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

test('TE-B-162/166: the bending sheet has steps 0-10, the key, and up to 4 forms on one page with the no-pins panel', () => {
  const { tr, res, force } = solve(curved);
  const plan = BD.cutPlan(tr, 3.18, { stock: 240, force, bentTop: true });
  const html = BD.bendingSheetHTML(tr, plan, res, { name: 't', code: 'abc', b: 3.18, nTruss: 2, mat: C.DEFAULT_MAT }, { copies: 4 });
  assert.equal((html.match(/class="st"/g) || []).length, 11);
  assert.match(html, /KEY/); assert.match(html, /NO PINS\?/); assert.match(html, /BRIANGWALKER\.COM/);
  assert.equal((html.match(/>FORM \d/g) || []).length, 4);
  assert.match(html, /PAGE 2 OF 2/); assert.doesNotMatch(html, /PAGE 3/);
  assert.equal((html.match(/>TRIM</g) || []).length, 8, 'two end-cut lines per form');
  // 5 forms take a second form page
  assert.match(BD.bendingSheetHTML(tr, plan, res, { b: 3.18, mat: C.DEFAULT_MAT }, { copies: 5 }), /PAGE 3 OF 3/);
  // a flat top chord has no sheet
  const flat = solve(DEFAULT), fp = BD.cutPlan(flat.tr, 3.18, { stock: 240, force: flat.force, bentTop: true });
  assert.equal(BD.bendingSheetHTML(flat.tr, fp, flat.res, { b: 3.18 }, { copies: 2 }), null);
});

test('TE-B-169: the black-and-white build set: one cut guide page, one angle page, steps, templates; numbers agree', () => {
  for (const st of [DEFAULT, curved]) {
    const { tr, res, force } = solve(st);
    const plan = BD.cutPlan(tr, 3.18, { stock: 240, force, bentTop: st === curved });
    const html = BD.documentHTML(tr, res, { name: 'Test bridge', code: 'abc', b: 3.18, h: 3.18, nTruss: 2, stock: 240, kerf: 1, massNote: '', capNote: '', mat: C.DEFAULT_MAT }, plan, { minimal: true });
    const n = (html.match(/<section/g) || []).length;
    assert.match(html, new RegExp(`PAGE 1 OF ${n}<`)); assert.match(html, new RegExp(`PAGE ${n} OF ${n} `));
    assert.equal((html.match(/<h2>CUT GUIDE/g) || []).length, 1); assert.equal((html.match(/END-ANGLE TEMPLATES · ACTUAL SIZE/g) || []).length, 1);
    assert.match(html, /BUILD STEPS/i); assert.match(html, /LENGTHS X = ±1 MM · ANGLES ±2°/);
    assert.doesNotMatch(html, /#c0392b|#3a6ea5/, 'black and white');
    // every item is in the cut guide, at its whole-mm length; every angle it names has its template with the same number
    plan.items.forEach(it => assert.match(html, new RegExp(`<td class="c"><b>${it.no}</b></td>[\\s\\S]*?<b>${Math.round(it.long)}</b>`)));
    const used = [...html.matchAll(/(\d+)° (?:FLUSH|MITRE|BEVEL) · (A\d+)/g)];
    used.forEach(([, deg, id]) => assert.match(html, new RegExp(`>${id}: ${deg}°`), `${id} ${deg}`));
    // the steps' callouts use the same whole-mm lengths
    [...html.matchAll(/class="ball"[^>]*>(\d+)<\/span> ([\d.]+)</g)].forEach(([, no, L]) => assert.equal(+L, Math.round(plan.items[no - 1].long)));    // TE-B-171: page 1 is the assembly (3D view, side view with TYP and angles); TYP is not in the cut guide; cut from stock
    assert.match(html, /3D VIEW \(NOT TO SCALE\)/); assert.match(html, /CUT FROM STOCK/);
    const guide = html.slice(html.indexOf('<h2>CUT GUIDE'), html.indexOf('<h2>CUT FROM STOCK'));
    assert.doesNotMatch(guide, /TYP/);
    const nested = BD.documentHTML(tr, res, { name: 'Test bridge', b: 3.18, nTruss: 2, mat: C.DEFAULT_MAT }, plan, { minimal: true, nest: true });
    assert.match(nested, /CUT FROM STOCK[^<]*NESTED/);
    const sticks = h => +(/(\d+) STICKS OF 240 MM/.exec(h) || [])[1];
    assert.ok(sticks(nested) <= sticks(html), `${sticks(nested)} <= ${sticks(html)}`);
  }
});

test('#312: at a bent chord joint, a member is cut to the curve\'s tangent, not to one panel', () => {
  const { tr, force } = solve(curved);
  const plan = BD.cutPlan(tr, 3.18, { stock: 240, force, bentTop: true });
  plan.bendAt.forEach(n => {
    const tops = tr.elems.map((e, k) => ({ e, k })).filter(({ e }) => e.type === 'top' && (e.i === n || e.j === n));
    const dir = ({ e }) => { const o = tr.nodes[e.i === n ? e.j : e.i], p = tr.nodes[n], L = Math.hypot(o[0] - p[0], o[1] - p[1]); return [(o[0] - p[0]) / L, (o[1] - p[1]) / L]; };
    const [d1, d2] = tops.map(dir), tg = [d1[0] - d2[0], d1[1] - d2[1]], tl = Math.hypot(...tg), t0 = [tg[0] / tl, tg[1] / tl];
    plan.pieces.filter(q => !q.bent).forEach(q => [[q.nodes[0], q.cut0], [q.nodes[1], q.cut1]].forEach(([m, c]) => {
      if (m !== n || !c || c.kind !== 'flush') return;
      const k = q.members.find(x => tr.elems[x].i === n || tr.elems[x].j === n), e = tr.elems[k], o = tr.nodes[e.i === n ? e.j : e.i], p = tr.nodes[n];
      const u = [(o[0] - p[0]), (o[1] - p[1])], ul = Math.hypot(...u);
      const theta = Math.acos(Math.min(1, Math.abs((u[0] * t0[0] + u[1] * t0[1]) / ul))) * 180 / Math.PI;
      assert.ok(Math.abs(c.ang - (90 - theta)) < 0.01, `joint ${n}: ${c.ang} vs ${90 - theta}`);
    }));
  });
});

test('#332: on a symmetric truss, mirror members share an item number (bisector cuts at chord kinks)', () => {
  // BDT-004's shape (catenary arch through a flat bottom chord, 4 Pratt panels) and the default bridge. Some other shapes
  // still pick their end joints' 'runs through' member by order, not mirrored (follow-up on #332).
  const bdt004 = Object.assign({}, DEFAULT, { height: 30, panels: 4, overall: 296.8, topShape: 'catenary', topEnd: -27, pattern: 'pratt', diagLeft: ['P', 'P'], vertLeft: [true, true], overlap: 48.4, deskEnds: 'feet' });
  for (const st of [DEFAULT, bdt004]) {
    const { tr, force } = solve(st);
    const plan = BD.cutPlan(tr, 3.18, { stock: 240, force });
    const xs = tr.nodes.map(p => p[0]), mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    const mir = n => tr.nodes.findIndex(q => Math.abs(q[0] - (2 * mid - tr.nodes[n][0])) < 0.05 && Math.abs(q[1] - tr.nodes[n][1]) < 0.05);
    plan.pieces.forEach(q => {
      if (q.pts) return;
      const m0 = mir(q.nodes[0]), m1 = mir(q.nodes[1]); if (m0 < 0 || m1 < 0) return;
      const twin = plan.pieces.find(p2 => !p2.pts && ((p2.nodes[0] === m0 && p2.nodes[1] === m1) || (p2.nodes[0] === m1 && p2.nodes[1] === m0)));
      if (twin) assert.equal(twin.item, q.item, `${q.type} ${q.nodes} vs ${twin.nodes}`);
    });
  }
});
