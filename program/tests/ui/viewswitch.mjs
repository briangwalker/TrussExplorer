// #408 (TE-B-314): an open ✎ value editor closes properly on a Truss 2D <-> 3D switch: no editor open, no label left
// marked active (brown), and focus isn't left inside a hidden pop-up (UI-I8, UI-W8).
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';
const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
const state = p => p.evaluate(() => ({ pop: !document.getElementById('dimPop').hidden, act2: document.querySelectorAll('.dimlab.act').length,
  act3: document.querySelectorAll('.d3lab.act').length, focusInPop: !!(document.activeElement && document.activeElement.closest('#dimPop')) }));
const sw = (p, d) => p.evaluate(d => { const x = document.querySelector(`[data-sw="t:${d}"]`); if (x) x.click(); return !!x; }, d);
try {
  const p = await openPage(b, srv.url); await waitRows(p);
  await sw(p, 2); await p.waitForTimeout(300);
  const opened = await p.evaluate(() => { const g = document.querySelector('.dimlab[data-var="height"]') || document.querySelector('.dimlab'); if (!g) return null;
    g.dispatchEvent(new MouseEvent('click', { bubbles: true })); return g.dataset.var; });
  await p.waitForTimeout(300);
  const s0 = await state(p);
  check('2D: clicking a ✎ label opens its value editor and marks it active', !!opened && s0.pop && s0.act2 === 1, JSON.stringify({ opened, ...s0 }));
  check('the 3D switch is in the top bar', await sw(p, 3)); await p.waitForTimeout(500);
  const s1 = await state(p);
  check('#408 after 2D -> 3D: no editor open, no label marked active, focus not in a hidden pop-up', !s1.pop && s1.act2 === 0 && s1.act3 === 0 && !s1.focusInPop, JSON.stringify(s1));
  // and the other way round
  const o3 = await p.evaluate(() => { const g = document.querySelector('.d3lab'); if (!g) return null; g.click(); return g.dataset.var; }); await p.waitForTimeout(300);
  const s2 = await state(p);
  if (o3) check('3D: clicking a 3D label opens its editor', s2.pop && s2.act3 === 1, JSON.stringify(s2));
  await sw(p, 2); await p.waitForTimeout(500);
  const s3 = await state(p);
  check('#408 after 3D -> 2D: no editor open, nothing marked active', !s3.pop && s3.act2 === 0 && s3.act3 === 0, JSON.stringify(s3));
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} view-switch checks passed`);
process.exit(fails.length ? 1 : 0);
