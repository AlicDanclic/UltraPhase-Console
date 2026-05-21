/**
 * @module utils
 * @description 纯数学工具函数。无副作用，无外部依赖。
 * @author EternoPax
 * @version 1.0.0
 */

/**
 * 将值限制在指定范围内。
 * @param {number} v - 输入值
 * @param {number} lo - 下限
 * @param {number} hi - 上限
 * @returns {number}
 */
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * 计算数组元素之和。
 * @param {number[]} arr
 * @returns {number}
 */
export function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

/**
 * 计算数组元素的平方和。
 * @param {number[]} arr
 * @returns {number}
 */
export function sumSquares(arr) { return arr.reduce((a, b) => a + b * b, 0); }

/**
 * 提取正小数部分（永远返回 [0, 1) 的值）。
 * 用于相位归一化，避免负数取模的歧义。
 * @param {number} v
 * @returns {number}
 */
export function frac(v) { return ((v % 1) + 1) % 1; }

/**
 * 将相位字节值（0-255）转换为弧度（0-2π）。
 * @param {number} b
 * @returns {number}
 */
export function phaseByteToRad(b) { return (b / 256) * 2 * Math.PI; }
