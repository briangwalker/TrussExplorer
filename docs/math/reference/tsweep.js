'use strict';
// Reference implementation of the .tsweep sweep file, format version 1 (spec: docs/math/sweep-file-format.md).
// Plain JavaScript, no libraries: runs in the browser and in Node 18+ (uses CompressionStream and crypto.subtle).
// This is a reference for Dev Lead, not app code: the app's own copy goes in src/ through a normal pull request.
(function (root) {
const MAGIC = 'TRUSS-EXPLORER-SWEEP 1\n';
const FORMAT = 'truss-explorer-sweep', FORMAT_VERSION = 1;
// rule fields: change them and every stored use/deflection rescales exactly, so they are NOT part of the fingerprint
const RULE_KEYS = ['FS', 'bookKg', 'deflLimit', 'minOverlap'];
// flag bits (one byte per design)
const F = { stable: 1, envOK: 2, edgeOK: 4, slipOK: 8, tableOK: 16 };
// governing check of the most-used member (one byte per design); 0 = not known / not stable
const GOV = ['', 'tension', 'crushing', 'buckling', 'bracing', 'deflection'];

// ---------- canonical JSON and hashes
function canon(v) {   // sorted keys, no spaces, numbers in shortest round-trip form: the same object always gives the same text
  if (v === null || typeof v !== 'object') { if (typeof v === 'number' && !Number.isFinite(v)) return 'null'; return JSON.stringify(v); }
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}
async function sha256hex(bytes) { const h = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
const enc = s => new TextEncoder().encode(s);
// the model fingerprint: solver version + everything fixed that changes a result (never the swept inputs, never the rules)
function modelOf(h) { return { appVer: h.app.appVer, analysis: h.sweep.analysis, base: h.base, material: h.material }; }
async function fingerprint(h) { return 'sha256:' + await sha256hex(enc(canon(modelOf(h)))); }

// ---------- design numbers: mixed radix over sweep.dims, last dimension changes fastest
function radix(dims) { const r = []; let m = 1n; for (let k = dims.length - 1; k >= 0; k--) { r[k] = m; m *= BigInt(dims[k].values.length); } return { r, total: m }; }
function idxToDigits(dims, idx) { idx = BigInt(idx); const out = new Array(dims.length); for (let k = dims.length - 1; k >= 0; k--) { const L = BigInt(dims[k].values.length); out[k] = Number(idx % L); idx /= L; } return out; }
function digitsToIdx(dims, d) { const { r } = radix(dims); let s = 0n; d.forEach((v, k) => { s += BigInt(v) * r[k]; }); return s; }
// numbers are compared after rounding to 1e-9 so 40 and 40.0000000001 are the same design
const valKey = v => typeof v === 'number' ? String(Math.round(v * 1e9) / 1e9) : canon(v);

// ---------- varints for the sorted design numbers (differences between neighbours are small)
function putVarint(out, v) { v = BigInt(v); do { let b = Number(v & 127n); v >>= 7n; if (v) b |= 128; out.push(b); } while (v); }
function getVarint(buf, pos) { let v = 0n, s = 0n, b; do { b = buf[pos.i++]; v |= BigInt(b & 127) << s; s += 7n; } while (b & 128); return v; }

// ---------- gzip using the platform's own streams
async function gz(bytes, how) { const s = new Blob([bytes]).stream().pipeThrough(how === 'c' ? new CompressionStream('gzip') : new DecompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }

// rows: [{ idx (number|bigint|string), wood, use, defl, overlap, flags, gov, braceWood? }]
async function encode(header, rows) {
  const n = rows.length, sorted = rows.slice().sort((a, b) => (BigInt(a.idx) < BigInt(b.idx) ? -1 : BigInt(a.idx) > BigInt(b.idx) ? 1 : 0));
  const f32 = ['wood', 'use', 'defl', 'overlap'].concat(sorted.some(r => r.braceWood != null) ? ['braceWood'] : []);
  const cols = [];
  f32.forEach(name => { const a = new Float32Array(n); sorted.forEach((r, i) => { a[i] = r[name] == null ? NaN : r[name]; }); cols.push({ name, type: 'f32', bytes: new Uint8Array(a.buffer) }); });
  ['flags', 'gov'].forEach(name => { const a = new Uint8Array(n); sorted.forEach((r, i) => { a[i] = r[name] | 0; }); cols.push({ name, type: 'u8', bytes: a }); });
  const iv = []; let prev = 0n; sorted.forEach((r, i) => { const v = BigInt(r.idx); if (i && v === prev) throw new Error('duplicate design number ' + v); putVarint(iv, v - prev); prev = v; });
  cols.push({ name: 'idx', type: 'uvarint-delta', bytes: Uint8Array.from(iv) });
  // lay the blocks out on 8-byte boundaries so f32 columns load straight into Float32Array views
  let off = 0; const layout = cols.map(c => { const o = off; off = Math.ceil((off + c.bytes.length) / 8) * 8; return { name: c.name, type: c.type, offset: o, length: c.bytes.length }; });
  const payload = new Uint8Array(off); cols.forEach((c, i) => payload.set(c.bytes, layout[i].offset));
  const h = Object.assign({}, header, { format: FORMAT, formatVersion: FORMAT_VERSION, rows: n, columns: layout });
  h.fingerprint = await fingerprint(h);
  h.payloadSha256 = await sha256hex(payload);
  let head = MAGIC + JSON.stringify(h) + '\n'; const pad = (8 - enc(head).length % 8) % 8; head = head.slice(0, -1) + ' '.repeat(pad) + '\n';
  const hb = enc(head), all = new Uint8Array(hb.length + payload.length); all.set(hb); all.set(payload, hb.length);
  return gz(all, 'c');
}

async function decode(fileBytes, { verifyHash = true } = {}) {
  const all = await gz(fileBytes, 'd');
  const nl1 = all.indexOf(10), magic = new TextDecoder().decode(all.subarray(0, nl1 + 1));
  if (magic !== MAGIC) throw new Error('not a .tsweep v1 file');
  const nl2 = all.indexOf(10, nl1 + 1), h = JSON.parse(new TextDecoder().decode(all.subarray(nl1 + 1, nl2)));
  if (h.format !== FORMAT || h.formatVersion !== FORMAT_VERSION) throw new Error('unsupported format version ' + h.formatVersion);
  const payload = all.slice(nl2 + 1);   // copy: aligned at 0
  const problems = [];
  if (verifyHash && await sha256hex(payload) !== h.payloadSha256) problems.push('data hash does not match: the file was changed or damaged');
  if (await fingerprint(h) !== h.fingerprint) problems.push('fingerprint does not match the header settings');
  const col = {};
  h.columns.forEach(c => {
    const b = payload.subarray(c.offset, c.offset + c.length);
    if (c.type === 'f32') col[c.name] = new Float32Array(payload.buffer, payload.byteOffset + c.offset, c.length / 4);
    else if (c.type === 'u8') col[c.name] = b;
    else if (c.type === 'uvarint-delta') { const out = new Array(h.rows), pos = { i: 0 }; let v = 0n; for (let i = 0; i < h.rows; i++) { v += getVarint(b, pos); out[i] = v; } col.idx = out; }
  });
  return { header: h, col, problems };
}

// ---------- rescale to other rules (exact: use and deflection both scale with FS x book mass)
function rescaleFactor(from, to) { return (to.FS * to.bookKg) / (from.FS * from.bookKg); }

// ---------- merge two decoded sweeps with the same fingerprint into one over the union grid
function merge(A, B, rules) {
  const ha = A.header, hb = B.header; rules = rules || ha.rules;
  if (ha.fingerprint !== hb.fingerprint) throw new Error('different model fingerprints: these sweeps used different solver versions or settings and cannot be merged');
  const keys = ha.sweep.dims.map(d => d.key);
  if (keys.join() !== hb.sweep.dims.map(d => d.key).join()) throw new Error('dimension lists differ (every sweepable input must be listed in the same order)');
  // union grid: per input, the sorted union of both value lists (numbers ascending, choices in first-seen order)
  const dims = keys.map((key, k) => { const seen = new Map(); [ha, hb].forEach(h => h.sweep.dims[k].values.forEach(v => { if (!seen.has(valKey(v))) seen.set(valKey(v), v); }));
    let values = [...seen.values()]; if (values.every(v => typeof v === 'number')) values.sort((x, y) => x - y); return { key, values }; });
  const pos = dims.map(d => new Map(d.values.map((v, i) => [valKey(v), i])));
  const rows = new Map(), conflicts = [];
  const tol = (x, y) => (Number.isNaN(x) && Number.isNaN(y)) || Math.abs(x - y) <= 1e-5 * Math.max(1e-9, Math.abs(x), Math.abs(y));
  [A, B].forEach(S => {
    const h = S.header, k = rescaleFactor(h.rules, rules);
    for (let i = 0; i < h.rows; i++) {
      const d = idxToDigits(h.sweep.dims, S.col.idx[i]).map((di, kk) => pos[kk].get(valKey(h.sweep.dims[kk].values[di])));
      const idx = digitsToIdx(dims, d);
      const r = { idx, wood: S.col.wood[i], use: S.col.use[i] * k, defl: S.col.defl[i] * k, overlap: S.col.overlap[i], flags: S.col.flags[i], gov: S.col.gov[i] };
      if (S.col.braceWood) r.braceWood = S.col.braceWood[i];
      const old = rows.get(idx);
      if (!old) rows.set(idx, r);
      else if (!(tol(old.wood, r.wood) && tol(old.use, r.use) && tol(old.defl, r.defl) && old.flags === r.flags)) conflicts.push(idx);
    }
  });
  conflicts.forEach(i => rows.delete(i));   // two files disagree on a design: keep neither until it is re-solved
  const sampled = [ha, hb].map(h => h.sweep.sampling);
  const header = { app: ha.app, name: ha.name + ' + ' + hb.name, savedAt: new Date().toISOString().slice(0, 10), analysis: ha.analysis,
    sweep: { analysis: ha.sweep.analysis, dims, total: String(radix(dims).total), sampling: { method: 'merged', parts: sampled } },
    base: ha.base, material: ha.material, rules, checks: [], merged: { from: [ha.name, hb.name], conflicts: conflicts.length } };
  return { header, rows: [...rows.values()], conflicts };
}

// ---------- which rows to re-solve before trusting a file (see the result-check guide)
// randomness MUST come from the checker at check time, never from the file, or an uploader could pick a file whose checked rows are the honest ones
function checkPlan(nRows, frontierRows, sampleSize, rand) {
  rand = rand || (() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
  const pick = new Set(frontierRows);
  const s = Math.min(sampleSize, nRows);
  while (pick.size < Math.min(nRows, frontierRows.length + s)) pick.add(Math.floor(rand() * nRows));
  return [...pick];
}
const detectChance = (f, s) => 1 - Math.pow(1 - f, s);           // chance of catching a file where a fraction f of rows is wrong
const sampleFor = (f, p) => Math.ceil(Math.log(1 - p) / Math.log(1 - f));   // rows needed to catch fraction f with probability p

const api = { MAGIC, FORMAT, FORMAT_VERSION, RULE_KEYS, F, GOV, canon, fingerprint, encode, decode, merge, rescaleFactor, checkPlan, detectChance, sampleFor, idxToDigits, digitsToIdx, radix };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TSweep = api;
})(typeof window !== 'undefined' ? window : globalThis);
