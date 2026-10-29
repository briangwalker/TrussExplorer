// #298: an arch (top chord) that passes through the flat bottom chord between joints. The arch runs through and the
// bottom chord is cut at each crossing, butted flush to the arch's face. Numbers from the Math Consultant's check on #298.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { C, design, DEFAULT } = require('./lib.js');
const BD = require('../src/builddoc.js');

const arch = Object.assign({}, DEFAULT, { height: 30, panels: 4, deskMode: 'length', overlap: 48.4, deskEnds: 'feet', topShape: 'catenary', topEnd: -27, botEnd: 0, pattern: 'pratt', diagLeft: ['P', 'P'], vertLeft: [true, true] });
const plan = st => { const tr = C.buildTruss(design(st)), res = C.analyze(tr, st.mat, st.load, st.opts); return { tr, res, plan: BD.cutPlan(tr, 3.18, { stock: 240, force: k => res.members[k].F }) }; };
const r1 = v => Math.round(v * 10) / 10;

test('the arch crosses the bottom chord at x = 30.9 and 169.1 mm, at 41°', () => {
  const { plan: p } = plan(arch);
  assert.equal(p.crossings.length, 2);
  assert.deepEqual(p.crossings.map(c => r1(c.pt[0])), [30.9, 169.1]);
  p.crossings.forEach(c => { assert.ok(Math.abs(c.pt[1]) < 1e-9); assert.ok(Math.abs(c.angle - 41.1) < 0.05); });
});

test('the bottom chord is three pieces per truss: 78.7/75.1 (x2) and 137.0/129.7 mm, ends 49° flush to the arch, no splice', () => {
  const { tr, plan: p } = plan(arch);
  const bot = p.pieces.filter(q => q.type === 'bot');
  assert.equal(bot.length, 3);
  assert.equal(p.splices.length, 0);
  assert.ok(bot.every(q => q.long <= 240));
  const outer = bot.filter(q => r1(q.long) === 78.7 && r1(q.short) === 75.1), mid = bot.filter(q => r1(q.long) === 137.0 && r1(q.short) === 129.7);
  assert.equal(outer.length, 2); assert.equal(mid.length, 1);
  bot.forEach(q => [q.cut0, q.cut1].filter(c => c.cross).forEach(c => { assert.equal(c.kind, 'flush'); assert.equal(Math.round(c.ang), 49); }));
  // centre to centre, the three pieces still add up to the whole bottom chord
  const L = tr.elems.filter(e => e.type === 'bot').reduce((s, e) => s + Math.hypot(tr.nodes[e.j][0] - tr.nodes[e.i][0], tr.nodes[e.j][1] - tr.nodes[e.i][1]), 0);
  assert.ok(Math.abs(bot.reduce((s, q) => s + q.L, 0) - L) < 1e-9);
});

test('bridges whose chords do not cross are cut as before (no crossings)', () => {
  for (const st of [DEFAULT, Object.assign({}, DEFAULT, { topShape: 'arc', topEnd: 20 }), Object.assign({}, DEFAULT, { panels: 6, diagLeft: ['P', 'P', 'P'], vertLeft: [true, true, true], topShape: 'parabola', topEnd: 0 })]) {
    const { plan: p } = plan(st);
    assert.equal(p.crossings.length, 0);
    assert.ok(!p.pieces.some(q => q.cross));
  }
});

test('the documents mark the crossings and glue the arch before the bottom chord', () => {
  const { tr, res, plan: p } = plan(arch);
  const html = BD.documentHTML(tr, res, { name: 'arch', b: 3.18, h: 3.18, nTruss: 2, stock: 240, kerf: 1, massNote: '', capNote: '' }, p, { steps: true, templates: true });
  assert.match(html, /Arch crossings/);
  assert.ok((html.match(/bottom chord cut: butt to the arch/g) || []).length >= 4);
  assert.ok(html.indexOf('Lay the arch (top chord)') < html.indexOf('Butt the bottom-chord pieces'));
  assert.doesNotMatch(html, /296\.8<\/b>/);
});
