// #255 part B in the page: every change to the sweep's results moves SweepState.version (charts key their caches on it).
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';
const srv = await serve();
const b = await browser();
const check = checker();
try {
  const p = await openPage(b, srv.url);
  await waitRows(p);
  const v0 = await p.evaluate(() => __dbg.sweepVersion);
  check('the first sweep sets a version', v0 > 0, String(v0));
  await p.evaluate(() => { const d = document.getElementById('s-sweep'); if (d) d.open = true; });
  await p.click('#runSweep');
  await p.waitForFunction(v => __dbg.sweepVersion > v && !document.getElementById('runSweep').disabled, v0, { timeout: 120000 });
  const r = await p.evaluate(() => ({ v: __dbg.sweepVersion, rows: __dbg.rows.length, same: TrussApp.rows === __dbg.rows }));
  check('running a sweep moves the version and replaces the rows', r.v > v0 && r.rows > 0 && r.same, JSON.stringify(r));
  // Re-check edits the rows in place (D, util, passes): the version must still move, so caches keyed on it rebuild (Dev Lead, #331)
  const before = await p.evaluate(() => __dbg.sweepVersion);
  await p.evaluate(() => { const d = document.getElementById('rcGo'); let e = d; while (e) { if (e.tagName === 'DETAILS') e.open = true; e = e.parentElement; } document.getElementById('rcFS').value = '3'; d.click(); });
  await p.waitForTimeout(300);
  check('Re-check moves the version (rows edited in place)', await p.evaluate(v => __dbg.sweepVersion > v, before));
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} sweep-state checks passed`);
process.exit(fails.length ? 1 : 0);
