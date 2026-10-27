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
const SAFE_CH = { '<': '‹', '>': '›', '"': '”', "'": '’', '`': 'ˋ' };
function cleanData(x, depth) {
  depth = depth || 0;
  if (typeof x === 'string') return (x.length > 2000 ? x.slice(0, 2000) : x).replace(/[<>"'`]/g, c => SAFE_CH[c]);
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
    else {
      ['E', 'sigT', 'sigC', 'rho'].forEach(k => { if (!num(m[k]) || +m[k] <= 0) errors.push('bad-number:material.' + k); });
      if (!['brittle-wood', 'ductile-metal', 'polymer'].includes(m.behaviour)) errors.push('bad-value:material.behaviour');
      if (!Array.isArray(m.sizes) || !m.sizes.length || !m.sizes.every(s => num(s) && +s > 0)) errors.push('bad-value:material.sizes');
      if (!m.source) warnings.push('no-source');
    }
  } else if (det.kind === 'theme') {
    if (typeof doc.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(doc.id)) errors.push('bad-value:id');
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
function materialToMat(m, size) {
  const b = num(size) ? +size : +m.sizes[0];
  return { b, h: b, E: +m.E, sigT: +m.sigT, sigC: +m.sigC, rho: +m.rho * KG_M3_TO_KG_MM3 };
}

const api = { KINDS, detect, upgrade, check, open, cleanData, cleanRows, ROW_NUM, ROW_OPT, materialToMat };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussFormats = api;
})(typeof window !== 'undefined' ? window : globalThis);
