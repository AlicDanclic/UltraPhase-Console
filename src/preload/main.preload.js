/**
 * @module preload
 * @description Electron preload 脚本。通过 contextBridge 向渲染进程安全地暴露
 * `ultrasonicHost` API 对象，提供串口管理、BLE 连接、波束应用等功能的 IPC 调用接口。
 *
 * 所有方法均通过 ipcRenderer.invoke 与主进程通信，保证 contextIsolation 安全模型。
 *
 * @author EternoPax
 * @version 1.0.0
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ultrasonicHost", {
  /**
   * 列出系统可用串口。
   * @returns {Promise<Array<{path: string, manufacturer: string, friendlyName: string}>>}
   */
  listPorts: () => ipcRenderer.invoke("host:list-ports"),

  /**
   * 获取当前连接状态信息。
   * @returns {Promise<{connected: boolean, path: string, baudRate: number, bleMode: boolean}>}
   */
  getConnectionInfo: () => ipcRenderer.invoke("host:get-connection-info"),

  /**
   * 连接指定串口。
   * @param {{path: string, baudRate: number}} options - 串口路径与波特率
   * @returns {Promise<{connected: boolean, path: string, baudRate: number}>}
   */
  connect: (options) => ipcRenderer.invoke("host:connect", options),

  /**
   * 断开当前连接。
   * @returns {Promise<{connected: boolean, path: string, baudRate: number}>}
   */
  disconnect: () => ipcRenderer.invoke("host:disconnect"),

  /**
   * 应用波束任务（握手 + 幅度 + 相位 + 应用）。
   * @param {{taskId: number, phaseTable: number[], ampTable: number[]}} payload - 任务载荷
   * @returns {Promise<{success: boolean}>}
   */
  applyBeam: (payload) => ipcRenderer.invoke("host:apply-beam", payload),

  /**
   * 关闭 FPGA 远程控制模式。
   * @returns {Promise<{address: string, aa: string, bb: string, cc: string}>}
   */
  disableRemote: () => ipcRenderer.invoke("host:disable-remote"),

  /**
   * 查询 FPGA 当前状态。
   * @returns {Promise<{address: string, aa: string, bb: string, cc: string}>}
   */
  getStatus: () => ipcRenderer.invoke("host:get-status"),

  /**
   * 设置 FPGA 动态占空比上限。
   * @param {{taskId?: number, value: number}} payload - 0-255 上限值
   * @returns {Promise<{address: string, aa: string, bb: string, cc: string}>}
   */
  setDutyLimit: (payload) => ipcRenderer.invoke("host:set-duty-limit", payload),

  /**
   * 启动 FPGA 动态占空比流模式。
   * @param {{taskId?: number}} payload
   * @returns {Promise<{address: string, aa: string, bb: string, cc: string}>}
   */
  startDutyLimitStream: (payload) => ipcRenderer.invoke("host:start-duty-limit-stream", payload),

  /**
   * 向 FPGA 占空比流写入一个原始字节。
   * @param {{value: number}} payload
   * @returns {Promise<{value: number}>}
   */
  sendDutyLimitByte: (payload) => ipcRenderer.invoke("host:send-duty-limit-byte", payload),

  /**
   * 向 FPGA 占空比流批量写入原始字节。
   * @param {{values: number[]}} payload
   * @returns {Promise<{count: number}>}
   */
  sendDutyLimitBytes: (payload) => ipcRenderer.invoke("host:send-duty-limit-bytes", payload),

  /**
   * 停止 FPGA 动态占空比流模式。
   * @returns {Promise<{success: boolean}>}
   */
  stopDutyLimitStream: () => ipcRenderer.invoke("host:stop-duty-limit-stream"),

  // ── BLE ────────────────────────────────────────────────────

  /**
   * 通过 BLE 蓝牙建立连接。
   * @param {{deviceName: string, baudRate: number}} options - 设备名与波特率
   * @returns {Promise<{connected: boolean, path: string, baudRate: number, bleMode: boolean}>}
   */
  bleConnect: (options) => ipcRenderer.invoke("host:ble-connect", options),

  /**
   * 断开 BLE 蓝牙连接。
   * @returns {Promise<{connected: boolean, path: string, baudRate: number}>}
   */
  bleDisconnect: () => ipcRenderer.invoke("host:ble-disconnect"),

  /**
   * 向 BLE 特征值写入数据。
   * @param {number[]} data - 字节数组
   * @returns {Promise<void>}
   */
  bleSendData: (data) => ipcRenderer.invoke("host:ble-data", data),

  /**
   * 注册 BLE 数据写入回调（主进程 → 渲染进程 → BLE 设备）。
   * @param {function(number[]): void} callback - 接收字节数组的回调
   * @returns {void}
   */
  onBleWrite: (callback) => {
    ipcRenderer.on("ble-write", async (event, payload) => {
      const id = typeof payload === "object" && payload !== null ? payload.id : 0;
      const data = typeof payload === "object" && payload !== null ? payload.data : payload;
      try {
        await callback(data);
        if (id) await ipcRenderer.invoke("host:ble-write-result", { id, ok: true });
      } catch (error) {
        if (id) await ipcRenderer.invoke("host:ble-write-result", { id, ok: false, error: error.message });
        else throw error;
      }
    });
  },

  /**
   * 注册 BLE 断开请求回调。
   * @param {function(): void} callback - 断开请求回调
   * @returns {void}
   */
  onBleDisconnectRequest: (callback) => {
    ipcRenderer.on("ble-disconnect-request", () => {
      callback();
    });
  },

  /**
   * 注册 BLE 设备列表回调（设备选择对话框）。
   * @param {function(Array<{deviceId: string, deviceName: string}>): void} callback
   * @returns {void}
   */
  onBleDeviceList: (callback) => {
    ipcRenderer.on("ble-device-list", (event, devices) => {
      callback(devices);
    });
  },

  /**
   * 选择 BLE 设备（用户在对话框中点击后调用）。
   * @param {string} deviceId - 选中的设备 ID
   * @returns {void}
   */
  bleSelectDevice: (deviceId) => ipcRenderer.send("ble-select-device", deviceId),

  // ── Log ────────────────────────────────────────────────────

  /**
   * 注册主进程日志回调。
   * @param {function(string, "info"|"error"): void} callback - 日志回调
   * @returns {void}
   */
  onLog: (callback) => {
    ipcRenderer.on("log-from-main", (event, message, type) => {
      callback(message, type);
    });
  }
});
