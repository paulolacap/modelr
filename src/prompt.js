// ---------- keyword prompt: type what you want (no AI, runs offline) ----------
// Words the app knows are matched to the generators above; numbers attach to the
// word next to them ("3 x 2 compartments", "walls 2 mm"). Anything else is reported as skipped.
const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, single: 1, pair: 2 };
const STOP = new Set('a an the with and of for to in on my me i want make need please some that has have it its is be which can you could would like something thing made from at each per this into plus also using use x by about around big small little nice simple tiny large out all are as or so very just inside'.split(' '));
const NEGATE = new Set(['no', 'without', 'not', 'none']);
const UNITS = { mm: 1, millimeter: 1, millimeters: 1, millimetre: 1, millimetres: 1, cm: 10, centimeter: 10, centimeters: 10, centimetre: 10, centimetres: 10, in: 25.4, inch: 25.4, inches: 25.4, '"': 25.4 };
// [words, tag]. Longest phrases are tried first.
const KW = [
  // things to make
  ['gridfinity baseplate|gridfinity base|gridfinity plate|baseplate|base plate', 'obj:gfplate'],
  ['gridfinity bin|gridfinity box|gridfinity', 'obj:gridfinity'],
  ['box|bin|container|organizer|organiser|tray|storage|caddy|crate|drawer', 'obj:storage'],
  ['key chain|key ring|keyring|keychain|key fob|keyfob|key tag|name tag|dog tag|tag|fob', 'obj:keychain'],
  ['door sign|name plate|nameplate|sign|plaque|plate|label plate', 'obj:sign'],
  ['coaster', 'obj:coaster'],
  ['letters|lettering|word', 'obj:text'],
  ['cube|block|brick|cuboid|square', 'obj:shape:box'],
  ['rounded box|rounded block|rounded cube', 'obj:shape:rbox'],
  ['cylinder|disc|disk|coin|puck|round', 'obj:shape:cylinder'],
  ['sphere|ball|globe', 'obj:shape:sphere'],
  ['cone', 'obj:shape:cone'],
  ['pyramid', 'obj:shape:pyramid'],
  ['wedge|ramp|door stop|doorstop', 'obj:shape:wedge'],
  ['hexagon|hex', 'obj:shape:hexagon'],
  ['tube|pipe|spacer|sleeve|bushing', 'obj:shape:tube'],
  ['ring|donut|doughnut|torus', 'obj:shape:torus'],
  ['star', 'obj:shape:star'],
  ['heart', 'obj:shape:heart'],
  ['cup|mug|pot|planter|plant pot|pen holder|pencil cup', 'obj:spin:Cup'],
  ['bowl|dish', 'obj:spin:Bowl'],
  ['vase', 'obj:spin:Vase'],
  ['knob|handle knob|drawer knob', 'obj:spin:Knob'],
  ['spinning top|spinner', 'obj:spin:Spinner'],
  ['bead', 'obj:spin:Bead'],
  ['dovetail joint|dovetail|dove tail|dovetails|dovetail slot', 'obj:joint:dovetail'],
  ['tongue and groove|tongue groove|tongue', 'obj:joint:tongue'],
  ['t slot|tee slot|t track|t shaped slot', 'obj:joint:tee'],
  ['puzzle joint|jigsaw joint|jigsaw|puzzle', 'obj:joint:puzzle'],
  ['finger joint|finger joints|box joint|box joints|comb joint|fingers', 'obj:joint:fingers'],
  ['peg joint|pegs and holes|peg and hole|dowel joint|dowels|dowel|pegs|peg', 'obj:joint:peg'],
  ['snap joint|snap tabs|snap tab|snap together|snap fit joint', 'obj:joint:snap'],
  ['joint|joints|connector|connectors|connection', 'obj:joint:dovetail'],
  ['hinge|hinges', 'obj:hinge'],
  ['living hinge|flexible hinge|flex hinge|bendy hinge', 'obj:hinge:living'],
  ['snap clip|snap fit|snap latch|clip|clips|latch|latches|catch', 'obj:latch:snap'],
  ['sliding bolt|slide bolt|barrel bolt|bolt|lock|locks|door lock', 'obj:latch:bolt'],
  ['padlock hasp|hasp|padlock', 'obj:latch:hasp'],
  ['magnet catch|magnetic catch|magnetic latch|magnet latch|magnetic', 'obj:latch:magnet'],
  ['turn button|turn latch|swivel|twist latch|swivel latch', 'obj:latch:turn'],
  // kinds of hinge
  ['print in place|printed in place|onepiece|pip|printed pin|in place', 'k:pip'],
  ['filament pin|filament|nail|pin hinge|removable pin', 'k:pin'],
  ['snap on|snap|clip on|removable|detachable', 'k:snap'],
  ['living|flexible|flex|bendy', 'k:living'],
  // lids and box features
  ['inner hinged lid|inner hinge lid|hidden hinge lid|inner hinge|hidden hinge|invisible hinge|concealed hinge|internal hinge', 'lid:inner'],
  ['snap hinged lid|snap hinge lid|snap on hinged lid|snap fit hinged lid|snap fit hinge lid|snap fit lid|snap on lid hinge|snap lid hinge', 'lid:snaphinge'],
  ['hinged lid|hinge lid|lid with hinge|lid with a hinge|flip lid|flip top', 'lid:hinge'],
  ['sliding lid|slide lid|slide on lid|slide-on lid|sliding top', 'lid:slide'],
  ['push on lid|push lid|press fit lid|friction lid|snap lid|lid|lids|cover', 'lid:friction'],
  ['padlock tab|padlock hole|padlock loop|zip tie tab', 'f:padtab'],
  ['inner clasp|inner snap clasp|inner box snap clasp|hidden clasp|hidden snap clasp|hidden lock|inside clasp|internal clasp|invisible clasp|hidden latch|inner latch|inner lock', 'f:hclasp'],
  ['front clasp|snap clasp|clasp|clasps|lockable', 'f:clasp'],
  ['finger scoop|finger scoops|scoop|scoops|scooped', 'f:scoop'],
  ['finger notch|notch', 'f:notch'],
  ['handle|handles|handle slots|grips', 'f:handles'],
  ['label shelf|labels|label', 'f:label'],
  ['gridfinity inside|gridfinity in the box|gridfinity grid|gridfinity floor|gridfinity baseplate inside|inside gridfinity|gridfinity inner|inner gridfinity|gridfinity base inside', 'f:gfin'],
  ['side lock|side locks|side clasp|side clasps|side latch|side latches|side clips|locking stack|stack lock|stackable lock|side snap|side lock stack', 'f:sidelock'],
  ['stackable|stacking|stack|stacks', 'f:stack'],
  ['magnets|magnet|magnet holes', 'f:magnets'],
  ['half grid|half size|half sized|half size feet|half grid feet|half pitch|half feet', 'f:half'],
  ['stacking lip|lip', 'f:lip'],
  ['rounded|rounded corners|round corners', 'f:rounded'],
  ['sharp corners|square corners|sharp', 'f:sharp'],
  ['engraved|engrave|carved|cut in|sunk|debossed|inset', 'f:engraved'],
  ['raised|embossed|sticking out', 'f:raised'],
  ['countersunk|countersink|flush screws', 'f:sink'],
  ['screw holes|screws|screw|mounting holes|holes', 'f:screws'],
  ['hole|keyring hole|key ring hole|hanging hole|hanger', 'f:hole'],
  ['solid', 'f:solid'],
  // measures (numbers attach to these)
  ['wide|width|across|w', 'm:w'],
  ['deep|depth|long|length|l', 'm:d'],
  ['tall|high|height|h', 'm:h'],
  ['thick|thickness', 'm:t'],
  ['diameter|dia|wide round', 'm:dia'],
  ['wall|walls|wall thickness|sides', 'm:wall'],
  ['floor|bottom', 'm:floor'],
  ['corner|corners|radius', 'm:r'],
  ['compartments|compartment|sections|section|cells|cell|slots|slot|pockets|spaces|grid|divisions', 'm:comp'],
  ['dividers|divider|walls inside', 'm:div'],
  ['units|unit|u', 'm:units'],
  ['knuckles|knuckle', 'm:knuckles'],
  ['pin', 'm:pin'],
  ['gap|tolerance|clearance|fit', 'm:gap'],
  ['size|big|sized', 'm:size'],
  ['shackle|opening', 'm:shackle'],
  // words that introduce text
  ['text|saying|says|that says|reads|reading|named|name|words|with the name|written', 'intro'],
].flatMap(([ws, tag]) => ws.split('|').map((w) => [w.split(' '), tag])).sort((a, b) => b[0].length - a[0].length);

function promptTokens(src) {
  let s = ' ' + src + ' ', quoted = null;
  s = s.replace(/["“”]([^"“”]*[A-Za-z0-9][^"“”]*)["“”]/, (m, t) => { quoted = t.trim(); return ' '; });
  s = s.replace(/[×✕*]/g, ' x ').replace(/(\d)\s*(mm|cm|inches|inch|in|")\s*x\s*(?=\d)/gi, '$1 x ').replace(/one[\s-]piece/gi, ' onepiece ').replace(/\b3d\b/gi, ' ').replace(/(\d)\s*by\s*(?=\d)/gi, '$1 x ')
    .replace(/(\d)(\s*)([a-zA-Z"])/g, '$1 $3').replace(/([a-zA-Z])(\d)/g, '$1 $2').replace(/(\d)\s*x\s*(?=\d)/gi, '$1 x ').replace(/-/g, ' ');
  const toks = [];
  for (const m of s.matchAll(/\d+(?:\.\d+)?|"|[A-Za-z']+/g)) {
    const raw = m[0].replace(/'s$/i, '').replace(/'/g, ''); if (!raw) continue;
    const w = raw.toLowerCase();
    toks.push({ raw, w, num: /^\d/.test(w) ? parseFloat(w) : (NUM_WORDS[w] ?? null), tag: null, used: false });
  }
  return { toks, quoted };
}

function parsePrompt(src) {
  const { toks, quoted } = promptTokens(src);
  // 1. Known words and phrases.
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].used) continue;
    for (const [ws, tag] of KW) {
      if (ws.every((w, j) => toks[i + j] && !toks[i + j].used && (toks[i + j].w === w || (w.length > 2 && j === ws.length - 1 && (toks[i + j].w === w + 's' || toks[i + j].w === w + 'es'))))) {
        if (ws.length === 1 && ws[0].length === 1 && !(toks[i - 1] && toks[i - 1].num != null) && !(toks[i + 1] && toks[i + 1].num != null)) continue; // w, h, l only next to a number
        toks[i].tag = tag; toks[i].span = ws.length;
        for (let j = 0; j < ws.length; j++) toks[i + j].used = true;
        break;
      }
    }
  }
  // "one" and "single" next to a known word are numbers only when they mean a count.
  // 2. Numbers: "120 x 80 x 50 mm" becomes one measure.
  const groups = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.num == null || t.used) continue;
    const g = { vals: [t.num], i0: i, i1: i, unit: null, word: !/^\d/.test(t.w) };
    t.used = true;
    while (toks[g.i1 + 1] && toks[g.i1 + 1].w === 'x' && toks[g.i1 + 2] && /^\d/.test(toks[g.i1 + 2].w)) { g.vals.push(toks[g.i1 + 2].num); toks[g.i1 + 1].used = toks[g.i1 + 2].used = true; g.i1 += 2; }
    const u = toks[g.i1 + 1];
    if (u && UNITS[u.w] != null && !u.used) { g.unit = u.w; g.vals = g.vals.map((v) => v * UNITS[u.w]); u.used = true; g.i1++; }
    groups.push(g); i = g.i1;
  }
  const near = (i, dir) => { for (let j = i + dir, n = 0; j >= 0 && j < toks.length && n < 3; j += dir, n++) { const t = toks[j]; if (t.tag) return t; if (t.num != null || !STOP.has(t.w)) return null; } return null; };
  for (const g of groups) {
    const after = near(g.i1, 1), before = near(g.i0, -1);
    if (after && after.tag.startsWith('m:')) g.role = after.tag.slice(2);
    else if (after && after.tag === 'f:hole') g.role = 'hole';
    else if (after && (after.tag.startsWith('obj:') || after.tag.startsWith('lid:') || after.tag.startsWith('f:')) && !g.unit && g.vals.length === 1) { g.role = 'count'; g.target = after; }
    else if (after && after.tag.startsWith('k:') && !g.unit && g.vals.length === 1 && toks.slice(g.i1 + 1, g.i1 + 8).find((t) => t.tag && t.tag.startsWith('obj:'))) { g.role = 'count'; g.target = toks.slice(g.i1 + 1, g.i1 + 8).find((t) => t.tag && t.tag.startsWith('obj:')); }
    else if (before && before.tag.startsWith('m:') && !(before.countedBy)) { g.role = before.tag.slice(2); before.countedBy = g; }
    else if (before && before.tag === 'f:hole') g.role = 'hole';
    // A size next to "magnets" is the magnet size, unless it is a Gridfinity grid ("2 x 2 with magnets", fixed 6 x 2 mm magnets).
    else if ((before && before.tag === 'f:magnets' || after && (after.tag === 'f:magnets' || after.tag === 'obj:latch:magnet') && g.vals.length === 2) && (g.unit || toks.some((t) => t.tag === 'obj:latch:magnet'))) g.role = 'magnet';
    else g.role = 'dims';
    if (g.role === 'count' && g.target.tag === 'f:magnets') g.role = 'magnetCount';
  }
  // A size placed right after the thing ("hinge 50 mm") is that thing's size.
  // 3. Negations: "no lid", "without scoops".
  for (let i = 0; i < toks.length; i++) {
    if (!NEGATE.has(toks[i].w)) continue;
    const t = near(i, 1); if (t) { t.neg = true; toks[i].used = true; }
  }
  // 4. Text to print: quotes, words after "text", or WORDS IN CAPITALS.
  let text = quoted;
  for (let i = 0; i < toks.length && text == null; i++) {
    if (toks[i].tag !== 'intro') continue;
    const words = [];
    for (let j = i + toks[i].span; j < toks.length && words.length < 4; j++) {
      const t = toks[j]; if (t.used || t.num != null || (STOP.has(t.w) && t.raw !== t.raw.toUpperCase())) break;
      words.push(t.raw); t.used = true;
    }
    if (words.length) text = words.join(' ');
  }
  if (text == null) {
    const caps = toks.filter((t) => !t.used && t.num == null && t.raw.length >= 2 && t.raw === t.raw.toUpperCase());
    if (caps.length) { text = caps.map((t) => t.raw).join(' '); caps.forEach((t) => { t.used = true; }); }
  }
  const tags = toks.filter((t) => t.tag && t.tag !== 'intro');
  const has = (pre) => tags.find((t) => t.tag === pre || t.tag.startsWith(pre + ':'));
  const flag = (tag) => { const t = tags.find((x) => x.tag === tag); return t ? (t.neg ? false : true) : null; };
  const role = (r) => groups.find((g) => g.role === r);
  const skipped = toks.filter((t) => !t.used && !STOP.has(t.w) && UNITS[t.w] == null && t.w !== 'x' && !NEGATE.has(t.w) && t.tag !== 'intro').map((t) => t.raw);
  return { toks, groups, tags, has, flag, role, text, skipped };
}

// Turn the parse into parts to add, plus a plain-language list of what was understood.
function planPrompt(src) {
  const P = parsePrompt(src), said = [], notes = [];
  const objs = P.tags.filter((t) => t.tag.startsWith('obj:') && !t.neg);
  const kinds = P.tags.filter((t) => t.tag.startsWith('k:')).map((t) => t.tag.slice(2));
  const dims = P.role('dims'), mm = (v) => `${fmt(round(v, 0.1))} mm`;
  const val = (r, i = 0) => { const g = P.role(r); return g ? g.vals[i] : null; };
  const countOf = (t) => { const g = P.groups.find((x) => x.role === 'count' && x.target === t); return g ? clamp(Math.round(g.vals[0]), 1, 12) : 1; };
  const box = objs.find((t) => ['obj:storage', 'obj:gridfinity', 'obj:gfplate'].includes(t.tag));
  const main = box || objs.find((t) => !/^obj:(latch|hinge|shape)/.test(t.tag)) || objs.find((t) => t.tag.startsWith('obj:shape')) || objs[0];
  if (!main) return { P, said, notes, parts: [], main: null };
  const parts = [];
  const hw = (t, type, kind) => {
    const n = countOf(t);
    const p = { ...(type === 'hinge' ? HINGE_DEFAULTS : LATCH_DEFAULTS)[kind] };
    return { n, p };
  };
  const dimsUsedBy = (t) => (t === main ? dims : null);
  const text = P.text;

  if (main.tag === 'obj:storage' || main.tag === 'obj:gridfinity') {
    const g = main.tag === 'obj:gridfinity' || objs.some((t) => t.tag === 'obj:gridfinity');
    const p = structuredClone(g ? MAKER_DEFAULTS.gridfinity : MAKER_DEFAULTS.storage);
    said.push(g ? 'Gridfinity bin' : 'Storage box');
    if (g) {
      // Width and depth go in half units (1.5 units, 63 mm), height in whole units.
      const toU = (v, unitless, step) => Math.max(step === 42 ? 0.5 : 1, step === 42 ? Math.round((unitless ? v : v / step) * 2) / 2 : Math.round(unitless ? v : v / step));
      if (dims) {
        const ul = !dims.unit && dims.vals.every((v) => v <= 24);
        [p.gx, p.gy, p.gz] = [toU(dims.vals[0], ul, 42), toU(dims.vals[1] ?? (ul ? 1 : 42), ul, 42), dims.vals[2] != null ? toU(dims.vals[2], ul, 7) : p.gz];
      }
      const u = P.role('units'); if (u) { p.gx = Math.round(u.vals[0] * 2) / 2; if (u.vals[1]) p.gy = Math.round(u.vals[1] * 2) / 2; if (u.vals[2]) p.gz = Math.round(u.vals[2]); }
      if (val('h') != null) p.gz = Math.max(2, Math.round(P.role('h').unit ? val('h') / 7 : val('h')));
      p.gx = clamp(p.gx, 0.5, 10); p.gy = clamp(p.gy, 0.5, 10); p.gz = clamp(p.gz, 2, 24);
      said.push(`${p.gx} × ${p.gy} units, ${p.gz} high (${p.gx * 42} × ${p.gy * 42} × ${p.gz * 7} mm)`);
      if (P.flag('f:half')) p.halfGrid = true;
      if (gfHalf(p)) said.push('Half-size feet (21 mm)');
    } else {
      if (dims) {
        const v = dims.vals;
        if (v.length >= 3) [p.w, p.d, p.h] = v;
        else if (v.length === 2) [p.w, p.d] = v;
        else p.w = p.d = p.h = v[0];
      }
      if (val('w') != null) p.w = val('w'); if (val('d') != null) p.d = val('d'); if (val('h') != null) p.h = val('h');
      if (val('size') != null) p.w = p.d = p.h = val('size');
      p.w = clamp(p.w, 10, 400); p.d = clamp(p.d, 10, 400); p.h = clamp(p.h, 5, 300);
      said.push(`${fmt(p.w)} × ${fmt(p.d)} × ${fmt(p.h)} mm (width × depth × height)`);
      if (!dims || dims.vals.length < 3 && val('h') == null && val('size') == null) notes.push(`No height given, so it is ${fmt(p.h)} mm.`);
    }
    const comp = P.role('comp'), div = P.role('div');
    if (comp) {
      if (comp.vals.length >= 2) { p.cols = comp.vals[0]; p.rows = comp.vals[1]; }
      else {
        const n = Math.round(comp.vals[0]), W = g ? p.gx : p.w, D = g ? p.gy : p.d;
        let best = [n, 1], score = Infinity;
        for (let r = 1; r <= n; r++) if (n % r === 0) { const c = n / r, s = Math.abs(Math.log((W / c) / (D / r))); if (s < score) { score = s; best = [c, r]; } }
        [p.cols, p.rows] = best;
      }
    } else if (div) { p.cols = Math.round(div.vals[0]) + 1; p.rows = div.vals[1] ? Math.round(div.vals[1]) + 1 : 1; }
    p.cols = clamp(Math.round(p.cols), 1, 12); p.rows = clamp(Math.round(p.rows), 1, 12);
    if (comp || div) said.push(p.cols * p.rows === 1 ? 'One open space' : `${p.cols} × ${p.rows} compartments (${p.cols * p.rows})`);
    if (val('wall') != null) { p.wall = clamp(val('wall'), 0.8, 6); said.push(`Walls ${mm(p.wall)}`); }
    if (val('floor') != null) { p.floor = clamp(val('floor'), 0.6, 6); said.push(`Floor ${mm(p.floor)}`); }
    if (!g) {
      if (val('r') != null) { p.radius = clamp(val('r'), 0, 30); said.push(`Corners rounded ${mm(p.radius)}`); }
      else if (P.flag('f:rounded')) { p.radius = 8; said.push('Extra-rounded corners'); }
      else if (P.flag('f:sharp')) { p.radius = 0; p.soften = 0; said.push('Sharp corners'); }
      const lt = P.tags.find((t) => t.tag.startsWith('lid:')) || (objs.some((t) => t.tag.startsWith('obj:hinge')) ? { tag: 'lid:hinge' } : null);
      if (lt && !lt.neg) { p.lid = lt.tag.slice(4); said.push({ hinge: 'Hinged lid', inner: 'Inner hinged lid (hidden hinge)', snaphinge: 'Snap-on hinged lid', slide: 'Slide-on lid', friction: 'Push-on lid' }[p.lid]); }
      const wantLock = P.flag('f:hclasp') ? 'hidden' : P.flag('f:clasp') ? 'clasp' : P.flag('f:padtab') ? 'padlock' : null;
      if (wantLock) {
        if (wantLock === 'hidden' ? p.lid !== 'inner' : !['hinge', 'snaphinge', 'inner'].includes(p.lid)) { p.lid = 'inner'; said.push('Inner hinged lid (hidden hinge)'); }
        p.lock = wantLock; said.push(wantLock === 'clasp' ? 'Snap clasp on the front' : wantLock === 'hidden' ? 'Hidden snap clasp inside the box' : 'Padlock tab');
      }
      if (P.flag('f:sidelock')) { p.stack = true; p.sideLock = true; if (p.lid && p.lid !== 'none') { p.lid = 'none'; p.lock = 'none'; } said.push('Side locks that click stacked boxes together'); }
      if (P.flag('f:gfin')) { p.gfInside = true; said.push('Gridfinity grid on the floor inside'); }
      if (P.flag('f:stack') != null) { p.stack = P.flag('f:stack'); if (p.stack) said.push('Stacking foot'); }
    } else {
      if (P.flag('f:lip') === false) { p.lip = false; said.push('No stacking lip'); }
      if (P.flag('f:magnets')) { p.magnets = true; said.push('Magnet holes under the feet'); }
      if (P.flag('f:screws')) { p.screws = true; said.push('Screw holes under the feet'); }
    }
    for (const [tag, key, label] of [['f:scoop', 'scoop', 'Finger scoops'], ['f:notch', 'notch', 'Finger notch'], ['f:handles', 'handles', 'Handle slots']]) {
      const f = P.flag(tag); if (f == null) continue; p[key] = f; said.push(f ? label : `No ${label.toLowerCase()}`);
    }
    if (text) { p.label = P.flag('f:engraved') ? 'engraved' : 'raised'; p.labelText = text.slice(0, 40); said.push(`${p.label === 'engraved' ? 'Engraved' : 'Raised'} label “${p.labelText}”`); }
    else if (P.flag('f:label') != null) { p.label = P.flag('f:label') ? 'shelf' : 'none'; said.push(p.label === 'shelf' ? 'Label shelf' : 'No label'); }
    parts.push({ maker: 'storage', p, n: countOf(main) });
  } else if (main.tag === 'obj:gfplate') {
    const p = { ...MAKER_DEFAULTS.gfplate };
    const d = dims || P.role('units');
    const ul = d && !d.unit && d.vals.every((v) => v <= 12);
    if (d && !ul && P.toks.some((t) => /^drawers?$/.test(t.w))) {
      // "baseplate for a 300 x 200 mm drawer": fill the drawer, with a solid border round the grid.
      p.fit = true; p.dw = clamp(d.vals[0], 42, 1000); p.dd = clamp(d.vals[1] ?? d.vals[0], 42, 1000);
      const L = gfPlateLayout(p);
      said.push('Gridfinity baseplate', `Fills a ${fmt(p.dw)} × ${fmt(p.dd)} mm drawer with ${L.gx} × ${L.gy} squares`);
    } else {
      if (d) { p.gx = clamp(Math.round(ul ? d.vals[0] : d.vals[0] / 42), 1, 12); p.gy = clamp(Math.round(ul ? d.vals[1] ?? d.vals[0] : (d.vals[1] ?? d.vals[0]) / 42), 1, 12); }
      said.push('Gridfinity baseplate', `${p.gx} × ${p.gy} squares (${p.gx * 42} × ${p.gy * 42} mm)`);
    }
    if (P.flag('f:magnets')) { p.magnets = true; said.push('Magnet holes in each square'); }
    if (P.flag('f:screws')) { p.screws = true; said.push('Countersunk screw holes'); }
    parts.push({ maker: 'gfplate', p, n: countOf(main) });
  } else if (main.tag === 'obj:keychain' || main.tag === 'obj:sign' || main.tag === 'obj:coaster') {
    const kind = main.tag.slice(4), v = dims ? dims.vals : [];
    const round_ = kind === 'coaster';
    let L = v[0] ?? val('w') ?? val('dia') ?? val('size'), W = v[1] ?? val('d') ?? val('h'), T = v[2] ?? val('t');
    const txt = text || (kind === 'sign' ? 'HELLO' : null);
    if (kind === 'keychain') { L = L ?? Math.max(40, (txt ? txt.length : 4) * 9 + 22); W = W ?? 20; T = T ?? 4; }
    else if (kind === 'sign') { L = L ?? Math.max(100, txt.length * 14 + 30); W = W ?? 50; T = T ?? 4; }
    else { L = L ?? 90; W = L; T = T ?? 4; }
    L = clamp(L, 10, 300); W = clamp(W, 6, 300); T = clamp(T, 1, 30);
    const shapeTag = objs.find((t) => t.tag.startsWith('obj:shape:'));
    const base = shapeTag ? shapeTag.tag.slice(10) : round_ ? 'cylinder' : 'rbox';
    said.push({ keychain: 'Keychain tag', sign: 'Sign', coaster: 'Coaster' }[kind], round_ || base !== 'rbox' ? `${fmt(L)} mm across, ${fmt(T)} mm thick` : `${fmt(L)} × ${fmt(W)} mm, ${fmt(T)} mm thick`);
    const items = [{ type: base, size: [L, T, round_ ? L : W], pos: [0, T / 2, 0], color: pickColor() }];
    let left = round_ ? -L * 0.33 : -L / 2 + 3, right = round_ ? L * 0.33 : L / 2 - 3;
    const holeWanted = kind === 'keychain' ? P.flag('f:hole') !== false : P.flag('f:hole') || val('hole') != null;
    if (holeWanted) {
      const hd = clamp(val('hole') ?? 5, 2, Math.min(W, L) * 0.6), hx = -L / 2 + Math.max(hd / 2 + 3, W * 0.3);
      items.push({ type: 'cylinder', hole: true, size: [hd, T + 6, hd], pos: [hx, T / 2, 0] });
      left = hx + hd / 2 + 3; said.push(`${mm(hd)} hole`);
    }
    if (kind === 'sign' && P.flag('f:screws')) {
      for (const s of [-1, 1]) items.push({ type: 'cylinder', hole: true, size: [3.5, T + 6, 3.5], pos: [s * (L / 2 - 7), T / 2, 0] });
      left = Math.max(left, -L / 2 + 13); right = L / 2 - 13; said.push('Two screw holes');
    }
    if (txt) {
      const eng = P.flag('f:engraved');
      items.push({ type: 'text', text: txt.slice(0, 40), hole: eng, fit: [right - left, round_ ? L * 0.35 : W * 0.6], depth: eng ? 2.4 : 2, pos: [(left + right) / 2, eng ? T - 0.2 : T + 0.5, 0], color: '#f4f1ea' });
      said.push(`${eng ? 'Engraved' : 'Raised'} text “${txt.slice(0, 40)}”`);
      if (!text) notes.push('No text given, so it says HELLO. Change it in the panel on the right.');
    }
    parts.push({ items, n: countOf(main) });
  } else if (main.tag === 'obj:text') {
    const h = clamp(val('h') ?? val('size') ?? (dims ? dims.vals[0] : 15), 3, 200), T = clamp(val('t') ?? 3, 0.6, 30);
    const txt = text || 'HELLO';
    said.push(`Letters “${txt}”`, `${mm(h)} tall, ${mm(T)} thick`);
    parts.push({ items: [{ type: 'text', text: txt.slice(0, 40), fitH: h, depth: T, pos: [0, T / 2, 0] }], n: countOf(main) });
  } else if (main.tag.startsWith('obj:shape:')) {
    const type = main.tag.slice(10), roundish = ['cylinder', 'cone', 'tube', 'hexagon', 'torus', 'sphere'].includes(type);
    const flat = type === 'star' || type === 'heart';
    let s = [...SHAPES[type].size];
    const v = dims ? dims.vals : [];
    if (v.length >= 3) s = [v[0], v[2], v[1]];
    else if (v.length === 2) s = roundish ? [v[0], v[1], v[0]] : flat ? [v[0], s[1], v[1]] : [v[0], s[1], v[1]];
    else if (v.length === 1) s = flat ? [v[0], s[1] * v[0] / 20, v[0] * s[2] / s[0]] : [v[0], v[0], v[0]];
    if (val('size') != null) s = s.map(() => val('size'));
    if (val('dia') != null) { s[0] = s[2] = val('dia'); }
    if (val('w') != null) s[0] = val('w');
    if (val('d') != null) s[2] = val('d');
    if (val('h') != null) s[1] = val('h');
    if (val('t') != null) s[1] = val('t');
    s = s.map((x) => clamp(x, 0.5, 400));
    said.push(SHAPES[type].label, `${fmt(s[0])} × ${fmt(s[2])} mm, ${fmt(s[1])} mm tall`);
    const items = [{ type, size: s, pos: [0, s[1] / 2, 0], color: pickColor() }];
    if (P.flag('f:hole') || val('hole') != null) {
      const hd = clamp(val('hole') ?? Math.min(s[0], s[2]) * 0.3, 1, Math.min(s[0], s[2]) * 0.8);
      items.push({ type: 'cylinder', hole: true, size: [hd, s[1] + 6, hd], pos: [0, s[1] / 2, 0] });
      said.push(`${mm(hd)} hole through the middle`);
    }
    parts.push({ items, n: countOf(main) });
  } else if (main.tag.startsWith('obj:joint')) {
    const kind = main.tag.split(':')[2] || 'dovetail', p = { ...JOINT_DEFAULTS[kind] };
    const v = dims ? dims.vals : [];
    if (v[0]) p.w = v[0]; if (v[1]) p.d = v[1]; if (v[2]) p.h = v[2];
    if (val('w') != null) p.w = val('w'); if (val('d') != null) p.d = val('d'); if (val('h') != null) p.h = val('h');
    if (val('gap') != null) p.tol = clamp(val('gap'), 0.1, 1);
    const cc = P.groups.find((g) => g.role === 'count' && g.target === main);
    if (cc && (kind === 'fingers' || kind === 'peg')) { p.n = clamp(Math.round(cc.vals[0]), kind === 'peg' ? 1 : 2, kind === 'peg' ? 8 : 12); cc.consumed = true; }
    p.w = clamp(p.w, 10, 150); p.d = clamp(p.d, 4, 80); p.h = clamp(p.h, 4, 120);
    if (kind === 'fingers' || kind === 'peg') said.push(`${p.n} ${kind === 'peg' ? 'pegs' : 'fingers'}`);
    said.push(JOINT_KINDS.find(([x]) => x === kind)[1].replace(/ joint$/i, '') + ' joint (two matching blocks)', `${fmt(p.w)} × ${fmt(p.d)} mm each, ${fmt(p.h)} mm tall`);
    parts.push({ maker: 'joint', p, n: cc && !cc.consumed ? countOf(main) : 1 });
  } else if (main.tag.startsWith('obj:spin:')) {
    const name = main.tag.slice(9), prof = OUTLINE_TEMPLATES.spin[name];
    const rmax = Math.max(...prof.map((q) => q[0])), zs = prof.map((q) => q[1]), zmin = Math.min(...zs), zmax = Math.max(...zs);
    const v = dims ? dims.vals : [];
    let dia = val('dia') ?? val('w') ?? (v.length >= 2 ? v[0] : null), h = val('h') ?? (v.length >= 2 ? v[v.length - 1] : v.length === 1 ? v[0] : null);
    if (val('size') != null) h = val('size');
    let sx = dia != null ? dia / 2 / rmax : null, sz = h != null ? h / (zmax - zmin) : null;
    sx = sx ?? sz ?? 1; sz = sz ?? sx;
    sx = clamp(sx, 0.1, 8); sz = clamp(sz, 0.1, 8);
    const scaled = prof.map(([r, z, sm]) => [round(r * sx, 0.01), round(z * sz, 0.01), sm]);
    said.push(name === 'Spinner' ? 'Spinning top' : name, `${fmt(round(rmax * sx * 2, 0.1))} mm across, ${fmt(round((zmax - zmin) * sz, 0.1))} mm tall`);
    notes.push('It is a spun shape: press Edit dots to change its outline.');
    parts.push({ maker: 'outline', p: { ...structuredClone(MAKER_DEFAULTS.outline), mode: 'spin', prof: scaled }, n: countOf(main) });
  }
  // Hinges and locks: the main thing, or extras next to a box ("box with 2 latches").
  for (const t of objs) {
    if (!(t.tag.startsWith('obj:hinge') || t.tag.startsWith('obj:latch'))) continue;
    if (box && t.tag.startsWith('obj:hinge') && box.tag === 'obj:storage') continue; // a hinge on a box means a hinged lid
    if (t !== main && parts.length && !box) continue;
    const isHinge = t.tag.startsWith('obj:hinge');
    let kind = t.tag.split(':')[2];
    if (isHinge && !kind) kind = kinds.find((k) => HINGE_DEFAULTS[k]) || 'pip';
    const { n, p } = hw(t, isHinge ? 'hinge' : 'latch', kind);
    const own = t === main ? dims : null;
    const label = (isHinge ? HW_KINDS.hinge : HW_KINDS.latch).find(([k]) => k === kind)[1];
    const bits = [];
    if (isHinge) {
      if (own) { p.w = own.vals[0]; if (own.vals[1]) p.leaf = own.vals[1] / 2; }
      if (val('w') != null && t === main) p.w = val('w');
      if (val('knuckles') != null && p.n) p.n = Math.round(val('knuckles')) | 1;
      if (val('pin') != null && p.pinD) p.pinD = val('pin');
      if (val('t') != null) p.t = val('t');
      if (val('gap') != null && p.tol) p.tol = val('gap');
      if (P.role('count') && P.groups.find((g) => g.role === 'count' && g.target.tag === 'f:screws')) p.screws = clamp(P.groups.find((g) => g.role === 'count' && g.target.tag === 'f:screws').vals[0], 1, 4);
      if (p.w) { p.w = clamp(p.w, 10, 300); bits.push(`${fmt(p.w)} mm wide`); }
      if (val('knuckles') != null && p.n) bits.push(`${p.n} knuckles`);
    } else {
      const v = own ? own.vals : [];
      if (kind === 'snap') { if (v[0]) p.L = v[0]; if (val('w') != null) p.w = val('w'); bits.push(`arm ${fmt(p.L)} mm`); }
      if (kind === 'bolt') { if (v[0]) p.hl = v[0]; if (v[1]) p.bw = v[1]; bits.push(`housing ${fmt(p.hl)} mm long`); }
      if (kind === 'hasp') { if (v[0]) p.w = v[0]; const sh = P.role('shackle'); if (sh) p.sw = sh.vals[0] + 1; bits.push(`${fmt(p.w)} mm wide`); }
      if (kind === 'magnet') { const m = P.role('magnet') || own; if (m) { p.md = m.vals[0]; if (m.vals[1]) p.mh = m.vals[1]; } bits.push(`for ${fmt(p.md)} × ${fmt(p.mh)} mm magnets`); }
      if (kind === 'turn') { if (v[0]) p.L = v[0]; bits.push(`${fmt(p.L)} mm long`); }
    }
    if (p.screwD != null) {
      if (P.flag('f:screws') === false) { p.screwD = 0; bits.push('no screw holes'); }
      if (P.flag('f:sink') === false) p.sink = false;
    }
    said.push(`${n > 1 ? n + ' × ' : ''}${label}${bits.length ? ', ' + bits.join(', ') : ''}`);
    parts.push({ maker: isHinge ? 'hinge' : 'latch', p, n });
  }
  return { P, said, notes, parts, main };
}

function buildPrompt(src) {
  const plan = planPrompt(src);
  if (!plan.parts.length) return false;
  clearExample();
  const added = [];
  const place = (list) => {
    // list: objects with pos relative to their own centre; drop the set somewhere free.
    syncScene();
    const xs = [], zs = [];
    for (const o of list) { xs.push(o.pos[0] - o.size[0] / 2, o.pos[0] + o.size[0] / 2); zs.push(o.pos[2] - o.size[2] / 2, o.pos[2] + o.size[2] / 2); }
    const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...zs) - Math.min(...zs), cx = (Math.max(...xs) + Math.min(...xs)) / 2, cz = (Math.max(...zs) + Math.min(...zs)) / 2;
    const [x, z] = freeSpot([w, 10, d]);
    for (const o of list) { o.pos[0] = round(o.pos[0] - cx + x, 0.01); o.pos[2] = round(o.pos[2] - cz + z, 0.01); doc.objects.push(o); added.push(o); }
    syncScene();
    const floor = Math.min(...list.map((o) => worldBox(o).min.y));
    if (Math.abs(floor) > 0.001) { for (const o of list) o.pos[1] = round(o.pos[1] - floor, 0.001); syncScene(); }
  };
  for (const part of plan.parts) {
    for (let c = 0; c < part.n; c++) {
      if (part.maker) {
        const o = { id: newId(), type: part.maker, hole: false, color: pickColor(), p: structuredClone(part.p), pos: [0, 0, 0], rot: [0, 0, 0], size: [1, 1, 1] };
        refreshMakerSize(o); o.pos[1] = o.size[1] / 2;
        place([o]);
        if (o.type === 'storage') { syncLid(o); const lid = doc.objects.find((x) => x.type === 'lid' && x.p.boxId === o.id); if (lid) added.push(lid); syncScene(); }
      } else {
        const list = part.items.map((it) => {
          const o = { id: newId(), type: it.type, hole: !!it.hole, color: it.hole ? COLORS[0] : (it.color || pickColor()), pos: [...it.pos], rot: [0, 0, 0], size: it.size ? [...it.size] : [1, 1, 1] };
          if (it.type === 'text') {
            o.text = it.text;
            const nat = unitGeom(o).userData.natural;
            const k = it.fit ? Math.min(it.fit[0] / nat[0], it.fit[1] / nat[2]) : it.fitH / nat[2];
            o.size = [round(nat[0] * k, 0.01), it.depth, round(nat[2] * k, 0.01)];
          }
          return o;
        });
        place(list);
      }
    }
  }
  select(added.map((o) => o.id));
  commit();
  setView('fit');
  return plan;
}

// ---------- the dialog ----------
const ASK_EXAMPLES = [
  'box 120 x 80 x 50 mm, 3 x 2 compartments, hinged lid, 2 mm walls',
  'gridfinity bin 2 x 1 x 6 units with scoops and label shelf',
  'gridfinity baseplate for a 320 x 240 mm drawer with magnets',
  'keychain with text "PAULO", 4 mm hole',
  'sign 150 x 50 mm saying "WORKSHOP" with screw holes',
  '2 print in place hinges 50 mm wide',
  'box 60 x 60 x 30 mm, slide lid, engraved label "PINS"',
  'sliding bolt lock 60 mm',
  'magnet catch for 10 x 3 mm magnets',
  'vase 120 mm tall',
  'coaster 90 mm with text "HOME"',
];
const ASK_WORDS = [
  ['box', 'storage box'], ['gridfinity bin', 'fits Gridfinity'], ['gridfinity baseplate', 'grid to hold bins'], ['keychain', 'tag with a hole'], ['sign', 'plate with text'], ['coaster', 'round mat'],
  ['letters', 'standing text'], ['hinge', 'swinging joint'], ['dovetail', 'sliding lock'], ['finger joint', 'interleaved fingers'], ['t slot', 'T-shaped slide'], ['puzzle joint', 'jigsaw shape'], ['pegs and holes', 'push-fit'], ['snap tabs', 'click together'], ['tongue and groove', 'slide-in rail'], ['print in place hinge', 'one piece'], ['filament pin hinge', 'pin from filament'], ['snap on hinge', 'clips together'], ['living hinge', 'bendy strip'],
  ['snap clip', 'springy latch'], ['sliding bolt', 'slide to lock'], ['padlock hasp', 'for a padlock'], ['magnet catch', 'holds with magnets'], ['turn button', 'swivel latch'],
  ['cube', 'shape'], ['cylinder', 'shape'], ['sphere', 'shape'], ['cone', 'shape'], ['pyramid', 'shape'], ['tube', 'shape'], ['ring', 'shape'], ['star', 'shape'], ['heart', 'shape'], ['hexagon', 'shape'], ['wedge', 'shape'],
  ['cup', 'spun shape'], ['bowl', 'spun shape'], ['vase', 'spun shape'], ['knob', 'spun shape'],
  ['compartments', 'e.g. 3 x 2 compartments'], ['dividers', 'e.g. 2 dividers'], ['walls', 'e.g. 2 mm walls'], ['floor', 'e.g. floor 1.5 mm'], ['corners', 'e.g. corners 5 mm'],
  ['hinged lid', 'lid on a hinge'], ['inner hinged lid', 'hidden hinge'], ['clasp', 'front snap lock'], ['inner clasp', 'hidden snap lock'], ['padlock tab', 'hole for a lock'], ['snap hinged lid', 'pegs click in'], ['slide lid', 'lid slides in'], ['push on lid', 'lid pushes on'], ['scoops', 'finger scoops'], ['notch', 'finger notch'], ['handles', 'handle slots'],
  ['label shelf', 'spot for a label'], ['label', 'add text after it'], ['stackable', 'stacking foot'], ['side locks', 'stack clicks together'], ['gridfinity inside', 'grid on the floor'], ['magnets', 'Gridfinity magnet holes'], ['half grid', 'Gridfinity 21 mm feet'], ['drawer', 'e.g. for a 300 x 200 mm drawer'], ['engraved', 'text cut in'], ['raised', 'text sticks out'],
  ['text', 'then your words'], ['hole', 'e.g. 4 mm hole'], ['screw holes', 'mounting holes'], ['no screw holes', 'glue instead'], ['knuckles', 'e.g. 5 knuckles'],
  ['wide', 'e.g. 50 mm wide'], ['tall', 'e.g. 40 mm tall'], ['deep', 'e.g. 30 mm deep'], ['thick', 'e.g. 3 mm thick'], ['diameter', 'e.g. diameter 60 mm'], ['mm', 'millimetres'], ['cm', 'centimetres'], ['inch', '25.4 mm'],
];
const ASK_NEXT = {
  storage: ['compartments', 'hinged lid', 'inner hinged lid', 'clasp', 'slide lid', 'push on lid', 'scoops', 'label', 'walls', 'handles', 'stackable', 'snap clip'],
  gridfinity: ['units', 'compartments', 'scoops', 'label shelf', 'magnets', 'screw holes', 'half grid', 'no lip'],
  gfplate: ['drawer', 'magnets', 'screw holes'],
  keychain: ['text', 'hole', 'engraved', 'thick'], sign: ['text', 'screw holes', 'engraved', 'thick'], coaster: ['text', 'engraved', 'thick'],
  joint: ['wide', 'tall', 'deep', 'gap'],
  hinge: ['wide', 'knuckles', 'no screw holes', 'print in place', 'filament pin', 'snap on'], latch: ['no screw holes', 'mm'],
};
let askTimer = 0;
function askOpen() {
  $('askOverlay').hidden = false;
  $('askEx').innerHTML = ASK_EXAMPLES.map((e) => `<button class="ask-ex">${esc(e)}</button>`).join('');
  $('askEx').querySelectorAll('button').forEach((b) => { b.onclick = () => { $('askInput').value = b.textContent; askUpdate(); $('askInput').focus(); }; });
  askUpdate();
  setTimeout(() => $('askInput').focus(), 30);
}
function askClose() { $('askOverlay').hidden = true; }
function askUpdate() {
  const v = $('askInput').value, plan = planPrompt(v);
  const empty = !v.trim();
  $('askBuild').disabled = !plan.parts.length;
  // What was understood
  let html = '';
  if (empty) html = '<p class="help">Type below, or tap an example. As you type, this shows what I picked up.</p>';
  else if (!plan.parts.length) html = `<p class="ask-miss">I could not tell what to make. Start with a thing, like <b>box</b>, <b>keychain</b>, <b>sign</b>, <b>hinge</b> or <b>cube</b>.</p>`;
  else html = `<ul class="ask-got">${plan.said.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
  const m = v.match(/([a-z]+)$/i), part = m ? m[1].toLowerCase() : '';
  const skipped = plan.P.skipped.filter((w, i, a) => !(part && i === a.length - 1 && w.toLowerCase() === part));
  if (!empty && skipped.length) html += `<p class="ask-skip">Skipped (I do not know these words): ${skipped.map((w) => `<span>${esc(w)}</span>`).join(' ')}</p>`;
  if (plan.parts.length) html += plan.notes.map((n) => `<p class="help">${esc(n)}</p>`).join('') + '<p class="help">Anything you leave out uses the usual settings. You can change everything in the panel on the right afterwards.</p>';
  $('askGot').innerHTML = html;
  // Suggestions: finish the word being typed, or what usually comes next.
  let sug;
  if (part) sug = [...ASK_WORDS.filter(([w]) => w.startsWith(part) && w !== part), ...ASK_WORDS.filter(([w]) => !w.startsWith(part) && part.length > 1 && w.split(' ').some((x) => x.startsWith(part)))];
  else if (!plan.main) sug = ASK_WORDS.slice(0, 17);
  else {
    const key = plan.main.tag.split(':')[1];
    const list = ASK_NEXT[key === 'storage' && plan.said[0] === 'Gridfinity bin' ? 'gridfinity' : key] || [];
    const low = v.toLowerCase();
    sug = list.filter((w) => !low.includes(w)).map((w) => ASK_WORDS.find(([x]) => x === w) || [w, '']);
  }
  sug = (sug || []).slice(0, 10);
  $('askSug').innerHTML = sug.map(([w, h]) => `<button class="ask-chip" data-w="${esc(w)}" title="${esc(h)}">${esc(w)}${h ? `<small>${esc(h)}</small>` : ''}</button>`).join('');
  $('askSug').querySelectorAll('button').forEach((b) => {
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => {
      const inp = $('askInput'), cur = inp.value, w = b.dataset.w;
      inp.value = (part ? cur.slice(0, cur.length - part.length) : cur.replace(/\s*$/, cur.trim() ? ' ' : '')) + w + ' ';
      askUpdate(); inp.focus();
    };
  });
}
function askBuild() {
  let plan;
  try { plan = buildPrompt($('askInput').value); }
  catch (err) { console.error(err); toast('Those settings do not fit together. Try different sizes.'); return; }
  if (!plan) { toast('I could not tell what to make. Try starting with box, keychain, sign, hinge or cube.'); return; }
  askClose();
  toast(`Added: ${plan.said[0]}. Change anything in the panel on the right.`);
}
$('btnAsk').onclick = askOpen;
$('askCancel').onclick = askClose;
$('askOverlay').onclick = (e) => { if (e.target === $('askOverlay')) askClose(); };
$('askInput').oninput = () => { clearTimeout(askTimer); askTimer = setTimeout(askUpdate, 120); };
$('askInput').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); askBuild(); } else if (e.key === 'Escape') askClose(); };
$('askBuild').onclick = askBuild;
