'use strict';
// #109 / #35 (Math Consultant, 2026-10-28): capture the reduced 3D systems a sweep actually solves, count solves per design,
// then time today's solveLinear against flat dense Cholesky and RCM-reordered banded Cholesky on the same systems.
// Run from the repo root: node docs/math/reference/solver-speed/bench.js
const APP = require('path').resolve(__dirname, '../../../../program');
const C = require(APP + '/src/core.js'), T3 = require(APP + '/src/core3d.js'), L = require(APP + '/tests/lib.js');
const orig = C.solveLinear, cap = []; let calls = 0;
C.solveLinear = (A, b) => { calls++; if (cap.length < 400) cap.push({ A: A.map(r => Float64Array.from(r)), b: Float64Array.from(b) }); return orig(A, b); };
let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(r() * a.length)];
const MAT = Object.assign({}, C.DEFAULT_MAT); let nd = 0;
for (let k = 0; k < 600; k++) { const P = pick([3,4,5,6,7,8]), h = Math.floor(P / 2);
  const d = L.design(Object.assign({}, L.DEFAULT, { family: pick(['grid','grid','warren']), height: pick([30,50,70,100]), panels: P, diagLeft: C.patternLeft(pick(['pratt','howe','x']), h), vertLeft: Array(h).fill(r() < .7), deskPanels: pick([1,2]) }));
  const tr = C.buildTruss(d), res = C.analyze(tr, MAT, L.DEFAULT.load, L.DEFAULT.opts); if (!res.stable) continue;
  try { T3.analyze3D(T3.build3D(tr, { width: 60, tilt: 0, bottomTies: true, topPat: ['S'], botPat: ['S'], framePat: ['D', 'N'] }), MAT, L.DEFAULT.load); nd++; } catch (e) {} }
console.log(`3D: ${nd} designs, ${calls} solves (${(calls / nd).toFixed(2)} per design: lift-off rounds), mean size ${Math.round(cap.reduce((a, c) => a + c.b.length, 0) / cap.length)} unknowns`);
// --- alternatives
function cholDense(A, b) {   // flat storage, no pivot search (K_ff is symmetric positive definite unless it's a mechanism)
  const n = b.length, M = new Float64Array(n * n); for (let i = 0; i < n; i++) M.set(A[i], i * n);
  let dmax = 0; for (let i = 0; i < n; i++) dmax = Math.max(dmax, M[i * n + i]);
  for (let j = 0; j < n; j++) { let d = M[j * n + j]; for (let k = 0; k < j; k++) d -= M[j * n + k] ** 2; if (d <= 1e-12 * dmax) return null; d = Math.sqrt(d); M[j * n + j] = d;
    for (let i = j + 1; i < n; i++) { let v = M[i * n + j]; for (let k = 0; k < j; k++) v -= M[i * n + k] * M[j * n + k]; M[i * n + j] = v / d; } }
  const x = Float64Array.from(b); for (let i = 0; i < n; i++) { let v = x[i]; for (let k = 0; k < i; k++) v -= M[i * n + k] * x[k]; x[i] = v / M[i * n + i]; }
  for (let i = n - 1; i >= 0; i--) { let v = x[i]; for (let k = i + 1; k < n; k++) v -= M[k * n + i] * x[k]; x[i] = v / M[i * n + i]; } return x;
}
function rcm(A) {   // reverse Cuthill-McKee ordering to shrink the bandwidth
  const n = A.length, adj = A.map((row, i) => { const o = []; for (let j = 0; j < n; j++) if (j !== i && row[j] !== 0) o.push(j); return o; });
  const seen = new Uint8Array(n), order = [];
  while (order.length < n) { let st = -1, dm = 1e9; for (let i = 0; i < n; i++) if (!seen[i] && adj[i].length < dm) { dm = adj[i].length; st = i; }
    const q = [st]; seen[st] = 1; while (q.length) { const v = q.shift(); order.push(v); adj[v].filter(u => !seen[u]).sort((a, b) => adj[a].length - adj[b].length).forEach(u => { seen[u] = 1; q.push(u); }); } }
  return order.reverse();
}
function bandOf(A, p) { const inv = new Int32Array(p.length); p.forEach((v, i) => inv[v] = i); let bw = 0; for (let i = 0; i < A.length; i++) for (let j = 0; j < A.length; j++) if (A[i][j] !== 0) bw = Math.max(bw, Math.abs(inv[i] - inv[j])); return bw; }
function cholBand(A, b, p, bw) {   // banded Cholesky in the RCM order: O(n·bw²)
  const n = b.length, W = bw + 1, M = new Float64Array(n * W);   // M[i*W + (i-j)] = L[i][j] for j in [i-bw, i]
  for (let i = 0; i < n; i++) for (let j = Math.max(0, i - bw); j <= i; j++) M[i * W + (i - j)] = A[p[i]][p[j]];
  let dmax = 0; for (let i = 0; i < n; i++) dmax = Math.max(dmax, M[i * W]);
  for (let j = 0; j < n; j++) { let d = M[j * W]; for (let k = Math.max(0, j - bw); k < j; k++) { const l = M[j * W + (j - k)]; d -= l * l; } if (d <= 1e-12 * dmax) return null; d = Math.sqrt(d); M[j * W] = d;
    for (let i = j + 1; i <= Math.min(n - 1, j + bw); i++) { let v = M[i * W + (i - j)]; for (let k = Math.max(0, i - bw); k < j; k++) v -= M[i * W + (i - k)] * M[j * W + (j - k)]; M[i * W + (i - j)] = v / d; } }
  const x = new Float64Array(n); for (let i = 0; i < n; i++) x[i] = b[p[i]];
  for (let i = 0; i < n; i++) { let v = x[i]; for (let k = Math.max(0, i - bw); k < i; k++) v -= M[i * W + (i - k)] * x[k]; x[i] = v / M[i * W]; }
  for (let i = n - 1; i >= 0; i--) { let v = x[i]; for (let k = i + 1; k <= Math.min(n - 1, i + bw); k++) v -= M[k * W + (k - i)] * x[k]; x[i] = v / M[i * W]; }
  const out = new Float64Array(n); p.forEach((v, i) => out[v] = x[i]); return out;
}
const T = (f, reps) => { const t0 = process.hrtime.bigint(); for (let r2 = 0; r2 < reps; r2++) cap.forEach(f); return Number(process.hrtime.bigint() - t0) / 1e6 / reps / cap.length; };
const orders = cap.map(c => rcm(c.A)), bws = cap.map((c, i) => bandOf(c.A, orders[i])), bw0 = cap.map(c => bandOf(c.A, c.A.map((_, i) => i)));
let maxErr = 0; cap.forEach((c, i) => { const x0 = orig(c.A, Array.from(c.b)), x1 = cholBand(c.A, c.b, orders[i], bws[i]), x2 = cholDense(c.A, c.b); if (!x0 || !x1 || !x2) return; const sc = Math.max(...x0.map(Math.abs)); x0.forEach((v, k) => { maxErr = Math.max(maxErr, Math.abs(v - x1[k]) / sc, Math.abs(v - x2[k]) / sc); }); });
console.log(`bandwidth: as numbered ${Math.round(bw0.reduce((a, b) => a + b) / bw0.length)}, after reordering ${Math.round(bws.reduce((a, b) => a + b) / bws.length)} (mean)`);
const tOld = T(c => orig(c.A, Array.from(c.b)), 3), tCh = T(c => cholDense(c.A, c.b), 3), tBand = T((c, i) => cholBand(c.A, c.b, orders[cap.indexOf(c)], bws[cap.indexOf(c)]), 3);
const tRcm = T(c => rcm(c.A), 1);
console.log(`per solve: today ${(1000 * tOld).toFixed(0)} µs | dense Cholesky (flat) ${(1000 * tCh).toFixed(0)} µs (${(tOld / tCh).toFixed(1)}×) | banded Cholesky ${(1000 * tBand).toFixed(0)} µs (${(tOld / tBand).toFixed(1)}×; ordering is once per design topology, ${(1000 * tRcm).toFixed(0)} µs)`);
console.log(`largest difference from today's answers: ${maxErr.toExponential(1)} (relative to the largest displacement)`);
