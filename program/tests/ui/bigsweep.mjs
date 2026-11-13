// TE-B-379: a sweep of more than about 125,000 designs opens AND its trade chart, curve and 3D chart draw.
// Math.min(...rows) overflowed the call stack there; the app now uses minOf/maxOf loops (10-state.js).
// Builds a 140,000-row .sweep.json from the page's own saved sweep and opens it through the normal Open button.
//   node tests/ui/bigsweep.mjs
import fs from 'fs'; import os from 'os'; import path from 'path';
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';

const N = 140000;
const srv = await serve(undefined, { shell: false });
const b = await browser();
const check = checker('big sweep: ');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bigsweep-'));
try {
  const p = await openPage(b, srv.url, { width: 1400, height: 900 }); await waitRows(p);
  await p.evaluate(() => { const d = document.getElementById('s-sweep'); if (d) d.open = true; });
  await p.click('#runSweep'); await p.waitForFunction(() => (__dbg.rows || []).length > 0 && !document.getElementById('runSweep').disabled && !/Running/.test(document.getElementById('sweepMsg').textContent), null, { timeout: 120000 });
  const dl = p.waitForEvent('download'); await p.click('#dockBtn'); await p.click('#dockMenu [data-click="saveSweepFile"]');
  await p.waitForSelector('#saveModal:not([hidden])'); await p.click('#saveGo');
  const small = path.join(tmp, 'small.sweep.json'); await (await dl).saveAs(small);
  const doc = JSON.parse(fs.readFileSync(small, 'utf8')), base = doc.rows;
  const rows = new Array(N); for (let i = 0; i < N; i++) { const r = Object.assign({}, base[i % base.length]); r.wood = r.wood * (0.8 + 0.4 * (i / N)); if (r.capKg != null) r.capKg = r.capKg * (0.9 + 0.2 * ((i * 7919) % N) / N); r.idx = i; rows[i] = r; }
  doc.rows = rows; const big = path.join(tmp, 'big.sweep.json'); fs.writeFileSync(big, JSON.stringify(doc));
  p.errs.length = 0;
  await p.evaluate(() => document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }));
  await p.evaluate(() => { window.__pickFor = true; }); const fc = p.waitForEvent('filechooser'); await p.evaluate(() => document.getElementById('loadSweepFile').click()); await (await fc).setFiles(big);
  await p.waitForFunction(n => (__dbg.rows || []).length >= n, N, { timeout: 180000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const n = await p.evaluate(() => __dbg.rows.length);
  check(`a ${N.toLocaleString()}-design sweep file opens`, n === N, String(n));
  for (const t of ['trade', 'curve', 'c3']) {
    const e = await p.evaluate(t => { try { __dbg.S.tab = t; __dbg.drawTrackers(); return ''; } catch (err) { return t + ': ' + err.name + ' ' + err.message; } }, t); if (e) p.errs.push(e); await p.waitForTimeout(400);
  }
  check('the trade chart, the curve and the 3D chart draw with no script error (no call-stack overflow)', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
const bad = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - bad.length}/${check.results.length} big-sweep checks passed`);
process.exit(bad.length ? 1 : 0);
