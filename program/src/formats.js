// ===== Truss formats: every file the Explorer saves or opens, by name and version (#149) =====
// The spec is docs/formats.md. This module is the ONE place that knows the formats:
//   open(text)    parse -> clean -> detect -> upgrade -> check, for anything that comes from outside the page
//   detect(doc)   which format and version a parsed object is
//   upgrade(doc)  a copy brought up to the current version, one step at a time (v1 -> v2 -> ...)
//   check(doc)    errors (the file can't be used) and warnings (it can, with gaps)
//   cleanData, cleanRows: the import boundary (text can never become markup; prototype keys dropped; row numbers are numbers)
// No DOM, no app state: Node tests load it directly, and build.py inlines it into the page before app.js.
// Rules: never delete an upgrade step; never rename a stored key; a newer file than we know opens with a warning.
(function (root) {
'use strict';

// ---------- the import boundary (moved here from app.js, unchanged)
const CTRL = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;
const SAFE_CH = { '<': '‹', '>': '›', '"': '”', "'": '’', '`': 'ˋ' };
function cleanData(x, depth) {
  depth = depth || 0;
  // text from outside is one line of plain text: control characters (line breaks, tabs ...) become spaces
  if (typeof x === 'string') return (x.length > 2000 ? x.slice(0, 2000) : x).replace(CTRL, ' ').replace(/[<>"'`]/g, c => SAFE_CH[c]);
  if (x === null || typeof x !== 'object') return x;
  if (depth > 40) return null;   // fail closed: anything nested deeper than any real file is dropped, never passed through (White Hat review, #248)
  if (ArrayBuffer.isView(x) || x instanceof ArrayBuffer) return x;
  if (Array.isArray(x)) return x.map(v => cleanData(v, depth + 1));
  const o = {}; Object.keys(x).forEach(k => { if (k === '__proto__' || k === 'constructor' || k === 'prototype') return; o[cleanData(k, depth + 1)] = cleanData(x[k], depth + 1); });
  return o;
}
// a sweep row from a file: the numbers the tables and charts read must be numbers
const ROW_NUM = ['wood', 'capKg', 'util', 'D', 'overall', 'side', 'mass', 'height', 'panels', 'members'];
const ROW_OPT = ['curve', 'supportOffset', 'ratio', 'overlap', 'topEnd', 'botEnd', 'tilt3', 'width3'];
function cleanRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter(r => r && typeof r === 'object' && ROW_NUM.every(k => r[k] !== '' && r[k] != null && Number.isFinite(+r[k])))
    .map(r => { ROW_NUM.forEach(k => { r[k] = +r[k]; }); ROW_OPT.forEach(k => { if (r[k] != null && r[k] !== '' && Number.isFinite(+r[k])) r[k] = +r[k]; }); return r; });
}

// ---------- the formats
// names: every name this kind has ever been written under (first = the one written today). current: the version written today.
const KINDS = {
  // a bridge (truss) file is saved as .truss since 1.0.0-alpha (Brian, TE-B-256); .bridge.json files keep opening forever (rule 4i).
  // The extension never decides what a file is: detect() reads its 'format' field.
  bridge:   { names: ['se310-truss-bridge', 'truss-explorer-bridge'], current: 2, ext: '.truss', also: ['.bridge.json'] },
  sweep:    { names: ['se310-truss-sweep', 'truss-explorer-sweep'], current: 2, ext: '.sweep.json' },
  material: { names: ['truss-explorer-material'], current: 1, ext: '.material.json', draft: true },
  theme:    { names: ['truss-explorer-theme'], current: 1, ext: '.theme.json', draft: true },
  // the compact binary sweep (docs/math/sweep-file-format.md, #179): this is its header's name and schema version.
  // The magic line inside the gzip is the binary layout version, checked by the bytes reader, which refuses one it doesn't know.
  tsweep:   { names: ['truss-explorer-tsweep'], current: 1, ext: '.tsweep', binary: true },   // in the app since #179: toTsweep and openBytes below
};
const NAME_TO_KIND = {}; Object.keys(KINDS).forEach(k => KINDS[k].names.forEach(n => { NAME_TO_KIND[n] = k; }));

const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
// autoName (#256): only ever a generated name '<Word> <Type> <code>' (src/names.js), never free text, because the public
// database shows it as the title. The same pattern as TrussNames.looksGenerated, kept here so formats.js stands alone.
const AUTO_NAME = /^[A-Z][a-z]{1,15} [A-Za-z]{2,15} [0-9bcdfghjkmnpqrstvwxyz]{4}$/;
const okAutoName = x => typeof x === 'string' && AUTO_NAME.test(x);
const num = x => x !== '' && x != null && Number.isFinite(+x);

function detect(doc) {
  if (!isObj(doc)) return { kind: null, reason: 'not-an-object' };
  const name = typeof doc.format === 'string' ? doc.format : null;
  const kind = name && NAME_TO_KIND[name];
  if (!kind) return { kind: null, name, reason: 'unknown-format' };
  // a file with a format name but no version predates versioning: treat it as version 1
  const v = num(doc.version) && +doc.version >= 1 ? Math.floor(+doc.version) : 1;
  const cur = KINDS[kind].current;
  return { kind, name, version: v, current: cur, tooNew: v > cur };
}

// ---------- upgrade steps: UP[kind][n] turns version n into n + 1. Each one is pure and never removed.
// What's not knowable from an old file stays null rather than guessed (the app infers 2D/3D for old bridges itself).
function rulesFromBridge(b) {
  if (!isObj(b)) return null;
  const mat = isObj(b.mat) ? b.mat : {}, load = isObj(b.load) ? b.load : {}, opts = isObj(b.opts) ? b.opts : {};
  const r = {};
  if (num(mat.FS)) r.FS = +mat.FS;
  if (num(load.mBook1) && num(load.mBook2)) r.bookKg = +(+load.mBook1 + +load.mBook2).toFixed(3);
  if (num(opts.deflLimit)) r.deflLimit = +opts.deflLimit;
  if (num(opts.minOverlap)) r.minOverlap = +opts.minOverlap;
  if (num(opts.width)) r.width = +opts.width;
  return Object.keys(r).length ? r : null;
}
function headerV2(d, model, rules) {
  // the v2 header (fileInfo() in app.js). release/solver/bridgeCode were not recorded before v2.
  const out = Object.assign({}, d);
  if (!('app' in out)) out.app = 'SE 310 Truss Explorer';
  if (!('release' in out)) out.release = null;
  if (!('solver' in out)) out.solver = null;
  if (!('model' in out)) out.model = model;
  if (!('bridgeCode' in out)) out.bridgeCode = null;
  if (!('rules' in out)) out.rules = rules;
  out.version = 2;
  return out;
}
const UP = {
  bridge: {
    1: d => {
      const b = isObj(d.bridge) ? d.bridge : null;
      const model = b && (b.anaMode === '3d' ? '3D' : b.anaMode === '2d' ? '2D' : null);
      const out = headerV2(d, model, rulesFromBridge(b));
      if (b) out.bridge = Object.assign({}, b);   // anaMode left out on purpose when the file didn't say (app.js infers it from the wood)
      return out;
    },
  },
  sweep: {
    1: d => {
      const ctx = isObj(d.ctx) ? d.ctx : {}, sheet = isObj(d.sheet) ? d.sheet : isObj(ctx.sheet) ? ctx.sheet : null;
      const model = sheet && /3D/.test(String(sheet.analysis)) ? '3D' : sheet && /2D/.test(String(sheet.analysis)) ? '2D' : null;
      const r = {};
      if (num(ctx.FS)) r.FS = +ctx.FS;
      if (num(ctx.bookKg)) r.bookKg = +(+ctx.bookKg).toFixed(3);
      if (num(ctx.defl)) r.deflLimit = +ctx.defl;
      if (num(ctx.minOv)) r.minOverlap = +ctx.minOv;
      const out = headerV2(d, model, Object.keys(r).length ? r : rulesFromBridge(d.bridge));
      if (sheet && !('sheet' in out)) out.sheet = sheet;   // early v1 files kept the summary sheet only inside ctx
      return out;
    },
  },
  material: {},
  theme: {},
  tsweep: {},
};

function upgrade(doc) {
  const det = detect(doc);
  if (!det.kind) return { doc, det, from: null, to: null, steps: [] };
  let d = JSON.parse(JSON.stringify(doc)), v = det.version; const steps = [];
  while (v < det.current) {
    const step = UP[det.kind][v];
    if (!step) throw new Error(`no upgrade from ${det.kind} version ${v}`);
    d = step(d); steps.push(`${v}->${v + 1}`); v++;
  }
  return { doc: d, det, from: det.version, to: Math.max(v, det.version), steps };
}

// ---------- material record (#150; Physics review on #178)
const BEHAVIOURS = ['brittle-wood', 'ductile-metal', 'polymer'];
const MAT_REQ = ['E', 'sigT', 'sigC', 'rho'], MAT_OPT = ['sigTult', 'sigCperp', 'sigPL'];
const pos = x => num(x) && +x > 0;
function checkMaterial(m, errors, warnings) {
  MAT_REQ.forEach(k => { if (!pos(m[k])) errors.push('bad-number:material.' + k); });
  MAT_OPT.forEach(k => { if (k in m && m[k] != null && !pos(m[k])) errors.push('bad-number:material.' + k); });
  if (!BEHAVIOURS.includes(m.behaviour)) errors.push('bad-value:material.behaviour');
  // sections are { b, h } (mm): square sticks today, rectangular ones later without a new version
  if (!Array.isArray(m.sizes) || !m.sizes.length || !m.sizes.every(z => isObj(z) && pos(z.b) && pos(z.h))) errors.push('bad-value:material.sizes');
  if ('estimated' in m && !(Array.isArray(m.estimated) && m.estimated.every(k => typeof k === 'string' && (MAT_REQ.includes(k) || MAT_OPT.includes(k))))) errors.push('bad-value:material.estimated');
  if ('sources' in m && !(isObj(m.sources) && Object.values(m.sources).every(v => typeof v === 'string'))) errors.push('bad-value:material.sources');
  if ('creep' in m && m.creep != null && !(isObj(m.creep) && pos(m.creep.factor))) errors.push('bad-value:material.creep');
  if ('joints' in m && !(isObj(m.joints) && Object.values(m.joints).every(meth => isObj(meth) && Object.values(meth).every(j => isObj(j)
      && ['tension', 'shear', 'slip'].every(k => !(k in j) || j[k] == null || (num(j[k]) && +j[k] >= 0)))))) errors.push('bad-value:material.joints');
  if ('variability' in m && m.variability != null) {
    const v = m.variability, nums = o => isObj(o) && Object.values(o).every(x => num(x) && +x >= 0);
    if (!isObj(v) || ('cov' in v && !nums(v.cov)) || ('low' in v && !nums(v.low)) || ('high' in v && !nums(v.high))) errors.push('bad-value:material.variability');
  }
  if (!m.source) warnings.push('no-source');
  if (m.behaviour === 'polymer' && !m.creep) warnings.push('polymer-without-creep');
}

// ---------- theme file (White Hat, board TE-B-014): a theme from outside the app is DATA ONLY.
// Tokens (colours, sizes, font names) and image file names; no CSS text, no script, no links out.
// Built-in themes listed in themes/index.json may point at a .css file because they arrive through a reviewed PR;
// formats.js never accepts one. A theme can't reach the verdict, force colours or results card (#197).
const THEME_KEYS = ['format', 'version', 'id', 'name', 'savedAt', 'tokens', 'images', 'fonts', 'notes'];
const TOKEN_NAME = /^[a-z][a-z0-9-]{0,39}$/;
const TOKEN_VALUE = /^(#[0-9a-fA-F]{3,8}|-?\d+(\.\d+)?(px|rem|em|%|deg)?|[A-Za-z][A-Za-z0-9 ,-]{0,59})$/;
const IMAGE_FILE = /^[a-z0-9][a-z0-9_-]{0,39}\.(png|jpe?g|webp)$/;
function checkTheme(t, errors, warnings) {
  if (typeof t.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(t.id)) errors.push('bad-value:id');
  Object.keys(t).forEach(k => { if (!THEME_KEYS.includes(k)) errors.push('not-allowed:' + k); });   // css, js, script, html... are all refused
  if ('tokens' in t) {
    if (!isObj(t.tokens)) errors.push('bad-value:tokens');
    else Object.keys(t.tokens).forEach(k => { const v = String(t.tokens[k]); if (!TOKEN_NAME.test(k) || !TOKEN_VALUE.test(v)) errors.push('bad-token:' + k); });
  }
  if ('images' in t && !(isObj(t.images) && Object.values(t.images).every(f => typeof f === 'string' && IMAGE_FILE.test(f)))) errors.push('bad-value:images');   // no SVG: it can carry script
  if ('fonts' in t && !(Array.isArray(t.fonts) && t.fonts.every(f => typeof f === 'string' && /^[A-Za-z][A-Za-z0-9 -]{0,39}$/.test(f)))) errors.push('bad-value:fonts');   // names of fonts the site hosts, never URLs
}

// ---------- checks: errors mean the file can't be used; warnings mean it can, with gaps
// savedAs: the version the file was saved as, when doc has been upgraded (fields an old version never wrote aren't warned about)
function check(doc, savedAs) {
  const det = detect(doc), errors = [], warnings = [];
  if (!det.kind) { errors.push('not-truss-explorer'); return { ok: false, det, errors, warnings }; }
  if (det.tooNew) warnings.push('newer-version');
  if (det.kind === 'bridge') {
    if (!isObj(doc.bridge)) errors.push('no-bridge');
    else {
      const b = doc.bridge;
      ['panels', 'height', 'overall'].forEach(k => { if (k in b && !num(b[k])) warnings.push('bad-number:bridge.' + k); });
      ['mat', 'load', 'opts', 'd3', 'doc'].forEach(k => { if (k in b && !isObj(b[k])) warnings.push('not-an-object:bridge.' + k); });
    }
  } else if (det.kind === 'sweep') {
    if (!Array.isArray(doc.rows)) errors.push('no-rows');
    if ('bridge' in doc && !isObj(doc.bridge)) warnings.push('not-an-object:bridge');
    if ('ctx' in doc && doc.ctx != null && !isObj(doc.ctx)) warnings.push('not-an-object:ctx');
  } else if (det.kind === 'material') {
    const m = isObj(doc.material) ? doc.material : null;
    if (!m) errors.push('no-material');
    else checkMaterial(m, errors, warnings);
  } else if (det.kind === 'theme') {
    checkTheme(doc, errors, warnings);
  } else if (det.kind === 'tsweep') {
    errors.push('binary-format');   // a .tsweep header is only valid inside its gzip, read by the bytes reader (#179)
  }
  if ((savedAs || det.version) >= 2 && (det.kind === 'bridge' || det.kind === 'sweep')) ['release', 'savedAt'].forEach(k => { if (!doc[k]) warnings.push('missing:' + k); });
  if ((det.kind === 'bridge' || det.kind === 'sweep') && ((doc.autoName != null && !okAutoName(doc.autoName)) || (isObj(doc.bridge) && doc.bridge.autoName != null && !okAutoName(doc.bridge.autoName)))) warnings.push('bad-value:autoName');
  return { ok: errors.length === 0, det, errors, warnings };
}

// ---------- the one way in: text (or an already-parsed object) from a file -> a usable, current-version document
// returns { ok, kind, doc, from, to, tooNew, errors, warnings, rowsIn, rowsDropped }
function open(input) {
  let raw = input;
  if (typeof input === 'string') { try { raw = JSON.parse(input); } catch (e) { return { ok: false, errors: ['not-json'], warnings: [] }; } }
  const clean = cleanData(raw);
  const det = detect(clean);
  if (!det.kind) return { ok: false, det, errors: [isObj(clean) ? 'not-truss-explorer' : 'not-an-object'], warnings: [] };
  const up = upgrade(clean), c = check(up.doc, up.from);
  const res = { ok: c.ok, kind: det.kind, doc: up.doc, from: up.from, to: up.to, steps: up.steps, tooNew: det.tooNew, errors: c.errors, warnings: c.warnings };
  // a wrong autoName is dropped, never shown as a title (#256)
  if (up.doc.autoName != null && !okAutoName(up.doc.autoName)) delete up.doc.autoName;
  if (isObj(up.doc.bridge) && up.doc.bridge.autoName != null && !okAutoName(up.doc.bridge.autoName)) delete up.doc.bridge.autoName;
  if (det.kind === 'sweep' && Array.isArray(up.doc.rows)) {
    res.rowsIn = up.doc.rows.length; up.doc.rows = cleanRows(up.doc.rows); res.rowsDropped = res.rowsIn - up.doc.rows.length;
    if (!up.doc.rows.length) { res.ok = false; res.errors.push('no-usable-rows'); }
  }
  return res;
}

// ---------- material files (#150): SI on disk; the solver's mat object uses kg/mm³ for density
// (rho 160 kg/m³ in a file = 1.6e-7 kg/mm³ in app.js S.mat)
const KG_M3_TO_KG_MM3 = 1e-9;
// i: which of the material's sections (default the first)
function materialToMat(m, i) {
  const z = m.sizes[num(i) ? +i : 0] || m.sizes[0];
  return { b: +z.b, h: +z.h, E: +m.E, sigT: +m.sigT, sigC: +m.sigC, rho: +m.rho * KG_M3_TO_KG_MM3 };
}

// ---------- the compact binary sweep (.tsweep, #179; spec docs/math/sweep-file-format.md and docs/formats.md)
// The codec follows Math's reference (docs/math/reference/tsweep.js): gzip, a magic line, one line of JSON header,
// then 8-byte-aligned columns. toTsweep(sweepDoc) makes the bytes from the same object a .sweep.json holds;
// openBytes(bytes) is the bytes door and gives back what open() gives for a .sweep.json, so the app opens both the same way.
const TS_MAGIC = 'TRUSS-EXPLORER-SWEEP 1\n', TS_FORMAT = 'truss-explorer-tsweep', TS_MAX = 512 * 1024 * 1024;
const TS_F = { stable: 1, envOK: 2, edgeOK: 4, slipOK: 8, tableOK: 16 };
// a sweep row's results (makeRow in src/app/60-sweep.js). Every other key of a row is an input and becomes a grid dimension.
const TS_STD = { wood: 'wood', util: 'use', D: 'defl', overlap: 'overlap' };   // row key -> the spec's column
const TS_OUT = ['wood', 'util', 'D', 'overlap', 'swOv', 'supportOffset', 'edgeOK', 'overall', 'bottom', 'members', 'mass', 'capKg', 'side', 'passes', 'slipOK', 'envOK', 'topShape', 'topEnd', 'botEnd', 'refined'];
const TS_SKIP = ['idx'];   // the live Large search's own candidate number: meaningless once saved
const BAD_KEY = k => k === '__proto__' || k === 'constructor' || k === 'prototype';
const utf8 = s => new TextEncoder().encode(s);

// canonical JSON: sorted keys, no spaces; the same object always gives the same text (for the fingerprint)
function canon(v) {
  if (v === null || typeof v !== 'object') { if (typeof v === 'number' && !Number.isFinite(v)) return 'null'; return v === undefined ? 'null' : JSON.stringify(v); }
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}
// SHA-256: the browser's own when it has one (crypto.subtle needs a secure page), else this small plain version
const SHA_K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
function sha256plain(bytes) {
  const n = bytes.length, len = ((n + 9 + 63) >> 6) << 6, m = new Uint8Array(len); m.set(bytes); m[n] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(len - 8, Math.floor(n / 2 ** 29)); dv.setUint32(len - 4, (n * 8) >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), W = new Uint32Array(64);
  const rotr = (x, r) => (x >>> r) | (x << (32 - r));
  for (let o = 0; o < len; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + 4 * i);
    for (let i = 16; i < 64; i++) { const a = W[i - 15], b = W[i - 2]; W[i] = (W[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + W[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[i] + W[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map(x => x.toString(16).padStart(8, '0')).join('');
}
async function sha256hex(bytes) {
  const sub = typeof crypto !== 'undefined' && crypto.subtle;
  if (sub) { try { const h = await sub.digest('SHA-256', bytes); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { /* fall through */ } }
  return sha256plain(bytes);
}
// the model fingerprint: solver + everything fixed that changes a result (never the swept inputs, never the rescalable rules)
function tsModel(h) { const r = isObj(h.rules) ? h.rules : {}; return { solver: h.solver, model: h.model, base: h.base, material: h.material, width: r.width, envelope: r.envelope }; }
async function tsFingerprint(h) { return 'sha256:' + await sha256hex(utf8(canon(tsModel(h)))); }

// design numbers: mixed radix over sweep.dims, last dimension changes fastest (as candAt does)
function tsRadix(dims) { const r = []; let m = 1n; for (let k = dims.length - 1; k >= 0; k--) { r[k] = m; m *= BigInt(dims[k].values.length); } return { r, total: m }; }
function putVarint(out, v) { do { let b = Number(v & 127n); v >>= 7n; if (v) b |= 128; out.push(b); } while (v); }
function getVarint(buf, pos) {
  let v = 0n, s = 0n, b;
  do { if (pos.i >= buf.length || s > 700n) throw new Error('damaged'); b = buf[pos.i++]; v |= BigInt(b & 127) << s; s += 7n; } while (b & 128);
  return v;
}
// gzip with the platform's own streams; unzipping stops past the cap (a few-kB gzip can expand to gigabytes)
async function gz(bytes, how, max) {
  const s = new Blob([bytes]).stream().pipeThrough(how === 'c' ? new CompressionStream('gzip') : new DecompressionStream('gzip'));
  if (how === 'c') return new Uint8Array(await new Response(s).arrayBuffer());
  const parts = [], rd = s.getReader(); let n = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.length; if (n > max) { await rd.cancel(); throw new Error('too-big'); } parts.push(value); }
  const out = new Uint8Array(n); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out;
}
const hasGzip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
// values written as 32-bit floats come back to 7 significant digits (0.8 stays 0.8 rather than 0.800000011920929)
const f32back = v => Number.isInteger(v) || !Number.isFinite(v) ? v : +v.toPrecision(7);

// what a sweep's results were judged by: the sweep's own ctx wins over the screen's rules saved in the header
function sweepRules(doc) {
  const r = Object.assign({}, isObj(doc.rules) ? doc.rules : {}), c = isObj(doc.ctx) ? doc.ctx : {};
  if (num(c.FS)) r.FS = +c.FS; if (num(c.bookKg)) r.bookKg = +(+c.bookKg).toFixed(3);
  if (num(c.defl)) r.deflLimit = +c.defl; if (num(c.minOv)) r.minOverlap = +c.minOv;
  return r;
}

// a sweep document (the object a .sweep.json holds) -> .tsweep bytes. Returns { bytes, rows, dupes }.
async function toTsweep(doc) {
  if (!hasGzip()) throw new Error('no-gzip');
  const all = Array.isArray(doc.rows) ? doc.rows : [], out = new Set(TS_OUT), skip = new Set(TS_SKIP);
  const keys = []; { const seen = new Set(); all.forEach(r => Object.keys(r).forEach(k => { if (!seen.has(k) && !BAD_KEY(k)) { seen.add(k); keys.push(k); } })); }
  // Some results can also be swept inputs (overlap, the top and bottom end offsets...): when two rows differ only in one of
  // those, it is promoted to a grid dimension and the grid is made again, so no design is mistaken for another.
  const promoted = new Set(), RESULTS_ONLY = ['wood', 'util', 'D'];
  let extra, inputs, dims, rad, total, rows, dupes;
  for (;;) {
    // results that aren't spec columns become the app's own columns ("x.<key>"; other readers skip them, spec "Versions and safety")
    extra = []; inputs = [];
    keys.forEach(k => {
      if (skip.has(k)) return;
      if (!out.has(k) || promoted.has(k)) { inputs.push(k); return; }
      if (TS_STD[k]) return;
      const vals = all.map(r => r[k]).filter(v => v != null);
      if (vals.every(v => typeof v === 'number')) extra.push({ key: k, type: 'f32' });
      else if (vals.every(v => typeof v === 'boolean')) extra.push({ key: k, type: 'bool' });
      else { const dict = new Map(); vals.forEach(v => { const c = canon(v); if (!dict.has(c)) dict.set(c, v); }); if (dict.size <= 255) extra.push({ key: k, type: 'code', dict }); else inputs.push(k); }
    });
    // the grid: every input with the values the rows use (numbers ascending)
    dims = inputs.map(key => { const s = new Map(); all.forEach(r => { const v = r[key] === undefined ? null : r[key]; s.set(canon(v), v); });
      let values = [...s.values()]; if (values.every(v => typeof v === 'number')) values.sort((a, b) => a - b); return { key, values }; });
    const pos = dims.map(d => new Map(d.values.map((v, i) => [canon(v), i]))); ({ r: rad, total } = tsRadix(dims));
    const seen = new Map(); rows = []; dupes = 0; let more = null;
    for (let order = 0; order < all.length && !more; order++) {
      const r = all[order]; let idx = 0n; dims.forEach((d, k) => { idx += BigInt(pos[k].get(canon(r[d.key] === undefined ? null : r[d.key]))) * rad[k]; });
      const first = seen.get(idx);
      if (!first) { seen.set(idx, r); rows.push({ idx, r, order }); continue; }
      const diff = keys.filter(k => out.has(k) && !promoted.has(k) && !RESULTS_ONLY.includes(k) && canon(r[k] === undefined ? null : r[k]) !== canon(first[k] === undefined ? null : first[k]));
      if (diff.length) more = diff; else dupes++;
    }
    if (!more) break;
    more.forEach(k => promoted.add(k));
  }
  rows.sort((a, b) => (a.idx < b.idx ? -1 : a.idx > b.idx ? 1 : 0));
  const n = rows.length, cols = [];
  const f32 = (name, get) => { const a = new Float32Array(n); rows.forEach((x, i) => { const v = get(x); a[i] = typeof v === 'number' ? v : NaN; }); cols.push({ name, type: 'f32', bytes: new Uint8Array(a.buffer) }); };
  const u8 = (name, get, more) => { const a = new Uint8Array(n); rows.forEach((x, i) => { a[i] = get(x) | 0; }); cols.push(Object.assign({ name, type: 'u8', bytes: a }, more)); };
  Object.keys(TS_STD).forEach(k => f32(TS_STD[k], x => x.r[k]));
  u8('flags', x => (Number.isFinite(x.r.wood) ? TS_F.stable : 0) | (x.r.envOK !== false ? TS_F.envOK : 0) | (x.r.edgeOK !== false ? TS_F.edgeOK : 0) | (x.r.slipOK !== false ? TS_F.slipOK : 0) | TS_F.tableOK);
  u8('gov', () => 0);   // not recorded by the app's sweep yet: 0 = unknown
  extra.forEach(e => {
    if (e.type === 'f32') f32('x.' + e.key, x => x.r[e.key]);
    else if (e.type === 'bool') u8('x.' + e.key, x => x.r[e.key] == null ? 0 : x.r[e.key] ? 2 : 1, { coded: 'bool' });   // 0 absent, 1 false, 2 true
    else { const codes = new Map([...e.dict.keys()].map((c, i) => [c, i + 1])); u8('x.' + e.key, x => x.r[e.key] == null ? 0 : codes.get(canon(x.r[e.key])), { coded: 'list', values: [...e.dict.values()] }); }   // 0 absent
  });
  f32('x.order', x => x.order);   // the order the rows were in, so they come back in it
  const iv = []; let prev = 0n; rows.forEach(x => { putVarint(iv, x.idx - prev); prev = x.idx; });
  cols.push({ name: 'idx', type: 'uvarint-delta', bytes: Uint8Array.from(iv) });
  let off = 0; const layout = cols.map(c => { const o = off; off = Math.ceil((off + c.bytes.length) / 8) * 8; const d = { name: c.name, type: c.type, offset: o, length: c.bytes.length }; if (c.coded) d.coded = c.coded; if (c.values) d.values = c.values; return d; });
  const payload = new Uint8Array(off); cols.forEach((c, i) => payload.set(c.bytes, layout[i].offset));
  // header: the shared v2 names; base and material for the fingerprint; the app's own sweep fields under "explorer"
  const bridge = isObj(doc.bridge) ? doc.bridge : {}, rules = sweepRules(doc);
  const base = {}; Object.keys(bridge).forEach(k => { if (!['mat', 'name', 'swOn', 'swVals', 'swSel', 'focus'].includes(k) && !inputs.includes(k)) base[k] = bridge[k]; });
  const material = isObj(bridge.mat) ? Object.assign({}, bridge.mat) : null; if (material) delete material.FS;   // FS is a rule, outside the fingerprint
  const fail = { strength: 0, deflection: 0, envelope: 0, edge: 0, slip: 0 }; let unstable = 0;
  rows.forEach(({ r }) => { if (!Number.isFinite(r.wood)) { unstable++; return; } if (r.util > 1) fail.strength++; if (num(rules.deflLimit) && r.D > rules.deflLimit) fail.deflection++; if (r.envOK === false) fail.envelope++; if (r.edgeOK === false) fail.edge++; if (r.slipOK === false) fail.slip++; });
  const h = { format: TS_FORMAT, version: KINDS.tsweep.current, app: doc.app || 'SE 310 Truss Explorer', release: doc.release == null ? null : doc.release, solver: doc.solver == null ? null : doc.solver,
    model: doc.model || null, savedAt: doc.savedAt || null, bridgeCode: doc.bridgeCode || null, name: doc.name || 'sweep',
    sweep: { dims, total: String(total), sampling: { method: 'rows', tested: n } }, base, material, rules, checks: [], stats: { tested: n, unstable, fail },
    explorer: { message: doc.message == null ? null : doc.message, ctx: doc.ctx == null ? null : doc.ctx, sheet: doc.sheet == null ? null : doc.sheet, mode: doc.mode == null ? null : doc.mode, settings: doc.settings == null ? null : doc.settings, bridge },
    rows: n, columns: layout };
  h.fingerprint = await tsFingerprint(h);
  h.payloadSha256 = await sha256hex(payload);
  let head = TS_MAGIC + JSON.stringify(h) + '\n'; const pad = (8 - utf8(head).length % 8) % 8; head = head.slice(0, -1) + ' '.repeat(pad) + '\n';
  const hb = utf8(head), file = new Uint8Array(hb.length + payload.length); file.set(hb); file.set(payload, hb.length);
  return { bytes: await gz(file, 'c'), rows: n, dupes };
}

const isTsweepBytes = b => b && b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;   // gzip; no JSON file starts with these bytes
// the bytes door (spec "Opening a file safely"): magic line, capped unzip, column bounds, hash and fingerprint, cleanData on the header.
// Returns what open() returns for a sweep (kind 'sweep', a version-2 sweep document), plus binary: 'tsweep'.
async function openBytes(input, opts) {
  const max = (opts && opts.maxUnzipped) || TS_MAX;
  const fail = e => ({ ok: false, errors: [e], warnings: [] });
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!isTsweepBytes(bytes)) return fail('not-tsweep');
  if (!hasGzip()) return fail('no-gzip');
  let all; try { all = await gz(bytes, 'd', max); } catch (e) { return fail(e && e.message === 'too-big' ? 'too-big' : 'not-tsweep'); }
  const nl1 = all.indexOf(10); if (nl1 < 0 || nl1 > 64) return fail('not-tsweep');
  const magic = new TextDecoder().decode(all.subarray(0, nl1 + 1));
  if (magic !== TS_MAGIC) return fail(/^TRUSS-EXPLORER-SWEEP /.test(magic) ? 'newer-layout' : 'not-tsweep');
  const nl2 = all.indexOf(10, nl1 + 1); if (nl2 < 0) return fail('damaged');
  let raw; try { raw = JSON.parse(new TextDecoder().decode(all.subarray(nl1 + 1, nl2))); } catch (e) { return fail('damaged'); }
  if (!isObj(raw) || raw.format !== TS_FORMAT) return fail('not-tsweep');
  const payload = all.slice(nl2 + 1), n = raw.rows, warnings = [];
  // every column lies inside the data and holds exactly one value per row
  const SIZE = { f32: 4, u8: 1 };
  if (!Number.isInteger(n) || n < 0 || n > payload.length || !Array.isArray(raw.columns)) return fail('damaged');
  for (const c of raw.columns) if (!isObj(c) || typeof c.name !== 'string' || !Number.isInteger(c.offset) || !Number.isInteger(c.length) || c.offset < 0 || c.length < 0 || c.offset + c.length > payload.length || (SIZE[c.type] && c.length !== n * SIZE[c.type])) return fail('damaged');
  const colOf = name => raw.columns.find(c => c.name === name);
  if (!['wood', 'use', 'defl', 'overlap', 'flags', 'idx'].every(colOf) || colOf('idx').type !== 'uvarint-delta') return fail('damaged');
  if (num(raw.version) && +raw.version > KINDS.tsweep.current) warnings.push('newer-version');
  // hash and fingerprint on the header exactly as saved (cleaning first would change the text they cover)
  if (await sha256hex(payload) !== raw.payloadSha256) warnings.push('changed-data');
  try { if (await tsFingerprint(raw) !== raw.fingerprint) warnings.push('changed-settings'); } catch (e) { warnings.push('changed-settings'); }
  const h = cleanData(raw);
  if (!h || !isObj(h.sweep) || !Array.isArray(h.sweep.dims) || !h.sweep.dims.every(d => isObj(d) && typeof d.key === 'string' && Array.isArray(d.values) && d.values.length)) return fail('damaged');
  const dims = h.sweep.dims, total = tsRadix(dims).total;
  const view = c => payload.subarray(c.offset, c.offset + c.length);
  const f32col = c => new Float32Array(payload.buffer, payload.byteOffset + c.offset, n);   // offsets are multiples of 8 in a good file
  const col = {};
  for (const c of h.columns) {
    if (c.type === 'f32') col[c.name] = c.offset % 4 === 0 ? f32col(c) : new Float32Array(view(c).slice().buffer);
    else if (c.type === 'u8') col[c.name] = view(c);
  }
  // design numbers -> each input's value
  const idx = new Array(n);
  try { const b = view(colOf('idx')), p = { i: 0 }; let v = 0n; for (let i = 0; i < n; i++) { v += getVarint(b, p); if (v >= total) throw 0; idx[i] = v; } } catch (e) { return fail('damaged'); }
  const xcols = h.columns.filter(c => /^x\./.test(c.name) && c.name !== 'x.order' && col[c.name] && !BAD_KEY(c.name.slice(2)));
  const rows = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = {}, dig = new Array(dims.length); let v = idx[i];
    for (let k = dims.length - 1; k >= 0; k--) { const L = BigInt(dims[k].values.length); dig[k] = Number(v % L); v /= L; }
    dims.forEach((d, k) => { if (!BAD_KEY(d.key)) r[d.key] = d.values[dig[k]]; });
    Object.keys(TS_STD).forEach(k => { const c = col[TS_STD[k]]; if (c) { const x = c[i]; if (!Number.isNaN(x)) r[k] = f32back(x); } });
    for (const c of xcols) {
      const k = c.name.slice(2), x = col[c.name][i];
      if (c.type === 'f32') { if (!Number.isNaN(x)) r[k] = f32back(x); }
      else if (c.coded === 'bool') { if (x) r[k] = x === 2; }
      else if (c.coded === 'list' && Array.isArray(c.values)) { if (x && x <= c.values.length) r[k] = c.values[x - 1]; }
    }
    // results the app needs that only the spec columns carry (a .tsweep made by another tool)
    const fl = col.flags[i];
    if (!('envOK' in r)) r.envOK = !!(fl & TS_F.envOK); if (!('edgeOK' in r)) r.edgeOK = !!(fl & TS_F.edgeOK); if (!('slipOK' in r)) r.slipOK = !!(fl & TS_F.slipOK);
    rows[i] = r;
  }
  const ord = col['x.order'];
  const ordered = ord ? rows.map((r, i) => [ord[i], r]).sort((a, b) => a[0] - b[0]).map(x => x[1]) : rows;
  const ex = isObj(h.explorer) ? h.explorer : {};
  const doc = { format: KINDS.sweep.names[0], version: KINDS.sweep.current, app: h.app || 'SE 310 Truss Explorer', release: h.release == null ? null : h.release, solver: h.solver == null ? null : h.solver,
    savedAt: h.savedAt || null, model: h.model || null, bridgeCode: h.bridgeCode || null, rules: isObj(h.rules) ? h.rules : null, name: h.name || 'sweep',
    message: ex.message == null ? '' : ex.message, ctx: isObj(ex.ctx) ? ex.ctx : null, sheet: isObj(ex.sheet) ? ex.sheet : null, mode: ex.mode == null ? null : ex.mode,
    settings: isObj(ex.settings) ? ex.settings : null, bridge: isObj(ex.bridge) ? ex.bridge : Object.assign({}, isObj(h.base) ? h.base : {}, isObj(h.material) ? { mat: h.material } : {}), rows: ordered };
  const res = { ok: true, kind: 'sweep', binary: 'tsweep', doc, from: num(h.version) ? +h.version : 1, to: num(h.version) ? +h.version : 1, steps: [], tooNew: warnings.includes('newer-version'), errors: [], warnings, header: h };
  res.rowsIn = ordered.length; doc.rows = cleanRows(ordered); res.rowsDropped = res.rowsIn - doc.rows.length;
  if (!doc.rows.length) { res.ok = false; res.errors.push('no-usable-rows'); }
  return res;
}

const api = { KINDS, detect, upgrade, check, open, cleanData, cleanRows, ROW_NUM, ROW_OPT, materialToMat, toTsweep, openBytes, isTsweepBytes, canon, sha256hex, sha256plain };
// what the Open buttons offer: every kind in the app (drafts aside), the old names, and plain JSON (TE-B-256)
api.ACCEPT = [...new Set(Object.values(KINDS).filter(k => !k.draft).flatMap(k => [k.ext].concat(k.also || [])).concat(['.json', 'application/json']))].join(',');
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussFormats = api;
})(typeof window !== 'undefined' ? window : globalThis);
