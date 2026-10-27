// File formats (#149): every saved version opens through src/formats.js and comes out as the current version.
//   node --test tests/formats.test.js
// Fixtures: tests/formats/fixtures/ (one per older version, plus the current version made by make-fixtures.mjs),
// tests/Partner_test.bridge.json and the repo's 3024000Sample.sweep.json (both v1), and, when present, Brian's own
// files in tests/private/ (git-ignored, rule 8).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const F = require(path.join(__dirname, '..', 'src', 'formats.js'));

const FIX = path.join(__dirname, 'formats', 'fixtures');
const read = f => fs.readFileSync(f, 'utf8');
const fix = name => read(path.join(FIX, name));
const REPO = path.resolve(__dirname, '..', '..', '..');

test('every fixture file opens, upgrades to the current version, and passes the check', () => {
  const files = fs.readdirSync(FIX).filter(f => f.endsWith('.json'));
  assert.ok(files.length >= 9, 'fixtures present');
  for (const f of files) {
    const o = F.open(fix(f));
    assert.ok(o.ok, `${f}: ${o.errors}`);
    const cur = F.KINDS[o.kind].current;
    assert.strictEqual(o.doc.version, Math.max(cur, o.from), `${f}: version after upgrade`);
    // a second pass changes nothing: upgrading is idempotent
    assert.deepStrictEqual(F.upgrade(o.doc).doc, o.doc, `${f}: second upgrade is a no-op`);
  }
});

test('the current version (v61) files open unchanged apart from cleaning', () => {
  for (const f of ['v2-v61-course-sample-2d.bridge.json', 'v2-v61-course-sample-3d.bridge.json', 'v2-v61-shallow-pratt-sag.bridge.json', 'v2-v61-height-panels.sweep.json']) {
    const raw = JSON.parse(fix(f)), o = F.open(raw);
    assert.ok(o.ok, f); assert.deepStrictEqual(o.steps, [], f + ': no upgrade steps');
    assert.deepStrictEqual(o.warnings, [], f + ': no warnings');
    assert.strictEqual(o.doc.release, 'v61'); assert.match(o.doc.bridgeCode, /^[0-9a-f]{8}$/);
    if (o.kind === 'sweep') assert.strictEqual(o.rowsDropped, 0);
  }
  assert.strictEqual(F.open(fix('v2-v61-course-sample-3d.bridge.json')).doc.model, '3D');
  assert.strictEqual(F.open(fix('v2-v61-course-sample-2d.bridge.json')).doc.model, '2D');
});

test('v1 bridge -> v2: header filled from what the file knows, nothing guessed', () => {
  const o = F.open(read(path.join(__dirname, 'Partner_test.bridge.json')));
  assert.ok(o.ok); assert.strictEqual(o.from, 1); assert.deepStrictEqual(o.steps, ['1->2']);
  assert.strictEqual(o.doc.release, null); assert.strictEqual(o.doc.solver, null); assert.strictEqual(o.doc.bridgeCode, null);
  assert.strictEqual(o.doc.model, null, '2D/3D is not in a v1 file; app.js infers it from the wood');
  assert.ok(!('anaMode' in o.doc.bridge), 'anaMode stays absent so app.js knows to infer it');
  assert.deepStrictEqual(o.doc.rules, { FS: 2, bookKg: 2.5, deflLimit: 2, minOverlap: 20, width: 60 });
  assert.strictEqual(o.doc.summary.wood, 2953.8, 'summary kept');
});

test('v1 bridge saved while unstable, and one with no version field', () => {
  const u = F.open(fix('v1-unstable.bridge.json')); assert.ok(u.ok); assert.deepStrictEqual(u.doc.summary, { stable: false });
  const n = F.open(fix('v1-no-version-field.bridge.json')); assert.ok(n.ok); assert.strictEqual(n.from, 1); assert.strictEqual(n.doc.version, 2);
});

test('early v1 sweep (ctx without the summary sheet) -> v2', () => {
  const o = F.open(fix('v1-early.sweep.json'));
  assert.ok(o.ok); assert.strictEqual(o.from, 1); assert.strictEqual(o.rowsDropped, 0); assert.strictEqual(o.doc.rows.length, 12);
  assert.strictEqual(o.doc.model, null, 'no sheet, so the model is unknown');
  assert.deepStrictEqual(o.doc.rules, { FS: 2, bookKg: 2.5, deflLimit: 2 });
});

test('later v1 sweep (the repo sample, 23,917 rows) -> v2', () => {
  const f = path.join(REPO, '3024000Sample.sweep.json');
  if (!fs.existsSync(f)) return;
  const o = F.open(read(f));
  assert.ok(o.ok); assert.strictEqual(o.from, 1); assert.strictEqual(o.doc.model, '3D', 'from the summary sheet');
  assert.deepStrictEqual(o.doc.rules, { FS: 2, bookKg: 2.5, deflLimit: 2, minOverlap: 5 });
  assert.strictEqual(o.doc.rows.length, 23917); assert.strictEqual(o.rowsDropped, 0);
});

test('a file from a newer release opens, with a warning', () => {
  const o = F.open(fix('v3-future.bridge.json'));
  assert.ok(o.ok); assert.ok(o.tooNew); assert.ok(o.warnings.includes('newer-version'));
  assert.strictEqual(o.doc.version, 3, 'not downgraded'); assert.deepStrictEqual(o.doc.futureField, { x: 1 }, 'unknown fields kept');
});

test('both release lines are accepted (v61 and balsaPixel)', () => {
  const d = JSON.parse(fix('v2-v61-course-sample-2d.bridge.json')); d.release = 'balsaPixel 1.0-dev';
  const o = F.open(d); assert.ok(o.ok); assert.deepStrictEqual(o.warnings, []); assert.strictEqual(o.doc.release, 'balsaPixel 1.0-dev');
});

test('what is not a usable file is refused, with a reason', () => {
  assert.deepStrictEqual(F.open('{nope').errors, ['not-json']);
  assert.deepStrictEqual(F.open('[1,2]').errors, ['not-an-object']);
  assert.deepStrictEqual(F.open('42').errors, ['not-an-object']);
  assert.deepStrictEqual(F.open({ hello: 1 }).errors, ['not-truss-explorer']);
  assert.deepStrictEqual(F.open({ format: 'se310-truss-bridge', version: 2 }).errors, ['no-bridge']);
  assert.deepStrictEqual(F.open({ format: 'se310-truss-sweep', version: 2 }).errors, ['no-rows']);
  const bad = F.open({ format: 'se310-truss-sweep', version: 2, rows: [{ wood: 'x' }, null, 5] });
  assert.ok(!bad.ok); assert.ok(bad.errors.includes('no-usable-rows')); assert.strictEqual(bad.rowsDropped, 3);
});

test('the minimal files the browser tests open still open (no header needed)', () => {
  const o = F.open({ format: 'se310-truss-bridge', version: 1, name: 'B', bridge: { name: 'D', panels: 4 } });
  assert.ok(o.ok); assert.strictEqual(o.doc.version, 2);
  const s = F.open({ format: 'se310-truss-sweep', version: 2, name: 'Two', rows: [{ wood: 3000, capKg: 9, util: 0.5, D: 0.1, overall: 300, side: 90, mass: 4, height: 70, panels: 4, members: 21 }] });
  assert.ok(s.ok); assert.ok(s.warnings.includes('missing:release'));
});

test('cleaning: text never becomes markup, prototype keys are dropped, row numbers become numbers', () => {
  const o = F.open('{"format":"se310-truss-sweep","version":2,"name":"<img src=x>","__proto__":{"polluted":1},"rows":[{"wood":"3000","capKg":9,"util":0.5,"D":0.1,"overall":300,"side":90,"mass":4,"height":70,"panels":4,"members":21,"label":"<b>"}]}');
  assert.ok(o.ok); assert.ok(!/[<>]/.test(o.doc.name)); assert.strictEqual(({}).polluted, undefined);
  assert.strictEqual(Object.getPrototypeOf(o.doc), Object.prototype);
  assert.strictEqual(o.doc.rows[0].wood, 3000); assert.ok(!/[<>]/.test(o.doc.rows[0].label));
});

test('material file (draft v1): checked, and converted to the solver units', () => {
  const o = F.open(fix('v1-balsa-course.material.json'));
  assert.ok(o.ok, String(o.errors)); assert.strictEqual(o.kind, 'material');
  const mat = F.materialToMat(o.doc.material);
  assert.deepStrictEqual(mat, { b: 3.18, h: 3.18, E: 3000, sigT: 7.5, sigC: 4.5, rho: 1.6e-7 }, 'matches C.DEFAULT_MAT (kg/m³ -> kg/mm³)');
  const bad = F.open({ format: 'truss-explorer-material', version: 1, material: { E: -1, sigT: 7.5, sigC: 4.5, rho: 160, behaviour: 'jelly', sizes: [] } });
  assert.ok(!bad.ok); assert.deepStrictEqual(bad.errors, ['bad-number:material.E', 'bad-value:material.behaviour', 'bad-value:material.sizes']);
});

test('every name and version in KINDS has an upgrade path from version 1', () => {
  for (const [kind, k] of Object.entries(F.KINDS)) {
    for (const name of k.names) assert.strictEqual(F.detect({ format: name, version: 1 }).kind, kind);
    for (let v = 1; v < k.current; v++) assert.ok(typeof F.upgrade({ format: k.names[0], version: v }).doc === 'object', `${kind} ${v}`);
  }
});

test("Brian's own files in tests/private/ (if present) all open", () => {
  const dir = path.join(__dirname, 'private');
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => /\.(bridge|sweep|material)\.json$/.test(f));
  for (const f of files) {
    const o = F.open(read(path.join(dir, f)));
    assert.ok(o.ok, `${f}: ${o.errors}`);
    if (o.kind === 'sweep') assert.strictEqual(o.rowsDropped, 0, `${f}: no rows lost`);
    console.log(`# private ${f}: ${o.kind} v${o.from} -> v${o.doc.version}${o.kind === 'sweep' ? `, ${o.doc.rows.length} rows` : ''}${o.warnings.length ? ', warnings ' + o.warnings : ''}`);
  }
});
