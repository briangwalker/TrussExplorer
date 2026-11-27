// RMA-18 (TE-B-650b): the normal sweep gives no result for designs the limits refuse (checkGeometry G1-G10, checkResult M2),
// behind TE_FLAGS.limitsBoxes (?limits=1) only. A refused design stays in the rows with passes: false and noResult: its first
// rule, so it never passes and never reaches the top 30; the sweep message counts 'no result (break the limits)' on its own (UI-I10).
// Without the flag nothing changes: the same rows, no noResult field, the same message text.
// RMA-21 (TE-B-705): the Analysis charts and 'Best for' leave refused designs out, and their tooltips never show a kg.
//   node tests/ui/sweeplimits.mjs
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('sweep limits: ');
const errors = [];

// a small sweep that hits G5 (short members), G8 and M2 (E 500: soft wood, low bridges): height 10 to 30 mm, the other ranges as they open
async function setup(p) {
  await p.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('swH0', 10); set('swH1', 30); set('swHs', 10); set('E', 500);
  });
}
async function run(p) {
  await p.evaluate(() => document.getElementById('runSweep').click());
  await p.waitForFunction(() => !document.getElementById('runSweep').disabled && !/Running/.test(document.getElementById('sweepMsg').textContent), null, { timeout: 180000 });
  await p.waitForTimeout(200);
  return p.evaluate(() => ({
    msg: document.getElementById('sweepMsg').textContent,
    rows: (__dbg.rows || []).map(r => ({ idx: r.idx, passes: r.passes, noResult: r.noResult, has: 'noResult' in r, D: r.D, height: r.height, wood: r.wood, util: r.util, capKg: r.capKg })),
  }));
}
const passN = rows => rows.filter(r => r.passes).length;

try {
  // flag off: the sweep as before
  const off = await openPage(b, srv.url, { width: 1400, height: 900 });
  off.on('pageerror', e => errors.push(String(e)));
  await waitRows(off).catch(() => {});
  await setup(off);
  const A = await run(off);
  check('flag off: no row carries a noResult field', A.rows.length > 0 && A.rows.every(r => !r.has), String(A.rows.length));
  check("flag off: the message doesn't mention 'no result'", !/no result/i.test(A.msg), A.msg);
  check('flag off: the message has its usual breakdown, ending with envelope', /Breakdown \(a design can fail several\): overlap [\d,]+, deflection [\d,]+, strength [\d,]+, envelope [\d,]+\.$/.test(A.msg), A.msg);
  await off.close();

  // flag on: the same designs, the refused ones without a result
  const on = await openPage(b, srv.url + '?limits=1', { width: 1400, height: 900 });
  on.on('pageerror', e => errors.push(String(e)));
  await waitRows(on).catch(() => {});
  await setup(on);
  const B = await run(on);
  const byIdx = new Map(A.rows.map(r => [r.idx, r]));
  const flagged = B.rows.filter(r => r.noResult);
  check('flag on: the same stable designs as flag off', B.rows.length === A.rows.length && B.rows.every(r => byIdx.has(r.idx)), `${B.rows.length} vs ${A.rows.length}`);
  check('flag on: the same numbers for every design (wood, D, util, capKg)', B.rows.every(r => { const a = byIdx.get(r.idx); return a && a.wood === r.wood && a.D === r.D && a.util === r.util && a.capKg === r.capKg; }));
  check('flag on: some designs have no result', flagged.length > 0, String(flagged.length));
  check('flag on: each noResult is a rule id (G1-G10 or M2)', flagged.every(r => /^(G([1-9]|10)|M2)$/.test(r.noResult)), [...new Set(flagged.map(r => r.noResult))].join(','));
  check('flag on: the run finds both a geometry rule and M2', flagged.some(r => r.noResult[0] === 'G') && flagged.some(r => r.noResult === 'M2'), [...new Set(flagged.map(r => r.noResult))].join(','));
  check('flag on: no design without a result passes', flagged.every(r => r.passes === false));
  check('flag on: a design passes exactly when it passed before and has a result', B.rows.every(r => r.passes === (byIdx.get(r.idx).passes && !r.noResult)));
  check('flag on: M2 rows have a mid-span deflection more than the height', flagged.filter(r => r.noResult === 'M2').every(r => Math.abs(r.D) > r.height));
  check('flag on: rows with a result have no noResult field (only refused rows get one)', B.rows.filter(r => !r.noResult).every(r => !r.has));
  const top = await on.evaluate(() => (__dbg.rows || []).filter(r => r.passes).sort((x, y) => x.wood - y.wood || x.util - y.util).slice(0, 30).filter(r => r.noResult).length);
  check('flag on: no design without a result in the top 30', top === 0, String(top));
  const n = flagged.length.toLocaleString('en-US');
  check("flag on: the breakdown counts 'no result (break the limits)'", B.msg.includes(`, no result (break the limits) ${n}.`), B.msg);
  // UI-I10 (ui-spec 1.5.13): the first line counts no result on its own, never as a fail, and its four numbers add up to the total
  const first = B.msg.match(/^([\d,]+) of ([\d,]+) pass · ([\d,]+) fail a check · ([\d,]+) no result \(break the limits\) · ([\d,]+) unstable\./);
  const num = x => +String(x).replace(/,/g, '');
  check('flag on: the first line reads pass · fail a check · no result (break the limits) · unstable', !!first, B.msg.slice(0, 160));
  if (first) {
    const [, pN, tot, fN, nN, uN] = first.map(num);
    check('flag on: pass + fail + no result + unstable = total', pN + fN + nN + uN === tot, `${pN}+${fN}+${nN}+${uN} vs ${tot}`);
    check('flag on: the first line\'s no result count is the refused rows', nN === flagged.length, `${nN} vs ${flagged.length}`);
    check('flag on: fail a check leaves the refused rows out', fN === B.rows.length - passN(B.rows) - flagged.length, `${fN}`);
  }
  const firstOff = A.msg.match(/^([\d,]+) of ([\d,]+) pass · ([\d,]+) fail a check · ([\d,]+) unstable\./);
  check('flag off: the first line is as before (pass · fail a check · unstable) and adds up', !!firstOff && num(firstOff[1]) + num(firstOff[3]) + num(firstOff[4]) === num(firstOff[2]), A.msg.slice(0, 160));
  check('flag on: the pass count in the message leaves them out', B.msg.startsWith(`${passN(B.rows).toLocaleString('en-US')} of `) && passN(B.rows) === passN(A.rows) - flagged.filter(r => byIdx.get(r.idx).passes).length, B.msg);
  // 'Most common' names it when it is the biggest count: the same sweep at stick 8 mm, where G5 refuses many more short members
  await on.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }; set('bS', 8); set('hS', 8); });
  const C = await run(on);
  check("flag on: 'Most common' can be 'no result (break the limits)'", /Most common: no result \(break the limits\) \([\d,]+ designs\)\./.test(C.msg), C.msg);
  await on.close();

  // RMA-21 (TE-B-705): the Analysis charts and 'Best for' on the default sweep. With ?limits=1 a refused design is never on the
  // best-trade line, never a 'Best for' pick or a table row, and its tooltip has no kg (UI-I10). Flag off: the same as before.
  const BUDGET = 3000, TARGET = 3;
  async function charts(url) {
    const p = await openPage(b, url, { width: 1400, height: 900 });
    p.on('pageerror', e => errors.push(String(e)));
    await waitRows(p).catch(() => {});
    await run(p);
    await p.click('#shellNav [data-go="analysis"]'); await p.waitForTimeout(800);
    await p.evaluate(([bu, ta]) => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }; set('woodBudget', bu); set('loadTarget', ta); __dbg.drawTrackers(); }, [BUDGET, TARGET]);
    await p.waitForTimeout(300);
    // every tooltip the chart can show: move the pointer over the whole canvas, 5 px apart
    const tips = id => p.evaluate(id => { const c = document.getElementById(id), r = c.getBoundingClientRect(), tip = document.getElementById(id === 'tradeCanvas' ? 'tradeTip' : 'c3Tip'), out = new Set();
      for (let y = r.top + 2; y < r.bottom; y += 5) for (let x = r.left + 2; x < r.right; x += 5) { c.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true })); if (!tip.hidden) out.add(tip.textContent); }
      return [...out]; }, id);
    // the rows, the saved best-trade line, the table and 'Best for' are read in one step, so they come from the same sweep
    const out = await p.evaluate(() => {
      const ctx = __dbg.ctx, S = __dbg.S;
      try { localStorage.removeItem('se310-truss-saved'); } catch (e) {}
      document.getElementById('saveSweep').click();
      const front = (JSON.parse(localStorage.getItem('se310-truss-saved') || '[]').pop() || { trade: [] }).trade.map(q => [q.wood, q.capKg]);
      return { version: __dbg.sweepVersion, front, rows: __dbg.rows.map(r => ({ wood: r.wood, capKg: r.capKg, D: r.D, passes: r.passes, noResult: r.noResult, envOK: r.envOK, edgeOK: r.edgeOK, slipOK: r.slipOK, bookKg: r.bookKg })),
        defl: ctx.defl, FS: ctx.FS, bookKg: ctx.bookKg, deflLimit: S.opts.deflLimit,
        best: [...document.querySelectorAll('#bestOut > div')].map(d => d.textContent), tbl: [...document.querySelectorAll('#frontTbl tbody tr')].map(tr => [...tr.cells].map(c => c.textContent)) };
    });
    out.tips = await tips('tradeCanvas');
    await p.click('#shellNav [data-sw="a:3"]'); await p.waitForTimeout(800);
    await p.evaluate(() => { __dbg.S.c3.fails = true; document.getElementById('c3Fails').checked = true; __dbg.drawTrackers(); });
    await p.waitForTimeout(300);
    out.c3tips = await tips('c3Canvas');
    out.same = (await p.evaluate(() => __dbg.sweepVersion)) === out.version;   // no new sweep while the tooltips were read
    await p.close();
    return out;
  }
  // Math's recount: the best-trade line and the two picks worked out here from the rows (withRes false: the old rule, every row)
  const okRow = r => r.envOK && r.edgeOK !== false && r.slipOK !== false;
  function recount(o, withRes) {
    const has = r => !withRes || !r.noResult;
    const s = o.rows.filter(r => has(r) && Number.isFinite(r.capKg) && okRow(r) && (!(r.D > 0) || r.D <= o.defl)).sort((a, c) => a.wood - c.wood || c.capKg - a.capKg);
    const front = []; let top = -Infinity; s.forEach(r => { if (r.capKg > top + 1e-9) { front.push(r); top = r.capKg; } });
    const ok = r => okRow(r) && has(r) && Number.isFinite(r.capKg);
    let strong = null, light = null;
    o.rows.forEach(r => { if (ok(r) && r.passes && r.wood <= BUDGET && (!strong || r.capKg > strong.capKg)) strong = r; });
    o.rows.forEach(r => { if (!ok(r) || r.capKg < TARGET * o.FS - 1e-9) return; if (r.D * TARGET / (r.bookKg != null ? r.bookKg : o.bookKg) > o.deflLimit) return; if (!light || r.wood < light.wood) light = r; });
    const lw = o.rows.filter(r => r.passes && has(r)).sort((a, c) => a.wood - c.wood)[0];
    return { front, strong, light, lw };
  }
  const sameFront = (got, want) => got.length === want.length && got.every((q, i) => q[0] === want[i].wood && q[1] === want[i].capKg);
  const pickText = r => r ? `wood ${r.wood.toFixed(0)} mm · capacity ${r.capKg.toFixed(1)} kg` : 'none in this sweep';
  const F = await charts(srv.url), T = await charts(srv.url + '?limits=1');
  const f0 = recount(F, false), t1 = recount(T, true), t0 = recount(T, false);
  check('RMA-21: no new sweep ran while the charts were read (flag off and on)', F.same && T.same);
  check('RMA-21 flag off: the best-trade line is the one worked out from every row', F.front.length > 0 && sameFront(F.front, f0.front), `${F.front.length} vs ${f0.front.length}`);
  check("RMA-21 flag off: 'Best for' picks the same designs as before", F.best.length === 2 && F.best[0].includes(pickText(f0.strong)) && F.best[1].includes(pickText(f0.light)), F.best.join(' | '));
  check("RMA-21 flag off: every Trade-off tooltip reads capacity and passes or fails, none says 'no result'", F.tips.length > 0 && F.tips.every(t => / capacity [\d.]+ kg · (passes|fails a check)/.test(t) && !/no result/.test(t)), String(F.tips.length));
  check("RMA-21 flag off: no 3D chart tooltip says 'no result'", F.c3tips.length > 0 && F.c3tips.every(t => !/no result/.test(t)), String(F.c3tips.length));
  check('RMA-21 flag on: the default sweep has refused designs', T.rows.some(r => r.noResult), String(T.rows.filter(r => r.noResult).length));
  check('RMA-21 flag on: the best-trade line matches the recount over the designs with a result', T.front.length > 0 && sameFront(T.front, t1.front), `${T.front.length} vs ${t1.front.length}`);
  check('RMA-21 flag on: no best-trade point is a refused design', t1.front.every(r => !r.noResult) && t0.front.some(r => r.noResult), `${t0.front.filter(r => r.noResult).length} of ${t0.front.length} on the old line were refused`);
  check("RMA-21 flag on: neither 'Best for' pick is a refused design, and both match the recount", T.best.length === 2 && T.best[0].includes(pickText(t1.strong)) && T.best[1].includes(pickText(t1.light)) && !(t1.strong && t1.strong.noResult) && !(t1.light && t1.light.noResult), T.best.join(' | '));
  check("RMA-21 flag on: 'Least wood that carries' would have picked a refused design without the change", !!(t0.light && t0.light.noResult), t0.light ? String(t0.light.noResult) : 'none');
  check('RMA-21 flag on: the table\'s lightest passing design has a result', T.tbl.length > 0 && T.tbl[0][2] === (t1.lw ? t1.lw.wood.toFixed(0) : '—'), JSON.stringify(T.tbl[0]));
  const nrT = T.tips.filter(t => /no result/.test(t));
  check("RMA-21 flag on: a refused design's Trade-off tooltip reads 'no result (breaks the limits: <rule>)' with no kg", nrT.length > 0 && nrT.every(t => /no result \(breaks the limits: (G([1-9]|10)|M2)\)/.test(t) && !/kg/.test(t)), `${nrT.length}: ${nrT[0] || ''}`);
  check('RMA-21 flag on: every other Trade-off tooltip is as before', T.tips.filter(t => !/no result/.test(t)).every(t => / capacity [\d.]+ kg · (passes|fails a check)/.test(t)));
  const nr3 = T.c3tips.filter(t => /no result/.test(t));
  check("RMA-21 flag on: a refused design's 3D chart tooltip reads 'no result' and shows no capacity number", nr3.length > 0 && nr3.every(t => /no result \(breaks the limits: (G([1-9]|10)|M2)\)/.test(t) && /capacity \(kg of books\): —/.test(t)), `${nr3.length}: ${nr3[0] || ''}`);
  check('no script errors', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - bad.length}/${check.results.length} sweep-limits checks passed`);
process.exit(bad.length ? 1 : 0);
