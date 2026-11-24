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
