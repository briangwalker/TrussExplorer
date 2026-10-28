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
  assert.ok(files.length >= 10, 'fixtures present');
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

test('text from a file is one line of plain text', () => {
  const o = F.open({ format: 'se310-truss-bridge', version: 2, name: 'Line one\nline two\r\nthree\tfour\u2028five\u0085six\u0000', bridge: { name: 'A\nB', panels: 4 } });
  assert.ok(o.ok);
  for (const s of [o.doc.name, o.doc.bridge.name]) assert.ok(!/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/.test(s), JSON.stringify(s));
  assert.strictEqual(o.doc.bridge.name, 'A B', 'a line break becomes a space, so words stay apart');
  assert.strictEqual(F.cleanData('plain name, 3.18 mm'), 'plain name, 3.18 mm', 'ordinary text is unchanged');
});

test('data nested deeper than any real file is dropped, not passed through', () => {
  let deep = { name: '<b>x</b>' }; for (let i = 0; i < 60; i++) deep = { a: deep };
  const c = F.cleanData({ top: deep });
  let n = c.top, d = 0; while (n && typeof n === 'object' && 'a' in n) { n = n.a; d++; }
  assert.strictEqual(n, null, 'the part past the limit is null');
  assert.ok(d < 45, 'cut at about 40 levels');
  assert.strictEqual(F.cleanData({ s: 'ok' }).s, 'ok', 'normal data is unchanged');
});

test('material file (draft v1): checked, and converted to the solver units', () => {
  const o = F.open(fix('v1-balsa-course.material.json'));
  assert.ok(o.ok, String(o.errors)); assert.strictEqual(o.kind, 'material');
  const mat = F.materialToMat(o.doc.material);
  assert.deepStrictEqual(mat, { b: 3.18, h: 3.18, E: 3000, sigT: 7.5, sigC: 4.5, rho: 1.6e-7 }, 'matches C.DEFAULT_MAT (kg/m³ -> kg/mm³)');
  const bad = F.open({ format: 'truss-explorer-material', version: 1, material: { E: -1, sigT: 7.5, sigC: 4.5, rho: 160, behaviour: 'jelly', sizes: [3.18] } });
  assert.ok(!bad.ok); assert.deepStrictEqual(bad.errors, ['bad-number:material.E', 'bad-value:material.behaviour', 'bad-value:material.sizes'], 'sizes are { b, h }, not bare numbers');
});

test('material file: the Physics review fields (#178): rectangular sections, provenance, joints, variability', () => {
  const base = JSON.parse(fix('v1-balsa-course.material.json'));
  const m = o => F.open(Object.assign({}, base, { material: Object.assign({}, base.material, o) }));
  const rect = m({ sizes: [{ b: 3.18, h: 3.18 }, { b: 6.35, h: 1.59 }] });
  assert.ok(rect.ok); assert.deepStrictEqual([F.materialToMat(rect.doc.material, 1).b, F.materialToMat(rect.doc.material, 1).h], [6.35, 1.59]);
  assert.ok(m({ sigCperp: 0.4, sigPL: 2.2, estimated: ['sigC', 'sigCperp'], sources: { sigCperp: 'dent test (#23)' }, condition: '12% moisture' }).ok);
  assert.ok(m({ joints: { 'butt-flush': { 'wood-cement': { tension: 12, shear: 9, slip: 0.1, source: 'test' } } } }).ok);
  assert.ok(m({ variability: { cov: { E: 0.2, sigC: 0.15 } } }).ok && m({ variability: { low: { E: 2000 }, high: { E: 4000 }, note: 'batch' } }).ok);
  assert.deepStrictEqual(m({ estimated: ['colour'] }).errors, ['bad-value:material.estimated']);
  assert.deepStrictEqual(m({ joints: { lap: { epoxy: { tension: -3 } } } }).errors, ['bad-value:material.joints']);
  assert.deepStrictEqual(m({ variability: { cov: { E: 'lots' } } }).errors, ['bad-value:material.variability']);
  assert.deepStrictEqual(m({ sigCperp: 0 }).errors, ['bad-number:material.sigCperp']);
  assert.ok(m({ behaviour: 'polymer' }).warnings.includes('polymer-without-creep'));
});

test('theme file: data only (White Hat, TE-B-014): tokens, font names and image names; CSS, script and links are refused', () => {
  const ok = F.open(fix('v1-test-graph-paper.theme.json')); assert.ok(ok.ok, String(ok.errors)); assert.strictEqual(ok.kind, 'theme');
  const base = JSON.parse(fix('v1-test-graph-paper.theme.json'));
  const t = o => F.open(Object.assign({}, base, o));
  assert.ok(t({ css: 'notebook.css' }).errors.includes('not-allowed:css'));
  assert.ok(t({ js: 'x.js' }).errors.includes('not-allowed:js'));
  assert.ok(t({ script: 'alert(1)' }).errors.includes('not-allowed:script'));
  assert.ok(t({ tokens: { paper: 'url(https://evil.example/x.png)' } }).errors.includes('bad-token:paper'), 'no links out');
  assert.ok(t({ tokens: { ink: 'red; } .res { display:none' } }).errors.includes('bad-token:ink'), 'no CSS injection through a value');
  assert.ok(t({ tokens: { 'Bad Name': '#fff' } }).errors.includes('bad-token:Bad Name'));
  assert.ok(t({ images: { background: 'logo.svg' } }).errors.includes('bad-value:images'), 'no SVG (it can carry script)');
  assert.ok(t({ images: { background: '../../secret.png' } }).errors.includes('bad-value:images'), 'no paths');
  assert.ok(t({ fonts: ['https://fonts.googleapis.com/css?family=Inter'] }).errors.includes('bad-value:fonts'), 'font names, never URLs');
});

test('the compact sweep header has its own name, and is only valid inside its binary file', () => {
  assert.strictEqual(F.detect({ format: 'truss-explorer-tsweep', version: 1 }).kind, 'tsweep');
  assert.strictEqual(F.detect({ format: 'truss-explorer-sweep', version: 2 }).kind, 'sweep', 'no clash with the JSON sweep (Math review)');
  assert.deepStrictEqual(F.open({ format: 'truss-explorer-tsweep', version: 1 }).errors, ['binary-format']);
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
