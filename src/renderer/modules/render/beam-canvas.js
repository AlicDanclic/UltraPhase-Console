/**
 * @module render/beam-canvas
 * @description Three.js 3D 声场曲面绘制。
 * @author EternoPax
 * @version 1.0.0
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { refs } from "../state.js";
import { ARRAY_POSITIONS } from "../geometry.js";
import { ARRAY_SIZE, PITCH_M } from "../constants.js";

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let surfaceMesh = null;
let markerMesh = null;
let animationStarted = false;

function ensureScene(canvas) {
  if (renderer) return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x111111, 1);

  scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.72));

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.86);
  keyLight.position.set(2.6, 3.2, 3.4);
  scene.add(keyLight);

  const grid = new THREE.GridHelper(4.6, 12, 0x3a3a3a, 0x252525);
  grid.position.y = -0.03;
  scene.add(grid);

  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(2.8, 2.2, 3.5);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.35, 0);
  controls.minDistance = 2.0;
  controls.maxDistance = 7.0;
}

function resizeRenderer(canvas) {
  const width = Math.max(1, canvas.clientWidth || canvas.width);
  const height = Math.max(1, canvas.clientHeight || canvas.height);
  const needsResize = canvas.width !== Math.round(width * renderer.getPixelRatio())
    || canvas.height !== Math.round(height * renderer.getPixelRatio());
  if (needsResize) renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function disposeMesh(mesh) {
  if (!mesh) return;
  scene.remove(mesh);
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
  else mesh.material.dispose();
}

function valueColor(value) {
  const v = Math.max(0, Math.min(1, value));
  const t = Math.sqrt(v);
  const color = new THREE.Color();
  color.setHSL((240 - t * 240) / 360, 0.8 + t * 0.2, 0.16 + t * 0.44);
  return color;
}

function buildSurface(view) {
  const width = view.width;
  const height = view.height;
  const xScale = 3.8;
  const zScale = 2.4;
  const yScale = 1.15;
  const positions = new Float32Array(width * height * 3);
  const colors = new Float32Array(width * height * 3);
  const indices = [];

  for (let r = 0; r < height; r++) {
    const dataY = view.yMax - ((view.yMax - view.yMin) * r) / (height - 1);
    const z = ((dataY - view.yMin) / (view.yMax - view.yMin) - 0.5) * zScale;
    for (let c = 0; c < width; c++) {
      const dataX = view.xMin + ((view.xMax - view.xMin) * c) / (width - 1);
      const x = ((dataX - view.xMin) / (view.xMax - view.xMin) - 0.5) * xScale;
      const value = view.values[r * width + c] || 0;
      const y = Math.sqrt(Math.max(0, value)) * yScale;
      const vertex = (r * width + c) * 3;
      positions[vertex] = x;
      positions[vertex + 1] = y;
      positions[vertex + 2] = z;

      const color = valueColor(value);
      colors[vertex] = color.r;
      colors[vertex + 1] = color.g;
      colors[vertex + 2] = color.b;
    }
  }

  for (let r = 0; r < height - 1; r++) {
    for (let c = 0; c < width - 1; c++) {
      const a = r * width + c;
      const b = a + 1;
      const d = (r + 1) * width + c;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  return new THREE.Mesh(geometry, material);
}

function buildMarker(view) {
  const xScale = 3.8;
  const zScale = 2.4;
  const x = ((view.marker.x - view.xMin) / (view.xMax - view.xMin) - 0.5) * xScale;
  const z = ((view.marker.y - view.yMin) / (view.yMax - view.yMin) - 0.5) * zScale;
  const geometry = new THREE.SphereGeometry(0.055, 18, 12);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444444 });
  const marker = new THREE.Mesh(geometry, material);
  marker.position.set(x, 1.28, z);
  return marker;
}

// ── Volume 3D helpers ──────────────────────────────────────

/** Group holding all volume3d scene objects for easy add/remove. */
let volumeGroup = null;

function disposeGroup(group) {
  if (!group) return;
  group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
  scene.remove(group);
}

/**
 * Map volume3d data coordinates to Three.js world coordinates.
 * World X ← data X (horizontal), World Y ← data Z (propagation), World Z ← data Y (depth).
 */
function volMap(view) {
  const xScale = 4.0;
  const yScale = 3.5;
  const zScale = 4.0;
  return {
    toWorldX: (dx) => ((dx - view.xMin) / (view.xMax - view.xMin) - 0.5) * xScale,
    toWorldZ: (dy) => ((dy - view.yMin) / (view.yMax - view.yMin) - 0.5) * zScale,
    toWorldY: (dz) => ((dz - view.zMin) / (view.zMax - view.zMin)) * yScale,
    xScale, yScale, zScale
  };
}

/** Build a half-transparent grid plane + element dots at z=0 (array face). */
function buildArrayPlane(view) {
  const group = new THREE.Group();
  const m = volMap(view);

  // Grid plane at world Y=0
  const planeGeo = new THREE.PlaneGeometry(m.xScale * 1.1, m.zScale * 1.1, 1, 1);
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x333333, transparent: true, opacity: 0.25, side: THREE.DoubleSide
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0;
  group.add(plane);

  // 25 element dots
  const dotGeo = new THREE.SphereGeometry(0.04, 12, 8);
  const dotMat = new THREE.MeshStandardMaterial({ color: 0x44aaff, emissive: 0x222244 });
  for (const p of ARRAY_POSITIONS) {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(m.toWorldX(p.x), 0.02, m.toWorldZ(p.y));
    group.add(dot);
  }

  // Grid lines
  const lineMat = new THREE.LineBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.5 });
  const half = (ARRAY_SIZE - 1) / 2;
  for (let i = 0; i < ARRAY_SIZE; i++) {
    const coord = (i - half) * PITCH_M;
    // Horizontal lines (along X)
    const hGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(m.toWorldX(-half * PITCH_M), 0.01, m.toWorldZ(coord)),
      new THREE.Vector3(m.toWorldX(half * PITCH_M), 0.01, m.toWorldZ(coord))
    ]);
    group.add(new THREE.Line(hGeo, lineMat));
    // Vertical lines (along Y)
    const vGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(m.toWorldX(coord), 0.01, m.toWorldZ(-half * PITCH_M)),
      new THREE.Vector3(m.toWorldX(coord), 0.01, m.toWorldZ(half * PITCH_M))
    ]);
    group.add(new THREE.Line(vGeo, lineMat));
  }

  return group;
}

/** Build stacked transparent heatmap planes for volume3d data. */
function buildLayers(view) {
  const group = new THREE.Group();
  const m = volMap(view);
  const { nx, ny, nz, values, zMin, zMax } = view;

  // Select ~10 evenly-spaced layers
  const layerCount = Math.min(nz, 10);
  const step = (nz - 1) / (layerCount - 1);

  for (let li = 0; li < layerCount; li++) {
    const iz = Math.round(li * step);
    const z = zMin + ((zMax - zMin) * iz) / (nz - 1);

    const positions = new Float32Array(nx * ny * 3);
    const colors = new Float32Array(nx * ny * 3);
    const indices = [];

    for (let iy = 0; iy < ny; iy++) {
      const dataY = view.yMin + ((view.yMax - view.yMin) * iy) / (ny - 1);
      for (let ix = 0; ix < nx; ix++) {
        const dataX = view.xMin + ((view.xMax - view.xMin) * ix) / (nx - 1);
        const idx = iz * nx * ny + iy * nx + ix;
        const value = values[idx] || 0;

        const vert = (iy * nx + ix) * 3;
        positions[vert] = m.toWorldX(dataX);
        positions[vert + 1] = m.toWorldY(z);
        positions[vert + 2] = m.toWorldZ(dataY);

        const color = valueColor(value);
        colors[vert] = color.r;
        colors[vert + 1] = color.g;
        colors[vert + 2] = color.b;
      }
    }

    for (let iy = 0; iy < ny - 1; iy++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const a = iy * nx + ix;
        const b = a + 1;
        const d = (iy + 1) * nx + ix;
        const e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    group.add(new THREE.Mesh(geo, mat));
  }

  return group;
}

/** Build a dotted center axis line from array face to far Z. */
function buildCenterLine(view) {
  const m = volMap(view);
  const points = [
    new THREE.Vector3(m.toWorldX(view.marker.x), 0, m.toWorldZ(view.marker.y)),
    new THREE.Vector3(m.toWorldX(view.marker.x), m.yScale, m.toWorldZ(view.marker.y))
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.08, gapSize: 0.04 });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  return line;
}

/** Build a focal point marker for volume3d. */
function buildVolumeMarker(view) {
  const m = volMap(view);
  const geo = new THREE.SphereGeometry(0.06, 18, 12);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444444 });
  const marker = new THREE.Mesh(geo, mat);
  marker.position.set(m.toWorldX(view.marker.x), m.toWorldY(view.marker.z), m.toWorldZ(view.marker.y));
  return marker;
}

function animate() {
  animationStarted = true;
  requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;
  controls?.update();
  resizeRenderer(refs.beamCanvas);
  renderer.render(scene, camera);
}

/**
 * Build a flat 2D heatmap plane from view data.
 */
function buildHeatmap(view) {
  const width = view.width;
  const height = view.height;
  const xScale = 3.8;
  const zScale = 2.4;
  const positions = new Float32Array(width * height * 3);
  const colors = new Float32Array(width * height * 3);
  const indices = [];

  for (let r = 0; r < height; r++) {
    const dataY = view.yMax - ((view.yMax - view.yMin) * r) / (height - 1);
    const z = ((dataY - view.yMin) / (view.yMax - view.yMin) - 0.5) * zScale;
    for (let c = 0; c < width; c++) {
      const dataX = view.xMin + ((view.xMax - view.xMin) * c) / (width - 1);
      const x = ((dataX - view.xMin) / (view.xMax - view.xMin) - 0.5) * xScale;
      const value = view.values[r * width + c] || 0;
      const vertex = (r * width + c) * 3;
      positions[vertex] = x;
      positions[vertex + 1] = 0;
      positions[vertex + 2] = z;
      const color = valueColor(value);
      colors[vertex] = color.r;
      colors[vertex + 1] = color.g;
      colors[vertex + 2] = color.b;
    }
  }

  for (let r = 0; r < height - 1; r++) {
    for (let c = 0; c < width - 1; c++) {
      const a = r * width + c;
      const b = a + 1;
      const d = (r + 1) * width + c;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide
  });

  return new THREE.Mesh(geometry, material);
}

/**
 * Build a marker for heatmap mode (same position as 3D marker but on the plane).
 */
function buildHeatmapMarker(view) {
  const xScale = 3.8;
  const zScale = 2.4;
  const x = ((view.marker.x - view.xMin) / (view.xMax - view.xMin) - 0.5) * xScale;
  const z = ((view.marker.y - view.yMin) / (view.yMax - view.yMin) - 0.5) * zScale;
  const geometry = new THREE.SphereGeometry(0.055, 18, 12);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444444 });
  const marker = new THREE.Mesh(geometry, material);
  marker.position.set(x, 0.02, z);
  return marker;
}

/**
 * 在 Canvas 上绘制声场。
 * @param {Object} view - 声场视图数据
 * @param {string} [mode="surface"] - 渲染模式："surface" | "heatmap" | "volume"
 */
export function renderBeam(view, mode = "surface") {
  const canvas = refs.beamCanvas;
  ensureScene(canvas);
  resizeRenderer(canvas);

  // Clean up previous meshes
  disposeMesh(surfaceMesh);
  disposeMesh(markerMesh);
  disposeGroup(volumeGroup);
  surfaceMesh = null;
  markerMesh = null;
  volumeGroup = null;

  if (mode === "volume" && view.kind === "volume3d") {
    volumeGroup = new THREE.Group();
    volumeGroup.add(buildArrayPlane(view));
    volumeGroup.add(buildLayers(view));
    volumeGroup.add(buildCenterLine(view));
    volumeGroup.add(buildVolumeMarker(view));
    scene.add(volumeGroup);
    refs.beamCaption.textContent = `3D 体积声场预览：${view.xLabel} / ${view.yLabel} / ${view.zLabel}`;
  } else if (mode === "heatmap") {
    surfaceMesh = buildHeatmap(view);
    markerMesh = buildHeatmapMarker(view);
    scene.add(surfaceMesh);
    scene.add(markerMesh);
    refs.beamCaption.textContent = view.kind === "farfield"
      ? `2D 远场偏转预览：${view.xLabel} / ${view.yLabel}`
      : `2D 聚焦声场预览：${view.xLabel} / ${view.yLabel}`;
  } else {
    surfaceMesh = buildSurface(view);
    markerMesh = buildMarker(view);
    scene.add(surfaceMesh);
    scene.add(markerMesh);
    refs.beamCaption.textContent = view.kind === "farfield"
      ? `3D 远场偏转预览：${view.xLabel} / ${view.yLabel}`
      : `3D 聚焦声场预览：${view.xLabel} / ${view.yLabel}`;
  }

  if (!animationStarted) animate();
}

/**
 * 将 25 个值格式化为 5×5 文本网格。
 * @param {number[]} vals
 * @returns {string}
 */
export function formatGrid(vals) {
  const lines = [];
  for (let r = 0; r < 5; r++) {
    lines.push(vals.slice(r*5, r*5+5).map(v => String(v).padStart(3, " ")).join(" "));
  }
  return lines.join("\n");
}
