/**
 * @module ui
 * @description UI 交互模块。负责 DOM 元素引用收集、控件绑定、任务模式切换、
 * 预设渲染、预览更新和事件绑定。
 *
 * 本模块是渲染进程的核心协调者，连接了：
 * - beam.js（波束计算）
 * - render.js（UI 渲染）
 * - connection.js（连接管理）
 * - log.js（日志输出）
 *
 * @author EternoPax
 * @version 1.0.0
 */

import { TASKS } from "./constants.js";
import { state, refs } from "./state.js";
import { solveMission } from "./beam/index.js";
import { renderBeam, renderMetrics, renderArrayGrid, renderSelectedCard, formatGrid } from "./render/index.js";
import { appendLog } from "./log.js";
import { initAudioLimitControls, stopAudioLimitStream } from "./audio-limit.js";
import {
  refreshPorts, setConnected, toggleConnection,
  bleScanAndConnect, bleDisconnect,
  applyBeam, pollStatus, disableRemote
} from "./connection.js";
// ── DOM refs ─────────────────────────────────────────────────

/**
 * 收集所有 DOM 元素引用并存入全局 refs 对象。
 * 在 initialize() 时调用一次，后续通过 refs[id] 访问。
 *
 * @returns {void}
 */
export function collectRefs() {
  ["taskTab_task1","taskTab_task2","taskTab_task3","taskTitle","taskSummary","presetButtons",
   "missionBadge","missionNote","portSelect","baudSelect","connectButton","refreshPortsButton",
   "bleScanButton","applyBeamButton","disableRemoteButton","getStatusButton",
   "thetaXRange","thetaXNumber","thetaYRange","thetaYNumber",
   "focusRow","focusRange","focusNumber","gainRange","gainNumber",
   "windowField","windowSelect","powerPolicyField","powerPolicySelect",
   "pressureStrategyField","pressureStrategySelect","adcCheckbox",
   "audioFileInput","audioGainRange","audioGainNumber","audioStartButton","audioStopButton","audioStatus",
   "connectionStatus","shadowState","activeState","adcState","pendingState","localState","protocolState",
   "beamCanvas","beamCaption","viewModeSelect","arrayGrid","metricsGrid","selectedCard","phaseTableText","ampTableText",
   "activityLog","activityLogPanel","activityLogHeader","activityLogBody",
   "clearLogButton","toggleLogButton",
   "bleOverlay","bleDeviceList","bleCancelBtn"
  ].forEach(id => { refs[id] = document.getElementById(id); });
}

// ── Control binding ──────────────────────────────────────────

/**
 * 绑定 range 滑块与 number 输入框的双向同步。
 * 任一控件变化时同步另一个的值并触发回调。
 *
 * @param {string} rKey - range 控件在 refs 中的键名
 * @param {string} nKey - number 控件在 refs 中的键名
 * @param {Function} cb - 值变化时的回调函数
 * @returns {void}
 */
function bindRangeAndNumber(rKey, nKey, cb) {
  const r = refs[rKey], n = refs[nKey];
  r.addEventListener("input", () => { n.value = r.value; cb(); });
  n.addEventListener("input", () => { r.value = n.value; cb(); });
}

/**
 * 从 DOM 控件读取当前控制参数值。
 * @returns {Object} 控制参数对象
 */
function getControlValues() {
  return {
    thetaX: Number(refs.thetaXNumber.value), thetaY: Number(refs.thetaYNumber.value),
    focusMm: Number(refs.focusNumber.value), gainPercent: Number(refs.gainNumber.value),
    windowName: refs.windowSelect.value, useAdcEnvelope: refs.adcCheckbox.checked,
    powerPolicy: refs.powerPolicySelect.value, pressureStrategy: refs.pressureStrategySelect.value
  };
}

/**
 * 批量设置控件值。仅更新 u 中定义的字段。
 * @param {Object} u - 要更新的控件值对象
 * @returns {void}
 */
function setControlValues(u) {
  if (u.thetaX !== undefined) { refs.thetaXRange.value = u.thetaX; refs.thetaXNumber.value = u.thetaX; }
  if (u.thetaY !== undefined) { refs.thetaYRange.value = u.thetaY; refs.thetaYNumber.value = u.thetaY; }
  if (u.focusMm !== undefined) { refs.focusRange.value = u.focusMm; refs.focusNumber.value = u.focusMm; }
  if (u.gainPercent !== undefined) { refs.gainRange.value = u.gainPercent; refs.gainNumber.value = u.gainPercent; }
  if (u.windowName !== undefined) refs.windowSelect.value = u.windowName;
  if (u.useAdcEnvelope !== undefined) refs.adcCheckbox.checked = Boolean(u.useAdcEnvelope);
  if (u.powerPolicy !== undefined) refs.powerPolicySelect.value = u.powerPolicy;
  if (u.pressureStrategy !== undefined) refs.pressureStrategySelect.value = u.pressureStrategy;
}

// ── Task mode ────────────────────────────────────────────────

/**
 * 切换任务模式。
 * 更新标签页高亮、标题、描述，可选应用默认参数，
 * 重新渲染预设按钮并刷新预览。
 *
 * @param {string} mode - 任务模式（"task1"|"task2"|"task3"）
 * @param {boolean} applyDefaults - 是否应用该任务的默认参数
 * @returns {void}
 */
export function updateTaskMode(mode, applyDefaults) {
  state.taskMode = mode;
  if (mode === "task1" && state.viewMode === "volume") {
    state.viewMode = "surface";
    refs.viewModeSelect.value = "surface";
  }
  const task = TASKS[mode];
  refs.taskTab_task1.classList.toggle("active", mode === "task1");
  refs.taskTab_task2.classList.toggle("active", mode === "task2");
  refs.taskTab_task3.classList.toggle("active", mode === "task3");
  refs.taskTitle.textContent = task.title;
  refs.taskSummary.textContent = task.description;
  refs.missionBadge.textContent = task.label;
  if (applyDefaults) setControlValues(task.defaults);
  renderPresets(task.presets);
  refreshVisibility();
  updatePreview();
}

/**
 * 渲染预设按钮列表。
 * 点击预设按钮时应用对应的参数更新并刷新预览。
 *
 * @param {Array<{label: string, updates: Object}>} presets - 预设配置数组
 * @returns {void}
 */
function renderPresets(presets) {
  refs.presetButtons.textContent = "";
  presets.forEach(p => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preset-button";
    btn.textContent = p.label;
    btn.addEventListener("click", () => {
      setControlValues(p.updates);
      refreshVisibility();
      updatePreview();
      appendLog(`预设：${p.label}`);
    });
    refs.presetButtons.appendChild(btn);
  });
}

/**
 * 根据当前任务模式刷新控件可见性。
 * - 任务 1：隐藏焦距控件
 * - 任务 3：显示压力策略，根据策略锁定窗函数和功率策略
 *
 * @returns {void}
 */
function refreshVisibility() {
  const isT1 = state.taskMode === "task1";
  const isT3 = state.taskMode === "task3";
  refs.focusRow.classList.toggle("hidden", isT1);
  refs.pressureStrategyField.classList.toggle("hidden", !isT3);
  const force = isT3 && refs.pressureStrategySelect.value !== "equal_rms_compare";
  refs.windowField.classList.toggle("disabled-field", force);
  refs.windowSelect.disabled = force;
  if (isT3) {
    const ps = refs.pressureStrategySelect.value;
    if (ps === "max_pressure") { refs.windowSelect.value = "Flat"; refs.powerPolicySelect.value = "peak"; }
    else if (ps === "balanced_focus") { refs.windowSelect.value = "Stage2"; refs.powerPolicySelect.value = "peak"; }
    else refs.powerPolicySelect.value = "equal_rms";
  }
}

// ── Preview update ───────────────────────────────────────────

/**
 * 刷新声场预览。
 * 调用 solveMission() 计算当前任务解，更新：
 * - 声场热力图
 * - 指标面板
 * - 5×5 阵列网格
 * - 选中阵元卡片
 * - 相位/幅度数据表
 * - 任务描述文本
 *
 * @returns {void}
 */
export function updatePreview() {
  const sol = solveMission();
  state.lastSolution = sol;
  state.phaseTable = sol.phaseTable;
  state.ampTable = sol.ampTable;
  const view = (state.viewMode === "volume" && sol.volumeView)
    ? sol.volumeView
    : sol.view;
  renderBeam(view, state.viewMode);
  renderMetrics(sol.metrics);
  renderArrayGrid();
  renderSelectedCard();
  refs.phaseTableText.textContent = formatGrid(state.phaseTable);
  refs.ampTableText.textContent = formatGrid(state.ampTable);
  refs.missionNote.textContent = sol.note;
}

// ── Wire up events ───────────────────────────────────────────

/**
 * 绑定所有 UI 事件处理器。
 * 包括：
 * - 滑块/输入框双向同步（θX、θY、焦距、增益）
 * - 下拉框/复选框变化事件
 * - 任务标签页切换
 * - 串口刷新/连接/断开按钮
 * - BLE 扫描/断开按钮
 * - 应用/状态/关闭远程按钮
 *
 * @returns {void}
 */
export function wireActions() {
  initAudioLimitControls();

  bindRangeAndNumber("thetaXRange", "thetaXNumber", updatePreview);
  bindRangeAndNumber("thetaYRange", "thetaYNumber", updatePreview);
  bindRangeAndNumber("focusRange", "focusNumber", updatePreview);
  bindRangeAndNumber("gainRange", "gainNumber", updatePreview);
  bindRangeAndNumber("audioGainRange", "audioGainNumber", () => {});

  refs.windowSelect.addEventListener("change", updatePreview);
  refs.adcCheckbox.addEventListener("change", updatePreview);
  refs.powerPolicySelect.addEventListener("change", updatePreview);
  refs.pressureStrategySelect.addEventListener("change", () => { refreshVisibility(); updatePreview(); });
  refs.viewModeSelect.addEventListener("change", () => { state.viewMode = refs.viewModeSelect.value; updatePreview(); });

  refs.taskTab_task1.addEventListener("click", () => updateTaskMode("task1", true));
  refs.taskTab_task2.addEventListener("click", () => updateTaskMode("task2", true));
  refs.taskTab_task3.addEventListener("click", () => updateTaskMode("task3", true));

  refs.refreshPortsButton.addEventListener("click", async () => {
    try { await refreshPorts(); appendLog("串口已刷新"); } catch (e) { appendLog(e.message, "error"); }
  });

  refs.connectButton.addEventListener("click", async () => {
    try { await stopAudioLimitStream("其他发送/连接操作触发，音频发送已停止"); if (state.bleMode) await bleDisconnect(); else await toggleConnection(); } catch (e) { appendLog(e.message, "error"); }
  });

  refs.bleScanButton.addEventListener("click", async () => {
    try {
      await stopAudioLimitStream("其他发送/连接操作触发，音频发送已停止");
      if (state.bleMode) await bleDisconnect();
      else if (state.connected) appendLog("请先断开串口", "error");
      else await bleScanAndConnect();
    } catch (e) { appendLog(e.message, "error"); }
  });

  refs.bleCancelBtn.addEventListener("click", () => { refs.bleOverlay.classList.add("hidden"); });

  refs.applyBeamButton.addEventListener("click", async () => { try { await stopAudioLimitStream("其他发送操作触发，音频发送已停止"); await applyBeam(); } catch (e) { appendLog(e.message, "error"); } });
  refs.getStatusButton.addEventListener("click", async () => { try { await stopAudioLimitStream("其他发送操作触发，音频发送已停止"); await pollStatus(); } catch (e) { appendLog(e.message, "error"); } });
  refs.disableRemoteButton.addEventListener("click", async () => { try { await stopAudioLimitStream("其他发送操作触发，音频发送已停止"); await disableRemote(); } catch (e) { appendLog(e.message, "error"); } });
}
