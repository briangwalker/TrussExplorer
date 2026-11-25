// ===== Truss limits: the table of allowed input values, and the input check (#420, #421; board TE-B-373, RMA-4) =====
// Values: Math (v0.4, 11-19, after Physics' review; height max 200, Math 11-24: 100 is the course rule, not a model limit) and Physics. Format: Architecture Lead (TE-B-372b).
// One data table (TABLE) read by the input boxes AND the file loader; it replaces both the box min/max and the slider range.
// An out-of-range value is REJECTED with the row's message and never clamped; a value that came from a file is reported, never changed (UI-I10).
// Row fields: id (the real input id), unit, min, max (a number or an expression), step (1 = whole numbers only),
//   zeroOr (0, or at least this), warnMin / warnMax (warn but allow), when ({ id, in: [...] }: the row applies only then),
//   warnRule ('M1' | 'N3D' | 'STICK': a named warning that is code, below), warnMsg, msg, status, sliderMin, sliderMax.
// Expressions: numbers, input ids, derived names (DERIVED), + - * /, unary minus, brackets, min() and max(). They are read by the small
// parser below, never run as code. Anything else throws a TypeError (CODE-N3: a programmer error).
// A missing or damaged input list, or a missing value, is not an error here: that row is skipped (CODE-N2).
// This is the validity function: checkInputs and warnInputs (the table), checkGeometry (G1-G5, RMA-6; G7-G10, RMA-13) and checkResult (M2, RMA-15).
// G6 is merged into G5. Math's M1 comes with G5 and M4 with G8; M3 is a Build Documents warning, not here (TE-B-583).
// No DOM, no app state (CODE-F1, CODE-F4, CODE-F5): Node tests load it directly; build.py inlines it before app.js.
(function (root) {
'use strict';

const STICK_MM = 3.18;                  // the course stick, in mm
const SHAPED = ['parabola', 'arc', 'catenary'];

// Named values usable inside expressions, defined once (Math: 'stick2' = two stick widths, 6.36 mm at the course stick).
// Plain names of the inputs, for a line a person reads (fileReport's summary). The page may use its own box labels, and Marketing may reword these.
const LABELS = Object.freeze({ height: 'Height', curve: 'Curve', topEnd: 'Top end', botEnd: 'Bottom end', panels: 'Panels', ratio: 'Panel ratio', sideAngle: 'Side angle',
  deskPanels: 'Desk panels', overlap: 'Desk overlap', supportOffset: 'Support offset', bookLen: 'Book length', bookWidth: 'Book width', bookThick: 'Book thickness',
  mBook1: 'Book mass 1', mBook2: 'Book mass 2', FS: 'Safety factor', nTruss: 'Trusses', width: 'Width', tilt3d: 'Tilt', deflLimit: 'Deflection limit', minOverlap: 'Minimum overlap',
  E: 'Stiffness (E)', rho: 'Density', sigT: 'Tension strength', sigC: 'Compression strength', bS: 'Stick width', hS: 'Stick depth', fricMu: 'Friction', fricK: 'Friction stiffness',
  tableThick: 'Table thickness', braceDepth: 'Brace depth', impAlpha: 'Imperfection alpha', impBeta: 'Imperfection beta', width3d: '3D width', docBendN: 'Bend count',
  docStock: 'Stick length', docKerf: 'Saw cut', autoLimit: 'Auto limit', bigCap: 'Sweep cap', rcFS: 'Check safety factor', rcBook: 'Check book mass', rcDefl: 'Check deflection',
  rcOv: 'Check overlap', refStep: 'Refine step', woodBudget: 'Wood budget', loadTarget: 'Load target', abSteps: 'Steps', abExt: 'Extent' });
const labelFor = id => (Object.prototype.hasOwnProperty.call(LABELS, id) ? LABELS[id] : String(id));
const DERIVED = Object.freeze({ stick2: '2*max(bS,hS)' });

// Ids a row's `when` may test that are not number boxes: the bottom and top chord shapes, and the model.
const WHEN_IDS = Object.freeze(['bottom', 'topShape', 'model']);

const R = (id, unit, min, max, msg, status, more) => Object.assign({ id, unit, min, max, msg, status }, more);
const COURSE = 'Course balsa is E 3000, rho 160, sigT 7.5, sigC 4.5, stick 3.18.';

const TABLE = Object.freeze([
  R('height', 'mm', 10, 200, 'Height must be 10 to 200 mm.', 'math', { warnMin: 20, warnMsg: 'Below 20 mm the top and bottom chords are close together, so buckling decides the capacity.', sliderMin: 10, sliderMax: 100 }),
  R('curve', 'mm', -60, 'height-10', 'The bottom chord must stay at least 10 mm below the top chord.', 'math', { warnMax: 'height-20', warnMsg: 'The bottom chord is within 20 mm of the top chord.', when: { id: 'bottom', in: SHAPED }, sliderMin: -50, sliderMax: 100 }),
  R('topEnd', 'mm', '-min(tableThick,50)', 'height-10', 'Top chord end must be between the table face and 10 mm below the top.', 'math', { when: { id: 'topShape', in: SHAPED }, sliderMin: -30, sliderMax: 70 }),
  R('botEnd', 'mm', 0, 'height-10', 'Bottom chord end must be 0 to height minus 10 mm.', 'math', { sliderMin: 0, sliderMax: 100 }),
  R('panels', 'count', 2, 12, 'Panels must be a whole number from 2 to 12.', 'measured', { step: 1, sliderMin: 2, sliderMax: 12 }),
  R('ratio', '-', 0.3, 3, 'Panel taper must be 0.3 to 3.', 'math', { step: 0.05, sliderMin: 0.5, sliderMax: 2 }),
  R('sideAngle', 'deg', 20, 90, 'Side angle must be 20 to 90 degrees.', 'math', { warnRule: 'M1', sliderMin: 30, sliderMax: 90 }),
  R('deskPanels', 'count', 0, 6, 'Desk panels must be a whole number from 0 to 6.', 'measured', { step: 1, warnRule: 'M1', sliderMin: 0, sliderMax: 4 }),
  R('overlap', 'mm', 0, 50, 'Foot must be 0 (no foot) or at least two stick widths and at most 50 mm.', 'math', { zeroOr: 'stick2', warnMin: 'minOverlap', warnMsg: 'Below the minimum overlap you set.', sliderMin: 0, sliderMax: 50 }),
  R('supportOffset', 'mm', 0, 50, 'Support must be 0 or at least two stick widths and at most 50 mm from the edge.', 'math', { zeroOr: 'stick2', sliderMin: 0, sliderMax: 50 }),
  R('bookLen', 'mm', 20, 400, 'Book length must be 20 to 400 mm.', 'math', { sliderMin: 100, sliderMax: 300 }),
  R('bookWidth', 'mm', 1, 400, 'Book width must be 1 to 400 mm.', 'math'),
  R('bookThick', 'mm', 1, 120, 'Book thickness must be 1 to 120 mm.', 'math'),
  R('mBook1', 'kg', 0, 20, 'Book mass must be 0 to 20 kg.', 'math', { warnMax: 10, warnMsg: 'Above 10 kg is far beyond the course test (2.5 kg per book).' }),
  R('mBook2', 'kg', 0, 20, 'Book mass must be 0 to 20 kg.', 'math', { warnMax: 10, warnMsg: 'Above 10 kg is far beyond the course test (2.5 kg per book).' }),
  R('FS', '-', 1, 10, 'Factor of safety must be 1 to 10.', 'math', { warnMin: 1.5, warnMsg: 'Below 1.5 leaves little margin; the course uses 2.' }),
  R('nTruss', 'count', 1, 4, 'Number of trusses must be 1 to 4.', 'confirmed', { step: 1, warnRule: 'N3D', warnMsg: 'The 3D result models two trusses only.' }),
  R('width', 'mm', 20, 120, 'Truss width must be 20 to 120 mm.', 'measured'),
  R('tilt3d', 'deg', -30, 30, 'Tilt must be -30 to 30 degrees.', 'measured'),
  R('deflLimit', 'mm', 0.1, 20, 'Deflection limit must be 0.1 to 20 mm.', 'math'),
  R('minOverlap', 'mm', 0, 50, 'Minimum overlap cannot exceed the 50 mm foot.', 'math'),
  R('E', 'MPa', 500, 10000, 'E must be 500 to 10000 MPa.', 'confirmed', { warnMin: 1500, warnMax: 6000, warnMsg: 'Outside 1500-6000 MPa. ' + COURSE }),
  R('rho', 'kg/m3', 50, 400, 'Density must be 50 to 400 kg/m3.', 'confirmed', { warnMin: 100, warnMax: 250, warnMsg: 'Outside 100-250 kg/m3. ' + COURSE }),
  R('sigT', 'MPa', 1, 60, 'Tension strength must be 1 to 60 MPa.', 'confirmed', { warnMin: 5, warnMax: 30, warnMsg: 'Outside 5-30 MPa. ' + COURSE }),
  R('sigC', 'MPa', 1, 40, 'Crush strength must be 1 to 40 MPa.', 'confirmed', { warnMin: 3, warnMax: 15, warnMsg: 'Outside 3-15 MPa. ' + COURSE }),
  R('bS', 'mm', 1, 10, 'Stick size must be 1 to 10 mm.', 'confirmed', { warnRule: 'STICK', warnMsg: 'Not the course stick. ' + COURSE }),
  R('hS', 'mm', 1, 10, 'Stick size must be 1 to 10 mm.', 'confirmed', { warnRule: 'STICK', warnMsg: 'Not the course stick. ' + COURSE }),
  R('fricMu', '-', 0, 2, 'Friction must be 0 to 2.', 'measured'),
  R('fricK', 'N/mm', 0, 100, 'Friction stiffness must be 0 to 100.', 'math'),
  R('tableThick', 'mm', 0, 80, 'Table thickness must be 0 to 80 mm.', 'measured'),
  R('braceDepth', 'mm', 1, 'min(50,tableThick)', 'Brace must be inside the table top (1 mm up to the table thickness, at most 50).', 'math'),
  R('impAlpha', '-', 0, 0.2, 'Bow must be 0 to 0.2.', 'math'),
  R('impBeta', '-', 0, 0.1, 'Sway must be 0 to 0.1.', 'math'),
  R('width3d', 'mm', 20, 120, 'Bridge width must be 20 to 120 mm.', 'math'),
  R('docBendN', 'count', 1, 8, 'Bending forms must be 1 to 8.', 'math', { step: 1 }),
  R('docStock', 'mm', 50, 2000, 'Stock stick length must be 50 to 2000 mm.', 'math'),
  R('docKerf', 'mm', 0, 10, 'Saw kerf must be 0 to 10 mm.', 'math'),
  R('autoLimit', 'count', 1, 'bigCap', 'Auto re-run limit must be 1 up to the max designs per run.', 'math', { step: 1 }),
  R('bigCap', 'count', 1000, 20000, 'Max designs per run must be 1000 to 20000.', 'math', { step: 1 }),
  R('rcFS', '-', 1, 10, 'Factor of safety must be 1 to 10.', 'math'),
  R('rcBook', 'kg', 0, 20, 'Book mass must be 0 to 20 kg.', 'math'),
  R('rcDefl', 'mm', 0.1, 20, 'Deflection limit must be 0.1 to 20 mm.', 'math'),
  R('rcOv', 'mm', 0, 50, 'Overlap must be 0 to 50 mm.', 'math'),
  R('refStep', 'mm', 0.01, 20, 'Step must be 0.01 to 20 mm.', 'math'),
  R('woodBudget', 'mm', 0, 5000, 'Wood budget must be 0 to 5000 mm.', 'math'),
  R('loadTarget', 'kg', 0, 20, 'Book load must be 0 to 20 kg.', 'math'),
  R('abSteps', 'count', 1, 200, 'Steps must be 1 to 200.', 'math', { step: 1 }),
  R('abExt', '%', 0, 100, 'Extension must be 0 to 100 percent.', 'math'),
]);

// Data only, checked by RMA-6 (the geometry half of the validity function): sweep boxes and file cases, as Math's table words them.
const SWEEP_RULE = 'Sweep boxes: from and to must each lie inside the limits of the input they sweep; step > 0; from <= to; count of designs <= bigCap. Same messages as the base input.';

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const KNOWN = new Set(TABLE.map(r => r.id).concat(Object.keys(DERIVED)));

// ---------- the expression parser: numbers, names, + - * /, unary minus, brackets, min() and max() ----------
function tokens(src) {
  const out = [], re = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|([-+*\/(),]))/y;
  let pos = 0;
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) throw new TypeError('limits: cannot read "' + src + '" at ' + pos);
    out.push(m[1] !== undefined ? { n: parseFloat(m[1]) } : m[2] !== undefined ? { id: m[2] } : { op: m[3] });
    pos = re.lastIndex;
  }
  return out;
}

// Returns a number, or null when a name it needs has no usable value (the check is then skipped, CODE-N2).
function evaluate(src, values, depth) {
  const t = tokens(src);
  let i = 0, missing = false;
  const peek = () => t[i], take = () => t[i++];
  const isOp = (o) => peek() && peek().op === o;
  function name(id) {
    if (hasOwn(DERIVED, id)) {
      if (depth > 3) throw new TypeError('limits: derived values nest too deep');
      const v = evaluate(DERIVED[id], values, depth + 1);
      if (v === null) { missing = true; return NaN; }
      return v;
    }
    if (!KNOWN.has(id)) throw new TypeError('limits: unknown name "' + id + '" in "' + src + '"');
    const v = isObj(values) && hasOwn(values, id) ? asNumber(values[id]) : null;
    if (v === null) { missing = true; return NaN; }
    return v;
  }
  function call(id) {
    if (id !== 'min' && id !== 'max') throw new TypeError('limits: only min() and max() are allowed, not "' + id + '"');
    take();                                           // (
    const args = [sum()];
    while (isOp(',')) { take(); args.push(sum()); }
    if (!isOp(')')) throw new TypeError('limits: missing ) in "' + src + '"');
    take();
    return id === 'min' ? Math.min.apply(null, args) : Math.max.apply(null, args);
  }
  function atom() {
    const x = take();
    if (!x) throw new TypeError('limits: "' + src + '" ends too soon');
    if (x.n !== undefined) return x.n;
    if (x.id !== undefined) return isOp('(') ? call(x.id) : name(x.id);
    if (x.op === '(') { const v = sum(); if (!isOp(')')) throw new TypeError('limits: missing ) in "' + src + '"'); take(); return v; }
    if (x.op === '-') return -atom();
    throw new TypeError('limits: unexpected "' + x.op + '" in "' + src + '"');
  }
  function product() { let v = atom(); while (isOp('*') || isOp('/')) { const o = take().op, r = atom(); v = o === '*' ? v * r : v / r; } return v; }
  function sum() { let v = product(); while (isOp('+') || isOp('-')) { const o = take().op, r = product(); v = o === '+' ? v + r : v - r; } return v; }
  const v = sum();
  if (i < t.length) throw new TypeError('limits: unexpected text after the end of "' + src + '"');
  return missing || !Number.isFinite(v) ? null : v;
}

// A bound is a number or an expression string. Returns a number, or null when a value it needs is missing.
function bound(expr, values) {
  if (isNum(expr)) return expr;
  if (typeof expr !== 'string') throw new TypeError('limits.bound: expected a number or a string, got ' + typeof expr);
  return evaluate(expr, values, 0);
}

// A box value as a number: a finite number, or text that is only a number ('12', ' 3.5 '). Anything else (empty, 'abc', NaN, a list) is null.
function asNumber(v) {
  if (isNum(v)) return v;
  if (typeof v === 'string' && /^\s*-?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?\s*$/i.test(v)) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return null;
}

// Does the row apply to these values? A row with no `when` always does. A `when` whose id has no value does not.
function applies(row, values) {
  if (!row.when) return true;
  return hasOwn(values, row.when.id) && row.when.in.includes(values[row.when.id]);
}

const EPS = 1e-9;
const whole = (v, step) => Math.abs(v / step - Math.round(v / step)) < 1e-6;

// checkInputs(values) -> errors, one per bad value, in table order: [{ id, value, why, msg }].
//   why: 'not-a-number' | 'min' | 'max' | 'zeroOr' | 'step'. The value is reported as it was given and never changed.
// Only ids present in `values` are checked, and only rows whose `when` matches. Warnings are separate (warnInputs).
function checkInputs(values) {
  const errs = [];
  if (!isObj(values)) return errs;
  for (const row of TABLE) {
    if (!hasOwn(values, row.id) || !applies(row, values)) continue;
    const raw = values[row.id], v = asNumber(raw), bad = why => errs.push({ id: row.id, value: raw, why, msg: row.msg });
    if (v === null) { bad('not-a-number'); continue; }
    const lo = bound(row.min, values), hi = bound(row.max, values);
    if (lo !== null && v < lo - EPS) { bad('min'); continue; }
    if (hi !== null && v > hi + EPS) { bad('max'); continue; }
    if (row.zeroOr !== undefined) {
      const z = bound(row.zeroOr, values);
      if (z !== null && v !== 0 && v < z - EPS) { bad('zeroOr'); continue; }
    }
    if (row.step === 1 && !whole(v, 1)) bad('step');
  }
  return errs;
}

// warnInputs(values) -> warnings for values that are allowed but unusual: [{ id, value, why, msg }].
//   why: 'warnMin' | 'warnMax' | 'STICK' | 'N3D'. Rule 'M1' needs the geometry, so it belongs to the validity unit (RMA-6), not here.
//   A value that is an error gets no warning. 'N3D' reads values.model ('2d', '2D', '3d' or '3D').
function warnInputs(values) {
  const out = [];
  if (!isObj(values)) return out;
  const bad = new Set(checkInputs(values).map(e => e.id));
  for (const row of TABLE) {
    if (!hasOwn(values, row.id) || bad.has(row.id) || !applies(row, values)) continue;
    const raw = values[row.id], v = asNumber(raw);
    if (v === null) continue;
    const add = (why, msg) => out.push({ id: row.id, value: raw, why, msg });
    const noFoot = row.zeroOr !== undefined && v === 0;                // a zero the row allows (no foot) is not 'below the minimum'
    const lo = row.warnMin === undefined || noFoot ? null : bound(row.warnMin, values), hi = row.warnMax === undefined ? null : bound(row.warnMax, values);
    if (lo !== null && v < lo - EPS) add('warnMin', row.warnMsg || 'Below the usual minimum of ' + lo + '.');
    else if (hi !== null && v > hi + EPS) add('warnMax', row.warnMsg || 'Above the usual maximum of ' + hi + '.');
    if (row.warnRule === 'STICK' && Math.abs(v - STICK_MM) > EPS) add('STICK', row.warnMsg);
    if (row.warnRule === 'N3D' && isModel3D(values.model) && v !== 2) add('N3D', row.warnMsg);
  }
  return out;
}

// the app's own mode id is lowercase ('2d' / '3d', S.anaMode); a file or a caller may write '3D': both mean 3D
const isModel3D = m => typeof m === 'string' && m.toLowerCase() === '3d';

// ---------- geometry rules G1-G5 (Physics' doc, TE-B-370; board TE-B-458, RMA-6): the second half of the validity function ----------
// checkGeometry(truss, values) -> [{ rule: 'G1'..'G10', msg, where: [indexes] }], in rule order; empty = fine. Pure: nothing is changed.
//   truss: what core.js's buildTruss returns, or a file's truss in the same shape: nodes [[x, y], ...] (mm, y up), elems [{ i, j, ... }, ...]
//   (member k joins nodes i and j), keys (a name per node; 'B0', 'B1' ... are the bottom chord, left to right) and panelPts (the panel
//   points' x, left to right) when the truss has them. values: the stick size, bS and hS in mm (a missing or bad one reads as the course stick).
//   where: 0-based node indexes (G1 to G4) or member indexes (G5); the messages count from 1, as the people reading them do.
//   G7 to G10 (RMA-13, TE-B-537b as amended by TE-B-598): where is member indexes (G7, G8: two members, or the member and the joint's node
//   index) or [] (G9, G10). values may also carry docStock (the stick length, mm, G7); the truss's supports, pin and roller (G9, G10) and
//   design.loads (G9) are read when it has them. E, the strengths and the book masses are checkInputs' only, so one bad value gives one line.
// G4 and G10 carry unstable: true, and the function returns after either. A flat line gives only G4, not a wall of G5 (Physics). A damaged truss gives [] (CODE-N2); nothing here throws.
// Not checked here: G6 (merged into G5), M2 (checkResult, below: it needs a solved result) and M3 (Build Documents). Two joints that sit close together but are not joined by a member
// are not looked at; a joined pair is covered by the member length.
const TOL = 1e-6;
// One decimal: lengths print '5.0' (G5), heights print '-5' (G3, Physics' wording), so a flag keeps the .0 or drops it.
const r1 = (v, keep) => { const x = Math.round(v * 10) / 10; return keep ? x.toFixed(1) : String(x); };
const f1 = v => r1(v, true), fh = v => r1(v, false);
const minOf = a => { let m = Infinity; for (let i = 0; i < a.length; i++) if (a[i] < m) m = a[i]; return m; };   // loops, not apply: no row count can overflow the stack
const maxOf = a => { let m = -Infinity; for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; };
const GEOMETRY_MSG = {
  G1: 'The span must be more than 0 mm.',
  G2: j => 'Joint ' + j[0] + ' is left of joint ' + j[1] + '. Panels must run left to right, each wider than 0 mm.',
  G2same: j => 'Joint ' + j[0] + ' is not to the right of joint ' + j[1] + '. Panels must run left to right, each wider than 0 mm.',
  G3: (j, y) => 'Joint ' + j + ' is below the bottom line (' + fh(y) + ' mm). Heights can\'t be negative; it would swap which members pull and push.',
  G4: 'Every joint is on one line, so this truss can\'t carry load. No capacity is shown.',
  G5len: (m, len, min) => 'Member ' + m + ' is ' + f1(len) + ' mm long; the shortest allowed is ' + f1(min) + ' mm.',
  G5dup: (a, b) => 'Members ' + a + ' and ' + b + ' join the same two joints.',
  G7: (m, len, stock) => 'Member ' + m + ' is ' + fh(len) + ' mm; one stick is ' + fh(stock) + ' mm. Shorten it or mark a splice.',
  G8: (a, b) => 'Members ' + a + ' and ' + b + ' lie on top of each other on one line. Remove one, or end them at a shared joint. Not solved.',
  G8joint: (m, j) => 'Member ' + m + ' runs through joint ' + j + " but isn't joined to it. Split member " + m + ' at joint ' + j + ', or move the joint. Not solved.',
  G9load: (a, b) => 'The load must sit between the supports (' + fh(a) + ' to ' + fh(b) + ' mm).',
  G10: 'Too few members to hold this shape (it can fold). No capacity is shown.',
};
// G7: one stick, in mm: Physics' doc G7 ('one stick is 240 mm'), the same default as the Build Documents stick length (S.doc.stock).
// values.docStock replaces it when it is a finite positive number (TE-B-598 c).
const STOCK_MM = 240;
// G8 (TE-B-598 a): two members that cross away from any joint are NOT flagged. The app builds them on purpose (X panels, the odd-panel centre
// diagonals, the #298 arch through the flat bottom chord, which cutPlan cuts flush), and a planar pin-jointed model treats them as passing
// each other. G8 flags only (1) two members on one line that overlap (Math's M4, the botEnd < 0 style) and (2) a member that passes within
// JOINT_GAP of a joint it doesn't end at.
const JOINT_GAP = 0.5;                                        // mm (TE-B-598 a)
const cr = (ax, ay, bx, by) => ax * by - ay * bx;
// Do members p (p0-p1) and q (q0-q1) lie on one line and overlap by more than TOL (mm)?
function overlaps(p0, p1, q0, q1) {
  const rx = p1[0] - p0[0], ry = p1[1] - p0[1], sx = q1[0] - q0[0], sy = q1[1] - q0[1], Lr = Math.hypot(rx, ry), Ls = Math.hypot(sx, sy);
  if (Lr <= TOL || Ls <= TOL || Math.abs(cr(rx, ry, sx, sy)) / (Lr * Ls) > 1e-9) return false;   // a point, or not parallel
  const wx = q0[0] - p0[0], wy = q0[1] - p0[1];
  if (Math.abs(cr(wx, wy, rx, ry)) / Lr > TOL) return false;   // parallel but apart
  const a = (wx * rx + wy * ry) / Lr, b = ((q1[0] - p0[0]) * rx + (q1[1] - p0[1]) * ry) / Lr;   // q's ends along p
  return Math.min(Lr, Math.max(a, b)) - Math.max(0, Math.min(a, b)) > TOL;
}
// Does member p0-p1 pass within JOINT_GAP of point c, between its ends (not at them)?
function passesNear(p0, p1, c) {
  const rx = p1[0] - p0[0], ry = p1[1] - p0[1], L = Math.hypot(rx, ry);
  if (L <= TOL) return false;
  const t = ((c[0] - p0[0]) * rx + (c[1] - p0[1]) * ry) / L;   // mm along the member
  return t > JOINT_GAP && t < L - JOINT_GAP && Math.abs(cr(c[0] - p0[0], c[1] - p0[1], rx, ry)) / L < JOINT_GAP;
}

function checkGeometry(truss, values) {
  const out = [];
  if (!isObj(truss) || !Array.isArray(truss.nodes) || truss.nodes.length < 2) return out;
  const ok = p => Array.isArray(p) && isNum(p[0]) && isNum(p[1]);
  if (!truss.nodes.every(ok)) return out;
  const N = truss.nodes;
  // G1: span is more than 0 (the nodes' reach left to right)
  const xs = N.map(p => p[0]), span = maxOf(xs) - minOf(xs);
  if (!(span > TOL)) out.push({ rule: 'G1', msg: GEOMETRY_MSG.G1, where: [] });
  // G2: joints run left to right, each panel wider than 0: the panel points (panelPts, else the bottom chord B0, B1 ...)
  let pts = null;
  if (Array.isArray(truss.panelPts) && truss.panelPts.length >= 2 && truss.panelPts.every(isNum)) pts = truss.panelPts.map((x, i) => ({ x, n: i }));
  else if (Array.isArray(truss.keys) && truss.keys.length === N.length) {
    pts = truss.keys.map((k, i) => ({ k, i })).filter(o => typeof o.k === 'string' && /^B\d+$/.test(o.k)).sort((a, b) => +a.k.slice(1) - +b.k.slice(1)).map(o => ({ x: N[o.i][0], n: o.i }));
    if (pts.length < 2) pts = null;
  }
  if (pts) for (let a = 1; a < pts.length; a++) if (!(pts[a].x > pts[a - 1].x + TOL)) {
    const j = [pts[a].n + 1, pts[a - 1].n + 1];
    out.push({ rule: 'G2', msg: (pts[a].x < pts[a - 1].x - TOL ? GEOMETRY_MSG.G2 : GEOMETRY_MSG.G2same)(j), where: [pts[a].n, pts[a - 1].n] });
  }
  // G3: heights are 0 or more, but the lowest allowed joint is the design's own lowest shaped end (Physics, TE-B-470): a shaped bottom chord sags
  // to its curve (a negative number), and a shaped top chord may end below the deck line at topEnd (the arch pressing on the table faces).
  // botEnd is 0 or more, so it adds nothing. Without the design, or with flat chords, the line is y = 0 (strict). Anything lower is still G3.
  const dz = isObj(truss.design) ? truss.design : null;
  const shaped = k => dz && typeof dz[k] === 'string' && SHAPED.indexOf(dz[k]) >= 0;
  let sag = 0;
  if (shaped('bottom') && isNum(+dz.curve)) sag = Math.min(sag, +dz.curve);
  if (shaped('topShape') && isNum(+dz.topEnd)) sag = Math.min(sag, +dz.topEnd);
  N.forEach((p, i) => { if (p[1] < sag - TOL) out.push({ rule: 'G3', msg: GEOMETRY_MSG.G3(i + 1, p[1]), where: [i] }); });
  // G4: not every joint on one line (a flat line, or any one straight line): a mechanism, 'unstable', and nothing more is said about it
  const a0 = N[0], far = N.reduce((b, p) => (Math.hypot(p[0] - a0[0], p[1] - a0[1]) > Math.hypot(b[0] - a0[0], b[1] - a0[1]) ? p : b), a0);
  const dx = far[0] - a0[0], dy = far[1] - a0[1], len0 = Math.hypot(dx, dy);
  const oneLine = len0 <= TOL || N.every(p => Math.abs(dx * (p[1] - a0[1]) - dy * (p[0] - a0[0])) / len0 <= TOL);
  if (oneLine) { out.push({ rule: 'G4', msg: GEOMETRY_MSG.G4, where: [], unstable: true }); return out; }
  // G5: every member at least two stick widths long (2 x max(bS, hS)), and no two members join the same two joints
  const E = Array.isArray(truss.elems) ? truss.elems : [];
  const stick = v => (isObj(values) && isNum(asNumber(values[v])) && asNumber(values[v]) > 0 ? asNumber(values[v]) : STICK_MM);
  const min2 = 2 * Math.max(stick('bS'), stick('hS')), seen = new Map();
  E.forEach((e, m) => {
    if (!isObj(e) || !Number.isInteger(e.i) || !Number.isInteger(e.j) || !N[e.i] || !N[e.j]) return;
    const L = Math.hypot(N[e.i][0] - N[e.j][0], N[e.i][1] - N[e.j][1]);
    if (L < min2 - TOL) out.push({ rule: 'G5', msg: GEOMETRY_MSG.G5len(m + 1, L, min2), where: [m] });
    const key = Math.min(e.i, e.j) + '-' + Math.max(e.i, e.j);
    if (seen.has(key)) out.push({ rule: 'G5', msg: GEOMETRY_MSG.G5dup(seen.get(key) + 1, m + 1), where: [seen.get(key), m] }); else seen.set(key, m);
  });
  const good = [];                                            // the members that join two real joints: [index, member]
  E.forEach((e, m) => { if (isObj(e) && Number.isInteger(e.i) && Number.isInteger(e.j) && N[e.i] && N[e.j]) good.push([m, e]); });
  const num = k => (isObj(values) && hasOwn(values, k) ? asNumber(values[k]) : null);
  // G7: every member fits in one stick. Spliced members: a later row, once a member carries the mark (splices are cutPlan's today, #116).
  const ds = num('docStock'), stock = ds !== null && ds > 0 ? ds : STOCK_MM;
  good.forEach(([m, e]) => {
    const L = Math.hypot(N[e.i][0] - N[e.j][0], N[e.i][1] - N[e.j][1]);
    if (L > stock + TOL) out.push({ rule: 'G7', msg: GEOMETRY_MSG.G7(m + 1, L, stock), where: [m] });
  });
  // G8 (1): two members on one line that overlap (M4). A pair on the same two joints is G5's.
  const lapped = new Set();                                   // 'member:node' already told by an overlap, so (2) doesn't say it again
  for (let a = 0; a < good.length; a++) for (let b = a + 1; b < good.length; b++) {
    const [ma, ea] = good[a], [mb, eb] = good[b];
    if (Math.min(ea.i, ea.j) === Math.min(eb.i, eb.j) && Math.max(ea.i, ea.j) === Math.max(eb.i, eb.j)) continue;
    if (!overlaps(N[ea.i], N[ea.j], N[eb.i], N[eb.j])) continue;
    out.push({ rule: 'G8', msg: GEOMETRY_MSG.G8(ma + 1, mb + 1), where: [ma, mb] });
    [eb.i, eb.j].forEach(n => lapped.add(ma + ':' + n)); [ea.i, ea.j].forEach(n => lapped.add(mb + ':' + n));
  }
  // G8 (2): a member that passes within JOINT_GAP of a joint it doesn't end at
  good.forEach(([m, e]) => N.forEach((c, n) => {
    if (n === e.i || n === e.j || lapped.has(m + ':' + n)) return;
    if (passesNear(N[e.i], N[e.j], c)) out.push({ rule: 'G8', msg: GEOMETRY_MSG.G8joint(m + 1, n + 1), where: [m, n] });
  }));
  // G9 (TE-B-598 b): the load sits on the bridge: each load's x (a point load; a spread load by its middle) between the two supports (the
  // pin and the roller). No design.loads, or no supports to measure from, means nothing to check.
  const sx = n => (Number.isInteger(n) && N[n] ? N[n][0] : null);
  const lo = sx(truss.pin), hi = sx(truss.roller);
  if (dz && Array.isArray(dz.loads) && lo !== null && hi !== null) {
    const a = Math.min(lo, hi), b = Math.max(lo, hi);
    const at = q => (!isObj(q) ? null : isNum(q.x) ? q.x : isNum(q.a) && isNum(q.b) ? (q.a + q.b) / 2 : null);
    if (dz.loads.some(q => { const x = at(q); return x !== null && (x < a - TOL || x > b + TOL); })) out.push({ rule: 'G9', msg: GEOMETRY_MSG.G9load(a, b), where: [] });
  }
  // G10: enough members to hold the shape, members + support reactions >= 2 x joints. Reactions are counted as core.js analyze fixes them:
  // a pin or an edge hold fixes x and y (2), any other support y (1). Unstable like G4, and the function returns after it (TE-B-598 d).
  if (Array.isArray(truss.supports)) {
    const r = truss.supports.reduce((n, s) => n + (!isObj(s) ? 0 : s.pin || s.xHold ? 2 : 1), 0);
    if (E.length + r < 2 * N.length) { out.push({ rule: 'G10', msg: GEOMETRY_MSG.G10, where: [], unstable: true }); return out; }
  }
  return out;
}

// ---------- result rule M2 (Math, 'limits v0.4 draft' geometryRules M2; board TE-B-589, RMA-15) ----------
// checkResult(res, values) -> [{ rule: 'M2', msg, where: [] }] or []. No capacity when the mid-span deflection is more than the bridge height.
//   res: core.js analyze's result; d = res.midDefl (mm, at the book load). values: h = values.height (mm).
//   An unstable, missing or damaged res, or a missing height, gives [] (CODE-N2). Pure: nothing is changed, nothing throws.
// Nothing calls it yet: wiring it into fileReport, the results card or the sweep is a later row, after Math's OK.
const RESULT_MSG = {
  M2: (d, h) => 'No capacity: the mid-span deflection (' + f1(d) + ' mm) is more than the bridge height (' + fh(h) + ' mm).',
};
function checkResult(res, values) {
  if (!isObj(res) || res.stable !== true || !isNum(res.midDefl) || !isObj(values)) return [];
  const d = Math.abs(res.midDefl), h = values.height;
  if (!isNum(h) || !(h > 0)) return [];
  return d > h ? [{ rule: 'M2', msg: RESULT_MSG.M2(d, h), where: [] }] : [];
}

// ---------- fileReport: everything a file or a typed design breaks, in one object (board TE-B-459, RMA-8) ----------
// fileReport(values, truss) -> { bad: checkInputs(values), geometry: checkGeometry(truss, values), warnings: warnInputs(values), noResult, summary }
//   noResult: true when bad or geometry has any entry (no kg, no PASS, Physics' file rule); warnings alone never set it.
//   summary: one plain line, kept as data at the top of the file; '' when there is nothing to say (rule 4i: a good file gets no new message).
//   Pure: nothing is changed or clamped. A damaged values or truss reads as nothing to report (CODE-N2); nothing here throws for data.
//   checkResult (M2) is separate, not part of fileReport, because it needs a solved result (core.js analyze), not just the file.
// The words of the summary line, as data (Marketing may reword them; the code only fills in the counts and names).
const SUMMARY_MSG = Object.freeze({
  values: (n, ids) => n + (n === 1 ? ' value is' : ' values are') + ' outside the limits: ' + ids + '.',
  shape: (n, rules) => 'The shape breaks ' + (n === 1 ? 'rule ' : 'rules ') + rules + '.',
  fix: n => 'Fix ' + (n > 1 ? 'them' : 'it') + ' to get a result.',
});
function fileReport(values, truss) {
  const v = isObj(values) ? values : {};
  const bad = checkInputs(v), geometry = checkGeometry(truss, v), warnings = warnInputs(v);
  const ids = []; bad.forEach(b => { if (ids.indexOf(b.id) < 0) ids.push(b.id); });
  const rules = []; geometry.forEach(g => { if (rules.indexOf(g.rule) < 0) rules.push(g.rule); });
  const parts = [];
  if (ids.length) parts.push(SUMMARY_MSG.values(ids.length, ids.map(labelFor).join(', ')));
  if (rules.length) parts.push(SUMMARY_MSG.shape(rules.length, rules.join(', ')));
  const noResult = parts.length > 0;
  return { bad, geometry, warnings, noResult, summary: noResult ? parts.join(' ') + ' ' + SUMMARY_MSG.fix(ids.length + rules.length) : '' };
}

const rowFor = id => TABLE.find(r => r.id === id) || null;

const api = { TABLE, DERIVED, WHEN_IDS, SWEEP_RULE, STICK_MM, bound, checkInputs, warnInputs, checkGeometry, checkResult, fileReport, SUMMARY_MSG, LABELS, labelFor, rowFor };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussLimits = api;
})(typeof window !== 'undefined' ? window : globalThis);
