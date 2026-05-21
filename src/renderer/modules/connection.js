/**
 * @module connection
 * @description 连接管理模块。负责串口（UART）和 BLE 蓝牙两种通信方式的连接、断开、
 * 数据收发，以及波束应用和状态查询等业务操作。
 *
 * 连接方式：
 * - **串口**：通过 Electron serialport 包连接 COM 端口
 * - **BLE**：通过 Web Bluetooth API 连接 BLE 设备（服务 UUID 0xFFE0）
 *
 * 通过 bridge 模块自动选择 IPC（Electron）或 HTTP（浏览器）通信方式。
 * 模块通过 `setUpdatePreviewFn` 注入预览更新函数，避免与 ui.js 的循环依赖。
 *
 * @author EternoPax
 * @version 1.0.0
 */

import { BLE_SERVICE_UUID, BLE_CHAR_UUID } from "./constants.js";
import { state, refs } from "./state.js";
import { appendLog } from "./log.js";
import * as bridge from "./bridge.js";

/**
 * 预览更新函数引用。由 renderer.js 通过 setUpdatePreviewFn 注入。
 * @type {Function|null}
 */
let updatePreviewFn = null;
let bleWriteQueue = Promise.resolve();

/**
 * 注入预览更新函数。用于在 applyBeam 前自动刷新声场预览。
 * @param {Function} fn - 预览更新函数（通常为 ui.updatePreview）
 * @returns {void}
 */
export function setUpdatePreviewFn(fn) {
  updatePreviewFn = fn;
}

// ── Serial port ──────────────────────────────────────────────

/**
 * 刷新可用串口列表。
 * 从主进程或 API 服务器获取串口列表，填充到端口选择下拉框。
 * 保持之前选中的端口（如果仍然可用）。
 *
 * @async
 * @returns {Promise<void>}
 */
export async function refreshPorts() {
  const ports = await bridge.listPorts();
  const cur = refs.portSelect.value;
  refs.portSelect.innerHTML = "";
  if (!ports.length) { refs.portSelect.innerHTML = '<option value="">无可用串口</option>'; return; }
  ports.forEach(p => { const o = document.createElement("option"); o.value = p.path; o.textContent = p.friendlyName || p.path; refs.portSelect.appendChild(o); });
  refs.portSelect.value = ports.some(p => p.path === cur) ? cur : ports[0].path;
}

/**
 * 更新连接状态显示。
 * 同时更新全局状态和 UI 元素（按钮文本、状态文本）。
 *
 * @param {boolean} c - 是否已连接
 * @param {string} txt - 状态显示文本
 * @returns {void}
 */
export function setConnected(c, txt) {
  state.connected = c;
  refs.connectButton.textContent = c ? "断开" : "连接";
  refs.connectionStatus.textContent = txt;
}

/**
 * 切换串口连接状态。
 * 已连接时断开，未连接时连接选中的端口。
 * BLE 模式下转为断开 BLE。
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} 未选择串口时抛出
 */
export async function toggleConnection() {
  if (state.bleMode) { await bleDisconnect(); return; }
  if (state.connected) { await bridge.disconnect(); setConnected(false, "未连接"); appendLog("串口已断开"); return; }
  const path = refs.portSelect.value;
  if (!path) throw new Error("请选择串口");
  const info = await bridge.connect({ path, baudRate: Number(refs.baudSelect.value) });
  setConnected(Boolean(info.connected), `${info.path} @ ${info.baudRate}`);
  appendLog(`已连接 ${info.path} @ ${info.baudRate}`);
}

// ── BLE ──────────────────────────────────────────────────────

/**
 * 扫描并连接 BLE 蓝牙设备。
 * 使用 Web Bluetooth API 请求用户选择设备，建立 GATT 连接，
 * 获取服务和特征值，注册数据通知回调。
 *
 * @async
 * @returns {Promise<void>}
 */
export async function bleScanAndConnect() {
  if (!navigator.bluetooth) { appendLog("不支持 Web Bluetooth", "error"); return; }
  try {
    appendLog("扫描 BLE...");
    refs.bleScanButton.disabled = true;
    refs.bleScanButton.textContent = "扫描中...";
    const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [BLE_SERVICE_UUID] }], optionalServices: [BLE_SERVICE_UUID] });
    if (!dev) { appendLog("未选择设备"); return; }
    dev.addEventListener("gattserverdisconnected", () => { appendLog("BLE 断开", "error"); bleCleanup(); bridge.bleDisconnect().catch(()=>{}); });
    const server = await dev.gatt.connect();
    const svc = await server.getPrimaryService(BLE_SERVICE_UUID);
    const ch = await svc.getCharacteristic(BLE_CHAR_UUID);
    await ch.startNotifications();
    ch.addEventListener("characteristicvaluechanged", e => { bridge.bleSendData(Array.from(new Uint8Array(e.target.value.buffer))); });
    state.bleDevice = dev; state.bleServer = server; state.bleCharacteristic = ch; state.bleMode = true;
    const br = Number(refs.baudSelect.value);
    await bridge.bleConnect({ deviceName: dev.name || dev.id, baudRate: br });
    setConnected(true, `BLE: ${dev.name || dev.id} @ ${br}`);
    refs.bleScanButton.textContent = "BLE 已连接";
    refs.bleScanButton.classList.add("connected");
    appendLog(`BLE 已连接: ${dev.name || dev.id}`);
  } catch (e) {
    if (e.name === "NotFoundError") appendLog("未选择蓝牙设备");
    else appendLog(`BLE 失败: ${e.message}`, "error");
    bleCleanup();
  } finally {
    refs.bleScanButton.disabled = false;
    if (!state.bleMode) refs.bleScanButton.textContent = "BLE 扫描";
  }
}

/**
 * 清理 BLE 连接状态。
 * 重置所有 BLE 相关的全局状态和 UI 元素。
 *
 * @returns {void}
 */
export function bleCleanup() {
  state.bleDevice = null; state.bleServer = null; state.bleCharacteristic = null; state.bleMode = false;
  bleWriteQueue = Promise.resolve();
  refs.bleScanButton.textContent = "BLE 扫描"; refs.bleScanButton.classList.remove("connected"); refs.bleScanButton.disabled = false;
  setConnected(false, "未连接");
}

/**
 * 断开 BLE 蓝牙连接。
 * 先断开 GATT 连接，再清理状态，最后通知主进程。
 *
 * @async
 * @returns {Promise<void>}
 */
export async function bleDisconnect() {
  try { if (state.bleDevice?.gatt?.connected) state.bleDevice.gatt.disconnect(); } catch(_){}
  bleCleanup();
  await bridge.bleDisconnect();
  appendLog("BLE 已断开");
}

/**
 * 显示 BLE 设备选择对话框。
 * 将扫描到的设备列表渲染为可点击的列表项。
 *
 * @param {Array<{deviceId: string, deviceName: string}>} devices - 扫描到的设备列表
 * @returns {void}
 */
export function showBleDialog(devices) {
  refs.bleDeviceList.innerHTML = "";
  devices.forEach(d => {
    const item = document.createElement("div");
    item.className = "ble-device-item";
    item.innerHTML = `<div><div class="ble-device-name">${d.deviceName||"未知"}</div><div class="ble-device-id">${d.deviceId}</div></div>`;
    item.addEventListener("click", () => { refs.bleOverlay.classList.add("hidden"); bridge.bleSelectDevice(d.deviceId); });
    refs.bleDeviceList.appendChild(item);
  });
  refs.bleOverlay.classList.remove("hidden");
}

// ── Apply / Status ───────────────────────────────────────────

/**
 * 应用当前波束任务到 FPGA。
 * 先刷新声场预览，然后通过主进程或 API 服务器执行完整的四步协议流程
 * （握手 → 幅度 → 相位 → 应用）。
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} 未连接时抛出
 */
export async function applyBeam() {
  if (!state.connected) throw new Error(state.bleMode ? "BLE 已断开" : "请先连接串口");
  if (updatePreviewFn) updatePreviewFn();
  const sol = state.lastSolution;
  appendLog(`发送任务 ${sol.task.num}: ${sol.ampTable.length} 幅度 + ${sol.phaseTable.length} 相位`);
  await bridge.applyBeam({ taskId: sol.task.num, phaseTable: sol.phaseTable, ampTable: sol.ampTable });
  appendLog(`${sol.task.label} 应用完成`);
}

/**
 * 查询 FPGA 当前状态。
 * 发送状态请求帧并显示响应。
 *
 * @async
 * @returns {Promise<void>}
 */
export async function pollStatus() {
  if (!state.connected) { appendLog("请先连接", "error"); return; }
  try {
    const s = await bridge.getStatus();
    appendLog(`状态: @${s.address}|${s.aa}|${s.bb}|${s.cc}#`);
  } catch (e) {
    appendLog(`状态失败: ${e.message}`, "error");
  }
}

/**
 * 关闭 FPGA 远程控制模式。
 * @async
 * @returns {Promise<void>}
 * @throws {Error} 未连接时抛出
 */
export async function disableRemote() {
  if (!state.connected) throw new Error("请先连接串口");
  await bridge.disableRemote();
  appendLog("远程控制已关闭");
}

// ── Host IPC callbacks ───────────────────────────────────────

/**
 * 注册主进程 IPC 回调（仅 Electron 环境生效）。
 * 包括：
 * - onLog：主进程日志转发到活动日志面板
 * - onBleWrite：BLE 数据写入（主进程 → 渲染进程 → BLE 设备）
 * - onBleDisconnectRequest：BLE 断开请求
 * - onBleDeviceList：BLE 设备列表（触发设备选择对话框）
 *
 * @returns {void}
 */
export function wireHostCallbacks() {
  bridge.onLog((m, t) => appendLog(m, t));
  bridge.onBleWrite(data => {
    const writeTask = bleWriteQueue.then(async () => {
      if (!state.bleCharacteristic) throw new Error("BLE 特征值未连接");
      await state.bleCharacteristic.writeValueWithoutResponse(new Uint8Array(data));
    });
    bleWriteQueue = writeTask.catch(() => {});
    return writeTask.catch(e => {
      appendLog(`BLE 写入失败: ${e.message}`, "error");
      throw e;
    });
  });
  bridge.onBleDisconnectRequest(() => bleDisconnect().catch(()=>{}));
  bridge.onBleDeviceList(devs => { if (!devs.length) { appendLog("未发现 BLE", "error"); return; } showBleDialog(devs); });
}
