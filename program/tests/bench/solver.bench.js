// Solver timing benchmark (#35, step 0: measure before changing anything). Board TE-B-069.
// Timing only, not pass/fail, so it is NOT part of run_all.sh. Run from the repo root:
//   node program/tests/bench/solver.bench.js
// Plain Node, no dependencies. It reads the solver through tests/lib.js and changes nothing.
// The last line starts with 'BENCH ' and holds the results as JSON, so runs can be compared.
'use strict';
const path = require('path');
const { C, T3, DEFAULT, design, cases } = require(path.join(__dirname, '..', 'lib.js'));

const WARM = 3, RUNS = 20, SWEEP_N = 2000, SEED = 310;
const OPT3D = { width: 60, tilt: 0, bottomTies: true, topPat: ['S'], botPat: ['S'], framePat: ['D', 'N'] }; // as tests/solver.test.js

const ms = () => Number(process.hrtime.bigint()) / 1e6;
const median = a => { const s = a.slice().sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
function time(fn) {
  for (let i = 0; i < WARM; i++) fn();
  const t = [];
  for (let i = 0; i < RUNS; i++) { const t0 = ms(); fn(); t.push(ms() - t0); }
  return median(t);
}
// Small fixed-seed generator (mulberry32): the same designs on every run and every machine.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const solve = st => C.analyze(C.buildTruss(design(st)), st.mat, st.load, st.opts);
const t0all = ms();

// (1) 2D: every built-in case (saved: ones skipped, so results don't depend on tests/private/)
const builtIn = cases().filter(cs => !cs.name.startsWith('saved:'));
for (const cs of builtIn) solve(cs.state); // one untimed pass, so the first rows aren't slowed by JIT warm-up
const rows2d = [];
for (const cs of builtIn) {
  const tr = C.buildTruss(design(cs.state));
  rows2d.push({ name: cs.name, joints: tr.nodes.length, members: tr.elems.length, ms: time(() => solve(cs.state)) });
}

// (2) 3D: the default design, built and analysed as tests/solver.test.js does
const tr0 = C.buildTruss(design(DEFAULT));
const m30 = T3.build3D(tr0, OPT3D), mat3 = Object.assign({}, C.DEFAULT_MAT, DEFAULT.mat);
const row3d = { name: 'default-3D', joints: m30.nodes.length, members: m30.elems.length,
  ms: time(() => { const m3 = T3.build3D(tr0, OPT3D); T3.analyze3D(m3, mat3, DEFAULT.load); }) };

// (3) sweep-like loop: 2,000 2D designs from DEFAULT, height 20-100 mm, panels 2-8, fixed seed
const r = rng(SEED), designs = [];
for (let i = 0; i < SWEEP_N; i++) {
  const N = 2 + Math.floor(r() * 7), h = 20 + Math.floor(r() * 81), half = Math.floor(N / 2);
  designs.push(Object.assign({}, DEFAULT, { panels: N, height: h, diagLeft: Array(half).fill('P'), vertLeft: Array(half).fill(true) }));
}
let stable = 0;
const ts = ms();
for (const st of designs) if (solve(st).stable) stable++;
const sweepS = (ms() - ts) / 1000, perSec = SWEEP_N / sweepS;

// readable table
const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);
console.log(`Truss Explorer solver benchmark  (node ${process.version}, median of ${RUNS} runs after ${WARM} warm-up)`);
console.log(pad('case', 18) + lpad('joints', 8) + lpad('members', 9) + lpad('median ms', 11));
for (const x of rows2d.concat([row3d])) console.log(pad(x.name, 18) + lpad(x.joints, 8) + lpad(x.members, 9) + lpad(x.ms.toFixed(3), 11));
console.log(`sweep-like loop: ${SWEEP_N} 2D designs (seed ${SEED}) in ${sweepS.toFixed(2)} s = ${perSec.toFixed(0)} designs/s (${stable} stable)`);
console.log(`total ${((ms() - t0all) / 1000).toFixed(1)} s`);

const round = v => Math.round(v * 1000) / 1000;
const out = { node: process.version, date: new Date().toISOString(), runs: RUNS, warmup: WARM,
  median2d_ms: Object.fromEntries(rows2d.map(x => [x.name, round(x.ms)])),
  median3d_ms: { 'default-3D': round(row3d.ms) },
  sweep: { designs: SWEEP_N, seed: SEED, seconds: round(sweepS), designs_per_s: Math.round(perSec), stable } };
console.log('BENCH ' + JSON.stringify(out));
