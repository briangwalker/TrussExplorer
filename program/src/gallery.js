// ===== Truss gallery: the hidden page that shows every shared screen piece (#384; UI-G1-G5) =====
// One global, TrussGallery (CODE-F1). Opened only by adding exactly ?gallery=1 to the alpha or preview link (UI-G2).
// It is where UI, Graphics, the Future Vision Lead and Brian review the real pieces (Brian's 41a, TE-B-227): every item is
// made by TrussPieces (src/pieces.js), styled by the real theme files, and switched with the shell's own no-save door
// (__shell.previewTheme, TE-B-251/267), so nothing is hand-drawn or copied (UI-G3).
//   Where it lives and its guards are the Architecture Lead's (TE-B-230), each tested in tests/ui/gallery.mjs:
//    (a) without ?gallery=1 it does nothing: no DOM, no listeners;
//    (b) it starts on DOMContentLoaded (build.py loads gallery.js before pieces.js);
//    (c) it builds <section id="gallery" data-slot="bg"> inside #stage and hides the app's windows only while open;
//    (d) it reads no bridge or app state and writes no storage (UI-G4): clicks and keys inside it stop at the section,
//        so the shell's and the app's own handlers (which save) never see them;
//    (e) no network, no page errors.
//   pageHTML() and coverage() are pure (no DOM), so tests/gallery.test.js runs them under Node.
(function (root) {
'use strict';

// UI-G2: exactly one gallery parameter, exactly '1'. Anything else (gallery=0, gallery=true, gallery, two of them) is nothing.
function wanted(search) {
  let q; try { q = new URLSearchParams(String(search || '')); } catch (e) { return false; }
  const v = q.getAll('gallery');
  return v.length === 1 && v[0] === '1';
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Pieces that no rule-built piece exists for yet: shown as plain cards naming their rules (UI-G3), so gaps are visible.
const NOT_BUILT = [
  { title: 'Top bar', rules: ['UI-W1', 'UI-A5', 'UI-A6'], note: 'still the step-1 shell (#183); not a shared piece yet' },
  { title: 'Value editor (✎)', rules: ['UI-I8', 'ART-W9'], note: 'pieces 0.2' },
  { title: 'Number box', rules: ['UI-I9', 'ART-T2'], note: 'pieces 0.2' },
  { title: 'Stepper', rules: ['UI-I1'], note: 'pieces 0.2' },
  { title: 'Sheet (☰ page)', rules: ['UI-A16'], note: 'pieces 0.2' },
  { title: 'Toast', rules: ['UI-W10', 'ART-P1', 'ART-T3'], note: 'pieces 0.2' },
  { title: 'Dialog', rules: ['UI-W13'], note: 'pieces 0.2' },
  { title: 'PIP', rules: ['UI-W7', 'UI-H5', 'UI-H8'], note: 'step 3 (#210)' },
  { title: 'Chart key', rules: ['UI-W11'], note: 'step 4 (#211)' },
];
const THEME_SWITCH_NOT_BUILT = { title: 'Switching themes in the gallery', rules: ['UI-G3', 'UI-G4'], note: "waits for the shell's no-save theme door (BPD-4, TE-B-267); the gallery shows the theme the program is in" };

// A small truss drawn as the picture under the windows, so a frame shows that windows float over it (UI-A3).
const PIC = '<svg viewBox="0 0 600 240" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
  + '<g fill="none" stroke="var(--te-muted)" stroke-width="2" opacity=".55"><path d="M60 180H540M120 100H480M60 180L120 100L180 180L240 100L300 180L360 100L420 180L480 100L540 180M120 100V180M180 100V180M240 100V180M300 100V180M360 100V180M420 100V180M480 100V180"/></g></svg>';

// The items, in page order. Each one: title, rules it shows, and the HTML made by TrussPieces (P).
function sections(P) {
  const frame = (inner, cls) => `<div class="g-frame${cls ? ' ' + cls : ''}"><div class="te-picture g-pic">${PIC}</div>${inner}</div>`;
  const win = (id, title, home, state, body, icons) => P.windowHTML({ id, title, home, state, body, icons }) + P.edgeTabHTML({ id, title, home, state });
  const ICONS = [{ ic: 'shape', label: 'Shape', icon: 'S' }, { ic: 'geo', label: 'Geometry', icon: 'G' }, { ic: 'load', label: 'Load', icon: 'L', on: true }];
  const body = '<p class="g-txt">Words and icons: the window\'s own controls go here.</p>' + P.toggleHTML({ label: 'Member forces', checked: true });
  const btnRow = kind => ['default', 'pressed', 'disabled'].map(st => `<div class="g-cell"><span class="g-lab">${st}</span>`
    + P.buttonHTML({ kind, label: kind === 'icon' ? 'Run the sweep' : kind === 'chip' ? '⇄ sweep' : 'Run sweep', icon: kind === 'icon' ? '▶' : null, pressed: st === 'pressed' ? true : (kind === 'stick' ? undefined : false), disabled: st === 'disabled' }) + '</div>').join('');
  const slider = o => P.sliderHTML(Object.assign({ key: 'h', label: 'Height h', unit: 'mm', min: 0, max: 140, step: 1, wall: { lo: 20 }, rule: { hi: 100 }, ruleNote: 'Course rule: h ≤ 100 mm', wallNote: 'Model limit: below the table face' }, o));
  return [
    { id: 'tokens', title: 'Theme tokens and contrast', rules: ['UI-T1', 'ART-K1', 'ART-K6', 'ART-K14', 'ART-C1', 'ART-C2'],
      html: `<div class="g-tokens" data-g-tokens>${P.TOKENS.filter(t => !/^font/.test(t.name)).map(t => `<div class="g-tok"><span class="g-sw" style="background:var(${t.css})"></span><code>${esc(t.css)}</code> <span class="g-rule">${esc(t.rule)}</span></div>`).join('')}</div>`
        + '<table class="g-pairs" data-g-pairs><caption>Contrast in this theme (ART-C1 text 4.5 : 1, ART-C2 lines 3 : 1)</caption><tbody></tbody></table>' },
    { id: 'win-w', title: 'Window: words and icons (W)', rules: ['UI-A3', 'UI-A4', 'UI-W1', 'UI-W15', 'UI-K4'], html: frame(win('g-left', 'Inputs', 'left', 'W', body, ICONS) + win('g-right', 'Drawing', 'right', 'W', P.toggleHTML({ label: 'Dimensions', checked: false }), ICONS)) },
    { id: 'win-i', title: 'Window: icons only (I)', rules: ['UI-A4', 'UI-W15'], html: frame(win('g-icons', 'Inputs', 'left', 'I', body, ICONS) + win('g-icons-r', 'Drawing', 'right', 'I', '', ICONS)) },
    { id: 'win-t', title: 'Window: edge tab (T)', rules: ['UI-A4', 'UI-W15', 'ART-K8'], html: frame(win('g-tab', 'Inputs', 'left', 'T', body, ICONS) + win('g-tab-b', 'Sweep', 'bottom', 'T', '', [])) },
    { id: 'win-peek', title: 'Peek: hover a tab', rules: ['UI-W9', 'UI-W17'], note: 'Shown open; move the pointer over and off the tab to see it close after 400 ms.', html: frame(win('g-peek', 'Inputs', 'left', 'T', body, ICONS), 'g-peekframe') },
    { id: 'stick', title: 'Stick buttons', rules: ['ART-S1', 'ART-S2', 'ART-S3', 'ART-S4', 'ART-S5', 'ART-S6', 'ART-S10'], note: 'Hover one to see it lift; press Tab to see the focus ring.', html: `<div class="g-row">${btnRow('stick')}</div>` },
    { id: 'icon', title: 'Icon buttons', rules: ['ART-I2', 'ART-S3', 'ART-S4'], html: `<div class="g-row">${btnRow('icon')}</div>` },
    { id: 'chip', title: 'Chips', rules: ['ART-S3', 'ART-S6', 'ART-S7'], html: `<div class="g-row">${btnRow('chip')}</div>` },
    { id: 'toggle', title: 'Toggles: off, on, disabled', rules: ['ART-S3', 'ART-S6', 'UI-A17'],
      html: `<div class="g-row">${P.toggleHTML({ label: 'Off', checked: false })}${P.toggleHTML({ label: 'On', checked: true })}${P.toggleHTML({ label: 'Disabled', checked: false, disabled: true })}</div>` },
    { id: 'tabs', title: 'Tabs', rules: ['UI-S6', 'UI-K7', 'ART-W13'], note: 'Arrow keys move and pick; Home and End go to the ends.',
      html: P.tabsHTML({ label: 'Analysis', idPrefix: 'g-tabs', selected: 'hist', tabs: [{ id: 'wood', label: 'Required wood' }, { id: 'hist', label: 'History' }, { id: 'win', label: 'Winners' }, { id: 'mem', label: 'Members' }] }) },
    { id: 'slider', title: 'Sliders', rules: ['UI-I1', 'UI-I2', 'UI-I3', 'ART-W1', 'ART-W5', 'ART-K16'], html: '<div class="g-sliders">'
      + `<div class="g-cell"><span class="g-lab">one value</span>${P.sliderHTML({ key: 'n', label: 'Panels', min: 2, max: 12, step: 1, value: 6 })}</div>`
      + `<div class="g-cell"><span class="g-lab">swept range</span>${slider({ value: 80, from: 60, to: 100 })}</div>`
      + `<div class="g-cell"><span class="g-lab">past a course rule (never clamped)</span>${slider({ key: 'h2', value: 120 })}</div>`
      + `<div class="g-cell"><span class="g-lab">at a model limit (stops at the wall)</span>${slider({ key: 'h3', value: 0 })}</div></div>` },
    { id: 'results', title: 'Results card: passes, fails, unstable', rules: ['UI-W2', 'UI-A17', 'UI-A18', 'ART-W3', 'ART-T2'], html: '<div class="g-col">'
      + P.resultsHTML({ verdict: 'pass', checks: [{ value: '18.6', op: '>=', limit: '5.0', unit: 'kg', ok: true }, { value: '0.131', op: '<=', limit: '2', unit: 'mm', ok: true }] })
      + P.resultsHTML({ verdict: 'fail', checks: [{ value: '3.9', op: '>=', limit: '5.0', unit: 'kg', ok: false }, { value: '0.131', op: '<=', limit: '2', unit: 'mm', ok: true }] })
      + P.resultsHTML({ verdict: 'unstable' }) + '</div>' },
    { id: 'popup', title: 'Pop-up: the results card\'s full view, open', rules: ['UI-W8', 'UI-W18', 'ART-W12'], note: 'Click outside to close it (that click does nothing else); Esc closes it and returns focus. Its content is #210\'s.',
      html: '<div class="g-popframe">' + P.resultsHTML({ id: 'g-res', verdict: 'pass', checks: [{ value: '18.6', op: '>=', limit: '5.0', unit: 'kg', ok: true }] })
        + '<div class="te-pop" id="g-pop" role="dialog" aria-label="Full results" hidden>The full results go here: each check against its limit, the project facts, and links (UI-W18, #210).</div></div>' },
  ];
}

// UI-G1: the page ends with a coverage list: rules shown, and rules with no piece yet.
function coverage(P, opts) {
  const shown = new Set(), missing = new Set();
  sections(P).forEach(s => s.rules.forEach(r => shown.add(r)));
  NOT_BUILT.concat(opts && opts.themes ? [] : [THEME_SWITCH_NOT_BUILT]).forEach(n => n.rules.forEach(r => { if (!shown.has(r)) missing.add(r); }));
  const byId = (a, b) => a.localeCompare(b, 'en', { numeric: true });
  return { shown: [...shown].sort(byId), missing: [...missing].sort(byId) };
}

// The whole page as one string. opts: { themes: [{ id, name }] or null (no door yet), theme: the id now on #stage }
function pageHTML(P, opts) {
  opts = opts || {};
  const items = sections(P).map(s => `<figure class="g-item" data-g-item="${esc(s.id)}"><figcaption><b>${esc(s.title)}</b> <span class="g-rules">${s.rules.map(esc).join(' · ')}</span>`
    + `${s.note ? `<span class="g-note">${esc(s.note)}</span>` : ''}</figcaption>${s.html}</figure>`).join('');
  const nb = n => `<figure class="g-item g-nb" data-g-notbuilt><figcaption><b>${esc(n.title)}</b> <span class="g-rules">${n.rules.map(esc).join(' · ')}</span></figcaption><p>Not built yet: ${esc(n.note)}.</p></figure>`;
  const picker = opts.themes && opts.themes.length
    ? `<div class="g-themes" role="group" aria-label="Theme">${opts.themes.map(t => P.buttonHTML({ kind: 'chip', label: t.name, pressed: t.id === opts.theme, act: 'theme:' + t.id })).join('')}</div>`
    : nb(THEME_SWITCH_NOT_BUILT);
  const cov = coverage(P, opts);
  return `<header class="g-head"><h1>Gallery: the screen pieces</h1><p class="g-txt">Every shared piece the program is built from, in every state, made by the program's own code (UI-G1, UI-G3). `
    + `It changes nothing and saves nothing (UI-G4). Remove <code>?gallery=1</code> from the link to go back to the program.</p>${picker}</header>`
    + `<div class="g-grid">${items}</div><h2>Not built yet</h2><div class="g-grid">${NOT_BUILT.map(nb).join('')}</div>`
    + `<section class="g-cov" aria-label="Coverage"><h2>Coverage</h2><p><b>Rules shown (${cov.shown.length}):</b> <span data-g-shown>${cov.shown.map(esc).join(', ')}</span></p>`
    + `<p><b>Rules with no piece yet (${cov.missing.length}):</b> <span data-g-missing>${cov.missing.map(esc).join(', ')}</span></p></section>`;
}

// The gallery's own layout. Tokens only, so every theme dresses it (UI-T1); 13 px minimum (ART-T2).
const CSS = `
#stage.te-gallery-on>:not(#gallery){visibility:hidden}
#stage #gallery{position:absolute;inset:0;z-index:200;overflow:auto;box-sizing:border-box;padding:20px 24px 80px;background:var(--te-page);color:var(--te-ink);font:400 14px var(--te-font-ui);visibility:visible}
#gallery h1{font:700 24px var(--te-font-head);margin:0 0 4px}
#gallery h2{font:700 19px var(--te-font-head);margin:28px 0 10px}
#gallery .g-txt{margin:4px 0 10px;max-width:70ch}
#gallery .g-head{margin-bottom:16px}
#gallery .g-themes{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
#gallery .g-grid{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
#gallery .g-item{margin:0;background:var(--te-surface);border:1px solid var(--te-line-soft);border-radius:8px;padding:10px 12px;max-width:100%;box-sizing:border-box}
#gallery figcaption{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;margin-bottom:8px}
#gallery .g-rules{font:500 13px var(--te-font-mono);color:var(--te-muted)}
#gallery .g-note{flex-basis:100%;font-size:13px;color:var(--te-muted)}
#gallery .g-nb{border:2px dashed var(--te-line);background:transparent;width:260px}
#gallery .g-nb p{margin:0;font-size:13px}
#gallery .g-frame{position:relative;width:600px;max-width:calc(100vw - 80px);height:250px;overflow:hidden;border:1px dashed var(--te-line);border-radius:6px;background:var(--te-page);--te-home-top:12px;--te-win-w:240px}
#gallery .g-pic svg{display:block}
#gallery .g-row{display:flex;flex-wrap:wrap;gap:14px;align-items:center}
#gallery .g-cell{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
#gallery .g-lab{font-size:13px;color:var(--te-muted)}
#gallery .g-sliders{display:grid;grid-template-columns:repeat(2,minmax(220px,280px));gap:14px 24px}
#gallery .g-sliders .te-slider{width:100%}
#gallery .g-col{display:flex;flex-direction:column;gap:10px;align-items:flex-start}
#gallery .g-popframe{position:relative;min-height:120px;width:420px;max-width:100%}
#gallery .g-popframe .te-pop{left:0;top:48px;width:360px}
#gallery .g-tokens{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px 16px;max-width:760px}
#gallery .g-tok{display:flex;align-items:center;gap:8px;font-size:13px}
#gallery .g-tok code{font:13px var(--te-font-mono)}
#gallery .g-rule{font:13px var(--te-font-mono);color:var(--te-muted)}
#gallery .g-sw{width:22px;height:22px;border:1px solid var(--te-line);border-radius:4px;flex:none}
#gallery .g-pairs{margin-top:10px;border-collapse:collapse;font:13px var(--te-font-mono)}
#gallery .g-pairs caption{text-align:left;font:600 13px var(--te-font-ui);margin-bottom:4px}
#gallery .g-pairs td{padding:2px 10px 2px 0;text-align:left}
#gallery .g-cov p{max-width:110ch;font:13px var(--te-font-mono)}
`;

// Events that must not leave the gallery: the shell and the app listen for these higher up, and their handlers save.
const STOP = ['click', 'dblclick', 'contextmenu', 'keydown', 'keyup', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'wheel', 'input', 'change'];

let state = { active: false };

// Builds the gallery into #stage. Called on DOMContentLoaded, only when the URL asked for it.
function open(doc, win) {
  const stage = doc.getElementById('stage'), P = win.TrussPieces;
  if (!stage || !P || doc.getElementById('gallery')) return false;   // classic layout, or already open
  P.install(doc);
  if (!doc.getElementById('te-gallery')) { const s = doc.createElement('style'); s.id = 'te-gallery'; s.textContent = CSS; doc.head.appendChild(s); }
  const sh = win.__shell, door = sh && Array.isArray(sh.themes) && typeof sh.previewTheme === 'function';
  const themes = door ? sh.themes.map(t => ({ id: String(t.id), name: String(t.name) })) : null;
  const section = doc.createElement('section');
  section.id = 'gallery'; section.dataset.slot = 'bg'; section.setAttribute('aria-label', 'Gallery of the screen pieces');
  section.innerHTML = pageHTML(P, { themes, theme: stage.dataset.theme });
  STOP.forEach(t => section.addEventListener(t, ev => ev.stopPropagation()));
  stage.appendChild(section); stage.classList.add('te-gallery-on');

  // behaviour, from the pieces themselves
  section.querySelectorAll('.s-pan').forEach(w => P.mountWindow(w, section.querySelector(`.tabE[data-tab="${w.dataset.win}"]`)));
  section.querySelectorAll('[role="switch"]').forEach(t => P.mountToggle(t));
  section.querySelectorAll('.te-chip[aria-pressed]:not([data-act^="theme:"])').forEach(c => P.mountToggle(c));
  section.querySelectorAll('[role="tablist"]').forEach(t => P.mountTabs(t));
  section.querySelectorAll('.te-slider').forEach(s => P.mountSlider(s));
  const pops = P.popups(doc), card = section.querySelector('#g-res'), pop = section.querySelector('#g-pop');
  if (card && pop) { card.addEventListener('click', () => pops.open(pop, card)); pops.open(pop, card); }
  const peekTab = section.querySelector('.tabE[data-tab="g-peek"]');   // shown open, by the window's own peek code
  if (peekTab) peekTab.dispatchEvent(new MouseEvent('mouseenter'));

  // the contrast pairs of whatever theme is on the stage now
  const paintPairs = () => {
    const cs = win.getComputedStyle(stage), v = {};
    P.TOKENS.forEach(t => { v[t.name] = cs.getPropertyValue(t.css).trim(); });
    const rows = P.contrastPairs(v).map(p => `<tr><td>${esc(p.fg)} on ${esc(p.bg)}</td><td>${isNaN(p.ratio) ? '—' : p.ratio.toFixed(2) + ' : 1'}</td><td>${isNaN(p.ratio) ? 'not a plain colour' : p.ok ? '✓' : '✕ under ' + p.min}</td><td>${esc(p.rule)}</td></tr>`);
    const tb = section.querySelector('[data-g-pairs] tbody'); if (tb) tb.innerHTML = rows.join('');
  };
  paintPairs();
  if (door) section.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act^="theme:"]'); if (!b) return;
    const id = b.dataset.act.slice(6); sh.previewTheme(id);
    section.querySelectorAll('[data-act^="theme:"]').forEach(x => { const on = x === b; x.setAttribute('aria-pressed', String(on)); x.classList.toggle('on', on); });
    paintPairs();
  });
  state = { active: true, door };
  return true;
}

// At load: look at the URL and nothing else (a). If it asks for the gallery, wait for the page (b).
function start(doc, win) {
  if (!doc || !win || !wanted(win.location && win.location.search)) return false;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => open(doc, win), { once: true });
  else open(doc, win);
  return true;
}

const api = { wanted, sections, coverage, pageHTML, NOT_BUILT, CSS, open, start, get active() { return state.active; }, get door() { return !!state.door; } };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else { root.TrussGallery = api; if (typeof document !== 'undefined') start(document, root); }
})(typeof window !== 'undefined' ? window : globalThis);
