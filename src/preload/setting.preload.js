/**
 * @module setting.preload
 * @description Settings window preload (placeholder).
 */

// TODO: implement settings window preload when settings page is added

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("settingsAPI", {});
