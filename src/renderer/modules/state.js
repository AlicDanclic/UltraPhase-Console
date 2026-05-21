/**
 * @module state
 * @description 应用全局共享状态和 DOM 引用缓存。
 * @author EternoPax
 * @version 1.0.0
 */

const ELEMENT_COUNT = 25;

/**
 * 应用全局共享状态。所有模块通过引用同一对象实现状态同步。
 */
export const state = {
  connected: false,
  bleDevice: null,
  bleServer: null,
  bleCharacteristic: null,
  bleMode: false,
  taskMode: "task1",
  viewMode: "surface",
  selectedIndex: 12,
  phaseTable: new Array(ELEMENT_COUNT).fill(0),
  ampTable: new Array(ELEMENT_COUNT).fill(255),
  lastSolution: null
};

/**
 * DOM 元素引用缓存。由 ui.collectRefs() 在初始化时填充。
 */
export const refs = {};
