/**
 * @module audio-limit
 * @description 音频文件包络到 FPGA 动态占空比上限的发送控制。
 */

import { state, refs } from "./state.js";
import { appendLog } from "./log.js";
import * as bridge from "./bridge.js";

const AUDIO_SAMPLE_RATE = 4000;
const AUDIO_SOFT_LIMIT_DRIVE = 2.2;
const AUDIO_SOFT_LIMIT_LEVEL = 0.85;
const CHUNK_MS = 5;
const FIFO_LEAD_MS = 24;
const MAX_SEND_BATCH_MS = 24;
const BLE_CHUNK_BYTES = 20;
const MIN_LIMIT = 0;
const MAX_LIMIT = 255;
const STREAM_MAX_LIMIT = 254;

let audioSamples = [];
let streamTimer = null;
let streamIndex = 0;
let streamBusy = false;
let streamActive = false;
let streamStartTime = 0;
let audioContext = null;

function clampByte(value) {
  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.round(value)));
}

function clampStreamByte(value) {
  return Math.max(MIN_LIMIT, Math.min(STREAM_MAX_LIMIT, Math.round(value)));
}

function setStatus(text) {
  if (refs.audioStatus) refs.audioStatus.textContent = text;
}

function setRunningUi(running) {
  if (refs.audioStartButton) refs.audioStartButton.disabled = running;
  if (refs.audioStopButton) refs.audioStopButton.disabled = !running;
}

async function decodeAudioFile(file) {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  const buffer = await file.arrayBuffer();
  return audioContext.decodeAudioData(buffer);
}

function readMonoSample(channels, index) {
  let sample = 0;
  for (let ch = 0; ch < channels.length; ch++) sample += channels[ch][index] || 0;
  return sample / channels.length;
}

function softLimitSample(sample) {
  const driven = Math.tanh(sample * AUDIO_SOFT_LIMIT_DRIVE) / Math.tanh(AUDIO_SOFT_LIMIT_DRIVE);
  return Math.max(-1, Math.min(1, driven * AUDIO_SOFT_LIMIT_LEVEL));
}

function buildAudioSamples(audioBuffer) {
  const outputLength = Math.floor(audioBuffer.duration * AUDIO_SAMPLE_RATE);
  const channels = audioBuffer.numberOfChannels;
  const data = [];
  for (let ch = 0; ch < channels; ch++) data.push(audioBuffer.getChannelData(ch));

  const samples = [];
  let peak = 0;
  const mono = [];
  for (let i = 0; i < outputLength; i++) {
    const srcPos = i * audioBuffer.sampleRate / AUDIO_SAMPLE_RATE;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(audioBuffer.length - 1, i0 + 1);
    const frac = srcPos - i0;
    const s0 = readMonoSample(data, i0);
    const s1 = readMonoSample(data, i1);
    const sample = s0 + (s1 - s0) * frac;
    mono.push(sample);
    peak = Math.max(peak, Math.abs(sample));
  }

  const normalize = peak > 0 ? peak : 1;
  for (const sample of mono) {
    const normalized = Math.max(-1, Math.min(1, sample / normalize));
    const limited = softLimitSample(normalized);
    samples.push(clampStreamByte(127 + limited * 127));
  }
  return samples;
}

async function sendNextLimit() {
  if (!streamTimer || streamBusy || !audioSamples.length) return;
  streamBusy = true;
  try {
    const gain = Math.max(0, Math.min(1, Number(refs.audioGainNumber?.value || 100) / 100));
    const elapsedMs = Math.max(0, performance.now() - streamStartTime);
    const elapsedSamples = Math.floor(elapsedMs * AUDIO_SAMPLE_RATE / 1000);
    const leadSamples = Math.round(FIFO_LEAD_MS * AUDIO_SAMPLE_RATE / 1000);
    const maxBatchSamples = Math.round(MAX_SEND_BATCH_MS * AUDIO_SAMPLE_RATE / 1000);
    const targetIndex = Math.min(audioSamples.length, elapsedSamples + leadSamples);
    const end = Math.min(targetIndex, streamIndex + maxBatchSamples);
    if (streamIndex >= audioSamples.length) {
      if (elapsedSamples >= audioSamples.length) await stopAudioLimitStream("音频发送完成");
      else setStatus(`等待 FPGA 播放完成 缓冲 ${Math.round((audioSamples.length - elapsedSamples) * 1000 / AUDIO_SAMPLE_RATE)}ms`);
      return;
    }
    if (end <= streamIndex) return;

    const values = [];
    for (let i = streamIndex; i < end; i++) {
      const centered = audioSamples[i] - 127;
      values.push(clampStreamByte(127 + centered * gain));
    }
    if (state.bleMode) {
      for (let offset = 0; offset < values.length; offset += BLE_CHUNK_BYTES) {
        await bridge.sendDutyLimitBytes({ values: values.slice(offset, offset + BLE_CHUNK_BYTES) });
      }
    } else {
      await bridge.sendDutyLimitBytes({ values });
    }
    streamIndex = end;
    const leadNow = Math.max(0, streamIndex - elapsedSamples);
    const leadMs = Math.round(leadNow * 1000 / AUDIO_SAMPLE_RATE);
    setStatus(`发送中 ${streamIndex}/${audioSamples.length} 采样 缓冲 ${leadMs}ms 幅度 ${Math.round(gain * 100)}%`);
    if (streamIndex >= audioSamples.length && elapsedSamples >= audioSamples.length) {
      await stopAudioLimitStream("音频发送完成");
    }
  } catch (error) {
    await stopAudioLimitStream(`音频发送停止: ${error.message}`, "error");
  } finally {
    streamBusy = false;
  }
}

export async function startAudioLimitStream() {
  if (!state.connected) throw new Error(state.bleMode ? "BLE 已断开" : "请先连接串口");
  const file = refs.audioFileInput?.files?.[0];
  if (!file) throw new Error("请选择音频文件");

  await stopAudioLimitStream();
  setStatus("正在解析音频...");
  const audioBuffer = await decodeAudioFile(file);
  audioSamples = buildAudioSamples(audioBuffer);
  if (!audioSamples.length) throw new Error("音频数据为空");

  await bridge.startDutyLimitStream({ taskId: state.lastSolution?.task?.num || 0 });
  streamActive = true;
  streamIndex = 0;
  streamStartTime = performance.now();
  setRunningUi(true);
  appendLog(`${AUDIO_SAMPLE_RATE / 1000}kHz 音频发送启动: ${file.name}, ${audioSamples.length} 采样, 提前缓冲${FIFO_LEAD_MS}ms, 软限幅${Math.round(AUDIO_SOFT_LIMIT_LEVEL * 100)}%, ${state.bleMode ? `${BLE_CHUNK_BYTES}字节/BLE包` : `${CHUNK_MS}ms检查`}`);
  setStatus(`发送中 0/${audioSamples.length}`);
  streamTimer = setInterval(sendNextLimit, CHUNK_MS);
  await sendNextLimit();
}

export async function stopAudioLimitStream(reason = "音频发送已停止", level = "info") {
  const wasActive = streamActive;
  if (streamTimer) {
    clearInterval(streamTimer);
    streamTimer = null;
  }
  streamActive = false;
  if (wasActive && state.connected) {
    try { await bridge.stopDutyLimitStream(); }
    catch (error) { appendLog(`音频停止命令失败: ${error.message}`, "error"); }
  }
  if (wasActive) appendLog(reason, level);
  setRunningUi(false);
  if (refs.audioStatus) refs.audioStatus.textContent = reason;
}

export function initAudioLimitControls() {
  setRunningUi(false);
  if (refs.audioStartButton) {
    refs.audioStartButton.addEventListener("click", async () => {
      try { await startAudioLimitStream(); }
      catch (error) { appendLog(error.message, "error"); setStatus(error.message); setRunningUi(false); }
    });
  }
  if (refs.audioStopButton) {
    refs.audioStopButton.addEventListener("click", () => stopAudioLimitStream());
  }
  if (refs.audioFileInput) {
    refs.audioFileInput.addEventListener("change", () => {
      stopAudioLimitStream("音频文件已更换");
      setStatus(refs.audioFileInput.files?.[0]?.name || "未选择音频");
    });
  }
}
