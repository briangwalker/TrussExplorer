// #236 (Math Consultant, 2026-10-28): profile opening the trade-off charts (balsaPixel layout, starter sweep).
import path from 'path';
import { fileURLToPath } from 'url';
// Run from the repo root after building the page:  node docs/math/reference/chart-open/<this file>.mjs [app dir]
const APP = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../truss-explorer-src-v58/truss-explorer');
const H = await import(path.join(APP, 'tests/ui/harness.mjs'));
const srv = await H.serve(path.join(APP, 'index.html'), { shell: true });
const b = await H.browser(), p = await H.openPage(b, srv.url);
await H.waitRows(p, 120000);
let last = -1; for (let i = 0; i < 120; i++) { const n = await p.evaluate(() => (__dbg.rows || []).length); if (n === last && n > 1000) break; last = n; await p.waitForTimeout(1000); }
console.log('rows', last, 'passing', await p.evaluate(() => __dbg.rows.filter(r => r.passes).length));
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
const settle = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))));
async function measure(label, sel) {
  await p.evaluate(() => { const b = document.querySelector('[data-sw="t:2"]'); if (b) b.click(); }); await p.waitForTimeout(800);   // back to Truss first
  await cdp.send('Profiler.start');
  const t0 = await p.evaluate(() => performance.now());
  await p.evaluate(s => { const b = document.querySelector(s); if (!b) throw new Error('no ' + s); b.click(); }, sel);
  const t1 = await settle();
  // wait for any timer-driven follow-up work, then settle again
  await p.waitForTimeout(1500); const t2 = await settle();
  const { profile } = await cdp.send('Profiler.stop');
  // self time per function, and inclusive time for the top-level suspects
  const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map(), parent = new Map();
  profile.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
  const dt = profile.timeDeltas, total = dt.reduce((a, x) => a + x, 0) / 1000; const incl = new Map();
  profile.samples.forEach((id, i) => { const ms = dt[i] / 1000, n = byId.get(id), k = (n.callFrame.functionName || '(anon)') + ':' + (n.callFrame.lineNumber + 1);
    self.set(k, (self.get(k) || 0) + ms);
    const seen = new Set(); for (let q = id; q != null; q = parent.get(q)) { const f = byId.get(q).callFrame.functionName || '(anon)'; if (!seen.has(f)) { seen.add(f); incl.set(f, (incl.get(f) || 0) + ms); } } });
  console.log(`\n== ${label}: click -> first painted frame ${(t1 - t0).toFixed(0)} ms (profile window ${total.toFixed(0)} ms)`);
  console.log('  top self time:'); [...self].filter(([k]) => !/^\(idle|\(program|\(root/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log(`    ${v.toFixed(0).padStart(6)} ms  ${k}`));
  console.log('  inclusive:', ['drawTrackers', 'drawTrade', 'draw3', 'paintSheet', 'queueSweepSave', 'renderBest', 'frontier', 'groupsOf', 'cssv', 'legendHTML', 'paintTabs', 'renderHistory', 'drawCurve', 'setupCanvas', 'getComputedStyle', '(garbage collector)'].map(f => `${f} ${(incl.get(f) || 0).toFixed(0)}`).join(' | '));
}
await measure('Analysis 2D (trade-off)', '[data-sw="a:2"]');
await measure('Analysis 3D (c3)', '[data-sw="a:3"]');
await measure('Analysis 2D again', '[data-sw="a:2"]');
await b.close(); srv.close();
