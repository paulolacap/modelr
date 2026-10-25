// ---------- hardware: hinges and locks ----------
// Same frame as the storage makers: mm, Z up, centred on X/Y, bottom at Z = 0.
const ext = (k, poly, h, z0 = 0) => k(k(k(new CSec([ccw(poly)])).extrude(h)).translate([0, 0, z0]));
const cone = (k, x, y, z0, z1, r0, r1) => k(k(MF.cylinder(z1 - z0, r0, r1, 40)).translate([x, y, z0]));
const above = (k, m) => k(m.intersect(slab(k, -1000, 1000, -1000, 1000, 0, 1000)));

function screwCuts(k, xs, y, t, d, sink) {
  // Through holes from the top face down, with an optional 90° countersink.
  const out = [];
  for (const x of xs) {
    out.push(cylZ(k, x, y, -1, t + 1, d / 2));
    if (sink) { const cs = Math.min(d * 0.45, t - 0.6); if (cs > 0.2) out.push(cone(k, x, y, t - cs, t + 0.01, d / 2, d / 2 + cs + 0.01)); }
  }
  return out;
}
const spread = (n, w, margin) => (n <= 1 ? [0] : Array.from({ length: n }, (_, i) => -w / 2 + margin + ((w - 2 * margin) * i) / (n - 1)));

// Knuckles along X around an axis at y = 0. Leaf A is on -Y, leaf B on +Y.
// pin 'printed': the pin belongs to A and turns inside B (print in place).
// pin 'hole': every knuckle has a hole for a filament or nail pin.
function knuckleHinge(k, o) {
  const { w, la, lb, t, tol } = o;
  const r = Math.max(o.kd / 2, t / 2 + 0.6), n = Math.max(3, Math.round(o.n) | 1);
  const zc = r - Math.min(0.6, r * 0.15), g = Math.max(tol, 0.3);
  const seg = (w - (n - 1) * g) / n;
  const A = [], B = [];
  A.push(rrPrism(k, w, la - (r + tol), 1.5, 0, t, 0, -(la + r + tol) / 2));
  B.push(rrPrism(k, w, lb - (r + tol), 1.5, 0, t, 0, (lb + r + tol) / 2));
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + i * (seg + g), x1 = x0 + seg, a = i % 2 === 0;
    const bridge = a ? slab(k, x0, x1, -(r + tol + 1), 0, 0, t) : slab(k, x0, x1, 0, r + tol + 1, 0, t);
    (a ? A : B).push(k(MF.hull([cylX(k, x0, x1, 0, zc, r), bridge])));
  }
  let mA = unionAll(k, A), mB = unionAll(k, B);
  if (o.pin === 'printed') {
    const pr = Math.min(o.pinD / 2, r - tol - 0.8);
    mA = k(MF.union([mA, cylX(k, -w / 2, w / 2, 0, zc, pr)]));
    mB = k(mB.subtract(cylX(k, -w / 2 - 1, w / 2 + 1, 0, zc, pr + tol)));
  } else {
    const hr = Math.min((o.pinD + tol) / 2, r - 0.8);
    mA = k(mA.subtract(cylX(k, -w / 2 - 1, w / 2 + 1, 0, zc, hr)));
    mB = k(mB.subtract(cylX(k, -w / 2 - 1, w / 2 + 1, 0, zc, hr)));
  }
  return { A: mA, B: mB, r, zc };
}

function buildHinge(p) {
  return withScope((k) => {
    const w = clamp(p.w, 10, 300), t = clamp(p.t, 1, 8), tol = clamp(p.tol ?? 0.4, 0.1, 1);
    if (p.kind === 'living') {
      const ht = clamp(p.ht, 0.3, 1.5), hl = clamp(p.hl, 1, 10), l = clamp(p.leaf, 5, 200);
      const a = rrPrism(k, w, l, 1.5, 0, t, 0, -hl / 2 - l / 2), b = rrPrism(k, w, l, 1.5, 0, t, 0, hl / 2 + l / 2);
      return manifoldToGeom(k(MF.union([a, b, slab(k, -w / 2, w / 2, -hl / 2 - 0.5, hl / 2 + 0.5, 0, ht)])));
    }
    const l = clamp(p.leaf, 6, 200), kd = clamp(p.kd, t + 1.2, 30), d = clamp(p.screwD, 0, 8);
    let A, B, r;
    if (p.kind === 'snap') {
      // Leaf A: two end arms holding a pin. Leaf B (printed beside it): a C-clip that snaps over the pin.
      r = kd / 2;
      const zc = r - Math.min(0.6, r * 0.15), pr = clamp(p.pinD / 2, 1, r - 1.2), arm = clamp(p.armW, 3, w / 3);
      const leafA = rrPrism(k, w, l - r, 1.5, 0, t, 0, -(l + r) / 2);
      const arms = [[-w / 2, -w / 2 + arm], [w / 2 - arm, w / 2]].map(([x0, x1]) => k(MF.hull([cylX(k, x0, x1, 0, zc, r), slab(k, x0, x1, -r - 1, 0, 0, t)])));
      A = k(MF.union([leafA, ...arms, cylX(k, -w / 2 + arm - 0.5, w / 2 - arm + 0.5, 0, zc, pr)]));
      const yB = l + 8 + r, cw = w - 2 * arm - 2 * tol;
      const leafB = rrPrism(k, cw, l - r, 1.5, 0, t, 0, yB + (l + r) / 2);
      const clip = k(MF.hull([cylX(k, -cw / 2, cw / 2, yB, zc, r), slab(k, -cw / 2, cw / 2, yB, yB + r + 1, 0, t)]));
      B = k(k(MF.union([leafB, clip])).subtract(cylX(k, -w, w, yB, zc, pr + tol)));
      B = k(B.subtract(slab(k, -w, w, yB - pr * 0.8, yB + pr * 0.8, zc, zc + r + 2)));
      const xsB = spread(Math.min(p.screws, 3), cw, 7);
      if (d > 0) B = k(B.subtract(unionAll(k, screwCuts(k, xsB, yB + (l + r) / 2, t, d, p.sink))));
    } else {
      const kh = knuckleHinge(k, { w, la: l, lb: l, t, tol, kd, n: p.n, pinD: p.pinD, pin: p.kind === 'pin' ? 'hole' : 'printed' });
      A = kh.A; B = kh.B; r = kh.r;
      if (d > 0) B = k(B.subtract(unionAll(k, screwCuts(k, spread(p.screws, w, 7), (l + r + tol) / 2, t, d, p.sink))));
    }
    if (d > 0) A = k(A.subtract(unionAll(k, screwCuts(k, spread(p.screws, w, 7), -(l + r) / 2, t, d, p.sink))));
    return manifoldToGeom(above(k, k(MF.union([A, B]))));
  });
}

function buildLatch(p) {
  return withScope((k) => {
    const tol = clamp(p.tol ?? 0.3, 0.1, 1), d = clamp(p.screwD ?? 3.5, 0, 8);
    let parts = [];
    if (p.kind === 'snap') {
      // Drawn as an outline in X/Y and pushed up by the clip width, so the arm bends along its layers.
      const w = clamp(p.w, 4, 60), L = clamp(p.L, 8, 80), at = clamp(p.at, 0.8, 5), bd = clamp(p.bd, 0.4, 4), bl = Math.max(bd * 2, 3);
      const base = ext(k, [[-7, 0], [0.5, 0], [0.5, at + bd + 4], [-7, at + bd + 4]], w);
      const arm = ext(k, [[0, 0], [L, 0], [L, at], [0, at]], w);
      const barb = ext(k, [[L - bl, at - 0.01], [L, at - 0.01], [L, at + 0.3], [L - bl, at + bd]], w);
      let hook = k(MF.union([base, arm, barb]));
      if (d > 0) hook = k(hook.subtract(cylY(k, -1, at + bd + 5, -3.25, w / 2, d / 2)));
      // The catch, printed beside the hook: the hook's barb rides over its ramp and clicks in behind it.
      const dy = at + bd + 6, y0 = at + bd + tol + dy, xf = L - bl - tol, bl2 = bl * 1.4, cx0 = xf - bl2 - 8;
      const body = ext(k, [[cx0, y0], [L + 2, y0], [L + 2, y0 + 5], [cx0, y0 + 5]], w);
      const tooth = ext(k, [[xf, y0 + 0.01], [xf - bl2, y0 + 0.01], [xf, at + tol + dy]], w);
      let catcher = k(MF.union([body, tooth]));
      if (d > 0) catcher = k(catcher.subtract(cylY(k, y0 - 1, y0 + 6, cx0 + 4, w / 2, d / 2)));
      parts = [hook, catcher];
    } else if (p.kind === 'bolt') {
      // A bolt that slides inside a housing, printed in place, plus a keeper for the other side.
      const hl = clamp(p.hl, 20, 150), bw = clamp(p.bw, 4, 30), bh = clamp(p.bh, 3, 20);
      const side = 4, st = 2, sl = 6, ft = 2.4, fl = 9, kw = 4;
      const yi = bw / 2 + tol, yo = yi + side, top = bh + tol + st;
      const blocks = [slab(k, -hl / 2, hl / 2, -yo, -yi, 0, top), slab(k, -hl / 2, hl / 2, yi, yo, 0, top)];
      const straps = [slab(k, -hl / 2, -hl / 2 + sl, -yo, yo, bh + tol, top), slab(k, hl / 2 - sl, hl / 2, -yo, yo, bh + tol, top)];
      const flanges = [slab(k, -hl / 2, hl / 2, -yo - fl, -yo + 0.5, 0, ft), slab(k, -hl / 2, hl / 2, yo - 0.5, yo + fl, 0, ft)];
      let housing = k(MF.union([...blocks, ...straps, ...flanges]));
      if (d > 0) housing = k(housing.subtract(unionAll(k, [-1, 1].flatMap((s) => screwCuts(k, spread(2, hl, 6), s * (yo + fl / 2), ft, d, p.sink)))));
      const x0 = -hl / 2 - 3, x1 = hl / 2 + 3, kx = -hl / 2 + sl + tol + kw / 2;
      const bolt = k(MF.union([slab(k, x0, x1, -bw / 2, bw / 2, 0, bh), slab(k, kx - kw / 2, kx + kw / 2, -bw / 2, bw / 2, bh - 0.5, top + 6)]));
      // Keeper: a little bridge the bolt slides into, printed past the end of the bolt.
      const kx0 = x1 + 4, kl = 10;
      const keeper0 = k(MF.union([slab(k, kx0, kx0 + kl, -yo, yo, 0, top), slab(k, kx0, kx0 + kl, -yo - fl, yo + fl, 0, ft)]));
      let keeper = k(keeper0.subtract(slab(k, kx0 - 1, kx0 + kl + 1, -yi, yi, -1, bh + tol)));
      if (d > 0) keeper = k(keeper.subtract(unionAll(k, [-1, 1].flatMap((s) => screwCuts(k, [kx0 + kl / 2], s * (yo + fl / 2), ft, d, p.sink)))));
      parts = [housing, bolt, keeper];
    } else if (p.kind === 'hasp') {
      // A hinged flap with a slot, and a staple with a loop for a padlock.
      const w = clamp(p.w, 16, 120), t = clamp(p.t, 1.6, 6), sw = clamp(p.sw, 3, 30), sh = Math.max(clamp(p.sh, 4, 40), sw / 2 + 1);
      const lt = 4, lw = 3, ow = sw + 2 * lw, bt = 3;
      const lb = Math.max(clamp(p.lb, 25, 200), lt + 26), la = clamp(p.la, 10, 100);
      const kh = knuckleHinge(k, { w, la, lb, t, tol, kd: t + 4, n: 3, pinD: Math.min(3, t + 0.6), pin: 'printed' });
      const ys = lb - 9, slot = rrPrism(k, ow + 2 * tol + 0.6, lt + 2 * tol + 0.6, 1, -1, t + 1, 0, ys);
      let B = k(kh.B.subtract(slot)), A = kh.A;
      if (d > 0) {
        A = k(A.subtract(unionAll(k, screwCuts(k, spread(2, w, 6), -(la + kh.r) / 2, t, d, p.sink))));
        B = k(B.subtract(unionAll(k, screwCuts(k, spread(2, w, 6), (kh.r + ys - lt) / 2, t, d, p.sink))));
      }
      const tab = rrPrism(k, Math.min(w, 20), 6, 2, 0, t, 0, lb + 2);
      // Staple sits beside the hasp, its loop standing up.
      const sy = lb + 20, hz0 = bt + t + 0.8, oh = hz0 + sh + 3;
      const plate = rrPrism(k, ow + 26, lt + 12, 3, 0, bt, 0, sy);
      const loop = k(MF.hull([slab(k, -ow / 2, ow / 2, sy - lt / 2, sy + lt / 2, 0, oh - ow / 2), cylY(k, sy - lt / 2, sy + lt / 2, 0, oh - ow / 2, ow / 2)]));
      const hole = k(MF.hull([slab(k, -sw / 2, sw / 2, sy - lt, sy + lt, hz0, hz0 + sh - sw / 2), cylY(k, sy - lt, sy + lt, 0, hz0 + sh - sw / 2, sw / 2)]));
      let staple = k(k(MF.union([plate, loop])).subtract(hole));
      if (d > 0) staple = k(staple.subtract(unionAll(k, screwCuts(k, [-(ow / 2 + 7), ow / 2 + 7], sy, bt, d, p.sink))));
      parts = [above(k, k(MF.union([A, B, tab]))), staple];
    } else if (p.kind === 'magnet') {
      // Two blocks with a pocket for a round magnet each.
      const md = clamp(p.md, 2, 30), mh = clamp(p.mh, 1, 15), bh = Math.max(clamp(p.bh, 2, 40), mh + 1.2);
      const bl = md + 2 * (d > 0 ? d + 6 : 3), bw = md + 5;
      for (const y of [-(bw / 2 + 3), bw / 2 + 3]) {
        let b = k(rrPrism(k, bl, bw, 2, 0, bh, 0, y).subtract(cylZ(k, 0, y, bh - mh - 0.2, bh + 1, (md + tol) / 2)));
        if (d > 0) b = k(b.subtract(unionAll(k, screwCuts(k, [-(md / 2 + 1.5 + d / 2 + 1.5), md / 2 + 1.5 + d / 2 + 1.5], y, bh, d, p.sink))));
        parts.push(b);
      }
    } else {
      // Turn button: a bar that swivels on one screw, plus a spacer washer.
      const L = clamp(p.L, 15, 150), W = clamp(p.W, 6, Math.min(40, p.L / 2.5)), t = clamp(p.t, 2, 12), sd = clamp(p.sd, 2, 8), sp = clamp(p.spacer, 0, 20);
      let bar = rrPrism(k, L, W, W / 2 - 0.05, 0, t);
      const grip = slab(k, L / 2 - W / 2 - 6, L / 2 - W / 2 - 3, -W / 2 + 1.5, W / 2 - 1.5, t - 0.01, t + 2);
      bar = k(k(MF.union([bar, grip])).subtract(unionAll(k, screwCuts(k, [-L / 2 + W / 2], 0, t, sd, true))));
      parts.push(bar);
      if (sp > 0) parts.push(k(cylZ(k, 0, W / 2 + 4 + W * 0.45, 0, sp, W * 0.45).subtract(cylZ(k, 0, W / 2 + 4 + W * 0.45, -1, sp + 1, sd / 2 + 0.2))));
    }
    return manifoldToGeom(unionAll(k, parts));
  });
}

const HINGE_DEFAULTS = {
  pip: { kind: 'pip', w: 40, leaf: 18, t: 2.4, kd: 7, n: 5, pinD: 3, tol: 0.4, screws: 2, screwD: 3.5, sink: true },
  pin: { kind: 'pin', w: 40, leaf: 18, t: 2.4, kd: 7, n: 5, pinD: 1.75, tol: 0.25, screws: 2, screwD: 3.5, sink: true },
  snap: { kind: 'snap', w: 40, leaf: 18, t: 2.4, kd: 8, pinD: 4, armW: 7, tol: 0.3, screws: 2, screwD: 3.5, sink: true },
  living: { kind: 'living', w: 40, leaf: 20, t: 2, ht: 0.5, hl: 3 },
};
const LATCH_DEFAULTS = {
  snap: { kind: 'snap', w: 10, L: 20, at: 1.6, bd: 1.2, tol: 0.3, screwD: 3.2 },
  bolt: { kind: 'bolt', hl: 40, bw: 8, bh: 5, tol: 0.4, screwD: 3.5, sink: true },
  hasp: { kind: 'hasp', w: 30, la: 16, lb: 55, t: 2.4, sw: 8, sh: 10, tol: 0.4, screwD: 3.5, sink: true },
  magnet: { kind: 'magnet', md: 6, mh: 2, bh: 5, tol: 0.2, screwD: 3, sink: true },
  turn: { kind: 'turn', L: 40, W: 12, t: 4, sd: 4, spacer: 3 },
};
MAKERS.hinge = { label: 'Hinge', build: buildHinge };
MAKERS.latch = { label: 'Lock', build: buildLatch };
const HW_KINDS = {
  hinge: [['pip', 'Print-in-place hinge'], ['pin', 'Filament pin hinge'], ['snap', 'Snap-on hinge'], ['living', 'Living hinge (bendy strip)']],
  latch: [['snap', 'Snap clip'], ['bolt', 'Sliding bolt'], ['hasp', 'Padlock hasp'], ['magnet', 'Magnet catch'], ['turn', 'Turn button']],
};
const HW_DEFAULTS = { hinge: HINGE_DEFAULTS, latch: LATCH_DEFAULTS };
const HW_NOTES = {
  'hinge.pip': 'Prints in one piece, already joined, and swings straight off the plate. If it is stuck, twist it firmly once to break it free. Stuck every time? Make the fit gap bigger.',
  'hinge.pin': 'Prints as two leaves with a hole through the knuckles. Push a piece of 1.75 mm filament (or a nail) through as the pin. Strongest of the three, and you can take it apart.',
  'hinge.snap': 'Prints as two pieces. Press the clip onto the pin until it clicks. Handy when you want to pull a lid off and put it back.',
  'hinge.living': 'A thin strip that bends. Print it flat in PETG or PP for thousands of bends; PLA cracks after a few. Thinner strip = easier to bend.',
  'latch.snap': 'A springy hook and a catch, printed side by side. Fix the hook to the lid and the catch to the box so the hook slides along the catch and clicks in behind its tooth.',
  'latch.bolt': 'The bolt prints already inside its housing. Slide it by the knob. Screw the housing to the door and the keeper to the frame, in line with the bolt.',
  'latch.hasp': 'A hinged flap with a slot, and a loop for a padlock. Screw the flap to the lid and the loop to the box so the loop pokes through the slot.',
  'latch.magnet': 'Two blocks, each with a pocket for a round magnet. Check which way the magnets attract before gluing them in, then screw the blocks to the door and frame.',
  'latch.turn': 'A bar that swivels on one screw to hold a door or lid shut. Put the spacer under it if the bar has to reach over a lip.',
};
function hwForm(o) {
  const p = o.p, key = o.type + '.' + p.kind, F = (id, l, u, a, b, s) => [id, l, u, a, b, s];
  const kind = { title: o.type === 'hinge' ? 'Hinge type' : 'Lock type', select: ['kind', HW_KINDS[o.type]], note: HW_NOTES[key] };
  const fit = F('tol', 'Fit gap', 'mm', 0.1, 1, 0.05);
  const screws = (count) => ({ title: 'Screw holes', checks: p.screwD > 0 ? [['sink', 'Countersunk (flat-head screws sit flush)']] : [], fields: [...(count ? [F('screws', 'Per side', '', 1, 4, 1)] : []), F('screwD', 'Hole size', 'mm', 0, 8, 0.1)], note: 'Set the hole size to 0 for no holes, if you will glue it instead.' });
  if (o.type === 'hinge') {
    if (p.kind === 'living') return [kind, { title: 'Size', fields: [F('w', 'Width', 'mm', 10, 300, 1), F('leaf', 'Each side', 'mm', 5, 200, 1), F('t', 'Thickness', 'mm', 1, 8, 0.1)] },
      { title: 'Bendy strip', fields: [F('ht', 'Strip thickness', 'mm', 0.3, 1.5, 0.05), F('hl', 'Strip length', 'mm', 1, 10, 0.5)], note: 'About 2 to 3 layers thick works best (0.4 to 0.6 mm).' }];
    return [kind, { title: 'Size', fields: [F('w', 'Width', 'mm', 10, 300, 1), F('leaf', 'Each leaf', 'mm', 6, 200, 1), F('t', 'Thickness', 'mm', 1, 8, 0.1)] },
      { title: 'Knuckles', fields: [F('kd', 'Knuckle size', 'mm', 3, 30, 0.5), ...(p.kind === 'snap' ? [F('armW', 'Arm width', 'mm', 3, 40, 0.5)] : [F('n', 'Knuckles', '', 3, 15, 2)]),
        F('pinD', p.kind === 'pin' ? 'Pin you will use' : 'Pin size', 'mm', 1, 10, 0.05), fit],
        note: p.kind === 'pip' ? 'The fit gap is the space around the pin. 0.4 mm suits most printers.' : p.kind === 'pin' ? '1.75 mm filament is the usual pin. The hole is made this size plus the fit gap.' : 'A tighter fit gap clicks harder.' },
      screws(true)];
  }
  if (p.kind === 'snap') return [kind, { title: 'Size', fields: [F('w', 'Width', 'mm', 4, 60, 0.5), F('L', 'Arm length', 'mm', 8, 80, 1), F('at', 'Arm thickness', 'mm', 0.8, 5, 0.1), F('bd', 'Hook depth', 'mm', 0.4, 4, 0.1), fit],
    note: 'Too stiff? Make the arm longer or thinner. Pops open? Make the hook deeper.' }, screws(false)];
  if (p.kind === 'bolt') return [kind, { title: 'Size', fields: [F('hl', 'Housing length', 'mm', 20, 150, 1), F('bw', 'Bolt width', 'mm', 4, 30, 0.5), F('bh', 'Bolt height', 'mm', 3, 20, 0.5), fit], note: 'Bolt stuck after printing? Push the knob firmly once, or make the fit gap bigger.' }, screws(false)];
  if (p.kind === 'hasp') return [kind, { title: 'Size', fields: [F('w', 'Width', 'mm', 16, 120, 1), F('la', 'Hinge side', 'mm', 10, 100, 1), F('lb', 'Flap length', 'mm', 25, 200, 1), F('t', 'Thickness', 'mm', 1.6, 6, 0.1)] },
    { title: 'Padlock loop', fields: [F('sw', 'Opening width', 'mm', 3, 30, 0.5), F('sh', 'Opening height', 'mm', 4, 40, 0.5), fit], note: 'Make the opening a little wider than your padlock\'s shackle.' }, screws(false)];
  if (p.kind === 'magnet') return [kind, { title: 'Magnet', fields: [F('md', 'Magnet width', 'mm', 2, 30, 0.5), F('mh', 'Magnet thickness', 'mm', 1, 15, 0.5), F('bh', 'Block height', 'mm', 2, 40, 0.5), fit], note: 'Measure your magnets. 6 × 2 mm and 10 × 3 mm are common sizes.' }, screws(false)];
  return [kind, { title: 'Size', fields: [F('L', 'Length', 'mm', 15, 150, 1), F('W', 'Width', 'mm', 6, 40, 0.5), F('t', 'Thickness', 'mm', 2, 12, 0.5), F('sd', 'Screw hole', 'mm', 2, 8, 0.1), F('spacer', 'Spacer height', 'mm', 0, 20, 0.5)], note: 'Set the spacer to 0 if you do not need one.' }];
}
const HW_BIN = [
  ...HW_KINDS.hinge.map(([kind, label]) => ({ key: 'h' + kind, label: label.replace(' (bendy strip)', ''), spec: () => ({ type: 'hinge', p: { ...HINGE_DEFAULTS[kind] } }) })),
  ...HW_KINDS.latch.map(([kind, label]) => ({ key: 'l' + kind, label, spec: () => ({ type: 'latch', p: { ...LATCH_DEFAULTS[kind] } }) })),
];
