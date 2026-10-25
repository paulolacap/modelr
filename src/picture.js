// ---------- pictures: trace an outline, lithophane, relief, colour layers ----------
// Everything here runs on the pixels in the browser. A picture is reduced to a grid of
// brightness values (0 = black, 255 = white), stored with the shape so it can be rebuilt.

const grayCache = new Map();
function encodeGray(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function decodeGray(b64) {
  let g = grayCache.get(b64);
  if (!g) { const s = atob(b64); g = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) g[i] = s.charCodeAt(i); grayCache.set(b64, g); }
  return g;
}
function grayFromImage(img, maxSide) {
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(2, Math.round(img.naturalWidth * k)), h = Math.max(2, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); // see-through parts count as white background
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = Math.round(0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]);
  return { g, w, h };
}

// --- tracing: marching squares around the dark (or light) areas, then fewer dots
function traceContours(gray, w, h, thr, invert) {
  const W = w + 2, H = h + 2, v = new Float32Array(W * H); // padded with background
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const b = gray[y * w + x]; v[(y + 1) * W + x + 1] = invert ? b - thr : thr - b; }
  const pad = (x, y) => (x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1 ? -1 : v[y * W + x]);
  const ins = (x, y) => pad(x, y) > 0;
  const pts = new Map(), adj = new Map();
  const edgePt = (key, ax, ay, bx, by) => {
    if (!pts.has(key)) { const va = pad(ax, ay), vb = pad(bx, by), t = clamp(va / (va - vb || 1e-9), 0, 1); pts.set(key, [ax + (bx - ax) * t, ay + (by - ay) * t]); }
    return key;
  };
  const link = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); };
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const idx = (ins(x, y) ? 8 : 0) | (ins(x + 1, y) ? 4 : 0) | (ins(x + 1, y + 1) ? 2 : 0) | (ins(x, y + 1) ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const T = () => edgePt(`${2 * x + 1},${2 * y}`, x, y, x + 1, y), R = () => edgePt(`${2 * x + 2},${2 * y + 1}`, x + 1, y, x + 1, y + 1);
    const B = () => edgePt(`${2 * x + 1},${2 * y + 2}`, x, y + 1, x + 1, y + 1), L = () => edgePt(`${2 * x},${2 * y + 1}`, x, y, x, y + 1);
    const segs = { 1: [[L, B]], 2: [[B, R]], 3: [[L, R]], 4: [[T, R]], 5: [[T, R], [L, B]], 6: [[T, B]], 7: [[L, T]], 8: [[L, T]], 9: [[T, B]], 10: [[L, T], [B, R]], 11: [[T, R]], 12: [[L, R]], 13: [[B, R]], 14: [[L, B]] }[idx];
    for (const [a, b] of segs) link(a(), b());
  }
  const seen = new Set(), loops = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let prev = null, cur = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur); loop.push(pts.get(cur));
      const nx = adj.get(cur).find((n) => n !== prev && !seen.has(n));
      prev = cur; cur = nx;
    }
    if (loop.length >= 3) loops.push(loop.map(([x, y]) => [x - 1, y - 1]));
  }
  return loops;
}
function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return Math.abs(a) / 2; }
function simplify(pts, tol) {
  // Douglas-Peucker on a closed loop, split at the two points farthest apart.
  if (pts.length < 8) return pts;
  let far = 0, fd = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
  const dp = (a) => {
    if (a.length < 3) return a;
    const [x0, y0] = a[0], [x1, y1] = a[a.length - 1], L = Math.hypot(x1 - x0, y1 - y0) || 1e-9;
    let idx = 0, md = 0;
    for (let i = 1; i < a.length - 1; i++) { const d = Math.abs((x1 - x0) * (y0 - a[i][1]) - (x0 - a[i][0]) * (y1 - y0)) / L; if (d > md) { md = d; idx = i; } }
    if (md <= tol) return [a[0], a[a.length - 1]];
    return [...dp(a.slice(0, idx + 1)).slice(0, -1), ...dp(a.slice(idx))];
  };
  const a = dp(pts.slice(0, far + 1)), b = dp([...pts.slice(far), pts[0]]);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
function traceToOutline(src, s) {
  const loops = traceContours(src.g, src.w, src.h, s.thr, s.invert);
  // Specks are judged at the picture's size if it were `width` wide, which is close enough.
  const mmPerPx = s.width / src.w;
  const minPx = s.speck / (mmPerPx * mmPerPx);
  const tol = [0.25, 0.5, 0.9, 1.5, 2.5][s.detailIdx];
  const kept = loops.filter((l) => polyArea(l) >= minPx).map((l) => simplify(l, tol)).filter((l) => l.length >= 3);
  if (!kept.length) return [];
  // Width means the width of what was traced, not of the whole picture.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of kept.flat()) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const k = s.width / Math.max(x1 - x0, 1e-6), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return kept
    .map((l) => l.map(([x, y]) => [round((x - cx) * k, 0.01), round((cy - y) * k, 0.01), 0]))
    .sort((a, b) => polyArea(b) - polyArea(a));
}

// --- height maps
const HF_PRESETS = {
  'Black and white': [['Black', '#111111', 0.6], ['White', '#f4f4f0', 4.0]],
  Grayscale: [['Black', '#111111', 0.6], ['Grey', '#8c8c8c', 1.6], ['White', '#f4f4f0', 4.0]],
  Sunset: [['Black', '#111111', 0.6], ['Red', '#c8202c', 2.2], ['Orange', '#f08a24', 3.0], ['Yellow', '#f7d23a', 5.0], ['White', '#f4f4f0', 4.0]],
  Ocean: [['Navy', '#14254f', 0.8], ['Blue', '#2f6fdb', 1.8], ['Turquoise', '#28b3b8', 3.2], ['White', '#f4f4f0', 4.0]],
  Forest: [['Black', '#111111', 0.6], ['Dark green', '#1f5a2b', 1.5], ['Lime', '#8cc63f', 4.0], ['White', '#f4f4f0', 4.0]],
  Sepia: [['Dark brown', '#3a2416', 0.8], ['Tan', '#b3875a', 2.5], ['Cream', '#efe2c4', 4.5]],
};
function hfStack(name, base, maxH) {
  const list = HF_PRESETS[name];
  return list.map(([n, color, td], i) => ({ name: n, color, td, at: i === 0 ? 0 : round(base + ((i - 1) / Math.max(1, list.length - 1)) * (maxH - base), 0.01) }));
}
const qLayer = (z, p) => (z <= p.first ? p.first : p.first + Math.round((z - p.first) / p.lh) * p.lh);
function heightAt(L, p) {
  // L: brightness 0..1 after the invert option.
  if (p.mode === 'litho') return p.maxT - L * (p.maxT - p.minT);
  if (p.mode === 'relief') return p.minT + L * (p.maxT - p.minT);
  return qLayer(p.base + Math.pow(L, p.gamma || 1) * (p.maxH - p.base), p);
}
const hex3 = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
function hfColor(z, p) {
  // Stack the filaments bottom-up; each lets light through until it is as thick as its TD.
  const st = p.stack;
  let c = hex3(st[0].color);
  for (let i = 1; i < st.length; i++) {
    const start = st[i].at;
    if (z <= start + 1e-6) break;
    const end = i + 1 < st.length ? Math.min(z, st[i + 1].at) : z;
    const a = clamp((end - start) / Math.max(0.05, st[i].td), 0, 1);
    const f = hex3(st[i].color);
    c = c.map((v, k) => v + (f[k] - v) * a);
  }
  return c;
}
function hfSwaps(p) {
  return p.stack.slice(1).map((f) => {
    const layer = Math.max(2, Math.round((qLayer(f.at, p) - p.first) / p.lh) + 2);
    return { name: f.name, color: f.color, layer, z: round(p.first + (layer - 1) * p.lh, 0.01) };
  });
}
function pictureGeom(p) {
  const g0 = decodeGray(p.gray), gw = p.gw, gh = p.gh;
  const px = p.w / gw, fpx = p.mode === 'hueforge' ? 0 : Math.round((p.frame || 0) / px);
  const W = gw + 2 * fpx, H = gh + 2 * fpx;
  const hgt = new Float32Array(W * H);
  const frameH = p.mode === 'hueforge' ? 0 : p.maxT;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ix = x - fpx, iy = y - fpx;
    if (ix < 0 || iy < 0 || ix >= gw || iy >= gh) { hgt[y * W + x] = frameH; continue; }
    let L = g0[iy * gw + ix] / 255;
    if (p.invert) L = 1 - L;
    hgt[y * W + x] = heightAt(L, p);
  }
  const sizeX = W * px, sizeZ = H * px;
  const X = (x) => (x / (W - 1) - 0.5) * sizeX, Z = (y) => (y / (H - 1) - 0.5) * sizeZ;
  const n = W * H, nb = 2 * (W + H) - 4;
  const pos = new Float32Array((n + nb + 1) * 3);
  const col = p.mode === 'hueforge' ? new Float32Array((n + nb + 1) * 3) : null;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    pos.set([X(x), hgt[i], Z(y)], i * 3);
    if (col) col.set(hfColor(hgt[i], p), i * 3);
  }
  // Boundary ring for the walls and the flat bottom, in order around the edge.
  const ring = [];
  for (let x = 0; x < W; x++) ring.push([x, 0]);
  for (let y = 1; y < H; y++) ring.push([W - 1, y]);
  for (let x = W - 2; x >= 0; x--) ring.push([x, H - 1]);
  for (let y = H - 2; y > 0; y--) ring.push([0, y]);
  ring.forEach(([x, y], k) => { pos.set([X(x), 0, Z(y)], (n + k) * 3); if (col) col.set(hex3(p.stack[0].color), (n + k) * 3); });
  const ctr = n + nb;
  pos.set([0, 0, 0], ctr * 3);
  if (col) col.set(hex3(p.stack[0].color), ctr * 3);
  const idx = new Uint32Array(((W - 1) * (H - 1) * 2 + nb * 2 + nb) * 3);
  let t = 0;
  const tri = (a, b, c) => { idx[t++] = a; idx[t++] = b; idx[t++] = c; };
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const a = y * W + x, b = a + 1, c = a + W, d = c + 1;
    tri(a, c, b); tri(b, c, d);
  }
  ring.forEach(([x, y], k) => {
    const [x2, y2] = ring[(k + 1) % nb];
    const top1 = y * W + x, top2 = y2 * W + x2, bot1 = n + k, bot2 = n + ((k + 1) % nb);
    tri(top1, top2, bot1); tri(top2, bot2, bot1);
    tri(ctr, bot2, bot1);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}
MAKERS.picture = { label: 'Picture', build: pictureGeom };
function sampleGray(n = 40) {
  // A soft ring pattern, used for the shape-bin pictures.
  const g = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = Math.hypot(x - n / 2, y - n / 2) / (n / 2); g[y * n + x] = clamp(Math.round(128 + 120 * Math.cos(r * 7)), 0, 255); }
  return encodeGray(g);
}
const PIC_BIN = [
  { key: 'trace', label: 'Outline from picture', thumb: () => outlineGeom({ mode: 'extrude', pts: OUTLINE_TEMPLATES.extrude.Star, more: [ring(8, 3, true)], height: 4 }) },
  { key: 'litho', label: 'Lithophane', thumb: () => pictureGeom({ mode: 'litho', gray: sampleGray(), gw: 40, gh: 40, w: 40, minT: 1, maxT: 5, frame: 2 }) },
  { key: 'relief', label: 'Relief', thumb: () => pictureGeom({ mode: 'relief', gray: sampleGray(), gw: 40, gh: 40, w: 40, minT: 2, maxT: 6, frame: 2 }) },
  { key: 'hueforge', label: 'Colour layers', thumb: () => pictureGeom({ mode: 'hueforge', gray: sampleGray(), gw: 40, gh: 40, w: 40, base: 1, maxH: 6, lh: 0.2, first: 0.2, stack: hfStack('Sunset', 1, 6).map((f) => ({ ...f, td: f.td * 0.8 })) }) },
];

// ---------- picture dialog ----------
const pic = { src: null, mode: 'trace', edit: null, timer: 0, s: null };
const PIC_DEFAULTS = {
  trace: { thr: 128, invert: false, detailIdx: 1, speck: 2, width: 60, height: 5, hole: false },
  litho: { w: 100, minT: 0.8, maxT: 3.2, frame: 3, invert: false, detail: 0.4 },
  relief: { w: 100, minT: 2, maxT: 5, frame: 3, invert: false, detail: 0.4 },
  hueforge: { w: 100, base: 0.48, maxH: 2.0, lh: 0.08, first: 0.16, gamma: 1, invert: false, detail: 0.3, preset: 'Grayscale' },
};
const PIC_MODES = { trace: 'Outline', litho: 'Lithophane', relief: 'Relief', hueforge: 'Colour layers' };
const PIC_HELP = {
  trace: 'Finds the edges of the dark parts and turns them into an outline of dots. Works best with logos, silhouettes and simple drawings on a plain background.',
  litho: 'Thicker where the picture is dark, thinner where it is light. Print it in white and hold it up to a light to see the picture.',
  relief: 'Light parts stand up, dark parts stay low, like an embossed tile or a coin.',
  hueforge: 'Filament painting in the HueForge style: thin layers of different colours stacked so they mix, then a colour change at set heights while printing.',
};
function picSettings() { return pic.s[pic.mode]; }
function picOpen(mode, editObj) {
  pic.mode = mode; pic.edit = editObj || null;
  pic.s = structuredClone(PIC_DEFAULTS);
  if (editObj) {
    const p = editObj.p;
    pic.src = { g: decodeGray(p.gray), w: p.gw, h: p.gh };
    Object.assign(pic.s[p.mode], p, { detail: p.w / p.gw });
    if (p.mode === 'hueforge') pic.stack = structuredClone(p.stack);
  } else { pic.src = null; pic.stack = null; }
  $('picOverlay').hidden = false;
  picRender();
}
function picClose() { $('picOverlay').hidden = true; pic.src = null; }
function picParams() {
  // Build the shape parameters for the current height-map mode at the chosen detail.
  const s = picSettings(), src = pic.src;
  let g = src.g, gw = src.w, gh = src.h;
  if (!pic.edit) {
    const want = clamp(Math.round(s.w / s.detail), 20, 600);
    if (pic.full && want !== pic.full.w) { const r = grayFromImage(pic.img, Math.max(want, Math.round(want * pic.img.naturalHeight / pic.img.naturalWidth))); g = r.g; gw = r.w; gh = r.h; }
  }
  const p = { mode: pic.mode, gray: encodeGray(g), gw, gh, w: s.w, invert: !!s.invert };
  if (pic.mode === 'hueforge') Object.assign(p, { base: s.base, maxH: s.maxH, lh: s.lh, first: s.first, gamma: s.gamma, stack: pic.stack });
  else Object.assign(p, { minT: s.minT, maxT: s.maxT, frame: s.frame });
  return p;
}
function picField(key, label, unit, min, max, step) {
  const v = picSettings()[key];
  return `<div class="field"><label for="pk_${key}">${label} ${unit ? `<span class="unit">${unit}</span>` : ''}</label><input id="pk_${key}" data-k="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${fmt(v)}"></div>`;
}
function picRender() {
  const s = picSettings(), m = pic.mode;
  document.querySelectorAll('[data-picmode]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.picmode === m)); b.hidden = !!pic.edit && b.dataset.picmode === 'trace'; });
  $('picHelp').textContent = PIC_HELP[m];
  $('picDrop').hidden = !!pic.src;
  $('picStage').hidden = !pic.src;
  $('picCreate').disabled = !pic.src;
  $('picCreate').textContent = pic.edit ? 'Update' : 'Add to plate';
  $('picPng').hidden = !(pic.src && m !== 'trace');
  let html = '';
  if (m === 'trace') {
    html = `<div class="field"><label for="pk_thr">Dark or light cut-off</label><input id="pk_thr" data-k="thr" type="range" min="5" max="250" step="1" value="${s.thr}"></div>
      <label class="check"><input type="checkbox" id="pk_invert" data-k="invert" ${s.invert ? 'checked' : ''}> Trace the light parts instead</label>
      <div class="field"><label for="pk_detailIdx">Smooth ↔ detailed</label><input id="pk_detailIdx" data-k="detailIdx" type="range" min="0" max="4" step="1" value="${4 - s.detailIdx}"></div>
      <div class="field-grid">${picField('width', 'Width', 'mm', 2, 400, 1)}${picField('height', 'Height', 'mm', 0.4, 100, 0.5)}${picField('speck', 'Ignore specks under', 'mm²', 0, 200, 1)}</div>
      <label class="check"><input type="checkbox" id="pk_hole" data-k="hole" ${s.hole ? 'checked' : ''}> Make it a hole (for cutting a logo into something)</label>
      <p class="help" id="picStat"></p>`;
  } else if (m === 'hueforge') {
    if (!pic.stack) pic.stack = hfStack(s.preset, s.base, s.maxH);
    html = `<div class="field-grid">${picField('w', 'Width', 'mm', 10, 300, 1)}${picField('base', 'Base', 'mm', 0.16, 3, 0.08)}${picField('maxH', 'Total height', 'mm', 0.5, 6, 0.08)}${picField('lh', 'Layer height', 'mm', 0.04, 0.3, 0.02)}${picField('first', 'First layer', 'mm', 0.08, 0.4, 0.02)}${picField('detail', 'Pixel size', 'mm', 0.15, 2, 0.05)}</div>
      <div class="field"><label for="pk_gamma">Contrast</label><input id="pk_gamma" data-k="gamma" type="range" min="0.4" max="2.5" step="0.05" value="${s.gamma}"></div>
      <label class="check"><input type="checkbox" id="pk_invert" data-k="invert" ${s.invert ? 'checked' : ''}> Swap light and dark</label>
      <div class="row" style="justify-content:space-between"><h2 style="margin:0">Filaments, bottom to top</h2><select id="pk_preset" class="sel" style="width:auto"><option value="">Load a set…</option>${Object.keys(HF_PRESETS).map((n) => `<option>${n}</option>`).join('')}</select></div>
      <div class="hf-table">
        <span class="hf-h">Colour</span><span class="hf-h">Name</span><span class="hf-h" title="Transmission distance: how thick this filament has to be before you can't see through it">TD mm</span><span class="hf-h">Starts at mm</span><span></span>
        ${pic.stack.map((f, i) => `<input type="color" data-hf="${i}:color" value="${f.color}" aria-label="Colour ${i + 1}"><input type="text" data-hf="${i}:name" value="${esc(f.name)}" aria-label="Name ${i + 1}"><input type="number" data-hf="${i}:td" step="0.1" min="0.1" value="${fmt(f.td)}" aria-label="TD ${i + 1}"><input type="number" data-hf="${i}:at" step="${s.lh}" min="0" value="${fmt(f.at)}" ${i === 0 ? 'disabled' : ''} aria-label="Starts at ${i + 1}"><button class="btn small ghost" data-hfdel="${i}" ${pic.stack.length <= 2 ? 'disabled' : ''} aria-label="Remove filament ${i + 1}">✕</button>`).join('')}
      </div>
      <button class="btn small" id="pk_add">Add a filament</button>
      <p class="help">TD is how thick a filament must be before you can't see through it. The value printed on the spool or in the HueForge library works best.</p>
      <div class="hf-swaps" id="picSwaps"></div>`;
  } else {
    const relief = m === 'relief';
    html = `<div class="field-grid">${picField('w', 'Width', 'mm', 10, 300, 1)}${picField('minT', relief ? 'Base' : 'Thinnest', 'mm', 0.4, 10, 0.1)}${picField('maxT', relief ? 'Top' : 'Thickest', 'mm', 0.8, 30, 0.1)}${picField('frame', 'Border', 'mm', 0, 20, 0.5)}${picField('detail', 'Pixel size', 'mm', 0.15, 2, 0.05)}</div>
      <label class="check"><input type="checkbox" id="pk_invert" data-k="invert" ${s.invert ? 'checked' : ''}> ${relief ? 'Make the dark parts stand up' : 'Swap light and dark'}</label>
      <p class="help">${relief ? 'Base is the flat back, Top is where the brightest parts reach.' : 'Around 0.8 mm thinnest and 3 mm thickest works for most printers. Print it in white at 100% infill.'}</p>`;
  }
  $('picOpts').innerHTML = html;
  $('picOpts').querySelectorAll('[data-k]').forEach((el) => {
    // Sliders and ticks update as you move them; number boxes when you press Enter or leave them.
    el.addEventListener(el.type === 'number' ? 'change' : 'input', () => {
      const k = el.dataset.k;
      let v = el.type === 'checkbox' ? el.checked : parseFloat(el.value);
      if (k === 'detailIdx') v = 4 - v;
      if (el.type === 'number' && !isFinite(v)) return;
      if (el.type === 'number') v = clamp(v, parseFloat(el.min), parseFloat(el.max));
      picSettings()[k] = v;
      if (pic.mode === 'hueforge' && (k === 'base' || k === 'maxH')) {
        const n = pic.stack.length;
        pic.stack = pic.stack.map((f, i) => ({ ...f, at: i === 0 ? 0 : round(s.base + ((i - 1) / Math.max(1, n - 1)) * (s.maxH - s.base), 0.01) }));
        picRender(); return;
      }
      picPreviewSoon();
    });
  });
  if (m === 'hueforge') {
    $('picOpts').querySelectorAll('[data-hf]').forEach((el) => {
      el.onchange = () => {
        const [i, k] = el.dataset.hf.split(':'); const f = pic.stack[+i];
        f[k] = k === 'td' || k === 'at' ? Math.max(0, parseFloat(el.value) || 0) : el.value;
        if (k === 'at') pic.stack.sort((a, b) => a.at - b.at);
        picRender();
      };
    });
    $('picOpts').querySelectorAll('[data-hfdel]').forEach((b) => { b.onclick = () => { pic.stack.splice(+b.dataset.hfdel, 1); pic.stack[0].at = 0; picRender(); }; });
    $('pk_add').onclick = () => {
      const last = pic.stack[pic.stack.length - 1];
      pic.stack.push({ name: 'White', color: '#f4f4f0', td: 4, at: round(Math.min(s.maxH - s.lh, (last.at || s.base) + 0.4), 0.01) });
      picRender();
    };
    $('pk_preset').onchange = (e) => { if (e.target.value) { s.preset = e.target.value; pic.stack = hfStack(s.preset, s.base, s.maxH); picRender(); } };
  }
  picPreviewSoon();
}
function picPreviewSoon() { clearTimeout(pic.timer); pic.timer = setTimeout(picPreview, 60); }
function picPreview() {
  if (!pic.src) return;
  const cv = $('picCanvas'), src = pic.src, m = pic.mode, s = picSettings();
  const maxW = 560, k = Math.min(maxW / src.w, 420 / src.h, 4);
  cv.width = Math.round(src.w * k); cv.height = Math.round(src.h * k);
  const x = cv.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = src.w; tmp.height = src.h;
  const tx = tmp.getContext('2d'), im = tx.createImageData(src.w, src.h);
  const p = m === 'trace' ? null : { ...picSettings(), mode: m, stack: pic.stack };
  for (let i = 0; i < src.w * src.h; i++) {
    let r, g, b;
    const L0 = src.g[i] / 255;
    if (m === 'trace') {
      const inside = s.invert ? src.g[i] > s.thr : src.g[i] < s.thr;
      const v = 0.55 + L0 * 0.45;
      [r, g, b] = inside ? [0.91, 0.33, 0.11] : [v, v, v];
    } else {
      const L = p.invert ? 1 - L0 : L0;
      const z = heightAt(L, p);
      if (m === 'hueforge') [r, g, b] = hfColor(z, p);
      else if (m === 'litho') { const t = Math.exp(-(z - p.minT) * 1.1); [r, g, b] = [1, 0.96, 0.88].map((c) => c * (0.08 + 0.92 * t)); }
      else { const v = 0.25 + 0.75 * (z - p.minT) / Math.max(0.1, p.maxT - p.minT); [r, g, b] = [v, v * 0.97, v * 0.92]; }
    }
    im.data[i * 4] = r * 255; im.data[i * 4 + 1] = g * 255; im.data[i * 4 + 2] = b * 255; im.data[i * 4 + 3] = 255;
  }
  tx.putImageData(im, 0, 0);
  x.imageSmoothingEnabled = m !== 'hueforge';
  x.drawImage(tmp, 0, 0, cv.width, cv.height);
  if (m === 'trace') {
    const parts = traceToOutline(src, s);
    pic.parts = parts;
    // Draw the simplified loops in picture pixels so they sit on the picture.
    const loops = traceContours(src.g, src.w, src.h, s.thr, s.invert).filter((l) => polyArea(l) >= s.speck / ((s.width / src.w) ** 2)).map((l) => simplify(l, [0.25, 0.5, 0.9, 1.5, 2.5][s.detailIdx]));
    x.strokeStyle = '#1f6fe0'; x.lineWidth = 1.5;
    let dots = 0;
    for (const part of loops) {
      x.beginPath();
      part.forEach(([px, py], i) => { const sx = (px + 0.5) * k, sy = (py + 0.5) * k; i ? x.lineTo(sx, sy) : x.moveTo(sx, sy); });
      x.closePath(); x.stroke();
      dots += part.length;
    }
    let dep = 0;
    if (parts.length) { let y0 = Infinity, y1 = -Infinity; for (const [, y] of parts.flat()) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); } dep = y1 - y0; }
    const st = $('picStat');
    if (st) st.textContent = parts.length ? `${parts.length} part${parts.length > 1 ? 's' : ''}, ${dots} dots, ${fmt(s.width)} × ${fmt(round(dep, 0.1))} mm. The blue lines become the outline.` : 'Nothing found. Move the cut-off slider until the shape turns orange.';
    $('picCreate').disabled = !parts.length;
  } else {
    $('picSize').textContent = `${fmt(s.w)} × ${fmt(round(s.w * src.h / src.w, 0.1))} mm`;
  }
  $('picSize').hidden = m === 'trace';
  if (m === 'hueforge') {
    const sw = hfSwaps({ ...p });
    $('picSwaps').innerHTML = `<h2>Colour changes</h2><ol class="swaps"><li><span class="chip" style="background:${p.stack[0].color}"></span><span>Start with <b>${esc(p.stack[0].name)}</b>, ${fmt(p.lh)} mm layers (first layer ${fmt(p.first)} mm)</span></li>${sw.map((c) => `<li><span class="chip" style="background:${c.color}"></span><span>At layer <b>${c.layer}</b> (Z ${fmt(c.z)} mm) change to <b>${esc(c.name)}</b></span></li>`).join('')}</ol>`;
  }
}
async function picLoadFile(f) {
  if (!f || !/^image\//.test(f.type)) { toast('That file is not a picture. Try a PNG or JPG.'); return; }
  const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; }).catch(() => null);
  if (!img.naturalWidth) { toast('That picture could not be opened.'); return; }
  pic.img = img;
  pic.full = grayFromImage(img, 600);
  pic.src = grayFromImage(img, 300);
  pic.s.trace.width = round(Math.min(80, Math.max(30, 60)), 1);
  picRender();
}
$('picFile').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; picLoadFile(f); };
$('picChoose').onclick = () => $('picFile').click();
$('picDrop').ondragover = (e) => { e.preventDefault(); };
$('picDrop').ondrop = (e) => { e.preventDefault(); picLoadFile(e.dataTransfer.files[0]); };
$('picReplace').onclick = () => $('picFile').click();
document.querySelectorAll('[data-picmode]').forEach((b) => { b.onclick = () => { pic.mode = b.dataset.picmode; picRender(); }; });
$('picCancel').onclick = picClose;
$('picOverlay').onclick = (e) => { if (e.target === $('picOverlay')) picClose(); };
$('picPng').onclick = async () => {
  // A clean grey height map, for the HueForge app or anything else that reads one.
  const p = picParams(), g = decodeGray(p.gray);
  const c = document.createElement('canvas'); c.width = p.gw; c.height = p.gh;
  const x = c.getContext('2d'), im = x.createImageData(p.gw, p.gh);
  for (let i = 0; i < g.length; i++) { const v = p.invert ? 255 - g[i] : g[i]; im.data.set([v, v, v, 255], i * 4); }
  x.putImageData(im, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  if (await offerFile(safeName(doc.name) + '-heightmap.png', blob)) toast('Saved the height map picture.');
};
$('picCreate').onclick = () => {
  if (!pic.src) return;
  busy(true); $('busy').textContent = 'Building…';
  setTimeout(() => {
    try {
      if (pic.mode === 'trace') {
        const s = pic.s.trace, parts = pic.parts || traceToOutline(pic.src, s);
        if (!parts.length) throw new Error('nothing traced');
        const o = addShape({ type: 'outline', hole: s.hole, quiet: true, p: { ...structuredClone(MAKER_DEFAULTS.outline), mode: 'extrude', pts: parts[0], more: parts.slice(1), height: s.height } });
        picClose();
        toast(`Traced ${parts.length} part${parts.length > 1 ? 's' : ''}. Press Edit dots to tidy up the outline.`);
        return o;
      }
      const p = picParams();
      if (pic.edit) { pic.edit.p = p; picClose(); updateMaker(pic.edit); }
      else { addShape({ type: 'picture', p, color: p.mode === 'hueforge' ? '#ffffff' : p.mode === 'litho' ? '#f4f1ea' : undefined }); picClose(); if (p.mode === 'litho') toast('Lithophane added. Print it in white with 100% infill.'); }
    } catch (err) {
      console.error(err);
      toast('That picture could not be turned into a shape. Try a smaller size or a simpler picture.');
    } finally { busy(false); $('busy').textContent = 'Combining shapes…'; }
  }, 30);
};
