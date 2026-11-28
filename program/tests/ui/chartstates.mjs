// balsaPixel 1.0, step 9 part 1 (#216; UIE-11, TE-B-736): the Analysis chart's 'no sweep yet' and 'out of date' states (UI-A14, UI-S5)
// No sweep yet: your bridge is the one dot, with an arrow and words pointing to Run sweep. Out of date: the dots fade and a banner names what changed.
// A fresh sweep clears both. 2D and 3D charts. axe on the Analysis stage. Words come from TrussStrings (chart.state.*).
import { serve, browser, checker, ROOT } from './harness.mjs';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const T = require(path.join(ROOT, 'src', 'strings.js'));
let axeSrc = null; try { axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch (e) { /* npm ci not run: the axe check says so */ }

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
const runSweep = async p => {
  await p.evaluate(() => document.getElementById('runSweep').click());
  await p.waitForFunction(() => !document.getElementById('runSweep').disabled && __dbg.rows.length > 0, null, { timeout: 120000 }); await p.waitForTimeout(500);
};
// book length, not height: the default sweep sweeps height and overlap, so changing those doesn't put it out of date (as in sweepbar.mjs)
const bumpBook = async p => { await p.evaluate(() => { const i = document.getElementById('bookLen'); i.value = String(+i.value + 2); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(900); };
const st = (p, id) => p.evaluate(id => {
  const cv = document.getElementById(id), el = cv.parentElement.querySelector(':scope > .chartstate'), btn = el && el.querySelector('.cs-run');
  return { kind: cv.dataset.chartState, dots: +cv.dataset.dots, alpha: +cv.dataset.dotAlpha, note: el ? { cls: el.className, role: el.getAttribute('role'), live: el.getAttribute('aria-live'), text: el.querySelector('.cs-msg').textContent, btn: btn ? btn.textContent : null, vis: el.getBoundingClientRect().width > 0 } : null,
    barStale: document.getElementById('win-sweep') ? document.getElementById('win-sweep').classList.contains('stale') : null,
    lv: (lv => lv ? { role: lv.getAttribute('role'), live: lv.getAttribute('aria-live'), text: lv.textContent, n: cv.parentElement.querySelectorAll(':scope > .cs-live').length, same: lv.__mark === 1, banner: !!el && !el.hasAttribute('role') && !el.hasAttribute('aria-live') } : null)(cv.parentElement.querySelector(':scope > .cs-live')) };
}, id);
// the starter sweep fills the chart 1.2 s after a fresh load (app/95-keep-safe.js); hold it back here (test only) so the no-sweep state stays to be read
const holdStarter = `(() => { const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (ms === 1200 && typeof fn === 'function' && /runSweep/.test(String(fn))) { window.__starterHeld = true; return 0; } return st.call(window, fn, ms, ...a); }; })();`;
const axeStage = async (p, tag) => {
  if (!axeSrc) { check(`${tag}: axe-core is installed (npm ci) for the axe check`, false); return; }
  if (!(await p.evaluate(() => typeof axe !== 'undefined'))) await p.addScriptTag({ content: axeSrc });
  const v = await p.evaluate(async () => (await axe.run(document.getElementById('s-track'), { resultTypes: ['violations'] })).violations.filter(x => ['critical', 'serious'].includes(x.impact)).map(x => `${x.id} ×${x.nodes.length}: ${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')}`));
  check(`${tag}: axe finds nothing critical or serious on the Analysis stage`, v.length === 0, v.join('; '));
};

// UIE-13 (UI Designer SHOULD 1, QA SHOULD 2 on #551): the no-sweep arrow is visible end to end: both its ends, and every point along it,
// lie outside the note's box (canvas px, data-arrow 'x0,y0,x1,y1')
const arrowClear = (p, id) => p.evaluate(id => {
  const cv = document.getElementById(id), el = cv.parentElement.querySelector(':scope > .chartstate'), a = (cv.dataset.arrow || '').split(',').map(Number);
  if (!el || a.length !== 4 || a.some(v => !Number.isFinite(v))) return { ok: false, why: 'no note or no arrow', arrow: cv.dataset.arrow };
  const c = cv.getBoundingClientRect(), n = el.getBoundingClientRect(), L = n.left - c.left, R = n.right - c.left, T = n.top - c.top, B = n.bottom - c.top;
  const inside = (x, y) => x > L && x < R && y > T && y < B;
  let along = false; for (let i = 0; i <= 50; i++) if (inside(a[0] + (a[2] - a[0]) * i / 50, a[1] + (a[3] - a[1]) * i / 50)) along = true;
  return { ok: !inside(a[0], a[1]) && !inside(a[2], a[3]) && !along, ends: !inside(a[0], a[1]) && !inside(a[2], a[3]), along, arrow: a, note: [L, T, R, B].map(Math.round), canvas: [Math.round(c.width), Math.round(c.height)] };
}, id);
try {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('the old empty-chart words (\'Run a sweep (in the Sweep section above)\') appear nowhere in the page', !html.includes('in the Sweep section above') && !html.includes("'Run a sweep to fill this chart.'"));
  check('every chart.state word is plain text in strings.js', Object.keys(T.TEXT).filter(k => k.startsWith('chart.state.')).length >= 8);

  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); await ctx.addInitScript(holdStarter);
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  await p.goto(srv.url, { waitUntil: 'load' }); await p.waitForFunction(() => window.__dbg && window.__dbg.res, null, { timeout: 15000 }); await p.waitForTimeout(1800);
  check('fresh load: the starter sweep was held back, so the chart has no rows', await p.evaluate(() => window.__starterHeld === true && __dbg.rows.length === 0));
  // QA SHOULD 1 on #551 (UIE-13): each chart has one empty polite live region from page load; the test marks it to see it is the same one later
  const lv0 = await p.evaluate(() => ['tradeCanvas', 'c3Canvas'].map(id => { const cv = document.getElementById(id), l = cv && cv.parentElement.querySelector(':scope > .cs-live'); if (l) l.__mark = 1;
    return l ? { id, role: l.getAttribute('role'), live: l.getAttribute('aria-live'), text: l.textContent, n: cv.parentElement.querySelectorAll('[role="status"], [aria-live]').length } : { id, missing: true }; }));
  check('page load: each chart (2D, 3D) has one role=status, aria-live=polite element, empty', lv0.every(x => !x.missing && x.role === 'status' && x.live === 'polite' && x.text === '' && x.n === 1), JSON.stringify(lv0));
  await p.evaluate(() => { const a = document.getElementById('autoRerun'); if (a && a.checked) { a.checked = false; a.dispatchEvent(new Event('change', { bubbles: true })); } });
  await p.evaluate(() => { const e = document.querySelector('#shellNav [data-go="analysis"]'); if (e) e.click(); }); await p.waitForTimeout(600);
  await p.evaluate(() => { const e = document.querySelector('.tdim2 [data-v="trade"]'); if (e) e.click(); }); await p.waitForTimeout(300);

  // 1. no sweep yet (2D)
  let s = await st(p, 'tradeCanvas');
  check('no sweep: the 2D chart is in its no-sweep state', s.kind === 'no-sweep', JSON.stringify(s));
  check('no sweep: your bridge is the one dot', s.dots === 1, JSON.stringify(s));
  check('no sweep: the words point to Run sweep (chart.state.noSweep)', !!s.note && s.note.vis && s.note.text === T.t('chart.state.noSweep'), JSON.stringify(s.note));
  check('no sweep: a Go to Run sweep button (the arrow\'s text twin)', !!s.note && s.note.btn === T.t('chart.state.goRun'), JSON.stringify(s.note));
  check('no sweep: the note is not a live region and the chart\'s live region stays empty', !!s.lv && s.lv.banner && s.lv.text === '' && s.lv.same, JSON.stringify(s.lv));
  let ac = await arrowClear(p, 'tradeCanvas');
  check('no sweep 1366x900: the arrow\'s two ends and its whole line are outside the note\'s box', ac.ok, JSON.stringify(ac));
  check('no sweep: the 2D chart is not blank: its axes and the dot are drawn', await p.evaluate(() => { const c = document.getElementById('tradeCanvas'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < x.length; i += 4) if (x[i] > 0) n++; return n > 500; }));
  await p.evaluate(() => document.querySelector('#tradeCanvas ~ .chartstate .cs-run').click()); await p.waitForTimeout(200);
  check('no sweep: the button takes focus to the bar\'s Run sweep', await p.evaluate(() => { const a = document.activeElement; return !!a && (a.id === 'runSweep' || a.dataset.ic === 'run'); }), await p.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.outerHTML.slice(0, 80))));
  await axeStage(p, 'no sweep 2D');
  // the note's button is drawn on the paper, not as a wood stick (ART-P2, Graphics MUST on #551): no s-b / dark, its own part, no shadow, no fill
  const look = () => p.evaluate(() => { const b = document.querySelector('#tradeCanvas ~ .chartstate .cs-run'), c = getComputedStyle(b);
    return { th: document.getElementById('stage').dataset.theme, cls: b.className, part: b.dataset.part, img: c.backgroundImage, bg: c.backgroundColor, sh: c.boxShadow, bw: c.borderTopWidth, ink: c.color === c.borderTopColor }; });
  const themes = await p.$$eval('#themeSel option', o => o.map(x => x.value));
  const was = await p.evaluate(() => document.getElementById('themeSel').value);
  for (const id of themes.filter(v => v.startsWith('notebook-calc')).concat([was])) {
    await p.evaluate(id => { const s = document.getElementById('themeSel'); s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); }, id); await p.waitForTimeout(250);
    const L = await look();
    check(`no sweep (${L.th}): Go to Run sweep is an ink outline on the paper, not a wood stick`, L.th === id && !/\bs-b\b|\bdark\b|\bbtn\b/.test(L.cls) && L.part === 'note-button' && L.img === 'none' && L.sh === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(L.bg) && L.bw === '2px' && L.ink, JSON.stringify(L));
  }
  await p.evaluate(() => { const e = document.querySelector('.tdim2 [data-v="c3"]'); if (e) e.click(); }); await p.waitForTimeout(400);
  s = await st(p, 'c3Canvas');
  check('3D no sweep: the words and the button point to Run sweep (chart.state.noSweep3d)', s.kind === 'no-sweep' && !!s.note && s.note.vis && s.note.text === T.t('chart.state.noSweep3d') && s.note.btn === T.t('chart.state.goRun'), JSON.stringify(s));
  ac = await arrowClear(p, 'c3Canvas');
  check('3D no sweep 1366x900: the arrow\'s two ends and its whole line are outside the note\'s box', ac.ok, JSON.stringify(ac));
  // the smallest stage (512x384, QA's size): the arrow still clear of the note, in 3D and 2D
  await p.setViewportSize({ width: 512, height: 384 }); await p.waitForTimeout(700);
  ac = await arrowClear(p, 'c3Canvas');
  check('3D no sweep 512x384: the arrow is clear of the note', ac.ok, JSON.stringify(ac));
  await p.evaluate(() => { const e = document.querySelector('.tdim2 [data-v="trade"]'); if (e) e.click(); }); await p.waitForTimeout(400);
  ac = await arrowClear(p, 'tradeCanvas');
  check('no sweep 512x384: the arrow is clear of the note', ac.ok, JSON.stringify(ac));
  await p.setViewportSize({ width: 1366, height: 900 }); await p.waitForTimeout(500);
  await p.evaluate(() => { const e = document.querySelector('.tdim2 [data-v="c3"]'); if (e) e.click(); }); await p.waitForTimeout(400);
  await axeStage(p, 'no sweep 3D');
  await p.evaluate(() => { const e = document.querySelector('.tdim2 [data-v="trade"]'); if (e) e.click(); }); await p.waitForTimeout(300);

  // 2. after a sweep: dots, no banner; focus on the note's button does not fall to the page when the note goes (WCAG 2.4.3, QA MUST on #551)
  const focusOk = () => p.evaluate(() => { const a = document.activeElement; return { ok: !!a && a !== document.body && (a.id === 'runSweep' || a.dataset.ic === 'run'), at: a ? (a.id || a.tagName) : null }; });
  await p.evaluate(() => document.querySelector('#tradeCanvas ~ .chartstate .cs-run').focus());
  await runSweep(p);
  let F = await focusOk();
  check('after a sweep: focus on the note\'s button moved to Run sweep, not to the page', F.ok, JSON.stringify(F));
  s = await st(p, 'tradeCanvas');
  check('after a sweep: the chart is fresh, with many dots and no note or banner', s.kind === 'fresh' && s.dots > 1 && !s.note, JSON.stringify(s));
  check('after a sweep: full-strength dots', s.alpha === 0.7, JSON.stringify(s));
  check('after a sweep: the bar is not striped', s.barStale === false);

  // 3. change an input: out of date
  await bumpBook(p);
  s = await st(p, 'tradeCanvas');
  check('out of date: the 2D chart is in its stale state', s.kind === 'stale', JSON.stringify(s));
  check('out of date: the dots are faded', s.alpha > 0 && s.alpha < 0.7, JSON.stringify(s));
  check('out of date: the banner names what changed (the book length)', !!s.note && s.note.text === T.t('chart.state.stale').replace('{what}', T.t('chart.state.whatBookLen')), JSON.stringify(s.note));
  check('out of date: the chart\'s live region from page load (the same element) carries the banner\'s words; the banner itself is no live region', !!s.note && !!s.lv && s.lv.same && s.lv.n === 1 && s.lv.role === 'status' && s.lv.live === 'polite' && s.lv.text === s.note.text && s.lv.banner, JSON.stringify(s.lv));
  check('out of date: the banner offers Run sweep', !!s.note && s.note.btn === T.t('chart.state.goRun'), JSON.stringify(s.note));
  check('out of date: the bar is striped (UI-S5)', s.barStale === true);
  await p.evaluate(() => document.querySelector('#tradeCanvas ~ .chartstate .cs-run').click()); await p.waitForTimeout(200);
  check('out of date: the banner\'s button takes focus to Run sweep', await p.evaluate(() => { const a = document.activeElement; return !!a && (a.id === 'runSweep' || a.dataset.ic === 'run'); }));
  await axeStage(p, 'out of date 2D');

  // 4. run again: cleared; focus on the banner's button moves to Run sweep when the banner goes
  await p.evaluate(() => document.querySelector('#tradeCanvas ~ .chartstate .cs-run').focus());
  await runSweep(p);
  F = await focusOk();
  check('run again: focus on the banner\'s button moved to Run sweep, not to the page', F.ok, JSON.stringify(F));
  s = await st(p, 'tradeCanvas');
  check('run again: the banner is gone and the dots are full strength', s.kind === 'fresh' && !s.note && s.alpha === 0.7, JSON.stringify(s));
  check('run again: the bar is not striped', s.barStale === false);
  check('run again: the chart\'s live region is empty again, the same element', !!s.lv && s.lv.same && s.lv.text === '' && s.lv.n === 1, JSON.stringify(s.lv));

  // 5. the 3D chart the same, after the switch
  await p.evaluate(() => { const e = document.querySelector('.tdim2 [data-v="c3"]'); if (e) e.click(); }); await p.waitForTimeout(500);
  s = await st(p, 'c3Canvas');
  check('3D: fresh after a sweep, dots and no banner', s.kind === 'fresh' && s.dots > 0 && !s.note, JSON.stringify(s));
  await bumpBook(p);
  s = await st(p, 'c3Canvas');
  check('3D out of date: faded dots and the banner naming the book length', s.kind === 'stale' && s.alpha < 0.8 && !!s.note && s.note.text.includes(T.t('chart.state.whatBookLen')) && !!s.lv && s.lv.same && s.lv.text === s.note.text, JSON.stringify(s));
  await axeStage(p, 'out of date 3D');
  await runSweep(p);
  s = await st(p, 'c3Canvas');
  check('3D run again: cleared', s.kind === 'fresh' && !s.note, JSON.stringify(s));

  // 6. quick look (UIE-12, TE-B-737; UI-S5 'Quick look: the pilot says so'): after a pilot the banner says the chart shows only its {n} random designs
  // and offers the full search through the pilot box's own handler; the full search clears it
  await p.evaluate(() => { const e = document.querySelector('.tdim2 [data-v="trade"]'); if (e) e.click(); }); await p.waitForTimeout(300);
  const idle = () => p.waitForFunction(() => !document.getElementById('runSweep').disabled && document.getElementById('bigCancel').hidden, null, { timeout: 240000 });
  await p.evaluate(() => document.getElementById('bigSearch').click());
  await idle(); await p.waitForTimeout(500);
  s = await st(p, 'tradeCanvas');
  const pilotN = await p.evaluate(() => __dbg.rows.length);
  check('quick look: after a pilot the chart is in its quick-look state', s.kind === 'quick-look', JSON.stringify(s));
  check('quick look: the banner says it shows only the pilot\'s {n} random designs (chart.state.quickLook)', !!s.note && s.note.vis && pilotN > 0 && s.note.text === T.t('chart.state.quickLook').replace('{n}', pilotN.toLocaleString('en-US')), JSON.stringify(s.note));
  check('quick look: the chart\'s one live region (from page load) carries the banner\'s words', !!s.note && !!s.lv && s.lv.same && s.lv.n === 1 && s.lv.role === 'status' && s.lv.live === 'polite' && s.lv.text === s.note.text && s.lv.banner, JSON.stringify(s.lv));
  check('quick look: the dots are full strength (a quick look is not out of date)', s.alpha === 0.7, JSON.stringify(s));
  check('quick look: the banner offers the full search (chart.state.goFull)', !!s.note && s.note.btn === T.t('chart.state.goFull'), JSON.stringify(s.note));
  // the same handler as the pilot box's 'Looks right: run the full search…' (#bigFull): both open the same full-search dialog with the same words
  // (the handler sits inside the app's closure, so the test compares what each button does rather than wrapping the function)
  const modal = () => p.evaluate(() => { const m = document.getElementById('bigModal'); return { open: !m.hidden, text: document.getElementById('bigModalText').textContent }; });
  await p.evaluate(() => document.querySelector('#tradeCanvas ~ .chartstate .cs-run').click()); await p.waitForTimeout(200);
  const mChart = await modal();
  check('quick look: the banner\'s button opens the full-search dialog', mChart.open && mChart.text.length > 0, JSON.stringify(mChart).slice(0, 200));
  await p.evaluate(() => document.getElementById('bigNo').click()); await p.waitForTimeout(150);
  const hasBigFull = await p.evaluate(() => !!document.getElementById('bigFull'));
  if (hasBigFull) {
    await p.evaluate(() => document.getElementById('bigFull').click()); await p.waitForTimeout(200);
    const mBox = await modal();
    check('quick look: the pilot box\'s own button opens the very same dialog (one handler, not a copy)', mBox.open && mBox.text === mChart.text, JSON.stringify(mBox).slice(0, 200));
  } else check('quick look: the pilot box\'s own full-search button exists to compare with', false);
  await axeStage(p, 'quick look 2D');
  await p.evaluate(() => document.getElementById('bigGo').click());
  await idle(); await p.waitForTimeout(800);
  s = await st(p, 'tradeCanvas');
  check('after the full search: no banner, the chart is fresh', s.kind === 'fresh' && !s.note, JSON.stringify(s));

  // 7. nothing saved: no new storage key (TE-B-447)
  check('no chart-state storage key', await p.evaluate(() => !Object.keys(localStorage).some(k => /chartstate|chart\.state/i.test(k))));
  check('no page errors', p.errs.length === 0, p.errs.join(' | '));
  await ctx.close();
} finally {
  await b.close(); srv.close();
}
const bad = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - bad.length}/${check.results.length} chart-state checks passed`);
process.exit(bad.length ? 1 : 0);
