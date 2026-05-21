/**
 * @module beam
 * @description 波束计算编排：任务求解、控制参数读取、指标生成。
 * @author EternoPax
 * @version 1.0.0
 */

import { TASKS, ELEMENT_COUNT } from "../constants.js";
import { state } from "../state.js";
import { buildAmplitudeProfile } from "./window.js";
import { buildSteeringPhaseTable, buildFocusPhaseTable } from "./phase.js";
import { computeFarField, computeFocus, computeVolume3D } from "./field.js";

/**
 * 从 DOM 控件读取当前控制参数值。
 * @returns {Object} 控制参数
 */
export function getControlValues() {
  return {
    thetaX: Number(document.getElementById("thetaXNumber").value),
    thetaY: Number(document.getElementById("thetaYNumber").value),
    focusMm: Number(document.getElementById("focusNumber").value),
    gainPercent: Number(document.getElementById("gainNumber").value),
    windowName: document.getElementById("windowSelect").value,
    useAdcEnvelope: document.getElementById("adcCheckbox").checked,
    powerPolicy: document.getElementById("powerPolicySelect").value,
    pressureStrategy: document.getElementById("pressureStrategySelect").value
  };
}

/**
 * 根据任务模式和压力策略确定生效的窗函数和功率策略。
 * @param {Object} ctrl
 * @returns {Object}
 */
export function effectiveScenario(ctrl) {
  if (state.taskMode !== "task3") return { ...ctrl, effectiveWindowName: ctrl.windowName, effectivePowerPolicy: ctrl.powerPolicy };
  if (ctrl.pressureStrategy === "max_pressure") return { ...ctrl, effectiveWindowName: "Flat", effectivePowerPolicy: "peak" };
  if (ctrl.pressureStrategy === "balanced_focus") return { ...ctrl, effectiveWindowName: "Stage2", effectivePowerPolicy: "peak" };
  return { ...ctrl, effectiveWindowName: ctrl.windowName, effectivePowerPolicy: "equal_rms" };
}

/**
 * 求解当前任务。返回完整任务解。
 * @returns {Object}
 */
export function solveMission() {
  const ctrl = effectiveScenario(getControlValues());
  const amp = buildAmplitudeProfile(ctrl.effectiveWindowName, ctrl.gainPercent, ctrl.effectivePowerPolicy);
  const phase = state.taskMode === "task1"
    ? buildSteeringPhaseTable(ctrl.thetaX, ctrl.thetaY)
    : buildFocusPhaseTable(ctrl.thetaX, ctrl.thetaY, ctrl.focusMm);
  const tp = { x: (ctrl.focusMm/1000)*Math.tan(ctrl.thetaX*Math.PI/180), y: (ctrl.focusMm/1000)*Math.tan(ctrl.thetaY*Math.PI/180), z: ctrl.focusMm/1000 };
  const amps = amp.amplitudes;
  const isTask1 = state.taskMode === "task1";
  const surfaceView = isTask1
    ? computeFarField(amps, phase, ctrl)
    : computeFocus(amps, phase, ctrl, tp);
  const volumeView = isTask1 ? null : computeVolume3D(amps, phase, ctrl, tp);

  return {
    task: TASKS[state.taskMode], controls: ctrl,
    phaseTable: phase, ampTable: amp.ampTable, amplitudes: amps,
    targetPoint: tp,
    metrics: buildMetrics(ctrl, amp, tp),
    view: surfaceView,
    volumeView,
    note: buildNote(ctrl, amp)
  };
}

/**
 * 生成任务描述文本。
 */
function buildNote(ctrl, amp) {
  const wn = { Flat: "平坦", Stage2: "二级", Hann: "汉恩", Hamming: "汉明" }[ctrl.effectiveWindowName] || ctrl.effectiveWindowName;
  if (state.taskMode === "task1") return `远场偏转：θx=${ctrl.thetaX.toFixed(1)}° θy=${ctrl.thetaY.toFixed(1)}° 窗函数：${wn}`;
  if (state.taskMode === "task2") return `近场聚焦：${ctrl.focusMm.toFixed(0)} 毫米 窗函数：${wn}`;
  return `驱动功率为全平坦孔径的 ${(amp.totalPowerRatio*100).toFixed(1)}%`;
}

/**
 * 生成任务指标数组。
 */
function buildMetrics(ctrl, amp, tp) {
  const wn = { Flat: "平坦", Stage2: "二级", Hann: "汉恩", Hamming: "汉明" }[ctrl.effectiveWindowName] || ctrl.effectiveWindowName;
  const pn = ctrl.effectivePowerPolicy === "equal_rms" ? "等 RMS" : "峰值限制";
  const m = [
    { label: "窗函数", value: wn },
    { label: "策略", value: pn },
    { label: "驱动功率", value: `${(amp.totalPowerRatio*100).toFixed(1)}%` },
    { label: "相干和", value: `${(amp.coherentSumRatio*100).toFixed(1)}%` },
    { label: "聚焦效率", value: `${(amp.coherentEfficiency*100).toFixed(1)}%` },
    { label: "削顶通道", value: `${amp.clippedCount}/${ELEMENT_COUNT}` }
  ];
  if (state.taskMode === "task1") {
    m.unshift({ label: "任务", value: "加窗偏转" }, { label: "目标角度", value: `${ctrl.thetaX.toFixed(1)}° ${ctrl.thetaY.toFixed(1)}°` });
  } else {
    m.unshift({ label: "任务", value: state.taskMode === "task2" ? "距离聚焦" : "功率聚焦" }, { label: "焦距", value: `${ctrl.focusMm.toFixed(0)} mm` });
  }
  return m;
}
