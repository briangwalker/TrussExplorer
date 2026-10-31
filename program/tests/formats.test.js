// File formats (#149): every saved version opens through src/formats.js and comes out as the current version.
//   node --test tests/formats.test.js
// Fixtures: tests/formats/fixtures/ (one per older version, plus the current version made by make-fixtures.mjs),
// tests/Partner_test.bridge.json and the repo's samples/3024000Sample.sweep.json (both v1), and, when present, Brian's own
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
const REPO = path.resolve(__dirname, '..', '..');

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
  const f = path.join(REPO, 'samples', '3024000Sample.sweep.json');
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

// ---------- the compact binary sweep (.tsweep, #179): the same sweep saved both ways opens to the same thing
const near = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)) : JSON.stringify(a) === JSON.stringify(b);
const regz = async b => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
const ungz = async b => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
// what the app saves: the upgraded sweep document (live-search candidate numbers, idx, are not kept)
function sameSweep(a, b, label) {
  assert.strictEqual(b.rows.length, a.rows.length, `${label}: row count`);
  a.rows.forEach((ra, i) => { const rb = b.rows[i];
    Object.keys(ra).filter(k => k !== 'idx' && ra[k] != null && !Number.isNaN(ra[k])).forEach(k => assert.ok(near(ra[k], rb[k]), `${label}: row ${i} ${k}: ${JSON.stringify(ra[k])} vs ${JSON.stringify(rb[k])}`)); });
  ['name', 'message', 'mode', 'release', 'solver', 'model', 'savedAt', 'bridgeCode'].forEach(k => assert.deepStrictEqual(b[k] ?? null, a[k] ?? null, `${label}: ${k}`));
  ['ctx', 'sheet', 'settings', 'bridge'].forEach(k => assert.deepStrictEqual(b[k] ?? null, a[k] ?? null, `${label}: ${k}`));
}

test('.tsweep: a sweep saved as .tsweep re-opens with the same rows, summary and settings; its .sweep.json still opens', async () => {
  const json = fix('v2-v61-height-panels.sweep.json'), o = F.open(json);
  assert.ok(o.ok && o.kind === 'sweep');
  // the app adds its sweep settings to every file it saves; put some in so the round trip covers them
  const doc = Object.assign({}, o.doc, { message: o.doc.message || 'Tested 48 designs.', mode: 'sweep', settings: { swOn: { H: true, P: true }, swVals: { swHfrom: '40' }, swSel: { panels: { 4: true, 6: true } }, focus: ['height'] } });
  const t = await F.toTsweep(JSON.parse(JSON.stringify(doc)));
  assert.strictEqual(t.dupes, 0);
  assert.ok(F.isTsweepBytes(t.bytes));
  const back = await F.openBytes(t.bytes);
  assert.ok(back.ok, String(back.errors)); assert.deepStrictEqual(back.warnings, []);
  assert.strictEqual(back.kind, 'sweep'); assert.strictEqual(back.binary, 'tsweep'); assert.strictEqual(back.rowsDropped, 0);
  sameSweep(doc, back.doc, 'v2 fixture');
  // and what comes out opens like any sweep document (the app reads both the same way)
  assert.ok(F.check(back.doc).ok);
  // the .sweep.json of the same sweep still opens, unchanged
  const again = F.open(JSON.stringify(doc)); assert.ok(again.ok); assert.strictEqual(again.doc.rows.length, back.doc.rows.length);
  console.log(`# .tsweep: ${doc.rows.length} rows, ${json.length.toLocaleString()} B as .sweep.json -> ${t.bytes.length.toLocaleString()} B as .tsweep`);
});

test('.tsweep: the header follows the spec (shared names, fingerprint, hash) and Math\'s reference reader opens it', async () => {
  const o = F.open(fix('v2-v61-height-panels.sweep.json')), t = await F.toTsweep(o.doc);
  const raw = await ungz(t.bytes), txt = new TextDecoder().decode(raw), nl1 = txt.indexOf('\n'), nl2 = txt.indexOf('\n', nl1 + 1);
  assert.strictEqual(txt.slice(0, nl1 + 1), 'TRUSS-EXPLORER-SWEEP 1\n');
  assert.strictEqual(new TextEncoder().encode(txt.slice(0, nl2 + 1)).length % 8, 0, 'columns start on an 8-byte boundary');
  const h = JSON.parse(txt.slice(nl1 + 1, nl2));
  assert.strictEqual(h.format, 'truss-explorer-tsweep'); assert.strictEqual(h.version, 1);
  ['app', 'release', 'solver', 'model', 'savedAt', 'bridgeCode', 'rules', 'sweep', 'base', 'material', 'fingerprint', 'payloadSha256', 'stats'].forEach(k => assert.ok(k in h, 'header has ' + k));
  assert.ok(/^sha256:[0-9a-f]{64}$/.test(h.fingerprint));
  assert.ok(!('FS' in (h.material || {})), 'FS is a rule, not in the fingerprinted material');
  const ref = path.join(REPO, 'docs', 'math', 'reference', 'tsweep.js');
  if (fs.existsSync(ref)) {
    const T = require(ref), d = await T.decode(t.bytes);
    assert.deepStrictEqual(d.problems, [], 'the reference reader finds no problems');
    assert.strictEqual(d.header.rows, o.doc.rows.length);
  }
});

test('.tsweep: the bytes door refuses or warns as the spec says', async () => {
  const o = F.open(fix('v2-v61-height-panels.sweep.json')), t = await F.toTsweep(o.doc);
  const raw = await ungz(t.bytes), txt = new TextDecoder().decode(raw), nl2 = txt.indexOf('\n', txt.indexOf('\n') + 1), headLen = new TextEncoder().encode(txt.slice(0, nl2 + 1)).length;
  // not gzip, not ours, a newer binary layout, an oversized unzip
  assert.deepStrictEqual((await F.openBytes(new TextEncoder().encode('{"format":"se310-truss-sweep"}'))).errors, ['not-tsweep']);
  assert.deepStrictEqual((await F.openBytes(await regz(new TextEncoder().encode('hello\n{}\n')))).errors, ['not-tsweep']);
  assert.deepStrictEqual((await F.openBytes(await regz(new TextEncoder().encode('TRUSS-EXPLORER-SWEEP 2\n{}\n')))).errors, ['newer-layout']);
  assert.deepStrictEqual((await F.openBytes(await regz(new Uint8Array(8 * 1024 * 1024)), { maxUnzipped: 1024 * 1024 })).errors, ['too-big']);
  // a changed number: still opens (results are read-only), with a warning
  const bad = raw.slice(); bad[headLen + 2] ^= 1;
  const w = await F.openBytes(await regz(bad)); assert.ok(w.ok); assert.ok(w.warnings.includes('changed-data'));
  // a changed setting in the fingerprint: warned. withHeader keeps the binary part and swaps the header line.
  const payload = raw.slice(headLen), hdr = () => JSON.parse(txt.slice(txt.indexOf('\n') + 1, nl2));
  const withHeader = h => { const hb = new TextEncoder().encode('TRUSS-EXPLORER-SWEEP 1\n' + JSON.stringify(h) + '\n'), all = new Uint8Array(hb.length + payload.length); all.set(hb); all.set(payload, hb.length); return regz(all); };
  const hs = hdr(); hs.rules.width += 1;
  const set = await F.openBytes(await withHeader(hs)); assert.ok(set.ok); assert.deepStrictEqual(set.warnings, ['changed-settings']);
  // a newer header version opens with a warning
  const hv = hdr(); hv.version = 2; hv.futureField = 1; const nv = await F.openBytes(await withHeader(hv)); assert.ok(nv.ok); assert.ok(nv.tooNew && nv.warnings.includes('newer-version'));
  // a column that runs past the data, or a row count that doesn't match: refused as damaged
  const h = hdr(); h.rows += 1;
  const lie = await withHeader(h);
  assert.deepStrictEqual((await F.openBytes(lie)).errors, ['damaged']);
});

test('.tsweep: text in the header is cleaned like any file, and keys cannot reach built-in objects', async () => {
  const mark = '<img src=x onerror="window.__ran=1">';
  const doc = { format: 'se310-truss-sweep', version: 2, name: 'S' + mark, message: mark, savedAt: '2026-10-28T00:00:00.000Z', release: 'r', solver: 1, model: '2D', rules: { FS: 2, bookKg: 2.5, deflLimit: 2, minOverlap: 5, width: 60, envelope: 'outer faces' },
    ctx: { FS: 2 }, bridge: { name: 'B' + mark, mat: { E: 3000 } },
    rows: [{ pattern: 'pratt' + mark, label: mark, wood: 3000, overall: 300, side: 90, mass: 4, members: 21, capKg: 9, util: 0.5, D: 0.1, passes: true, envOK: true, edgeOK: true, overlap: 50, height: 70, panels: 4, bottom: 'b' + mark }] };
  const back = await F.openBytes((await F.toTsweep(doc)).bytes);
  assert.ok(back.ok);
  const all = JSON.stringify(back.doc);
  assert.ok(!/[<>]/.test(all), 'no markup survives');
  assert.strictEqual(({}).polluted, undefined);
});

test('.tsweep: a result that was also swept (an end offset, the overlap) becomes a grid input, so no design is lost', async () => {
  const rows = [];
  for (const te of [0, 5, 10]) for (const ov of [40, 60]) for (const h of [40, 50]) rows.push({ height: h, panels: 4, topEnd: te, overlap: ov, swOv: true, wood: 1000 + h + te + ov, util: 0.5, D: 1, capKg: 3, overall: 300, side: 60, mass: 4, members: 21, passes: true });
  const t = await F.toTsweep({ rows, bridge: {} });
  assert.strictEqual(t.rows, rows.length); assert.strictEqual(t.dupes, 0);
  const back = await F.openBytes(t.bytes);
  assert.ok(back.ok);
  assert.deepStrictEqual(back.doc.rows.map(r => [r.height, r.topEnd, r.overlap, r.wood]), rows.map(r => [r.height, r.topEnd, r.overlap, r.wood]));
  // a real repeat (same inputs, same results) is still stored once
  const t2 = await F.toTsweep({ rows: rows.concat([Object.assign({}, rows[0])]), bridge: {} });
  assert.strictEqual(t2.dupes, 1);
});

// ---------- #296: one set of size limits for every door (White Hat's review of #274)
test('size limits: a huge text, too many sweep rows (either kind), and a .tsweep header claiming too many rows are refused', async () => {
  const L = F.LIMITS;
  assert.ok(L.fileBytes > 0 && L.unzipped > 0 && L.rows > 0 && Object.isFrozen(L));
  assert.deepStrictEqual(F.open('x'.repeat(L.fileBytes + 1)).errors, ['too-big']);
  const many = { format: 'se310-truss-sweep', version: 2, release: 'r', savedAt: '2026-10-31T00:00:00Z', rows: new Array(L.rows + 1).fill(0) };
  assert.deepStrictEqual(F.open(many).errors, ['too-many-rows']);
  // a .tsweep whose header says more rows than the limit stops before any column is read
  const o = F.open(fix('v2-v61-height-panels.sweep.json')), t = await F.toTsweep(o.doc);
  const raw = await ungz(t.bytes), txt = new TextDecoder().decode(raw), nl1 = txt.indexOf('\n'), nl2 = txt.indexOf('\n', nl1 + 1);
  const h = JSON.parse(txt.slice(nl1 + 1, nl2)); h.rows = L.rows + 1;
  const head = new TextEncoder().encode('TRUSS-EXPLORER-SWEEP 1\n' + JSON.stringify(h) + '\n'), headLen = new TextEncoder().encode(txt.slice(0, nl2 + 1)).length;
  const all = new Uint8Array(head.length + raw.length - headLen); all.set(head); all.set(raw.slice(headLen), head.length);
  assert.deepStrictEqual((await F.openBytes(await regz(all))).errors, ['too-many-rows']);
});

// ---------- autoName (#256): the generated name a design got when it was made; never free text
test('autoName: a generated name is kept; free text or a wrong pattern is dropped with a warning', () => {
  const base = { format: 'se310-truss-bridge', version: 2, release: 'r', savedAt: '2026-10-30T00:00:00Z', name: 'My bridge', bridge: { name: 'My bridge', panels: 4 } };
  const good = F.open(JSON.stringify(Object.assign({}, base, { autoName: 'Maple Pratt k3f9', bridge: Object.assign({}, base.bridge, { autoName: 'Maple Pratt k3f9' }) })));
  assert.ok(good.ok); assert.strictEqual(good.doc.autoName, 'Maple Pratt k3f9'); assert.strictEqual(good.doc.bridge.autoName, 'Maple Pratt k3f9');
  assert.ok(!good.warnings.includes('bad-value:autoName'));
  for (const bad of ['Brian\'s bridge', 'maple pratt k3f9', 'Maple Pratt kaei', '<b>Maple</b> Pratt k3f9', 'Maple Pratt k3f9 extra', 42]) {
    const o = F.open(JSON.stringify(Object.assign({}, base, { autoName: bad, bridge: Object.assign({}, base.bridge, { autoName: bad }) })));
    assert.ok(o.ok, String(bad)); assert.ok(o.warnings.includes('bad-value:autoName'), String(bad));
    assert.ok(!('autoName' in o.doc) && !('autoName' in o.doc.bridge), `${bad} dropped`);
  }
  // files without it (every v1 and v2 fixture) open as before, with no autoName warning
  for (const f of fs.readdirSync(FIX).filter(f => f.endsWith('.json'))) { const o = F.open(fix(f)); assert.ok(!o.warnings.includes('bad-value:autoName'), f); }
});
