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
  let r2 = C.analyze(t2, S.mat, L, anaOpts(Object.assign(c.width3 != null ? { width: +c.width3 } : {}, (mode || S.anaMode) === '3d' ? { tilt: c.tilt3 != null ? +c.tilt3 : +S.d3.tilt || 0 } : { tilt: 0 })));
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
  return JSON.stringify({ ana: S.anaMode || '2d', d3: S.anaMode === '3d' ? [S.d3.topPat, S.d3.botPat, S.d3.framePat, S.d3.tilt, S.d3.botTies, swOn('Z') ? SW.brace3 : null].concat(S.d3.imperf && S.d3.imperf.on ? [S.d3.imperf] : []) : null, d, pat: swOn('P') ? null : S.pattern, vp: swOn('V') ? null : S.vertPreset, mat: S.mat, load: swOn('M') ? null : S.load, opts: S.opts, on: S.swOn, vals: SW_IDS.map(id => $(id).value), sel: SW, focus: swOn('F') ? S.focus : null });
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
async function idbGet(key) { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction('big').objectStore('big').get(key); q.onsuccess = () => res(cleanData(q.result)); q.onerror = () => rej(q.error); }); }
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
function renderSweep() { return HOOKS.renderSweep(); }
function renderSweepCore() {
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

