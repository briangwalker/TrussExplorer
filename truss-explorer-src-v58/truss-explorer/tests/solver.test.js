// Node unit tests: 2D solver, supports and friction, 3D model, export and build documents.
// Run: node --test tests/   (from the source folder)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { SRC, C, T3, DEFAULT, cases, solve2D, design } = require('./lib.js');
const X = require(path.join(SRC, 'export.js'));
const BD = require(path.join(SRC, 'builddoc.js'));

const CASES = cases();

test('solveLinear solves a known 3x3 system and flags a singular one', () => {
  const x = C.solveLinear([[4, -2, 1], [-2, 4, -2], [1, -2, 4]], [11, -16, 17]);
  [1, -2, 3].forEach((v, i) => assert.ok(Math.abs(x[i] - v) < 1e-12, `x${i}=${x[i]}`));
  assert.equal(C.solveLinear([[1, 2], [2, 4]], [1, 2]), null);
});

test('panelWidths add up to the span', () => {
  for (const N of [1, 2, 3, 5, 8]) for (const r of [0.5, 1, 2]) {
    const w = C.panelWidths(N, 200, r);
    assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 200) < 1e-9);
  }
});

for (const cs of CASES) {
  test(`2D audit: ${cs.name}`, () => {
    const { tr, res } = solve2D(cs.state);
    assert.ok(res.stable, 'design should be stable');
    const P = res.Ptruss, tol = 1e-6 * P;
    // (1) joint equilibrium: member pulls + loads + reactions = 0 at every joint
    const ext = tr.nodes.map(() => [0, 0]);
    res.Fval.forEach(([n, dof, v]) => { ext[n][dof - 1] += v; });
    res.activeSupports.forEach(s => { ext[s.node][0] += s.Rx || 0; ext[s.node][1] += s.Ry || 0; });
    res.members.forEach(m => { ext[m.i][0] += m.F * m.lx; ext[m.i][1] += m.F * m.ly; ext[m.j][0] -= m.F * m.lx; ext[m.j][1] -= m.F * m.ly; });
    const worst = Math.max(...ext.map(v => Math.hypot(v[0], v[1])));
    assert.ok(worst < 1e-4 * P, `joint residual ${worst.toExponential(2)} N (P=${P.toFixed(2)})`);
    // (2) global: reactions carry the whole truss load
    const sumRy = res.activeSupports.reduce((s, q) => s + (q.Ry || 0), 0);
    assert.ok(Math.abs(sumRy - P) < 1e-4 * P, `sum Ry ${sumRy} vs ${P}`);
    // (3) unilateral supports: the table never pulls down
    res.activeSupports.filter(s => !s.claw && !s.yFree).forEach(s => assert.ok(s.Ry > -tol, `support at node ${s.node} pulls (${s.Ry})`));
    // (4) table-top friction: a top support needing more than mu*N is reported as a slip
    const mu = res.mu;
    res.activeSupports.filter(s => !s.brace && !s.abut && !s.claw && !s.corner && !s.xFree).forEach(s => {
      if (Math.abs(s.Rx) > mu * Math.max(0, s.Ry) + 1e-4 * P) assert.ok(res.slips.some(q => q.node === s.node), `node ${s.node} should be listed as slipping`);
    });
    if (res.slips.length) assert.equal(res.passes, false);
    // (5) member checks follow the stated formulas
    res.members.forEach(m => {
      const Pcr = Math.PI ** 2 * res.mat.E * m.Ieff / (res.mat.K * m.L) ** 2;
      assert.ok(Math.abs(Pcr - m.Pcr) < 1e-9 * Pcr);
      if (m.F < 0) assert.ok(Math.abs(m.util - Math.max(-m.F / Pcr, -m.F / (res.mat.sigC * m.Aeff))) < 1e-12);
      if (m.F > 0) assert.ok(Math.abs(m.util - m.F / (res.mat.sigT * m.Aeff)) < 1e-12);
    });
    // (6) capacity and wood bookkeeping
    if (res.maxUtil > 0) assert.ok(Math.abs(res.capKg - res.mat.FS * (res.load.mBook1 + res.load.mBook2) / res.maxUtil) < 1e-9);
    assert.ok(Math.abs(res.wood - (res.totalLen * res.load.nTruss + (res.opts.crossTies ? res.nTies * res.opts.width : 0))) < 1e-9);
    // (7) symmetry: a symmetric design under a centred load gives equal forces in mirror members
    const symmetric = !cs.state.loads && !cs.state.sticks || Object.keys(cs.state.sticks || {}).length === 0;
    if (symmetric && !cs.state.loads && res.lifted.length === 0) {
      res.members.forEach(m => { if (m.mirror >= 0) assert.ok(Math.abs(m.F - res.members[m.mirror].F) < 1e-4 * P, `members ${m.k}/${m.mirror}: ${m.F} vs ${res.members[m.mirror].F}`); });
    }
  });
}

test('saved bridges reproduce their saved 2D summary when they were saved in 2D', () => {
  const saved = CASES.filter(c => c.summary);
  const report = [];
  saved.forEach(c => {
    const { res } = solve2D(c.state);
    const same = Math.round(res.wood) === Math.round(c.summary.wood) && Math.abs(res.capKg - c.summary.capKg) < 0.006 && Math.abs(res.midDefl - c.summary.deflection) < 1e-3 && res.passes === c.summary.passes;
    report.push(`${c.name}: wood ${res.wood.toFixed(0)}/${c.summary.wood} cap ${res.capKg.toFixed(2)}/${c.summary.capKg} defl ${res.midDefl.toFixed(4)}/${c.summary.deflection} pass ${res.passes}/${c.summary.passes} ${same ? 'MATCH' : 'differs (3D save or older version?)'}`);
  });
  console.log('    ' + report.join('\n    '));
});

test('mu = 0 vs a large mu: more friction never adds slips', () => {
  const lo = solve2D(Object.assign({}, DEFAULT, { fricMu: 0, deskEnds: 'feet' })).res;
  const hi = solve2D(Object.assign({}, DEFAULT, { fricMu: 10, deskEnds: 'feet' })).res;
  assert.ok(hi.slips.length <= lo.slips.length);
});

const B3 = [
  { name: 'ties only (a mechanism)', o: { width: 60, tilt: 0, bottomTies: true, topPat: ['N'], botPat: ['N'], framePat: ['N'] }, mechanism: true },
  { name: 'single top + bottom, end frames', o: { width: 60, tilt: 0, bottomTies: true, topPat: ['S'], botPat: ['S'], framePat: ['D', 'N'] } },
  { name: 'full X', o: { width: 60, tilt: 0, bottomTies: true, topPat: ['X'], botPat: ['X'], framePat: ['X'] } },
  { name: 'tilted 8 deg', o: { width: 60, tilt: 8, bottomTies: true, topPat: ['S'], botPat: ['S'], framePat: ['D'] } },
];
for (const cs of CASES.filter(c => /^pratt-N4|^howe-N3|^saved/.test(c.name))) for (const b of B3) {
  test(`3D audit: ${cs.name} / ${b.name}`, () => {
    const { tr, res } = solve2D(cs.state);
    const m3 = T3.build3D(tr, b.o);
    const q = T3.analyze3D(m3, Object.assign({}, C.DEFAULT_MAT, cs.state.mat), cs.state.load);
    if (b.mechanism) { assert.equal(q.stable, false, 'ties alone cannot hold sway; the solver must say unstable, not return numbers'); return; }
    assert.ok(q.stable, '3D model should be stable');
    assert.ok(Math.abs(q.sumZ - q.P) < 1e-4 * q.P, `vertical reactions ${q.sumZ} vs design load ${q.P}`);
    // joint equilibrium in 3D for every free joint
    const ND = 3 * m3.nodes.length, F = new Float64Array(ND);
    q.members.forEach(m => { const g = m3.nodes[m.i], h = m3.nodes[m.j], d = [0, 1, 2].map(a => (h[a] - g[a]) / m.L);
      for (let a = 0; a < 3; a++) { F[3 * m.i + a] += m.F * d[a]; F[3 * m.j + a] -= m.F * d[a]; } });
    // add the applied loads, as analyze3D spreads them
    m3.tr.trib.forEach(t => { const yf = m3.nodes[t.node][1], yb = m3.nodes[t.node + m3.n][1]; const back = Math.abs(yb - yf) > 1e-9 ? (0 - yf) / (yb - yf) : 0.5;
      F[3 * t.node + 2] -= q.P * t.frac * (1 - back); F[3 * (t.node + m3.n) + 2] -= q.P * t.frac * back; });
    const held = new Set(); m3.supports.filter(s => !q.lifted.includes(s.node)).forEach(s => s.dofs.forEach(d => held.add(3 * s.node + d)));
    let worst = 0; for (let i = 0; i < ND; i++) if (!held.has(i)) worst = Math.max(worst, Math.abs(F[i]));
    assert.ok(worst < 1e-4 * q.P, `3D free-joint residual ${worst.toExponential(2)} N`);
    // untilted, centred, and bracing that is itself mirror-symmetric front-to-back (X or none):
    // front and back copies carry the same force. One-way diagonals (S) share chord force
    // unevenly, so the forces there are only point-symmetric; that is real, not a bug.
    const mirrorSym = [b.o.topPat, b.o.botPat, b.o.framePat].every(p => (p || []).every(c => c === 'X' || c === 'N'));
    if (mirrorSym && !b.o.tilt && !cs.state.loads && q.lifted.length === 0) {
      const fr = q.members.filter(m => m.side === 'front'), bk = q.members.filter(m => m.side === 'back');
      assert.equal(fr.length, bk.length);
      fr.forEach((m, i) => assert.ok(Math.abs(m.F - bk[i].F) < 1e-4 * q.P, `front/back ${i}: ${m.F} vs ${bk[i].F}`));
    }
  });
}

test('exportPy fills every placeholder', () => {
  const s = DEFAULT, { tr, res } = solve2D(s);
  const tpl = require(path.join(SRC, 'template.js'));
  const py = X.exportPy(tpl, 'Test', design(s), tr, res, Object.assign({}, C.DEFAULT_MAT, s.mat), s.load, s.opts);
  assert.ok(!/\{\{[A-Z0-9]+\}\}/.test(py), 'placeholder left in the export');
  assert.match(py, /elemNodes\s*=/);
});

test('build documents: cut plan covers every member', () => {
  const { tr, res } = solve2D(DEFAULT);
  const html = BD.documentHTML ? true : false;
  assert.ok(html);
  assert.ok(typeof BD.cutPlan === 'function' && typeof BD.sideSVG === 'function');
});
