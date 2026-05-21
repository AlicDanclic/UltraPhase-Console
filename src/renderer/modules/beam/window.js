/**
 * @module beam/window
 * @description 窗函数与幅度分布计算。
 * @author EternoPax
 * @version 1.0.0
 */

import { ELEMENT_COUNT } from "../constants.js";
import { clamp, sum, sumSquares } from "../utils.js";

/**
 * 生成一维窗函数系数（5 个元素）。
 * @param {string} name - "Flat"|"Stage2"|"Hann"|"Hamming"
 * @returns {number[]} 归一化系数（0-1）
 */
function oneDimWindow(name) {
  if (name === "Flat") return [1, 1, 1, 1, 1];
  if (name === "Stage2") return [160/255, 224/255, 1, 224/255, 160/255];
  const v = [];
  for (let i = 0; i < 5; i++) {
    const p = (2 * Math.PI * i) / 4;
    if (name === "Hann") v.push(0.5 - 0.5 * Math.cos(p));
    else if (name === "Hamming") v.push(0.54 - 0.46 * Math.cos(p));
    else v.push(1);
  }
  const peak = Math.max(...v, 1);
  return v.map(x => x / peak);
}

/**
 * 将一维窗函数扩展为 5×5 二维窗矩阵（外积）。
 * @param {string} name
 * @returns {number[]} 25 元素行优先数组
 */
function buildWindowMatrix(name) {
  const w = oneDimWindow(name);
  const m = [];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      m.push(w[r] * w[c]);
  return m;
}

/**
 * 根据窗函数、增益和功率策略计算 25 通道幅度分布。
 * @param {string} winName
 * @param {number} gainPct - 增益百分比（0-100）
 * @param {string} policy - "peak"|"equal_rms"
 * @returns {{amplitudes: number[], ampTable: number[], totalPowerRatio: number, coherentSumRatio: number, coherentEfficiency: number, clippedCount: number}}
 */
export function buildAmplitudeProfile(winName, gainPct, policy) {
  const gain = clamp(gainPct / 100, 0, 1);
  const wv = buildWindowMatrix(winName);
  const maxW = Math.max(...wv, 1);
  const rmsDen = sumSquares(wv);
  let scale;
  if (policy === "equal_rms") {
    scale = rmsDen > 0 ? gain * Math.sqrt(ELEMENT_COUNT / rmsDen) : 0;
  } else {
    scale = maxW > 0 ? gain / maxW : 0;
  }
  const amps = wv.map(w => clamp(w * scale, 0, 1));
  const ampTable = amps.map(v => Math.round(v * 255));
  return {
    amplitudes: amps, ampTable,
    totalPowerRatio: sumSquares(amps) / ELEMENT_COUNT,
    coherentSumRatio: sum(amps) / ELEMENT_COUNT,
    coherentEfficiency: sumSquares(amps) > 0 ? (sum(amps) ** 2) / (ELEMENT_COUNT * sumSquares(amps)) : 0,
    clippedCount: amps.filter(v => v >= 0.999).length
  };
}
