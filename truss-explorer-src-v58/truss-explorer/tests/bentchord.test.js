// #282: a curved top chord built as one stick bent to the curve. The cut plan makes it one piece (length along the curve),
// and bentCheck gives the Physics Consultant's checks (#194, TE-B-128): the dry-bend strain and the sagitta bending.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { C, design, DEFAULT } = require('./lib.js');
const BD = require('../src/builddoc.js');

const curved = Object.assign({}, DEFAULT, { height: 90, topShape: 'parabola', topEnd: 50, panels: 6, diagLeft: ['X', 'X', 'X'], vertLeft: [true, true, true] });
const solve = st => { const tr = C.buildTruss(design(st)), res = C.analyze(tr, st.mat, st.load, st.opts); return { tr, res, force: k => res.members[k].F }; };
const sig = it => [it.type, it.long.toFixed(3), it.short.toFixed(3), it.cuts.map(BD.cutTxt).join('/'), it.pieces.length].join('|');

test('a flat top chord: "one bent stick" changes nothing', () => {
  const { tr, force } = solve(DEFAULT);
  const off = BD.cutPlan(tr, 3.18, { stock: 240, force }), on = BD.cutPlan(tr, 3.18, { stock: 240, force, bentTop: true });
  assert.equal(on.bendAt.length, 0);
  assert.deepEqual(on.items.map(sig), off.items.map(sig));
});

test('a curved top chord with the option off is cut as before (straight pieces, mitred at each bend)', () => {
  const { tr, force } = solve(curved);
  const a = BD.cutPlan(tr, 3.18, { stock: 240, force }), b = BD.cutPlan(tr, 3.18, { stock: 240, force, bentTop: false });
  assert.deepEqual(b.items.map(sig), a.items.map(sig));
  assert.ok(!a.pieces.some(q => q.bent));
  assert.ok(a.pieces.filter(q => q.type === 'top').length >= 6);
});

test('with the option on, the curved part of the top chord is one bent stick, a little longer than joint to joint', () => {
  const { tr, force } = solve(curved);
  const plan = BD.cutPlan(tr, 3.18, { stock: 240, force, bentTop: true });
  const bent = plan.pieces.filter(q => q.bent);
  assert.equal(bent.length, 1);
  assert.equal(bent[0].members.length, 6);
  const poly = bent[0].members.reduce((s, k) => s + Math.hypot(tr.nodes[tr.elems[k].j][0] - tr.nodes[tr.elems[k].i][0], tr.nodes[tr.elems[k].j][1] - tr.nodes[tr.elems[k].i][1]), 0);
  assert.ok(Math.abs(bent[0].L - poly) < 1e-9, 'centre-to-centre wood stays the model\'s');
  assert.ok(bent[0].arcExtra > 0.2 && bent[0].arcExtra < 1, `along the curve adds ${bent[0].arcExtra} mm`);
  // inner joints of the bent stick run through; the stick's own two ends are cut as before
  plan.bendAt.forEach(n => assert.ok(plan.joints.find(j => j.n === n).notes.some(s => /bent stick/.test(s))));
  assert.notEqual(bent[0].cut0.kind, 'through'); assert.notEqual(bent[0].cut1.kind, 'through');
  assert.ok(plan.items.find(it => it.no === bent[0].item).bent);
});

test("Physics' numbers for a 127 mm crown radius (TE-B-128): 1.25% strain, must be soaked; sagitta 1.1 mm", () => {
  const { tr, res, force } = solve(curved);
  const plan = BD.cutPlan(tr, 3.18, { stock: 240, force, bentTop: true });
  const ck = BD.bentCheck(tr, plan, res, C.DEFAULT_MAT);
  assert.ok(Math.abs(ck.Rmin - 127.2) < 0.1, `R ${ck.Rmin}`);
  assert.ok(Math.abs(ck.strain - 0.0125) < 0.0001, `strain ${ck.strain}`);
  assert.equal(ck.strainLimit, 7.5 / 3000);
  assert.equal(ck.mustSoak, true);
  const crown = ck.pieces[0].members.find(m => Math.abs(m.R - ck.Rmin) < 1e-6);
  assert.ok(Math.abs(crown.e - 1.11) < 0.01, `sagitta ${crown.e}`);
  // the use formula, checked on Physics' worked case: 11.7 N, e 1.1 mm -> 80% of sigma_c
  const use = F => (F / ck.A + F * crown.e / ck.Z) / C.DEFAULT_MAT.sigC;
  assert.ok(Math.abs(use(11.7) - 0.79) < 0.02, `use ${use(11.7)}`);
  assert.ok(Math.abs(crown.use - use(Math.abs(crown.F))) < 1e-12);
  assert.ok(crown.use > crown.straightUse);
});

test('too tight for one stick: a 4-panel arc bent to a 125 mm radius is over 100% and says so', () => {
  const { tr, res, force } = solve(Object.assign({}, DEFAULT, { topShape: 'arc', topEnd: 20 }));
  const plan = BD.cutPlan(tr, 3.18, { stock: 240, force, bentTop: true });
  const ck = BD.bentCheck(tr, plan, res, C.DEFAULT_MAT);
  assert.equal(ck.tooTight, true);
  const html = BD.documentHTML(tr, res, { name: 't', b: 3.18, h: 3.18, nTruss: 2, stock: 240, kerf: 1, massNote: '', capNote: '', mat: C.DEFAULT_MAT }, plan, { steps: true, templates: true });
  assert.match(html, /Too tight for one stick: use straight pieces/);
});

test('a bent stick longer than the stock is spliced at a joint, each piece still bent', () => {
  const { tr, force } = solve(curved);
  const plan = BD.cutPlan(tr, 3.18, { stock: 120, force, bentTop: true });
  const bent = plan.pieces.filter(q => q.type === 'top' && q.members.length > 1);
  assert.ok(bent.length >= 2, `${bent.length} pieces`);
  assert.ok(plan.splices.some(s => s.type === 'top'));
  assert.ok(bent.every(q => q.long <= 120 + 1));
});

test('TE-B-162: the bending sheet has the 11 steps, the key and one 1:1 form per copy', () => {
  const { tr, res, force } = solve(curved);
  const plan = BD.cutPlan(tr, 3.18, { stock: 240, force, bentTop: true });
  const html = BD.bendingSheetHTML(tr, plan, res, { name: 't', code: 'abc', b: 3.18, nTruss: 2, mat: C.DEFAULT_MAT }, { copies: 4 });
  assert.equal((html.match(/class="st"/g) || []).length, 11);
  assert.match(html, /KEY/);
  assert.equal((html.match(/MIRRORED ALONG THE DOTTED LINE/g) || []).length, 4);
  assert.match(html, /PAGE 5 OF 5/);
  // a flat top chord has no sheet
  const flat = solve(DEFAULT), fp = BD.cutPlan(flat.tr, 3.18, { stock: 240, force: flat.force, bentTop: true });
  assert.equal(BD.bendingSheetHTML(flat.tr, fp, flat.res, { b: 3.18 }, { copies: 2 }), null);
});
