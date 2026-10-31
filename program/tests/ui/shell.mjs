// balsaPixel 1.0: the window layout (step 1) and the theme setup (#108).
import { serve, browser, openPage, waitRows, checker, SHOTS } from './harness.mjs';
import path from 'path';
import fs from 'fs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
const rect = (p, q) => p.evaluate(q => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, q);
const st = (p, w) => p.evaluate(w => __shell.state.w[__shell.state.place][w], w);
const visible = (p, q) => p.evaluate(q => { const e = document.querySelector(q); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, q);

try {
  const p = await openPage(b, srv.url); await waitRows(p); await p.waitForTimeout(500);
  // ---------- the stage and the contract ----------
  check('the page sits inside #stage, Wireframe by default', await p.evaluate(() => { const s = document.getElementById('stage'); return !!s && s.dataset.theme === 'wireframe' && document.body.children.length === 1; }));
  check('the v61 page is hidden (no header, no dock bar)', !(await visible(p, 'header.top')) && !(await visible(p, '.dockbar')));
  const parts = await p.evaluate(() => ['top-bar', 'nav-button', 'view-pill', 'switch', 'button', 'icon-button', 'segmented', 'edge-tab', 'stepper', 'window', 'window-title', 'results', 'toast', 'badge', 'table', 'drawing', 'sheet']
    .filter(x => !document.querySelector(`#stage [data-part="${x}"]`)));
  check('every part of the contract is tagged with data-part and data-slot', parts.length === 0, parts.join(', '));
  check('slots are only bg, ctl or disp', await p.evaluate(() => [...document.querySelectorAll('#stage [data-slot]')].every(e => ['bg', 'ctl', 'disp'].includes(e.dataset.slot))));
  check('v61 buttons carry the contract classes (.s-b, .s-b.dark)', await p.evaluate(() => !!document.querySelector('#stage .btn.s-b.dark') && !!document.querySelector('#stage .btn.ghost.s-b:not(.dark)')));
  check('picked controls carry .on (aria-pressed / aria-checked / aria-selected)', await p.evaluate(() => [...document.querySelectorAll('#stage .seg button[aria-pressed="true"]')].every(b => b.classList.contains('on')) && !!document.querySelector('#stage .seg button.on')));
  check('the 3D view cube buttons no longer use .nb (it belongs to the top bar)', await p.evaluate(() => !document.querySelector('.navcube .nb, .navpad .nb')));
  check('no two elements share an id', await p.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach(e => { c[e.id] = (c[e.id] || 0) + 1; }); return Object.values(c).every(n => n === 1); }));

  // ---------- Truss place ----------
  check('starts in Truss: the drawing fills the screen', await p.evaluate(() => __shell.state.place === 'truss' && document.getElementById('fsFill').contains(document.getElementById('drawWrap'))));
  check('the Inputs window holds the inputs', await p.evaluate(() => document.getElementById('win-inputs').contains(document.getElementById('inputsPane'))) && await visible(p, '#win-inputs'));
  check('UI-W5: the Drawing window holds the drawing toggles and the legend', await p.evaluate(() => { const w = document.getElementById('win-drawing'); return w.contains(document.getElementById('showDims')) && w.contains(document.getElementById('tg-showDims')) && !!w.querySelector('.legend'); }));
  check('UI-W3: View options in Truss 2D has none of its own tools, so it is not on screen', await p.evaluate(() => !document.getElementById('win-view').contains(document.getElementById('showDims'))) && !(await visible(p, '#win-view')));
  check('the results card shows the verdict', /PASSES|FAILS|UNSTABLE/.test(await p.textContent('#resCard')));
  // UI-A3: the picture is the base layer. It covers the whole stage under the top bar, and the windows float over it.
  const BAR = 56;
  const stageBelowBar = () => p.evaluate(bar => { const r = document.getElementById('stage').getBoundingClientRect(); return { l: r.left, t: r.top + bar, r: r.right, b: r.bottom }; }, BAR);
  const same = (a, b) => !!a && !!b && ['l', 't', 'r', 'b'].every(k => Math.abs(a[k] - b[k]) <= 1);
  const fill0 = await rect(p, '#fsFill');
  { const s0 = await stageBelowBar(), i = await rect(p, '#win-inputs');
    check('UI-A3: the drawing covers the whole stage under the top bar', same(fill0, s0), JSON.stringify({ fill: fill0, stage: s0 }));
    check('UI-A3: the Inputs window floats over the drawing (not beside it)', fill0.l <= i.l && fill0.r >= i.r, JSON.stringify({ fillL: fill0.l, inputsL: i.l })); }
  const fillSame = async (what) => { await p.waitForTimeout(300); const f = await rect(p, '#fsFill'); check(`UI-A3: ${what} doesn't move or resize the drawing`, same(f, fill0), JSON.stringify(f)); };
  await p.screenshot({ path: path.join(SHOTS, 'shell-truss.png') });

  // three states: W → I → T, the edge tab, peek, and back
  const grps = await p.evaluate(() => document.querySelectorAll('#inputsPane > details.grp').length);
  await p.click('#win-inputs [data-step="shrink"]'); await p.waitForTimeout(250);
  await fillSame('resizing a window (Inputs to icons)');
  check('‹ shrinks Inputs to icons, one per section', await st(p, 'inputs') === 'I' && (await p.locator('#win-inputs .s-icons [data-ic]').count()) === grps && !(await visible(p, '#inputsPane')));
  check('the icons window is narrow', (await rect(p, '#win-inputs')).w <= 60);
  await p.click('#win-inputs .s-icons [data-ic="g1"]'); await p.waitForTimeout(250);
  check('an icon opens the window at its section', await st(p, 'inputs') === 'W' && await visible(p, '#inputsPane'));
  await p.click('#win-inputs [data-step="shrink"]'); await p.click('#win-inputs [data-step="shrink"]'); await p.waitForTimeout(250);
  check('‹ again leaves a tab on the left edge', await st(p, 'inputs') === 'T' && !(await visible(p, '#win-inputs')) && await visible(p, '.tabE[data-tab="inputs"]'));
  await fillSame('closing a window (Inputs to a tab)');
  await p.hover('.tabE[data-tab="inputs"]'); await p.waitForTimeout(500);
  check('hovering the tab peeks at the window', await p.evaluate(() => document.getElementById('win-inputs').classList.contains('peek')) && await visible(p, '#win-inputs'));
  await p.mouse.move(900, 500); await p.waitForTimeout(700);
  check('moving away ends the peek', !(await visible(p, '#win-inputs')));
  await p.click('.tabE[data-tab="inputs"]'); await p.waitForTimeout(250);
  check('clicking the tab brings the window back', await st(p, 'inputs') === 'W' && await visible(p, '#win-inputs'));
  await fillSame('opening a window (Inputs from its tab)');
  await p.evaluate(() => { const w = document.getElementById('win-drawing'); w.style.right = '200px'; w.style.top = '300px'; });
  await fillSame('moving a window by hand (Drawing)');
  await p.evaluate(() => __shell.layout());

  // ---------- the Drawing window: built from the window piece (UI-W5, UI-A4, UI-W8, UI-W9, UI-D6, UI-A3; BPD-3) ----------
  const TG = ['showDims', 'resOnDraw', 'showForces', 'd3ShowPlan', 'd3ShowSec', 'showGhosts', 'showIds', 'showElems', 'showDef'];
  check('the Drawing window is the window piece, at home on the right edge', await p.evaluate(() => { const w = document.getElementById('win-drawing'); return w.hasAttribute('data-pc') && w.dataset.part === 'window' && w.dataset.home === 'right' && w.getAttribute('role') === 'region'; }));
  check('it starts as icons in Truss, one per drawing toggle', await st(p, 'drawing') === 'I' && (await p.locator('#win-drawing .s-icons [data-ic]').count()) === TG.length);
  { const was = await p.isChecked('#showIds'); await p.click('#win-drawing .s-icons [data-ic="showIds"]'); await p.waitForTimeout(200);
    check('an icon flips its toggle, and the toggle piece follows', (await p.isChecked('#showIds')) === !was && (await p.getAttribute('#win-drawing .s-icons [data-ic="showIds"]', 'aria-pressed')) === String(!was) && (await p.getAttribute('#tg-showIds', 'aria-checked')) === String(!was));
    await p.click('#win-drawing .s-icons [data-ic="showIds"]'); await p.waitForTimeout(150); }
  await p.click('#win-drawing [data-step="grow"]'); await p.waitForTimeout(300);
  { const d = await rect(p, '#win-drawing'), vw = await p.evaluate(() => innerWidth);
    check('UI-W5: › grows it to words, at the right edge', await st(p, 'drawing') === 'W' && await visible(p, '#tg-showDims') && d.r >= vw - 14 && d.l > vw / 2, JSON.stringify(d)); }
  await fillSame('opening the Drawing window');
  check('every drawing option is a toggle piece with its words (the checkbox keeps its id)', await p.evaluate(TG => TG.every(k => { const t = document.getElementById('tg-' + k), c = document.getElementById(k); return t && t.getAttribute('role') === 'switch' && t.hasAttribute('data-pc') && c && c.type === 'checkbox' && t.getAttribute('aria-checked') === String(c.checked) && t.closest('label').textContent.trim().length > 3; }), TG));
  // every toggle still switches its layer: the checkbox, the app's setting and (in 2D) the drawing all follow
  const STATE = { showDims: 'S.showDims', resOnDraw: 'S.resOnDraw', showForces: 'S.showForces', d3ShowPlan: 'S.d3.showPlan', d3ShowSec: 'S.d3.showSec', showGhosts: 'S.showGhosts', showIds: 'S.showIds', showElems: 'S.showElems', showDef: 'S.showDef' };
  const ONLY3D = ['d3ShowPlan', 'd3ShowSec'];
  for (const k of TG) {
    const read = () => p.evaluate(([k, path]) => { const S = __dbg.S, v = path.split('.').slice(1).reduce((o, x) => o && o[x], S); return { cb: document.getElementById(k).checked, s: v !== false && v != null && v !== 0 ? !!v : false, draw: document.getElementById('draw').innerHTML.length + ':' + document.getElementById('draw').querySelectorAll('*').length + ':' + (document.getElementById('resOv') ? document.getElementById('resOv').hidden : '-') }; }, [k, STATE[k]]);   // resOnDraw's layer is the #resOv overlay
    const a = await read(); await p.click('#tg-' + k); await p.waitForTimeout(250); const b = await read();
    const ok = b.cb === !a.cb && b.s === b.cb && (ONLY3D.includes(k) || a.draw !== b.draw);
    check(`toggle ${k}: switches its layer`, ok, JSON.stringify({ a, b }));
    await p.click('#tg-' + k); await p.waitForTimeout(200);
  }
  check('UI-D6: no two toggle labels overlap', await p.evaluate(() => { const r = [...document.querySelectorAll('#win-drawing .te-togrow')].map(e => e.getBoundingClientRect()).filter(x => x.width); return r.every((a, i) => r.every((b, j) => i >= j || a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)); }));
  // UI-W8: windows aren't pop-ups, so a click on the picture leaves the Drawing window open
  await p.mouse.click(700, 700); await p.waitForTimeout(250);
  check('UI-W8: a click on the picture leaves the Drawing window open', await st(p, 'drawing') === 'W' && await visible(p, '#win-drawing'));
  await p.click('#win-drawing [data-step="shrink"]'); await p.waitForTimeout(200);
  await fillSame('resizing the Drawing window (to icons)');
  await p.click('#win-drawing [data-step="shrink"]'); await p.waitForTimeout(300);
  check('UI-W5: › again leaves the tab ◂ DRAWING on the right edge', await st(p, 'drawing') === 'T' && !(await visible(p, '#win-drawing')) && await visible(p, '.tabE[data-tab="drawing"]') && /◂\s*drawing/i.test(await p.textContent('.tabE[data-tab="drawing"]')));
  await fillSame('closing the Drawing window (to its tab)');
  await p.hover('.tabE[data-tab="drawing"]'); await p.waitForTimeout(600);
  { const w = await rect(p, '#win-drawing'), t = await rect(p, '.tabE[data-tab="drawing"]');
    check('UI-W9, UI-W17: hovering the tab peeks beside it', await p.evaluate(() => document.getElementById('win-drawing').classList.contains('peek')) && await visible(p, '#win-drawing') && w.r <= t.l - 6, JSON.stringify({ w, t })); }
  await fillSame('a peek (a window moved beside its tab)');
  await p.mouse.move(700, 700); await p.waitForTimeout(800);
  check('moving away ends the peek', !(await visible(p, '#win-drawing')));
  await p.click('.tabE[data-tab="drawing"]'); await p.waitForTimeout(300);
  check('clicking the tab brings it back in words', await st(p, 'drawing') === 'W' && await visible(p, '#win-drawing'));
  await p.click('#win-drawing [data-step="shrink"]'); await p.waitForTimeout(200);
  // results
  await p.click('#resCard'); await p.waitForTimeout(250);
  check('the results card opens the full results', await visible(p, '#win-results') && await p.evaluate(() => document.getElementById('win-results').contains(document.getElementById('stats'))));
  await p.click('#resCard'); await p.waitForTimeout(200);
  check('and closes them again', !(await visible(p, '#win-results')));
  // Esc stays put
  await p.click('#fsFill', { position: { x: 30, y: 30 } }).catch(() => {}); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  check('Esc does not leave the place', await p.evaluate(() => document.getElementById('fsFill').contains(document.getElementById('drawWrap'))));

  // ---------- 2D | 3D, Analysis, back ----------
  await p.click('#shellNav [data-sw="t:3"]'); await p.waitForTimeout(1200);
  check('Truss 3D: the analysis model is 3D and the 3D bridge fills the screen', await p.evaluate(() => __dbg.S.anaMode === '3d' && document.getElementById('fsFill').contains(document.getElementById('c3d'))));
  await p.click('#shellNav [data-sw="t:2"]'); await p.waitForTimeout(800);
  check('Truss 2D: back to the side view', await p.evaluate(() => __dbg.S.anaMode === '2d' && document.getElementById('fsFill').contains(document.getElementById('drawWrap'))));
  await p.click('#shellNav [data-go="analysis"]'); await p.waitForTimeout(700);
  check('Analysis: the chart fills the screen and its controls are in View options', await p.evaluate(() => __shell.state.place === 'analysis' && document.getElementById('fsFill').contains(document.getElementById('tradeCanvas')) && document.getElementById('win-view').contains(document.getElementById('trackTabs'))));
  check('Inputs start as a tab in Analysis (each place keeps its own layout)', await st(p, 'inputs') === 'T');
  check('Analysis shows how many designs pass', /\d/.test(await p.textContent('#shellNav .vp.on .badge').catch(() => '')));
  await p.click('#shellNav [data-sw="a:3"]'); await p.waitForTimeout(700);
  check('Analysis 3D: the 3D trade-off chart', await p.evaluate(() => __dbg.S.tab === 'c3' && document.getElementById('fsFill').contains(document.getElementById('c3Canvas'))));
  await p.click('#shellNav [data-sw="a:2"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(SHOTS, 'shell-analysis.png') });
  await p.click('#navBack'); await p.waitForTimeout(600);
  check('← goes back to Truss', await p.evaluate(() => __shell.state.place === 'truss' && document.getElementById('fsFill').contains(document.getElementById('drawWrap'))));
  // the top bar folds too
  await p.click('#navFold'); await p.waitForTimeout(150);
  check('top bar ‹: icons only (no words)', await p.locator('#shellNav .lab').count() === 0 && await visible(p, '#shellNav .swb'));
  await p.click('#navFold'); await p.waitForTimeout(150);
  check('‹ again: a tab', !(await visible(p, '#shellNav')) && await visible(p, '#navTab'));
  await p.click('#navTab'); await p.click('#navGrow'); await p.waitForTimeout(150);
  check('and back to words and icons', await p.locator('#shellNav .lab').count() >= 2);

  // ---------- themes ----------
  await p.click('#dockBtn'); await p.waitForTimeout(150);
  check('☰ opens the drawer, Look and controls first', await visible(p, '#dockMenu') && (await p.textContent('#dockMenu .dsec summary')).trim() === 'Look and controls');
  await p.click('#lookSec > summary');
  const opts = await p.$$eval('#themeSel option', o => o.map(x => x.value));
  check('the theme picker lists Wireframe, OG, Blueprint and Notebook + Calculator', ['wireframe', 'og', 'blueprint', 'notebook-calc'].every(x => opts.includes(x)), opts.join(', '));
  const meaning = () => p.evaluate(() => ['--comp', '--tens', '--zero', '--ok', '--bad'].map(v => getComputedStyle(document.querySelector('#draw')).getPropertyValue(v).trim()).join(' '));
  const m0 = await meaning();
  for (const t of ['blueprint', 'notebook-calc', 'notebook-calc-calc', 'og', 'wireframe']) {
    await p.selectOption('#themeSel', t); await p.waitForTimeout(300);
    check(`theme ${t}: applied`, await p.evaluate(t => document.getElementById('stage').dataset.theme === t, t) && (await meaning()) === m0);
    if (t !== 'wireframe' && t !== 'og') check(`theme ${t}: its CSS is on the page`, (await p.evaluate(() => document.getElementById('themeCss').textContent.length)) > 500);
    await p.screenshot({ path: path.join(SHOTS, `shell-theme-${t}.png`) });
  }
  check('meaning colours never change with the theme', true, m0);
  // ART-K6 (Wireframe strong is brown #7a4f1c) and ART-S5 (focus: 3 px accent outline, 3 px offset)
  await p.selectOption('#themeSel', 'wireframe'); await p.waitForTimeout(200);
  { const strong = await p.evaluate(() => getComputedStyle(document.getElementById('stage')).getPropertyValue('--te-strong').trim().toLowerCase());
    await p.focus('#dockBtn'); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab');
    const ring = await p.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { on: e.matches(':focus-visible'), w: s.outlineWidth, off: s.outlineOffset }; });
    check('ART-K6, ART-S5: Wireframe strong is #7a4f1c and a focused button has a 3 px outline 3 px out', strong === '#7a4f1c' && ring.on && ring.w === '3px' && ring.off === '3px', JSON.stringify({ strong, ring })); }
  await p.selectOption('#themeSel', 'notebook-calc'); await p.waitForTimeout(300);
  check('Notebook + Calculator turns the top bar to balsa', /photo-balsa|data:image/.test(await p.evaluate(() => getComputedStyle(document.querySelector('#shellNav .nb')).backgroundImage)));
  await p.selectOption('#themeSel', 'og'); await p.waitForTimeout(200);
  check('OG keeps the v61 buttons', await p.evaluate(() => { const b = document.querySelector('#dockMenu .btn.acc'); const s = getComputedStyle(b); return s.borderRadius === '4px'; }));
  // only built-in themes until the shared theme format exists (#197): no way to load raw CSS
  check('no raw CSS loading (built-in themes only)', await p.evaluate(() => !document.querySelector('#stage input[type="file"][accept*="css"]') && ![...document.querySelectorAll('#themeSel option')].some(o => o.value === 'local')));
  await p.evaluate(() => { try { localStorage.setItem('te-theme-local', '#stage{--te-strong:red}'); } catch (e) {} __shell.applyTheme('local'); });
  check('an unknown theme id falls back to Wireframe', await p.evaluate(() => document.getElementById('stage').dataset.theme === 'wireframe' && document.getElementById('themeCss').textContent === ''));
  await p.selectOption('#themeSel', 'wireframe');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);

  // ---------- saving still works from ☰ ----------
  if (await p.isHidden('#dockMenu')) await p.click('#dockBtn');
  await p.click('#dockMenu [data-click="saveBridge"]');
  const shown = await p.waitForSelector('#saveModal:not([hidden])', { timeout: 4000 }).then(() => true).catch(() => false);
  const top = shown && await p.evaluate(() => { const m = document.getElementById('saveModal'); const c = m.querySelector('.modalcard').getBoundingClientRect(); const e = document.elementFromPoint(c.left + c.width / 2, c.top + 12); return m.contains(e); });
  const dl = p.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  if (shown) await p.click('#saveGo');
  const d = await dl;
  check('☰ Save bridge file: the pop-up is on top and the file downloads', top && !!d && d.suggestedFilename().endsWith('.bridge.json'));
  await p.evaluate(() => document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }));

  // ---------- it remembers ----------
  await p.click('#win-drawing [data-step="grow"]').catch(() => {}); await p.waitForTimeout(150);
  const before = await p.evaluate(() => JSON.stringify(__shell.state.w));
  await p.reload(); await p.waitForFunction(() => window.__dbg && __dbg.res && window.__shell); await p.waitForTimeout(400);
  check('window states and place survive a reload', (await p.evaluate(() => JSON.stringify(__shell.state.w))) === before);
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 3).join(' | '));
  await p.close();

  // ---------- phone width: nothing runs off the screen ----------
  const q = await openPage(b, srv.url, { width: 390, height: 844 }); await q.waitForTimeout(800);
  check('phone: no horizontal scroll', await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await q.screenshot({ path: path.join(SHOTS, 'shell-phone.png') });
  check('phone: no script errors', q.errs.length === 0, q.errs.slice(0, 2).join(' | '));
  await q.close();

  // ---------- ?layout=classic keeps the v61 page ----------
  const c = await openPage(b, srv.url + '?layout=classic');
  check('?layout=classic: the v61 page, no #stage', await c.evaluate(() => !document.getElementById('stage') && !window.SHELL_ON) && await visible(c, 'header.top'));
  await c.close();
} finally {
  await b.close(); srv.close();
}
const fails = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} shell checks passed`);
process.exit(fails.length ? 1 : 0);
