/**
 * @module render/selected-card
 * @description 选中阵元的详细信息卡片渲染。
 * @author EternoPax
 * @version 1.0.0
 */

import { state, refs } from "../state.js";
import { ARRAY_POSITIONS } from "../geometry.js";

/**
 * 渲染选中阵元的详细信息卡片。
 */
export function renderSelectedCard() {
  const i = state.selectedIndex;
  const p = ARRAY_POSITIONS[i];
  const ph = state.phaseTable[i];
  const amp = state.ampTable[i];
  refs.selectedCard.innerHTML = `
    <div class="selected-line"><span class="selected-key">通道</span><span>CH${String(i+1).padStart(2,"0")}</span></div>
    <div class="selected-line"><span class="selected-key">网格</span><span>行${p.row+1} 列${p.col+1}</span></div>
    <div class="selected-line"><span class="selected-key">相位</span><span>${ph} (${((ph/256)*360).toFixed(1)}°)</span></div>
    <div class="selected-line"><span class="selected-key">幅度</span><span>${amp} (${((amp/255)*100).toFixed(1)}%)</span></div>
    <div class="selected-line"><span class="selected-key">X</span><span>${(p.x*1000).toFixed(1)} mm</span></div>
    <div class="selected-line"><span class="selected-key">Y</span><span>${(p.y*1000).toFixed(1)} mm</span></div>`;
}
