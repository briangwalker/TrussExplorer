// Timing for TrussLimits.checkGeometry (RMA-20, board TE-B-681). Not part of run_all.sh: timing depends on the machine, so it can't pass or fail.
//   node program/tests/bench/limits-bench.mjs
// Designs: the 36 built-in cases (tests/lib.js cases(), the saved: ones left out) and the 2,000-design sweep-like sample (seed 310) from
// tests/limits.test.js. 'old' is the reference copy of checkGeometry from before RMA-20, read out of tests/limits.test.js so there is
// one copy; 'new' is src/limits.js. The block table times each rule block of the OLD code alone over the sample (where the time went).
// Each figure: 3 warm-up passes, then 7 timed passes over the whole set, and the median, in microseconds per design.
// The last line starts with 'BENCH ' and is JSON, to keep before and after a change on the same machine. - RedMangoArch
//
// Sweep timing mode (RMA-22, board TE-B-721): node program/tests/bench/limits-bench.mjs --sweep [--runs N]
// Needs the built page (python3 program/build.py) and Playwright. It opens the page twice, flag off and ?limits=1, and times the
// default normal sweep (Run sweep, 51,100 designs) N times each (default 3), alternating, and gives the medians. One more run per
// side wraps TrussLimits.checkInputs / checkGeometry / checkResult and TrussCore.buildTruss / analyze (the solve) with timers to
// show where the time goes; those wrapped runs are not in the medians. Its last line starts with 'SWEEPBENCH ' and is JSON.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

if (process.argv.includes('--sweep')) { await sweepBench(); process.exit(0); }

async function sweepBench() {
  const ai = process.argv.indexOf('--runs'), N = ai > 0 ? Math.max(1, +process.argv[ai + 1] || 3) : 3;
  const { serve, browser, openPage, waitRows } = await import('../ui/harness.mjs');
  const srv = await serve(undefined, { shell: true }), b = await browser();
  const med = a => { const x = a.slice().sort((p, q) => p - q), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
  // one Run sweep; the time is taken in the page, from the click to the end of the sweep's last step (SweepState.set and the message)
  const runOnce = p => p.evaluate(() => new Promise((res, rej) => {
    const btn = document.getElementById('runSweep'), msg = document.getElementById('sweepMsg');
    const t0 = performance.now(); btn.click();
    const poll = () => { if (!btn.disabled && !/Running/.test(msg.textContent)) return res({ ms: performance.now() - t0, msg: msg.textContent });
      if (performance.now() - t0 > 600000) return rej(new Error('sweep took over 10 min')); setTimeout(poll, 5); };
    setTimeout(poll, 5);
  }));
  // timers around the limits checks and the solve, for the split run only
  const wrap = p => p.evaluate(() => {
    const T = window.__sweepT = {};
    const w = (o, k, name) => { const f = o && o[k]; if (typeof f !== 'function') return; T[name] = { ms: 0, n: 0 };
      o[k] = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { T[name].ms += performance.now() - t; T[name].n++; } }; };
    w(window.TrussLimits, 'checkInputs', 'checkInputs'); w(window.TrussLimits, 'checkGeometry', 'checkGeometry'); w(window.TrussLimits, 'checkResult', 'checkResult');
    w(window.TrussCore, 'buildTruss', 'buildTruss'); w(window.TrussCore, 'analyze', 'analyze');
  });
  const pages = {};
  for (const [k, q] of [['off', ''], ['on', '?limits=1']]) {
    const p = await openPage(b, srv.url + q, { width: 1400, height: 900 });
    await waitRows(p, 180000).catch(() => {});   // the starter sweep first, so it isn't timed with ours
    pages[k] = p;
  }
  // flag-on check: the page really runs the limits (a no-result count in the message)
  const out = { node: process.version, date: new Date().toISOString().slice(0, 10), runs: N, off: [], on: [] };
  await runOnce(pages.off); await runOnce(pages.on);   // one untimed warm-up run on each page
  for (let k = 0; k < N; k++) for (const side of ['off', 'on']) {
    const r = await runOnce(pages[side]); out[side].push(+r.ms.toFixed(1));
    if (k === 0) out[side + 'Msg'] = r.msg.split('. ')[0];
    console.log(`run ${k + 1} ${side.padEnd(3)} ${r.ms.toFixed(0).padStart(7)} ms`);
  }
  const n = +((out.offMsg.match(/of ([\d,]+) pass/) || [])[1] || '0').replace(/,/g, '');
  out.designs = n;
  const mOff = med(out.off), mOn = med(out.on);
  out.median = { off: +mOff.toFixed(1), on: +mOn.toFixed(1), overPct: +(100 * (mOn - mOff) / mOff).toFixed(1) };
  out.split = {};
  for (const side of ['off', 'on']) {
    await wrap(pages[side]); const r = await runOnce(pages[side]);
    const T = await pages[side].evaluate(() => window.__sweepT);
    const parts = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, { ms: +v.ms.toFixed(1), n: v.n }]));
    const inside = Object.values(T).reduce((a, v) => a + v.ms, 0);
    out.split[side] = { total: +r.ms.toFixed(1), ...parts, rest: +(r.ms - inside).toFixed(1) };
  }
  console.log(`\nsweep: ${out.offMsg} (flag off) / ${out.onMsg} (flag on)`);
  console.log(`designs ${n.toLocaleString()}, ${N} runs each, medians:`);
  console.log(`  flag off  ${mOff.toFixed(0).padStart(7)} ms  ${(mOff / n).toFixed(4)} ms per design`);
  console.log(`  ?limits=1 ${mOn.toFixed(0).padStart(7)} ms  ${(mOn / n).toFixed(4)} ms per design  ${out.median.overPct >= 0 ? '+' : ''}${out.median.overPct}% over flag off`);
  console.log('\nwhere the time goes (one run each with timers, ms; n = calls):');
  for (const side of ['off', 'on']) console.log('  ' + side.padEnd(3) + ' ' + Object.entries(out.split[side]).map(([k, v]) => typeof v === 'number' ? `${k} ${v}` : `${k} ${v.ms} (n ${v.n})`).join(', '));
  console.log('SWEEPBENCH ' + JSON.stringify(out));
  await b.close(); srv.close();
}

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { C, design, cases, DEFAULT } = require(path.join(here, '..', 'lib.js'));
const L = require(path.join(here, '..', '..', 'src', 'limits.js'));

// the reference and the sample generator, out of the test file (between their markers)
const src = readFileSync(path.join(here, '..', 'limits.test.js'), 'utf8');
const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error('marker not found: ' + from); return src.slice(a, b + to.length); };
const REF = new Function(cut('const REF = (() => {', '\nreturn checkGeometry;\n})();') + '\nreturn REF;')();
const sweepSample = new Function(cut('function sweepSample(', '\n  return out;\n}') + '\nreturn sweepSample;')();

const builtins = cases().filter(cs => !cs.name.startsWith('saved:')).map(cs => C.buildTruss(design(cs.state)));
const sample = sweepSample(C, design, DEFAULT, 2000);

function time(list, fn) {
  for (let k = 0; k < 3; k++) for (const t of list) fn(t);
  const runs = [];
  for (let k = 0; k < 7; k++) { const t0 = performance.now(); for (const t of list) fn(t); runs.push((performance.now() - t0) * 1000 / list.length); }
  return runs.sort((a, b) => a - b)[3];
}

// ---- the OLD code's rule blocks, one function each (the same loops as the reference, cut apart; their output is thrown away) ----
const TOL = 1e-6, GAP = 0.5, cr = (ax, ay, bx, by) => ax * by - ay * bx;
const goodOf = t => t.elems.map((e, m) => [m, e]).filter(([, e]) => t.nodes[e.i] && t.nodes[e.j]);
function oldOverlaps(p0, p1, q0, q1) {
  const rx = p1[0] - p0[0], ry = p1[1] - p0[1], sx = q1[0] - q0[0], sy = q1[1] - q0[1], Lr = Math.hypot(rx, ry), Ls = Math.hypot(sx, sy);
  if (Lr <= TOL || Ls <= TOL || Math.abs(cr(rx, ry, sx, sy)) / (Lr * Ls) > 1e-9) return false;
  const wx = q0[0] - p0[0], wy = q0[1] - p0[1];
  if (Math.abs(cr(wx, wy, rx, ry)) / Lr > TOL) return false;
  const a = (wx * rx + wy * ry) / Lr, b = ((q1[0] - p0[0]) * rx + (q1[1] - p0[1]) * ry) / Lr;
  return Math.min(Lr, Math.max(a, b)) - Math.max(0, Math.min(a, b)) > TOL;
}
function oldNear(p0, p1, c) {
  const rx = p1[0] - p0[0], ry = p1[1] - p0[1], Ln = Math.hypot(rx, ry);
  if (Ln <= TOL) return false;
  const t = ((c[0] - p0[0]) * rx + (c[1] - p0[1]) * ry) / Ln;
  return t > GAP && t < Ln - GAP && Math.abs(cr(c[0] - p0[0], c[1] - p0[1], rx, ry)) / Ln < GAP;
}
let sink = 0;
const BLOCKS = {
  'G1-G4': t => { const N = t.nodes, xs = N.map(p => p[0]); sink += Math.max(...xs) - Math.min(...xs);
    const a0 = N[0], far = N.reduce((b, p) => (Math.hypot(p[0] - a0[0], p[1] - a0[1]) > Math.hypot(b[0] - a0[0], b[1] - a0[1]) ? p : b), a0);
    const dx = far[0] - a0[0], dy = far[1] - a0[1], len0 = Math.hypot(dx, dy); sink += N.every(p => Math.abs(dx * (p[1] - a0[1]) - dy * (p[0] - a0[0])) / len0 <= TOL) ? 1 : 0; },
  'G5': t => { const N = t.nodes, seen = new Map(); t.elems.forEach((e, m) => { sink += Math.hypot(N[e.i][0] - N[e.j][0], N[e.i][1] - N[e.j][1]);
    const key = Math.min(e.i, e.j) + '-' + Math.max(e.i, e.j); if (!seen.has(key)) seen.set(key, m); }); },
  'G7': t => { const N = t.nodes; goodOf(t).forEach(([, e]) => { sink += Math.hypot(N[e.i][0] - N[e.j][0], N[e.i][1] - N[e.j][1]); }); },
  'G8 pairs': t => { const N = t.nodes, g = goodOf(t); for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) { const ea = g[a][1], eb = g[b][1];
    if (Math.min(ea.i, ea.j) === Math.min(eb.i, eb.j) && Math.max(ea.i, ea.j) === Math.max(eb.i, eb.j)) continue; if (oldOverlaps(N[ea.i], N[ea.j], N[eb.i], N[eb.j])) sink++; } },
  'G8 joint-pass': t => { const N = t.nodes, lapped = new Set(); goodOf(t).forEach(([m, e]) => N.forEach((c, n) => {
    if (n === e.i || n === e.j || lapped.has(m + ':' + n)) return; if (oldNear(N[e.i], N[e.j], c)) sink++; })); },
  'G9-G10': t => { if (Array.isArray(t.supports)) sink += t.supports.reduce((n, s) => n + (s && (s.pin || s.xHold) ? 2 : 1), 0); },
};

const size = list => { let n = 0, m = 0; for (const t of list) { n += t.nodes.length; m += t.elems.length; } return [(n / list.length).toFixed(1), (m / list.length).toFixed(1)]; };
const out = { node: process.version, date: new Date().toISOString().slice(0, 10), designs: { builtins: builtins.length, sample: sample.length } };
console.log(`checkGeometry bench: ${builtins.length} built-ins (joints/members ${size(builtins).join('/')}), ${sample.length} sample designs (${size(sample).join('/')})\n`);
console.log('OLD code, each rule block alone over the sample (us per design):');
out.blocks = {};
for (const [k, fn] of Object.entries(BLOCKS)) { const us = time(sample, fn); out.blocks[k] = +us.toFixed(2); console.log('  ' + k.padEnd(14) + us.toFixed(2).padStart(8)); }
console.log('\nwhole checkGeometry (us per design)      old      new   speed-up');
out.total = {};
for (const [k, list] of [['built-ins', builtins], ['sample', sample]]) {
  const o = time(list, t => REF(t, {})), n = time(list, t => L.checkGeometry(t, {}));
  out.total[k] = { old: +o.toFixed(2), new: +n.toFixed(2), x: +(o / n).toFixed(2) };
  console.log('  ' + k.padEnd(36) + o.toFixed(2).padStart(8) + n.toFixed(2).padStart(9) + (o / n).toFixed(2).padStart(9) + 'x');
}
let same = 0; for (const t of sample) if (JSON.stringify(REF(t, {})) === JSON.stringify(L.checkGeometry(t, {}))) same++;
console.log(`\nsame answer as the old code on ${same} of ${sample.length} sample designs` + (sink === -1 ? '' : ''));
out.same = same;
console.log('BENCH ' + JSON.stringify(out));
