/**
 * @module render/color
 * @description 声压值到热力图颜色的映射。
 * @author EternoPax
 * @version 1.0.0
 */

import { clamp } from "../utils.js";

/**
 * 将归一化声压值（0-1）映射为热力图颜色。
 * 平方根映射增强低值对比度，色相从蓝（冷）到红（暖）渐变。
 * @param {number} v - 归一化声压值
 * @returns {string} CSS hsl 颜色字符串
 */
export function valueToColor(v) {
  const l = clamp(v, 0, 1);
  const t = Math.sqrt(l);
  const hue = 240 - t * 240;
  const sat = 80 + t * 20;
  const light = 5 + t * 55;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}
