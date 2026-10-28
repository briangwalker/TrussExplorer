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
try { saved = cleanData(JSON.parse(localStorage.getItem(SKEY) || '[]')) || []; if (!Array.isArray(saved)) saved = []; } catch (e) { saved = []; }
function persistSaved() { try { localStorage.setItem(SKEY, JSON.stringify(saved)); return true; } catch (e) { return false; } }
function renderSaved() {
  const el = $('savedList'); el.innerHTML = '';
  saved.forEach((sv, i) => {
    const wrap = document.createElement('span'); wrap.className = 'chip on'; wrap.style.display = 'inline-flex'; wrap.style.gap = '6px'; wrap.style.alignItems = 'center'; wrap.style.padding = '4px 8px';
    wrap.innerHTML = `<label class="check" style="font-size:12px"><input type="checkbox" ${sv.show !== false ? 'checked' : ''} data-sv="${i}"> <span class="swatch" style="background:${gcolor(i + 3)};opacity:.6"></span>${escH(sv.name)}</label><span class="note" style="font-size:11px">FS ${sv.FS} · ${sv.bookKg.toFixed(2)} kg</span><button type="button" class="btn ghost sm" data-del="${i}" aria-label="Delete saved sweep ${sv.name}" style="padding:0 6px">×</button>`;
    el.appendChild(wrap);
  });
  el.querySelectorAll('input[data-sv]').forEach(c => c.addEventListener('change', () => { saved[+c.dataset.sv].show = c.checked; persistSaved(); drawTrackers(); }));
  el.querySelectorAll('button[data-del]').forEach(b => b.addEventListener('click', () => { saved.splice(+b.dataset.del, 1); persistSaved(); renderSaved(); drawTrackers(); }));
}
$('saveSweep').addEventListener('click', () => {
  if (!sweepAll.length) { $('saveMsg').textContent = 'Run a sweep first.'; return; }
  const name = cleanData(($('cmpName').value || `FS ${sweepCtx.FS} · ${(+sweepCtx.bookKg || 0).toFixed(1)} kg`).slice(0, 40));
  const trade = frontier(sweepAll).map(r => ({ wood: r.wood, capKg: r.capKg, label: summaryOf(r) }));
  const cf = frontier(sweepAll, combined).map(r => ({ wood: r.wood, cf: combined(r), label: summaryOf(r) }));
  saved.push({ name, FS: sweepCtx.FS, bookKg: sweepCtx.bookKg, trade, cf, show: true });
  if (saved.length > 12) saved.shift();
  $('saveMsg').textContent = persistSaved() ? `Saved "${name}" in this browser.` : `Saved "${name}" for this visit only (this browser blocks storage).`;
  $('cmpName').value = ''; renderSaved(); drawTrackers();
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
  if ((S.groupBy || 'none') === 'none') return items.map(it => `<span><span class="swatch" style="background:${it.color}"></span>${escH(it.label)}</span>`).join('') + '<span class="lghint">To hide some kinds of design, pick "Group by" above (pattern, panels…), then click a group here to hide or show it.</span>';
  return items.map(it => `<span${it.g != null ? ` class="lg${it.off ? ' off' : ''}" data-g="${String(it.g).replace(/"/g, '&quot;')}" title="${String(it.tip || `Click to ${it.off ? 'show' : 'hide'} this group`).replace(/"/g, '&quot;')}"` : ''}><span class="swatch" style="background:${it.color};${it.dash ? 'opacity:.6;outline:1px dashed ' + it.color + ';outline-offset:1px' : ''}"></span>${escH(it.label)}</span>`).join('')
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
  const csv = infoLines(sweepInfo()).map(l => '# ' + l).concat([all.join(',')], sweepAll.map(r => all.map(k => esc(r[k])).join(','))).join('\n');
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

