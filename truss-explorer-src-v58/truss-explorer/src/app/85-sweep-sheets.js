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
  const N = v => { const x = +v; return Number.isFinite(x) ? x : 0; };
  return `<p class="note" style="margin:0 0 6px"><b>${escH(sh.kind)}</b> · ${escH(new Date(sh.when).toLocaleString())} · ${escH(sh.analysis)} analysis · tested <b>${N(sh.tested).toLocaleString()}</b> of ${N(sh.total).toLocaleString()} designs${sh.sampled ? ' (an evenly spread random sample)' : ' (every design)'} · rules: FS ${N(sh.FS)}, books ${N(sh.bookKg).toFixed(2)} kg, deflection ≤ ${N(sh.defl)} mm, overlap ≥ ${N(sh.minOv)} mm.</p>
    <div class="tablewrap"><table><thead><tr><th class="l">Swept input</th><th>From</th><th>To</th><th>Step set</th><th>Values</th><th>${sh.sampled ? 'Step reached (about)' : 'Step reached'}</th></tr></thead><tbody>${[].concat(sh.rows || []).map(r => r.list
      ? `<tr><td class="l">${escH(r.name)}</td><td class="l" colspan="3">${escH([].concat(r.list).join(' / '))}</td><td>${N(r.count)}</td><td>${escH(r.eff || 'all')}</td></tr>`
      : `<tr><td class="l">${escH(r.name)}</td><td>${escH(f(r.from))}</td><td>${escH(f(r.to))}</td><td>${escH(f(r.step))}</td><td>${N(r.count)}</td><td>${r.eff != null ? '≈ ' + escH(f(r.eff)) : escH(f(r.step))}</td></tr>`).join('') || '<tr><td class="l" colspan="6">Nothing was swept.</td></tr>'}</tbody></table></div>
    <p class="note" style="margin:6px 0 0">Everything else was fixed at: ${escH(sh.fixed)}.${sh.sampled ? ' "Step reached" is how far apart the sampled designs are, on average, in each swept input: the sample covers the whole range, but less finely than the step set.' : ''}</p>`;
}
function sheetCSV(sh) {
  const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const fi = fileInfo(sweepInfo().model);
  const head = [['Made with', `SE 310 Truss Explorer ${fi.release} (solver ${fi.solver})`], ['Bridge code', fi.bridgeCode], ['Run', sh.kind], ['When', sh.when], ['Analysis', sh.analysis], ['Designs tested', sh.tested], ['Designs in the ranges', sh.total], ['Sampled', sh.sampled ? 'yes' : 'no'], ['FS', sh.FS], ['Books (kg)', sh.bookKg], ['Deflection limit (mm)', sh.defl], ['Min overlap (mm)', sh.minOv], ['Fixed inputs', sh.fixed], []];
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
  try { const o = TrussFormats.open(await f.text()); if (!o.ok || o.kind !== 'bridge') throw 0; abFiles[abPickSide] = Object.assign({ name: o.doc.name }, o.doc.bridge); }
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

