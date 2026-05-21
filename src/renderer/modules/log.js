/**
 * @module log
 * @description 活动日志模块。提供日志消息的显示和可拖拽日志面板的交互功能。
 *
 * 日志面板特性：
 * - 浮动在页面右下角，可通过标题栏拖拽移动
 * - 支持折叠/展开
 * - 支持清空历史
 * - 最多保留 200 条记录，超出自动删除旧记录
 * - 错误消息使用红色高亮样式
 *
 * @author EternoPax
 * @version 1.0.0
 */

import { refs } from "./state.js";

/**
 * 向活动日志面板追加一条日志消息。
 * 新消息插入到列表顶部，超过 200 条时自动删除末尾。
 *
 * @param {string} msg - 日志消息文本
 * @param {"info"|"error"} [type="info"] - 日志级别，"error" 使用红色高亮
 * @returns {void}
 */
export function appendLog(msg, type = "info") {
  const entry = document.createElement("div");
  entry.className = `activity-entry${type === "error" ? " error" : ""}`;
  entry.innerHTML = `<span class="activity-time">${new Date().toLocaleTimeString()}</span><span>${msg}</span>`;
  refs.activityLog.prepend(entry);
  while (refs.activityLog.children.length > 200) refs.activityLog.removeChild(refs.activityLog.lastChild);
}

/**
 * 初始化可拖拽日志面板。
 * 注册以下交互事件：
 * - 标题栏鼠标拖拽（排除按钮点击）
 * - 清空按钮：清除所有日志
 * - 折叠按钮：切换面板展开/折叠状态
 *
 * @returns {void}
 */
export function initDraggableLog() {
  const panel = refs.activityLogPanel;
  const header = refs.activityLogHeader;
  let dragging = false, startX, startY, startLeft, startTop;

  header.addEventListener("mousedown", e => {
    if (e.target.closest(".log-action-btn")) return;
    dragging = true;
    const rect = panel.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    startLeft = rect.left; startTop = rect.top;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.left = startLeft + "px";
    panel.style.top = startTop + "px";
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    panel.style.left = (startLeft + e.clientX - startX) + "px";
    panel.style.top = (startTop + e.clientY - startY) + "px";
  });

  document.addEventListener("mouseup", () => { dragging = false; });

  refs.clearLogButton.addEventListener("click", () => { refs.activityLog.textContent = ""; });
  refs.toggleLogButton.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
    refs.toggleLogButton.textContent = panel.classList.contains("collapsed") ? "+" : "−";
  });
}
