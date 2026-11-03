// ---------- 3D view (prototype)
// a fresh page's 3D setup; a starter preset puts it back too (#281), so a preset gives the same bridge whatever came before
function d3Defaults() { return { tilt: 0, botTies: true, topBr: 'single', botBr: 'single', sway: true, imperf: { on: false, alpha: 0.02, beta: 0.005, dir: 1 }, topPat: ['S'], botPat: ['S'], framePat: ['D', 'N'], sec: 0 }; }
S.d3 = Object.assign({ tilt: 0, botTies: true, topBr: 'single', botBr: 'single', sway: true }, S.d3 || {});
S.d3.imperf = Object.assign({ on: false, alpha: 0.02, beta: 0.005, dir: 1 }, S.d3.imperf || {});
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
// imperfection loads in 3D (#117): off by default, so the results are the perfect model's, as before
function imperfOpt() { const q = S.d3.imperf; return q && q.on ? { imperf: { alpha: +q.alpha || 0, beta: +q.beta || 0, dir: +q.dir || 1 } } : null; }
function paintImperf() { const q = S.d3.imperf; $('imperf3d').checked = !!q.on; setVal('impAlpha', q.alpha); setVal('impBeta', q.beta); $('impDir').value = String(q.dir < 0 ? -1 : 1); $('imperfVals').style.opacity = q.on ? '' : '.5'; }
['imperf3d', 'impAlpha', 'impBeta', 'impDir'].forEach(id => $(id).addEventListener('change', () => {
  const q = S.d3.imperf; q.on = $('imperf3d').checked; const a = +$('impAlpha').value, b = +$('impBeta').value;
  if (a >= 0 && a <= 0.2) q.alpha = a; if (b >= 0 && b <= 0.1) q.beta = b; q.dir = +$('impDir').value < 0 ? -1 : 1;
  paintImperf(); save(); d3Changed();
}));
function paint3Inputs() { paintImperf(); setVal('tilt3d', S.d3.tilt); $('botTies3d').checked = S.d3.botTies; setVal('width3d', S.opts.width); $('d3ShowPlan').checked = S.d3.showPlan !== false; $('d3ShowSec').checked = S.d3.showSec !== false; paint3Show(); }
function paint3Show() {
  const pl = S.d3.showPlan !== false, se = S.d3.showSec !== false;
  $('d3Plan').parentElement.hidden = !pl; $('d3Sec').parentElement.hidden = !se;
  $('d3Views').hidden = !pl && !se;
}
$('width3d').addEventListener('change', () => guardNum('width3d', WIDTH_LIM[0], WIDTH_LIM[1], S.opts.width, v => { S.opts.width = v; setVal('width', v); update(); }, 'Bridge width'));
$('d3ShowPlan').addEventListener('change', () => { S.d3.showPlan = $('d3ShowPlan').checked; save(); paint3Show(); });
$('d3ShowSec').addEventListener('change', () => { S.d3.showSec = $('d3ShowSec').checked; save(); paint3Show(); });
$('tilt3d').addEventListener('change', () => guardNum('tilt3d', -30, 30, +S.d3.tilt || 0, v => { S.d3.tilt = v; save(); d3Changed(); }, 'Tilt', '°'));
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
  try { m = Truss3D.build3D(t2, o); q = Truss3D.analyze3D(m, mat, load, imperfOpt()); } catch (e) { return Object.assign({}, r2, { stable: false, passes: false, unstable3D: true }); }
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
  r3 = Truss3D.analyze3D(m3, mat, S.load, imperfOpt());
  draw3D(); paint3Chips(); draw3Views(); renderTable3();
  const cap2 = res.stable ? res.capKg : NaN;
  $('d3Status').textContent = r3.stable ? `${r3.failing.length ? 'fails' : 'passes strength'} · capacity ${r3.capKg.toFixed(1)} kg` : 'unstable';
  if (!r3.stable) { $('d3Facts').innerHTML = `<b style="color:var(--bad)">Unstable in 3D.</b> With pin joints the two trusses can sway or rack sideways. Brace both the top and bottom planes (xy), and add cross-frames (zy) at least at the ends; a plane with no bracing lets its chord swing sideways between frames.${m3.warn.length ? ' ' + m3.warn.join(' ') : ''}`; return; }
  const fails = r3.failing.map(m => `${X.TYPE_LABEL[m.type] || ({ tie: 'Tie', lat: 'Lateral brace', sway: 'Sway brace' })[m.type]} (${m.side}) ${m.F.toFixed(1)} N ${m.mode}`);
  const typeWood = {}; m3.elems.forEach((e, k) => { const t = e.side === 'cross' ? e.type : 'side trusses'; typeWood[t] = (typeWood[t] || 0) + r3.members[k].L * e.n; });
  $('d3Facts').innerHTML = `Wood in the 3D model: <b>${r3.wood.toFixed(0)} mm</b> (${Object.entries(typeWood).map(([t, v]) => `${({ tie: 'ties', lat: 'lateral bracing', sway: 'sway diagonals' })[t] || t} ${v.toFixed(0)}`).join(', ')}).
    ${r3.imperf ? `Imperfection loads on: bow ${(r3.imperf.alpha * 100).toFixed(1)}% of each compression chord force ${r3.imperf.dir < 0 ? 'inward' : 'outward'}, sway ${(r3.imperf.beta * 100).toFixed(1)}% of each joint load (${r3.imperf.lateral.toFixed(2)} N sideways in all), so the bracing forces below are realistic. ` : ''}Capacity <b>${r3.capKg.toFixed(1)} kg</b> (2D: ${Number.isFinite(cap2) ? cap2.toFixed(1) : '—'} kg) · highest use ${(r3.maxUtil * 100).toFixed(0)}% · deck deflection <b>${r3.deckDefl.toFixed(3)} mm</b> (2D: ${res.stable ? res.midDefl.toFixed(3) : '—'} mm) · largest sideways movement ${r3.sideSway.toFixed(3)} mm.
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
  // edge stops (#239): with "ends bear on the table edge", the same stops the 2D view and the build documents show, on both
  // trusses: a short stick under each corner joint, hanging down the table's face (drawn see-through) so the edge pushes it inward
  v3.edgeStops = 0;
  if (tr.design.edgeBear && window.BuildDoc) {
    const bS = +S.mat.b || 3.18, stops = BuildDoc.edgeStops(tr, bS), tz = Math.min(+S.tableThick || 30, 60);
    if (stops.length) {
      ctx.globalAlpha = 0.28; [0, 200].forEach(x => poly([[x, -Wd, 0], [x, Wd, 0], [x, Wd, -tz], [x, -Wd, -tz]], cssv('--desk'), cssv('--muted'))); ctx.globalAlpha = 1;
    }
    stops.forEach(st => {
      const i = tr.supports.findIndex(s => s.node === st.node); if (i < 0) return;
      [m3.supports[2 * i], m3.supports[2 * i + 1]].forEach(s => {
        if (!s || s.ghost) return;
        const [x, y, z] = m3.nodes[s.node], xc = (st.x0 + st.x1) / 2, a = proj(xc, y, z), q = proj(xc, y, z - (st.y1 - st.y0));
        ctx.strokeStyle = cssv('--warn'); ctx.lineWidth = Math.max(2.5, 3.18 * sc * 0.9); ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); v3.edgeStops++;
      });
    });
    if (v3.edgeStops) { const q = proj(0, -Wd, -tz); ctx.font = '9px IBM Plex Mono, monospace'; ctx.fillStyle = cssv('--warn'); ctx.textAlign = 'left'; ctx.fillText('edge stops bear on the table face', q[0], q[1] + 12); }
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
  if (!SweepState.rows().length && !sv.length) { emptyCanvas(cv, 'Run the sweep above to fill this chart.'); $('curveTbl').innerHTML = ''; $('curveLegend').innerHTML = ''; curvePts = null; return; }
  const groups = SweepState.rows().length ? groupsOf(SweepState.rows()) : [];
  const series = groups.map((g, gi) => ({ label: g.label, g: g.label, off: isHid(g.label), tip: groupTip(g), color: S.groupBy === 'none' ? cssv('--accent') : gcolor(gi), data: curveFor(g.rows) }));
  sv.forEach(s => series.push({ label: `saved: ${s.name}`, color: gcolor(s.i + 3), dash: true, data: savedCurve(s) }));
  const shown = series.filter(s => !s.off);
  const all = shown.flatMap(s => s.data.filter(d => d.wood != null));
  if (!all.length) { emptyCanvas(cv, series.some(s => s.off) ? 'Every group is hidden: click a group below to show it.' : 'No design passes at these load levels.'); $('curveLegend').innerHTML = legendHTML(series.map(s => ({ color: s.color, label: s.label, dash: s.dash, g: s.g, off: s.off, tip: s.tip }))); $('curveTbl').innerHTML = ''; return; }
  const lv = levels();
  let xr = [lv[0] - 10, lv[lv.length - 1] + 10];
  const yv = all.map(d => d.wood); let yr = [Math.min(...yv) * 0.9, Math.max(...yv) * 1.08];
  if (drawCurve.ref !== SweepState.rows()) { curveView = null; drawCurve.ref = SweepState.rows(); }
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
  let t = `<thead><tr><th>Load level</th><th>Books (kg)</th>${series.map(s => `<th>${escH(s.label)}</th>`).join('')}</tr></thead><tbody>`;
  const bk = SweepState.ctx() ? SweepState.ctx().bookKg : S.load.mBook1 + S.load.mBook2;
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


