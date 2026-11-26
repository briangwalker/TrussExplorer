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
// how many legend lines sweepGhosts will write (the drawing makes room for them above the envelope)
function ghostRows() {
  if (typeof swOn !== 'function') return 0;
  let n = GHOST.filter(g => swOn(g.k)).length;
  if (swOn('N') && typeof SW !== 'undefined' && Object.keys(SW.panels).some(k => SW.panels[k])) n++;
  return n;
}
// legY: the truss height (mm) of the lowest legend line's baseline; the lines stack upward from there
function sweepGhosts(Y, legY) {
  if (typeof swOn !== 'function') return '';
  const out = [], F = 'IBM Plex Mono, monospace', nRows = ghostRows();
  if (legY == null) legY = 108;
  const legAt = r => Y(legY + 5 * (nRows - 1 - r));   // row 0 on top, the last row lowest
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
    out.push(`<text data-legend="${g.k}" x="${-48}" y="${legAt(row)}" font-size="3.8" fill="${g.col}" font-family="${F}">sweep ${g.name}: ${fmt1(ends[0])} (dotted) to ${fmt1(ends[1])} (dashed)${st > 0 ? `, grey every ${fmt1(st)}` : ''}</text>`);
    row++;
  });
  if (swOn('N')) { const ns = Object.keys(SW.panels).filter(k => SW.panels[k]); if (ns.length) { out.push(`<text data-legend="N" x="${-48}" y="${legAt(row)}" font-size="3.8" fill="var(--g8)" font-family="${F}">sweep panels: ${ns.join(', ')}</text>`); row++; } }
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
  if (!adj) { if (!bridgeLive() || ev.target.closest('.navpad') || ev.target.closest('.infobox')) return; ev.preventDefault(); const svg = $('draw'), r = svg.getBoundingClientRect(), b = v2Box(); if (!b) return;
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
    + (noResultNow() ? box('tc', '—', 'capacity · no result (fix the marked values)', 'var(--ink)')   // UI-I10: never a kg while there is no result
      : box('tc', `${res.capKg.toFixed(1)} kg`, `capacity · needs ${need.toFixed(1)}`, c(res.capKg >= need - 1e-9)))
    + box('bc', `D ${res.midDefl.toFixed(3)} mm`, `deflection · limit ${S.opts.deflLimit}`, c(res.deflOK))
    + box('bl', `${res.wood.toFixed(0)} mm`, 'wood used ΣL', 'var(--accent)');
}
// ---------- UI-D7: Home frames the drawing in the part of the stage the windows leave free in their DEFAULT homes (#503)
// The free box is worked out from where the shell puts the windows by default (Inputs open on the left, the Drawing window as icons
// on the right under the view control, the sweep bar at the bottom), never from where they are now: moving or folding a window
// never refits, only Home (and a new render: the first view, a new bridge) does. The top bar and the results card sit above the drawing; the view
// control doesn't move, so it is measured. A free box under 480 px wide (phone) gives null: the drawing then fits the whole stage.
var HOMEFIT = { M: 10, margin: 16, minW: 480, sweepH: 96 };
function homeFree() {
  const stage = document.getElementById('stage'), svg = $('draw');
  if (!stage || !stage.querySelector('.s-pan[data-win="inputs"]') || !svg) return null;   // the classic layout has no windows
  if (window.__shell && window.__shell.state && window.__shell.state.place && window.__shell.state.place !== 'truss') return null;
  const sr = svg.getBoundingClientRect(); if (!(sr.width > 0 && sr.height > 0)) return null;
  const vw = innerWidth, vh = innerHeight, M = HOMEFIT.M, box = el => { const r = el && el.getBoundingClientRect(); return r && r.width > 0 && r.height > 0 ? r : null; };
  // the shell's own sizes (shell.js layout(), UI-W15): Inputs up to 400 px and never over 40 % of the page; Drawing as icons is 56 px
  const iW = Math.floor(Math.min(400, vw - 2 * M, vw * 0.4));
  let l = M + iW, r = vw - M - 56, t = sr.top, bt = sr.bottom;
  const pad = box(document.querySelector('#drawWrap .navpad')); if (pad) r = Math.min(r, pad.left);
  // the sweep bar's default home is its bar alone (Sweep settings closed) at the bottom. Its height is a fixed allowance, never measured,
  // so a theme with a taller bar or an open Sweep settings never moves the drawing (UI-T2: a theme changes no meaning or position).
  bt = Math.min(bt, vh - M - HOMEFIT.sweepH);
  l = Math.max(l, sr.left); r = Math.min(r, sr.right);
  if (r - l < HOMEFIT.minW || bt - t < 120) return null;
  return { l, t, r, b: bt, svg: sr };
}
// the viewBox (whole svg) that puts the drawing's box b = [x, y, w, h] inside the free box, centred, with the 16 px margin
function homeFit(b) {
  const f = homeFree(); if (!f || !b) return null;
  const m = HOMEFIT.margin, fw = f.r - f.l - 2 * m, fh = f.b - f.t - 2 * m; if (fw <= 0 || fh <= 0) return null;
  const s = Math.min(fw / b[2], fh / b[3]), W = f.svg.width / s, H = f.svg.height / s;
  const cx = (f.l + f.r) / 2 - f.svg.left, cy = (f.t + f.b) / 2 - f.svg.top;
  return [b[0] + b[2] / 2 - cx / s, b[1] + b[3] / 2 - cy / s, W, H];
}
function v2Box() { return renderDrawing.home || renderDrawing.base; }
function applyV2() {
  const b = v2Box(); if (!b) return; const w = b[2] / v2.zoom, h = b[3] / v2.zoom;
  $('draw').setAttribute('viewBox', `${(b[0] + (b[2] - w) / 2 - v2.px).toFixed(2)} ${(b[1] + (b[3] - h) / 2 - v2.py).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
}
function nav2D(d) {
  const b = v2Box(); if (!b) return; const w = b[2] / v2.zoom, h = b[3] / v2.zoom;
  if (d === 'home') { v2.zoom = 1; v2.px = 0; v2.py = 0; }
  else if (d === 'in') v2.zoom = Math.min(8, v2.zoom * 1.25); else if (d === 'out') v2.zoom = Math.max(0.5, v2.zoom / 1.25);
  else if (d === 'left') v2.px += 0.15 * w; else if (d === 'right') v2.px -= 0.15 * w; else if (d === 'up') v2.py += 0.15 * h; else if (d === 'down') v2.py -= 0.15 * h;
  applyV2();
}
// ---------- the 2D drawing (#255 part A; UI-A3, UI-H5)
// drawingSVG(design, opts) builds the picture from a design alone: no element, no listeners, no shared state.
//   design = { tr, res, S }: the truss, its results and the settings the picture reads (height, tableThick, mat.b,
//            showDef/defScale/showIds/showElems/showForces). currentDesign() is the one on screen.
//   opts   = { hl: member to highlight (-1 none), ghosts: swept ranges, dims: clickable dimension labels }.
//            ghosts and dims describe the sweep and the editor on screen, so they only make sense for the current design.
// renderDrawing(target, design, opts) draws it into an <svg>. With no arguments it is the main view, exactly as before:
// #draw, pan and zoom (v2), the results overlay, the hover and click listeners and the dimension editor. Any other
// target (the PIP, #210) gets its own fitted viewBox and nothing else, so it never moves the main view.
function currentDesign() { return { tr, res, S }; }
function renderDrawing(target, design, opts) {
  const main = !target || target === $('draw');
  const svg = target || $('draw');
  opts = Object.assign(main ? { hl: hlElem, ghosts: S.showGhosts !== false, dims: S.showDims !== false, results: true, fit: true } : { hl: -1, ghosts: false, dims: false, results: false, fit: false }, opts);
  const d = drawingSVG(design || currentDesign(), opts);
  if (main) { renderDrawing.base = d.base; renderDrawing.home = d.home || null; applyV2(); paintResOverlay(); }
  else svg.setAttribute('viewBox', d.base.join(' '));
  svg.innerHTML = d.svg;
  if (!main) return;
  svg.querySelectorAll('.dimlab').forEach(g => { if (adj && g.dataset.var === adj.key) g.classList.add('act'); g.addEventListener('click', ev => { ev.stopPropagation(); openDimPop(g.dataset.var); }); });
  svg.querySelectorAll('.mem').forEach(l => {
    l.addEventListener('mouseenter', () => highlight(+l.dataset.k));
    l.addEventListener('mouseleave', () => highlight(-1));
    l.addEventListener('click', () => {
      // the member table is in Analysis > Members now (UI-S10): if it is showing, find the row there
      highlight(+l.dataset.k);
      const row = document.querySelector(`#memTbl tbody tr[data-key="${l.dataset.k}"]`);
      if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  });
}
function drawingSVG(design, opts) {
  const { tr, res, S } = design;   // the design's own, never the shared ones
  const xs = tr.nodes.map(n => n[0]);
  const x0 = Math.min(-70, Math.min(...xs) - 22), x1 = Math.max(270, Math.max(...xs) + 22);
  // the sweep legend sits above the envelope's label and the books' line (UI-D7: never on the books), so the top makes room for it
  const nLeg = opts.ghosts && typeof ghostRows === 'function' ? ghostRows() : 0, legY = Math.max(100 + 2.5 + 4.2, +S.height + 12 + 13 + 2.4 + 4.2) + 2;
  const yTop = Math.max(128, +S.height + 46, nLeg ? legY + 5 * (nLeg - 1) + 6 : 0), yBot = opts.results ? -112 : -76;   // the results strip (callouts, wood pile) needs the extra floor
  const base = [x0, 0, x1 - x0, yTop - yBot];
  // UI-D7: in the main view the Home box is wider than the drawing; the tables (UI-S1) still run to its edges
  const home = opts.fit && typeof homeFit === 'function' ? homeFit(base) : null;
  const tx0 = home ? Math.min(x0, home[0]) : x0, tx1 = home ? Math.max(x1, home[0] + home[2]) : x1;
  const Y = y => yTop - y;
  const o = [];
  const MONO = 'IBM Plex Mono, monospace';
  const t = (x, y, s, size, anchor, fill) => `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size || 5}" fill="${fill || 'var(--muted)'}" text-anchor="${anchor || 'middle'}">${s}</text>`;
  o.push(`<rect x="-50" y="${Y(100)}" width="300" height="100" fill="var(--env)" stroke="var(--envline)" stroke-dasharray="3 2.5" stroke-width=".6"/>`);
  o.push(t(-50, Y(100) - 2.5, 'allowable envelope · 100 mm above deck · 300 mm max length', 4.2, 'start'));
  o.push(`<rect x="0" y="${Y(0)}" width="200" height="50" fill="none" stroke="var(--envline)" stroke-dasharray="3 2.5" stroke-width=".5"/>`);
  o.push(t(204, Y(-50) + 5.5, '50 mm max below deck', 4.2, 'start'));
  const Tt = Math.max(0, +S.tableThick || 0), tH = Math.min(Tt, 76);
  o.push(`<rect x="${tx0}" y="${Y(0)}" width="${-tx0}" height="76" fill="var(--desk)" fill-opacity=".35"/>`);
  o.push(`<rect x="200" y="${Y(0)}" width="${tx1 - 200}" height="76" fill="var(--desk)" fill-opacity=".35"/>`);
  o.push(`<rect x="${tx0}" y="${Y(0)}" width="${-tx0}" height="${tH}" fill="var(--desk)"/>`);
  o.push(`<rect x="200" y="${Y(0)}" width="${tx1 - 200}" height="${tH}" fill="var(--desk)"/>`);
  // UI-S1 / UI-D2: the tables run to both edges of the drawing and end in break lines. ART-spec has no break-line rule yet, so this is a plain
  // 1 px double rule (non-scaling) across the table block; Graphics may replace it with a drawn break.
  [[tx0, 1], [tx1, -1]].forEach(([bx, sg], n) => o.push(`<g data-break="${n ? 'right' : 'left'}" fill="none" stroke="var(--ink)" stroke-width="1" stroke-linecap="butt" aria-hidden="true"><line vector-effect="non-scaling-stroke" x1="${bx + sg * 1}" y1="${Y(0)}" x2="${bx + sg * 1}" y2="${Y(0) + 76}"/><line vector-effect="non-scaling-stroke" x1="${bx + sg * 2.8}" y1="${Y(0)}" x2="${bx + sg * 2.8}" y2="${Y(0) + 76}"/></g>`));
  if (Tt > 0) { o.push(t(x0 + 6, Y(-Tt) + 6, `table top ${Tt.toFixed(0)} mm`, 3.8, 'start')); o.push(t(x1 - 6, Y(-Tt) + 6, `table top ${Tt.toFixed(0)} mm`, 3.8, 'end')); }
  o.push(t(x0 + 6, Y(-22), 'DESK', 5, 'start')); o.push(t(x1 - 6, Y(-22), 'DESK', 5, 'end'));
  o.push(`<g stroke="var(--muted)" stroke-width=".4"><line x1="0" y1="${Y(-64)}" x2="200" y2="${Y(-64)}"/><line x1="0" y1="${Y(-61)}" x2="0" y2="${Y(-67)}"/><line x1="200" y1="${Y(-61)}" x2="200" y2="${Y(-67)}"/></g>`);
  o.push(t(-4, Y(-64) + 6, 'clear span 200 mm', 4.4, 'end'));
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
    o.push(`<line data-k="${k}" class="mem" x1="${a[0]}" y1="${Y(a[1])}" x2="${b[0]}" y2="${Y(b[1])}" stroke="${col}" stroke-width="${opts.hl === k ? 5.5 : memWOf(S, e)}" stroke-linecap="round" style="cursor:pointer"><title>${tip}${e.n > 1 ? ` · ${e.n} sticks` : ''}</title></line>`);
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
  // UI-A13 / UI-D3: the books are drawn as books, stacked on the deck (ART-D3: cover colour, page edges, spine band); book1 under book2.
  // A theme may supply books.svg (UI-T4, ART-H5): TrussDrawPics.books = { viewBox, inner }; the built-in shapes are the fallback.
  const bkW = Math.max(6, b1 - b0), bkH = 6.5, bkBase = deckY + 12, nBk = 2;
  const pic = (name, x, yy, w, h, builtin) => { const P = window.TrussDrawPics && window.TrussDrawPics[name]; return P && /^[\d. -]{1,40}$/.test(String(P.viewBox)) && typeof P.inner === 'string' ? `<svg class="te-drawpic" data-pic="${name}" x="${x}" y="${yy}" width="${w}" height="${h}" viewBox="${P.viewBox}" preserveAspectRatio="xMidYMid meet">${P.inner}</svg>` : `<g data-pic="${name}" data-builtin="1">${builtin}</g>`; };
  let bk = '';
  for (let n = 0; n < nBk; n++) {
    const bx = b0 + n * 2.2, bw = bkW - n * 4.4, by = Y(bkBase + (n + 1) * bkH);
    bk += `<g data-book="book${n + 1}"><rect x="${bx}" y="${by}" width="${bw}" height="${bkH}" rx=".8" fill="var(--book)" stroke="var(--tens)" stroke-width=".5"/>`
      + `<rect x="${bx + 3}" y="${by + 1.1}" width="${Math.max(1, bw - 4.5)}" height="${bkH - 2.2}" fill="var(--sheet)" stroke="var(--tens)" stroke-width=".25"/>`
      + `<rect x="${bx}" y="${by}" width="2.6" height="${bkH}" rx=".8" fill="var(--tens)" fill-opacity=".55"/></g>`;
  }
  const bkTop = Y(bkBase + nBk * bkH);
  o.push(`<g aria-hidden="true">${pic('books', b0, bkTop, bkW, nBk * bkH, bk)}</g>`);
  o.push(t((b0 + b1) / 2, bkTop - 2.4, `books · ${(b1 - b0).toFixed(0)} mm · ${res.Ptruss.toFixed(2)} N on this truss`, 4.2, 'middle', 'var(--ink)'));
  const maxF = Math.max(...res.Fval.map(f => -f[2]), 1e-9);
  res.Fval.forEach(([n, , v]) => {
    const [x, y] = tr.nodes[n];
    const len = 2 + 5 * (-v / maxF);   // arrows end under the books (UI-A13)
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
  // UI-A13 results strip (main view only): the wood pile on the floor under the bridge, and three callouts, each with a leader to where it applies.
  // The results card keeps the numbers; the words for these three live here (UI-D3, UI-D6: text never overlaps text).
  if (opts.results && ok) {
    const FL = -106, ink = 'var(--ink)', okc = c => c ? 'var(--ok)' : 'var(--bad)';
    o.push(`<line x1="${tx0}" y1="${Y(FL)}" x2="${tx1}" y2="${Y(FL)}" stroke="var(--line)" stroke-width=".5"/>`);
    const lowY = Math.min(...tr.nodes.map(n => n[1])), cx = (Math.min(...xs) + Math.max(...xs)) / 2, mn = tr.nodes[res.midNode] || [100, 0];
    const fitsOK = !!res.edgeOK && !(res.envelope && res.envelope.length);
    const nFit = (res.envelope ? res.envelope.length : 0) + (res.edgeOK ? 0 : 1);
    const lim = (+S.opts.deflLimit).toFixed(1);
    const chips = [
      { k: 'det', x: -64, lab: 'determinacy', val: `${res.m + res.r} vs ${2 * res.j} · ${res.det}`, col: ink, ax: cx, ay: lowY, alt: `Determinacy: m + r = ${res.m + res.r} against 2j = ${2 * res.j}, ${res.det}` },
      { k: 'defl', x: 24, lab: `mid-span deflection · joint ${res.midNode}`, val: `${res.midDefl.toFixed(3)} mm ${res.deflOK ? '✓' : '✕'} limit ${lim}`, col: okc(res.deflOK), ax: mn[0], ay: mn[1], alt: `Mid-span deflection ${res.midDefl.toFixed(3)} mm, limit ${lim} mm, ${res.deflOK ? 'passes' : 'fails'}` },
      { k: 'fits', x: 112, lab: 'fits the envelope and the desks', val: fitsOK ? 'fits ✓' : `✕ ${nFit} problem${nFit > 1 ? 's' : ''}, see the list`, col: okc(fitsOK), ax: Math.max(...xs), ay: Math.max(...tr.nodes.map(n => n[1])) * 0.5, alt: fitsOK ? 'Fits the allowable envelope and reaches the desks' : `Does not fit: ${nFit} problem${nFit > 1 ? 's' : ''}, listed under the results` },
    ];
    chips.forEach(c => {
      const w = 84, top = Y(-80), h = 19;
      o.push(`<g data-callout="${c.k}"><title>${c.alt}</title>`
        + `<line x1="${c.x + w / 2}" y1="${top}" x2="${c.ax}" y2="${Y(c.ay) + 2}" stroke="${c.col}" stroke-opacity=".6" stroke-width=".3" stroke-dasharray="1.2 1"/><circle cx="${c.ax}" cy="${Y(c.ay) + 2}" r="1" fill="${c.col}"/>`
        + `<rect x="${c.x}" y="${top}" width="${w}" height="${h}" rx="1.5" fill="var(--sheet)" stroke="${c.col}" stroke-width=".5"/>`
        + t(c.x + 3, top + 6.4, c.lab, 3.5, 'start') + t(c.x + 3, top + 14.4, c.val, 4.7, 'start', c.col) + '</g>');
    });
    // the wood pile: sticks end-on (square, end-grain ring), two twine loops; its size follows the wood used ΣL (240 mm sticks)
    const nSt = Math.max(1, Math.round((res.wood || 0) / 240)), cols = Math.max(1, Math.ceil(Math.sqrt(nSt * 1.8))), rows = Math.ceil(nSt / cols), cell = 4.2, px = 208, pw = cols * cell, ph = rows * cell;
    let pile = '';
    for (let n = 0; n < nSt; n++) {
      const cxx = px + (n % cols) * cell, cyy = Y(FL) - ph + Math.floor(n / cols) * cell;
      pile += `<rect x="${cxx + .2}" y="${cyy + .2}" width="${cell - .4}" height="${cell - .4}" fill="var(--sheet)" stroke="var(--ink)" stroke-width=".3"/><circle cx="${cxx + cell / 2}" cy="${cyy + cell / 2}" r="${cell * 0.24}" fill="none" stroke="var(--muted)" stroke-width=".25"/>`;
    }
    pile += `<line x1="${px - .6}" y1="${Y(FL) - ph * 0.28}" x2="${px + pw + .6}" y2="${Y(FL) - ph * 0.28}" stroke="var(--accent)" stroke-width=".7"/><line x1="${px - .6}" y1="${Y(FL) - ph * 0.72}" x2="${px + pw + .6}" y2="${Y(FL) - ph * 0.72}" stroke="var(--accent)" stroke-width=".7"/>`;
    o.push(`<g data-pile="${nSt}" data-pile-w="${pw.toFixed(1)}"><title>Wood used: ${res.wood.toFixed(0)} mm, about ${nSt} sticks of 240 mm</title>${pic('woodpile', px, Y(FL) - ph, pw, ph, pile)}</g>`);
  }
  // swept ranges as dashed outlines, then the clickable dimension labels (main view only: they read the screen's sweep and editor)
  if (opts.ghosts) o.push(sweepGhosts(Y, legY));
  if (opts.dims) o.push(dimLabels(Y, x0, x1));
  return { svg: o.join(''), base, home };
}
function memWOf(s, e) { return s.mat.b * (e.n === 4 && e.bundle === 'compact' ? 2 : e.n); }
function memW(e) { return memWOf(S, e); }
function highlight(k) {
  if (hlElem === k) return;
  hlElem = k;
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
function renderKey() { return HOOKS.renderKey(); }
function renderKeyCore() {
  const bk = S.load.mBook1 + S.load.mBook2, need = bk * S.mat.FS;
  const ok = (c, txt) => `<b class="${c ? 'ok' : 'bad'}">${txt}</b>`;
  const s = res.stable, nr = noResultNow();
  if (nr) {   // UI-I10: no kg and no PASS while a value or the shape breaks the limits table (the summary is the app's own words)
    $('keyStrip').innerHTML = `<b>What Project I measures:</b> wood used ΣL (less is better) · capacity in kg of books (must reach books × FS = ${need.toFixed(1)} kg) · mid-span deflection (≤ ${S.opts.deflLimit} mm) · fits the 300 × 100 mm envelope with ≥ ${S.opts.minOverlap} mm on each desk.
    <div class="kv"><span>This design: <b>No result</b>. ${escH(nr.summary)}</span></div>`;
    return;
  }
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
      <div class="stat"><span class="k">Determinacy m + r vs 2j</span><span class="v">${res.m + res.r} vs ${2 * res.j}</span></div>`;
    const names = (res.loose || []).map(n => `${n} (${tr.keys[n]})`).join(', ');
    li.unshift(['bad', '<button type="button" class="btn acc sm" data-findstable="1">Find the closest stable bridge</button> This truss is a mechanism: the stiffness matrix cannot be solved. ' + (names ? `Joint${res.loose.length > 1 ? 's' : ''} ${names} ${res.loose.length > 1 ? 'are' : 'is'} only held by members in one straight line, so nothing stops ${res.loose.length > 1 ? 'them' : 'it'} moving sideways. Add a vertical or a diagonal there.` : 'No single joint is loose, so a whole block of the truss can swing. Usually that is two parts joined at just one joint (for example where an arch touches the top chord, which makes a hinge) or a four-sided panel with no diagonal.')]);
    msgs.innerHTML = li.map(([c, s]) => `<li class="${c}">${s}</li>`).join('');
    return;
  }
  const f = res.failing, nr = noResultNow();   // UI-I10: no PASS and no kg while the values or the shape break the limits table
  pill.innerHTML = nr ? '<span class="pill"><span aria-hidden="true">⟂</span> No result</span>' : (res.passes ? '<span class="pill ok">Passes all checks</span>' : `<span class="pill bad">Fails ${f.length ? f.length + ' member' + (f.length > 1 ? 's' : '') : 'a check'}</span>`) + (res.mode3 ? '<span class="mode3d" title="3D analysis">3D</span>' : '');
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
    <div class="stat"><span class="k">D<sub>max</sub> mid-span</span><span class="v" style="color:${res.deflOK ? 'inherit' : 'var(--bad)'}">${res.midDefl.toFixed(3)} mm</span><span class="s">limit ${(+S.opts.deflLimit).toFixed(1)} mm</span></div>
    <div class="stat"><span class="k">Capacity</span><span class="v" style="color:${nr ? 'inherit' : uCol}">${!nr && isFinite(res.capKg) ? res.capKg.toFixed(1) + ' kg' : '—'}</span><span class="s">${nr ? 'No result. ' + escH(nr.summary) : ''}${!nr && isFinite(res.capFactor) ? res.capFactor.toFixed(1) + '× the books' : ''}${nr ? '' : ` · most-used member ${worst.k} at ${(res.maxUtil * 100).toFixed(0)}% (${worst.mode || 'no load'})`}</span></div>
    <div class="stat"><span class="k">Determinacy m + r vs 2j</span><span class="v">${res.m + res.r} vs ${2 * res.j}</span></div>`;
  if (f.length) {
    const by = {}; f.forEach(m => { (by[m.mode] = by[m.mode] || []).push(m.k); });
    Object.entries(by).forEach(([mode, ks]) => li.push(['bad', `${mode === 'buckling' ? 'Buckles' : mode === 'crushing' ? 'Crushes' : 'Breaks in tension'}: member${ks.length > 1 ? 's' : ''} ${ks.join(', ')}.`]));
  }
  if (!res.edgeOK) li.push(['bad', `Each end reaches only ${res.overlap.toFixed(0)} mm onto the desks; the edge check needs at least ${(+S.opts.minOverlap).toFixed(0)} mm, or a slightly off-centre bridge could slip into the gap. Add desk panels or lengthen the bridge.`]);
  if (!res.deflOK) li.push(['bad', `Mid-span deflection ${res.midDefl.toFixed(3)} mm is over the ${S.opts.deflLimit} mm limit.`]);
  res.envelope.forEach(e => li.push(['bad', e]));
  if (res.size) { const o = res.size.outer, c = res.size.centre, f = v => (Math.round(v * 10) / 10).toFixed(1);
    li.push(['info', `Built size, outside faces (what the limits check): width ${f(o.width)} mm (${f(c.width)} centre to centre) · height ${f(o.height)} mm above the deck${res.size.tiesOnTop ? ', ties on top' : ''} (${f(c.height)}) · ${f(o.depth)} mm below (${f(c.depth)}) · length ${f(o.length)} mm (${f(c.length)}).`]); }
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
// the design facts to hand-check (UI-S10 4): they sit in a closed disclosure under the Members table
function factsHTML() {
  const angs = {};
  tr.elems.forEach(e => { if (e.type !== 'diag') return; const a = tr.nodes[e.i], b = tr.nodes[e.j]; angs[(Math.atan2(Math.abs(b[1] - a[1]), Math.abs(b[0] - a[0])) * 180 / Math.PI).toFixed(1)] = 1; });
  const sup = res.stable ? res.activeSupports.map(s => `${s.claw ? 'claw' : s.brace ? 'edge brace' : s.pin ? 'pin' : 'roller'} x=${tr.nodes[s.node][0].toFixed(0)}: ${s.Ry.toFixed(2)} N`).join(' · ') : '';
  const sumR = res.stable ? res.activeSupports.reduce((a, s) => a + s.Ry, 0) : 0;
  return `<dt>Design load on one truss</dt><dd>${res.Ptruss.toFixed(2)} N (W = ${res.W.toFixed(2)} N × FS ${S.mat.FS} ÷ ${S.load.nTruss})</dd>
    <dt>Book footprint</dt><dd>${(+S.bookLen).toFixed(0)} mm, x = ${tr.bookSpan[0].toFixed(0)} to ${tr.bookSpan[1].toFixed(0)} mm, over ${res.Fval.length} deck joints</dd>
    <dt>Diagonal angles</dt><dd>${Object.keys(angs).map(a => a + '°').join(', ') || 'no diagonals'}</dd>
    <dt>Side (end-post) angle</dt><dd>${tr.info.sideAngleActual.toFixed(1)}°</dd>
    <dt>Bottom chord</dt><dd>${tr.info.curve ? `${{ arc: 'circular arc', catenary: 'catenary', parabola: 'parabola' }[tr.info.shape]}, ${Math.abs(tr.info.curve).toFixed(0)} mm ${tr.info.curve < 0 ? 'below the deck (sag)' : 'above the desk (arch)'} at mid-span` : 'flat, at desk level'}</dd>
    <dt>Overlap on each desk</dt><dd>${tr.overlap.toFixed(0)} mm (edge check needs ≥ ${(+S.opts.minOverlap).toFixed(0)} mm${S.opts.minOverlap > 0 ? ` · ${(tr.overlap / S.opts.minOverlap).toFixed(2)}× the minimum` : ''})</dd>
    <dt>Panels</dt><dd>${tr.widths.length} total, ${tr.deskPanels} on each desk · overall ${tr.overall.toFixed(0)} mm</dd>
    ${sup ? `<dt>Reactions (hand-check)</dt><dd>${sup} · sum ${sumR.toFixed(2)} N</dd>` : ''}
    <dt>Wood used, one truss</dt><dd>${woodBreakdown()}</dd>
    <dt>Wood used, whole bridge</dt><dd>${woodTotalText()}</dd>`;
}
function renderTable() { const f = $('facts'); if (f) f.innerHTML = factsHTML(); }
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
    : '<span class="note">None yet. Mark members with ◎ in Analysis › Members.</span>';
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
// a CSV cell that a spreadsheet would read as a formula (= + - @ ...) is kept as text; plain numbers stay numbers
// a cell a spreadsheet would read as a formula gets a leading ' (CSV injection); leading spaces and tabs are looked past,
// since some spreadsheets trim them first (Black Hat, UI Engineer, TE-B-346/359). Plain signed numbers stay numbers.
function csvSafe(v) { if (typeof v !== 'string') return v; const t = v.replace(/[\u0000-\u001F\u007F]+/g, ' '), u = t.replace(/^\s+/, ''); return /^[=+\-@]/.test(u) && !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(u) ? "'" + t : t; }
function csvOf(rows) { return rows.map(r => r.map(v => { v = csvSafe(v); return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v; }).join(',')).join('\n'); }
function csvText() { return infoLines().map(l => '# ' + l).join('\n') + '\n' + csvOf(rowsForCsv()); }

