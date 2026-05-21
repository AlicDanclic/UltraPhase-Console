/**
 * @module server
 * @description HTTP 服务器启动与路由分发。
 * @author EternoPax
 * @version 1.0.0
 */

import http from "http";
import url from "url";
import { handleApiRequest } from "./routes.js";
import { serveStaticFile } from "./static.js";

/** @type {http.Server|null} */
let server = null;

const PORT = 3333;

/**
 * 启动 HTTP 服务器。绑定 3333 端口，提供 REST API + 静态文件服务。
 */
export function startApiServer() {
  if (server) return;

  server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;

    if (pathname.startsWith("/api/")) {
      await handleApiRequest(req, res, pathname);
      return;
    }

    serveStaticFile(res, pathname);
  });

  server.listen(PORT, () => {
    console.log(`[API] HTTP 服务器已启动: http://localhost:${PORT}`);
  });
}
