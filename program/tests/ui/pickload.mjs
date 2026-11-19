// TE-B-348: picking a design from a sweep (a dot in Analysis, a row in a table) puts EVERY swept input on the bridge,
// width included, and the loaded bridge's results equal the row's. One 3D sweep over height, support distance, tilt
// and width; every row picked; each swept value compared with the bridge state, the input boxes and the 3D model.
//   node tests/ui/pickload.mjs
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('pick loads: ');
try {
  const p = await openPage(b, srv.url, { width: 1400, height: 900 }); await waitRows(p);
  await p.evaluate(() => {
    const S = __dbg.S; S.anaMode = '3d'; S.swOn = {};
    const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    ['H', 'S', 'Y', 'W'].forEach(k => { const c = document.getElementById('swOn' + k); if (c.checked) c.click(); c.click(); S.swOn[k] = true; });
    set('swH0', 50); set('swH1', 70); set('swHs', 20);
    set('swS0', 0); set('swS1', 10); set('swSs', 10); set('swY0', 0); set('swY1', 10); set('swYs', 10); set('swW0', 40); set('swW1', 100); set('swWs', 60);
  });
  await p.evaluate(() => document.getElementById('runSweep').click());
  await p.waitForFunction(() => (__dbg.rows || []).length > 0 && !document.getElementById('runSweep').disabled && !/Running/.test(document.getElementById('sweepMsg').textContent), null, { timeout: 240000 });
  const out = await p.evaluate(() => {
    const rows = __dbg.rows, bad = [], seen = {}, near = (a, b, t = 1e-6) => Math.abs(+a - +b) <= t * Math.max(1, Math.abs(+b));
    const val = { height: () => __dbg.S.height, supportOffset: () => __dbg.S.supportOffset, tilt3: () => __dbg.S.d3.tilt, width3: () => __dbg.S.opts.width };
    const box = { height: 'height', width3: 'width' };
    rows.forEach((r, i) => {
      __dbg.load(r);
      Object.keys(val).forEach(k => {
        if (r[k] == null) return; (seen[k] = seen[k] || new Set()).add(+r[k]);
        if (!near(val[k](), r[k])) bad.push(`row ${i} ${k}: bridge ${val[k]()} vs row ${r[k]}`);
        if (box[k] && !near(document.getElementById(box[k]).value, r[k])) bad.push(`row ${i} ${k}: box ${document.getElementById(box[k]).value} vs row ${r[k]}`);
      });
      if (r.width3 != null && __dbg.m3) { const span = Math.max(...__dbg.m3.nodes.map(n => n[1])) - Math.min(...__dbg.m3.nodes.map(n => n[1])); if (!near(span, r.width3, 1e-3)) bad.push(`row ${i} 3D model width ${span} vs ${r.width3}`); }
      if (!near(__dbg.res.wood, r.wood, 1e-6)) bad.push(`row ${i} wood ${__dbg.res.wood} vs row ${r.wood}`);
      if (r.capKg != null && __dbg.res.capKg != null && !near(__dbg.res.capKg, r.capKg, 1e-6)) bad.push(`row ${i} capacity ${__dbg.res.capKg} vs row ${r.capKg}`);
    });
    return { n: rows.length, seen: Object.fromEntries(Object.entries(seen).map(([k, s]) => [k, [...s].sort((a, b) => a - b)])), bad: bad.slice(0, 6), nbad: bad.length };
  });
  check('the sweep varied all four inputs (two values each)', out.n >= 16 && ['height', 'supportOffset', 'tilt3', 'width3'].every(k => out.seen[k] && out.seen[k].length === 2), JSON.stringify({ n: out.n, seen: out.seen }));
  check('every picked row puts every swept input on the bridge and its boxes, the 3D model has its width, and wood and capacity equal the row', out.nbad === 0, out.nbad + ': ' + out.bad.join(' | '));
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - bad.length}/${check.results.length} pick-loads checks passed`);
process.exit(bad.length ? 1 : 0);
