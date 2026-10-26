// The v58 diagnostics t29, tfeet, t46, t47 and t61, turned into checks (TE-002).
// Physics that must always hold is asserted directly. The numbers each case produced at v58
// (capacity, deflection, which supports lift, stability) are kept in golden.json, so any change
// in results shows up here. When a ticket changes results on purpose, re-record them with
//   node tests/regressions.test.js --update
// and say which ticket changed them in the commit message.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { C, T3, bridgeFiles, design, DEFAULT } = require('./lib.js');

const GOLD = path.join(__dirname, 'golden.json');
const UPDATE = process.argv.includes('--update');
const gold = !UPDATE && fs.existsSync(GOLD) ? JSON.parse(fs.readFileSync(GOLD, 'utf8')) : {};
const fresh = {};
const r4 = v => (Number.isFinite(v) ? +v.toFixed(4) : String(v));
function golden(key, val) {
  fresh[key] = val;
  if (UPDATE || !(key in gold)) return;
  assert.deepEqual(val, gold[key], `${key} changed since v58; if a ticket meant this, re-record with --update`);
}
const mat = Object.assign({}, C.DEFAULT_MAT, { FS: 2 }), load = { mBook1: 1.5, mBook2: 1, g: 9.81, nTruss: 2 };

// 3D joint balance: largest out-of-balance force at a free joint, as a fraction of the load
function balance3D(m, r) {
  const res = new Float64Array(3 * m.nodes.length);
  m.tr.trib.forEach(t => { const yf = m.nodes[t.node][1], yb = m.nodes[t.node + m.n][1], bk = Math.abs(yb - yf) > 1e-9 ? (0 - yf) / (yb - yf) : 0.5;
    res[3 * t.node + 2] -= r.P * t.frac * (1 - bk); res[3 * (t.node + m.n) + 2] -= r.P * t.frac * bk; });
  r.members.forEach(mm => { const p = m.nodes[mm.i], q = m.nodes[mm.j], dd = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], L = Math.hypot(...dd);
    for (let k = 0; k < 3; k++) { res[3 * mm.i + k] += mm.F * dd[k] / L; res[3 * mm.j + k] -= mm.F * dd[k] / L; } });
  const sup = new Set(); m.supports.forEach(s => { if (!r.lifted.includes(s.node)) s.dofs.forEach(k => sup.add(3 * s.node + k)); });
  let w = 0; for (let i = 0; i < res.length; i++) if (!sup.has(i)) w = Math.max(w, Math.abs(res[i]));
  return w / r.P;
}

// ---- t29: 3D bracing patterns (v29). The legacy-options comparison needed core3d_v24_backup.js, which was
// never kept; legacy option names are still checked to build a stable model.
test('t29: 3D bracing patterns balance at every joint', () => {
  const d = { family: 'grid', span: 200, overall: 300, height: 50, panels: 4, ratio: 1, diagLeft: ['P', 'P'], diagMiddle: 'X', vertLeft: [true, true], approachDiag: 'P', edgeVert: true, deskVert: true, deskMode: 'match', deskPanels: 1, overlap: 50, bottom: 'flat', curve: 0, deskEnds: 'truss', supportMode: 'one', supportOffset: 0, sticks: {}, sideAngle: 90, sideLean: 'in', deck: 'top', bookLen: 242 };
  const tr = C.buildTruss(d);
  const legacy = T3.analyze3D(T3.build3D(tr, { width: 60, tilt: 8, bottomTies: true, topBrace: 'single', botBrace: 'x', sway: true }), mat, load);
  assert.ok(legacy.stable, 'legacy option names still build a stable frame');
  golden('t29/legacy', { cap: r4(legacy.capKg), D: r4(legacy.deckDefl) });
  for (const [lab, o] of [
    ['frames every station D', { framePat: ['D'], topPat: ['S'], botPat: ['S'] }],
    ['frames X, lateral X', { framePat: ['X'], topPat: ['X'], botPat: ['X'] }],
    ['K frames, alt lateral', { framePat: ['K', 'N'], topPat: ['S', 'R'], botPat: ['S'] }],
    ['no frames', { framePat: ['N'], topPat: ['S'], botPat: ['S'] }],
    ['end frames only', { framePat: ['D', 'N', 'N'], topPat: ['S'], botPat: ['N'] }],
  ]) {
    const m = T3.build3D(tr, Object.assign({ width: 60, tilt: 10, bottomTies: true }, o)), r = T3.analyze3D(m, mat, load);
    if (r.stable) {
      assert.ok(balance3D(m, r) < 1e-6, `${lab}: joints out of balance`);
      assert.ok(Math.abs(r.sumZ - r.P) < 1e-6 * r.P, `${lab}: reactions ${r.sumZ} vs load ${r.P}`);
    }
    golden('t29/' + lab, r.stable ? { stable: true, cap: r4(r.capKg), D: r4(r.deckDefl), sway: r4(r.sideSway), wood: r4(r.wood), frames: m.frames.map(f => f.code).join('') } : { stable: false });
  }
});

// ---- tfeet: feet on the table face, edge bearing, friction (v21+). The "unchanged since v21" comparison
// needed core_v21_backup.js, which was never kept; golden.json now plays that role.
test('tfeet: face feet, edge bearing and friction keep the bridge in balance', () => {
  const opts = { deflLimit: 2, minOverlap: 0 };
  const base = { family: 'warren', span: 200, overall: 300, height: 45, panels: 4, ratio: 1, diagLeft: [], diagMiddle: 'X', vertLeft: [], approachDiag: 'P', edgeVert: true, deskVert: true, deskMode: 'length', deskPanels: 1, overlap: 30, bottom: 'flat', curve: 0, deskEnds: 'feet', supportMode: 'all', supportOffset: 0, sticks: {}, sideAngle: 90, sideLean: 'in', deck: 'top', bookLen: 242, tableThick: 30, topShape: 'parabola', topEnd: 0 };
  for (const [lab, v] of [
    ['arch on corner, rollers', {}],
    ['arch on corner, ends bear on edge', { edgeBear: true }],
    ['arch Δh -15 into the face', { topEnd: -15 }],
    ['arch Δh 0, bottom Δp -15', { botEnd: -15, curve: 10, bottom: 'parabola' }],
    ['both ends in face', { topEnd: -10, botEnd: -25 }],
    ['both in face, μ 1.0', { topEnd: -10, botEnd: -25, fricMu: 1.0 }],
    ['grid, flat, truss ends', { family: 'grid', topShape: 'flat', diagLeft: ['P', 'P'], vertLeft: [true, true], deskEnds: 'truss' }],
    ['parabola bottom -20', { bottom: 'parabola', curve: -20 }],
  ]) {
    const tr = C.buildTruss(Object.assign({}, base, v)), r = C.analyze(tr, mat, load, opts);
    if (r.stable) {
      const sumY = r.activeSupports.reduce((s, q) => s + q.Ry, 0), sumX = r.activeSupports.reduce((s, q) => s + q.Rx, 0);
      assert.ok(Math.abs(sumY - r.Ptruss) < 1e-6 * r.Ptruss, `${lab}: ΣRy ${sumY} vs ${r.Ptruss}`);
      assert.ok(Math.abs(sumX) < 1e-6 * r.Ptruss, `${lab}: ΣRx ${sumX} should be 0 (no sideways load)`);
    }
    golden('tfeet/' + lab, r.stable ? { cap: r4(r.capKg), D: r4(r.midDefl), sup: r.activeSupports.map(s => `${s.abut ? 'face' : s.corner ? 'corner' : s.pin ? 'pin' : 'roll'}(${s.Rx.toFixed(2)},${s.Ry.toFixed(2)})`).join(' '), slips: r.slips.length, released: r.released.map(q => q.kind).join(',') } : { stable: false, warn: tr.warn.join(' ') });
  }
});

// ---- t46 / t47: lift-off of desk supports in 2D and 3D (v46-v47)
const T46BASE = { family: 'grid', span: 200, overall: 300, height: 40, panels: 4, ratio: 1, diagLeft: ['P', 'P'], diagMiddle: 'X', vertLeft: [true, true], approachDiag: 'P', edgeVert: true, deskVert: true, deskMode: 'panels', deskPanels: 1, overlap: 30, bottom: 'flat', curve: 0, deskEnds: 'truss', supportMode: 'all', supportOffset: 0, sticks: {}, sideAngle: 90, sideLean: 'in', deck: 'top', bookLen: 242 };
const opts46 = { deflLimit: 2, minOverlap: 5, width: 60 };
test('t46: 2D and 3D lift-off on the base design', () => {
  const tr = C.buildTruss(T46BASE), r = C.analyze(tr, mat, load, opts46);
  assert.ok(r.stable);
  r.activeSupports.forEach(s => assert.ok(s.Ry > -1e-6 * r.Ptruss, 'no support pulls'));
  const q = T3.analyze3D(T3.build3D(tr, { width: 60, tilt: 0, bottomTies: true, topPat: ['S'], botPat: ['S'], framePat: ['D', 'N'] }), mat, load);
  assert.ok(q.stable);
  assert.ok(Math.abs(q.sumZ - q.P) < 1e-6 * q.P, `3D ΣRz ${q.sumZ} vs ${q.P}`);
  golden('t46', { lifted2D: r.lifted.map(s => tr.keys[s.node]).join(','), lifted3D: q.lifted.join(','), cap2D: r4(r.capKg), cap3D: r4(q.capKg) });
});
test('t47: lift-off with curved bottoms, leaning ends and two bracings', () => {
  for (const v of [{ family: 'warren', panels: 6, bottom: 'parabola', curve: 20 }, { family: 'warren', panels: 6, bottom: 'parabola', curve: 20, sideAngle: 60 }, { family: 'grid', panels: 6, diagLeft: ['P', 'P', 'P'], vertLeft: [false, false, false], edgeVert: false, deskVert: false, bottom: 'parabola', curve: 20 }]) {
    const tr = C.buildTruss(Object.assign({}, T46BASE, v)), r = C.analyze(tr, mat, load, opts46);
    const key = 't47/' + JSON.stringify(v);
    if (!r.stable) { golden(key, { stable2D: false }); continue; }
    const out = { lifted2D: r.lifted.map(s => tr.keys[s.node]).join(',') };
    for (const [bl, br] of [['S', { topPat: ['S'], botPat: ['S'], framePat: ['D', 'N'], bottomTies: true }], ['framesX', { topPat: ['N'], botPat: ['N'], framePat: ['X'], bottomTies: true }]]) {
      const m3 = T3.build3D(tr, Object.assign({ width: 60, tilt: 0 }, br)), q = T3.analyze3D(m3, mat, load);
      if (q.stable) assert.ok(Math.abs(q.sumZ - q.P) < 1e-6 * q.P, `${key} ${bl}: ΣRz`);
      out[bl] = q.stable ? q.lifted.map(n => tr.keys[n % tr.nodes.length] + (n >= tr.nodes.length ? 'b' : 'f')).join(',') : 'unstable';
    }
    golden(key, out);
  }
});

// ---- t61: no member may pass through the table top (Decisions, 2026-10-24). Runs on every bridge file present.
test('t61: a member through the table top always fails the design', () => {
  const files = bridgeFiles();
  assert.ok(files.length > 0, 'at least tests/Partner_test.bridge.json');
  files.forEach(file => {
    const S = Object.assign({}, DEFAULT, JSON.parse(fs.readFileSync(file, 'utf8')).bridge);
    const tr = C.buildTruss(design(S)), r = C.analyze(tr, Object.assign({}, C.DEFAULT_MAT, S.mat), S.load, S.opts);
    const T = +S.tableThick || 30, inTable = (x, y) => (x < -0.05 || x > 200.05) && y < -0.05 && y > -T - 0.05;
    const through = [];
    tr.elems.forEach((e, k) => { const a = tr.nodes[e.i], b = tr.nodes[e.j]; for (let t = 0.02; t < 0.99; t += 0.02) if (inTable(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))) { through.push(k); break; } });
    if (through.length && r.stable) {
      assert.equal(r.passes, false, `${path.basename(file)}: members ${through} cross the table but the design passes`);
      assert.ok(r.envelope.some(s => /table top/.test(s)), `${path.basename(file)}: no table-top message`);
    }
  });
});

test.after(() => {
  if (UPDATE) { fs.writeFileSync(GOLD, JSON.stringify(fresh, null, 1) + '\n'); console.log(`golden.json re-recorded (${Object.keys(fresh).length} cases)`); }
});
