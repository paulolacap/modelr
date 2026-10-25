import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import Module from 'manifold-3d';

// Units are millimetres. Three.js is Y-up; printers are Z-up, so the UI and STL
// export map three (x, y, z) to printer (x, -z, y).

const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
const font = new Font(JSON.parse($('font-data').textContent));
const STORE_KEY = 'shape-workshop-v1';

// ---------- shapes ----------
function extrudeFlat(shape, curveSegments = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments });
  g.rotateX(-Math.PI / 2);
  return g;
}
function starShape(points = 5, outer = 1, inner = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer, a = Math.PI / 2 + (i * Math.PI) / points;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  return s;
}
function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -1);
  s.bezierCurveTo(-0.15, -0.8, -1, -0.35, -1, 0.25);
  s.bezierCurveTo(-1, 0.75, -0.55, 1, -0.3, 1);
  s.bezierCurveTo(-0.1, 1, 0, 0.85, 0, 0.7);
  s.bezierCurveTo(0, 0.85, 0.1, 1, 0.3, 1);
  s.bezierCurveTo(0.55, 1, 1, 0.75, 1, 0.25);
  s.bezierCurveTo(1, -0.35, 0.15, -0.8, 0, -1);
  return s;
}

const SHAPES = {
  box:      { label: 'Box',         size: [20, 20, 20], make: () => new THREE.BoxGeometry(1, 1, 1) },
  rbox:     { label: 'Rounded box', size: [20, 20, 20], make: () => new RoundedBoxGeometry(1, 1, 1, 4, 0.12) },
  cylinder: { label: 'Cylinder',    size: [20, 20, 20], make: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 64) },
  sphere:   { label: 'Sphere',      size: [20, 20, 20], make: () => new THREE.SphereGeometry(0.5, 48, 24) },
  cone:     { label: 'Cone',        size: [20, 20, 20], make: () => new THREE.ConeGeometry(0.5, 1, 64) },
  pyramid:  { label: 'Pyramid',     size: [20, 20, 20], make: () => new THREE.ConeGeometry(0.5, 1, 4).rotateY(Math.PI / 4) },
  wedge:    { label: 'Wedge',       size: [20, 20, 20], make: () => {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1, 0); s.lineTo(0, 1); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  } },
  hexagon:  { label: 'Hexagon',     size: [20, 20, 23.1], make: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 6) },
  tube:     { label: 'Tube',        size: [20, 20, 20], make: () => {
    const s = new THREE.Shape(); s.absarc(0, 0, 1, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.absarc(0, 0, 0.75, 0, Math.PI * 2, true); s.holes.push(h);
    return extrudeFlat(s, 48);
  } },
  torus:    { label: 'Ring',        size: [20, 4.6, 20], make: () => new THREE.TorusGeometry(1, 0.3, 24, 72).rotateX(-Math.PI / 2) },
  star:     { label: 'Star',        size: [20, 5, 19], make: () => extrudeFlat(starShape()) },
  heart:    { label: 'Heart',       size: [20, 5, 20], make: () => extrudeFlat(heartShape(), 32) },
  text:     { label: 'Text',        size: null, make: null },
};
const SOLID_BIN = ['box', 'rbox', 'cylinder', 'sphere', 'cone', 'pyramid', 'wedge', 'hexagon', 'tube', 'torus', 'star', 'heart', 'text'];
const HOLE_BIN = [
  { type: 'box', label: 'Box hole', size: [10, 20, 10] },
  { type: 'cylinder', label: 'Round hole', size: [10, 30, 10] },
  { type: 'cylinder', label: 'Screw hole 3 mm', size: [3.4, 30, 3.4] },
];
const COLORS = ['#e8551c', '#e23b3b', '#f2b705', '#3fae49', '#14a3a3', '#2f6fdb', '#7a4fd6', '#e05aa8', '#f4f1ea', '#9aa4ae', '#3a3f45', '#1b1b1b'];

function makeUnit(g) {
  g.deleteAttribute('uv');
  if (g.getAttribute('uv1')) g.deleteAttribute('uv1');
  g.clearGroups();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  g.computeBoundingBox();
  const bb = g.boundingBox, c = new THREE.Vector3(), s = new THREE.Vector3();
  bb.getCenter(c); bb.getSize(s);
  g.translate(-c.x, -c.y, -c.z);
  g.scale(1 / Math.max(s.x, 1e-6), 1 / Math.max(s.y, 1e-6), 1 / Math.max(s.z, 1e-6));
  g.computeBoundingBox(); g.computeBoundingSphere();
  g.userData.natural = s.toArray();
  return g;
}
function textGeometry(text) {
  const g = new TextGeometry(text || ' ', { font, size: 10, depth: 3, curveSegments: 5, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

const geomCache = new Map();
function geomKey(o) {
  if (o.type === 'text') return 'text:' + o.text;
  if (o.type === 'group') return 'group:' + JSON.stringify(o.children.map(childSig));
  if (isMaker(o)) { const { boxId, ...rest } = o.p; return o.type + ':' + JSON.stringify(rest); }
  return o.type;
}
function childSig(c) { return [geomKey(c), c.hole ? 1 : 0, c.pos, c.rot, c.size]; }
function unitGeom(o) {
  const key = geomKey(o);
  let g = geomCache.get(key);
  if (!g) {
    if (o.type === 'text') g = makeUnit(textGeometry(o.text));
    else if (o.type === 'group') g = makeUnit(groupRaw(o.children));
    else if (isMaker(o)) g = makeUnit(MAKERS[o.type].build(o.p));
    else g = makeUnit(SHAPES[o.type].make());
    geomCache.set(key, g);
  }
  return g;
}
function matrixOf(o) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rot[0] * DEG, o.rot[1] * DEG, o.rot[2] * DEG));
  return new THREE.Matrix4().compose(new THREE.Vector3(...o.pos), q, new THREE.Vector3(...o.size));
}

// ---------- CSG ----------
// Manifold does the cutting and joining. It always returns a closed, watertight mesh, which is
// what slicers want, and it copes with faces that touch exactly.
// The Artifact and standalone builds carry the WASM inline; the website build leaves it out and loads it beside manifold.js on the CDN.
const wasmEl = $('manifold-wasm');
const wasm = await Module(wasmEl ? { wasmBinary: Uint8Array.from(atob(wasmEl.textContent.trim()), (c) => c.charCodeAt(0)) } : {});
wasm.setup();
function toManifold(g) {
  let p = new THREE.BufferGeometry();
  p.setAttribute('position', g.getAttribute('position').clone());
  if (g.index) p.setIndex(g.index.clone());
  p = mergeVertices(p, 1e-5);
  const idx = p.index.array, tri = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    if (a !== b && b !== c && a !== c) tri.push(a, b, c);
  }
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties: new Float32Array(p.getAttribute('position').array), triVerts: new Uint32Array(tri) });
  mesh.merge();
  return new wasm.Manifold(mesh);
}
function combine(solids, holes) {
  if (!solids.length) { solids = holes; holes = []; }
  if (!solids.length) return new THREE.BufferGeometry();
  const made = [];
  const keep = (m) => { made.push(m); return m; };
  try {
    const parts = solids.map((g) => keep(toManifold(g)));
    let acc = parts.length > 1 ? keep(wasm.Manifold.union(parts)) : parts[0];
    if (holes.length) {
      const cut = holes.map((g) => keep(toManifold(g)));
      acc = keep(acc.subtract(cut.length > 1 ? keep(wasm.Manifold.union(cut)) : cut[0]));
    }
    const out = acc.getMesh();
    const n = out.numProp, vp = out.vertProperties, pos = new Float32Array((vp.length / n) * 3);
    for (let i = 0, j = 0; i < vp.length; i += n, j += 3) { pos[j] = vp[i]; pos[j + 1] = vp[i + 1]; pos[j + 2] = vp[i + 2]; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(out.triVerts), 1));
    const flat = g.toNonIndexed();
    flat.computeVertexNormals();
    return flat;
  } finally {
    for (const m of made) m.delete();
  }
}
// @@MAKERS@@
// @@HARDWARE@@
// @@JOINTS@@
function groupRaw(children) {
  const solids = [], holes = [];
  for (const c of children) {
    const g = unitGeom(c).clone().applyMatrix4(matrixOf(c));
    (c.hole ? holes : solids).push(g);
  }
  return combine(solids, holes);
}

// ---------- state ----------
let doc = { name: 'My design', objects: [] };
let selection = [];
let nextId = 1;
let mode = 'translate';
let snap = 1;
let lockRatio = false;
let isExample = false;
const history = { stack: [], index: -1 };

const newId = () => 'o' + (nextId++) + Math.random().toString(36).slice(2, 6);
const byId = (id) => doc.objects.find((o) => o.id === id);
const selObjs = () => selection.map(byId).filter(Boolean);
const round = (v, step = 0.01) => Math.round(v / step) * step;
const fmt = (v) => (Math.round(v * 100) / 100).toString();
const snapV = (v) => (snap > 0 ? round(v, snap) : round(v, 0.01));

function commit() {
  const s = JSON.stringify(doc.objects);
  if (history.stack[history.index] === s) return;
  history.stack.length = history.index + 1;
  history.stack.push(s);
  if (history.stack.length > 80) history.stack.shift();
  history.index = history.stack.length - 1;
  if (history.index > 0) isExample = false;
  persist();
  updateButtons();
}
function restore(i) {
  history.index = i;
  doc.objects = JSON.parse(history.stack[i]);
  selection = selection.filter((id) => byId(id));
  syncScene(); renderCard(); persist(); updateButtons();
}
function undo() { if (history.index > 0) restore(history.index - 1); }
function redo() { if (history.index < history.stack.length - 1) restore(history.index + 1); }
let warnedFull = false;
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ name: doc.name, objects: doc.objects, example: isExample })); }
  catch (e) {
    // Usually a design with big pictures is over the browser's storage limit.
    if (!warnedFull && e && e.name === 'QuotaExceededError') { warnedFull = true; toast('This design is too big to keep in the browser. Use Save to keep a copy as a file.'); }
  }
}

// ---------- three setup ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.prepend(renderer.domElement);
renderer.domElement.tabIndex = 0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 8000);
camera.position.set(0, 170, 230);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a4, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(120, 260, 180); scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-200, 80, -150); scene.add(fill);

const PLATE = 200;
const plateGroup = new THREE.Group(); scene.add(plateGroup);
let plateMesh, gridMinor, gridMajor, axisX, axisY;
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function buildPlate() {
  plateGroup.clear();
  plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(PLATE, PLATE).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: css('--plate') }));
  plateMesh.position.y = -0.05; plateMesh.userData.isPlate = true;
  gridMinor = new THREE.GridHelper(PLATE, PLATE / 2, css('--grid-minor'), css('--grid-minor'));
  gridMajor = new THREE.GridHelper(PLATE, PLATE / 10, css('--grid-major'), css('--grid-major'));
  gridMinor.position.y = 0.01; gridMajor.position.y = 0.02;
  axisX = line([-PLATE / 2, 0.05, PLATE / 2], [PLATE / 2, 0.05, PLATE / 2], '#e23b3b');
  axisY = line([-PLATE / 2, 0.05, PLATE / 2], [-PLATE / 2, 0.05, -PLATE / 2], '#3fae49');
  plateGroup.add(plateMesh, gridMinor, gridMajor, axisX, axisY, label('Front', 0, PLATE / 2 + 12), label('X', PLATE / 2 + 8, PLATE / 2, '#e23b3b'), label('Y', -PLATE / 2, -PLATE / 2 - 8, '#3fae49'));
  scene.background = new THREE.Color(css('--stage'));
}
function line(a, b, color) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), new THREE.LineBasicMaterial({ color }));
}
function label(text, x, z, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color || css('--muted'); ctx.font = '600 40px Figtree, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(32, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.position.set(x, 0.1, z);
  return m;
}
buildPlate();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { buildPlate(); syncScene(); });
new MutationObserver(() => { buildPlate(); syncScene(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

const objectRoot = new THREE.Group(); scene.add(objectRoot);
const meshes = new Map();

// TransformControls first, then our pointer handler, then OrbitControls, so each can claim a press in that order.
const tc = new TransformControls(camera, renderer.domElement);
tc.setSize(0.9);
scene.add(tc.getHelper());
// Drop the free-move and free-spin handles: they move shapes in ways that are hard to predict.
for (const [m, name] of [['translate', 'XYZ'], ['rotate', 'XYZE']]) {
  for (const part of [tc._gizmo.gizmo[m], tc._gizmo.picker[m]]) part.children.filter((c) => c.name === name).forEach((c) => part.remove(c));
}
let tcStart = null;

function syncScene() {
  const seen = new Set();
  const selColor = new THREE.Color(css('--sel'));
  for (const o of doc.objects) {
    seen.add(o.id);
    let m = meshes.get(o.id);
    const key = geomKey(o);
    if (!m) {
      m = new THREE.Mesh(); m.userData.id = o.id; meshes.set(o.id, m); objectRoot.add(m);
    }
    if (m.userData.key !== key || m.userData.hole !== o.hole || m.userData.color !== o.color) {
      m.geometry = unitGeom(o);
      m.userData.key = key; m.userData.hole = o.hole; m.userData.color = o.color;
      m.material = o.hole
        ? new THREE.MeshStandardMaterial({ color: css('--hole'), transparent: true, opacity: 0.38, depthWrite: false, roughness: 0.8 })
        : m.geometry.getAttribute('color')
          ? new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.6 })
          : new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.55, metalness: 0.02 });
      m.clear();
      if (o.hole) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), new THREE.LineBasicMaterial({ color: css('--hole') })));
      const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)), new THREE.LineBasicMaterial({ color: selColor, depthTest: false, transparent: true, opacity: 0.9 }));
      box.renderOrder = 10; box.name = 'sel'; m.add(box);
    }
    m.renderOrder = o.hole ? 2 : 0;
    applyToMesh(o, m);
    const isSel = selection.includes(o.id);
    m.getObjectByName('sel').visible = isSel;
    if (!o.hole) m.material.emissive.setHex(isSel ? 0x1a1a1a : 0x000000);
  }
  for (const [id, m] of meshes) if (!seen.has(id)) { objectRoot.remove(m); meshes.delete(id); }
  attachGizmo();
}
function applyToMesh(o, m) {
  m.position.set(...o.pos);
  m.rotation.set(o.rot[0] * DEG, o.rot[1] * DEG, o.rot[2] * DEG);
  m.scale.set(...o.size);
  m.updateMatrixWorld(true);
}
function readFromMesh(o, m) {
  o.pos = m.position.toArray().map((v) => round(v, 0.001));
  o.rot = [m.rotation.x, m.rotation.y, m.rotation.z].map((v) => round(v / DEG, 0.01));
  o.size = m.scale.toArray().map((v) => Math.max(0.2, round(Math.abs(v), 0.001)));
}
// In Move mode the handle is a single lift arrow on a pivot just above the selection;
// sliding across the plate is done by dragging the shape itself.
const pivot = new THREE.Object3D(); scene.add(pivot);
function placePivot() {
  const objs = selObjs(); if (!objs.length) return;
  const b = new THREE.Box3();
  for (const o of objs) b.union(new THREE.Box3().setFromObject(meshes.get(o.id)));
  pivot.position.set((b.min.x + b.max.x) / 2, b.max.y + 3, (b.min.z + b.max.z) / 2);
  pivot.updateMatrixWorld(true);
}
function attachGizmo() {
  const objs = selObjs();
  tc.setMode(mode);
  tc.showX = tc.showZ = mode !== 'translate';
  if (mode === 'translate' && objs.length) { placePivot(); tc.attach(pivot); tc.setSpace('world'); }
  else if (objs.length === 1 && !(mode === 'scale' && isMaker(objs[0]))) { tc.attach(meshes.get(objs[0].id)); tc.setSpace('local'); }
  else tc.detach();
}
function worldBox(o) {
  const m = meshes.get(o.id);
  m.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(m, true);
}
function boxOf(objs) {
  const b = new THREE.Box3();
  for (const o of objs) b.union(worldBox(o));
  return b;
}

tc.addEventListener('dragging-changed', (e) => {
  orbit.enabled = !e.value;
  if (e.value) { tcStart = { y: pivot.position.y, items: selObjs().map((o) => ({ o, y0: o.pos[1] })) }; return; }
  tcStart = null;
  if (mode !== 'translate') {
    const o = selObjs()[0];
    if (o) { readFromMesh(o, meshes.get(o.id)); finishSize(o); applyToMesh(o, meshes.get(o.id)); }
  }
  placePivot(); commit(); renderCard();
});
tc.addEventListener('objectChange', () => {
  if (mode === 'translate') {
    if (!tcStart) return;
    const dy = snapV(pivot.position.y - tcStart.y);
    pivot.position.y = tcStart.y + dy;
    for (const { o, y0 } of tcStart.items) { o.pos[1] = round(y0 + dy, 0.001); applyToMesh(o, meshes.get(o.id)); }
    updateCardValues();
    return;
  }
  const o = selObjs()[0]; if (!o) return;
  const m = meshes.get(o.id);
  if (mode === 'scale' && snap > 0) {
    m.scale.set(...m.scale.toArray().map((v) => Math.max(snap, round(Math.abs(v), snap))));
  }
  readFromMesh(o, m);
  updateCardValues();
});
function finishSize(o) { o.size = o.size.map((v) => Math.max(0.2, v)); }
function setSnap(v) {
  snap = v;
  tc.setRotationSnap(15 * DEG);
  tc.setScaleSnap(null);
}

// ---------- picking & dragging ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function setNdc(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
function pick(e) {
  setNdc(e);
  const hits = raycaster.intersectObjects([...meshes.values()], false);
  return hits[0] || null;
}
function floorPoint(e, y = 0) {
  setNdc(e);
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
}

let drag = null, press = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  renderer.domElement.focus({ preventScroll: true });
  if (e.button !== 0 || tc.dragging) return;
  press = { x: e.clientX, y: e.clientY, empty: false };
  const hit = pick(e);
  if (!hit) { press.empty = true; return; }
  const id = hit.object.userData.id;
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    selection = selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
    select(selection);
    if (!selection.includes(id)) return;
  } else if (!selection.includes(id)) select([id]);
  orbit.enabled = false;
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -hit.point.y);
  drag = { plane, start: hit.point.clone(), items: selObjs().map((o) => ({ o, p0: [...o.pos] })), moved: false };
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!drag) return;
  setNdc(e);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(drag.plane, p)) return;
  const dx = snapV(p.x - drag.start.x), dz = snapV(p.z - drag.start.z);
  if (!drag.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 4) return;
  drag.moved = true;
  for (const { o, p0 } of drag.items) {
    o.pos = [round(p0[0] + dx, 0.001), p0[1], round(p0[2] + dz, 0.001)];
    applyToMesh(o, meshes.get(o.id));
  }
  placePivot();
  updateCardValues();
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (drag) {
    if (drag.moved) commit();
    drag = null; orbit.enabled = true;
    renderCard();
  } else if (press && press.empty && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 4 && !tc.dragging && tc.axis === null) {
    select([]);
  }
  press = null;
});

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true; orbit.dampingFactor = 0.12;
orbit.minDistance = 8; orbit.maxDistance = 2500;
orbit.screenSpacePanning = true;

// ---------- operations ----------
function select(ids) {
  selection = ids.filter((id) => byId(id));
  syncScene(); renderCard();
}
function freeSpot(size) {
  // Spiral out from the centre of the plate until the new footprint touches nothing.
  const step = 5;
  const boxes = doc.objects.map(worldBox);
  for (let r = 0; r < 20; r++) {
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      const x = i * step * Math.max(1, Math.ceil(size[0] / step / 2)), z = j * step * Math.max(1, Math.ceil(size[2] / step / 2));
      const b = new THREE.Box3(new THREE.Vector3(x - size[0] / 2 - 1, 0, z - size[2] / 2 - 1), new THREE.Vector3(x + size[0] / 2 + 1, size[1], z + size[2] / 2 + 1));
      if (!boxes.some((bb) => bb.intersectsBox(b))) return [x, z];
    }
  }
  return [0, 0];
}
function addShape(spec, at) {
  clearExample();
  const o = { id: newId(), type: spec.type, hole: !!spec.hole, color: spec.hole ? COLORS[0] : (spec.color || pickColor()), pos: [0, 0, 0], rot: [0, 0, 0], size: [...(spec.size || (SHAPES[spec.type] && SHAPES[spec.type].size) || [20, 20, 20])] };
  if (spec.type === 'text') {
    o.text = spec.text || 'Hello';
    o.size = [...unitGeom(o).userData.natural];
  }
  if (isMaker(o)) { o.p = structuredClone(spec.p); refreshMakerSize(o); }
  const [x, z] = at ? [snapV(at.x), snapV(at.z)] : freeSpot(o.size);
  o.pos = [x, o.size[1] / 2, z];
  doc.objects.push(o);
  select([o.id]);
  commit();
  if (o.type === 'outline' && !spec.quiet) edOpen(o);
  return o;
}
let colorCursor = 0;
function pickColor() { const c = COLORS[colorCursor % 8]; colorCursor++; return c; }
function deleteSel() {
  if (!selection.length) return;
  doc.objects = doc.objects.filter((o) => !selection.includes(o.id));
  select([]); commit();
}
function duplicateSel() {
  const objs = selObjs(); if (!objs.length) return;
  const b = boxOf(objs);
  const shift = snapV(Math.max(5, b.max.x - b.min.x + 5));
  const idMap = {};
  const copies = objs.map((o) => { const c = structuredClone(o); c.id = newId(); idMap[o.id] = c.id; c.pos[0] = round(c.pos[0] + shift, 0.001); return c; });
  for (const c of copies) if (c.type === 'lid') c.p.boxId = idMap[c.p.boxId] || null;
  doc.objects.push(...copies);
  select(copies.map((c) => c.id)); commit();
}
function dropSel() {
  for (const o of selObjs()) { const b = worldBox(o); o.pos[1] = round(o.pos[1] - b.min.y, 0.001); }
  syncScene(); commit(); renderCard();
}
function toggleHole() {
  const objs = selObjs(); if (!objs.length) return;
  const to = !objs.every((o) => o.hole);
  objs.forEach((o) => { o.hole = to; });
  syncScene(); commit(); renderCard();
}
function rotateSel(axis) {
  // 90° turn around a printer axis, in world space, about each shape's own centre.
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis), Math.PI / 2);
  for (const o of selObjs()) {
    const m = meshes.get(o.id);
    m.quaternion.premultiply(q);
    m.rotation.setFromQuaternion(m.quaternion);
    readFromMesh(o, m);
    o.rot = o.rot.map((v) => round(v, 0.5));
    applyToMesh(o, m);
    const b = worldBox(o);
    if (b.min.y < -0.01) { o.pos[1] = round(o.pos[1] - b.min.y, 0.001); applyToMesh(o, m); }
  }
  commit(); renderCard();
}
function nudge(dx, dy, dz) {
  const objs = selObjs(); if (!objs.length) return;
  for (const o of objs) { o.pos = [round(o.pos[0] + dx, 0.001), round(o.pos[1] + dy, 0.001), round(o.pos[2] + dz, 0.001)]; applyToMesh(o, meshes.get(o.id)); }
  commit(); updateCardValues();
}
function align(axis, where) {
  const objs = selObjs(); if (objs.length < 2) return;
  const all = boxOf(objs);
  for (const o of objs) {
    const b = worldBox(o);
    const target = where === 'min' ? all.min.getComponent(axis) : where === 'max' ? all.max.getComponent(axis) : (all.min.getComponent(axis) + all.max.getComponent(axis)) / 2;
    const cur = where === 'min' ? b.min.getComponent(axis) : where === 'max' ? b.max.getComponent(axis) : (b.min.getComponent(axis) + b.max.getComponent(axis)) / 2;
    o.pos[axis] = round(o.pos[axis] + target - cur, 0.001);
    applyToMesh(o, meshes.get(o.id));
  }
  commit(); renderCard();
}
function busy(on) { $('busy').hidden = !on; }
function groupSel() {
  const objs = selObjs();
  if (objs.length < 2) { toast('Pick two or more shapes first. Hold Shift and click to pick more than one.'); return; }
  busy(true);
  setTimeout(() => {
    try {
      const floor = boxOf(objs).min.y;
      const children = structuredClone(objs);
      const raw = groupRaw(children);
      raw.computeBoundingBox();
      if (raw.boundingBox.isEmpty()) throw new Error('empty');
      const c = new THREE.Vector3(), s = new THREE.Vector3();
      raw.boundingBox.getCenter(c); raw.boundingBox.getSize(s);
      for (const ch of children) { ch.pos = [round(ch.pos[0] - c.x, 0.001), round(ch.pos[1] - c.y, 0.001), round(ch.pos[2] - c.z, 0.001)]; }
      const solid = children.find((ch) => !ch.hole);
      const g = { id: newId(), type: 'group', hole: !solid, color: solid ? solid.color : COLORS[0], children, pos: c.toArray().map((v) => round(v, 0.001)), rot: [0, 0, 0], size: s.toArray().map((v) => round(v, 0.001)), base: s.toArray().map((v) => round(v, 0.001)) };
      doc.objects = doc.objects.filter((o) => !selection.includes(o.id));
      doc.objects.push(g);
      select([g.id]);
      g.pos[1] = round(g.pos[1] + Math.max(0, floor) - worldBox(g).min.y, 0.001); // keep it on the plate
      syncScene(); commit();
      if (children.some((ch) => ch.hole) && solid) toast('Grouped. The holes are now cut out of the shape.');
    } catch (err) {
      console.error(err);
      toast('Those shapes could not be combined. Try nudging them so their faces do not line up exactly, then group again.');
    }
    busy(false);
  }, 30);
}
function ungroupSel() {
  const groups = selObjs().filter((o) => o.type === 'group');
  if (!groups.length) return;
  const out = [];
  for (const g of groups) {
    const gm = matrixOf(g).multiply(new THREE.Matrix4().makeScale(1 / g.base[0], 1 / g.base[1], 1 / g.base[2]));
    for (const ch of g.children) {
      const m = gm.clone().multiply(matrixOf(ch));
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      m.decompose(p, q, s);
      const e = new THREE.Euler().setFromQuaternion(q);
      const c = structuredClone(ch);
      c.id = newId();
      c.pos = p.toArray().map((v) => round(v, 0.001));
      c.rot = [e.x, e.y, e.z].map((v) => round(v / DEG, 0.01));
      c.size = s.toArray().map((v) => round(Math.abs(v), 0.001));
      out.push(c);
    }
    doc.objects = doc.objects.filter((o) => o.id !== g.id);
  }
  doc.objects.push(...out);
  select(out.map((o) => o.id)); commit();
}
function selectAll() { select(doc.objects.map((o) => o.id)); }
function clearExample() {
  if (!isExample) return;
  isExample = false;
}
function newDesign() {
  doc.objects = []; doc.name = 'My design'; $('projectName').value = doc.name; isExample = false;
  select([]); commit();
  toast('Started a new design. Press Undo to bring the old one back.');
}

// ---------- camera ----------
const target = new THREE.Vector3();
function setView(kind) {
  let objs = selObjs(); if (!objs.length) objs = doc.objects;
  const b = objs.length ? boxOf(objs) : new THREE.Box3(new THREE.Vector3(-50, 0, -50), new THREE.Vector3(50, 20, 50));
  const c = b.getCenter(new THREE.Vector3());
  const r = Math.max(b.getSize(new THREE.Vector3()).length() / 2, 15);
  const fov = camera.fov * DEG;
  let dist = (r / Math.sin(fov / 2)) * 1.15;
  let dir;
  if (kind === 'home') { orbit.target.set(0, 0, 0); camera.position.set(0, 170, 230); camera.updateProjectionMatrix(); return; }
  if (kind === 'top') dir = new THREE.Vector3(0, 1, 0.001);
  else if (kind === 'front') dir = new THREE.Vector3(0, 0.05, 1);
  else if (kind === 'side') dir = new THREE.Vector3(1, 0.05, 0);
  else dir = camera.position.clone().sub(orbit.target).normalize();
  orbit.target.copy(c);
  camera.position.copy(c).addScaledVector(dir.normalize(), dist);
}

// ---------- export ----------
function printerTriangles() {
  const solids = [], holes = [];
  for (const o of doc.objects) {
    const g = unitGeom(o).clone().applyMatrix4(matrixOf(o));
    (o.hole ? holes : solids).push(g);
  }
  if (!solids.length) return null;
  let geom;
  try { geom = holes.length || solids.length > 1 ? combine(solids, holes) : solids[0]; }
  catch (err) {
    console.error(err);
    if (holes.length) throw err;
    geom = null;
  }
  const parts = geom ? [geom] : solids;
  const tris = [];
  let minZ = Infinity;
  const toPrinter = (v) => [v.x, -v.z, v.y];
  for (const g of parts) {
    const pos = g.getAttribute('position'), idx = g.index;
    const count = idx ? idx.count : pos.count;
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i += 3) {
      const t = [];
      for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k); const p = toPrinter(v); minZ = Math.min(minZ, p[2]); t.push(p); }
      tris.push(t);
    }
  }
  return { tris, minZ };
}
function binarySTL({ tris, minZ }) {
  const buf = new ArrayBuffer(84 + tris.length * 50), dv = new DataView(buf);
  const head = 'Shape Workshop STL, units mm';
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i));
  dv.setUint32(80, tris.length, true);
  let off = 84;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (const t of tris) {
    a.set(t[0][0], t[0][1], t[0][2] - minZ); b.set(t[1][0], t[1][1], t[1][2] - minZ); c.set(t[2][0], t[2][1], t[2][2] - minZ);
    n.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    for (const v of [n, a, b, c]) { dv.setFloat32(off, v.x, true); dv.setFloat32(off + 4, v.y, true); dv.setFloat32(off + 8, v.z, true); off += 12; }
    dv.setUint16(off, 0, true); off += 2;
  }
  return new Uint8Array(buf);
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(d) { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipOne(name, data) {
  const nameB = new TextEncoder().encode(name), crc = crc32(data);
  const local = new Uint8Array(30 + nameB.length), lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(8, 0, true);
  lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, nameB.length, true);
  local.set(nameB, 30);
  const central = new Uint8Array(46 + nameB.length), cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
  cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, nameB.length, true);
  central.set(nameB, 46);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, 1, true); ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true); ev.setUint32(16, local.length + data.length, true);
  return new Blob([local, data, central, end]);
}
const inViewer = !!(window.claude && window.claude.use);
const downloadsP = inViewer ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
function safeName(s) { return (s || 'design').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'design'; }
async function offerFile(filename, data) {
  if (!inViewer) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
    a.download = filename; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return true;
  }
  const dl = await downloadsP;
  if (!dl) { toast('Saving files is not available in this view. Open the page in claude.ai or use the standalone file.'); return false; }
  try { await dl.save({ filename, data }); return true; }
  catch (err) {
    if (err && err.code === 'declined') toast('Download cancelled.');
    else if (err && err.code === 'rate_limited') toast('A download prompt is already open.');
    else toast('That download did not go through (' + ((err && err.code) || 'error') + ').');
    return false;
  }
}
async function exportSTL() {
  if (!doc.objects.some((o) => !o.hole)) { toast('Add at least one solid shape before exporting.'); return; }
  busy(true); $('busy').textContent = 'Building your STL…';
  await new Promise((r) => setTimeout(r, 30));
  let tri;
  try { tri = printerTriangles(); }
  catch (err) { console.error(err); busy(false); toast('The holes could not be cut. Try grouping a few shapes at a time, then export again.'); return; }
  busy(false); $('busy').textContent = 'Combining shapes…';
  if (!tri || !tri.tris.length) { toast('Nothing to export. The holes may cover every solid.'); return; }
  const stl = binarySTL(tri);
  const base = safeName(doc.name);
  // The claude.ai viewer only hands out a fixed list of file types, so the STL travels inside a zip there.
  const ok = inViewer ? await offerFile(base + '.zip', zipOne(base + '.stl', stl)) : await offerFile(base + '.stl', stl);
  if (ok) toast(inViewer ? `Saved ${base}.zip. Unzip it to get ${base}.stl for your slicer.` : `Saved ${base}.stl (${tri.tris.length.toLocaleString()} triangles).`);
}
async function saveProject() {
  const data = JSON.stringify({ app: 'shape-workshop', version: 1, name: doc.name, objects: doc.objects }, null, 1);
  if (await offerFile(safeName(doc.name) + '.json', data)) toast('Design saved as a file. Use Open to load it again.');
}
function loadProject(text) {
  try {
    const d = JSON.parse(text);
    if (!Array.isArray(d.objects)) throw new Error('bad');
    doc.objects = d.objects; doc.name = d.name || 'My design'; $('projectName').value = doc.name; isExample = false;
    select([]); commit(); setView('fit');
    toast('Opened ' + doc.name + '.');
  } catch (e) { toast('That file is not a Shape Workshop design.'); }
}

// ---------- print check ----------
const PRINTERS = [
  ['Bambu Lab A1 mini', 180, 180, 180], ['Bambu Lab A1, P1S, X1C', 256, 256, 256], ['Prusa MK4 / Core One', 250, 210, 220],
  ['Prusa MINI', 180, 180, 180], ['Creality Ender 3', 220, 220, 250], ['Creality K1', 220, 220, 250], ['Elegoo Neptune 4', 225, 225, 265],
];
let printerIdx = 1;
try { const v = parseInt(localStorage.getItem('shape-workshop-printer'), 10); if (v >= 0 && v < PRINTERS.length) printerIdx = v; } catch (e) { /* storage unavailable */ }
function analyze(tri) {
  const { tris, minZ } = tri;
  let vol = 0, area = 0, over = 0;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const ids = new Map(), parent = [];
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const vid = (p) => { const key = p[0].toFixed(3) + ',' + p[1].toFixed(3) + ',' + p[2].toFixed(3); let i = ids.get(key); if (i === undefined) { i = parent.length; parent.push(i); ids.set(key, i); } return i; };
  const zOf = [];
  for (const t of tris) {
    const [a, b, c] = t.map((p) => [p[0], p[1], p[2] - minZ]);
    for (const v of [a, b, c]) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], v[i]); hi[i] = Math.max(hi[i], v[i]); }
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(...n), A = len / 2;
    area += A;
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    if (len > 0 && n[2] / len < -0.707 && Math.min(a[2], b[2], c[2]) > 0.4) over += A;
    const ia = vid(a), ib = vid(b), ic = vid(c);
    zOf[ia] = a[2]; zOf[ib] = b[2]; zOf[ic] = c[2];
    parent[find(ib)] = find(ia); parent[find(ic)] = find(ia);
  }
  const low = new Map();
  for (let i = 0; i < parent.length; i++) { const r = find(i); low.set(r, Math.min(low.has(r) ? low.get(r) : Infinity, zOf[i])); }
  const lows = [...low.values()];
  return { vol: Math.abs(vol), area, over, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], parts: lows.length, floating: lows.filter((z) => z > 0.3).length };
}
function designChecks() {
  const out = [];
  const walk = (list) => {
    for (const o of list) {
      if (o.type === 'group') { walk(o.children); continue; }
      if (o.hole) continue;
      const name = shapeLabel(o);
      if (o.type === 'storage') {
        const p = o.p;
        if (p.wall < 0.8) out.push(['bad', `${name}: the ${fmt(p.wall)} mm walls are thinner than most nozzles can print. Use 1.2 mm or more.`]);
        else if (p.wall < 1.2) out.push(['warn', `${name}: ${fmt(p.wall)} mm walls are only two lines thick with a 0.4 mm nozzle and may be flimsy. 1.2 mm or more is sturdier.`]);
        if ((p.cols > 1 || p.rows > 1) && p.divT < 0.8) out.push(['warn', `${name}: ${fmt(p.divT)} mm dividers are very thin. Try 1.2 mm.`]);
        if (p.floor < 0.8) out.push(['warn', `${name}: a ${fmt(p.floor)} mm floor may let light through or crack. Try 1.2 mm.`]);
        if (p.style !== 'gridfinity' && p.lid === 'slide' && p.wall < 1.6) out.push(['warn', `${name}: the slide-on lid's grooves cut into the walls. With ${fmt(p.wall)} mm walls they get weak; 1.6 mm or more is better.`]);
        if (p.style !== 'gridfinity' && p.lid !== 'none' && p.lidT < 1.2) out.push(['warn', `${name}: a ${fmt(p.lidT)} mm lid will bend easily.`]);
      } else if (!isMaker(o)) {
        const t = Math.min(...o.size);
        if (t < 0.8) out.push(['warn', `${name}: only ${fmt(t)} mm thick in one direction, which is thinner than most nozzles can print well.`]);
      }
    }
  };
  walk(doc.objects);
  return out;
}
function hm(sec) { const m = Math.max(1, Math.round(sec / 60)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; }
async function openCheck() {
  $('checkOverlay').hidden = false;
  const body = $('checkBody');
  if (!doc.objects.some((o) => !o.hole)) { body.innerHTML = '<p class="help">Add a solid shape first, then check it here.</p>'; return; }
  body.innerHTML = '<p class="help">Checking your design…</p>';
  await new Promise((r) => setTimeout(r, 30));
  let tri;
  try { tri = printerTriangles(); } catch (err) { console.error(err); body.innerHTML = '<p class="help">The holes could not be cut, so the design could not be checked.</p>'; return; }
  if (!tri || !tri.tris.length) { body.innerHTML = '<p class="help">Nothing would print. The holes may cover every solid shape.</p>'; return; }
  const a = analyze(tri);
  const items = [];
  const [pn, bx, by, bz] = PRINTERS[printerIdx];
  const [sx, sy, sz] = a.size;
  if (sx > bx + 0.01 || sy > by + 0.01 || sz > bz + 0.01) items.push(['bad', `Too big for the ${pn}. The design is ${fmt(sx)} × ${fmt(sy)} × ${fmt(sz)} mm and the printer fits ${bx} × ${by} × ${bz} mm.`]);
  else items.push(['ok', `Fits the ${pn} (${fmt(sx)} × ${fmt(sy)} × ${fmt(sz)} mm).`]);
  if (a.floating) items.push(['bad', `${a.floating} part${a.floating > 1 ? 's float' : ' floats'} above the plate and would print in mid-air. Select ${a.floating > 1 ? 'them' : 'it'} and press Drop to plate, or move it so it touches the part below.`]);
  else items.push(['ok', a.parts > 1 ? `${a.parts} separate parts, all sitting on the plate.` : 'Everything sits on the plate.']);
  const overPct = a.area ? (a.over / a.area) * 100 : 0;
  if (a.over > 40 && overPct > 1) items.push(['warn', `About ${fmt(a.over / 100)} cm² faces downward at more than 45°. Turn on supports in your slicer, or turn the part so those faces point up.`]);
  else items.push(['ok', 'No steep overhangs. It should print without supports.']);
  const thin = designChecks();
  items.push(...thin);
  if (!thin.length) items.push(['ok', 'No thin walls found.']);
  const shell = Math.min(a.vol, a.area * 0.8), printed = shell + (a.vol - shell) * 0.15;
  const grams = (printed / 1000) * 1.24, metres = printed / (Math.PI * 0.875 * 0.875) / 1000;
  const secs = printed / 8 + (sz / 0.2) * 3;
  const icon = { ok: '✓', warn: '!', bad: '✕' };
  body.innerHTML = `
    <div class="stats">
      <div><span>Size</span><b>${fmt(sx)} × ${fmt(sy)} × ${fmt(sz)} mm</b></div>
      <div><span>Filament</span><b>${grams < 10 ? fmt(Math.round(grams * 10) / 10) : Math.round(grams)} g · ${fmt(Math.round(metres * 10) / 10)} m</b></div>
      <div><span>Print time</span><b>about ${hm(secs)}</b></div>
    </div>
    <ul class="checks">${items.map(([k, t]) => `<li class="${k}"><span class="ic" aria-label="${k === 'ok' ? 'Fine' : k === 'warn' ? 'Worth a look' : 'Problem'}">${icon[k]}</span><span>${esc(t)}</span></li>`).join('')}</ul>
    <p class="help">Estimates assume PLA, 0.2 mm layers, 15% infill and 2 walls. Your slicer will give the real numbers.</p>`;
}
$('checkPrinter').innerHTML = PRINTERS.map(([n, x, y, z], i) => `<option value="${i}" ${i === printerIdx ? 'selected' : ''}>${n} (${x} × ${y} × ${z})</option>`).join('');
$('checkPrinter').onchange = (e) => { printerIdx = +e.target.value; try { localStorage.setItem('shape-workshop-printer', String(printerIdx)); } catch (er) { /* storage unavailable */ } openCheck(); };
$('btnCheck').onclick = openCheck;
$('checkClose').onclick = () => { $('checkOverlay').hidden = true; };
$('checkOverlay').onclick = (e) => { if (e.target === $('checkOverlay')) $('checkOverlay').hidden = true; };

// ---------- side card ----------
const card = $('card');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function shapeLabel(o) {
  if (o.type === 'group') return o.hole ? 'Grouped hole' : 'Grouped shape';
  const base = o.type === 'picture' ? PIC_MODES[o.p.mode] : o.type === 'outline' && o.p.mode === 'spin' ? 'Spun shape' : o.type === 'storage' && o.p.style === 'gridfinity' ? 'Gridfinity bin' : (MAKERS[o.type] || SHAPES[o.type]).label;
  return o.hole ? base + ' hole' : base;
}
function num(id, label, value, step) {
  return `<div class="field"><label for="${id}">${label} <span class="unit">mm</span></label><input id="${id}" type="number" inputmode="decimal" step="${step || (snap || 0.1)}" value="${fmt(value)}"></div>`;
}
const LID_NOTES = {
  none: 'Pick a lid style and a matching lid appears next to the box.',
  friction: 'A lip under the lid pushes into the opening. Too tight? Make the fit gap bigger. Too loose? Make it smaller.',
  slide: 'The lid slides in from the front along grooves in the walls. Walls of 1.6 mm or more work best.',
  hinge: 'Push a piece of 1.75 mm filament through the knuckles at the back to make the hinge pin.',
  inner: 'The hinge is hidden inside the box, so the outside stays a clean rectangle. Two round pegs inside the side walls click into sockets in two ears under the lid. Press the lid down onto the box, flexing the ears a little, and it clicks in. It opens to about 90°. Print it in PETG for the best flex. Too loose or too tight? Change the fit gap.',
  snaphinge: 'No pin needed. The lid has a peg out of each side of its hinge knuckle; hold the lid upright behind the box and press the pegs down into the open sockets until they click. Too tight or too loose? Change the fit gap.',
};
function makerForm(o) {
  const p = o.p;
  if (o.type === 'gfplate') return [{ title: 'Size', note: 'Each square holds a 1 × 1 Gridfinity bin and is 42 mm across. Screw or glue it into a drawer.', fields: [['gx', 'Width', 'squares', 1, 12, 1], ['gy', 'Depth', 'squares', 1, 12, 1]] }];
  if (o.type === 'lid' || o.type === 'picture') return [];
  if (o.type === 'hinge' || o.type === 'latch') return hwForm(o);
  if (o.type === 'joint') return jointForm(o);
  const g = p.style === 'gridfinity';
  return [
    g ? { title: 'Size', note: '1 unit is 42 mm across and 7 mm tall, so it fits any Gridfinity baseplate.', fields: [['gx', 'Width', 'units', 1, 10, 1], ['gy', 'Depth', 'units', 1, 10, 1], ['gz', 'Height', 'units', 2, 24, 1]] }
      : { title: 'Size', note: 'Outside size, walls included.', fields: [['w', 'Width', 'mm', 10, 400, 1], ['d', 'Depth', 'mm', 10, 400, 1], ['h', 'Height', 'mm', 5, 300, 1]] },
    { title: 'Walls', fields: g ? [['wall', 'Wall', 'mm', 0.8, 4, 0.1], ['floor', 'Floor', 'mm', 0.6, 5, 0.1]]
      : [['wall', 'Wall', 'mm', 0.8, 6, 0.1], ['floor', 'Floor', 'mm', 0.6, 6, 0.1], ['radius', 'Corners', 'mm', 0, 30, 0.5], ['soften', 'Bottom edge', 'mm', 0, 10, 0.5]],
      note: g ? '' : 'Corners rounds the upright edges. Bottom edge softens the edge along the bottom.' },
    { title: 'Compartments', fields: [['cols', 'Columns', '', 1, 12, 1], ['rows', 'Rows', '', 1, 12, 1], ['divT', 'Divider', 'mm', 0.6, 4, 0.1], ['divH', 'Divider height', '%', 10, 100, 5]] },
    { title: 'Easy to grab', checks: [['scoop', 'Finger scoop at the front of each row'], ['notch', 'Finger notch in the front wall'], ['handles', 'Handle slots in the sides']], fields: p.scoop ? [['scoopR', 'Scoop size', 'mm', 3, 40, 1]] : [] },
    { title: 'Label', select: ['label', [['none', 'No label'], ['shelf', 'Label shelf inside each row'], ['raised', 'Raised text on the front'], ['engraved', 'Engraved text on the front']]], text: p.label === 'raised' || p.label === 'engraved' ? ['labelText', 'Text'] : null,
      note: p.label === 'shelf' ? 'A sloped ledge at the back of each row, sized for a small sticker or written label.' : '' },
    !g && { title: 'Lid', select: ['lid', [['none', 'No lid'], ['friction', 'Push-on lid'], ['slide', 'Slide-on lid'], ['hinge', 'Hinged lid (filament pin)'], ['snaphinge', 'Snap-on hinged lid'], ['inner', 'Inner hinged lid (hidden hinge)']]], fields: p.lid !== 'none' ? [['lidT', 'Lid thickness', 'mm', 1, 5, 0.1], ['tol', 'Fit gap', 'mm', 0.1, 1, 0.05]] : [], note: LID_NOTES[p.lid] },
    !g && ['hinge', 'snaphinge', 'inner'].includes(p.lid) && { title: 'Lock', select: ['lock', LOCK_CHOICES], note: p.lock === 'clasp' ? 'A springy hook on the lid clicks under a ledge on the front of the box. Pull the little lip at the bottom of the hook to open it.' : p.lock === 'padlock' ? 'The lid and the box each get a tab with a hole. Slide a small padlock, a zip tie or a cable tie through both holes. The tab sticks out 12 mm at the front.' : 'Add a lock to keep the lid shut.' },
    g ? { title: 'Stacking', checks: [['lip', 'Stacking lip so another bin sits on top'], ['magnets', 'Magnet holes under the feet (6 × 2 mm)']] }
      : { title: 'Stacking', checks: [['stack', 'Stacking foot that drops into the box below']], fields: p.stack && p.lid === 'none' ? [['tol', 'Fit gap', 'mm', 0.1, 1, 0.05]] : [], note: p.stack ? 'The bottom 3 mm steps in so it sits inside the top of an identical box.' : '' },
  ].filter(Boolean);
}
function makerSections(o) {
  if (o.type === 'picture') {
    const p = o.p;
    const swaps = p.mode === 'hueforge' ? hfSwaps(p) : [];
    return `<div class="section">
      <button class="btn primary big" id="mPic">Picture settings</button>
      <p class="help">${PIC_HELP[p.mode]}</p>
    </div>
    ${p.mode === 'hueforge' ? `<div class="section"><h2>Colour changes</h2>
      <ol class="swaps"><li><span class="chip" style="background:${p.stack[0].color}"></span><span>Start with <b>${esc(p.stack[0].name)}</b>, ${fmt(p.lh)} mm layers, first layer ${fmt(p.first)} mm</span></li>${swaps.map((c) => `<li><span class="chip" style="background:${c.color}"></span><span>At layer <b>${c.layer}</b> (Z ${fmt(c.z)} mm) change to <b>${esc(c.name)}</b></span></li>`).join('')}</ol>
      <button class="btn small" id="mCopySwaps">Copy this list</button>
      <p class="help">In your slicer, add a filament change (Bambu Studio, PrusaSlicer, Orca, Cura: "pause" or "colour change") at each layer above. Set the layer height and first layer to match.</p></div>` : ''}`;
  }
  if (o.type === 'outline') {
    const sp = o.p.mode === 'spin';
    return `<div class="section">
      <button class="btn primary big" id="mEdit">Edit dots</button>
      <p class="help">${sp ? `A side profile spun all the way round, ${o.p.prof.length} dots.` : `An outline of ${o.p.pts.length} dots pushed up ${fmt(o.p.height)} mm${o.p.twist ? `, twisted ${fmt(o.p.twist)}°` : ''}${(o.p.topScale ?? 100) !== 100 ? `, top at ${fmt(o.p.topScale)}%` : ''}.`} Its size comes from the dots, so change it in the editor.</p>
    </div>`;
  }
  if (o.type === 'lid') {
    const box = byId(o.p.boxId);
    return `<div class="section"><p class="help">${box ? 'This lid is made to fit its box. Change the lid style, thickness or fit gap on the box and the lid follows.' : 'The box this lid was made for is gone, so this lid no longer updates.'}</p>${box ? '<button class="btn small" id="mSelBox">Select the box</button>' : ''}</div>`;
  }
  return makerForm(o).map((sec) => `<div class="section">
      <h2>${sec.title}</h2>
      ${sec.select ? `<div class="field"><select id="p_${sec.select[0]}" class="sel">${sec.select[1].map(([v, l]) => `<option value="${v}" ${o.p[sec.select[0]] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}
      ${sec.text ? `<div class="field"><label for="p_${sec.text[0]}">${sec.text[1]}</label><input id="p_${sec.text[0]}" type="text" maxlength="40" value="${esc(o.p[sec.text[0]] || '')}" style="font-family:var(--font-body)"></div>` : ''}
      ${(sec.checks || []).map(([key, l]) => `<label class="check"><input type="checkbox" id="p_${key}" ${o.p[key] ? 'checked' : ''}> ${l}</label>`).join('')}
      ${sec.fields && sec.fields.length ? `<div class="field-grid">${sec.fields.map(([key, l, unit, min, max, step]) => `<div class="field"><label for="p_${key}">${l} <span class="unit">${unit}</span></label><input id="p_${key}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${fmt(o.p[key])}"></div>`).join('')}</div>` : ''}
      ${sec.note ? `<p class="help">${sec.note}</p>` : ''}
    </div>`).join('');
}
function bindMaker(o) {
  if (o.type === 'outline') { $('mEdit').onclick = () => edOpen(o); return; }
  if (o.type === 'picture') {
    $('mPic').onclick = () => picOpen(o.p.mode, o);
    const cp = $('mCopySwaps');
    if (cp) cp.onclick = () => {
      const p = o.p, lines = [`Layer height ${p.lh} mm, first layer ${p.first} mm. Start with ${p.stack[0].name}.`, ...hfSwaps(p).map((c) => `Layer ${c.layer} (Z ${c.z} mm): change to ${c.name}`)];
      navigator.clipboard.writeText(lines.join('\n')).then(() => toast('Copied the colour changes.'), () => toast('Copying is blocked here. Select the list and copy it by hand.'));
    };
    return;
  }
  if (o.type === 'lid') { const b = $('mSelBox'); if (b) b.onclick = () => select([o.p.boxId]); return; }
  for (const sec of makerForm(o)) {
    for (const [key, , , min, max, step] of sec.fields || []) {
      $('p_' + key).onchange = (e) => {
        let v = parseFloat(e.target.value);
        if (!isFinite(v)) { renderCard(); return; }
        v = clamp(step >= 1 ? Math.round(v) : v, min, max);
        o.p[key] = v; updateMaker(o);
      };
    }
    for (const [key] of sec.checks || []) $('p_' + key).onchange = (e) => { o.p[key] = e.target.checked; updateMaker(o); };
    if (sec.select) $('p_' + sec.select[0]).onchange = (e) => {
      if (sec.select[0] === 'kind') o.p = { ...HW_DEFAULTS[o.type][e.target.value] };
      else o.p[sec.select[0]] = e.target.value;
      updateMaker(o);
    };
    if (sec.text) $('p_' + sec.text[0]).onchange = (e) => { o.p[sec.text[0]] = e.target.value; updateMaker(o); };
  }
}
function refreshMakerSize(o) { o.size = unitGeom(o).userData.natural.map((v) => round(v, 0.001)); }
function updateMaker(o) {
  busy(true); $('busy').textContent = 'Building…';
  setTimeout(() => {
    try {
      const bottom = worldBox(o).min.y;
      refreshMakerSize(o);
      syncScene();
      o.pos[1] = round(o.pos[1] + bottom - worldBox(o).min.y, 0.001);
      if (o.type === 'storage') syncLid(o);
      syncScene(); commit(); renderCard();
    } catch (err) {
      console.error(err);
      restore(history.index);
      toast(o.type === 'storage' ? 'Those settings do not fit together. Try a bigger box, thinner walls or fewer compartments.' : 'Those settings do not fit together. Try a bigger size or smaller holes.');
    }
    busy(false); $('busy').textContent = 'Combining shapes…';
  }, 20);
}
function syncLid(box) {
  const lid = doc.objects.find((o) => o.type === 'lid' && o.p.boxId === box.id);
  if (box.p.style === 'gridfinity' || box.p.lid === 'none') {
    if (lid) doc.objects = doc.objects.filter((o) => o !== lid);
    return;
  }
  if (lid) {
    lid.p = lidParamsOf(box); refreshMakerSize(lid);
    lid.rot = [0, 0, 0]; lid.pos[1] = lid.size[1] / 2;
    return;
  }
  const n = { id: newId(), type: 'lid', hole: false, color: box.color, p: lidParamsOf(box), pos: [0, 0, 0], rot: [0, 0, 0], size: [1, 1, 1] };
  refreshMakerSize(n);
  const b = worldBox(box);
  n.pos = [round(b.max.x + 10 + n.size[0] / 2, 0.5), n.size[1] / 2, round((b.min.z + b.max.z) / 2, 0.5)];
  doc.objects.push(n);
  toast('Added a matching lid next to the box. Print them both.');
}
function renderCard() {
  if (!tcStart) placePivot();
  const objs = selObjs();
  if (!objs.length) {
    card.innerHTML = `
      <div class="section">
        <h3>Start building</h3>
        ${isExample ? `<div class="example-note"><b>This is an example</b>, a keychain tag made from a rounded box, a round hole and raised text. Click any part to see how it was made, or press <b>New</b> to start fresh.</div>` : ''}
        <ol class="steps">
          <li><span><b>Add shapes.</b> Click one on the left. It lands on the plate.</span></li>
          <li><span><b>Drag it</b> to move it. Use the handles to lift, turn or stretch it, or type exact sizes here.</span></li>
          <li><span><b>Make holes.</b> Switch a shape to <i>Hole</i> and push it into a solid shape.</span></li>
          <li><span><b>Group them.</b> Shift-click both, then press Group. The hole is cut out.</span></li>
          <li><span><b>Export STL</b> and open it in your slicer. <b>Print check</b> first catches common problems.</span></li>
        </ol>
      </div>
      <div class="section">
        <h2>Quick start</h2>
        <p class="help">Press <b>Type what you want</b> at the top left and describe it in simple words, like <i>box 120 x 80 x 50 mm with a hinged lid</i>. Or use the <b>Storage</b> and <b>Hinges &amp; locks</b> shapes on the left, which build things for you. Set the size, compartments, lid, scoops and label here, and the box rebuilds itself.</p>
      </div>
      <div class="section">
        <h2>In this design</h2>
        <p class="help">${doc.objects.length ? `${doc.objects.length} shape${doc.objects.length > 1 ? 's' : ''}. Press <kbd class="k">Ctrl</kbd>+<kbd class="k">A</kbd> to pick them all.` : 'Nothing yet. The plate is 200 × 200 mm, which fits most printers.'}</p>
        <p class="help">All sizes are in millimetres. Snap sets the step that shapes move and resize by.</p>
      </div>`;
    return;
  }
  if (objs.length > 1) {
    const holes = objs.filter((o) => o.hole).length;
    card.innerHTML = `
      <div class="section">
        <div class="row" style="justify-content:space-between"><h3>${objs.length} shapes picked</h3><span class="badge">${holes ? holes + ' hole' + (holes > 1 ? 's' : '') : 'all solid'}</span></div>
        <button class="btn primary big" id="cGroup">Group into one shape</button>
        <p class="help">${holes ? 'Holes will be cut out of the solid shapes they touch.' : 'Overlapping shapes are fused together. Turn a shape into a hole first if you want to cut it out.'}</p>
      </div>
      <div class="section">
        <h2>Line them up</h2>
        <div class="align-grid">
          <span>Left · Right</span><button data-al="0,min">Left</button><button data-al="0,mid">Centre</button><button data-al="0,max">Right</button>
          <span>Back · Front</span><button data-al="2,min">Back</button><button data-al="2,mid">Centre</button><button data-al="2,max">Front</button>
          <span>Up · Down</span><button data-al="1,min">Bottom</button><button data-al="1,mid">Middle</button><button data-al="1,max">Top</button>
        </div>
        <p class="help">Lines shapes up against the box around all of them. Centre + Centre puts a hole right in the middle.</p>
      </div>
      <div class="section">
        <div class="row">
          <button class="btn small" id="cHole">${holes === objs.length ? 'Make solid' : 'Make holes'}</button>
          <button class="btn small" id="cDup">Duplicate</button>
          <button class="btn small" id="cDrop">Drop to plate</button>
          <button class="btn small" id="cDel">Delete</button>
        </div>
      </div>`;
    $('cGroup').onclick = groupSel;
    card.querySelectorAll('[data-al]').forEach((b) => { b.onclick = () => { const [a, w] = b.dataset.al.split(','); align(+a, w); }; });
    $('cHole').onclick = toggleHole; $('cDup').onclick = duplicateSel; $('cDrop').onclick = dropSel; $('cDel').onclick = deleteSel;
    return;
  }
  const o = objs[0];
  card.innerHTML = `
    <div class="section">
      <h3>${esc(shapeLabel(o))}</h3>
      <div class="kind" role="group" aria-label="Solid or hole">
        <button id="kSolid" aria-pressed="${!o.hole}"><span class="sw-solid" style="background:${o.color}"></span>Solid</button>
        <button id="kHole" aria-pressed="${o.hole}"><span class="sw-hole"></span>Hole</button>
      </div>
      ${o.hole ? '<p class="help">A hole shows as see-through grey. Group it with a solid shape to cut it out.</p>' : `<div class="swatches" role="group" aria-label="Colour">${COLORS.map((c) => `<button class="swatch" data-c="${c}" style="background:${c}" aria-label="Colour ${c}" aria-pressed="${c === o.color}"></button>`).join('')}</div>`}
    </div>
    ${o.type === 'text' ? `<div class="section"><div class="field"><label for="fText">Text</label><input id="fText" type="text" value="${esc(o.text)}" maxlength="60" style="font-family:var(--font-body)"></div><p class="help">Letters lie flat on the plate. Change the height below to make them thicker.</p></div>` : ''}
    ${isMaker(o) ? makerSections(o) : `<div class="section">
      <div class="row" style="justify-content:space-between"><h2 style="margin:0">Size</h2><label class="check"><input type="checkbox" id="fLock" ${lockRatio ? 'checked' : ''}> Keep proportions</label></div>
      <div class="field-grid">${num('fW', 'Width', o.size[0])}${num('fD', 'Depth', o.size[2])}${num('fH', 'Height', o.size[1])}</div>
    </div>`}
    <div class="section">
      <h2>Position</h2>
      <div class="field-grid">${num('fX', 'X', o.pos[0])}${num('fY', 'Y', -o.pos[2])}${num('fZ', 'Lift', 0)}</div>
      <p class="help">Lift is the gap under the shape. 0 means it sits on the plate.</p>
    </div>
    <div class="section">
      <h2>Turn 90°</h2>
      <div class="row">
        <button class="btn small" id="rZ" title="Spin around the up axis">↻ Spin</button>
        <button class="btn small" id="rX" title="Tip toward you">⤵ Tip forward</button>
        <button class="btn small" id="rY" title="Tip onto its side">⤳ Tip sideways</button>
      </div>
      <p class="help">Or pick <b>Rotate</b> at the top and drag a ring. It clicks every 15°.</p>
    </div>
    <div class="section">
      <div class="row">
        <button class="btn small" id="cDup">Duplicate</button>
        <button class="btn small" id="cDrop">Drop to plate</button>
        ${o.type === 'group' ? '<button class="btn small" id="cUngroup">Ungroup</button>' : ''}
        ${DOT_SOURCES[o.type] ? '<button class="btn small" id="cDots" title="Turn this shape into an outline of dots you can drag">Edit as dots</button>' : ''}
        <button class="btn small" id="cDel">Delete</button>
      </div>
    </div>`;
  $('kSolid').onclick = () => { if (o.hole) toggleHole(); };
  $('kHole').onclick = () => { if (!o.hole) toggleHole(); };
  card.querySelectorAll('.swatch').forEach((b) => { b.onclick = () => { o.color = b.dataset.c; syncScene(); commit(); renderCard(); }; });
  if (isMaker(o)) bindMaker(o);
  else $('fLock').onchange = (e) => { lockRatio = e.target.checked; };
  const sizeField = (id, axis) => {
    $(id).onchange = (e) => {
      const v = parseFloat(e.target.value);
      if (!(v > 0)) { renderCard(); return; }
      const bottom = worldBox(o).min.y;
      if (lockRatio) { const k = v / o.size[axis]; o.size = o.size.map((s) => round(s * k, 0.001)); } else o.size[axis] = v;
      applyToMesh(o, meshes.get(o.id));
      o.pos[1] = round(o.pos[1] + bottom - worldBox(o).min.y, 0.001); // keep it standing where it was
      applyToMesh(o, meshes.get(o.id));
      commit(); updateCardValues();
    };
  };
  if (!isMaker(o)) { sizeField('fW', 0); sizeField('fD', 2); sizeField('fH', 1); }
  $('fX').onchange = (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) { o.pos[0] = v; applyToMesh(o, meshes.get(o.id)); commit(); } };
  $('fY').onchange = (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) { o.pos[2] = -v; applyToMesh(o, meshes.get(o.id)); commit(); } };
  $('fZ').onchange = (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) { o.pos[1] = round(o.pos[1] + v - worldBox(o).min.y, 0.001); applyToMesh(o, meshes.get(o.id)); commit(); } };
  if (o.type === 'text') {
    $('fText').oninput = (e) => {
      const t = e.target.value; if (!t.trim()) return;
      const old = unitGeom(o).userData.natural;
      const k = o.size[2] / old[2];
      o.text = t;
      const nat = unitGeom(o).userData.natural;
      o.size = [round(nat[0] * k, 0.001), o.size[1], round(nat[2] * k, 0.001)];
      syncScene(); updateCardValues();
    };
    $('fText').onchange = () => commit();
  }
  $('rZ').onclick = () => rotateSel([0, 1, 0]);
  $('rX').onclick = () => rotateSel([1, 0, 0]);
  $('rY').onclick = () => rotateSel([0, 0, 1]);
  $('cDup').onclick = duplicateSel; $('cDrop').onclick = dropSel; $('cDel').onclick = deleteSel;
  if (o.type === 'group') $('cUngroup').onclick = ungroupSel;
  if (DOT_SOURCES[o.type]) $('cDots').onclick = () => convertToDots(o);
  updateCardValues();
}
function updateCardValues() {
  if (!tcStart) placePivot();
  const objs = selObjs(); if (objs.length !== 1) return;
  const o = objs[0];
  const set = (id, v) => { const el = $(id); if (el && document.activeElement !== el) el.value = fmt(v); };
  set('fW', o.size[0]); set('fD', o.size[2]); set('fH', o.size[1]);
  set('fX', o.pos[0]); set('fY', -o.pos[2]); set('fZ', Math.abs(worldBox(o).min.y) < 0.03 ? 0 : worldBox(o).min.y);
}
function updateButtons() {
  $('btnUndo').disabled = history.index <= 0;
  $('btnRedo').disabled = history.index >= history.stack.length - 1;
}

// ---------- shape bin ----------
function thumbnails() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(2); r.setSize(48, 48);
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2));
  const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(2, 4, 3); s.add(d);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); cam.position.set(1.9, 1.7, 2.6); cam.lookAt(0, 0, 0);
  const out = {};
  const shot = (key, geom, size, hole, colors) => {
    const k = 1 / Math.max(...size);
    const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: colors ? 0xffffff : hole ? 0x9aa4ae : 0xe8551c, vertexColors: !!colors, roughness: 0.5, transparent: !!hole, opacity: hole ? 0.6 : 1 }));
    mesh.scale.set(size[0] * k * 1.25, size[1] * k * 1.25, size[2] * k * 1.25);
    s.add(mesh); r.render(s, cam); out[key] = r.domElement.toDataURL(); s.remove(mesh);
  };
  for (const t of SOLID_BIN) {
    if (t === 'text') { const g = makeUnit(textGeometry('Aa')); shot(t, g, [g.userData.natural[0], g.userData.natural[1] * 3, g.userData.natural[2]]); }
    else shot(t, unitGeom({ type: t }), SHAPES[t].size);
  }
  HOLE_BIN.forEach((h, i) => shot('hole' + i, unitGeom({ type: h.type }), h.size, true));
  for (const m of PIC_BIN) { const g = makeUnit(m.thumb()); shot('pc' + m.key, g, g.userData.natural, false, !!g.getAttribute('color')); }
  for (const m of DRAW_BIN) { const g = unitGeom(m.spec()); shot('dr' + m.key, g, g.userData.natural); }
  for (const m of MAKER_BIN) { const sp = m.spec(); const g = unitGeom(sp); shot('mk' + m.key, g, g.userData.natural); }
  for (const m of [...HW_BIN, ...JOINT_BIN]) { const g = unitGeom(m.spec()); shot('hw' + m.key, g, g.userData.natural); }
  r.dispose();
  return out;
}
function buildBin() {
  const thumbs = thumbnails();
  const mk = (spec, label, img) => {
    const b = document.createElement('button');
    b.className = 'shape'; b.draggable = true; b.title = 'Add ' + label.toLowerCase();
    b.innerHTML = `<img alt="" src="${img}"><span>${label}</span>`;
    b.onclick = () => addShape(spec);
    b.ondragstart = (e) => { e.dataTransfer.setData('text/plain', JSON.stringify(spec)); e.dataTransfer.effectAllowed = 'copy'; };
    return b;
  };
  PIC_BIN.forEach((m) => { const b = document.createElement('button'); b.className = 'shape'; b.title = m.label; b.innerHTML = `<img alt="" src="${thumbs['pc' + m.key]}"><span>${m.label}</span>`; b.onclick = () => picOpen(m.key); $('picShapes').append(b); });
  DRAW_BIN.forEach((m) => { const b = mk(m.spec(), m.label, thumbs['dr' + m.key]); b.onclick = () => addShape(m.spec()); b.ondragstart = (e) => { e.dataTransfer.setData('text/plain', JSON.stringify(m.spec())); }; $('drawShapes').append(b); });
  MAKER_BIN.forEach((m) => { const b = mk(m.spec(), m.label, thumbs['mk' + m.key]); b.onclick = () => addShape(m.spec()); b.ondragstart = (e) => { e.dataTransfer.setData('text/plain', JSON.stringify(m.spec())); }; $('makerShapes').append(b); });
  JOINT_BIN.forEach((m) => { const b = mk(m.spec(), m.label, thumbs['hw' + m.key]); b.onclick = () => addShape(m.spec()); b.ondragstart = (e) => { e.dataTransfer.setData('text/plain', JSON.stringify(m.spec())); }; $('jointShapes').append(b); });
  HW_BIN.forEach((m) => { const b = mk(m.spec(), m.label, thumbs['hw' + m.key]); b.onclick = () => addShape(m.spec()); b.ondragstart = (e) => { e.dataTransfer.setData('text/plain', JSON.stringify(m.spec())); }; $('hwShapes').append(b); });
  SOLID_BIN.forEach((t) => $('solidShapes').append(mk({ type: t }, SHAPES[t].label, thumbs[t])));
  HOLE_BIN.forEach((h, i) => $('holeShapes').append(mk({ type: h.type, hole: true, size: h.size }, h.label, thumbs['hole' + i])));
}
stage.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; $('dropHint').hidden = false; });
stage.addEventListener('dragleave', (e) => { if (!stage.contains(e.relatedTarget)) $('dropHint').hidden = true; });
stage.addEventListener('drop', (e) => {
  e.preventDefault(); $('dropHint').hidden = true;
  let spec; try { spec = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
  if (!spec || !spec.type) return;
  addShape(spec, floorPoint(e) || undefined);
});

// ---------- dimension labels ----------
const dimEls = [$('dimW'), $('dimD'), $('dimH')];
function placeDims() {
  const objs = selObjs();
  if (objs.length !== 1) { dimEls.forEach((d) => { d.hidden = true; }); return; }
  const o = objs[0], m = meshes.get(o.id);
  const r = renderer.domElement.getBoundingClientRect();
  const pts = [[0, -0.5, 0.5], [0.5, -0.5, 0], [0.5, 0, 0.5]];
  const vals = [o.size[0], o.size[2], o.size[1]];
  pts.forEach((p, i) => {
    const v = new THREE.Vector3(...p).applyMatrix4(m.matrixWorld).project(camera);
    const el = dimEls[i];
    if (v.z > 1) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = fmt(vals[i]) + ' mm';
    el.style.left = ((v.x + 1) / 2) * r.width + 'px';
    el.style.top = ((1 - v.y) / 2) * r.height + 'px';
  });
}

// ---------- toolbar & keys ----------
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4200);
}
function setMode(m) {
  mode = m;
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  attachGizmo();
}
document.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
document.querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => setView(b.dataset.view); });
$('btnUndo').onclick = undo; $('btnRedo').onclick = redo;
$('btnNew').onclick = newDesign;
$('btnExport').onclick = exportSTL;
$('btnSave').onclick = saveProject;
$('btnOpen').onclick = () => $('fileOpen').click();
$('fileOpen').onchange = (e) => { const f = e.target.files[0]; if (f) f.text().then(loadProject); e.target.value = ''; };
$('btnHelp').onclick = () => { $('helpOverlay').hidden = false; $('helpClose').focus(); };
$('helpClose').onclick = () => { $('helpOverlay').hidden = true; };
$('helpOverlay').onclick = (e) => { if (e.target === $('helpOverlay')) $('helpOverlay').hidden = true; };
$('snapSel').onchange = (e) => { setSnap(parseFloat(e.target.value)); renderCard(); };
$('projectName').onchange = (e) => { doc.name = e.target.value.trim() || 'My design'; persist(); };

window.addEventListener('keydown', (e) => {
  if (ed.open) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicateSel(); return; }
  if (mod && k === 'g') { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); return; }
  if (mod && k === 'a') { e.preventDefault(); selectAll(); return; }
  if (mod) return;
  const step = (snap || 1) * (e.shiftKey ? 10 : 1);
  switch (e.key) {
    case 'Delete': case 'Backspace': e.preventDefault(); deleteSel(); break;
    case 'ArrowLeft': e.preventDefault(); nudge(-step, 0, 0); break;
    case 'ArrowRight': e.preventDefault(); nudge(step, 0, 0); break;
    case 'ArrowUp': e.preventDefault(); nudge(0, 0, -step); break;
    case 'ArrowDown': e.preventDefault(); nudge(0, 0, step); break;
    case 'PageUp': e.preventDefault(); nudge(0, step, 0); break;
    case 'PageDown': e.preventDefault(); nudge(0, -step, 0); break;
    case 'Escape': if (!$('helpOverlay').hidden || !$('checkOverlay').hidden || !$('picOverlay').hidden || !$('askOverlay').hidden) { $('helpOverlay').hidden = true; $('checkOverlay').hidden = true; $('askOverlay').hidden = true; picClose(); } else select([]); break;
    default:
      if (k === 'm') setMode('translate');
      else if (k === 'r') setMode('rotate');
      else if (k === 's') setMode('scale');
      else if (k === 'h') toggleHole();
      else if (k === 'd') dropSel();
      else if (k === 'f') setView('fit');
      else if (k === '?') $('btnHelp').click();
  }
});

// @@EDITOR@@
// @@PICTURE@@
// @@PROMPT@@
// ---------- example & boot ----------
function exampleDesign() {
  const tag = { id: newId(), type: 'rbox', hole: false, color: '#2f6fdb', pos: [0, 2, 0], rot: [0, 0, 0], size: [56, 4, 20] };
  const ring = { id: newId(), type: 'cylinder', hole: true, color: COLORS[0], pos: [-21, 2, 0], rot: [0, 0, 0], size: [6, 10, 6] };
  const text = { id: newId(), type: 'text', hole: false, color: '#f4f1ea', text: 'HELLO', rot: [0, 0, 0] };
  const nat = unitGeom(text).userData.natural, k = 40 / nat[0];
  text.size = [40, 2, round(nat[2] * k, 0.01)];
  text.pos = [5, 4.5, 0];
  return [tag, ring, text];
}
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

function boot() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { saved = null; }
  if (saved && Array.isArray(saved.objects) && (saved.objects.length || !saved.example)) {
    doc.objects = saved.objects; doc.name = saved.name || 'My design'; isExample = !!saved.example;
  } else {
    doc.objects = exampleDesign(); doc.name = 'Example keychain'; isExample = true;
  }
  $('projectName').value = doc.name;
  setSnap(1);
  buildBin();
  resize();
  syncScene(); renderCard(); commit();
  if (isExample) setTimeout(() => setView('fit'), 0);
}
boot();

renderer.setAnimationLoop(() => {
  orbit.update();
  renderer.render(scene, camera);
  placeDims();
});
window.__sw = { MAKERS, MAKER_DEFAULTS, innerLayout, storageDims, wasm, planPrompt, buildPrompt, doc: () => doc, select, syncLid, ed, edOpen, edClose, convertToDots, addShape, groupSel, ungroupSel, exportTris: printerTriangles, binarySTL, zipOne };
