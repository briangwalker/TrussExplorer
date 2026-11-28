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

  // SweepState.live() (the UIE-12b seam, TE-B-838 a): while a sweep runs, the rows so far, done and total under kind 'sweep'; at rest, kind 'none'
  const idle = await p.evaluate(() => __dbg.live);
  check('nothing running: live() is kind none with no rows', idle.kind === 'none' && idle.rows.length === 0 && idle.done === 0 && idle.total === 0, JSON.stringify(idle));
  await p.evaluate(() => { window.__liveLog = []; __dbg.onLive(() => { const l = __dbg.live; window.__liveLog.push({ kind: l.kind, done: l.done, total: l.total, rows: l.rows.length }); }); });
  const v1 = await p.evaluate(() => __dbg.sweepVersion);
  await p.click('#runSweep');
  await p.waitForFunction(v => __dbg.sweepVersion > v && !document.getElementById('runSweep').disabled, v1, { timeout: 120000 });
  const log = await p.evaluate(() => window.__liveLog), after = await p.evaluate(() => ({ live: __dbg.live, rows: __dbg.rows.length }));
  const mid = log.filter(x => x.done > 0 && x.done < x.total), last = log[log.length - 1] || {};
  check('while the sweep runs, live() is kind sweep and done only grows', log.length > 1 && log.every(x => x.kind === 'sweep' && x.total > 0) && log.every((x, i) => i === 0 || x.done >= log[i - 1].done), JSON.stringify(log.slice(0, 3)));
  check('the rows so far are readable before the end, never more than done', mid.length > 0 && mid.some(x => x.rows > 0) && mid.every(x => x.rows <= x.done), JSON.stringify(mid.slice(0, 3)));
  check('the last step is the whole run; then live() is kind none again and rows() holds the results', last.done === last.total && after.live.kind === 'none' && after.live.rows.length === 0 && after.rows > 0, JSON.stringify({ last, after }));

  // the full-search dialog gives focus back to the control that opened it (QA TE-B-850; UI-K2 / UI-W13): a pilot, then Esc and Cancel from 'Looks right'
  await p.evaluate(() => document.getElementById('bigSearch').click());
  await p.waitForFunction(() => !document.getElementById('runSweep').disabled && document.getElementById('bigCancel').hidden && document.getElementById('bigFull'), null, { timeout: 240000 });
  await p.waitForTimeout(300);
  const pilotLive = await p.evaluate(() => (window.__liveLog || []).filter(x => x.kind === 'pilot').length);
  check('a pilot reports as kind pilot while it runs', pilotLive > 0, String(pilotLive));
  const focusNow = () => p.evaluate(() => ({ open: !document.getElementById('bigModal').hidden, focus: document.activeElement && document.activeElement.id }));
  await p.evaluate(() => document.getElementById('bigFull').focus()); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const opened = await focusNow();
  check("'Looks right' opens the full-search dialog with focus on Go", opened.open && opened.focus === 'bigGo', JSON.stringify(opened));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  const esc = await focusNow();
  check('Esc closes it and focus is back on the button that opened it', !esc.open && esc.focus === 'bigFull', JSON.stringify(esc));
  await p.evaluate(() => { const b = document.getElementById('bigFull'); b.focus(); b.click(); }); await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('bigNo').click()); await p.waitForTimeout(150);
  const no = await focusNow();
  check('Cancel closes it and focus is back on the opener', !no.open && no.focus === 'bigFull', JSON.stringify(no));
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} sweep-state checks passed`);
process.exit(fails.length ? 1 : 0);
