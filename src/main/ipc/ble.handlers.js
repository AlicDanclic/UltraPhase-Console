/**
 * @module ipc/ble.handlers
 * @description BLE 蓝牙连接相关 IPC 处理器。
 * @author EternoPax
 * @version 1.0.0
 */

import { ipcMain } from "electron";
import { sendLogToRenderer, getMainWindow } from "../windowManager.js";

let bleWriteSeq = 0;
const pendingBleWrites = new Map();

function requestBleWrite(data) {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) throw new Error("BLE 窗口不可用");

  const id = ++bleWriteSeq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingBleWrites.delete(id);
      reject(new Error("BLE 写入超时"));
    }, 2000);
    pendingBleWrites.set(id, { resolve, reject, timer });
    win.webContents.send("ble-write", { id, data: Array.from(data) });
  });
}

/**
 * 注册 BLE 相关 IPC 处理器。
 * @param {import("../protocol/index.js").SimpleProtocolClient} client
 */
export function registerBleHandlers(client) {
  ipcMain.handle("host:ble-connect", async (_event, { deviceName, baudRate }) => {
    sendLogToRenderer(`BLE 连接: ${deviceName} @ ${baudRate} bps`);
    client.connectBle(deviceName, baudRate,
      async (data) => {
        await requestBleWrite(data);
      },
      () => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) win.webContents.send("ble-disconnect-request");
      }
    );
    sendLogToRenderer(`BLE 传输已建立`);
    return client.getConnectionInfo();
  });

  ipcMain.handle("host:ble-disconnect", async () => {
    sendLogToRenderer(`BLE 断开`);
    await client.disconnect();
    sendLogToRenderer(`BLE 已断开`);
    return client.getConnectionInfo();
  });

  ipcMain.handle("host:ble-data", async (_event, data) => {
    client.feedBleData(Buffer.from(data));
  });

  ipcMain.handle("host:ble-write-result", async (_event, { id, ok, error }) => {
    const pending = pendingBleWrites.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingBleWrites.delete(id);
    if (ok) pending.resolve();
    else pending.reject(new Error(error || "BLE 写入失败"));
  });
}
