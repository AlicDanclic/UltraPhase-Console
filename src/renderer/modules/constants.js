/**
 * @module constants
 * @description 物理常量、任务定义和 BLE UUID。
 * @author EternoPax
 * @version 1.0.0
 */

// ── Physics constants ────────────────────────────────────────

/** @type {number} 阵列边长（5×5 阵列） */
export const ARRAY_SIZE = 5;

/** @type {number} 阵元总数（25 个通道） */
export const ELEMENT_COUNT = ARRAY_SIZE * ARRAY_SIZE;

/** @type {number} 阵元间距，单位：米（16mm） */
export const PITCH_M = 0.016;

/** @type {number} 声速，单位：米/秒 */
export const SPEED_OF_SOUND = 343.0;

/** @type {number} 超声载波频率，单位：赫兹（40kHz） */
export const CARRIER_HZ = 40000.0;

/** @type {number} 波长，单位：米 */
export const WAVELENGTH_M = SPEED_OF_SOUND / CARRIER_HZ;

/** @type {number} 波数（2π / 波长），单位：弧度/米 */
export const WAVE_NUMBER = (2 * Math.PI) / WAVELENGTH_M;

// ── Task definitions ─────────────────────────────────────────

export const TASKS = {
  task1: {
    id: "task1", label: "任务 1", num: 1,
    title: "任务 1：加窗波束偏转",
    description: "使用空间窗函数抑制旁瓣，通过电控方式偏转声学主瓣。",
    defaults: { thetaX: 12, thetaY: 0, focusMm: 800, gainPercent: 100, windowName: "Stage2", useAdcEnvelope: false, powerPolicy: "peak", pressureStrategy: "max_pressure" },
    presets: [
      { label: "左偏 -12°", updates: { thetaX: -12, thetaY: 0, windowName: "Stage2", gainPercent: 100 } },
      { label: "中心", updates: { thetaX: 0, thetaY: 0, windowName: "Stage2", gainPercent: 100 } },
      { label: "右偏 +12°", updates: { thetaX: 12, thetaY: 0, windowName: "Stage2", gainPercent: 100 } },
      { label: "对角线", updates: { thetaX: 10, thetaY: 10, windowName: "Hamming", gainPercent: 95 } }
    ]
  },
  task2: {
    id: "task2", label: "任务 2", num: 2,
    title: "任务 2：距离聚焦",
    description: "利用逐阵元相位曲率在指定方向和距离上聚焦波束。",
    defaults: { thetaX: 0, thetaY: 0, focusMm: 800, gainPercent: 100, windowName: "Stage2", useAdcEnvelope: true, powerPolicy: "peak", pressureStrategy: "max_pressure" },
    presets: [
      { label: "0.50 米", updates: { thetaX: 0, thetaY: 0, focusMm: 500, windowName: "Stage2" } },
      { label: "0.80 米", updates: { thetaX: 0, thetaY: 0, focusMm: 800, windowName: "Stage2" } },
      { label: "1.20 米", updates: { thetaX: 0, thetaY: 0, focusMm: 1200, windowName: "Stage2" } },
      { label: "偏移聚焦", updates: { thetaX: 8, thetaY: -6, focusMm: 700, windowName: "Hamming" } }
    ]
  },
  task3: {
    id: "task3", label: "任务 3", num: 3,
    title: "任务 3：功率导向聚焦",
    description: "在可用驱动预算下最大化焦点声压，并对比不同的孔径策略。",
    defaults: { thetaX: 0, thetaY: 0, focusMm: 800, gainPercent: 100, windowName: "Flat", useAdcEnvelope: true, powerPolicy: "peak", pressureStrategy: "max_pressure" },
    presets: [
      { label: "最大压力", updates: { pressureStrategy: "max_pressure", gainPercent: 100, focusMm: 800 } },
      { label: "均衡聚焦", updates: { pressureStrategy: "balanced_focus", gainPercent: 100, focusMm: 800 } },
      { label: "等-RMS 对比", updates: { pressureStrategy: "equal_rms_compare", gainPercent: 72, windowName: "Stage2" } },
      { label: "远距离", updates: { pressureStrategy: "max_pressure", gainPercent: 100, focusMm: 1200 } }
    ]
  }
};

// ── BLE UUIDs ────────────────────────────────────────────────

/** @type {number} BLE GATT 服务 UUID（0xFFE0） */
export const BLE_SERVICE_UUID = 0xFFE0;

/** @type {number} BLE GATT 特征值 UUID（0xFFE1） */
export const BLE_CHAR_UUID = 0xFFE1;
