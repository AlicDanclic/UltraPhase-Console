/**
 * @module bridge
 * @description 环境检测与 API 桥接模块。
 *
 * 自动检测当前运行环境（Electron 或浏览器），并提供统一的接口：
 * - Electron 环境：通过 `window.ultrasonicHost`（preload 注入的 IPC 桥）调用
 * - 浏览器环境：通过 HTTP REST API（`/api/*`）调用
 *
 * 本模块对外暴露与 `window.ultrasonicHost` 完全相同的接口，
 * 其他模块无需关心底层通信方式。
 *
 * @author EternoPax
 * @version 1.0.0
 */

/**
 * 检测当前是否运行在 Electron 环境中。
 * @returns {boolean} 如果存在 window.ultrasonicHost 则为 Electron 环境
 */
function isElectron() {
  return typeof window !== "undefined" && typeof window.ultrasonicHost !== "undefined";
}

/**
 * 向主进程或 API 服务器发送日志消息。
 * Electron 环境下由主进程处理，浏览器环境下输出到控制台。
 *
 * @param {string} message - 日志消息
 * @param {"info"|"error"} [type="info"] - 日志级别
 * @returns {void}
 */
export function sendLog(message, type = "info") {
  if (isElectron()) {
    // Electron 环境：日志由主进程 onLog 回调处理
    // 此处无需额外操作
  } else {
    // 浏览器环境：输出到控制台
    if (type === "error") {
      console.error(`[LOG] ${message}`);
    } else {
      console.log(`[LOG] ${message}`);
    }
  }
}

// ── 串口管理 ─────────────────────────────────────────────────

/**
 * 获取可用串口列表。
 *
 * @async
 * @returns {Promise<Array<{path: string, manufacturer: string, friendlyName: string}>>}
 */
export async function listPorts() {
  if (isElectron()) return window.ultrasonicHost.listPorts();
  const res = await fetch("/api/ports");
  if (!res.ok) throw new Error(`获取串口失败: ${res.status}`);
  return res.json();
}

/**
 * 获取当前连接状态信息。
 *
 * @async
 * @returns {Promise<{connected: boolean, path: string, baudRate: number, bleMode: boolean}>}
 */
export async function getConnectionInfo() {
  if (isElectron()) return window.ultrasonicHost.getConnectionInfo();
  const res = await fetch("/api/connection");
  if (!res.ok) throw new Error(`获取连接状态失败: ${res.status}`);
  return res.json();
}

/**
 * 连接指定串口。
 *
 * @async
 * @param {{path: string, baudRate: number}} options - 串口路径与波特率
 * @returns {Promise<{connected: boolean, path: string, baudRate: number}>}
 */
export async function connect(options) {
  if (isElectron()) return window.ultrasonicHost.connect(options);
  const res = await fetch("/api/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `连接失败: ${res.status}`);
  return data;
}

/**
 * 断开当前连接。
 *
 * @async
 * @returns {Promise<{connected: boolean, path: string, baudRate: number}>}
 */
export async function disconnect() {
  if (isElectron()) return window.ultrasonicHost.disconnect();
  const res = await fetch("/api/disconnect", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `断开失败: ${res.status}`);
  return data;
}

// ── 波束控制 ─────────────────────────────────────────────────

/**
 * 应用波束任务到 FPGA。
 * 执行完整四步流程：握手 → 幅度数据 → 相位数据 → 应用命令。
 *
 * @async
 * @param {{taskId: number, phaseTable: number[], ampTable: number[]}} payload - 任务载荷
 * @returns {Promise<{success: boolean}>}
 */
export async function applyBeam(payload) {
  if (isElectron()) return window.ultrasonicHost.applyBeam(payload);
  const res = await fetch("/api/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `应用失败: ${res.status}`);
  return data;
}

/**
 * 查询 FPGA 当前状态。
 *
 * @async
 * @returns {Promise<{address: string, aa: string, bb: string, cc: string}>}
 */
export async function getStatus() {
  if (isElectron()) return window.ultrasonicHost.getStatus();
  const res = await fetch("/api/status", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `状态查询失败: ${res.status}`);
  return data;
}

/**
 * 设置 FPGA 动态占空比上限。
 *
 * @async
 * @param {{taskId?: number, value: number}} payload - 0-255 上限值
 * @returns {Promise<{address: string, aa: string, bb: string, cc: string}>}
 */
export async function setDutyLimit(payload) {
  if (isElectron()) return window.ultrasonicHost.setDutyLimit(payload);
  const res = await fetch("/api/duty-limit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `占空比上限设置失败: ${res.status}`);
  return data;
}

/**
 * 启动 FPGA 动态占空比流模式。
 *
 * @async
 * @param {{taskId?: number}} payload
 * @returns {Promise<{address: string, aa: string, bb: string, cc: string}>}
 */
export async function startDutyLimitStream(payload) {
  if (isElectron()) return window.ultrasonicHost.startDutyLimitStream(payload);
  const res = await fetch("/api/duty-limit-stream/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `占空比流启动失败: ${res.status}`);
  return data;
}

/**
 * 发送一个 FPGA 动态占空比流原始字节。
 *
 * @async
 * @param {{value: number}} payload
 * @returns {Promise<{value: number}>}
 */
export async function sendDutyLimitByte(payload) {
  if (isElectron()) return window.ultrasonicHost.sendDutyLimitByte(payload);
  const res = await fetch("/api/duty-limit-stream/byte", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `占空比字节发送失败: ${res.status}`);
  return data;
}

/**
 * 批量发送 FPGA 动态占空比流原始字节。
 *
 * @async
 * @param {{values: number[]}} payload
 * @returns {Promise<{count: number}>}
 */
export async function sendDutyLimitBytes(payload) {
  if (isElectron()) return window.ultrasonicHost.sendDutyLimitBytes(payload);
  const res = await fetch("/api/duty-limit-stream/bytes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `占空比字节批量发送失败: ${res.status}`);
  return data;
}

/**
 * 停止 FPGA 动态占空比流模式。
 *
 * @async
 * @returns {Promise<{success: boolean}>}
 */
export async function stopDutyLimitStream() {
  if (isElectron()) return window.ultrasonicHost.stopDutyLimitStream();
  const res = await fetch("/api/duty-limit-stream/stop", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `占空比流停止失败: ${res.status}`);
  return data;
}

/**
 * 关闭 FPGA 远程控制模式。
 *
 * @async
 * @returns {Promise<{address: string, aa: string, bb: string, cc: string}>}
 */
export async function disableRemote() {
  if (isElectron()) return window.ultrasonicHost.disableRemote();
  const res = await fetch("/api/disable-remote", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `关闭远程失败: ${res.status}`);
  return data;
}

// ── BLE 蓝牙（仅 Electron 环境可用）──────────────────────────

/**
 * 通过 BLE 蓝牙建立连接。
 * 仅在 Electron 环境下可用，浏览器环境下抛出错误。
 *
 * @async
 * @param {{deviceName: string, baudRate: number}} options - 设备名与波特率
 * @returns {Promise<{connected: boolean, path: string, baudRate: number, bleMode: boolean}>}
 * @throws {Error} 浏览器环境下抛出不支持错误
 */
export async function bleConnect(options) {
  if (isElectron()) return window.ultrasonicHost.bleConnect(options);
  throw new Error("BLE 连接仅在 Electron 环境下可用");
}

/**
 * 断开 BLE 蓝牙连接。
 * 仅在 Electron 环境下可用。
 *
 * @async
 * @returns {Promise<{connected: boolean, path: string, baudRate: number}>}
 * @throws {Error} 浏览器环境下抛出不支持错误
 */
export async function bleDisconnect() {
  if (isElectron()) return window.ultrasonicHost.bleDisconnect();
  throw new Error("BLE 断开仅在 Electron 环境下可用");
}

/**
 * 向 BLE 特征值写入数据。
 * 仅在 Electron 环境下可用。
 *
 * @param {number[]} data - 字节数组
 * @returns {Promise<void>}
 * @throws {Error} 浏览器环境下抛出不支持错误
 */
export async function bleSendData(data) {
  if (isElectron()) return window.ultrasonicHost.bleSendData(data);
  throw new Error("BLE 数据写入仅在 Electron 环境下可用");
}

/**
 * 选择 BLE 设备（用户在对话框中点击后调用）。
 * 仅在 Electron 环境下可用。
 *
 * @param {string} deviceId - 选中的设备 ID
 * @returns {void}
 * @throws {Error} 浏览器环境下抛出不支持错误
 */
export function bleSelectDevice(deviceId) {
  if (isElectron()) {
    window.ultrasonicHost.bleSelectDevice(deviceId);
    return;
  }
  throw new Error("BLE 设备选择仅在 Electron 环境下可用");
}

// ── 事件回调注册（仅 Electron 环境）─────────────────────────

/**
 * 注册主进程日志回调。
 * 仅在 Electron 环境下生效，浏览器环境下忽略。
 *
 * @param {function(string, "info"|"error"): void} callback - 日志回调
 * @returns {void}
 */
export function onLog(callback) {
  if (isElectron() && window.ultrasonicHost.onLog) {
    window.ultrasonicHost.onLog(callback);
  }
}

/**
 * 注册 BLE 数据写入回调。
 * 仅在 Electron 环境下生效。
 *
 * @param {function(number[]): void} callback - 数据回调
 * @returns {void}
 */
export function onBleWrite(callback) {
  if (isElectron() && window.ultrasonicHost.onBleWrite) {
    window.ultrasonicHost.onBleWrite(callback);
  }
}

/**
 * 注册 BLE 断开请求回调。
 * 仅在 Electron 环境下生效。
 *
 * @param {function(): void} callback - 断开回调
 * @returns {void}
 */
export function onBleDisconnectRequest(callback) {
  if (isElectron() && window.ultrasonicHost.onBleDisconnectRequest) {
    window.ultrasonicHost.onBleDisconnectRequest(callback);
  }
}

/**
 * 注册 BLE 设备列表回调。
 * 仅在 Electron 环境下生效。
 *
 * @param {function(Array<{deviceId: string, deviceName: string}>): void} callback - 设备列表回调
 * @returns {void}
 */
export function onBleDeviceList(callback) {
  if (isElectron() && window.ultrasonicHost.onBleDeviceList) {
    window.ultrasonicHost.onBleDeviceList(callback);
  }
}
