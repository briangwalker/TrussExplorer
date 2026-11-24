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
// This is the first half of the validity function: the geometry rules G1-G10 and M1-M4 are a later row (RMA-6).
// No DOM, no app state (CODE-F1, CODE-F4, CODE-F5): Node tests load it directly; build.py inlines it before app.js.
(function (root) {
'use strict';

const STICK_MM = 3.18;                  // the course stick, in mm
const SHAPED = ['parabola', 'arc', 'catenary'];

// Named values usable inside expressions, defined once (Math: 'stick2' = two stick widths, 6.36 mm at the course stick).
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

const rowFor = id => TABLE.find(r => r.id === id) || null;

const api = { TABLE, DERIVED, WHEN_IDS, SWEEP_RULE, STICK_MM, bound, checkInputs, warnInputs, rowFor };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussLimits = api;
})(typeof window !== 'undefined' ? window : globalThis);
