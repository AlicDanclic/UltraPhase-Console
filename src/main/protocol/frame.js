/**
 * @module protocol/frame
 * @description UART 协议帧格式化与响应解析。
 *
 * 固定 13 字符帧格式：@TT|AA|BB|CC#
 *   @  = 起始符 (0x40)
 *   TT = 任务 ID（2 位十六进制）
 *   AA = 功能码（2 位十六进制）
 *   BB = 字段 2（2 位十六进制）
 *   CC = 字段 3（2 位十六进制）
 *   #  = 结束符 (0x23)
 *
 * @author EternoPax
 * @version 1.0.0
 */

/** 响应帧解析正则 */
const RESPONSE_RE = /@([0-9A-Fa-f]{2})\|([0-9A-Fa-f]{2})\|([0-9A-Fa-f]{2})\|([0-9A-Fa-f]{2})\|?\#/;

/**
 * 构建协议帧字符串。
 * @param {string} tt - 任务 ID（2 位 hex）
 * @param {string} aa - 功能码（2 位 hex）
 * @param {string} bb - 字段 2（2 位 hex）
 * @param {string} cc - 字段 3（2 位 hex）
 * @returns {string} 13 字符帧
 */
export function buildFrame(tt, aa, bb, cc) {
  return `@${tt}|${aa}|${bb}|${cc}#`;
}

/**
 * 从接收缓冲区中解析响应帧。
 * @param {string} buffer - 接收缓冲区
 * @returns {{frame: {address: string, aa: string, bb: string, cc: string}, rest: string}|null}
 */
export function parseResponse(buffer) {
  const match = buffer.match(RESPONSE_RE);
  if (!match) return null;
  const [full, tt, aa, bb, cc] = match;
  const rest = buffer.substring(buffer.indexOf("#") + 1);
  return { frame: { address: tt, aa, bb, cc }, rest };
}
