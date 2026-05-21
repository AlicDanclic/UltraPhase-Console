/**
 * @module beam/field
 * @description 远场波束方向图和聚焦声场的二维网格计算。
 * @author EternoPax
 * @version 1.0.0
 */

import { WAVE_NUMBER, ARRAY_SIZE, PITCH_M } from "../constants.js";
import { ARRAY_POSITIONS } from "../geometry.js";
import { clamp, phaseByteToRad } from "../utils.js";

/**
 * 计算远场波束方向图（73×73 网格）。
 * @param {number[]} amps - 25 通道归一化幅度（0-1）
 * @param {number[]} phase - 25 通道相位字节（0-255）
 * @param {Object} ctrl - 控制参数
 * @returns {Object} 声场视图数据
 */
export function computeFarField(amps, phase, ctrl) {
  const W = 73, H = 73;
  const vals = new Array(W * H).fill(0);
  let max = 0;
  for (let r = 0; r < H; r++) {
    const ty = 30 - (60 * r) / (H - 1);      // θy: y‑z 平面偏转角
    const sy = Math.sin(ty * Math.PI / 180); // sin(θy)
    for (let c = 0; c < W; c++) {
      const tx = -30 + (60 * c) / (W - 1);      // θx: x‑z 平面偏转角
      const sx = Math.sin(tx * Math.PI / 180); // sin(θx)
      let re = 0, im = 0;
      for (let i = 0; i < 25; i++) {
        const ph = phaseByteToRad(phase[i]) - WAVE_NUMBER * (ARRAY_POSITIONS[i].x * sx + ARRAY_POSITIONS[i].y * sy);
        re += amps[i] * Math.cos(ph);
        im += amps[i] * Math.sin(ph);
      }
      const v = re * re + im * im;
      vals[r * W + c] = v;
      if (v > max) max = v;
    }
  }
  if (max > 0) for (let i = 0; i < vals.length; i++) vals[i] /= max;
  return { kind: "farfield", width: W, height: H, values: vals, xMin: -30, xMax: 30, yMin: -30, yMax: 30, xLabel: "θX (度)", yLabel: "θY (度)", marker: { x: ctrl.thetaX, y: ctrl.thetaY } };
}

/**
 * 计算近场聚焦声场（89×73 网格）。
 * @param {number[]} amps - 25 通道归一化幅度（0-1）
 * @param {number[]} phase - 25 通道相位字节（0-255）
 * @param {Object} ctrl - 控制参数
 * @param {{x: number, y: number, z: number}} tp - 目标焦点坐标（米）
 * @returns {Object} 声场视图数据
 */
export function computeFocus(amps, phase, ctrl, tp) {
  const W = 89, H = 73;
  const xSpan = 0.22;
  const xMin = tp.x - xSpan, xMax = tp.x + xSpan;
  const zMin = clamp(tp.z - 0.38, 0.18, 1.5), zMax = clamp(tp.z + 0.38, 0.32, 1.8);
  const vals = new Array(W * H).fill(0);
  let max = 0;
  for (let r = 0; r < H; r++) {
    const z = zMax - ((zMax - zMin) * r) / (H - 1);
    for (let c = 0; c < W; c++) {
      const x = xMin + ((xMax - xMin) * c) / (W - 1);
      let re = 0, im = 0;
      for (let i = 0; i < 25; i++) {
        const p = ARRAY_POSITIONS[i];
        const d = Math.hypot(x - p.x, tp.y - p.y, z);
        const ph = phaseByteToRad(phase[i]) - WAVE_NUMBER * d;
        const w = amps[i] / Math.max(d, 0.05);
        re += w * Math.cos(ph);
        im += w * Math.sin(ph);
      }
      const v = re * re + im * im;
      vals[r * W + c] = v;
      if (v > max) max = v;
    }
  }
  if (max > 0) for (let i = 0; i < vals.length; i++) vals[i] /= max;
  return { kind: "focus", width: W, height: H, values: vals, xMin, xMax, yMin: zMin, yMax: zMax, xLabel: "X (mm)", yLabel: "Z (mm)", marker: { x: tp.x, y: tp.z } };
}

/**
 * 计算三维体积声场（X-Y 平面 + Z 传播距离）。
 * 使用球面波模型，在三维网格上计算声压强度分布。
 *
 * @param {number[]} amps - 25 通道归一化幅度（0-1）
 * @param {number[]} phase - 25 通道相位字节（0-255）
 * @param {Object} ctrl - 控制参数
 * @param {{x: number, y: number, z: number}} tp - 目标焦点坐标（米）
 * @returns {Object} 体积声场视图数据
 */
export function computeVolume3D(amps, phase, ctrl, tp) {
  const NX = 31, NY = 31, NZ = 21;
  const span = 0.08;
  const xMin = tp.x - span, xMax = tp.x + span;
  const yMin = tp.y - span, yMax = tp.y + span;
  const zMin = clamp(tp.z - 0.5, 0.1, 1.3);
  const zMax = clamp(tp.z + 0.5, 0.7, 1.8);

  const total = NX * NY * NZ;
  const vals = new Float32Array(total);
  let max = 0;

  for (let iz = 0; iz < NZ; iz++) {
    const z = zMin + ((zMax - zMin) * iz) / (NZ - 1);
    for (let iy = 0; iy < NY; iy++) {
      const y = yMin + ((yMax - yMin) * iy) / (NY - 1);
      for (let ix = 0; ix < NX; ix++) {
        const x = xMin + ((xMax - xMin) * ix) / (NX - 1);
        let re = 0, im = 0;
        for (let i = 0; i < 25; i++) {
          const p = ARRAY_POSITIONS[i];
          const d = Math.hypot(x - p.x, y - p.y, z);
          const ph = phaseByteToRad(phase[i]) - WAVE_NUMBER * d;
          const w = amps[i] / Math.max(d, 0.05);
          re += w * Math.cos(ph);
          im += w * Math.sin(ph);
        }
        const v = re * re + im * im;
        const idx = iz * NX * NY + iy * NX + ix;
        vals[idx] = v;
        if (v > max) max = v;
      }
    }
  }

  if (max > 0) for (let i = 0; i < total; i++) vals[i] /= max;

  // 轴上声压 profile（x=焦点x, y=焦点y, 沿 z）
  const centerProfile = new Float32Array(NZ);
  const cx = NX >> 1, cy = NY >> 1;
  for (let iz = 0; iz < NZ; iz++) {
    centerProfile[iz] = vals[iz * NX * NY + cy * NX + cx];
  }

  return {
    kind: "volume3d",
    nx: NX, ny: NY, nz: NZ,
    xMin, xMax, yMin, yMax, zMin, zMax,
    values: vals,
    centerProfile,
    xLabel: "X (mm)", yLabel: "Y (mm)", zLabel: "Z (mm)",
    marker: { x: tp.x, y: tp.y, z: tp.z }
  };
}
