// ===== Build documents: joint styles, cut lengths and angles, parts list, cutting plan, and a printable document =====
(function (root) {
'use strict';
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1], crs = (a, b) => a[0] * b[1] - a[1] * b[0];
const unit = a => { const L = Math.hypot(a[0], a[1]) || 1; return [a[0] / L, a[1] / L]; };
const perp = a => [-a[1], a[0]];
const rot = (a, t) => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];
// where does the line p + t*u meet the line q + s*c? returns t
function meet(p, u, q, c) { const den = crs(u, c); if (Math.abs(den) < 1e-12) return null; return crs(sub(q, p), c) / den; }

const TYPE_ORDER = { bot: 0, top: 1, end: 2, vert: 3, diag: 4, brace: 5, claw: 6 };
const isChord = e => e.type === 'top' || e.type === 'bot';
// radius of the circle through three points (Infinity when they're in a line)
const circ = (p, q, r) => { const a = Math.hypot(q[0] - p[0], q[1] - p[1]), c = Math.hypot(r[0] - q[0], r[1] - q[1]), d = Math.hypot(r[0] - p[0], r[1] - p[1]);
  const ar = Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / 2; return ar < 1e-9 ? Infinity : a * c * d / (4 * ar); };
// the joints of a piece in order, from its first end, and its members in the same order
// what to draw for each member: the whole member, or, where a piece was cut at an arch crossing (#298), each part with its
// own piece's item number
function drawSegs(tr, plan) {
  const split = {}; plan.pieces.forEach(q => (q.parts || []).forEach(pt => { (split[pt.k] = split[pt.k] || []).push({ a: pt.a, c: pt.c, item: q.item }); }));
  const pieceOf = {}; plan.pieces.forEach(q => q.members.forEach(k => { if (!q.parts) pieceOf[k] = q; }));
  return tr.elems.flatMap((e, k) => split[k] ? split[k].map(s => ({ k, e, a: s.a, c: s.c, item: s.item })) : [{ k, e, a: tr.nodes[e.i], c: tr.nodes[e.j], item: pieceOf[k] ? pieceOf[k].item : 1 }]);
}
function chainOf(tr, q) {
  const seq = [q.nodes[0]], mem = [], left = new Set(q.members); let cur = q.nodes[0];
  while (left.size) { const k = [...left].find(k2 => tr.elems[k2].i === cur || tr.elems[k2].j === cur); if (k == null) break; left.delete(k); mem.push(k); cur = tr.elems[k].i === cur ? tr.elems[k].j : tr.elems[k].i; seq.push(cur); }
  return { seq, mem };
}

// the joints of the truss with the members that meet there (direction pointing away from the joint)
function jointsOf(tr) {
  return tr.nodes.map((p, n) => {
    const m = [];
    tr.elems.forEach((e, k) => { if (e.i === n || e.j === n) { const o = e.i === n ? e.j : e.i; m.push({ k, dir: unit(sub(tr.nodes[o], p)), type: e.type }); } });
    return { n, p, m };
  }).filter(J => J.m.length);
}

// the default rule for one joint. styles: 'through' (chords run through, the others cut flush to the chord face),
// 'square' (chords run through, the others cut square at 90°), 'mitre' (two-member joints mitred at the split, others flush)
function defaultJoint(J, style) {
  const chords = J.m.filter(q => isChord(q));
  let through = null;
  if (chords.length) {
    // prefer a chord that continues straight through this joint; else the chord with the most members against it
    const straight = chords.find(a => chords.some(b => b !== a && dot(a.dir, b.dir) < -Math.cos(0.5 * D2R)));
    through = (straight || chords[0]).k;
  } else if (J.m.length > 2) through = J.m.slice().sort((a, b) => (TYPE_ORDER[a.type] - TYPE_ORDER[b.type]))[0].k;
  const two = J.m.length === 2;
  if (style === 'mitre' && two) return { through: null, end: 'mitre', split: 50 };
  if (two && !chords.length) return { through: null, end: 'mitre', split: 50 };
  return { through, end: style === 'square' ? 'square' : 'flush', split: 50 };
}

// cut geometry for every member end. b = stick width. cfg: { style, over: { [node]: { through, end, split } } }
function cutPlan(tr, b, cfg) {
  cfg = cfg || {}; const style = cfg.style || 'through', over = cfg.over || {};
  const J = jointsOf(tr), byNode = {};
  J.forEach(j => { byNode[j.n] = j; });
  const rule = n => Object.assign(defaultJoint(byNode[n], style), over[n] || {});
  // which members continue straight through a joint as one stick (a chord with its collinear partner at a through joint)
  const parent = tr.elems.map((e, k) => k);
  const find = k => parent[k] === k ? k : (parent[k] = find(parent[k]));
  const cont = {};   // node -> set of member indices that pass through without a cut
  J.forEach(j => {
    const r = rule(j.n); if (r.through == null) return;
    const t = j.m.find(q => q.k === r.through); if (!t) return;
    const partner = j.m.find(q => q.k !== t.k && tr.elems[q.k].type === tr.elems[t.k].type && dot(q.dir, t.dir) < -Math.cos(0.5 * D2R));
    if (partner) { parent[find(partner.k)] = find(t.k); cont[j.n] = new Set([t.k, partner.k]); }
  });
  // end cut of member k at joint n: returns the cut-line distances (along the member, from the joint centre) for its two edges
  const ends = {}, notes = {};
  const note = (n, s) => { (notes[n] = notes[n] || []); if (!notes[n].includes(s)) notes[n].push(s); };
  // a curved top chord built as ONE stick bent to the curve (#282): at every joint where two top-chord members meet at
  // a bend of under 30°, the stick runs through (no cut), and the others cut flush to its face as at any through joint
  const bendAt = new Set();
  if (cfg.bentTop) J.forEach(j => {
    const tops = j.m.filter(q => tr.elems[q.k].type === 'top'); if (tops.length !== 2) return;
    const c = dot(tops[0].dir, tops[1].dir); if (!(c < -Math.cos(30 * D2R)) || c < -Math.cos(0.5 * D2R)) return;
    parent[find(tops[1].k)] = find(tops[0].k); cont[j.n] = new Set([tops[0].k, tops[1].k]); bendAt.add(j.n);
    note(j.n, 'top chord: one bent stick runs through');
  });
  tr.elems.forEach((e, k) => {
    [e.i, e.j].forEach(n => {
      const j = byNode[n], p = j.p, me = j.m.find(q => q.k === k), u = me.dir, nrm = perp(u);
      const r = rule(n), key = k + '@' + n;
      if (cont[n] && cont[n].has(k)) { ends[key] = { kind: 'through', eA: null, eB: null, ang: 0 }; return; }
      const edge = (o, q, c) => meet(add(p, mul(nrm, o)), u, q, c);
      const others = j.m.filter(q => q.k !== k);
      if (!others.length) { ends[key] = { kind: 'free', eA: 0, eB: 0, ang: 0 }; return; }
      // a chord meeting the next chord piece at a shallow bend (a curved chord): mitre the two on the bisector, so
      // neither gets a sliver end; the chord is in compression and bears end grain on end grain (#155, Physics)
      const kink = !over[n] && isChord(tr.elems[k]) ? others.find(q => tr.elems[q.k].type === tr.elems[k].type && dot(u, q.dir) < -Math.cos(30 * D2R) && dot(u, q.dir) > -Math.cos(0.5 * D2R)) : null;
      if (kink) {
        const phi = Math.acos(Math.max(-1, Math.min(1, dot(u, kink.dir)))), sgn = crs(u, kink.dir) >= 0 ? 1 : -1, c = rot(u, sgn * phi / 2);
        ends[key] = { kind: 'mitre', eA: edge(b / 2, p, c), eB: edge(-b / 2, p, c), ang: 90 - phi / 2 * R2D, share: 50, auto: true };
        note(n, `chords mitred on the bisector (${(180 - phi * R2D).toFixed(0)}° bend)`); return;
      }
      if (r.through === k || (r.through != null && cont[n] && cont[n].has(r.through) && false)) {
        // this member is the one on top / running through, and it ends here: square, reaching past the joint to cover the others
        ends[key] = { kind: 'end', eA: -b / 2, eB: -b / 2, ang: 0 }; return;
      }
      if (r.end === 'mitre' && others.length === 1 && r.through == null) {
        const o = others[0], phi = Math.acos(Math.max(-1, Math.min(1, dot(u, o.dir))));
        const sgn = crs(u, o.dir) >= 0 ? 1 : -1;
        const share = (tr.elems[k].i === n ? (r.split != null ? r.split : 50) : 100 - (r.split != null ? r.split : 50)) / 100;
        // the split belongs to the lower-numbered member; the partner takes the rest
        const mine = k < o.k ? (r.split != null ? r.split : 50) / 100 : 1 - (r.split != null ? r.split : 50) / 100;
        const beta = Math.max(1 * D2R, Math.min(phi - 1 * D2R, mine * phi));
        const c = rot(u, sgn * beta);
        ends[key] = { kind: 'mitre', eA: edge(b / 2, p, c), eB: edge(-b / 2, p, c), ang: 90 - beta * R2D, share: Math.round(mine * 100) };
        void share; return;
      }
      // flush or square against the member on top (the through member), or the nearest other member if none is set
      let t = r.through != null ? j.m.find(q => q.k === r.through) : null;
      if (!t || t.k === k) t = others.slice().sort((a, b2) => Math.abs(dot(u, b2.dir)) - Math.abs(dot(u, a.dir)))[0];
      const tl = t.dir;   // along the through member, from the joint
      const side = Math.sign(crs(tl, u)) || 1;
      const face = add(p, mul(perp(tl), side * b / 2));
      const theta = Math.acos(Math.min(1, Math.abs(dot(u, tl))));
      if (theta < 2 * D2R) { ends[key] = { kind: 'free', eA: 0, eB: 0, ang: 0 }; return; }
      const eA = edge(b / 2, face, tl), eB = edge(-b / 2, face, tl);
      // a member meeting the chord at under 20°: a flush cut would leave a long thin feather, so butt it square (#155)
      if (r.end === 'square' || (!over[n] && theta < 20 * D2R)) { const e2 = Math.max(eA, eB); ends[key] = { kind: 'square', eA: e2, eB: e2, ang: 0, against: t.k }; if (r.end !== 'square') note(n, `member ${k} butted square (meets at ${(theta * R2D).toFixed(0)}°)`); }
      else ends[key] = { kind: 'flush', eA, eB, ang: 90 - theta * R2D, against: t.k };
    });
  });
  // pieces: members joined straight through a joint are one stick
  const groups = {};
  tr.elems.forEach((e, k) => { const g = find(k); (groups[g] = groups[g] || []).push(k); });
  const pieces = Object.values(groups).map(ks => {
    // order the members along the piece and find its two ends
    const nodesOf = {}; ks.forEach(k => { [tr.elems[k].i, tr.elems[k].j].forEach(n => { nodesOf[n] = (nodesOf[n] || 0) + 1; }); });
    const endNodes = Object.keys(nodesOf).filter(n => nodesOf[n] === 1).map(Number);
    const [n0, n1] = endNodes.length === 2 ? endNodes : [tr.elems[ks[0]].i, tr.elems[ks[ks.length - 1]].j];
    const L = ks.reduce((s, k) => s + Math.hypot(...sub(tr.nodes[tr.elems[k].j], tr.nodes[tr.elems[k].i])), 0);
    const k0 = ks.find(k => tr.elems[k].i === n0 || tr.elems[k].j === n0), k1 = ks.find(k => tr.elems[k].i === n1 || tr.elems[k].j === n1);
    const c0 = ends[k0 + '@' + n0], c1 = ends[k1 + '@' + n1];
    // edges A/B are left/right of each end's outward direction, so the same physical edge is A at one end and B at the other
    const e0A = c0.eA || 0, e0B = c0.eB || 0, e1A = c1.eA || 0, e1B = c1.eB || 0;
    const sideOne = L - e0A - e1B, sideTwo = L - e0B - e1A;
    const centre = L - (e0A + e0B) / 2 - (e1A + e1B) / 2;
    const e = tr.elems[ks[0]];
    return { members: ks.slice().sort((a, b2) => a - b2), type: e.type, n: e.n || 1, nodes: [n0, n1], L, centre, long: Math.max(sideOne, sideTwo), short: Math.min(sideOne, sideTwo),
      cut0: c0, cut1: c1 };
  }).sort((a, b2) => TYPE_ORDER[a.type] - TYPE_ORDER[b2.type] || a.members[0] - b2.members[0]);
  // an arch that passes through the bottom chord between joints (#298, Physics): two sticks can't pass through each other
  // in one plane, so the top chord runs through and the bottom chord is CUT at each crossing, each piece butted flush to
  // the arch's face (double-glued). The model's member forces are unchanged by the extra joint there (Physics, main f00664e).
  const crossings = [];
  {
    const segX = (a, b2, c, d) => { const r = sub(b2, a), s = sub(d, c), den = crs(r, s); if (Math.abs(den) < 1e-12) return null;
      const t1 = crs(sub(c, a), s) / den, u1 = crs(sub(c, a), r) / den; return t1 > 1e-6 && t1 < 1 - 1e-6 && u1 > 1e-6 && u1 < 1 - 1e-6 ? { t: t1, u: u1 } : null; };
    const tops = tr.elems.map((e, k) => e.type === 'top' ? k : -1).filter(k => k >= 0);
    const out = [];
    pieces.forEach(q => {
      if (q.type !== 'bot') { out.push(q); return; }
      const { seq, mem } = chainOf(tr, q); if (mem.length !== q.members.length) { out.push(q); return; }
      const P = n => tr.nodes[n], pos = [0]; mem.forEach((k, i) => pos.push(pos[i] + Math.hypot(...sub(P(seq[i + 1]), P(seq[i])))));
      const hits = [];
      mem.forEach((k, i) => tops.forEach(tk => { const a2 = P(seq[i]), b2 = P(seq[i + 1]), h = segX(a2, b2, tr.nodes[tr.elems[tk].i], tr.nodes[tr.elems[tk].j]); if (!h) return;
        hits.push({ i, k, tk, s: pos[i] + h.t * (pos[i + 1] - pos[i]), X: add(a2, mul(sub(b2, a2), h.t)), fwd: unit(sub(b2, a2)), tl: unit(sub(tr.nodes[tr.elems[tk].j], tr.nodes[tr.elems[tk].i])) }); }));
      if (!hits.length) { out.push(q); return; }
      hits.sort((x, y) => x.s - y.s);
      // the end cut where a bottom-chord piece meets the arch's face: u points from the crossing into the piece
      const crossCut = (h, u) => { const nrm = perp(u), side = Math.sign(crs(h.tl, u)) || 1, face = add(h.X, mul(perp(h.tl), side * b / 2)), theta = Math.acos(Math.min(1, Math.abs(dot(u, h.tl))));
        return { kind: 'flush', eA: meet(add(h.X, mul(nrm, b / 2)), u, face, h.tl), eB: meet(add(h.X, mul(nrm, -b / 2)), u, face, h.tl), ang: 90 - theta * R2D, against: h.tk, cross: true }; };
      const bounds = [{ s: 0, cut: q.cut0, node: seq[0], pt: P(seq[0]) }].concat(hits.map(h => ({ s: h.s, h, pt: h.X }))).concat([{ s: pos[mem.length], cut: q.cut1, node: seq[seq.length - 1], pt: P(seq[seq.length - 1]) }]);
      for (let j = 0; j + 1 < bounds.length; j++) {
        const A = bounds[j], B = bounds[j + 1], L = B.s - A.s;
        const c0 = A.h ? crossCut(A.h, A.h.fwd) : A.cut, c1 = B.h ? crossCut(B.h, mul(B.h.fwd, -1)) : B.cut;
        const ks = mem.filter((k, i) => pos[i + 1] > A.s + 1e-9 && pos[i] < B.s - 1e-9);
        const parts = ks.map(k => { const i = mem.indexOf(k), a2 = P(seq[i]), b2 = P(seq[i + 1]), d = pos[i + 1] - pos[i], f0 = Math.max(0, (A.s - pos[i]) / d), f1 = Math.min(1, (B.s - pos[i]) / d); return { k, a: add(a2, mul(sub(b2, a2), f0)), c: add(a2, mul(sub(b2, a2), f1)) }; });
        const one = L - (c0.eA || 0) - (c1.eB || 0), two = L - (c0.eB || 0) - (c1.eA || 0);
        out.push({ members: ks.slice().sort((x, y) => x - y), type: q.type, n: q.n, nodes: [A.node != null ? A.node : null, B.node != null ? B.node : null], pts: [A.pt, B.pt], parts, cross: true,
          L, centre: L - ((c0.eA || 0) + (c0.eB || 0)) / 2 - ((c1.eA || 0) + (c1.eB || 0)) / 2, long: Math.max(one, two), short: Math.min(one, two), cut0: c0, cut1: c1 });
      }
      hits.forEach(h => { crossings.push({ pt: h.X, top: h.tk, bot: h.k, angle: Math.acos(Math.min(1, Math.abs(dot(h.fwd, h.tl)))) * R2D }); });
    });
    pieces.length = 0; out.forEach(q => pieces.push(q));
  }
  // a piece longer than one stock stick is spliced at joints (#116): where the chord force is lowest, preferring
  // compression (a square butt carries it by bearing) over tension (needs a splint). cfg.stock, cfg.force(k) -> N
  const splices = [];
  if (cfg.stock > 0) {
    const out = [];
    pieces.forEach(q => {
      if (q.cross || q.long <= cfg.stock + 1e-9 || q.members.length < 2) { out.push(q); return; }
      const seq = [q.nodes[0]], mem = [], left = new Set(q.members); let cur = q.nodes[0];
      while (left.size) { const k = [...left].find(k2 => tr.elems[k2].i === cur || tr.elems[k2].j === cur); if (k == null) break; left.delete(k); mem.push(k); cur = tr.elems[k].i === cur ? tr.elems[k].j : tr.elems[k].i; seq.push(cur); }
      if (left.size || cur !== q.nodes[1]) { out.push(q); return; }
      const m = mem.length, pos = [0];
      mem.forEach((k, i) => pos.push(pos[i] + Math.hypot(...sub(tr.nodes[tr.elems[k].j], tr.nodes[tr.elems[k].i]))));
      const cutAt = i => i === 0 ? q.cut0 : i === m ? q.cut1 : SPLICE;
      const seg = (a, c) => { const d = pos[c] - pos[a], s0 = cutAt(a), s1 = cutAt(c); return Math.max(d - (s0.eA || 0) - (s1.eB || 0), d - (s0.eB || 0) - (s1.eA || 0)); };
      const F = cfg.force || (() => 0);
      // a splice at a joint only has to pass on the force of the lighter side (Physics, #116): a joint next to a
      // zero-force piece (the chord over a desk) costs nothing
      const cost = i => { const f = [F(mem[i - 1]), F(mem[i])]; return Math.min(...f.map(v => v > 0 ? 3 * v : -v)) + 0.05; };
      const best = [0], from = [-1];
      for (let c = 1; c <= m; c++) { best[c] = Infinity; for (let a = 0; a < c; a++) { if (best[a] === Infinity || seg(a, c) > cfg.stock + 1e-9) continue; const v = best[a] + (c < m ? cost(c) : 0); if (v < best[c] - 1e-12) { best[c] = v; from[c] = a; } } }
      if (best[m] === Infinity) { out.push(q); return; }
      const cuts = []; for (let c = m; c > 0; c = from[c]) cuts.unshift([from[c], c]);
      cuts.forEach(([a, c]) => {
        const ks = mem.slice(a, c), c0 = cutAt(a), c1 = cutAt(c), L = pos[c] - pos[a];
        const one = L - (c0.eA || 0) - (c1.eB || 0), two = L - (c0.eB || 0) - (c1.eA || 0);
        out.push({ members: ks.slice().sort((x, y) => x - y), type: q.type, n: q.n, nodes: [seq[a], seq[c]], L, centre: L - ((c0.eA || 0) + (c0.eB || 0)) / 2 - ((c1.eA || 0) + (c1.eB || 0)) / 2, long: Math.max(one, two), short: Math.min(one, two), cut0: c0, cut1: c1 });
        if (c < m) { const f = [F(mem[c - 1]), F(mem[c])].sort((x, y) => Math.abs(x) - Math.abs(y))[0]; splices.push({ node: seq[c], type: q.type, F: f, tension: f > 0.005 }); }
      });
    });
    pieces.length = 0; out.sort((a, b2) => TYPE_ORDER[a.type] - TYPE_ORDER[b2.type] || a.members[0] - b2.members[0]).forEach(q => pieces.push(q));
  }
  // a piece of top chord that bends at one of its joints is cut straight to its length along the joints, then bent (#282)
  pieces.forEach(q => { q.bent = bendAt.size > 0 && q.type === 'top' && q.members.some(k => [tr.elems[k].i, tr.elems[k].j].some(n => bendAt.has(n) && n !== q.nodes[0] && n !== q.nodes[1])); });
  // a bent stick follows the curve between joints, a little longer than the straight joint-to-joint line: add the difference
  // (each panel taken as a circular arc through its two joints with the radius at its tighter end)
  pieces.filter(q => q.bent).forEach(q => {
    const { seq } = chainOf(tr, q), P = n => tr.nodes[n];
    const Rn = seq.map((n, i) => i === 0 || i === seq.length - 1 ? Infinity : circ(P(seq[i - 1]), P(n), P(seq[i + 1])));
    let extra = 0; for (let i = 0; i + 1 < seq.length; i++) { const L = Math.hypot(...sub(P(seq[i + 1]), P(seq[i]))), R = Math.min(Rn[i], Rn[i + 1]); if (Number.isFinite(R)) extra += 2 * R * Math.asin(Math.min(1, L / (2 * R))) - L; }
    q.arcExtra = extra; q.long += extra; q.short += extra; q.centre += extra;
  });
  // parts list: identical pieces (to 0.5 mm and 1°) share an item number
  const keyOf = q => [q.bent ? 'bent' : '', q.type, (Math.round(q.long * 2) / 2).toFixed(1), (Math.round(q.short * 2) / 2).toFixed(1), [Math.round(q.cut0.ang), Math.round(q.cut1.ang)].sort((a, b2) => a - b2).join('/'), q.n].join('|');
  const items = [];
  pieces.forEach(q => { const key = keyOf(q); let it = items.find(i => i.key === key); if (!it) { it = { key, no: items.length + 1, type: q.type, bent: !!q.bent, long: q.long, short: q.short, cuts: [q.cut0, q.cut1], n: q.n, pieces: [] }; items.push(it); } it.pieces.push(q); q.item = it.no; });
  // pieces too short to cut, or short enough that the pin-jointed model gets doubtful (L < 6 stick widths, Physics #155)
  const bad = pieces.filter(q => !(q.short > 0.05) || !(q.long > 0.05)), short = pieces.filter(q => q.L < 6 * b);
  return { joints: J.map(j => Object.assign({ n: j.n, members: j.m.map(q => q.k), notes: notes[j.n] || [] }, rule(j.n), cont[j.n] && bendAt.has(j.n) ? { through: [...cont[j.n]][0] } : {})), ends, pieces, items, splices, bad, short, bendAt: [...bendAt], crossings };
}
const SPLICE = { kind: 'splice', eA: 0, eB: 0, ang: 0 };

// can the bent top chord be built (#282, #194; Physics, TE-B-128)? For each bent piece: the radius at each inner joint
// is the circle through it and its two neighbours on the chord; a member's radius is the tighter of its two ends.
// - bending it dry: outer-fibre strain (b/2)/R against the failure strain sigT/E. Over it: soak or steam, dry on the form.
// - once dried to shape, the wood between two joints sits off the straight force line by the sagitta e = L^2/(8R), so a
//   member force F also bends it by F*e: stress |F|/A + |F|*e/Z, against sigC (compression) or sigT (tension).
// F is the member force at the design load (books x FS), as everywhere in the documents.
function bentCheck(tr, plan, res, mat) {
  mat = mat || {}; const b = +mat.b || 3.18, h = +mat.h || b, E = +mat.E || 3000, sigT = +mat.sigT || 7.5, sigC = +mat.sigC || 4.5;
  const A = b * h, Z = b * h * h / 6, strainLimit = sigT / E;
  const out = (plan.pieces || []).filter(q => q.bent).map(q => {
    const { seq, mem } = chainOf(tr, q);
    const Rn = seq.map((n, i) => i === 0 || i === seq.length - 1 ? Infinity : circ(tr.nodes[seq[i - 1]], tr.nodes[n], tr.nodes[seq[i + 1]]));
    const members = mem.map((k, i) => {
      const L = Math.hypot(...sub(tr.nodes[seq[i + 1]], tr.nodes[seq[i]])), R = Math.min(Rn[i], Rn[i + 1]), e = Number.isFinite(R) ? L * L / (8 * R) : 0, arc = Number.isFinite(R) ? 2 * R * Math.asin(Math.min(1, L / (2 * R))) : L;
      const F = res && res.members && res.members[k] ? res.members[k].F : 0, sigma = Math.abs(F) / A + Math.abs(F) * e / Z;
      return { k, L, arc, R, e, F, sigma, use: sigma / (F < 0 ? sigC : sigT), straightUse: Math.abs(F) / A / (F < 0 ? sigC : sigT) };
    });
    const Rmin = Math.min(...Rn), strain = Number.isFinite(Rmin) ? (b / 2) / Rmin : 0;
    return { item: q.item, nodes: seq, len: q.long, L: q.L, Rmin, strain, members, worstUse: Math.max(0, ...members.map(m => m.use)), worst: members.slice().sort((x, y) => y.use - x.use)[0] };
  });
  const Rmin = Math.min(Infinity, ...out.map(o => o.Rmin)), strain = Number.isFinite(Rmin) ? (b / 2) / Rmin : 0, worstUse = Math.max(0, ...out.map(o => o.worstUse));
  return { pieces: out, Rmin, strain, strainLimit, mustSoak: strain > strainLimit, worstUse, tooTight: worstUse >= 1, A, Z };
}

// first-fit decreasing: how to cut the pieces from stock sticks
function stockPlan(lengths, stock, kerf) {
  const bars = [];
  lengths.slice().sort((a, b) => b.len - a.len).forEach(p => {
    if (p.len > stock) { bars.push({ used: p.len, cuts: [p], over: true }); return; }
    const bar = bars.find(B => !B.over && B.used + kerf + p.len <= stock + 1e-9);
    if (bar) { bar.used += kerf + p.len; bar.cuts.push(p); } else bars.push({ used: p.len, cuts: [p] });
  });
  return bars;
}

// ===== 3D build documents (#116): every member the 3D model adds between the two side trusses =====
const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  unit: a => { const L = Math.hypot(...a) || 1; return [a[0] / L, a[1] / L, a[2] / L]; },
};
const XL = { tieTop: 'Top tie', tieBot: 'Bottom tie', tieMid: 'Tie half (to the mid joint)', latTop: 'Top lateral brace', latBot: 'Bottom lateral brace', sway: 'Sway diagonal' };
const XORDER = { tieTop: 0, tieMid: 1, latTop: 2, sway: 3, tieBot: 4, latBot: 5 };
// which cross part a 3D member is
function crossKind(m3, e) {
  const n = m3.n, mid = e.i >= 2 * n || e.j >= 2 * n, top = new Set(m3.top);
  if (e.type === 'tie') return mid ? 'tieMid' : top.has(e.i % n) ? 'tieTop' : 'tieBot';
  if (e.type === 'lat') return e.plane === 'bottom' ? 'latBot' : 'latTop';
  return 'sway';
}
// lengths and end cuts of every cross member. Each truss lies in a plane tilted by phi about its bottom line; a
// stick of width b occupies +-b/2 either side of that plane. opt.tieJoint: 'ontop' (ties lap over both top chords,
// the default: side grain to side grain, and a flat deck at the joints) or 'between' (butted between the chords).
// Bracing and sway diagonals always butt against the chords' inner faces; bottom ties butt between the bottom chords.
function crossPlan(m3, r3, b, opt) {
  opt = opt || {};
  const onTop = opt.tieJoint !== 'between', n = m3.n, phi = (+m3.tilt || 0) * D2R, sn = Math.sin(phi), cs = Math.cos(phi);
  const normal = i => i < n ? [0, cs, -sn] : [0, cs, sn];   // front and back truss planes
  const parts = [];
  m3.elems.forEach((e, k) => {
    if (e.side !== 'cross') return;
    const kind = crossKind(m3, e), P = m3.nodes[e.i], Q = m3.nodes[e.j], L = Math.hypot(...V.sub(Q, P));
    const pn = kind === 'latTop' || kind === 'latBot' ? [0, 0, 1] : [1, 0, 0];   // the plane the part lies in
    const endCut = (node, other) => {
      if (node >= 2 * n) return { kind: 'free', eA: 0, eB: 0, ang: 0 };   // a mid-width joint: the halves meet at its centre
      const u = V.unit(V.sub(m3.nodes[other], m3.nodes[node])), nu = normal(node), dn = V.dot(u, nu);
      if (Math.abs(dn) < 0.05) return { kind: 'free', eA: 0, eB: 0, ang: 0 };
      if (kind === 'tieTop' && onTop) { const o = (b / 2) / Math.abs(dn); return { kind: 'lap', eA: -o, eB: -o, ang: 0 }; }
      const w = V.unit(V.cross(pn, u)), sg = Math.sign(dn);
      const t = o => (sg * b / 2 - o * V.dot(nu, w)) / dn;
      const eA = t(b / 2), eB = t(-b / 2), ang = Math.atan(Math.abs(eA - eB) / b) * R2D;
      return ang < 0.5 ? { kind: 'square', eA: (eA + eB) / 2, eB: (eA + eB) / 2, ang: 0 } : { kind: 'flush', eA, eB, ang };
    };
    const c0 = endCut(e.i, e.j), c1 = endCut(e.j, e.i);
    const one = L - c0.eA - c1.eB, two = L - c0.eB - c1.eA;
    const m = r3 && r3.members ? r3.members[k] : null;
    parts.push({ k, kind, L, cut0: c0, cut1: c1, long: Math.max(one, two), short: Math.min(one, two), F: m ? m.F : 0, nodes: [e.i, e.j], lab: m3.elemLab ? m3.elemLab[k] : 'k' + k,
      view: pn[2] ? 'plan view' : 'end view' });
  });
  parts.sort((a, c) => XORDER[a.kind] - XORDER[c.kind] || m3.nodes[a.nodes[0]][0] - m3.nodes[c.nodes[0]][0]);
  const start = opt.startNo || 1, items = [];
  const keyOf = q => [q.kind, (Math.round(q.long * 2) / 2).toFixed(1), (Math.round(q.short * 2) / 2).toFixed(1), [Math.round(q.cut0.ang), Math.round(q.cut1.ang)].sort((a, c) => a - c).join('/')].join('|');
  parts.forEach(q => { const key = keyOf(q); let it = items.find(i => i.key === key); if (!it) { it = { key, no: start + items.length, kind: q.kind, type: q.kind, label: XL[q.kind], long: q.long, short: q.short, cc: q.L, cuts: [q.cut0, q.cut1], n: 1, view: q.view, pieces: [], Fmax: 0 }; items.push(it); } it.pieces.push(Object.assign(q, { members: [q.k] })); it.Fmax = Math.max(it.Fmax, Math.abs(q.F)); q.item = it.no; });
  // both trusses are copies of the 2D truss in the model; say so only after checking every member pair
  let same = true; const fr = {}; m3.elems.forEach((e, k) => { if (e.side === 'front') fr[e.e2] = k; });
  m3.elems.forEach(e => { if (e.side !== 'back' || fr[e.e2] == null) return; const f = m3.elems[fr[e.e2]], Lf = Math.hypot(...V.sub(m3.nodes[f.j], m3.nodes[f.i])), Lb = Math.hypot(...V.sub(m3.nodes[e.j], m3.nodes[e.i])); if (Math.abs(Lf - Lb) > 0.05 || f.n !== e.n) same = false; });
  return { parts, items, onTop, sameTrusses: same, tilt: +m3.tilt || 0 };
}

// a view of the 3D frame as SVG, in its own 2D coordinates (v up): 'plan' (top plane from above, x right, back truss up),
// 'bottom' (bottom plane, seen from above through the deck) or 'end' (one cross-frame, y right, z up).
// o: { station, hi: Set of cross part k (coloured), grey: Set (drawn grey), balloons, colour: 'part'|'mono'|css, dims, b }
function view3(m3, cx, o) {
  o = o || {};
  const n = m3.n, b = o.b || 3.18, top = new Set(m3.top), bot = new Set(m3.bottom);
  const partOf = {}; cx.parts.forEach(q => { partOf[q.k] = q; });
  let pr, keep;
  if (o.view === 'end') {
    const fr = m3.frames[o.station || 0];
    const sj = new Set([fr.t, fr.t + n, fr.b, fr.b + n]);
    m3.nodes.forEach((p, i) => { if (i >= 2 * n && Math.abs(p[0] - fr.x) < 1.5) sj.add(i); });
    pr = p => [p[1], p[2]]; keep = e => sj.has(e.i) && sj.has(e.j);
  } else {
    const set = o.view === 'bottom' ? bot : top;
    const inPlane = i => i >= 2 * n ? o.view !== 'bottom' : set.has(i % n);
    pr = p => [p[0], p[1]];
    keep = e => e.side === 'cross' ? (o.view === 'bottom' ? (partOf[e.k] || {}).kind === 'tieBot' || (partOf[e.k] || {}).kind === 'latBot' : ['tieTop', 'tieMid', 'latTop'].includes((partOf[e.k] || {}).kind)) : inPlane(e.i) && inPlane(e.j) && (e.type === 'top' || e.type === 'bot');
  }
  const els = m3.elems.map((e, k) => Object.assign({ k }, e)).filter(keep);
  const pts = []; els.forEach(e => { pts.push(pr(m3.nodes[e.i]), pr(m3.nodes[e.j])); });
  if (!pts.length) return null;
  const pad = o.dims ? 20 : 10, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  const Y = y => y1 - y + y0, out = [];
  if (o.view === 'end') out.push(`<rect x="${x0}" y="${Y(0)}" width="${x1 - x0}" height="${Math.min(6, -y0 + 0)}" fill="#e9e9e9"/>`);
  // side-truss sticks first (context), then the cross parts on top
  // a cross part is drawn as cut: trimmed to the chord faces, or running past them when it laps over the chords
  const ends3 = e => { const P = m3.nodes[e.i], Q = m3.nodes[e.j], part = partOf[e.k]; if (!part) return [P, Q];
    const u = V.unit(V.sub(Q, P)), s0 = (part.cut0.eA + part.cut0.eB) / 2, s1 = (part.cut1.eA + part.cut1.eB) / 2;
    return [P.map((v, i) => v + u[i] * s0), Q.map((v, i) => v - u[i] * s1)]; };
  els.slice().sort((a, c) => (a.side === 'cross') - (c.side === 'cross')).forEach(e => {
    const [P3, Q3] = ends3(e), p = pr(P3), q = pr(Q3), d = sub(q, p);
    if (Math.hypot(...d) < 1e-6) { out.push(`<rect x="${p[0] - b / 2}" y="${Y(p[1]) - b / 2}" width="${b}" height="${b}" fill="#d9d9d9" stroke="#111" stroke-width=".2"/>`); return; }
    const nv = mul(perp(unit(d)), b * Math.sqrt(e.side === 'cross' ? 1 : (e.n || 1)) / 2);
    const part = partOf[e.k], hi = part && (!o.hi || o.hi.has(e.k)), gr = !part || (o.grey && o.grey.has(e.k)) || (part && o.hi && !o.hi.has(e.k));
    if (part && o.hi && !o.hi.has(e.k) && !(o.grey && o.grey.has(e.k))) return;
    const col = !part ? '#e3e3e3' : gr ? '#c8c8c8' : o.colour === 'part' ? colOf(part.item) : o.colour === 'mono' ? '#fff' : (o.colour || '#c0392b');
    const poly = [add(p, nv), add(q, nv), sub(q, nv), sub(p, nv)].map(z => `${z[0]},${Y(z[1])}`).join(' ');
    out.push(`<polygon points="${poly}" fill="${col}" stroke="${gr && part ? '#bbb' : '#111'}" stroke-width=".2" opacity="${hi ? 0.95 : 0.8}"/>`);
    if (o.dash && part && hi) { const da = dashOf(part.item); if (da) out.push(`<line x1="${p[0]}" y1="${Y(p[1])}" x2="${q[0]}" y2="${Y(q[1])}" stroke="#111" stroke-width=".55" stroke-dasharray="${da}"/>`); }
  });
  const cen = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  if (o.balloons) {
    const done = new Set();
    els.forEach(e => {
      const part = partOf[e.k]; if (!part || done.has(part.item) || (o.hi && !o.hi.has(e.k))) return; done.add(part.item);
      const a = pr(m3.nodes[e.i]), c = pr(m3.nodes[e.j]), m = mul(add(a, c), 0.5), dd = unit(sub(c, a)), nv = perp(dd);
      const side = dot(nv, sub(m, cen)) >= 0 ? 1 : -1, r = 2.9, bp = add(m, mul(nv, side * (b + 6)));
      out.push(`<line x1="${m[0]}" y1="${Y(m[1])}" x2="${bp[0]}" y2="${Y(bp[1])}" stroke="#111" stroke-width=".2"/><circle cx="${bp[0]}" cy="${Y(bp[1])}" r="${r}" fill="${o.colour === 'part' ? colOf(part.item) : '#fff'}" stroke="#111" stroke-width=".3"/><text x="${bp[0]}" y="${Y(bp[1]) + 1.15}" font-size="3.2" font-weight="bold" text-anchor="middle" fill="${o.colour === 'part' ? '#fff' : '#111'}" font-family="Arial, sans-serif">${part.item}</text>`);
    });
  }
  if (o.dims) {
    if (o.view === 'end') {
      const fr = m3.frames[o.station || 0], T = [pr(m3.nodes[fr.t]), pr(m3.nodes[fr.t + n])], B = [pr(m3.nodes[fr.b]), pr(m3.nodes[fr.b + n])];
      out.push(dimLine(T[0], T[1], 16, f1(Math.abs(T[1][0] - T[0][0])) + ' c-c', Y));
      if (Math.abs(B[1][0] - B[0][0] - (T[1][0] - T[0][0])) > 0.05 || Math.abs(B[0][1] - T[0][1]) > 0.5) out.push(dimLine(B[1], B[0], 16, f1(Math.abs(B[1][0] - B[0][0])) + ' c-c', Y));
      if (Math.abs(T[0][1] - B[0][1]) > 0.5) out.push(dimLine([B[0][0], B[0][1]], [B[0][0], T[0][1]], 16, f1(T[0][1] - B[0][1]) + ' high', Y));
    } else {
      const ends = els.filter(e => e.side === 'cross');
      if (ends.length) { const e = ends.slice().sort((a, c) => m3.nodes[a.i][0] - m3.nodes[c.i][0])[0]; const a = pr(m3.nodes[e.i]), c = pr(m3.nodes[e.j]); if (Math.abs(a[0] - c[0]) < 0.5) out.push(dimLine(a[1] < c[1] ? a : c, a[1] < c[1] ? c : a, 9, f1(Math.abs(c[1] - a[1])) + ' c-c', Y)); }
    }
  }
  m3.nodes.forEach((p, i) => { if (els.some(e => e.i === i || e.j === i)) { const q = pr(p); out.push(`<circle cx="${q[0]}" cy="${Y(q[1])}" r=".7" fill="#111"/>`); } });
  return { svg: out.join(''), box: [x0, y0, x1 - x0, y1 - y0], Y, els };
}
// stations whose cross-frames are built the same (same members, same lengths): one end-view drawing and template each
function distinctFrames(m3, cx) {
  const groups = [];
  m3.frames.forEach((fr, s) => {
    const v = view3(m3, cx, { view: 'end', station: s }); if (!v) return;
    const sig = v.els.filter(e => e.side === 'cross').map(e => { const p = cx.parts.find(q => q.k === e.k); return p ? p.item + '@' + Math.round(m3.nodes[e.i][1]) : ''; }).sort().join(',') + '|' + fr.code;
    const g = groups.find(q => q.sig === sig); if (g) g.stations.push(s); else groups.push({ sig, stations: [s], code: fr.code, x: fr.x });
  });
  return groups;
}

const TL = { top: 'Top chord', bot: 'Bottom chord', end: 'End post', vert: 'Vertical', diag: 'Diagonal', brace: 'Edge brace', claw: 'Claw hook' };
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cutTxt = c => c.auto && c.kind === 'mitre' ? `${Math.round(c.ang)}° mitre (bend)` : c.kind === 'through' ? 'runs through' : c.kind === 'end' ? 'square, runs past' : c.kind === 'free' ? 'square' : c.kind === 'square' ? 'square (90°)' : c.kind === 'splice' ? 'square, splice at a joint' : c.kind === 'lap' ? 'square, laps the chord' : `${Math.round(c.ang)}° ${c.kind === 'mitre' ? 'mitre' : c.kind === 'bevel' ? 'bevel' : 'flush'}`;

// one colour and one line pattern per item, so a part can be told apart on screen and in black-and-white print
const PALETTE = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf', '#8c564b', '#e377c2', '#0b6e4f', '#bcbd22', '#393b79', '#ad494a'];
const DASHES = ['', '6 1.6', '1.6 1.2', '7 1.4 1.4 1.4', '3 1.5', '10 2', '4 1 1 1 1 1', '2 3', '8 1 2 1', '5 3', '1 1', '12 1.5 3 1.5'];
const colOf = no => PALETTE[(no - 1) % PALETTE.length], dashOf = no => DASHES[(no - 1) % DASHES.length];

// an aligned dimension between points a and b (model coordinates), offset d to the left of a->b. Y flips y for SVG.
function dimLine(a, b, d, txt, Y, sz) {
  sz = sz || 3.2;
  const u = unit(sub(b, a)), n = perp(u), A = add(a, mul(n, d)), B = add(b, mul(n, d)), g = 1, ex = 1.5;
  const P = q => `${q[0]},${Y(q[1])}`;
  const e1a = add(a, mul(n, Math.sign(d) * g)), e1b = add(A, mul(n, Math.sign(d) * ex)), e2a = add(b, mul(n, Math.sign(d) * g)), e2b = add(B, mul(n, Math.sign(d) * ex));
  const ah = 2.2, aw = 0.7;
  const arrow = (tip, dir) => { const base = sub(tip, mul(dir, ah)); return `<polygon points="${P(tip)} ${P(add(base, mul(perp(dir), aw)))} ${P(sub(base, mul(perp(dir), aw)))}" fill="#111"/>`; };
  const m = mul(add(A, B), 0.5), tp = add(m, mul(n, Math.sign(d || 1) * 1.6));
  let ang = Math.atan2(u[1], u[0]) * R2D; if (ang > 90.01) ang -= 180; if (ang < -90.01) ang += 180;
  return `<g stroke="#111" stroke-width=".22" fill="none"><line x1="${e1a[0]}" y1="${Y(e1a[1])}" x2="${e1b[0]}" y2="${Y(e1b[1])}"/><line x1="${e2a[0]}" y1="${Y(e2a[1])}" x2="${e2b[0]}" y2="${Y(e2b[1])}"/><line x1="${A[0]}" y1="${Y(A[1])}" x2="${B[0]}" y2="${Y(B[1])}"/></g>${arrow(A, mul(u, -1))}${arrow(B, u)}
    <text x="${tp[0]}" y="${Y(tp[1])}" font-size="${sz}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${-ang} ${tp[0]} ${Y(tp[1])})" font-family="Arial, sans-serif" fill="#111" paint-order="stroke" stroke="#fffdf5" stroke-width=".9">${txt}</text>`;
}

// side view as SVG. o: { highlight: Set, grey: Set, labels, balloons, b, color: 'part' | 'mono' | css colour, dash: true, dims: true }
function sideSVG(tr, plan, o) {
  o = o || {};
  const xs = tr.nodes.map(p => p[0]), ys = tr.nodes.map(p => p[1]);
  const pad = o.dims ? 26 : 14;
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys, -6) - pad, y1 = Math.max(...ys, 6) + pad;
  const W = x1 - x0, H = y1 - y0, Y = y => y1 - y + y0;
  const b = o.b || 3.18, out = [];
  out.push(`<rect x="${x0}" y="${Y(0)}" width="${-x0}" height="${Math.min(10, -y0)}" fill="#e9e9e9"/><rect x="${tr.design.span || 200}" y="${Y(0)}" width="${x1 - (tr.design.span || 200)}" height="${Math.min(10, -y0)}" fill="#e9e9e9"/>`);
  drawSegs(tr, plan).forEach(({ e, k, a: p, c: q, item: it }) => {
    const hi = o.highlight ? o.highlight.has(k) : true, gr = o.grey && o.grey.has(k);
    if (o.highlight && !hi && !gr) return;
    const w = b * Math.sqrt(e.n || 1);
    const col = gr ? '#c8c8c8' : o.color === 'part' ? colOf(it) : o.color === 'mono' ? '#fff' : (o.color || '#1f4e8c');
    const d = sub(q, p), u = unit(d), nv = mul(perp(u), w / 2);
    const poly = [add(p, nv), add(q, nv), sub(q, nv), sub(p, nv)].map(z => `${z[0]},${Y(z[1])}`).join(' ');
    out.push(`<polygon points="${poly}" fill="${col}" stroke="${gr ? '#bbb' : '#111'}" stroke-width=".2" opacity="${gr ? 0.7 : 0.95}"/>`);
    if (o.dash && !gr) { const da = dashOf(it); if (da) out.push(`<line x1="${p[0]}" y1="${Y(p[1])}" x2="${q[0]}" y2="${Y(q[1])}" stroke="#111" stroke-width=".55" stroke-dasharray="${da}"/>`); }
  });
  tr.nodes.forEach(p => out.push(`<circle cx="${p[0]}" cy="${Y(p[1])}" r=".7" fill="#111"/>`));
  if (o.labels) {
    // an item is labelled once: identical parts are obvious from the parts list and the balloon
    const done = new Set();
    plan.pieces.forEach(q => {
      if (o.highlight && !q.members.some(k => o.highlight.has(k))) return;
      if (done.has(q.item)) return; done.add(q.item);
      const a = q.pts ? q.pts[0] : tr.nodes[q.nodes[0]], c = q.pts ? q.pts[1] : tr.nodes[q.nodes[1]], m = mul(add(a, c), 0.5), d = unit(sub(c, a)), nv = perp(d);
      // dimension on the outside of the truss: away from its centre
      const cen = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
      const side = dot(nv, sub(m, cen)) >= 0 ? 1 : -1;
      if (o.dims) out.push(dimLine(a, c, side * (b + 4), f1(q.long), Y));
      else { const tp = add(m, mul(nv, 5)); let ang = Math.atan2(d[1], d[0]) * R2D; if (ang > 90) ang -= 180; if (ang < -90) ang += 180; out.push(`<text x="${tp[0]}" y="${Y(tp[1])}" font-size="3.3" text-anchor="middle" transform="rotate(${-ang} ${tp[0]} ${Y(tp[1])})" font-family="Arial, sans-serif">${f1(q.long)}</text>`); }
      if (o.balloons) {
        const bp = add(m, mul(nv, -side * (b + 7))), r = 2.9;
        out.push(`<line x1="${m[0]}" y1="${Y(m[1])}" x2="${bp[0]}" y2="${Y(bp[1])}" stroke="#111" stroke-width=".2"/><circle cx="${bp[0]}" cy="${Y(bp[1])}" r="${r}" fill="${o.color === 'part' ? colOf(q.item) : '#fff'}" stroke="#111" stroke-width=".3"/><text x="${bp[0]}" y="${Y(bp[1]) + 1.15}" font-size="3.2" font-weight="bold" text-anchor="middle" fill="${o.color === 'part' ? '#fff' : '#111'}" font-family="Arial, sans-serif">${q.item}</text>`);
      }
    });
  }
  if (o.dims) {
    const lo = Math.min(...xs), hi = Math.max(...xs), top = Math.max(...ys), bot = Math.min(...ys, 0);
    out.push(dimLine([lo, bot], [hi, bot], -(Math.abs(bot - Math.min(...ys)) + 16), f1(hi - lo) + ' overall', Y, 3.4));
    if (top > 0.5) out.push(dimLine([lo, 0], [lo, top], 12 + (Math.min(...xs) < 0 ? 0 : 0), f1(top), Y, 3.4));
  }
  return { svg: out.join(''), box: [x0, y0, W, H], Y };
}

// one part detail: the bar to scale along its length, with enlarged end details that show the cut
function partDetail(it, b, colour) {
  const q = it.pieces[0], L = q.L;
  const c0 = q.cut0, c1 = q.cut1, z = v => v == null ? 0 : v;
  // outline in the piece's own axes: x along the stick, y across (+b/2 is edge A at end 0)
  const pts = [[z(c0.eA), b / 2], [L - z(c1.eB), b / 2], [L - z(c1.eA), -b / 2], [z(c0.eB), -b / 2]];
  const x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0]));
  const len = x1 - x0, Wd = 120, sx = Wd / Math.max(len, 1), sy = Math.min(sx * 1.6, 2.2);   // the bar: true length, width shown thicker
  const P = p => `${(p[0] - x0) * sx + 4},${(-p[1]) * sy + 14}`;
  const bar = `<polygon points="${pts.map(P).join(' ')}" fill="${colour}" stroke="#111" stroke-width=".25"/>`;
  const dim = (xa, xb, y, t) => `<g stroke="#111" stroke-width=".2"><line x1="${(xa - x0) * sx + 4}" y1="${y}" x2="${(xb - x0) * sx + 4}" y2="${y}"/><line x1="${(xa - x0) * sx + 4}" y1="${y - 1.5}" x2="${(xa - x0) * sx + 4}" y2="${y + 1.5}"/><line x1="${(xb - x0) * sx + 4}" y1="${y - 1.5}" x2="${(xb - x0) * sx + 4}" y2="${y + 1.5}"/></g><text x="${((xa + xb) / 2 - x0) * sx + 4}" y="${y - 1.2}" font-size="3.2" text-anchor="middle" font-family="Arial">${t}</text>`;
  const top = [pts[0][0], pts[1][0]], botE = [pts[3][0], pts[2][0]];
  const longTop = top[1] - top[0] >= botE[1] - botE[0];
  let s = bar + dim(longTop ? top[0] : botE[0], longTop ? top[1] : botE[1], 6.5, `${f1(it.long)} long point`);
  if (Math.abs(it.long - it.short) > 0.05) s += dim(longTop ? botE[0] : top[0], longTop ? botE[1] : top[1], 23, `${f1(it.short)} short point`);
  // enlarged ends (×6) with the cut angle
  const end = (cut, which, ox) => {
    const k = 6, seg = 9;
    const loc = which === 0 ? [[pts[0][0], b / 2], [pts[3][0], -b / 2]] : [[pts[1][0], b / 2], [pts[2][0], -b / 2]];
    const ref = which === 0 ? Math.min(loc[0][0], loc[1][0]) : Math.max(loc[0][0], loc[1][0]);
    const T = p => [(p[0] - ref) * k * (which === 0 ? 1 : 1), p[1] * k];
    const inner = which === 0 ? ref + seg : ref - seg;
    const poly = which === 0 ? [loc[0], [inner, b / 2], [inner, -b / 2], loc[1]] : [[inner, b / 2], loc[0], loc[1], [inner, -b / 2]];
    const pp = poly.map(T).map(p => `${p[0] + ox},${-p[1] + 50}`).join(' ');
    const lbl = cut.kind === 'through' ? 'runs through' : cut.kind === 'splice' ? 'square: splice' : cut.kind === 'lap' ? 'square: laps the chord' : cut.kind === 'end' || cut.kind === 'free' || cut.kind === 'square' || Math.abs(cut.ang) < 0.5 ? 'square cut' : `${Math.round(cut.ang)}° from square${cut.kind === 'bevel' ? ' (bevel, through the thickness)' : ''}`;
    return `<polygon points="${pp}" fill="${colour}" stroke="#111" stroke-width=".3"/><text x="${ox + (which === 0 ? 0 : -54)}" y="${50 + b * k / 2 + 6}" font-size="3.2" font-family="Arial">${which === 0 ? 'end 1' : 'end 2'}: ${lbl}</text>`;
  };
  s += end(c0, 0, 6) + end(c1, 1, 122);
  return `<svg viewBox="0 0 130 66" class="pd">${s}</svg>`;
}

// the printable document (HTML; print it or save it as PDF). Every sheet is sized to fit one US-letter landscape page.
// where the desk edges fall on the bottom chord (#119): the support offset s puts the support joint s mm onto the desk,
// so the builder lines this mark up with the desk edge, not the joint
function edgeMarks(tr) {
  const S = tr.design.span || 200, out = [];
  [0, S].forEach(x => {
    const e = tr.elems.find(q => q.type === 'bot' && Math.min(tr.nodes[q.i][0], tr.nodes[q.j][0]) <= x + 1e-6 && Math.max(tr.nodes[q.i][0], tr.nodes[q.j][0]) >= x - 1e-6);
    if (!e) return; const a = tr.nodes[e.i], c = tr.nodes[e.j], dx = c[0] - a[0];
    out.push({ x, y: Math.abs(dx) < 1e-9 ? Math.min(a[1], c[1]) : a[1] + (c[1] - a[1]) * (x - a[0]) / dx, left: x < S / 2 });
  });
  return out;
}
// edge stops (#119): with "ends bear on the table edge", a short stick glued under each corner joint reaches down the
// table's face, so the edge can push the bridge inward as the model assumes (#58)
const STOP_LEN = 10;
function edgeStops(tr, b) {
  if (!tr.design.edgeBear) return [];
  const S = tr.design.span || 200;
  return tr.supports.filter(s => s.corner).map(s => { const p = tr.nodes[s.node], left = p[0] < S / 2;
    return { node: s.node, x0: left ? p[0] : p[0] - b, x1: left ? p[0] + b : p[0], y0: p[1] - STOP_LEN, y1: p[1], left }; });
}
function markSVG(tr, marks, stops, Y, b, colour) {
  return marks.map(m => `<g><line x1="${m.x}" y1="${Y(m.y) - 5}" x2="${m.x}" y2="${Y(m.y) + 5}" stroke="#0b6e4f" stroke-width=".45" stroke-dasharray="1.2 .8"/><text x="${m.x + (m.left ? -1.2 : 1.2)}" y="${Y(m.y) + 8.5}" font-size="2.6" text-anchor="${m.left ? 'end' : 'start'}" fill="#0b6e4f" font-family="Arial">desk edge: line up here</text></g>`).join('')
    + stops.map(s => `<rect x="${s.x0}" y="${Y(s.y1)}" width="${s.x1 - s.x0}" height="${s.y1 - s.y0}" fill="${colour || '#fff'}" stroke="#111" stroke-width=".25"/><text x="${s.left ? s.x1 + 1 : s.x0 - 1}" y="${Y(s.y0) - 1}" font-size="2.6" text-anchor="${s.left ? 'start' : 'end'}" fill="#111" font-family="Arial">edge stop</text>`).join('');
}

// the full-size bending form for a bent top chord (#282): the curve through the chord's joints (a smooth curve, the shape a
// stick takes when it's pinned through those points), the stick's two faces, a tick and number at every joint, and pin
// marks beside the stick on alternate sides every ~17 mm. Returns the SVG pieces in mm, y up in the truss's own axes.
function bendForm(tr, piece, b) {
  const { seq } = chainOf(tr, piece), P = seq.map(n => tr.nodes[n]), m = P.length;
  // Catmull-Rom through the joints, sampled finely
  const at = (i, s) => { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(m - 1, i + 2)], s2 = s * s, s3 = s2 * s;
    return [0, 1].map(d => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * s + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * s2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * s3)); };
  // the two end panels are drawn straight (the stick is trimmed there, and a spline through a short end panel can loop)
  const lin = (i, s) => [P[i][0] + (P[i + 1][0] - P[i][0]) * s, P[i][1] + (P[i + 1][1] - P[i][1]) * s];
  const pts = [], at0 = [0]; for (let i = 0; i + 1 < m; i++) for (let j = 0; j < 24; j++) pts.push((i === 0 || i === m - 2) && m > 3 ? lin(i, j / 24) : at(i, j / 24)); pts.push(P[m - 1]);
  for (let i = 1; i < pts.length; i++) at0.push(at0[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const nrm = i => { const a2 = pts[Math.max(0, i - 1)], c2 = pts[Math.min(pts.length - 1, i + 1)]; return perp(unit(sub(c2, a2))); };
  const off = d => pts.map((p, i) => add(p, mul(nrm(i), d)));
  const len = at0[at0.length - 1];
  const pins = []; for (let s = 8, side = 1; s < len - 4; s += 17, side = -side) { const i = at0.findIndex(v => v >= s); pins.push(add(pts[i], mul(nrm(i), side * (b / 2 + 1.6)))); }
  const ticks = seq.map((n, i) => { const k = i === 0 ? 0 : i === m - 1 ? pts.length - 1 : i * 24, nv = nrm(k); return { n, p: P[i], a: add(P[i], mul(nv, b / 2 + 4)), c: sub(P[i], mul(nv, b / 2 + 4)) }; });
  return { pts, up: off(b / 2), dn: off(-b / 2), pins, ticks, len, xs: pts.map(p => p[0]), ys: pts.map(p => p[1]) };
}
function documentHTML(tr, res, meta, plan, opt) {
  opt = opt || {};
  const b = meta.b || 3.18, nT = meta.nTruss || 2, colourMode = opt.colour === false ? 'mono' : 'part', dash = !!opt.dash;
  const today = new Date().toLocaleDateString();
  // 3D: every member the model adds between the trusses, numbered after the side-truss items
  const d3 = meta.d3 && meta.d3.m3 ? meta.d3 : null;
  const cx = d3 ? crossPlan(d3.m3, d3.r3, b, { tieJoint: d3.tieJoint, startNo: plan.items.length + 1 }) : null;
  const stops = edgeStops(tr, b), marks = edgeMarks(tr);
  const stopItem = stops.length ? (() => { const q = { L: STOP_LEN, cut0: { kind: 'square', eA: 0, eB: 0, ang: 0 }, cut1: { kind: 'square', eA: 0, eB: 0, ang: 0 }, long: STOP_LEN, short: STOP_LEN, members: [] };
    return { no: plan.items.length + (cx ? cx.items.length : 0) + 1, type: 'stop', label: 'Edge stop (under each corner joint)', long: STOP_LEN, short: STOP_LEN, cc: STOP_LEN, cuts: [q.cut0, q.cut1], n: 1, view: 'side view', pieces: Array.from({ length: stops.length * nT }, () => q), Fmax: 0, kind: 'stop' }; })() : null;
  const allItems = plan.items.concat(cx ? cx.items : [], stopItem ? [stopItem] : []);
  // a curved top chord built as one bent stick (#282): its checks, sheet, form and steps
  const bentPieces = plan.pieces.filter(q => q.bent), bent = bentPieces.length ? bentCheck(tr, plan, res, meta.mat || { b, h: meta.h || b }) : null;
  const pctB = v => `${Math.round(v * 100)}%`;
  const isX = it => !!it.label, lab = it => it.label || (it.bent ? 'Top chord: one stick bent to the curve' : TL[it.type] || it.type), qty = it => isX(it) ? it.pieces.length : it.pieces.length * nT * it.n;
  const allCuts = []; plan.pieces.forEach(q => { for (let t = 0; t < nT * q.n; t++) allCuts.push({ len: q.long, item: q.item }); });
  if (cx) cx.parts.forEach(q => allCuts.push({ len: q.long, item: q.item }));
  if (stopItem) stopItem.pieces.forEach(() => allCuts.push({ len: STOP_LEN, item: stopItem.no }));
  // 2D cross-ties (the 3D plan already lists its ties as parts, #300); also with edge stops, which used to hide them
  if (!cx && meta.ties && meta.ties.count) for (let t = 0; t < meta.ties.count; t++) allCuts.push({ len: meta.ties.len, item: 'T' });
  const kerf = meta.kerf == null ? 1 : meta.kerf, stock = meta.stock || 240;
  const bars = stockPlan(allCuts, stock, kerf), totalLen = allCuts.reduce((s, c) => s + c.len, 0);
  // centre-to-centre wood: what the app's "Wood in the 3D model" counts (cut lengths add the joint allowances)
  const cc2 = plan.pieces.reduce((s, q) => s + q.L * q.n, 0) * nT, ccX = cx ? cx.parts.reduce((s, q) => s + q.L, 0) : 0;
  const swatch = no => colourMode === 'part' ? `<span class="sw" style="background:${colOf(no)}"></span>` : '';
  const pattern = no => dash ? `<svg width="34" height="6" style="vertical-align:middle"><line x1="1" y1="3" x2="33" y2="3" stroke="#111" stroke-width="1.4" stroke-dasharray="${(dashOf(no) || '40').split(' ').map(v => v * 2).join(' ')}"/></svg>` : '';
  const ball = no => `<span class="ball" style="${colourMode === 'part' ? `background:${colOf(no)};color:#fff` : ''}">${no}</span>`;
  const sheets = [];
  const sheet = (title, body, cls) => sheets.push({ title, body, cls });
  // a sheet is a fixed page, so long tables go on in continuation sheets (#153). Rows per sheet are set for the
  // tallest rows these tables have; tests/ui/documents.mjs checks that nothing is cut off on the worst bridges.
  const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o.length ? o : [[]]; };
  const cont = (title, i, n) => n > 1 ? `${title} (${i + 1} of ${n})` : title;
  const splices = plan.splices || [];
  const spliceMarks = (Y) => splices.map(s => { const p = tr.nodes[s.node]; return `<g stroke="#c0392b" stroke-width=".5"><line x1="${p[0] - 2.4}" y1="${Y(p[1]) - 4}" x2="${p[0] - 2.4}" y2="${Y(p[1]) + 4}"/><line x1="${p[0] + 2.4}" y1="${Y(p[1]) - 4}" x2="${p[0] + 2.4}" y2="${Y(p[1]) + 4}"/></g><text x="${p[0]}" y="${Y(p[1]) + (s.type === 'bot' ? -5 : 7.5)}" font-size="2.8" text-anchor="middle" fill="#c0392b" font-family="Arial">splice${s.tension ? ' + splint' : ''}</text>`; }).join('');
  const crossings = plan.crossings || [];
  const crossMarks = (Y) => crossings.map(c => `<g><circle cx="${c.pt[0]}" cy="${Y(c.pt[1])}" r="${b * 0.9}" fill="none" stroke="#c0392b" stroke-width=".4"/><text x="${c.pt[0]}" y="${Y(c.pt[1]) + 7.5}" font-size="2.8" text-anchor="middle" fill="#c0392b" font-family="Arial">bottom chord cut: butt to the arch</text></g>`).join('');
  const crossNote = crossings.length ? ` <b>Arch crossings</b> (red circles): the top chord passes through the bottom chord at ${crossings.length} point${crossings.length > 1 ? 's' : ''} (x = ${crossings.map(c => f1(c.pt[0])).join(', ')} mm, ${crossings.map(c => Math.round(c.angle) + '°').join(', ')}). The arch runs through; the bottom chord is cut there and each piece butts flush to the arch's face, double-glued.` : '';
  const spliceNote = splices.length ? ` <b>Splices</b> (red marks): ${splices.length} chord joint${splices.length > 1 ? 's' : ''} where a piece longer than one ${stock} mm stick is joined: square butt ends at the joint centre, placed where the chord force is lowest (${splices.map(s => Math.abs(s.F) < 0.005 ? 'no force' : `${Math.abs(s.F).toFixed(2)} N ${s.tension ? 'tension: glue a splint across it' : 'compression'}`).join('; ')}).` : '';
  // 1. assembly drawing (side truss)
  const v = sideSVG(tr, plan, { labels: true, balloons: true, dims: true, b, color: colourMode, dash });
  const partsArr = plan.items.map(it => `<tr><td>${swatch(it.no)}${it.no}</td><td>${qty(it)}</td><td>${f1(it.long)}</td><td>${Math.abs(it.long - it.short) > 0.05 ? f1(it.short) : '—'}</td><td>${it.cuts.map(cutTxt).join(' / ')}</td><td>${lab(it)}${it.n > 1 ? ` (${it.n} sticks glued)` : ''}${it.bent ? ': length along the curve; cut 10-15 mm long at each end, bend, then trim' : ''}${pattern(it.no)}</td></tr>`)
    .concat(stopItem ? [`<tr><td>${swatch(stopItem.no)}${stopItem.no}</td><td>${qty(stopItem)}</td><td>${f1(STOP_LEN)}</td><td>—</td><td>square / square</td><td>Edge stop: glued under each corner joint, against the table's face</td></tr>`] : [])
    .concat(!cx && meta.ties && meta.ties.count ? [`<tr><td>T</td><td>${meta.ties.count}</td><td>${f1(meta.ties.len)}</td><td>—</td><td>square</td><td>Cross-tie between the trusses</td></tr>`] : []);
  const partsHead = `<tr><th colspan="6">PARTS LIST · ${nT} TRUSSES</th></tr><tr><th>ITEM</th><th>QTY</th><th>LENGTH</th><th>SHORT PT</th><th>END CUTS</th><th>DESCRIPTION</th></tr>`;
  const ownParts = partsArr.length > 10;   // too many rows to sit beside the drawing
  sheet('Assembly drawing', `${ownParts ? `<p class="note asmnote"><b>Parts list: next sheet${partsArr.length > 30 ? 's' : ''}.</b></p>` : `<table class="parts">${partsHead}${partsArr.join('')}</table>`}
    <p class="note asmnote">Side view of one truss, mm. Each part is dimensioned once (long point); identical parts carry the same item balloon. ${bent ? ` <b>Bent top chord</b>: ${bentPieces.length * nT} stick${bentPieces.length * nT > 1 ? 's' : ''} bent to the curve (tightest radius ${f1(bent.Rmin)} mm); ${bent.tooTight ? '<b style="color:#c0392b">too tight for one stick here: use straight pieces (see the Bent top chord sheet)</b>' : bent.mustSoak ? 'soak or steam it and let it dry on the bending form first' : 'it can be bent dry'}. See the Bent top chord sheet.` : ''} Build ${nT} identical trusses${cx ? (cx.sameTrusses ? ' (checked: the front and back trusses of the 3D model are identical)' : ' — <b>the front and back trusses differ: see the 3D sheets</b>') : ''}.${cx && cx.tilt ? ` In the 3D bridge each truss leans ${f1(cx.tilt)}° inward about its bottom chord; build it flat, exactly as drawn.` : ''}${spliceNote}${crossNote}${(plan.bad || []).length ? ` <b style="color:#c0392b">${plan.bad.length} piece${plan.bad.length > 1 ? 's' : ''} can't be cut as set (no length left between the end cuts): change the joints marked in the joints table.</b>` : ''}${(plan.short || []).length ? ` <b>Short members</b>: ${plan.short.length} piece${plan.short.length > 1 ? 's are' : ' is'} under ${f1(6 * b)} mm (6 stick widths); members this short behave like a solid web, so the results are less reliable.` : ''}${marks.length ? ` <b>Desk edge</b> (green marks): line these up with the desk edges${(+tr.design.supportOffset || 0) ? `; the support joints sit ${f1(+tr.design.supportOffset)} mm onto the desks` : ''}.` : ''}${stopItem ? ` <b>Edge stops</b>: ${stops.length * nT} sticks of ${STOP_LEN} mm glued under the corner joints, hanging down the table's face so the edge can push the bridge inward (${f1(stopItem.pieces.length * STOP_LEN)} mm of stick, not counted in the app's wood).` : ''}
    ${cx ? `Centre-to-centre wood ${f1(cc2 + ccX)} mm (side trusses ${f1(cc2)} + 3D parts ${f1(ccX)}; the app's "Wood in the 3D model" is ${f1(d3.r3.wood)} mm) · cut length ${f1(totalLen)} mm with joint allowances` : `Stick total ${f1(totalLen)} mm`} · ${meta.massNote || ''} · capacity ${meta.capNote || ''}.</p>
    <svg class="view" style="height:${ownParts ? 120 : Math.max(70, 112 - Math.max(0, partsArr.length - 7) * 5)}mm" viewBox="${v.box.join(' ')}">${v.svg}${spliceMarks(v.Y)}${crossMarks(v.Y)}${markSVG(tr, marks, stops, v.Y, b, stopItem && colourMode === 'part' ? colOf(stopItem.no) : '#fff')}</svg>`);
  if (ownParts) { const ch = chunk(partsArr, 30); ch.forEach((rows, i) => sheet(cont('Parts list', i, ch.length), `<table class="parts xparts">${partsHead}${rows.join('')}</table>`)); }
  // 1b. 3D frame: plan, bottom and end views with the cross parts' list
  let frames = [];
  if (cx) {
    const m3 = d3.m3, xArr = cx.items.map(it => `<tr><td>${swatch(it.no)}${it.no}</td><td>${qty(it)}</td><td>${f1(it.cc)}</td><td><b>${f1(it.long)}</b></td><td>${Math.abs(it.long - it.short) > 0.05 ? f1(it.short) : '—'}</td><td>${it.cuts.map(cutTxt).join(' / ')}${it.cuts.some(c => c.kind === 'flush') ? ` (${it.view})` : ''}</td><td>${lab(it)}${pattern(it.no)}</td></tr>`);
    const xHead = `<tr><th colspan="7">3D PARTS · BETWEEN THE TRUSSES</th></tr><tr><th>ITEM</th><th>QTY</th><th>C-C</th><th>CUT TO</th><th>SHORT PT</th><th>END CUTS</th><th>DESCRIPTION</th></tr>`, ownX = xArr.length > 7;
    const pv = view3(m3, cx, { view: 'plan', balloons: true, colour: colourMode, dash, dims: true, b }), bv = view3(m3, cx, { view: 'bottom', balloons: true, colour: colourMode, dash, dims: true, b });
    frames = distinctFrames(m3, cx);
    const fv = frames.map(g => ({ g, v: view3(m3, cx, { view: 'end', station: g.stations[0], balloons: true, colour: colourMode, dash, dims: true, b }) })).filter(q => q.v);
    const stn = g => g.stations.map(s => s + 1).join(', ');
    sheet('3D assembly', `${ownX ? `<p class="note"><b>3D parts list: next sheet${xArr.length > 30 ? 's' : ''}.</b></p>` : `<table class="parts xparts">${xHead}${xArr.join('')}</table>`}
      <div class="v3">${pv ? `<figure><svg viewBox="${pv.box.join(' ')}">${pv.svg}</svg><figcaption>Top plane from above (x along the bridge, back truss at the top): top chords grey, ties${cx.onTop ? ' laid on top of the chords' : ' between the chords'} and top lateral bracing.</figcaption></figure>` : ''}
      ${bv ? `<figure><svg viewBox="${bv.box.join(' ')}">${bv.svg}</svg><figcaption>Bottom plane (seen from above, through the deck): bottom chords grey, bottom ties and bracing, butted between the chords.</figcaption></figure>` : ''}</div>
      <p class="note">mm. "C-C" is centre to centre, as in the 3D model; cut each part to "cut to" (long point). ${cx.onTop ? 'Top ties lap over both top chords (glued flat on top, side grain to side grain): cut square, as long as the outside width.' : 'Top ties butt between the top chords\' inner faces.'} Lateral bracing and sway diagonals butt against the chords' and posts' inner faces; the end angle is shown in the view named in the parts list.${cx.tilt ? ` Tilt ${f1(cx.tilt)}°: the cross-frames are narrower at the top than at the bottom.` : ''}</p>`);
    if (ownX) { const ch = chunk(xArr, 30); ch.forEach((rows, i) => sheet(cont('3D parts list', i, ch.length), `<table class="parts xparts">${xHead}${rows.join('')}</table>`)); }
    for (let s0 = 0; s0 < fv.length; s0 += 4) sheet('3D cross-frames', `<h2 style="margin:0 0 3mm">Cross-frames (end views, looking along the bridge)</h2><div class="frames">${fv.slice(s0, s0 + 4).map(({ g, v: vv }) => `<figure><svg viewBox="${vv.box.join(' ')}">${vv.svg}</svg><figcaption>Station${g.stations.length > 1 ? 's' : ''} ${stn(g)} of ${m3.frames.length}${g.stations.includes(0) || g.stations.includes(m3.frames.length - 1) ? ' (end frame)' : ''} · bracing ${g.code === 'N' ? 'ties only' : g.code}</figcaption></figure>`).join('')}</div>
      <p class="note">Front truss on the left. Grey: the side-truss posts at that station. A full-size template of each frame is at the end of this set.</p>`);
  }
  // 2. part drawings, six to a sheet
  const per = 6;
  for (let s0 = 0; s0 < allItems.length; s0 += per) {
    const cards = allItems.slice(s0, s0 + per).map(it => `<div class="pcard"><div class="ph">${ball(it.no)} <b>${lab(it)}</b>${it.n > 1 ? ` · ${it.n} sticks glued` : ''}<span class="qty">QTY ${qty(it)}</span></div>
      ${partDetail(it, b, colourMode === 'part' ? colOf(it.no) : '#fff')}
      <div class="pf">Balsa ${b} × ${meta.h || b} · long point <b>${f1(it.long)}</b>${Math.abs(it.long - it.short) > 0.05 ? ` · short point ${f1(it.short)}` : ''}${isX(it) ? ` · c-c ${f1(it.cc)}` : ''} · ends ${it.cuts.map(cutTxt).join(' / ')}${isX(it) && it.cuts.some(c => c.kind === 'flush') ? ` (angle seen in the ${it.view})` : ''}${it.type === 'end' && res && res.members && it.pieces.some(q => q.members.some(k => res.members[k] && res.members[k].F > 0.005)) ? ' · <b>carries tension: double-glue both ends and add a splint</b>' : ''}${pattern(it.no)}</div></div>`).join('');
    sheet(`Part drawings ${allItems.length > per ? `(${Math.floor(s0 / per) + 1})` : ''}`, `<div class="pgrid">${cards}</div>`);
  }
  // 3. cut list, cutting plan and joints
  const barArr = bars.map((B, i) => { let x = 0;
    const segs = B.cuts.map(c => { const r = `<rect x="${x}" y="0" width="${c.len}" height="8" fill="${c.item === 'T' ? '#ddd' : colourMode === 'part' ? colOf(c.item) : '#fff'}" fill-opacity=".55" stroke="#333" stroke-width=".4"/><text x="${x + c.len / 2}" y="5.6" font-size="4.2" text-anchor="middle" font-family="Arial">${c.item}</text>`; x += c.len + kerf; return r; }).join('');
    return `<div class="bar"><span>Stick ${i + 1}${B.over ? ' (too long!)' : ''}</span><svg viewBox="-1 -1 ${stock + 2} 10" preserveAspectRatio="none">${segs}<rect x="0" y="0" width="${stock}" height="8" fill="none" stroke="#999" stroke-width=".3"/></svg></div>`; });
  const cutArr = allItems.map(it => `<tr><td>${swatch(it.no)}${it.no}</td><td>${lab(it)}</td><td>${qty(it)}</td><td><b>${f1(it.long)}</b></td><td>${f1(it.short)}</td><td>${cutTxt(it.cuts[0])}</td><td>${cutTxt(it.cuts[1])}</td></tr>`);
  const jArr = plan.joints.map(j => `<tr><td>${j.n}</td><td>${j.members.join(', ')}</td><td>${j.through == null ? '—' : j.through}</td><td>${j.end}${j.end === 'mitre' ? ' ' + j.split + '/' + (100 - j.split) : ''}${j.notes && j.notes.length ? `<br><i style="font-size:6pt">${j.notes.join('; ')}</i>` : ''}</td></tr>`);
  // joint advice for the 3D parts (Physics, #116): pick each joint from its force
  let xJoints = '', xjRows = [], xjNote = '';
  const xjHead = '<tr><th>Item</th><th>Part</th><th>Joint</th><th>Largest force</th></tr>';
  if (cx) {
    const how = { tieTop: cx.onTop ? 'On top of both chords, glued flat (lap)' : 'Butted between the chords', tieMid: 'Butted at the mid joint', latTop: 'Butted between the chords, under the ties', latBot: 'Butted between the bottom chords', sway: 'Butted between the posts\' inner faces', tieBot: 'Butted between the bottom chords, not under them' };
    const tens = (res && res.members ? res.members.map((m, k) => ({ k, F: m.F })) : []).filter(m => m.F > 0.005).sort((a, c) => c.F - a.F).slice(0, 3);
    const itemOfMember = k => { const q = plan.pieces.find(p => p.members.includes(k)); return q ? q.item : '?'; };
    xjRows = cx.items.map(it => `<tr><td>${it.no}</td><td>${lab(it)}</td><td>${how[it.kind]}${it.Fmax > 1 ? ' + splint (over 1 N)' : ''}</td><td>${it.Fmax.toFixed(2)} N</td></tr>`);
    xjNote = tens.length ? `<p class="note">Side trusses: splint the end joints of the members in most tension (end grain pulls apart): ${tens.map(m => `member ${m.k} (item ${itemOfMember(m.k)}, ${m.F.toFixed(1)} N)`).join(', ')}.</p>` : '';
    xJoints = `<h2 style="margin-top:3mm">3D joints</h2><table class="grid small">${xjHead}${xjRows.join('')}</table>${xjNote}`;
  }
  const cutHead = '<tr><th>Item</th><th>Part</th><th>Qty</th><th>Long pt</th><th>Short pt</th><th>End 1</th><th>End 2</th></tr>';
  const cutNote = `<p class="note">Measure the long point, mark the angle (part drawings, or the templates), and cut on the waste side. "Flush" ends sit flat on the member on top; "mitre" ends meet their partner on a shared line; "runs through" continues past the joint. Butt joints (a stick end against another stick's face): end grain soaks up cement, so double-glue: a thin coat, let it go tacky, a second coat, then press; finish with a small fillet.${splices.length ? ' "Splice" ends butt square at a joint centre.' : ''}</p>`;
  const planNote = `<p class="note">${bars.length} stick${bars.length > 1 ? 's' : ''} of ${stock} mm, ${kerf} mm saw kerf.${bars.some(B => B.over) ? ' <b>A part is longer than one stick: join it at a joint (see the assembly drawing).</b>' : ''}</p>`;
  const jHead = '<tr><th>Joint</th><th>Members</th><th>On top</th><th>Others</th></tr>';
  if (cutArr.length <= 16 && barArr.length <= 22) {
    // a small set: cut list and cutting plan side by side, as before
    sheet('Cut list and cutting plan', `<div class="two"><div><h2>Cut list</h2><table class="grid">${cutHead}${cutArr.join('')}</table>${cutNote}</div><div><h2>Cutting plan</h2>${planNote}${barArr.join('')}</div></div>`);
  } else {
    const cc = chunk(cutArr, 24); cc.forEach((rows, i) => sheet(cont('Cut list', i, cc.length), `<h2>${cont('Cut list', i, cc.length)}</h2><table class="grid">${cutHead}${rows.join('')}</table>${i === cc.length - 1 ? cutNote : ''}`));
    const bc = chunk(barArr, 24); bc.forEach((rows, i) => sheet(cont('Cutting plan', i, bc.length), `<h2>${cont('Cutting plan', i, bc.length)}</h2>${i === 0 ? planNote : ''}${rows.join('')}`));
  }
  const jc = chunk(jArr, 22);   // joint rows can carry a note (#155), so fewer to a sheet
  const xjOwn = xjRows.length > 12;   // a long 3D joints table gets its own sheets
  jc.forEach((rows, i) => sheet(cont('Joints', i, jc.length), `<div class="two"><div><h2>${cont('Joints', i, jc.length)}</h2><table class="grid small">${jHead}${rows.join('')}</table></div><div>${i === 0 && !xjOwn ? xJoints : ''}</div></div>`));
  if (xjOwn) { const xc = chunk(xjRows, 22); xc.forEach((rows, i) => sheet(cont('3D joints', i, xc.length), `<h2>${cont('3D joints', i, xc.length)}</h2><table class="grid">${xjHead}${rows.join('')}</table>${i === xc.length - 1 ? xjNote : ''}`)); }
  // 3b. the bent top chord (#282): can it be bent, is it strong enough once bent, and how to make it (Physics, TE-B-128)
  if (bent) {
    const rows = bent.pieces.flatMap(pc => pc.members.map(mb => `<tr><td>${pc.item}</td><td>${mb.k}</td><td>${f1(mb.L)}</td><td>${Number.isFinite(mb.R) ? f1(mb.R) : 'straight'}</td><td>${mb.e.toFixed(2)}</td><td>${Math.abs(mb.F).toFixed(2)} ${mb.F < -0.005 ? 'C' : mb.F > 0.005 ? 'T' : ''}</td><td>${pctB(mb.straightUse)}</td><td${mb.use >= 1 ? ' style="color:#c0392b;font-weight:bold"' : ''}>${pctB(mb.use)}</td></tr>`));
    const verdict = bent.tooTight
      ? `<p class="note" style="color:#c0392b;font-size:10pt"><b>Too tight for one stick: use straight pieces.</b> Bent to this curve, member ${bent.pieces.map(pc => pc.worst).sort((x, y) => y.use - x.use)[0].k} would be at ${pctB(bent.worstUse)} of its strength at the design load (over 100%). Untick "one bent stick" to get straight pieces joint to joint, or make the curve flatter.</p>`
      : `<p class="note" style="font-size:9pt"><b>Strong enough once dried to shape:</b> at most ${pctB(bent.worstUse)} of its strength at the design load (straight pieces joint to joint: ${pctB(Math.max(...bent.pieces.flatMap(pc => pc.members.map(mb => mb.straightUse))))}). The wood between joints sits off the straight line by the sagitta e = L²/8R, so the chord force also bends it.</p>`;
    const dry = `<p class="note" style="font-size:9pt"><b>${bent.mustSoak ? 'It must be soaked or steamed' : 'It can be bent dry'}:</b> at the tightest radius, ${f1(bent.Rmin)} mm, the outer fibre stretches ${(bent.strain * 100).toFixed(2)}% (b/2R); balsa breaks at about ${(bent.strainLimit * 100).toFixed(2)}% (σt/E).${bent.mustSoak ? ' Bent dry it would crack.' : ''}</p>`;
    const how = `<ol class="note" style="font-size:8.5pt;margin:1mm 0 0;padding-left:5mm">
      <li><b>The day before</b> (Thursday evening for a Friday build): print the bending form (template pages) at 100% and check its 50 mm bar. Tape it to a board pins go into, wax paper on top.</li>
      <li>Pick straight-grained, dense sticks (one per truss, from sticks of similar density) and cut each <b>10-15 mm longer</b> than the cut list at each end. Weigh each one dry and write the mass down.</li>
      <li><b>Soak</b> in hot tap water (not boiling) for about 15-30 min, or <b>steam</b> it for 1-3 min along the whole curved part, until a scrap of the same stock bends to the crown radius without creaking. Test the scrap first. Mind your hands near steam.</li>
      <li>Pin it to the form starting at the crown (the tightest part), working out to each end. Pins go <b>beside</b> the stick at the pin marks, inside and outside alternately, <b>never through it</b>. If it creaks, stop, re-wet that part and go slower; a crack means a new stick or straight pieces.</li>
      <li>Check it lies on the line everywhere (no gap over 0.5 mm), then mark the joint positions from the form onto the stick with a pencil.</li>
      <li>Let it dry pinned, at room temperature, <b>overnight (at least 8-12 h)</b>, no heater or hot hair dryer. It's dry when its mass is back within about 2% of the dry mass.</li>
      <li><b>Build day:</b> unpin it (a little springback is normal; within about 1 mm of the line is fine), trim the ends to the cut list, re-check the joint marks, and glue it in as the top chord, pinned to the curve on the truss template. Verticals and diagonals are cut flush to its curved face and double-glued.</li></ol>`;
    sheet('Bent top chord', `<div class="two"><div><h2>Bent top chord: checks</h2><table class="grid small"><tr><th>Item</th><th>Member</th><th>L</th><th>R</th><th>Sagitta e</th><th>Force at design load</th><th>Use, straight</th><th>Use, bent</th></tr>${rows.join('')}</table>${dry}${verdict}<p class="note">mm and N. R: the circle through each joint and its two neighbours on the chord (a member takes the tighter of its two ends). Use, bent = (|F|/A + |F|·e/Z) / σ, with A = ${f1(bent.A)} mm² and Z = ${f1(bent.Z)} mm³. Checks from the Physics Consultant (#194, #282).</p></div>
      <div><h2>How to make it</h2>${how}</div></div>`);
  }
  // 5. full-size templates, tiled to fit the page
  const tpls = [];   // full-size template pages: [inner html]
  // which template pages hold what (T1 = the first template page), so the build steps can name them (#302)
  const tplOf = { side: [], frames: [], plan: [], bend: {} }, tplMark = (key, item) => { const n = tpls.length; if (item != null) (tplOf.bend[item] = tplOf.bend[item] || []).push(n); else tplOf[key].push(n); };
  if (opt.templates) {
    const tw = 240, th = 160, xs = tr.nodes.map(p => p[0]), ys = tr.nodes.map(p => p[1]);
    const X0 = Math.min(...xs) - 6, X1 = Math.max(...xs) + 6, Y0 = Math.min(...ys, ...stops.map(s => s.y0)) - 6, Y1 = Math.max(...ys) + 6, hgt = Math.min(th, Y1 - Y0 + 24);
    const edges = drawSegs(tr, plan).map(({ e, a: p, c: q, item }) => { const d = unit(sub(q, p)), nv = mul(perp(d), b * Math.sqrt(e.n || 1) / 2);
      return `<polygon points="${[add(p, nv), add(q, nv), sub(q, nv), sub(p, nv)].map(z => `${z[0]},${Y1 - z[1]}`).join(' ')}" fill="${colourMode === 'part' ? colOf(item) : 'none'}" fill-opacity=".25" stroke="#000" stroke-width=".2"/><line x1="${p[0]}" y1="${Y1 - p[1]}" x2="${q[0]}" y2="${Y1 - q[1]}" stroke="#666" stroke-width=".15" stroke-dasharray="${dash ? dashOf(item) || '1 1' : '1 1'}"/>`; }).join('')
      + crossMarks(y => Y1 - y)
      + splices.map(s => { const p = tr.nodes[s.node]; return `<line x1="${p[0]}" y1="${Y1 - p[1] - 4}" x2="${p[0]}" y2="${Y1 - p[1] + 4}" stroke="#c0392b" stroke-width=".35"/>`; }).join('')
      + markSVG(tr, marks, stops, y => Y1 - y, b, 'none');
    const scale = (tx, h) => `<g stroke="#000" stroke-width=".3"><line x1="${tx + 5}" y1="${h - 6}" x2="${tx + 55}" y2="${h - 6}"/><line x1="${tx + 5}" y1="${h - 8}" x2="${tx + 5}" y2="${h - 4}"/><line x1="${tx + 55}" y1="${h - 8}" x2="${tx + 55}" y2="${h - 4}"/></g><text x="${tx + 30}" y="${h - 1}" font-size="3" text-anchor="middle" font-family="Arial">50 mm</text>`;
    const tiles = []; for (let tx = X0; tx < X1 - 1; tx += tw - 10) tiles.push(tx);
    tiles.forEach((tx, i) => tplMark('side') || tpls.push(`<p class="note">Full-size template${cx ? ' (side truss: build both on it)' : ''} · tile ${i + 1} of ${tiles.length} · print at 100% (actual size) and check that the bar measures 50 mm. Tiles overlap by 10 mm; line up the + marks. Pins go beside the sticks, never through them.</p>
      <svg width="${tw}mm" height="${hgt}mm" viewBox="${tx} 0 ${tw} ${hgt}">${edges}${scale(tx, hgt)}
        ${[tx + tw - 10, tx + 10].map(mx => `<path d="M${mx - 3} 6 h6 M${mx} 3 v6" stroke="#000" stroke-width=".3"/>`).join('')}</svg>`));
    // 3D: one full-size template per different cross-frame (stand the trusses on it), and the top plane
    if (cx) {
      const m3 = d3.m3, full = (vv, cap) => { const [bx, by, bw, bh] = vv.box, h2 = bh + 14; return `<figure class="ftpl"><svg width="${bw}mm" height="${h2}mm" viewBox="${bx} ${by} ${bw} ${h2}">${vv.svg.replace(/fill="#e9e9e9"/g, 'fill="none"')}${scale(bx, by + h2)}</svg><figcaption>${cap}</figcaption></figure>`; };
      const ft = frames.map(g => { const vv = view3(m3, cx, { view: 'end', station: g.stations[0], balloons: true, colour: colourMode === 'part' ? 'part' : 'mono', b }); return vv ? full(vv, `Cross-frame, station${g.stations.length > 1 ? 's' : ''} ${g.stations.map(s => s + 1).join(', ')} · full size`) : ''; }).join('');
      tplMark('frames'); tpls.push(`<p class="note">Full-size cross-frame templates · print at 100% and check the 50 mm bar. Stand the two trusses on these (front truss on the left) to set the spacing${cx.tilt ? ' and the lean' : ''}; build each frame flat on its template.</p><div class="ftpls">${ft}</div>`);
      const pv = view3(m3, cx, { view: 'plan', balloons: true, colour: colourMode === 'part' ? 'part' : 'mono', b });
      if (pv) { const [bx, by, bw, bh] = pv.box, ptiles = []; for (let tx = bx; tx < bx + bw - 1; tx += tw - 10) ptiles.push(tx);
        ptiles.forEach((tx, i) => tplMark('plan') || tpls.push(`<p class="note">Full-size top plane (from above) · tile ${i + 1} of ${ptiles.length} · print at 100%. Lay it under the finished frame to place the ties and bracing.</p><svg width="${tw}mm" height="${bh + 14}mm" viewBox="${tx} ${by} ${tw} ${bh + 14}">${pv.svg}${scale(tx, by + bh + 14)}</svg>`)); }
    }
  }
  // the bending form for each different bent piece, full size (always printed when the chord is bent: it's the build day's jig)
  if (bent) {
    const tw = 240, seen = new Set();
    bentPieces.forEach(q => { if (seen.has(q.item)) return; seen.add(q.item);
      const F = bendForm(tr, q, b), X0 = Math.min(...F.xs) - 12, X1 = Math.max(...F.xs) + 12, Y0 = Math.min(...F.ys) - 14, Y1 = Math.max(...F.ys) + 12, hgt = Y1 - Y0 + 16;
      const pl = a2 => a2.map(z => `${z[0].toFixed(2)},${(Y1 - z[1]).toFixed(2)}`).join(' ');
      const g = `<polyline points="${pl(F.up)}" fill="none" stroke="#000" stroke-width=".25"/><polyline points="${pl(F.dn)}" fill="none" stroke="#000" stroke-width=".25"/><polyline points="${pl(F.pts)}" fill="none" stroke="#666" stroke-width=".15" stroke-dasharray="1 1"/>`
        + F.ticks.map((tk, i) => `<line x1="${tk.a[0]}" y1="${Y1 - tk.a[1]}" x2="${tk.c[0]}" y2="${Y1 - tk.c[1]}" stroke="#c0392b" stroke-width=".35"/><text x="${tk.a[0]}" y="${Y1 - tk.a[1] - 1}" font-size="3" text-anchor="middle" fill="#c0392b" font-family="Arial">${i === 0 || i === F.ticks.length - 1 ? 'end ' : ''}joint ${tk.n}</text>`).join('')
        + F.pins.map(pn => `<circle cx="${pn[0]}" cy="${Y1 - pn[1]}" r=".8" fill="none" stroke="#0b6e4f" stroke-width=".3"/>`).join('');
      const bar = tx => `<g stroke="#000" stroke-width=".3"><line x1="${tx + 5}" y1="${hgt - 6}" x2="${tx + 55}" y2="${hgt - 6}"/><line x1="${tx + 5}" y1="${hgt - 8}" x2="${tx + 5}" y2="${hgt - 4}"/><line x1="${tx + 55}" y1="${hgt - 8}" x2="${tx + 55}" y2="${hgt - 4}"/></g><text x="${tx + 30}" y="${hgt - 1}" font-size="3" text-anchor="middle" font-family="Arial">50 mm</text>`;
      const tiles = []; for (let tx = X0; tx < X1 - 1; tx += tw - 10) tiles.push(tx);
      tiles.forEach((tx, i) => tplMark(null, q.item) || tpls.push(`<p class="note"><b>Bending form</b>, item ${q.item} (top chord, one stick bent to the curve) · tile ${i + 1} of ${tiles.length} · print at 100% (actual size) and check that the bar measures 50 mm. ${F.len.toFixed(1)} mm along the curve between the end joints; red ticks: the joints (mark them on the stick); green circles: pins, beside the stick, never through it. Wax paper on top.</p>
        <svg width="${tw}mm" height="${hgt}mm" viewBox="${tx} 0 ${tw} ${hgt}">${g}${bar(tx)}${tiles.length > 1 ? [tx + tw - 10, tx + 10].map(mx => `<path d="M${mx - 3} 6 h6 M${mx} 3 v6" stroke="#000" stroke-width=".3"/>`).join('') : ''}</svg>`)); });
  }
  // 4. build steps
  if (opt.steps) {
    const order = crossings.length
      // the arch crosses the bottom chord (#298): glue the arch first, then butt the bottom-chord pieces to it
      ? [['top', 'Lay the arch (top chord) on the template: it runs through where it crosses the bottom chord'], ['bot', 'Butt the bottom-chord pieces to the arch\'s faces at the red circles, double-glued'], ['end', 'Add the end posts'], ['vert', 'Glue in the verticals'], ['diag', 'Glue in the diagonals'], ['brace', 'Add the edge braces'], ['claw', 'Add the claws']]
      : [['bot', 'Lay the bottom chord'], ['top', 'Add the top chord'], ['end', 'Add the end posts'], ['vert', 'Glue in the verticals'], ['diag', 'Glue in the diagonals'], ['brace', 'Add the edge braces'], ['claw', 'Add the claws']];
    const done = new Set(); let stepNo = 0;
    const callOf = its => Object.entries(its).map(([no, c]) => `<div class="part"><b>${c}×</b> ${ball(+no)} ${f1(allItems[no - 1].long)}</div>`).join('');
    const box = (callout, vv, title) => `<div class="step"><div class="sn">${++stepNo}</div><div class="callout">${callout}</div><svg viewBox="${vv.box.join(' ')}">${vv.svg}</svg><p>${title}</p></div>`;
    const steps = [];
    const textStep = html => `<div class="step"><div class="sn">${++stepNo}</div><div style="margin:11mm 2mm 0;font-size:9.5pt;line-height:1.35">${html}</div></div>`;
    const tn = a2 => !a2 || !a2.length ? '' : a2.length > 1 ? `T${a2[0] + 1}-T${a2[a2.length - 1] + 1}` : `T${a2[0] + 1}`;
    const sideT = tn(tplOf.side), frameT = tn(tplOf.frames), planT = tn(tplOf.plan), bendT = tn(Object.values(tplOf.bend).flat());
    // step 0 when a chord end sits below the deck (#299, Physics): the real platforms must match the model
    const lowEnd = Math.min(0, ...tr.nodes.map(q => q[1])), tableT = +((tr.info && tr.info.tableThick) || tr.design.tableThick || 30);
    if (lowEnd < -0.5) steps.push(textStep(`<b>Before cutting anything: measure the real test platforms.</b> This bridge's ends sit ${f1(-lowEnd)} mm below the deck and bear on the table's face (${f1(-lowEnd + b / 2)} mm to the underside). Check: the table top is at least ${f1(tableT)} mm thick (as in the model); its edge is a flat, square face down to at least ${f1(-lowEnd + b / 2 + 1)} mm; nothing (an apron, a clamp, a frame) sits under the edge where the ends go. If not, change "Table top thickness" in Truss Explorer and re-check the bridge before cutting.`));
    if (opt.templates && tpls.length) steps.push(textStep(`<b>Print and check the templates</b> (${tn(tpls.map((x, i) => i))}, the last pages of this set): print at <b>Actual size</b>, never "Fit to page", and check each 50 mm bar with a ruler. Tape the tiles of each template together on the + marks${sideT ? ` (side truss: ${sideT})` : ''}. Tape them to a flat board and cover them with wax paper. Pins go beside the sticks, never through them.`));
    // cut and label: from the cut list, before any gluing (#302)
    const nCut = allItems.reduce((s, it) => s + qty(it), 0);
    steps.push(textStep(`<b>Cut and label every part</b> before gluing: ${nCut} pieces in ${allItems.length} items, from the cut list (long point, angles) and the cutting plan (which stick each comes from). Write the item number on each piece in pencil and keep each item together.${bent ? ' The bent top-chord sticks are made the day before (next step).' : ''}`));
    if (bent) { const vv = sideSVG(tr, plan, { highlight: new Set(bentPieces.flatMap(q => q.members)), b, color: colourMode === 'part' ? 'part' : '#c0392b', dash });
      const its = {}; bentPieces.forEach(q => { its[q.item] = (its[q.item] || 0) + 1; });
      steps.push(box(callOf(its), vv, `${bent.tooTight ? '<span style="color:#c0392b">Too tight for one stick: use straight pieces instead (Bent top chord sheet).</span> ' : ''}The day before: ${bent.mustSoak ? 'soak or steam the top-chord sticks, pin them beside the bending form and let them dry overnight' : 'bend the top-chord sticks on the bending form'} (Bent top chord sheet)`)); }
    order.map(([ty, title]) => {
      const ks = tr.elems.map((e, k) => e.type === ty ? k : -1).filter(k => k >= 0); if (!ks.length) return '';
      const hi = new Set(ks), gr = new Set(done); ks.forEach(k => done.add(k));
      const vv = sideSVG(tr, plan, { highlight: new Set([...hi, ...gr]), grey: gr, b, color: colourMode === 'part' ? 'part' : '#c0392b', dash });
      const its = {}; plan.pieces.filter(q => q.members.some(k => hi.has(k))).forEach(q => { its[q.item] = (its[q.item] || 0) + 1; });
      const spl = ty === 'bot' || ty === 'top' ? splices.filter(s => s.type === ty) : [];
      const onT = !gr.size && sideT ? ` (template ${sideT})` : '';
      return box(callOf(its), { box: vv.box, svg: vv.svg + (spl.length ? spliceMarks(vv.Y) : '') + ((ty === 'bot' || ty === 'top') && crossings.length ? crossMarks(vv.Y) : '') }, (ty === 'top' && bent ? 'Glue in the bent top chord, pinned to the curve on the template, joint marks on the joints' : title) + (spl.length ? ` (${spl.length + 1} pieces: butt them at the red marks${spl.some(s => s.tension) ? ', with a splint where marked' : ''})` : '') + onT);
    }).filter(Boolean).forEach(s => steps.push(s));
    // splints (#302, #299; Physics): every joint the documents mark for a splint gets a step. A splint is a stick offcut
    // glued across the joint on one face, overlapping well onto both pieces.
    const itemOf = k => { const q = plan.pieces.find(p2 => p2.members.includes(k)); return q ? q.item : null; };
    const tensK = (res && res.members ? res.members.map((m, k) => ({ k, F: m.F })) : []).filter(m => m.F > 0.005).sort((a4, c) => c.F - a4.F).slice(0, 3).map(m => m.k);
    const postsT = (res && res.members ? res.members.map((m, k) => ({ k, F: m.F })) : []).filter(m => tr.elems[m.k].type === 'end' && m.F > 0.005).map(m => m.k);
    const splK = [...new Set(tensK.concat(postsT))], splItems = [...new Set(splK.map(itemOf).filter(v => v != null))].sort((x, y) => x - y);
    const tSplices = splices.filter(s => s.tension);
    if (splItems.length || tSplices.length) {
      const vv = sideSVG(tr, plan, { highlight: new Set(splK), grey: new Set(tr.elems.map((e, k) => k).filter(k => !splK.includes(k))), b, color: colourMode === 'part' ? 'part' : '#c0392b', dash });
      const its = {}; splItems.forEach(no => { its[no] = plan.pieces.filter(q => q.item === no && q.members.some(k => splK.includes(k))).length; });
      steps.push(box(callOf(its), { box: vv.box, svg: vv.svg + (tSplices.length ? spliceMarks(vv.Y) : '') }, `Splint ${splItems.length ? `both end joints of the members in most tension (items ${splItems.join(', ')}${postsT.length ? '; the end posts hang the arch ends in tension' : ''})` : ''}${splItems.length && tSplices.length ? ' and ' : ''}${tSplices.length ? 'the splices marked "+ splint"' : ''}: glue a stick offcut across each joint on one face, double-glued, overlapping well onto both pieces`));
    }
    if (stopItem) { const vv = sideSVG(tr, plan, { b, color: '#c8c8c8' }); steps.push(box(callOf({ [stopItem.no]: stops.length }), { box: vv.box, svg: vv.svg + markSVG(tr, marks, stops, vv.Y, b, colourMode === 'part' ? colOf(stopItem.no) : '#c0392b') }, 'Glue an edge stop under each corner joint, square to the bottom chord: it hangs down the table\'s face')); }
    if (cx) {
      const m3 = d3.m3, built = new Set(), ofKind = (...ks) => cx.parts.filter(q => ks.includes(q.kind));
      const endSt = new Set([0, m3.frames.length - 1]);
      const frameParts = s => { const vv = view3(m3, cx, { view: 'end', station: s }); return vv ? vv.els.filter(e => e.side === 'cross').map(e => e.k) : []; };
      const step3 = (parts, view, opts, title) => {
        if (!parts.length) return; const ks = new Set(parts.map(q => q.k));
        const vv = view3(m3, cx, Object.assign({ view, hi: new Set([...ks, ...built]), grey: new Set(built), colour: colourMode === 'part' ? 'part' : '#c0392b', dash, b }, opts)); if (!vv) return;
        const its = {}; parts.forEach(q => { its[q.item] = (its[q.item] || 0) + 1; }); ks.forEach(k => built.add(k));
        steps.push(box(callOf(its), vv, title));
      };
      const sideAll = sideSVG(tr, plan, { b, color: colourMode === 'part' ? 'part' : '#c0392b', dash });
      steps.push(box('', sideAll, `Build the second truss on the same full-size template${sideT ? ` (${sideT})` : ''}, then lay it on the first: every joint should line up${cx.sameTrusses ? '' : ' (the 3D model has different front and back trusses: check the 3D sheets)'}`));
      const endK = new Set([...endSt].flatMap(frameParts));
      const fe = frames.find(g => g.stations.includes(0)), fv0 = fe ? view3(m3, cx, { view: 'end', station: 0, colour: colourMode === 'part' ? 'part' : '#c0392b', b }) : null;
      if (fv0) steps.push(box('', fv0, `Stand both trusses upright, ${f1(Math.abs(m3.nodes[m3.frames[0].b + m3.n][1] - m3.nodes[m3.frames[0].b][1]))} mm apart at the bottom (centre to centre), on the full-size cross-frame templates${frameT ? ` (${frameT})` : ''}${cx.tilt ? `, leaning ${f1(cx.tilt)}° inward` : ''}. Weight or pin them so they cannot move`));
      step3(cx.parts.filter(q => endK.has(q.k)), 'end', { station: 0 }, 'Glue the end frames first (ties and sway diagonals at the first and last station). Check each end is square on the template before the glue sets');
      step3(ofKind('tieTop', 'tieMid').filter(q => !built.has(q.k)), 'plan', {}, `Add the remaining top ties, working from the ends to the middle${cx.onTop ? ', glued flat on top of both chords' : ''}${planT ? `; lay the top-plane template (${planT}) under the frame to place them` : ''}`);
      const xOnce = new Set(); cx.parts.forEach(q => { if ((q.kind === 'latTop' || q.kind === 'latBot' || q.kind === 'sway') && cx.parts.some(o2 => o2 !== q && o2.kind === q.kind && Math.abs((m3.nodes[o2.nodes[0]][0] + m3.nodes[o2.nodes[1]][0]) - (m3.nodes[q.nodes[0]][0] + m3.nodes[q.nodes[1]][0])) < 0.5 && cx.parts.indexOf(o2) < cx.parts.indexOf(q))) xOnce.add(q.k); });
      step3(ofKind('latTop').filter(q => !built.has(q.k) && !xOnce.has(q.k)), 'plan', {}, 'Glue in the top lateral bracing, butted between the chords under the ties');
      step3(ofKind('tieBot').filter(q => !built.has(q.k)), 'bottom', {}, 'Add the bottom ties, butted between the bottom chords (not under them)');
      step3(ofKind('latBot').filter(q => !built.has(q.k) && !xOnce.has(q.k)), 'bottom', {}, 'Glue in the bottom lateral bracing');
      step3(ofKind('sway').filter(q => !built.has(q.k) && !xOnce.has(q.k)), 'end', { station: Math.max(0, m3.frames.findIndex(f => f.code !== 'N' && !endSt.has(m3.frames.indexOf(f)))) }, 'Glue in the sway diagonals of the other cross-frames');
      const second = cx.parts.filter(q => xOnce.has(q.k) && !built.has(q.k));
      if (second.length) step3(second, second.every(q => q.kind === 'sway') ? 'end' : second.some(q => q.kind === 'latBot') && !second.some(q => q.kind === 'latTop') ? 'bottom' : 'plan', {}, 'Last: the second diagonal of each X. Measure the real gap after the first is set and cut to fit; never force a long one in');
      const xSpl = cx.items.filter(it => it.Fmax > 1);
      if (xSpl.length) steps.push(textStep(`<b>Splint the 3D joints marked "+ splint (over 1 N)"</b> in the 3D joints table: both ends of items ${xSpl.map(it => it.no).join(', ')}. Glue a stick offcut across each joint on one face, overlapping well onto both pieces.`));
      steps.push(`<div class="step"><div class="sn">${++stepNo}</div><p style="margin-top:12mm;font-size:11pt">Let the cement dry completely before anything is loaded (see the cement's label; overnight is safest). Check the bridge sits flat and square, and against the 3D view in the app. No load at all before test day: store it flat with nothing on it.</p></div>`);
    }
    if (!cx) steps.push(`<div class="step"><div class="sn">${++stepNo}</div><p style="margin-top:12mm;font-size:11pt">Let the cement dry completely (see the cement's label; overnight is safest). No load at all before test day: store the trusses flat with nothing on them.</p></div>`);
    for (let s0 = 0; s0 < steps.length; s0 += 4) sheet('Build steps', `<h2 style="margin:0 0 4px">Build steps <span class="note">(${cx ? 'one truss first; then the 3D frame' : `one truss; build ${nT === 2 ? 'the second' : 'the others'} the same way, then join them with the cross-ties`})</span></h2><div class="steps">${steps.slice(s0, s0 + 4).join('')}</div>`);
  }
  const total = sheets.length + tpls.length;
  // every printed page carries its number (#157): the sheets in their title blocks, the templates in their header
  const tplPages = tpls.map((h, i) => `<section class="sheet tpl"><p class="pgno">${esc(meta.name)} · page ${sheets.length + i + 1} of ${total} · template T${i + 1} of ${tpls.length}${meta.info ? ` · ${esc(meta.info)}` : ""}</p>${h}</section>`).join('');
  const html = sheets.map((s, i) => `<section class="sheet ${s.cls || ''}"><div class="frame"><div class="zones top"><span>4</span><span>3</span><span>2</span><span>1</span></div><div class="zones bot"><span>4</span><span>3</span><span>2</span><span>1</span></div><div class="content">${s.body}</div>
    <table class="title"><tr><td colspan="2" class="big">${esc(meta.name)}</td><td>SHEET ${i + 1} OF ${total}</td></tr>
    <tr><td>SE 310 Project I · balsa truss bridge</td><td>${esc(s.title)}</td><td>${today}</td></tr>
    <tr><td>Balsa ${b} × ${meta.h || b} mm</td><td>mm · angles from a square cut</td><td>${colourMode === 'part' ? 'colour = part' : 'black and white'}${dash ? ' · line pattern = part' : ''}</td></tr>${meta.info ? `<tr><td colspan="3" class="info">SE 310 Truss Explorer ${esc(meta.info)}</td></tr>` : ''}</table></div></section>`).join('');
  const css = `@page{size:letter landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;background:#ddd}
    .sheet{width:263mm;height:199mm;margin:8mm auto;background:#fffdf5;padding:3mm;overflow:hidden;page-break-after:always;break-after:page;box-shadow:0 2px 10px rgba(0,0,0,.2)}
    .frame{border:.5mm solid #111;height:100%;position:relative;padding:6mm 5mm 22mm}
    .content{height:100%;overflow:hidden}
    .zones{position:absolute;left:0;right:0;display:flex;justify-content:space-around;font-size:8pt;color:#555}.zones.top{top:.5mm}.zones.bot{bottom:.5mm}
    .title{position:absolute;right:3mm;bottom:3mm;border-collapse:collapse;font-size:8pt;width:150mm;background:#fffdf5}.title td{border:.3mm solid #111;padding:1mm 2mm}.title .big{font-size:12pt;font-weight:bold}.title .info{font-size:6.5pt;color:#333}
    .parts{float:right;border-collapse:collapse;font-size:7.5pt;margin:0 0 3mm 4mm;background:#fffdf5}.parts th,.parts td{border:.25mm solid #111;padding:.6mm 1.6mm;text-align:center}.parts tr:first-child th{background:#eee}
    .view{width:100%;height:112mm;display:block;clear:both}.asmnote{margin:0 0 2mm}.note{font-size:8pt;color:#333}
    h2{font-size:11pt;margin:0 0 2mm}.two{display:grid;grid-template-columns:1.35fr 1fr;gap:6mm}
    .grid{border-collapse:collapse;font-size:8pt;width:100%}.grid th,.grid td{border:.25mm solid #444;padding:.8mm 1.6mm;text-align:left}.grid.small{font-size:7pt}
    .bar{display:flex;gap:2mm;align-items:center;font-size:7pt;margin:.6mm 0}.bar span{width:20mm}.bar svg{flex:1;height:5mm}
    .pgrid{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:4mm;height:100%}
    .pcard{border:.3mm solid #111;padding:2mm;display:flex;flex-direction:column;font-size:8pt}.ph{display:flex;gap:2mm;align-items:center}.ph .qty{margin-left:auto;font-weight:bold}
    .pd{width:100%;flex:1}.pf{font-size:7pt;color:#333}
    .sw{display:inline-block;width:3mm;height:3mm;border:.2mm solid #111;margin-right:1mm;vertical-align:middle}
    .steps{display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr);gap:3mm;height:calc(100% - 8mm)}
    .step{border:.4mm solid #3a6ea5;border-radius:3mm;padding:2mm;position:relative;background:#fff;display:flex;flex-direction:column}
    .step{overflow:hidden}.step svg{width:100%;flex:1 1 0;min-height:0;height:1px}.step p{margin:0;font-weight:bold;font-size:9pt}.sn{position:absolute;left:2mm;top:1mm;font-size:18pt;font-weight:bold;color:#3a6ea5}
    .callout{margin-left:10mm;display:flex;flex-wrap:wrap;gap:2mm;background:#e9f1fb;border-radius:2mm;padding:1mm 2mm;font-size:8.5pt}
    .ball{display:inline-block;border:.25mm solid #111;border-radius:50%;width:4.4mm;height:4.4mm;text-align:center;font-size:7pt;line-height:4.2mm;background:#fff;font-weight:bold}
    .tpl{height:auto;min-height:199mm}.pgno{font-size:8pt;font-weight:bold;margin:0 0 1mm;text-align:right}.tpl svg{display:block;margin:0 auto}
    .xparts{float:none;margin:0 0 3mm 0;width:100%}.v3{display:flex;flex-direction:column;gap:2mm}.v3 figure{margin:0}.v3 svg{width:100%;height:46mm;display:block}figcaption{font-size:7.5pt;color:#333}
    .frames{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm}.frames figure{margin:0;border:.3mm solid #ccc;padding:2mm}.frames svg{width:100%;height:62mm}
    .ftpls{display:flex;flex-wrap:wrap;gap:8mm;align-items:flex-end}.ftpl{margin:0}
    @media print{body{background:#fff}.sheet{margin:0;box-shadow:none}}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(meta.name)} · build documents</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}${tplPages}</body></html>`;
}

// ===== The bending sheet (#282, TE-B-162): a work instruction for bending the top chord, built to Brian's Work Instruction
// Axioms (2026-10-28): numbered steps with no boxes, a picture for every step so it can be done without reading, ALL CAPS on
// the printed pages, a key in the free space, and the 1:1 bending form, printed `copies` times (spares: a bend dries ~12 h).
// Steps and limits from the Physics Consultant (#282, TE-B-128, TE-B-162). meta: { name, info, code, mat }.
const BEND_INK = '#8c5e22';   // section lines in the logo colour (axioms: WI 1); Graphics sets the final colour and logo
function bendIcons() {
  const L = (d, w) => `<path d="${d}" fill="none" stroke="#111" stroke-width="${w || 1.6}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const T = (x, y, s, sz, a) => `<text x="${x}" y="${y}" font-size="${sz || 9}" font-family="Arial" font-weight="bold" text-anchor="${a || 'middle'}" fill="#111">${s}</text>`;
  const stick = (x0, x1, y) => `<rect x="${x0}" y="${y - 2.5}" width="${x1 - x0}" height="5" fill="#e8c38a" stroke="#111" stroke-width="1.2"/>`;
  const arc = 'M10 46 Q60 4 110 46';
  const pin = (x, y) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#c0392b"/><line x1="${x}" y1="${y}" x2="${x}" y2="${y - 9}" stroke="#111" stroke-width="1.2"/>`;
  return {
    print: `<rect x="14" y="6" width="44" height="52" fill="#fff" stroke="#111" stroke-width="1.4"/>${L('M20 44 h30 M20 41 v6 M50 41 v6', 1.4)}${T(35, 38, '50', 8)}${L('M64 12 l40 40', 3)}${T(96, 20, '100%', 9)}${L('M70 50 h44', 1)}${T(92, 60, 'WAX PAPER', 7)}`,
    cut: `${stick(14, 106, 32)}${L('M14 20 v24 M106 20 v24', 1.2)}${L('M14 16 h14 M14 16 l4 -3 M14 16 l4 3 M106 16 h-14 M106 16 l-4 -3 M106 16 l-4 3', 1.2)}${T(22, 12, '+10-15', 8)}${T(98, 12, '+10-15', 8)}${T(60, 54, 'CUT LONG', 9)}`,
    weigh: `<rect x="28" y="38" width="64" height="14" rx="2" fill="#ddd" stroke="#111" stroke-width="1.4"/>${stick(32, 88, 33)}${T(60, 49, '0.00 g', 9)}${L('M60 18 v8', 1.2)}${T(60, 14, 'WRITE IT DOWN', 8)}`,
    soak: `${L('M10 24 q0 30 30 30 h20 q30 0 30 -30', 1.8)}${L('M14 34 h72', 1)}${stick(20, 80, 40)}${T(50, 14, '15-30 MIN', 9)}${L('M98 40 l8 -12 l8 12 M100 52 c0 -6 4 -6 4 -12 M108 52 c0 -6 4 -6 4 -12', 1.2)}${T(106, 60, '1-3 MIN', 8)}`,
    pin: `${L(arc, 1)}<path d="${arc}" fill="none" stroke="#e8c38a" stroke-width="5"/>${pin(60, 21)}${pin(44, 30)}${pin(76, 30)}${L('M52 12 l-10 6 M68 12 l10 6', 1)}${T(60, 9, '1', 9)}${T(60, 58, 'CROWN FIRST', 9)}`,
    creak: `${stick(18, 102, 36)}${L('M56 30 l4 6 l-4 6 l4 6', 1.6)}${L('M40 16 l40 30 M80 16 l-40 30', 2.2)}${T(60, 58, 'CREAKS? RE-WET, SLOWER', 8)}`,
    check: `${L(arc, 1)}<path d="M10 44 Q60 2 110 44" fill="none" stroke="#e8c38a" stroke-width="5"/>${L('M34 25 l-3 -5 M60 20 l0 -6 M86 25 l3 -5', 1.4)}${T(60, 58, 'GAP ≤ 0.5', 9)}`,
    dry: `<circle cx="38" cy="32" r="18" fill="#fff" stroke="#111" stroke-width="1.6"/>${L('M38 32 v-11 M38 32 l8 5', 1.6)}${T(38, 60, '8-12 H', 9)}${L('M74 18 h30 v24 h-30 z M78 24 h22 M78 30 h22 M78 36 h22', 1.2)}${L('M70 14 l38 34', 2.4)}`,
    dryw: `<rect x="28" y="38" width="64" height="14" rx="2" fill="#ddd" stroke="#111" stroke-width="1.4"/>${stick(32, 88, 33)}${T(60, 49, '±2%', 9)}${T(60, 14, 'SAME AS STEP 3', 8)}`,
    trim: `<path d="M14 44 Q60 10 106 44" fill="none" stroke="#e8c38a" stroke-width="5"/>${L('M14 44 Q60 10 106 44', 1)}${L('M18 32 v18 M102 32 v18', 2)}${T(60, 58, 'TRIM TO LENGTH', 9)}${T(60, 30, '≤ 1', 8)}`,
    pair: `${stick(16, 104, 22)}${stick(16, 104, 38)}${T(60, 58, 'SAME WEIGHT, SAME TIME', 8)}${T(110, 34, '=', 14)}`,
  };
}
function bendingSheetHTML(tr, plan, res, meta, opt) {
  opt = opt || {}; meta = meta || {};
  const b = meta.b || 3.18, copies = Math.max(1, Math.min(8, Math.round(+opt.copies || 1)));
  const bentPieces = plan.pieces.filter(q => q.bent);
  if (!bentPieces.length) return null;
  const ck = bentCheck(tr, plan, res, meta.mat || { b, h: meta.h || b });
  const ic = bendIcons(), U = s => String(s).toUpperCase();
  const code = `WI-BEND-${esc(meta.code || '')}`.replace(/-$/, '');
  const head = (pg, n) => `<div class="hd"><b>${U('Bend the top chord')}</b><span>${code} · ${U(esc(meta.name || 'Design'))} · PAGE ${pg} OF ${n}</span></div>`;
  const foot = `<div class="ft">DESIGNED BY BRIAN G. WALKER AND TRUSS EXPLORER: A CORPORATE AI AGENT TEAM${meta.info ? ` · ${U(esc(meta.info))}` : ''}</div>`;
  const items = [...new Set(bentPieces.map(q => q.item))];
  const per = it => plan.items.find(i => i.no === it);
  const lens = items.map(it => `ITEM ${it}: ${Math.round(per(it).long)} MM`).join(' · ');
  const nSticks = bentPieces.length * (meta.nTruss || 2);
  const steps = [
    ['print', 'PRINT THE FORMS AT 100% (ACTUAL SIZE). CHECK THE 50 MM BAR. TAPE TO A PIN BOARD, WAX PAPER ON TOP.'],
    ['cut', `PICK STRAIGHT-GRAIN, DENSE STICKS. CUT EACH 10-15 MM LONG AT EACH END (${lens}).`],
    ['weigh', 'WEIGH EACH STICK DRY. WRITE THE MASS DOWN.'],
    ['soak', 'SOAK IN HOT TAP WATER 15-30 MIN (WEIGHED DOWN), OR STEAM 1-3 MIN ALONG THE WHOLE CURVE. OVEN MITT.'],
    ['pin', 'PIN AT THE CROWN FIRST, THEN OUT TO EACH END. PINS BESIDE THE STICK, NEVER THROUGH IT, SIDES ALTERNATING EVERY 15-20 MM.'],
    ['creak', 'IF IT CREAKS: STOP, RE-WET, GO SLOWER. A CRACK = A NEW STICK.'],
    ['check', 'IT LIES ON THE LINE: GAP 0.5 MM MAX. PENCIL THE JOINT TICKS ONTO THE STICK WHILE PINNED.'],
    ['dry', 'DRY PINNED AT ROOM TEMPERATURE 8-12 H. NO HEATER, NO HOT DRYER.'],
    ['dryw', 'DRY = MASS BACK WITHIN 2% OF STEP 3.'],
    ['trim', 'UNPIN. WITHIN 1 MM OF THE LINE IS FINE. TRIM BOTH ENDS TO LENGTH.'],
    ['pair', 'BEND EACH PAIR (FRONT AND BACK TRUSS) FROM STICKS OF SIMILAR WEIGHT, AT THE SAME TIME.'],
  ];
  const stepHTML = steps.map(([k, s], i) => `<div class="st"><div class="n">${i + 1}</div><svg viewBox="0 0 120 62">${ic[k]}</svg><p>${s}</p></div>`).join('');
  const key = `<div class="key"><b>KEY</b><ul>
    <li>DO THE WHOLE ROUTINE ON A SCRAP OF THE SAME STOCK FIRST.</li>
    <li>START THE EVENING BEFORE THE BUILD: IT DRIES OVERNIGHT.</li>
    <li>${copies} FORM${copies > 1 ? 'S' : ''} PRINTED FOR ${nSticks} STICK${nSticks > 1 ? 'S' : ''}${copies * items.length > nSticks ? ' + SPARES' : ''}.</li>
    <li>${ck.mustSoak ? `BENT DRY IT CRACKS: ${(ck.strain * 100).toFixed(2)}% STRETCH VS ${(ck.strainLimit * 100).toFixed(2)}% (RADIUS ${Math.round(ck.Rmin)} MM).` : 'THIS CURVE CAN BE BENT DRY.'}</li>
    ${ck.tooTight ? '<li style="color:#c0392b">TOO TIGHT FOR ONE STICK: USE STRAIGHT PIECES.</li>' : `<li>ONCE DRY, UP TO ${Math.round(ck.worstUse * 100)}% OF ITS STRENGTH AT THE DESIGN LOAD.</li>`}
    <li>TOLERANCE: X = ±1 MM. FORM DRAWN EXACT; 50 MM BAR ±0.5.</li></ul></div>`;
  const pages = [`<section class="pg">${head(1, 1 + copies * items.length)}<div class="steps">${stepHTML}${key}</div>${foot}</section>`];
  let pg = 1;
  items.forEach(it => {
    const q = bentPieces.find(p2 => p2.item === it), F = bendForm(tr, q, b);
    const X0 = Math.min(...F.xs) - 14, X1 = Math.max(...F.xs) + 14, Y0 = Math.min(...F.ys) - 16, Y1 = Math.max(...F.ys) + 16, w = X1 - X0, h = Y1 - Y0;
    const pl = a2 => a2.map(z => `${z[0].toFixed(2)},${(Y1 - z[1]).toFixed(2)}`).join(' ');
    const mid = (Math.min(...F.xs) + Math.max(...F.xs)) / 2;
    const svg = `<svg width="${w}mm" height="${h + 18}mm" viewBox="${X0} 0 ${w} ${h + 18}">
      <polyline points="${pl(F.up)}" fill="none" stroke="#000" stroke-width=".3"/><polyline points="${pl(F.dn)}" fill="none" stroke="#000" stroke-width=".3"/>
      <line x1="${mid}" y1="2" x2="${mid}" y2="${h - 2}" stroke="#555" stroke-width=".25" stroke-dasharray="3 1.5 .6 1.5"/>
      ${F.ticks.map((tk, i) => `<line x1="${tk.a[0]}" y1="${Y1 - tk.a[1]}" x2="${tk.c[0]}" y2="${Y1 - tk.c[1]}" stroke="#000" stroke-width=".45"/>${i === 0 || i === F.ticks.length - 1 ? `<text x="${tk.a[0]}" y="${Y1 - tk.a[1] - 1.2}" font-size="3" text-anchor="middle" font-family="Arial" font-weight="bold">END</text>` : ''}`).join('')}
      ${F.pins.map(pn => `<circle cx="${pn[0]}" cy="${Y1 - pn[1]}" r=".9" fill="none" stroke="#000" stroke-width=".35"/>`).join('')}
      <g stroke="#000" stroke-width=".35"><line x1="${X0 + 6}" y1="${h + 8}" x2="${X0 + 56}" y2="${h + 8}"/><line x1="${X0 + 6}" y1="${h + 6}" x2="${X0 + 6}" y2="${h + 10}"/><line x1="${X0 + 56}" y1="${h + 6}" x2="${X0 + 56}" y2="${h + 10}"/></g>
      <text x="${X0 + 31}" y="${h + 14}" font-size="3.2" text-anchor="middle" font-family="Arial" font-weight="bold">50 ±0.5</text></svg>`;
    for (let c = 0; c < copies; c++) {
      pg++;
      pages.push(`<section class="pg">${head(pg, 1 + copies * items.length)}<div class="form"><div class="fn"><b>BENDING FORM ${c + 1} OF ${copies}${items.length > 1 ? ` · ITEM ${it}` : ''}</b> · ACTUAL SIZE · CUT ${Math.round(per(it).long)} MM ALONG THE CURVE, +10-15 EACH END, TRIM AFTER DRYING · TICKS = JOINTS · O = PIN, BESIDE THE STICK · MIRRORED ALONG THE DOTTED LINE</div>${svg}</div>${foot}</section>`);
    }
  });
  const css = `@page{size:letter landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111;background:#ddd}
    .pg{width:263mm;height:199mm;margin:8mm auto;background:#fff;padding:4mm 6mm;display:flex;flex-direction:column;page-break-after:always;break-after:page;overflow:hidden}
    .hd{display:flex;justify-content:space-between;align-items:baseline;border-bottom:.7mm solid ${BEND_INK};padding-bottom:1.5mm;margin-bottom:3mm;font-size:9pt}.hd b{font-size:15pt;letter-spacing:.04em}
    .ft{margin-top:auto;border-top:.5mm solid ${BEND_INK};padding-top:1mm;font-size:6.5pt;text-align:center;letter-spacing:.05em}
    .steps{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);gap:2.5mm 4mm;flex:1;min-height:0}
    .st{position:relative;display:flex;flex-direction:column;min-height:0}.st .n{position:absolute;left:0;top:-1mm;font-size:22pt;font-weight:bold;color:${BEND_INK}}
    .st svg{flex:1;min-height:0;width:100%;margin-left:7mm;width:calc(100% - 7mm)}.st p{margin:.5mm 0 0;font-size:7pt;font-weight:bold;line-height:1.25}
    .key{border-left:.7mm solid ${BEND_INK};padding-left:2.5mm;font-size:7pt}.key ul{margin:1mm 0 0;padding-left:3.5mm}.key li{margin-bottom:.8mm}
    .form{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center}.fn{font-size:8pt;margin-bottom:3mm;text-align:center}
    @media print{body{background:#fff}.pg{margin:0}}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(meta.name || 'Design')} · bending sheet</title><style>${css}</style></head><body>${pages.join('')}</body></html>`;
}
const api = { bentCheck, bendingSheetHTML, edgeMarks, edgeStops, jointsOf, defaultJoint, cutPlan, stockPlan, documentHTML, sideSVG, partDetail, cutTxt, TL, colOf, dashOf, crossPlan, crossKind, view3, distinctFrames, XL };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuildDoc = api;
})(typeof window !== 'undefined' ? window : globalThis);
