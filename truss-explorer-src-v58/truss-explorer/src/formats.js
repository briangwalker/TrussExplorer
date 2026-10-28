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
  if (x === null || typeof x !== 'object' || depth > 40) return x;
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
  bridge:   { names: ['se310-truss-bridge', 'truss-explorer-bridge'], current: 2, ext: '.bridge.json' },
  sweep:    { names: ['se310-truss-sweep', 'truss-explorer-sweep'], current: 2, ext: '.sweep.json' },
  material: { names: ['truss-explorer-material'], current: 1, ext: '.material.json', draft: true },
  theme:    { names: ['truss-explorer-theme'], current: 1, ext: '.theme.json', draft: true },
  // the compact binary sweep (docs/math/sweep-file-format.md, #179): this is its header's name and schema version.
  // The magic line inside the gzip is the binary layout version, checked by the bytes reader, which refuses one it doesn't know.
  tsweep:   { names: ['truss-explorer-tsweep'], current: 1, ext: '.tsweep', binary: true, draft: true },
};
const NAME_TO_KIND = {}; Object.keys(KINDS).forEach(k => KINDS[k].names.forEach(n => { NAME_TO_KIND[n] = k; }));

const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
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

const api = { KINDS, detect, upgrade, check, open, cleanData, cleanRows, ROW_NUM, ROW_OPT, materialToMat };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussFormats = api;
})(typeof window !== 'undefined' ? window : globalThis);
