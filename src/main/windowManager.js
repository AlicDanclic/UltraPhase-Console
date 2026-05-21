/**
 * @module window
 * @description BrowserWindow 创建与日志转发。
 * @author EternoPax
 * @version 1.0.0
 */

import path from "path";
import { fileURLToPath } from "url";
import { BrowserWindow, ipcMain } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {BrowserWindow|null} */
let mainWindow = null;

/**
 * 向渲染进程发送日志消息。
 * @param {string} message
 * @param {"info"|"error"} [type="info"]
 */
export function sendLogToRenderer(message, type = "info") {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("log-from-main", message, type);
  }
  if (type === "error") console.error(`[LOG] ${message}`);
  else console.log(`[LOG] ${message}`);
}

/**
 * 获取主窗口引用。
 * @returns {BrowserWindow|null}
 */
export function getMainWindow() { return mainWindow; }

/**
 * 创建主应用窗口。
 */
export function createWindow() {
  const win = new BrowserWindow({
    width: 1480, height: 960,
    minWidth: 1200, minHeight: 760,
    backgroundColor: "#111111",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "..", "preload", "main.preload.js")
    }
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, "..", "renderer", "pages", "main", "index.html"));

  let bleSelectCallback = null;

  win.webContents.on("select-bluetooth-device", (event, devices, callback) => {
    event.preventDefault();
    win.webContents.send("ble-device-list", devices);
    bleSelectCallback = callback;
    setTimeout(() => {
      if (bleSelectCallback) { bleSelectCallback(""); bleSelectCallback = null; }
    }, 30000);
  });

  ipcMain.on("ble-select-device", (_event, deviceId) => {
    if (bleSelectCallback) { bleSelectCallback(deviceId); bleSelectCallback = null; }
  });

  mainWindow = win;
}
