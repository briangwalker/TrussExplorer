// Every number in the saved state that has a row on the limits table (limits.js) comes back inside that row's range, however it
// was saved: update() clamps it before anything is computed, drawn or saved again (TE-B-762; the SEC-009 class, Black Hat's scan
// on #552: height 1,000,000 made every later load take 11-14 s). Each field is seeded alone at 1e5, 1e6 and -1e6 in the state an
// earlier visit saved, then the page is reloaded and timed. Also: Trusses under 1 is 1, and 2 only for a non-number (Physics, TE-B-755).
//   node tests/ui/savedclamp.mjs
import { serve, browser, checker } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('savedclamp: ');
const KEY = 'se310-truss-v5';
// [limits-table id, owner in the saved state ('' = top level), key, scale from the saved unit to the table's unit]
const FIELDS = [['height', '', 'height'], ['ratio', '', 'ratio'], ['sideAngle', '', 'sideAngle'], ['deskPanels', '', 'deskPanels'],
  ['overlap', '', 'overlap'], ['supportOffset', '', 'supportOffset'], ['bookLen', '', 'bookLen'], ['bookWidth', '', 'bookWidth'], ['bookThick', '', 'bookThick'],
  ['tableThick', '', 'tableThick'], ['braceDepth', '', 'braceDepth'], ['fricMu', '', 'fricMu'], ['fricK', '', 'fricK'], ['panels', '', 'panels'],
  ['mBook1', 'load', 'mBook1'], ['mBook2', 'load', 'mBook2'], ['nTruss', 'load', 'nTruss'], ['FS', 'mat', 'FS'], ['E', 'mat', 'E'], ['rho', 'mat', 'rho', 1e9],
  ['sigT', 'mat', 'sigT'], ['sigC', 'mat', 'sigC'], ['bS', 'mat', 'b'], ['hS', 'mat', 'h'],
  ['width', 'opts', 'width'], ['deflLimit', 'opts', 'deflLimit'], ['minOverlap', 'opts', 'minOverlap'], ['tilt3d', 'd3', 'tilt'],
  ['docStock', 'doc', 'stock'], ['docKerf', 'doc', 'kerf'], ['docBendN', 'doc', 'bendN'],
  ['bigCap', '', 'bigCap'], ['autoLimit', '', 'autoLimit'], ['refStep', '', 'refStep'], ['woodBudget', '', 'woodBudget'], ['loadTarget', '', 'loadTarget'],
  ['abSteps', '', 'abSteps'], ['abExt', '', 'abExt']];
const SEEDS = [1e5, 1e6, -1e6];

const ready = p => p.waitForFunction(() => window.__dbg && window.__dbg.res, null, { timeout: 20000 });
// the field's value now, in the page and in the state saved again, plus its row's range at the page's current values
const read = (p, f) => p.evaluate(([[id, o, k, sc], KEY]) => {
  const own = s => o ? (s[o] || {}) : s, S = __dbg.S, saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  const v = +own(S)[k] * (sc || 1), sv = +own(saved)[k] * (sc || 1);
  const vals = { height: S.height, tableThick: S.tableThick, bS: S.mat.b, hS: S.mat.h, minOverlap: S.opts.minOverlap, bigCap: S.bigCap };
  const row = TrussLimits.rowFor(id); let lo = TrussLimits.bound(row.min, vals), hi = TrussLimits.bound(row.max, vals);
  if (lo !== null && hi !== null && hi < lo) hi = null;
  return { v, sv, lo, hi, wood: __dbg.res && __dbg.res.wood };
}, [f, KEY]);
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

try {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  await p.goto(srv.url, { waitUntil: 'load' }); await ready(p);
  const clean = await p.evaluate(KEY => localStorage.getItem(KEY), KEY);
  let worst = 0;
  for (const f of FIELDS) {
    const [id, o, k, sc] = f;
    for (const seed of SEEDS) {
      await p.evaluate(([KEY, clean, o, k, val]) => { const s = JSON.parse(clean); const t = o ? (s[o] = s[o] || {}) : s; t[k] = val; localStorage.setItem(KEY, JSON.stringify(s)); }, [KEY, clean, o, k, seed / (sc || 1)]);
      const t0 = Date.now();
      await p.reload({ waitUntil: 'load' }); await ready(p);
      const ms = Date.now() - t0, r = await read(p, f); worst = Math.max(worst, ms);
      const want = seed > 0 ? r.hi : r.lo;   // a seed past the end comes back as that end
      const ok = want !== null && near(r.v, want) && near(r.sv, want) && ms < 3000 && Number.isFinite(r.wood);
      check(`saved ${id} ${seed} comes back as ${want}, in the page and saved again, in under 3 s`, ok, JSON.stringify(r) + ` ${ms} ms`);
    }
  }
  console.log(`slowest load ${worst} ms`);
  // Trusses: any number under 1 is 1; a value that isn't a number is 2 (Physics' SHOULD on #552, TE-B-755)
  for (const [val, want] of [[0, 1], [0.4, 1], [0.5, 1], [-5, 1], ['abc', 2], [null, 2], ['', 2], [2.6, 3]]) {
    await p.evaluate(([KEY, clean, val]) => { const s = JSON.parse(clean); s.load.nTruss = val; localStorage.setItem(KEY, JSON.stringify(s)); }, [KEY, clean, val]);
    await p.reload({ waitUntil: 'load' }); await ready(p);
    const n = await p.evaluate(() => __dbg.S.load.nTruss);
    check(`saved Trusses ${JSON.stringify(val)} loads as ${want}`, n === want, String(n));
  }
  // an in-range saved state is not changed at all
  await p.evaluate(([KEY, clean]) => localStorage.setItem(KEY, clean), [KEY, clean]);
  await p.reload({ waitUntil: 'load' }); await ready(p);
  const same = await p.evaluate(([KEY, clean]) => { const a = JSON.parse(clean), b = JSON.parse(localStorage.getItem(KEY));
    return ['height', 'ratio', 'overlap', 'bookLen', 'tableThick', 'braceDepth'].every(k => a[k] === b[k]) && JSON.stringify(a.mat) === JSON.stringify(b.mat) && JSON.stringify(a.load) === JSON.stringify(b.load); }, [KEY, clean]);
  check('a saved state inside the table comes back unchanged', same);
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await ctx.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} savedclamp checks passed`);
process.exit(fails.length ? 1 : 0);
