/**
 * @module render/array-grid
 * @description 5×5 阵列网格渲染。
 * @author EternoPax
 * @version 1.0.0
 */

import { state, refs } from "../state.js";
import { ARRAY_POSITIONS } from "../geometry.js";
import { renderSelectedCard } from "./selected-card.js";

/**
 * 渲染 5×5 阵列网格。圆点色相 = 相位，大小/亮度 = 幅度。
 */
export function renderArrayGrid() {
  refs.arrayGrid.textContent = "";
  state.phaseTable.forEach((phase, i) => {
    const amp = state.ampTable[i];
    const pos = ARRAY_POSITIONS[i];
    const hue = Math.round((phase / 256) * 360);
    const light = Math.round(30 + (amp / 255) * 40);
    const dotSz = Math.round(14 + (amp / 255) * 18);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `array-cell${state.selectedIndex === i ? " selected" : ""}`;
    btn.style.setProperty("--dot-hue", String(hue));
    btn.style.setProperty("--dot-light", `${light}%`);
    btn.style.setProperty("--dot-size", `${dotSz}px`);
    btn.style.gridRow = String(pos.row + 1);
    btn.style.gridColumn = String(pos.col + 1);
    btn.innerHTML = `<div class="cell-label">CH${String(i+1).padStart(2,"0")}</div><div class="cell-visual"><div class="cell-dot"></div></div><div class="cell-values"><div>P${String(phase).padStart(3)}</div><div>A${String(amp).padStart(3)}</div></div>`;
    btn.addEventListener("click", () => { state.selectedIndex = i; renderArrayGrid(); renderSelectedCard(); });
    refs.arrayGrid.appendChild(btn);
  });
}
