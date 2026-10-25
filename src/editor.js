// ---------- dot editor ----------
// A flat, top-down drawing board for custom shapes. Works on a draft copy; Done applies it.
const ed = { open: false, o: null, draft: null, c: 0, sel: null, view: { cx: 0, cy: 0, s: 6 }, hist: [], drag: null, img: null, prevTimer: 0, raf: 0 };
const traceImages = new Map(); // per shape, for this visit only
const peSvg = $('peSvg');
const edKey = () => (ed.draft.mode === 'spin' ? 'prof' : 'pts');
// An outline can have extra parts (ed.draft.more): islands and holes, e.g. from a traced logo.
const contours = () => (ed.draft.mode === 'spin' ? [ed.draft.prof] : [ed.draft.pts, ...(ed.draft.more || [])]);
const edPts = () => contours()[ed.c] || contours()[0];
const spin = () => ed.draft.mode === 'spin';

function edSize() {
  const poly = contours().flatMap((c) => samplePath(c));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (spin()) x0 = Math.min(0, x0);
  return { x0, x1, y0, y1 };
}
function edFit() {
  const b = edSize();
  const W = peSvg.clientWidth || 600, H = peSvg.clientHeight || 400;
  const span = Math.max(b.x1 - b.x0, b.y1 - b.y0, 10);
  ed.view.s = clamp(Math.min(W, H) / (span * 1.5), 0.5, 80);
  ed.view.cx = spin() ? b.x1 / 2 : (b.x0 + b.x1) / 2;
  ed.view.cy = (b.y0 + b.y1) / 2;
}
function toScr(x, y) { const W = peSvg.clientWidth, H = peSvg.clientHeight; return [W / 2 + (x - ed.view.cx) * ed.view.s, H / 2 - (y - ed.view.cy) * ed.view.s]; }
function toWorld(e) {
  const r = peSvg.getBoundingClientRect();
  return [ed.view.cx + (e.clientX - r.left - r.width / 2) / ed.view.s, ed.view.cy - (e.clientY - r.top - r.height / 2) / ed.view.s];
}
function crosses(poly) {
  const n = poly.length;
  const hit = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (hit(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true;
  }
  return false;
}
function edRender() {
  const W = peSvg.clientWidth, H = peSvg.clientHeight, s = ed.view.s;
  const pts = edPts();
  const steps = [0.5, 1, 2, 5, 10, 20, 50, 100];
  const minor = steps.find((v) => v * s >= 9) || 100;
  const major = { 0.5: 5, 1: 10, 2: 10, 5: 10, 10: 50, 20: 100, 50: 100, 100: 500 }[minor];
  const [wx0, wy1] = [ed.view.cx - W / 2 / s, ed.view.cy + H / 2 / s], [wx1, wy0] = [ed.view.cx + W / 2 / s, ed.view.cy - H / 2 / s];
  let g = '';
  for (let x = Math.ceil(wx0 / minor) * minor; x <= wx1; x += minor) { const [sx] = toScr(x, 0); g += `<line x1="${sx}" y1="0" x2="${sx}" y2="${H}" class="${Math.abs(x / major - Math.round(x / major)) < 1e-6 ? 'gM' : 'gm'}"/>`; }
  for (let y = Math.ceil(wy0 / minor) * minor; y <= wy1; y += minor) { const [, sy] = toScr(0, y); g += `<line x1="0" y1="${sy}" x2="${W}" y2="${sy}" class="${Math.abs(y / major - Math.round(y / major)) < 1e-6 ? 'gM' : 'gm'}"/>`; }
  const [ox, oy] = toScr(0, 0);
  g += `<line x1="${ox}" y1="0" x2="${ox}" y2="${H}" class="ax"/><line x1="0" y1="${oy}" x2="${W}" y2="${oy}" class="ax"/>`;
  if (spin()) g += `<rect x="0" y="0" width="${Math.max(0, ox)}" height="${H}" class="off"/><text x="${ox + 6}" y="16" class="axl">Spins around this line</text>`;
  if (ed.img) {
    const [ix, iy] = toScr(-ed.img.w / 2, ed.img.w * ed.img.ratio / 2);
    g += `<image href="${ed.img.url}" x="${ix}" y="${iy}" width="${ed.img.w * s}" height="${ed.img.w * ed.img.ratio * s}" opacity="${ed.img.op}" preserveAspectRatio="none"/>`;
  }
  const polys = contours().map((c) => samplePath(c).map(([x, y]) => (spin() ? [Math.max(0, x), y] : [x, y])));
  const pathOf = (poly, mx = 1) => poly.map(([x, y], i) => (i ? 'L' : 'M') + toScr(mx * x, y).map((v) => v.toFixed(1)).join(' ')).join(' ') + 'Z';
  g += `<path d="${polys.map((q) => pathOf(q)).join(' ')}" class="fill" fill-rule="${polys.length > 1 ? 'evenodd' : 'nonzero'}"/>`;
  if (spin()) g += `<path d="${pathOf(polys[0], -1)}" class="ghost"/>`; // mirror image, faint, so the whole silhouette shows
  const many = contours().reduce((n, c) => n + c.length, 0) > 150;
  contours().forEach((cpts, c) => {
    const sp = cpts.map(([x, y]) => toScr(x, y));
    g += `<polygon points="${sp.map((q) => q.join(',')).join(' ')}" class="ctrl"/>`;
    sp.forEach((q, i) => {
      const r = sp[(i + 1) % sp.length];
      if (Math.hypot(r[0] - q[0], r[1] - q[1]) < 34) return; // no room for a + on short edges
      const mx = (q[0] + r[0]) / 2, my = (q[1] + r[1]) / 2;
      g += `<g class="add" data-add="${c}:${i}"><circle cx="${mx}" cy="${my}" r="8"/><path d="M${mx - 3.5} ${my}h7M${mx} ${my - 3.5}v7"/></g>`;
    });
    sp.forEach(([x, y], i) => {
      const cls = 'dot' + (c === ed.c && i === ed.sel ? ' sel' : '') + (many ? ' small' : '');
      const r = many ? 4.5 : 7.5;
      g += cpts[i][2] ? `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}" data-dot="${c}:${i}"/>` : `<rect x="${x - r + 1}" y="${y - r + 1}" width="${2 * r - 2}" height="${2 * r - 2}" rx="2" class="${cls}" data-dot="${c}:${i}"/>`;
    });
  });
  if (ed.sel !== null && ed.drag && ed.drag.type === 'dot' && pts[ed.sel]) {
    const p = pts[ed.sel], [x, y] = toScr(p[0], p[1]);
    g += `<text x="${x + 12}" y="${y - 12}" class="coord">${fmt(p[0])}, ${fmt(p[1])}</text>`;
  }
  const poly = polys[ed.c] || polys[0];
  peSvg.innerHTML = g;
  $('peWarn').hidden = !crosses(poly);
  const b = edSize();
  $('peW').value = fmt(spin() ? 2 * b.x1 : b.x1 - b.x0);
  $('peD').value = fmt(b.y1 - b.y0);
  $('peDLabel').firstChild.textContent = spin() ? 'Height ' : 'Depth ';
  $('peWLabel').firstChild.textContent = spin() ? 'Width ' : 'Width ';
  // selected dot panel
  const has = ed.sel !== null && pts[ed.sel];
  $('pePoint').hidden = !has; $('peHint').hidden = !!has;
  if (has) {
    const p = pts[ed.sel];
    if (document.activeElement !== $('peX')) $('peX').value = fmt(p[0]);
    if (document.activeElement !== $('peY')) $('peY').value = fmt(p[1]);
    $('peXLabel').firstChild.textContent = spin() ? 'Out from centre ' : 'X ';
    $('peYLabel').firstChild.textContent = spin() ? 'Up ' : 'Y ';
    $('peSmooth').checked = !!p[2];
    $('peDel').disabled = pts.length <= 3 && ed.c === 0;
    $('peDel').textContent = pts.length <= 3 && ed.c > 0 ? 'Delete this part' : 'Delete dot';
  }
  document.querySelectorAll('[data-pemode]').forEach((bt) => bt.setAttribute('aria-pressed', String(bt.dataset.pemode === ed.draft.mode)));
  $('peExtrudeOpts').hidden = spin();
  $('peTemplate').innerHTML = '<option value="">Start from…</option>' + Object.keys(OUTLINE_TEMPLATES[ed.draft.mode]).map((n) => `<option>${n}</option>`).join('');
  edPreviewSoon();
}
function edPush() { ed.hist.push(JSON.stringify(ed.draft)); if (ed.hist.length > 100) ed.hist.shift(); }
function edUndo() { if (!ed.hist.length) return; ed.draft = JSON.parse(ed.hist.pop()); ed.c = 0; ed.sel = null; edRender(); }
function snapPt([x, y]) { return [snapV(x), snapV(y)]; }
function insertAt(i, x, y) {
  const pts = edPts(), a = pts[i], b = pts[(i + 1) % pts.length];
  edPush();
  pts.splice(i + 1, 0, [x, y, a[2] && b[2] ? 1 : 0]);
  ed.sel = i + 1;
}

// The board is redrawn on every press, so double-clicks are detected here rather than with 'dblclick'.
let lastTap = { t: 0, key: '' };
function isDouble(key) { const now = performance.now(), d = now - lastTap.t < 350 && lastTap.key === key; lastTap = { t: d ? 0 : now, key }; return d; }
peSvg.addEventListener('pointerdown', (e) => {
  const t = e.target.closest('[data-dot],[data-add]');
  const w = toWorld(e);
  peSvg.setPointerCapture(e.pointerId);
  const ref = (v) => v.split(':').map(Number);
  if (t && t.dataset.dot !== undefined && isDouble('d' + t.dataset.dot)) {
    const [c, i] = ref(t.dataset.dot);
    edPush(); ed.c = c; ed.sel = i; const p = edPts()[i]; p[2] = p[2] ? 0 : 1; ed.drag = null; edRender(); return;
  }
  if (!t && isDouble('empty') && addNearLine(e)) { ed.drag = null; edRender(); return; }
  if (t && t.dataset.dot !== undefined) {
    [ed.c, ed.sel] = ref(t.dataset.dot);
    ed.drag = { type: 'dot', pushed: false, x: e.clientX, y: e.clientY };
  } else if (t && t.dataset.add !== undefined) {
    const [c, i] = ref(t.dataset.add); ed.c = c;
    const pts = edPts(), a = pts[i], b = pts[(i + 1) % pts.length];
    insertAt(i, round((a[0] + b[0]) / 2, 0.01), round((a[1] + b[1]) / 2, 0.01));
    ed.drag = { type: 'dot', pushed: true, x: e.clientX, y: e.clientY };
  } else {
    ed.drag = { type: 'pan', x: e.clientX, y: e.clientY, cx: ed.view.cx, cy: ed.view.cy, w, moved: false };
  }
  edRender();
});
peSvg.addEventListener('pointermove', (e) => {
  if (!ed.drag) return;
  if (ed.drag.type === 'pan') {
    if (Math.hypot(e.clientX - ed.drag.x, e.clientY - ed.drag.y) > 3) ed.drag.moved = true;
    ed.view.cx = ed.drag.cx - (e.clientX - ed.drag.x) / ed.view.s;
    ed.view.cy = ed.drag.cy + (e.clientY - ed.drag.y) / ed.view.s;
    edRender(); return;
  }
  if (Math.hypot(e.clientX - ed.drag.x, e.clientY - ed.drag.y) < 2) return;
  if (!ed.drag.pushed) { edPush(); ed.drag.pushed = true; }
  let [x, y] = snapPt(toWorld(e));
  if (spin()) x = Math.max(0, x);
  const p = edPts()[ed.sel];
  p[0] = x; p[1] = y;
  edRender();
});
peSvg.addEventListener('pointerup', () => {
  if (ed.drag && ed.drag.type === 'pan' && !ed.drag.moved) { ed.sel = null; }
  ed.drag = null; edRender();
});
function addNearLine(e) {
  // Double-click near a line adds a dot right there.
  const [wx, wy] = toWorld(e);
  let best = null;
  contours().forEach((pts, c) => pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1];
    const t2 = clamp(((wx - a[0]) * dx + (wy - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const px = a[0] + t2 * dx, py = a[1] + t2 * dy, dist = Math.hypot(px - wx, py - wy) * ed.view.s;
    if (dist < 24 && (!best || dist < best.dist)) best = { c, i, dist, px, py };
  }));
  if (!best) return false;
  ed.c = best.c;
  const [x, y] = snapPt([best.px, best.py]); insertAt(best.i, x, y);
  return true;
}
peSvg.addEventListener('contextmenu', (e) => {
  const t = e.target.closest('[data-dot]');
  if (!t) return;
  e.preventDefault(); [ed.c, ed.sel] = t.dataset.dot.split(':').map(Number); edDelete();
});
peSvg.addEventListener('wheel', (e) => {
  e.preventDefault();
  const before = toWorld(e);
  ed.view.s = clamp(ed.view.s * Math.exp(-e.deltaY * 0.0015), 0.5, 120);
  const after = toWorld(e);
  ed.view.cx += before[0] - after[0]; ed.view.cy += before[1] - after[1];
  edRender();
}, { passive: false });
function edDelete() {
  const pts = edPts();
  if (ed.sel === null) return;
  if (pts.length <= 3 && ed.c > 0) { edPush(); ed.draft.more.splice(ed.c - 1, 1); ed.c = 0; ed.sel = null; toast('Removed that part.'); edRender(); return; }
  if (pts.length <= 3) { toast('A shape needs at least 3 dots.'); return; }
  edPush(); pts.splice(ed.sel, 1); ed.sel = null; edRender();
}
function edKeys(e) {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'select';
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!typing) edUndo(); return; }
  if (typing) return;
  const step = (snap || 1) * (e.shiftKey ? 10 : 1);
  const nudgeDot = (dx, dy) => { if (ed.sel === null) return; edPush(); const p = edPts()[ed.sel]; p[0] = round(p[0] + dx, 0.001); p[1] = round(p[1] + dy, 0.001); if (spin()) p[0] = Math.max(0, p[0]); edRender(); };
  switch (e.key) {
    case 'Delete': case 'Backspace': e.preventDefault(); edDelete(); break;
    case 'Escape': e.preventDefault(); edClose(true); break;
    case 'Enter': e.preventDefault(); edClose(true); break;
    case 'ArrowLeft': e.preventDefault(); nudgeDot(-step, 0); break;
    case 'ArrowRight': e.preventDefault(); nudgeDot(step, 0); break;
    case 'ArrowUp': e.preventDefault(); nudgeDot(0, step); break;
    case 'ArrowDown': e.preventDefault(); nudgeDot(0, -step); break;
    default: if (e.key.toLowerCase() === 'r' && ed.sel !== null) { edPush(); const p = edPts()[ed.sel]; p[2] = p[2] ? 0 : 1; edRender(); }
  }
}

// live 3D preview in the corner
let prev = null;
function edPreviewSoon() { clearTimeout(ed.prevTimer); ed.prevTimer = setTimeout(edPreview, ed.drag ? 60 : 10); }
function edPreview() {
  if (!ed.open) return;
  if (!prev) {
    const r = new THREE.WebGLRenderer({ canvas: $('pePrev'), antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0xffffff, 0x8a96a4, 1.8));
    const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(2, 4, 3); s.add(dl);
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.55 }));
    s.add(mesh);
    prev = { r, s, cam, mesh, t: 0 };
  }
  try {
    const g = outlineGeom(ed.draft);
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(new THREE.Vector3()), sz = g.boundingBox.getSize(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);
    prev.mesh.geometry.dispose(); prev.mesh.geometry = g;
    prev.mesh.material.color.set(ed.o.hole ? css('--hole') : ed.o.color);
    prev.dist = sz.length() * 1.25 + 5;
    $('peErr').hidden = true;
  } catch (err) {
    $('peErr').hidden = false;
  }
}
function edLoop() {
  if (!ed.open) return;
  ed.raf = requestAnimationFrame(edLoop);
  if (!prev || !prev.dist) return;
  const cv = $('pePrev'), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * prev.r.getPixelRatio())) { prev.r.setSize(w, h, false); prev.cam.aspect = w / h; prev.cam.updateProjectionMatrix(); }
  prev.t += 0.01;
  prev.cam.position.set(Math.sin(prev.t) * prev.dist, prev.dist * 0.55, Math.cos(prev.t) * prev.dist);
  prev.cam.lookAt(0, 0, 0);
  prev.r.render(prev.s, prev.cam);
}

function edOpen(o) {
  ed.open = true; ed.o = o; ed.draft = structuredClone(o.p); ed.c = 0; ed.sel = null; ed.hist = []; ed.drag = null;
  ed.img = traceImages.get(o.id) || null;
  $('pathEditor').hidden = false;
  $('peHeight').value = fmt(ed.draft.height); $('peTwist').value = fmt(ed.draft.twist || 0); $('peTop').value = fmt(ed.draft.topScale ?? 100);
  $('peImgRow').hidden = !ed.img;
  if (ed.img) { $('peImgW').value = fmt(ed.img.w); $('peImgOp').value = ed.img.op; }
  tc.detach();
  requestAnimationFrame(() => { edFit(); edRender(); edLoop(); });
  window.addEventListener('keydown', edKeys, true);
}
function edClose(apply) {
  if (!ed.open) return;
  if (apply) {
    try { outlineGeom(ed.draft); } catch (err) { $('peErr').hidden = false; toast('This outline has no area yet. Spread the dots out so they enclose some space.'); return; }
  }
  ed.open = false;
  cancelAnimationFrame(ed.raf);
  window.removeEventListener('keydown', edKeys, true);
  $('pathEditor').hidden = true;
  if (ed.img) traceImages.set(ed.o.id, ed.img);
  const o = ed.o;
  if (apply && JSON.stringify(o.p) !== JSON.stringify(ed.draft)) { o.p = ed.draft; updateMaker(o); }
  else attachGizmo();
}
document.querySelectorAll('[data-pemode]').forEach((b) => { b.onclick = () => { if (ed.draft.mode === b.dataset.pemode) return; edPush(); ed.draft.mode = b.dataset.pemode; ed.c = 0; ed.sel = null; edFit(); edRender(); }; });
$('peTemplate').onchange = (e) => {
  const n = e.target.value; if (!n) return;
  edPush(); ed.draft[edKey()] = structuredClone(OUTLINE_TEMPLATES[ed.draft.mode][n]); if (!spin()) ed.draft.more = []; ed.c = 0; ed.sel = null; edFit(); edRender();
};
$('peX').onchange = (e) => { const v = parseFloat(e.target.value); if (!isFinite(v) || ed.sel === null) return; edPush(); edPts()[ed.sel][0] = spin() ? Math.max(0, v) : v; edRender(); };
$('peY').onchange = (e) => { const v = parseFloat(e.target.value); if (!isFinite(v) || ed.sel === null) return; edPush(); edPts()[ed.sel][1] = v; edRender(); };
$('peSmooth').onchange = (e) => { if (ed.sel === null) return; edPush(); edPts()[ed.sel][2] = e.target.checked ? 1 : 0; edRender(); };
$('peDel').onclick = edDelete;
const scaleAxis = (axis, target) => {
  const b = edSize();
  const cur = axis === 0 ? (spin() ? 2 * b.x1 : b.x1 - b.x0) : b.y1 - b.y0;
  if (!(target > 0) || !(cur > 0)) return;
  const k = target / cur, mid = axis === 0 ? (spin() ? 0 : (b.x0 + b.x1) / 2) : (spin() ? b.y0 : (b.y0 + b.y1) / 2);
  edPush();
  for (const c of contours()) for (const p of c) p[axis] = round(mid + (p[axis] - mid) * k, 0.01);
  edFit(); edRender();
};
$('peW').onchange = (e) => scaleAxis(0, parseFloat(e.target.value));
$('peD').onchange = (e) => scaleAxis(1, parseFloat(e.target.value));
$('peHeight').onchange = (e) => { const v = parseFloat(e.target.value); if (v > 0) { edPush(); ed.draft.height = clamp(v, 0.2, 500); edPreview(); } };
$('peTwist').onchange = (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) { edPush(); ed.draft.twist = clamp(v, -720, 720); edPreview(); } };
$('peTop').onchange = (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) { edPush(); ed.draft.topScale = clamp(v, 0, 400); edPreview(); } };
$('peZoomIn').onclick = () => { ed.view.s = clamp(ed.view.s * 1.4, 0.5, 120); edRender(); };
$('peZoomOut').onclick = () => { ed.view.s = clamp(ed.view.s / 1.4, 0.5, 120); edRender(); };
$('peFit').onclick = () => { edFit(); edRender(); };
$('peUndo').onclick = edUndo;
$('peDone').onclick = () => edClose(true);
$('peCancel').onclick = () => edClose(false);
$('peImgBtn').onclick = () => $('peImgFile').click();
$('peImgFile').onchange = (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const im = new Image();
    im.onload = () => {
      const b = edSize();
      ed.img = { url: rd.result, ratio: im.naturalHeight / im.naturalWidth, w: Math.round(Math.max(40, b.x1 - b.x0) * 1.2), op: 0.45 };
      $('peImgRow').hidden = false; $('peImgW').value = fmt(ed.img.w); $('peImgOp').value = ed.img.op;
      edFit(); edRender();
      toast('Picture added behind the grid. Move the dots along its edges, then press Done.');
    };
    im.src = rd.result;
  };
  rd.readAsDataURL(f);
};
$('peImgW').onchange = (e) => { const v = parseFloat(e.target.value); if (ed.img && v > 0) { ed.img.w = v; edRender(); } };
$('peImgOp').oninput = (e) => { if (ed.img) { ed.img.op = parseFloat(e.target.value); edRender(); } };
$('peImgDel').onclick = () => { ed.img = null; traceImages.delete(ed.o.id); $('peImgRow').hidden = true; edRender(); };
new ResizeObserver(() => { if (ed.open) edRender(); }).observe(peSvg);

function convertToDots(o) {
  const src = DOT_SOURCES[o.type];
  if (!src) return;
  o.p = { ...structuredClone(MAKER_DEFAULTS.outline), mode: 'extrude', pts: fitPts(src(), o.size[0], o.size[2]), height: round(o.size[1], 0.01) };
  o.type = 'outline';
  refreshMakerSize(o); syncScene(); commit(); renderCard();
  edOpen(o);
}
