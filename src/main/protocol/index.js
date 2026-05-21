/**
 * @module protocol
 * @description SimpleProtocolClient 门面类。组合传输层、帧处理和端口枚举，
 * 暴露高层业务 API（握手、幅度、相位、应用、状态、远程控制）。
 * @author EternoPax
 * @version 1.0.0
 */

import { Transport } from "./transport.js";
import { buildFrame } from "./frame.js";
import { listPorts } from "./port-discovery.js";

/**
 * 简单协议客户端。通过串口或 BLE 与 FPGA 通信。
 */
export class SimpleProtocolClient {
  constructor() {
    this.transport = new Transport();
  }

  setLogger(callback) { this.transport.setLogger(callback); }
  listPorts() { return listPorts((msg, lvl) => this.transport._log(msg, lvl)); }
  getConnectionInfo() { return this.transport.getConnectionInfo(); }
  connect(portPath, baudRate) { return this.transport.connect(portPath, baudRate); }
  disconnect() { return this.transport.disconnect(); }
  connectBle(deviceName, baudRate, writeFn, disconnectFn) { return this.transport.connectBle(deviceName, baudRate, writeFn, disconnectFn); }
  feedBleData(chunk) { return this.transport.feedBleData(chunk); }

  async sendStatusRequest(taskId) {
    return this.transport.enqueue(async () => {
      this.transport.ensureConnected();
      const tt = String(taskId || 0).padStart(2, '0');
      const message = buildFrame(tt, '00', '00', '00');
      this.transport._log(`发送状态请求: ${message}`);
      await this.transport.writeMessage(message);
      return this.transport.waitForResponse();
    });
  }

  async initiateTask(taskId) {
    return this.transport.enqueue(async () => {
      this.transport.ensureConnected();
      const tt = String(taskId).padStart(2, '0');
      const message = buildFrame(tt, '02', '00', '00');
      this.transport._log(`发起任务握手: ${message}`);
      await this.transport.writeMessage(message);
      return this.transport.waitForResponse();
    });
  }

  async sendAmpData(taskId, index, value) {
    return this.transport.enqueue(async () => {
      this.transport.ensureConnected();
      const tt = String(taskId).padStart(2, '0');
      const idx = index.toString(16).toUpperCase().padStart(2, '0');
      const val = value.toString(16).toUpperCase().padStart(2, '0');
      const message = buildFrame(tt, '00', idx, val);
      this.transport._log(`TX amp[${idx}]=${val}: ${message}`);
      await this.transport.writeMessage(message);
      return this.transport.waitForResponse();
    });
  }

  async sendPhaseData(taskId, index, value) {
    return this.transport.enqueue(async () => {
      this.transport.ensureConnected();
      const tt = String(taskId).padStart(2, '0');
      const idx = index.toString(16).toUpperCase().padStart(2, '0');
      const val = value.toString(16).toUpperCase().padStart(2, '0');
      const message = buildFrame(tt, '01', idx, val);
      this.transport._log(`TX phase[${idx}]=${val}: ${message}`);
      await this.transport.writeMessage(message);
      return this.transport.waitForResponse();
    });
  }

  async applyTask(taskId) {
    return this.transport.enqueue(async () => {
      this.transport.ensureConnected();
      const tt = String(taskId).padStart(2, '0');
      const message = buildFrame(tt, '01', '00', '00');
      this.transport._log(`发送应用命令: ${message}`);
      await this.transport.writeMessage(message);
      return this.transport.waitForResponse();
    });
  }

  async setDutyLimit(taskId, value) {
    return this.transport.enqueue(async () => {
      this.transport.ensureConnected();
      const tt = String(taskId || 0).padStart(2, '0');
      const val = Math.max(0, Math.min(255, Number(value) || 0)).toString(16).toUpperCase().padStart(2, '0');
      const message = buildFrame(tt, '03', '00', val);
      this.transport._log(`TX duty_limit=${val}: ${message}`);
      await this.transport.writeMessage(message);
      return this.transport.waitForResponse();
    });
  }

  async startDutyLimitStream(taskId) {
    return this.transport.enqueue(async () => {
      this.transport.ensureConnected();
      const tt = String(taskId || 0).padStart(2, '0');
      const message = buildFrame(tt, '03', '01', '00');
      this.transport._log(`启动占空比流: ${message}`);
      await this.transport.writeMessage(message);
      return this.transport.waitForResponse();
    });
  }

  async sendDutyLimitStreamByte(value) {
    this.transport.ensureConnected();
    const byte = Math.max(0, Math.min(254, Number(value) || 0));
    await this.transport.writeRaw(Buffer.from([byte]));
    return { value: byte };
  }

  async sendDutyLimitStreamBytes(values) {
    this.transport.ensureConnected();
    const bytes = Array.from(values || [], value => Math.max(0, Math.min(254, Number(value) || 0)));
    await this.transport.writeRaw(Buffer.from(bytes));
    return { count: bytes.length };
  }

  async stopDutyLimitStream() {
    this.transport.ensureConnected();
    await this.transport.writeRaw(Buffer.from([0xFF]));
    this.transport._log("停止占空比流: 0xFF");
    return { success: true };
  }

  async disableRemote(taskId) {
    return this.transport.enqueue(async () => {
      this.transport.ensureConnected();
      const tt = String(taskId || 0).padStart(2, '0');
      const message = buildFrame(tt, '00', '00', 'FF');
      this.transport._log(`关闭远程: ${message}`);
      await this.transport.writeMessage(message);
      return this.transport.waitForResponse();
    });
  }
}
