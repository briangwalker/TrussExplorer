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
// a number box never says one thing while the app uses another (#156): a value outside what the model can handle is
// refused, the box goes back to the value in use, and a short message says why. Course rules (the 50-75 mm width, say)
// are not limits here: they run, and the design fails visibly.
function guardNum(id, lo, hi, cur, apply, what, unit) {
  const el = $(id), raw = String(el.value).trim(), v = +raw, u = unit == null ? ' mm' : unit;
  const back = msg => { el.value = cur; toast(msg, true); };
  if (raw === '' || !Number.isFinite(v)) return back(`${what} needs a number; kept ${cur}${u}.`);
  if (v < lo || v > hi) return back(`${what} must be ${lo} to ${hi}${u}; kept ${cur}${u}.`);
  apply(v);
}
const WIDTH_LIM = [20, 120];   // the model's range for the bridge width; the course rule (50-75 mm) is checked as a pass/fail rule
$('width').addEventListener('change', () => guardNum('width', WIDTH_LIM[0], WIDTH_LIM[1], S.opts.width, v => { S.opts.width = v; setVal('width3d', v); update(); }, 'Bridge width'));
['deflLimit', 'minOverlap'].forEach(id => $(id).addEventListener('change', () => guardNum(id, 0, id === 'deflLimit' ? 50 : 200, S.opts[id], v => { S.opts[id] = v; update(); }, id === 'deflLimit' ? 'The deflection limit' : 'The minimum overlap')));

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
  res2d = C.analyze(tr, S.mat, S.load, anaOpts());
  res = S.anaMode === '3d' ? apply3D(tr, res2d, S.load, d3opts(null)) : res2d;
  clearTimeout(update.bk); update.bk = setTimeout(() => { try { if (res && res.stable) backupBridge('after your changes'); } catch (e) {} }, 15000);
  paintInputs(); if (typeof sizeName === 'function') sizeName(); renderDiagChips(); renderVertChips(); renderDrawing(); renderStats(); renderTable(); renderExport(); updateSweepCount(); renderHistory(); render3D();
  save();
}
let res2d = null;
function setVal(id, v) { const el = $(id); if (document.activeElement !== el) el.value = v; }
