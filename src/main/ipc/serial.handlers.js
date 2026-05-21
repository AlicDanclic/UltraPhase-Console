/**
 * @module ipc/serial.handlers
 * @description 串口管理相关 IPC 处理器。
 * @author EternoPax
 * @version 1.0.0
 */

import { ipcMain } from "electron";
import { sendLogToRenderer } from "../windowManager.js";

/**
 * 注册串口相关 IPC 处理器。
 * @param {import("../protocol/index.js").SimpleProtocolClient} client
 */
export function registerSerialHandlers(client) {
  ipcMain.handle("host:list-ports", async () => {
    sendLogToRenderer("获取串口列表");
    const ports = await client.listPorts();
    sendLogToRenderer(`发现 ${ports.length} 个串口: ${ports.map(p => p.path).join(", ")}`);
    return ports;
  });

  ipcMain.handle("host:get-connection-info", async () => {
    return client.getConnectionInfo();
  });

  ipcMain.handle("host:connect", async (_event, options) => {
    const portPath = String(options?.path || "").trim();
    const baudRate = Number(options?.baudRate || 0);
    if (!portPath) throw new Error("必须指定串口");
    if (!Number.isInteger(baudRate) || baudRate <= 0) throw new Error("波特率无效");

    sendLogToRenderer(`尝试连接串口 ${portPath} @ ${baudRate} bps`);
    await client.connect(portPath, baudRate);
    sendLogToRenderer(`连接成功`);
    return client.getConnectionInfo();
  });

  ipcMain.handle("host:disconnect", async () => {
    sendLogToRenderer(`断开连接`);
    await client.disconnect();
    sendLogToRenderer(`已断开`);
    return client.getConnectionInfo();
  });
}
