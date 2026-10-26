(function () {
'use strict';
const C = TrussCore, X = TrussExport;
const $ = id => document.getElementById(id);
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
const COURSE = { mat: Object.assign({}, C.DEFAULT_MAT), load: { mBook1: 1.5, mBook2: 1.0, g: 9.81, nTruss: 2 }, opts: { deflLimit: 2.0, width: 60, crossTies: true, minOverlap: 5 } };
// NEVER rename this key: everyone's saved work lives under it. When the saved format changes, convert old data on load instead.
const KEY = 'se310-truss-v5';
const APP_VER = 33;   // bumped whenever the solver or the saved data changes

const DEFAULT = {
  name: 'Design A', family: 'grid', height: 70, panels: 4, ratio: 1, sideAngle: 90, sideLean: 'in',
  overall: 300, bookLen: 242, loads: null, bookWidth: 209, bookThick: 32, approachDiag: 'P', edgeVert: true, deskVert: true, deskMode: 'match', deskPanels: 1,
  bottom: 'flat', curve: -30, deskEnds: 'truss', supportMode: 'all', topShape: 'flat', topEnd: 0, botEnd: 0, edgeBear: false, showDims: true, showGhosts: true, bookContact: 'rigid', claw: 'off', brace: 'off', tableThick: 30, braceDepth: 20, fricK: 2, fricMu: 0.4, supportOffset: 0, overlap: 50, sticks: {}, groupBy: 'none',
  pattern: 'pratt', diagLeft: ['P', 'P'], diagMiddle: 'X', vertPreset: 'all', vertLeft: [true, true],
  mat: Object.assign({}, COURSE.mat), load: Object.assign({}, COURSE.load), opts: Object.assign({}, COURSE.opts),
  showIds: true, showElems: false, showDef: true, defScale: 20, wide: false, openMap: {}, tab: 'trade',
  history: [], baseline: 0,
};
let S = JSON.parse(JSON.stringify(DEFAULT));
var FIRST_VISIT = true;
try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && saved.panels) { S = Object.assign(S, saved); FIRST_VISIT = false; } } catch (e) {}
if (!S.migOv5) { if (S.opts && +S.opts.minOverlap === 20) S.opts.minOverlap = 5; S.migOv5 = true; }
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

// ---------- collapsible sections + side toggle
document.querySelectorAll('details.grp[id], details.sheet[id]').forEach(d => {
  if (S.openMap && d.id in S.openMap) d.open = !!S.openMap[d.id];
  d.addEventListener('toggle', () => { S.openMap[d.id] = d.open; save(); if (d.open && d.id === 's-track') drawTrackers(); });
});
function curView() { return S.wide ? 'bridge' : S.inputsFirst ? 'inputs' : 'both'; }
function setView(v) {
  if (v === 'analysis') { setFs(fsEl === '#trackBody' ? null : '#trackBody'); paintView(); return; }   // Analysis = that section full screen (again to leave)
  if (typeof fsEl !== 'undefined' && fsEl) setFs(null);   // the switch always shows its result, so it leaves full screen
  S.wide = v === 'bridge'; S.inputsFirst = v === 'inputs';
  paintSide(); paintLayout(); save(); setTimeout(sizeName, 30);
  if (v !== 'inputs') { renderDrawing(); drawTrackers(); }
}
function paintView() {
  const an = typeof fsEl !== 'undefined' && fsEl === '#trackBody', v = an ? 'analysis' : curView(), sw = $('viewSwitch'); if (!sw) return;
  sw.dataset.v = v; sw.querySelectorAll('[data-view]').forEach(b => { const on = b.dataset.view === v; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  const t = $('backTab'); t.hidden = v === 'both';
  t.className = 'backtab ' + (v === 'bridge' ? 'l' : 'r'); t.textContent = v === 'bridge' ? '▸ Show inputs' : 'Show bridge ◂';
}
function paintSide() { $('main').classList.toggle('wide', !!S.wide); $('toggleSide').textContent = S.wide ? 'Show inputs' : 'Hide inputs'; $('toggleSide').setAttribute('aria-pressed', String(!!S.wide)); }
$('toggleSide').addEventListener('click', () => { S.wide = !S.wide; paintSide(); save(); drawTrackers(); });
// condensed layout (number boxes and buttons only) and the trade-off data / notes, hidden by default
S.sideW = +S.sideW || 0;
function paintLayout() {
  const m = $('main');
  m.classList.toggle('first', !!S.inputsFirst); m.classList.toggle('onlyin', !!S.inputsFirst);
  document.body.classList.toggle('compact', compactOn());
  // never let the drawing side get squeezed below a readable width (a saved width from a bigger screen is trimmed)
  const mw = m.getBoundingClientRect().width || window.innerWidth;
  const sw = S.sideW ? Math.max(240, Math.min(S.sideW, mw - 440)) : 0;
  if (sw && !S.inputsFirst) m.style.setProperty('--sidew', sw + 'px'); else m.style.removeProperty('--sidew');
  $('toggleFirst').textContent = S.inputsFirst ? 'Drawing first' : 'Inputs first'; $('toggleFirst').setAttribute('aria-pressed', String(!!S.inputsFirst));
  document.body.classList.toggle('nohelp', !!S.hideHelp);
  paintView();
  $('toggleHelp').textContent = S.hideHelp ? 'Show help text' : 'Hide help text'; $('toggleHelp').setAttribute('aria-pressed', String(!!S.hideHelp));
}
$('toggleFirst').addEventListener('click', () => { S.inputsFirst = !S.inputsFirst; paintLayout(); save(); renderDrawing(); drawTrackers(); });
$('toggleHelp').addEventListener('click', () => { S.hideHelp = !S.hideHelp; paintLayout(); save(); });
(() => {
  const dv = $('divider'); let drag = null;
  dv.addEventListener('mousedown', ev => { ev.preventDefault(); drag = { x: ev.clientX, w: document.querySelector('.controls').getBoundingClientRect().width }; dv.classList.add('drag'); });
  window.addEventListener('mousemove', ev => {
    if (!drag) return;
    const raw = drag.w + ev.clientX - drag.x;
    if (raw < 170) { drag = null; dv.classList.remove('drag'); S.sideW = 0; setView('bridge'); toast('Inputs folded away. Use the Inputs tab on the left, or the switch at the top, to bring them back.'); return; }
    if ($('main').getBoundingClientRect().width - raw < 440) { drag = null; dv.classList.remove('drag'); S.sideW = 0; setView('inputs'); toast('Bridge folded away. Use the Bridge tab on the right, or the switch at the top, to bring it back.'); return; }
    const w = Math.max(240, Math.min($('main').getBoundingClientRect().width - 440, raw));
    S.sideW = Math.round(w); S.inputsFirst = false; paintLayout();
  });
  window.addEventListener('mouseup', () => { if (!drag) return; drag = null; dv.classList.remove('drag'); save(); renderDrawing(); drawTrackers(); });
  dv.addEventListener('dblclick', () => { S.sideW = 0; S.inputsFirst = false; paintLayout(); save(); renderDrawing(); drawTrackers(); });
})();
function compactOn() { return !!S.compact || !!S.inputsFirst || (typeof fsEl !== 'undefined' && fsEl === 'inputs'); }
function paintModes() {
  document.body.classList.toggle('compact', compactOn()); document.body.classList.toggle('showdata', !!S.showData);
  $('toggleCompact').textContent = S.compact ? 'Full layout' : 'Condensed'; $('toggleCompact').setAttribute('aria-pressed', String(!!S.compact));
  document.querySelectorAll('.datatgl').forEach(b => { b.textContent = S.showData ? 'Hide data and notes' : 'Show data and notes'; b.setAttribute('aria-pressed', String(!!S.showData)); b.title = S.showData ? 'Hide the explanation paragraphs and data tables' : 'Show the explanation paragraphs and data tables'; });
}
$('toggleCompact').addEventListener('click', () => { S.compact = !S.compact; paintModes(); save(); drawTrackers(); });
// the same switch sits in the Analysis and the Sweep title bars; clicking it must not fold the section
(function () { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost sm datatgl'; b.id = 'toggleData2'; $('sweepBtns').appendChild(b); })();
document.querySelectorAll('.datatgl').forEach(b => b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); S.showData = !S.showData; paintModes(); save(); drawTrackers(); }));
paintModes(); paintLayout();
window.addEventListener('resize', () => { clearTimeout(paintLayout.t); paintLayout.t = setTimeout(paintLayout, 150); });

// ---------- controls wiring
function seg(id, key) {
  $(id).addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; S[key] = b.dataset.v; update(); });
}
function paintSeg(id, val) { $(id).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === val))); }
seg('family', 'family'); seg('sideLean', 'sideLean'); seg('pattern', 'pattern'); seg('vertPreset', 'vertPreset');
seg('deskMode', 'deskMode'); seg('deskEnds', 'deskEnds'); seg('bottom', 'bottom'); seg('supportMode', 'supportMode'); seg('claw', 'claw'); seg('brace', 'brace');
['tableThick', 'braceDepth', 'fricK', 'fricMu'].forEach(id => $(id).addEventListener('change', () => { const v = +$(id).value; if (v >= 0 && isFinite(v)) { S[id] = v; update(); } }));
function pair(base, key, num) {
  const r = $(base + 'R'), n = $(base);
  const set = v => { if (v === '' || isNaN(+v)) return; S[key] = num ? Math.round(+v) : +v; update(); };
  r.addEventListener('input', () => set(r.value));
  n.addEventListener('change', () => set(n.value));
}
pair('height', 'height'); pair('topEnd', 'topEnd'); pair('botEnd', 'botEnd');
$('edgeBear').addEventListener('change', () => { S.edgeBear = $('edgeBear').checked; update(); });
['showDims', 'showGhosts', 'resOnDraw', 'showForces'].forEach(id => $(id).addEventListener('change', () => { S[id] = $(id).checked; renderDrawing(); if (topOn()) { draw3D(); draw3Views(); } save(); }));
$('hideStats').addEventListener('click', () => {
  S.hideStats = !S.hideStats;
  if (S.hideStats && !S.resOnDraw) { S.resOnDraw = true; $('resOnDraw').checked = true; toast('Results are now shown on the drawing.'); }
  paintStatsBox(); renderDrawing(); if (topOn()) draw3D(); save();
});
function paintStatsBox() { $('stats').hidden = !!S.hideStats; $('hideStats').textContent = S.hideStats ? 'Show results ▸' : 'Hide results ▾'; } seg('topShape', 'topShape'); seg('bookContact', 'bookContact');
$('bookThick').addEventListener('change', () => { const v = +$('bookThick').value; if (v > 0) { S.bookThick = v; update(); } }); pair('panels', 'panels', true); pair('ratio', 'ratio'); pair('sideAngle', 'sideAngle'); pair('bookLen', 'bookLen'); pair('curve', 'curve'); pair('deskPanels', 'deskPanels', true); pair('supportOffset', 'supportOffset'); pair('overlap', 'overlap');
$('name').addEventListener('input', () => { S.name = $('name').value || 'Design'; renderExport(); $('viewTitle').textContent = `${topOn() ? '3D bridge' : 'Side view'} · ${S.name}`; save(); });
const MATKEYS = { E: 'E', rho: 'rho', sigT: 'sigT', sigC: 'sigC', bS: 'b', hS: 'h', FS: 'FS' };
Object.entries(MATKEYS).forEach(([id, k]) => $(id).addEventListener('change', () => {
  const v = +$(id).value; if (!(v > 0)) return; S.mat[k] = id === 'rho' ? v * 1e-9 : v; update(); }));
['mBook1', 'mBook2', 'nTruss'].forEach(id => $(id).addEventListener('change', () => { const v = +$(id).value; if (!(v >= 0)) return; S.load[id] = id === 'nTruss' ? Math.max(1, Math.round(v)) : v; update(); }));
['width', 'deflLimit', 'minOverlap'].forEach(id => $(id).addEventListener('change', () => { const v = +$(id).value; if (!(v >= 0)) return; S.opts[id] = v; update(); }));
$('crossTies').addEventListener('change', () => { S.opts.crossTies = $('crossTies').checked; update(); });
$('resetMat').addEventListener('click', () => { S.mat = Object.assign({}, COURSE.mat); S.load = Object.assign({}, COURSE.load); S.opts = Object.assign({}, COURSE.opts); update(); });
['showIds', 'showElems', 'showDef'].forEach(id => $(id).addEventListener('change', () => { S[id] = $(id).checked; renderDrawing(); if (typeof draw3D === 'function') { draw3D(); draw3Views(); } save(); }));
$('defScale').addEventListener('input', () => { S.defScale = +$('defScale').value; $('defScaleV').textContent = S.defScale; renderDrawing(); if (typeof draw3D === 'function') draw3D(); save(); });

// ---------- chips
const CYCLE = ['P', 'H', 'X', 'N'];
const DNAME = { P: 'down', H: 'up', X: 'X', N: 'none' };
function diagIcon(code) {
  const l = [];
  const box = '<rect x="2" y="2" width="30" height="20" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2"/>';
  if (code === 'P' || code === 'X') l.push('<line x1="2" y1="2" x2="32" y2="22"/>');
  if (code === 'H' || code === 'X') l.push('<line x1="2" y1="22" x2="32" y2="2"/>');
  return `<svg viewBox="0 0 34 24" aria-hidden="true">${box}<g stroke="currentColor" stroke-width="2.2" stroke-linecap="round">${l.join('')}</g></svg>`;
}
function chip(code, label, title, opts) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip' + (code !== 'N' ? ' on' : '') + (opts && opts.desk ? ' desk' : '');
  b.disabled = !!(opts && opts.disabled);
  b.innerHTML = diagIcon(b.disabled ? 'N' : code) + `<span>${label}</span>`;
  b.title = title;
  return b;
}
function renderDiagChips() {
  const el = $('diagChips'); el.innerHTML = '';
  const merged = tr && tr.info.merged, app = hasApp();
  if (app) {
    const c = S.approachDiag;
    const b = chip(c, merged ? 'Desk: end post' : 'Desk ' + DNAME[c], merged ? 'The sloped end post already braces the panel over the desk' : 'Panel resting on the desk: ' + DNAME[c], { desk: true, disabled: merged });
    b.addEventListener('click', () => { S.approachDiag = CYCLE[(CYCLE.indexOf(c) + 1) % 4]; update(); });
    el.appendChild(b);
  }
  S.diagLeft.forEach((c, i) => {
    const dis = merged && !app && i === 0;
    const b = chip(c, `P${i + 1} ${dis ? 'end post' : DNAME[c]}`, dis ? 'The sloped end post already braces this panel' : `Span panel ${i + 1}: ${DNAME[c]}`, { disabled: dis });
    b.addEventListener('click', () => { S.pattern = 'custom'; S.diagLeft[i] = CYCLE[(CYCLE.indexOf(c) + 1) % 4]; update(); });
    el.appendChild(b);
  });
  if (S.panels % 2 === 1) {
    const c = S.diagMiddle;
    const b = chip(c, `Mid ${c === 'X' ? 'X' : 'none'}`, 'The middle panel must be symmetric on its own, so it takes X bracing or nothing');
    b.addEventListener('click', () => { S.diagMiddle = c === 'X' ? 'N' : 'X'; update(); });
    el.appendChild(b);
  }
}
function vChip(on, label, title, desk) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip' + (on ? ' on' : '') + (desk ? ' desk' : ''); b.setAttribute('aria-pressed', String(on));
  b.innerHTML = `<svg viewBox="0 0 34 24" aria-hidden="true"><line x1="2" y1="2" x2="32" y2="2" stroke="currentColor" stroke-opacity=".35"/><line x1="2" y1="22" x2="32" y2="22" stroke="currentColor" stroke-opacity=".35"/>${on ? '<line x1="17" y1="2" x2="17" y2="22" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' : '<line x1="17" y1="2" x2="17" y2="22" stroke="currentColor" stroke-width="1" stroke-dasharray="2 3"/>'}</svg><span>${label}</span>`;
  b.title = title; return b;
}
function renderVertChips() {
  const el = $('vertChips'); el.innerHTML = '';
  if (hasApp()) {
    if (tr.deskPanels >= 2) {
      const b0 = vChip(S.deskVert, 'Desk', 'Verticals at the other joints on the desks', true);
      b0.addEventListener('click', () => { S.vertPreset = 'custom'; S.deskVert = !S.deskVert; update(); });
      el.appendChild(b0);
    }
    const b = vChip(S.edgeVert, 'Edge', 'Vertical at the desk edge (x = 0 and 200 mm)', true);
    b.addEventListener('click', () => { S.vertPreset = 'custom'; S.edgeVert = !S.edgeVert; update(); });
    el.appendChild(b);
  }
  S.vertLeft.forEach((on, k) => {
    const p = k + 1, centre = (S.panels % 2 === 0 && p === S.panels / 2);
    const b = vChip(on, `J${p}${centre ? ' mid' : ''}`, `Vertical at span joint ${p}${centre ? ' (mid-span)' : ''}`);
    b.addEventListener('click', () => { S.vertPreset = 'custom'; S.vertLeft[k] = !on; update(); });
    el.appendChild(b);
  });
}

// ---------- main update
function update() {
  S.panels = Math.max(2, Math.min(12, Math.round(S.panels)));
  S.overall = Math.max(200, Math.min(300, +S.overall || 200));
  S.height = Math.max(0, +S.height || 0); const faceMax = Math.min(+S.tableThick || 0, 50); S.topEnd = Math.max(-faceMax, Math.min(S.height, +S.topEnd || 0)); S.botEnd = Math.max(-faceMax, Math.min(S.height, +S.botEnd || 0)); S.curve = Math.max(-60, Math.min(120, +S.curve || 0));
  S.deskPanels = Math.max(0, Math.min(6, Math.round(+S.deskPanels || 0))); S.supportOffset = Math.max(0, Math.min(50, +S.supportOffset || 0)); S.overlap = Math.max(0, Math.min(50, +S.overlap || 0));
  syncArrays();
  tr = C.buildTruss(design());
  res2d = C.analyze(tr, S.mat, S.load, S.opts);
  res = S.anaMode === '3d' ? apply3D(tr, res2d, S.load, d3opts(null)) : res2d;
  clearTimeout(update.bk); update.bk = setTimeout(() => { try { if (res && res.stable) backupBridge('after your changes'); } catch (e) {} }, 15000);
  paintInputs(); if (typeof sizeName === 'function') sizeName(); renderDiagChips(); renderVertChips(); renderDrawing(); renderStats(); renderTable(); renderExport(); updateSweepCount(); renderHistory(); render3D();
  save();
}
let res2d = null;
function setVal(id, v) { const el = $(id); if (document.activeElement !== el) el.value = v; }
// ---------- loads on the deck (replace the single book when set)
const LOAD_TYPES = { uniform: 'Uniform', partial: 'Partial uniform', ramp: 'Ramp', point: 'Point' };
const SPAN_MID = 100;   // the default span is 200 mm
function loadAdd(type) {
  if (!S.loads) S.loads = [{ type: 'uniform', a: SPAN_MID - (+S.bookLen) / 2, b: SPAN_MID + (+S.bookLen) / 2, w: 1 }];
  if (type === 'book') { S.loads = null; }
  else if (type === 'point') S.loads.push({ type, x: SPAN_MID, w: 1 });
  else S.loads.push({ type, a: 60, b: 140, w: 1, dir: 'up' });
  update();
}
function renderLoads() {
  const el = $('loadList'); if (!el) return;
  if (!S.loads) { el.innerHTML = ''; $('loadNote').textContent = `the book, ${(+S.bookLen).toFixed(0)} mm, uniform and centred (Book length above)`; return; }
  $('loadNote').textContent = 'custom loads (Book length is ignored while these are set)';
  el.innerHTML = S.loads.map((L, i) => {
    const opts = Object.keys(LOAD_TYPES).map(k => `<option value="${k}" ${L.type === k ? 'selected' : ''}>${LOAD_TYPES[k]}</option>`).join('');
    const pos = L.type === 'point'
      ? `<label class="lf">at (mm)<input type="number" step="0.5" data-i="${i}" data-k="x" value="${(+L.x).toFixed(1)}"></label>`
      : `<label class="lf">from<input type="number" step="0.5" data-i="${i}" data-k="a" value="${(+L.a).toFixed(1)}"></label><label class="lf">to<input type="number" step="0.5" data-i="${i}" data-k="b" value="${(+L.b).toFixed(1)}"></label>`;
    const dir = L.type === 'ramp' ? `<label class="lf">rises<select data-i="${i}" data-k="dir"><option value="up" ${L.dir !== 'down' ? 'selected' : ''}>toward the end</option><option value="down" ${L.dir === 'down' ? 'selected' : ''}>toward the start</option></select></label>` : '';
    return `<div class="loadrow"><select data-i="${i}" data-k="type" aria-label="Load ${i + 1} type">${opts}</select>${pos}${dir}<label class="lf">weight<input type="number" step="0.1" min="0" data-i="${i}" data-k="w" value="${(+L.w).toFixed(2)}"></label><button type="button" class="btn ghost sm" data-del="${i}" aria-label="Remove load ${i + 1}">×</button></div>`;
  }).join('');
}
$('loadList').addEventListener('change', ev => {
  const t = ev.target, i = +t.dataset.i, k = t.dataset.k; if (!S.loads || isNaN(i) || !S.loads[i]) return;
  const L = S.loads[i];
  if (k === 'type') {
    const was = L.type; L.type = t.value;
    if (L.type === 'point' && was !== 'point') { L.x = (+L.a + +L.b) / 2 || SPAN_MID; }
    if (L.type !== 'point' && was === 'point') { L.a = (+L.x) - 25; L.b = (+L.x) + 25; }
    if (L.type === 'ramp' && !L.dir) L.dir = 'up';
  } else if (k === 'dir') L.dir = t.value;
  else { const v = +t.value; if (!(v >= -50 && v <= 250) && k !== 'w') return; if (k === 'w') L.w = Math.max(0, v || 0); else L[k] = v; }
  update();
});
$('loadList').addEventListener('click', ev => { const b = ev.target.closest('[data-del]'); if (!b || !S.loads) return; S.loads.splice(+b.dataset.del, 1); if (!S.loads.length) S.loads = null; update(); });
$('addLoad').addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) loadAdd(b.dataset.v); });
if (+S.bookWidth === 20.8) S.bookWidth = 209;   // the real book: 242 x 209 x 32 mm
if (+S.bookThick === 50.8) S.bookThick = 32;
$('bookWidth').addEventListener('change', () => { const v = +$('bookWidth').value; if (v > 0) { S.bookWidth = v; update(); } });
function paintInputs() {
  paintSeg('family', S.family); paintSeg('sideLean', S.sideLean);
  paintSeg('deskMode', S.deskMode); paintSeg('bottom', S.bottom); paintSeg('supportMode', S.supportMode); paintSeg('claw', S.claw); paintSeg('brace', S.brace); renderFocus(); ['tableThick', 'braceDepth', 'fricK', 'fricMu'].forEach(id => setVal(id, S[id])); setVal('bookWidth', S.bookWidth); renderLoads();
  $('curveRow').hidden = S.bottom === 'flat'; paintSeg('deskEnds', S.deskEnds); $('deskEnds').hidden = false; $('deskEnds').style.opacity = tr.deskPanels > 0 ? '' : '0.4'; $('deskEnds').querySelectorAll('button').forEach(b => { b.disabled = !(tr.deskPanels > 0); }); $('deskEnds').title = tr.deskPanels > 0 ? '' : 'Needs at least one desk panel'; setVal('minOverlap', S.opts.minOverlap); $('overlapRow').hidden = S.deskMode !== 'length';
  const k = tr.deskPanels;
  $('deskNote').textContent = k ? `${k} panel${k > 1 ? 's' : ''} of ${tr.info.deskWidth.toFixed(1)} mm on each desk · overall length ${tr.overall.toFixed(0)} mm` : `No desk panels · overall length ${tr.overall.toFixed(0)} mm (the bridge just reaches the desk edges)`;
  const so = tr.info.supportOffset;
  $('supNote').textContent = `${so.toFixed(0)} mm (x = ${(-so).toFixed(0)} and ${(200 + so).toFixed(0)} mm)`;
  setVal('swFS', S.mat.FS); $('swFSv').textContent = (+S.mat.FS).toFixed(1);
  setVal('swBook', (S.load.mBook1 + S.load.mBook2).toFixed(1)); $('swBookv').textContent = (S.load.mBook1 + S.load.mBook2).toFixed(2) + ' kg';
  paintSeg('pattern', S.pattern); paintSeg('vertPreset', S.vertPreset);
  setVal('name', S.name);
  [['height', S.height], ['topEnd', S.topEnd], ['botEnd', S.botEnd], ['panels', S.panels], ['ratio', S.ratio], ['sideAngle', S.sideAngle], ['bookLen', S.bookLen], ['curve', S.curve], ['deskPanels', S.deskPanels], ['supportOffset', S.supportOffset], ['overlap', S.overlap]].forEach(([k, v]) => { setVal(k, v); setVal(k + 'R', v); });
  const grid = S.family === 'grid';
  $('diagBox').hidden = !grid; $('vertBox').hidden = !grid; $('sideRow').hidden = !grid;
  paintSeg('topShape', S.topShape); $('topEndRow').hidden = S.topShape === 'flat'; $('topEndR').max = Math.max(1, +S.height); paintSeg('bookContact', S.bookContact); setVal('bookThick', S.bookThick);
  $('memberCount').textContent = `${tr.elems.length} members · ${tr.nodes.length} joints`;
  $('widthList').textContent = 'Panel widths: ' + tr.widths.map(w => w.toFixed(1)).join(' / ') + ' mm' + (hasApp() ? ` (the outer ${tr.deskPanels} on each side rest on the desks)` : '');
  const sa = tr.info.sideAngleActual;
  $('sideNote').textContent = grid ? (tr.warn.filter(w => /angle|lean/i.test(w)).join(' ') || (sa < 89.99 ? `Actual end-post angle ${sa.toFixed(1)}°, overall length ${tr.overall.toFixed(0)} mm.` : `Vertical end posts, overall length ${tr.overall.toFixed(0)} mm.`)) : '';
  setVal('mBook1', S.load.mBook1); setVal('mBook2', S.load.mBook2); setVal('nTruss', S.load.nTruss);
  setVal('FS', S.mat.FS); setVal('E', S.mat.E); setVal('rho', Math.round(S.mat.rho * 1e9)); setVal('sigT', S.mat.sigT); setVal('sigC', S.mat.sigC);
  setVal('bS', S.mat.b); setVal('hS', S.mat.h); setVal('width', S.opts.width); setVal('deflLimit', S.opts.deflLimit);
  $('crossTies').checked = !!S.opts.crossTies;
  $('resOnDraw').checked = !!S.resOnDraw; $('showForces').checked = !!S.showForces; paintStatsBox();
  $('showDims').checked = S.showDims !== false; $('showGhosts').checked = S.showGhosts !== false; $('edgeBear').checked = !!S.edgeBear;
  $('topEndR').min = $('botEndR').min = -Math.min(+S.tableThick || 0, 30);
  $('showIds').checked = S.showIds; $('showElems').checked = S.showElems; $('showDef').checked = S.showDef;
  $('defScale').value = S.defScale; $('defScaleV').textContent = S.defScale;
  $('tbLoad').textContent = `${(S.load.mBook1 + S.load.mBook2).toFixed(2)} kg × FS ${(+S.mat.FS).toFixed(1)}`;
  $('viewTitle').textContent = `${topOn() ? '3D bridge' : 'Side view'} · ${S.name}`;
  paintSide();
}

// ---------- drawing
// ---------- the variables on the drawing: dimension labels you can click, and the sweep ranges as dashed outlines
const fmt1 = v => (+v).toFixed(Math.abs((+v) % 1) > 1e-9 ? 1 : 0);
const GHOST = [
  { k: 'H', f: v => ({ height: v }), name: 'h', col: 'var(--g1)' },
  { k: 'T', f: v => ({ topEnd: v }), name: 'Δh', col: 'var(--g7)' },
  { k: 'Q', f: v => ({ botEnd: v }), name: 'Δp', col: 'var(--g8)' },
  { k: 'D', f: v => ({ curve: v, bottom: S.bottom === 'flat' ? 'parabola' : S.bottom }), name: 'p', col: 'var(--g2)' },
  { k: 'O', f: v => ({ deskMode: 'length', overlap: v, deskPanels: Math.max(1, +S.deskPanels || 1) }), name: 'overlap', col: 'var(--g3)' },
  { k: 'S', f: v => ({ supportOffset: v }), name: 'support', col: 'var(--g4)' },
  { k: 'R', f: v => ({ ratio: v }), name: 'taper', col: 'var(--g5)' },
  { k: 'A', f: v => ({ sideAngle: v }), name: 'side', col: 'var(--g6)' },
];
function sweepGhosts(Y) {
  if (typeof swOn !== 'function') return '';
  const out = [], F = 'IBM Plex Mono, monospace';
  let row = 0;
  GHOST.forEach(g => {
    if (!swOn(g.k)) return;
    const a0 = +$('sw' + g.k + '0').value, a1 = +$('sw' + g.k + '1').value;
    const ends = [Math.min(a0, a1), Math.max(a0, a1)];
    const st = Math.abs(+$('sw' + g.k + 's').value) || 0;
    if (st > 0 && (ends[1] - ends[0]) / st <= 60) for (let v = ends[0] + st; v < ends[1] - st / 2; v += st) {
      let t3; try { t3 = C.buildTruss(design(g.f(+v.toFixed(4)))); } catch (e) { continue; }
      out.push(`<g stroke="var(--muted)" stroke-width=".3" opacity=".35" fill="none" pointer-events="none">${t3.elems.filter(e => e.type === 'top' || e.type === 'bot' || e.type === 'end').map(e => { const p = t3.nodes[e.i], q = t3.nodes[e.j]; return `<line x1="${p[0]}" y1="${Y(p[1])}" x2="${q[0]}" y2="${Y(q[1])}"/>`; }).join('')}</g>`);
    }
    ends.forEach((v, j) => {
      let t2; try { t2 = C.buildTruss(design(g.f(v))); } catch (e) { return; }
      const segs = t2.elems.filter(e => e.type === 'top' || e.type === 'bot' || e.type === 'end').map(e => { const p = t2.nodes[e.i], q = t2.nodes[e.j]; return `<line x1="${p[0]}" y1="${Y(p[1])}" x2="${q[0]}" y2="${Y(q[1])}"/>`; }).join('');
      out.push(`<g stroke="${g.col}" stroke-width="${j ? 0.9 : 0.7}" stroke-dasharray="${j ? '4 2' : '1.4 1.4'}" fill="none" opacity=".9" pointer-events="none">${segs}</g>`);
    });
    out.push(`<text x="${-48}" y="${Y(100) + 8 + 5 * row}" font-size="3.8" fill="${g.col}" font-family="${F}">sweep ${g.name}: ${fmt1(ends[0])} (dotted) to ${fmt1(ends[1])} (dashed)${st > 0 ? `, grey every ${fmt1(st)}` : ''}</text>`);
    row++;
  });
  if (swOn('N')) { const ns = Object.keys(SW.panels).filter(k => SW.panels[k]); if (ns.length) { out.push(`<text x="${-48}" y="${Y(100) + 8 + 5 * row}" font-size="3.8" fill="var(--g8)" font-family="${F}">sweep panels: ${ns.join(', ')}</text>`); row++; } }
  return out.join('');
}
function dimLabels(Y, vx0, vx1) {
  const out = [], F = 'IBM Plex Mono, monospace', labs = [];
  const lab = (x, y, text, key, anchor) => {
    const tx = '✎ ' + text, w = tx.length * 2.3 + 4, x0 = anchor === 'end' ? x - w : anchor === 'start' ? x : x - w / 2;
    labs.push({ x0, y, w, tx, key, ax: x, ay: y - 1.2, y0: y });
  };
  const vdim = (x, y0, y1) => out.push(`<g stroke="var(--muted)" stroke-width=".35" pointer-events="none"><line x1="${x}" y1="${Y(y0)}" x2="${x}" y2="${Y(y1)}"/><line x1="${x - 2}" y1="${Y(y0)}" x2="${x + 2}" y2="${Y(y0)}"/><line x1="${x - 2}" y1="${Y(y1)}" x2="${x + 2}" y2="${Y(y1)}"/></g>`);
  const hdim = (x0, x1, y) => out.push(`<g stroke="var(--muted)" stroke-width=".35" pointer-events="none"><line x1="${x0}" y1="${Y(y)}" x2="${x1}" y2="${Y(y)}"/><line x1="${x0}" y1="${Y(y) - 2}" x2="${x0}" y2="${Y(y) + 2}"/><line x1="${x1}" y1="${Y(y) - 2}" x2="${x1}" y2="${Y(y) + 2}"/></g>`);
  const H = +S.height, mid = 100;
  vdim(mid + 7, 0, H); lab(mid + 9, Y(H / 2) + 1.5, `h ${fmt1(H)}`, 'height', 'start');
  if (S.topShape !== 'flat') { vdim(5, 0, +S.topEnd); lab(7, Y(+S.topEnd / 2) - 3, `Δh ${fmt1(S.topEnd)}`, 'topEnd', 'start'); }
  { const be = +S.botEnd || 0; if (Math.abs(be) > 1e-9) vdim(-4, 0, be); lab(-6, Y(be / 2) + (be < 0 ? 1.5 : 3), `Δp ${fmt1(be)}`, 'botEnd', 'end'); }
  if (S.bottom !== 'flat' && +S.curve) { vdim(mid - 7, 0, +S.curve); lab(mid - 9, Y(+S.curve / 2) + 1.5, `p ${fmt1(S.curve)}`, 'curve', 'end'); }
  else lab(mid - 9, Y(0) + 9, 'p 0 (flat)', 'curve', 'end');
  const ov = Math.max(0, tr.overlap), ovKey = S.deskMode === 'length' ? 'overlap' : 'deskPanels';
  if (ov > 0.01) { hdim(-ov, 0, -8); lab(-ov / 2, Y(-8) + 6.5, `overlap ${fmt1(ov)}`, ovKey); }
  else lab(-3, Y(-8) + 6.5, 'overlap 0', ovKey, 'end');
  const so = tr.info.supportOffset || 0;
  lab(-so - 3, Y(-17) + 6.5, `support ${fmt1(so)} back`, 'supportOffset', 'end');
  lab(30, Y(-57), `${S.panels} panels`, 'panels');
  lab(170, Y(-57), `taper ${(+S.ratio).toFixed(2)}`, 'ratio');
  if (S.family === 'grid') { const xs = tr.nodes.map(n => n[0]); lab(Math.min(...xs) - 3, Y(Math.max(H, 0) * 0.55), `side ${fmt1(tr.info.sideAngleActual)}°`, 'sideAngle', 'end'); }
  // push labels apart: each one moves down (then up) until it no longer overlaps one already placed
  if (vx0 != null) labs.forEach(L => { L.x0 = Math.max(vx0 + 1, Math.min(L.x0, vx1 - L.w - 1)); });
  const placed = [], hit = (A, B) => A.x0 < B.x0 + B.w + 1 && B.x0 < A.x0 + A.w + 1 && Math.abs(A.y - B.y) < 7;
  labs.forEach(L => {
    for (let k = 0; k < 40 && placed.some(P => hit(L, P)); k++) L.y = L.y0 + (k % 2 ? -1 : 1) * 7 * Math.ceil((k + 1) / 2);
    placed.push(L);
  });
  labs.forEach(L => {
    if (Math.abs(L.y - L.y0) > 0.5) out.push(`<line x1="${L.x0 + L.w / 2}" y1="${L.y - 1.2}" x2="${L.ax}" y2="${L.ay}" stroke="var(--accent)" stroke-width=".3" stroke-dasharray="1 .8" pointer-events="none"/>`);
    out.push(`<g class="dimlab" data-var="${L.key}"><title>Click to change ${L.tx.slice(2).split(' ')[0]}</title><rect x="${L.x0}" y="${L.y - 4.4}" width="${L.w}" height="6.2" rx="1.4" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width=".5"/><text x="${L.x0 + L.w / 2}" y="${L.y}" font-size="3.9" font-weight="600" text-anchor="middle" fill="var(--accent)" font-family="${F}">${L.tx}</text></g>`);
  });
  return out.join('');
}
const DIMVARS = {
  height: { label: 'h · top chord height at mid-span', unit: 'mm', sw: 'H' },
  topEnd: { label: 'Δh · top chord at the desk edges (0 = on the table corner, below 0 = against the inside face of the edge)', unit: 'mm', sw: 'T' },
  botEnd: { label: 'Δp · bottom chord at the desk edges (0 = on the table corner, below 0 = against the inside face of the edge)', unit: 'mm', sw: 'Q' },
  curve: { label: 'p · bottom chord at mid-span (− sag, + arch). Pick the curve shape under Bottom chord.', unit: 'mm', sw: 'D' },
  overlap: { label: 'overlap onto each desk (foot length)', unit: 'mm', sw: 'O' },
  deskPanels: { label: 'panels on each desk (the overlap follows the panel width; switch to "Set the overlap" to type it)', unit: '', sw: null },
  supportOffset: { label: 'support distance back from the desk edge', unit: 'mm', sw: 'S' },
  panels: { label: 'panels across the span', unit: '', sw: 'N', chips: true },
  ratio: { label: 'panel width taper (centre ÷ end)', unit: '', sw: 'R' },
  sideAngle: { label: 'angle of the sides (90 = vertical end posts)', unit: '°', sw: 'A' },
  width3d: { label: 'bridge width (centre of the front truss to centre of the back truss)', unit: 'mm', sw: 'W' },
  tilt3d: { label: 'tilt in y (+ leans in): each truss leans about its bottom line. The orange planes show the tilt while you edit it.', unit: '°', sw: 'Y' },
};
function swBox(k) { return k === 'O' ? $('swVaryOv') : $('swOn' + k); }
// ---------- adjust a parameter on the drawing: click its ✎ label, then drag. Up/down = value, left/right = sweep range, wheel = sweep step.
// Coordinates follow the drawing: up and right are positive.
const DRAGK = {   // how far one pixel of drag moves each kind of parameter, and the steps the wheel walks through
  mm: { px: 0.25, round: 0.1, steps: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20] },
  ratio: { px: 0.005, round: 0.01, steps: [0.01, 0.02, 0.05, 0.1, 0.2] },
  deg: { px: 0.25, round: 0.5, steps: [0.5, 1, 2, 5, 10] },
  count: { px: 1 / 18, round: 1, steps: [1, 2] },
};
S.dragUnit = Object.assign({ mm: 1, ratio: 0.05, deg: 1, count: 1 }, S.dragUnit || {});
const UNIT_CHOICES = { mm: [0.1, 0.25, 0.5, 1, 2, 5, 10], ratio: [0.01, 0.02, 0.05, 0.1], deg: [0.5, 1, 2, 5], count: [1] };
const PX_PER_UNIT = 8;
const kindOf = key => key === 'ratio' ? 'ratio' : (key === 'sideAngle' || key === 'tilt3d') ? 'deg' : (key === 'panels' || key === 'deskPanels') ? 'count' : 'mm';
S.dragMode = S.dragMode || 'widen';
let adj = null;   // the parameter being adjusted
function dimFields(key) {
  const v = DIMVARS[key], sw = v.sw;
  return { inp: $(key), sw, chips: !!v.chips, on: !!(sw && swOn(sw)), f: sw && !v.chips ? $('sw' + sw + '0') : null, t: sw && !v.chips ? $('sw' + sw + '1') : null, s: sw && !v.chips ? $('sw' + sw + 's') : null };
}
function setInput(el, v, evName) { el.value = v; el.dispatchEvent(new Event(evName || 'change', { bubbles: true })); }
function popHost() { return typeof topOn === 'function' && topOn() ? $('c3d').parentElement : $('drawWrap'); }
function placePop(pop) {
  const wrap = popHost(); if (pop.parentElement !== wrap) wrap.appendChild(pop);
  const r = wrap.getBoundingClientRect();
  if (S.popPos) { pop.style.left = Math.max(0, Math.min(r.width - 60, S.popPos[0] * r.width)) + 'px'; pop.style.top = Math.max(0, Math.min(r.height - 40, S.popPos[1] * r.height)) + 'px'; return; }
  // default spot: over the right-hand desk, where there is usually nothing to read
  pop.style.left = Math.max(4, r.width - 270) + 'px'; pop.style.top = Math.max(4, r.height * 0.42) + 'px';
}
function openDimPop(key) {
  const v = DIMVARS[key]; if (!v) return;
  adj = { key }; const F = dimFields(key), pop = $('dimPop');
  document.querySelectorAll('.dimlab').forEach(g => g.classList.toggle('act', g.dataset.var === key));
  pop.innerHTML = `<div class="dpgrip" id="dpGrip" title="Drag to move this box">⠿ move</div><b>${v.label}</b>
    <span class="hint" style="margin:0">Drag on the drawing: <b>up/down</b> value · <b>left/right</b> sweep range · <b>wheel</b> sweep step. Tab moves between the boxes.</span>
    <label style="display:flex;gap:6px;align-items:center">value <input type="number" id="dpVal" step="any" value="${F.inp.value}" style="width:96px"> ${v.unit}</label>
    ${F.sw ? `<label class="check"><input type="checkbox" id="dpSw" ${F.on ? 'checked' : ''}> Sweep this</label>` : ''}
    ${F.f ? `<div class="trio" id="dpTrio"><label>from<input type="number" step="any" data-t="0" value="${F.f.value}"></label><label>to<input type="number" step="any" data-t="1" value="${F.t.value}"></label><label>step<input type="number" step="any" data-t="s" value="${F.s.value}"></label></div>
      <label style="font-size:12px">left/right drag <select id="dpMode"><option value="widen">widens / narrows the range</option><option value="to">moves the "to" end</option><option value="shift">shifts the whole range</option></select></label>` : ''}
    ${F.chips ? `<div class="chips" id="dpChips">${Object.keys(SW.panels).map(k => `<button type="button" class="chip${SW.panels[k] ? ' on' : ''}" data-pc="${k}">${k}</button>`).join('')}</div><span class="hint" style="margin:0">Panel counts the sweep tries. Tick "Sweep this" to use them.</span>` : ''}
    <div class="dpjoy"><div class="joy" id="dpJoy" title="Pull the knob: up/down changes the value, left/right the sweep range. Further = faster."><div class="knob" id="dpKnob"></div></div>
      <label style="font-size:12px">change by <input type="number" id="dpUnit" list="dpUnits" step="any" min="0" style="width:70px"> ${v.unit}<datalist id="dpUnits">${UNIT_CHOICES[kindOf(key)].map(u => `<option value="${u}"></option>`).join('')}</datalist></label></div>
    <div class="btns"><button type="button" class="btn ghost sm" id="dpShow">Show in the panel</button><button type="button" class="btn acc sm" id="dpClose">Done</button></div>`;
  pop.hidden = false; placePop(pop);
  $('dpGrip').addEventListener('pointerdown', ev => {
    ev.preventDefault(); ev.stopPropagation();
    const g = $('dpGrip'); g.setPointerCapture(ev.pointerId);
    const r = pop.parentElement.getBoundingClientRect(), x0 = ev.clientX - pop.offsetLeft, y0 = ev.clientY - pop.offsetTop;
    const mv = e => { pop.style.left = Math.max(0, Math.min(r.width - 60, e.clientX - x0)) + 'px'; pop.style.top = Math.max(0, Math.min(r.height - 30, e.clientY - y0)) + 'px'; };
    const up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); S.popPos = [pop.offsetLeft / r.width, pop.offsetTop / r.height]; save(); };
    g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up);
  });
  const kind = kindOf(key);
  $('dpUnit').value = S.dragUnit[kind];
  $('dpUnit').addEventListener('change', () => { const u = +$('dpUnit').value; if (u > 0) { S.dragUnit[kind] = kind === 'count' ? Math.max(1, Math.round(u)) : u; save(); } $('dpUnit').value = S.dragUnit[kind]; });
  if ($('dpChips')) $('dpChips').addEventListener('click', ev => {
    const b = ev.target.closest('[data-pc]'); if (!b) return;
    const src = [...$('swPanels').querySelectorAll('button')].find(x => x.textContent === b.dataset.pc); if (src) src.click();
    b.classList.toggle('on', !!SW.panels[b.dataset.pc]);
  });
  joystick(key);
  if ($('dpMode')) { $('dpMode').value = S.dragMode; $('dpMode').addEventListener('change', () => { S.dragMode = $('dpMode').value; save(); }); }
  $('dpVal').addEventListener('change', () => setInput(F.inp, $('dpVal').value));
  if ($('dpSw')) $('dpSw').addEventListener('change', () => { const box = swBox(F.sw); box.checked = $('dpSw').checked; box.dispatchEvent(new Event('change', { bubbles: true })); refreshPop(); renderDrawing(); });
  if ($('dpTrio')) $('dpTrio').querySelectorAll('input').forEach(q => q.addEventListener('change', () => { setInput($('sw' + F.sw + q.dataset.t), q.value, 'input'); updateSweepCount(); renderDrawing(); }));
  $('dpShow').addEventListener('click', () => {
    closeAdj(); const det = F.inp.closest('details'); if (det) det.open = true;
    const row = F.inp.closest('.row') || F.inp; row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1600);
  });
  $('dpClose').addEventListener('click', closeAdj);
  $('drawWrap').classList.add('adjusting');
}
function refreshPop() {   // keep the editor's boxes in step with a drag
  if (!adj) return; const F = dimFields(adj.key);
  if ($('dpVal') && document.activeElement !== $('dpVal')) $('dpVal').value = F.inp.value;
  if ($('dpSw')) $('dpSw').checked = swOn(F.sw);
  if ($('dpTrio')) $('dpTrio').querySelectorAll('input').forEach(q => { if (document.activeElement !== q) q.value = $('sw' + F.sw + q.dataset.t).value; });
}
function closeAdj() { const was = adj && adj.key; adj = null; $('dimPop').hidden = true; $('drawWrap').classList.remove('adjusting'); document.querySelectorAll('.dimlab.act').forEach(g => g.classList.remove('act')); if (was && typeof draw3D === 'function') draw3D(); }
const rnd = (v, r) => +(Math.round(v / r) * r).toFixed(4);
let dragRaf = 0;
$('drawWrap').addEventListener('pointerdown', ev => {
  if (!adj || ev.button !== 0 || ev.target.closest('.dimpop') || ev.target.closest('.dimlab') || ev.target.closest('.infobtn') || ev.target.closest('.infobox') || ev.target.closest('.navpad')) return;
  const F = dimFields(adj.key);
  adj.drag = { x: ev.clientX, y: ev.clientY, v0: +F.inp.value, f0: F.f ? +F.f.value : 0, t0: F.t ? +F.t.value : 0, on0: F.on };
  $('drawWrap').setPointerCapture(ev.pointerId); ev.preventDefault();
});
$('drawWrap').addEventListener('pointermove', ev => {
  if (!adj || !adj.drag) return;
  const d = adj.drag, F = dimFields(adj.key), unit = S.dragUnit[kindOf(adj.key)];
  let dy = d.y - ev.clientY, dx = ev.clientX - d.x;   // up and right are positive
  // lock to whichever direction moved more, so the hand does not have to go perfectly straight
  if (!d.axis && Math.abs(dx) + Math.abs(dy) > 8) d.axis = Math.abs(dy) >= Math.abs(dx) ? 'v' : 'h';
  if (d.axis === 'v') dx = 0; else if (d.axis === 'h') dy = 0; else return;
  cancelAnimationFrame(dragRaf);
  dragRaf = requestAnimationFrame(() => applyDelta(d, F, Math.trunc(dy / PX_PER_UNIT) * unit, Math.trunc(dx / PX_PER_UNIT) * unit, unit));
});
// move the value by dv and the sweep range by ds (both already whole units), starting from the values when the drag began
function applyDelta(d, F, dv, ds, unit) {
  {
    if (dv) { const nv = rnd(d.v0 + dv, unit); if (+F.inp.value !== nv) setInput(F.inp, nv); }
    if (F.f && ds) {
      let f = d.f0, t = d.t0;
      if (!d.on0) { f = d.v0; t = d.v0; }   // starting a sweep: the range grows out of the current value
      if (S.dragMode === 'widen') { const c = d.on0 ? (d.f0 + d.t0) / 2 : d.v0, hw = Math.max(0, (d.on0 ? (d.t0 - d.f0) / 2 : 0) + ds); f = c - hw; t = c + hw; }   // each end moves one unit per unit of drag
      else if (S.dragMode === 'to') t = Math.max(f, t + ds);
      else { f += ds; t += ds; }
      f = rnd(f, unit); t = rnd(t, unit);
      const box = swBox(F.sw), want = t - f > 1e-9;
      if (box.checked !== want) { box.checked = want; box.dispatchEvent(new Event('change', { bubbles: true })); }
      if (want) { setInput(F.f, f, 'input'); setInput(F.t, t, 'input'); updateSweepCount(); }
      renderDrawing(); if (typeof draw3D === 'function') draw3D();
    }
    refreshPop();
  }
}
// the joystick: pull the knob; the further it goes, the faster the value (up/down) or sweep range (left/right) changes
function joystick(key) {
  const joy = $('dpJoy'), knob = $('dpKnob'); let timer = null, off = [0, 0], start = null;
  const R = 22;
  const tick = () => {
    if (!adj || adj.key !== key) return;
    const F = dimFields(key), unit = S.dragUnit[kindOf(key)];
    const ax = Math.abs(off[1]) >= Math.abs(off[0]) ? 'v' : 'h', mag = Math.max(Math.abs(off[0]), Math.abs(off[1]));
    if (mag < 5) return;
    const n = mag > 18 ? 3 : mag > 11 ? 2 : 1, sgn = ax === 'v' ? Math.sign(-off[1]) : Math.sign(off[0]);
    const base = { v0: +F.inp.value, f0: F.f ? +F.f.value : 0, t0: F.t ? +F.t.value : 0, on0: !!(F.sw && swOn(F.sw)) };
    applyDelta(base, F, ax === 'v' ? sgn * n * unit : 0, ax === 'h' ? sgn * n * unit : 0, unit);
  };
  joy.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); joy.setPointerCapture(ev.pointerId); const r = joy.getBoundingClientRect(); start = [r.left + r.width / 2, r.top + r.height / 2]; timer = setInterval(tick, 140); });
  joy.addEventListener('pointermove', ev => {
    if (!start) return;
    let x = ev.clientX - start[0], y = ev.clientY - start[1]; const L = Math.hypot(x, y); if (L > R) { x *= R / L; y *= R / L; }
    // snap the knob to the bigger direction
    if (Math.abs(y) >= Math.abs(x)) x = 0; else y = 0;
    off = [x, y]; knob.style.transform = `translate(${x}px, ${y}px)`;
  });
  const stop = () => { start = null; off = [0, 0]; knob.style.transform = ''; clearInterval(timer); timer = null; save(); };
  joy.addEventListener('pointerup', stop); joy.addEventListener('pointercancel', stop);
}
// pan the side view with the pan button (right or middle by default)
(function () {
  let pd = null;
  $('drawWrap').addEventListener('contextmenu', ev => { if (!ev.target.closest('.dimpop')) ev.preventDefault(); });
  $('drawWrap').addEventListener('mousedown', ev => {
    if (ev.target.closest('.dimpop') || ev.target.closest('.navpad') || ev.target.closest('.infobox')) return;
    if (!bridgeLive() || navMode(ev, false) !== 'pan' || (ev.button === 0 && adj)) return;
    ev.preventDefault(); ev.stopPropagation(); pd = { x: ev.clientX, y: ev.clientY, px: v2.px, py: v2.py };
  }, true);
  window.addEventListener('mousemove', ev => { if (!pd) return; const r = $('draw').getBoundingClientRect(), b = renderDrawing.base, k = (b[2] / v2.zoom) / r.width; v2.px = pd.px + (ev.clientX - pd.x) * k; v2.py = pd.py + (ev.clientY - pd.y) * k; applyV2(); });
  window.addEventListener('mouseup', () => { pd = null; });
  $('drawWrap').tabIndex = -1;
  $('drawWrap').addEventListener('keydown', ev => { if (adj || !bridgeLive()) return; const m = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '=': 'in', '-': 'out', F6: 'home', Home: 'home' }[ev.key]; if (m) { ev.preventDefault(); nav2D(m); } });
})();
var padDraw = addNavPad($('drawWrap'), nav2D);
(function () {
  let down = null;
  $('drawWrap').addEventListener('mousedown', ev => { down = ev.button === 0 ? { x: ev.clientX, y: ev.clientY } : null; });
  $('drawWrap').addEventListener('click', ev => {
    if (!down || adj || !bridgeLive() || keys().click2d === 'none') return;
    const moved = Math.abs(ev.clientX - down.x) + Math.abs(ev.clientY - down.y) > 4; down = null;
    if (moved || ev.target.closest('.dimlab, .mem, .navpad, .infobtn, .infobox, .dimpop')) return;
    if (v2.zoom !== 1 || v2.px || v2.py) nav2D('home');
  });
})();
$('drawWrap').addEventListener('pointerup', ev => { if (adj && adj.drag) { adj.drag = null; try { $('drawWrap').releasePointerCapture(ev.pointerId); } catch (e) {} save(); } });
(function () {   // the same up/down and left/right drag on the 3D bridge, while a ✎ label is open
  const cv = $('c3d');
  cv.addEventListener('pointerdown', ev => {
    if (!adj || ev.button !== 0) return;
    const F = dimFields(adj.key);
    adj.drag = { x: ev.clientX, y: ev.clientY, v0: +F.inp.value, f0: F.f ? +F.f.value : 0, t0: F.t ? +F.t.value : 0, on0: F.on };
    cv.setPointerCapture(ev.pointerId); ev.preventDefault();
  });
  cv.addEventListener('pointermove', ev => {
    if (!adj || !adj.drag) return;
    const d = adj.drag, F = dimFields(adj.key), unit = S.dragUnit[kindOf(adj.key)];
    let dy = d.y - ev.clientY, dx = ev.clientX - d.x;
    if (!d.axis && Math.abs(dx) + Math.abs(dy) > 8) d.axis = Math.abs(dy) >= Math.abs(dx) ? 'v' : 'h';
    if (d.axis === 'v') dx = 0; else if (d.axis === 'h') dy = 0; else return;
    cancelAnimationFrame(dragRaf);
    dragRaf = requestAnimationFrame(() => applyDelta(d, F, Math.trunc(dy / PX_PER_UNIT) * unit, Math.trunc(dx / PX_PER_UNIT) * unit, unit));
  });
  cv.addEventListener('pointerup', ev => { if (adj && adj.drag) { adj.drag = null; try { cv.releasePointerCapture(ev.pointerId); } catch (e) {} save(); } });
})();
function bridgeLive() { return typeof fsEl !== 'undefined' && fsEl === '#sideSheet'; }   // the bridge view only moves in full screen
$('drawWrap').addEventListener('wheel', ev => {
  if (!adj) { if (!bridgeLive() || ev.target.closest('.navpad') || ev.target.closest('.infobox')) return; ev.preventDefault(); const svg = $('draw'), r = svg.getBoundingClientRect(), b = renderDrawing.base; if (!b) return;
    // zoom around the pointer
    const vb = svg.viewBox.baseVal, fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height, z0 = v2.zoom;
    v2.zoom = Math.max(0.5, Math.min(8, v2.zoom * (wheelDir(ev) > 0 ? 1.15 : 1 / 1.15)));
    const w1 = b[2] / v2.zoom, h1 = b[3] / v2.zoom, cx = vb.x + fx * vb.width, cy = vb.y + fy * vb.height;
    v2.px = b[0] + (b[2] - w1) / 2 - (cx - fx * w1); v2.py = b[1] + (b[3] - h1) / 2 - (cy - fy * h1); void z0; applyV2(); return; }
  const F = dimFields(adj.key); if (!F.s) return;
  ev.preventDefault();
  const K = DRAGK[kindOf(adj.key)], cur = Math.abs(+F.s.value) || K.steps[0];
  let i = K.steps.findIndex(s => s >= cur - 1e-9); if (i < 0) i = K.steps.length - 1;
  i = Math.max(0, Math.min(K.steps.length - 1, i + (ev.deltaY < 0 ? 1 : -1)));
  setInput(F.s, K.steps[i], 'input'); updateSweepCount(); renderDrawing(); refreshPop();
}, { passive: false });
$('infoBtn').addEventListener('click', ev => { ev.stopPropagation(); $('infoBox').hidden = !$('infoBox').hidden; });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { closeAdj(); $('infoBox').hidden = true; } });
document.addEventListener('click', ev => { if (adj && ev.isTrusted && ev.target.isConnected && !ev.target.closest('#drawWrap') && !ev.target.closest('#dimPop') && !ev.target.closest('#c3d') && !ev.target.closest('.d3labs') && !ev.target.closest('#dock')) closeAdj(); if (!ev.target.closest('.infobox') && !ev.target.closest('.infobtn')) $('infoBox').hidden = true; });
var v2 = { zoom: 1, px: 0, py: 0 };
// results written over the drawing (an HTML layer, so the drawing keeps its size); determinacy sits top left, clear of the view pad
// in full screen the View bar and the options bar float over the top of the bridge; the results sit just below them
function fsTopPad() {
  if (typeof fsEl === 'undefined' || fsEl !== '#sideSheet') return 0;
  const top = $('fsFill').getBoundingClientRect().top; let low = top;
  [$('dock'), $('fsBar')].forEach(el => { if (!el || el.hidden) return; const r = el.getBoundingClientRect(); if (r.height > 0) low = Math.max(low, r.bottom); });
  return Math.max(0, low - top + 4);
}
function paintResOverlay() {
  let ov = $('resOv'); if (!ov) { ov = document.createElement('div'); ov.id = 'resOv'; ov.className = 'resov'; $('drawWrap').appendChild(ov); }
  ov.hidden = !(S.resOnDraw && res && res.stable); if (ov.hidden) return;
  ov.style.setProperty('--ovtop', fsTopPad() + 'px');
  const need = (S.load.mBook1 + S.load.mBook2) * S.mat.FS, c = ok => ok ? 'var(--ok)' : 'var(--bad)';
  const box = (cls, big, small, col) => `<div class="${cls}"><b style="color:${col}">${big}</b><span>${small}</span></div>`;
  ov.innerHTML = box('tl', `${res.m + res.r} vs ${2 * res.j}`, `m + r vs 2j · ${res.det}`, 'var(--ink)')
    + box('tc', `${res.capKg.toFixed(1)} kg`, `capacity · needs ${need.toFixed(1)}`, c(res.capKg >= need - 1e-9))
    + box('bc', `D ${res.midDefl.toFixed(3)} mm`, `deflection · limit ${S.opts.deflLimit}`, c(res.deflOK))
    + box('bl', `${res.wood.toFixed(0)} mm`, 'wood used ΣL', 'var(--accent)');
}
function applyV2() {
  const b = renderDrawing.base; if (!b) return; const w = b[2] / v2.zoom, h = b[3] / v2.zoom;
  $('draw').setAttribute('viewBox', `${(b[0] + (b[2] - w) / 2 - v2.px).toFixed(2)} ${(b[1] + (b[3] - h) / 2 - v2.py).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
}
function nav2D(d) {
  const b = renderDrawing.base; if (!b) return; const w = b[2] / v2.zoom, h = b[3] / v2.zoom;
  if (d === 'home') { v2.zoom = 1; v2.px = 0; v2.py = 0; }
  else if (d === 'in') v2.zoom = Math.min(8, v2.zoom * 1.25); else if (d === 'out') v2.zoom = Math.max(0.5, v2.zoom / 1.25);
  else if (d === 'left') v2.px += 0.15 * w; else if (d === 'right') v2.px -= 0.15 * w; else if (d === 'up') v2.py += 0.15 * h; else if (d === 'down') v2.py -= 0.15 * h;
  applyV2();
}
function renderDrawing() {
  const svg = $('draw');
  const xs = tr.nodes.map(n => n[0]);
  const x0 = Math.min(-70, Math.min(...xs) - 22), x1 = Math.max(270, Math.max(...xs) + 22);
  const yTop = Math.max(128, +S.height + 46), yBot = -76;
  renderDrawing.base = [x0, 0, x1 - x0, yTop - yBot]; applyV2();
  const Y = y => yTop - y;
  const o = [];
  const MONO = 'IBM Plex Mono, monospace';
  const t = (x, y, s, size, anchor, fill) => `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size || 5}" fill="${fill || 'var(--muted)'}" text-anchor="${anchor || 'middle'}">${s}</text>`;
  o.push(`<rect x="-50" y="${Y(100)}" width="300" height="100" fill="var(--env)" stroke="var(--envline)" stroke-dasharray="3 2.5" stroke-width=".6"/>`);
  o.push(t(-50, Y(100) - 2.5, 'allowable envelope · 100 mm above deck · 300 mm max length', 4.2, 'start'));
  o.push(`<rect x="0" y="${Y(0)}" width="200" height="50" fill="none" stroke="var(--envline)" stroke-dasharray="3 2.5" stroke-width=".5"/>`);
  o.push(t(100, Y(-50) + 5.5, '50 mm max below deck', 4.2));
  const Tt = Math.max(0, +S.tableThick || 0), tH = Math.min(Tt, 76);
  o.push(`<rect x="${x0}" y="${Y(0)}" width="${-x0}" height="76" fill="var(--desk)" fill-opacity=".35"/>`);
  o.push(`<rect x="200" y="${Y(0)}" width="${x1 - 200}" height="76" fill="var(--desk)" fill-opacity=".35"/>`);
  o.push(`<rect x="${x0}" y="${Y(0)}" width="${-x0}" height="${tH}" fill="var(--desk)"/>`);
  o.push(`<rect x="200" y="${Y(0)}" width="${x1 - 200}" height="${tH}" fill="var(--desk)"/>`);
  if (Tt > 0) { o.push(t(x0 + 6, Y(-Tt) + 6, `table top ${Tt.toFixed(0)} mm`, 3.8, 'start')); o.push(t(x1 - 6, Y(-Tt) + 6, `table top ${Tt.toFixed(0)} mm`, 3.8, 'end')); }
  o.push(t(x0 + 6, Y(-22), 'DESK', 5, 'start')); o.push(t(x1 - 6, Y(-22), 'DESK', 5, 'end'));
  o.push(`<g stroke="var(--muted)" stroke-width=".4"><line x1="0" y1="${Y(-64)}" x2="200" y2="${Y(-64)}"/><line x1="0" y1="${Y(-61)}" x2="0" y2="${Y(-67)}"/><line x1="200" y1="${Y(-61)}" x2="200" y2="${Y(-67)}"/></g>`);
  o.push(t(100, Y(-64) + 6, 'clear span 200 mm', 4.4));
  const hx = Math.min(...xs) - 12;

  const ok = res.stable;
  if (ok) res.members.forEach(m => {
    if (!m.fails) return;
    const a = tr.nodes[m.i], b = tr.nodes[m.j];
    o.push(`<line x1="${a[0]}" y1="${Y(a[1])}" x2="${b[0]}" y2="${Y(b[1])}" stroke="var(--bad)" stroke-opacity=".28" stroke-width="9" stroke-linecap="round"/>`);
  });
  tr.elems.forEach((e, k) => {
    const a = tr.nodes[e.i], b = tr.nodes[e.j];
    let col = 'var(--ink)';
    const m = ok ? res.members[k] : null;
    if (m) col = m.F < 0 ? 'var(--comp)' : m.F > 0 ? 'var(--tens)' : 'var(--zero)';
    const tip = m ? `Member ${k} (${X.TYPE_LABEL[e.type]}): ${m.F.toFixed(2)} N ${m.TC}, L ${m.L.toFixed(1)} mm, Pcr ${m.Pcr.toFixed(1)} N, use ${(m.util * 100).toFixed(0)}%` : `Member ${k}`;
    o.push(`<line data-k="${k}" class="mem" x1="${a[0]}" y1="${Y(a[1])}" x2="${b[0]}" y2="${Y(b[1])}" stroke="${col}" stroke-width="${hlElem === k ? 5.5 : memW(e)}" stroke-linecap="round" style="cursor:pointer"><title>${tip}${e.n > 1 ? ` · ${e.n} sticks` : ''}</title></line>`);
  });
  if (ok && S.showDef) {
    const sc = S.defScale;
    const g = tr.elems.map(e => {
      const a = tr.nodes[e.i], b = tr.nodes[e.j];
      return `<line x1="${a[0] + sc * res.U[2 * e.i]}" y1="${Y(a[1] + sc * res.U[2 * e.i + 1])}" x2="${b[0] + sc * res.U[2 * e.j]}" y2="${Y(b[1] + sc * res.U[2 * e.j + 1])}"/>`;
    }).join('');
    o.push(`<g stroke="var(--muted)" stroke-width=".7" stroke-dasharray="2.2 1.6" fill="none" pointer-events="none">${g}</g>`);
  }
  // books + load arrows
  const [b0, b1] = tr.bookSpan;
  const deckY = S.height;
  o.push(`<rect x="${b0}" y="${Y(deckY + 32)}" width="${b1 - b0}" height="8" fill="var(--book)" stroke="var(--tens)" stroke-width=".5"/>`);
  o.push(t((b0 + b1) / 2, Y(deckY + 32) + 5.6, `books · ${(b1 - b0).toFixed(0)} mm · ${res.Ptruss.toFixed(2)} N on this truss`, 4.2, 'middle', 'var(--ink)'));
  const maxF = Math.max(...res.Fval.map(f => -f[2]), 1e-9);
  res.Fval.forEach(([n, , v]) => {
    const [x, y] = tr.nodes[n];
    const len = 4 + 18 * (-v / maxF);
    o.push(`<g stroke="var(--accent)" fill="var(--accent)" stroke-width=".8"><line x1="${x}" y1="${Y(y + 3 + len)}" x2="${x}" y2="${Y(y + 5)}"/><path d="M${x - 1.8} ${Y(y + 6.4)} L${x + 1.8} ${Y(y + 6.4)} L${x} ${Y(y + 3)} Z"/></g>`);
  });
  // supports
  const act = res.activeSupports || [];
  act.forEach(s => {
    const [x, y] = tr.nodes[s.node];
    const sgn = x < 100 ? -1 : 1;   // the table is on this side
    if (s.claw) {
      o.push(`<path d="M${x} ${Y(y) + 1} h${sgn * 9} v-2.4" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/>`);
      o.push(t(x + sgn * 11, Y(y) + 9, `claw ${(-s.Ry).toFixed(1)} N`, 3.6, sgn < 0 ? 'end' : 'start', 'var(--accent)'));
      return;
    }
    if (s.corner) o.push(`<path d="M${x} ${Y(y) - 1} l${sgn * 4.5} -2.2 v4.4 Z" fill="var(--warn)"/>`, t(x - sgn * 6, Y(y) - 4, `${Math.abs(s.Rx).toFixed(1)} N`, 3.6, sgn < 0 ? 'start' : 'end', 'var(--warn)'));
    if (s.brace || s.abut) {
      o.push(`<path d="M${x} ${Y(y)} l${sgn * 5} -2.6 v5.2 Z" fill="var(--ink)"/>`);
      o.push(t(x - sgn * 6, Y(y) + 2, `${Math.abs(s.Rx).toFixed(1)} N`, 3.6, sgn < 0 ? 'start' : 'end', 'var(--ink)'));
      return;
    }
    if (s.pin) o.push(`<path d="M${x} ${Y(0)} l-4 6 h8 Z" fill="var(--ink)"/>`);
    else o.push(`<circle cx="${x}" cy="${Y(0) + 3.2}" r="3" fill="var(--ink)"/>`);
  });
  (res.lifted || []).forEach(s => {
    const [x] = tr.nodes[s.node];
    o.push(`<circle cx="${x}" cy="${Y(0) + 3.2}" r="3" fill="none" stroke="var(--warn)" stroke-width=".8" stroke-dasharray="1.4 1"/>`);
    o.push(t(x, Y(0) + 13, 'lifts off', 3.8, 'middle', 'var(--warn)'));
  });
  tr.nodes.forEach((n, i) => {
    const loose = !ok && res.loose && res.loose.includes(i);
    o.push(`<circle cx="${n[0]}" cy="${Y(n[1])}" r="${loose ? 3.2 : 1.9}" fill="${loose ? 'var(--bad)' : 'var(--sheet)'}" stroke="var(--ink)" stroke-width=".7"/>`);
    if (S.showIds) {
      const up = n[1] >= Math.max(+S.height, 0) - 0.01;
      o.push(`<text x="${n[0] + (up ? 0 : 3.5)}" y="${Y(n[1]) + (up ? -4 : 9.5)}" font-family="${MONO}" font-size="4.6" font-weight="500" fill="${loose ? 'var(--bad)' : 'var(--accent)'}" text-anchor="${up ? 'middle' : 'start'}">${i}</text>`);
    }
  });
  if (S.showElems) tr.elems.forEach((e, k) => {
    const a = tr.nodes[e.i], b = tr.nodes[e.j];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    o.push(`<g pointer-events="none"><rect x="${mx - 3.6}" y="${Y(my) - 3}" width="7.2" height="5.6" rx="1" fill="var(--sheet)" stroke="var(--line)" stroke-width=".3"/><text x="${mx}" y="${Y(my) + 1.5}" font-family="${MONO}" font-size="3.8" fill="var(--ink)" text-anchor="middle">${k}</text></g>`);
  });
  if (S.showForces && res.stable) tr.elems.forEach((e, k) => {
    const m = res.members[k]; if (!m) return; const a = tr.nodes[e.i], b = tr.nodes[e.j];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + (S.showElems ? -6 : 0), F = m.F;
    const txt = Math.abs(F) < 0.005 ? '0' : `${Math.abs(F).toFixed(1)} ${F < 0 ? 'C' : 'T'}`, wd = txt.length * 2.5 + 2.4;
    const col = m.fails ? 'var(--bad)' : F < 0 ? 'var(--comp)' : F > 0 ? 'var(--tens)' : 'var(--zero)';
    o.push(`<g pointer-events="none"><rect x="${mx - wd / 2}" y="${Y(my) - 3.3}" width="${wd}" height="5.6" rx="1" fill="var(--sheet)" fill-opacity=".9" stroke="${col}" stroke-width=".3"/><text x="${mx}" y="${Y(my) + 1.2}" font-family="${MONO}" font-size="3.9" font-weight="600" fill="${col}" text-anchor="middle">${txt}</text></g>`);
  });
  // swept ranges as dashed outlines, then the clickable dimension labels
  if (S.showGhosts !== false) o.push(sweepGhosts(Y));
  paintResOverlay();
  if (S.showDims !== false) o.push(dimLabels(Y, x0, x1));
  svg.innerHTML = o.join('');
  svg.querySelectorAll('.dimlab').forEach(g => { if (adj && g.dataset.var === adj.key) g.classList.add('act'); g.addEventListener('click', ev => { ev.stopPropagation(); openDimPop(g.dataset.var); }); });
  svg.querySelectorAll('.mem').forEach(l => {
    l.addEventListener('mouseenter', () => highlight(+l.dataset.k));
    l.addEventListener('mouseleave', () => highlight(-1));
    l.addEventListener('click', () => {
      $('s-members').open = true;
      const row = document.querySelector(`#tbl tbody tr[data-k="${l.dataset.k}"]`);
      if (row) { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); highlight(+l.dataset.k); }
    });
  });
}
function memW(e) { return S.mat.b * (e.n === 4 && e.bundle === 'compact' ? 2 : e.n); }
function highlight(k) {
  if (hlElem === k) return;
  hlElem = k;
  document.querySelectorAll('#tbl tbody tr').forEach(r => r.classList.toggle('hl', +r.dataset.k === k));
  document.querySelectorAll('#draw .mem').forEach(l => l.setAttribute('stroke-width', +l.dataset.k === k ? 5.5 : memW(tr.elems[+l.dataset.k])));
}

// ---------- wood helpers
function lengths() { return tr.elems.map(e => { const a = tr.nodes[e.i], b = tr.nodes[e.j]; return Math.hypot(b[0] - a[0], b[1] - a[1]); }); }
function woodBreakdown() {
  const L = lengths(), by = {};
  tr.elems.forEach((e, k) => { const t = X.TYPE_LABEL[e.type]; by[t] = (by[t] || 0) + L[k] * e.n; });
  const tot = tr.elems.reduce((s, e, k) => s + L[k] * e.n, 0);
  return Object.entries(by).map(([t, v]) => `${t} ${v.toFixed(0)}`).join(' + ') + ` = <b>${tot.toFixed(0)} mm</b>`;
}
function woodTotalText() {
  const L0 = lengths(), one = tr.elems.reduce((s, e, k) => s + L0[k] * e.n, 0), ties = tr.deckNodes.length * S.opts.width;
  const A = S.mat.b * S.mat.h, g = len => (len * A * S.mat.rho * 1000).toFixed(2);
  return `${one.toFixed(0)} × ${S.load.nTruss} trusses = ${(one * S.load.nTruss).toFixed(0)} mm (M = ρ·A·ΣL = ${g(one * S.load.nTruss)} g)` +
    ` · with ${tr.deckNodes.length} cross-ties × ${S.opts.width} mm: ${(one * S.load.nTruss + ties).toFixed(0)} mm (${g(one * S.load.nTruss + ties)} g)`;
}

// ---------- stats
// the four project measurements, at the top of the page, so everyone reads the same numbers
function renderKey() {
  const bk = S.load.mBook1 + S.load.mBook2, need = bk * S.mat.FS;
  const ok = (c, txt) => `<b class="${c ? 'ok' : 'bad'}">${txt}</b>`;
  const s = res.stable;
  $('keyStrip').innerHTML = `<b>What Project I measures:</b> wood used ΣL (less is better) · capacity in kg of books (must reach books × FS = ${need.toFixed(1)} kg) · mid-span deflection (≤ ${S.opts.deflLimit} mm) · fits the 300 × 100 mm envelope with ≥ ${S.opts.minOverlap} mm on each desk.
    <div class="kv"><span>This design: wood <b>${s ? res.wood.toFixed(0) + ' mm' : '—'}</b></span>
    <span>capacity ${s ? ok(res.capKg >= need - 1e-9, res.capKg.toFixed(1) + ' kg') : ok(false, 'unstable')}</span>
    <span>deflection ${s ? ok(res.deflOK, res.midDefl.toFixed(3) + ' mm') : '—'}</span>
    <span>envelope and desks ${s ? ok(res.envelope.length === 0 && res.edgeOK, res.envelope.length === 0 && res.edgeOK ? 'OK' : 'fails') : '—'}</span>
    <span>overall ${s ? ok(res.passes, res.passes ? 'PASSES' : 'FAILS') : ok(false, 'UNSTABLE')}</span></div>`;
}
function renderStats() {
  renderKey();
  const st = $('stats'), msgs = $('msgs'), pill = $('statusPill');
  const li = [];
  tr.warn.forEach(w => li.push(['warn', w]));
  if (tr.info.bookContact === 'rigid') li.push(['info', `The top chord is curved, so the rigid book rests only on the highest joint${tr.info.touch.length > 1 ? 's' : ''} (${tr.info.touch.join(', ')}). All of its weight goes in there. An arch also pushes outward at its feet: on a table that only pushes up, a tie (the bottom chord) or the edge braces has to take that push.`]);
  if (tr.info.clawNote) li.push(['warn', tr.info.clawNote]);
  if (tr.info.braceNote) li.push(['warn', tr.info.braceNote]);
  if (res.stable) {
    const cl = res.activeSupports.filter(s => s.claw);
    if (cl.length) li.push(['info', cl.every(s => Math.abs(s.Ry) < 1e-6 * res.Ptruss)
      ? 'Claw force 0 N: nothing is trying to lift the ends, so the claws carry no load. A claw only works when the load could lift an end, for example a load out beyond a support.'
      : `The claws pull the ends down with ${cl.map(s => (-s.Ry).toFixed(2)).join(' / ')} N.`]);
    (res.released || []).forEach(r => li.push(['info', r.kind === 'claw' ? `The claw at x = ${r.x.toFixed(0)} mm would have to push up on the table, so it just hangs there.`
      : r.kind === 'slip' ? `The foot on the edge face at x = ${r.x.toFixed(0)} mm needs more friction than it has, so it slides down. While it slides, friction still holds μ × the face push (sliding friction); its foot post hangs the rest on the table corner.`
      : `The brace at x = ${r.x.toFixed(0)} mm would have to pull on the table edge, so it lets go sideways.`]));
    const br = res.activeSupports.filter(s => s.brace || s.abut);
    const cor = res.activeSupports.filter(s => s.corner);
    if (cor.length) li.push(['info', `The table edges push the ends inward with ${cor.map(s => Math.abs(s.Rx).toFixed(2)).join(' / ')} N, so the arch can't spread. Without that push the bottom chord would have to hold the ends together in tension.`]);
    if (br.length) li.push(['info', `${br.some(s => s.brace) ? 'Edge braces' : 'Feet against the edge faces'}: the table edges push in with ${br.map(s => Math.abs(s.Rx).toFixed(2)).join(' / ')} N, and friction holds ${br.map(s => s.Ry.toFixed(2)).join(' / ')} N vertically (μ ${res.mu}; friction holds rigidly until it slips, then keeps pushing back with μ × the face force while it slides). Like an arch, that sideways push lets the edges carry part of the load.`]);
    (res.slips || []).forEach(s => li.push(['bad', s.top
      ? `Joint ${s.node} sits on the table top and has to hold ${s.need.toFixed(2)} N sideways, but friction there is only μ × the downward push = ${s.have.toFixed(2)} N, so it would slide. Add a tie (bottom chord) between the feet, or let the ends bear on the table edge.`
      : `Joint ${s.node}, against the table edge, would slip: it needs ${s.need.toFixed(2)} N of friction, but μ × the face force is only ${s.have.toFixed(2)} N.`]));
  }
  if (res.lifted && res.lifted.some(s => s.pin)) li.push(['info', 'The pin would have to pull the bridge down, so it keeps only its sideways hold; the table pushes up elsewhere.']);
  if (res.lifted && res.lifted.some(s => !s.pin)) {
    const xs = res.lifted.filter(s => !s.pin).map(s => tr.nodes[s.node][0].toFixed(0)).join(' and ');
    li.push(['info', `The bridge lifts off the table at x = ${xs} mm: ${res.lifted.filter(s => !s.pin).length > 1 ? 'those rollers' : 'that roller'} would have to pull down, so ${res.lifted.filter(s => !s.pin).length > 1 ? 'they were' : 'it was'} removed and the model solved again. ${res.activeSupports.length} supports touch the table.`]);
  }
  if (!res.stable) {
    pill.innerHTML = '<span class="pill bad">Unstable</span>' + (S.anaMode === '3d' ? '<span class="mode3d">3D</span>' : '');
    if (res.unstable3D) {
      li.unshift(['bad', '<button type="button" class="btn acc sm" data-findstable="1">Find the closest stable bridge</button> Stable as a flat 2D truss, but unstable in 3D: with pin joints the two trusses can sway or rack sideways. In the 3D section, brace the top and bottom planes (xy) and add cross-frames (zy), at least at the ends. Or switch the analysis back to 2D.']);
      st.innerHTML = '<div class="stat"><span class="k">3D analysis</span><span class="v">—</span><span class="s">needs bracing</span></div>';
      msgs.innerHTML = li.map(([c, s]) => `<li class="${c}">${s}</li>`).join(''); return;
    }
    st.innerHTML = `<div class="stat"><span class="k">Wood used ΣL</span><span class="v">${(lengths().reduce((s, v) => s + v, 0) * S.load.nTruss).toFixed(0)} mm</span><span class="s">both side trusses</span></div>
      <div class="stat"><span class="k">D<sub>max</sub></span><span class="v">—</span></div><div class="stat"><span class="k">Capacity</span><span class="v">—</span></div>
      <div class="stat"><span class="k">Determinacy</span><span class="v">${res.m + res.r} vs ${2 * res.j}</span><span class="s">m + r vs 2j · ${res.det}</span></div>`;
    const names = (res.loose || []).map(n => `${n} (${tr.keys[n]})`).join(', ');
    li.unshift(['bad', '<button type="button" class="btn acc sm" data-findstable="1">Find the closest stable bridge</button> This truss is a mechanism: the stiffness matrix cannot be solved. ' + (names ? `Joint${res.loose.length > 1 ? 's' : ''} ${names} ${res.loose.length > 1 ? 'are' : 'is'} only held by members in one straight line, so nothing stops ${res.loose.length > 1 ? 'them' : 'it'} moving sideways. Add a vertical or a diagonal there.` : 'No single joint is loose, so a whole block of the truss can swing. Usually that is two parts joined at just one joint (for example where an arch touches the top chord, which makes a hinge) or a four-sided panel with no diagonal.')]);
    msgs.innerHTML = li.map(([c, s]) => `<li class="${c}">${s}</li>`).join('');
    return;
  }
  const f = res.failing;
  pill.innerHTML = (res.passes ? '<span class="pill ok">Passes all checks</span>' : `<span class="pill bad">Fails ${f.length ? f.length + ' member' + (f.length > 1 ? 's' : '') : 'a check'}</span>`) + (res.mode3 ? '<span class="mode3d" title="3D analysis">3D</span>' : '');
  if (res.mode3) {
    const M = res.mode3;
    li.unshift(['info', `<b>3D analysis.</b> Both trusses, the ties, ${M.bracingWood > 0 ? 'and the bracing and cross-frames' : 'and the cross-frames'} are solved together. Wood ${res.wood.toFixed(0)} mm includes ${M.bracingWood.toFixed(0)} mm of ties and bracing (2D count was ${M.wood2.toFixed(0)} mm). Each member shows the worse of its front and back copies. Deflection is the largest deck movement; the deck sways ${M.sway.toFixed(3)} mm sideways.`]);
    if (M.failBr.length) li.push(['bad', `Bracing fails: ${M.failBr.map(x => `${({ tie: 'tie', lat: 'lateral brace', sway: 'cross-frame brace' })[x.type] || x.type} ${Math.abs(x.F).toFixed(1)} N (${x.mode})`).join(', ')}. See the 3D section.`]);
  }
  const worst = res.members.reduce((a, b) => (b.util > a.util ? b : a), res.members[0]);
  const uCol = res.maxUtil >= 1 ? 'var(--bad)' : res.maxUtil >= .8 ? 'var(--warn)' : 'var(--ok)';
  const tiesLen = res.nTies * S.opts.width;
  st.innerHTML = `
    <div class="stat"><span class="k">Wood used ΣL</span><span class="v">${res.wood.toFixed(0)} mm</span><span class="s">${res.mode3 ? `3D: both trusses + ${res.mode3.bracingWood.toFixed(0)} mm ties and bracing` : `${res.totalLen.toFixed(0)} mm per truss × ${S.load.nTruss}${S.opts.crossTies ? ` + ${tiesLen.toFixed(0)} mm ties` : ''}`} · M = ${res.massTruss.toFixed(2)} g${S.opts.crossTies ? ` (${res.massTotal.toFixed(2)} g with ties)` : ''}</span></div>
    <div class="stat"><span class="k">D<sub>max</sub> mid-span</span><span class="v" style="color:${res.deflOK ? 'inherit' : 'var(--bad)'}">${res.midDefl.toFixed(3)} mm</span><span class="s">joint ${res.midNode} · limit ${(+S.opts.deflLimit).toFixed(1)} mm</span></div>
    <div class="stat"><span class="k">Capacity</span><span class="v" style="color:${uCol}">${isFinite(res.capKg) ? res.capKg.toFixed(1) + ' kg' : '—'}</span><span class="s">${isFinite(res.capFactor) ? res.capFactor.toFixed(1) + '× the books' : ''} · most-used member ${worst.k} at ${(res.maxUtil * 100).toFixed(0)}% (${worst.mode || 'no load'})</span></div>
    <div class="stat"><span class="k">Determinacy</span><span class="v">${res.m + res.r} vs ${2 * res.j}</span><span class="s">m + r vs 2j · ${res.det} · ${res.activeSupports.length} supports</span></div>`;
  if (f.length) {
    const by = {}; f.forEach(m => { (by[m.mode] = by[m.mode] || []).push(m.k); });
    Object.entries(by).forEach(([mode, ks]) => li.push(['bad', `${mode === 'buckling' ? 'Buckles' : mode === 'crushing' ? 'Crushes' : 'Breaks in tension'}: member${ks.length > 1 ? 's' : ''} ${ks.join(', ')}.`]));
  }
  if (!res.edgeOK) li.push(['bad', `Each end reaches only ${res.overlap.toFixed(0)} mm onto the desks; the edge check needs at least ${(+S.opts.minOverlap).toFixed(0)} mm, or a slightly off-centre bridge could slip into the gap. Add desk panels or lengthen the bridge.`]);
  if (!res.deflOK) li.push(['bad', `Mid-span deflection ${res.midDefl.toFixed(3)} mm is over the ${S.opts.deflLimit} mm limit.`]);
  res.envelope.forEach(e => li.push(['bad', e]));
  if (Math.abs(res.dmax - res.midDefl) > 1e-4 && res.dnode !== res.midNode) li.push(['info', `Largest vertical movement anywhere is ${res.dmax.toFixed(3)} mm at joint ${res.dnode}.`]);
  msgs.innerHTML = li.map(([c, s]) => `<li class="${c}">${s}</li>`).join('');
}

// ---------- table
function rowsForCsv() {
  const head = ['Elem', 'i', 'j', 'Type', 'Sticks', 'L (mm)', 'F (N)', 'T/C', 'P_cr (N)', 'Buckling?(Y/N)', 'Capacity (N)', 'Use (%)', 'Governs'];
  if (!res.stable) return [head];
  return [head].concat(res.members.map(m => [m.k, m.i, m.j, X.TYPE_LABEL[m.type], m.n + (m.n === 4 && m.bundle === 'compact' ? ' (2x2)' : ''), m.L.toFixed(1), m.F.toFixed(2), m.TC, m.Pcr.toFixed(1), m.buckles,
    (m.F > 0 ? m.capT : m.F < 0 ? m.capC : 0).toFixed(1), (m.util * 100).toFixed(0), m.mode]));
}
function renderTable() {
  const tb = $('tbl'), facts = $('facts');
  const angs = {};
  tr.elems.forEach(e => { if (e.type !== 'diag') return; const a = tr.nodes[e.i], b = tr.nodes[e.j]; angs[(Math.atan2(Math.abs(b[1] - a[1]), Math.abs(b[0] - a[0])) * 180 / Math.PI).toFixed(1)] = 1; });
  const sup = res.stable ? res.activeSupports.map(s => `${s.claw ? 'claw' : s.brace ? 'edge brace' : s.pin ? 'pin' : 'roller'} x=${tr.nodes[s.node][0].toFixed(0)}: ${s.Ry.toFixed(2)} N`).join(' · ') : '';
  const sumR = res.stable ? res.activeSupports.reduce((a, s) => a + s.Ry, 0) : 0;
  facts.innerHTML = `<dt>Design load on one truss</dt><dd>${res.Ptruss.toFixed(2)} N (W = ${res.W.toFixed(2)} N × FS ${S.mat.FS} ÷ ${S.load.nTruss})</dd>
    <dt>Book footprint</dt><dd>${(+S.bookLen).toFixed(0)} mm, x = ${tr.bookSpan[0].toFixed(0)} to ${tr.bookSpan[1].toFixed(0)} mm, over ${res.Fval.length} deck joints</dd>
    <dt>Diagonal angles</dt><dd>${Object.keys(angs).map(a => a + '°').join(', ') || 'no diagonals'}</dd>
    <dt>Side (end-post) angle</dt><dd>${tr.info.sideAngleActual.toFixed(1)}°</dd>
    <dt>Bottom chord</dt><dd>${tr.info.curve ? `${{ arc: 'circular arc', catenary: 'catenary', parabola: 'parabola' }[tr.info.shape]}, ${Math.abs(tr.info.curve).toFixed(0)} mm ${tr.info.curve < 0 ? 'below the deck (sag)' : 'above the desk (arch)'} at mid-span` : 'flat, at desk level'}</dd>
    <dt>Overlap on each desk</dt><dd>${tr.overlap.toFixed(0)} mm (edge check needs ≥ ${(+S.opts.minOverlap).toFixed(0)} mm${S.opts.minOverlap > 0 ? ` · ${(tr.overlap / S.opts.minOverlap).toFixed(2)}× the minimum` : ''})</dd>
    <dt>Panels</dt><dd>${tr.widths.length} total, ${tr.deskPanels} on each desk · overall ${tr.overall.toFixed(0)} mm</dd>
    ${sup ? `<dt>Reactions (hand-check)</dt><dd>${sup} · sum ${sumR.toFixed(2)} N</dd>` : ''}
    <dt>Wood used, one truss</dt><dd>${woodBreakdown()}</dd>
    <dt>Wood used, whole bridge</dt><dd>${woodTotalText()}</dd>`;
  if (!res.stable) { tb.innerHTML = '<tbody><tr><td class="l">No results: the truss is unstable.</td></tr></tbody>'; return; }
  let h = '<thead><tr><th>Elem</th><th>i</th><th>j</th><th class="l">Type</th><th class="l">Sticks</th><th>L (mm)</th><th>F (N)</th><th>T/C</th><th>P<sub>cr</sub> (N)</th><th>Buckling?</th><th>Capacity (N)</th><th class="l">Use</th></tr></thead><tbody>';
  res.members.forEach(m => {
    const cap = m.F > 0 ? m.capT : m.capC;
    const u = Math.min(1, m.util), col = m.util >= 1 ? 'var(--bad)' : m.util >= .8 ? 'var(--warn)' : (m.F < 0 ? 'var(--comp)' : 'var(--tens)');
    h += `<tr data-k="${m.k}" class="${m.fails ? 'fail' : ''}${hlElem === m.k ? ' hl' : ''}"><td>${m.k}</td><td>${m.i}</td><td>${m.j}</td><td class="l">${X.TYPE_LABEL[m.type]}</td><td class="l"><span class="stk"><button type="button" data-st="${m.k}" data-d="-1" aria-label="Fewer sticks in member ${m.k}">−</button><b>${m.n}</b><button type="button" data-st="${m.k}" data-d="1" aria-label="More sticks in member ${m.k}">+</button>${m.n === 4 ? `<button type="button" class="bund" data-bd="${m.k}" title="How the 4 sticks are glued">${m.bundle === 'compact' ? '2×2' : 'row'}</button>` : ''}<button type="button" class="bund" data-fc="${m.k}" aria-pressed="${isFocus(m.k)}" title="Focus: sweep this member's sticks (and its mirror image)">${isFocus(m.k) ? '● focus' : '◎'}</button></span></td><td>${m.L.toFixed(1)}</td><td>${m.F.toFixed(2)}</td><td class="tc-${m.TC}">${m.TC}</td><td>${m.Pcr.toFixed(1)}</td><td>${m.buckles}</td><td>${m.F ? cap.toFixed(1) : '—'}</td><td class="l"><span class="bar"><span style="width:${(u * 100).toFixed(0)}%;background:${col}"></span></span>${(m.util * 100).toFixed(0)}%${m.mode && m.F ? ' ' + m.mode : ''}</td></tr>`;
  });
  tb.innerHTML = h + '</tbody>';
  tb.querySelectorAll('tbody tr').forEach(r => { r.addEventListener('mouseenter', () => highlight(+r.dataset.k)); r.addEventListener('mouseleave', () => highlight(-1)); });
  tb.querySelectorAll('button[data-st]').forEach(b => b.addEventListener('click', () => setSticks(+b.dataset.st, d => ({ n: Math.max(1, Math.min(4, d.n + +b.dataset.d)) }))));
  tb.querySelectorAll('button[data-bd]').forEach(b => b.addEventListener('click', () => setSticks(+b.dataset.bd, d => ({ bundle: d.bundle === 'compact' ? 'row' : 'compact' }))));
  tb.querySelectorAll('button[data-fc]').forEach(b => b.addEventListener('click', () => toggleFocus(+b.dataset.fc)));
}
function isFocus(k) { const e = tr.elems[k]; return !!e && S.focus.some(f => f.key === e.key || f.mkey === e.key); }
function toggleFocus(k) {
  const e = tr.elems[k]; if (!e) return;
  const i = S.focus.findIndex(f => f.key === e.key || f.mkey === e.key);
  if (i >= 0) S.focus.splice(i, 1);
  else { const m = tr.elems[e.mirror]; S.focus.push({ key: e.key, mkey: m && m !== e ? m.key : null, label: `${X.TYPE_LABEL[e.type]} ${k}${m && m !== e ? ' + ' + e.mirror : ''}` }); }
  update();
}
function renderFocus() {
  const el = $('focusChips'); if (!el) return;
  el.innerHTML = S.focus.length ? S.focus.map((f, i) => `<span class="chip on" style="display:inline-flex;gap:6px;align-items:center;padding:3px 8px">${f.label}<button type="button" class="btn ghost sm" data-unf="${i}" aria-label="Remove ${f.label} from focus" style="padding:0 6px">×</button></span>`).join('')
    : '<span class="note">None yet. Mark members with ◎ in the member table.</span>';
  el.querySelectorAll('[data-unf]').forEach(b => b.addEventListener('click', () => { S.focus.splice(+b.dataset.unf, 1); update(); }));
}
function setSticks(k, fn) {
  const e = tr.elems[k]; if (!e) return;
  const cur = { n: e.n, bundle: e.bundle };
  const nv = Object.assign({}, cur, fn(cur));
  S.sticks = Object.assign({}, S.sticks);
  [e, tr.elems[e.mirror]].forEach(m => { if (!m) return; if (nv.n === 1) delete S.sticks[m.key]; else S.sticks[m.key] = { n: nv.n, bundle: nv.bundle }; });
  update();
}
$('resetSticks').addEventListener('click', () => { S.sticks = {}; update(); });
function csvOf(rows) { return rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n'); }
function csvText() { return csvOf(rowsForCsv()); }

// ---------- export
function fileBase() { return (S.name || 'design').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'design'; }
function pyText() { return X.exportPy(PROF_TEMPLATE, S.name || 'Design', design(), tr, res, Object.assign({}, C.DEFAULT_MAT, S.mat), S.load, S.opts); }
function renderExport() { $('pyOut').value = pyText(); $('dlPy').disabled = !res.stable; }
function toast(msg, err) { const t = $('toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => { t.textContent = ''; }, 4000); }
async function copy(text, okMsg, fallbackEl) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e) { if (fallbackEl) { const d = fallbackEl.closest('details'); if (d) d.open = true; fallbackEl.focus(); fallbackEl.select(); toast('Copy was blocked here. The text is selected; press Ctrl+C or Cmd+C.', true); } else toast('Copy was blocked in this view.', true); }
}
$('copyPy').addEventListener('click', () => copy(pyText(), 'Copied the .py text.', $('pyOut')));
$('copyCsv').addEventListener('click', () => copy(csvText(), 'Copied the table as CSV.'));

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  files.forEach(f => {
    const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  });
  const cSize = central.reduce((s, p) => s + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cSize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)]);
}
let downloadsP = null;
function getDownloads() { if (!downloadsP) downloadsP = (window.claude && window.claude.use) ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null); return downloadsP; }
// every export asks for its file name first (Enter saves, Esc cancels); the name can also become the design's name
function askFileName(filename) {
  return new Promise(resolve => {
    const m = filename.match(/^(.*?)((\.bridge|\.sweep)?\.[A-Za-z0-9]+)$/) || [filename, filename, ''];
    const base = m[1], ext = m[2] || '';
    const md = $('saveModal'); md.hidden = false;
    $('saveExt').textContent = ext; $('saveName').value = base; $('saveAsDesign').checked = ext === '.bridge.json';
    setTimeout(() => { $('saveName').focus(); $('saveName').select(); }, 30);
    const done = ok => { md.hidden = true; $('saveGo').onclick = $('saveNo').onclick = null; $('saveName').onkeydown = null;
      if (!ok) { resolve(null); return; }
      const nm = ($('saveName').value || base).trim().replace(/[\\/:*?"<>|]+/g, '_') || base;
      if ($('saveAsDesign').checked && nm !== S.name) { S.name = nm; $('name').value = nm; sizeName(); update(); }
      resolve(nm + ext); };
    $('saveGo').onclick = () => done(true); $('saveNo').onclick = () => done(false);
    $('saveName').onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); done(true); } else if (ev.key === 'Escape') { ev.preventDefault(); done(false); } };
  });
}
async function saveFile(filename, data) {
  const nm = await askFileName(filename); if (!nm) { toast('Not saved.'); return; }
  filename = nm;
  const dl = await getDownloads();
  if (!dl) { toast('Downloads are not available in this view. Use the copy button instead.', true); return; }
  try { await dl.save({ filename, data }); toast('Saved ' + filename + '.'); }
  catch (e) { if (e && e.code === 'declined') toast('Download cancelled.', true); else if (e && e.code === 'rate_limited') toast('A save prompt is already open.', true); else toast('This view could not save the file. Use the copy button instead.', true); }
}
$('dlPy').addEventListener('click', () => { const b = fileBase(); saveFile(b + '_TrussFEA.zip', zip([{ name: b + '_TrussFEA_Bridge_SE310.py', text: pyText() }])); });
$('dlCsv').addEventListener('click', () => saveFile(fileBase() + '_members.csv', csvText()));

// ---------- LP data
function lpFiles() {
  const nN = tr.nodes.length;
  const F = new Array(2 * nN).fill(0); res.Fval.forEach(([n, , v]) => { F[2 * n + 1] += v; });
  const supAt = {}; tr.supports.forEach(s => { supAt[s.node] = s; });
  const lifted = new Set((res.lifted || []).map(s => s.node));
  const A = S.mat.b * S.mat.h, I = S.mat.b * Math.pow(S.mat.h, 3) / 12;
  const nodes = [['node', 'label', 'x_mm', 'y_mm', 'load_x_N', 'load_y_N', 'support', 'fixed_x', 'fixed_y', 'lifted_off_in_FEA']];
  tr.nodes.forEach((p, i) => {
    const s = supAt[i];
    nodes.push([i, tr.keys[i], p[0].toFixed(4), p[1].toFixed(4), F[2 * i].toFixed(6), F[2 * i + 1].toFixed(6), s ? (s.pin ? 'pin' : 'roller') : 'none', s && s.pin ? 1 : 0, s ? 1 : 0, lifted.has(i) ? 1 : 0]);
  });
  const mem = [['member', 'i', 'j', 'type', 'L_mm', 'cos_x', 'cos_y', 'tension_limit_N', 'euler_Pcr_N', 'crush_limit_N', 'compression_limit_N', 'FEA_force_N']];
  tr.elems.forEach((e, k) => {
    const a = tr.nodes[e.i], b = tr.nodes[e.j], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const Pcr = Math.PI * Math.PI * S.mat.E * I / Math.pow(S.mat.K * L, 2);
    const cc = S.mat.sigC * A;
    mem.push([k, e.i, e.j, X.TYPE_LABEL[e.type], L.toFixed(4), ((b[0] - a[0]) / L).toFixed(6), ((b[1] - a[1]) / L).toFixed(6),
      (S.mat.sigT * A).toFixed(4), Pcr.toFixed(4), cc.toFixed(4), Math.min(Pcr, cc).toFixed(4), res.stable ? res.members[k].F.toFixed(6) : '']);
  });
  const head = ['row', 'node', 'direction', 'is_support_row'].concat(tr.elems.map((_, k) => 'm' + k));
  const B = [head];
  for (let n = 0; n < nN; n++) for (const dir of ['x', 'y']) {
    const row = [`n${n}_${dir}`, n, dir, (supAt[n] && (dir === 'y' || supAt[n].pin)) ? 1 : 0];
    tr.elems.forEach((e, k) => {
      let v = 0;
      if (e.i === n || e.j === n) {
        const me = tr.nodes[n], other = tr.nodes[e.i === n ? e.j : e.i];
        const L = Math.hypot(other[0] - me[0], other[1] - me[1]);
        v = (dir === 'x' ? other[0] - me[0] : other[1] - me[1]) / L;
      }
      row.push(v === 0 ? 0 : v.toFixed(6));
    });
    B.push(row);
  }
  const readme = `SE 310 Truss Explorer - LP data for "${S.name}"
${summaryOf({ family: S.family, pattern: S.pattern, panels: S.panels, height: S.height, overall: tr.overall, ratio: S.ratio, sideAngle: S.sideAngle, curve: tr.info.curve, bottom: tr.info.shape, supportOffset: tr.info.supportOffset })}
Exported ${new Date().toISOString().slice(0, 10)}. Units: mm, N. One side truss (the loads are this truss's share).

FILES
nodes.csv
  node, label        joint number (same numbering as the FEA script) and T/B label (top/bottom chord)
  x_mm, y_mm         coordinates
  load_x_N, load_y_N applied load on this truss, already multiplied by FS ${S.mat.FS} and divided by ${S.load.nTruss} trusses
                     (downward is negative). The book is ${(+S.bookLen).toFixed(0)} mm long, spread over the deck joints by tributary length.
  support            pin / roller / none (pin at the left main support joint; rollers at the matching right joint and, in
                     "every desk joint can bear" mode, at the other bottom joints that rest on a desk)
  fixed_x, fixed_y   1 if the table can push on this joint in that direction
  lifted_off_in_FEA  1 if the stiffness solution found this roller would have to pull down, so it was dropped there.
                     A table can only push up; how you treat that in your model is your call.

members.csv
  member, i, j       member number and its two joints
  L_mm               length (wood used per truss is the sum of these)
  cos_x, cos_y       direction cosines from joint i toward joint j
  tension_limit_N    sigma_t x A  = ${S.mat.sigT} MPa x ${A.toFixed(2)} mm^2
  euler_Pcr_N        pi^2 E I / (K L)^2 with E = ${S.mat.E} MPa, I = ${I.toFixed(3)} mm^4, K = ${S.mat.K}
  crush_limit_N      sigma_c x A  = ${S.mat.sigC} MPa x ${A.toFixed(2)} mm^2
  compression_limit_N  the smaller of the two above
  FEA_force_N        the stiffness-method force in this member for this exact design (tension positive), for comparison

equilibrium_matrix.csv
  One row per joint direction (n<node>_x, n<node>_y), one column per member.
  Entry = component, in that direction, of the unit vector pointing FROM that joint TOWARD the member's other end.
  So with member forces taken as tension positive, the column for member e tells you how a unit tension in e pulls on each joint.
  is_support_row = 1 marks rows where the table can supply a reaction.

Everything here is data from the current design. Writing the LP (variables, objective, constraints, and what the
dual values mean) is the part to do yourself.
`;
  return [
    { name: 'README.txt', text: readme },
    { name: 'nodes.csv', text: csvOf(nodes) },
    { name: 'members.csv', text: csvOf(mem) },
    { name: 'equilibrium_matrix.csv', text: csvOf(B) },
  ];
}
// ---------- build documents: joint styles, cut list, drawing, steps, templates
S.doc = Object.assign({ style: 'through', over: {}, stock: 914, kerf: 1, steps: true, tpl: true, colour: true, dash: false }, S.doc || {});
function docPlan() {
  const b = +S.mat.b || 3.18;
  // keep only overrides that still match this design's joints
  const J = BuildDoc.jointsOf(tr), ok = {};
  Object.keys(S.doc.over).forEach(n => { const j = J.find(q => q.n === +n); if (!j) return; const o = S.doc.over[n]; if (o.through != null && !j.m.some(q => q.k === o.through)) return; ok[n] = o; });
  S.doc.over = ok;
  return BuildDoc.cutPlan(tr, b, { style: S.doc.style, over: S.doc.over });
}
function renderDocDialog() {
  const plan = docPlan(), b = +S.mat.b || 3.18;
  document.querySelectorAll('input[name="jstyle"]').forEach(r => { r.checked = r.value === S.doc.style; });
  $('docStock').value = S.doc.stock; $('docKerf').value = S.doc.kerf; $('docSteps').checked = S.doc.steps; $('docTpl').checked = S.doc.tpl; $('docColour').checked = S.doc.colour; $('docDash').checked = S.doc.dash;
  // view with joint numbers
  const v = BuildDoc.sideSVG(tr, plan, { labels: false, b, color: S.doc.colour ? 'part' : 'mono', dash: S.doc.dash });
  const lbl = tr.nodes.map((p, n) => `<text x="${p[0] + 2}" y="${v.Y(p[1]) - 2}" font-size="5" fill="#b0601a" font-family="Arial" font-weight="bold">${n}</text>`).join('');
  $('docView').setAttribute('viewBox', v.box.join(' ')); $('docView').innerHTML = v.svg + lbl;
  const nT = +S.load.nTruss || 2, total = plan.pieces.reduce((s, q) => s + q.long * q.n, 0) * nT;
  $('docSum').textContent = `${plan.pieces.length} pieces per truss in ${plan.items.length} different cuts · ${total.toFixed(0)} mm of stick for ${nT} trusses (before cross-ties).`;
  $('docItems').innerHTML = '<thead><tr><th>Item</th><th class="l">Part</th><th>Qty</th><th>Long point</th><th>Short point</th><th class="l">End cuts</th></tr></thead><tbody>' +
    plan.items.map(it => `<tr><td>${S.doc.colour ? `<span style="display:inline-block;width:10px;height:10px;margin-right:4px;background:${BuildDoc.colOf(it.no)}"></span>` : ''}${it.no}</td><td class="l">${BuildDoc.TL[it.type] || it.type}</td><td>${it.pieces.length * nT * it.n}</td><td>${it.long.toFixed(1)}</td><td>${it.short.toFixed(1)}</td><td class="l">${it.cuts.map(BuildDoc.cutTxt).join(' / ')}</td></tr>`).join('') + '</tbody>';
  const name = k => `${k} ${(BuildDoc.TL[tr.elems[k].type] || '').toLowerCase()}`;
  $('docJoints').innerHTML = '<thead><tr><th>Joint</th><th class="l">On top / runs through</th><th class="l">Other ends</th><th>Mitre %</th></tr></thead><tbody>' +
    plan.joints.map(j => {
      const two = j.members.length === 2;
      const opts = ['<option value="">none</option>'].concat(j.members.map(k => `<option value="${k}" ${j.through === k ? 'selected' : ''}>${name(k)}</option>`)).join('');
      const ends = ['flush', 'square'].concat(two ? ['mitre'] : []).map(s => `<option value="${s}" ${j.end === s ? 'selected' : ''}>${s === 'flush' ? 'flush to it' : s === 'square' ? 'square (90°)' : 'mitre'}</option>`).join('');
      return `<tr${S.doc.over[j.n] ? ' style="background:var(--accent-soft)"' : ''}><td>${j.n}</td><td class="l"><select data-j="${j.n}" data-f="through">${opts}</select></td><td class="l"><select data-j="${j.n}" data-f="end">${ends}</select></td><td>${j.end === 'mitre' ? `<input type="number" min="5" max="95" step="5" value="${j.split}" data-j="${j.n}" data-f="split" style="width:60px">` : '—'}</td></tr>`;
    }).join('') + '</tbody>';
}
$('openDocs').addEventListener('click', () => { if (!res.stable) { toast('Make the design stable first: the build documents need a working bridge.', true); return; } renderDocDialog(); $('docModal').hidden = false; });
function showExport(x) {
  S.expTab = x; save(); $('s-export').open = true;
  document.querySelectorAll('#expTabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.x === x)));
  document.querySelectorAll('[data-xp]').forEach(p => { p.hidden = p.dataset.xp !== x; });
  if (x === 'docs') $('openDocs').click();
}
$('expTabs').addEventListener('click', ev => { const b = ev.target.closest('[data-x]'); if (!b) return; ev.preventDefault(); ev.stopPropagation(); showExport(b.dataset.x); });
showExport(S.expTab || 'bridge');
$('docNo').addEventListener('click', () => { $('docModal').hidden = true; });
$('docModal').addEventListener('keydown', ev => { if (ev.key === 'Escape') $('docModal').hidden = true; });
document.querySelectorAll('input[name="jstyle"]').forEach(r => r.addEventListener('change', () => { S.doc.style = r.value; save(); renderDocDialog(); }));
[['docStock', 'stock'], ['docKerf', 'kerf']].forEach(([id, k]) => $(id).addEventListener('change', () => { const v = +$(id).value; if (v >= 0) { S.doc[k] = v; save(); renderDocDialog(); } }));
[['docSteps', 'steps'], ['docTpl', 'tpl'], ['docColour', 'colour'], ['docDash', 'dash']].forEach(([id, k]) => $(id).addEventListener('change', () => { S.doc[k] = $(id).checked; save(); renderDocDialog(); }));
$('docResetJ').addEventListener('click', () => { S.doc.over = {}; save(); renderDocDialog(); });
$('docJoints').addEventListener('change', ev => {
  const t = ev.target, n = t.dataset.j, f = t.dataset.f; if (n == null) return;
  const cur = Object.assign({}, S.doc.over[n] || {});
  if (f === 'through') cur.through = t.value === '' ? null : +t.value;
  else if (f === 'end') cur.end = t.value;
  else if (f === 'split') cur.split = Math.max(5, Math.min(95, +t.value || 50));
  if (cur.end === 'mitre' && cur.through === undefined) cur.through = null;
  S.doc.over[n] = cur; save(); renderDocDialog();
});
$('docGo').addEventListener('click', () => {
  const plan = docPlan(), mat = Object.assign({}, C.DEFAULT_MAT, S.mat);
  const meta = { name: S.name || 'Design', b: +mat.b, h: +mat.h, nTruss: +S.load.nTruss || 2, stock: +S.doc.stock || 914, kerf: +S.doc.kerf,
    ties: S.opts.crossTies ? { count: tr.deckNodes.length, len: +S.opts.width || 60 } : null,
    massNote: `bridge mass ${res.massTotal.toFixed(1)} g`, capNote: `${res.capKg.toFixed(1)} kg of books (needs ${((S.load.mBook1 + S.load.mBook2) * S.mat.FS).toFixed(1)} kg)`,
    scaleNote: 'Templates: 1:1' };
  const html = BuildDoc.documentHTML(tr, res, meta, plan, { steps: S.doc.steps, templates: S.doc.tpl, colour: S.doc.colour, dash: S.doc.dash });
  saveFile(fileBase() + '_build_documents.html', html);
});
// ---------- bridge and sweep files, to share with partners (and, later, to publish)
const FILE_VER = 1;
// settings that belong to this browser's screen, not to the bridge
const UI_ONLY = ['openMap', 'hideSame', 'bestN', 'expTab', 'tradeDim', 'topView', 'keys', 'showForces', 'popPos', 'migOv5', 'abSteps', 'abExt', 'anaMode', 'tab', 'wide', 'compact', 'inputsFirst', 'sideW', 'hideHelp', 'hideStats', 'history', 'baseline', 'hideG', 'showIds', 'showElems', 'showDef', 'defScale', 'showDims', 'showGhosts', 'resOnDraw', 'groupBy', 'axX', 'axY', 'colorFails', 'clickMode', 'c3', 'autoRerun', 'autoLimit', 'bigCap', 'woodBudget', 'loadTarget', 'refStep'];
function bridgeState() { const o = {}; Object.keys(S).forEach(k => { if (!UI_ONLY.includes(k)) o[k] = S[k]; }); return JSON.parse(JSON.stringify(o)); }
function bridgeSummary() {
  return res.stable ? { wood: +res.wood.toFixed(1), capKg: +res.capKg.toFixed(2), deflection: +res.midDefl.toFixed(4), passes: !!res.passes, members: tr.elems.length, joints: tr.nodes.length } : { stable: false };
}
const stamp = () => new Date().toISOString();
$('saveBridge').addEventListener('click', () => {
  const doc = { format: 'se310-truss-bridge', version: FILE_VER, app: 'SE 310 Truss Explorer', savedAt: stamp(), name: S.name || 'Design', summary: bridgeSummary(), bridge: bridgeState() };
  saveFile(fileBase() + '.bridge.json', JSON.stringify(doc, null, 1));
});
$('saveSweepFile').addEventListener('click', () => {
  if (!sweepAll.length) { toast('Run a sweep first.', true); return; }
  const doc = { format: 'se310-truss-sweep', version: FILE_VER, app: 'SE 310 Truss Explorer', savedAt: stamp(), name: (S.name || 'Design') + ' sweep',
    message: $('sweepMsg').textContent, ctx: sweepCtx, sheet: sweepCtx && sweepCtx.sheet, mode: sweepMode, settings: { swOn: S.swOn, swVals: S.swVals, swSel: SW, focus: S.focus },
    bridge: bridgeState(), rows: sweepAll };
  saveFile(fileBase() + '.sweep.json', JSON.stringify(doc));
});
let pickFor = null, pendingSweep = null;
$('loadBridge').addEventListener('click', () => { pickFor = 'bridge'; $('filePick').value = ''; $('filePick').click(); });
$('loadSweepFile').addEventListener('click', () => { pickFor = 'sweep'; $('filePick').value = ''; $('filePick').click(); });
function applyBridge(b) {
  if (b.swOn) S.swOn = Object.assign({}, S.swOn, b.swOn);
  if (b.swVals) S.swVals = Object.assign({}, b.swVals);
  if (b.focus) S.focus = b.focus.slice();
  Object.keys(b).forEach(k => { if (!UI_ONLY.includes(k) && k in DEFAULT) S[k] = b[k]; });
  ['mat', 'load', 'opts'].forEach(k => { if (b[k]) S[k] = Object.assign({}, DEFAULT[k], b[k]); });
  if (b.swSel) ['panels', 'patterns', 'verts', 'claw', 'brace', 'loadShape', 'stickGroups', 'brace3', 'choice'].forEach(g => { if (b.swSel[g]) Object.keys(SW[g]).forEach(k => { if (k in b.swSel[g]) SW[g][k] = !!b.swSel[g][k]; }); });
  if (b.swVals) SW_IDS.forEach(id => { if (b.swVals[id] != null) $(id).value = b.swVals[id]; });
  ['swPanels', 'swPatterns', 'swVerts', 'swClaw', 'swBrace', 'swLoad', 'swStick'].forEach(id => { const el = $(id); if (el) el.querySelectorAll('button').forEach(() => {}); });
  toggleChips('swPanels', SW.panels); toggleChips('swPatterns', SW.patterns, PNAME); toggleChips('swVerts', SW.verts, { all: 'All', none: 'None' });
  toggleChips('swClaw', SW.claw, { off: 'No claws', on: 'Claws' }); toggleChips('swBrace', SW.brace, { off: 'No braces', on: 'Edge braces' });
  toggleChips('swLoad', SW.loadShape, LOAD_SHAPES); toggleChips('swStick', SW.stickGroups, STICK_GROUPS);
  SWV.forEach(v => { const cb = v.k === 'O' ? $('swVaryOv') : $('swOn' + v.k); if (cb) cb.checked = swOn(v.k); });
  paintSwBlocks(); update();
}
$('filePick').addEventListener('change', async () => {
  const f = $('filePick').files[0]; if (!f) return;
  let doc; try { doc = JSON.parse(await f.text()); } catch (e) { toast('That file is not a bridge or sweep file (it is not valid JSON).', true); return; }
  if (pickFor === 'bridge' || doc.format === 'se310-truss-bridge') {
    if (doc.format !== 'se310-truss-bridge' || !doc.bridge) { toast('That is not a bridge file.', true); return; }
    applyBridge(doc.bridge);
    $('fileMsg').textContent = `Opened "${doc.name}" (saved ${new Date(doc.savedAt).toLocaleString()}).`; toast('Bridge loaded.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (doc.format !== 'se310-truss-sweep' || !Array.isArray(doc.rows)) { toast('That is not a sweep file.', true); return; }
  sweepAll = doc.rows; sweepCtx = doc.ctx || sweepCtx; sweepMode = 'file'; pendingSweep = doc;
  sweepRows = sweepAll.filter(r => r.passes).sort((x, y) => x.wood - y.wood || x.util - y.util).slice(0, 30);
  lastSig = null;
  $('sweepMsg').textContent = `Opened the sweep "${doc.name}" (saved ${new Date(doc.savedAt).toLocaleString()}): ${doc.rows.length.toLocaleString()} designs. ${doc.message || ''}`;
  $('sweepFileBox').hidden = false;
  $('sweepFileBox').innerHTML = `These results come from a sweep file. The inputs on the left are still your own. <button type="button" class="btn ghost sm" id="useSweepSetup">Also load its bridge and sweep settings</button>`;
  $('useSweepSetup').addEventListener('click', () => { const d = pendingSweep; if (!d) return; applyBridge(Object.assign({}, d.bridge, d.settings ? { swOn: d.settings.swOn, swVals: d.settings.swVals, swSel: d.settings.swSel, focus: d.settings.focus } : {})); lastSig = sweepSig(); checkStale(); $('sweepFileBox').hidden = true; toast('Bridge and sweep settings loaded.'); });
  renderSweep(); drawTrackers(); paintBigMode(); checkStale();
});
// ---------- the floating View switch and menu, and simple bridges to start again from
function closeDock() { $('dockMenu').hidden = true; $('dockBtn').setAttribute('aria-expanded', 'false'); }
$('dockBtn').addEventListener('click', ev => { ev.stopPropagation(); const m = $('dockMenu'); m.hidden = !m.hidden; $('dockBtn').setAttribute('aria-expanded', String(!m.hidden)); if (!m.hidden) { paintBackups(); paintDockChecks(); } });
document.addEventListener('click', ev => { if (!ev.target.closest('#dock')) closeDock(); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('dockMenu').hidden) closeDock(); });
function paintDockChecks() { $('swCompact').checked = !!S.compact; $('swHelp').checked = !S.hideHelp; }
$('swCompact').addEventListener('change', () => { if (!!S.compact !== $('swCompact').checked) $('toggleCompact').click(); });
$('swHelp').addEventListener('change', () => { if (!S.hideHelp !== $('swHelp').checked) $('toggleHelp').click(); });
$('chartDimDock').addEventListener('click', ev => { const b = ev.target.closest('[data-cd]'); if (!b) return; ev.stopPropagation(); S.tab = b.dataset.cd; S.tradeDim = b.dataset.cd; save(); paintTabs(); drawTrackers(); if (fsEl === '#trackBody') setFs('#trackBody'); });
$('viewSwitch').addEventListener('click', ev => { if (ev.target.closest('#anaSwitch') || ev.target.closest('#chartDimDock')) return; const b = ev.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
$('viewSwitch').addEventListener('keydown', ev => {
  if (ev.target.closest('#anaSwitch')) return;
  const order = ['inputs', 'both', 'bridge', 'analysis'], i = order.indexOf(fsEl === '#trackBody' ? 'analysis' : curView());
  if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); const v = order[Math.max(0, Math.min(3, i + (ev.key === 'ArrowRight' ? 1 : -1)))]; setView(v); $('viewSwitch').querySelector(`[data-view="${v}"]`).focus(); }
});
$('backTab').addEventListener('click', () => setView('both'));
const PRESETS = [
  { name: 'Course sample · Pratt, 4 panels, h 70', set: {} },
  { name: 'Simple Warren · 4 panels, h 40', set: { family: 'warren', panels: 4, height: 40 } },
  { name: 'Howe · 6 panels, h 50', set: { pattern: 'howe', panels: 6, height: 50 } },
  { name: 'Shallow Pratt with a sagging bottom · h 30, p −20', set: { height: 30, bottom: 'parabola', curve: -20 } },
  { name: 'Arch on the table edges · Warren, top arch, feet', set: { family: 'warren', panels: 4, height: 45, topShape: 'parabola', topEnd: 0, deskMode: 'length', overlap: 30, deskEnds: 'feet', edgeBear: true } },
];
$('presetSel').innerHTML += PRESETS.map((q, i) => `<option value="${i}">${q.name}</option>`).join('');
$('presetSel').addEventListener('change', () => {
  const q = PRESETS[+$('presetSel').value]; if (!q) return;
  const base = JSON.parse(JSON.stringify(DEFAULT));
  UI_ONLY.forEach(k => { delete base[k]; });
  base.name = q.name.split(' · ')[0];
  const b = Object.assign(base, q.set);
  if ($('presetSweep').checked) Object.assign(b, { swOn: { H: true, N: true, P: true }, swVals: {} });
  // the sweep switches not named go off; ranges keep their values unless reset
  if ($('presetSweep').checked) Object.keys(S.swOn).forEach(k => { if (!(k in b.swOn)) b.swOn[k] = false; });
  S.sticks = {}; S.loads = null; S.focus = [];
  applyBridge(b);
  $('presetSel').value = ''; closeDock(); toast(`Started from "${q.name}". Changed your mind? ☰ → Go back to an earlier bridge.`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('dlLp').addEventListener('click', () => saveFile(fileBase() + '_LP_data.zip', zip(lpFiles())));

// ---------- sweep
// choice inputs that can be swept (foot style, supports, chord shapes...): key = the design field
const CHOICES = [
  { key: 'deskEnds', host: 'deskEnds', name: 'foot style', opts: { truss: 'Full truss', noEndPost: 'No end post', feet: 'Feet only' } },
  { key: 'supportMode', host: 'supportMode', name: 'supports', opts: { all: 'Every desk joint', one: 'One per side' } },
  { key: 'topShape', host: 'topShape', name: 'top chord shape', opts: { flat: 'Flat', parabola: 'Parabola', arc: 'Arc', catenary: 'Catenary' } },
  { key: 'bottom', host: 'bottom', name: 'bottom chord shape', opts: { flat: 'Flat', parabola: 'Parabola', arc: 'Arc', catenary: 'Catenary' } },
  { key: 'sideLean', host: 'sideLean', name: 'side lean', opts: { in: 'Lean in', out: 'Lean out' } },
  { key: 'bookContact', host: 'bookContact', name: 'book on a curved top', opts: { rigid: 'Highest joints', spread: 'Every deck joint' } },
  { key: 'edgeBear', host: 'edgeBear', name: 'ends bear on the table edge', opts: { off: 'No', on: 'Yes' }, bool: true },
];
function choiceVal(ch, v) { return ch.bool ? v === 'on' : v; }
const SW = { panels: { 2: false, 3: true, 4: true, 5: true, 6: true, 7: false, 8: true, 9: false, 10: false, 11: false, 12: false },
  patterns: { pratt: true, howe: true, altP: true, altH: false, x: false, warren: true },
  verts: { all: true, none: false }, claw: { off: true, on: true }, brace: { off: true, on: true },
  loadShape: { current: true, book: false, point: true, partial: false, rampUp: false, rampDown: false },
  stickGroups: { top: true, bot: true, diag: false, vert: false, end: false },
  brace3: { current: true, light: true, every: true, topX: false, full: true },
  choice: Object.fromEntries(CHOICES.flatMap(ch => Object.keys(ch.opts).map(o => [ch.key + ':' + o, true]))) };
const LOAD_SHAPES = { current: 'Loads as set', book: 'Book (uniform)', point: 'Point', partial: 'Partial (half the book)', rampUp: 'Ramp rising →', rampDown: 'Ramp falling →' };
const STICK_GROUPS = { top: 'Top chord', bot: 'Bottom chord', diag: 'Diagonals', vert: 'Verticals', end: 'End posts' };
// the loads used by one sweep design: a shape, centred at x for a point or partial load
function loadsFor(shape, x) {
  const Lb = +S.bookLen, cx = x == null ? SPAN_MID : +x;
  switch (shape) {
    case 'book': return null;
    case 'point': return [{ type: 'point', x: cx, w: 1 }];
    case 'partial': return [{ type: 'partial', a: cx - Lb / 4, b: cx + Lb / 4, w: 1 }];
    case 'rampUp': return [{ type: 'ramp', a: SPAN_MID - Lb / 2, b: SPAN_MID + Lb / 2, w: 1, dir: 'up' }];
    case 'rampDown': return [{ type: 'ramp', a: SPAN_MID - Lb / 2, b: SPAN_MID + Lb / 2, w: 1, dir: 'down' }];
    default: return S.loads ? S.loads.map(L => Object.assign({}, L)) : null;
  }
}
S.focus = Array.isArray(S.focus) ? S.focus : [];
function toggleChips(id, obj, labels) {
  const el = $(id); el.innerHTML = '';
  Object.keys(obj).forEach(k => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (obj[k] ? ' on' : '');
    b.setAttribute('aria-pressed', String(obj[k])); b.style.minWidth = '38px'; b.style.padding = '6px 8px';
    b.textContent = labels ? labels[k] : k;
    b.addEventListener('click', () => { obj[k] = !obj[k]; S.swSel = SW; save(); toggleChips(id, obj, labels); updateSweepCount(); if (tr) renderDrawing(); });
    el.appendChild(b);
  });
}
if (S.swSel) { ['panels', 'patterns', 'verts', 'claw', 'brace', 'loadShape', 'stickGroups', 'brace3', 'choice'].forEach(g => { if (S.swSel[g]) Object.keys(SW[g]).forEach(k => { if (k in S.swSel[g]) SW[g][k] = !!S.swSel[g][k]; }); }); }
toggleChips('swPanels', SW.panels); toggleChips('swPatterns', SW.patterns, PNAME); toggleChips('swVerts', SW.verts, { all: 'All', none: 'None' });
toggleChips('swClaw', SW.claw, { off: 'No claws', on: 'Claws' }); toggleChips('swBrace', SW.brace, { off: 'No braces', on: 'Edge braces' });
toggleChips('swLoad', SW.loadShape, LOAD_SHAPES); toggleChips('swStick', SW.stickGroups, STICK_GROUPS);

// ---------- one variable list: every sweepable input has its own Sweep switch, and its range sits right under it.
// A variable that is not swept uses the value in its input, for the single design and for every sweep design.
S.swOn = Object.assign({ H: true, N: true, P: true, V: false, R: false, A: false, D: false, S: false, O: false, T: false, Q: false, C: false, B: false, L: false, X: false, M: false, K: false, F: false }, S.swOn || {});
S.swVals = S.swVals || {};
const swOn = k => !!S.swOn[k];
const SWV = [
  { k: 'H', anchor: 'height', name: 'height' }, { k: 'D', anchor: 'curve', name: 'curve depth (mm, − sag / + arch)' }, { k: 'N', anchor: 'panels', chips: 'swPanels', name: 'panel count' },
  { k: 'T', anchor: 'topEnd', name: 'arch end height Δh' }, { k: 'Q', anchor: 'botEnd', name: 'bottom end height Δp' }, { k: 'R', anchor: 'ratio', name: 'taper' }, { k: 'A', anchor: 'sideAngle', name: 'side angle' }, { k: 'O', anchor: 'overlap', name: 'overlap' },
  { k: 'S', anchor: 'supportOffset', name: 'support distance' }, { k: 'P', anchor: 'pattern', chips: 'swPatterns', name: 'pattern' }, { k: 'V', anchor: 'vertPreset', chips: 'swVerts', name: 'verticals' },
  { k: 'C', anchor: 'claw', chips: 'swClaw', name: 'claws' }, { k: 'B', anchor: 'brace', chips: 'swBrace', name: 'edge braces' },
  { k: 'L', anchor: 'addLoad', chips: 'swLoad', name: 'load shape' },
  { k: 'X', anchor: 'swAnchorX', name: 'load position (mm from the left desk edge; centre of a point or partial load, otherwise mid-span)' },
  { k: 'M', anchorEl: () => $('mBook1').closest('.two'), name: 'total book mass (kg)' },
  { k: 'K', anchor: 'stickAnchor', chips: 'swStick', trio: true, name: 'sticks per member type (1 to 4)' },
  { k: 'F', anchor: 'focusList', name: 'sticks in each focused member (1 to 4)' },
];
const SW_IDS = ['swH0', 'swH1', 'swHs', 'swR0', 'swR1', 'swRs', 'swA0', 'swA1', 'swAs', 'swD0', 'swD1', 'swDs', 'swS0', 'swS1', 'swSs', 'swO0', 'swO1', 'swOs',
  'swY0', 'swY1', 'swYs', 'swW0', 'swW1', 'swWs', 'swT0', 'swT1', 'swTs', 'swQ0', 'swQ1', 'swQs', 'swX0', 'swX1', 'swXs', 'swM0', 'swM1', 'swMs', 'swK0', 'swK1', 'swKs', 'swF0', 'swF1', 'swFs'];
SW_IDS.forEach(id => { if (S.swVals[id] != null) $(id).value = S.swVals[id]; $(id).addEventListener('input', () => { S.swVals[id] = $(id).value; save(); renderDrawing(); }); });
SWV.forEach(v => {
  const body = document.createElement('div');
  if (v.chips) body.appendChild($(v.chips));
  if (v.trio || !v.chips) body.appendChild($('sw' + v.k + '0').closest('.trio'));
  const a = v.anchorEl ? v.anchorEl() : $(v.anchor), row = v.anchorEl ? a : (a.closest('.row') || a);
  const blk = document.createElement('div'); blk.className = 'swblock'; blk.dataset.k = v.k;
  const lab = document.createElement('label'); lab.className = 'swtog';
  let cb;
  if (v.k === 'O') { cb = $('swVaryOv'); const old = cb.closest('label'); lab.appendChild(cb); if (old) old.remove(); }
  else { cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'swOn' + v.k; lab.appendChild(cb); }
  const note = document.createElement('span'); note.className = 'swnote';
  const wrap = document.createElement('div'); wrap.className = 'swbody'; wrap.appendChild(body);
  if (v.k === 'O') { const h = document.createElement('span'); h.className = 'hint'; h.textContent = 'Sweeping the overlap sets the desk panels by overlap for every sweep design.'; wrap.appendChild(h); }
  const head = !v.anchorEl && row.querySelector(':scope > .lab');
  if (head) {   // a small "sweep" switch in the input's own label line
    lab.className = 'swchip'; lab.title = 'Sweep ' + v.name; lab.appendChild(document.createTextNode('sweep'));
    head.appendChild(lab); blk.classList.add('inl'); blk.append(note, wrap);
  } else { lab.appendChild(document.createTextNode(' Sweep ' + v.name)); blk.append(lab, note, wrap); }
  row.after(blk);
  cb.checked = swOn(v.k);
  cb.addEventListener('change', () => { S.swOn[v.k] = cb.checked; save(); paintSwBlocks(); updateSweepCount(); renderDrawing(); });
});
function paintSwBlocks() {
  document.querySelectorAll('.swblock').forEach(b => {
    const on = swOn(b.dataset.k); b.classList.toggle('on', on);
    b.querySelector('.swnote').textContent = on ? `sweep range for ${(SWV.find(v => v.k === b.dataset.k) || {}).name || ''} (the single design still uses the value above)` : 'fixed: the sweep uses the value above';
  });
}
paintSwBlocks();
function renderSwSummary() {
  const names = { H: 'Height', T: 'Arch end height Δh', Q: 'Bottom end height Δp', R: 'Taper', A: 'Side angle', D: 'Curve', S: 'Support distance', O: 'Overlap' };
  const tri = k => `${$('sw' + k + '0').value} to ${$('sw' + k + '1').value} by ${$('sw' + k + 's').value}`;
  const parts = [];
  ['H', 'T', 'D', 'Q', 'R', 'A', 'O', 'S'].forEach(k => { if (swOn(k)) parts.push(`${names[k]} ${tri(k)}`); });
  CHOICES.forEach(ch => { if (swOn('c_' + ch.key)) parts.push(`${ch.name[0].toUpperCase() + ch.name.slice(1)} ${Object.keys(ch.opts).filter(o => SW.choice[ch.key + ':' + o]).map(o => ch.opts[o]).join(' / ')}`); });
  if (S.anaMode === '3d') { if (swOn('Y')) parts.push(`3D tilt ${tri('Y')}°`); if (swOn('W')) parts.push(`3D width ${tri('W')} mm`); if (swOn('U')) parts.push('bottom ties on and off'); if (swOn('Z')) parts.push('bracing sets ' + Object.keys(SW.brace3).filter(x => SW.brace3[x]).length); }
  if (swOn('N')) parts.push('Panels ' + Object.keys(SW.panels).filter(x => SW.panels[x]).join(', '));
  if (swOn('P')) parts.push('Patterns ' + Object.keys(SW.patterns).filter(x => SW.patterns[x]).map(x => PNAME[x]).join(', '));
  if (swOn('V')) parts.push('Verticals ' + Object.keys(SW.verts).filter(x => SW.verts[x]).join(', '));
  if (swOn('C')) parts.push('Claws ' + Object.keys(SW.claw).filter(x => SW.claw[x]).join(', '));
  if (swOn('B')) parts.push('Edge braces ' + Object.keys(SW.brace).filter(x => SW.brace[x]).join(', '));
  if (swOn('L')) parts.push('Load shapes ' + Object.keys(SW.loadShape).filter(x => SW.loadShape[x]).map(x => LOAD_SHAPES[x]).join(', '));
  if (swOn('X')) parts.push(`Load position ${tri('X')} mm`);
  if (swOn('M')) parts.push(`Book mass ${tri('M')} kg`);
  if (swOn('K')) parts.push(`Sticks ${tri('K')} for ${Object.keys(SW.stickGroups).filter(x => SW.stickGroups[x]).map(x => STICK_GROUPS[x]).join(', ')}`);
  if (swOn('F')) parts.push(`Sticks ${tri('F')} in each of ${S.focus.length} focused member${S.focus.length === 1 ? '' : 's'}`);
  $('swSummary').innerHTML = (parts.length ? '<b>Swept:</b> ' + parts.join(' · ') + '.' : '<b>Nothing is swept yet.</b> Tick "Sweep" under an input on the left.') +
    ' <b>Everything else</b> is fixed at the values in the inputs on the left.';
}
$('swFS').addEventListener('input', () => { const v = +$('swFS').value; if (v > 0) { S.mat.FS = v; update(); } });
$('swBook').addEventListener('input', () => {
  const tot = +$('swBook').value; if (!(tot > 0)) return;
  const old = S.load.mBook1 + S.load.mBook2, f1 = old > 0 ? S.load.mBook1 / old : 0.6;
  S.load.mBook1 = +(tot * f1).toFixed(3); S.load.mBook2 = +(tot - S.load.mBook1).toFixed(3); update();
});
function range(a, b, s) { a = +a; b = +b; s = Math.abs(+s) || 1; if (b < a) [a, b] = [b, a]; const out = []; for (let v = a; v <= b + 1e-9 && out.length < 400; v += s) out.push(+v.toFixed(4)); return out; }
function sweepDims() {
  const H = swOn('H') ? range($('swH0').value, $('swH1').value, $('swHs').value).filter(h => h >= 0) : [+S.height];
  const Rr = swOn('R') ? range($('swR0').value, $('swR1').value, $('swRs').value).filter(r => r > 0) : [+S.ratio];
  const A = swOn('A') ? [...new Set(range($('swA0').value, $('swA1').value, $('swAs').value).map(a => Math.max(20, Math.min(90, a))))] : [+S.sideAngle];
  const Ds = swOn('D') ? [...new Set(range($('swD0').value, $('swD1').value, $('swDs').value).map(v => Math.max(-60, Math.min(120, v))))] : [S.bottom === 'flat' ? 0 : +S.curve];
  const Sups = swOn('S') ? [...new Set(range($('swS0').value, $('swS1').value, $('swSs').value).map(v => Math.max(0, Math.min(50, v))))] : [+S.supportOffset];
  const Ovs = swOn('O') ? [...new Set(range($('swO0').value, $('swO1').value, $('swOs').value).map(v => Math.max(0, Math.min(50, v))))] : [null];
  const Ns = swOn('N') ? Object.keys(SW.panels).filter(k => SW.panels[k]).map(Number) : [+S.panels];
  const pats = swOn('P') ? Object.keys(SW.patterns).filter(k => SW.patterns[k]) : [S.family === 'warren' ? 'warren' : (S.pattern || 'custom')];
  const verts = swOn('V') ? Object.keys(SW.verts).filter(k => SW.verts[k]) : ['current'];
  const claws = swOn('C') ? Object.keys(SW.claw).filter(k => SW.claw[k]) : [S.claw];
  const braces = swOn('B') ? Object.keys(SW.brace).filter(k => SW.brace[k]) : [S.brace];
  // one combined pattern dimension: Warren ignores side angle and verticals
  const PV = [];
  pats.forEach(p => { if (p === 'warren') PV.push({ family: 'warren', pattern: 'warren', sideAngle: 90, vert: '—' });
    else A.forEach(an => verts.forEach(v => PV.push({ family: 'grid', pattern: p, sideAngle: an, vert: v }))); });
  // load shape and position: the position only matters for point and partial loads
  const shapes = swOn('L') ? Object.keys(SW.loadShape).filter(k => SW.loadShape[k]) : ['current'];
  const xs = swOn('X') ? range($('swX0').value, $('swX1').value, $('swXs').value).map(v => Math.max(-50, Math.min(250, v))) : [SPAN_MID];
  const LX = [];
  shapes.forEach(sh => { if (sh === 'point' || sh === 'partial') xs.forEach(x => LX.push({ loadShape: sh, loadX: x })); else LX.push({ loadShape: sh, loadX: null }); });
  const Ms = swOn('M') ? range($('swM0').value, $('swM1').value, $('swMs').value).filter(m => m > 0) : [null];
  const counts = id => [...new Set(range($('sw' + id + '0').value, $('sw' + id + '1').value, $('sw' + id + 's').value).map(v => Math.max(1, Math.min(4, Math.round(v)))))];
  const Ts = swOn('T') ? range($('swT0').value, $('swT1').value, $('swTs').value).map(v => Math.max(0, Math.min(100, v))) : [+S.topEnd];
  const Qs = swOn('Q') ? range($('swQ0').value, $('swQ1').value, $('swQs').value).map(v => Math.max(-50, Math.min(100, v))) : [+S.botEnd];
  const Zs = S.anaMode === '3d' && swOn('Z') ? Object.keys(SW.brace3).filter(k => SW.brace3[k]) : [S.anaMode === '3d' ? 'current' : null];
  const in3 = S.anaMode === '3d';
  const Ys = in3 && swOn('Y') ? [...new Set(range($('swY0').value, $('swY1').value, $('swYs').value).map(v => Math.max(-30, Math.min(30, v))))] : [null];
  const Ws = in3 && swOn('W') ? [...new Set(range($('swW0').value, $('swW1').value, $('swWs').value).map(v => Math.max(20, Math.min(120, v))))] : [null];
  const Us = in3 && swOn('U') ? [true, false] : [null];
  const chDims = CHOICES.filter(ch => swOn('c_' + ch.key)).map(ch => ['c_' + ch.key, Object.keys(ch.opts).filter(o => SW.choice[ch.key + ':' + o])]).filter(d => d[1].length);
  const dims = [...chDims, ['tilt3', Ys], ['width3', Ws], ['ties3', Us], ['brace3', Zs], ['claw', claws], ['brace', braces], ['lx', LX], ['bookKg', Ms], ['topEnd', Ts], ['botEnd', Qs], ['overlap', Ovs], ['curve', Ds], ['supportOffset', Sups], ['panels', Ns], ['pv', PV], ['height', H], ['ratio', Rr]];
  if (swOn('K')) Object.keys(SW.stickGroups).filter(g => SW.stickGroups[g]).forEach(g => dims.push(['st_' + g, counts('K')]));
  if (swOn('F')) S.focus.forEach((f, i) => dims.push(['fc_' + i, counts('F')]));
  // total as a plain number for display, and exact as a BigInt: past 2^53 (about 9 quadrillion) plain numbers lose digits
  return { dims, total: dims.reduce((n, d) => n * d[1].length, 1), totalBig: dims.reduce((n, d) => n * BigInt(d[1].length), 1n) };
}
// design number idx of the sweep (mixed-radix count over the dimensions; the last one changes fastest)
function candAt(Dm, idx) {
  if (typeof idx === 'bigint') {   // a design number past 2^53: exact BigInt digits, kept as text in the row
    const c = { idx: idx.toString() };
    for (let k = Dm.dims.length - 1; k >= 0; k--) {
      const [name, arr] = Dm.dims[k], L = BigInt(arr.length), v = arr[Number(idx % L)]; idx = idx / L;
      if (name === 'pv' || name === 'lx') Object.assign(c, v); else c[name] = v;
    }
    return c;
  }
  const c = { idx };
  for (let k = Dm.dims.length - 1; k >= 0; k--) {
    const [name, arr] = Dm.dims[k], v = arr[idx % arr.length]; idx = Math.floor(idx / arr.length);
    if (name === 'pv' || name === 'lx') Object.assign(c, v); else c[name] = v;
  }
  return c;
}
function sweepList() { const Dm = sweepDims(); const out = new Array(Dm.total); for (let i = 0; i < Dm.total; i++) out[i] = candAt(Dm, i); return out; }
// a sweep range needs a step above 0 unless from and to are equal
function sweepProblems() {
  const names = { Y: '3D tilt', W: '3D width', H: 'Height', R: 'Taper', A: 'Side angle', D: 'Bottom-chord curve', S: 'Support distance', O: 'Overlap', T: 'Arch end height', Q: 'Bottom end height', X: 'Load position', M: 'Book mass', K: 'Sticks per type', F: 'Focused-member sticks' };
  const out = [];
  for (const k of Object.keys(names)) {
    if (!swOn(k)) { $('sw' + k + 's').classList.remove('bad'); continue; }
    const f = +$('sw' + k + '0').value, t = +$('sw' + k + '1').value, s = +$('sw' + k + 's').value;
    $('sw' + k + 's').classList.toggle('bad', !(s > 0) && f !== t);
    if (!(s > 0) && f !== t) out.push(names[k]);
  }
  return out;
}
function updateSweepCount() {
  const pr = sweepProblems();
  renderSwSummary(); if (typeof checkStale === 'function' && lastSigReady()) checkStale();
  $('sweepCount').textContent = pr.length ? `Step is 0 for ${pr.join(', ')}: set a step above 0 (or make from and to equal)` : sweepDims().total.toLocaleString() + ' designs to test' + overlapWarning();
}
// when the overlap is not swept, every design gets the current overlap; say so if that is under the minimum
function overlapWarning() {
  if (swOn('O') || !tr) return '';
  const ov = Math.max(0, tr.overlap), mn = +S.opts.minOverlap || 0;
  if (ov >= mn - 1e-9) return '';
  return ` · Warning: every design will have ${ov.toFixed(0)} mm on each desk, under the ${mn.toFixed(0)} mm minimum, so none can pass. ` +
    (tr.deskPanels === 0 ? 'Desk panels is 0 in the inputs, so the bridge stops at the desk edges. Set desk panels to 1 or more, or tick "Sweep" under the overlap.' : 'Raise the overlap, tick "Sweep" under the overlap, or lower the minimum.');
}
['swH0', 'swH1', 'swHs', 'swR0', 'swR1', 'swRs', 'swA0', 'swA1', 'swAs', 'swD0', 'swD1', 'swDs', 'swS0', 'swS1', 'swSs', 'swO0', 'swO1', 'swOs', 'swVaryOv'].forEach(id => $(id).addEventListener('input', updateSweepCount));
let sweepRows = [], sweepAll = [], sweepBusy = false, sweepCtx = null;
function evalCandidate(c, mode) {
  const h = Math.floor(c.panels / 2);
  const keepDiag = !swOn('P') && c.family === 'grid' && c.panels === +S.panels && S.diagLeft.length === h;
  const d = design({ family: c.family, height: c.height, panels: c.panels, ratio: c.ratio,
    topEnd: c.topEnd != null ? c.topEnd : +S.topEnd, botEnd: c.botEnd != null ? c.botEnd : +S.botEnd, curve: c.curve, bottom: c.curve ? (S.bottom === 'flat' ? 'parabola' : S.bottom) : 'flat', supportOffset: c.supportOffset, sticks: candSticks(c), stickByType: candStickTypes(c), claw: c.claw === 'on', brace: c.brace === 'on',
    ...(c.loadShape && c.loadShape !== 'current' ? { loads: loadsFor(c.loadShape, c.loadX) } : {}),
    ...(c.overlap != null ? { deskMode: 'length', overlap: c.overlap, deskPanels: Math.max(1, +S.deskPanels || 1) } : {}),
    diagLeft: c.family === 'grid' ? (keepDiag ? S.diagLeft.slice() : C.patternLeft(c.pattern === 'custom' ? 'pratt' : c.pattern, h)) : [], diagMiddle: keepDiag ? S.diagMiddle : 'X',
    vertLeft: c.vert === 'current' ? (S.vertLeft.length === h ? S.vertLeft.slice() : Array(h).fill(S.vertPreset !== 'none')) : Array(h).fill(c.vert !== 'none'),
    edgeVert: c.vert === 'current' ? S.edgeVert : c.vert !== 'none', sideAngle: c.sideAngle, sideLean: swOn('A') ? 'in' : S.sideLean, ...choiceOver(c) });
  const t2 = C.buildTruss(d), L = candLoad(c);
  let r2 = C.analyze(t2, S.mat, L, c.width3 != null ? Object.assign({}, S.opts, { width: +c.width3 }) : S.opts);
  const r2d = r2;
  if ((mode || S.anaMode) === '3d') r2 = apply3D(t2, r2, L, d3opts(c));
  return { t2, r2, r2d };
}
// a 2D result that fails clearly (not just by a little) can skip the 3D solve in a pre-screened search
const SCREEN_UTIL = 1.15;
function clearly2DFail(r) { return !r.stable || r.envelope.length > 0 || !r.edgeOK || r.slips.length > 0 || r.maxUtil > SCREEN_UTIL || r.midDefl > 1.15 * S.opts.deflLimit; }
function upgrade3D(c, t2, r2d) { return apply3D(t2, r2d, candLoad(c), d3opts(c)); }
// sticks: fixed = the counts set in the member table; swept by type = every member of that type; focused members override
function choiceOver(c) {
  const o = {};
  CHOICES.forEach(ch => { const v = c['c_' + ch.key]; if (v == null) return; o[ch.key] = choiceVal(ch, v); });
  if (o.bottom) { if (o.bottom === 'flat') o.curve = 0; else if (!c.curve) o.curve = +S.curve || -20; }
  return o;
}
function candStickTypes(c) {
  if (!swOn('K')) return null;
  const o = {}; Object.keys(STICK_GROUPS).forEach(g => { if (c['st_' + g]) o[g] = c['st_' + g]; }); return o;
}
function candSticks(c) {
  let st = swOn('K') ? {} : Object.assign({}, S.sticks);
  if (swOn('F')) S.focus.forEach((f, i) => { const n = c['fc_' + i]; if (!n) return; [f.key, f.mkey].forEach(k => { if (k) { if (n === 1) delete st[k]; else st[k] = { n, bundle: 'row' }; } }); });
  return st;
}
function candLoad(c) {
  if (c.bookKg == null) return S.load;
  const old = S.load.mBook1 + S.load.mBook2, f1 = old > 0 ? S.load.mBook1 / old : 0.6;
  return Object.assign({}, S.load, { mBook1: c.bookKg * f1, mBook2: c.bookKg * (1 - f1) });
}
function lastSigReady() { try { return lastSig !== undefined; } catch (e) { return false; } }
// ---------- stale results: the charts show the last sweep; flag it when any input that feeds the sweep has changed since
let lastSig = null, autoTimer = null;
S.autoRerun = !!S.autoRerun; S.autoLimit = +S.autoLimit || 500;
function sweepSig() {
  const d = design({ name: '' });
  // inputs that are swept don't matter to the sweep: only their ranges do
  const drop = { H: ['height'], D: ['curve'], N: ['panels', 'diagLeft', 'vertLeft'], R: ['ratio'], A: ['sideAngle', 'sideLean'], O: ['overlap', 'deskMode'], S: ['supportOffset'],
    P: ['family', 'diagLeft', 'diagMiddle'], V: ['vertLeft', 'edgeVert'], C: ['claw'], B: ['brace'], L: ['loads'], K: ['sticks'], T: ['topEnd'], Q: ['botEnd'] };
  Object.keys(drop).forEach(k => { if (swOn(k)) drop[k].forEach(f => { delete d[f]; }); });
  CHOICES.forEach(ch => { if (swOn('c_' + ch.key)) delete d[ch.key]; });
  return JSON.stringify({ ana: S.anaMode || '2d', d3: S.anaMode === '3d' ? [S.d3.topPat, S.d3.botPat, S.d3.framePat, S.d3.tilt, S.d3.botTies, swOn('Z') ? SW.brace3 : null] : null, d, pat: swOn('P') ? null : S.pattern, vp: swOn('V') ? null : S.vertPreset, mat: S.mat, load: swOn('M') ? null : S.load, opts: S.opts, on: S.swOn, vals: SW_IDS.map(id => $(id).value), sel: SW, focus: swOn('F') ? S.focus : null });
}
function checkStale() {
  const stale = lastSig !== null && sweepSig() !== lastSig;
  // say plainly when the charts hold a sweep from the other analysis (a 2D sweep counts one truss pair, no ties or bracing)
  let ana = null; try { ana = lastSig ? JSON.parse(lastSig).ana : null; } catch (e) {}
  const other = stale && ana && ana !== (S.anaMode || '2d');
  document.querySelectorAll('.staleMsg').forEach(el => {
    el.hidden = !stale; el.classList.toggle('anamix', !!other);
    const t = el.firstChild; if (!t || t.nodeType !== 3) return;
    if (el.dataset.txt == null) el.dataset.txt = t.textContent;
    t.textContent = other ? (ana === '2d' ? 'These results are from a 2D sweep: their wood counts the two side trusses only, with no ties or bracing, so a design loaded in 3D shows more wood. Re-run the sweep in 3D to compare 3D wood. ' : 'These results are from a 3D sweep (wood includes ties and bracing). Re-run the sweep to compare in 2D. ') : el.dataset.txt;
  });
  if (!stale || sweepBusy || !S.autoRerun) return;
  const n = sweepProblems().length ? Infinity : sweepDims().total;
  if (n > S.autoLimit) return;
  clearTimeout(autoTimer); autoTimer = setTimeout(() => { if (!sweepBusy) $('runSweep').click(); }, 700);
}
$('autoRerun').checked = S.autoRerun; $('autoLimit').value = S.autoLimit;
$('autoRerun').addEventListener('change', () => { S.autoRerun = $('autoRerun').checked; save(); checkStale(); });
$('autoLimit').addEventListener('change', () => { const v = Math.round(+$('autoLimit').value); if (v > 0) { S.autoLimit = v; save(); checkStale(); } });
document.querySelectorAll('.staleRun').forEach(b => b.addEventListener('click', () => $('runSweep').click()));
function makeRow(c, t2, r2) {
  return Object.assign({}, c, { swOv: c.overlap != null, overlap: t2.overlap, supportOffset: t2.info.supportOffset, edgeOK: r2.edgeOK, overall: t2.overall, bottom: t2.info.shape, members: t2.elems.length, wood: r2.wood, mass: r2.massTotal, D: r2.midDefl, util: r2.maxUtil,
    capKg: r2.capKg, side: t2.info.sideAngleActual, passes: r2.passes, slipOK: !(r2.slips && r2.slips.length), envOK: r2.envelope.length === 0, topShape: t2.info.topShape, topEnd: t2.info.topEnd, botEnd: t2.info.botEnd });
}
function countWhy(why, r2) {
  if (r2.edgeOK === false) why.edge++;
  if (r2.envelope.length) why.env++;
  if (r2.midDefl > S.opts.deflLimit) why.defl++;
  if (r2.maxUtil > 1) why.strength++;
}
function whyText(why, nStable) {
  const fails = [['overlap under the minimum', why.edge], ['deflection over the limit', why.defl], ['a member over its strength limit', why.strength], ['outside the envelope', why.env]].sort((x, y) => y[1] - x[1]);
  return (fails[0][1] > 0 ? ` Most common: ${fails[0][0]} (${fails[0][1].toLocaleString()} designs).` : '') + (nStable && why.edge === nStable ? overlapWarning() : '') +
    ` Breakdown (a design can fail several): overlap ${why.edge.toLocaleString()}, deflection ${why.defl.toLocaleString()}, strength ${why.strength.toLocaleString()}, envelope ${why.env.toLocaleString()}.`;
}
let sweepMode = 'none';
$('runSweep').addEventListener('click', () => {
  if (sweepBusy) return;
  const pr = sweepProblems();
  if (pr.length) { $('sweepMsg').textContent = `Step is 0 for ${pr.join(', ')}. Set a step above 0, or make from and to equal. Nothing was run.`; updateSweepCount(); return; }
  const tot = sweepDims().total;   // check the size before building the list (billions would not fit)
  if (tot > 60000) { $('sweepMsg').textContent = `${tot.toLocaleString()} designs is too many for a normal sweep (limit 60,000). Use "Large search" below, or narrow the ranges.`; return; }
  const list = sweepList();
  if (!list.length) { $('sweepMsg').textContent = 'Pick at least one panel count and pattern.'; return; }
  if (list.length > 60000) { $('sweepMsg').textContent = `${list.length.toLocaleString()} designs is too many for a normal sweep (limit 60,000). Use "Large search" below, or narrow the ranges.`; return; }
  sweepBusy = true; $('runSweep').disabled = true;
  const sigAtStart = sweepSig();
  const all = []; let i = 0, unstable = 0;
  const why = { edge: 0, env: 0, defl: 0, strength: 0 };   // why stable designs fail (one design can fail several)
  sweepCtx = { bookKg: S.load.mBook1 + S.load.mBook2, FS: S.mat.FS, defl: S.opts.deflLimit, minOv: +S.opts.minOverlap, sheet: sheetFor(sweepDims(), list.length, 'Sweep') };
  const step = () => { try { stepBody(); } catch (e) { searchFailed(e, `in the sweep at design ${i.toLocaleString()}`); } };
  const stepBody = () => {
    const end = Math.min(list.length, i + 250);
    for (; i < end; i++) {
      const c = list[i];
      const { t2, r2 } = evalCandidate(c);
      if (!r2.stable) { unstable++; continue; }
      countWhy(why, r2);
      all.push(makeRow(c, t2, r2));
    }
    $('sweepBar').style.width = (100 * i / list.length).toFixed(1) + '%';
    if (i < list.length) { setTimeout(step, 0); return; }
    sweepAll = all;
    const passing = all.filter(r => r.passes).sort((a, b) => a.wood - b.wood || a.util - b.util);
    sweepRows = passing.slice(0, 30);
    $('sweepMsg').textContent = `${passing.length.toLocaleString()} of ${list.length.toLocaleString()} pass · ${(all.length - passing.length).toLocaleString()} fail a check · ${unstable.toLocaleString()} unstable. ${passing.length ? `Showing the ${sweepRows.length} that use the least wood. The Wood vs load charts below now use these designs.` : 'No design passes every check.'}${whyText(why, all.length)}`;
    lastSig = sigAtStart; sweepMode = 'sweep'; paintBigMode();
    renderSweep(); drawTrackers(); sweepBusy = false; $('runSweep').disabled = false; checkStale();
  };
  $('sweepMsg').textContent = 'Running…'; $('sweepBar').style.width = '0';
  setTimeout(step, 0);
});
// ---------- large search: a low-fidelity pilot you can audit, then the full run in the background
const big = { pilot: null, running: false, cancel: false, result: null };
S.bigCap = +S.bigCap || 20000;
S.bigHours = Math.max(0, +S.bigHours || 0);
// a run with a time limit tests as many random designs as fit in the time (up to a billion), then stops and keeps them
const RUN_MAX_TIMED = 1000000000;
function plannedN(P, msPer) { return S.bigHours > 0 ? Math.min(P.total, RUN_MAX_TIMED, Math.ceil(S.bigHours * 3.6e6 / Math.max(1e-3, msPer) * 1.5)) : Math.min(P.total, S.bigCap, 100000000); }
$('bigCap').value = S.bigCap;
$('bigCap').addEventListener('change', () => { const v = Math.round(+$('bigCap').value); if (v >= 1000) { S.bigCap = v; save(); } else $('bigCap').value = S.bigCap; });
function fmtTime(ms) { const s = ms / 1000; return s < 90 ? `about ${Math.max(1, Math.round(s))} s` : s < 5400 ? `about ${Math.round(s / 60)} min` : `about ${(s / 3600).toFixed(1)} h`; }
function setBigButtons() { $('bigSearch').disabled = big.running; $('runSweep').disabled = big.running || sweepBusy; $('bigCancel').hidden = !big.running; }
function paintBigMode() { $('pilotBanner').hidden = sweepMode !== 'pilot'; $('bigBox').hidden = !(sweepMode === 'pilot' && big.pilot); }
// run body(0..n-1) in slices of about 30 ms so the page stays usable
function searchFailed(e, where) {
  console.error(e);
  big.running = false; sweepBusy = false; big.cancel = false; setBigButtons(); $('runSweep').disabled = false;
  $('bigMsg').textContent = `The search stopped on an error ${where} (${e && e.message ? e.message : e}). Nothing is stuck now: run it again. If it happens again, tell Claude this message.`;
  toast('The search stopped on an error. It is reset, so you can run it again.', true);
}
const tickCh = new MessageChannel(); let tickFn = null; tickCh.port1.onmessage = () => { const f = tickFn; tickFn = null; if (f) f(); };
function nextTick(f) { tickFn = f; tickCh.port2.postMessage(0); }   // message tasks are not slowed the way timers are in a hidden tab
let wakeLock = null;
async function holdAwake(on) { try { if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; } } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (!document.hidden && big.running) holdAwake(true); });
function runChunks(n, body, progress, done, start) {
  let i = start || 0; const t0 = performance.now(); big.lastTick = performance.now(); big.tickGen = (big.tickGen || 0) + 1; const gen = big.tickGen;
  const tick = () => {
    if (gen !== big.tickGen) return;   // a newer search replaced this one
    const until = performance.now() + 30;
    try {
      while (i < n && !big.cancel && performance.now() < until) body(i++);
      if (big.hrs > 0 && !big.cancel && big.msBefore + performance.now() - t0 >= big.hrs * 3.6e6) { big.timeUp = true; big.cancel = true; }
      progress(i, performance.now() - t0);
    } catch (e) { searchFailed(e, `at design ${i.toLocaleString()} of ${n.toLocaleString()}`); return; }
    big.lastTick = performance.now();
    if (i < n && !big.cancel) nextTick(tick); else { try { done(i, performance.now() - t0); } catch (e) { searchFailed(e, 'while finishing'); } }
  };
  setTimeout(tick, 0);
}
function sampleIdx(total, n, Dm) {   // n distinct design numbers out of total
  if (n >= total) return null;   // null = every design, in order
  if (total > Number.MAX_SAFE_INTEGER) return walkBig(Dm.totalBig, ...bigStep(Dm.totalBig));
  const gcd = (x, y) => { while (y) [x, y] = [y, x % y]; return x; };
  // (no bitwise ops here: they cut numbers to 32 bits, which broke spaces of more than 2 billion designs)
  let m = Math.floor(total * (0.3 + 0.4 * Math.random())); if (m % 2 === 0) m++; while (gcd(m, total) !== 1) m++;
  const b = Math.floor(Math.random() * total);
  return walkFn(total, m, b);
}
// (m * i + b) mod total without losing digits: m * i can pass 2^53 when the design space is in the billions.
// Splitting i into 16-bit halves is exact only while m * 65536 < 2^53, i.e. total <= 2^37 (about 137 billion).
// Past that, mulmodX doubles-and-adds with every step kept below total (<= 2^53), so nothing is ever rounded (TE-063).
const WALK_SPLIT_MAX = 2 ** 37;
function mulmod(m, i, total) { const hi = Math.floor(i / 65536), lo = i % 65536; return ((m * hi) % total * 65536 + m * lo) % total; }
function addmod(x, y, T) { return x >= T - y ? x - (T - y) : x + y; }   // (x + y) mod T for x, y < T, never above T
function mulmodX(m, i, T) { let r = 0, a = m % T, k = i; while (k > 0) { if (k % 2 === 1) r = addmod(r, a, T); a = addmod(a, a, T); k = Math.floor(k / 2); } return r; }
// the same scrambled walk with exact BigInt maths, for spaces past 2^53 designs (plain numbers there are all even,
// so the old "find an odd step" loop never ended and froze the page)
function bigStep(T) {
  const r = () => BigInt(Math.floor(Math.random() * 1e9));
  const gcd = (x, y) => { while (y) [x, y] = [y, x % y]; return x; };
  let m = T * (300000000n + r() * 4n / 10n) / 1000000000n; if (m % 2n === 0n) m++; while (gcd(m, T) !== 1n) m++;
  return [m, T * r() / 1000000000n];
}
function walkBig(T, m, b) { const f = i => (m * BigInt(i) + b) % T; f.m = m; f.b = b; f.T = T; return f; }
// a scrambled walk that visits each design at most once. legacy = the v58 walk, kept only so a checkpoint
// saved by v58 resumes on the walk it started (it is biased past 2^37 designs; see TE-063).
function walkFn(total, m, b, legacy) {
  const f = legacy || total <= WALK_SPLIT_MAX ? (i => (mulmod(m, i, total) + b) % total) : (i => addmod(mulmodX(m, i, total), b, total));
  f.m = m; f.b = b; f.wv = 2; return f;
}
// automatic checks on one solved design: overall equilibrium, equilibrium at every joint, and mirror symmetry
function auditDesign(t2, r2) {
  const P = r2.Ptruss || 1, nd = t2.nodes.length, rs = new Float64Array(2 * nd);
  r2.Fval.forEach(([n, dof, v]) => { rs[2 * n + dof - 1] += v; });
  let sumRy = 0, sumRx = 0, sumLy = 0;
  r2.Fval.forEach(f => { sumLy += f[2]; });
  r2.activeSupports.forEach(q => { rs[2 * q.node] += q.Rx || 0; rs[2 * q.node + 1] += q.Ry || 0; sumRy += q.Ry || 0; sumRx += q.Rx || 0; });
  r2.members.forEach(m => {
    const pa = t2.nodes[m.i], pb = t2.nodes[m.j], L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    const ux = (pb[0] - pa[0]) / L, uy = (pb[1] - pa[1]) / L;   // tension pulls joint i toward j
    rs[2 * m.i] += m.F * ux; rs[2 * m.i + 1] += m.F * uy; rs[2 * m.j] -= m.F * ux; rs[2 * m.j + 1] -= m.F * uy;
  });
  let joint = 0; for (let k = 0; k < rs.length; k++) joint = Math.max(joint, Math.abs(rs[k]));
  let sym = null;
  if (!t2.design.loads && !t2.design.brace) { sym = 0; r2.members.forEach((m, k) => { const e = t2.elems[k]; if (e.mirror >= 0) sym = Math.max(sym, Math.abs(m.F - r2.members[e.mirror].F)); }); sym /= P; }
  return { eq: Math.max(Math.abs(sumRy + sumLy), Math.abs(sumRx)) / P, joint: joint / P, sym };
}
const AUDIT_TOL = 1e-6;
$('bigSearch').addEventListener('click', () => {
  if (sweepBusy || big.running) return;
  const pr = sweepProblems();
  if (pr.length) { $('bigMsg').textContent = `Step is 0 for ${pr.join(', ')}. Set a step above 0 first.`; return; }
  const Dm = sweepDims();
  if (!Dm.total) { $('bigMsg').textContent = 'Pick at least one panel count and pattern.'; return; }
  const n = Math.min(1000, Dm.total), pick = sampleIdx(Dm.total, n, Dm);
  const sheet0 = sheetFor(Dm, n, S.anaMode === '3d' ? 'Pilot (2D, then 3D)' : 'Pilot');
  big.running = true; big.cancel = false; sweepBusy = true; setBigButtons(); big.hrs = 0; big.timeUp = false;
  const sig = sweepSig();
  sweepCtx = { bookKg: S.load.mBook1 + S.load.mBook2, FS: S.mat.FS, defl: S.opts.deflLimit, minOv: +S.opts.minOverlap, sheet: sheet0 };
  const rows = [], why = { edge: 0, env: 0, defl: 0, strength: 0 };
  const au = { n: 0, eqBad: 0, jointBad: 0, symN: 0, symBad: 0, worstEq: 0, worstJoint: 0, worstSym: 0, nan: 0 };
  let unstable = 0;
  const is3 = S.anaMode === '3d', st = is3 ? { ids: [], r2d: [], ms3: 0, both: 0, onlyIn2D: 0, onlyIn3D: 0, neither: 0, screenMiss: 0, screened: 0, unst3: 0, eqWorst: 0 } : null;
  runChunks(n, k => {
    const c = candAt(Dm, pick ? pick(k) : k);
    const { t2, r2 } = evalCandidate(c, '2d');
    if (is3) st.ids.push([c, t2, r2]);
    if (!r2.stable) { unstable++; return; }
    countWhy(why, r2);
    const row = makeRow(c, t2, r2); rows.push(row);
    if (!Number.isFinite(row.wood) || !Number.isFinite(row.D) || Number.isNaN(row.capKg)) au.nan++;
    const ck = auditDesign(t2, r2); au.n++;
    au.worstEq = Math.max(au.worstEq, ck.eq); au.worstJoint = Math.max(au.worstJoint, ck.joint);
    if (ck.eq > AUDIT_TOL) au.eqBad++; if (ck.joint > AUDIT_TOL) au.jointBad++;
    if (ck.sym !== null) { au.symN++; au.worstSym = Math.max(au.worstSym, ck.sym); if (ck.sym > AUDIT_TOL) au.symBad++; }
  }, i => { $('sweepBar').style.width = (100 * i / n).toFixed(1) + '%'; $('bigMsg').textContent = `Pilot: ${i.toLocaleString()} of ${n.toLocaleString()} designs…`; },
  (done, ms) => {
    if (is3 && !big.cancel) { pilot3D(Dm, done, ms, rows, why, unstable, au, sig, st); return; }
    big.running = false; sweepBusy = false;
    if (big.cancel) { $('bigMsg').textContent = 'Pilot cancelled.'; setBigButtons(); return; }
    big.pilot = { Dm, total: Dm.total, n: done, msPer: ms / Math.max(1, done), rows, why, unstable, au, sig };
    sweepAll = rows; sweepRows = rows.filter(r => r.passes).sort((x, y) => x.wood - y.wood || x.util - y.util).slice(0, 30);
    lastSig = sig; sweepMode = 'pilot';
    $('bigMsg').textContent = ''; renderPilot(); renderSweep(); drawTrackers(); paintBigMode(); setBigButtons(); checkStale();
  });
});
// stage 2 of a 3D pilot: the same designs solved in 3D, compared with their 2D results
function pilot3D(Dm, n, ms2, rows2, why2, unstable2, au, sig, st) {
  const rows = [], why = { edge: 0, env: 0, defl: 0, strength: 0 }; let unstable = 0;
  runChunks(st.ids.length, k => {
    const [c, t2, r2d] = st.ids[k];
    const t0 = performance.now();
    const r = r2d.stable ? upgrade3D(c, t2, r2d) : r2d;
    st.ms3 += performance.now() - t0;
    if (r.mode3) { const q = r.mode3.r3; st.eqWorst = Math.max(st.eqWorst, Math.abs(q.sumZ - q.P) / q.P); }
    const p2 = r2d.stable && r2d.passes, p3 = r.stable && r.passes;
    if (p2 && p3) st.both++; else if (p2) st.onlyIn2D++; else if (p3) st.onlyIn3D++; else st.neither++;
    if (r2d.stable && !r.stable) st.unst3++;
    if (clearly2DFail(r2d)) { st.screened++; if (p3) st.screenMiss++; }
    if (!r.stable) { unstable++; return; }
    countWhy(why, r); rows.push(makeRow(c, t2, r));
  }, i => { $('sweepBar').style.width = (100 * i / st.ids.length).toFixed(1) + '%'; $('bigMsg').textContent = `Pilot, stage 2 of 2 (3D): ${i.toLocaleString()} of ${st.ids.length.toLocaleString()} designs…`; },
  (done) => {
    big.running = false; sweepBusy = false;
    if (big.cancel) { $('bigMsg').textContent = 'Pilot cancelled.'; setBigButtons(); return; }
    const ms2per = ms2 / Math.max(1, n), ms3per = st.ms3 / Math.max(1, done);
    big.pilot = { Dm, total: Dm.total, n: done, msPer: ms2per + ms3per, ms2per, ms3per, rows, why, unstable, au, sig, st, rows2d: rows2, unstable2 };
    sweepAll = rows; sweepRows = rows.filter(r => r.passes).sort((x, y) => x.wood - y.wood || x.util - y.util).slice(0, 30);
    lastSig = sig; sweepMode = 'pilot';
    $('bigMsg').textContent = ''; renderPilot(); renderSweep(); drawTrackers(); paintBigMode(); setBigButtons(); checkStale();
  });
}
// one line for the folded pilot box: pass count, whether every audit check held, and the speed
function pilotOneLine(P) {
  const pass = P.rows.filter(r => r.passes).length, au = P.au;
  const bad = au.eqBad + au.jointBad + au.symBad + au.nan + (P.st && P.st.eqWorst >= 1e-6 ? 1 : 0);
  return `<b>${pass.toLocaleString()} of ${P.n.toLocaleString()} pass</b> · ${bad ? `<b style="color:var(--bad)">${bad} audit check${bad > 1 ? 's' : ''} failed</b>` : '<b style="color:var(--ok)">all audit checks pass</b>'} · ${P.msPer.toFixed(2)} ms per design${P.st && P.st.screenMiss ? ` · <b style="color:var(--bad)">pre-screen would miss ${P.st.screenMiss}</b>` : ''}.`;
}
function renderPilot() {
  const P = big.pilot; if (!P) return;
  const st = P.rows, pass = st.filter(r => r.passes).length;
  const rng = (f, dp) => { const v = st.map(f).filter(Number.isFinite); return v.length ? `${Math.min(...v).toFixed(dp)} to ${Math.max(...v).toFixed(dp)}` : '—'; };
  const ok = (bad, n) => bad === 0 ? `<b style="color:var(--ok)">all ${n.toLocaleString()} pass</b>` : `<b style="color:var(--bad)">${bad.toLocaleString()} of ${n.toLocaleString()} fail</b>`;
  const n = plannedN(P, P.msPer);
  $('bigBox').innerHTML = `<h3 style="margin:0 0 6px">Pilot audit (low fidelity)</h3>
    <p style="margin:0 0 8px">${P.n.toLocaleString()} random designs out of the ${P.total.toLocaleString()} in your ranges (${(100 * P.n / P.total).toFixed(P.n === P.total ? 0 : 2)}%). ${pass.toLocaleString()} pass · ${(st.length - pass).toLocaleString()} fail a check · ${P.unstable.toLocaleString()} unstable.${whyText(P.why, st.length)}</p>
    <p class="ndata" style="margin:0 0 8px">${pilotOneLine(P)} <span class="note">The full audit is under "Show data and notes".</span></p>
    <table class="tdata"><tbody>
      <tr><td>Wood, stable designs</td><td>${rng(r => r.wood, 0)} mm</td></tr>
      <tr><td>Capacity</td><td>${rng(r => r.capKg, 1)} kg</td></tr>
      <tr><td>Mid-span deflection</td><td>${rng(r => r.D, 3)} mm</td></tr>
      <tr><td>Overall equilibrium (reactions balance the load)</td><td>${ok(P.au.eqBad, P.au.n)} · worst ${P.au.worstEq.toExponential(1)} of the load</td></tr>
      <tr><td>Equilibrium at every joint (method of joints)</td><td>${ok(P.au.jointBad, P.au.n)} · worst ${P.au.worstJoint.toExponential(1)} of the load</td></tr>
      <tr><td>Mirror symmetry (book load, no braces)</td><td>${P.au.symN ? ok(P.au.symBad, P.au.symN) + ` · worst ${P.au.worstSym.toExponential(1)}` : 'not checked: custom loads or braces make the bridge unsymmetric'}</td></tr>
      <tr><td>Invalid numbers (NaN, infinite wood or deflection)</td><td>${P.au.nan ? `<b style="color:var(--bad)">${P.au.nan}</b>` : '<b style="color:var(--ok)">none</b>'}</td></tr>
      <tr><td>Speed</td><td>${P.msPer.toFixed(2)} ms per design</td></tr>
    </tbody></table>
    ${P.st ? `<h4 class="tdata" style="margin:10px 0 4px">Stage 2: the same designs in 3D</h4><table class="tdata"><tbody>
      <tr><td>Speed</td><td>2D ${P.ms2per.toFixed(2)} ms · 3D ${P.ms3per.toFixed(2)} ms per design (3D is ${(P.ms3per / Math.max(1e-6, P.ms2per)).toFixed(1)}× slower)</td></tr>
      <tr><td>Pass in both</td><td>${P.st.both.toLocaleString()}</td></tr>
      <tr><td>Pass in 2D but fail in 3D (bracing, sway or the bracing wood)</td><td>${P.st.onlyIn2D.toLocaleString()}${P.st.unst3 ? ` · ${P.st.unst3} unstable in 3D: add bracing` : ''}</td></tr>
      <tr><td>Fail in 2D but pass in 3D</td><td>${P.st.onlyIn3D.toLocaleString()}</td></tr>
      <tr><td>3D vertical equilibrium (reactions balance the load)</td><td>${P.st.eqWorst < 1e-6 ? '<b style="color:var(--ok)">all balance</b>' : `<b style="color:var(--bad)">worst ${P.st.eqWorst.toExponential(1)} of the load</b>`}</td></tr>
      <tr><td>2D pre-screen (skip 3D when 2D fails clearly: over ${Math.round((SCREEN_UTIL - 1) * 100)}% over strength, envelope, overlap or slip)</td><td>would skip ${P.st.screened.toLocaleString()} of ${P.n.toLocaleString()} · <b style="color:${P.st.screenMiss ? 'var(--bad)' : 'var(--ok)'}">${P.st.screenMiss ? P.st.screenMiss + ' of those pass in 3D, so the pre-screen would lose them' : 'none of those pass in 3D, so it looks safe'}</b></td></tr>
    </tbody></table>` : ''}
    <p style="margin:8px 0">The chart below shows only this pilot. If the numbers look right, the full search will test ${n.toLocaleString()} designs${P.total > S.bigCap ? ` (a random ${n.toLocaleString()} of the ${P.total.toLocaleString()}, because "Max designs per run" is ${S.bigCap.toLocaleString()})` : ''}, ${fmtTime(n * P.msPer)}.</p>
    <div class="btns"><button type="button" class="btn acc sm" id="bigFull">Looks right: run the full search…</button><button type="button" class="btn ghost sm" id="bigDiscard">Discard pilot</button></div>`;
  $('bigFull').addEventListener('click', openBigModal);
  $('bigDiscard').addEventListener('click', () => { big.pilot = null; sweepMode = 'none'; paintBigMode(); });
}
function openBigModal() {
  const P = big.pilot; if (!P) return;
  if (sweepSig() !== P.sig) { $('bigMsg').textContent = 'Inputs changed since the pilot. Run a new pilot first.'; return; }
  const n = plannedN(P, P.msPer);
  const pre = P.st ? (n * (P.ms2per + (1 - P.st.screened / Math.max(1, P.n)) * P.ms3per)) : 0;
  $('bigModalText').innerHTML = (P.st ? `<b>3D search.</b> <label class="check"><input type="radio" name="bigHow" value="full" ${big.prescreen ? '' : 'checked'}> Solve every design in 3D (${fmtTime(n * P.msPer)})</label>
    <label class="check"><input type="radio" name="bigHow" value="pre" ${big.prescreen ? 'checked' : ''}> 2D pre-screen, low fidelity: skip the 3D solve for designs that already fail clearly in 2D (${fmtTime(pre)}${P.st.screenMiss ? `; the pilot found ${P.st.screenMiss} design${P.st.screenMiss > 1 ? 's' : ''} it would wrongly skip` : '; in the pilot it skipped nothing that passes in 3D'})</label><br>` : '') + `${S.bigHours > 0 ? `This tests random designs from the ${P.total.toLocaleString()} in your ranges until the time limit.` : `This tests <b>${n.toLocaleString()}</b> designs${P.total > S.bigCap ? `, a random selection of the ${P.total.toLocaleString()} in your ranges. To test more, raise "Max designs per run" or set a time limit below` : ''}.`}<br><br>
    <label class="note" style="display:block;margin:6px 0">Time limit <input type="number" id="bigHrs" min="0" max="72" step="0.5" value="${S.bigHours}" style="width:70px;display:inline-block"> hours
      <span class="hint" style="margin:0;display:block">0 = no limit (uses "Max designs per run", ${S.bigCap.toLocaleString()}). With a limit, the run tests random designs until the time is up, then keeps what it found (about ${Math.round(3.6e6 / Math.max(1e-3, P.msPer)).toLocaleString()} designs per hour here). For an overnight run: keep this tab open and visible, the computer plugged in and set not to sleep.</span></label>
    ${S.bigHours > 0 ? `Runs for <b>${S.bigHours} h</b>, about ${Math.min(n, Math.round(S.bigHours * 3.6e6 / Math.max(1e-3, P.msPer))).toLocaleString()} designs (${(100 * Math.min(n, S.bigHours * 3.6e6 / Math.max(1e-3, P.msPer)) / P.total).toPrecision(2)}% of the ${P.total.toLocaleString()}).` : ''}
    Estimated time: <b>${S.bigHours > 0 ? S.bigHours + ' h (time limit)' : fmtTime(n * P.msPer)}</b> on this computer, based on the pilot. The page stays usable while it runs, there is a progress bar, and Cancel keeps the results so far.<br><br>
    The results are saved in this browser, so you can reload them later with "Load last large search".`;
  $('bigModal').hidden = false; $('bigGo').focus();
  $('bigHrs').addEventListener('change', () => { const v = +$('bigHrs').value; S.bigHours = v >= 0 && v <= 72 ? v : 0; save(); openBigModal(); });
}
$('bigNo').addEventListener('click', () => { $('bigModal').hidden = true; });
$('bigModal').addEventListener('keydown', ev => { if (ev.key === 'Escape') $('bigModal').hidden = true; });
$('bigGo').addEventListener('click', () => { const r = document.querySelector('input[name="bigHow"]:checked'); big.prescreen = !!(r && r.value === 'pre'); $('bigModal').hidden = true; runFull(); });
$('bigCancel').addEventListener('click', () => {
  big.cancel = true;
  // if nothing has moved for a few seconds the search is not coming back: free everything now
  setTimeout(() => { if (big.running && performance.now() - (big.lastTick || 0) > 3000) { big.tickGen = (big.tickGen || 0) + 1; big.running = false; sweepBusy = false; big.cancel = false; setBigButtons(); $('runSweep').disabled = false; $('bigMsg').textContent = 'Search cancelled and reset.'; } }, 600);
});
const GROUP_DIMS = [...CHOICES.map(ch => 'c_' + ch.key), 'tilt3', 'width3', 'ties3', 'brace3', 'overlap', 'curve', 'height', 'panels', 'pattern', 'supportOffset', 'sideAngle', 'ratio', 'claw', 'brace', 'loadShape', 'loadX', 'bookKg', 'topEnd', 'botEnd'];
function frontPos(pos, woodA, yA) {
  const s = pos.slice().sort((p, q) => woodA[p] - woodA[q] || yA[q] - yA[p]);
  const out = []; let best = -Infinity;
  for (const p of s) { const y = yA[p]; if (Number.isFinite(y) && y > best + 1e-9) { out.push(p); best = y; } }
  return out;
}
function runFull(ck) {
  const P = ck ? { Dm: sweepDims(), total: ck.total, sig: ck.sig } : big.pilot; if (!P || big.running || sweepBusy) return;
  // big runs go in batches of BATCH designs: each batch keeps only its best-trade designs, then its memory is reused.
  // The best-trade lines of the whole run are the best of every batch's, so they stay exact.
  const BATCH = window.__batch || 2000000, RUN_MAX = 100000000;
  big.hrs = ck ? (ck.hrs || 0) : S.bigHours; big.timeUp = false;
  const Dm = P.Dm, n = ck ? ck.n : (big.hrs > 0 ? plannedN(P, P.msPer) : Math.min(P.total, S.bigCap, RUN_MAX)), pick = ck ? (ck.m != null ? (typeof ck.m === 'bigint' ? walkBig(ck.T, ck.m, ck.b) : walkFn(ck.total, ck.m, ck.b, !ck.wv)) : null) : sampleIdx(P.total, n, Dm);
  if (!ck && !(big.hrs > 0) && Math.min(P.total, S.bigCap) > RUN_MAX) toast(`One run is limited to ${RUN_MAX.toLocaleString()} designs, so this run samples ${RUN_MAX.toLocaleString()} of them.`);
  big.running = true; big.cancel = false; sweepBusy = true; setBigButtons();
  const sig = P.sig, B = Math.min(n, BATCH);
  const pre = ck ? !!ck.pre : (S.anaMode === '3d' && !!big.prescreen);
  sweepCtx = ck ? ck.ctx : { bookKg: S.load.mBook1 + S.load.mBook2, FS: S.mat.FS, defl: S.opts.deflLimit, minOv: +S.opts.minOverlap, sheet: sheetFor(Dm, n, pre ? 'Large search (3D, 2D pre-screen)' : S.anaMode === '3d' ? 'Large search (3D)' : 'Large search') };
  let idxA, woodA, capA, combA, flag;
  try { idxA = new Float64Array(B); woodA = new Float32Array(B); capA = new Float32Array(B); combA = new Float32Array(B); flag = new Uint8Array(B); }
  catch (e) { searchFailed(e, `setting up ${B.toLocaleString()} designs (not enough memory)`); return; }
  const RES = 15000; let sample = [], seen = 0, unstable = 0, passN = 0, screened = 0;
  let why = { edge: 0, env: 0, defl: 0, strength: 0 };
  let top = [], start = 0, msBefore = 0, bStart = 0;
  const kept = new Map();   // best-trade designs found so far, from finished batches
  holdAwake(true);
  big.msBefore = ck ? (ck.ms || 0) : 0;
  // idxA holds walk positions; a checkpoint from before this change holds design numbers for its open batch
  let oldIds = !!(ck && !ck.kpos);
  const idAt = v => oldIds ? v : (pick ? pick(v) : v);
  if (ck) {   // carry on from the last checkpoint
    idxA.set(ck.idxA); woodA.set(ck.woodA); capA.set(ck.capA); combA.set(ck.combA); flag.set(ck.flag);
    ({ sample, seen, unstable, passN, why, top } = ck); screened = ck.screened || 0; start = ck.k; msBefore = ck.ms || 0; bStart = ck.bStart || 0;
    (ck.kept || []).forEach(r => kept.set(r.idx, r));
  }
  const dimLen = name => { const d = Dm.dims.find(q => q[0] === name); return d ? d[1].length : 1; };
  const varies = g => ['pattern', 'sideAngle'].includes(g) ? dimLen('pv') > 1 : ['loadShape', 'loadX'].includes(g) ? dimLen('lx') > 1 : dimLen(g) > 1;
  const groupDims = GROUP_DIMS.filter(varies);
  const keyOf = (c, g) => g === 'overlap' ? (c.overlap == null ? null : Math.round(c.overlap)) : g === 'supportOffset' ? Math.round(c.supportOffset) : c[g];
  // keep the best-trade designs of positions 0..count-1 of the current batch
  const flushBatch = count => {
    const pos = []; for (let k = 0; k < count; k++) if (flag[k] & 4) pos.push(k);
    const keep = new Set(frontPos(pos, woodA, capA)); frontPos(pos, woodA, combA).forEach(q => keep.add(q));
    groupDims.forEach(g => {
      const m = new Map();
      for (const q of pos) { const key = keyOf(candAt(Dm, idAt(idxA[q])), g); if (!m.has(key)) m.set(key, []); m.get(key).push(q); }
      if (m.size < 2) return;
      m.forEach(list => { frontPos(list, woodA, capA).forEach(q => keep.add(q)); frontPos(list, woodA, combA).forEach(q => keep.add(q)); });
    });
    keep.forEach(q => { const id = idAt(idxA[q]), key = typeof id === 'bigint' ? id.toString() : id; if (kept.has(key)) return; const c = candAt(Dm, id); const { t2, r2 } = evalCandidate(c); kept.set(key, makeRow(c, t2, r2)); });
    flag.fill(0); oldIds = false;
  };
  const eta = (i, ms) => i > start ? fmtTime((n - i) * ms / (i - start)) : '';
  let lastCk = performance.now();
  const checkpoint = (i, ms) => {
    lastCk = performance.now(); const L = i - bStart;
    idbPut('ckpt', { ver: APP_VER, wv: 2, when: new Date().toISOString(), sig, total: P.total, n, m: pick ? pick.m : null, b: pick ? pick.b : null, T: pick && pick.T ? pick.T : null, kpos: !oldIds, hrs: big.hrs, k: i, bStart, ms: msBefore + ms, ctx: sweepCtx,
      idxA: idxA.slice(0, L), woodA: woodA.slice(0, L), capA: capA.slice(0, L), combA: combA.slice(0, L), flag: flag.slice(0, L), kept: [...kept.values()], sample, seen, unstable, passN, why, top, pre, screened }).catch(() => {});
  };
  const nb = Math.ceil(n / B);
  runChunks(n, k => {
    if (k - bStart >= B) { flushBatch(B); bStart = k; }
    const li = k - bStart;
    const id = pick ? pick(k) : k, c = candAt(Dm, id);
    idxA[li] = k;
    let t2, r2;
    if (pre) { const e = evalCandidate(c, '2d'); t2 = e.t2; if (clearly2DFail(e.r2)) { screened++; return; } r2 = upgrade3D(c, t2, e.r2); }
    else ({ t2, r2 } = evalCandidate(c));
    if (!r2.stable) { unstable++; return; }
    countWhy(why, r2);
    const row = makeRow(c, t2, r2);
    woodA[li] = row.wood; capA[li] = row.capKg; combA[li] = combined(row);
    flag[li] = 1 | (row.passes ? 2 : 0) | (frontOK(row) ? 4 : 0);
    if (row.passes) { passN++; if (top.length < 30 || row.wood < top[top.length - 1].wood) { top.push(row); top.sort((x, y) => x.wood - y.wood || x.util - y.util); if (top.length > 30) top.pop(); } }
    seen++;   // reservoir sample of the stable designs, for the grey cloud
    if (sample.length < RES) sample.push(row); else { const j = Math.floor(Math.random() * seen); if (j < RES) sample[j] = row; }
  }, (i, ms) => { $('sweepBar').style.width = (100 * i / n).toFixed(1) + '%'; $('bigMsg').textContent = `Full search: ${i.toLocaleString()} of ${n.toLocaleString()} designs${nb > 1 ? ` (batch ${Math.min(nb, Math.floor(i / B) + 1)} of ${nb})` : ''} · ${passN.toLocaleString()} pass so far · ${eta(i, ms)} left · progress saved, so a reload can resume`; if (performance.now() - lastCk > 6000 && i < n) checkpoint(i, ms); },
  (done, ms) => {
    ms += msBefore;
    if (big.cancel) idbPut('ckpt', null).catch(() => {});
    holdAwake(false);
    $('bigMsg').textContent = 'Finding the best-trade lines…';
    setTimeout(() => { try {
      flushBatch(done - bStart);
      const rows = new Map(); sample.forEach(r => rows.set(r.idx, r)); top.forEach(r => rows.set(r.idx, r)); kept.forEach((r, id) => { if (!rows.has(id)) rows.set(id, r); });
      sweepAll = [...rows.values()]; sweepRows = top;
      const msg = `${big.timeUp ? `Time limit (${big.hrs} h) reached:` : big.cancel ? 'Cancelled after' : 'Full search:'} ${done.toLocaleString()} designs${pick ? ` (random, out of ${P.total.toLocaleString()})` : ''}${Math.ceil(done / B) > 1 ? ` in ${Math.ceil(done / B)} batches` : ''} in ${fmtTime(ms).replace('about ', '')} · ${passN.toLocaleString()} pass · ${(seen - passN).toLocaleString()} fail a check · ${unstable.toLocaleString()} unstable${pre ? ` · ${screened.toLocaleString()} skipped by the 2D pre-screen (failed clearly in 2D; not on the charts)` : ''}.${whyText(why, seen)} The best-trade lines on the charts are exact; the grey cloud is a random ${Math.min(RES, seen).toLocaleString()} of the stable designs.`;
      $('sweepMsg').textContent = msg; $('bigMsg').textContent = '';
      big.running = false; sweepBusy = false; sweepMode = 'full'; lastSig = sig;
      renderSweep(); drawTrackers(); paintBigMode(); setBigButtons(); checkStale();
      idbPut('last', { when: new Date().toISOString(), msg, rows: sweepAll, top, ctx: sweepCtx, sig }).catch(() => { $('bigMsg').textContent = 'Could not save the results in this browser.'; });
      idbPut('ckpt', null).catch(() => {});
    } catch (e) { searchFailed(e, 'while finding the best-trade lines'); } }, 0);
  }, start);
}
// IndexedDB keeps the last large search (it can be far bigger than the settings storage allows)
function idb() { return new Promise((res, rej) => { try { const r = indexedDB.open('se310-truss', 1); r.onupgradeneeded = () => r.result.createObjectStore('big'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); }
async function idbPut(key, val) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('big', 'readwrite'); tx.objectStore('big').put(val, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbGet(key) { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction('big').objectStore('big').get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
$('bigRestore').addEventListener('click', async () => {
  if (big.running || sweepBusy) return;
  let v = null; try { v = await idbGet('last'); } catch (e) { v = null; }
  if (!v) { $('bigMsg').textContent = 'No large search is saved in this browser yet.'; return; }
  sweepAll = v.rows; sweepRows = v.top; sweepCtx = v.ctx; lastSig = v.sig; sweepMode = 'full';
  $('sweepMsg').textContent = `Loaded the large search from ${new Date(v.when).toLocaleString()}. ${v.msg}`;
  renderSweep(); drawTrackers(); paintBigMode(); checkStale();
});
function loadParams(r) {
  if (r.loadShape && r.loadShape !== 'current') S.loads = loadsFor(r.loadShape, r.loadX);
  if (r.bookKg != null) { const old = S.load.mBook1 + S.load.mBook2, f1 = old > 0 ? S.load.mBook1 / old : 0.6; S.load.mBook1 = +(r.bookKg * f1).toFixed(3); S.load.mBook2 = +(r.bookKg - S.load.mBook1).toFixed(3); }
  const stickRow = Object.keys(r).some(k => /^st_|^fc_/.test(k));
  CHOICES.forEach(ch => { const v = r['c_' + ch.key]; if (v != null) S[ch.key] = choiceVal(ch, v); });
  if (r.c_bottom && r.c_bottom !== 'flat' && !r.curve && !+S.curve) S.curve = -20;
  if (r.tilt3 != null) S.d3.tilt = +r.tilt3; if (r.width3 != null) S.opts.width = +r.width3; if (r.ties3 != null) S.d3.botTies = !!r.ties3;
  if (r.brace3 && r.brace3 !== 'current' && BRACE_SETS[r.brace3]) { const b = BRACE_SETS[r.brace3]; S.d3.topPat = b.top.slice(); S.d3.botPat = b.bot.slice(); S.d3.framePat = b.frame.slice(); }
  Object.assign(S, { family: r.family, panels: r.panels, height: r.height, topEnd: r.topEnd != null ? r.topEnd : S.topEnd, botEnd: r.botEnd != null ? r.botEnd : S.botEnd, ratio: r.ratio, sideAngle: r.sideAngle, sideLean: swOn('A') ? 'in' : S.sideLean,
    curve: r.curve || 0, bottom: r.curve ? (S.bottom === 'flat' ? 'parabola' : S.bottom) : 'flat', supportOffset: r.supportOffset || 0, sticks: {},
    ...(r.swOv ? { deskMode: 'length', overlap: r.overlap } : {}), claw: r.claw || S.claw, brace: r.brace || S.brace,
    pattern: r.family === 'grid' && r.pattern !== 'custom' ? r.pattern : S.pattern, vertPreset: r.vert === 'current' ? S.vertPreset : (r.vert === 'none' ? 'none' : 'all'),
    diagMiddle: (!swOn('P') && r.panels === +S.panels) ? S.diagMiddle : 'X' });
  update();
  if (stickRow) {   // rebuild the member-table stick counts for this design
    const st = {};
    tr.elems.forEach(e => { const n = r['st_' + e.type]; if (n > 1) st[e.key] = { n, bundle: 'row' }; });
    S.focus.forEach((f, i) => { const n = r['fc_' + i]; if (n) [f.key, f.mkey].forEach(k => { if (k) { if (n === 1) delete st[k]; else st[k] = { n, bundle: 'row' }; } }); });
    S.sticks = st; update();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
(function () {
  ['abOpen', 'runSweep', 'bigSearch', 'toggleData2'].forEach(id => $('sweepBtns').appendChild($(id))); paintModes();
  $('sweepSum').addEventListener('click', ev => { if (ev.target.closest('button')) ev.preventDefault(); });   // buttons in the header must not fold the section
  $('bestN').value = String(S.bestN || 5);
  $('bestN').addEventListener('change', () => { S.bestN = +$('bestN').value; save(); renderSweep(); });
  $('bestN').addEventListener('click', ev => ev.stopPropagation());
})();
function renderSweep() {
  const tb = $('sweepTbl');
  const none = sweepAll.length > 0 && !sweepAll.some(r => r.passes);
  $('nonePass').hidden = !none;
  const m = $('sweepMsg'); m.classList.toggle('nonepass', none);
  if (none && !m.querySelector('.np')) m.innerHTML = '<span class="np">NONE PASS.</span> ' + escH(m.textContent);
  if (!sweepRows.length) { tb.innerHTML = sweepAll.length ? '' : '<tbody><tr><td class="l">Run a sweep to list the best designs here.</td></tr></tbody>'; return; }
  let h = `<thead><tr><th>#</th><th class="l">Pattern</th><th>Panels</th><th>Height</th><th>Curve</th><th>Length</th><th>Support (mm)</th><th>Taper</th><th>Side°</th><th class="l">Verticals</th><th>Members</th><th>Wood (mm)</th><th>M (g)</th><th>D (mm)</th><th>Capacity</th><th></th></tr></thead><tbody>`;
  sweepRows.slice(0, S.bestN || 5).forEach((r, k) => {
    h += `<tr><td>${k + 1}</td><td class="l">${PNAME[r.pattern]}</td><td>${r.panels}</td><td>${r.height}</td><td>${r.curve}</td><td>${r.overall.toFixed(0)}</td><td>${(+r.supportOffset).toFixed(0)}</td><td>${(+r.ratio).toFixed(2)}</td><td>${r.side.toFixed(0)}</td><td class="l">${r.vert}</td><td>${r.members}</td><td><b>${r.wood.toFixed(0)}</b></td><td>${r.mass.toFixed(2)}</td><td>${r.D.toFixed(3)}</td><td>${r.capKg.toFixed(1)} kg</td><td><button type="button" class="btn ghost sm" data-k="${k}">Load</button></td></tr>`;
  });
  tb.innerHTML = h + '</tbody>';
  tb.querySelectorAll('button[data-k]').forEach(b => b.addEventListener('click', () => loadParams(sweepRows[+b.dataset.k])));
}

// ---------- trackers
function cssv(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
$('trackTabs').addEventListener('click', ev => {
  if (ev.target.closest('.tdim2')) return;
  const b = ev.target.closest('button[data-t]'); if (!b) return;
  ev.preventDefault(); ev.stopPropagation(); $('s-track').open = true;   // a tab in the header must not fold the section
  S.tab = b.dataset.t === 'trade' && S.tradeDim === 'c3' ? 'c3' : b.dataset.t; save(); paintTabs(); drawTrackers(); if (fsEl === '#trackBody') setFs('#trackBody');
});
document.querySelectorAll('.tdim2').forEach(sg => sg.addEventListener('click', ev => {
  const b = ev.target.closest('[data-v]'); if (!b) return; ev.preventDefault(); ev.stopPropagation(); $('s-track').open = true;
  S.tab = b.dataset.v; S.tradeDim = b.dataset.v; save(); paintTabs(); drawTrackers(); if (fsEl === '#trackBody') setFs('#trackBody');
}));
function paintTabs() {
  document.querySelectorAll('#trackTabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.t === S.tab || (b.dataset.t === 'trade' && S.tab === 'c3'))));
  document.querySelectorAll('#chartDimDock [data-cd]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.cd === (S.tab === 'c3' ? 'c3' : (S.tab === 'trade' ? 'trade' : (S.tradeDim || 'trade'))))));
  document.querySelectorAll('.tdim2').forEach(sg => sg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === (S.tab === 'c3' ? 'c3' : S.tab === 'trade' ? 'trade' : (S.tradeDim || 'trade'))))));
  document.querySelectorAll('#s-track [data-panel]').forEach(p => { p.hidden = p.dataset.panel !== S.tab; });
}
function niceTicks(lo, hi, n) {
  const span = hi - lo || 1, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || mag * 10;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}
function setupCanvas(cv) {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 600, h = cv.clientHeight || 320;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
function axes(ctx, w, h, xr, yr, xl, yl) {
  const P = { l: 58, r: 14, t: 12, b: 40 };
  const X = v => P.l + (v - xr[0]) / (xr[1] - xr[0]) * (w - P.l - P.r);
  const Y = v => h - P.b - (v - yr[0]) / (yr[1] - yr[0]) * (h - P.t - P.b);
  ctx.font = '11px IBM Plex Mono, monospace'; ctx.lineWidth = 1;
  ctx.strokeStyle = cssv('--line'); ctx.fillStyle = cssv('--muted');
  niceTicks(xr[0], xr[1], 6).forEach(v => { const x = X(v); ctx.beginPath(); ctx.moveTo(x, P.t); ctx.lineTo(x, h - P.b); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(String(v), x, h - P.b + 14); });
  niceTicks(yr[0], yr[1], 5).forEach(v => { const y = Y(v); ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(w - P.r, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(String(v), P.l - 6, y + 4); });
  ctx.fillStyle = cssv('--ink'); ctx.textAlign = 'center'; ctx.fillText(xl, P.l + (w - P.l - P.r) / 2, h - 6);
  ctx.save(); ctx.translate(13, P.t + (h - P.t - P.b) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yl, 0, 0); ctx.restore();
  return { X, Y, P };
}
const GLABEL = { ...Object.fromEntries(CHOICES.map(ch => ['c_' + ch.key, k => k == null ? ch.name + ' as set' : ch.opts[k] || k])), ties3: k => k == null ? 'bottom ties as set' : (k ? 'with bottom ties' : 'no bottom ties'), tilt3: k => k == null ? 'tilt as set' : k + '°', width3: k => k == null ? 'width as set' : k + ' mm', brace3: k => k == null ? 'no bracing set (2D)' : ((BRACE_SETS[k] || {}).name || k),
  overlap: v => `overlap ${(+v).toFixed(0)} mm`, curve: v => +v === 0 ? 'flat' : (v < 0 ? `sag ${-v} mm` : `arch ${v} mm`),
  height: v => `h ${v} mm`, panels: v => `${v} panels`, pattern: v => PNAME[v] || v,
  supportOffset: v => `support ${(+v).toFixed(0)} mm back`, sideAngle: v => `side ${v}°`, ratio: v => `taper ${(+v).toFixed(2)}`,
  topEnd: v => `Δh ${v} mm`, botEnd: v => `Δp ${v} mm`, claw: v => v === 'on' ? 'claws' : 'no claws', brace: v => v === 'on' ? 'edge braces' : 'no braces',
  loadShape: v => LOAD_SHAPES[v] || v, loadX: v => v == null || v === 'null' ? 'spread / mid-span' : `load at ${v} mm`, bookKg: v => v == null || v === 'null' ? 'books as set' : `books ${v} kg`,
};
// a design that slips off the table is not a usable result (TE-066); older rows without slipOK count as not slipping
const okRow = r => r.envOK && r.edgeOK !== false && r.slipOK !== false;
// frontier candidates also pass the deflection check (capacity itself is strength only)
const frontOK = r => okRow(r) && (!(r.D > 0) || !sweepCtx || r.D <= sweepCtx.defl);
function gcolor(i) { return cssv('--g' + ((i % 8) + 1)); }
function groupsOf(rows) {
  const g = S.groupBy || 'none';
  if (g === 'none') return [{ label: 'this sweep', rows }];
  const m = new Map();
  rows.forEach(r => { const key = g === 'overlap' || g === 'supportOffset' ? Math.round(r[g]) : r[g]; if (!m.has(key)) m.set(key, []); m.get(key).push(r); });
  return [...m.entries()].sort((a, b) => (typeof a[0] === 'number' ? a[0] - b[0] : String(a[0]).localeCompare(String(b[0]))))
    .map(([k, rr]) => ({ label: (GLABEL[g] || String)(k), rows: rr }));
}
function frontier(rows, yOf) {
  yOf = yOf || (r => r.capKg);
  const s = rows.filter(r => isFinite(yOf(r)) && frontOK(r)).slice().sort((a, b) => a.wood - b.wood || yOf(b) - yOf(a));
  const f = []; let best = -Infinity;
  s.forEach(r => { if (yOf(r) > best + 1e-9) { f.push(r); best = yOf(r); } });
  return f;
}
// load multiple (of the factored design load) a design survives on strength AND deflection
const combined = r => Math.min(r.util > 0 ? 1 / r.util : Infinity, r.D > 0 ? sweepCtx.defl / r.D : Infinity);

// ---------- saved sweeps (kept in this browser only)
const SKEY = 'se310-truss-saved';
let saved = [];
try { saved = JSON.parse(localStorage.getItem(SKEY) || '[]') || []; } catch (e) { saved = []; }
function persistSaved() { try { localStorage.setItem(SKEY, JSON.stringify(saved)); return true; } catch (e) { return false; } }
function renderSaved() {
  const el = $('savedList'); el.innerHTML = '';
  saved.forEach((sv, i) => {
    const wrap = document.createElement('span'); wrap.className = 'chip on'; wrap.style.display = 'inline-flex'; wrap.style.gap = '6px'; wrap.style.alignItems = 'center'; wrap.style.padding = '4px 8px';
    wrap.innerHTML = `<label class="check" style="font-size:12px"><input type="checkbox" ${sv.show !== false ? 'checked' : ''} data-sv="${i}"> <span class="swatch" style="background:${gcolor(i + 3)};opacity:.6"></span>${sv.name}</label><span class="note" style="font-size:11px">FS ${sv.FS} · ${sv.bookKg.toFixed(2)} kg</span><button type="button" class="btn ghost sm" data-del="${i}" aria-label="Delete saved sweep ${sv.name}" style="padding:0 6px">×</button>`;
    el.appendChild(wrap);
  });
  el.querySelectorAll('input[data-sv]').forEach(c => c.addEventListener('change', () => { saved[+c.dataset.sv].show = c.checked; persistSaved(); drawTrackers(); }));
  el.querySelectorAll('button[data-del]').forEach(b => b.addEventListener('click', () => { saved.splice(+b.dataset.del, 1); persistSaved(); renderSaved(); drawTrackers(); }));
}
$('saveSweep').addEventListener('click', () => {
  if (!sweepAll.length) { $('saveMsg').textContent = 'Run a sweep first.'; return; }
  const name = ($('saveName').value || `FS ${sweepCtx.FS} · ${sweepCtx.bookKg.toFixed(1)} kg`).slice(0, 40);
  const trade = frontier(sweepAll).map(r => ({ wood: r.wood, capKg: r.capKg, label: summaryOf(r) }));
  const cf = frontier(sweepAll, combined).map(r => ({ wood: r.wood, cf: combined(r), label: summaryOf(r) }));
  saved.push({ name, FS: sweepCtx.FS, bookKg: sweepCtx.bookKg, trade, cf, show: true });
  if (saved.length > 12) saved.shift();
  $('saveMsg').textContent = persistSaved() ? `Saved "${name}" in this browser.` : `Saved "${name}" for this visit only (this browser blocks storage).`;
  $('saveName').value = ''; renderSaved(); drawTrackers();
});
$('groupBy').value = S.groupBy || 'none';
$('groupBy').addEventListener('change', () => { S.groupBy = $('groupBy').value; save(); drawTrackers(); });
renderSaved();

let tradePts = null, curvePts = null;
function drawTrackers() {
  queueSweepSave(); try { paintSheet(); } catch (e) {}
  paintTabs();
  if (!$('s-track').open) return;
  if (S.tab === 'trade') drawTrade(); else if (S.tab === 'curve') drawCurve(); else if (S.tab === 'c3') draw3(); else renderHistory();
  paintAllHidden();
}
// a clear notice on the chart when every group is switched off, so an empty chart is not mistaken for one still loading
function paintAllHidden() {
  [['tradeCanvas', 'tradeLegend'], ['c3Canvas', 'c3Legend'], ['curveCanvas', 'curveLegend']].forEach(([cid, lid]) => {
    const box = $(cid).parentElement; let n = box.querySelector('.allhid');
    const gs = $(lid).querySelectorAll('[data-g]'), off = $(lid).querySelectorAll('[data-g].off');
    const all = gs.length > 0 && off.length === gs.length;
    if (!all) { if (n) n.remove(); return; }
    if (!n) {
      n = document.createElement('div'); n.className = 'allhid';
      n.innerHTML = '<b>All groups are hidden</b><span>Every group in the legend is switched off, so nothing is drawn.</span><button type="button" class="btn sm" data-showall="1">Show all groups</button>';
      n.querySelector('button').addEventListener('click', () => { Object.keys(S.hideG).forEach(k => { if (k.startsWith((S.groupBy || 'none') + '|')) delete S.hideG[k]; }); save(); drawTrackers(); });
      box.appendChild(n);
    }
  });
}
function emptyCanvas(cv, msg) {
  const { ctx, w, h } = setupCanvas(cv);
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = cssv('--muted'); ctx.font = '13px Barlow, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg, w / 2, h / 2);
}
function groupTip(g) {
  const rows = g.rows || [], pass = rows.filter(r => r.passes);
  if (!rows.length) return '';
  const lw = pass.length ? pass.reduce((p, q) => q.wood < p.wood ? q : p) : null, sc = pass.length ? pass.reduce((p, q) => q.capKg > p.capKg ? q : p) : null;
  return `${g.label}: ${rows.length.toLocaleString()} designs in this sweep, ${pass.length.toLocaleString()} pass (${Math.round(100 * pass.length / rows.length)}%)` +
    (lw ? `. Least wood that passes: ${lw.wood.toFixed(0)} mm (${lw.capKg.toFixed(1)} kg). Strongest: ${sc.capKg.toFixed(1)} kg (${sc.wood.toFixed(0)} mm).` : '. None pass.') + ' Click to hide or show.';
}
function legendHTML(items) {
  const anyOff = items.some(it => it.off);
  const nG = items.filter(it => it.g != null).length;
  if ((S.groupBy || 'none') === 'none') return items.map(it => `<span><span class="swatch" style="background:${it.color}"></span>${it.label}</span>`).join('') + '<span class="lghint">To hide some kinds of design, pick "Group by" above (pattern, panels…), then click a group here to hide or show it.</span>';
  return items.map(it => `<span${it.g != null ? ` class="lg${it.off ? ' off' : ''}" data-g="${String(it.g).replace(/"/g, '&quot;')}" title="${String(it.tip || `Click to ${it.off ? 'show' : 'hide'} this group`).replace(/"/g, '&quot;')}"` : ''}><span class="swatch" style="background:${it.color};${it.dash ? 'opacity:.6;outline:1px dashed ' + it.color + ';outline-offset:1px' : ''}"></span>${it.label}</span>`).join('')
    + (anyOff ? '<button type="button" class="btn ghost sm" data-showall="1">Show all groups</button>' : '') + (nG > 3 ? '<button type="button" class="btn ghost sm" data-hideall="1">Hide all</button>' : '') + (nG > 1 && !anyOff ? '<span class="lghint">Click a group to hide or show it. "Hide all", then click the few you want, to compare a handful.</span>' : '');
}
S.hideG = S.hideG || {};
const hidKey = lab => (S.groupBy || 'none') + '|' + lab;
const isHid = lab => !!S.hideG[hidKey(lab)];
['tradeLegend', 'c3Legend', 'curveLegend'].forEach(id => $(id).addEventListener('click', ev => {
  if (ev.target.closest('[data-hideall]')) { $(id).querySelectorAll('[data-g]').forEach(s => { S.hideG[hidKey(s.dataset.g)] = 1; }); save(); drawTrackers(); return; }
  if (ev.target.closest('[data-showall]')) { Object.keys(S.hideG).forEach(k => { if (k.startsWith((S.groupBy || 'none') + '|')) delete S.hideG[k]; }); save(); drawTrackers(); return; }
  const s = ev.target.closest('[data-g]'); if (!s) return;
  const k = hidKey(s.dataset.g); if (S.hideG[k]) delete S.hideG[k]; else S.hideG[k] = 1; save(); drawTrackers();
}));
const shownSaved = () => saved.map((sv, i) => Object.assign({ i }, sv)).filter(sv => sv.show !== false);
function line(ctx, pts, color, width, dash) {
  if (!pts.length) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath();
  pts.forEach(([x, y], i) => { i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore();
}
// ---------- trade-off chart: pick the axes, zoom by dragging, colour failing designs, export, refine around a design
const AXES = {
  wood: ['wood used ΣL (mm, whole bridge)', r => r.wood], mass: ['bridge mass (g)', r => r.mass], capKg: ['capacity (kg of books)', r => r.capKg],
  D: ['mid-span deflection (mm)', r => r.D], util: ['highest member use at the design load', r => r.util], comb: ['load multiple (strength and deflection)', r => combined(r)],
  height: ['height (mm)', r => +r.height], topEnd: ['arch end height Δh (mm)', r => +r.topEnd || 0], botEnd: ['bottom end height Δp (mm)', r => +r.botEnd || 0], panels: ['panels', r => +r.panels], overlap: ['overlap on each desk (mm)', r => r.overlap], curve: ['bottom-chord curve (mm)', r => +r.curve || 0],
  supportOffset: ['support distance from the edge (mm)', r => +r.supportOffset || 0], overall: ['overall length (mm)', r => r.overall], members: ['members', r => r.members],
  tilt3: ['3D tilt (°)', r => r.tilt3 == null ? +S.d3.tilt : +r.tilt3], width3: ['3D bridge width (mm)', r => r.width3 == null ? +S.opts.width : +r.width3],
  loadX: ['load position (mm)', r => r.loadX == null ? SPAN_MID : +r.loadX], bookKg: ['book mass (kg)', r => r.bookKg == null ? (sweepCtx ? sweepCtx.bookKg : S.load.mBook1 + S.load.mBook2) : +r.bookKg],
};
S.axX = AXES[S.axX] ? S.axX : 'wood'; S.axY = AXES[S.axY] ? S.axY : 'capKg';
S.colorFails = !!S.colorFails; S.clickMode = S.clickMode || 'load'; S.refStep = +S.refStep || 0.5;
let tradeView = null, dragBox = null;
const AXSHORT = { wood: 'Wood ΣL (mm)', mass: 'Mass (g)', capKg: 'Capacity (kg)', D: 'Deflection (mm)', util: 'Max member use', comb: 'Load multiple', height: 'h (mm)', topEnd: 'Δh (mm)', botEnd: 'Δp (mm)', panels: 'Panels', overlap: 'Overlap (mm)', curve: 'Curve p (mm)', supportOffset: 'Support offset (mm)', overall: 'Length (mm)', members: 'Members', loadX: 'Load position (mm)', bookKg: 'Book mass (kg)', tilt3: '3D tilt (°)', width3: '3D width (mm)' };
const axOpt = k => `<option value="${k}" title="${AXES[k][0]}">${AXSHORT[k] || AXES[k][0]}</option>`;
['axX', 'axY'].forEach(id => {
  $(id).innerHTML = Object.keys(AXES).map(axOpt).join('');
  $(id).value = S[id];
  $(id).addEventListener('change', () => { S[id] = $(id).value; tradeView = null; save(); drawTrackers(); });
});
$('colorFails').checked = S.colorFails;
$('colorFails').addEventListener('change', () => { S.colorFails = $('colorFails').checked; save(); drawTrackers(); });
$('clickMode').value = S.clickMode;
function paintRefine() { $('refineTgl').setAttribute('aria-pressed', String(S.clickMode === 'refine')); $('refineTgl').textContent = S.clickMode === 'refine' ? '＋ Adding designs on click: on' : '＋ Add designs on click'; }
$('refineTgl').addEventListener('click', () => { S.clickMode = S.clickMode === 'refine' ? 'load' : 'refine'; $('clickMode').value = S.clickMode; save(); paintClickMode(); paintRefine(); toast(S.clickMode === 'refine' ? 'Click a dot to add designs around it. Clicks no longer move the view.' : 'Clicks load designs again.'); });
paintRefine();
$('clickMode').addEventListener('change', () => { S.clickMode = $('clickMode').value; save(); paintClickMode(); });
$('refStep').value = S.refStep;
$('refStep').addEventListener('change', () => { const v = +$('refStep').value; if (v > 0 && v <= 20) { S.refStep = v; save(); } else $('refStep').value = S.refStep; });
function paintClickMode() { $('refRow').hidden = S.clickMode !== 'refine'; }
paintClickMode();
$('zoomReset').addEventListener('click', () => { tradeView = null; drawTrackers(); });
$('tradeCsv').addEventListener('click', () => {
  if (!sweepAll.length) { toast('Run a sweep first.', true); return; }
  const cols = ['idx', 'family', 'pattern', 'panels', 'height', 'curve', 'bottom', 'overlap', 'supportOffset', 'ratio', 'sideAngle', 'vert', 'claw', 'brace', 'loadShape', 'loadX', 'bookKg', 'topEnd', 'botEnd'];
  const extra = [...new Set(sweepAll.flatMap(r => Object.keys(r).filter(k => /^st_|^fc_/.test(k))))];
  const outc = ['wood', 'mass', 'D', 'util', 'capKg', 'passes', 'edgeOK', 'envOK', 'refined'];
  const all = cols.concat(extra, outc);
  const esc = v => v == null ? '' : (typeof v === 'number' ? (Number.isFinite(v) ? +v.toPrecision(8) : '') : String(v).replace(/[",\n]/g, ' '));
  const csv = [all.join(',')].concat(sweepAll.map(r => all.map(k => esc(r[k])).join(','))).join('\n');
  saveFile(fileBase() + '_tradeoff.csv', csv);
});
function drawTrade() {
  const cv = $('tradeCanvas');
  const sv = shownSaved();
  if (!sweepAll.length && !sv.length) { emptyCanvas(cv, 'Run a sweep (in the Sweep section above) to fill this chart.'); $('frontTbl').innerHTML = ''; $('tradeLegend').innerHTML = ''; tradePts = null; renderBest(); return; }
  // new sweep results (or a switch between 2D and 3D results): drop the old zoom so the new cloud is all in view
  if (drawTrade.ref !== sweepAll || drawTrade.len !== sweepAll.length) { if (drawTrade.ref !== undefined && !sweepAll.some(q => q.refined)) tradeView = null; drawTrade.ref = sweepAll; drawTrade.len = sweepAll.length; }
  const [xl, fx] = AXES[S.axX], [yl, fy] = AXES[S.axY];
  const classic = S.axX === 'wood' && S.axY === 'capKg';
  const pts = sweepAll.filter(r => Number.isFinite(fx(r)) && Number.isFinite(fy(r)));
  const groups = groupsOf(pts);
  const need = sweepCtx ? sweepCtx.bookKg * sweepCtx.FS : (S.load.mBook1 + S.load.mBook2) * S.mat.FS;
  const cur = res.stable ? Object.assign({ wood: res.wood, capKg: res.capKg, D: res.midDefl, util: res.maxUtil, mass: res.massTotal, overall: tr.overall, members: tr.elems.length, overlap: tr.overlap }, design()) : null;
  let xr, yr;
  if (tradeView) { xr = tradeView.x; yr = tradeView.y; }
  else {
    const xs = pts.map(fx), ys = pts.map(fy);
    if (classic) { ys.push(need); sv.forEach(s => s.trade.forEach(q => { xs.push(q.wood); ys.push(q.capKg); })); }
    if (cur && Number.isFinite(fx(cur)) && Number.isFinite(fy(cur))) { xs.push(fx(cur)); ys.push(fy(cur)); }
    const pad = (lo, hi, z) => { const d = (hi - lo) || Math.abs(hi) || 1; return [z && lo >= 0 ? 0 : lo - 0.04 * d, hi + 0.05 * d]; };
    xr = pad(Math.min(...xs), Math.max(...xs), false); yr = pad(Math.min(...ys), Math.max(...ys), S.axY === 'capKg');
  }
  const { ctx, w, h } = setupCanvas(cv); ctx.clearRect(0, 0, w, h);
  const A = axes(ctx, w, h, xr, yr, xl, yl);
  ctx.save(); ctx.beginPath(); ctx.rect(A.P.l, A.P.t, w - A.P.l - A.P.r, h - A.P.t - A.P.b); ctx.clip();
  if (classic) {
    ctx.setLineDash([5, 4]); ctx.strokeStyle = cssv('--warn'); ctx.beginPath(); ctx.moveTo(A.P.l, A.Y(need)); ctx.lineTo(w - A.P.r, A.Y(need)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = cssv('--warn'); ctx.textAlign = 'left'; ctx.fillText(`needed ${need.toFixed(1)} kg (books × FS)`, A.P.l + 4, A.Y(need) - 5);
  }
  tradePts = [];
  const leg = [];
  const hiddenRows = new Set(); groups.forEach(g => { if (isHid(g.label)) g.rows.forEach(r => hiddenRows.add(r)); });
  groups.forEach((g, gi) => {
    const col = S.groupBy === 'none' ? cssv('--accent') : gcolor(gi);
    if (isHid(g.label)) { leg.push({ color: S.groupBy === 'none' ? cssv('--ink') : col, label: g.label, g: g.label, off: true, tip: groupTip(g) }); return; }
    g.rows.forEach(q => {
      const x = A.X(fx(q)), y = A.Y(fy(q));
      if (x < A.P.l - 4 || x > w - A.P.r + 4 || y < A.P.t - 4 || y > h - A.P.b + 4) return;
      tradePts.push({ p: q, x, y });
      if (q.refined) return;   // drawn on top below
      if (q.passes) { ctx.fillStyle = col; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); }
      else if (S.colorFails) { ctx.strokeStyle = col; ctx.globalAlpha = 0.45; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.stroke(); }
      else { ctx.fillStyle = cssv('--zero'); ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
    if (classic) line(ctx, frontier(g.rows).map(q => [A.X(q.wood), A.Y(q.capKg)]), S.groupBy === 'none' ? cssv('--ink') : col, 1.8);
    leg.push({ color: S.groupBy === 'none' ? cssv('--ink') : col, label: g.label, g: g.label, tip: groupTip(g) });
  });
  // refined designs: small diamonds on top
  pts.filter(q => q.refined && !hiddenRows.has(q)).forEach(q => {
    const x = A.X(fx(q)), y = A.Y(fy(q));
    ctx.fillStyle = q.passes ? cssv('--tens') : cssv('--bad'); ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(x, y - 3.4); ctx.lineTo(x + 3.4, y); ctx.lineTo(x, y + 3.4); ctx.lineTo(x - 3.4, y); ctx.closePath(); ctx.fill();
  });
  ctx.globalAlpha = 1;
  if (classic) sv.forEach(s => { const col = gcolor(s.i + 3); line(ctx, s.trade.map(q => [A.X(q.wood), A.Y(q.capKg)]), col, 1.6, [6, 4]); leg.push({ color: col, label: `saved: ${s.name}`, dash: true }); });
  if (cur && Number.isFinite(fx(cur)) && Number.isFinite(fy(cur))) { const cx = A.X(fx(cur)), cy = A.Y(fy(cur)); ctx.strokeStyle = cssv('--tens'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.stroke(); ctx.fillStyle = cssv('--tens'); ctx.textAlign = 'left'; ctx.fillText('current', cx + 9, cy + 4); }
  if (dragBox) { ctx.strokeStyle = cssv('--ink'); ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeRect(Math.min(dragBox.x0, dragBox.x1), Math.min(dragBox.y0, dragBox.y1), Math.abs(dragBox.x1 - dragBox.x0), Math.abs(dragBox.y1 - dragBox.y0)); ctx.setLineDash([]); }
  ctx.restore();
  drawTrade.A = A; drawTrade.ranges = { xr, yr };
  if (sweepAll.length && !sweepAll.some(r => r.passes)) {
    ctx.save(); ctx.font = '600 14px Barlow, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = cssv('--bad');
    ctx.fillText('No design in the last sweep passes every check: every dot here fails something.', w / 2, A.P.t + 44);
    ctx.font = '13px Barlow, sans-serif'; ctx.fillText('Try taller trusses, more panels, or turning verticals on, then run the sweep again.', w / 2, A.P.t + 62); ctx.restore();
  }
  $('tradeLegend').innerHTML = legendHTML(leg) + `<span>${S.colorFails ? 'Rings fail a check' : 'Grey dots fail a check'}</span>` + (pts.some(q => q.refined) ? '<span>◆ refined designs (blue pass, red fail)</span>' : '') + (classic ? '' : '<span>Best-trade lines show only on wood vs capacity</span>');
  $('zoomReset').disabled = !tradeView;
  // table: per group, the lightest passing design and the wood cost of extra load along its best-trade line
  let t = `<thead><tr><th class="l">${S.groupBy === 'none' ? 'Sweep' : 'Group'}</th><th class="l">Lightest passing design</th><th>Wood (mm)</th><th>Capacity (kg)</th><th>Wood per +1% load (next ≥10% step)</th><th></th></tr></thead><tbody>`;
  const best = [];
  groups.forEach((g, gi) => {
    const pass = g.rows.filter(r => r.passes).sort((x, y) => x.wood - y.wood)[0];
    const f = frontier(g.rows);
    let slope = '—';
    if (pass) {
      const p1 = f.filter(r => r.capKg >= pass.capKg * 1.1).sort((x, y) => x.wood - y.wood)[0];
      if (p1) slope = ((p1.wood - pass.wood) / ((p1.capKg - pass.capKg) / pass.capKg * 100)).toFixed(1) + ' mm';
    }
    best.push(pass);
    t += `<tr><td class="l"><span class="swatch" style="background:${S.groupBy === 'none' ? cssv('--ink') : gcolor(gi)}"></span>${g.label}</td><td class="l">${pass ? summaryOf(pass) : 'none pass'}</td><td>${pass ? pass.wood.toFixed(0) : '—'}</td><td>${pass ? pass.capKg.toFixed(1) : '—'}</td><td>${slope}</td><td>${pass ? `<button type="button" class="btn ghost sm" data-f="${gi}">Load</button>` : ''}</td></tr>`;
  });
  sv.forEach(s => { const pass = s.cf.filter(q => q.cf >= 1).sort((x, y) => x.wood - y.wood)[0]; t += `<tr><td class="l"><span class="swatch" style="background:${gcolor(s.i + 3)};opacity:.6"></span>saved: ${s.name}</td><td class="l">${pass ? pass.label : 'none pass'}</td><td>${pass ? pass.wood.toFixed(0) : '—'}</td><td>—</td><td>—</td><td></td></tr>`; });
  $('frontTbl').innerHTML = t + '</tbody>';
  $('frontTbl').querySelectorAll('button[data-f]').forEach(b => b.addEventListener('click', () => loadParams(best[+b.dataset.f])));
  renderBest();
}
function nearest(pts, ev, cv) {
  if (!pts) return null;
  const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
  let bestQ = null, bd = 144;
  pts.forEach(q => { const d = (q.x - mx) ** 2 + (q.y - my) ** 2; if (d < bd) { bd = d; bestQ = q; } });
  return bestQ ? { q: bestQ, mx, my } : null;
}
function showTip(tip, cv, n, html) {
  if (!n) { tip.hidden = true; return; }
  tip.innerHTML = html; tip.hidden = false;
  const w = cv.clientWidth;
  if (cv.id === 'c3Canvas') {
    // the 3D chart: park the details in the bottom corner on the far side from the pointer, so they never sit over the points
    const h = cv.clientHeight, left = n.q.x > w / 2;
    tip.style.left = (left ? 8 : w - tip.offsetWidth - 8) + 'px'; tip.style.top = Math.max(0, h - tip.offsetHeight - 8) + 'px';
    return;
  }
  tip.style.left = Math.min(n.q.x + 12, w - tip.offsetWidth - 4) + 'px'; tip.style.top = Math.max(0, n.q.y - 40) + 'px';
}
// strongest bridge for a wood budget, and the least wood for a book load (both from the designs in the last sweep)
function renderBest() {
  const el = $('bestOut'); if (!el) return;
  if (!sweepAll.length) { el.innerHTML = ''; return; }
  const budget = +$('woodBudget').value, target = +$('loadTarget').value, FS = sweepCtx ? sweepCtx.FS : S.mat.FS, bk = sweepCtx ? sweepCtx.bookKg : S.load.mBook1 + S.load.mBook2;
  const ok = r => okRow(r) && Number.isFinite(r.capKg);
  let strong = null, light = null;
  if (budget > 0) sweepAll.forEach(r => { if (ok(r) && r.passes && r.wood <= budget && (!strong || r.capKg > strong.capKg)) strong = r; });
  if (target > 0) sweepAll.forEach(r => {
    if (!ok(r) || r.capKg < target * FS - 1e-9) return;
    const dAt = r.D * target / (r.bookKg != null ? r.bookKg : bk);   // deflection scales with the load
    if (dAt > S.opts.deflLimit) return;
    if (!light || r.wood < light.wood) light = r;
  });
  const rowHtml = (r, i) => r ? `${summaryOf(r)} · wood ${r.wood.toFixed(0)} mm · capacity ${r.capKg.toFixed(1)} kg <button type="button" class="btn ghost sm" data-best="${i}">Load</button>` : 'none in this sweep';
  el.innerHTML = `<div><b>Strongest within ${budget > 0 ? budget.toFixed(0) + ' mm' : '—'} of wood:</b> ${budget > 0 ? rowHtml(strong, 0) : 'enter a budget'}</div>
    <div><b>Least wood that carries ${target > 0 ? target + ' kg' : '—'} of books (× FS ${FS}):</b> ${target > 0 ? rowHtml(light, 1) : 'enter a load'}</div>`;
  const pick = [strong, light];
  el.querySelectorAll('[data-best]').forEach(b => b.addEventListener('click', () => loadParams(pick[+b.dataset.best])));
}
['woodBudget', 'loadTarget'].forEach(id => { $(id).value = S[id] || ''; $(id).addEventListener('change', () => { S[id] = +$(id).value || ''; save(); renderBest(); }); });
// designs a little either side of a clicked one, in fractions of a mm
function refineAround(r) {
  if (sweepBusy) return;
  const step = S.refStep, k = 2;   // two steps each way: 5 values per variable
  const vars = [];
  if (swOn('H') || !['D', 'O', 'S'].some(swOn)) vars.push(['height', 0, 100]);
  if (swOn('D') || (!swOn('H') && !['O', 'S'].some(swOn) && r.curve)) vars.push(['curve', -50, 100]);
  if (r.swOv) vars.push(['overlap', 0, 50]);
  if (swOn('S')) vars.push(['supportOffset', 0, 50]);
  let per = 2 * k + 1;
  while (Math.pow(per, vars.length) > 3000 && per > 3) per -= 2;
  const half = (per - 1) / 2;
  const base = Object.assign({}, r, { overlap: r.swOv ? r.overlap : null, refined: false });
  let list = [base];
  vars.forEach(([f, lo, hi]) => {
    const nx = [];
    list.forEach(c => { for (let j = -half; j <= half; j++) { const v = +(+c[f] + j * step).toFixed(4); if (v < lo - 1e-9 || v > hi + 1e-9) continue; nx.push(Object.assign({}, c, { [f]: v })); } });
    list = nx;
  });
  list = list.filter(c => vars.some(([f]) => Math.abs(c[f] - base[f]) > 1e-9));
  const keyOf = c => vars.map(([f]) => c[f]).join('|') + '|' + [c.panels, c.pattern, c.vert, c.claw, c.brace, c.loadShape, c.loadX, c.bookKg].join('|');
  const have = new Set(sweepAll.filter(q => q.refined).map(keyOf));
  const fresh = list.filter(c => !have.has(keyOf(c)));
  let added = 0;
  fresh.forEach(c => { const { t2, r2 } = evalCandidate(c); if (!r2.stable) return; const row = makeRow(c, t2, r2); row.refined = true; sweepAll.push(row); added++; });
  // zoom to the new designs
  const [, fx] = AXES[S.axX], [, fy] = AXES[S.axY];
  const near = sweepAll.filter(q => q.refined || q === r).map(q => [fx(q), fy(q)]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (near.length > 1) {
    const xs = near.map(q => q[0]), ys = near.map(q => q[1]);
    const dx = (Math.max(...xs) - Math.min(...xs)) || 1, dy = (Math.max(...ys) - Math.min(...ys)) || 1;
    tradeView = { x: [Math.min(...xs) - 0.3 * dx, Math.max(...xs) + 0.3 * dx], y: [Math.min(...ys) - 0.3 * dy, Math.max(...ys) + 0.3 * dy] };
  }
  $('refMsg').textContent = `Added ${added} designs within ±${(half * step).toFixed(2)} mm (${vars.map(v => v[0]).join(', ')}) in ${step} mm steps. Blue diamonds pass. Click one to load it.`;
  drawTrackers();
}
S.tradeDrag = S.tradeDrag || 'box'; S.c3Drag = S.c3Drag || 'rot';
function paintChartDrag() { paintSeg('tradeDrag', S.tradeDrag); $('tradeCanvas').style.cursor = S.tradeDrag === 'pan' ? 'grab' : 'crosshair'; }
$('tradeDrag').addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (!b) return; S.tradeDrag = b.dataset.v; save(); paintChartDrag(); });

paintChartDrag();
$('tradeCanvas').addEventListener('contextmenu', ev => ev.preventDefault());
var padTrade = addNavPad($('tradeCanvas').parentElement, d => {
  if (!drawTrade.A) return; const R = drawTrade.ranges, wx = R.xr[1] - R.xr[0], wy = R.yr[1] - R.yr[0];
  if (d === 'home') { tradeView = null; drawTrade(); return; }
  const f = d === 'in' ? 1 / 1.25 : d === 'out' ? 1.25 : 1, cx = (R.xr[0] + R.xr[1]) / 2, cy = (R.yr[0] + R.yr[1]) / 2;
  const sx = d === 'left' ? -0.15 * wx : d === 'right' ? 0.15 * wx : 0, sy = d === 'up' ? 0.15 * wy : d === 'down' ? -0.15 * wy : 0;
  tradeView = { x: [cx - wx * f / 2 + sx, cx + wx * f / 2 + sx], y: [cy - wy * f / 2 + sy, cy + wy * f / 2 + sy] }; drawTrade();
});
let panT = null;   // moving the trade-off chart around
const tradeInv = (px, py) => { const A = drawTrade.A, R = drawTrade.ranges, W = $('tradeCanvas').clientWidth, H = $('tradeCanvas').clientHeight;
  return [R.xr[0] + (px - A.P.l) / (W - A.P.r - A.P.l) * (R.xr[1] - R.xr[0]), R.yr[0] + (H - A.P.b - py) / (H - A.P.b - A.P.t) * (R.yr[1] - R.yr[0])]; };
$('tradeCanvas').addEventListener('mousedown', ev => {
  const r = $('tradeCanvas').getBoundingClientRect();
  if ((S.tradeDrag === 'pan' || navMode(ev, false) === 'pan') && drawTrade.A) { panT = { x: ev.clientX, y: ev.clientY, R: JSON.parse(JSON.stringify(drawTrade.ranges)), moved: false }; $('tradeCanvas').style.cursor = 'grabbing'; return; }
  dragBox = { x0: ev.clientX - r.left, y0: ev.clientY - r.top, x1: ev.clientX - r.left, y1: ev.clientY - r.top, moved: false };
});
window.addEventListener('mousemove', ev => {
  if (!panT) return;
  const A = drawTrade.A, W = $('tradeCanvas').clientWidth, H = $('tradeCanvas').clientHeight, R = panT.R;
  const dx = (ev.clientX - panT.x) / (W - A.P.l - A.P.r) * (R.xr[1] - R.xr[0]), dy = (ev.clientY - panT.y) / (H - A.P.t - A.P.b) * (R.yr[1] - R.yr[0]);
  if (Math.abs(ev.clientX - panT.x) + Math.abs(ev.clientY - panT.y) > 3) panT.moved = true;
  tradeView = { x: [R.xr[0] - dx, R.xr[1] - dx], y: [R.yr[0] + dy, R.yr[1] + dy] }; $('tradeTip').hidden = true; drawTrade();
});
$('tradeCanvas').addEventListener('wheel', ev => {
  if (!drawTrade.A) return; ev.preventDefault();
  const r = $('tradeCanvas').getBoundingClientRect(), [cx, cy] = tradeInv(ev.clientX - r.left, ev.clientY - r.top), R = drawTrade.ranges, f = wheelDir(ev) > 0 ? 1 / 1.15 : 1.15;
  tradeView = { x: [cx - (cx - R.xr[0]) * f, cx + (R.xr[1] - cx) * f], y: [cy - (cy - R.yr[0]) * f, cy + (R.yr[1] - cy) * f] }; drawTrade();
}, { passive: false });
$('tradeCanvas').addEventListener('mousemove', ev => {
  if (panT) return;
  if (dragBox) { const r = $('tradeCanvas').getBoundingClientRect(); dragBox.x1 = ev.clientX - r.left; dragBox.y1 = ev.clientY - r.top; if (Math.abs(dragBox.x1 - dragBox.x0) + Math.abs(dragBox.y1 - dragBox.y0) > 6) { dragBox.moved = true; $('tradeTip').hidden = true; drawTrade(); return; } }
  const n = nearest(tradePts, ev, $('tradeCanvas'));
  const act = n ? (S.clickMode === 'refine' && !n.q.p.refined ? 'click to add designs around it' : 'click to load it') : '';
  showTip($('tradeTip'), $('tradeCanvas'), n, n ? `${summaryOf(n.q.p)}<br>wood ${n.q.p.wood.toFixed(0)} mm · capacity ${n.q.p.capKg.toFixed(1)} kg · ${n.q.p.passes ? 'passes' : 'fails a check'}${n.q.p.refined ? ' · refined' : ''}<br><i>${act}</i>` : '');
});
window.addEventListener('mouseup', ev => {
  if (panT) { const moved = panT.moved; panT = null; paintChartDrag(); if (moved || ev.target !== $('tradeCanvas')) return; const n = nearest(tradePts, ev, $('tradeCanvas')); if (n) { if (S.clickMode === 'refine' && !n.q.p.refined) refineAround(n.q.p); else loadParams(n.q.p); } return; }
  if (!dragBox) return;
  const b = dragBox; dragBox = null;
  if (b.moved && drawTrade.A) {
    const A = drawTrade.A, R = drawTrade.ranges, W = $('tradeCanvas').clientWidth, H = $('tradeCanvas').clientHeight;
    const inv = (px, lo, hi, p0, p1) => lo + (px - p0) / (p1 - p0) * (hi - lo);
    const xa = [b.x0, b.x1].map(px => inv(px, R.xr[0], R.xr[1], A.P.l, W - A.P.r)).sort((p, q) => p - q);
    const ya = [b.y0, b.y1].map(py => inv(py, R.yr[0], R.yr[1], H - A.P.b, A.P.t)).sort((p, q) => p - q);
    if (Math.abs(b.x1 - b.x0) > 8 && Math.abs(b.y1 - b.y0) > 8) tradeView = { x: xa, y: ya };
    drawTrade(); return;
  }
  if (ev.target !== $('tradeCanvas')) return;
  const n = nearest(tradePts, ev, $('tradeCanvas'));
  if (!n) { if (S.clickMode !== 'refine' && keys().click2d !== 'none' && tradeView) { tradeView = null; drawTrade(); } return; }
  if (S.clickMode === 'refine' && !n.q.p.refined) refineAround(n.q.p); else loadParams(n.q.p);
});
$('tradeCanvas').addEventListener('mouseleave', () => { $('tradeTip').hidden = true; });
$('refClear').addEventListener('click', () => { sweepAll = sweepAll.filter(q => !q.refined); $('refMsg').textContent = ''; tradeView = null; drawTrackers(); });

// ---------- 3D chart: three chosen axes, orthographic view, drag to rotate
S.c3 = Object.assign({ x: 'wood', y: 'height', z: 'capKg', fails: false }, S.c3 || {});
const c3v = { yaw: -0.7, pitch: 0.45, zoom: 1, px: 0, py: 0, pts: null, drag: null };
[['c3X', 'x'], ['c3Y', 'y'], ['c3Z', 'z']].forEach(([id, k]) => {
  $(id).innerHTML = Object.keys(AXES).map(axOpt).join('');
  $(id).value = AXES[S.c3[k]] ? S.c3[k] : 'wood';
  $(id).addEventListener('change', () => { S.c3[k] = $(id).value; save(); draw3(); });
});
$('c3Fails').checked = !!S.c3.fails;
$('c3Fails').addEventListener('change', () => { S.c3.fails = $('c3Fails').checked; save(); draw3(); });
$('c3Reset').addEventListener('click', () => { c3v.yaw = -0.7; c3v.pitch = 0.45; c3v.zoom = 1; c3v.px = 0; c3v.py = 0; draw3(); });
function draw3() {
  const cv = $('c3Canvas');
  if (!sweepAll.length) { emptyCanvas(cv, 'Run a sweep to fill this chart.'); c3v.pts = null; $('c3Legend').innerHTML = ''; return; }
  const fx = AXES[S.c3.x][1], fy = AXES[S.c3.y][1], fz = AXES[S.c3.z][1];
  if (draw3.ref !== sweepAll) { if (draw3.ref !== undefined) { c3v.px = 0; c3v.py = 0; c3v.zoom = 1; } draw3.ref = sweepAll; }
  const rows = sweepAll.filter(r => (S.c3.fails || r.passes) && [fx(r), fy(r), fz(r)].every(Number.isFinite));
  const { ctx, w, h } = setupCanvas(cv); ctx.clearRect(0, 0, w, h);
  if (!rows.length) { ctx.fillStyle = cssv('--muted'); ctx.textAlign = 'center'; ctx.font = '13px Barlow, sans-serif'; ctx.fillText('No designs to show (tick "Show failing designs"?)', w / 2, h / 2); c3v.pts = null; return; }
  const rng = f => { const v = rows.map(f); let lo = Math.min(...v), hi = Math.max(...v); if (hi - lo < 1e-9) { lo -= 1; hi += 1; } return [lo, hi]; };
  const R = [rng(fx), rng(fy), rng(fz)];
  const norm = (v, [lo, hi]) => (v - lo) / (hi - lo) * 2 - 1;
  const cy = Math.cos(c3v.yaw), sy = Math.sin(c3v.yaw), cp = Math.cos(c3v.pitch), sp = Math.sin(c3v.pitch);
  // world: x right, y into the page, z up. Rotate about z (yaw), then tilt (pitch). The box (with room for its labels) is fitted to the canvas.
  const rot = (X, Y, Z) => { const x1 = X * cy - Y * sy, y1 = X * sy + Y * cy; return [x1, y1 * sp + Z * cp, y1 * cp - Z * sp]; };
  const Rb = Math.hypot(1.35, 1.35, 1.2);   // the box and its labels fit inside this sphere whichever way it is turned
  const sc = Math.min(w - 20, h - 30) / (2 * Rb) * c3v.zoom;
  const ox = w / 2 + c3v.px, oy = h / 2 + c3v.py;
  const proj = (X, Y, Z) => { const q = rot(X, Y, Z); return [ox + sc * q[0], oy - sc * q[1], q[2]]; };
  // box and axes
  ctx.strokeStyle = cssv('--line'); ctx.lineWidth = 1;
  const corners = [-1, 1];
  const edges = [];
  corners.forEach(a => corners.forEach(b => { edges.push([[-1, a, b], [1, a, b]]); edges.push([[a, -1, b], [a, 1, b]]); edges.push([[a, b, -1], [a, b, 1]]); }));
  edges.forEach(([p0, p1]) => { const q0 = proj(...p0), q1 = proj(...p1); ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke(); });
  ctx.font = '11px IBM Plex Mono, monospace'; ctx.fillStyle = cssv('--ink');
  const lab = (p, s, al) => { const q = proj(...p); ctx.textAlign = al || 'center'; ctx.fillText(s, q[0], q[1]); };
  const fmt = v => Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
  lab([0, -1.25, -1.1], AXES[S.c3.x][0]); lab([-1, -1.12, -1.08], fmt(R[0][0])); lab([1, -1.12, -1.08], fmt(R[0][1]));
  lab([1.3, 0, -1.1], AXES[S.c3.y][0]); lab([1.12, -1, -1.08], fmt(R[1][0])); lab([1.12, 1, -1.08], fmt(R[1][1]));
  lab([-1.1, -1.1, 1.12], AXES[S.c3.z][0], 'left'); lab([-1.12, -1.1, -1], fmt(R[2][0]), 'right'); lab([-1.12, -1.1, 1], fmt(R[2][1]), 'right');
  // points, far ones first
  const groups = groupsOf(rows), colOf = new Map();
  groups.forEach((g, gi) => { if (!isHid(g.label)) g.rows.forEach(r => colOf.set(r, S.groupBy === 'none' ? cssv('--accent') : gcolor(gi))); });
  const P = rows.filter(r => colOf.has(r)).map(r => { const q = proj(norm(fx(r), R[0]), norm(fy(r), R[1]), norm(fz(r), R[2])); return { p: r, x: q[0], y: q[1], d: q[2] }; }).sort((a1, b1) => b1.d - a1.d);
  P.forEach(q => { ctx.globalAlpha = q.p.passes ? 0.8 : 0.35; ctx.fillStyle = q.p.passes ? colOf.get(q.p) : cssv('--zero'); ctx.beginPath(); ctx.arc(q.x, q.y, q.p.refined ? 3.4 : 2.6, 0, 7); ctx.fill(); });
  ctx.globalAlpha = 1;
  c3v.pts = P; if (c3v.cube) c3v.cube();
  $('c3Legend').innerHTML = legendHTML(groups.map((g, gi) => ({ color: S.groupBy === 'none' ? cssv('--accent') : gcolor(gi), label: g.label, g: g.label, off: isHid(g.label), tip: groupTip(g) }))) + (S.c3.fails ? '<span>Grey points fail a check</span>' : '<span>Passing designs only</span>') + `<span>${rows.length.toLocaleString()} designs</span>`;
}
attachOrbit($('c3Canvas'), c3v, () => { $('c3Tip').hidden = true; draw3(); }, { home: { yaw: -0.7, pitch: 0.45 },
  click: ev => { const n = nearest(c3v.pts, ev, $('c3Canvas')); if (n) loadParams(n.q.p); } });
$('c3Canvas').addEventListener('mousemove', ev => {
  if (c3v.drag) return;
  const n = nearest(c3v.pts, ev, $('c3Canvas'));
  const f = k => { const v = AXES[S.c3[k]][1](n.q.p); return Number.isFinite(v) ? (+v.toFixed(2)).toString() : '—'; };
  showTip($('c3Tip'), $('c3Canvas'), n, n ? `${summaryOf(n.q.p)}<br>${AXES[S.c3.x][0]}: ${f('x')}<br>${AXES[S.c3.y][0]}: ${f('y')}<br>${AXES[S.c3.z][0]}: ${f('z')}<br>${n.q.p.passes ? 'passes' : 'fails a check'} · click to load` : '');
});
$('c3Canvas').addEventListener('mouseleave', () => { $('c3Tip').hidden = true; });

// ---------- 3D view (prototype)
S.d3 = Object.assign({ tilt: 0, botTies: true, topBr: 'single', botBr: 'single', sway: true }, S.d3 || {});
// per-panel / per-station patterns (left half). Older saved settings become patterns the first time.
if (!S.d3.topPat) S.d3.topPat = [{ none: 'N', x: 'X' }[S.d3.topBr] || 'S'];
if (!S.d3.botPat) S.d3.botPat = [{ none: 'N', x: 'X' }[S.d3.botBr] || 'S'];
if (!S.d3.framePat) S.d3.framePat = S.d3.sway ? ['D', 'N'] : ['N'];
S.d3.sec = S.d3.sec || 0;
const LAT_CYCLE = ['N', 'S', 'R', 'X'], FRAME_CYCLE = ['N', 'D', 'E', 'X', 'K'];
const LAT_SYM = { N: '·', S: '╱', R: '╲', X: '✕' }, FRAME_SYM = { N: '·', D: '⟋', E: '⟍', X: '✕', K: 'K' };
const halfOf = n => Math.ceil(n / 2);
function patAt(pat, i) { return pat[Math.min(i, pat.length - 1)] || 'N'; }
function setPat(key, i, code, half) { const p = []; for (let k = 0; k < half; k++) p.push(patAt(S.d3[key], k)); p[i] = code; S.d3[key] = p; }
function paint3Chips() {
  if (!m3) return;
  const mk = (id, key, count, cyc, sym, isFrame) => {
    const el = $(id), half = halfOf(count); el.innerHTML = '';
    for (let i = 0; i < half; i++) {
      const code = patAt(S.d3[key], i), b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (code !== 'N' ? ' on' : '') + (isFrame && S.d3.sec === i ? ' sel' : '');
      b.textContent = sym[code]; b.title = `${isFrame ? 'Station' : 'Panel'} ${i + 1}: ${code}`;
      b.addEventListener('click', () => { setPat(key, i, cyc[(cyc.indexOf(code) + 1) % cyc.length], half); if (isFrame) S.d3.sec = i; save(); d3Changed(); });
      el.appendChild(b);
    }
    if (!half) el.innerHTML = '<span class="note">none here</span>';
  };
  mk('d3Top', 'topPat', m3.topPanels, LAT_CYCLE, LAT_SYM, false);
  mk('d3Bot', 'botPat', m3.botPanels, LAT_CYCLE, LAT_SYM, false);
  mk('d3Frames', 'framePat', m3.stationCount, FRAME_CYCLE, FRAME_SYM, true);
}
document.querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => {
  const [plane, code] = b.dataset.pre.split(':');
  if (plane === 'frame') S.d3.framePat = code === 'ends' ? ['D', 'N'] : [code]; else S.d3[plane + 'Pat'] = [code];
  save(); d3Changed();
}));
var v3 = window.__v3 = { yaw: -0.55, pitch: 0.42, zoom: 1, px: 0, py: 0, drag: null, segs: null };
function paint3Inputs() { setVal('tilt3d', S.d3.tilt); $('botTies3d').checked = S.d3.botTies; setVal('width3d', S.opts.width); $('d3ShowPlan').checked = S.d3.showPlan !== false; $('d3ShowSec').checked = S.d3.showSec !== false; paint3Show(); }
function paint3Show() {
  const pl = S.d3.showPlan !== false, se = S.d3.showSec !== false;
  $('d3Plan').parentElement.hidden = !pl; $('d3Sec').parentElement.hidden = !se;
  $('d3Views').hidden = !pl && !se;
}
$('width3d').addEventListener('change', () => { const v = +$('width3d').value; if (v > 0 && isFinite(v)) { S.opts.width = v; setVal('width', v); update(); } });
$('d3ShowPlan').addEventListener('change', () => { S.d3.showPlan = $('d3ShowPlan').checked; save(); paint3Show(); });
$('d3ShowSec').addEventListener('change', () => { S.d3.showSec = $('d3ShowSec').checked; save(); paint3Show(); });
$('tilt3d').addEventListener('change', () => { const v = +$('tilt3d').value; if (isFinite(v) && Math.abs(v) <= 30) { S.d3.tilt = v; save(); d3Changed(); } });
[['botTies3d', 'botTies', 'checked']].forEach(([id, k, prop]) => $(id).addEventListener('change', () => { S.d3[k] = $(id)[prop]; save(); d3Changed(); }));
$('reset3d').addEventListener('click', () => { v3.yaw = -0.55; v3.pitch = 0.42; v3.zoom = 1; v3.px = 0; v3.py = 0; render3D(); });
let m3 = null, r3 = null;
function d3Changed() { if (S.anaMode === '3d') { update(); checkStale(); } else render3D(); }
// ---------- 2D / 3D analysis. In 3D the whole bridge is solved (both trusses, ties, bracing, cross-frames);
// each 2D member shows the worse of its front and back copies, and the checks use the 3D strength, deflection and wood.
const BRACE_SETS = {
  current: { name: 'As set above' },
  light: { name: 'Light: single top and bottom, end frames', top: ['S'], bot: ['S'], frame: ['D', 'N'] },
  every: { name: 'Frames at every station, single top and bottom', top: ['S'], bot: ['S'], frame: ['D'] },
  topX: { name: 'X on top, single bottom, end frames', top: ['X'], bot: ['S'], frame: ['D', 'N'] },
  full: { name: 'Full: X top and bottom, X frames everywhere', top: ['X'], bot: ['X'], frame: ['X'] },
};
S.anaMode = S.anaMode === '3d' ? '3d' : '2d';
function d3opts(c) {
  const b = c && c.brace3 && c.brace3 !== 'current' ? BRACE_SETS[c.brace3] : null;
  return { width: c && c.width3 != null ? +c.width3 : (+S.opts.width || 60), tilt: c && c.tilt3 != null ? +c.tilt3 : +S.d3.tilt, bottomTies: c && c.ties3 != null ? !!c.ties3 : S.d3.botTies, topPat: b ? b.top : S.d3.topPat, botPat: b ? b.bot : S.d3.botPat, framePat: b ? b.frame : S.d3.framePat };
}
function apply3D(t2, r2, load, o) {
  if (!r2.stable || !window.Truss3D) return r2;
  const mat = Object.assign({}, C.DEFAULT_MAT, S.mat);
  let m, q;
  try { m = Truss3D.build3D(t2, o); q = Truss3D.analyze3D(m, mat, load); } catch (e) { return Object.assign({}, r2, { stable: false, passes: false, unstable3D: true }); }
  if (!q.stable) return Object.assign({}, r2, { stable: false, passes: false, unstable3D: true });
  const hits = Truss3D.tableHits ? Truss3D.tableHits(m, +S.tableThick || 30, t2.design.span || 200) : [];
  // 2D element k -> its front and back copies in the 3D model (build3D adds them in order, skipping claws and braces)
  const pair = []; let c = 0;
  t2.elems.forEach((e, k) => { if (e.type === 'claw' || e.type === 'brace') { pair[k] = null; return; } pair[k] = [c, c + 1]; c += 2; });
  const members = r2.members.map((mm, k) => {
    if (!pair[k]) return mm;
    const f = q.members[pair[k][0]], b = q.members[pair[k][1]], w = b.util > f.util ? b : f;
    return Object.assign({}, mm, { F: w.F, TC: w.F > 0 ? 'T' : w.F < 0 ? 'C' : '0', util: w.util, mode: w.mode, fails: w.fails, stress: w.F / mm.Aeff, buckles: w.F < 0 && w.mode === 'buckling' && w.fails ? 'Y' : 'N', side3: w === b ? 'back' : 'front' });
  });
  const extraWood = t2.elems.reduce((s, e, k) => s + (pair[k] ? 0 : 2 * r2.members[k].L * e.n), 0);
  const wood = q.wood + extraWood;
  const bracing = q.members.filter(x => x.side === 'cross');
  const maxUtil = q.maxUtil, midDefl = q.deckDefl, deflOK = midDefl <= S.opts.deflLimit;
  const failing = members.filter(x => x.fails);
  const failBr = bracing.filter(x => x.fails);
  const capFactor = maxUtil > 0 ? mat.FS / maxUtil : Infinity;
  const nN = t2.nodes.length, lift3 = [...new Set(q.lifted.map(n => n % nN))].filter(n => n < nN).map(n => ({ node: n, x: t2.nodes[n][0], pin: false }));
  return Object.assign({}, r2, { members, maxUtil, midDefl, lifted: lift3, dmax: Math.max(r2.dmax, midDefl), deflOK, wood, massTotal: r2.massTotal * wood / Math.max(1e-9, r2.wood),
    failing, capFactor, capKg: q.capKg, passes: failing.length === 0 && failBr.length === 0 && deflOK && r2.envelope.length === 0 && r2.edgeOK && r2.slips.length === 0 && hits.length === 0,
    envelope: hits.length ? r2.envelope.concat([`${hits.length} 3D member${hits.length > 1 ? 's' : ''} (bracing or ties) would pass through the table top.`]) : r2.envelope,
    mode3: { r3: q, m3: m, sway: q.sideSway, failBr, wood2: r2.wood, bracingWood: bracing.reduce((s, x) => s + x.L * x.n, 0) } });
}
function paintAna() {
  placeTopView();
  const sw = $('anaSwitch'); sw.dataset.v = S.anaMode;
  sw.querySelectorAll('[data-ana]').forEach(b => { const on = b.dataset.ana === S.anaMode; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  $('brace3Sweep').style.opacity = S.anaMode === '3d' ? '' : '.5';
}
$('topViewSeg').addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (!b) return; S.topView = b.dataset.v; save(); if (fsEl === '#sideSheet') { setFs(null); placeTopView(); setFs('#sideSheet'); } else placeTopView(); renderDrawing(); render3D(); });
$('anaSwitch').addEventListener('click', ev => {
  const b = ev.target.closest('[data-ana]'); if (!b || b.dataset.ana === S.anaMode) return;
  const fsWas = fsEl; if (fsWas === '#sideSheet') setFs(null);
  S.anaMode = b.dataset.ana; paintAna(); update(); checkStale(); updateSweepCount();
  if (fsWas === '#sideSheet') setFs('#sideSheet');
  toast(S.anaMode === '3d' ? '3D analysis: both trusses, ties and bracing. Bracing wood now counts. Set the bracing in the 3D section.' : '2D analysis: one side truss, half the load.');
});
toggleChips('swBrace3', SW.brace3, Object.fromEntries(Object.entries(BRACE_SETS).map(([k, v]) => [k, v.name])));
CHOICES.forEach(ch => {
  const host = $(ch.host); if (!host) return;
  const anchor = ch.bool ? host.closest('label') : host;
  const box = document.createElement('div'); box.className = 'chsw' + (swOn('c_' + ch.key) ? ' on' : ''); box.id = 'chsw_' + ch.key;
  box.innerHTML = `<label class="swchip" title="Try every ticked choice in the sweep"><input type="checkbox" ${swOn('c_' + ch.key) ? 'checked' : ''}> sweep ${ch.name}</label><span class="chips">${Object.keys(ch.opts).map(o => `<button type="button" class="chip${SW.choice[ch.key + ':' + o] ? ' on' : ''}" data-o="${o}">${ch.opts[o]}</button>`).join('')}</span>`;
  anchor.after(box);
  box.querySelector('input').addEventListener('change', ev => { S.swOn['c_' + ch.key] = ev.target.checked; box.classList.toggle('on', ev.target.checked); save(); updateSweepCount(); checkStale(); renderDrawing(); });
  box.querySelector('.chips').addEventListener('click', ev => { const b = ev.target.closest('[data-o]'); if (!b) return; const k = ch.key + ':' + b.dataset.o; SW.choice[k] = !SW.choice[k]; b.classList.toggle('on', SW.choice[k]); S.swSel = SW; save(); updateSweepCount(); checkStale(); });
});
['Y', 'W', 'U'].forEach(k => { $('swOn' + k).checked = swOn(k); $('swOn' + k).addEventListener('change', () => { S.swOn[k] = $('swOn' + k).checked; save(); updateSweepCount(); checkStale(); }); });
['swY0', 'swY1', 'swYs', 'swW0', 'swW1', 'swWs'].forEach(id => { if (S.swVals && S.swVals[id] != null) $(id).value = S.swVals[id]; $(id).addEventListener('input', () => { S.swVals = S.swVals || {}; S.swVals[id] = $(id).value; save(); updateSweepCount(); }); });
$('swOnZ').checked = swOn('Z');
$('swOnZ').addEventListener('change', () => { S.swOn.Z = $('swOnZ').checked; save(); updateSweepCount(); checkStale(); });
paintAna();
function topOn() { return S.anaMode === '3d' && S.topView !== '2d'; }
function placeTopView() {
  const on = topOn(), box = $('c3d').closest('.chartbox');
  if (!(fsMoved && fsMoved.length)) {
    if (on && box.parentElement !== $('topD3Slot')) $('topD3Slot').appendChild(box);
    if (!on && box.parentElement === $('topD3Slot')) $('d3BoxHome').appendChild(box);
  }
  $('drawWrap').hidden = on; $('d3Facts').hidden = !on;
  $('topViewSeg').hidden = S.anaMode !== '3d'; paintSeg('topViewSeg', on ? '3d' : '2d');
  $('viewTitle').textContent = `${on ? '3D bridge' : 'Side view'} · ${S.name}`;
}
function render3D() {
  if (!window.Truss3D) return;
  paint3Inputs();
  const mat = Object.assign({}, C.DEFAULT_MAT, S.mat);
  m3 = Truss3D.build3D(tr, { width: +S.opts.width || 60, tilt: +S.d3.tilt, bottomTies: S.d3.botTies, topPat: S.d3.topPat, botPat: S.d3.botPat, framePat: S.d3.framePat });
  r3 = Truss3D.analyze3D(m3, mat, S.load);
  draw3D(); paint3Chips(); draw3Views(); renderTable3();
  const cap2 = res.stable ? res.capKg : NaN;
  $('d3Status').textContent = r3.stable ? `${r3.failing.length ? 'fails' : 'passes strength'} · capacity ${r3.capKg.toFixed(1)} kg` : 'unstable';
  if (!r3.stable) { $('d3Facts').innerHTML = `<b style="color:var(--bad)">Unstable in 3D.</b> With pin joints the two trusses can sway or rack sideways. Brace both the top and bottom planes (xy), and add cross-frames (zy) at least at the ends; a plane with no bracing lets its chord swing sideways between frames.${m3.warn.length ? ' ' + m3.warn.join(' ') : ''}`; return; }
  const fails = r3.failing.map(m => `${X.TYPE_LABEL[m.type] || ({ tie: 'Tie', lat: 'Lateral brace', sway: 'Sway brace' })[m.type]} (${m.side}) ${m.F.toFixed(1)} N ${m.mode}`);
  const typeWood = {}; m3.elems.forEach((e, k) => { const t = e.side === 'cross' ? e.type : 'side trusses'; typeWood[t] = (typeWood[t] || 0) + r3.members[k].L * e.n; });
  $('d3Facts').innerHTML = `Wood in the 3D model: <b>${r3.wood.toFixed(0)} mm</b> (${Object.entries(typeWood).map(([t, v]) => `${({ tie: 'ties', lat: 'lateral bracing', sway: 'sway diagonals' })[t] || t} ${v.toFixed(0)}`).join(', ')}).
    Capacity <b>${r3.capKg.toFixed(1)} kg</b> (2D: ${Number.isFinite(cap2) ? cap2.toFixed(1) : '—'} kg) · highest use ${(r3.maxUtil * 100).toFixed(0)}% · deck deflection <b>${r3.deckDefl.toFixed(3)} mm</b> (2D: ${res.stable ? res.midDefl.toFixed(3) : '—'} mm) · largest sideways movement ${r3.sideSway.toFixed(3)} mm.
    ${r3.lifted.length ? `${r3.lifted.length} support${r3.lifted.length > 1 ? 's' : ''} would have to pull down and lift off.` : ''}
    ${fails.length ? `<br><b style="color:var(--bad)">Over the limit:</b> ${fails.join(' · ')}` : ''}${m3.warn.length ? '<br>' + m3.warn.join(' ') : ''}`;
}
// ✎ input labels on the 3D bridge (HTML buttons over the canvas, so a click opens the same editor as in 2D)
// the drawing options as small picture toggles; the text shows on hover (and stays for screen readers)
(function () {
  const sv = b => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
  const ICON = {
    showDims: ['Input labels: the ✎ labels you click to change a size on the drawing', sv('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>')],
    resOnDraw: ['Results on the drawing: capacity, determinacy, deflection and wood', sv('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15v-3M11 15V9M15 15v-5M19 15v-2" stroke-width="2"/>')],
    showForces: ['Member forces: the force in each member (C compression, T tension)', sv('<path d="M3 12h18"/><path d="M7 8l-4 4 4 4M17 8l4 4-4 4"/>')],
    showIds: ['Node numbers: the number of each joint', sv('<circle cx="12" cy="12" r="8"/><text x="12" y="16" font-size="11" text-anchor="middle" fill="currentColor" stroke="none" font-weight="700">1</text>')],
    showElems: ['Member numbers: the number of each member', sv('<path d="M2 19L22 5"/><rect x="8" y="8" width="8" height="8" rx="1.5" fill="var(--sheet)"/><text x="12" y="14.5" font-size="7" text-anchor="middle" fill="currentColor" stroke="none" font-weight="700">1</text>')],
    showDef: ['Deformed shape: the bent shape under load, magnified by the scale', sv('<path d="M3 8h18" opacity=".45"/><path d="M3 8c5 9 13 9 18 0" stroke-dasharray="3 2.5"/>')],
    showGhosts: ['Sweep ranges: the low (dotted) and high (dashed) outline of each swept input', sv('<path d="M3 18L12 6l9 12" stroke-dasharray="1 3"/><path d="M6 18l6-7 6 7" stroke-dasharray="4 2"/>')],
    d3ShowPlan: ['Plan view (3D): the bridge seen from above', sv('<rect x="3" y="7" width="18" height="10"/><path d="M3 7l6 10 6-10 6 10"/>')],
    d3ShowSec: ['End view (3D): one cross-frame seen along the bridge', sv('<rect x="6" y="5" width="12" height="13"/><path d="M6 18L18 5"/><path d="M3 21h18" opacity=".5"/>')],
  };
  document.querySelectorAll('.drawopts').forEach(box => {
    Object.keys(ICON).forEach(id => {
      const inp = $(id); if (!inp || !box.contains(inp)) return;
      const lb = inp.closest('label'); if (!lb || lb.classList.contains('icotgl')) return;
      lb.classList.add('icotgl'); lb.title = ICON[id][0];
      [...lb.childNodes].forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) { const s = document.createElement('span'); s.className = 'icotxt'; s.textContent = n.textContent.trim(); lb.replaceChild(s, n); } });
      lb.insertAdjacentHTML('beforeend', ICON[id][1]);
    });
  });
})();
function draw3Labels(proj, w, h) {
  const box = $('c3d').parentElement; let lay = box.querySelector('.d3labs');
  if (!lay) { lay = document.createElement('div'); lay.className = 'd3labs'; box.appendChild(lay); lay.addEventListener('click', ev => { const b = ev.target.closest('[data-var]'); if (!b) return; ev.stopPropagation(); if (adj && adj.key === b.dataset.var) closeAdj(); else { openDimPop(b.dataset.var); draw3D(); } }); }
  if (S.showDims === false || !m3) { lay.innerHTML = ''; return; }
  const W = +S.opts.width || 60, H = +S.height, ph = (+S.d3.tilt || 0) * Math.PI / 180, mid = 100;
  const at = (x, y, z) => { const q = proj(x, y, z); return [q[0], q[1]]; };
  const L = [
    ['height', `h ${fmt1(H)}`, at(mid, -W / 2 + H * Math.sin(ph), H * Math.cos(ph) / 2)],
    ['width3d', `width ${fmt1(W)}`, at(mid, 0, H * Math.cos(ph) + 6)],
    ['tilt3d', `tilt ${fmt1(+S.d3.tilt || 0)}°`, at(Math.max(...m3.nodes.map(p => p[0])) + 4, W / 2, H * Math.cos(ph) / 2)],
    ['overlap', `overlap ${fmt1(+tr.overlap || 0)}`, at(-Math.max(8, (+tr.overlap || 0) / 2), -W / 2, -2)],
    ['panels', `${S.panels} panels`, at(150, W / 2 - H * Math.sin(ph), H * Math.cos(ph) + 8)],
  ];
  lay.innerHTML = L.map(([k, t, [x, y]]) => `<button type="button" class="d3lab${adj && adj.key === k ? ' act' : ''}" data-var="${k}" style="left:${Math.max(4, Math.min(w - 90, x)).toFixed(0)}px;top:${Math.max(4, Math.min(h - 22, y)).toFixed(0)}px" title="${DIMVARS[k].label.replace(/"/g, '&quot;')}">✎ ${t}</button>`).join('');
}
// sweep ranges on the 3D bridge: only the low (dotted) and high (dashed) outline of each swept input, on the front truss,
// so it stays readable; a swept width or tilt shows the back truss's top and bottom chords at both ends of its range
function draw3Ghosts(ctx, proj, h) {
  if (typeof swOn !== 'function') return;
  const W0 = +S.opts.width || 60, tilt0 = +S.d3.tilt || 0, legend = [];
  const place = (t2, side, W, tilt) => { const ph = tilt * Math.PI / 180, sn = Math.sin(ph), cs = Math.cos(ph); return t2.nodes.map(([x, z]) => side < 0 ? [x, -W / 2 + z * sn, z * cs] : [x, W / 2 - z * sn, z * cs]); };
  const outline = (t2, pts, col, dash, types) => {
    ctx.strokeStyle = col; ctx.setLineDash(dash); ctx.beginPath();
    t2.elems.forEach(e => { if (!types.includes(e.type)) return; const a = proj(...pts[e.i]), b = proj(...pts[e.j]); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); });
    ctx.stroke();
  };
  const ends = k => { const a0 = +$('sw' + k + '0').value, a1 = +$('sw' + k + '1').value; return [Math.min(a0, a1), Math.max(a0, a1)]; };
  ctx.save(); ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.globalAlpha = 0.95;
  GHOST.forEach(g => {
    if (!swOn(g.k)) return;
    const col = cssv(g.col.replace(/^var\((.*)\)$/, '$1')), [lo, hi] = ends(g.k);
    [lo, hi].forEach((v, j) => { let t2; try { t2 = C.buildTruss(design(g.f(v))); } catch (e) { return; } outline(t2, place(t2, -1, W0, tilt0), col, j ? [8, 4] : [0.5, 4], ['top', 'bot', 'end']); });
    legend.push([col, `${g.name}: ${fmt1(lo)} (dotted) to ${fmt1(hi)} (dashed)`]);
  });
  if (S.anaMode === '3d') [['W', 'width', v => [v, tilt0], '--g7'], ['Y', 'tilt', v => [W0, v], '--g8']].forEach(([k, name, wt, cv]) => {
    if (!swOn(k)) return;
    const col = cssv(cv), [lo, hi] = ends(k);
    [lo, hi].forEach((v, j) => { const [W, t] = wt(v); outline(tr, place(tr, 1, W, t), col, j ? [8, 4] : [0.5, 4], ['top', 'bot']); });
    legend.push([col, `${name}: ${fmt1(lo)} (dotted) to ${fmt1(hi)} (dashed)${k === 'W' ? ' mm' : '°'}`]);
  });
  ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.font = '11px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
  // top left, under the determinacy count (the plan and end-view insets cover the bottom left)
  const y0 = (S.resOnDraw ? 62 : 18) + fsTopPad();
  legend.forEach(([col, t], i) => { const s = 'sweep ' + t, wd = ctx.measureText(s).width + 6; ctx.fillStyle = cssv('--sheet'); ctx.globalAlpha = 0.85; ctx.fillRect(9, y0 + 15 * i - 11, wd, 14); ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.fillText(s, 12, y0 + 15 * i); });
  ctx.restore();
}
// every 3D member in one table (the 2D table below is one side truss, where sticks are set)
function renderTable3() {
  const box = $('tbl3Box'); if (!box) return;
  box.hidden = S.anaMode !== '3d' || !m3;
  if (box.hidden) return;
  if (!r3 || !r3.stable) { $('tbl3').innerHTML = '<tbody><tr><td class="l">No 3D results: the 3D model is unstable. Add bracing in the 3D section.</td></tr></tbody>'; $('tbl3Note').textContent = ''; return; }
  const where = e => e.side === 'cross' ? ({ top: 'top plane (xy)', bottom: 'bottom plane (xy)', frame: 'cross-frame (zy)' })[e.plane] || (e.type === 'tie' ? 'tie across' : 'cross') : e.side + ' truss';
  const nm = e => X.TYPE_LABEL[e.type] || ({ tie: 'Tie', lat: 'Lateral brace', sway: 'Sway diagonal' })[e.type];
  let hd = '<thead><tr><th>Member</th><th>i</th><th>j</th><th class="l">Where</th><th class="l">Type</th><th>Sticks</th><th>L (mm)</th><th>F (N)</th><th>T/C</th><th class="l">Use</th></tr></thead><tbody>';
  r3.members.forEach((m, k) => {
    const e = m3.elems[k], u = Math.min(1, m.util), col = m.util >= 1 ? 'var(--bad)' : m.util >= .8 ? 'var(--warn)' : (m.F < 0 ? 'var(--comp)' : 'var(--tens)');
    hd += `<tr data-k3="${k}" class="${m.fails ? 'fail' : ''}"><td>${m3.elemLab[k]}</td><td>${m3.nodeLab[e.i]}</td><td>${m3.nodeLab[e.j]}</td><td class="l">${where(e)}</td><td class="l">${nm(e)}</td><td>${e.n}</td><td>${m.L.toFixed(1)}</td><td>${m.F.toFixed(2)}</td><td>${m.F < 0 ? 'C' : m.F > 0 ? 'T' : '0'}</td>
      <td class="l"><span style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-block;width:60px;height:6px;background:var(--soft);border-radius:3px;overflow:hidden"><span style="display:block;height:100%;width:${(u * 100).toFixed(0)}%;background:${col}"></span></span>${(m.util * 100).toFixed(0)}%${m.mode ? ' ' + m.mode : ''}</span></td></tr>`;
  });
  $('tbl3').innerHTML = hd + '</tbody>';
  $('tbl3').querySelectorAll('tbody tr').forEach(r => { r.addEventListener('mouseenter', () => { v3.hl = +r.dataset.k3; draw3D(); }); r.addEventListener('mouseleave', () => { v3.hl = -1; draw3D(); }); });
  const nT = r3.members.filter(m => m.F > 0).length, nC = r3.members.filter(m => m.F < 0).length;
  $('tbl3Note').innerHTML = `${r3.members.length} members: ${nT} in tension, ${nC} in compression, ${r3.members.length - nT - nC} at zero force. Names: 12f / 12b = member 12 of the front / back truss (the 2D number), T = ties, L = lateral bracing (xy planes), S = sway diagonals (zy cross-frames). Joints: 4f / 4b front / back, M = mid-width joints. Hover a row to find it on the 3D bridge.`;
}
// plan (xy) and end (zy) views of the 3D model
function draw3Views() {
  if (!m3) return;
  const forceCol = k => { const m = r3 && r3.stable ? r3.members[k] : null; return !m ? 'var(--ink)' : m.fails ? 'var(--bad)' : m.F < 0 ? 'var(--comp)' : m.F > 0 ? 'var(--tens)' : 'var(--zero)'; };
  // plan: x to the right, y up
  const xs = m3.nodes.map(p => p[0]), ys = m3.nodes.map(p => p[1]);
  const px0 = Math.min(...xs) - 10, px1 = Math.max(...xs) + 10, py0 = Math.min(...ys) - 10, py1 = Math.max(...ys) + 10;
  let s = `<rect x="${px0}" y="${-py1}" width="${-px0}" height="${py1 - py0}" fill="var(--desk)" opacity=".5"/><rect x="200" y="${-py1}" width="${px1 - 200}" height="${py1 - py0}" fill="var(--desk)" opacity=".5"/>`;
  m3.elems.forEach((e, k) => {
    const p = m3.nodes[e.i], q = m3.nodes[e.j];
    const isBot = e.plane === 'bottom' || (e.side !== 'cross' && e.type === 'bot');
    if (e.side !== 'cross' && !(e.type === 'top' || e.type === 'bot')) return;   // side-truss webs are edge-on from above
    s += `<line x1="${p[0]}" y1="${-p[1]}" x2="${q[0]}" y2="${-q[1]}" stroke="${forceCol(k)}" stroke-width="${e.side === 'cross' ? 1 : 1.6}" ${isBot ? 'stroke-dasharray="3 2" opacity=".75"' : ''}/>`;
  });
  const fr = m3.frames[S.d3.sec] ? m3.frames[S.d3.sec] : null;
  if (fr) s += `<line x1="${fr.x}" y1="${-py1}" x2="${fr.x}" y2="${-py0}" stroke="var(--accent)" stroke-width=".8" stroke-dasharray="2 2"/>`;
  $('d3Plan').setAttribute('viewBox', `${px0} ${-py1} ${px1 - px0} ${py1 - py0}`); $('d3Plan').setAttribute('preserveAspectRatio', 'xMidYMid meet');
  $('d3Plan').style.aspectRatio = `${px1 - px0} / ${py1 - py0}`;
  $('d3Plan').innerHTML = s + `<text x="${px0 + 2}" y="${-py0 - 2}" font-size="5" fill="var(--muted)">solid: top plane · dashed: bottom plane · y up, x right</text>`;
  // end view at the chosen station: y to the right, z up
  if (!fr) { $('d3Sec').innerHTML = ''; $('d3SecLab').textContent = 'no stations'; return; }
  // the cross-frame is every member whose two ends are both joints of this station (its top and bottom joints on
  // both trusses, plus any mid-width joint): ties, sway diagonals and the side-truss pieces joining them
  const sj = new Set([fr.t, fr.t + m3.n, fr.b, fr.b + m3.n]);
  m3.nodes.forEach((p, i) => { if (i >= 2 * m3.n && Math.abs(p[0] - fr.x) < 1.5) sj.add(i); });
  const near = new Set(); m3.elems.forEach((e, k) => { if (sj.has(e.i) && sj.has(e.j)) near.add(k); });
  const pts = [...sj].map(i => m3.nodes[i]);
  const sz = pts.map(p => p[2]);
  const W = (+S.opts.width || 60) / 2 + 22, z0 = Math.min(0, ...sz) - 12, z1 = Math.max(10, ...sz) + 12;
  let t = `<rect x="${-W}" y="0" width="${2 * W}" height="${Math.min(12, -z0)}" fill="var(--desk)" opacity=".4"/>`;
  const lab = []; const fs = Math.max(3.2, (2 * W) / 26);
  near.forEach(k => {
    const e = m3.elems[k], p = m3.nodes[e.i], q = m3.nodes[e.j], m = r3 && r3.stable ? r3.members[k] : null, zero = m && Math.abs(m.F) < 0.005;
    // zero-force members are drawn dashed in ink so they read as "there, carrying nothing" instead of vanishing
    t += `<line x1="${p[1]}" y1="${-p[2]}" x2="${q[1]}" y2="${-q[2]}" stroke="${zero ? 'var(--ink)' : forceCol(k)}" stroke-width="${e.side === 'cross' ? 1.6 : 2.2}" ${zero ? 'stroke-dasharray="2.5 1.8" opacity=".55"' : ''} stroke-linecap="round"><title>${m3.elemLab[k]}${m ? ` · ${m.F.toFixed(2)} N` : ''}</title></line>`;
    if (m && (S.showForces || S.showElems)) lab.push(`<text x="${(p[1] + q[1]) / 2}" y="${-(p[2] + q[2]) / 2 - 1}" font-size="${fs}" text-anchor="middle" fill="${zero ? 'var(--muted)' : forceCol(k)}" paint-order="stroke" stroke="var(--sheet)" stroke-width="${fs / 3}">${S.showElems ? m3.elemLab[k] : ''}${S.showElems && S.showForces ? ' ' : ''}${S.showForces ? (zero ? '0' : Math.abs(m.F).toFixed(1) + (m.F < 0 ? 'C' : 'T')) : ''}</text>`);
  });
  pts.forEach(p => { t += `<circle cx="${p[1]}" cy="${-p[2]}" r="1.4" fill="var(--sheet)" stroke="var(--ink)" stroke-width=".5"/>`; });
  if (S.showIds) [...sj].forEach(i => { const p = m3.nodes[i]; lab.push(`<text x="${p[1]}" y="${-p[2] - 2.5}" font-size="${fs}" text-anchor="middle" fill="var(--accent)">${m3.nodeLab[i]}</text>`); });
  t += lab.join('') + `<text x="${-W + 2}" y="${-z0 - 2}" font-size="${fs * 0.8}" fill="var(--muted)">dashed: zero force</text>`;
  $('d3Sec').setAttribute('viewBox', `${-W} ${-z1} ${2 * W} ${z1 - z0}`); $('d3Sec').innerHTML = t;
  $('d3SecLab').textContent = `station ${S.d3.sec + 1} at x = ${fr.x.toFixed(0)} mm (${FRAME_SYM[fr.code]})`;
}
function draw3D() {
  const cv = $('c3d'); const { ctx, w, h } = setupCanvas(cv); ctx.clearRect(0, 0, w, h);
  if (!m3) return;
  const H = Math.max(10, +S.height), cyw = Math.cos(v3.yaw), syw = Math.sin(v3.yaw), cp = Math.cos(v3.pitch), sp = Math.sin(v3.pitch);
  const sc = Math.min(w / 330, h / 210) * v3.zoom, ox = w / 2 + (v3.px || 0), oy = h / 2 + 20 + (v3.py || 0);
  const proj = (x, y, z) => { const X1 = x - 100, Y1 = y, Z1 = z - H / 3; const x1 = X1 * cyw - Y1 * syw, y1 = X1 * syw + Y1 * cyw; const y2 = y1 * cp - Z1 * sp, z2 = y1 * sp + Z1 * cp; return [ox + sc * x1, oy - sc * z2, y2]; };
  const poly = (pts, fill, stroke) => { const q = pts.map(p => proj(...p)); ctx.beginPath(); q.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } };
  const Wd = (+S.opts.width || 60) / 2 + 20;
  ctx.globalAlpha = 0.5; poly([[-90, -Wd, 0], [0, -Wd, 0], [0, Wd, 0], [-90, Wd, 0]], cssv('--desk')); poly([[200, -Wd, 0], [290, -Wd, 0], [290, Wd, 0], [200, Wd, 0]], cssv('--desk')); ctx.globalAlpha = 1;
  // members, far ones first
  const U = r3 && r3.stable ? r3.U : null;
  const segs = m3.elems.map((e, k) => {
    const a = m3.nodes[e.i], b = m3.nodes[e.j], pa = proj(...a), pb = proj(...b);
    const m = U ? r3.members[k] : null;
    const col = !m ? cssv('--ink') : m.fails ? cssv('--bad') : m.F < 0 ? cssv('--comp') : m.F > 0 ? cssv('--tens') : cssv('--zero');
    return { e, k, m, pa, pb, d: (pa[2] + pb[2]) / 2, col };
  }).sort((s1, s2) => s2.d - s1.d);
  segs.forEach(s => { ctx.strokeStyle = s.col; ctx.lineWidth = (s.e.side === 'cross' ? 1.4 : 2.2) * Math.sqrt(s.e.n) * (v3.hl === s.k ? 2 : 1); ctx.globalAlpha = s.e.side === 'cross' ? 0.75 : 0.95; ctx.beginPath(); ctx.moveTo(s.pa[0], s.pa[1]); ctx.lineTo(s.pb[0], s.pb[1]); ctx.stroke(); });
  ctx.globalAlpha = 1;
  // deformed shape: every joint moved by its 3D displacement × the drawing's scale
  if (U && S.showDef) {
    const sc = +S.defScale || 20, dp = i => { const p = m3.nodes[i]; return proj(p[0] + sc * U[3 * i], p[1] + sc * U[3 * i + 1], p[2] + sc * U[3 * i + 2]); };
    ctx.save(); ctx.strokeStyle = cssv('--muted'); ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.globalAlpha = 0.9;
    m3.elems.forEach(e => { const a = dp(e.i), b = dp(e.j); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
    ctx.restore();
  }
  if (S.showGhosts !== false) draw3Ghosts(ctx, proj, h);
  // while the tilt is being edited: the upright plane (grey) and each truss's tilted plane (orange)
  if (adj && adj.key === 'tilt3d') {
    const W = +S.opts.width || 60, ph = (+S.d3.tilt || 0) * Math.PI / 180, Hh = Math.max(20, +S.height), x0 = Math.min(...m3.nodes.map(p => p[0])), x1 = Math.max(...m3.nodes.map(p => p[0]));
    [-1, 1].forEach(sd => {
      const y0 = sd * W / 2;
      ctx.globalAlpha = 0.1; poly([[x0, y0, 0], [x1, y0, 0], [x1, y0, Hh], [x0, y0, Hh]], cssv('--muted'), cssv('--muted'));
      ctx.globalAlpha = 0.16; poly([[x0, y0, 0], [x1, y0, 0], [x1, y0 - sd * Hh * Math.sin(ph), Hh * Math.cos(ph)], [x0, y0 - sd * Hh * Math.sin(ph), Hh * Math.cos(ph)]], cssv('--warn'), cssv('--warn'));
    });
    ctx.globalAlpha = 1;
  }
  // supports
  m3.supports.forEach(s => { if (s.ghost) return; const q = proj(...m3.nodes[s.node]); ctx.fillStyle = r3 && r3.lifted.includes(s.node) ? cssv('--warn') : cssv('--ink'); ctx.beginPath(); ctx.arc(q[0], q[1] + 4, 2.6, 0, 7); ctx.fill(); });
  // the book, as a see-through box on the deck
  const deckZ = Math.max(...m3.deck.map(d => m3.nodes[d][2]));
  const [b0, b1] = tr.bookSpan, bw = (+S.bookWidth || 209) / 2, bt = Math.min(+S.bookThick || 32, 80);
  ctx.globalAlpha = 0.18; ctx.lineWidth = 1;
  [[[b0, -bw, deckZ], [b1, -bw, deckZ], [b1, bw, deckZ], [b0, bw, deckZ]], [[b0, -bw, deckZ + bt], [b1, -bw, deckZ + bt], [b1, bw, deckZ + bt], [b0, bw, deckZ + bt]],
   [[b0, -bw, deckZ], [b1, -bw, deckZ], [b1, -bw, deckZ + bt], [b0, -bw, deckZ + bt]], [[b0, bw, deckZ], [b1, bw, deckZ], [b1, bw, deckZ + bt], [b0, bw, deckZ + bt]]].forEach(f => poly(f, cssv('--book'), cssv('--tens')));
  ctx.globalAlpha = 1;
  // axis triad
  const tri = (dx, dy, dz, lab, col) => { const o = proj(-80, -Wd - 10, 0), q = proj(-80 + dx, -Wd - 10 + dy, dz); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.fillStyle = col; ctx.font = '11px IBM Plex Mono, monospace'; ctx.fillText(lab, q[0] + 3, q[1]); };
  tri(25, 0, 0, 'x', cssv('--ink')); tri(0, 25, 0, 'y', cssv('--ink')); tri(0, 0, 25, 'z', cssv('--ink'));
  v3.segs = segs;
  draw3Overlays(ctx, w, h, segs, proj);
  draw3Labels(proj, w, h);
  if (v3.cube) v3.cube();
}
// member forces and results written on the 3D bridge (same switches as the 2D drawing)
function draw3Overlays(ctx, w, h, segs, proj) {
  ctx.save(); ctx.textAlign = 'center';
  const tp = fsTopPad();
  const mid = s => [(s.pa[0] + s.pb[0]) / 2, (s.pa[1] + s.pb[1]) / 2];
  if (S.showElems) {
    ctx.font = '9px IBM Plex Mono, monospace';
    segs.forEach(s => { const [x, y] = mid(s), t = m3.elemLab[s.k], wd = ctx.measureText(t).width + 4; ctx.fillStyle = cssv('--sheet'); ctx.globalAlpha = 0.9; ctx.fillRect(x - wd / 2, y - (S.showForces ? 18 : 6), wd, 11); ctx.globalAlpha = 1; ctx.fillStyle = cssv('--ink'); ctx.fillText(t, x, y + (S.showForces ? -9.5 : 2.5)); });
  }
  if (S.showIds) {
    ctx.font = '500 9px IBM Plex Mono, monospace'; ctx.fillStyle = cssv('--accent');
    m3.nodes.forEach((p, i) => { if (m3.ghost.has(i)) return; const q = proj(...p); ctx.fillText(m3.nodeLab[i], q[0], q[1] - 5); });
  }
  if (S.showForces && r3 && r3.stable) {
    ctx.font = '600 10px IBM Plex Mono, monospace';
    // every member with a force; a back-truss member is labelled only when it differs from its front twin
    const front = {}; segs.forEach(s => { if (s.e.side === 'front' && s.m) front[s.e.e2] = s.m.F; });
    segs.forEach(s => { if (!s.m || Math.abs(s.m.F) < 0.005 || (s.e.side === 'back' && Math.abs((front[s.e.e2] ?? NaN) - s.m.F) < 0.05)) return; const x = (s.pa[0] + s.pb[0]) / 2, y = (s.pa[1] + s.pb[1]) / 2, F = s.m.F;
      const t = Math.abs(F) < 0.005 ? '0' : `${Math.abs(F).toFixed(1)} ${F < 0 ? 'C' : 'T'}`; const wd = ctx.measureText(t).width + 6;
      ctx.fillStyle = cssv('--sheet'); ctx.globalAlpha = 0.85; ctx.fillRect(x - wd / 2, y - 7, wd, 13); ctx.globalAlpha = 1; ctx.fillStyle = s.col; ctx.fillText(t, x, y + 3.5); });
  }
  if (S.resOnDraw && r3 && r3.stable && S.anaMode === '3d') {
    // the 3D model's own numbers: 3 equations per joint, so the count is m + r vs 3j
    const need = (S.load.mBook1 + S.load.mBook2) * S.mat.FS;
    const big = (x, y, a, b, col, al) => { ctx.textAlign = al || 'center'; ctx.font = '700 15px IBM Plex Mono, monospace'; ctx.fillStyle = col; ctx.fillText(a, x, y); ctx.font = '11px IBM Plex Mono, monospace'; ctx.fillStyle = cssv('--muted'); ctx.fillText(b, x, y + 14); };
    const real = m3.supports.filter(s => !s.ghost), m = m3.elems.length, r = real.reduce((t, s) => t + s.dofs.length, 0), j = m3.nodes.length - m3.ghost.size;
    big(w / 2, 22 + tp, `${r3.capKg.toFixed(1)} kg`, `3D capacity · needs ${need.toFixed(1)}`, r3.capKg >= need - 1e-9 ? cssv('--ok') : cssv('--bad'));
    big(12, 22 + tp, `${m + r} vs ${3 * j}`, `m + r vs 3j · ${m + r === 3 * j ? 'determinate' : m + r > 3 * j ? 'indeterminate' : 'too few'}`, cssv('--ink'), 'left');
    big(w - 12, h - 62, `D ${r3.deckDefl.toFixed(3)} mm`, `3D deck deflection · limit ${S.opts.deflLimit}`, r3.deckDefl <= +S.opts.deflLimit ? cssv('--ok') : cssv('--bad'), 'right');
    big(w - 12, h - 24, `${r3.wood.toFixed(0)} mm`, 'wood in the 3D model', cssv('--accent'), 'right');
  } else if (S.resOnDraw && res && res.stable) {
    const need = (S.load.mBook1 + S.load.mBook2) * S.mat.FS;
    const big = (x, y, a, b, col, al) => { ctx.textAlign = al || 'center'; ctx.font = '700 15px IBM Plex Mono, monospace'; ctx.fillStyle = col; ctx.fillText(a, x, y); ctx.font = '11px IBM Plex Mono, monospace'; ctx.fillStyle = cssv('--muted'); ctx.fillText(b, x, y + 14); };
    big(w / 2, 22 + tp, `${res.capKg.toFixed(1)} kg`, `capacity · needs ${need.toFixed(1)}`, res.capKg >= need - 1e-9 ? cssv('--ok') : cssv('--bad'));
    big(12, 22 + tp, `${res.m + res.r} vs ${2 * res.j}`, `m + r vs 2j · ${res.det}`, cssv('--ink'), 'left');
    big(w - 12, h - 62, `D ${res.midDefl.toFixed(3)} mm`, `deflection · limit ${S.opts.deflLimit}`, res.deflOK ? cssv('--ok') : cssv('--bad'), 'right');
    big(w - 12, h - 24, `${res.wood.toFixed(0)} mm`, 'wood used ΣL', cssv('--accent'), 'right');
  }
  ctx.restore();
}
attachOrbit($('c3d'), v3, () => { $('d3Tip').hidden = true; draw3D(); }, { home: { yaw: -0.55, pitch: 0.42 }, live: () => !adj && (bridgeLive() || !!S.free3d) });
// a lock button where the view cube sits: the 3D bridge can be turned on the page without going full screen
(function () {
  const b = document.createElement('button'); b.type = 'button'; b.id = 'free3d'; b.className = 'btn ghost sm freebtn';
  $('c3d').parentElement.appendChild(b);
  window.paintFree3d = () => {
    document.body.classList.toggle('free3d', !!S.free3d);
    const lock = open => `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style="vertical-align:-1px;margin-right:5px"><rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor"/><path d="${open ? 'M5 7V5a3 3 0 0 1 5.8-1' : 'M5 7V5a3 3 0 0 1 6 0v2'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    b.innerHTML = S.free3d ? lock(true) + 'Lock view' : lock(false) + 'Move view';
    b.title = S.free3d ? 'Lock the 3D bridge again (it goes back to its normal view)' : 'Let the mouse turn, pan and zoom the 3D bridge here (it is locked so a scroll cannot move it by accident)';
    b.setAttribute('aria-pressed', String(!!S.free3d));
  };
  b.addEventListener('click', () => {
    S.free3d = !S.free3d;
    if (!S.free3d) { v3.yaw = -0.55; v3.pitch = 0.42; v3.zoom = 1; v3.px = 0; v3.py = 0; }
    paintFree3d(); save(); draw3D();
  });
  paintFree3d();
})();
$('c3d').addEventListener('mousemove', ev => {
  if (v3.drag || !v3.segs) return;
  const r = $('c3d').getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
  let best = null, bd = 49;
  v3.segs.forEach(s => { const [x1, y1] = s.pa, [x2, y2] = s.pb, dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((mx - x1) * dx + (my - y1) * dy) / L2)); const d = (x1 + t * dx - mx) ** 2 + (y1 + t * dy - my) ** 2; if (d < bd) { bd = d; best = s; } });
  const hl = best ? best.k : -1; if (hl !== v3.hl) { v3.hl = hl; draw3D(); }
  if (!best || !best.m) { $('d3Tip').hidden = true; return; }
  const nm = X.TYPE_LABEL[best.e.type] || ({ tie: 'Tie', lat: 'Lateral brace', sway: 'Sway diagonal' })[best.e.type];
  showTip($('d3Tip'), $('c3d'), { q: { x: mx, y: my } }, `<b>${m3.elemLab[best.k]}</b> · ${nm} (${best.e.side}) · joints ${m3.nodeLab[best.e.i]}–${m3.nodeLab[best.e.j]}${best.e.n > 1 ? ` · ${best.e.n} sticks` : ''}<br>${best.m.F.toFixed(2)} N ${best.m.F < 0 ? 'compression' : best.m.F > 0 ? 'tension' : ''} · L ${best.m.L.toFixed(1)} mm · use ${(best.m.util * 100).toFixed(0)}%`);
});
$('c3d').addEventListener('mouseleave', () => { $('d3Tip').hidden = true; if (v3.hl !== -1) { v3.hl = -1; draw3D(); } });

function levels() { return String($('curveLevels').value).split(/[ ,;]+/).map(Number).filter(v => v > 0).sort((a, b) => a - b); }
function curveFor(rows) {
  return levels().map(p => {
    const k = p / 100; let best = null;
    rows.forEach(r => { if (okRow(r) && combined(r) >= k - 1e-12 && combined(r) > 0 && (!best || r.wood < best.wood)) best = r; });
    return { p, best, wood: best ? best.wood : null };
  });
}
function savedCurve(sv) { return levels().map(p => { const k = p / 100; const c = sv.cf.filter(q => q.cf >= k - 1e-12).sort((a, b) => a.wood - b.wood)[0]; return { p, wood: c ? c.wood : null, label: c ? c.label : '' }; }); }
function drawCurve() {
  const cv = $('curveCanvas');
  const sv = shownSaved();
  if (!sweepAll.length && !sv.length) { emptyCanvas(cv, 'Run the sweep above to fill this chart.'); $('curveTbl').innerHTML = ''; $('curveLegend').innerHTML = ''; curvePts = null; return; }
  const groups = sweepAll.length ? groupsOf(sweepAll) : [];
  const series = groups.map((g, gi) => ({ label: g.label, g: g.label, off: isHid(g.label), tip: groupTip(g), color: S.groupBy === 'none' ? cssv('--accent') : gcolor(gi), data: curveFor(g.rows) }));
  sv.forEach(s => series.push({ label: `saved: ${s.name}`, color: gcolor(s.i + 3), dash: true, data: savedCurve(s) }));
  const shown = series.filter(s => !s.off);
  const all = shown.flatMap(s => s.data.filter(d => d.wood != null));
  if (!all.length) { emptyCanvas(cv, series.some(s => s.off) ? 'Every group is hidden: click a group below to show it.' : 'No design passes at these load levels.'); $('curveLegend').innerHTML = legendHTML(series.map(s => ({ color: s.color, label: s.label, dash: s.dash, g: s.g, off: s.off, tip: s.tip }))); $('curveTbl').innerHTML = ''; return; }
  const lv = levels();
  let xr = [lv[0] - 10, lv[lv.length - 1] + 10];
  const yv = all.map(d => d.wood); let yr = [Math.min(...yv) * 0.9, Math.max(...yv) * 1.08];
  if (drawCurve.ref !== sweepAll) { curveView = null; drawCurve.ref = sweepAll; }
  if (curveView) { xr = curveView.x; yr = curveView.y; }
  const { ctx, w, h } = setupCanvas(cv); ctx.clearRect(0, 0, w, h);
  const A = axes(ctx, w, h, xr, yr, 'load level (% of the book load, FS applied)', 'least wood that passes (mm)');
  drawCurve.A = A; drawCurve.ranges = { xr, yr };
  ctx.save(); ctx.beginPath(); ctx.rect(A.P.l, A.P.t, w - A.P.l - A.P.r, h - A.P.t - A.P.b); ctx.clip();
  curvePts = [];
  shown.forEach(s => {
    const ok = s.data.filter(d => d.wood != null);
    line(ctx, ok.map(d => [A.X(d.p), A.Y(d.wood)]), s.color, 2, s.dash ? [6, 4] : []);
    ok.forEach(d => { const x = A.X(d.p), y = A.Y(d.wood); curvePts.push({ d, s, x, y }); ctx.fillStyle = cssv('--sheet'); ctx.strokeStyle = s.color; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); ctx.stroke(); });
  });
  ctx.restore();
  $('curveLegend').innerHTML = legendHTML(series.map(s => ({ color: s.color, label: s.label, dash: s.dash, g: s.g, off: s.off, tip: s.tip })));
  let t = `<thead><tr><th>Load level</th><th>Books (kg)</th>${series.map(s => `<th>${s.label}</th>`).join('')}</tr></thead><tbody>`;
  const bk = sweepCtx ? sweepCtx.bookKg : S.load.mBook1 + S.load.mBook2;
  lv.forEach((p, i) => { t += `<tr><td>${p}%</td><td>${(bk * p / 100).toFixed(2)}</td>${series.map(s => { const d = s.data[i]; return `<td>${d.wood != null ? d.wood.toFixed(0) + ' mm' : '—'}</td>`; }).join('')}</tr>`; });
  $('curveTbl').innerHTML = t + '</tbody>';
}
$('curveLevels').addEventListener('change', () => { curveView = null; drawCurve(); });
// the required-wood curve moves like the other 2D charts: wheel zooms around the pointer, drag (or right drag) moves, a click on empty space goes home
var curveView = null;
(function () {
  const cv = $('curveCanvas'); let pd = null;
  const inv = (px, py) => { const A = drawCurve.A, R = drawCurve.ranges, W = cv.clientWidth, H = cv.clientHeight;
    return [R.xr[0] + (px - A.P.l) / (W - A.P.r - A.P.l) * (R.xr[1] - R.xr[0]), R.yr[0] + (H - A.P.b - py) / (H - A.P.b - A.P.t) * (R.yr[1] - R.yr[0])]; };
  cv.addEventListener('contextmenu', ev => ev.preventDefault());
  cv.addEventListener('wheel', ev => { if (!drawCurve.A) return; ev.preventDefault(); const r = cv.getBoundingClientRect(), [cx, cy] = inv(ev.clientX - r.left, ev.clientY - r.top), R = drawCurve.ranges, f = wheelDir(ev) > 0 ? 1 / 1.15 : 1.15;
    curveView = { x: [cx - (cx - R.xr[0]) * f, cx + (R.xr[1] - cx) * f], y: [cy - (cy - R.yr[0]) * f, cy + (R.yr[1] - cy) * f] }; drawCurve(); }, { passive: false });
  cv.addEventListener('mousedown', ev => { if (!drawCurve.A) return; pd = { x: ev.clientX, y: ev.clientY, R: JSON.parse(JSON.stringify(drawCurve.ranges)), moved: false }; cv.style.cursor = 'grabbing'; });
  window.addEventListener('mousemove', ev => { if (!pd) return; const A = drawCurve.A, R = pd.R, W = cv.clientWidth, H = cv.clientHeight;
    const dx = (ev.clientX - pd.x) / (W - A.P.l - A.P.r) * (R.xr[1] - R.xr[0]), dy = (ev.clientY - pd.y) / (H - A.P.t - A.P.b) * (R.yr[1] - R.yr[0]);
    if (Math.abs(ev.clientX - pd.x) + Math.abs(ev.clientY - pd.y) > 3) pd.moved = true; if (!pd.moved) return;
    curveView = { x: [R.xr[0] - dx, R.xr[1] - dx], y: [R.yr[0] + dy, R.yr[1] + dy] }; $('curveTip').hidden = true; drawCurve(); });
  window.addEventListener('mouseup', ev => { if (!pd) return; const moved = pd.moved; pd = null; cv.style.cursor = 'grab';
    if (!moved && ev.target === cv && ev.button === 0) { const n = nearest(curvePts, ev, cv); if (n && n.q.d.best) loadParams(n.q.d.best); else if (!n && curveView && keys().click2d !== 'none') { curveView = null; drawCurve(); } } });
  cv.style.cursor = 'grab';
  addNavPad(cv.parentElement, d => {
    if (!drawCurve.A) return; const R = drawCurve.ranges, wx = R.xr[1] - R.xr[0], wy = R.yr[1] - R.yr[0];
    if (d === 'home') { curveView = null; drawCurve(); return; }
    const f = d === 'in' ? 1 / 1.25 : d === 'out' ? 1.25 : 1, cx = (R.xr[0] + R.xr[1]) / 2, cy = (R.yr[0] + R.yr[1]) / 2;
    const sx = d === 'left' ? -0.15 * wx : d === 'right' ? 0.15 * wx : 0, sy = d === 'up' ? 0.15 * wy : d === 'down' ? -0.15 * wy : 0;
    curveView = { x: [cx - wx * f / 2 + sx, cx + wx * f / 2 + sx], y: [cy - wy * f / 2 + sy, cy + wy * f / 2 + sy] }; drawCurve();
  });
})();
$('curveCanvas').addEventListener('mousemove', ev => {
  const n = nearest(curvePts, ev, $('curveCanvas'));
  showTip($('curveTip'), $('curveCanvas'), n, n ? `${n.q.s.label}<br>${n.q.d.p}% load<br>${n.q.d.best ? summaryOf(n.q.d.best) : n.q.d.label}<br>wood ${n.q.d.wood.toFixed(0)} mm` : '');
});
$('curveCanvas').addEventListener('mouseleave', () => { $('curveTip').hidden = true; });


// history
function snapshot() {
  const keys = ['name', 'family', 'height', 'panels', 'ratio', 'sideAngle', 'sideLean', 'overall', 'bookLen', 'approachDiag', 'edgeVert', 'deskVert', 'deskMode', 'deskPanels', 'overlap', 'deskEnds', 'bottom', 'curve', 'supportMode', 'supportOffset', 'sticks', 'pattern', 'diagLeft', 'diagMiddle', 'vertPreset', 'vertLeft'];
  const o = {}; keys.forEach(k => { o[k] = JSON.parse(JSON.stringify(S[k])); }); return o;
}
$('logHere').addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); $('logDesign').click(); });
$('logDesign').addEventListener('click', () => {
  if (!res.stable) { $('histMsg').textContent = 'This design is unstable, so there is nothing to log.'; return; }
  backupBridge('logged by hand', true); $('histMsg').textContent = 'Logged.'; toast('Design logged in the history.');
});
$('clearLog').addEventListener('click', () => {
  if ($('clearLog').dataset.armed !== '1') { $('clearLog').dataset.armed = '1'; $('clearLog').textContent = 'Click again to clear'; setTimeout(() => { $('clearLog').dataset.armed = ''; $('clearLog').textContent = 'Clear history'; }, 3000); return; }
  try { localStorage.removeItem(BKEY); } catch (e) {}
  $('clearLog').dataset.armed = ''; $('clearLog').textContent = 'Clear history'; $('histMsg').textContent = 'History cleared.'; S.histBase = null; save(); paintBackups(); renderHistory();
});
// every bridge you have had: copies saved before resets, presets and file loads, after your changes settle, and any logged by hand
function renderHistory() {
  const tb = $('histTbl'); if (!tb) return;
  const list = readBackups().filter(q => q.sum && q.sum.wood);
  if (!list.length) { tb.innerHTML = '<tbody><tr><td class="l">No bridges in the history yet. It fills itself as you work: a copy is saved before every reset, preset or file load, and after each change you make.</td></tr></tbody>'; return; }
  const bi = Math.max(0, list.findIndex(q => q.when === S.histBase)), b = list[bi].sum;
  const f = v => (Math.round(v * 10) / 10).toString();
  let t = `<thead><tr><th>Base</th><th class="l">When</th><th class="l">Design</th><th class="l">Saved because</th><th>Wood (mm)</th><th>Capacity (kg)</th><th>D (mm)</th><th>Passes</th><th>Δ wood</th><th>Δ capacity</th><th>Wood per 1% capacity</th><th></th></tr></thead><tbody>`;
  list.forEach((q, i) => {
    const r = q.sum, dW = r.wood - b.wood, dWp = dW / b.wood * 100, dC = b.capKg ? (r.capKg - b.capKg) / b.capKg * 100 : 0;
    const ratio = i === bi || Math.abs(dC) < 1e-6 ? '—' : (dW / dC).toFixed(1) + ' mm';
    const tm = new Date(q.when);
    t += `<tr class="${i === bi ? 'base' : ''}"><td><input type="radio" name="base" data-b="${i}" ${i === bi ? 'checked' : ''} aria-label="Compare the others with this one"></td>
      <td class="l">${tm.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${tm.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td><td class="l">${escH(q.name)} · ${escH(bridgeLine(q.bridge))}</td><td class="l">${escH(q.why)}</td>
      <td>${r.wood.toFixed(0)}</td><td>${(+r.capKg).toFixed(1)}</td><td>${r.deflection != null ? (+r.deflection).toFixed(3) : '—'}</td><td>${r.passes ? 'yes' : 'no'}</td>
      <td class="${dW < 0 ? 'pos' : dW > 0 ? 'neg' : ''}">${i === bi ? '—' : (dW > 0 ? '+' : '') + dW.toFixed(0) + ' mm (' + (dWp > 0 ? '+' : '') + dWp.toFixed(1) + '%)'}</td>
      <td class="${dC > 0 ? 'pos' : dC < 0 ? 'neg' : ''}">${i === bi ? '—' : (dC > 0 ? '+' : '') + dC.toFixed(1) + '%'}</td><td>${ratio}</td>
      <td><button type="button" class="btn ghost sm" data-h="${i}" title="Change your bridge back to this one">Load</button></td></tr>`;
    void f;
  });
  tb.innerHTML = t + '</tbody>';
  tb.querySelectorAll('input[data-b]').forEach(el => el.addEventListener('change', () => { S.histBase = list[+el.dataset.b].when; save(); renderHistory(); }));
  tb.querySelectorAll('button[data-h]').forEach(el => el.addEventListener('click', () => { const q = list[+el.dataset.h]; applyBridge(q.bridge, 'before loading a bridge from the history'); toast(`Loaded the bridge from ${new Date(q.when).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
}
function bridgeLine(b) {
  if (!b) return '';
  const pat = b.family === 'warren' ? 'Warren' : (PNAME[b.pattern] || b.pattern || 'grid');
  return `${pat} · ${b.panels} panels · h ${b.height}${b.bottom && b.bottom !== 'flat' ? ` · ${b.bottom} ${b.curve}` : ''}${b.topShape && b.topShape !== 'flat' ? ` · ${b.topShape} top` : ''}${b.deskEnds && b.deskEnds !== 'truss' ? ` · ${b.deskEnds}` : ''}`;
}

window.addEventListener('resize', () => { clearTimeout(window._rt); window._rt = setTimeout(drawTrackers, 150); });
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawTrackers); } catch (e) {}


// ---------- the sweep data sheet: what was run, over which ranges, at which steps (and the step really reached if it was sampled)
const DIMNAME = { height: 'h · height (mm)', ratio: 'panel taper', curve: 'p · bottom-chord curve (mm)', supportOffset: 'support offset (mm)', overlap: 'overlap on each desk (mm)', panels: 'panels', pv: 'pattern · side angle · verticals', lx: 'load shape · position', bookKg: 'book mass (kg)', topEnd: 'Δh (mm)', botEnd: 'Δp (mm)', brace3: '3D bracing set', tilt3: '3D tilt (°)', width3: '3D width (mm)', ties3: '3D bottom ties', claw: 'claws', brace: 'edge braces' };
function dimLabel(nm) { if (DIMNAME[nm]) return DIMNAME[nm]; if (nm.startsWith('c_')) { const ch = CHOICES.find(q => 'c_' + q.key === nm); return ch ? ch.name : nm; } if (nm.startsWith('st_')) return 'sticks: ' + (STICK_GROUPS[nm.slice(3)] || nm.slice(3)); if (nm.startsWith('fc_')) return 'focused member ' + (+nm.slice(3) + 1) + ' sticks'; return nm; }
function sheetFor(Dm, n, kind) {
  const total = Dm.total, swept = Dm.dims.filter(d => d[1].length > 1), dcount = swept.length;
  const f = n < total && dcount ? Math.pow(total / n, 1 / dcount) : 1;   // sampling n of total spreads them about f steps apart in each swept input
  const rows = swept.map(([nm, arr]) => {
    const nums = arr.every(v => typeof v === 'number');
    if (nums) { const lo = Math.min(...arr), hi = Math.max(...arr), st = arr.length > 1 ? Math.abs(arr[1] - arr[0]) : 0;
      return { name: dimLabel(nm), from: +lo.toFixed(4), to: +hi.toFixed(4), step: +st.toFixed(4), count: arr.length, eff: f > 1.0001 ? +(st * f).toFixed(3) : null }; }
    const lab = v => v == null ? 'as set' : nm === 'pv' ? `${PNAME[v.pattern] || v.pattern}${v.family !== 'warren' && v.sideAngle !== 90 ? ' ' + v.sideAngle + '°' : ''}${v.vert && v.vert !== 'current' && v.vert !== '—' ? ' (verticals ' + v.vert + ')' : ''}`
      : nm === 'lx' ? `${LOAD_SHAPES[v.loadShape] || v.loadShape}${v.loadX != null ? ' at ' + v.loadX + ' mm' : ''}` : nm.startsWith('c_') ? ((CHOICES.find(q => 'c_' + q.key === nm) || { opts: {} }).opts[v] || String(v))
      : nm === 'brace3' ? ((BRACE_SETS[v] || {}).name || String(v)) : typeof v === 'object' ? Object.values(v).filter(x => x != null && x !== '—').join(' · ') : String(v);
    return { name: dimLabel(nm), list: arr.map(lab), count: arr.length, eff: f > 1.0001 ? `about 1 in ${Math.max(1, Math.round(f))}` : null };
  });
  return { kind, when: new Date().toISOString(), tested: n, total, sampled: n < total, analysis: S.anaMode === '3d' ? '3D' : '2D', FS: S.mat.FS, bookKg: S.load.mBook1 + S.load.mBook2, defl: S.opts.deflLimit, minOv: +S.opts.minOverlap,
    fixed: `${S.name} · ${bridgeLine(bridgeState())}`, rows };
}
function sheetHTML(sh) {
  if (!sh) return '<p class="note">This result has no data sheet (it was made before sheets were added). Re-run the sweep to get one.</p>';
  const f = v => typeof v === 'number' ? (+v.toFixed(4)).toString() : v;
  return `<p class="note" style="margin:0 0 6px"><b>${sh.kind}</b> · ${new Date(sh.when).toLocaleString()} · ${sh.analysis} analysis · tested <b>${sh.tested.toLocaleString()}</b> of ${sh.total.toLocaleString()} designs${sh.sampled ? ' (an evenly spread random sample)' : ' (every design)'} · rules: FS ${sh.FS}, books ${(+sh.bookKg).toFixed(2)} kg, deflection ≤ ${sh.defl} mm, overlap ≥ ${sh.minOv} mm.</p>
    <div class="tablewrap"><table><thead><tr><th class="l">Swept input</th><th>From</th><th>To</th><th>Step set</th><th>Values</th><th>${sh.sampled ? 'Step reached (about)' : 'Step reached'}</th></tr></thead><tbody>${sh.rows.map(r => r.list
      ? `<tr><td class="l">${escH(r.name)}</td><td class="l" colspan="3">${escH(r.list.join(' / '))}</td><td>${r.count}</td><td>${r.eff || 'all'}</td></tr>`
      : `<tr><td class="l">${escH(r.name)}</td><td>${f(r.from)}</td><td>${f(r.to)}</td><td>${f(r.step)}</td><td>${r.count}</td><td>${r.eff != null ? '≈ ' + f(r.eff) : f(r.step)}</td></tr>`).join('') || '<tr><td class="l" colspan="6">Nothing was swept.</td></tr>'}</tbody></table></div>
    <p class="note" style="margin:6px 0 0">Everything else was fixed at: ${escH(sh.fixed)}.${sh.sampled ? ' "Step reached" is how far apart the sampled designs are, on average, in each swept input: the sample covers the whole range, but less finely than the step set.' : ''}</p>`;
}
function sheetCSV(sh) {
  const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const head = [['Run', sh.kind], ['When', sh.when], ['Analysis', sh.analysis], ['Designs tested', sh.tested], ['Designs in the ranges', sh.total], ['Sampled', sh.sampled ? 'yes' : 'no'], ['FS', sh.FS], ['Books (kg)', sh.bookKg], ['Deflection limit (mm)', sh.defl], ['Min overlap (mm)', sh.minOv], ['Fixed inputs', sh.fixed], []];
  const tbl = [['Swept input', 'From', 'To', 'Step set', 'Values', 'Choices', 'Step reached (about)']].concat(sh.rows.map(r => r.list ? [r.name, '', '', '', r.count, r.list.join(' / '), r.eff || 'all'] : [r.name, r.from, r.to, r.step, r.count, '', r.eff != null ? r.eff : r.step]));
  return head.concat(tbl).map(row => row.map(q).join(',')).join('\n');
}
function paintSheet() {
  const box = $('sheetBody'); if (!box) return;
  box.innerHTML = sweepAll.length ? sheetHTML(sweepCtx && sweepCtx.sheet) : '<p class="note">Run a sweep to see its data sheet.</p>';
  const c = sweepCtx || {};
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#rulesBox')) return;
  $('rcFS').value = c.FS != null ? c.FS : S.mat.FS; $('rcBook').value = c.bookKg != null ? +(+c.bookKg).toFixed(3) : S.load.mBook1 + S.load.mBook2;
  $('rcDefl').value = c.defl != null ? c.defl : S.opts.deflLimit; $('rcOv').value = c.minOv != null ? c.minOv : S.opts.minOverlap;
}
$('sheetCsv').addEventListener('click', () => { if (!sweepCtx || !sweepCtx.sheet) { toast('Run a sweep first.', true); return; } saveFile(fileBase() + '_sweep_sheet.csv', sheetCSV(sweepCtx.sheet)); });
// re-check the pass rules on results already computed: forces scale with the load, so this is exact and instant
$('rcGo').addEventListener('click', () => {
  if (!sweepAll.length || !sweepCtx) { toast('Run a sweep first.', true); return; }
  const FS = +$('rcFS').value, bk = +$('rcBook').value, defl = +$('rcDefl').value, ov = +$('rcOv').value;
  if (!(FS > 0 && bk > 0 && defl > 0 && ov >= 0)) { toast('Each rule needs a number above 0.', true); return; }
  const c = sweepCtx; if (!c.base) c.base = { FS: c.FS, bookKg: c.bookKg };
  const k = (FS * bk) / (c.base.FS * c.base.bookKg), need = bk * FS;
  let pass = 0;
  sweepAll.forEach(r => {
    if (r.D0 == null) { r.D0 = r.D; r.util0 = r.util; }
    r.D = r.D0 * k; r.util = r.util0 * k; r.edgeOK = r.overlap >= ov - 1e-9;
    r.passes = r.envOK && r.edgeOK && r.slipOK !== false && r.capKg >= need - 1e-9 && r.D <= defl + 1e-12;
    if (r.passes) pass++;
  });
  Object.assign(c, { FS, bookKg: bk, defl, minOv: ov });
  sweepRows = sweepAll.filter(r => r.passes).sort((x, y) => x.wood - y.wood || x.util - y.util).slice(0, 30);
  if ($('rcInputs').checked) {
    S.mat.FS = FS; S.opts.deflLimit = defl; S.opts.minOverlap = ov; const old = S.load.mBook1 + S.load.mBook2, f1 = old > 0 ? S.load.mBook1 / old : 0.6; S.load.mBook1 = +(bk * f1).toFixed(3); S.load.mBook2 = +(bk - S.load.mBook1).toFixed(3);
    update(); lastSig = sweepSig();
  }
  const note = `Re-checked ${sweepAll.length.toLocaleString()} designs with FS ${FS}, books ${bk} kg, deflection ≤ ${defl} mm, overlap ≥ ${ov} mm: ${pass.toLocaleString()} pass.` + (sweepMode === 'full' ? ' (Large search: only the designs it kept are re-checked, so a few new best designs could be missing until you re-run it.)' : '');
  $('rcMsg').textContent = note; $('sweepMsg').textContent = note + ' ' + $('sweepMsg').textContent.replace(/^Re-checked[^)]*?pass\.(\s*\(Large[^)]*\))?\s*/, '');
  queueSweepSave.ref = null; renderSweep(); drawTrackers(); checkStale(); toast(`Re-checked: ${pass.toLocaleString()} pass with the new rules.`);
});

// ---------- sweep between two bridges: what differs becomes the sweep, split into the same number of steps
const AB_NUM = [   // [sweep key, label, read a value from a bridge, input ids prefix]
  ['H', 'h · height at mid-span (mm)', b => +b.height],
  ['T', 'Δh · top chord at the desk edges (mm)', b => +b.topEnd || 0],
  ['Q', 'Δp · bottom chord at the desk edges (mm)', b => +b.botEnd || 0],
  ['D', 'p · bottom-chord curve (mm)', b => b.bottom === 'flat' ? 0 : +b.curve],
  ['R', 'panel width taper', b => +b.ratio],
  ['A', 'angle of the sides (°)', b => +b.sideAngle],
  ['O', 'overlap on each desk (mm)', b => b.deskMode === 'length' ? +b.overlap : null],
  ['S', 'support distance from the edge (mm)', b => +b.supportOffset || 0],
  ['M', 'book mass (kg)', b => b.load ? +b.load.mBook1 + +b.load.mBook2 : null],
];
const AB_CAT = [   // [sweep key, label, value]
  ['N', 'panels across the span', b => +b.panels],
  ['P', 'pattern', b => b.family === 'warren' ? 'warren' : b.pattern],
  ['V', 'verticals', b => b.family === 'warren' ? null : (b.vertPreset === 'none' ? 'none' : 'all')],
  ['C', 'claws', b => b.claw],
  ['B', 'edge braces', b => b.brace],
];
const AB_FIXED = { bottom: 'bottom-chord shape', topShape: 'top-chord shape', deskEnds: 'foot style', deskMode: 'desk panels mode', deskPanels: 'panels on each desk', supportMode: 'supports', edgeBear: 'ends bear on the edge', sticks: 'stick counts', loads: 'custom loads', bookLen: 'book length', tableThick: 'table thickness' };
let abFiles = { A: null, B: null }, abOver = {};
function abSources() {
  const o = [['cur', 'The bridge on screen now']];
  readBackups().forEach((q, i) => o.push(['bk' + i, `Earlier: ${new Date(q.when).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${q.name}${q.sum && q.sum.wood ? ' · ' + Math.round(q.sum.wood) + ' mm' : ''}`]));
  (typeof saved !== 'undefined' ? saved : []).forEach((sv, i) => { if (sv.bridge) o.push(['sv' + i, 'Saved: ' + sv.name]); });
  o.push(['file', 'Open a bridge file…']);
  return o;
}
function abGet(side) {
  const v = $('abSrc' + side).value;
  if (v === 'cur') return snapBridge();
  if (v.startsWith('bk')) { const q = readBackups()[+v.slice(2)]; return q ? q.bridge : null; }
  if (v.startsWith('sv')) { const sv = saved[+v.slice(2)]; return sv && sv.bridge; }
  if (v === 'file') return abFiles[side];
  return null;
}
function abPlan() {
  const A = abGet('A'), B = abGet('B'); if (!A || !B) return null;
  const n = Math.max(1, Math.min(200, Math.round(+$('abSteps').value || 10))), ext = Math.max(0, +$('abExt').value || 0) / 100;
  const rows = [], swOnNew = {}, vals = {}, sel = {};
  AB_NUM.forEach(([k, lab, f]) => {
    const va = f(A), vb = f(B), ov = abOver[k] || {};
    if (va == null || vb == null || Math.abs(va - vb) < 1e-9) { rows.push({ k, lab, a: va, b: vb, same: true }); return; }
    if (ov.off) { rows.push({ k, lab, a: va, b: vb, same: true, off: true }); return; }
    const lo = Math.min(va, vb), hi = Math.max(va, vb), gap = hi - lo;
    const from = ov.from != null ? ov.from : lo - ext * gap, to = ov.to != null ? ov.to : hi + ext * gap, step = ov.step != null && ov.step > 0 ? ov.step : gap / n;
    const r4 = v => +v.toFixed(4);
    swOnNew[k] = true; vals['sw' + k + '0'] = r4(from); vals['sw' + k + '1'] = r4(to); vals['sw' + k + 's'] = r4(step);
    rows.push({ k, num: true, lab, a: va, b: vb, from: r4(from), to: r4(to), step: r4(step), count: Math.max(1, Math.floor((to - from) / step + 1e-6) + 1) });
  });
  AB_CAT.forEach(([k, lab, f]) => {
    const va = f(A), vb = f(B);
    if (va === vb || va == null || vb == null) { rows.push({ k, lab, a: va, b: vb, same: true }); return; }
    if ((abOver[k] || {}).off) { rows.push({ k, lab, a: va, b: vb, same: true, off: true }); return; }
    swOnNew[k] = true;
    if (k === 'N') { const lo = Math.min(va, vb), hi = Math.max(va, vb), lo2 = Math.max(2, Math.round(lo - ext * (hi - lo))), hi2 = Math.min(12, Math.round(hi + ext * (hi - lo))); sel.panels = {}; Object.keys(SW.panels).forEach(q => { sel.panels[q] = +q >= lo2 && +q <= hi2; }); rows.push({ k, lab, a: va, b: vb, from: lo2, to: hi2, step: 1, count: hi2 - lo2 + 1 }); return; }
    const g = { P: 'patterns', V: 'verts', C: 'claw', B: 'brace' }[k]; sel[g] = {}; Object.keys(SW[g]).forEach(q => { sel[g][q] = q === String(va) || q === String(vb); });
    rows.push({ k, lab, a: va, b: vb, from: 'both', count: 2 });
  });
  const fixedDiff = Object.keys(AB_FIXED).filter(k => JSON.stringify(A[k]) !== JSON.stringify(B[k]));
  const total = rows.filter(r => !r.same).reduce((t, r) => t * r.count, 1);
  return { A, B, n, rows, swOnNew, vals, sel, fixedDiff, total };
}
function abPaint() {
  ['A', 'B'].forEach(s => { const b = abGet(s); $('abSum' + s).textContent = b ? `${b.name || 'Design'} · ${b.family === 'warren' ? 'Warren' : b.pattern} · ${b.panels} panels · h ${b.height}` : ($('abSrc' + s).value === 'file' ? 'Choose a file…' : ''); });
  const P = abPlan();
  if (!P) { $('abTbl').innerHTML = ''; $('abTotal').textContent = 'Pick both bridges.'; $('abGo').disabled = $('abRun').disabled = true; return; }
  const f = v => v == null ? '—' : typeof v === 'number' ? (+v.toFixed(3)).toString() : String(v);
  $('abTbl').innerHTML = `<thead><tr><th>Sweep</th><th class="l">Input</th><th>A</th><th>B</th><th>from</th><th>to</th><th>step</th><th>Values</th></tr></thead><tbody>${P.rows.map(r => r.same && !r.off
    ? `<tr><td></td><td class="l same">${r.lab}</td><td class="same">${f(r.a)}</td><td class="same">${f(r.b)}</td><td class="same" colspan="3">same in both: fixed</td><td class="same">1</td></tr>`
    : r.off ? `<tr><td><input type="checkbox" data-abon="${r.k}"></td><td class="l">${r.lab}</td><td>${f(r.a)}</td><td>${f(r.b)}</td><td class="same" colspan="3">fixed (from Bridge ${$('abBase').value})</td><td>1</td></tr>`
    : `<tr><td><input type="checkbox" data-abon="${r.k}" checked></td><td class="l"><b>${r.lab}</b></td><td>${f(r.a)}</td><td>${f(r.b)}</td>${r.num
      ? ['from', 'to', 'step'].map(q => `<td><input type="number" step="any" data-abk="${r.k}" data-abq="${q}" value="${r[q]}"></td>`).join('')
      : `<td colspan="3">${r.from === 'both' ? 'both choices' : `${f(r.from)} to ${f(r.to)}`}</td>`}<td>${r.count}</td></tr>`).join('')}</tbody>`;
  const nd = P.rows.filter(r => !r.same).length;
  $('abTotal').innerHTML = nd ? `<b>${P.total.toLocaleString()} designs</b> (${nd} input${nd > 1 ? 's' : ''} differ).${P.total > 60000 ? ' That is more than a normal sweep runs (60,000): use fewer steps, or use the large search after setting it up.' : ''}${P.fixedDiff.length ? ` These also differ but can't be swept, so they come from Bridge ${$('abBase').value}: ${P.fixedDiff.map(k => AB_FIXED[k]).join(', ')}.` : ''}` : 'The two bridges are the same in every sweepable input.';
  $('abGo').disabled = $('abRun').disabled = !nd; $('abRun').disabled = !nd || P.total > 60000;
}
function abOpen() {
  const opts = abSources().map(([v, l]) => `<option value="${v}">${escH(l)}</option>`).join('');
  $('abSrcA').innerHTML = opts; $('abSrcB').innerHTML = opts;
  $('abSrcA').value = 'cur'; $('abSrcB').value = readBackups().length > 1 ? 'bk1' : 'file';
  $('abSteps').value = S.abSteps || 10; $('abExt').value = S.abExt || 0;
  $('abModal').hidden = false; abPaint();
}
let abPickSide = null;
['A', 'B'].forEach(s => $('abSrc' + s).addEventListener('change', () => { abOver = {}; if ($('abSrc' + s).value === 'file') { abPickSide = s; $('abFile').value = ''; $('abFile').click(); } abPaint(); }));
$('abFile').addEventListener('change', async () => {
  const f = $('abFile').files[0]; if (!f || !abPickSide) return;
  try { const doc = JSON.parse(await f.text()); if (doc.format !== 'se310-truss-bridge' || !doc.bridge) throw 0; abFiles[abPickSide] = Object.assign({ name: doc.name }, doc.bridge); }
  catch (e) { toast('That is not a bridge file.', true); }
  abPaint();
});
['abSteps', 'abExt', 'abBase'].forEach(id => $(id).addEventListener('input', () => { if (id !== 'abBase') Object.keys(abOver).forEach(k => { abOver[k] = { off: abOver[k].off }; }); S.abSteps = +$('abSteps').value; S.abExt = +$('abExt').value; abPaint(); }));
$('abOpen').addEventListener('click', abOpen);
$('abTbl').addEventListener('change', ev => {
  const t = ev.target;
  if (t.dataset.abon) { abOver[t.dataset.abon] = Object.assign({}, abOver[t.dataset.abon], { off: !t.checked }); abPaint(); return; }
  if (t.dataset.abk) { const v = +t.value; if (!isFinite(v)) return; abOver[t.dataset.abk] = Object.assign({}, abOver[t.dataset.abk], { [t.dataset.abq]: v }); abPaint(); }
});
$('abNo').addEventListener('click', () => { $('abModal').hidden = true; });
$('abModal').addEventListener('keydown', ev => { if (ev.key === 'Escape') $('abModal').hidden = true; });
function abApply(run) {
  const P = abPlan(); if (!P) return;
  const base = JSON.parse(JSON.stringify($('abBase').value === 'B' ? P.B : P.A));
  // every switch off except the inputs that differ
  const on = {}; Object.keys(S.swOn).forEach(k => { on[k] = false; }); Object.assign(on, P.swOnNew);
  const swVals = {}; SW_IDS.forEach(id => { swVals[id] = $(id).value; }); Object.assign(swVals, P.vals);
  const swSel = JSON.parse(JSON.stringify(SW)); Object.keys(P.sel).forEach(g => { swSel[g] = P.sel[g]; });
  if (P.swOnNew.O) base.deskMode = 'length';
  Object.assign(base, { swOn: on, swVals, swSel });
  applyBridge(base, 'before a sweep between two bridges');
  $('abModal').hidden = true;
  $('s-sweep') && ($('s-sweep').open = true);
  const what = P.rows.filter(r => !r.same).map(r => `${r.lab.split(' (')[0]} ${r.from === 'both' ? `${r.a} / ${r.b}` : `${+(+r.from).toFixed(3)} → ${+(+r.to).toFixed(3)}`}`).join(' · ');
  const box = $('abDone'); box.hidden = false;
  box.innerHTML = `<span><b>Your truss system is now the sweep</b>: ${P.total.toLocaleString()} designs between Bridge A and Bridge B (${escH(what)}). The inputs on the left now hold Bridge ${$('abBase').value}, and only these sweep switches are on.</span>${run ? '' : '<button type="button" class="btn acc sm" id="abDoneRun">Run sweep now</button>'}<button type="button" class="btn ghost sm" id="abDoneUndo">Undo</button>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' }); box.classList.remove('flashbox'); void box.offsetWidth; box.classList.add('flashbox');
  if ($('abDoneRun')) $('abDoneRun').addEventListener('click', () => { box.hidden = true; $('runSweep').click(); });
  $('abDoneUndo').addEventListener('click', () => { const q = readBackups()[0]; if (q) { applyBridge(q.bridge, 'before undoing a two-bridge sweep'); toast('Back to the bridge and sweep you had before.'); } box.hidden = true; });
  toast(`Sweep set up: ${P.total.toLocaleString()} designs between the two bridges.`);
  if (run) setTimeout(() => { box.hidden = true; $('runSweep').click(); }, 50);
}
$('abGo').addEventListener('click', () => abApply(false));
$('abRun').addEventListener('click', () => abApply(true));

// ---------- mouse and keys (☰ → Mouse and keys). Defaults follow Autodesk Inventor:
// left drag rotates (3D), right or middle drag pans, the wheel zooms; Shift + middle orbits, Ctrl + middle zooms by dragging,
// double-click middle / F6 / Home = home view. Arrow keys rotate (3D) or pan (2D), Shift + arrows pan, + and − zoom.
function keys() { if (!S.keys) S.keys = {}; return Object.assign(S.keys, Object.assign({ rot: 'left', pan: 'right', wheel: 'normal', nav: true, click2d: 'home' }, S.keys)); }
function navMode(ev, is3D) {
  const K = keys(), b = ev.button;
  if (b === 1 && ev.shiftKey) return is3D ? 'rot' : 'pan';
  if (b === 1 && ev.ctrlKey) return 'zoom';
  const name = b === 0 ? (ev.shiftKey ? 'shiftleft' : 'left') : b === 1 ? 'middle' : 'right';
  if (K.pan === name) return 'pan';
  if (K.rot === name) return is3D ? 'rot' : null;
  if (name === 'shiftleft' && K.rot === 'left') return is3D ? 'rot' : null;
  if (name === 'middle' || name === 'right') return 'pan';   // the button left free still pans
  return null;
}
function wheelDir(ev) { return (ev.deltaY < 0 ? 1 : -1) * (keys().wheel === 'reverse' ? -1 : 1); }
function tween(v, to, redraw) {
  const from = { yaw: v.yaw, pitch: v.pitch }, t0 = performance.now();
  let dy = to.yaw - from.yaw; dy = ((dy + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const step = () => { const k = Math.min(1, (performance.now() - t0) / 280), e = k * (2 - k); v.yaw = from.yaw + dy * e; v.pitch = from.pitch + (to.pitch - from.pitch) * e; if (to.zoom != null) { v.zoom = 1; v.px = 0; v.py = 0; } redraw(); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function attachOrbit(cv, v, redraw, o) {
  o = o || {};
  const home = () => tween(v, { yaw: o.home.yaw, pitch: o.home.pitch, zoom: 1 }, redraw);
  let lastMid = 0;
  cv.addEventListener('contextmenu', ev => ev.preventDefault());
  cv.addEventListener('mousedown', ev => {
    if (o.live && !o.live()) return;
    ev.preventDefault(); cv.focus({ preventScroll: true });
    let mode = navMode(ev, true) || 'rot';
    if (ev.button === 0 && o.leftPan && o.leftPan() && mode === 'rot') mode = 'pan';
    if (ev.button === 1) { const t = performance.now(); if (t - lastMid < 350) { home(); lastMid = 0; return; } lastMid = t; }
    v.drag = { x: ev.clientX, y: ev.clientY, yaw: v.yaw, pitch: v.pitch, px: v.px || 0, py: v.py || 0, zoom: v.zoom, mode, moved: false, button: ev.button };
    cv.style.cursor = mode === 'pan' ? 'move' : mode === 'zoom' ? 'ns-resize' : 'grabbing';
  });
  window.addEventListener('mousemove', ev => {
    const d = v.drag; if (!d) return;
    const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.mode === 'pan') { v.px = d.px + dx; v.py = d.py + dy; }
    else if (d.mode === 'zoom') v.zoom = Math.max(0.3, Math.min(8, d.zoom * Math.exp(-dy * 0.01)));
    else { v.yaw = d.yaw + dx * 0.01; v.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d.pitch + dy * 0.01)); }
    redraw();
  });
  window.addEventListener('mouseup', ev => {
    const d = v.drag; if (!d) return; v.drag = null; cv.style.cursor = 'grab';
    if (!d.moved && d.button === 0 && ev.target === cv && o.click) o.click(ev);
  });
  cv.addEventListener('wheel', ev => { if (o.live && !o.live()) return; ev.preventDefault(); v.zoom = Math.max(0.3, Math.min(8, v.zoom * (wheelDir(ev) > 0 ? 1.1 : 1 / 1.1))); redraw(); }, { passive: false });
  if (!cv.hasAttribute('tabindex')) cv.tabIndex = 0;
  cv.addEventListener('keydown', ev => {
    if (o.live && !o.live()) return;
    const k = ev.key; let used = true;
    if (k === 'F6' || k === 'Home') home();
    else if (k.startsWith('Arrow')) { const sx = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, sy = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0;
      if (ev.shiftKey) { v.px = (v.px || 0) + sx * 20; v.py = (v.py || 0) + sy * 20; } else { v.yaw += sx * 0.12; v.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, v.pitch + sy * 0.12)); } redraw(); }
    else if (k === '+' || k === '=') { v.zoom = Math.min(8, v.zoom * 1.15); redraw(); }
    else if (k === '-' || k === '_') { v.zoom = Math.max(0.3, v.zoom / 1.15); redraw(); }
    else used = false;
    if (used) ev.preventDefault();
  });
  cv.title = 'Left drag: rotate · right or middle drag: pan · wheel: zoom · F6: home view. Change in ☰ → Mouse and keys.';
  v.cube = addViewCube(cv, v, redraw, home);
}
// the view cube: click a face for that view, a compass letter to look from that side, the arrows to turn 90°, ⌂ for home; drag it to rotate
function addViewCube(cv, v, redraw, home) {
  const box = document.createElement('div'); box.className = 'navcube'; cv.parentElement.appendChild(box);
  const FACES = [
    { n: [0, 0, 1], t: 'TOP', to: { yaw: 0, pitch: Math.PI / 2 } }, { n: [0, 0, -1], t: 'BOTTOM', to: { yaw: 0, pitch: -Math.PI / 2 } },
    { n: [0, -1, 0], t: 'FRONT', to: { yaw: 0, pitch: 0 } }, { n: [0, 1, 0], t: 'BACK', to: { yaw: Math.PI, pitch: 0 } },
    { n: [1, 0, 0], t: 'RIGHT', to: { yaw: -Math.PI / 2, pitch: 0 } }, { n: [-1, 0, 0], t: 'LEFT', to: { yaw: Math.PI / 2, pitch: 0 } }];
  const paint = () => {
    box.hidden = keys().nav === false;
    if (box.hidden) return;
    const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch), s = 19, ox = 60, oy = 52;
    const rot = (X, Y, Z) => { const y1 = X * sy + Y * cy; return [ox + s * (X * cy - Y * sy), oy - s * (y1 * sp + Z * cp), y1 * cp - Z * sp]; };
    let h = '';
    // compass ring under the cube
    const ring = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * 2 * Math.PI; ring.push(rot(1.9 * Math.cos(a), 1.9 * Math.sin(a), -1.1)); }
    h += `<path d="M${ring.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L')}" fill="none" stroke="var(--muted)" stroke-width="5" stroke-opacity=".25"/>`;
    [['N', 0, 1.9, Math.PI], ['S', 0, -1.9, 0], ['E', 1.9, 0, -Math.PI / 2], ['W', -1.9, 0, Math.PI / 2]].forEach(([L, X, Y, yaw]) => { const q = rot(X * 1.12, Y * 1.12, -1.1); h += `<text class="cmp" data-yaw="${yaw}" x="${q[0]}" y="${q[1] + 4}" text-anchor="middle">${L}</text>`; });
    FACES.map(f => {
      const [ax] = [f.n.findIndex(c => c !== 0)], sg = f.n[ax], o2 = [0, 1, 2].filter(i => i !== ax);
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, w]) => { const p = [0, 0, 0]; p[ax] = sg; p[o2[0]] = u; p[o2[1]] = w; return rot(...p); });
      const c = rot(...f.n), depth = rot(f.n[0], f.n[1], f.n[2])[2];
      return { f, pts, c, depth };
    }).filter(q => q.depth < -0.05).sort((p1, p2) => p2.depth - p1.depth).forEach(q => {
      const shade = 0.55 + 0.45 * Math.min(1, -q.depth);
      h += `<g class="face" data-f="${q.f.t}"><path d="M${q.pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L')} Z" fill="var(--sheet)" fill-opacity="${shade.toFixed(2)}" stroke="var(--muted)" stroke-width=".8"/>`
        + (-q.depth > 0.3 ? `<text x="${q.c[0]}" y="${q.c[1] + 3}" text-anchor="middle" font-size="${(6.5 + 2.5 * -q.depth).toFixed(1)}">${q.f.t}</text>` : '') + '</g>';
    });
    box.innerHTML = `<svg viewBox="0 0 120 104" width="120" height="104">${h}</svg><button type="button" class="nb home" title="Home view (F6)">⌂</button><button type="button" class="nb rl" title="Turn 90° left">↺</button><button type="button" class="nb rr" title="Turn 90° right">↻</button>`;
  };
  box.addEventListener('click', ev => {
    ev.stopPropagation();
    const f = ev.target.closest('.face'), c = ev.target.closest('.cmp'), b = ev.target.closest('.nb');
    if (b) { if (b.classList.contains('home')) home(); else tween(v, { yaw: v.yaw + (b.classList.contains('rl') ? -1 : 1) * Math.PI / 2, pitch: v.pitch }, redraw); return; }
    if (f) { const F = FACES.find(q => q.t === f.dataset.f); tween(v, F.to, redraw); return; }
    if (c) tween(v, { yaw: +c.dataset.yaw, pitch: Math.abs(v.pitch) > 1.3 ? 0.35 : v.pitch }, redraw);
  });
  let d = null;
  box.addEventListener('mousedown', ev => { if (ev.target.closest('.nb')) return; d = { x: ev.clientX, y: ev.clientY, yaw: v.yaw, pitch: v.pitch, moved: false }; ev.preventDefault(); });
  window.addEventListener('mousemove', ev => { if (!d) return; const dx = ev.clientX - d.x, dy = ev.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true; if (!d.moved) return; v.yaw = d.yaw + dx * 0.02; v.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d.pitch + dy * 0.02)); redraw(); });
  window.addEventListener('mouseup', ev => { if (d && d.moved) { ev.stopPropagation(); box.addEventListener('click', e2 => e2.stopImmediatePropagation(), { once: true, capture: true }); } d = null; });
  paint();
  return paint;
}
// the 2D pad: arrows pan, + and − zoom, ⌂ resets
function addNavPad(host, act) {
  const box = document.createElement('div'); box.className = 'navpad'; host.appendChild(box);
  box.innerHTML = `<svg viewBox="0 0 70 70" width="70" height="70"><circle cx="35" cy="35" r="30" fill="var(--sheet)" fill-opacity=".9" stroke="var(--line)"/>
    <path class="pa" data-d="up" d="M35 9 L42 19 L28 19 Z"/><path class="pa" data-d="down" d="M35 61 L42 51 L28 51 Z"/><path class="pa" data-d="left" d="M9 35 L19 28 L19 42 Z"/><path class="pa" data-d="right" d="M61 35 L51 28 L51 42 Z"/>
    <circle class="pa" data-d="home" cx="35" cy="35" r="10" fill="var(--accent)"/><text x="35" y="39.5" text-anchor="middle" font-size="13" fill="var(--accent-ink)" pointer-events="none">⌂</text></svg>
    <div class="pz"><button type="button" class="nb" data-d="in" title="Zoom in (+)">+</button><button type="button" class="nb" data-d="out" title="Zoom out (−)">−</button></div>`;
  box.addEventListener('click', ev => { const t = ev.target.closest('[data-d]'); if (!t) return; ev.stopPropagation(); act(t.dataset.d); });
  box.addEventListener('mousedown', ev => ev.stopPropagation()); box.addEventListener('pointerdown', ev => ev.stopPropagation());
  const paint = () => { box.hidden = keys().nav === false; }; paint();
  return paint;
}

// ---------- ☰ menu: import and export
$('dockMenu').addEventListener('click', ev => { const b = ev.target.closest('[data-click]'); if (!b) return; ev.stopPropagation(); const t = $(b.dataset.click); if (t) { closeDock(); t.click(); } });

// ---------- settings: mouse and keys
function paintKeys() { const K = keys(); $('kbClick').value = K.click2d; $('kbRot').value = K.rot; $('kbPan').value = K.pan; $('kbWheel').value = K.wheel; $('kbNav').checked = K.nav !== false; }
function keysChanged() { save(); [v3.cube, c3v.cube, padDraw, padTrade].forEach(f => { if (typeof f === 'function') f(); }); toast('Mouse and keys saved.'); }
$('kbRot').addEventListener('change', () => { keys().rot = $('kbRot').value; if (keys().pan === keys().rot) { keys().pan = keys().rot === 'right' ? 'middle' : 'right'; paintKeys(); } keysChanged(); });
$('kbPan').addEventListener('change', () => { keys().pan = $('kbPan').value; if (keys().pan === keys().rot) { keys().rot = keys().pan === 'left' ? 'middle' : 'left'; paintKeys(); } keysChanged(); });
$('kbWheel').addEventListener('change', () => { keys().wheel = $('kbWheel').value; keysChanged(); });
$('kbClick').addEventListener('change', () => { keys().click2d = $('kbClick').value; keysChanged(); });
$('kbNav').addEventListener('change', () => { keys().nav = $('kbNav').checked; keysChanged(); });
$('kbReset').addEventListener('click', () => { S.keys = { rot: 'left', pan: 'right', wheel: 'normal', nav: true, click2d: 'home' }; paintKeys(); keysChanged(); });
paintKeys();

// ---------- find the closest stable bridge: try small changes (and, in 3D, bracing schemes), keep what is stable and passes
function tryPatch(patch) {
  const snap = JSON.stringify(S);
  try {
    Object.keys(patch).forEach(k => { if (k === 'd3') S.d3 = Object.assign({}, S.d3, patch.d3); else S[k] = patch[k]; });
    syncArrays();
    const t = C.buildTruss(design()); let r = C.analyze(t, S.mat, S.load, S.opts);
    if (S.anaMode === '3d') r = apply3D(t, r, S.load, d3opts(null));
    return { stable: !!r.stable, passes: !!(r.stable && r.passes), wood: r.stable ? r.wood : Infinity, cap: r.stable ? r.capKg : 0 };
  } catch (e) { return { stable: false, passes: false, wood: Infinity, cap: 0 }; }
  finally { const o = JSON.parse(snap); Object.keys(S).forEach(k => { delete S[k]; }); Object.assign(S, o); syncArrays(); }
}
function fixCandidates() {
  const P = [], add = (lab, patch) => P.push({ lab, patch });
  const h = n => Math.floor(n / 2);
  add('Verticals at every panel', { vertPreset: 'all' });
  add('Pratt diagonals', { family: 'grid', pattern: 'pratt' }); add('Howe diagonals', { family: 'grid', pattern: 'howe' }); add('Warren (no verticals)', { family: 'warren' });
  add('X in the middle panel', { diagMiddle: 'X' });
  add('Full truss at the ends', { deskEnds: 'truss' }); add('Every desk joint can bear', { supportMode: 'all' });
  add('Flat bottom chord', { bottom: 'flat' }); add('Flat top chord', { topShape: 'flat' }); add('Chord ends on the table (Δh 0, Δp 0)', { topEnd: 0, botEnd: 0 });
  add('One desk panel each side', { deskMode: 'panels', deskPanels: Math.max(1, +S.deskPanels || 0) });
  if (+S.panels > 2) add(`${+S.panels - 1} panels`, { panels: +S.panels - 1 }); if (+S.panels < 12) add(`${+S.panels + 1} panels`, { panels: +S.panels + 1 });
  add(`Height ${Math.min(100, +S.height + 10)} mm`, { height: Math.min(100, +S.height + 10) });
  if (+S.height > 20) add(`Height ${Math.max(10, +S.height - 10)} mm`, { height: Math.max(10, +S.height - 10) });
  void h; return P;
}
function braceCandidates() {
  const P = [];
  Object.entries(BRACE_SETS).forEach(([k, b]) => { if (k === 'current') return; P.push({ lab: '3D bracing: ' + b.name, patch: { d3: { topPat: b.top.slice(), botPat: b.bot.slice(), framePat: b.frame.slice() } } }); });
  P.push({ lab: 'Bottom ties on', patch: { d3: { botTies: true } } });
  return P;
}
function findStable() {
  const base = tryPatch({}), want = base.stable ? 'passes' : 'stable';
  $('fixModal').hidden = false; $('fixTbl').innerHTML = ''; $('fixMsg').textContent = 'Searching…';
  setTimeout(() => {
    const t0 = performance.now(), out = [];
    const geo = fixCandidates(), br = S.anaMode === '3d' ? braceCandidates() : [];
    const consider = (labs, patch) => { const r = tryPatch(patch); if (r.stable) out.push(Object.assign({ labs, patch }, r)); };
    geo.concat(br).forEach(c => consider([c.lab], c.patch));
    // nothing good with one change: try two (geometry + bracing in 3D, or two geometry changes)
    if (!out.some(q => q[want === 'passes' ? 'passes' : 'stable'])) {
      const pairs = S.anaMode === '3d' ? geo.flatMap(g => br.map(b => [g, b])) : geo.flatMap((g, i) => geo.slice(i + 1).map(g2 => [g, g2]));
      pairs.forEach(([x, y]) => consider([x.lab, y.lab], Object.assign({}, x.patch, y.patch, x.patch.d3 || y.patch.d3 ? { d3: Object.assign({}, x.patch.d3, y.patch.d3) } : {})));
    }
    out.sort((p, q) => (q.passes - p.passes) || (p.labs.length - q.labs.length) || (p.wood - q.wood));
    const top = out.slice(0, 8);
    $('fixMsg').innerHTML = `${base.stable ? `This bridge is stable but ${base.passes ? 'already passes' : 'fails a check'}, so this looks for the closest one that passes.` : `This bridge is unstable${S.anaMode === '3d' ? ' in 3D' : ''}, so this looks for the closest stable one.`} Tried ${geo.length + br.length}${out.length ? '' : ' single and paired'} changes in ${Math.round(performance.now() - t0)} ms${S.anaMode === '3d' ? ' (3D analysis, bracing included)' : ''}. Best first: passes, then fewest changes, then least wood.`;
    $('fixTbl').innerHTML = top.length ? `<thead><tr><th class="l">Change</th><th>Wood (mm)</th><th>Capacity (kg)</th><th>Result</th><th></th></tr></thead><tbody>${top.map((q, i) => `<tr><td class="l">${q.labs.join(' + ')}</td><td>${q.wood.toFixed(0)}</td><td>${q.cap.toFixed(1)}</td><td>${q.passes ? '<b style="color:var(--ok)">passes</b>' : 'stable, fails a check'}</td><td><button type="button" class="btn acc sm" data-fix="${i}" title="Change your bridge to this one (you can go back from ☰ → earlier bridges)">Use this</button></td></tr>`).join('')}</tbody>`
      : '<tbody><tr><td class="l">No small change makes this bridge stable. Try "Start from a simple bridge" in the ☰ menu.</td></tr></tbody>';
    findStable.top = top;
  }, 30);
}
$('fixTbl').addEventListener('click', ev => {
  const b = ev.target.closest('[data-fix]'); if (!b) return; const q = findStable.top[+b.dataset.fix];
  const bridge = bridgeState(); Object.keys(q.patch).forEach(k => { if (k === 'd3') bridge.d3 = Object.assign({}, S.d3, q.patch.d3); else bridge[k] = q.patch[k]; });
  backupBridge('before using the closest stable bridge');
  if (q.patch.d3) Object.assign(S.d3, q.patch.d3);
  applyBridge(bridge, 'before using the closest stable bridge');
  $('fixModal').hidden = true; toast(`Changed: ${q.labs.join(' + ')}. Undo from ☰ → Go back to an earlier bridge.`);
});
$('fixNo').addEventListener('click', () => { $('fixModal').hidden = true; });
$('fixModal').addEventListener('keydown', ev => { if (ev.key === 'Escape') $('fixModal').hidden = true; });
$('findStableMenu').addEventListener('click', () => { closeDock(); findStable(); });
$('msgs').addEventListener('click', ev => { if (ev.target.closest('[data-findstable]')) findStable(); });

// ---------- full screen inputs: grow the text until the columns fill the screen without scrolling
function fitInputsFs() {
  const el = $('inputsPane');
  // zoom shrinks the box too, so the box is made bigger by the same factor to keep it filling the screen
  const setZ = z => { el.style.zoom = String(z); el.style.setProperty('width', (100 / z).toFixed(3) + 'vw', 'important'); el.style.setProperty('height', (100 / z).toFixed(3) + 'vh', 'important'); };
  const fits = () => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1;
  let z = 1; setZ(z);
  if (fits()) { while (z < 1.8) { setZ(z + 0.05); if (!fits()) break; z += 0.05; } }
  else { while (z > 0.6 && !fits()) { z -= 0.05; setZ(z); } }
  setZ(+z.toFixed(2));
}
// the design name box grows with the name, up to the column width
function sizeName() {
  const el = $('name'), host = el.closest('.in') || el.parentElement; if (!host) return;
  const cs = getComputedStyle(el), cv = sizeName.cv || (sizeName.cv = document.createElement('canvas')), ctx = cv.getContext('2d');
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + 4;
  const hs = getComputedStyle(host), avail = host.clientWidth - parseFloat(hs.paddingLeft) - parseFloat(hs.paddingRight);
  const want = Math.max(ctx.measureText('Design name').width + pad, ctx.measureText(el.value || '').width + pad);
  const wpx = Math.max(90, Math.min(avail > 40 ? avail : want, want));
  el.style.width = wpx + 'px'; el.style.minWidth = '0'; el.style.maxWidth = '100%';
  const r = el.closest('.row'); if (r) { r.style.maxWidth = '100%'; r.style.width = wpx + 'px'; r.style.flex = '0 0 auto'; }
}
window.addEventListener('resize', () => { clearTimeout(sizeName.t); sizeName.t = setTimeout(sizeName, 120); });
$('name').addEventListener('input', sizeName); sizeName();

// ---------- full screen: the picture fills the screen, and its controls float small on top (nothing to scroll).
// The real controls are moved into the floating bars and put back afterwards, so they keep working as usual.
const FS_CFG = {
  '#trackBody': () => S.tab === 'c3'
    ? { fill: $('c3Canvas').closest('.chartbox'), bar: [$('trackTabs'), $('logHere'), $('groupBy').closest('label'), $('c3Canvas').closest('[data-panel]').querySelector('.tradectl')], foot: [$('c3Legend')] }
    : S.tab === 'curve' ? { fill: $('curveCanvas').closest('.chartbox'), bar: [$('trackTabs'), $('logHere'), $('groupBy').closest('label'), $('curveLevels').closest('.row')], foot: [$('curveLegend')] }
    : S.tab === 'hist' ? { fill: $('trackBody').querySelector('[data-panel="hist"]'), bar: [$('trackTabs'), $('logHere')] }
    : { fill: $('tradeCanvas').closest('.chartbox'), bar: [$('trackTabs'), $('logHere'), $('groupBy').closest('label'), $('tradeCanvas').closest('[data-panel]').querySelector('.tradectl')], foot: [$('tradeLegend')] },
  '#sideSheet': () => ({ fill: topOn() ? $('c3d').closest('.chartbox') : $('drawWrap'), bar: [$('statusPill'), $('topViewSeg'), $('showDims').closest('.drawopts')], foot: [$('drawWrap').parentElement.querySelector('.legend')] }),
  '#inputsPane': () => ({ inputs: true }),
};
var fsEl = null, fsMoved = [], fsCompactWas = null;
function fsMove(node, into) { if (!node) return; const ph = document.createComment('fs'); node.parentNode.insertBefore(ph, node); into.appendChild(node); fsMoved.push([node, ph]); }
function setFs(key) {
  setTimeout(() => { try { paintResOverlay(); if (topOn()) draw3D(); } catch (e) {} }, 80);
  // put everything back first
  fsMoved.reverse().forEach(([n, ph]) => { ph.parentNode.insertBefore(n, ph); ph.remove(); }); fsMoved = [];
  const L = $('fsLayer'); L.hidden = true; L.className = 'fslayer';
  ['fsBar', 'fsFoot', 'fsPanelBody'].forEach(id => { $(id).innerHTML = ''; });
  if (fsEl === 'inputs') { $('inputsPane').classList.remove('fsOn'); $('inputsPane').style.zoom = ''; $('inputsPane').style.removeProperty('width'); $('inputsPane').style.removeProperty('height'); }
  if (fsEl === '#sideSheet' && key !== '#sideSheet') { v2.zoom = 1; v2.px = 0; v2.py = 0; v3.yaw = -0.55; v3.pitch = 0.42; v3.zoom = 1; v3.px = 0; v3.py = 0; }
  fsEl = key ? (key === '#inputsPane' ? 'inputs' : key) : null;
  document.body.classList.toggle('fsmode', !!key); $('fsExit').hidden = true; $('dockEsc').hidden = !key; setTimeout(paintView, 0);
  // the inputs in full screen use the condensed layout so more of them fit at once
  document.body.classList.toggle('compact', compactOn());
  if (key) {
    const c = FS_CFG[key]();
    if (c.inputs) { $('inputsPane').classList.add('fsOn'); setTimeout(() => { sizeName(); fitInputsFs(); sizeName(); }, 60); }
    else {
      const det = document.querySelector(key).closest('details'); if (det) det.open = true;
      L.hidden = false;
      fsMove(c.fill, $('fsFill'));
      (c.bar || []).forEach(n => fsMove(n, $('fsBar')));
      (c.foot || []).forEach(n => fsMove(n, $('fsFoot')));
      $('fsPanel').hidden = !c.panel; $('fsPanel').open = false; $('fsPanelName').textContent = c.panelName || '';
      (c.panel || []).forEach(n => fsMove(n, $('fsPanelBody')));
    }
  }
  setTimeout(() => { renderDrawing(); drawTrackers(); try { render3D(); } catch (e) {} sizeName(); }, 30);
}
document.querySelectorAll('.fsbtn').forEach(b => b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); setFs(b.dataset.fs); }));
$('fsExit').addEventListener('click', () => setFs(null));
$('dockEsc').addEventListener('click', ev => { ev.stopPropagation(); setFs(null); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && fsEl && !adj && !document.querySelector('.modal:not([hidden])')) setFs(null); });
window.addEventListener('resize', () => { if (fsEl) { renderDrawing(); drawTrackers(); try { render3D(); } catch (e) {} } });

// ---------- keeping work safe across reloads and new versions
// 1. the current sweep results are saved in this browser and brought back on load
function queueSweepSave() {
  clearTimeout(queueSweepSave.t);
  queueSweepSave.t = setTimeout(() => {
    try { if (!sweepAll.length || sweepBusy) return; } catch (e) { return; }
    if (queueSweepSave.ref === sweepAll && queueSweepSave.len === sweepAll.length) return;
    queueSweepSave.ref = sweepAll; queueSweepSave.len = sweepAll.length;
    idbPut('cur', { ver: APP_VER, when: new Date().toISOString(), msg: $('sweepMsg').textContent, rows: sweepAll, top: sweepRows, ctx: sweepCtx, sig: lastSig, mode: sweepMode }).catch(() => {});
  }, 800);
}
(async () => {
  let v = null, ck = null;
  try { v = await idbGet('cur'); } catch (e) { v = null; }
  if (v && v.rows && v.rows.length && !sweepAll.length) {
    sweepAll = v.rows; sweepRows = v.top || []; sweepCtx = v.ctx || sweepCtx; lastSig = v.sig || null; sweepMode = v.mode === 'pilot' ? 'sweep' : (v.mode || 'sweep');
    queueSweepSave.ref = sweepAll; queueSweepSave.len = sweepAll.length;
    const old = v.ver !== APP_VER;
    $('sweepMsg').innerHTML = `<b>Restored</b> the sweep from ${new Date(v.when).toLocaleString()}${old ? ` (made with an older version of the Explorer${v.ver ? ` (v${v.ver})` : ''}; the solver may have changed since, so <button type="button" class="btn ghost sm" id="rerunOld">re-run it</button> to be sure)` : ''}. ` + escH(v.msg || '');
    if ($('rerunOld')) $('rerunOld').addEventListener('click', () => $('runSweep').click());
    renderSweep(); drawTrackers(); paintBigMode(); checkStale();
  } else if (!sweepAll.length) starterSweep();
  // 2. a large search that was interrupted can carry on where it stopped
  try { ck = await idbGet('ckpt'); } catch (e) { ck = null; }
  if (ck && ck.k < ck.n) {
    $('bigMsg').innerHTML = `A large search stopped at ${ck.k.toLocaleString()} of ${ck.n.toLocaleString()} designs (${new Date(ck.when).toLocaleString()}). <button type="button" class="btn acc sm" id="ckResume">Resume it</button> <button type="button" class="btn ghost sm" id="ckDrop">Discard</button>`;
    $('ckResume').addEventListener('click', () => {
      if (sweepSig() !== ck.sig || sweepDims().total !== ck.total) { $('bigMsg').textContent = 'The inputs or sweep ranges have changed since that search, so resuming would mix two different searches. Set them back, or start a new search.'; return; }
      if (!ck.wv && ck.total > WALK_SPLIT_MAX && typeof ck.m === 'number') toast(`That search started before v59. For spaces past 137 billion designs its sampler favoured some designs and repeated others, so it carries on the same way. For a fair sample, start a new search.`, true);
      else if (ck.ver !== APP_VER) toast('That search was started in an older version; the rest will use the new solver.');
      $('s-sweep') && ($('s-sweep').open = true);
      runFull(ck);
    });
    $('ckDrop').addEventListener('click', () => { idbPut('ckpt', null).catch(() => {}); $('bigMsg').textContent = 'Discarded.'; });
  }
})();
// a starter sweep, so the charts have something to show before anyone runs one. A first visit gets a ready-made set of ranges (about 51,000 designs).
function starterSweep() {
  if (FIRST_VISIT) {
    const set = (id, v) => { const el = $(id); if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('swH0', 10); set('swH1', 100); set('swHs', 1.25);
    set('swD0', -30); set('swD1', 30); set('swDs', 10);
    set('swO0', 5); set('swO1', 45); set('swOs', 10);
    ['swOnD'].forEach(id => { const c = $(id); if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } });
    const vo = $('swVaryOv'); if (vo && !vo.checked) { vo.checked = true; vo.dispatchEvent(new Event('change', { bubbles: true })); }
    S.swOn.H = true; S.swOn.N = true; S.swOn.P = true; save(); paintSwBlocks(); updateSweepCount();
  }
  if (sweepProblems().length) return;
  const n = sweepDims().total;
  if (!n || n > 60000) { $('sweepMsg').textContent = `No sweep has been run yet. Your ranges hold ${n.toLocaleString()} designs: press Run sweep${n > 60000 ? ' (or Large search)' : ''} to fill the charts.`; return; }
  $('sweepMsg').textContent = `Building a starter sweep (${n.toLocaleString()} designs) so the charts have something to show…`;
  toast(`Building a starter sweep of ${n.toLocaleString()} designs in the background…`);
  setTimeout(() => { if (!sweepBusy && !big.running && !sweepAll.length) $('runSweep').click(); }, 1200);
}
function escH(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// 3. ask before leaving while something is running
window.addEventListener('beforeunload', ev => { if (sweepBusy || big.running) { ev.preventDefault(); ev.returnValue = ''; } });
// 4. earlier bridges: a copy is kept before every reset, preset or file load, and every few minutes while you work
const BKEY = 'se310-truss-backups';
function readBackups() { try { return JSON.parse(localStorage.getItem(BKEY) || '[]') || []; } catch (e) { return []; } }
function snapBridge() { const b = bridgeState(); b.swSel = JSON.parse(JSON.stringify(SW)); b.swVals = {}; SW_IDS.forEach(id => { b.swVals[id] = $(id).value; }); return b; }
function backupBridge(why, force) {
  const b = snapBridge(), str = JSON.stringify(b), list = readBackups();
  if (list.length && JSON.stringify(list[0].bridge) === str) { if (force) { list[0].why = why; try { localStorage.setItem(BKEY, JSON.stringify(list)); } catch (e) {} renderHistory(); } return; }
  let sum = {}; try { sum = bridgeSummary(); } catch (e) {}
  list.unshift({ when: new Date().toISOString(), why, name: S.name || 'Design', sum, bridge: b });
  while (list.length > 40) list.pop();
  try { localStorage.setItem(BKEY, JSON.stringify(list)); } catch (e) { list.pop(); try { localStorage.setItem(BKEY, JSON.stringify(list)); } catch (e2) {} }
  paintBackups(); try { renderHistory(); } catch (e) {}
}
function paintBackups() {
  const sel = $('backupSel'); if (!sel) return;
  const list = readBackups();
  sel.innerHTML = `<option value="">${list.length ? 'choose…' : 'none yet'}</option>` + list.map((q, i) => {
    const t = new Date(q.when), s = q.sum || {};
    return `<option value="${i}">${t.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${escH(q.name)}${s.wood ? ` · ${Math.round(s.wood)} mm${s.passes ? ' · passes' : ''}` : ''} (${q.why})</option>`;
  }).join('');
}
{
  const ab = applyBridge;
  applyBridge = function (b, why) { backupBridge(why || 'before loading another bridge'); return ab(b); };
}
$('backupSel').addEventListener('change', () => {
  const q = readBackups()[+$('backupSel').value]; if (!q) return;
  applyBridge(q.bridge, 'before going back to an earlier bridge');
  $('backupSel').value = ''; closeDock(); toast(`Back to the bridge from ${new Date(q.when).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
});
setTimeout(() => backupBridge('when the page opened'), 600);   // after the first solve, so the copy has its results
setInterval(() => { if (!document.hidden) backupBridge('saved automatically'); }, 180000);

update();
drawTrackers();
// ---------- result tables: grey out what does not change, so the differences stand out
// a column with one value in every row is greyed (header marked "="), or hidden with the "Hide same columns" switch;
// in the other columns, a value repeating the row above is faded
S.hideSame = !!S.hideSame;
function markSame(tb) {
  if (!tb || tb._marking) return; tb._marking = true;
  try {
    const rows = [...tb.querySelectorAll('tbody tr')].filter(r => r.cells.length > 1);
    tb.querySelectorAll('.samecol, .dit').forEach(c => c.classList.remove('samecol', 'dit'));
    const head = tb.tHead && tb.tHead.rows.length ? tb.tHead.rows[tb.tHead.rows.length - 1] : null;
    let nSame = 0;
    if (rows.length > 1) {
      const nc = Math.max(...rows.map(r => r.cells.length));
      for (let c = 0; c < nc; c++) {
        const cells = rows.map(r => r.cells[c]);
        if (cells.some(x => !x || x.colSpan > 1 || x.querySelector('button, input, select'))) continue;
        const txt = cells.map(x => x.textContent.trim());
        if (txt.every(t => t === txt[0])) {
          nSame++;
          cells.forEach(x => x.classList.add('samecol'));
          if (head && head.cells[c]) { head.cells[c].classList.add('samecol'); head.cells[c].title = `Same in every row: ${txt[0]}`; }
        } else for (let k = 1; k < txt.length; k++) if (txt[k] === txt[k - 1] && txt[k] !== '') cells[k].classList.add('dit');
      }
    }
    tb.dataset.same = nSame;
  } finally { setTimeout(() => { tb._marking = false; }, 0); }
}
['sweepTbl', 'frontTbl', 'histTbl', 'curveTbl'].forEach(id => {
  const tb = $(id); if (!tb) return;
  new MutationObserver(() => { if (!tb._marking) markSame(tb); }).observe(tb, { childList: true, subtree: true });
  markSame(tb);
});
function paintSame() {
  document.body.classList.toggle('hidesame', S.hideSame);
  document.querySelectorAll('.sametgl').forEach(b => { b.textContent = S.hideSame ? 'Show same columns' : 'Hide same columns'; b.setAttribute('aria-pressed', String(S.hideSame)); b.title = S.hideSame ? 'Show the columns that have the same value in every row (greyed, marked =)' : 'Hide the columns that have the same value in every row, so only what differs is left'; });
}
[['sweepBtns', 'sameTgl2'], [null, 'sameTgl']].forEach(([host, id]) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost sm sametgl'; b.id = id;
  if (host) $(host).appendChild(b); else $('toggleData').after(b);
  b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); S.hideSame = !S.hideSame; paintSame(); save(); });
});
paintSame();
window.__dbg = { get S() { return S; }, drawTrackers: () => drawTrackers(), get rows() { return sweepAll; }, get res() { return res; }, load: p => loadParams(p), get ctx() { return sweepCtx; } };
})();
