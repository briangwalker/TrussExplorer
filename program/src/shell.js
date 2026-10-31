// balsaPixel 1.0 shell (Full-Screen UI Spec): the theme setup (#108) and step 1, the windows and the top bar.
// Its own <script> after app.js. It reaches the app only through window.TrussApp (state, res, rows, fsEl, hooks, save, toast, escH, topOn, redraw).
// ?layout=classic keeps the v61 page (the UI tests that predate the shell use it).
(function () {
'use strict';
const A = window.TrussApp; if (!A) return;
const S = A.state, $ = id => document.getElementById(id), { save, toast, escH } = A;
const SH_CLASSIC = /(^|[?&])layout=classic(&|$)/.test(location.search.slice(1)) || S.layout === 'classic';
window.SHELL_ON = !SH_CLASSIC;
if (!SH_CLASSIC) {
  // ---------- built-in themes (build.py fills THEME_PACK from themes/index.json) ----------
  const THEME_PACK = /*THEMES*/{ files: {}, list: [] };
  const THEME_LIST = [{ id: 'wireframe', name: 'Wireframe' }, { id: 'og', name: 'OG (v61)' }].concat(THEME_PACK.list.filter(t => t.css && THEME_PACK.files[t.css]));
  const PLACES = ['truss', 'analysis'], STATES = ['W', 'I', 'T'];
  const DEF = { place: 'truss', bar: 'W', hist: [], theme: 'wireframe',
    w: { truss: { inputs: 'W', view: 'W', drawing: 'I', sweep: 'T', results: 'T' }, analysis: { inputs: 'T', view: 'W', drawing: 'W', sweep: 'T', results: 'T' } } };
  const sh0 = S.shell && typeof S.shell === 'object' ? S.shell : {};
  if (!sh0.w && innerWidth < 700) { DEF.w.truss = { inputs: 'T', view: 'I', drawing: 'T', sweep: 'T', results: 'T' }; DEF.w.analysis = { inputs: 'T', view: 'I', drawing: 'T', sweep: 'T', results: 'T' }; DEF.bar = 'I'; }   // a phone starts with the picture
  S.shell = { place: PLACES.includes(sh0.place) ? sh0.place : DEF.place, bar: STATES.includes(sh0.bar) ? sh0.bar : DEF.bar,
    hist: Array.isArray(sh0.hist) ? sh0.hist.filter(p => PLACES.includes(p)).slice(-20) : [], theme: typeof sh0.theme === 'string' ? sh0.theme : DEF.theme, w: {} };
  PLACES.forEach(p => { S.shell.w[p] = {}; Object.keys(DEF.w[p]).forEach(k => { const v = sh0.w && sh0.w[p] && sh0.w[p][k]; S.shell.w[p][k] = STATES.includes(v) ? v : DEF.w[p][k]; }); });
  S.wide = false; S.inputsFirst = false;   // the v61 view switch has no meaning here

  // ---------- the stage: everything on the page goes inside #stage[data-theme] ----------
  const stage = document.createElement('div'); stage.id = 'stage';
  while (document.body.firstChild) stage.appendChild(document.body.firstChild);
  document.body.appendChild(stage); document.body.classList.add('shell');
  const themeStyle = document.createElement('style'); themeStyle.id = 'themeCss'; document.head.appendChild(themeStyle);
  // the shared screen pieces (#354, docs/pieces.md): their CSS reaches only what they built (data-pc), so the rest of the shell is unchanged
  const PC = window.TrussPieces; PC.install(document);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // references taken before anything moves
  const R = { pane: $('inputsPane'), drawopts: $('showDims').closest('.drawopts'), topSeg: $('topViewSeg'), legend: $('drawWrap').parentElement.querySelector('.legend'),
    memBd: $('s-members').querySelector('.bd'), sweepBd: $('s-sweep').querySelector('.bd'), sweepBtns: $('sweepBtns'), sweepCount: $('sweepCount'),
    stats: $('stats'), msgs: $('msgs') };

  // ---------- the top bar ----------
  const SWP = { t2: '<svg width="84" height="36" viewBox="0 0 84 36" aria-hidden="true" style="display:block;flex:none"><rect x="1" y="4" width="82" height="28" rx="14" style="fill:var(--te-surface-2);stroke:var(--te-ctl-line)"/><rect x="3" y="6" width="40" height="24" rx="12" style="fill:var(--te-strong)"/><path d="M10 25H34M13 14H31M10 25L13 14L18 25L22 14L26 25L31 14L34 25" style="stroke:var(--te-on-strong)" stroke-width="1.3" fill="none" stroke-linejoin="round"/><g stroke="#9aa3ac" stroke-width="1.1" fill="none" stroke-linejoin="round"><path d="M51 26H68M54 17H68M51 26L54 17L59 26L62 17L68 26"/><path d="M56 22H73M59 13H73M68 17L73 13M68 26L73 22M54 17L59 13M73 13V22" opacity=".75"/></g></svg>',
    t3: '<svg width="84" height="36" viewBox="0 0 84 36" aria-hidden="true" style="display:block;flex:none"><rect x="1" y="4" width="82" height="28" rx="14" style="fill:var(--te-surface-2);stroke:var(--te-ctl-line)"/><path d="M13 25H37M16 14H34M13 25L16 14L21 25L25 14L29 25L34 14L37 25" stroke="#9aa3ac" stroke-width="1.3" fill="none" stroke-linejoin="round"/><rect x="41" y="6" width="40" height="24" rx="12" style="fill:var(--te-strong)"/><g style="stroke:var(--te-on-strong)" stroke-width="1.1" fill="none" stroke-linejoin="round"><path d="M48 26H65M51 17H65M48 26L51 17L56 26L59 17L65 26"/><path d="M53 22H70M56 13H70M65 17L70 13M65 26L70 22M51 17L56 13M70 13V22" opacity=".75"/></g></svg>',
    a2: '<svg width="84" height="36" viewBox="0 0 84 36" aria-hidden="true" style="display:block;flex:none"><rect x="1" y="4" width="82" height="28" rx="14" style="fill:var(--te-surface-2);stroke:var(--te-ctl-line)"/><rect x="3" y="6" width="40" height="24" rx="12" style="fill:var(--te-strong)"/><path d="M12 10V26H34" style="stroke:var(--te-on-strong)" stroke-width="1.3" fill="none"/><g style="fill:var(--te-on-strong)"><circle cx="17" cy="22" r="1.7"/><circle cx="21" cy="19" r="1.7"/><circle cx="25" cy="20" r="1.7"/><circle cx="28" cy="15" r="1.7"/><circle cx="31" cy="13" r="1.7"/></g><path d="M62 21V9M62 21L75 26M62 21L51 27" stroke="#9aa3ac" stroke-width="1.2" fill="none"/><g fill="#9aa3ac"><circle cx="66" cy="16" r="2.1"/><circle cx="70" cy="20" r="1.8"/><circle cx="58" cy="18" r="1.4"/><circle cx="64" cy="12" r="1.2"/><circle cx="56" cy="23" r="1.6"/></g></svg>',
    a3: '<svg width="84" height="36" viewBox="0 0 84 36" aria-hidden="true" style="display:block;flex:none"><rect x="1" y="4" width="82" height="28" rx="14" style="fill:var(--te-surface-2);stroke:var(--te-ctl-line)"/><path d="M15 10V26H37" stroke="#9aa3ac" stroke-width="1.3" fill="none"/><g fill="#9aa3ac"><circle cx="20" cy="22" r="1.7"/><circle cx="24" cy="19" r="1.7"/><circle cx="28" cy="20" r="1.7"/><circle cx="31" cy="15" r="1.7"/><circle cx="34" cy="13" r="1.7"/></g><rect x="41" y="6" width="40" height="24" rx="12" style="fill:var(--te-strong)"/><path d="M59 21V9M59 21L72 26M59 21L48 27" style="stroke:var(--te-on-strong)" stroke-width="1.2" fill="none"/><g style="fill:var(--te-on-strong)"><circle cx="63" cy="16" r="2.1"/><circle cx="67" cy="20" r="1.8"/><circle cx="55" cy="18" r="1.4"/><circle cx="61" cy="12" r="1.2"/><circle cx="53" cy="23" r="1.6"/></g></svg>' };
  const TABNAME = { trade: 'Trade-off', c3: 'Trade-off 3D', hist: 'History', curve: 'Wood curve' };
  const nav = el('nav', 'nav'); nav.setAttribute('aria-label', 'Main'); nav.id = 'shellNav';
  const menuBtn = $('dockBtn'); menuBtn.className = 'nb r'; menuBtn.setAttribute('aria-label', 'Menu'); menuBtn.title = 'Menu: files, export, sweep, look and controls, help';
  const backBtn = el('button', 'nb r', '←'); backBtn.type = 'button'; backBtn.id = 'navBack'; backBtn.setAttribute('aria-label', 'Back'); backBtn.title = 'Back to where you were';
  const vpT = el('div', 'vp'), vpA = el('div', 'vp');
  const growBar = el('button', 'nb r sm', '›'), foldBar = el('button', 'nb r sm', '‹'); growBar.type = foldBar.type = 'button'; growBar.id = 'navGrow'; foldBar.id = 'navFold';
  nav.append(menuBtn, backBtn, vpT, vpA, growBar, foldBar);
  const barTab = el('button', 'tabE t'); barTab.type = 'button'; barTab.id = 'navTab'; barTab.style.left = '58px'; barTab.style.top = '12px';
  const card = el('button', 'res s-pan'); card.type = 'button'; card.id = 'resCard'; card.setAttribute('aria-expanded', 'false'); card.title = 'Results: click for the full list';
  const dockMenu = $('dockMenu'); dockMenu.classList.add('drawer', 'sheet');
  document.querySelectorAll('.modalcard').forEach(c => c.classList.add('sheet'));
  stage.append(nav, barTab, card, dockMenu);

  const place = () => S.shell.place;
  const sw = (which, d) => `<span class="swb">${SWP[which + (d === '3d' || d === 'c3' ? '3' : '2')]}<button type="button" style="left:0" data-sw="${which}:2" aria-label="${which === 't' ? 'Truss' : 'Analysis'} in 2D" aria-pressed="${!(d === '3d' || d === 'c3')}" title="${which === 't' ? 'Truss' : 'Analysis'} in 2D"></button><button type="button" style="right:0" data-sw="${which}:3" aria-label="${which === 't' ? 'Truss' : 'Analysis'} in 3D" aria-pressed="${d === '3d' || d === 'c3'}" title="${which === 't' ? 'Truss' : 'Analysis'} in 3D"></button></span>`;
  function passCount() { try { let n = 0; for (const r of A.rows) if (r.passes) n++; return n; } catch (e) { return 0; } }
  function paintNav() {
    const P = place(), st = S.shell.bar, words = st === 'W', tOn = P === 'truss';
    nav.hidden = st === 'T'; barTab.hidden = st !== 'T';
    vpT.className = 'vp ' + (tOn ? 'on' : 'off'); vpA.className = 'vp ' + (tOn ? 'off' : 'on');
    vpT.innerHTML = (words ? `<button type="button" class="lab" data-go="truss" aria-pressed="${tOn}">Truss</button>` : '') + sw('t', S.anaMode);
    const n = passCount();
    vpA.innerHTML = (words ? `<button type="button" class="lab" data-go="analysis" aria-pressed="${!tOn}">Analysis${n ? ` <span class="badge" title="designs that pass in the sweep">${n.toLocaleString()}</span>` : ''}</button>` : '') + sw('a', S.tab === 'c3' ? 'c3' : 'trade')
      + (words ? `<button type="button" class="lab" data-go="analysis" id="navLast" title="The analysis tab you were on">${TABNAME[S.tab] || ''}</button>` : '');
    backBtn.disabled = !S.shell.hist.length;
    growBar.hidden = st === 'W'; foldBar.setAttribute('aria-label', st === 'W' ? 'Shrink the top bar to icons' : 'Shrink the top bar to a tab');
    growBar.setAttribute('aria-label', 'Grow the top bar to words and icons');
    barTab.textContent = `› ${P === 'truss' ? 'Truss' : 'Analysis'} · ${(P === 'truss' ? S.anaMode === '3d' : S.tab === 'c3') ? '3D' : '2D'}`;
    barTab.setAttribute('aria-label', 'Show the top bar');
    tagAll(); layoutSoon();
  }
  nav.addEventListener('click', ev => {
    const g = ev.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
    const s = ev.target.closest('[data-sw]'); if (s) {
      const [w, d] = s.dataset.sw.split(':');
      if (w === 't') { const b = $('anaSwitch').querySelector(`[data-ana="${d}d"]`); if (b && S.anaMode !== d + 'd') b.click(); go('truss'); }
      else { const b = $('chartDimDock').querySelector(`[data-cd="${d === '3' ? 'c3' : 'trade'}"]`); go('analysis'); if (b) b.click(); }
      paintNav(); return;
    }
  });
  backBtn.addEventListener('click', () => { const p = S.shell.hist.pop(); if (p) go(p, true); });
  foldBar.addEventListener('click', () => { S.shell.bar = S.shell.bar === 'W' ? 'I' : 'T'; save(); paintNav(); });
  growBar.addEventListener('click', () => { S.shell.bar = 'W'; save(); paintNav(); });
  barTab.addEventListener('click', () => { S.shell.bar = 'I'; save(); paintNav(); });

  // ---------- results card (top centre) ----------
  function paintCard() {
    const res = A.res; if (!res) return;
    const need = (S.load.mBook1 + S.load.mBook2) * S.mat.FS, s = res.stable;
    const tag = S.anaMode === '3d' ? ' <span class="badge">3D</span>' : '';
    card.innerHTML = s
      ? `<span>Σ ${res.wood.toFixed(0)} mm · <span class="${res.capKg >= need - 1e-9 ? '' : 'bad'}">${res.capKg.toFixed(1)} ${res.capKg >= need - 1e-9 ? '≥' : '<'} ${need.toFixed(1)} kg</span> · <span class="${res.deflOK ? '' : 'bad'}">${res.midDefl.toFixed(3)} ${res.deflOK ? '≤' : '>'} ${S.opts.deflLimit} mm</span></span><span class="pill ${res.passes ? 'ok' : 'bad'}">${res.passes ? '✓ PASSES' : '✕ FAILS'}</span>${tag} <span aria-hidden="true">▾</span>`
      : `<span>no capacity: the truss is a mechanism</span><span class="pill bad">✕ UNSTABLE</span>${tag} <span aria-hidden="true">▾</span>`;
    tagAll(); layoutSoon();
  }
  card.addEventListener('click', () => { setState('results', S.shell.w[place()].results === 'W' ? 'T' : 'W'); });
  const H = A.hooks, keyCore = H.renderKey, sweepCore = H.renderSweep, fsCore = H.setFs;
  let togReady = false;   // the drawing toggles (below) follow every render once they exist
  H.renderKey = () => { keyCore(); paintCard(); if (togReady) paintToggles(); };
  H.renderSweep = () => { const r = sweepCore(); paintNav(); return r; };

  // ---------- windows: W (words and icons) → I (icons) → T (an edge tab) ----------
  const WIN = {
    inputs: { home: 'left', title: () => 'Inputs', glyph: '✎', w: 400 },
    view: { home: 'top', title: () => 'View options', glyph: '◐' },
    drawing: { home: 'right', title: () => place() === 'truss' ? 'Drawing' : 'Chart key', glyph: '▤', w: 340 },
    sweep: { home: 'bottom', title: () => 'Sweep', glyph: '▶', w: 640 },
    results: { home: 'res', title: () => 'Results', glyph: 'Σ', w: 540 },
  };
  const VIEW_ICONS = { showDims: ['✎', 'Input labels'], resOnDraw: ['Σ', 'Results on the drawing'], showForces: ['F', 'Member forces'], d3ShowPlan: ['⊞', 'Plan view (3D)'], d3ShowSec: ['⊡', 'End view (3D)'],
    showGhosts: ['◌', 'Sweep ranges'], showIds: ['#', 'Node numbers'], showElems: ['№', 'Member numbers'], showDef: ['∿', 'Deformed shape'] };
  const wins = {}, tabs = {};
  Object.entries(WIN).forEach(([id, w]) => {
    if (id === 'drawing') {   // built from the window piece (UI-W5); the piece runs its own three states, tab and peek (mountWindow below)
      const st = S.shell.w[place()].drawing;
      stage.insertAdjacentHTML('beforeend', PC.windowHTML({ id, title: w.title(), home: 'right', state: st }) + PC.edgeTabHTML({ id, title: w.title(), home: 'right', state: st }));
      wins[id] = $('win-drawing'); tabs[id] = stage.querySelector('.tabE[data-tab="drawing"]'); return;
    }
    const s = el('section', 's-pan'); s.dataset.win = id; s.dataset.home = w.home; s.setAttribute('aria-label', w.title()); s.id = 'win-' + id;
    s.innerHTML = `<div class="s-ph"><span class="grip" aria-hidden="true">⋮⋮</span><span class="wt"></span><span class="stp"><button type="button" class="s-ic sm" data-step="shrink"></button><button type="button" class="s-ic sm" data-step="grow"></button></span></div>`
      + (id === 'sweep' ? '<div class="s-sum"></div>' : '') + '<div class="s-bd"></div><div class="s-icons" role="toolbar"></div>';
    stage.appendChild(s); wins[id] = s;
    if (w.home !== 'res') { const t = el('button', 'tabE ' + ({ left: 'l', right: 'r', bottom: 'b', top: 't' })[w.home]); t.type = 'button'; t.dataset.tab = id; stage.appendChild(t); tabs[id] = t; }
  });
  const order = ['T', 'I', 'W'];
  // the Drawing window's states, tab and peek come from the piece; the shell keeps each place's state (UI-A9) and the layout
  const drawWin = PC.mountWindow(wins.drawing, tabs.drawing, { onState: st => { S.shell.w[place()].drawing = st; save(); paintWins(); } });
  function setState(id, v) { if (id === 'drawing') { drawWin.setState(v); return; } S.shell.w[place()][id] = v; save(); wins[id].classList.remove('peek'); paintWins(); }
  function step(id, dir) {
    const cur = S.shell.w[place()][id];
    if (id === 'results') { setState(id, dir > 0 ? 'W' : 'T'); return; }
    setState(id, order[Math.max(0, Math.min(2, order.indexOf(cur) + dir))]);
  }
  stage.addEventListener('click', ev => {
    const b = ev.target.closest('[data-step]'); if (b) { const id = b.closest('.s-pan').dataset.win; if (id !== 'drawing') step(id, b.dataset.step === 'grow' ? 1 : -1); return; }
    const t = ev.target.closest('.tabE[data-tab]'); if (t && t.dataset.tab === 'drawing') return;
    if (t) { setState(t.dataset.tab, 'W'); const f = wins[t.dataset.tab].querySelector('.s-bd button, .s-bd input, .s-bd select, .s-bd summary'); if (f) f.focus({ preventScroll: true }); return; }
    const i = ev.target.closest('.s-icons [data-ic]'); if (i) iconAct(i.closest('.s-pan').dataset.win, i.dataset.ic);
  });
  // hover a tab to peek at the window; it goes away when the pointer leaves both
  let peekT = null;
  const unpeek = id => { clearTimeout(peekT); peekT = setTimeout(() => { if (!wins[id].matches(':hover') && !(tabs[id] && tabs[id].matches(':hover'))) { wins[id].classList.remove('peek'); layout(); } }, 280); };
  Object.entries(tabs).forEach(([id, t]) => {
    if (id === 'drawing') return;   // the window piece peeks for itself (UI-W9, UI-W17)
    t.addEventListener('mouseenter', () => { clearTimeout(peekT); peekT = setTimeout(() => { if (S.shell.w[place()][id] === 'T') { wins[id].classList.add('peek'); layout(); } }, 220); });
    t.addEventListener('mouseleave', () => unpeek(id));
    wins[id].addEventListener('mouseleave', () => { if (wins[id].classList.contains('peek')) unpeek(id); });
    wins[id].addEventListener('mouseenter', () => { if (wins[id].classList.contains('peek')) clearTimeout(peekT); });
  });

  // icons for the I state
  function icons(id) {
    if (id === 'inputs') return [...R.pane.querySelectorAll(':scope > details.grp')].map((d, k) => { const h = d.querySelector('summary h3'); const t = h ? h.textContent.trim() : 'Section ' + (k + 1); const m = t.match(/^(\d+)/); return { ic: 'g' + k, g: m ? m[1] : t[0], label: t }; });
    if (id === 'drawing' && place() === 'truss') return Object.entries(VIEW_ICONS).filter(([k]) => TOGGLES.includes(k)).map(([k, [g, label]]) => ({ ic: k, g, label, on: $(k).checked }));
    if (id === 'view' && place() === 'analysis') return [...document.querySelectorAll('#trackTabs [role="tab"]')].map(b => ({ ic: 't:' + b.dataset.t, g: ({ trade: '⋰', hist: '☰', curve: '⌒' })[b.dataset.t] || '•', label: b.textContent.trim(), on: b.getAttribute('aria-selected') === 'true' }));
    if (id === 'sweep') return [{ ic: 'run', g: '▶', label: 'Run the sweep' }, { ic: 'grow', g: '⋯', label: 'Show the sweep' }];
    return [{ ic: 'grow', g: WIN[id].glyph, label: 'Show ' + WIN[id].title() }];
  }
  function paintIcons(id) {
    const box = wins[id].querySelector('.s-icons'), list = icons(id);
    box.setAttribute('aria-label', WIN[id].title() + ' (icons)');
    box.innerHTML = list.map(x => `<button type="button" class="s-ic${x.on ? ' on' : ''}" data-ic="${escH(x.ic)}" title="${escH(x.label)}" aria-label="${escH(x.label)}"${x.on != null ? ` aria-pressed="${!!x.on}"` : ''}>${escH(x.g)}</button>`).join('');
  }
  function iconAct(id, ic) {
    if (ic === 'grow') { setState(id, 'W'); return; }
    if (id === 'inputs') { const d = R.pane.querySelectorAll(':scope > details.grp')[+ic.slice(1)]; setState('inputs', 'W'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); const s = d.querySelector('summary'); if (s) s.focus({ preventScroll: true }); } return; }
    if (id === 'drawing' && VIEW_ICONS[ic]) { flip(ic, !$(ic).checked); paintIcons(id); return; }
    if (id === 'view' && ic.startsWith('t:')) { const b = document.querySelector(`#trackTabs [data-t="${ic.slice(2)}"]`); if (b) b.click(); return; }
    if (id === 'sweep' && ic === 'run') { const b = $('runSweep'); if (b) b.click(); }
  }

  // ---------- the drawing toggles (UI-W5): toggle pieces that drive the app's own checkboxes ----------
  // Each checkbox keeps its id and its 'change' listeners (30-drawing.js, 80-view3d.js), hidden inside its old label;
  // the toggle piece in front of it is what people see and use. The Scale slider stays a plain input (TE-B-235).
  const TOGGLES = Object.keys(VIEW_ICONS).filter(k => $(k) && R.drawopts.contains($(k)));
  const togBox = el('div', 'te-drawtgl'); togBox.style.cssText = 'display:grid;gap:6px;margin-bottom:8px';
  togBox.setAttribute('role', 'group'); togBox.setAttribute('aria-label', 'Show on the drawing');
  togBox.innerHTML = TOGGLES.map(k => PC.toggleHTML({ label: VIEW_ICONS[k][1], checked: $(k).checked, id: 'tg-' + k })).join('');
  R.drawopts.parentNode.insertBefore(togBox, R.drawopts);   // a page node, so fill() and restore() move it with the others
  TOGGLES.forEach(k => { const lb = $(k).closest('label'); if (lb) lb.style.display = 'none'; });
  function flip(k, v) { const c = $(k); c.checked = v; c.dispatchEvent(new Event('change', { bubbles: true })); c.dispatchEvent(new Event('input', { bubbles: true })); paintToggles(); }
  TOGGLES.forEach(k => PC.mountToggle($('tg-' + k), { onChange: v => flip(k, v) }));
  togReady = true;
  // the app also sets some checkboxes itself (a loaded bridge, the 3D settings): the toggles follow
  function paintToggles() { TOGGLES.forEach(k => { const t = $('tg-' + k), v = !!$(k).checked; if (t.getAttribute('aria-checked') !== String(v)) { t.setAttribute('aria-checked', String(v)); t.classList.toggle('on', v); } }); }

  // ---------- filling the windows from the v61 page ----------
  let moved = [];
  function mv(node, into) { if (!node || !into || !node.parentNode) return; const ph = document.createComment('shell'); node.parentNode.insertBefore(ph, node); into.appendChild(node); moved.push([node, ph]); }
  function restore() { moved.reverse().forEach(([n, ph]) => { if (ph.parentNode) { ph.parentNode.insertBefore(n, ph); ph.remove(); } }); moved = []; }
  function contents(id) {
    const T = place() === 'truss';
    if (id === 'inputs') return [R.pane];
    if (id === 'view') return T ? [R.topSeg] : [...$('fsBar').children];
    if (id === 'drawing') return T ? [togBox, R.drawopts, R.legend, R.memBd] : [...$('fsFoot').children];
    if (id === 'sweep') return [R.sweepBd];
    if (id === 'results') return [R.stats, R.msgs];
    return [];
  }
  function fill() {
    Object.keys(WIN).forEach(id => {
      const body = wins[id].querySelector('.s-bd'), nodes = contents(id).filter(Boolean);
      nodes.forEach(n => mv(n, body));
      if (id === 'sweep') { const sum = wins.sweep.querySelector('.s-sum'); mv(R.sweepBtns, sum); mv(R.sweepCount, sum); }
      wins[id].dataset.empty = nodes.length ? '' : '1';
    });
    paintWins();
  }
  function paintWins() {
    const P = place();
    Object.keys(WIN).forEach(id => {
      const s = wins[id], st = S.shell.w[P][id], w = WIN[id];
      if (id === 'view' && P === 'truss') s.dataset.empty = R.topSeg.hidden ? '1' : '';
      const empty = s.dataset.empty === '1';
      s.dataset.state = st; s.hidden = empty || (id === 'drawing' && st === 'T' && !s.classList.contains('peek')); s.setAttribute('aria-label', w.title());
      s.querySelector('.wt').textContent = w.title();
      const right = w.home === 'right', [sh, gr] = [s.querySelector('[data-step="shrink"]'), s.querySelector('[data-step="grow"]')];
      sh.textContent = right ? '›' : '‹'; gr.textContent = right ? '‹' : '›';
      sh.setAttribute('aria-label', `${id === 'results' || st === 'I' ? 'Hide' : 'Shrink'} ${w.title()}${st === 'W' && id !== 'results' ? ' to icons' : ''}`); sh.title = sh.getAttribute('aria-label');
      gr.setAttribute('aria-label', `Grow ${w.title()} to words and icons`); gr.title = gr.getAttribute('aria-label');
      gr.hidden = st === 'W' || id === 'results';
      if (tabs[id]) { tabs[id].hidden = empty || st !== 'T'; tabs[id].textContent = (id === 'drawing' ? '◂ ' : '') + w.title(); tabs[id].setAttribute('aria-label', `Show ${w.title()}`); tabs[id].title = `Show ${w.title()} (hover to peek)`; }
      if (st === 'I') paintIcons(id);
    });
    card.setAttribute('aria-expanded', String(S.shell.w[P].results === 'W'));
    tagAll(); layout();
  }

  // ---------- fixed homes ----------
  const M = 10;
  let lastFree = '';
  function layout() {
    const P = place(), st = S.shell.w[P], vw = innerWidth, vh = innerHeight;
    const shown = id => wins[id].dataset.empty !== '1' && (st[id] !== 'T' || wins[id].classList.contains('peek'));
    const eff = id => (st[id] === 'T' ? 'W' : st[id]);   // a peek shows the whole window
    const navR = S.shell.bar === 'T' ? barTab.getBoundingClientRect() : nav.getBoundingClientRect();
    const barB = Math.max(navR.bottom, 44);
    // results card: in the top row, right of the bar, centred when there is room
    const cw = card.offsetWidth || 360, cl = Math.max(navR.right + 12, Math.min((vw - cw) / 2, vw - cw - 46));
    card.style.left = cl + 'px'; card.style.top = '10px';
    const cardB = card.getBoundingClientRect().bottom || 46;
    // drawing / chart key on the right edge
    const D = wins.drawing, dW = eff('drawing') === 'W' ? Math.min(WIN.drawing.w, vw - 2 * M) : 56;
    const top0 = Math.max(barB, cardB) + 8;
    // a peeking Drawing window is placed by the window piece, beside its tab (UI-W17); its home is put back when the peek ends
    if (!D.classList.contains('peek')) Object.assign(D.style, { right: M + 'px', left: 'auto', top: top0 + 'px', width: dW + 'px', maxHeight: (vh - top0 - M) + 'px', bottom: 'auto' });
    else Object.assign(D.style, { width: dW + 'px', maxHeight: (vh - top0 - M) + 'px' });
    const dShown = shown('drawing'), rightUsed = dShown ? dW + 2 * M : 0;
    // view options under the bar on the left
    const V = wins.view;
    Object.assign(V.style, { left: M + 'px', top: top0 + 'px', right: 'auto', width: eff('view') === 'W' ? 'auto' : 'auto', maxWidth: (vw - 2 * M - rightUsed) + 'px', bottom: 'auto' });
    const vB = shown('view') ? V.getBoundingClientRect().bottom + 8 : top0;
    // inputs on the left edge, under the view options
    const I = wins.inputs, iW = eff('inputs') === 'W' ? Math.min(WIN.inputs.w, vw - 2 * M) : 56;
    Object.assign(I.style, { left: M + 'px', top: vB + 'px', bottom: M + 'px', width: iW + 'px', right: 'auto', maxHeight: 'none' });
    const iShown = shown('inputs'), leftUsed = iShown ? iW + 2 * M : 0;
    // sweep at the bottom, beside the inputs
    const W = wins.sweep, sl = leftUsed || M, sW = eff('sweep') === 'W' ? Math.max(260, Math.min(WIN.sweep.w, vw - sl - M - rightUsed)) : 'auto';
    Object.assign(W.style, { left: sl + 'px', bottom: M + 'px', top: 'auto', width: typeof sW === 'number' ? sW + 'px' : sW, maxHeight: Math.round(vh * .55) + 'px', right: 'auto' });
    // the full results under the card
    const RS = wins.results;
    Object.assign(RS.style, { left: Math.max(M, Math.min(cl, vw - WIN.results.w - M)) + 'px', top: (cardB + 6) + 'px', width: Math.min(WIN.results.w, vw - 2 * M) + 'px', maxHeight: (vh - cardB - 16) + 'px', bottom: 'auto', right: 'auto' });
    // edge tabs
    if (tabs.inputs) { tabs.inputs.style.top = Math.max(vB, vh * .35) + 'px'; }
    if (tabs.drawing) { tabs.drawing.style.top = Math.max(top0, vh * .35) + 'px'; }
    if (tabs.view) { tabs.view.style.left = (S.shell.bar === 'T' ? navR.right + 8 : M + 24) + 'px'; tabs.view.style.top = barB + 'px'; }
    if (tabs.sweep) { tabs.sweep.style.left = (leftUsed || 40) + 'px'; }
    // the picture fills the whole stage (UI-A3): only the page size changes it, never the windows
    const sig = vw + 'x' + vh;
    if (sig !== lastFree) { lastFree = sig; redrawSoon(); }
  }
  let layT = 0, redT = 0;
  function layoutSoon() { cancelAnimationFrame(layT); layT = requestAnimationFrame(layout); }
  function redrawSoon() { clearTimeout(redT); redT = setTimeout(() => A.redraw(), 200); }
  window.addEventListener('resize', layoutSoon);
  if (window.ResizeObserver) { const ro = new ResizeObserver(layoutSoon); [wins.view, wins.sweep, card, nav].forEach(x => ro.observe(x)); }

  // ---------- places ----------
  H.setFs = key => { restore(); fsCore(key); if (key) fill(); };
  function go(p, fromBack) {
    if (!PLACES.includes(p)) return;
    const want = p === 'truss' ? '#sideSheet' : '#trackBody';
    if (p !== place()) { if (!fromBack) { S.shell.hist.push(place()); S.shell.hist = S.shell.hist.slice(-20); } S.shell.place = p; save(); }
    if (A.fsEl !== want) H.setFs(want);
    paintNav(); paintWins();
  }

  // ---------- ☰ drawer: Look and controls ----------
  const look = el('details', 'dsec'); look.id = 'lookSec';
  look.innerHTML = `<summary class="dlab">Look and controls</summary>
    <span class="dlab" style="margin-top:6px">Theme</span>
    <div class="themerow"><select id="themeSel" aria-label="Theme"></select></div>
    <span class="dnote" id="themeNote"></span>
    <label class="tsw"><input type="checkbox" id="swClassic"><span class="track"></span>Use the v61 page layout (reloads)</label>`;
  const kb = [...dockMenu.querySelectorAll('details.dsec')].find(d => /Keybinding|Mouse and keys/.test(d.querySelector('summary').textContent));
  if (kb) { kb.querySelector('summary').textContent = 'Mouse and keys'; look.appendChild(kb); kb.classList.add('sub'); }
  dockMenu.insertBefore(look, dockMenu.firstChild);
  // Only built-in themes for now: a theme people load or share will be data (tokens and images) checked by formats.js,
  // never raw CSS (White Hat, board TE-B-014; #197).
  function paintThemeSel() {
    $('themeSel').innerHTML = THEME_LIST.map(t => `<option value="${escH(t.id)}">${escH(t.name)}</option>`).join('');
    $('themeSel').value = stage.dataset.theme;
    $('themeNote').textContent = 'Themes change the look only. The meaning colours on the drawing (C red, T blue, zero grey, fails, passes) never change.';
  }
  function applyTheme(id) {
    let css = '';
    if (id !== 'wireframe' && id !== 'og') { const t = THEME_LIST.find(x => x.id === id); if (t) css = THEME_PACK.files[t.css] || ''; else id = 'wireframe'; }
    themeStyle.textContent = css; stage.dataset.theme = id; S.shell.theme = id; save();
    if ($('themeSel')) $('themeSel').value = id;
    tagAll(); lastFree = ''; layoutSoon();
  }
  $('themeSel').addEventListener('change', ev => applyTheme(ev.target.value));
  $('swClassic').addEventListener('change', ev => { if (ev.target.checked) { S.layout = 'classic'; save(); location.reload(); } });

  // ---------- the contract: data-slot / data-part, and the class names themes style ----------
  const PARTS = [['.nav', 'top-bar', 'ctl'], ['.nb', 'nav-button', 'ctl'], ['.vp', 'view-pill', 'ctl'], ['.swb', 'switch', 'ctl'], ['.s-b', 'button', 'ctl'], ['.s-ic', 'icon-button', 'ctl'],
    ['.tab', 'tab', 'ctl'], ['.seg', 'segmented', 'ctl'], ['.mrow', 'menu-row', 'ctl'], ['.tabE', 'edge-tab', 'ctl'], ['.stp', 'stepper', 'ctl'], ['g.dimlab', 'value-tag', 'ctl'],
    ['.s-pan:not(.res)', 'window', 'bg'], ['#dockMenu', 'sheet', 'bg'], ['.modalcard', 'sheet', 'bg'], ['.s-ph', 'window-title', 'bg'], ['.smut', 'label', 'bg'], ['.modal', 'scrim', 'bg'],
    ['.res', 'results', 'disp'], ['.toast', 'toast', 'disp'], ['.pill', 'badge', 'disp'], ['.badge', 'count-badge', 'disp'], ['table', 'table', 'disp'], ['#draw', 'drawing', 'disp'],
    ['#c3d', 'drawing', 'disp'], ['.progress', 'progress', 'disp']];
  const ON_Q = '.seg button, [role="tab"], [role="radio"], .s-b, .s-ic, .nb, .tab';
  function tagAll() {
    stage.querySelectorAll('.btn:not(.s-b)').forEach(b => { b.classList.add('s-b'); if (!b.classList.contains('ghost')) b.classList.add('dark'); });
    stage.querySelectorAll('[role="tab"]:not(.tab)').forEach(b => b.classList.add('tab'));
    stage.querySelectorAll('table:not(.tt)').forEach(t => t.classList.add('tt'));
    PARTS.forEach(([q, part, slot]) => stage.querySelectorAll(q).forEach(e => { if (!e.dataset.part) { e.dataset.part = part; e.dataset.slot = slot; } }));
    stage.querySelectorAll(ON_Q).forEach(e => { const on = ['aria-pressed', 'aria-checked', 'aria-selected'].some(a => e.getAttribute(a) === 'true'); if (e.hasAttribute('aria-pressed') || e.hasAttribute('aria-checked') || e.hasAttribute('aria-selected')) e.classList.toggle('on', on); });
  }
  let tagT = 0;
  new MutationObserver(ms => {
    for (const m of ms) if (m.type === 'attributes' || [...m.addedNodes].some(n => n.nodeType === 1 && !(n instanceof SVGElement && n.tagName !== 'svg'))) { cancelAnimationFrame(tagT); tagT = requestAnimationFrame(tagAll); return; }
  }).observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-checked', 'aria-selected'] });

  // ---------- the view options' icons follow their boxes; Esc no longer leaves the place ----------
  R.drawopts.addEventListener('change', () => { if (S.shell.w[place()].view === 'I') paintIcons('view'); });

  // ---------- start ----------
  applyTheme(S.shell.theme); paintThemeSel();
  go(place(), true);
  setTimeout(() => { paintCard(); paintNav(); lastFree = ''; layout(); }, 60);
  window.__shell = { go, setState, applyTheme, layout, get state() { return S.shell; } };
}
})();
