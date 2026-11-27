// Trusses (load.nTruss) stays on the limits table, 1 to 4 (limits.js), whatever way it comes in: typed, an opened bridge
// file, or the state an earlier visit saved. update() rounds and clamps it before anything is computed or saved.
//   node tests/ui/ntruss.mjs
import { serve, browser, openPage, checker } from './harness.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('ntruss: ');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'te-ntruss-'));
const file = (name, nTruss) => { const f = path.join(tmp, name); fs.writeFileSync(f, JSON.stringify({ format: 'se310-truss-bridge', version: 1, name, savedAt: new Date().toISOString(), bridge: { name, panels: 4, load: { mBook1: 1.5, mBook2: 1.0, g: 9.81, nTruss } } })); return f; };
const CASES = [[100000, 4], [1e6, 4], [-5, 1], ['abc', 2], [2.6, 3], [3, 3]];
const state = p => p.evaluate(() => ({ n: __dbg.S.load.nTruss, box: document.getElementById('nTruss').value, saved: (JSON.parse(localStorage.getItem('se310-truss-v5') || '{}').load || {}).nTruss }));

try {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  await p.goto(srv.url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__dbg && window.__dbg.res, null, { timeout: 15000 });
  for (const [v, want] of CASES) {
    const t0 = Date.now();
    await p.setInputFiles('#filePick', file(`n${String(v).replace(/\W/g, '_')}.bridge.json`, v));
    await p.waitForFunction(w => __dbg.S.load.nTruss === w, want, { timeout: 5000 }).catch(() => {});
    const r = await state(p), ms = Date.now() - t0;
    check(`file nTruss ${JSON.stringify(v)} opens as ${want} in the app, the box and the saved state, in under 3 s`, r.n === want && +r.box === want && r.saved === want && ms < 3000, JSON.stringify(r) + ` ${ms} ms`);
  }
  // typed
  await p.evaluate(() => { const el = document.getElementById('nTruss'); el.value = '100000'; el.dispatchEvent(new Event('change')); });
  let r = await state(p);
  check('typed 100000 becomes 4', r.n === 4 && r.saved === 4, JSON.stringify(r));
  // saved state from an earlier visit (written before this fix) with a huge count: the next visit loads fast and clamps it
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('se310-truss-v5')); s.load.nTruss = 100000; localStorage.setItem('se310-truss-v5', JSON.stringify(s)); });
  const t0 = Date.now();
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.__dbg && window.__dbg.res, null, { timeout: 15000 });
  r = await state(p);
  check('a saved count of 100000 reloads as 4, in under 3 s', r.n === 4 && r.saved === 4 && Date.now() - t0 < 3000, JSON.stringify(r) + ` ${Date.now() - t0} ms`);
  check('results use the clamped count (wood is finite and small)', await p.evaluate(() => isFinite(__dbg.res.wood) && __dbg.res.wood < 1e5), String(await p.evaluate(() => __dbg.res.wood)));
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await ctx.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} ntruss checks passed`);
process.exit(fails.length ? 1 : 0);
