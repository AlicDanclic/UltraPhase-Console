/**
 * @module ipc
 * @description IPC 处理器注册入口。
 * @author EternoPax
 * @version 1.0.0
 */

import { registerSerialHandlers } from "./serial.handlers.js";
import { registerBeamHandlers } from "./beam.handlers.js";
import { registerBleHandlers } from "./ble.handlers.js";

/**
 * 注册所有 IPC 处理器。
 * @param {import("../protocol/index.js").SimpleProtocolClient} client
 */
export function registerAllIpcHandlers(client) {
  registerSerialHandlers(client);
  registerBeamHandlers(client);
  registerBleHandlers(client);
}
