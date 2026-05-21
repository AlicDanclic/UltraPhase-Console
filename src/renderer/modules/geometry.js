/**
 * @module geometry
 * @description 5×5 阵列的物理坐标生成。
 * @author EternoPax
 * @version 1.0.0
 */

import { ARRAY_SIZE, PITCH_M } from "./constants.js";

/**
 * 计算 5×5 阵列中每个阵元的物理坐标。
 * 原点位于阵列中心，阵元间距为 PITCH_M。
 *
 * PCB 通道按行蛇形走线：
 * 第 1 行 CH01..CH05 从左到右；
 * 第 2 行 CH06..CH10 从右到左；
 * 后续行依次交替。
 *
 * 数组下标仍然保持逻辑通道顺序 CH01..CH25，row/col/x/y 表示该通道的真实物理位置。
 * @returns {Array<{row: number, col: number, x: number, y: number}>}
 */
function arrayPositions() {
  const c = [];
  for (let r = 0; r < ARRAY_SIZE; r++) {
    for (let logicalCol = 0; logicalCol < ARRAY_SIZE; logicalCol++) {
      const col = (r % 2 === 0) ? logicalCol : (ARRAY_SIZE - 1 - logicalCol);
      c.push({ row: r, col, x: (col - 2) * PITCH_M, y: (r - 2) * PITCH_M });
    }
  }
  return c;
}

/** 25 个阵元的物理坐标 */
export const ARRAY_POSITIONS = arrayPositions();
