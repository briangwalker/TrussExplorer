// RMA-18 (TE-B-650b): the normal sweep gives no result for designs the limits refuse (checkGeometry G1-G10, checkResult M2),
// behind TE_FLAGS.limitsBoxes (?limits=1) only. A refused design stays in the rows with passes: false and noResult: its first
// rule, so it never passes and never reaches the top 30; the sweep message counts 'no result (break the limits)' on its own (UI-I10).
// Without the flag nothing changes: the same rows, no noResult field, the same message text.
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
  check('no script errors', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - bad.length}/${check.results.length} sweep-limits checks passed`);
process.exit(bad.length ? 1 : 0);
