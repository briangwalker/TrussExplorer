// TE-B-187a / #332: the finished-part-shape layer. finishedParts(tr, plan, b) describes every side-truss piece as it is
// cut (outline, end angles, template degrees); checkParts() is the check every drawing must pass. The pictures (side view,
// templates, step pictures) are to draw only from finishedParts, so they can't disagree with the cut guide.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { C, design, DEFAULT } = require('./lib.js');
const BD = require('../src/builddoc.js');

const B = 3.18;
const CASES = {
  default: DEFAULT,
  // #298's arch through the flat bottom chord (the BDT-004 style)
  arch: Object.assign({}, DEFAULT, { height: 30, panels: 4, deskMode: 'length', overlap: 48.4, deskEnds: 'feet', topShape: 'catenary', topEnd: -27, botEnd: 0, pattern: 'pratt', diagLeft: ['P', 'P'], vertLeft: [true, true] }),
  arc: Object.assign({}, DEFAULT, { topShape: 'arc', topEnd: 20 }),
  // the shape of the team's final design (TE-B-190): 4 panels, catenary top, flat bottom, h 22, feet
  final: Object.assign({}, DEFAULT, { height: 22, panels: 4, ratio: 0.5, sideAngle: 90, overall: 296.8, approachDiag: 'X', edgeVert: true, deskVert: true, deskMode: 'length', deskPanels: 1, bottom: 'flat', curve: -30, deskEnds: 'feet', supportMode: 'all', topShape: 'catenary', topEnd: -15, botEnd: 0, tableThick: 30, overlap: 10, pattern: 'custom', diagLeft: ['N', 'P'], diagMiddle: 'X', vertLeft: [true, true] }),
};
const partsOf = st => { const tr = C.buildTruss(design(st)), res = C.analyze(tr, st.mat, st.load, st.opts), plan = BD.cutPlan(tr, B, { stock: 240, force: k => res.members[k].F }); return { tr, plan, parts: BD.finishedParts(tr, plan, B) }; };

test('every piece of the cut guide has one finished part, with both end cuts from the guide', () => {
  for (const [name, st] of Object.entries(CASES)) {
    const { plan, parts } = partsOf(st);
    assert.equal(parts.length, plan.pieces.length, name);
    parts.forEach((P, i) => {
      const q = plan.pieces[i];
      assert.equal(P.item, q.item); assert.deepEqual(P.nodes, q.nodes);
      assert.equal(P.ends.length, 2);
      P.ends.forEach(e => { assert.ok(e.angle >= 0 && e.angle < 90, `${name} item ${P.item}: ${e.angle}`); assert.equal(e.deg, Math.round(e.angle)); });
      if (P.poly) assert.equal(P.poly.length, 4);
    });
  }
});

test('every drawn end leans exactly the cut guide angle, and no end leans past square (the step 10-16 bug)', () => {
  for (const [name, st] of Object.entries(CASES)) {
    const bad = BD.checkParts(partsOf(st).parts, B).filter(p => p.kind !== 'overlap');
    assert.deepEqual(bad, [], name);
  }
});

test('pieces meet face to face: the default bridge has no overlap at all', () => {
  assert.deepEqual(BD.checkParts(partsOf(DEFAULT).parts, B), []);
});

// KNOWN (for Math and the Dev Lead on #332): where the top chord KINKS at a joint, a vertical or diagonal is cut flush to one
// chord member's face, and its corner pokes into the next chord piece by 0.3-0.9 mm. Inside the ±1 mm cut tolerance and
// covered by '+1/-0, sand to fit' for compression parts, but the drawings will show it. Kept from getting worse here.
test('at a kinked chord joint the known overlap stays under 1 mm', () => {
  for (const [name, st] of Object.entries(CASES)) {
    const ov = BD.checkParts(partsOf(st).parts, B).filter(p => p.kind === 'overlap');
    ov.forEach(p => assert.ok(p.depth <= 1.0, `${name}: item ${p.item} into item ${p.intoItem} by ${p.depth} mm`));
    if (ov.length) console.log(`# KNOWN ${name}: ${ov.length} corners 0.3-${Math.max(...ov.map(p => p.depth))} mm into a kinked chord (#332)`);
  }
});

test('the check catches a drawn angle that differs from the guide, an end past square, and a piece through another', () => {
  const { parts } = partsOf(DEFAULT);
  const P = JSON.parse(JSON.stringify(parts));
  const s = P.find(p => p.poly && p.ends[0].angle > 1);
  s.ends[0].angle += 5;   // the guide says one thing, the outline another
  assert.ok(BD.checkParts(P, B).some(p => p.kind === 'angle' && p.piece === s.piece));
  const Q = JSON.parse(JSON.stringify(parts)); Q[0].ends[1].angle = 95;
  assert.ok(BD.checkParts(Q, B).some(p => p.kind === 'range'));
  const R = JSON.parse(JSON.stringify(parts)), mover = R.find(p => p.poly), other = R.find(p => p.poly && p !== mover);
  const c = [0, 1, 2, 3].map(i => other.poly[i]).reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
  const off = [c[0] - mover.poly[0][0], c[1] - mover.poly[0][1]]; mover.poly = mover.poly.map(p => [p[0] + off[0], p[1] + off[1]]);
  assert.ok(BD.checkParts(R, B).some(p => p.kind === 'overlap'));
});
