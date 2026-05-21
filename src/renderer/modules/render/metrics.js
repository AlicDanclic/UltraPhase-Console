/**
 * @module render/metrics
 * @description 任务指标面板渲染。
 * @author EternoPax
 * @version 1.0.0
 */

import { refs } from "../state.js";

/**
 * 渲染任务指标面板。
 * @param {Array<{label: string, value: string}>} metrics
 */
export function renderMetrics(metrics) {
  refs.metricsGrid.textContent = "";
  metrics.forEach(m => {
    const el = document.createElement("div");
    el.className = "metric-item";
    el.innerHTML = `<span class="metric-label">${m.label}</span><span class="metric-value">${m.value}</span>`;
    refs.metricsGrid.appendChild(el);
  });
}
