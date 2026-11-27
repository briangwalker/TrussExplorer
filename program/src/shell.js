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
  // The default theme (Brian 75a, TE-B-757): a new visitor opens in Notebook + Calculator, the balsaPixel look (photo wood; generated wood
  // and the Calculator screen stay choices in the list). A saved choice still wins; OG stays locked until earned (UI-T6). Every fall-back
  // (a saved 'file' pick with no file, a locked 'og', an unknown id) lands here too. Wireframe is the base built into shell.css, so it is
  // the default only if the pack somehow lacks the Notebook theme.
  const DEFAULT_THEME = THEME_LIST.some(t => t.id === 'notebook-calc') ? 'notebook-calc' : 'wireframe';
  // ---------- THE TABLE (TE-B-364): what this tool puts in the shell, as data ----------
  // Places, windows, their default states, the icons and the edge-tab arrows. A new window, icon or tab icon is a row
  // here, not a new literal further down (the code below only reads it). Later this is the tool's half of the
  // shell / tool seam (TE-B-358): a second tool would hand the shell its own table.
  const TABLE = {
    places: ['truss', 'analysis'],
    // id: where it lives, its title (a function, since Drawing is 'Chart key' in Analysis), its glyph, its width in W,
    // and movable (UI-W20): true only for a window you can drag; today none is, so none shows the ⋮⋮ grip. Flip it here when one moves.
    windows: {
      inputs: { home: 'left', title: () => 'Inputs', glyph: '✎', w: 400, movable: false },
      view: { home: 'top', title: () => 'View options', glyph: '◐', movable: false },
      drawing: { home: 'right', title: () => place() === 'truss' ? 'Drawing' : 'Chart key', glyph: '▤', w: 340, movable: false },
      sweep: { home: 'bottom', title: () => 'Sweep', glyph: '▶', w: 640, movable: false },
      results: { home: 'res', title: () => 'Results', glyph: 'Σ', w: 540, movable: false },
    },
    // each place's window states (W words, I icons, T edge tab); a phone (under 700 px) starts with the picture
    states: { truss: { inputs: 'W', view: 'W', drawing: 'I', sweep: 'W', results: 'T' }, analysis: { inputs: 'T', view: 'W', drawing: 'W', sweep: 'W', results: 'T' } },
    phoneStates: { truss: { inputs: 'T', view: 'I', drawing: 'T', sweep: 'I', results: 'T' }, analysis: { inputs: 'T', view: 'I', drawing: 'T', sweep: 'I', results: 'T' } },
    // windows built from the window piece (#356), with the arrow their edge tab shows (UI-W4 ▸ INPUTS, UI-W5 ◂ DRAWING)
    pieceArrows: { drawing: '◂ ', inputs: '▸ ' },
    // the Drawing window's toggles: checkbox id -> [icon, label] (UI-W5)
    viewIcons: { showDims: ['✎', 'Input labels'], resOnDraw: ['Σ', 'Results on the drawing'], showForces: ['F', 'Member forces'], d3ShowPlan: ['⊞', 'Plan view (3D)'], d3ShowSec: ['⊡', 'End view (3D)'],
      showGhosts: ['◌', 'Sweep ranges'], showIds: ['#', 'Node numbers'], showElems: ['№', 'Member numbers'], showDef: ['∿', 'Deformed shape'] },
    // Analysis tabs (#trackTabs data-t) -> icon in View options' I state
    tabIcons: { trade: '⋰', hist: '☰', curve: '⌒', mem: '▤' },
    sweepIcons: [{ ic: 'run', g: '▶', label: 'Run the sweep' }, { ic: 'grow', g: '⋯', label: 'Show the sweep' }],
  };
  const PLACES = TABLE.places, STATES = ['W', 'I', 'T'];
  const DEF = { place: PLACES[0], bar: 'W', hist: [], theme: DEFAULT_THEME, w: TABLE.states };
  const sh0 = S.shell && typeof S.shell === 'object' ? S.shell : {};
  if (!sh0.w && innerWidth < 700) { DEF.w = TABLE.phoneStates; DEF.bar = 'I'; }   // a phone starts with the picture
  // UI-W15 (#470): on a stage under 1100 px the side windows' default home is icons, so Inputs starts as icons there too
  // (Drawing already does). Only the defaults change: a saved layout (the person's own) wins, and a resize never moves a window.
  else if (!sh0.w && innerWidth < 1100) { DEF.w = JSON.parse(JSON.stringify(TABLE.states)); DEF.w.truss.inputs = 'I'; }
  S.shell = { place: PLACES.includes(sh0.place) ? sh0.place : DEF.place, bar: STATES.includes(sh0.bar) ? sh0.bar : DEF.bar,
    hist: Array.isArray(sh0.hist) ? sh0.hist.filter(p => PLACES.includes(p)).slice(-20) : [], theme: typeof sh0.theme === 'string' ? sh0.theme : DEF.theme, w: {},
    unlocks: window.TrussUnlocks ? window.TrussUnlocks.fresh() : null };
  // ---------- OG unlock (UI-T6, #162, #221): TrussUnlocks (src/unlocks.js) keeps the rule; the shell keeps the state in S.shell.unlocks ----------
  const UNL = window.TrussUnlocks || null;
  if (UNL) S.shell.unlocks = UNL.note(sh0.unlocks, 'none', 0);   // a clean copy of the saved state, or fresh() if it's damaged
  // This visit's use time stays in memory (useMs) and folds into S.shell.unlocks only in whole 5-minute blocks, at the unlock,
  // after a sweep and on pagehide: a quiet page then writes nothing to storage by itself (the gallery's UI-G4 guard).
  let useMs = 0, lastTick = null;
  const unlockState = () => { const u = UNL.note(S.shell.unlocks, 'none', 0); u.usedMs += useMs; return u; };
  const ogUnlocked = () => !UNL || UNL.unlocked(unlockState()).og;
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
    sweepBd: $('s-sweep').querySelector('.bd'), sweepBtns: $('sweepBtns'), sweepCount: $('sweepCount'),
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
  // the top bar's tab state (UI-W1 '☰ + › Truss · 2D'): one edge tab on the stage's top edge (ART-K8, UI-W15 28 px) with ☰ first,
  // so ☰ is always visible (UI-A5). ☰ moves into the tab only in that state; in the W and I states it stays first in #shellNav.
  const barTabBox = el('div', 'tabE t'); barTabBox.id = 'navTabBox'; barTabBox.setAttribute('role', 'group'); barTabBox.setAttribute('aria-label', 'Top bar (folded)');
  const barTab = el('button', 'tablab'); barTab.type = 'button'; barTab.id = 'navTab'; barTabBox.appendChild(barTab);
  const card = el('button', 'res s-pan'); card.type = 'button'; card.id = 'resCard'; card.setAttribute('aria-expanded', 'false'); card.title = 'Results: click for the full list';
  const dockMenu = $('dockMenu'); dockMenu.classList.add('drawer', 'sheet');
  document.querySelectorAll('.modalcard').forEach(c => c.classList.add('sheet'));
  stage.append(nav, barTabBox, card, dockMenu);

  const place = () => S.shell.place;
  const sw = (which, d) => `<span class="swb">${SWP[which + (d === '3d' || d === 'c3' ? '3' : '2')]}<button type="button" style="left:0" data-sw="${which}:2" aria-label="${which === 't' ? 'Truss' : 'Analysis'} in 2D" aria-pressed="${!(d === '3d' || d === 'c3')}" title="${which === 't' ? 'Truss' : 'Analysis'} in 2D"></button><button type="button" style="right:0" data-sw="${which}:3" aria-label="${which === 't' ? 'Truss' : 'Analysis'} in 3D" aria-pressed="${d === '3d' || d === 'c3'}" title="${which === 't' ? 'Truss' : 'Analysis'} in 3D"></button></span>`;
  function passCount() { try { let n = 0; for (const r of A.rows) if (r.passes) n++; return n; } catch (e) { return 0; } }
  function paintNav() {
    const P = place(), st = S.shell.bar, words = st === 'W', tOn = P === 'truss';
    nav.hidden = st === 'T'; barTabBox.hidden = st !== 'T';
    if (st === 'T') { if (menuBtn.parentNode !== barTabBox) barTabBox.prepend(menuBtn); }
    else if (menuBtn.parentNode !== nav) nav.prepend(menuBtn);
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
    const nr = A.noResult;   // UI-I10: a value or the shape breaks the limits table: No result with the note's first line, no kg, no PASS
    // pill first, the summary cut to the normal card's width with an ellipsis (UI-I10, UI-W2, UI-W19: the card never grows past the
    // stage); the full line is the card's accessible name and is in the ▾ Results window (#522, UI Designer and QA MUST, TE-B-625/628)
    if (nr) { card.innerHTML = `<span class="pill"><span aria-hidden="true">⟂</span> No result</span><span class="nrsum">${A.escH(nr.summary)}</span>${tag} <span aria-hidden="true">▾</span>`; card.setAttribute('aria-label', 'No result. ' + nr.summary); tagAll(); layoutSoon(); return; }
    card.removeAttribute('aria-label');
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
  const WIN = TABLE.windows, VIEW_ICONS = TABLE.viewIcons;   // the table above
  const wins = {}, tabs = {};
  // windows built from the window piece (#356): the piece runs their three states, edge tab and peek (mountWindow below);
  // the shell keeps each place's states (UI-A9) and their homes. The value is the arrow their tab shows (UI-W4 ▸ INPUTS, UI-W5 ◂ DRAWING).
  const PIECE = TABLE.pieceArrows;
  Object.entries(WIN).forEach(([id, w]) => {
    if (PIECE[id] != null) {
      const st = S.shell.w[place()][id];
      stage.insertAdjacentHTML('beforeend', PC.windowHTML({ id, title: w.title(), home: w.home, state: st, movable: w.movable === true }) + PC.edgeTabHTML({ id, title: w.title(), home: w.home, state: st }));
      wins[id] = $('win-' + id); tabs[id] = stage.querySelector(`.tabE[data-tab="${id}"]`); return;
    }
    const s = el('section', 's-pan'); s.dataset.win = id; s.dataset.home = w.home; s.setAttribute('aria-label', w.title()); s.id = 'win-' + id; if (w.movable === true) s.dataset.movable = '';
    s.innerHTML = `<div class="s-ph">${w.movable === true ? '<span class="grip" aria-hidden="true">⋮⋮</span>' : ''}<span class="wt"></span><span class="stp"><button type="button" class="s-ic sm" data-step="shrink"></button><button type="button" class="s-ic sm" data-step="grow"></button></span></div>`
      + (id === 'sweep' ? '<div class="s-sum"></div>' : '') + '<div class="s-bd"></div><div class="s-icons" role="toolbar"></div>';
    stage.appendChild(s); wins[id] = s;
    if (w.home !== 'res') { const t = el('button', 'tabE ' + ({ left: 'l', right: 'r', bottom: 'b', top: 't' })[w.home]); t.type = 'button'; t.dataset.tab = id; stage.appendChild(t); tabs[id] = t; }
  });
  const order = ['T', 'I', 'W'];
  // the Drawing window's states, tab and peek come from the piece; the shell keeps each place's state (UI-A9) and the layout
  // UI-W15: a window is up to its width, then its content scrolls inside it. The Drawing window's body is a one-column grid, so
  // cap that column at the window's width (minmax(0, 1fr)); the wide member table then scrolls sideways in its own box.
  wins.drawing.querySelector('.s-bd').style.gridTemplateColumns = 'minmax(0, 1fr)';
  const pieceWin = {};
  Object.keys(PIECE).forEach(id => { pieceWin[id] = PC.mountWindow(wins[id], tabs[id], { onState: st => { S.shell.w[place()][id] = st; save(); paintWins(); } }); });
  function setState(id, v) { if (pieceWin[id]) { pieceWin[id].setState(v); return; } if (id === 'sweep' && v !== 'W') sweepAsked = sweepForce = false; S.shell.w[place()][id] = v; save(); wins[id].classList.remove('peek'); paintWins(); }
  function step(id, dir) {
    const cur = S.shell.w[place()][id];
    if (id === 'results') { setState(id, dir > 0 ? 'W' : 'T'); return; }
    if (id === 'sweep' && dir > 0) sweepAsked = true;   // the person asked for the words state (see the fit rule in layout)
    setState(id, order[Math.max(0, Math.min(2, order.indexOf(cur) + dir))]);
  }
  stage.addEventListener('click', ev => {
    const b = ev.target.closest('[data-step]'); if (b) { const id = b.closest('.s-pan').dataset.win; if (!pieceWin[id]) step(id, b.dataset.step === 'grow' ? 1 : -1); return; }
    const t = ev.target.closest('.tabE[data-tab]'); if (t && pieceWin[t.dataset.tab]) return;
    if (t) { setState(t.dataset.tab, 'W'); const f = wins[t.dataset.tab].querySelector('.s-bd button, .s-bd input, .s-bd select, .s-bd summary'); if (f) f.focus({ preventScroll: true }); return; }
    const i = ev.target.closest('.s-icons [data-ic]'); if (i) iconAct(i.closest('.s-pan').dataset.win, i.dataset.ic);
  });
  // hover a tab to peek at the window; it goes away when the pointer leaves both
  let peekT = null;
  const unpeek = id => { clearTimeout(peekT); peekT = setTimeout(() => { if (!wins[id].matches(':hover') && !(tabs[id] && tabs[id].matches(':hover'))) { wins[id].classList.remove('peek'); layout(); } }, 280); };
  Object.entries(tabs).forEach(([id, t]) => {
    if (PIECE[id] != null) return;   // the window piece peeks for itself (UI-W9, UI-W17)
    t.addEventListener('mouseenter', () => { clearTimeout(peekT); peekT = setTimeout(() => { if (S.shell.w[place()][id] === 'T') { wins[id].classList.add('peek'); layout(); } }, 220); });
    t.addEventListener('mouseleave', () => unpeek(id));
    wins[id].addEventListener('mouseleave', () => { if (wins[id].classList.contains('peek')) unpeek(id); });
    wins[id].addEventListener('mouseenter', () => { if (wins[id].classList.contains('peek')) clearTimeout(peekT); });
  });

  // icons for the I state
  function icons(id) {
    if (id === 'inputs') return [...R.pane.querySelectorAll(':scope > details.grp')].map((d, k) => { const h = d.querySelector('summary h3'); const t = h ? h.textContent.trim() : 'Section ' + (k + 1); const m = t.match(/^(\d+)/); return { ic: 'g' + k, g: m ? m[1] : t[0], label: t }; });
    if (id === 'drawing' && place() === 'truss') return Object.entries(VIEW_ICONS).filter(([k]) => TOGGLES.includes(k) && togShown(k)).map(([k, [g, label]]) => ({ ic: k, g, label, on: $(k).checked }));
    if (id === 'view' && place() === 'analysis') return [...document.querySelectorAll('#trackTabs [role="tab"]')].map(b => ({ ic: 't:' + b.dataset.t, g: TABLE.tabIcons[b.dataset.t] || '•', label: b.textContent.trim(), on: b.getAttribute('aria-selected') === 'true' }));
    if (id === 'sweep') return TABLE.sweepIcons.map(x => ({ ...x }));
    return [{ ic: 'grow', g: WIN[id].glyph, label: 'Show ' + WIN[id].title() }];
  }
  function paintIcons(id) {
    const box = wins[id].querySelector('.s-icons'), list = icons(id);
    box.setAttribute('aria-label', WIN[id].title() + ' (icons)');
    box.innerHTML = list.map(x => `<button type="button" class="s-ic${x.on ? ' on' : ''}" data-ic="${escH(x.ic)}" title="${escH(x.label)}" aria-label="${escH(x.label)}"${x.on != null ? ` aria-pressed="${!!x.on}"` : ''}>${escH(x.g)}</button>`).join('');
  }
  // ⋯ on a bar fitted to icons never does nothing (QA MUST on #538, TE-B-715): the bar takes the room beside the windows; if its words
  // still don't fit there, Inputs goes one state smaller, words to icons (UI-W16); if there is still no room, the bar opens in words
  // anyway, as base 3d4c9f0 did. Then Sweep settings is on screen, inside the bar, and focused.
  function growSweep() {
    sweepAsked = true; layout();
    const st = S.shell.w[place()], I = wins.inputs;
    if (wins.sweep.dataset.fit === 'I' && st.inputs === 'W' && I.dataset.empty !== '1' && !I.classList.contains('peek')) setState('inputs', 'I');
    layout();
    if (wins.sweep.dataset.fit === 'I') { sweepForce = true; layout(); }
    const f = $('sweepMore'); if (f) f.focus({ preventScroll: true });
  }
  function iconAct(id, ic) {
    // the bar fell to icons only because its words didn't fit (UI-W16): ⋯ is the person asking for them, so the bar may use the room it has
    if (id === 'sweep' && ic === 'grow' && wins.sweep.dataset.fit === 'I') { growSweep(); return; }
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
  const ONLY3D = ['d3ShowPlan', 'd3ShowSec'];   // Plan view and End view change only the 3D drawing: hidden in 2D, so no toggle does nothing (UI-A8)
  const togShown = k => !ONLY3D.includes(k) || S.anaMode === '3d';
  const togBox = el('div', 'te-drawtgl'); togBox.style.cssText = 'display:grid;gap:6px;margin-bottom:8px';
  togBox.setAttribute('role', 'group'); togBox.setAttribute('aria-label', 'Show on the drawing');
  togBox.innerHTML = TOGGLES.map(k => PC.toggleHTML({ label: VIEW_ICONS[k][1], checked: $(k).checked, id: 'tg-' + k })).join('');
  R.drawopts.parentNode.insertBefore(togBox, R.drawopts);   // a page node, so fill() and restore() move it with the others
  TOGGLES.forEach(k => { const lb = $(k).closest('label'); if (lb) lb.style.display = 'none'; });
  function flip(k, v) { const c = $(k); c.checked = v; c.dispatchEvent(new Event('change', { bubbles: true })); c.dispatchEvent(new Event('input', { bubbles: true })); paintToggles(); }
  TOGGLES.forEach(k => PC.mountToggle($('tg-' + k), { onChange: v => flip(k, v) }));
  togReady = true; paintToggles();
  // the app also sets some checkboxes itself (a loaded bridge, the 3D settings): the toggles follow
  function paintToggles() { TOGGLES.forEach(k => { const row = $('tg-' + k).closest('.te-togrow'); if (row) row.hidden = !togShown(k); }); TOGGLES.forEach(k => { const t = $('tg-' + k), v = !!$(k).checked; if (t.getAttribute('aria-checked') !== String(v)) { t.setAttribute('aria-checked', String(v)); t.classList.toggle('on', v); } }); }

  // ---------- filling the windows from the v61 page ----------
  let moved = [];
  function mv(node, into) { if (!node || !into || !node.parentNode) return; const ph = document.createComment('shell'); node.parentNode.insertBefore(ph, node); into.appendChild(node); moved.push([node, ph]); }
  function restore() { moved.reverse().forEach(([n, ph]) => { if (ph.parentNode) { ph.parentNode.insertBefore(n, ph); ph.remove(); } }); moved = []; }
  function contents(id) {
    const T = place() === 'truss';
    if (id === 'inputs') return [R.pane];
    if (id === 'view') return T ? [R.topSeg] : [...$('fsBar').children];
    if (id === 'drawing') return T ? [togBox, R.drawopts, R.legend] : [...$('fsFoot').children];
    if (id === 'sweep') return [R.sweepBd];
    if (id === 'results') return [R.stats, R.msgs];
    return [];
  }
  // ---------- the sweep bar (UI-A2, UI-W15, UI-S5, UI-S9) ----------
  // One row, bottom-left, always on screen: Run sweep, the count line, the progress bar, Cancel while a search runs, and the Resume offer (the app
  // writes it into #bigMsg, so moving that element brings it). Every element keeps its id and its listeners: they are moved, never re-wired.
  // The rest of the sweep (the other buttons, the ranges, the tables) sits under 'Sweep settings' in the same window. The orange stripe follows
  // the app's own out-of-date banner (.staleMsg), so nothing here reads the sweep's variables.
  function fillSweepBar() {
    const W = wins.sweep, sum = W.querySelector('.s-sum'), body = W.querySelector('.s-bd');
    sum.classList.add('te-sweepbar');
    const prog = $('sweepBar') && $('sweepBar').parentNode;
    [$('runSweep'), R.sweepCount, prog, $('bigMsg'), $('bigCancel')].forEach(n => mv(n, sum));
    if (prog) prog.classList.add('te-sweepprog');
    // UI-W15: the main action keeps one line; the count line is the part that ellipsises
    if ($('runSweep')) Object.assign($('runSweep').style, { whiteSpace: 'nowrap', flex: '0 0 auto' });
    let tg = $('sweepMore'); if (!tg) { tg = el('button', 'btn ghost sm'); tg.type = 'button'; tg.id = 'sweepMore'; tg.setAttribute('aria-expanded', 'false'); tg.textContent = 'Sweep settings ▾'; tg.addEventListener('click', () => { const o = W.dataset.more !== '1'; W.dataset.more = o ? '1' : ''; tg.setAttribute('aria-expanded', String(o)); tg.textContent = o ? 'Sweep settings ▴' : 'Sweep settings ▾'; layout(); }); }
    sum.appendChild(tg);   // last, also after a later fill() (a place switch)
    // the buttons that stay in the old summary row go to the top of the body, so the bar itself stays one row
    let more = body.querySelector(':scope > .te-sweepmore'); if (!more) { more = el('div', 'te-sweepmore'); body.insertBefore(more, body.firstChild); }
    mv(R.sweepBtns, more);
    const st = document.querySelector('.staleMsg');
    if (st && !W._stale) { const paint = () => W.classList.toggle('stale', !st.hidden); W._stale = new MutationObserver(paint); W._stale.observe(st, { attributes: true, attributeFilter: ['hidden'] }); paint(); }
  }
  function fill() {
    Object.keys(WIN).forEach(id => {
      const body = wins[id].querySelector('.s-bd'), nodes = contents(id).filter(Boolean);
      nodes.forEach(n => mv(n, body));
      if (id === 'sweep') fillSweepBar();
      wins[id].dataset.empty = nodes.length ? '' : '1';
    });
    paintWins();
  }
  function paintWins() {
    const P = place(); if (togReady) paintToggles();   // the 3D-only toggles follow the 2D/3D switch (UI-A8)
    Object.keys(WIN).forEach(id => {
      const s = wins[id], st = S.shell.w[P][id], w = WIN[id];
      if (id === 'view' && P === 'truss') s.dataset.empty = R.topSeg.hidden ? '1' : '';
      const empty = s.dataset.empty === '1';
      s.dataset.state = st; s.hidden = empty || (PIECE[id] != null && st === 'T' && !s.classList.contains('peek')); s.setAttribute('aria-label', w.title());
      s.querySelector('.wt').textContent = w.title();
      const right = w.home === 'right', [sh, gr] = [s.querySelector('[data-step="shrink"]'), s.querySelector('[data-step="grow"]')];
      sh.textContent = right ? '›' : '‹'; gr.textContent = right ? '‹' : '›';
      sh.setAttribute('aria-label', `${id === 'results' || st === 'I' ? 'Hide' : 'Shrink'} ${w.title()}${st === 'W' && id !== 'results' ? ' to icons' : ''}`); sh.title = sh.getAttribute('aria-label');
      gr.setAttribute('aria-label', `Grow ${w.title()} to words and icons`); gr.title = gr.getAttribute('aria-label');
      gr.hidden = st === 'W' || id === 'results';
      if (tabs[id]) { tabs[id].hidden = empty || st !== 'T'; tabs[id].textContent = (PIECE[id] || '') + w.title(); tabs[id].setAttribute('aria-label', `Show ${w.title()}`); tabs[id].title = `Show ${w.title()} (hover to peek)`; }
      if (st === 'I') paintIcons(id);
    });
    card.setAttribute('aria-expanded', String(S.shell.w[P].results === 'W'));
    tagAll(); layout();
  }

  // ---------- fixed homes ----------
  const M = 10;
  let lastFree = '', sweepAsked = false;   // sweepAsked: the person grew the bar themselves (in memory only, like a peek)
  let sweepForce = false;   // ⋯ found no room even with Inputs as icons: keep the words, as base did, until there is room again (growSweep)
  // UI-W15 with UI-W16: the narrowest the bar's words state can be with every part whole: Run sweep, the progress bar at its 60 px minimum,
  // Cancel or the Resume offer when they show, and 'Sweep settings ▾'. The count line and #bigMsg ellipsise, so they count as 0.
  // Each part counts its own border box (a Notebook button has a 2 px border that scrollWidth leaves out), and the bar adds the
  // window's own frame, read from the theme: every border and padding between #win-sweep's edge and .s-sum (Notebook's bezel is 7 px
  // a side, Wireframe's border 1 px; FVL MUST on #538).
  function sweepNeed() {
    const W = wins.sweep, sum = W.querySelector('.s-sum'), px = v => parseFloat(v) || 0;
    const side = c => px(c.borderLeftWidth) + px(c.borderRightWidth) + px(c.paddingLeft) + px(c.paddingRight);
    const k = [...sum.children].filter(e => !e.hidden && getComputedStyle(e).display !== 'none');
    const cs = getComputedStyle(sum), gap = px(cs.columnGap);
    const own = e => { const c = getComputedStyle(e); return Math.max(e.getBoundingClientRect().width, e.scrollWidth + px(c.borderLeftWidth) + px(c.borderRightWidth)) + px(c.marginLeft) + px(c.marginRight); };
    const w = k.reduce((a, e) => a + (e.classList.contains('te-sweepprog') ? (px(getComputedStyle(e).minWidth) || 60) : e.classList.contains('note') ? 0 : own(e)), 0);
    let frame = 0; for (let e = sum; e && e !== W.parentElement; e = e.parentElement) frame += side(getComputedStyle(e));
    return Math.ceil(w + gap * Math.max(0, k.length - 1) + frame + 1);   // +1: sub-pixel rounding
  }
  function layout() {
    const P = place(), st = S.shell.w[P], vw = innerWidth, vh = innerHeight;
    const shown = id => wins[id].dataset.empty !== '1' && (st[id] !== 'T' || wins[id].classList.contains('peek'));
    const eff = id => (st[id] === 'T' ? 'W' : st[id]);   // a peek shows the whole window
    const navR = S.shell.bar === 'T' ? barTabBox.getBoundingClientRect() : nav.getBoundingClientRect();
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
    // UI-W15: up to 400 px and never over 40 % of the stage; the icons state is one 52 px column. A peek is placed by the piece (UI-W17).
    const I = wins.inputs, iW = eff('inputs') === 'W' ? Math.floor(Math.min(WIN.inputs.w, vw - 2 * M, vw * 0.4)) : 52;
    if (!I.classList.contains('peek')) Object.assign(I.style, { left: M + 'px', top: vB + 'px', bottom: M + 'px', width: iW + 'px', right: 'auto', maxHeight: 'none' });
    else Object.assign(I.style, { width: iW + 'px' });
    const iShown = shown('inputs'), leftUsed = iShown ? iW + 2 * M : 0;
    // sweep at the bottom, beside the inputs
    // UI-W15 (#534): the bar is up to 640 px AND never wider than 40 % of the stage; its count line ellipsises. Its floor is what the
    // words state needs (sweepNeed, measured with the theme's own frame), never past the stage's right edge (#532).
    const W = wins.sweep, sl = leftUsed || M, sCap = Math.floor(Math.min(WIN.sweep.w, vw * 0.4, vw - sl - M - Math.max(rightUsed, vw >= 1100 ? 370 : 0)));
    // When the cap leaves less than the words state needs, the bar opens one state smaller (UI-W16): icons, as on a phone. Only what is
    // shown changes: the person's saved state stays 'W', so a wider stage gives the words back. If the person asks for the words (⋯ or ›),
    // the bar may use the room beside the windows past the 40 % cap. Measured in the words state, in this same frame.
    let fit = '', need = 0;
    if (st.sweep === 'W' && !W.classList.contains('peek')) {
      W.dataset.state = 'W'; need = sweepNeed();
      const room = sweepAsked ? Math.floor(vw - sl - M - rightUsed) : sCap;
      if (sweepForce && room >= need) sweepForce = false;
      if (room < need && !sweepForce) fit = 'I';
    }
    const fitWas = W.dataset.fit || '', foc = fit !== fitWas && W.contains(document.activeElement) ? document.activeElement : null;
    W.dataset.fit = fit; if (fit) W.dataset.state = 'I';
    if (fit && !fitWas) paintIcons('sweep');
    // the bar is already icons, so '‹ Shrink Sweep to icons' would do nothing you can see: hide it while the fit holds (UI-W15 1.5.13, QA note 2)
    { const sh = W.querySelector('.s-ph [data-step="shrink"]'); if (sh) sh.hidden = fit === 'I'; }
    // focus follows a resize switch between words and icons (UI-W15 1.5.13, QA note 1): Run sweep ↔ ▶, Sweep settings ↔ ⋯, and
    // anything else goes to the bar's first control, so it never drops to <body>
    if (foc && !(foc.offsetWidth > 0 && foc.getClientRects().length)) {
      const id = foc.id || '', ic = foc.dataset.ic || '';
      const pick = fit ? (id === 'runSweep' ? '[data-ic="run"]' : id === 'sweepMore' ? '[data-ic="grow"]' : '') : (ic === 'run' ? '#runSweep' : ic === 'grow' ? '#sweepMore' : '');
      const vis = e => !!e && e.offsetWidth > 0 && !e.closest('[hidden]');
      let t = pick ? W.querySelector(pick) : null;
      if (!vis(t)) t = [...W.querySelectorAll('button, summary, input, select')].find(vis);
      if (t) t.focus({ preventScroll: true });
    }
    const sW = fit || eff('sweep') !== 'W' ? 'auto' : need ? (sweepForce ? Math.max(sCap, Math.min(need, vw - sl - M)) : sweepAsked ? Math.max(sCap, need) : sCap) : Math.max(sCap, Math.min(260, vw - sl - M));
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
    <div class="themerow"><select id="themeSel" aria-label="Theme"></select><span class="pill ogbadge" id="themeBadge" data-part="badge" data-slot="disp" title="The v61 look, kept as it was" hidden>OG</span></div>
    <span class="dnote" id="themeNote"></span>
    <label class="tsw"><input type="checkbox" id="swClassic"><span class="track"></span>Use the v61 page layout (reloads)</label>`;
  const kb = [...dockMenu.querySelectorAll('details.dsec')].find(d => /Keybinding|Mouse and keys/.test(d.querySelector('summary').textContent));
  if (kb) { kb.querySelector('summary').textContent = 'Mouse and keys'; look.appendChild(kb); kb.classList.add('sub'); }
  dockMenu.insertBefore(look, dockMenu.firstChild);
  // Built-in themes are reviewed CSS. A theme from a FILE is data only (tokens checked by formats.js, RMA-5/RMA-7; the pairs
  // by TrussThemeFile), never raw CSS (White Hat, TE-B-014; #197, #265). One file theme at a time, kept in memory only: it is
  // not saved, so a reload comes back on the built-in theme (nothing from a file ever reaches storage, WH-S1).
  let fileTheme = null;   // { id: 'file', name, vars: { '--te-ink': '#...' } }
  const FILE_ID = 'file';
  // OG is listed only once it's unlocked (UI-T6); the OG badge sits by the picker while OG is the look
  const themeList = () => THEME_LIST.filter(t => t.id !== 'og' || ogUnlocked());
  function paintThemeSel() {
    $('themeSel').innerHTML = themeList().map(t => `<option value="${escH(t.id)}">${escH(t.name)}</option>`).join('')
      + (fileTheme ? `<option value="${FILE_ID}">${escH(fileTheme.name)} (from a file)</option>` : '');
    $('themeSel').value = stage.dataset.theme;
    $('themeBadge').hidden = stage.dataset.theme !== 'og';
    $('themeNote').textContent = 'Themes change the look only. The meaning colours on the drawing (C red, T blue, zero grey, fails, passes) never change.'
      + (ogUnlocked() ? '' : ' The OG (v61) look unlocks after your first finished sweep, or after 20 minutes.');
  }
  // ONE theme path (Architecture Lead, TE-B-251). opts.save === false is a preview: it changes the look exactly as a pick
  // does, but leaves S.shell.theme, the saved state and #themeSel alone (the gallery, UI-G3 and UI-G4). layout() never saves.
  function applyTheme(id, opts) {
    const keep = !(opts && opts.save === false);
    let css = '';
    if (id === FILE_ID && !fileTheme) id = DEFAULT_THEME;   // a saved 'file' pick with no file loaded (a reload) falls back
    if (id === 'og' && keep && !ogUnlocked()) id = DEFAULT_THEME;   // UI-T6: OG only once it's unlocked (a saved 'og' falls back; a gallery preview may still show it, UI-G3)
    if (id !== 'wireframe' && id !== 'og' && id !== FILE_ID) { const t = THEME_LIST.find(x => x.id === id); if (t) css = THEME_PACK.files[t.css] || ''; else { id = DEFAULT_THEME; const d = THEME_LIST.find(x => x.id === id); css = d && d.css ? THEME_PACK.files[d.css] || '' : ''; } }
    themeStyle.textContent = css; stage.dataset.theme = id;
    // a file theme sits on the Wireframe base: its tokens go on as inline variables (values only, set one by one, never a style string)
    for (const k of Array.from(stage.style)) if (k.startsWith('--te-')) stage.style.removeProperty(k);
    if (id === FILE_ID) for (const k of Object.keys(fileTheme.vars)) stage.style.setProperty(k, fileTheme.vars[k]);
    if (keep) { S.shell.theme = id; save(); if ($('themeSel')) { $('themeSel').value = id; $('themeBadge').hidden = id !== 'og'; } }
    tagAll(); lastFree = ''; layoutSoon();
  }
  // the shell's theme door for the gallery (CODE-F4): the built-in list, read-only, and a preview that saves nothing
  const themes = () => Object.freeze(THEME_LIST.map(t => Object.freeze({ id: t.id, name: t.name })).concat(fileTheme ? [Object.freeze({ id: FILE_ID, name: fileTheme.name + ' (from a file)', file: true })] : []));
  const previewTheme = id => applyTheme(id, { save: false });
  // the file door (#265): doc is a theme TrussFormats.open() accepted. Returns { ok, errors } ; ok applies it and picks it.
  // The pair check uses the built-in values the file doesn't set, read from the page with the file's own variables cleared.
  function loadThemeFile(doc) {
    const tokens = doc && doc.tokens && typeof doc.tokens === 'object' ? doc.tokens : {};
    // a file that sets no token would only rename Wireframe; the door refuses it itself, not only the Open button (Black Hat SEC-007 NOTE 3)
    if (!Object.keys(tokens).length) return { ok: false, errors: ['empty'], pairs: [] };
    const was = stage.dataset.theme;
    for (const k of Array.from(stage.style)) if (k.startsWith('--te-')) stage.style.removeProperty(k);
    stage.dataset.theme = FILE_ID;
    const cs = getComputedStyle(stage), defaults = {}, meaning = {};
    for (const k of Object.keys(TrussThemeFile.PAIRS.reduce((m, [a, b]) => (m[a] = m[b] = 1, m), {}))) defaults[k] = cs.getPropertyValue('--te-' + k).trim();
    // the meaning colours as the stage shows them: every theme but OG keeps ui.html's light set, and a file theme is never OG (ART-K14)
    for (const m of Object.keys(TrussThemeFile.MEANING)) meaning[m] = cs.getPropertyValue('--' + m).trim();
    stage.dataset.theme = was; if (was === FILE_ID && fileTheme) for (const k of Object.keys(fileTheme.vars)) stage.style.setProperty(k, fileTheme.vars[k]);
    const name = typeof doc.name === 'string' && doc.name.trim() ? doc.name.trim().slice(0, 40) : String(doc.id || 'Theme');
    const r = TrussThemeFile.check(tokens, defaults, { name, builtIn: THEME_LIST.map(t => t.name).concat(['Wireframe', 'OG']) }, meaning);
    if (!r.ok) return r;
    fileTheme = { id: FILE_ID, name, vars: TrussThemeFile.vars(tokens) };
    paintThemeSel(); applyTheme(FILE_ID);
    return r;
  }
  $('themeSel').addEventListener('change', ev => applyTheme(ev.target.value));
  // ---------- toasts (UI-W10): one TrussSheets toast box for the shell and the app (step 2b's Undo toasts read it too) ----------
  const SH = window.TrussSheets || null; if (SH) SH.install(document);
  const toasts = SH ? SH.toasts(document) : { show() { return { close() {} }; }, hide() {} };
  // the app tells the shell about use ('tick') and finished sweeps ('sweep-finished'); the first unlock says so once
  // A tick changes S.shell.unlocks in memory only: it rides along with the next save() (every input change saves) and with
  // pagehide, so a quiet page writes nothing to storage on its own (the gallery's UI-G4 guard). A sweep or the unlock saves at once.
  const FOLD_MS = 300000;
  function foldUse(all) {   // move this visit's use time into the saved state: whole 5-minute blocks, or all of it
    const add = all ? useMs : Math.floor(useMs / FOLD_MS) * FOLD_MS; if (add <= 0) return false;
    const u = UNL.note(S.shell.unlocks, 'none', 0); u.usedMs += add; u.lastTickMs = null; S.shell.unlocks = u; useMs -= add; save(); return true;
  }
  function noteUnlock(ev) {
    if (!UNL) return false;
    if (!S.shell.unlocks || typeof S.shell.unlocks !== 'object') S.shell.unlocks = UNL.fresh();   // a damaged state reads as fresh (CODE-N2)
    const was = ogUnlocked(), now0 = Date.now();
    if (ev === 'tick') { if (lastTick !== null) useMs += Math.min(UNL.TICK_MAX_MS, Math.max(0, now0 - lastTick)); lastTick = now0; }
    else if (ev === 'sweep-finished') { S.shell.unlocks = UNL.note(S.shell.unlocks, ev, now0); save(); }
    const now = ogUnlocked();
    if (now && !was) { foldUse(true); paintThemeSel(); toasts.show({ text: 'OG (v61) look unlocked: ☰ › Look and controls › Theme', ms: 6000 }); }
    return now;
  }
  // use counts only while the page is on screen; a tick can add at most TrussUnlocks.TICK_MAX_MS, so a closed laptop adds nothing
  if (UNL) {
    noteUnlock('tick'); setInterval(() => { if (document.visibilityState === 'visible') noteUnlock('tick'); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') noteUnlock('tick'); else foldUse(false); });
    window.addEventListener('pagehide', () => foldUse(false));
  }
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
  window.__shell = { go, setState, applyTheme, layout, get themes() { return themes(); }, previewTheme, loadThemeFile, noteUnlock, ogUnlocked, toasts, get unlockState() { return UNL ? unlockState() : null; }, get state() { return S.shell; } };
}
})();
