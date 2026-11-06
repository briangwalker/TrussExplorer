// #393: with the computer in dark mode, a light balsaPixel stage (every theme but OG) keeps the light meaning colours, so
// pass/fail and C/T read on its light cards (ART-C1 4.5:1, ART-C4, ART-K14). An OG stage keeps today's behaviour (ART-K15).
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';
import { readFileSync } from 'fs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
const LIGHT = { ok: 'rgb(47, 122, 75)', bad: 'rgb(176, 23, 122)', comp: 'rgb(194, 58, 43)', tens: 'rgb(33, 96, 168)' };
const DARK = { ok: 'rgb(92, 193, 132)', bad: 'rgb(240, 124, 196)' };
const swatches = p => p.evaluate(() => { const st = document.getElementById('stage'), o = {};
  for (const v of ['ok', 'bad', 'comp', 'tens']) { const d = document.createElement('span'); d.style.color = `var(--${v})`; st.appendChild(d); o[v] = getComputedStyle(d).color; d.remove(); } return o; });
// contrast of every coloured text in the results card against the background it sits on
const cardContrast = p => p.evaluate(() => {
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number), lum = c => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const bg = e => { while (e) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > .5)) return c; e = e.parentElement; } return [255, 255, 255]; };
  const out = []; document.querySelectorAll('#resCard *').forEach(e => { if (!e.childNodes.length || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
    const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none') return;
    const a = lum(rgb(s.color)), c = lum(bg(e)), r = (Math.max(a, c) + .05) / (Math.min(a, c) + .05); out.push({ t: e.textContent.trim().slice(0, 20), r: +r.toFixed(2) }); });
  return out; });
const pick = (p, id) => p.evaluate(id => { const s = document.getElementById('themeSel'); s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); }, id);

try {
  const p = await openPage(b, srv.url); await waitRows(p);
  await p.emulateMedia({ colorScheme: 'dark' }); await pick(p, 'wireframe'); await p.waitForTimeout(400);
  const w = await swatches(p);
  check('#393 dark mode, Wireframe: the stage keeps the light meaning colours', Object.keys(LIGHT).every(k => w[k] === LIGHT[k]), JSON.stringify(w));
  const cc = await cardContrast(p), low = cc.filter(x => x.r < 4.5);
  check('#393 dark mode, Wireframe: every text in the results card is 4.5:1 or more (ART-C1)', cc.length > 0 && !low.length, JSON.stringify(low.length ? low : cc.slice(0, 3)));
  const opts = await p.$$eval('#themeSel option', o => o.map(x => x.value).filter(v => v !== 'og' && v !== 'wireframe'));
  for (const t of opts) { await pick(p, t); await p.waitForTimeout(300); const s = await swatches(p);
    check(`#393 dark mode, ${t}: light meaning colours on the stage`, s.ok === LIGHT.ok && s.bad === LIGHT.bad, JSON.stringify(s)); }
  await pick(p, 'og'); await p.waitForTimeout(300); const o = await swatches(p);
  check('#393 dark mode, OG: the stage keeps the page\'s dark-mode colours, as today (ART-K15)', o.ok === DARK.ok && o.bad === DARK.bad, JSON.stringify(o));
  const charts = readFileSync(new URL('../../src/app/70-charts.js', import.meta.url), 'utf8');
  check('#393 the charts read their colours from the stage when there is one', /function cssv\(v\) \{ return getComputedStyle\(document\.getElementById\('stage'\) \|\| document\.documentElement\)/.test(charts));
  await pick(p, 'wireframe'); await p.waitForTimeout(300);
  await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(300); const l = await swatches(p);
  check('light mode: unchanged meaning colours', l.ok === LIGHT.ok && l.bad === LIGHT.bad, JSON.stringify(l));
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} dark-mode checks passed`);
process.exit(fails.length ? 1 : 0);
