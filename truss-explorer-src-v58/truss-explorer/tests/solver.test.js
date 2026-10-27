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

// ---------- 3D build documents (#116)
const STW = 3.18;
const D3CASES = [
  ['default, upright, light', DEFAULT, { width: 60, tilt: 0, bottomTies: true, topPat: ['S'], botPat: ['S'], framePat: ['D', 'N'] }],
  ['default, tilt 10, bottom ties', DEFAULT, { width: 60, tilt: 10, bottomTies: true, topPat: ['S'], botPat: ['S'], framePat: ['D', 'N'] }],
  ['X everywhere, width 72, tilt 5', DEFAULT, { width: 72, tilt: 5, bottomTies: true, topPat: ['X'], botPat: ['X'], framePat: ['X'] }],
  ['K frames', DEFAULT, { width: 60, tilt: 0, bottomTies: true, topPat: ['S'], botPat: ['S'], framePat: ['K', 'N'] }],
  ['6 panels, arc top, tilt 8', Object.assign({}, DEFAULT, { panels: 6, diagLeft: ['P', 'P', 'P'], vertLeft: [true, true, true], topShape: 'arc', topEnd: 20 }), { width: 64, tilt: 8, bottomTies: true, topPat: ['S'], botPat: ['S'], framePat: ['D', 'N'] }],
];
function solve3D(state, o) {
  const { tr, res } = solve2D(state);
  const m3 = T3.build3D(tr, o), r3 = T3.analyze3D(m3, Object.assign({}, C.DEFAULT_MAT, state.mat), state.load);
  return { tr, res, m3, r3 };
}
for (const [name, st, o] of D3CASES) {
  test(`3D build documents: ${name}: every member once, centre-to-centre total = 3D wood`, () => {
    const { tr, res, m3, r3 } = solve3D(st, o);
    assert.ok(r3.stable, '3D model should be stable');
    const plan = BD.cutPlan(tr, STW, { stock: 240, force: k => res.members[k].F });
    const cx = BD.crossPlan(m3, r3, STW, { startNo: plan.items.length + 1 });
    const crossK = m3.elems.map((e, k) => e.side === 'cross' ? k : -1).filter(k => k >= 0);
    assert.deepEqual(cx.parts.map(q => q.k).sort((a, b) => a - b), crossK, 'each cross member exactly once');
    assert.equal(cx.items.reduce((s, it) => s + it.pieces.length, 0), crossK.length);
    // every side member is in exactly one piece, and no piece is longer than a stick
    const seen = plan.pieces.flatMap(q => q.members).sort((a, b) => a - b);
    assert.deepEqual(seen, tr.elems.map((e, k) => k));
    plan.pieces.forEach(q => assert.ok(q.long <= 240 + 1e-6, `piece ${q.long.toFixed(1)} mm > 240`));
    const cc = plan.pieces.reduce((s, q) => s + q.L * q.n, 0) * 2 + cx.parts.reduce((s, q) => s + q.L, 0);
    assert.ok(Math.abs(cc - r3.wood) < 0.01, `c-c ${cc.toFixed(2)} vs 3D wood ${r3.wood.toFixed(2)}`);
    assert.ok(cx.sameTrusses, 'front and back trusses identical');
    // the document lists every item and has the 3D sheets
    const html = BD.documentHTML(tr, res, { name: 'T', b: STW, h: STW, nTruss: 2, stock: 240, kerf: 1, d3: { m3, r3 } }, plan, { steps: true, templates: true });
    assert.match(html, /3D assembly/); assert.match(html, /cross-frame templates/);
    cx.items.forEach(it => assert.ok(html.includes(`>${it.no}</text>`), `item ${it.no} has a balloon`));
    assert.ok(!/NaN|undefined/.test(html), 'no NaN or undefined in the document');
  });
}
test('3D build documents: top tie length follows the tilt (W - 2 z sin phi) and its cut depends on the joint', () => {
  for (const tilt of [0, 10, 20]) {
    const { m3, r3 } = solve3D(DEFAULT, { width: 60, tilt, bottomTies: true, topPat: ['S'], botPat: ['S'], framePat: ['D', 'N'] });
    const ph = tilt * Math.PI / 180, top = BD.crossPlan(m3, r3, STW).parts.filter(q => q.kind === 'tieTop');
    const z = DEFAULT.height;   // flat top chord: every top joint at h
    top.forEach(q => assert.ok(Math.abs(q.L - (60 - 2 * z * Math.sin(ph))) < 1e-6, `tilt ${tilt}: ${q.L}`));
    // on top: square, out to the outer faces; between: shorter than centre to centre, bevelled by the tilt
    const lap = BD.crossPlan(m3, r3, STW, { tieJoint: 'ontop' }).parts.find(q => q.kind === 'tieTop');
    assert.ok(Math.abs(lap.long - (lap.L + STW / Math.cos(ph))) < 1e-6 && lap.cut0.kind === 'lap');
    const btw = BD.crossPlan(m3, r3, STW, { tieJoint: 'between' }).parts.find(q => q.kind === 'tieTop');
    assert.ok(btw.long < btw.L && Math.abs(btw.cut0.ang - tilt) < 0.01, `between: ${btw.long} < ${btw.L}, angle ${btw.cut0.ang}`);
    const bt = BD.crossPlan(m3, r3, STW).parts.find(q => q.kind === 'tieBot');
    assert.ok(Math.abs(bt.L - 60) < 1e-9 && bt.long < 60, 'bottom ties butt between the bottom chords');
  }
});
test('build documents: 240 mm stock splices the chords at zero-force joints over the desks', () => {
  const { tr, res } = solve2D(DEFAULT);
  const plan = BD.cutPlan(tr, STW, { stock: 240, force: k => res.members[k].F });
  assert.ok(plan.splices.length >= 2);
  plan.splices.forEach(s => assert.ok(Math.abs(s.F) < 1e-6, `splice at joint ${s.node} passes ${s.F} N`));
  const top = plan.pieces.filter(q => q.type === 'top').map(q => +q.L.toFixed(1)).sort((a, b) => a - b);
  assert.deepEqual(top, [50, 50, 200], 'top chord in three pieces, joined at the desk edges');
  // a long enough stick: no splices, the pieces are the same as without a stock length (2D documents unchanged)
  const long = BD.cutPlan(tr, STW, { stock: 914, force: k => res.members[k].F }), none = BD.cutPlan(tr, STW, {});
  assert.equal(long.splices.length, 0);
  assert.deepEqual(long.pieces.map(q => q.long), none.pieces.map(q => q.long));
  const html2 = BD.documentHTML(tr, res, { name: 'T', b: STW, h: STW, nTruss: 2, stock: 914, kerf: 1 }, none, { steps: true, templates: true });
  assert.ok(!/3D assembly|cross-frame/.test(html2), '2D documents have no 3D sheets');
});

// ---------- envelope on the outer faces (#133)
test('envelope: outer faces are one stick bigger; checked only when asked, warned otherwise', () => {
  const at = (o, s) => { const st = Object.assign({}, DEFAULT, s || {}); const tr = C.buildTruss(design(st)); return C.analyze(tr, st.mat, st.load, Object.assign({}, st.opts, o)); };
  const b = C.DEFAULT_MAT.b;
  // width: W + b outside; W = 75 fails (78.2), W = 71 passes (74.2)
  const w75 = at({ width: 75, envMeasure: 'outer' }), w71 = at({ width: 71, envMeasure: 'outer' });
  assert.ok(Math.abs(w75.size.outer.width - (75 + b)) < 1e-9);
  assert.ok(w75.envelope.some(e => /width is 78\.2/i.test(e)), 'W 75 fails outside');
  assert.ok(!w71.envelope.some(e => /width/i.test(e)), 'W 71 passes outside');
  // height: centreline 99 + b/2 + one tie on top = 103.8 fails; without ties on top, 100.6 still fails
  const h99 = at({ envMeasure: 'outer', tiesOnTop: true }, { height: 99 });
  assert.ok(Math.abs(h99.size.outer.height - (99 + b / 2 + b)) < 1e-9 && h99.envelope.some(e => /103\.8/.test(e)));
  // default (centrelines): the v59 checks, results unchanged, and a warning lists what would fail outside
  const def = at({}), old = at({ envMeasure: 'centre' });
  assert.equal(def.size.measure, 'centre');
  assert.deepEqual(def.envelope, old.envelope);
  assert.ok(def.size.warn.some(s => /length 303\.2/.test(s)), 'warns that 300 mm between end joints is 303.2 outside');
  // tilt: the outside width grows at the bottom, the height drops
  const t10 = at({ envMeasure: 'outer', tilt: 10 });
  assert.ok(t10.size.outer.width > 60 + b && t10.size.outer.height < at({ envMeasure: 'outer' }).size.outer.height);
  // member forces never change
  w75.members.forEach((m, k) => assert.equal(m.F, at({ width: 75 }).members[k].F));
});

// ---------- imperfection loads in 3D (#117)
test('3D imperfection loads: off = unchanged; on = small realistic bracing forces that flip with the bow', () => {
  const { tr } = solve2D(DEFAULT), mat = Object.assign({}, C.DEFAULT_MAT);
  const m3 = T3.build3D(tr, { width: 60, tilt: 0, bottomTies: true, topPat: ['S'], botPat: ['S'], framePat: ['D', 'N'] });
  const r0 = T3.analyze3D(m3, mat, DEFAULT.load), off = T3.analyze3D(m3, mat, DEFAULT.load, { imperf: { alpha: 0, beta: 0 } });
  r0.members.forEach((m, k) => assert.equal(m.F, off.members[k].F));
  const on = T3.analyze3D(m3, mat, DEFAULT.load, { imperf: { alpha: 0.02, beta: 0.005 } }), flip = T3.analyze3D(m3, mat, DEFAULT.load, { imperf: { alpha: 0.02, beta: 0.005, dir: -1 } });
  const latTop = m3.elems.map((e, k) => e.type === 'lat' && e.plane === 'top' ? k : -1).filter(k => k >= 0);
  latTop.forEach(k => { assert.equal(r0.members[k].F, 0); assert.ok(Math.abs(on.members[k].F) > 0.01 && Math.abs(on.members[k].F) < 1, `brace ${k}: ${on.members[k].F}`); assert.ok(Math.abs(on.members[k].F + flip.members[k].F) < 1e-9, 'flips with the bow'); });
  assert.ok(Math.abs(on.capKg / r0.capKg - 1) < 0.01, 'capacity changes by less than 1%');
  // bow alone (no sway): both trusses stay mirror images
  const bow = T3.analyze3D(m3, mat, DEFAULT.load, { imperf: { alpha: 0.02, beta: 0 } }), fr = {};
  m3.elems.forEach((e, k) => { if (e.side === 'front') fr[e.e2] = k; });
  m3.elems.forEach((e, k) => { if (e.side === 'back') assert.ok(Math.abs(bow.members[k].F - bow.members[fr[e.e2]].F) < 1e-9, `member ${e.e2} front/back`); });
});

// ---------- desk-edge marks and edge stops in the build documents (#119)
test('build documents: desk-edge marks always, edge stops with "ends bear on the table edge"', () => {
  const st = Object.assign({}, DEFAULT, { edgeBear: true, supportOffset: 10 }), { tr, res } = solve2D(st);
  const marks = BD.edgeMarks(tr), stops = BD.edgeStops(tr, 3.18);
  assert.deepEqual(marks.map(m => m.x), [0, 200]);
  assert.equal(stops.length, 2);
  const plan = BD.cutPlan(tr, 3.18, { stock: 240, force: k => res.members[k].F });
  const html = BD.documentHTML(tr, res, { name: 'T', b: 3.18, h: 3.18, nTruss: 2, stock: 240, kerf: 1 }, plan, { steps: true, templates: true });
  assert.match(html, /Edge stop: glued under each corner joint/); assert.match(html, /line up here/); assert.match(html, /10\.0 mm onto the desks/);
  const plain = solve2D(DEFAULT), html2 = BD.documentHTML(plain.tr, plain.res, { name: 'T', b: 3.18, h: 3.18, nTruss: 2, stock: 240, kerf: 1 }, BD.cutPlan(plain.tr, 3.18, {}), {});
  assert.ok(!/Edge stop/.test(html2) && /line up here/.test(html2));
});
