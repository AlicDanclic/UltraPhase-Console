/**
 * @module server/routes
 * @description REST API 路由处理函数。
 * @author EternoPax
 * @version 1.0.0
 */

/** @type {import("../protocol/index.js").SimpleProtocolClient|null} */
let client = null;

/**
 * 设置协议客户端实例。
 * @param {import("../protocol/index.js").SimpleProtocolClient} c
 */
export function setProtocolClient(c) { client = c; }

/**
 * 解析 JSON 请求体。
 * @param {import("http").IncomingMessage} req
 * @returns {Promise<Object>}
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(new Error("JSON 解析失败")); }
    });
    req.on("error", reject);
  });
}

/**
 * 发送 JSON 响应。
 * @param {import("http").ServerResponse} res
 * @param {number} statusCode
 * @param {*} data
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(data));
}

/**
 * 处理 REST API 请求。
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {string} pathname
 */
export async function handleApiRequest(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && pathname === "/api/ports") {
      const ports = await client.listPorts();
      sendJson(res, 200, ports);
      return;
    }

    if (req.method === "GET" && pathname === "/api/connection") {
      sendJson(res, 200, client.getConnectionInfo());
      return;
    }

    if (req.method === "POST" && pathname === "/api/connect") {
      const body = await parseBody(req);
      const portPath = String(body.path || "").trim();
      const baudRate = Number(body.baudRate || 0);
      if (!portPath) { sendJson(res, 400, { error: "必须指定串口" }); return; }
      if (!Number.isInteger(baudRate) || baudRate <= 0) { sendJson(res, 400, { error: "波特率无效" }); return; }
      await client.connect(portPath, baudRate);
      sendJson(res, 200, client.getConnectionInfo());
      return;
    }

    if (req.method === "POST" && pathname === "/api/disconnect") {
      await client.disconnect();
      sendJson(res, 200, client.getConnectionInfo());
      return;
    }

    if (req.method === "POST" && pathname === "/api/apply") {
      const body = await parseBody(req);
      const { taskId, phaseTable, ampTable } = body;
      if (!taskId || !phaseTable || !ampTable) {
        sendJson(res, 400, { error: "缺少 taskId / phaseTable / ampTable" });
        return;
      }
      const handshake = await client.initiateTask(taskId);
      const expectedAmp = parseInt(handshake.bb, 16) || 25;
      const expectedPhase = parseInt(handshake.cc, 16) || 25;
      for (let i = 0; i < Math.min(ampTable.length, expectedAmp); i++) await client.sendAmpData(taskId, i + 1, ampTable[i]);
      for (let i = 0; i < Math.min(phaseTable.length, expectedPhase); i++) await client.sendPhaseData(taskId, i + 1, phaseTable[i]);
      const applyResp = await client.applyTask(taskId);
      sendJson(res, 200, { success: true, response: applyResp });
      return;
    }

    if (req.method === "POST" && pathname === "/api/status") {
      const resp = await client.sendStatusRequest(0);
      sendJson(res, 200, resp);
      return;
    }

    if (req.method === "POST" && pathname === "/api/duty-limit") {
      const body = await parseBody(req);
      const value = Math.max(0, Math.min(255, Number(body.value) || 0));
      const taskId = Number(body.taskId || 0);
      const resp = await client.setDutyLimit(taskId, value);
      sendJson(res, 200, resp);
      return;
    }

    if (req.method === "POST" && pathname === "/api/duty-limit-stream/start") {
      const body = await parseBody(req);
      const taskId = Number(body.taskId || 0);
      const resp = await client.startDutyLimitStream(taskId);
      sendJson(res, 200, resp);
      return;
    }

    if (req.method === "POST" && pathname === "/api/duty-limit-stream/byte") {
      const body = await parseBody(req);
      const value = Math.max(0, Math.min(254, Number(body.value) || 0));
      const resp = await client.sendDutyLimitStreamByte(value);
      sendJson(res, 200, resp);
      return;
    }

    if (req.method === "POST" && pathname === "/api/duty-limit-stream/bytes") {
      const body = await parseBody(req);
      const values = Array.isArray(body.values) ? body.values : [];
      const resp = await client.sendDutyLimitStreamBytes(values);
      sendJson(res, 200, resp);
      return;
    }

    if (req.method === "POST" && pathname === "/api/duty-limit-stream/stop") {
      const resp = await client.stopDutyLimitStream();
      sendJson(res, 200, resp);
      return;
    }

    if (req.method === "POST" && pathname === "/api/disable-remote") {
      const resp = await client.disableRemote(0);
      sendJson(res, 200, resp);
      return;
    }

    sendJson(res, 404, { error: `未知端点: ${pathname}` });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
}
