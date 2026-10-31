(function () {
'use strict';
const C = TrussCore, X = TrussExport;
const $ = id => document.getElementById(id);
// The calls another layer may wrap (balsaPixel's window layout does). Code here calls setFs, renderKey and renderSweep, which go through these.
const HOOKS = { setFs: k => setFsCore(k), renderKey: () => renderKeyCore(), renderSweep: () => renderSweepCore() };
// ---------- left panel: three groups. 1 bridge shape, 2 desks and supports, 3 loads and checks (with the pass/fail rules called out)
(function regroup() {
  const inn = id => $(id).querySelector('.in');
  const mk = (id, title) => { const d = document.createElement('details'); d.className = 'grp'; d.id = id; d.open = true; d.innerHTML = `<summary><h3>${title}</h3></summary><div class="in"></div>`; return d; };
  const sub = (box, t, id) => { const h = document.createElement('h4'); h.className = 'subh'; h.textContent = t; if (id) h.id = id; box.appendChild(h); return h; };
  const g1 = mk('g-shape', '1 · Bridge shape'), g2 = mk('g-desk', '2 · Desks and supports'), g3 = mk('g-loads', '3 · Loads and checks');
  const first = $('g-design'); first.parentNode.insertBefore(g1, first); g1.after(g2); g2.after(g3);
  const S1 = g1.querySelector('.in'), S2 = g2.querySelector('.in'), S3 = g3.querySelector('.in');
  const moveAll = (from, to) => [...from.children].forEach(ch => to.appendChild(ch));
  moveAll(inn('g-design'), S1);
  sub(S1, 'Chords and panels');
  sub(S2, 'Desk panels and foot style');
  const deskRow = $('deskMode').closest('.row');
  let phase = 1;
  [...inn('g-geom').children].forEach(ch => {
    if (ch === deskRow) { phase = 2; S2.appendChild(ch); return; }
    if (phase === 1) { S1.appendChild(ch); return; }
    if (phase === 2) { phase = 3; sub(S3, 'Books and loads'); }
    S3.appendChild(ch);
  });
  const box = (id, title, from) => { const b = document.createElement('div'); b.id = id; sub(b, title); moveAll(inn(from), b); S1.appendChild(b); };
  box('diagBox', 'Diagonals', 'diagGrp'); box('vertBox', 'Verticals', 'vertGrp'); box('stickBox', 'Sticks (doubling up)', 'stickGrp');
  sub(S2, 'Supports, claws and edge braces');
  moveAll(inn('supGrp'), S2);
  // the pass/fail rules, in their own box
  const lim = document.createElement('div'); lim.className = 'limits';
  lim.innerHTML = '<h4 class="subh" style="border:0;padding:0;margin:0">Project limits <span class="rulechip">pass / fail rules</span></h4><span class="hint">A design passes only if it meets every one of these. Fixed by the project rules: overall length at most 300 mm, at most 100 mm above the deck and 50 mm below it, bridge width 50 to 75 mm.</span><div class="two" id="limitsTwo"></div>';
  ['FS', 'deflLimit', 'minOverlap', 'width'].forEach(id => lim.querySelector('#limitsTwo').appendChild($(id).closest('.row')));
  S3.appendChild(lim);
  sub(S3, 'Books, material and setup');
  moveAll(inn('loadGrp'), S3);
  ['g-design', 'g-geom', 'supGrp', 'diagGrp', 'vertGrp', 'stickGrp', 'loadGrp'].forEach(id => $(id).remove());
})();
const COURSE = { mat: Object.assign({}, C.DEFAULT_MAT), load: { mBook1: 1.5, mBook2: 1.0, g: 9.81, nTruss: 2 }, opts: { deflLimit: 2.0, width: 60, crossTies: true, minOverlap: 5, tieJoint: 'ontop' } };
// NEVER rename this key: everyone's saved work lives under it. When the saved format changes, convert old data on load instead.
const KEY = 'se310-truss-v5';
const APP_VER = 35;   // bumped whenever the solver or the saved data changes
const APP_RELEASE = '1.0.0-alpha.1';   // SemVer pre-release (board TE-B-017); a version only, never the product name (TE-B-246: the product is 'balsaPixel: Truss Explorer'); written into every file the app saves (main is the stable v6x line)

// The starter bridge fits the 300 mm envelope measured on the outer faces (#185, Brian 2026-10-28): 48.4 mm on each desk
// gives 296.8 mm between end joints and 299.98 mm outside (half a stick, 1.59 mm, shorter at each end than v61's 300 mm).
const DEFAULT = {
  name: 'Design A', family: 'grid', height: 70, panels: 4, ratio: 1, sideAngle: 90, sideLean: 'in',
  overall: 296.8, bookLen: 242, loads: null, bookWidth: 209, bookThick: 32, approachDiag: 'P', edgeVert: true, deskVert: true, deskMode: 'length', deskPanels: 1,
  bottom: 'flat', curve: -30, deskEnds: 'truss', supportMode: 'all', topShape: 'flat', topEnd: 0, botEnd: 0, edgeBear: false, showDims: true, showGhosts: true, bookContact: 'rigid', claw: 'off', brace: 'off', tableThick: 30, braceDepth: 20, fricK: 2, fricMu: 0.4, supportOffset: 0, overlap: 48.4, sticks: {}, groupBy: 'none',
  pattern: 'pratt', diagLeft: ['P', 'P'], diagMiddle: 'X', vertPreset: 'all', vertLeft: [true, true],
  mat: Object.assign({}, COURSE.mat), load: Object.assign({}, COURSE.load), opts: Object.assign({}, COURSE.opts),
  showIds: true, showElems: false, showDef: true, defScale: 20, wide: false, openMap: {}, tab: 'trade',
  history: [], baseline: 0,
};
// Everything that comes from outside this page (an opened file, or data an earlier visit stored) is cleaned before
// the app uses it: text can never become markup, and keys that would reach an object's prototype are dropped.
// Typed arrays and BigInts (large-search checkpoints) pass through unchanged.
const { cleanData, cleanRows } = TrussFormats;   // the import boundary lives in formats.js with the file formats (#149)
let S = JSON.parse(JSON.stringify(DEFAULT));
var FIRST_VISIT = true;
try { const saved = cleanData(JSON.parse(localStorage.getItem(KEY) || 'null')); if (saved && saved.panels) { S = Object.assign(S, saved); FIRST_VISIT = false; } } catch (e) {}
if (FIRST_VISIT) S.name = TrussNames.make(S);   // a new design gets a generated name, e.g. "Maple Pratt k3f9" (#27); it can be renamed
if (!S.migOv5) { if (S.opts && +S.opts.minOverlap === 20) S.opts.minOverlap = 5; S.migOv5 = true; }
// v61: the envelope is checked on the built bridge's outer faces (#133), and how the ties are joined belongs to the bridge
S.opts = Object.assign({ tieJoint: (S.doc && S.doc.tieJoint) || 'ontop' }, S.opts || {});
delete S.opts.envMeasure;   // v61: the envelope is always measured on the outer faces
// the options every 2D analysis gets: the bridge's own, plus the tilt (3D only) and whether ties sit on the top chords
function anaOpts(extra) {
  const o = Object.assign({}, S.opts, extra || {});
  if (o.tilt == null) o.tilt = S.anaMode === '3d' ? (+S.d3.tilt || 0) : 0;
  o.tiesOnTop = (S.anaMode === '3d' || !!o.crossTies) && o.tieJoint !== 'between';
  return o;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

let tr = null, res = null, hlElem = -1;
const hasApp = () => (tr ? tr.deskPanels : S.deskPanels) > 0;

// ---------- state helpers
function half() { return Math.floor(S.panels / 2); }
function syncArrays() {
  const h = half();
  if (S.pattern !== 'custom') S.diagLeft = C.patternLeft(S.pattern, h);
  while (S.diagLeft.length < h) S.diagLeft.push('P');
  S.diagLeft.length = h;
  if (S.vertPreset === 'all') S.vertLeft = Array(h).fill(true);
  else if (S.vertPreset === 'none') S.vertLeft = Array(h).fill(false);
  else if (S.vertPreset === 'alt') S.vertLeft = Array.from({ length: h }, (_, k) => k % 2 === 1);
  while (S.vertLeft.length < h) S.vertLeft.push(true);
  S.vertLeft.length = h;
  if (S.vertPreset === 'all') { S.edgeVert = true; S.deskVert = true; } else if (S.vertPreset === 'none') { S.edgeVert = false; S.deskVert = false; }
}
function design(over) {
  return Object.assign({ family: S.family, span: 200, overall: +S.overall, height: +S.height, panels: +S.panels, ratio: +S.ratio,
    diagLeft: S.diagLeft.slice(), diagMiddle: S.diagMiddle, vertLeft: S.vertLeft.slice(), approachDiag: S.approachDiag, edgeVert: S.edgeVert, deskVert: S.deskVert,
    deskMode: S.deskMode, deskPanels: +S.deskPanels, overlap: +S.overlap, bottom: S.bottom, curve: +S.curve, deskEnds: S.deskEnds, supportMode: S.supportMode, topShape: S.topShape, topEnd: +S.topEnd, botEnd: +S.botEnd, edgeBear: !!S.edgeBear, bookContact: S.bookContact, claw: S.claw === 'on', brace: S.brace === 'on', tableThick: +S.tableThick, braceDepth: +S.braceDepth, fricK: +S.fricK, fricMu: +S.fricMu, supportOffset: +S.supportOffset, sticks: S.sticks,
    sideAngle: +S.sideAngle, sideLean: S.sideLean, deck: 'top', bookLen: +S.bookLen, loads: S.loads ? S.loads.map(L => Object.assign({}, L)) : null }, over || {});
}
const PNAME = { pratt: 'Pratt', howe: 'Howe', altP: 'Alt ↘↗', altH: 'Alt ↗↘', x: 'X', warren: 'Warren', custom: 'Custom' };
function summaryOf(p) {
  const fam = p.family === 'warren' ? 'Warren' : PNAME[p.pattern] || 'Custom';
  let s = `${fam} · ${p.panels} panels · h ${(+p.height).toFixed(+p.height % 1 ? 1 : 0)}`;
  if (p.topShape && p.topShape !== 'flat') s += ` · ${p.topShape} top Δh ${(+p.topEnd).toFixed(+p.topEnd % 1 ? 1 : 0)}`;
  if (+p.botEnd) s += ` · Δp ${(+p.botEnd).toFixed(+p.botEnd % 1 ? 1 : 0)}`;
  if (p.curve) s += ` · ${p.bottom || 'parabola'} ${p.curve < 0 ? 'sag' : 'arch'} ${Math.abs(+p.curve).toFixed(0)}`;
  if (p.overall) s += ` · L ${(+p.overall).toFixed(0)}`;
  if (p.supportOffset > 0) s += ` · support ${(+p.supportOffset).toFixed(0)} mm back`;
  if (Math.abs(p.ratio - 1) > 1e-6) s += ` · taper ${(+p.ratio).toFixed(2)}`;
  if (p.family !== 'warren' && p.sideAngle < 89.9) s += ` · side ${(+p.sideAngle).toFixed(0)}°`;
  if (p.family !== 'warren' && p.vert === 'none') s += ' · no verticals';
  return s;
}

