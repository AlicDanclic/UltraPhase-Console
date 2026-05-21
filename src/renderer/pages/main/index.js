/**
 * @module renderer
 * @description 渲染进程入口文件。负责初始化应用：
 * 1. 收集 DOM 引用
 * 2. 注册主进程 IPC 回调
 * 3. 注入预览更新函数（解决模块间循环依赖）
 * 4. 绑定 UI 事件
 * 5. 初始化可拖拽日志面板
 * 6. 刷新串口列表并设置默认任务模式
 *
 * @author EternoPax
 * @version 1.0.0
 */

import { updatePreview, wireActions, collectRefs, updateTaskMode } from "../../modules/ui.js";
import { appendLog, initDraggableLog } from "../../modules/log.js";
import { refreshPorts, setConnected, setUpdatePreviewFn, wireHostCallbacks } from "../../modules/connection.js";

/**
 * 应用初始化入口。
 * 按顺序执行各模块的初始化逻辑，确保 DOM 和 IPC 回调就绪。
 *
 * @async
 * @returns {Promise<void>}
 */
async function initialize() {
  collectRefs();
  wireHostCallbacks();
  setUpdatePreviewFn(updatePreview);
  wireActions();
  initDraggableLog();
  await refreshPorts();
  setConnected(false, "未连接");
  updateTaskMode("task1", true);
  appendLog("主机已就绪");
}

window.addEventListener("DOMContentLoaded", () => initialize().catch(e => appendLog(e.message, "error")));
