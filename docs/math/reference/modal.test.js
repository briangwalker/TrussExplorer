'use strict';
// Checks for modal.js against #207's acceptance checks. Run from the repo root: node docs/math/reference/modal.test.js
const assert = require('assert'), path = require('path');
const M = require('./modal.js');
const APP = path.resolve(__dirname, '../../../truss-explorer-src-v58/truss-explorer');
const C = require(path.join(APP, 'src/core.js')), L = require(path.join(APP, 'tests/lib.js'));

// 0. Jacobi on a known matrix
{ const A = [[2, -1, 0], [-1, 2, -1], [0, -1, 2]].map(r => Float64Array.from(r)); const v = M.jacobiEigen(A).values.sort((a, b) => a - b);
  [2 - Math.SQRT2, 2, 2 + Math.SQRT2].forEach((x, i) => assert(Math.abs(v[i] - x) < 1e-12)); console.log('0. Jacobi on a 3×3 with known eigenvalues: ok'); }

// 1. #207 check 1: 100 mm stick, fixed at one end, 0.1 kg at the other -> f = 277 Hz
{ const E = 3000, A = 3.18 * 3.18, Lb = 100, k = E * A / Lb;
  const K = [[k, -k], [-k, k]].map(r => Float64Array.from(r)), mass = Float64Array.from([0, 0.1]);
  const r = M.modes(K, new Set([0]), mass, 1), f = r.modes[0].f, exact = Math.sqrt(k * 1000 / 0.1) / (2 * Math.PI);
  assert(Math.abs(f - exact) / exact < 1e-12); assert(Math.abs(f - 277) / 277 < 0.002);
  console.log(`1. single bar: k = ${k.toFixed(1)} N/mm, f = ${f.toFixed(2)} Hz (Physics' hand value 277 Hz; exact formula ${exact.toFixed(2)} Hz): ok`); }

// 2. #207 check 2: default bridge, with and without books, vs the static estimate f ≈ (1/2π)·√(g/δ)
function bridgeModes(S, withBooks, stuck, booksVerticalOnly) {
  const d = L.design(S), t = C.buildTruss(d), mat = Object.assign({}, C.DEFAULT_MAT, S.mat), load = S.load, r = C.analyze(t, mat, load, S.opts);
  assert(r.stable);
  const nD = 2 * t.nodes.length, K = Array.from({ length: nD }, () => new Float64Array(nD)), mass = new Float64Array(nD), A = mat.b * mat.h;
  t.elems.forEach(e => { const [x1, y1] = t.nodes[e.i], [x2, y2] = t.nodes[e.j], Le = Math.hypot(x2 - x1, y2 - y1), c = (x2 - x1) / Le, s = (y2 - y1) / Le;
    const k = mat.E * A * e.n / Le, dofs = [2 * e.i, 2 * e.i + 1, 2 * e.j, 2 * e.j + 1], v = [c, s, -c, -s];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) K[dofs[a]][dofs[b]] += k * v[a] * v[b];
    const m = mat.rho * A * e.n * Le;   // kg (rho in kg/mm³)
    [e.i, e.j].forEach(n => { mass[2 * n] += m / 2; mass[2 * n + 1] += m / 2; }); });
  const bookPerTruss = (load.mBook1 + load.mBook2) / load.nTruss;   // unfactored: the books as they really sit
  if (withBooks) t.trib.forEach(q => { if (!booksVerticalOnly) mass[2 * q.node] += bookPerTruss * q.frac; mass[2 * q.node + 1] += bookPerTruss * q.frac; });
  // a joint with no mass would make M singular: give it a tiny mass (it then has a very high, irrelevant frequency)
  for (let i = 0; i < nD; i++) if (!(mass[i] > 0)) mass[i] = 1e-9;
  const fixed = new Set(r.DispCon.map(([n, dof]) => 2 * n + dof - 1));
  // Physics on #207 (TE-B-105): on the desk, friction holds every bearing joint for vibrations this small, so in the MODAL
  // solve a joint that bears (y held) is held sideways too. The static solve keeps the course pin/roller convention.
  if (stuck) r.DispCon.forEach(([n, dof]) => { if (dof === 2) fixed.add(2 * n); });
  const out = M.modes(K, fixed, mass, 6);
  // static estimate: deflection under the unfactored books = FS-design deflection / FS
  const delta = r.midDefl / mat.FS, fStatic = Math.sqrt(9810 / delta) / (2 * Math.PI);   // g in mm/s²
  return { out, fStatic, delta, massTruss: mass.reduce((a, b) => a + b, 0) / 2, mass };
}
{ const S = Object.assign({}, L.DEFAULT);
  const w = bridgeModes(S, true), wo = bridgeModes(S, false);
  // name each mode by where its kinetic energy goes; the static estimate is for the vertical bounce, which need not be mode 1
  const kind = m => { const sh = M.energyShares(m.phi, w.mass, 2); return { along: sh[0], vert: sh[1] }; };
  const iV = w.out.modes.findIndex(m => kind(m).vert > 0.5), fV = w.out.modes[iV].f, ratio = fV / w.fStatic;
  console.log(`2. default bridge (2D, one truss, ${w.out.nFree} free DOFs, Jacobi ${w.out.sweeps} sweeps):`);
  console.log('   with books:    ' + w.out.modes.map((m, k) => `f${k + 1} ${m.f.toFixed(1)} Hz (${Math.round(100 * kind(m).vert)}% vertical)`).join(', '));
  console.log(`   first mainly-vertical mode (bounce): mode ${iV + 1}, ${fV.toFixed(1)} Hz; static estimate (δ = ${w.delta.toFixed(4)} mm unfactored) ${w.fStatic.toFixed(1)} Hz -> ratio ${ratio.toFixed(3)}`);
  console.log(`   without books: f1..f6 = ${wo.out.modes.map(m => m.f.toFixed(0)).join(', ')} Hz`);
  assert(ratio > 0.8 && ratio < 1.2, 'bounce frequency within ±20% of the static estimate');
  assert(wo.out.modes[0].f > 5 * w.out.modes[0].f, 'without books the frequencies rise a lot');
  // M-orthogonality of the modes (a solver sanity check)
  const a = w.out.modes[0].phi, b = w.out.modes[1].phi; let dot = 0, na = 0; a.forEach((v, i) => { dot += w.mass[i] * v * b[i]; na += w.mass[i] * v * v; });
  assert(Math.abs(dot / na) < 1e-9); console.log('   modes are mass-orthogonal; the bounce is within ±20% of the static estimate: ok'); }
// 3. #207 with the supports held by friction (Physics, TE-B-105). Measured, not assumed: the along-span mode moves from 57 Hz up to
// just below the bounce. What's left is the top chord (where the books sit) racking along the span over the panels, carrying the
// books' along-span mass. If the books slide on the deck instead (their mass acts only vertically), the bounce is mode 1.
{ const S = Object.assign({}, L.DEFAULT), st = bridgeModes(S, true, true), vo = bridgeModes(S, true, true, true);
  const vert = (m, x) => M.energyShares(m.phi, x.mass, 2)[1], show = x => x.out.modes.slice(0, 4).map((m, k) => `f${k + 1} ${m.f.toFixed(1)} Hz (${Math.round(100 * vert(m, x))}% vertical)`).join(', ');
  console.log('3. supports held sideways (friction), books ride with the deck: ' + show(st));
  console.log('   ... books' + "'" + ' mass vertical only (books slide): ' + show(vo));
  const iV = st.out.modes.findIndex(m => vert(m, st) > 0.5), ratio = st.out.modes[iV].f / st.fStatic;
  assert(st.out.modes[0].f > w0(), 'holding the supports raises the lowest mode');
  assert(ratio > 0.8 && ratio < 1.2, 'the bounce stays within ±20% of the static estimate');
  assert(vert(vo.out.modes[0], vo) > 0.5, 'with the books sliding, mode 1 is the bounce');
  console.log(`   bounce: mode ${iV + 1}, ${st.out.modes[iV].f.toFixed(1)} Hz, ratio ${ratio.toFixed(3)} to the static estimate; the racking mode sits ${(100 * (1 - st.out.modes[0].f / st.out.modes[iV].f)).toFixed(1)}% below it: ok`); }
function w0() { return bridgeModes(Object.assign({}, L.DEFAULT), true).out.modes[0].f; }
console.log('modal tests: all passed');
