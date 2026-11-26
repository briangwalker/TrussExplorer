// The limits table and the input check (CODE-F1, CODE-F4, CODE-N2, CODE-N3; #420, #421). Board TE-B-373.
//   node --test tests/limits.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const L = require(path.join(__dirname, '..', 'src', 'limits.js'));

// A good set of values: every id at its app default (Dev Lead's CSV, TE-B-370b), so expressions resolve.
const DEF = { height: 70, topEnd: 0, curve: -30, botEnd: 0, panels: 4, ratio: 1, sideAngle: 90, deskPanels: 1, overlap: 48.4, tableThick: 30,
  braceDepth: 20, fricK: 2, fricMu: 0.4, supportOffset: 0, bookLen: 242, bookWidth: 209, bookThick: 32, FS: 2, deflLimit: 2, minOverlap: 5,
  width: 60, mBook1: 1.5, mBook2: 1, nTruss: 2, E: 3000, rho: 160, sigT: 7.5, sigC: 4.5, bS: 3.18, hS: 3.18, tilt3d: 0, width3d: 60,
  impAlpha: 0.02, impBeta: 0.005, autoLimit: 500, bigCap: 10000, rcFS: 2, rcBook: 2.5, rcDefl: 2, rcOv: 5, refStep: 0.5, woodBudget: 100,
  loadTarget: 1, docBendN: 3, docStock: 240, docKerf: 1, abSteps: 10, abExt: 0, model: '2D', bottom: 'parabola', topShape: 'parabola' };
const deepFreeze = o => { Object.values(o).forEach(v => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };
const only = (id, v, base = DEF) => L.checkInputs(Object.assign({}, base, { [id]: v })).filter(e => e.id === id);
const EPS = 0.001;

test('every id in DEF has a row, and every row has a default to test with', () => {
  for (const r of L.TABLE) assert.ok(r.id in DEF, 'default for ' + r.id);
  assert.strictEqual(L.TABLE.length, 48);
  assert.strictEqual(new Set(L.TABLE.map(r => r.id)).size, 48, 'no id twice');
  assert.deepStrictEqual(L.checkInputs(DEF), [], 'the defaults are all allowed');
  assert.deepStrictEqual(L.warnInputs(DEF), [], 'and raise no warning');
});

test('each row: below min, min, max, above max, text and empty (the 6 cases from Math)', () => {
  for (const r of L.TABLE) {
    const lo = L.bound(r.min, DEF), hi = L.bound(r.max, DEF);
    assert.strictEqual(typeof lo, 'number', r.id + ' min'); assert.strictEqual(typeof hi, 'number', r.id + ' max');
    assert.ok(lo <= hi, r.id + ' min <= max');
    const below = only(r.id, lo - EPS); assert.strictEqual(below.length, 1, r.id + ' below min'); assert.strictEqual(below[0].why, 'min', r.id);
    assert.strictEqual(below[0].msg, r.msg, r.id + ' says the row message'); assert.strictEqual(below[0].value, lo - EPS);
    assert.deepStrictEqual(only(r.id, lo), [], r.id + ' at min');
    assert.deepStrictEqual(only(r.id, hi), [], r.id + ' at max');
    const above = only(r.id, hi + EPS); assert.strictEqual(above.length, 1, r.id + ' above max'); assert.strictEqual(above[0].why, 'max', r.id);
    for (const junk of ['abc', '', '  ', NaN, Infinity, null, undefined, [], {}, true]) {
      const e = only(r.id, junk); assert.strictEqual(e.length, 1, r.id + ' ' + String(junk)); assert.strictEqual(e[0].why, 'not-a-number');
    }
  }
});

test('a value as text is read as a number; a file value is reported, not changed', () => {
  assert.deepStrictEqual(only('height', '50'), []);
  assert.deepStrictEqual(only('height', ' 50.5 '), []);
  assert.strictEqual(only('height', '5')[0].why, 'min');
  const file = deepFreeze(Object.assign({}, DEF, { height: 5, panels: 99 }));
  const copy = JSON.parse(JSON.stringify(file));
  const errs = L.checkInputs(file);
  assert.deepStrictEqual(errs.map(e => e.id + ':' + e.why), ['height:min', 'topEnd:max', 'botEnd:max', 'panels:max'], 'height 5 also leaves no room for the chord ends: all listed');
  assert.deepStrictEqual(file, copy, 'the input is exactly as it was');
  assert.strictEqual(errs[0].value, 5); assert.strictEqual(errs[3].value, 99);
});

test('whole numbers: every count row refuses a fraction inside its range (step)', () => {
  const frac = { panels: 2.5, deskPanels: 2.5, nTruss: 2.5, docBendN: 2.5, abSteps: 10.5, autoLimit: 100.5, bigCap: 2000.5 };
  for (const id of Object.keys(frac)) { const e = only(id, frac[id]); assert.strictEqual(e.length, 1, id); assert.strictEqual(e[0].why, 'step', id); }
  assert.deepStrictEqual(L.TABLE.filter(r => r.step === 1).map(r => r.id).sort(), Object.keys(frac).sort());
  assert.deepStrictEqual(only('ratio', 1.07), [], 'ratio step 0.05 is the box step, not a rule');
});

test('zeroOr: overlap and supportOffset are 0 or at least two stick widths', () => {
  for (const id of ['overlap', 'supportOffset']) {
    assert.deepStrictEqual(only(id, 0), [], id + ' 0'); assert.deepStrictEqual(only(id, 6.36), [], id + ' 6.36');
    const e = only(id, 3); assert.strictEqual(e.length, 1, id + ' 3'); assert.strictEqual(e[0].why, 'zeroOr');
  }
  assert.strictEqual(only('overlap', 6.4, Object.assign({}, DEF, { bS: 5 })).length, 1, 'stick 5 mm: 6.4 is below two sticks (10 mm)');
  assert.deepStrictEqual(only('overlap', 10, Object.assign({}, DEF, { bS: 5 })), []);
});

test('expressions follow the other values', () => {
  assert.strictEqual(L.bound('height-10', { height: 70 }), 60);
  assert.strictEqual(L.bound('-min(tableThick,50)', { tableThick: 30 }), -30);
  assert.strictEqual(L.bound('-min(tableThick,50)', { tableThick: 80 }), -50);
  assert.strictEqual(L.bound('stick2', { bS: 3.18, hS: 3.18 }), 6.36);
  assert.strictEqual(L.bound('stick2', { bS: 3.18, hS: 5 }), 10);
  assert.strictEqual(L.bound(7, {}), 7);
  assert.strictEqual(L.bound('height-10', {}), null, 'a missing value gives null, not a throw');
  assert.strictEqual(L.bound('height-10', { height: 'x' }), null);
  assert.strictEqual(L.bound('1+2*3-(4-1)/3', {}), 6);
  assert.strictEqual(L.bound('max(1,2,3)-min(4,5)', {}), -1);
  assert.deepStrictEqual(only('curve', 59, Object.assign({}, DEF, { height: 70 })), []);
  assert.strictEqual(only('curve', 61, Object.assign({}, DEF, { height: 70 }))[0].why, 'max');
  assert.deepStrictEqual(only('curve', 61, Object.assign({}, DEF, { height: 80 })), []);
  assert.strictEqual(only('braceDepth', 31)[0].why, 'max', 'brace deeper than the 30 mm table');
  assert.strictEqual(only('autoLimit', 10001)[0].why, 'max', 'auto limit above bigCap');
});

test('the parser refuses unknown names, other functions and bad syntax with a TypeError (CODE-N3)', () => {
  for (const bad of ['nope', 'height+nope', 'sqrt(4)', 'Math.max(1,2)', 'eval(1)', 'constructor', '__proto__', 'toString', 'abs(-1)',
    '1 +', '(1', '1)', 'max(1', 'max(1,)', 'max()', '1 2', '1 + * 2', '*2', 'a.b', '1;2', 'height=1', '"x"', '`x`', '1e3', '2**2', '', '   '])
    assert.throws(() => L.bound(bad, DEF), TypeError, JSON.stringify(bad));
  for (const bad of [{}, [], true, null, undefined, () => 1]) assert.throws(() => L.bound(bad, DEF), TypeError);
});

test('every expression in the table parses, and every name in it is an input id or a derived name', () => {
  for (const r of L.TABLE) for (const f of ['min', 'max', 'zeroOr', 'warnMin', 'warnMax']) if (r[f] !== undefined) {
    assert.doesNotThrow(() => L.bound(r[f], DEF), r.id + '.' + f);
    assert.notStrictEqual(L.bound(r[f], DEF), null, r.id + '.' + f);
  }
  for (const k of Object.keys(L.DERIVED)) assert.doesNotThrow(() => L.bound(L.DERIVED[k], DEF), k);
});

test('no row has an unknown `when` id; the rows are the real ones', () => {
  const ids = new Set(L.TABLE.map(r => r.id).concat(L.WHEN_IDS));
  for (const r of L.TABLE) if (r.when) {
    assert.ok(ids.has(r.when.id), r.id + ' when ' + r.when.id);
    assert.ok(Array.isArray(r.when.in) && r.when.in.length > 0 && r.when.in.every(x => typeof x === 'string'), r.id);
    assert.deepStrictEqual(Object.keys(r.when).sort(), ['id', 'in']);
  }
  assert.deepStrictEqual(L.TABLE.filter(r => r.when).map(r => r.id), ['curve', 'topEnd']);
  // the chord shapes the page really has: ids and values (ui.html / 60-sweep.js)
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.html'), 'utf8');
  assert.ok(html.includes('id="bottom"') && html.includes('id="topShape"'), 'seg ids exist');
  for (const r of L.TABLE.filter(r => r.when)) for (const v of r.when.in) assert.ok(html.includes('data-v="' + v + '"') || html.includes(v), v);
});

test('a row applies only when its `when` matches', () => {
  const flat = Object.assign({}, DEF, { bottom: 'flat', topShape: 'flat', curve: 9999, topEnd: -9999 });
  assert.deepStrictEqual(L.checkInputs(flat), [], 'a flat chord has no curve or end to check');
  assert.strictEqual(L.checkInputs(Object.assign({}, flat, { bottom: 'arc' })).some(e => e.id === 'curve'), true);
  assert.strictEqual(L.checkInputs(Object.assign({}, flat, { topShape: 'catenary' })).some(e => e.id === 'topEnd'), true);
  const noShape = Object.assign({}, DEF, { curve: 9999 }); delete noShape.bottom;
  assert.deepStrictEqual(L.checkInputs(noShape), [], 'no shape given: the row is skipped');
});

test('only ids that are present are checked; damaged input reads as nothing to check (CODE-N2)', () => {
  assert.deepStrictEqual(L.checkInputs({}), []);
  assert.deepStrictEqual(L.checkInputs({ height: 5 }).map(e => e.id), ['height']);
  assert.deepStrictEqual(L.checkInputs({ unknownId: 1e9 }), []);
  for (const bad of [null, undefined, 'x', 42, [], [1, 2], true, () => 1]) {
    assert.doesNotThrow(() => L.checkInputs(bad)); assert.deepStrictEqual(L.checkInputs(bad), []);
    assert.doesNotThrow(() => L.warnInputs(bad)); assert.deepStrictEqual(L.warnInputs(bad), []);
  }
  const inherited = Object.create({ height: 5 });
  assert.deepStrictEqual(L.checkInputs(inherited), [], 'inherited properties are not values');
  assert.doesNotThrow(() => L.checkInputs(JSON.parse('{"__proto__": {"height": 5}, "constructor": 1}')));
});

test('warnings are separate: allowed but unusual values', () => {
  const w = (id, v, extra) => L.warnInputs(Object.assign({}, DEF, extra, { [id]: v })).filter(x => x.id === id);
  assert.strictEqual(w('E', 1000)[0].why, 'warnMin'); assert.deepStrictEqual(only('E', 1000), []);
  assert.match(w('E', 1000)[0].msg, /Outside 1500-6000 MPa/);
  assert.strictEqual(only('E', 400)[0].msg, 'E must be 500 to 10000 MPa.', 'the hard message states its own range (v0.4)');
  assert.strictEqual(only('rho', 40)[0].msg, 'Density must be 50 to 400 kg/m3.');
  assert.deepStrictEqual(w('botEnd', 0), [], 'botEnd has no warning (v0.4)');
  assert.deepStrictEqual(w('overlap', 0), [], 'no foot (0) is not below the minimum overlap');
  assert.strictEqual(w('overlap', 6.5, { minOverlap: 10 })[0].why, 'warnMin'); assert.strictEqual(w('overlap', 6.5, { minOverlap: 10 })[0].msg, 'Below the minimum overlap you set.');
  assert.match(w('mBook1', 11)[0].msg, /far beyond the course test/); assert.match(w('FS', 1.2)[0].msg, /the course uses 2/); assert.match(w('curve', 55, { height: 70 })[0].msg, /within 20 mm of the top chord/);
  assert.strictEqual(w('E', 7000)[0].why, 'warnMax'); assert.deepStrictEqual(w('E', 3000), []);
  assert.match(w('height', 15)[0].msg, /buckling decides the capacity/);
  assert.strictEqual(w('height', 15)[0].why, 'warnMin'); assert.deepStrictEqual(w('height', 20), []);
  assert.strictEqual(w('mBook1', 11)[0].why, 'warnMax');
  assert.strictEqual(w('FS', 1.2)[0].why, 'warnMin');
  assert.strictEqual(w('curve', 55, { height: 70 })[0].why, 'warnMax', 'curve above height-20');
  assert.deepStrictEqual(w('E', 100), [], 'an error gets no warning');
  assert.strictEqual(only('E', 100)[0].why, 'min');
  // course stick
  assert.deepStrictEqual(w('bS', 3.18), []); assert.strictEqual(w('bS', 4)[0].why, 'STICK'); assert.match(w('hS', 2.5)[0].msg, /Not the course stick/);
  // 3D: nTruss other than 2
  assert.deepStrictEqual(w('nTruss', 3), [], 'in 2D no warning');
  assert.strictEqual(w('nTruss', 3, { model: '3D' })[0].why, 'N3D'); assert.strictEqual(w('nTruss', 3, { model: '3D' })[0].msg, 'The 3D result models two trusses only.');
  assert.deepStrictEqual(w('nTruss', 2, { model: '3D' }), []);
  for (const m of ['3d', '3D']) assert.strictEqual(w('nTruss', 3, { model: m })[0].why, 'N3D', 'model ' + m + ' (the app writes 3d, S.anaMode)');
  for (const m of ['2d', '2D', '', undefined, null, 3, {}]) assert.deepStrictEqual(w('nTruss', 3, { model: m }), [], 'model ' + String(m));
  // M1 needs the geometry: not raised here
  assert.deepStrictEqual(w('sideAngle', 20), []);
});

test('no dynamic code: the source never runs text as code', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'limits.js'), 'utf8');
  assert.ok(!/\beval\s*\(/.test(src) && !/\bFunction\s*\(/.test(src) && !/\bnew\s+Function\b/.test(src) && !/setTimeout\s*\(\s*['"`]/.test(src));
  assert.ok(!/\b(document|window\.|localStorage|require\s*\()/.test(src.replace(/typeof window[^\n]*/g, '')), 'no DOM, no app state, no imports (CODE-F1, CODE-F5)');
});

test('the table is frozen and standalone; the global is TrussLimits (CODE-F1)', () => {
  assert.ok(Object.isFrozen(L.TABLE) && Object.isFrozen(L.DERIVED) && Object.isFrozen(L.WHEN_IDS));
  const vm = require('node:vm'), ctx = { window: undefined }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'limits.js'), 'utf8'), ctx);
  assert.strictEqual(typeof ctx.TrussLimits.checkInputs, 'function');
  assert.strictEqual(L.rowFor('height').min, 10); assert.strictEqual(L.rowFor('nope'), null);
});

test('height: 10 to 200 mm (Math, TE-B-520: 100 is the course rule, not a model limit); the slider still stops at 100', () => {
  for (const v of [10, 100, 150, 200]) assert.deepStrictEqual(L.checkInputs(Object.assign({}, DEF, { height: v })).filter(e => e.id === 'height'), [], 'height ' + v);
  for (const [v, why] of [[9.9, 'min'], [200.1, 'max'], [1000, 'max'], ['abc', 'not-a-number']]) assert.strictEqual(L.checkInputs(Object.assign({}, DEF, { height: v })).filter(e => e.id === 'height')[0].why, why, 'height ' + v);
  const row = L.rowFor('height'); assert.strictEqual(row.max, 200); assert.strictEqual(row.msg, 'Height must be 10 to 200 mm.'); assert.strictEqual(row.sliderMax, 100); assert.strictEqual(row.sliderMin, 10);
});

// ---------- RMA-6 (TE-B-458): geometry rules G1-G5, checkGeometry(truss, values) (Physics' doc, TE-B-370) ----------
const { C, design, cases, DEFAULT } = require(path.join(__dirname, 'lib.js'));
const F = require(path.join(__dirname, '..', 'src', 'formats.js'));
const rules = r => r.map(x => x.rule);
// a small good truss: bottom chord B0..B4 at 0..220, top joint T2 at y 26
const goodTruss = () => ({ nodes: [[0, 0], [55, 0], [110, 0], [165, 0], [220, 0], [110, 26]], keys: ['B0', 'B1', 'B2', 'B3', 'B4', 'T2'],
  elems: [{ i: 0, j: 1 }, { i: 1, j: 2 }, { i: 2, j: 3 }, { i: 3, j: 4 }, { i: 0, j: 5 }, { i: 5, j: 4 }, { i: 1, j: 5 }, { i: 3, j: 5 }, { i: 2, j: 5 }] });
const cloneT = t => JSON.parse(JSON.stringify(t));

test('G1-G5: Physics\' good example passes clean, and nothing is changed', () => {
  const t = goodTruss(), copy = cloneT(t);
  assert.deepStrictEqual(L.checkGeometry(t, {}), []);
  assert.deepStrictEqual(L.checkGeometry(deepFreeze(t), { bS: 3.18, hS: 3.18 }), []);
  assert.deepStrictEqual(t, copy);
});

test('G1: a span of 0 is refused (all joints at one x)', () => {
  const t = { nodes: [[0, 0], [0, 10], [0, 26]], elems: [{ i: 0, j: 1 }, { i: 1, j: 2 }] };
  const r = L.checkGeometry(t, {});
  assert.ok(rules(r).includes('G1')); assert.strictEqual(r.find(x => x.rule === 'G1').msg, 'The span must be more than 0 mm.');
  assert.ok(!rules(L.checkGeometry(goodTruss(), {})).includes('G1'));
});

test('G2: panel points must run left to right, each panel wider than 0', () => {
  const t = goodTruss(); t.nodes[2][0] = 40;              // B2 at 40 is left of B1 at 55 (B0, B1, B2 = joints 1, 2, 3)
  const r = L.checkGeometry(t, {}).filter(x => x.rule === 'G2');
  assert.strictEqual(r.length, 1); assert.strictEqual(r[0].msg, 'Joint 3 is left of joint 2. Panels must run left to right, each wider than 0 mm.'); assert.deepStrictEqual(r[0].where, [2, 1]);
  const same = goodTruss(); same.nodes[2][0] = 55;        // a panel of width 0
  assert.strictEqual(L.checkGeometry(same, {}).find(x => x.rule === 'G2').msg, 'Joint 3 is not to the right of joint 2. Panels must run left to right, each wider than 0 mm.');
  const pp = Object.assign(goodTruss(), { panelPts: [0, 80, 60, 220] });   // Physics' bad example, through panelPts
  assert.strictEqual(L.checkGeometry(pp, {}).find(x => x.rule === 'G2').msg, 'Joint 3 is left of joint 2. Panels must run left to right, each wider than 0 mm.');
  assert.deepStrictEqual(rules(L.checkGeometry(Object.assign(goodTruss(), { panelPts: [0, 55, 110, 165, 220] }), {})), []);
  const two = goodTruss(); two.nodes[1][0] = 10; two.nodes[2][0] = 5;      // several bad panels: every one is listed (F2)
  assert.ok(L.checkGeometry(two, {}).filter(x => x.rule === 'G2').length >= 1);
});

test('G3: a joint below the bottom line is refused, with its height in the message', () => {
  const t = goodTruss(); t.nodes[3][1] = -5;
  const r = L.checkGeometry(t, {}).filter(x => x.rule === 'G3');
  assert.strictEqual(r.length, 1); assert.deepStrictEqual(r[0].where, [3]);
  assert.strictEqual(r[0].msg, 'Joint 4 is below the bottom line (-5 mm). Heights can\'t be negative; it would swap which members pull and push.');
  const two = goodTruss(); two.nodes[1][1] = -5; two.nodes[3][1] = -8; assert.strictEqual(L.checkGeometry(two, {}).filter(x => x.rule === 'G3').length, 2, 'every one is listed');
  // a shaped bottom chord sags below the desk line by design: down to its curve, no further
  const sag = goodTruss(); sag.nodes[2][1] = -30; sag.design = { bottom: 'parabola', curve: -30 };
  assert.ok(!rules(L.checkGeometry(sag, {})).includes('G3'));
  sag.nodes[2][1] = -35; assert.ok(rules(L.checkGeometry(sag, {})).includes('G3'));
  sag.design = { bottom: 'flat', curve: -30 }; sag.nodes[2][1] = -30; assert.ok(rules(L.checkGeometry(sag, {})).includes('G3'), 'a flat bottom does not sag');
});

// Brian's final design (Math's file 'BrianFinalV2 option A + h26 (checked)': flat bottom, catenary top, topEnd -15, tableThick 30, 4 panels, h 26).
// Its arch ends sit 15 mm below the deck line by design, so they must not read as G3 (Physics, TE-B-470). No fixture in tests/formats/fixtures has a
// negative topEnd, nor do the 36 built-in cases, which is how this was missed; this design is the one that covers it.
const FINAL = { family: 'grid', height: 26, panels: 4, ratio: 0.5, sideAngle: 90, sideLean: 'in', overall: 296.8, bookLen: 242, approachDiag: 'X', edgeVert: true, deskVert: true,
  deskMode: 'length', deskPanels: 1, bottom: 'flat', curve: -30, deskEnds: 'feet', supportMode: 'all', topShape: 'catenary', topEnd: -15, botEnd: 0, tableThick: 30, overlap: 10,
  diagLeft: ['N', 'P'], diagMiddle: 'X', vertLeft: [true, true] };
const finalTruss = () => C.buildTruss(design(Object.assign({}, DEFAULT, FINAL)));

test('G3: Brian\'s final design (catenary top, topEnd -15) gives [], and a joint below its own lowest end still gives G3', () => {
  const t = finalTruss();
  assert.ok(t.nodes.some(p => p[1] < -14.9), 'the design really has joints at -15');
  assert.deepStrictEqual(L.checkGeometry(t, {}), []);
  const lower = cloneT(t); const k = lower.nodes.findIndex(p => p[1] < -14.9); lower.nodes[k][1] = -16;
  const r = L.checkGeometry(lower, {}).filter(x => x.rule === 'G3');
  assert.strictEqual(r.length, 1); assert.deepStrictEqual(r[0].where, [k]);
  // the flat top does not get the allowance, and a shaped top with a positive topEnd does not either
  const flatTop = cloneT(t); flatTop.design.topShape = 'flat'; assert.ok(rules(L.checkGeometry(flatTop, {})).includes('G3'));
  const pos = cloneT(t); pos.design.topEnd = 10; assert.ok(rules(L.checkGeometry(pos, {})).includes('G3'));
});

test('G4: every joint on one line is a mechanism: unstable, and only G4 is said', () => {
  const flat = { nodes: [[0, 0], [55, 0], [110, 0], [220, 0]], elems: [{ i: 0, j: 1 }, { i: 1, j: 2 }, { i: 2, j: 3 }, { i: 0, j: 0 }, { i: 1, j: 1 }] };
  const r = L.checkGeometry(flat, {});
  assert.deepStrictEqual(rules(r), ['G4'], 'not a wall of G5s'); assert.strictEqual(r[0].unstable, true);
  assert.strictEqual(r[0].msg, 'Every joint is on one line, so this truss can\'t carry load. No capacity is shown.');
  const slanted = { nodes: [[0, 0], [50, 50], [100, 100]], elems: [{ i: 0, j: 1 }, { i: 1, j: 2 }] };
  assert.ok(rules(L.checkGeometry(slanted, {})).includes('G4'), 'any one line, not only y = 0');
  assert.ok(!rules(L.checkGeometry(goodTruss(), {})).includes('G4'));
  assert.strictEqual(L.checkGeometry(goodTruss(), {}).find(x => x.unstable), undefined);
});

test('G5: members at least two stick widths long, and no two members join the same joints', () => {
  const t = goodTruss(); t.nodes[1] = [5, 0]; t.nodes[0] = [0, 0];       // member 1 (B0-B1) is 5 mm
  const r = L.checkGeometry(t, {}).filter(x => x.rule === 'G5');
  assert.ok(r.some(x => x.msg === 'Member 1 is 5.0 mm long; the shortest allowed is 6.4 mm.' && x.where[0] === 0));
  const ok = goodTruss(); ok.nodes[1] = [6.36, 0];                          // exactly two sticks (6.36): allowed
  assert.ok(!L.checkGeometry(ok, {}).some(x => x.rule === 'G5' && x.where[0] === 0));
  const stick5 = goodTruss(); stick5.nodes[1] = [8, 0];                    // 8 mm is long enough for 3.18, not for a 5 mm stick (10 mm)
  assert.ok(!L.checkGeometry(stick5, {}).some(x => x.rule === 'G5' && x.where[0] === 0));
  assert.ok(L.checkGeometry(stick5, { bS: 5 }).some(x => x.rule === 'G5' && x.where[0] === 0 && /shortest allowed is 10\.0 mm/.test(x.msg)));
  assert.ok(L.checkGeometry(stick5, { bS: 'abc', hS: -1 }).every(x => x.where[0] !== 0 || x.rule !== 'G5'), 'a bad stick size reads as the course stick');
  const dup = goodTruss(); dup.elems.push({ i: 4, j: 3 });                // members 4 (3-4) and 10 (4-3)
  const d = L.checkGeometry(dup, {}).filter(x => x.rule === 'G5');
  assert.strictEqual(d.length, 1); assert.strictEqual(d[0].msg, 'Members 4 and 10 join the same two joints.'); assert.deepStrictEqual(d[0].where, [3, 9]);
});

test('damaged or odd input reads as nothing to report, and never throws (CODE-N2)', () => {
  for (const bad of [null, undefined, 'x', 42, [], {}, { nodes: [] }, { nodes: [[0, 0]] }, { nodes: 'x' }, { nodes: [[0, 0], [1, 'a']] }, { nodes: [[0, 0], [NaN, 1]] }, { nodes: [null, [1, 1]] }])
    assert.deepStrictEqual(L.checkGeometry(bad, {}), [], JSON.stringify(bad));
  const t = goodTruss(); t.elems = [null, 5, { i: 0 }, { i: 99, j: 0 }, { i: 0, j: 1.5 }, { i: 'a', j: 'b' }, { i: 0, j: 1 }];
  assert.doesNotThrow(() => L.checkGeometry(t, null)); assert.deepStrictEqual(L.checkGeometry(t, null), []);
  assert.deepStrictEqual(L.checkGeometry(Object.assign(goodTruss(), { elems: 'x', keys: 5, panelPts: 'y', design: 7 }), 3), []);
  assert.ok(Object.keys(L).includes('checkGeometry'));
});

test('the built-in cases pass the geometry rules clean (rule 4i): no new message on a good design', () => {
  const list = cases().filter(cs => !cs.name.startsWith('saved:')); assert.ok(list.length >= 30);
  for (const cs of list) assert.deepStrictEqual(L.checkGeometry(C.buildTruss(design(cs.state)), {}), [], cs.name);
});

test('every bridge fixture in tests/formats/fixtures passes the geometry rules clean', () => {
  const dir = path.join(__dirname, 'formats', 'fixtures'), files = fs.readdirSync(dir).filter(f => f.endsWith('.bridge.json'));
  assert.ok(files.length >= 4); let built = 0;
  for (const f of files) {
    const o = F.open(fs.readFileSync(path.join(dir, f), 'utf8')); assert.ok(o.ok, f);
    const st = Object.assign({}, DEFAULT, o.doc.bridge);
    let tr; try { tr = C.buildTruss(design(st)); } catch (e) { continue; }
    built++; assert.deepStrictEqual(L.checkGeometry(tr, {}), [], f);
  }
  assert.ok(built >= 3, 'built ' + built);
});

test('file cases F1, F2 and F4 where they fit G1-G5: bad values listed, a good file untouched', () => {
  const t = goodTruss(); t.nodes[4][0] = 100; t.nodes[3][1] = -5; t.nodes[1] = [5, 0];       // F2: several bad values, every one listed
  const r = L.checkGeometry(t, {}); assert.ok(['G2', 'G3', 'G5'].every(x => rules(r).includes(x)));
  assert.ok(r.every(x => typeof x.msg === 'string' && Array.isArray(x.where)));              // F1: each one names where, so the page can mark it
  assert.deepStrictEqual(L.checkGeometry(goodTruss(), {}), []);                                // F4: a good file gives nothing
});

// ---------- RMA-8 (TE-B-459): fileReport(values, truss) and Physics' file cases F1-F6 ----------
const hasNaN = rep => /NaN|undefined/.test(JSON.stringify(rep));

test('fileReport: the shape, and a good file gets nothing new (F4, rule 4i)', () => {
  const rep = L.fileReport({}, goodTruss());
  assert.deepStrictEqual(Object.keys(rep).sort(), ['bad', 'geometry', 'noResult', 'summary', 'warnings']);
  assert.deepStrictEqual(rep, { bad: [], geometry: [], warnings: [], noResult: false, summary: '' });
  for (const cs of cases().filter(c => !c.name.startsWith('saved:'))) {
    const rep2 = L.fileReport(DEF, C.buildTruss(design(cs.state)));
    assert.strictEqual(rep2.noResult, false, cs.name); assert.strictEqual(rep2.summary, '', cs.name); assert.deepStrictEqual(rep2.geometry, [], cs.name);
  }
  // Brian's final design (catenary top, topEnd -15) is a good file too (Physics, TE-B-470)
  assert.deepStrictEqual(L.fileReport(DEF, finalTruss()), { bad: [], geometry: [], warnings: [], noResult: false, summary: '' });
});

test('fileReport F1: a G2 bad value is listed with where, and there is no result', () => {
  const t = goodTruss(); t.nodes[2][0] = 40;
  const rep = L.fileReport({}, t);
  assert.strictEqual(rep.noResult, true); assert.strictEqual(rep.geometry[0].rule, 'G2'); assert.deepStrictEqual(rep.geometry[0].where, [2, 1]);
  // joint 3 at x 40 also folds members 1, 2 and 3 over each other on the bottom line: each overlap is G8 (Math's M4, RMA-13)
  assert.strictEqual(rep.summary, 'The shape breaks rules G2, G8. Fix them to get a result.');
  assert.deepStrictEqual(rep.geometry.filter(g => g.rule === 'G8').map(g => g.where), [[0, 1], [0, 2], [1, 2]]);
});

test('fileReport F2: several bad values are all listed, not only the first; summary counts them', () => {
  const t = goodTruss(); t.nodes[4][0] = 100; t.nodes[3][1] = -5;
  const rep = L.fileReport({ height: 500, E: 'abc' }, t);
  assert.ok(rep.bad.length >= 2 && rep.geometry.length >= 2); assert.strictEqual(rep.noResult, true);
  // joint 5 at x 100 also folds member 4 back over members 2 and 3 on the bottom line: that overlap is G8 (Math's M4, RMA-13)
  assert.strictEqual(rep.summary, '2 values are outside the limits: Height, Stiffness (E). The shape breaks rules G2, G3, G8. Fix them to get a result.');
  assert.strictEqual(L.fileReport({ height: 500 }, null).summary, '1 value is outside the limits: Height. Fix it to get a result.');
});

test('fileReport F3: a bad number-box value in a file is reported exactly as a typed entry (checkInputs)', () => {
  const vals = { height: 500, panels: 2.5, E: -3000 };
  assert.deepStrictEqual(L.fileReport(vals, goodTruss()).bad, L.checkInputs(vals));
  assert.deepStrictEqual(L.fileReport(vals, goodTruss()).warnings, L.warnInputs(vals));
});

test('fileReport F5: fixing the bad value clears the mark and the result returns; warnings alone never block', () => {
  const t = goodTruss(); t.nodes[2][0] = 40;
  assert.strictEqual(L.fileReport({ height: 500 }, t).noResult, true);
  const fixed = L.fileReport({ height: 50 }, goodTruss());
  assert.strictEqual(fixed.noResult, false); assert.deepStrictEqual(fixed.bad, []); assert.deepStrictEqual(fixed.geometry, []);
  const warn = L.fileReport({ bS: 20, hS: 20 }, goodTruss());
  if (warn.warnings.length) { assert.strictEqual(warn.noResult, warn.bad.length > 0 || warn.geometry.length > 0); }
});

test('fileReport F6: -300, 1e9 and abc in any number box: no crash, no NaN shown, never silently fine for abc', () => {
  for (const r of L.TABLE) for (const x of [-300, 1e9, 'abc']) {
    let rep; assert.doesNotThrow(() => { rep = L.fileReport(Object.assign({ bottom: 'parabola', topShape: 'arc', model: '2D' }, { [r.id]: x }), goodTruss()); }, r.id + ' ' + x);
    assert.ok(!hasNaN(rep), r.id + ' ' + x);
    if (x === 'abc') { assert.ok(rep.bad.some(b => b.id === r.id), r.id + ' abc is reported'); assert.strictEqual(rep.noResult, true); }
  }
});

test('fileReport: damaged values or truss read as nothing to report (CODE-N2), nothing is changed', () => {
  for (const bad of [null, undefined, 'x', 7, [], NaN]) assert.doesNotThrow(() => L.fileReport(bad, bad));
  assert.deepStrictEqual(L.fileReport(null, null), { bad: [], geometry: [], warnings: [], noResult: false, summary: '' });
  const vals = { height: 500 }, t = goodTruss(), v0 = JSON.stringify(vals), t0 = JSON.stringify(t);
  L.fileReport(vals, t); assert.strictEqual(JSON.stringify(vals), v0); assert.strictEqual(JSON.stringify(t), t0);
  assert.ok(Object.keys(L).includes('fileReport'));
});

test('fileReport: the summary names the people-readable labels, every table id has one, and an unknown id prints as it is', () => {
  for (const r of L.TABLE) assert.ok(typeof L.LABELS[r.id] === 'string' && L.LABELS[r.id].length, r.id + ' has a label');
  assert.deepStrictEqual(Object.keys(L.LABELS).filter(k => !L.rowFor(k)), [], 'no label without a row');
  assert.strictEqual(L.labelFor('bS'), 'Stick width'); assert.strictEqual(L.labelFor('__proto__'), '__proto__'); assert.strictEqual(L.labelFor('nope'), 'nope');
  assert.ok(Object.isFrozen(L.LABELS));
  assert.strictEqual(L.fileReport({ bS: 50, hS: 50, mBook1: -1 }, null).summary, '3 values are outside the limits: Book mass 1, Stick width, Stick depth. Fix them to get a result.');
});

// ---------- RMA-13 (TE-B-537b, amended by TE-B-598): geometry rules G7-G10 in checkGeometry (Physics' doc, TE-B-370) ----------
const tri = w => ({ nodes: [[0, 0], [w, 0], [w / 2, 30]], elems: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 1, j: 2 }] });
// a 100 x 50 panel: joints 1-4 counter-clockwise from the bottom left; pin at joint 1, roller at joint 2 (3 reactions)
const panel = elems => ({ nodes: [[0, 0], [100, 0], [100, 50], [0, 50]], elems: elems.map(([i, j]) => ({ i, j })), supports: [{ node: 0, pin: true }, { node: 1, pin: false }], pin: 0, roller: 1 });
const SIDES = [[0, 1], [1, 2], [2, 3], [3, 0]];

test('G7: every member fits in one 240 mm stick (Physics\' bad 260, good 239); a finite positive docStock replaces 240', () => {
  assert.deepStrictEqual(L.checkGeometry(tri(260), {}), [{ rule: 'G7', msg: 'Member 1 is 260 mm; one stick is 240 mm. Shorten it or mark a splice.', where: [0] }]);
  assert.deepStrictEqual(L.checkGeometry(tri(239), {}), []);
  assert.deepStrictEqual(L.checkGeometry(tri(240), {}), [], 'exactly one stick is fine');
  assert.deepStrictEqual(L.checkGeometry(tri(260), { docStock: 300 }), []);
  assert.deepStrictEqual(L.checkGeometry(tri(260), { docStock: '200' }).map(x => x.msg), ['Member 1 is 260 mm; one stick is 200 mm. Shorten it or mark a splice.']);
  for (const ds of [-5, 0, 'abc', null, NaN, Infinity]) assert.deepStrictEqual(rules(L.checkGeometry(tri(260), { docStock: ds })), ['G7'], 'not a finite positive docStock reads as 240: ' + ds);
  // TE-B-598: docStock 150 makes a 160 mm diagonal G7
  const d = { nodes: [[0, 0], [128, 0], [128, 96]], elems: [{ i: 0, j: 1 }, { i: 1, j: 2 }, { i: 0, j: 2 }] };   // the diagonal is 160 mm
  assert.deepStrictEqual(L.checkGeometry(d, { docStock: 150 }), [{ rule: 'G7', msg: 'Member 3 is 160 mm; one stick is 150 mm. Shorten it or mark a splice.', where: [2] }]);
  assert.deepStrictEqual(L.checkGeometry(d, {}), []);
});

test('G8 (TE-B-598 a): two members crossing away from a joint are not flagged (X panels, the #298 arch, Brian\'s final design)', () => {
  assert.deepStrictEqual(L.checkGeometry(panel(SIDES.concat([[0, 2], [1, 3]])), {}), [], 'an X panel with no joint at the crossing');
  const joined = panel(SIDES.concat([[0, 4], [4, 2], [1, 4], [4, 3]])); joined.nodes.push([50, 25]);
  assert.deepStrictEqual(L.checkGeometry(joined, {}), [], 'the same diagonals with a joint at the crossing');
  for (const name of ['x-N3-h30', 'pratt-N3-h30', 'howe-N5-h70']) {
    const cs = cases().find(c => c.name === name); assert.ok(cs, name);
    assert.deepStrictEqual(L.checkGeometry(C.buildTruss(design(cs.state)), {}), [], name);
  }
  const arch = Object.assign({}, DEFAULT, { height: 30, panels: 4, deskMode: 'length', overlap: 48.4, deskEnds: 'feet', topShape: 'catenary', topEnd: -27, botEnd: 0, pattern: 'pratt', diagLeft: ['P', 'P'], vertLeft: [true, true] });
  assert.deepStrictEqual(L.checkGeometry(C.buildTruss(design(arch)), {}), [], 'the #298 arch through the bottom chord');
  assert.deepStrictEqual(rules(L.checkGeometry(finalTruss(), {})).filter(r => r === 'G8'), [], 'Brian\'s final design');
});

test('G8 (TE-B-598 a): members on one line that overlap (M4), and a member through a joint it doesn\'t end at', () => {
  const lap = panel(SIDES.concat([[0, 2], [0, 4], [4, 2]])); lap.nodes.push([50, 0]);  // member 6 lies along member 1 from joint 1
  assert.deepStrictEqual(L.checkGeometry(lap, {}), [{ rule: 'G8', msg: 'Members 1 and 6 lie on top of each other on one line. Remove one, or end them at a shared joint. Not solved.', where: [0, 5] }], 'said once, not again as joint 5 on member 1');
  const mid = panel(SIDES.concat([[0, 2], [3, 1], [4, 1]])); mid.nodes.push([40, 20]);   // joint 5 sits on diagonal 5 (0,0)-(100,50), which doesn't join it
  assert.deepStrictEqual(L.checkGeometry(mid, {}), [{ rule: 'G8', msg: "Member 5 runs through joint 5 but isn't joined to it. Split member 5 at joint 5, or move the joint. Not solved.", where: [4, 4] }],
    'where: the member and the joint\'s node index; the X crossing at the centre is not flagged');
  mid.elems[4] = { i: 0, j: 4 }; mid.elems.push({ i: 4, j: 2 });
  assert.deepStrictEqual(L.checkGeometry(mid, {}), [], 'the diagonal split at joint 5');
  const near = panel(SIDES.concat([[0, 2]])); near.nodes.push([50, 25.4]); near.elems.push({ i: 4, j: 3 }, { i: 4, j: 1 });   // 0.36 mm off the diagonal
  assert.deepStrictEqual(rules(L.checkGeometry(near, {})), ['G8'], 'within 0.5 mm');
  near.nodes[4] = [50, 26]; assert.deepStrictEqual(L.checkGeometry(near, {}), [], '0.89 mm off: not G8');
  assert.deepStrictEqual(L.checkGeometry(panel(SIDES.concat([[0, 2]])), {}), [], 'members that meet at a shared joint');
  const apart = panel(SIDES.concat([[0, 2], [4, 5]])); apart.nodes.push([60, 10], [90, 40]);   // parallel to a diagonal, beside it
  assert.ok(!rules(L.checkGeometry(apart, {})).includes('G8'));
});

test('G9 (TE-B-598 b): only the load inside the span, between the pin and the roller; materials and books stay checkInputs\'', () => {
  const at = (x, more) => Object.assign(panel(SIDES.concat([[0, 2]])), { design: { span: 100, loads: [Object.assign({ type: 'point', x, w: 1 }, more)] } });
  assert.deepStrictEqual(L.checkGeometry(at(150), {}), [{ rule: 'G9', msg: 'The load must sit between the supports (0 to 100 mm).', where: [] }]);
  assert.ok(rules(L.checkGeometry(at(-1), {})).includes('G9'));
  for (const x of [0, 50, 100]) assert.deepStrictEqual(L.checkGeometry(at(x), {}), [], 'load at ' + x);
  const spread = at(0); spread.design.loads[0] = { type: 'partial', a: 80, b: 180, w: 1 };
  assert.ok(rules(L.checkGeometry(spread, {})).includes('G9'), 'a spread load is placed by its middle (130)');
  spread.design.loads[0] = { type: 'partial', a: -20, b: 60, w: 1 }; assert.deepStrictEqual(L.checkGeometry(spread, {}), [], 'middle 20: on the bridge');
  const noLoads = panel(SIDES.concat([[0, 2]])); noLoads.design = { span: 100 }; assert.deepStrictEqual(L.checkGeometry(noLoads, {}), [], 'no d.loads: nothing');
  const noPin = at(150); delete noPin.pin; assert.deepStrictEqual(L.checkGeometry(noPin, {}), [], 'no pin to measure from: nothing (CODE-N2)');
  assert.deepStrictEqual(L.checkGeometry(goodTruss(), { E: 0, sigT: -1, mBook1: -1 }), [], 'E, strengths and book masses are not G9');
  const vals = { E: -3000 }; assert.deepStrictEqual(L.fileReport(vals, goodTruss()).summary, '1 value is outside the limits: Stiffness (E). Fix it to get a result.', 'one bad E gives one line');
  const cs = cases()[0], st = Object.assign({}, cs.state); const t = C.buildTruss(design(st)); t.design = Object.assign({}, t.design, { loads: [{ type: 'point', x: 250, w: 1 }] });
  assert.ok(rules(L.checkGeometry(t, {})).includes('G9'), 'a built-in truss with its load past the roller');
});

test('G10: members + support reactions >= 2 x joints (Physics: 4 joints, 4 members, 3 reactions folds; 5 members holds)', () => {
  assert.deepStrictEqual(L.checkGeometry(panel(SIDES), {}), [{ rule: 'G10', msg: 'Too few members to hold this shape (it can fold). No capacity is shown.', where: [], unstable: true }]);
  assert.deepStrictEqual(L.checkGeometry(panel(SIDES.concat([[0, 2]])), {}), []);
  const two = panel(SIDES); two.supports = [{ node: 0, pin: true }, { node: 1, pin: true }];       // 4 + 4 = 8: enough
  assert.deepStrictEqual(L.checkGeometry(two, {}), []);
  const hold = panel(SIDES); hold.supports[1].xHold = true; assert.deepStrictEqual(L.checkGeometry(hold, {}), [], 'an edge hold fixes x too');
  assert.deepStrictEqual(L.checkGeometry(Object.assign(panel(SIDES), { supports: undefined }), {}), [], 'no supports: not checked (CODE-N2)');
  assert.ok(rules(L.checkGeometry(Object.assign(panel(SIDES), { supports: [null, 5] }), {})).includes('G10'), 'damaged supports count 0');
});

test('G7-G10: rule order, early returns after G4 and G10, and nothing is changed', () => {
  const t = panel(SIDES.concat([[0, 2], [0, 4], [4, 2]])); t.nodes = t.nodes.map(p => [p[0] * 3, p[1]]); t.nodes.push([150, 0]);   // 300 x 50, member 6 along member 1
  t.design = { span: 300, loads: [{ type: 'point', x: 400 }] };
  const frozen = deepFreeze(cloneT(t));
  assert.deepStrictEqual(rules(L.checkGeometry(frozen, {})), ['G7', 'G7', 'G7', 'G8', 'G9']);
  const folds = cloneT(t); folds.supports = [{ node: 0 }];                                  // 7 + 1 < 10: G10, said last
  assert.deepStrictEqual(rules(L.checkGeometry(folds, {})), ['G7', 'G7', 'G7', 'G8', 'G9', 'G10']);
  assert.ok(L.checkGeometry(folds, {}).pop().unstable);
  const flat = Object.assign(cloneT(t), { nodes: t.nodes.map(p => [p[0], 0]) });
  assert.deepStrictEqual(rules(L.checkGeometry(flat, {})), ['G4']);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'limits.js'), 'utf8');
  assert.ok(!/G6-G10 and M1-M4 are a later row|G7-G10 and M1-M4 \(a later row\)/.test(src), 'the header no longer says G7-G10 are a later row');
});

// ---------- RMA-15 (TE-B-589): Math's M2, checkResult(res, values): no capacity when the mid-span deflection is more than the height ----------
const solveRes = st => C.analyze(C.buildTruss(design(st)), st.mat, st.load, st.opts);
const M2msg = (d, h) => 'No capacity: the mid-span deflection (' + d + ' mm) is more than the bridge height (' + h + ' mm).';

test('M2: Math\'s measured cases (botEnd 69 and a shaped bottom\'s curve 69, at h 70) give M2; a good design gives none', () => {
  const be = Object.assign({}, DEFAULT, { botEnd: 69, height: 70 }), rb = solveRes(be);
  assert.ok(rb.stable && rb.midDefl > 70, 'botEnd 69 sags past h: ' + rb.midDefl);
  assert.deepStrictEqual(L.checkResult(rb, be), [{ rule: 'M2', msg: M2msg(rb.midDefl.toFixed(1), '70'), where: [] }]);
  const cv = Object.assign({}, DEFAULT, { bottom: 'parabola', curve: 69, height: 70 }), rc = solveRes(cv);
  assert.ok(Math.abs(rc.midDefl - 162) < 1, 'curve 69: about 162 mm (Math), got ' + rc.midDefl);
  assert.deepStrictEqual(L.checkResult(rc, cv), [{ rule: 'M2', msg: M2msg('161.8', '70'), where: [] }]);
  const good = Object.assign({}, DEFAULT), rg = solveRes(good);
  assert.ok(rg.stable && rg.midDefl < 1); assert.deepStrictEqual(L.checkResult(rg, good), []);
});

test('M2: strictly more than the height; one decimal for d, the height as typed', () => {
  const r = d => ({ stable: true, midDefl: d });
  assert.deepStrictEqual(L.checkResult(r(70), { height: 70 }), [], 'equal is not more');
  assert.strictEqual(L.checkResult(r(70.06), { height: 70 })[0].msg, M2msg('70.1', '70'));
  assert.strictEqual(L.checkResult(r(-30), { height: 26.5 })[0].msg, M2msg('30.0', '26.5'), 'a deflection is its size');
  assert.strictEqual(L.checkResult(r(161.83), { height: 70 })[0].msg, M2msg('161.8', '70'));
});

// RMA-17 (TE-B-647, Math TE-B-627 note a, Math's MUST on #530): when d and h read the same at 1 decimal, both get 2 decimals (3 if still the same)
test('M2: d and h both get 2 decimals (then 3) when they would read the same; otherwise 1 decimal for d, h as typed', () => {
  const r = d => ({ stable: true, midDefl: d });
  assert.strictEqual(L.checkResult(r(70.03), { height: 70 })[0].msg, M2msg('70.03', '70.00'), 'Math: never 70.0 ... 70 mm');
  assert.strictEqual(L.checkResult(r(70.04), { height: 70 })[0].msg, M2msg('70.04', '70.00'));
  assert.strictEqual(L.checkResult(r(-70.03), { height: 70 })[0].msg, M2msg('70.03', '70.00'), 'a deflection is its size');
  assert.strictEqual(L.checkResult(r(26.52), { height: 26.5 })[0].msg, M2msg('26.52', '26.50'));
  // Math's three rows (MUST on #530 at 6e2c663)
  assert.strictEqual(L.checkResult(r(70.07), { height: 70.06 })[0].msg, M2msg('70.07', '70.06'), 'never 70.07 ... 70.1');
  assert.strictEqual(L.checkResult(r(95.351), { height: 95.35 })[0].msg, M2msg('95.351', '95.350'), 'never 95.35 ... 95.4');
  assert.strictEqual(L.checkResult(r(70.003), { height: 70 })[0].msg, M2msg('70.003', '70.000'), 'never 70.00 ... 70');
  // outside the band: unchanged
  assert.strictEqual(L.checkResult(r(70.05), { height: 70 })[0].msg, M2msg('70.1', '70'), '70.05 already reads 70.1');
  assert.strictEqual(L.checkResult(r(26.6), { height: 26.5 })[0].msg, M2msg('26.6', '26.5'));
  assert.deepStrictEqual(L.checkResult(r(70), { height: 70 }), [], 'the rule is unchanged: equal is not more');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'limits.js'), 'utf8');
  assert.ok(/---------- geometry rules G1-G10 \(/.test(src) && !/geometry rules G1-G5/.test(src), 'the section comment says G1-G10 (Physics TE-B-642)');
});

test('M2: the built-in cases, every fixture and Brian\'s final design give [] (rule 4i)', () => {
  const list = cases(); assert.ok(list.length >= 30);
  for (const cs of list) assert.deepStrictEqual(L.checkResult(solveRes(cs.state), cs.state), [], cs.name);
  const dir = path.join(__dirname, 'formats', 'fixtures'), files = fs.readdirSync(dir).filter(f => f.endsWith('.bridge.json')); let n = 0;
  for (const f of files) {
    const o = F.open(fs.readFileSync(path.join(dir, f), 'utf8')); assert.ok(o.ok, f);
    const st = Object.assign({}, DEFAULT, o.doc.bridge);
    let res; try { res = solveRes(st); } catch (e) { continue; }
    n++; assert.deepStrictEqual(L.checkResult(res, st), [], f);
  }
  assert.ok(n >= 3, 'solved ' + n);
  const st = Object.assign({}, DEFAULT, FINAL); assert.deepStrictEqual(L.checkResult(solveRes(st), st), [], 'FINAL');
});

test('M2: unstable, missing or damaged input gives [] and never throws; nothing is changed (CODE-N2)', () => {
  const big = { stable: true, midDefl: 500 };
  assert.deepStrictEqual(L.checkResult({ stable: false, midDefl: 500 }, { height: 70 }), [], 'unstable');
  assert.deepStrictEqual(L.checkResult({ midDefl: 500 }, { height: 70 }), [], 'no stable flag');
  for (const bad of [null, undefined, 'x', 7, [], {}, { stable: true }, { stable: true, midDefl: NaN }, { stable: true, midDefl: 'a' }, { stable: true, midDefl: Infinity }])
    assert.deepStrictEqual(L.checkResult(bad, { height: 70 }), [], JSON.stringify(bad));
  for (const v of [null, undefined, 3, {}, { height: 'abc' }, { height: NaN }, { height: 0 }, { height: -5 }])
    assert.deepStrictEqual(L.checkResult(big, v), [], JSON.stringify(v));
  const fr = deepFreeze({ stable: true, midDefl: 500, members: [{ F: 1 }] }), fv = deepFreeze({ height: 70 });
  assert.doesNotThrow(() => L.checkResult(fr, fv)); assert.strictEqual(L.checkResult(fr, fv).length, 1);
  // the stable-unstable pair from analyze itself: a folding design gives no M2 (G10/analyze say it)
  const feet = cases().find(cs => cs.name === 'feet'); const fs2 = Object.assign({}, feet.state, { supportMode: 'ends' }); const ru = solveRes(fs2);
  if (!ru.stable) assert.deepStrictEqual(L.checkResult(ru, fs2), []);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'limits.js'), 'utf8');
  assert.ok(!/M1-M4 (are )?(a later row|\(a later row\))/.test(src), 'the header no longer says M1-M4 are a later row');
  assert.ok(Object.keys(L).includes('checkResult'));
});
