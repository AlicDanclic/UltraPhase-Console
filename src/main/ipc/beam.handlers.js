/**
 * @module ipc/beam.handlers
 * @description 波束应用、状态查询、远程控制 IPC 处理器。
 * @author EternoPax
 * @version 1.0.0
 */

import { ipcMain } from "electron";
import { sendLogToRenderer } from "../windowManager.js";

/**
 * 注册波束相关 IPC 处理器。
 * @param {import("../protocol/index.js").SimpleProtocolClient} client
 */
export function registerBeamHandlers(client) {
  ipcMain.handle("host:apply-beam", async (_event, payload) => {
    const { taskId, phaseTable, ampTable } = payload;
    sendLogToRenderer(`开始应用任务 ${taskId}: ${phaseTable.length} 相位 + ${ampTable.length} 幅度`);

    const handshake = await client.initiateTask(taskId);
    sendLogToRenderer(`握手响应: @${handshake.address}|${handshake.aa}|${handshake.bb}|${handshake.cc}#`);

    const expectedAmp = parseInt(handshake.bb, 16) || 25;
    const expectedPhase = parseInt(handshake.cc, 16) || 25;
    sendLogToRenderer(`FPGA 期望: ${expectedAmp} 幅度 + ${expectedPhase} 相位`);

    for (let i = 0; i < Math.min(ampTable.length, expectedAmp); i++) {
      await client.sendAmpData(taskId, i + 1, ampTable[i]);
      sendLogToRenderer(`幅度[${i + 1}] = ${ampTable[i].toString(16).toUpperCase().padStart(2, "0")} → ACK`);
    }

    for (let i = 0; i < Math.min(phaseTable.length, expectedPhase); i++) {
      await client.sendPhaseData(taskId, i + 1, phaseTable[i]);
      sendLogToRenderer(`相位[${i + 1}] = ${phaseTable[i].toString(16).toUpperCase().padStart(2, "0")} → ACK`);
    }

    const applyResp = await client.applyTask(taskId);
    sendLogToRenderer(`应用响应: @${applyResp.address}|${applyResp.aa}|${applyResp.bb}|${applyResp.cc}#`);
    return { success: true };
  });

  ipcMain.handle("host:disable-remote", async () => {
    sendLogToRenderer(`关闭远程控制`);
    const resp = await client.disableRemote(0);
    sendLogToRenderer(`响应: @${resp.address}|${resp.aa}|${resp.bb}|${resp.cc}#`);
    return resp;
  });

  ipcMain.handle("host:set-duty-limit", async (_event, payload) => {
    const value = Math.max(0, Math.min(255, Number(payload?.value) || 0));
    const taskId = Number(payload?.taskId || 0);
    const resp = await client.setDutyLimit(taskId, value);
    sendLogToRenderer(`占空比上限=${value} 响应: @${resp.address}|${resp.aa}|${resp.bb}|${resp.cc}#`);
    return resp;
  });

  ipcMain.handle("host:start-duty-limit-stream", async (_event, payload) => {
    const taskId = Number(payload?.taskId || 0);
    const resp = await client.startDutyLimitStream(taskId);
    sendLogToRenderer(`占空比流启动响应: @${resp.address}|${resp.aa}|${resp.bb}|${resp.cc}#`);
    return resp;
  });

  ipcMain.handle("host:send-duty-limit-byte", async (_event, payload) => {
    const value = Math.max(0, Math.min(254, Number(payload?.value) || 0));
    return client.sendDutyLimitStreamByte(value);
  });

  ipcMain.handle("host:send-duty-limit-bytes", async (_event, payload) => {
    const values = Array.isArray(payload?.values) ? payload.values : [];
    return client.sendDutyLimitStreamBytes(values);
  });

  ipcMain.handle("host:stop-duty-limit-stream", async () => {
    return client.stopDutyLimitStream();
  });

  ipcMain.handle("host:get-status", async () => {
    const resp = await client.sendStatusRequest(0);
    sendLogToRenderer(`状态响应: @${resp.address}|${resp.aa}|${resp.bb}|${resp.cc}#`);
    return resp;
  });
}
