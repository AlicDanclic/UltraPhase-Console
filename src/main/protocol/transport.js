/**
 * @module protocol/transport
 * @description 串口/BLE 传输抽象层。管理连接生命周期、数据收发和事务队列。
 * @author EternoPax
 * @version 1.0.0
 */

import { SerialPort } from "serialport";
import { parseResponse } from "./frame.js";

/**
 * 传输层。封装串口和 BLE 两种传输方式的统一接口。
 */
export class Transport {
  constructor() {
    this.port = null;
    this.portInfo = null;
    this.rxBuffer = "";
    this.pendingCallback = null;
    this.transactionQueue = Promise.resolve();
    this.logCallback = null;
    this.bleWriteFn = null;
    this.bleDisconnectFn = null;
    this.bleMode = false;
  }

  setLogger(callback) { this.logCallback = callback; }
  _log(message, level = "info") { if (this.logCallback) this.logCallback(message, level); }

  // ── BLE ────────────────────────────────────────────────────

  connectBle(deviceName, baudRate, writeFn, disconnectFn) {
    this.disconnect();
    this.rxBuffer = "";
    this.bleWriteFn = writeFn;
    this.bleDisconnectFn = disconnectFn;
    this.bleMode = true;
    this.portInfo = { path: `BLE:${deviceName}`, baudRate };
    this._log(`BLE 已连接: ${deviceName} @ ${baudRate} bps`);
  }

  feedBleData(chunk) { this._handleData(chunk); }
  isBleMode() { return this.bleMode; }

  // ── Serial ─────────────────────────────────────────────────

  getConnectionInfo() {
    const connected = this.bleMode ? Boolean(this.bleWriteFn) : Boolean(this.port?.isOpen);
    return { connected, path: this.portInfo?.path || "", baudRate: this.portInfo?.baudRate || 0, bleMode: this.bleMode };
  }

  async connect(portPath, baudRate) {
    await this.disconnect();
    this.bleMode = false;
    this.bleWriteFn = null;
    this.bleDisconnectFn = null;
    this.rxBuffer = "";

    const port = new SerialPort({ path: portPath, baudRate, autoOpen: false });
    port.on("data", (chunk) => this._handleData(chunk));
    port.on("close", () => this._handlePortLoss(new Error("串口已关闭")));
    port.on("error", (error) => this._handlePortLoss(error));

    await new Promise((resolve, reject) => {
      port.open((error) => { if (error) reject(error); else resolve(); });
    });

    this.port = port;
    this.portInfo = { path: portPath, baudRate };
    this._log(`串口已打开: ${portPath} @ ${baudRate} bps`);
  }

  async disconnect() {
    if (this.pendingCallback) {
      clearTimeout(this.pendingCallback.timer);
      this.pendingCallback.reject(new Error("连接已断开"));
      this.pendingCallback = null;
    }

    if (this.bleMode) {
      const disconnectFn = this.bleDisconnectFn;
      this.bleWriteFn = null; this.bleDisconnectFn = null;
      this.bleMode = false; this.portInfo = null; this.rxBuffer = "";
      if (disconnectFn) try { disconnectFn(); } catch (_) {}
      this._log("BLE 已断开");
      return;
    }

    const port = this.port;
    this.port = null; this.portInfo = null; this.rxBuffer = "";
    if (port?.isOpen) {
      await new Promise((resolve) => { port.close(() => resolve()); });
      this._log("串口已关闭");
    }
  }

  // ── Transaction queue ──────────────────────────────────────

  enqueue(task) {
    const pending = this.transactionQueue.then(task, task);
    this.transactionQueue = pending.catch(() => {});
    return pending;
  }

  ensureConnected() {
    if (this.bleMode) {
      if (!this.bleWriteFn) throw new Error("BLE 未连接");
      return;
    }
    if (!this.port?.isOpen) throw new Error("串口未连接");
  }

  async writeMessage(message) {
    this._log(`TX: ${message}`);
    if (this.bleMode) {
      await this.bleWriteFn(Buffer.from(message, "ascii"));
      return;
    }
    await new Promise((resolve, reject) => {
      this.port.write(message, "ascii", (error) => {
        if (error) { reject(error); return; }
        this.port.drain((drainError) => { if (drainError) reject(drainError); else resolve(); });
      });
    });
  }

  async writeRaw(data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (this.bleMode) {
      await this.bleWriteFn(buffer);
      return;
    }
    await new Promise((resolve, reject) => {
      this.port.write(buffer, (error) => {
        if (error) { reject(error); return; }
        this.port.drain((drainError) => { if (drainError) reject(drainError); else resolve(); });
      });
    });
  }

  waitForResponse() {
    if (this.pendingCallback) throw new Error("内部协议错误：已有待处理响应");
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingCallback?.timer === timer) this.pendingCallback = null;
        reject(new Error("等待 FPGA 响应超时"));
      }, 2000);
      this.pendingCallback = { resolve, reject, timer };
    });
  }

  // ── Internal ───────────────────────────────────────────────

  _handlePortLoss(error) {
    this._log(`串口异常丢失: ${error.message}`, "error");
    if (this.pendingCallback) {
      clearTimeout(this.pendingCallback.timer);
      this.pendingCallback.reject(error);
      this.pendingCallback = null;
    }
  }

  _handleData(chunk) {
    const text = chunk.toString("ascii");
    this._log(`RAW: ${JSON.stringify(text)}`);
    this.rxBuffer += text;

    const result = parseResponse(this.rxBuffer);
    if (result) {
      const { address, aa, bb, cc } = result.frame;
      this._log(`RX: @${address}|${aa}|${bb}|${cc}#`);
      this.rxBuffer = result.rest;

      if (this.pendingCallback) {
        clearTimeout(this.pendingCallback.timer);
        const callback = this.pendingCallback;
        this.pendingCallback = null;
        callback.resolve({ address, aa, bb, cc });
      }
    }
  }
}
