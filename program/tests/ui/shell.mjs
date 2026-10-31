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
  check('View options holds the drawing options', await p.evaluate(() => document.getElementById('win-view').contains(document.getElementById('showDims'))));
  check('the results card shows the verdict', /PASSES|FAILS|UNSTABLE/.test(await p.textContent('#resCard')));
  { const i = await rect(p, '#win-inputs'), f = await rect(p, '#fsFill'), v = await rect(p, '#win-view');
    check('the drawing area starts right of the Inputs window and below View options', f.l >= i.r - 1 && f.t >= v.b - 1, JSON.stringify({ inputsR: i.r, fillL: f.l, viewB: v.b, fillT: f.t })); }
  await p.screenshot({ path: path.join(SHOTS, 'shell-truss.png') });

  // three states: W → I → T, the edge tab, peek, and back
  const grps = await p.evaluate(() => document.querySelectorAll('#inputsPane > details.grp').length);
  await p.click('#win-inputs [data-step="shrink"]'); await p.waitForTimeout(250);
  check('‹ shrinks Inputs to icons, one per section', await st(p, 'inputs') === 'I' && (await p.locator('#win-inputs .s-icons [data-ic]').count()) === grps && !(await visible(p, '#inputsPane')));
  check('the icons window is narrow', (await rect(p, '#win-inputs')).w <= 60);
  await p.click('#win-inputs .s-icons [data-ic="g1"]'); await p.waitForTimeout(250);
  check('an icon opens the window at its section', await st(p, 'inputs') === 'W' && await visible(p, '#inputsPane'));
  await p.click('#win-inputs [data-step="shrink"]'); await p.click('#win-inputs [data-step="shrink"]'); await p.waitForTimeout(250);
  check('‹ again leaves a tab on the left edge', await st(p, 'inputs') === 'T' && !(await visible(p, '#win-inputs')) && await visible(p, '.tabE[data-tab="inputs"]'));
  check('with Inputs as a tab, the drawing takes the room', (await rect(p, '#fsFill')).l < 5);
  await p.hover('.tabE[data-tab="inputs"]'); await p.waitForTimeout(500);
  check('hovering the tab peeks at the window', await p.evaluate(() => document.getElementById('win-inputs').classList.contains('peek')) && await visible(p, '#win-inputs'));
  await p.mouse.move(900, 500); await p.waitForTimeout(700);
  check('moving away ends the peek', !(await visible(p, '#win-inputs')));
  await p.click('.tabE[data-tab="inputs"]'); await p.waitForTimeout(250);
  check('clicking the tab brings the window back', await st(p, 'inputs') === 'W' && await visible(p, '#win-inputs'));
  await p.click('#win-view [data-step="shrink"]'); await p.waitForTimeout(250);
  const vIcons = await p.locator('#win-view .s-icons [data-ic]').count();
  check('View options as icons: one toggle per drawing option', vIcons >= 6, vIcons);
  const was = await p.isChecked('#showIds'); await p.click('#win-view .s-icons [data-ic="showIds"]'); await p.waitForTimeout(200);
  check('an icon toggle flips its option', (await p.isChecked('#showIds')) === !was && (await p.getAttribute('#win-view .s-icons [data-ic="showIds"]', 'aria-pressed')) === String(!was));
  await p.click('#win-view .s-icons [data-ic="showIds"]'); await p.click('#win-view [data-step="grow"]');
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
