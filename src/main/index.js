/**
 * @module main
 * @description Electron 主进程入口。负责应用生命周期管理和启动编排。
 * @author EternoPax
 * @version 1.0.0
 */

import { app, BrowserWindow } from "electron";
import { SimpleProtocolClient } from "./protocol/index.js";
import { registerAllIpcHandlers } from "./ipc/index.js";
import { createWindow, sendLogToRenderer } from "./windowManager.js";

const client = new SimpleProtocolClient();

app.whenReady().then(() => {
  client.setLogger((message, level) => {
    sendLogToRenderer(message, level);
  });

  registerAllIpcHandlers(client);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", async () => {
  await client.disconnect();
  if (process.platform !== "darwin") app.quit();
});
