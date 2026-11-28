// RMA-18 (TE-B-650b): the normal sweep gives no result for designs the limits refuse (checkGeometry G1-G10, checkResult M2),
// behind TE_FLAGS.limitsBoxes (?limits=1) only. A refused design stays in the rows with passes: false and noResult: its first
// rule, so it never passes and never reaches the top 30; the sweep message counts 'no result (break the limits)' on its own (UI-I10).
// Without the flag nothing changes: the same rows, no noResult field, the same message text.
// RMA-19 (TE-B-675, TE-B-717): 'Most common' and the Breakdown are the fails only; no result has its own by-rule sentence; a limits
// check that throws gives noResult 'error' (never a kg); the large search (pilot, 3D pilot stage, full run, the saved result) does the same.
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
    rows: rowsOf(),
  }));
}
// the rows as plain facts (rowsOf is defined in the page by addInitScript)
const ROWS_FN = () => { window.rowsOf = () => (__dbg.rows || []).map(r => ({ idx: r.idx, passes: r.passes, noResult: r.noResult, has: 'noResult' in r, D: r.D, height: r.height, wood: r.wood, util: r.util, capKg: r.capKg, edgeOK: r.edgeOK, envOK: r.envOK })); };
// the large search: the pilot (#bigSearch), then optionally the full run (#bigFull, #bigGo), as the person does it
async function pilot(p) {
  await p.evaluate(() => { const bf = document.getElementById('bigFull'); if (bf) bf.remove(); document.getElementById('bigSearch').click(); });
  await p.waitForSelector('#bigFull', { state: 'attached', timeout: 240000 });
  await p.waitForTimeout(200);
  return p.evaluate(() => ({ box: document.getElementById('bigBox').textContent.replace(/\s+/g, ' '), rows: rowsOf() }));
}
async function full(p) {
  await p.evaluate(() => document.getElementById('bigFull').click()); await p.waitForTimeout(300);
  await p.evaluate(() => { const h = document.getElementById('bigHrs'); h.value = '0'; h.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('bigGo').click());
  await p.waitForFunction(() => /^(Full search:|Cancelled)/.test(document.getElementById('sweepMsg').textContent), null, { timeout: 240000 });
  await p.waitForTimeout(400);
  return p.evaluate(() => ({ msg: document.getElementById('sweepMsg').textContent, rows: rowsOf() }));
}
const num = x => +String(x).replace(/,/g, '');
// the Breakdown's four counts, and the by-rule no-result sentence
const breakdown = msg => { const m = msg.match(/Breakdown \(a design can fail several\): overlap ([\d,]+), deflection ([\d,]+), strength ([\d,]+), envelope ([\d,]+)\./); return m ? { edge: num(m[1]), defl: num(m[2]), strength: num(m[3]), env: num(m[4]) } : null; };
const noResSentence = msg => { const m = msg.match(/ No result \(break the limits\): ([\d,]+), by rule: ((?:[A-Za-z0-9]+ [\d,]+(?:, )?)+)\./); if (!m) return null; const by = {}; m[2].split(', ').forEach(x => { const [k, v] = x.split(' '); by[k] = num(v); }); return { n: num(m[1]), by, order: m[2].split(', ').map(x => x.split(' ')[0]) }; };
const tally = rows => { const by = {}; rows.filter(r => r.noResult).forEach(r => { by[r.noResult] = (by[r.noResult] || 0) + 1; }); return by; };
const passN = rows => rows.filter(r => r.passes).length;

try {
  // flag off: the sweep as before
  const off = await openPage(b, srv.url, { width: 1400, height: 900 });
  off.on('pageerror', e => errors.push(String(e))); await off.addInitScript(ROWS_FN); await off.evaluate(ROWS_FN);
  await waitRows(off).catch(() => {});
  await setup(off);
  const A = await run(off);
  check('flag off: no row carries a noResult field', A.rows.length > 0 && A.rows.every(r => !r.has), String(A.rows.length));
  check("flag off: the message doesn't mention 'no result'", !/no result/i.test(A.msg), A.msg);
  check('flag off: the message has its usual breakdown, ending with envelope', /Breakdown \(a design can fail several\): overlap [\d,]+, deflection [\d,]+, strength [\d,]+, envelope [\d,]+\.$/.test(A.msg), A.msg);
  // flag off, large search: no row carries noResult and nothing says 'no result' (RMA-19 (4))
  const AP = await pilot(off);
  check('flag off: pilot rows carry no noResult field', AP.rows.length > 0 && AP.rows.every(r => !r.has), String(AP.rows.length));
  check("flag off: the pilot box doesn't mention 'no result'", !/no result/i.test(AP.box), AP.box.slice(0, 300));
  check('flag off: the pilot box first line is pass · fail a check · unstable', /[\d,]+ pass · [\d,]+ fail a check · [\d,]+ unstable\./.test(AP.box), AP.box.slice(0, 300));
  const AF = await full(off);
  check('flag off: full-run rows carry no noResult field', AF.rows.length > 0 && AF.rows.every(r => !r.has), String(AF.rows.length));
  check("flag off: the full-run message doesn't mention 'no result'", !/no result/i.test(AF.msg), AF.msg.slice(0, 300));
  await off.close();

  // flag on: the same designs, the refused ones without a result
  const on = await openPage(b, srv.url + '?limits=1', { width: 1400, height: 900 });
  on.on('pageerror', e => errors.push(String(e))); await on.addInitScript(ROWS_FN); await on.evaluate(ROWS_FN);
  const warns = []; on.on('console', m => { if (m.type() === 'warning' && /limits check failed/.test(m.text())) warns.push(m.text()); });
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
  // TE-B-717: the Breakdown and 'Most common' are the fails only; no result has its own sentence, per rule, biggest first
  const bd = breakdown(B.msg), ns = noResSentence(B.msg), dl = await on.evaluate(() => __dbg.S.opts.deflLimit);
  const withRes = B.rows.filter(r => !r.noResult), failN = withRes.filter(r => !r.passes).length;
  check('flag on: the Breakdown lists the four fails only (no no-result count in it)', !!bd && !/Breakdown[^.]*no result/.test(B.msg), B.msg);
  if (bd) {
    const want = { edge: withRes.filter(r => r.edgeOK === false).length, env: withRes.filter(r => !r.envOK).length, defl: withRes.filter(r => r.D > dl).length, strength: withRes.filter(r => r.util > 1).length };
    check('flag on: overlap, deflection, strength and envelope count no refused row', ['edge', 'env', 'defl', 'strength'].every(k => bd[k] === want[k]), JSON.stringify({ bd, want }));
    check('flag on: each fail reason is at most the fail-a-check count', ['edge', 'env', 'defl', 'strength'].every(k => bd[k] <= failN), JSON.stringify(bd) + ' vs ' + failN);
  }
  check("flag on: the message has the no-result sentence 'No result (break the limits): n, by rule: ...'", !!ns, B.msg.slice(-200));
  if (ns) {
    const t = tally(B.rows), sum = Object.values(ns.by).reduce((a, c) => a + c, 0);
    check('flag on: the by-rule counts add up to the no-result count', sum === ns.n && ns.n === flagged.length, `${sum} / ${ns.n} / ${flagged.length}`);
    check('flag on: the by-rule counts are the rows\' first rules', JSON.stringify(Object.keys(t).sort().map(k => [k, t[k]])) === JSON.stringify(Object.keys(ns.by).sort().map(k => [k, ns.by[k]])), JSON.stringify({ t, by: ns.by }));
    check('flag on: the rules are listed biggest first, none at 0', ns.order.every((k, i) => i === 0 || ns.by[ns.order[i - 1]] >= ns.by[k]) && Object.values(ns.by).every(v => v > 0), ns.order.join(','));
  }
  check("flag on: 'Most common' never names no result", !/Most common: no result/i.test(B.msg), B.msg);
  // UI-I10 (ui-spec 1.5.13): the first line counts no result on its own, never as a fail, and its four numbers add up to the total
  const first = B.msg.match(/^([\d,]+) of ([\d,]+) pass · ([\d,]+) fail a check · ([\d,]+) no result \(break the limits\) · ([\d,]+) unstable\./);
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
  // large search, 2D: the pilot samples 1,000 of these designs; each gets the same noResult as in the normal sweep (RMA-19 (1))
  const bIdx = new Map(B.rows.map(r => [String(r.idx), r]));
  const BP = await pilot(on);
  const pFlag = BP.rows.filter(r => r.noResult);
  check('pilot: every row matches the normal sweep (noResult and passes)', BP.rows.length > 0 && BP.rows.every(r => { const q = bIdx.get(String(r.idx)); return q && q.noResult === r.noResult && q.passes === r.passes; }), String(BP.rows.length));
  check('pilot: some rows have no result, and none of them passes', pFlag.length > 0 && pFlag.every(r => r.passes === false), String(pFlag.length));
  const pf = BP.box.match(/([\d,]+) pass · ([\d,]+) fail a check · ([\d,]+) no result \(break the limits\) · ([\d,]+) unstable\./);
  check('pilot box: the first line reads pass · fail a check · no result (break the limits) · unstable', !!pf, BP.box.slice(0, 300));
  if (pf) check('pilot box: the counts match the rows', num(pf[1]) === BP.rows.filter(r => r.passes).length && num(pf[3]) === pFlag.length && num(pf[2]) === BP.rows.length - num(pf[1]) - pFlag.length, pf[0]);
  const pns = noResSentence(BP.box);
  check('pilot box: the no-result sentence adds up to the no-result rows', !!pns && pns.n === pFlag.length && JSON.stringify(tally(BP.rows)) === JSON.stringify(Object.fromEntries(Object.keys(tally(BP.rows)).map(k => [k, pns.by[k]]))), BP.box.slice(0, 400));
  check("pilot box: 'Most common' never names no result", !/Most common: no result/i.test(BP.box));
  check("pilot one-line: counts 'no result (break the limits)'", BP.box.includes(`pass · ${pFlag.length.toLocaleString('en-US')} no result (break the limits) · `), BP.box.slice(0, 600));
  // the full run: every design (2,100 is under the cap), so every stable row is kept and matches the normal sweep
  const BF = await full(on);
  check('full run: every row matches the normal sweep (noResult and passes)', BF.rows.length > 0 && BF.rows.every(r => { const q = bIdx.get(String(r.idx)); return q && q.noResult === r.noResult && q.passes === r.passes; }), String(BF.rows.length));
  check('full run: the refused rows are there, none passes', BF.rows.filter(r => r.noResult).length === flagged.length && BF.rows.filter(r => r.noResult).every(r => !r.passes), String(BF.rows.filter(r => r.noResult).length));
  const ff = BF.msg.match(/^Full search: ([\d,]+) designs .*? · ([\d,]+) pass · ([\d,]+) fail a check · ([\d,]+) no result \(break the limits\) · ([\d,]+) unstable/);
  check('full run: the message reads pass · fail a check · no result (break the limits) · unstable and adds up', !!ff && num(ff[2]) + num(ff[3]) + num(ff[4]) + num(ff[5]) === num(ff[1]) && num(ff[4]) === flagged.length, BF.msg.slice(0, 300));
  const fns = noResSentence(BF.msg.split(' The best-trade lines')[0]);
  check('full run: the no-result sentence matches the normal sweep', !!fns && !!ns && JSON.stringify(fns.by) === JSON.stringify(ns.by), BF.msg.slice(0, 600));
  check("full run: 'Most common' never names no result", !/Most common: no result/i.test(BF.msg));
  const topBad = await on.evaluate(() => (__dbg.rows || []).filter(r => r.passes && r.noResult).length);
  check('full run: no row without a result passes', topBad === 0, String(topBad));
  // the saved result keeps noResult (RMA-19 (3)): reload the page, then 'Load last large search'
  await on.reload({ waitUntil: 'load' }); await on.waitForFunction(() => window.__dbg && __dbg.res, null, { timeout: 20000 }).catch(() => {}); await waitRows(on).catch(() => {});
  await on.evaluate(() => document.getElementById('bigRestore').click());
  await on.waitForFunction(() => /^Loaded the large search/.test(document.getElementById('sweepMsg').textContent), null, { timeout: 20000 }).catch(() => {});
  const R = await on.evaluate(() => rowsOf());
  check('saved large search: reloads with the same noResult on every row', R.length === BF.rows.length && R.every(r => { const q = BF.rows.find(x => String(x.idx) === String(r.idx)); return q && q.noResult === r.noResult && q.passes === r.passes; }), `${R.length} vs ${BF.rows.length}`);
  await setup(on);
  // stick 8 mm: G5 refuses far more short members than any fail reason counts, and 'Most common' still names a fail (TE-B-717 (2))
  await on.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }; window.__stick = [document.getElementById('bS').value, document.getElementById('hS').value]; set('bS', 8); set('hS', 8); });
  const C = await run(on), cns = noResSentence(C.msg);
  check("stick 8 mm: no result is the biggest count, and 'Most common' still names a fail", !!cns && !/Most common: no result/i.test(C.msg) && (/Most common: (overlap|deflection|a member|outside)/.test(C.msg) || !/Most common/.test(C.msg)) && cns.n > Math.max(...Object.values(breakdown(C.msg) || { x: 0 })), C.msg);
  // a limits check that throws: no result 'error', no pass, no kg in the top list, one console.warn per sweep (TE-B-717 (3))
  await on.evaluate(() => { window.__realCG = TrussLimits.checkGeometry; TrussLimits.checkGeometry = () => { throw new Error('stub'); }; });
  const E = await run(on);
  check("throwing check: every stable row has noResult 'error'", E.rows.length > 0 && E.rows.every(r => r.noResult === 'error'), [...new Set(E.rows.map(r => r.noResult))].join(','));
  check('throwing check: nothing passes, the top list is empty', E.rows.every(r => r.passes === false) && await on.evaluate(() => document.querySelectorAll('#sweepTbl button[data-k]').length) === 0);
  check("throwing check: the message counts them as no result, by rule 'error'", /^(NONE PASS\. )?0 of /.test(E.msg) && (noResSentence(E.msg) || { by: {} }).by.error === E.rows.length, E.msg);
  check('throwing check: one console.warn for the sweep', warns.length === 1, String(warns.length));
  const EP = await pilot(on);
  check("throwing check: the pilot's rows are all 'error' too", EP.rows.length > 0 && EP.rows.every(r => r.noResult === 'error' && !r.passes));
  check('throwing check: one more console.warn for the pilot', warns.length === 2, String(warns.length));
  await on.evaluate(() => { TrussLimits.checkGeometry = window.__realCG; });
  // 3D: the pilot's 3D stage checks the 3D result, so M2 reads the deck deflection (D is the 3D row's), and nothing refused passes
  await setup(on);
  await on.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }; set('bS', window.__stick[0]); set('hS', window.__stick[1]); document.querySelector('#anaSwitch [data-ana="3d"]').click(); });
  await on.waitForTimeout(800);
  const T = await pilot(on), tFlag = T.rows.filter(r => r.noResult);
  check('3D pilot: some rows have no result, none passes', tFlag.length > 0 && tFlag.every(r => !r.passes), String(tFlag.length));
  check('3D pilot: M2 rows have a 3D deck deflection more than the height', tFlag.filter(r => r.noResult === 'M2').every(r => Math.abs(r.D) > r.height));
  check('3D pilot: a design a G-rule refuses in 2D has no result in 3D too', T.rows.every(r => { const q = bIdx.get(String(r.idx)); return !q || !q.noResult || q.noResult[0] !== 'G' || !!r.noResult; }));
  check('3D pilot: the box counts no result on its own', /[\d,]+ pass · [\d,]+ fail a check · [\d,]+ no result \(break the limits\) · [\d,]+ unstable\./.test(T.box) && !/Most common: no result/i.test(T.box), T.box.slice(0, 300));
  await on.close();

  // RMA-21 (TE-B-705): the Analysis charts and 'Best for' on the default sweep. With ?limits=1 a refused design is never on the
  // best-trade line, never a 'Best for' pick or a table row, and its tooltip has no kg (UI-I10). Flag off: the same as before.
  const BUDGET = 3000, TARGET = 3;
  async function charts(url) {
    const p = await openPage(b, url, { width: 1400, height: 900 });
    p.on('pageerror', e => errors.push(String(e))); await p.addInitScript(ROWS_FN); await p.evaluate(ROWS_FN);
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
  const F = await charts(srv.url), TC = await charts(srv.url + '?limits=1');
  const f0 = recount(F, false), t1 = recount(TC, true), t0 = recount(TC, false);
  check('RMA-21: no new sweep ran while the charts were read (flag off and on)', F.same && TC.same);
  check('RMA-21 flag off: the best-trade line is the one worked out from every row', F.front.length > 0 && sameFront(F.front, f0.front), `${F.front.length} vs ${f0.front.length}`);
  check("RMA-21 flag off: 'Best for' picks the same designs as before", F.best.length === 2 && F.best[0].includes(pickText(f0.strong)) && F.best[1].includes(pickText(f0.light)), F.best.join(' | '));
  check("RMA-21 flag off: every Trade-off tooltip reads capacity and passes or fails, none says 'no result'", F.tips.length > 0 && F.tips.every(t => / capacity [\d.]+ kg · (passes|fails a check)/.test(t) && !/no result/.test(t)), String(F.tips.length));
  check("RMA-21 flag off: no 3D chart tooltip says 'no result'", F.c3tips.length > 0 && F.c3tips.every(t => !/no result/.test(t)), String(F.c3tips.length));
  check('RMA-21 flag on: the default sweep has refused designs', TC.rows.some(r => r.noResult), String(TC.rows.filter(r => r.noResult).length));
  check('RMA-21 flag on: the best-trade line matches the recount over the designs with a result', TC.front.length > 0 && sameFront(TC.front, t1.front), `${TC.front.length} vs ${t1.front.length}`);
  check('RMA-21 flag on: no best-trade point is a refused design', t1.front.every(r => !r.noResult) && t0.front.some(r => r.noResult), `${t0.front.filter(r => r.noResult).length} of ${t0.front.length} on the old line were refused`);
  check("RMA-21 flag on: neither 'Best for' pick is a refused design, and both match the recount", TC.best.length === 2 && TC.best[0].includes(pickText(t1.strong)) && TC.best[1].includes(pickText(t1.light)) && !(t1.strong && t1.strong.noResult) && !(t1.light && t1.light.noResult), TC.best.join(' | '));
  check("RMA-21 flag on: 'Least wood that carries' would have picked a refused design without the change", !!(t0.light && t0.light.noResult), t0.light ? String(t0.light.noResult) : 'none');
  check('RMA-21 flag on: the table\'s lightest passing design has a result', TC.tbl.length > 0 && TC.tbl[0][2] === (t1.lw ? t1.lw.wood.toFixed(0) : '—'), JSON.stringify(TC.tbl[0]));
  const nrT = TC.tips.filter(t => /no result/.test(t));
  check("RMA-21 flag on: a refused design's Trade-off tooltip reads 'no result (breaks the limits: <rule>)' with no kg", nrT.length > 0 && nrT.every(t => /no result \(breaks the limits: (G([1-9]|10)|M2)\)/.test(t) && !/kg/.test(t)), `${nrT.length}: ${nrT[0] || ''}`);
  check('RMA-21 flag on: every other Trade-off tooltip is as before', TC.tips.filter(t => !/no result/.test(t)).every(t => / capacity [\d.]+ kg · (passes|fails a check)/.test(t)));
  const nr3 = TC.c3tips.filter(t => /no result/.test(t));
  check("RMA-21 flag on: a refused design's 3D chart tooltip reads 'no result' and shows no capacity number", nr3.length > 0 && nr3.every(t => /no result \(breaks the limits: (G([1-9]|10)|M2)\)/.test(t) && /capacity \(kg of books\): —/.test(t)), `${nr3.length}: ${nr3[0] || ''}`);
  check('no script errors', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - bad.length}/${check.results.length} sweep-limits checks passed`);
process.exit(bad.length ? 1 : 0);
