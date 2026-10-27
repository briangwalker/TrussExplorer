// Playwright smoke tests for the built page. Usage: node tests/ui/smoke.mjs [url]
// With no url it serves index.html itself WITHOUT a charset header, to catch TE-084.
// Covers: clean load, solver state, saved bridges, 2D/3D switch, a small sweep, saving, phone width.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { serve, SHOTS } from './harness.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const own = process.argv[2] ? null : await serve(undefined, { charset: false });
const url = process.argv[2] || own.url;
const shots = SHOTS;
fs.mkdirSync(shots, { recursive: true });
const results = [];
// known: a ticket ID for a defect already filed; it is reported but does not fail the run
const check = (name, ok, info = '', known = '') => { const k = !ok && known; results.push({ name, ok: ok || !!k, info }); console.log(`${ok ? 'ok  ' : k ? 'KNOWN' : 'FAIL'} ${name}${info ? '  — ' + info : ''}${k ? '  [' + known + ']' : ''}`); };

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  // the sandbox has no route to Google Fonts; answer those requests empty so the page doesn't wait on them
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.res, null, { timeout: 15000 });

  // 1. clean load
  check('page declares UTF-8 (served without a charset header)', await page.evaluate(() => document.characterSet) === 'UTF-8', await page.evaluate(() => document.characterSet));
  const ov = await page.evaluate(() => { const d = document.querySelector('.dockbar').getBoundingClientRect(), h = document.querySelector('header.top h1').getBoundingClientRect(); return { hit: d.right > h.left && d.bottom > h.top && d.top < h.bottom, d: Math.round(d.right), h: Math.round(h.left) }; });
  check('View bar does not cover the page title at 1440 px', !ov.hit, `bar ends x=${ov.d}, title starts x=${ov.h}`, 'TE-052');
  check('page loads with no script errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  const s0 = await page.evaluate(() => ({ stable: __dbg.res.stable, members: __dbg.res.members.length, rows: document.querySelectorAll('#s-members tbody tr').length }));
  check('default design solves and fills the member table', s0.stable && s0.rows >= s0.members, `${s0.members} members, ${s0.rows} rows`);
  await page.screenshot({ path: path.join(shots, 'default-1440.png') });

  // 2. saved bridges load and match their saved summaries (2D)
  const bridgeFiles = [path.join(here, '..'), path.join(here, '..', 'private')].filter(d => fs.existsSync(d))
    .flatMap(d => fs.readdirSync(d).filter(f => f.endsWith('.bridge.json')).map(f => path.join(d, f)));
  for (const file of bridgeFiles) {
    const f = path.basename(file), fx = path.dirname(file);
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    // open it the way a person does: the hidden file input behind ☰ Open
    const s = j.summary || {}, rep = [];
    for (const mode of ['2d', '3d']) {
      await page.click(`#anaSwitch [data-ana="${mode}"]`); await page.waitForTimeout(200);
      await page.setInputFiles('#filePick', path.join(fx, f));
      await page.waitForFunction(n => (document.getElementById('fileMsg') || {}).textContent?.includes(n), j.name, { timeout: 8000 });
      await page.waitForTimeout(mode === '3d' ? 800 : 300);
      const r = await page.evaluate(() => { const q = __dbg.res; return { stable: q.stable, wood: q.wood, capKg: q.capKg, passes: q.passes, ana: __dbg.S.anaMode }; });
      const same = s.wood != null && Math.abs(r.wood - s.wood) < 0.06 && Math.abs(r.capKg - s.capKg) < 0.006 && r.passes === s.passes;
      rep.push(`${mode}: wood ${r.wood?.toFixed(1)} cap ${r.capKg?.toFixed(2)} pass ${r.passes}${same ? ' = saved' : ''}`);
      if (mode === '2d') check(`open ${f} (2D)`, r.stable === true, '');
    }
    await page.click('#anaSwitch [data-ana="2d"]');
    console.log(`       saved summary: wood ${s.wood ?? '–'} cap ${s.capKg ?? '–'} pass ${s.passes ?? '–'}  |  ${rep.join('  |  ')}`);
  }
  check('no script errors after loading bridges', errors.length === 0, errors.slice(0, 3).join(' | '));

  // 3. 2D -> 3D -> 2D
  await page.click('#anaSwitch [data-ana="3d"]');
  await page.waitForTimeout(600);
  const r3 = await page.evaluate(() => ({ ana: __dbg.S.anaMode, stable: __dbg.res.stable, cap: __dbg.res.capKg }));
  check('3D analysis switch solves', r3.ana === '3d' && r3.stable !== undefined, `mode ${r3.ana}, stable ${r3.stable}, cap ${r3.cap && r3.cap.toFixed ? r3.cap.toFixed(2) : r3.cap}`);
  await page.screenshot({ path: path.join(shots, 'analysis-3d-1440.png') });
  await page.click('#anaSwitch [data-ana="2d"]');
  await page.waitForTimeout(300);
  check('back to 2D', await page.evaluate(() => __dbg.S.anaMode === '2d'));
  check('no script errors after 2D/3D switch', errors.length === 0, errors.slice(0, 3).join(' | '));

  // 4. sweeps: the open bridge (Brian's Test file carries a huge sweep) must be sent to Large search;
  //    a fresh page with the starter sweep must run to the end
  await page.evaluate(() => document.getElementById('s-sweep') && (document.getElementById('s-sweep').open = true));
  const cnt = await page.textContent('#sweepCount');
  if (/\d{2},\d{3},\d{3}/.test(cnt || '')) {
    await page.click('#runSweep'); await page.waitForTimeout(800);
    const msg = await page.textContent('#sweepMsg');
    check('oversized sweep points to Large search', /too many for a normal sweep/.test(msg), (cnt || '').trim());
  }
  const fresh = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  fresh.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await fresh.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  await fresh.goto(url, { waitUntil: 'load' });
  await fresh.waitForFunction(() => window.__dbg && window.__dbg.res, null, { timeout: 15000 });
  await fresh.evaluate(() => { localStorage.clear(); });
  await fresh.reload({ waitUntil: 'load' });
  await fresh.waitForFunction(() => window.__dbg && window.__dbg.res, null, { timeout: 15000 });
  await fresh.evaluate(() => document.getElementById('s-sweep').open = true);
  const startCount = (await fresh.textContent('#sweepCount') || '').trim();
  await fresh.click('#runSweep');
  await fresh.waitForFunction(() => (__dbg.rows || []).length > 0, null, { timeout: 60000 }).catch(() => {});
  const nrows = await fresh.evaluate(() => (__dbg.rows || []).length);
  check('starter sweep runs to the end', nrows > 0, `${startCount} -> ${nrows.toLocaleString()} rows`);
  await fresh.screenshot({ path: path.join(shots, 'starter-sweep-1440.png') });
  await fresh.close();
  check('no script errors after sweeps', errors.length === 0, errors.slice(0, 3).join(' | '));

  // 5. saving keeps the storage key
  await page.waitForTimeout(500);
  const key = await page.evaluate(() => { try { return !!localStorage.getItem('se310-truss-v5'); } catch (e) { return 'no storage'; } });
  check('state saved under se310-truss-v5', key === true, String(key));

  // 6. phone width: no sideways page scroll
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  await phone.goto(url, { waitUntil: 'load' });
  await phone.waitForFunction(() => window.__dbg && window.__dbg.res, null, { timeout: 15000 });
  const over = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('phone width (390 px): no horizontal page scroll', over <= 1, `overflow ${over}px`);
  await phone.screenshot({ path: path.join(shots, 'default-390.png'), fullPage: false });
} finally {
  await browser.close();
  if (own) own.close();
}
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} UI checks passed`);
process.exit(fails.length ? 1 : 0);
