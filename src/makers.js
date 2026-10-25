// ---------- makers: storage boxes, lids, Gridfinity ----------
// Built with Manifold in printer space (mm, Z up, centred on X/Y, bottom at Z = 0),
// then turned into a Three.js geometry (Y up).
const MF = wasm.Manifold, CSec = wasm.CrossSection;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const GF = { unit: 42, height: 7, base: 4.75, lip: 4.4, radius: 3.75 };
const LID_LIP = 4;

function withScope(fn) {
  const made = [];
  const k = (m) => { made.push(m); return m; };
  try { return fn(k); } finally { for (const m of made) { try { m.delete(); } catch (e) { /* already freed */ } } }
}
function ccw(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a < 0 ? pts.slice().reverse() : pts;
}
function rrectPts(w, d, r, cx = 0, cy = 0, seg = 8) {
  r = clamp(r, 0, Math.min(w, d) / 2 - 0.01);
  if (r < 0.05) return [[cx - w / 2, cy - d / 2], [cx + w / 2, cy - d / 2], [cx + w / 2, cy + d / 2], [cx - w / 2, cy + d / 2]];
  const pts = [];
  for (const [x, y, a0] of [[w / 2 - r, d / 2 - r, 0], [-w / 2 + r, d / 2 - r, 90], [-w / 2 + r, -d / 2 + r, 180], [w / 2 - r, -d / 2 + r, 270]]) {
    for (let i = 0; i <= seg; i++) { const a = (a0 + (90 * i) / seg) * DEG; pts.push([cx + x + r * Math.cos(a), cy + y + r * Math.sin(a)]); }
  }
  return pts;
}
const rrPrism = (k, w, d, r, z0, z1, cx = 0, cy = 0) => k(k(k(new CSec([ccw(rrectPts(w, d, r, cx, cy))])).extrude(z1 - z0)).translate([0, 0, z0]));
const slab = (k, x0, x1, y0, y1, z0, z1) => k(k(MF.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
const cylX = (k, x0, x1, y, z, r) => k(k(k(MF.cylinder(x1 - x0, r, r, 48)).rotate([0, 90, 0])).translate([x0, y, z]));
const cylY = (k, y0, y1, x, z, r) => k(k(k(MF.cylinder(y1 - y0, r, r, 48)).rotate([-90, 0, 0])).translate([x, y0, z]));
const cylZ = (k, x, y, z0, z1, r) => k(k(MF.cylinder(z1 - z0, r, r, 40)).translate([x, y, z0]));
// A 2D outline in the (y, z) plane pushed along X, or in the (x, z) plane pushed along Y.
const prismX = (k, poly, x0, len) => k(k(k(k(new CSec([ccw(poly)])).extrude(len)).rotate([90, 0, 90])).translate([x0, 0, 0]));
const prismY = (k, poly, y0, len) => k(k(k(k(new CSec([ccw(poly)])).extrude(len)).rotate([90, 0, 0])).translate([0, y0 + len, 0]));
// Convex hull through rounded-rectangle slices: [w, d, r, z].
const hullSlices = (k, slices, cx = 0, cy = 0) => k(MF.hull(slices.flatMap(([w, d, r, z]) => rrectPts(w, d, r, cx, cy).map(([x, y]) => [x, y, z]))));
const unionAll = (k, list) => (list.length === 1 ? list[0] : k(MF.union(list)));
function stadium(len, h, cy, cz, seg = 12) {
  // A slot with round ends, lying in a 2D plane: long along the first axis.
  const r = h / 2, a = len / 2 - r, pts = [];
  for (let i = 0; i <= seg; i++) { const t = -90 + (180 * i) / seg; pts.push([cy + a + r * Math.cos(t * DEG), cz + r * Math.sin(t * DEG)]); }
  for (let i = 0; i <= seg; i++) { const t = 90 + (180 * i) / seg; pts.push([cy - a + r * Math.cos(t * DEG), cz + r * Math.sin(t * DEG)]); }
  return pts;
}
function manifoldToGeom(m) {
  const out = m.getMesh();
  const n = out.numProp, vp = out.vertProperties, pos = new Float32Array((vp.length / n) * 3);
  for (let i = 0, j = 0; i < vp.length; i += n, j += 3) { pos[j] = vp[i]; pos[j + 1] = vp[i + 2]; pos[j + 2] = -vp[i + 1]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(out.triVerts), 1));
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}
function labelText(k, text, { width, height, depth, faceY, zc, raised }) {
  // Upright letters on the front face (y = faceY), read from the front.
  const tg = new TextGeometry(text, { font, size: 10, depth: 1, curveSegments: 4, bevelEnabled: false });
  tg.computeBoundingBox();
  const bb = tg.boundingBox, tw = bb.max.x - bb.min.x, th = bb.max.y - bb.min.y;
  if (tw <= 0 || th <= 0) return null;
  const s = Math.min(width / tw, height / th);
  const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
  const p = tg.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = (p.getX(i) - cx) * s, y = (p.getY(i) - cy) * s, z = p.getZ(i);
    // raised: from 0.3 inside the wall to `depth` proud of it; engraved: from 0.1 proud to `depth` deep.
    // Both map the letters' depth to -Y so the triangles keep facing outwards.
    const yy = raised ? faceY + 0.3 - z * (depth + 0.3) : faceY + depth - z * (depth + 0.1);
    p.setXYZ(i, x, yy, zc + y);
  }
  return k(toManifold(tg));
}

function storageDims(p) {
  const g = p.style === 'gridfinity';
  const W = g ? GF.unit * p.gx - 0.5 : p.w, D = g ? GF.unit * p.gy - 0.5 : p.d;
  const H = g ? GF.height * p.gz : p.h;
  const wall = clamp(p.wall, 0.4, Math.min(W, D) / 4);
  const R = g ? GF.radius : clamp(p.radius, 0, Math.min(W, D) / 2 - 0.5);
  const iW = W - 2 * wall, iD = D - 2 * wall, iR = Math.max(R - wall, 0.5);
  const footH = !g && p.stack ? 3 : 0;
  const baseTop = g ? GF.base : footH;
  const floorZ = baseTop + clamp(p.floor, 0.4, H / 2);
  const slide = !g && p.lid === 'slide';
  const gd = slide ? Math.max(0.6, wall * 0.5) : 0;
  const gz1 = H - 1, gz0 = gz1 - (p.lidT + 2 * p.tol);
  let top = H;
  if (!g && p.lid === 'friction') top = H - LID_LIP - 0.5;
  if (slide) top = gz0 - 0.5;
  if (footH) top = Math.min(top, H - footH - 0.5);
  return { g, W, D, H, wall, R, iW, iD, iR, footH, baseTop, floorZ, slide, gd, gz0, gz1, top };
}

function buildStorage(p) {
  return withScope((k) => {
    const d = storageDims(p);
    const { g, W, D, H, wall, R, iW, iD, iR, footH, floorZ } = d;
    const solids = [], cuts = [], adds = [], cuts2 = [];

    // Outer body
    if (g) {
      const feet = [];
      for (let i = 0; i < p.gx; i++) for (let j = 0; j < p.gy; j++) {
        const cx = -(p.gx - 1) * 21 + 42 * i, cy = -(p.gy - 1) * 21 + 42 * j;
        feet.push(hullSlices(k, [[35.6, 35.6, 0.8, 0], [37.2, 37.2, 1.6, 0.8], [37.2, 37.2, 1.6, 2.6]], cx, cy));
        // 0.02 mm under full width and running up into the body, so the two overlap instead of touching.
        feet.push(hullSlices(k, [[37.2, 37.2, 1.6, 2.6], [41.48, 41.48, 3.74, 4.75], [41.48, 41.48, 3.74, 5.2]], cx, cy));
        if (p.magnets) for (const sx of [-13, 13]) for (const sy of [-13, 13]) cuts2.push(cylZ(k, cx + sx, cy + sy, -1, 2.4, 3.25));
      }
      solids.push(...feet, rrPrism(k, W, D, R, GF.base, p.lip ? H + GF.lip : H));
    } else {
      const s = Math.min(p.soften || 0, (H - footH) / 3, Math.min(W, D) / 4);
      if (s > 0.2) {
        const sl = [];
        for (let i = 0; i <= 6; i++) { const t = (i / 6) * 90 * DEG, inset = s - s * Math.sin(t); sl.push([W - 2 * inset, D - 2 * inset, Math.max(R - inset, 0), footH + s - s * Math.cos(t)]); }
        sl.push([W, D, R, H]);
        solids.push(hullSlices(k, sl));
      } else solids.push(rrPrism(k, W, D, R, footH, H));
      if (footH) solids.push(rrPrism(k, iW - 2 * p.tol, iD - 2 * p.tol, Math.max(iR - p.tol, 0.5), 0, footH + 0.01));
    }
    cuts.push(rrPrism(k, iW, iD, iR, floorZ, g && p.lip ? H : H + 10));
    // Gridfinity stacking lip: the inside follows the profile the feet of the bin above sit in,
    // ending in a 0.3 mm flat rim.
    if (g && p.lip) {
      const sl = (inset, z) => [W - 2 * inset, D - 2 * inset, Math.max(R - inset, 0.3), z];
      cuts.push(hullSlices(k, [sl(2.6, H - 0.02), sl(0.7, H + 1.9), sl(0.7, H + 3.7)]), hullSlices(k, [sl(0.7, H + 3.7), sl(0.3, H + 4.1), sl(0.3, H + GF.lip + 1)]));
    }

    // Compartments
    const cols = clamp(Math.round(p.cols), 1, 20), rows = clamp(Math.round(p.rows), 1, 20);
    const divT = clamp(p.divT, 0.4, 5);
    const divTop = floorZ + (d.top - floorZ) * clamp(p.divH, 10, 100) / 100;
    for (let i = 1; i < cols; i++) { const x = -iW / 2 + (i * iW) / cols; adds.push(slab(k, x - divT / 2, x + divT / 2, -iD / 2 - 0.1, iD / 2 + 0.1, floorZ - 0.1, divTop)); }
    for (let j = 1; j < rows; j++) { const y = -iD / 2 + (j * iD) / rows; adds.push(slab(k, -iW / 2 - 0.1, iW / 2 + 0.1, y - divT / 2, y + divT / 2, floorZ - 0.1, divTop)); }
    const rowSpan = (j) => [-iD / 2 + (j * iD) / rows + (j > 0 ? divT / 2 : 0), -iD / 2 + ((j + 1) * iD) / rows - (j < rows - 1 ? divT / 2 : 0)];

    // Finger scoops: a curved ramp along the front of each row
    if (p.scoop) {
      for (let j = 0; j < rows; j++) {
        const [y0, y1] = rowSpan(j);
        const r = Math.min(p.scoopR, (y1 - y0) * 0.6, (d.top - floorZ) * 0.9);
        if (r < 2) continue;
        const pts = [[y0 - 0.05, floorZ - 0.05], [y0 + r, floorZ - 0.05]];
        // Centre nudged 0.05 mm into the floor and wall so the curve cuts into them rather than just touching.
        const cy = y0 + r - 0.05, cz = floorZ + r - 0.05;
        for (let i = 0; i <= 16; i++) { const a = (270 - (90 * i) / 16) * DEG; pts.push([cy + r * Math.cos(a), cz + r * Math.sin(a)]); }
        pts.push([y0 - 0.05, floorZ + r]);
        adds.push(prismX(k, pts, -iW / 2 - 0.05, iW + 0.1));
      }
    }
    // Label shelf: a 45° supported tab at the back of each row
    if (p.label === 'shelf') {
      for (let j = 0; j < rows; j++) {
        const [y0, y1] = rowSpan(j);
        const t = Math.min(12, (y1 - y0) * 0.35);
        const zt = Math.min(d.top, H) - (g ? 0 : 0.5);
        if (t < 3 || zt - t < floorZ) continue;
        adds.push(prismX(k, [[y1 + 0.05, zt], [y1 - t, zt], [y1 - t, zt - 0.8], [y1 + 0.05, zt - 0.8 - t]], -iW / 2 - 0.05, iW + 0.1));
      }
    }
    // Text on the front
    if ((p.label === 'raised' || p.label === 'engraved') && (p.labelText || '').trim()) {
      const zc = floorZ + (H - floorZ) * (p.notch ? 0.35 : 0.5);
      const raised = p.label === 'raised';
      const m = labelText(k, p.labelText.trim(), { width: W - 2 * R - 6, height: Math.min(12, (H - floorZ) * 0.45), depth: raised ? 0.8 : Math.min(0.6, wall * 0.5), faceY: -D / 2, zc, raised });
      if (m) (raised ? adds : cuts2).push(m);
    }
    // Finger notch in the front wall
    if (p.notch) {
      const nw = Math.min(30, W * 0.4), nd = Math.min(18, (H - floorZ) * 0.45), r = nw / 2;
      const yA = -D / 2 - 2, yB = -iD / 2 + 0.6;
      cuts2.push(cylY(k, yA, yB, 0, H - nd + r, r));
      if (nd > r) cuts2.push(slab(k, -r, r, yA, yB, H - nd + r, H + GF.lip + 1));
    }
    // Handle slots through the side walls
    if (p.handles) {
      const L = Math.min(40, D * 0.5), hh = Math.min(10, (H - floorZ) * 0.3), zc = H - hh / 2 - Math.max(4, hh * 0.6);
      if (L > hh + 2 && zc - hh / 2 > floorZ) {
        const slot = stadium(L, hh, 0, zc);
        cuts2.push(prismX(k, slot, -W / 2 - 1, wall + 2), prismX(k, slot, W / 2 - wall - 1, wall + 2));
      }
    }
    // Slide-on lid: grooves in the side and back walls, front wall opened above them
    if (d.slide) {
      cuts2.push(slab(k, -iW / 2 - d.gd, iW / 2 + d.gd, -D / 2 - 1, iD / 2 + d.gd, d.gz0, d.gz1));
      cuts2.push(slab(k, -iW / 2 - d.gd, iW / 2 + d.gd, -D / 2 - 1, -iD / 2 + 0.01, d.gz0, H + 1));
    }
    // Hinged lid: knuckles at both ends of the back edge, pin hole for a piece of 1.75 mm filament
    if (!g && p.lid === 'hinge') {
      const hk = hingeLayout(d, p);
      for (const [x0, x1] of [hk.segs[0], hk.segs[2]]) {
        adds.push(k(MF.hull([cylX(k, x0, x1, hk.y, hk.z, hk.kr), slab(k, x0, x1, D / 2 - 0.02, D / 2, hk.z - 2 * hk.kr - 2, hk.z)])));
      }
      cuts2.push(cylX(k, -W / 2 - 1, W / 2 + 1, hk.y, hk.z, hk.pin));
    }

    let body = k(unionAll(k, solids).subtract(unionAll(k, cuts)));
    if (adds.length) body = k(MF.union([body, ...adds]));
    if (cuts2.length) body = k(body.subtract(unionAll(k, cuts2)));
    return manifoldToGeom(body);
  });
}
function hingeLayout(d, p) {
  const kr = 3.5, gap = p.tol + 0.3;
  const x0 = -d.W / 2 + d.R + 1, x1 = d.W / 2 - d.R - 1, seg = (x1 - x0 - 2 * gap) / 3;
  return { kr, pin: 1 + p.tol / 2, y: d.D / 2 + kr, z: d.H, segs: [[x0, x0 + seg], [x0 + seg + gap, x0 + 2 * seg + gap], [x0 + 2 * seg + 2 * gap, x1]] };
}
function lidParamsOf(box) {
  const p = box.p;
  return { boxId: box.id, lid: p.lid, w: p.w, d: p.d, h: p.h, wall: p.wall, radius: p.radius, tol: p.tol, lidT: p.lidT, stack: p.stack, floor: p.floor, style: 'plain' };
}
function buildLid(p) {
  return withScope((k) => {
    const d = storageDims(p);
    const { W, D, R, iW, iD, iR, wall } = d;
    const t = clamp(p.lidT, 0.8, 6), tol = p.tol;
    let lid;
    if (p.lid === 'slide') {
      const back = iD / 2 + d.gd - tol, lw = iW + 2 * d.gd - 2 * tol;
      const plate = rrPrism(k, lw, back + D / 2, 0.6, 0, t, 0, (back - D / 2) / 2);
      const grip = slab(k, -10, 10, -D / 2 + 1.5, -D / 2 + 3.5, t - 0.01, t + 1);
      lid = k(MF.union([plate, grip]));
    } else if (p.lid === 'hinge') {
      // Built where it sits on the box (top of box at z = H), then flipped to print plate-down.
      const hk = hingeLayout(d, p);
      const plate = rrPrism(k, W, D, R, d.H, d.H + t);
      const [x0, x1] = hk.segs[1];
      const knuckle = k(MF.hull([cylX(k, x0, x1, hk.y, hk.z, hk.kr), slab(k, x0, x1, D / 2 - 0.02, D / 2, d.H, d.H + t)]));
      const tab = slab(k, -8, 8, -D / 2 - 4, -D / 2 + 1, d.H, d.H + t);
      lid = k(k(MF.union([plate, knuckle, tab])).subtract(cylX(k, -W / 2 - 1, W / 2 + 1, hk.y, hk.z, hk.pin)));
      lid = k(k(lid.rotate([180, 0, 0])).translate([0, 0, d.H + t]));
    } else {
      // Friction fit: a plate with a lip that pushes into the box opening.
      const plate = rrPrism(k, W, D, R, 0, t);
      const ow = iW - 2 * tol, od = iD - 2 * tol, or = Math.max(iR - tol, 0.5), lw = Math.max(1.2, Math.min(wall, 2));
      const lip = k(rrPrism(k, ow, od, or, t - 0.01, t + LID_LIP).subtract(rrPrism(k, ow - 2 * lw, od - 2 * lw, Math.max(or - lw, 0.3), t, t + LID_LIP + 1)));
      const tab = slab(k, -8, 8, -D / 2 - 4, -D / 2 + 1, 0, t);
      lid = k(MF.union([plate, lip, tab]));
    }
    return manifoldToGeom(lid);
  });
}
function buildBaseplate(p) {
  return withScope((k) => {
    const gx = clamp(Math.round(p.gx), 1, 12), gy = clamp(Math.round(p.gy), 1, 12);
    const W = 42 * gx, D = 42 * gy, Hp = 4.65;
    const plate = rrPrism(k, W, D, 4, 0, Hp);
    const cav = [];
    const sl = (inset, r, z) => [42 - 2 * inset, 42 - 2 * inset, r, z];
    for (let i = 0; i < gx; i++) for (let j = 0; j < gy; j++) {
      const cx = -(gx - 1) * 21 + 42 * i, cy = -(gy - 1) * 21 + 42 * j;
      cav.push(hullSlices(k, [sl(2.85, 1.15, -1), sl(2.85, 1.15, 0.7 - 0.7)], cx, cy));
      cav.push(hullSlices(k, [sl(2.85, 1.15, 0), sl(2.15, 1.85, 0.7), sl(2.15, 1.85, 2.5)], cx, cy));
      cav.push(hullSlices(k, [sl(2.15, 1.85, 2.5), sl(0, 4, Hp), sl(-0.3, 4.3, Hp + 0.3)], cx, cy));
    }
    return manifoldToGeom(k(plate.subtract(unionAll(k, cav))));
  });
}

const MAKER_DEFAULTS = {
  storage: { style: 'plain', w: 80, d: 60, h: 40, wall: 1.6, floor: 1.2, radius: 4, soften: 1, cols: 2, rows: 1, divT: 1.2, divH: 100, scoop: false, scoopR: 12, notch: false, handles: false, label: 'none', labelText: 'SCREWS', lid: 'none', lidT: 2, tol: 0.3, stack: false },
  gridfinity: { style: 'gridfinity', gx: 2, gy: 1, gz: 6, wall: 1.2, floor: 1.2, cols: 2, rows: 1, divT: 1.2, divH: 100, scoop: true, scoopR: 12, notch: false, handles: false, label: 'shelf', labelText: 'BITS', lip: true, magnets: false, tol: 0.3 },
  gfplate: { gx: 3, gy: 3 },
};
const MAKERS = {
  storage: { label: 'Storage box', build: buildStorage },
  lid: { label: 'Lid', build: buildLid },
  gfplate: { label: 'Gridfinity baseplate', build: buildBaseplate },
};
const MAKER_BIN = [
  { key: 'box', label: 'Storage box', spec: () => ({ type: 'storage', p: { ...MAKER_DEFAULTS.storage } }) },
  { key: 'gfbin', label: 'Gridfinity bin', spec: () => ({ type: 'storage', p: { ...MAKER_DEFAULTS.gridfinity } }) },
  { key: 'gfplate', label: 'Gridfinity base', spec: () => ({ type: 'gfplate', p: { ...MAKER_DEFAULTS.gfplate } }) },
];
const isMaker = (o) => !!MAKERS[o.type];

// ---------- custom outlines: shapes drawn with dots ----------
// A dot is [x, y, smooth]. Sharp dots join with straight lines; smooth dots bend the
// lines through them into a curve. "extrude" pushes the outline straight up;
// "spin" turns a side profile (x = distance from the centre line, y = height) all the way round.
const r2 = (v) => Math.round(v * 100) / 100;
const ring = (n, r, smooth, a0 = 90) => Array.from({ length: n }, (_, i) => { const a = (a0 + (360 * i) / n) * DEG; return [r2(r * Math.cos(a)), r2(r * Math.sin(a)), smooth ? 1 : 0]; });
const OUTLINE_TEMPLATES = {
  extrude: {
    House: [[-15, -15, 0], [15, -15, 0], [15, 5, 0], [0, 18, 0], [-15, 5, 0]],
    Square: [[-15, -15, 0], [15, -15, 0], [15, 15, 0], [-15, 15, 0]],
    Circle: ring(8, 15, true),
    Triangle: [[-15, -13, 0], [15, -13, 0], [0, 13, 0]],
    Hexagon: ring(6, 15, false),
    Star: ring(10, 1, false).map(([x, y], i) => [r2(x * (i % 2 ? 7 : 16)), r2(y * (i % 2 ? 7 : 16)), 0]),
    Heart: [[0, -15, 0], [13, -2, 1], [13, 9, 1], [6, 13, 1], [0, 8, 0], [-6, 13, 1], [-13, 9, 1], [-13, -2, 1]],
    Arrow: [[-16, -5, 0], [3, -5, 0], [3, -12, 0], [17, 0, 0], [3, 12, 0], [3, 5, 0], [-16, 5, 0]],
    Blob: [[-14, -8, 1], [2, -14, 1], [16, -6, 1], [12, 10, 1], [-2, 8, 1], [-12, 14, 1]],
  },
  spin: {
    Cup: [[0, 0, 0], [20, 0, 0], [23, 40, 0], [21, 40, 0], [18.2, 2, 0], [0, 2, 0]],
    Bowl: [[0, 0, 0], [14, 0, 0], [30, 14, 1], [36, 26, 0], [34, 26, 0], [28, 15, 1], [13, 2, 0], [0, 2, 0]],
    Vase: [[0, 0, 0], [16, 0, 0], [22, 16, 1], [11, 42, 1], [14, 56, 0], [0, 56, 0]],
    Knob: [[0, 0, 0], [16, 0, 0], [16, 9, 1], [8, 13, 1], [6, 22, 0], [0, 22, 0]],
    Spinner: [[0, 0, 0], [16, 14, 1], [3, 18, 0], [3, 30, 0], [0, 30, 0]],
    Bead: [[0, -10, 0], [8, -8, 1], [12, 0, 1], [8, 8, 1], [0, 10, 0], [0, 3, 0], [2, 3, 0], [2, -3, 0], [0, -3, 0]],
  },
};
function samplePath(pts, steps = 10) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    out.push([p1[0], p1[1]]);
    if (!p1[2] && !p2[2]) continue;
    const t1 = p1[2] ? [(p2[0] - p0[0]) / 2, (p2[1] - p0[1]) / 2] : [0, 0];
    const t2 = p2[2] ? [(p3[0] - p1[0]) / 2, (p3[1] - p1[1]) / 2] : [0, 0];
    for (let s = 1; s < steps; s++) {
      const t = s / steps, t2_ = t * t, t3 = t2_ * t;
      const a = 2 * t3 - 3 * t2_ + 1, b = t3 - 2 * t2_ + t, c = -2 * t3 + 3 * t2_, d = t3 - t2_;
      out.push([a * p1[0] + b * t1[0] + c * p2[0] + d * t2[0], a * p1[1] + b * t1[1] + c * p2[1] + d * t2[1]]);
    }
  }
  return out.filter((p, i) => { const q = out[(i + 1) % out.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4; });
}
function outlineGeom(p) {
  return withScope((k) => {
    let m;
    if (p.mode === 'spin') {
      const poly = samplePath(p.prof).map(([x, y]) => [Math.max(0, x), y]);
      m = k(k(new CSec([poly], 'NonZero')).revolve(96));
    } else {
      const polys = [p.pts, ...(p.more || [])].map((c) => samplePath(c));
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of polys.flat()) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const tw = clamp(p.twist || 0, -720, 720), sc = clamp(p.topScale ?? 100, 0, 400) / 100;
      // Extra parts use even-odd filling, so a part inside another one becomes a hole in it.
      const cs = k(new CSec(polys.map((q) => q.map(([x, y]) => [x - cx, y - cy])), polys.length > 1 ? 'EvenOdd' : 'NonZero'));
      m = k(cs.extrude(clamp(p.height, 0.2, 500), tw ? Math.ceil(Math.abs(tw) / 4) : 0, tw, [sc, sc]));
    }
    if (!m.numTri()) throw new Error('empty outline');
    return manifoldToGeom(m);
  });
}
MAKERS.outline = { label: 'Custom shape', build: outlineGeom };
MAKER_DEFAULTS.outline = { mode: 'extrude', pts: OUTLINE_TEMPLATES.extrude.House, prof: OUTLINE_TEMPLATES.spin.Cup, height: 10, twist: 0, topScale: 100 };
const DRAW_BIN = [
  { key: 'draw', label: 'Draw outline', spec: () => ({ type: 'outline', p: structuredClone(MAKER_DEFAULTS.outline) }) },
  { key: 'spin', label: 'Spin a profile', spec: () => ({ type: 'outline', p: { ...structuredClone(MAKER_DEFAULTS.outline), mode: 'spin' } }) },
];
// Footprints of basic shapes, for "Edit as dots". Coordinates are printer X/Y, any scale.
const DOT_SOURCES = {
  box: () => [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]],
  rbox: () => { const r = 0.24, a = 1 - r, pts = []; for (const [sx, sy, c] of [[1, -1, -45], [1, 1, 45], [-1, 1, 135], [-1, -1, 225]]) for (const [da, sm] of [[-45, 0], [0, 1], [45, 0]]) { const t = (c + da) * DEG; pts.push([sx * a + r * Math.cos(t), sy * a + r * Math.sin(t), sm]); } return pts; },
  cylinder: () => ring(8, 1, true),
  hexagon: () => Array.from({ length: 6 }, (_, i) => [Math.sin((i * 60 * Math.PI) / 180), -Math.cos((i * 60 * Math.PI) / 180), 0]),
  star: () => ring(10, 1, false).map(([x, y], i) => [x * (i % 2 ? 0.45 : 1), y * (i % 2 ? 0.45 : 1), 0]),
  heart: () => OUTLINE_TEMPLATES.extrude.Heart,
  tube: null,
};
function fitPts(pts, w, d) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of samplePath(pts)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return pts.map(([x, y, s]) => [round(((x - (x0 + x1) / 2) / (x1 - x0)) * w, 0.01), round(((y - (y0 + y1) / 2) / (y1 - y0)) * d, 0.01), s]);
}
