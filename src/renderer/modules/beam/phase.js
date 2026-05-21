/**
 * @module beam/phase
 * @description 相位表构建：远场偏转与近场聚焦。
 * @author EternoPax
 * @version 1.0.0
 */

import { WAVELENGTH_M } from "../constants.js";
import { ARRAY_POSITIONS } from "../geometry.js";
import { frac } from "../utils.js";

/**
 * 计算远场波束偏转相位表。
 * @param {number} tx - X 方向偏转角度（度）
 * @param {number} ty - Y 方向偏转角度（度）
 * @returns {number[]} 25 通道相位字节（0-255）
 */
export function buildSteeringPhaseTable(tx, ty) {
  const sx = Math.sin(tx * Math.PI / 180);
  const sy = Math.sin(ty * Math.PI / 180);
  return ARRAY_POSITIONS.map(p => {
    const norm = frac((p.x * sx + p.y * sy) / WAVELENGTH_M);
    return Math.round(norm * 256) & 0xff;
  });
}

/**
 * 计算近场聚焦相位表。
 * @param {number} tx - X 方向偏转角度（度）
 * @param {number} ty - Y 方向偏转角度（度）
 * @param {number} fmm - 焦距（毫米）
 * @returns {number[]} 25 通道相位字节（0-255）
 */
export function buildFocusPhaseTable(tx, ty, fmm) {
  const fz = Math.max(fmm / 1000, 0.05);
  const fx = fz * Math.tan(tx * Math.PI / 180);
  const fy = fz * Math.tan(ty * Math.PI / 180);
  const cd = Math.hypot(fx, fy, fz);
  return ARRAY_POSITIONS.map(p => {
    const d = Math.hypot(p.x - fx, p.y - fy, fz);
    const norm = frac((d - cd) / WAVELENGTH_M);
    return Math.round(norm * 256) & 0xff;
  });
}
