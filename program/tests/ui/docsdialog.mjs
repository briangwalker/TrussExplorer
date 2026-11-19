// #285 (UI-W13): the Build documents dialog takes keyboard focus when it opens, keeps it inside on Tab and Shift+Tab,
// closes on Esc, gets focus back after a download's name pop-up (so Esc still closes it), and gives focus back to ☰.
//   node tests/ui/docsdialog.mjs
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('build documents dialog: ');
const inside = p => p.evaluate(() => document.getElementById('docModal').contains(document.activeElement));
const openIt = async p => { await p.click('#dockBtn'); await p.waitForTimeout(200); await p.click('#dockMenu [data-click="openDocs"]'); await p.waitForSelector('#docModal:not([hidden])'); await p.waitForTimeout(150); };
try {
  for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    const p = await openPage(b, srv.url, vp), tag = ` (${vp.width}x${vp.height})`; await waitRows(p);
    await openIt(p);
    check('focus is inside the dialog when it opens' + tag, await inside(p));
    let out = 0; for (let i = 0; i < 60; i++) { await p.keyboard.press('Tab'); if (!(await inside(p))) out++; }
    for (let i = 0; i < 20; i++) { await p.keyboard.press('Shift+Tab'); if (!(await inside(p))) out++; }
    check('Tab and Shift+Tab stay inside the dialog' + tag, out === 0, `${out} stops outside`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    check('Esc closes it and focus goes back to ☰' + tag, await p.evaluate(() => document.getElementById('docModal').hidden && document.activeElement === document.getElementById('dockBtn')));
    if (vp.width === 1366) {
      await openIt(p);
      await p.focus('#docGo'); await p.keyboard.press('Enter');
      await p.waitForSelector('#saveModal:not([hidden])');
      await p.waitForFunction(() => document.getElementById('saveModal').contains(document.activeElement), null, { timeout: 5000 }).catch(() => {});   // the name pop-up has taken focus
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), p.keyboard.press('Enter')]);
      await p.waitForTimeout(300);
      check('a download works from the keyboard', !!dl && /_build_documents\.html$/.test(dl.suggestedFilename()), dl ? dl.suggestedFilename() : 'no download');
      check('after the name pop-up closes, focus is back on the download button', await p.evaluate(() => !document.getElementById('docModal').hidden && document.activeElement === document.getElementById('docGo')));
      await p.keyboard.press('Escape'); await p.waitForTimeout(150);
      check('and Esc still closes the dialog, focus on ☰', await p.evaluate(() => document.getElementById('docModal').hidden && document.activeElement === document.getElementById('dockBtn')));
      await openIt(p); await p.click('#docNo'); await p.waitForTimeout(150);
      check('the close button gives focus back to ☰ too', await p.evaluate(() => document.getElementById('docModal').hidden && document.activeElement === document.getElementById('dockBtn')));
    }
    check('no script errors' + tag, p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - bad.length}/${check.results.length} Build documents dialog checks passed`);
process.exit(bad.length ? 1 : 0);
