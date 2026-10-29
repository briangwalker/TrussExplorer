'use strict';
// Math check of the build documents' numbers (TE-B-129): cut lengths, end cuts, splices, parts list, stock plan, totals.
// Independent of how builddoc.js computes them: each claim is re-derived from the truss geometry.
// Usage: TE_ROOT=<app dir> node cutcheck.js [bridge.json ...]   (no files: the course sample and the presets)
const path = require('path'), fs = require('fs');
const R = path.resolve(process.env.TE_ROOT || '.');
const C = require(R + '/src/core.js'), BD = require(R + '/src/builddoc.js'), L = require(R + '/tests/lib.js');

const PRESETS = [
  ['Course sample', {}],
  ['Simple Warren', { family: 'warren', panels: 4, height: 40 }],
  ['Howe 6', { pattern: 'howe', panels: 6, height: 50 }],
  ['Shallow Pratt sag', { height: 30, bottom: 'parabola', curve: -20 }],
  ['Arch on edges', { family: 'warren', panels: 4, height: 45, topShape: 'parabola', topEnd: 0, deskMode: 'length', overlap: 30, deskEnds: 'feet', edgeBear: true }],
  ['Curved top 8 panels', { panels: 8, height: 60, topShape: 'parabola', topEnd: 20 }],
];
function stateOf(set) {
  const S = Object.assign({}, L.DEFAULT, set);
  if (set.pattern) { const h = Math.floor(S.panels / 2); S.diagLeft = C.patternLeft(set.pattern, h); S.vertLeft = Array(h).fill(true); }
  else if (set.panels && !set.diagLeft) { const h = Math.floor(S.panels / 2); S.diagLeft = Array(h).fill('P'); S.vertLeft = Array(h).fill(true); }
  return S;
}
const cases = process.argv.slice(2).length
  ? process.argv.slice(2).map(f => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return [path.basename(f), Object.assign({}, L.DEFAULT, j.bridge || j)]; })
  : PRESETS.map(([n, s]) => [n, stateOf(s)]);

const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
let bad = 0; const fail = (c, s) => { bad++; console.log(`  ✗ ${c}: ${s}`); };
for (const [name, S] of cases) {
  let tr, r; try { tr = C.buildTruss(L.design(S)); r = C.analyze(tr, Object.assign({}, C.DEFAULT_MAT, S.mat), S.load, S.opts); } catch (e) { console.log(`${name}: could not build (${e.message})`); continue; }
  const doc = Object.assign({ style: 'through', over: {}, stock: 240, kerf: 1 }, S.doc || {}), b = +S.mat.b || 3.18;
  const plan = BD.cutPlan(tr, b, { style: doc.style, over: doc.over || {}, stock: +doc.stock || 240, force: k => r.members && r.members[k] ? r.members[k].F : 0 });
  const nT = +S.load.nTruss || 2, stock = +doc.stock || 240, kerf = +doc.kerf || 0;
  const n0 = bad;
  // 1. every flush end: both edge points of the cut lie on the face of the member it butts against (distance b/2 from its centre line)
  let ends = 0;
  Object.entries(plan.ends).forEach(([key, c]) => {
    if (c.kind !== 'flush') return; ends++;
    const [k, n] = key.split('@').map(Number), e = tr.elems[k], p = tr.nodes[n], o = tr.nodes[e.i === n ? e.j : e.i];
    const u = [(o[0] - p[0]) / len(p, o), (o[1] - p[1]) / len(p, o)], nr = [-u[1], u[0]];
    const t = tr.elems[c.against], q0 = tr.nodes[t.i], q1 = tr.nodes[t.j], tl = [(q1[0] - q0[0]) / len(q0, q1), (q1[1] - q0[1]) / len(q0, q1)];
    [[b / 2, c.eA], [-b / 2, c.eB]].forEach(([off, d]) => {
      const x = [p[0] + nr[0] * off + u[0] * d, p[1] + nr[1] * off + u[1] * d];
      const dist = Math.abs((x[0] - q0[0]) * tl[1] - (x[1] - q0[1]) * tl[0]);
      if (Math.abs(dist - b / 2) > 1e-6) fail(name, `member ${k} at joint ${n}: cut edge is ${dist.toFixed(4)} mm from member ${c.against}'s centre line, not ${(b / 2).toFixed(3)}`);
    });
    // the stated angle matches the edge offset: |eA - eB| = b·tan(angle)
    const want = b * Math.tan(c.ang * Math.PI / 180);
    if (Math.abs(Math.abs(c.eA - c.eB) - want) > 1e-6) fail(name, `member ${k} at joint ${n}: angle ${c.ang.toFixed(2)}° but edges differ by ${Math.abs(c.eA - c.eB).toFixed(3)} mm (expect ${want.toFixed(3)})`);
  });
  // pieces cut at an arch crossing (#298) are parts of one member: check them against the crossing, not the member
  const crossed = new Set((plan.crossings || []).map(c => c.bot));
  // 2. each piece: L is the sum of its members' centre-line lengths; long ≥ short > 0; long - short agrees with the end offsets
  plan.pieces.forEach((q, i) => {
    const sumL = q.members.reduce((s, k) => s + len(tr.nodes[tr.elems[k].i], tr.nodes[tr.elems[k].j]), 0);
    if (!q.members.some(k => crossed.has(k)) && Math.abs(sumL - q.L) > 1e-6) fail(name, `piece ${i} (item ${q.item}): L ${q.L.toFixed(3)} vs members' ${sumL.toFixed(3)}`);
    if (!(q.short > 0) || q.long + 1e-9 < q.short) fail(name, `piece ${i}: long ${q.long} short ${q.short}`);
    if (q.long > stock + 1e-6 && q.members.length > 1) fail(name, `piece ${i} (item ${q.item}) is ${q.long.toFixed(1)} mm, over the ${stock} mm stick, though it could be spliced`);
  });
  // 3. splices tile the chord: after splicing, every member of the truss is in exactly one piece
  const seen = new Map(); plan.pieces.forEach(q => q.members.forEach(k => seen.set(k, (seen.get(k) || 0) + 1)));
  tr.elems.forEach((e, k) => { if (crossed.has(k) ? !(seen.get(k) >= 1) : seen.get(k) !== 1) fail(name, `member ${k} is in ${seen.get(k) || 0} pieces`); });
  // a bottom chord cut at crossings: its pieces still add up to the whole chord (centre to centre)
  if (crossed.size) { const bot = tr.elems.filter(e => e.type === 'bot').reduce((s2, e) => s2 + len(tr.nodes[e.i], tr.nodes[e.j]), 0), parts = plan.pieces.filter(q => q.type === 'bot').reduce((s2, q) => s2 + q.L, 0); if (Math.abs(bot - parts) > 1e-6) fail(name, `bottom chord pieces add to ${parts.toFixed(2)}, chord is ${bot.toFixed(2)}`); }
  // 4. parts list: pieces sharing an item agree to 0.5 mm; quantities add up
  plan.items.forEach(it => it.pieces.forEach(q => { if (Math.abs(q.long - it.long) > 0.5 + 1e-9 || Math.abs(q.short - it.short) > 0.5 + 1e-9) fail(name, `item ${it.no}: a piece is ${q.long.toFixed(2)}/${q.short.toFixed(2)} vs the listed ${it.long.toFixed(2)}/${it.short.toFixed(2)}`); }));
  const qty = plan.items.reduce((s, it) => s + it.pieces.length * nT * it.n, 0), pcs = plan.pieces.reduce((s, q) => s + q.n, 0) * nT;
  if (qty !== pcs) fail(name, `parts list quantity ${qty} vs ${pcs} pieces`);
  // 5. stock plan: no stick over-full, every piece cut once
  const lens = []; plan.pieces.forEach(q => { for (let t = 0; t < q.n * nT; t++) lens.push({ len: q.long, item: q.item }); });
  const bars = BD.stockPlan(lens, stock, kerf);
  bars.forEach((B, i) => { const used = B.cuts.reduce((s, c) => s + c.len, 0) + kerf * (B.cuts.length - 1); if (!B.over && used > stock + 1e-6) fail(name, `stick ${i} needs ${used.toFixed(1)} mm`); if (Math.abs(used - B.used) > 1e-6) fail(name, `stick ${i}: used ${B.used} vs ${used}`); });
  if (bars.reduce((s, B) => s + B.cuts.length, 0) !== lens.length) fail(name, 'stock plan lost a piece');
  // lower bound on sticks: total length with kerfs over the stick length
  const need = lens.reduce((s, p) => s + p.len + kerf, 0) / (stock + kerf), lb = Math.ceil(need - 1e-9);
  // 6. totals: the document's wood (long points) vs the analysis' ΣL (centre lines)
  const totalDoc = plan.pieces.reduce((s, q) => s + q.long * q.n, 0) * nT, centre = plan.pieces.reduce((s, q) => s + q.L * q.n, 0) * nT;
  console.log(`${name}: ${tr.elems.length} members, ${plan.pieces.length} pieces/truss, ${plan.items.length} items, ${plan.splices.length} splices, ${ends} flush ends checked; ` +
    `wood ${totalDoc.toFixed(0)} mm cut (long points) vs ${centre.toFixed(0)} mm centre lines (${(100 * (totalDoc / centre - 1)).toFixed(1)}%); ` +
    `sticks ${bars.length} (lower bound ${lb})${plan.short.length ? `; ${plan.short.length} short members` : ''}${bad === n0 ? ' ✓' : ''}`);
}
console.log(bad ? `${bad} problems` : 'cut-list checks: all passed');
process.exitCode = bad ? 1 : 0;
