'use strict';
// Tests for the .tsweep reference. Run: node docs/math/reference/tsweep.test.js [path/to/a.sweep.json]
// With a .sweep.json it also converts that real sweep and reports sizes (default: the sample in the repo root).
const assert = require('assert'), fs = require('fs'), path = require('path');
const T = require('./tsweep.js');
const close = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

// convert old .sweep.json rows: every input becomes a dimension (one value if it was not swept)
function fromOldSweep(doc) {
  const rows = doc.rows, skip = new Set(['idx', 'swOv', 'edgeOK', 'overall', 'bottom', 'members', 'wood', 'mass', 'D', 'util', 'capKg', 'side', 'passes', 'slipOK', 'envOK', 'topShape', 'overlap', 'supportOffset', 'refined']);
  const keys = Object.keys(rows[0]).filter(k => !skip.has(k));
  const dims = keys.map(key => { const s = new Map(); rows.forEach(r => { const v = r[key] === undefined ? null : r[key]; s.set(JSON.stringify(v), v); });
    let values = [...s.values()]; if (values.every(v => typeof v === 'number')) values.sort((a, b) => a - b); return { key, values }; });
  const pos = dims.map(d => new Map(d.values.map((v, i) => [JSON.stringify(v), i])));
  const ctx = doc.ctx || {}, rules = { FS: ctx.FS || 2, bookKg: ctx.bookKg || 2.5, deflLimit: ctx.defl || 2, minOverlap: ctx.minOv != null ? ctx.minOv : 5, width: 60, envelope: 'centreline' };
  const seen = new Set(), out = [];
  rows.forEach(r => {
    const idx = T.digitsToIdx(dims, dims.map((d, k) => pos[k].get(JSON.stringify(r[d.key] === undefined ? null : r[d.key])))); if (seen.has(idx)) return; seen.add(idx);
    out.push({ idx, wood: r.wood, use: r.util, defl: r.D, overlap: r.overlap, flags: T.F.stable | (r.envOK ? T.F.envOK : 0) | (r.edgeOK !== false ? T.F.edgeOK : 0) | (r.slipOK !== false ? T.F.slipOK : 0) | T.F.tableOK, gov: 0 });
  });
  const header = { app: 'SE 310 Truss Explorer', release: 'v60', solver: 34, model: '2D', name: doc.name || 'sweep', savedAt: '2026-10-27T12:00:00.000Z',
    sweep: { dims, total: String(T.radix(dims).total), sampling: { method: 'converted', tested: out.length } },
    base: { note: 'converted from a .sweep.json; fixed inputs live in the dims' }, material: { b: 3.18, h: 3.18, E: 3000, sigT: 7.5, sigC: 4.5, rho: 1.6e-7, K: 1 }, rules, checks: [] };
  return { header, rows: out };
}

(async () => {
  // 1. tiny round trip: values, BigInt design numbers past 2^53, NaN for unstable rows, hash and fingerprint verify
  const dims = [{ key: 'height', values: [40, 50, 60] }, { key: 'pattern', values: ['pratt', 'howe'] }, { key: 'st_top', values: Array.from({ length: 1000 }, (_, i) => i) }];
  const big = [{ key: 'huge', values: Array.from({ length: 1e6 }, (_, i) => i) }, { key: 'huge2', values: Array.from({ length: 1e6 }, (_, i) => i) }, { key: 'huge3', values: Array.from({ length: 1e5 }, (_, i) => i) }];
  const R0 = { FS: 2, bookKg: 2.5, deflLimit: 2, minOverlap: 5, width: 60, envelope: 'outer faces' };
  const head = (d, name, rules) => ({ app: 'SE 310 Truss Explorer', release: 'v61', solver: 35, model: '2D', bridgeCode: '3a899a02', name, savedAt: '2026-10-27T17:07:12.000Z', sweep: { dims: d, total: String(T.radix(d).total), sampling: { method: 'all' } },
    base: { span: 200, tableThick: 30 }, material: { E: 3000 }, rules: Object.assign({}, R0, rules), checks: [] });
  const rows = [{ idx: 5, wood: 1234.5, use: 0.8, defl: 1.1, overlap: 50, flags: 31, gov: 3 }, { idx: 2, wood: NaN, use: NaN, defl: NaN, overlap: 50, flags: 0, gov: 0 }];
  let file = await T.encode(head(dims, 'tiny'), rows), back = await T.decode(file);
  assert.deepStrictEqual(back.problems, []); assert.strictEqual(back.header.rows, 2);
  assert.strictEqual(back.col.idx[0], 2n); assert(Number.isNaN(back.col.wood[0])); assert(close(back.col.wood[1], 1234.5)); assert.strictEqual(back.col.gov[1], 3);
  const bigIdx = 99999999999999999999n; file = await T.encode(head(big, 'big'), [{ idx: bigIdx, wood: 1, use: 1, defl: 1, overlap: 1, flags: 1, gov: 0 }]);
  back = await T.decode(file); assert.strictEqual(back.col.idx[0], bigIdx); assert.deepStrictEqual(back.problems, []);
  console.log('1. round trip, NaN rows, design numbers past 2^53: ok');

  // 2. tampering: a changed number is caught by the data hash; a changed setting by the fingerprint
  const raw = new Uint8Array(await new Response(new Blob([await T.encode(head(dims, 't'), rows)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const nl = raw.indexOf(10, raw.indexOf(10) + 1); const bad = raw.slice(); bad[nl + 5] ^= 1;
  const regz = async b => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  assert((await T.decode(await regz(bad))).problems.some(p => /hash/.test(p)));
  const txt = new TextDecoder().decode(raw).replace('"E":3000', '"E":3001'); assert((await T.decode(await regz(new TextEncoder().encode(txt)))).problems.some(p => /fingerprint/.test(p)));
  console.log('2. tampered data and tampered settings both detected: ok');

  // 3. merge: different grids, one rescaled to other rules, overlap de-duplicated, a disagreement caught
  const dA = [{ key: 'height', values: [40, 50] }, { key: 'panels', values: [4] }], dB = [{ key: 'height', values: [45, 50] }, { key: 'panels', values: [4, 6] }];
  const A = await T.decode(await T.encode(head(dA, 'A'), [{ idx: 0, wood: 100, use: 0.5, defl: 1, overlap: 50, flags: 31, gov: 3 }, { idx: 1, wood: 110, use: 0.4, defl: 0.8, overlap: 50, flags: 31, gov: 3 }]));
  // B saved at FS 2.5: its use/defl are 1.25x bigger for the same design; height 50 / 4 panels (B idx 2) is the same design as A idx 1
  const B = await T.decode(await T.encode(head(dB, 'B', { FS: 2.5 }), [{ idx: 2, wood: 110, use: 0.5, defl: 1.0, overlap: 50, flags: 31, gov: 3 }, { idx: 1, wood: 120, use: 0.9, defl: 2, overlap: 50, flags: 31, gov: 2 }]));
  const M = T.merge(A, B);
  assert.deepStrictEqual(M.header.sweep.dims.map(d => d.values), [[40, 45, 50], [4, 6]]);
  assert.strictEqual(M.rows.length, 3); assert.strictEqual(M.conflicts.length, 0);
  const m45_6 = M.rows.find(r => r.idx === T.digitsToIdx(M.header.sweep.dims, [1, 1])); assert(close(m45_6.use, 0.9 * 2 / 2.5));
  const Bbad = await T.decode(await T.encode(head(dB, 'B', { FS: 2.5 }), [{ idx: 2, wood: 110, use: 0.9, defl: 1.0, overlap: 50, flags: 31, gov: 3 }]));
  assert.strictEqual(T.merge(A, Bbad).conflicts.length, 1);
  const Cdiff = await T.decode(await T.encode(Object.assign(head(dA, 'C'), { material: { E: 2500 } }), [{ idx: 0, wood: 1, use: 1, defl: 1, overlap: 1, flags: 1, gov: 0 }]));
  assert.throws(() => T.merge(A, Cdiff), /fingerprint/);
  // width and envelope can't be rescaled: different values must refuse to merge
  const Denv = await T.decode(await T.encode(head(dA, 'D', { envelope: 'centreline' }), [{ idx: 0, wood: 1, use: 1, defl: 1, overlap: 1, flags: 1, gov: 0 }]));
  assert.throws(() => T.merge(A, Denv), /fingerprint/);
  const Dw = await T.decode(await T.encode(head(dA, 'D', { width: 75 }), [{ idx: 0, wood: 1, use: 1, defl: 1, overlap: 1, flags: 1, gov: 0 }]));
  assert.throws(() => T.merge(A, Dw), /fingerprint/);
  console.log('3. merge over the union grid (40/50 + 45/50 -> 40/45/50), rescale FS 2.5 -> 2, de-duplicate, catch a disagreement, refuse other material, width or envelope: ok');

  // 3b. versions and safety: newer header opens with a warning and an unknown column is skipped; newer layout refused; zip bomb refused
  {
    const raw0 = new Uint8Array(await new Response(new Blob([await T.encode(head(dims, 'v'), rows)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    const txt0 = new TextDecoder().decode(raw0), nl1 = txt0.indexOf('\n'), nl2 = txt0.indexOf('\n', nl1 + 1);
    const h = JSON.parse(txt0.slice(nl1 + 1, nl2)); h.version = 2; h.columns.push({ name: 'futureThing', type: 'f16', offset: 0, length: 4 }); h.futureField = { x: 1 };
    const fp = await T.fingerprint(h); h.fingerprint = fp;   // header-only change: the data hash still matches
    const newHead = new TextEncoder().encode('TRUSS-EXPLORER-SWEEP 1\n' + JSON.stringify(h) + '\n');
    const pay = raw0.slice(new TextEncoder().encode(txt0.slice(0, nl2 + 1)).length), both = new Uint8Array(newHead.length + pay.length); both.set(newHead); both.set(pay, newHead.length);
    const v2 = await T.decode(await regz(both));
    assert.deepStrictEqual(v2.problems, []); assert(v2.warnings.some(w => /newer release/.test(w))); assert(close(v2.col.wood[1], 1234.5)); assert.strictEqual(v2.header.futureField.x, 1);
    const lay2 = await regz(new TextEncoder().encode('TRUSS-EXPLORER-SWEEP 2\n{}\n'));
    await assert.rejects(T.decode(lay2), /newer binary layout/);
    const bomb = await regz(new Uint8Array(64 * 1024 * 1024));   // 64 MB of zeros zips to about 64 kB
    await assert.rejects(T.decode(bomb, { maxUnzipped: 16 * 1024 * 1024 }), /refused/);
    console.log('3b. newer header opens with a warning (unknown field kept, unknown column skipped), newer layout refused, oversized unzip refused: ok');
  }

  // 4. spot-check numbers
  assert.strictEqual(T.sampleFor(0.01, 0.95), 299); assert(Math.abs(T.detectChance(0.01, 300) - 0.951) < 0.001);
  const plan = T.checkPlan(1e6, [7, 8, 9], 300); assert.strictEqual(plan.length, 303); assert([7, 8, 9].every(i => plan.includes(i)));
  console.log('4. check plan: 300 random rows + every frontier row; 299 rows catch a 1%-wrong file 95% of the time: ok');

  // 5. a real sweep
  const src = process.argv[2] || path.resolve(__dirname, '../../../3024000Sample.sweep.json');
  if (fs.existsSync(src)) {
    const doc = JSON.parse(fs.readFileSync(src, 'utf8')), conv = fromOldSweep(doc), oldBytes = fs.statSync(src).size;
    const t0 = Date.now(), out = await T.encode(conv.header, conv.rows), t1 = Date.now(), dec = await T.decode(out), t2 = Date.now();
    assert.deepStrictEqual(dec.problems, []);
    const byIdx = new Map(conv.rows.map(r => [BigInt(r.idx), r])); let maxErr = 0;
    for (let i = 0; i < dec.header.rows; i++) { const r = byIdx.get(dec.col.idx[i]); maxErr = Math.max(maxErr, Math.abs(dec.col.use[i] - r.use) / r.use, Math.abs(dec.col.wood[i] - r.wood) / r.wood); }
    const hdr = JSON.stringify(dec.header).length;
    console.log(`5. ${path.basename(src)}: ${conv.rows.length.toLocaleString()} designs, ${dec.header.sweep.dims.length} inputs, grid of ${Number(dec.header.sweep.total).toExponential(2)} designs`);
    console.log(`   old .sweep.json ${(oldBytes / 1e6).toFixed(1)} MB (${Math.round(oldBytes / conv.rows.length)} B/design) -> .tsweep ${(out.length / 1e3).toFixed(0)} kB (${(out.length / conv.rows.length).toFixed(1)} B/design, header ${(hdr / 1e3).toFixed(1)} kB); ${Math.round(oldBytes / out.length)}x smaller`);
    console.log(`   largest change from Float32 storage: ${(maxErr * 100).toExponential(1)}%; encode ${t1 - t0} ms, decode + verify ${t2 - t1} ms`);
    fs.writeFileSync(path.join(require('os').tmpdir(), 'sample.tsweep'), out);
  }
  console.log('tsweep tests: all passed');
})().catch(e => { console.error(e); process.exit(1); });
