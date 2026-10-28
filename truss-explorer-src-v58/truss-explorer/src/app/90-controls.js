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
    box.innerHTML = `<svg viewBox="0 0 120 104" width="120" height="104">${h}</svg><button type="button" class="ncb home" title="Home view (F6)">⌂</button><button type="button" class="ncb rl" title="Turn 90° left">↺</button><button type="button" class="ncb rr" title="Turn 90° right">↻</button>`;
  };
  box.addEventListener('click', ev => {
    ev.stopPropagation();
    const f = ev.target.closest('.face'), c = ev.target.closest('.cmp'), b = ev.target.closest('.ncb');
    if (b) { if (b.classList.contains('home')) home(); else tween(v, { yaw: v.yaw + (b.classList.contains('rl') ? -1 : 1) * Math.PI / 2, pitch: v.pitch }, redraw); return; }
    if (f) { const F = FACES.find(q => q.t === f.dataset.f); tween(v, F.to, redraw); return; }
    if (c) tween(v, { yaw: +c.dataset.yaw, pitch: Math.abs(v.pitch) > 1.3 ? 0.35 : v.pitch }, redraw);
  });
  let d = null;
  box.addEventListener('mousedown', ev => { if (ev.target.closest('.ncb')) return; d = { x: ev.clientX, y: ev.clientY, yaw: v.yaw, pitch: v.pitch, moved: false }; ev.preventDefault(); });
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
    <div class="pz"><button type="button" class="ncb" data-d="in" title="Zoom in (+)">+</button><button type="button" class="ncb" data-d="out" title="Zoom out (−)">−</button></div>`;
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
    const t = C.buildTruss(design()); let r = C.analyze(t, S.mat, S.load, anaOpts());
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
function setFs(key) { return HOOKS.setFs(key); }
function setFsCore(key) {
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
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && fsEl && !window.SHELL_ON && !adj && !document.querySelector('.modal:not([hidden])')) setFs(null); });   // in the window layout Esc never leaves the place
window.addEventListener('resize', () => { if (fsEl) { renderDrawing(); drawTrackers(); try { render3D(); } catch (e) {} } });

