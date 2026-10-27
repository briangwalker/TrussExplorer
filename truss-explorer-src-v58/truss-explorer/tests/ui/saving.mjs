// Every save path, in every view and full-screen mode (#105, #97, #98).
// Part A: an ordinary web host (no window.claude), where saves are normal browser downloads.
// Part B: claude.ai, simulated with a fake window.claude.use('downloads'): a failed request must not stick,
// a refusal must say so, and a save that may have failed must offer Copy and Try again.
import { serve, browser, openPage, waitRows, checker, SHOTS } from './harness.mjs';
import path from 'path';

const srv = await serve();
const b = await browser();
const check = checker();

// the save pop-up must be the thing on top in the middle of the screen, not hidden behind full screen
const onTop = (p, id) => p.evaluate(id => { const m = document.getElementById(id); if (!m || m.hidden) return false; const c = m.querySelector('.modalcard').getBoundingClientRect(); const e = document.elementFromPoint(c.left + c.width / 2, c.top + 12); return !!e && m.contains(e); }, id);
const openMenu = async p => { if (await p.isHidden('#dockMenu')) await p.click('#dockBtn'); };
const viewBtn = (p, v) => p.click(`#viewSwitch [data-view="${v}"]`);
const leaveFs = async p => { if (await p.isVisible('#dockEsc')) { await p.click('#dockEsc'); await p.waitForTimeout(200); } };

// press a save control, confirm the name pop-up is on top, press Enter, and catch the download
async function saveVia(p, label, press, ext) {
  await press();
  const shown = await p.waitForSelector('#saveModal:not([hidden])', { timeout: 4000 }).then(() => true).catch(() => false);
  const top = shown && await onTop(p, 'saveModal');
  if (!top) { check(`${label}: name pop-up shows on top`, false, shown ? 'shown but covered' : 'never shown'); if (shown) await p.keyboard.press('Escape'); return null; }
  const dl = p.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await p.click('#saveGo');
  const d = await dl;
  await p.evaluate(() => document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }));
  const name = d ? d.suggestedFilename() : '';
  check(`${label}: downloads a ${ext} file`, !!d && name.endsWith(ext), name || 'no download');
  return d;
}

try {
  // ---------- Part A: ordinary web host ----------
  const p = await openPage(b, srv.url); await waitRows(p);
  const bridgeBtn = async () => { await openMenu(p); await p.click('#dockMenu [data-click="saveBridge"]'); };
  const sweepBtn = async () => { await openMenu(p); await p.click('#dockMenu [data-click="saveSweepFile"]'); };

  for (const v of ['inputs', 'both', 'bridge', 'analysis']) {
    await leaveFs(p); await viewBtn(p, v); await p.waitForTimeout(300);
    await saveVia(p, `${v} view, ☰ Save bridge file`, bridgeBtn, '.bridge.json');
    await saveVia(p, `${v} view, ☰ Save sweep file`, sweepBtn, '.sweep.json');
  }
  // the Sweep section's own button (#97), with the section folded and open
  await viewBtn(p, 'both'); await p.waitForTimeout(200);
  await p.evaluate(() => { document.getElementById('s-sweep').open = true; });
  await saveVia(p, 'Sweep section, Save sweep file', () => p.click('#saveSweepFile'), '.sweep.json');

  // every full-screen mode
  for (const fs of ['#inputsPane', '#sideSheet', '#trackBody']) {
    await leaveFs(p); await viewBtn(p, 'both'); await p.waitForTimeout(200);
    await p.evaluate(() => { const t = document.getElementById('s-track'); if (t) t.open = true; });
    const btn = p.locator(`.fsbtn[data-fs="${fs}"]`).first();
    if (!(await btn.isVisible())) { check(`full screen ${fs}: button visible`, false); continue; }
    await btn.click(); await p.waitForTimeout(400);
    await saveVia(p, `full screen ${fs}, ☰ Save bridge file`, bridgeBtn, '.bridge.json');
    await saveVia(p, `full screen ${fs}, ☰ Save sweep file`, sweepBtn, '.sweep.json');
    await p.screenshot({ path: path.join(SHOTS, `save-fs-${fs.slice(1)}.png`) });
  }
  await leaveFs(p);

  // one id per element: two elements sharing an id made the save pop-up and "Save sweep to compare" read each other's name box
  const dups = await p.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach(e => { c[e.id] = (c[e.id] || 0) + 1; }); return Object.keys(c).filter(k => c[k] > 1); });
  check('no two elements share an id', dups.length === 0, dups.join(', '));
  // the name typed in the pop-up is the name the file gets
  await bridgeBtn(); await p.waitForSelector('#saveModal:not([hidden])');
  check('the pop-up shows the suggested name', (await p.inputValue('#saveModal #saveName')) === 'Design_A');
  await p.fill('#saveModal #saveName', 'Typed name'); await p.uncheck('#saveAsDesign');
  { const dl = p.waitForEvent('download', { timeout: 8000 }).catch(() => null); await p.click('#saveGo'); const d = await dl;
    check('a typed file name is used', !!d && d.suggestedFilename() === 'Typed_name.bridge.json' || (!!d && d.suggestedFilename() === 'Typed name.bridge.json'), d ? d.suggestedFilename() : 'no download'); }

  // the other exports
  const d1 = await saveVia(p, 'bridge file content', bridgeBtn, '.bridge.json');
  if (d1) { const fs = await import('fs'); const j = JSON.parse(fs.readFileSync(await d1.path(), 'utf8')); check('saved bridge file reopens as a bridge', j.format === 'se310-truss-bridge' && !!j.bridge); }
  await saveVia(p, '☰ FEA script (.py)', async () => { await openMenu(p); await p.click('#dockMenu [data-click="dlPy"]'); }, '.zip');
  await saveVia(p, '☰ member table CSV', async () => { await openMenu(p); await p.click('#dockMenu [data-click="dlCsv"]'); }, '.csv');
  await saveVia(p, '☰ LP data', async () => { await openMenu(p); await p.click('#dockMenu [data-click="dlLp"]'); }, '.zip');
  await saveVia(p, 'build documents', async () => { await openMenu(p); await p.click('#dockMenu [data-click="openDocs"]'); await p.waitForSelector('#docModal:not([hidden])'); await p.click('#docGo'); }, '.html');
  await p.evaluate(() => { const d = document.getElementById('docModal'); if (d) d.hidden = true; });
  check('Part A: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();

  // ---------- Part B: claude.ai, simulated ----------
  // mode 'flaky': the first request for downloads fails, later ones work. 'declined': the person says no.
  async function claudePage(mode) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(mode => {
      window.__saves = []; let asks = 0;
      window.claude = { use: async name => {
        if (name !== 'downloads') throw new Error('unknown');
        asks++; window.__asks = asks;
        if (mode === 'flaky' && asks === 1) throw Object.assign(new Error('not ready'), { code: 'unavailable' });
        return { save: async ({ filename, data }) => { if (mode === 'declined') throw Object.assign(new Error('no'), { code: 'declined' }); window.__saves.push(filename); } };
      } };
    }, mode);
    const q = await ctx.newPage(); q.errs = []; q.on('pageerror', e => q.errs.push(e.message));
    await q.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
    await q.goto(srv.url); await q.waitForFunction(() => window.__dbg && __dbg.res); await waitRows(q);
    return { q, ctx };
  }
  const nameEnter = async q => { await q.waitForSelector('#saveModal:not([hidden])', { timeout: 4000 }); await q.click('#saveGo'); await q.waitForTimeout(400); };
  const menuSave = async (q, what) => { await q.waitForTimeout(300); if (await q.isHidden('#dockMenu')) await q.click('#dockBtn'); await q.waitForSelector('#dockMenu:not([hidden])'); await q.waitForTimeout(150); await q.click(`#dockMenu [data-click="${what}"]`); };

  {
    const { q, ctx } = await claudePage('flaky');
    await menuSave(q, 'saveBridge'); await nameEnter(q);
    const fb = await q.isVisible('#saveFbModal');
    check('claude.ai, host download fails: says so and offers Copy', fb && await q.isVisible('#saveFbCopy') && await onTop(q, 'saveFbModal'));
    const txt = await q.textContent('#saveFbText');
    check('the message names no button that isn\'t there', !/copy button/i.test(txt), txt.slice(0, 90));
    await q.click('#saveFbRetry'); await q.waitForTimeout(400);
    check('Try again asks the host again and saves', (await q.evaluate(() => window.__saves.length)) === 1 && (await q.evaluate(() => window.__asks)) === 2);
    await menuSave(q, 'saveSweepFile'); await nameEnter(q);
    check('later saves keep working (no stuck failure)', (await q.evaluate(() => window.__saves)).some(f => f.endsWith('.sweep.json')));
    check('no fallback pop-up once saving works', await q.isHidden('#saveFbModal'));
    check('Part B: no script errors', q.errs.length === 0, q.errs.slice(0, 2).join(' | '));
    await q.screenshot({ path: path.join(SHOTS, 'save-claude.png') });
    await ctx.close();
  }
  {
    const { q, ctx } = await claudePage('declined');
    await menuSave(q, 'saveBridge'); await nameEnter(q);
    check('claude.ai, person declines: "Download cancelled", no fallback', /cancelled/i.test(await q.textContent('#toast')) && await q.isHidden('#saveFbModal'));
    await ctx.close();
  }
} finally {
  await b.close(); srv.close();
}
const fails = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} saving checks passed`);
process.exit(fails.length ? 1 : 0);
