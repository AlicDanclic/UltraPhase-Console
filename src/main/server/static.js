/**
 * @module server/static
 * @description 静态文件服务与 MIME 类型映射。
 * @author EternoPax
 * @version 1.0.0
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** MIME 类型映射 */
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon"
};

/**
 * 处理静态文件请求。
 * @param {import("http").ServerResponse} res
 * @param {string} pathname
 */
export function serveStaticFile(res, pathname) {
  let filePath = pathname;
  if (filePath === "/") filePath = "/index.html";

  const rootDir = path.join(__dirname, "..", "..", "..");
  const cleanPath = path.normalize(filePath).replace(/^([/\\]?(\.\.)[/\\])+/, "");
  const fullPath = cleanPath.startsWith(`${path.sep}node_modules${path.sep}`)
    ? path.join(rootDir, cleanPath)
    : path.join(rootDir, "src", "renderer", cleanPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mimeType,
      "Access-Control-Allow-Origin": "*"
    });
    res.end(data);
  });
}
