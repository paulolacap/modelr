// ---------- IKEA Skådis pegboard accessories ----------
// Skådis boards are about 5 mm thick with upright slots 5 mm wide and 15 mm tall (round ends).
// Slots in a row are 40 mm apart; every other column is moved down 20 mm, so the slots form a
// diagonal grid with neighbours 20 mm across and 20 mm down.
// A Skådis peg pushes through a slot, then the part drops down so the stem sits on the bottom of the
// slot and a tab behind the board hooks under it.
const SK = { board: 5, slotW: 5, slotH: 15, pitch: 40, stem: 7, drop: 5, tab: 3 };

// Side view of one peg: x points out of the board (the board's front face is x = 0, its back
// face is x = -5), y points up and the stem sits on the bottom of the slot at y = y0.
function skPegProfile(y0, tol) {
  const L = SK.board + tol + 0.1, T = L + SK.tab, top = y0 + SK.stem, bot = y0 - SK.drop;
  return [[0.6, y0], [-L, y0], [-L, bot], [-T + 0.8, bot], [-T, bot + 0.8], [-T, top - 0.8], [-T + 0.8, top], [0.6, top]];
}
const skPegWidth = (tol) => SK.slotW - 2 * tol;
// Peg columns along a part of width W: one slot pitch apart, centred, kept inside the part.
function skColumns(W, tol) {
  const n = Math.max(1, Math.floor((W - skPegWidth(tol) - 4) / SK.pitch) + 1);
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * SK.pitch);
}

// Hooks print lying on their side: the side view is drawn flat on the plate and pushed up by the
// hook's thickness. That keeps the layers running along the hook (strong) and needs no supports.
// The pegs sit on the plate, the rest of the hook can be thicker.
function skHook(k, p) {
  const tol = clamp(p.tol, 0.1, 0.6), w = clamp(p.w, skPegWidth(tol), 30), pt = clamp(p.pt, 2.4, 10), at = clamp(p.at, 2.4, 12);
  const pegs = clamp(Math.round(p.pegs), 1, 2), drop = clamp(p.drop, 0, 120);
  const pegYs = pegs === 2 ? [0, -SK.pitch] : [0];
  const flat = [], thin = pegYs.map((y) => skPegProfile(y, tol));
  let low;
  if (p.kind === 'uhook') {
    // A round saddle: half a ring under the hook, then a lip up the front.
    const R = clamp(p.R, 4, 80), lip = clamp(p.lip, 0, 80), cx = Math.max(pt, at) + R, cy = -drop, ring = [];
    for (let i = 0; i <= 32; i++) { const a = Math.PI + (Math.PI * i) / 32; ring.push([cx + (R + at) * Math.cos(a), cy + (R + at) * Math.sin(a)]); }
    for (let i = 32; i >= 0; i--) { const a = Math.PI + (Math.PI * i) / 32; ring.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
    flat.push(ring, [[cx + R, cy - 0.01], [cx + R + at, cy - 0.01], [cx + R + at, cy + lip - at / 3], [cx + R + at * 2 / 3, cy + lip], [cx + R, cy + lip]]);
    low = cy - 0.5;
  } else {
    // A straight arm, tilted up by `ang`, with a lip at the end.
    const reach = clamp(p.reach, 8, 200), lip = clamp(p.lip, 0, 60), a = clamp(p.ang, 0, 45) * DEG;
    const rot = ([x, y]) => [x * Math.cos(a) - y * Math.sin(a), -drop + x * Math.sin(a) + y * Math.cos(a)];
    flat.push([[-0.5, 0], [reach, 0], [reach, at], [-0.5, at]].map(rot));
    if (lip > 0) flat.push([[reach - at, at - 0.01], [reach, at - 0.01], [reach, at + lip - at / 3], [reach - at / 3, at + lip], [reach - at, at + lip]].map(rot));
    const g = Math.min(8, reach / 3);
    flat.push([[pt - 0.5, at - 0.01], [pt + g, at - 0.01], [pt - 0.5, at + g]].map(rot));
    low = -drop - 0.5;
  }
  const bottom = Math.min(low, pegYs[pegYs.length - 1] - SK.drop - 2);
  flat.push([[0, bottom], [pt, bottom], [pt, SK.stem + 3], [0, SK.stem + 3]]);
  const parts = flat.map((poly) => ext(k, poly, w)).concat(thin.map((poly) => ext(k, poly, skPegWidth(tol))));
  return k(MF.union(parts));
}

// Fit test: one peg on a small tab, so you can check the fit gap before printing something big.
function skTest(k, p) {
  const tol = clamp(p.tol, 0.1, 0.6), pw = skPegWidth(tol);
  return k(MF.union([ext(k, [[0, -SK.drop - 4], [3, -SK.drop - 4], [3, SK.stem + 6], [0, SK.stem + 6]], 10), ext(k, skPegProfile(0, tol), pw)]));
}

// Shelves, bins, holders and cups print standing up, the way they hang. The pegs stick out of the
// back (+Y) near the top. The tab under each peg overhangs, so print with supports from the plate
// (only the hook tips need them). Front is -Y; the back face of the part touches the board at y = 0.
function skPegsBack(k, xs, z0, tol) {
  const pw = skPegWidth(tol), side = skPegProfile(z0, tol).map(([x, y]) => [-x, y]);
  return xs.map((x) => prismX(k, side, x - pw / 2, pw));
}
function skBack(k, W, H, pt) { return slab(k, -W / 2, W / 2, -pt, 0, 0, H); }

function skShelf(k, p) {
  const tol = clamp(p.tol, 0.1, 0.6), W = clamp(p.w, 20, 300), D = clamp(p.d, 10, 200), pt = clamp(p.pt, 2.4, 8);
  const st = clamp(p.st, 2, 10), H = clamp(p.h, SK.stem + 14, 200), lip = clamp(p.lip, 0, 60);
  const parts = [skBack(k, W, H, pt), slab(k, -W / 2, W / 2, -D, 0, 0, st)];
  if (lip > 0) parts.push(slab(k, -W / 2, W / 2, -D, -D + 2.4, 0, st + lip));
  const holes = [];
  if (p.kind === 'holder') {
    // A row of holes (or slots open at the front) for screwdrivers, pliers, brushes, pens.
    const hd = clamp(p.hd, 3, Math.min(60, D - pt - 3)), gap = clamp(p.hg, 2, 60), cy = -pt - (D - pt) / 2;
    const n = Math.max(1, Math.floor((W - 6 + gap) / (hd + gap)));
    const span = (n - 1) * (hd + gap);
    for (let i = 0; i < n; i++) {
      const x = -span / 2 + i * (hd + gap);
      holes.push(cylZ(k, x, cy, -1, st + 1, hd / 2));
      if (p.slots) holes.push(slab(k, x - hd * 0.35, x + hd * 0.35, -D - 1, cy, -1, st + lip + 1));
    }
  }
  // Gussets at both ends hold the shelf level under load.
  const gh = Math.min(H - 2, D * 1.2);
  if (gh > st + 2) for (const s of [-1, 1]) {
    const x0 = s < 0 ? -W / 2 : W / 2 - 3;
    parts.push(prismX(k, [[0, st - 0.01], [-(D - 2), st - 0.01], [-(D - 2), st + 2], [0, gh]], x0, 3));
  }
  parts.push(...skPegsBack(k, skColumns(W, tol), H - SK.stem - 3, tol));
  let m = k(MF.union(parts));
  if (holes.length) m = k(m.subtract(unionAll(k, holes)));
  return m;
}

function skBin(k, p) {
  const tol = clamp(p.tol, 0.1, 0.6), W = clamp(p.w, 20, 300), D = clamp(p.d, 10, 200), H = clamp(p.h, SK.stem + 14, 250);
  const wall = clamp(p.wall, 0.8, Math.min(W, D) / 4), floor = clamp(p.floor, 0.6, 6), r = clamp(p.radius, 0, Math.min(W, D) / 2 - 0.1);
  const front = clamp(p.front, 20, 100) / 100;
  const outer = k(MF.union([rrPrism(k, W, D, r, 0, H, 0, -D / 2), slab(k, -W / 2, W / 2, -D / 2, 0, 0, H)]));
  const ir = Math.max(0, r - wall), iw = W - 2 * wall, id = D - 2 * wall;
  const inner = k(MF.union([rrPrism(k, iw, id, ir, floor, H + 1, 0, -D / 2), slab(k, -iw / 2, iw / 2, -D / 2, -wall, floor, H + 1)]));
  const cuts = [inner];
  if (front < 1) {
    // Lower the front wall so things are easy to grab; it slopes up to full height at the back.
    const fz = Math.max(floor + 2, H * front);
    cuts.push(prismX(k, [[-D - 1, fz], [-D - 1, H + 1], [-wall - 2, H + 1], [-D * 0.45, fz]], -W / 2 - 1, W + 2));
  }
  let m = k(outer.subtract(unionAll(k, cuts)));
  const n = clamp(Math.round(p.cols), 1, 12), dt = clamp(p.divT, 0.6, 4), parts = [m];
  for (let i = 1; i < n; i++) { const x = -iw / 2 + (iw * i) / n; parts.push(slab(k, x - dt / 2, x + dt / 2, -D + wall / 2, -wall / 2, 0, Math.max(floor + 2, H * front - 1))); }
  parts.push(...skPegsBack(k, skColumns(W, tol), H - SK.stem - 3, tol));
  return k(MF.union(parts));
}

function skCup(k, p) {
  const tol = clamp(p.tol, 0.1, 0.6), Dc = clamp(p.dia, 15, 200), H = clamp(p.h, SK.stem + 14, 250);
  const wall = clamp(p.wall, 0.8, Dc / 4), floor = clamp(p.floor, 0.6, 6), pt = 3;
  const W = Math.max(Dc * 0.7, skPegWidth(tol) + 10), cy = -pt - Dc / 2 + wall;
  const body = k(MF.union([skBack(k, W, H, pt), cylZ(k, 0, cy, 0, H, Dc / 2)]));
  const m = k(body.subtract(cylZ(k, 0, cy, floor, H + 1, Dc / 2 - wall)));
  const cuts = [];
  if (p.drain) cuts.push(cylZ(k, 0, cy, -1, floor + 1, Math.min(4, Dc / 2 - wall - 1)));
  const out = cuts.length ? k(m.subtract(unionAll(k, cuts))) : m;
  return k(MF.union([out, ...skPegsBack(k, skColumns(W, tol), H - SK.stem - 3, tol)]));
}

// A piece of Skådis-style pegboard, printed flat with the front face down.
function skBoard(k, p) {
  const W = clamp(p.w, 30, 400), H = clamp(p.h, 30, 400), t = clamp(p.t, 3, 10), m = 4;
  const slots = [];
  const nx = Math.floor((W / 2 - m - SK.slotW / 2) / 20), ny = Math.floor((H / 2 - m - SK.slotH / 2) / 20);
  for (let i = -nx; i <= nx; i++) for (let j = -ny; j <= ny; j++) {
    if ((i + j) % 2 !== 0) continue;
    slots.push(ext(k, stadium(SK.slotH, SK.slotW, 20 * j, 20 * i).map(([a, b]) => [b, a]), t + 2, -1));
  }
  const parts = [rrPrism(k, W, H, 3, 0, t)];
  const holes = [...slots];
  const sh = clamp(p.stand, 0, 40);
  if (p.screws || sh > 0) {
    // Corner screw holes; with spacers they go through standoffs on the back that keep the board off the wall.
    const cx = W / 2 - 10, cyy = H / 2 - 10;
    for (const [x, y] of [[-cx, -cyy], [cx, -cyy], [-cx, cyy], [cx, cyy]]) {
      if (sh > 0) parts.push(cylZ(k, x, y, t - 0.01, t + sh, 6));
      holes.push(cylZ(k, x, y, -1, t + sh + 1, 2.1), cone(k, x, y, -0.01, 2, 4.2, 2.1));
    }
  }
  return k(k(MF.union(parts)).subtract(unionAll(k, holes)));
}

function buildSkadis(p) {
  return withScope((k) => {
    const fn = { hook: skHook, uhook: skHook, shelf: skShelf, holder: skShelf, bin: skBin, cup: skCup, board: skBoard, test: skTest }[p.kind] || skHook;
    return manifoldToGeom(fn(k, p));
  });
}

const SKADIS_DEFAULTS = {
  hook: { kind: 'hook', reach: 40, lip: 10, ang: 10, at: 5, pt: 4, w: 8, drop: 20, pegs: 1, tol: 0.3 },
  uhook: { kind: 'uhook', R: 15, lip: 12, at: 5, pt: 4, w: 10, drop: 25, pegs: 2, tol: 0.3 },
  shelf: { kind: 'shelf', w: 120, d: 60, h: 40, pt: 4, st: 3, lip: 6, tol: 0.3 },
  holder: { kind: 'holder', w: 120, d: 40, h: 30, pt: 4, st: 5, lip: 0, hd: 8, hg: 6, slots: false, tol: 0.3 },
  bin: { kind: 'bin', w: 80, d: 50, h: 60, wall: 1.6, floor: 1.6, radius: 4, front: 60, cols: 1, divT: 1.2, tol: 0.3 },
  cup: { kind: 'cup', dia: 60, h: 90, wall: 1.6, floor: 1.6, drain: false, tol: 0.3 },
  board: { kind: 'board', w: 200, h: 160, t: 5, screws: true, stand: 0 },
  test: { kind: 'test', tol: 0.3 },
};
MAKERS.skadis = { label: 'Skådis', build: buildSkadis };
HW_DEFAULTS.skadis = SKADIS_DEFAULTS;
const SKADIS_KINDS = [['hook', 'Hook'], ['uhook', 'Big U hook (cables, headphones)'], ['shelf', 'Shelf'], ['holder', 'Tool holder'], ['bin', 'Bin'], ['cup', 'Round cup'], ['board', 'Pegboard tile'], ['test', 'Fit test peg']];
const SK_SIDE = 'Prints lying on its side, so it needs no supports and the layers run along the hook, which makes it strong.';
const SK_UP = 'Prints standing up, the way it hangs. Turn on supports "on build plate only" in your slicer: only the little tabs under the hooks need them.';
const SKADIS_NOTES = {
  hook: 'A hook with a lip so things do not slide off. Push the peg through a slot, then let it drop down. ' + SK_SIDE,
  uhook: 'A deep round hook for cables, headphones, hoses and straps. Two pegs (one slot above the other, 40 mm apart) make it steady. ' + SK_SIDE,
  shelf: 'A flat shelf with a front lip and braces at both ends. The pegs are one slot apart (40 mm), as many as fit the width. ' + SK_UP,
  holder: 'A shelf with a row of holes for screwdrivers, pliers, brushes or pens. Tick "Open at the front" to slide tools in from the front. ' + SK_UP,
  bin: 'An open bin with a low front so things are easy to grab. ' + SK_UP,
  cup: 'A round cup for pens, brushes or tools. ' + SK_UP,
  board: 'Print your own piece of Skådis-style pegboard: 5 mm thick with the same slot pattern, so every Skådis accessory fits. It prints flat with no supports. Add spacers to keep it off the wall so the hooks have room behind it.',
  test: 'One peg on a small tab. Print it first and try it in your board: it should push in and drop down without forcing. Too tight? Make the fit gap bigger. Wobbly? Make it smaller. Then use the same fit gap on everything else.',
};
function skadisForm(o) {
  const p = o.p, F = (id, l, u, a, b, s) => [id, l, u, a, b, s];
  const kind = { title: 'Skådis part', select: ['kind', SKADIS_KINDS], note: SKADIS_NOTES[p.kind] };
  const fit = { title: 'Fit', fields: [F('tol', 'Fit gap', 'mm', 0.1, 0.6, 0.05)], note: 'Space on each side of the peg in the 5 mm slot. 0.3 mm suits most printers.' };
  const by = {
    hook: [{ title: 'Hook', fields: [F('reach', 'Reach', 'mm', 8, 200, 1), F('lip', 'Lip height', 'mm', 0, 60, 1), F('ang', 'Tilt up', '°', 0, 45, 1), F('at', 'Arm thickness', 'mm', 2.4, 12, 0.5), F('w', 'Width', 'mm', 4.4, 30, 0.5), F('drop', 'Arm below peg', 'mm', 0, 120, 1)] },
      { title: 'Pegs', fields: [F('pegs', 'Pegs', '', 1, 2, 1), F('pt', 'Back thickness', 'mm', 2.4, 10, 0.5)], note: 'Two pegs use the slot 40 mm below as well, for heavy things.' }],
    uhook: [{ title: 'Hook', fields: [F('R', 'Inside radius', 'mm', 4, 80, 1), F('lip', 'Front lip', 'mm', 0, 80, 1), F('at', 'Thickness', 'mm', 2.4, 12, 0.5), F('w', 'Width', 'mm', 4.4, 30, 0.5), F('drop', 'Below peg', 'mm', 0, 120, 1)] },
      { title: 'Pegs', fields: [F('pegs', 'Pegs', '', 1, 2, 1), F('pt', 'Back thickness', 'mm', 2.4, 10, 0.5)] }],
    shelf: [{ title: 'Size', fields: [F('w', 'Width', 'mm', 20, 300, 1), F('d', 'Depth', 'mm', 10, 200, 1), F('h', 'Back height', 'mm', 21, 200, 1), F('st', 'Shelf thickness', 'mm', 2, 10, 0.5), F('lip', 'Front lip', 'mm', 0, 60, 1), F('pt', 'Back thickness', 'mm', 2.4, 8, 0.5)] }],
    holder: [{ title: 'Size', fields: [F('w', 'Width', 'mm', 20, 300, 1), F('d', 'Depth', 'mm', 10, 200, 1), F('h', 'Back height', 'mm', 21, 200, 1), F('st', 'Shelf thickness', 'mm', 2, 10, 0.5), F('pt', 'Back thickness', 'mm', 2.4, 8, 0.5)] },
      { title: 'Holes', checks: [['slots', 'Open at the front']], fields: [F('hd', 'Hole size', 'mm', 3, 60, 0.5), F('hg', 'Space between', 'mm', 2, 60, 0.5)], note: 'As many holes as fit the width. Make them 1 mm bigger than the tool shaft.' }],
    bin: [{ title: 'Size', fields: [F('w', 'Width', 'mm', 20, 300, 1), F('d', 'Depth', 'mm', 10, 200, 1), F('h', 'Height', 'mm', 21, 250, 1), F('front', 'Front height', '%', 20, 100, 5)] },
      { title: 'Walls', fields: [F('wall', 'Wall', 'mm', 0.8, 6, 0.1), F('floor', 'Floor', 'mm', 0.6, 6, 0.1), F('radius', 'Front corners', 'mm', 0, 30, 0.5), F('cols', 'Compartments', '', 1, 12, 1), F('divT', 'Divider', 'mm', 0.6, 4, 0.1)] }],
    cup: [{ title: 'Size', checks: [['drain', 'Hole in the bottom']], fields: [F('dia', 'Diameter', 'mm', 15, 200, 1), F('h', 'Height', 'mm', 21, 250, 1), F('wall', 'Wall', 'mm', 0.8, 6, 0.1), F('floor', 'Floor', 'mm', 0.6, 6, 0.1)] }],
    board: [{ title: 'Size', fields: [F('w', 'Width', 'mm', 30, 400, 1), F('h', 'Height', 'mm', 30, 400, 1), F('t', 'Thickness', 'mm', 3, 10, 0.5)], note: 'Keep it 5 mm thick so IKEA hooks fit too. Check that it fits your printer bed.' },
      { title: 'Mounting', checks: [['screws', 'Screw holes in the corners']], fields: [F('stand', 'Wall spacers', 'mm', 0, 40, 1)], note: 'Spacers are posts on the back around the screw holes. 10 to 15 mm leaves room for the hooks behind the board. 0 for none.' }],
    test: [],
  }[p.kind] || [];
  return [kind, ...by, p.kind === 'board' ? null : fit].filter(Boolean);
}
const SKADIS_BIN = SKADIS_KINDS.map(([kind, label]) => ({ key: 's' + kind, label: label.replace(' (cables, headphones)', ''), spec: () => ({ type: 'skadis', p: { ...SKADIS_DEFAULTS[kind] } }) }));
