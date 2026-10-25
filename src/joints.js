// ---------- joints: ways to connect separate printed pieces ----------
// Each joint is a matching pair of small blocks, printed side by side with the joining faces facing each other.
// Every shape is extruded straight up (Z), so both halves print flat with no supports.
// Assembly: slide B toward A (along -Y) for pegs, snap tabs and finger joints; slide B down over A (along Z)
// for dovetails, T-slots, tongue and groove and puzzle joints.
const grow = (poly, e) => poly.map(([x, y]) => [x + Math.sign(x) * e, y]);

function dovetailPoly(p, e, ang) {
  // Narrow neck at the block, wider tip. e grows it for the matching slot.
  const rw = p.rw, tl = p.tl, tw = rw + 2 * tl * Math.tan(ang * DEG);
  return [[-rw / 2 - e, -1], [rw / 2 + e, -1], [rw / 2 + e, 0], [tw / 2 + e, tl + e], [-tw / 2 - e, tl + e], [-rw / 2 - e, 0]];
}
function teePoly(p, e) {
  const sw = p.sw / 2 + e, cw = p.cw / 2 + e, tl = p.tl + e, ct = p.ct;
  return [[-sw, -1], [sw, -1], [sw, tl - ct - e], [cw, tl - ct - e], [cw, tl], [-cw, tl], [-cw, tl - ct - e], [-sw, tl - ct - e]];
}
function puzzleParts(p, e) {
  // A round head on a narrow neck, like a jigsaw piece. Returns [neck polygon, head polygon].
  const r = p.hr + e, nw = p.nw / 2 + e, cy = p.tl - p.hr, pts = [];
  for (let i = 0; i < 40; i++) { const a = (i / 40) * 2 * Math.PI; pts.push([r * Math.cos(a), cy + r * Math.sin(a)]); }
  return [[[-nw, -1], [nw, -1], [nw, cy], [-nw, cy]], pts];
}

function buildJoint(p) {
  return withScope((k) => {
    const kind = p.kind, tol = clamp(p.tol, 0.1, 1), h = clamp(p.h, 4, 120), W = clamp(p.w, 10, 150);
    const feat = kind === 'fingers' ? p.fl : kind === 'peg' ? p.pl : kind === 'snap' ? p.L : p.tl;
    const D = Math.max(clamp(p.d, 4, 80), kind === 'snap' ? p.L + 6 : kind === 'peg' ? p.pl + 3 : feat + 3);
    const sep = feat + 8;
    const A = [slab(k, -W / 2, W / 2, -D, 0, 0, h)], cuts = [];
    let B = slab(k, -W / 2, W / 2, sep, sep + D, 0, h);
    const fromPoly = (poly) => ext(k, poly, h + 2, -1);
    if (kind === 'dovetail' || kind === 'tongue') {
      const ang = kind === 'tongue' ? 0 : clamp(p.ang, 5, 35);
      const rw = clamp(p.rw, 3, W / 2), tl = clamp(p.tl, 2, 40);
      const q = { rw, tl };
      A.push(k(ext(k, dovetailPoly(q, 0, ang), h)));
      cuts.push(fromPoly(dovetailPoly(q, tol / 2, ang).map(([x, y]) => [x, y + sep])));
    } else if (kind === 'tee') {
      const q = { sw: clamp(p.sw, 2, W / 2), cw: clamp(p.cw, p.sw + 3, W - 4), tl: clamp(p.tl, 4, 40), ct: clamp(p.ct, 1.2, 10) };
      A.push(k(ext(k, teePoly(q, 0), h)));
      cuts.push(fromPoly(teePoly(q, tol / 2).map(([x, y]) => [x, y + sep])));
    } else if (kind === 'puzzle') {
      const q = { hr: clamp(p.hr, 2, 20), nw: clamp(p.nw, 1.5, 20), tl: clamp(p.tl, 5, 50) };
      q.nw = Math.min(q.nw, q.hr * 1.6);
      for (const poly of puzzleParts(q, 0)) A.push(k(ext(k, poly, h)));
      for (const poly of puzzleParts(q, tol / 2)) cuts.push(fromPoly(poly.map(([x, y]) => [x, y + sep])));
    } else if (kind === 'fingers') {
      const n = clamp(Math.round(p.n), 2, 12), seg = h / n, fl = clamp(p.fl, 2, 40);
      const bs = [B];
      for (let i = 0; i < n; i++) {
        const z0 = i * seg, z1 = (i + 1) * seg;
        if (i % 2 === 0) A.push(slab(k, -W / 2, W / 2, -0.5, fl, z0 + (i ? tol / 2 : 0), z1 - (i < n - 1 ? tol / 2 : 0)));
        else bs.push(slab(k, -W / 2, W / 2, sep - fl, sep + 0.5, z0 + tol / 2, z1 - (i < n - 1 ? tol / 2 : 0)));
      }
      B = k(MF.union(bs));
    } else if (kind === 'peg') {
      const n = clamp(Math.round(p.n), 1, 8), r = clamp(p.pegD, 2, Math.min(h - 3, 20)) / 2, pl = clamp(p.pl, 2, 30);
      const z = h / 2, xs = spread(n, W, Math.max(r + 3, 6));
      for (const x of xs) {
        A.push(k(MF.hull([cylY(k, -0.5, pl - 0.8, x, z, r), cylY(k, pl - 0.8, pl, x, z, r - 0.7)])));
        cuts.push(cylY(k, sep - 1, sep + pl + 0.8, x, z, r + tol / 2));
      }
    } else {
      // snap: two springy arms with barbs on A; a pocket with a ledge on B.
      const L = clamp(p.L, 8, 40), at = clamp(p.at, 0.8, 4), bd = clamp(p.bd, 0.4, 3), pw = clamp(p.pw, at * 2 + bd * 2 + 2, W - 2 * bd - 2), bl = Math.max(2.5, bd * 2.5);
      const arm = (s) => {
        const o = s * pw / 2, i = s * (pw / 2 - at);
        return s > 0 ? [[i, -0.5], [o, -0.5], [o, L - bl], [o + bd, L - bl], [o, L], [i, L]] : [[o, -0.5], [i, -0.5], [i, L], [o, L], [o - bd, L - bl], [o, L - bl]];
      };
      A.push(k(ext(k, arm(1), h)), k(ext(k, arm(-1), h)));
      const lt = Math.max(1, L - bl - tol), ew = pw / 2 + tol, cwd = pw / 2 + bd + tol;
      cuts.push(fromPoly([[-ew, sep - 1], [ew, sep - 1], [ew, sep + lt + 0.01], [-ew, sep + lt + 0.01]]));
      cuts.push(fromPoly([[-cwd, sep + lt], [cwd, sep + lt], [cwd, sep + L + tol + 0.8], [-cwd, sep + L + tol + 0.8]]));
    }
    if (cuts.length) B = k(B.subtract(unionAll(k, cuts)));
    return manifoldToGeom(k(MF.union([unionAll(k, A), B])));
  });
}

const JOINT_DEFAULTS = {
  dovetail: { kind: 'dovetail', w: 30, d: 12, h: 12, rw: 8, tl: 6, ang: 15, tol: 0.3 },
  tongue: { kind: 'tongue', w: 30, d: 12, h: 12, rw: 8, tl: 5, tol: 0.3 },
  tee: { kind: 'tee', w: 30, d: 12, h: 12, sw: 5, cw: 11, tl: 6, ct: 2.4, tol: 0.3 },
  puzzle: { kind: 'puzzle', w: 30, d: 12, h: 12, hr: 3.5, nw: 4, tl: 8, tol: 0.3 },
  fingers: { kind: 'fingers', w: 30, d: 8, h: 25, n: 5, fl: 6, tol: 0.3 },
  peg: { kind: 'peg', w: 30, d: 10, h: 14, n: 2, pegD: 5, pl: 6, tol: 0.3 },
  snap: { kind: 'snap', w: 30, d: 20, h: 12, pw: 12, at: 1.6, bd: 1, L: 12, tol: 0.3 },
};
MAKERS.joint = { label: 'Joint', build: buildJoint };
HW_DEFAULTS.joint = JOINT_DEFAULTS;
const JOINT_KINDS = [['dovetail', 'Dovetail'], ['tongue', 'Tongue and groove'], ['tee', 'T-slot'], ['puzzle', 'Puzzle (jigsaw) joint'], ['fingers', 'Finger joint'], ['peg', 'Pegs and holes'], ['snap', 'Snap tabs']];
const JOINT_NOTES = {
  dovetail: 'The narrow neck and wide tip lock the pieces together sideways, so they only come apart by sliding. Slide piece B down over the tail of piece A. Great for drawers and sliding lids.',
  tongue: 'A square tongue that slides into a groove. It lines pieces up and holds them flat, but does not lock sideways, so add glue or screws.',
  tee: 'A T-shaped tail that slides into a T-shaped slot. It locks sideways like a dovetail and is very easy to print.',
  puzzle: 'A round head on a narrow neck, like a jigsaw piece. Slide piece B down over the head. Good for tiles and big models you print in parts.',
  fingers: 'Fingers that interleave like a box joint. Push the two pieces together along their length. Good for corners and for joining big flat parts. Glue makes it very strong.',
  peg: 'Round pegs on one piece push into holes on the other. Quick to align, easy to take apart. Use a bigger fit gap for a loose fit, smaller for a snug one.',
  snap: 'Two springy arms with a barb on each end push into a pocket and click behind a ledge. Push the pieces together; they hold until you squeeze the arms in to pull them apart. Print it in PETG or ABS for the longest life.',
};
function jointForm(o) {
  const p = o.p, F = (id, l, u, a, b, s) => [id, l, u, a, b, s];
  const kind = { title: 'Joint type', select: ['kind', JOINT_KINDS], note: JOINT_NOTES[p.kind] };
  const blocks = { title: 'Blocks', fields: [F('w', 'Width', 'mm', 10, 150, 1), F('d', 'Depth each', 'mm', 4, 80, 1), F('h', 'Height', 'mm', 4, 120, 1)], note: 'Two matching blocks, printed side by side. Resize them to suit your project, or group them with your own shapes.' };
  const fit = F('tol', 'Fit gap', 'mm', 0.1, 1, 0.05);
  const by = {
    dovetail: [F('rw', 'Neck width', 'mm', 3, 75, 0.5), F('tl', 'Tail length', 'mm', 2, 40, 0.5), F('ang', 'Angle', '°', 5, 35, 1), fit],
    tongue: [F('rw', 'Tongue width', 'mm', 3, 75, 0.5), F('tl', 'Tongue length', 'mm', 2, 40, 0.5), fit],
    tee: [F('sw', 'Stem width', 'mm', 2, 75, 0.5), F('cw', 'Top width', 'mm', 5, 146, 0.5), F('tl', 'Length', 'mm', 4, 40, 0.5), F('ct', 'Top thickness', 'mm', 1.2, 10, 0.1), fit],
    puzzle: [F('hr', 'Head radius', 'mm', 2, 20, 0.5), F('nw', 'Neck width', 'mm', 1.5, 20, 0.5), F('tl', 'Length', 'mm', 5, 50, 0.5), fit],
    fingers: [F('n', 'Fingers', '', 2, 12, 1), F('fl', 'Finger length', 'mm', 2, 40, 0.5), fit],
    peg: [F('n', 'Pegs', '', 1, 8, 1), F('pegD', 'Peg size', 'mm', 2, 20, 0.5), F('pl', 'Peg length', 'mm', 2, 30, 0.5), fit],
    snap: [F('pw', 'Arms width', 'mm', 6, 140, 1), F('L', 'Arm length', 'mm', 8, 40, 1), F('at', 'Arm thickness', 'mm', 0.8, 4, 0.1), F('bd', 'Barb depth', 'mm', 0.4, 3, 0.1), fit],
  }[p.kind];
  return [kind, blocks, { title: 'The joint', fields: by, note: p.kind === 'snap' ? 'Too stiff? Make the arms longer or thinner. Pops apart? Make the barbs deeper.' : 'Too tight? Make the fit gap bigger. Too loose? Make it smaller.' }];
}
const JOINT_BIN = JOINT_KINDS.map(([kind, label]) => ({ key: 'j' + kind, label: label.replace(' (jigsaw) joint', '').replace('Pegs and holes', 'Pegs & holes'), spec: () => ({ type: 'joint', p: { ...JOINT_DEFAULTS[kind] } }) }));
