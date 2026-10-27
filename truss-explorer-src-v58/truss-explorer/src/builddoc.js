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
  const ends = {};
  tr.elems.forEach((e, k) => {
    [e.i, e.j].forEach(n => {
      const j = byNode[n], p = j.p, me = j.m.find(q => q.k === k), u = me.dir, nrm = perp(u);
      const r = rule(n), key = k + '@' + n;
      if (cont[n] && cont[n].has(k)) { ends[key] = { kind: 'through', eA: null, eB: null, ang: 0 }; return; }
      const edge = (o, q, c) => meet(add(p, mul(nrm, o)), u, q, c);
      const others = j.m.filter(q => q.k !== k);
      if (!others.length) { ends[key] = { kind: 'free', eA: 0, eB: 0, ang: 0 }; return; }
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
      if (r.end === 'square') { const e2 = Math.max(eA, eB); ends[key] = { kind: 'square', eA: e2, eB: e2, ang: 0, against: t.k }; }
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
  // a piece longer than one stock stick is spliced at joints (#116): where the chord force is lowest, preferring
  // compression (a square butt carries it by bearing) over tension (needs a splint). cfg.stock, cfg.force(k) -> N
  const splices = [];
  if (cfg.stock > 0) {
    const out = [];
    pieces.forEach(q => {
      if (q.long <= cfg.stock + 1e-9 || q.members.length < 2) { out.push(q); return; }
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
  // parts list: identical pieces (to 0.5 mm and 1°) share an item number
  const keyOf = q => [q.type, (Math.round(q.long * 2) / 2).toFixed(1), (Math.round(q.short * 2) / 2).toFixed(1), [Math.round(q.cut0.ang), Math.round(q.cut1.ang)].sort((a, b2) => a - b2).join('/'), q.n].join('|');
  const items = [];
  pieces.forEach(q => { const key = keyOf(q); let it = items.find(i => i.key === key); if (!it) { it = { key, no: items.length + 1, type: q.type, long: q.long, short: q.short, cuts: [q.cut0, q.cut1], n: q.n, pieces: [] }; items.push(it); } it.pieces.push(q); q.item = it.no; });
  return { joints: J.map(j => Object.assign({ n: j.n, members: j.m.map(q => q.k) }, rule(j.n))), ends, pieces, items, splices };
}
const SPLICE = { kind: 'splice', eA: 0, eB: 0, ang: 0 };

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
const cutTxt = c => c.kind === 'through' ? 'runs through' : c.kind === 'end' ? 'square, runs past' : c.kind === 'free' ? 'square' : c.kind === 'square' ? 'square (90°)' : c.kind === 'splice' ? 'square, splice at a joint' : c.kind === 'lap' ? 'square, laps the chord' : `${Math.round(c.ang)}° ${c.kind === 'mitre' ? 'mitre' : c.kind === 'bevel' ? 'bevel' : 'flush'}`;

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
  const pieceOf = {}; plan.pieces.forEach(q => q.members.forEach(k => { pieceOf[k] = q; }));
  tr.elems.forEach((e, k) => {
    const p = tr.nodes[e.i], q = tr.nodes[e.j], it = pieceOf[k] ? pieceOf[k].item : 1;
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
      const a = tr.nodes[q.nodes[0]], c = tr.nodes[q.nodes[1]], m = mul(add(a, c), 0.5), d = unit(sub(c, a)), nv = perp(d);
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
  const isX = it => !!it.label, lab = it => it.label || TL[it.type] || it.type, qty = it => isX(it) ? it.pieces.length : it.pieces.length * nT * it.n;
  const allCuts = []; plan.pieces.forEach(q => { for (let t = 0; t < nT * q.n; t++) allCuts.push({ len: q.long, item: q.item }); });
  if (cx) cx.parts.forEach(q => allCuts.push({ len: q.long, item: q.item }));
  if (stopItem) stopItem.pieces.forEach(() => allCuts.push({ len: STOP_LEN, item: stopItem.no }));
  else if (meta.ties && meta.ties.count) for (let t = 0; t < meta.ties.count; t++) allCuts.push({ len: meta.ties.len, item: 'T' });
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
  const spliceNote = splices.length ? ` <b>Splices</b> (red marks): ${splices.length} chord joint${splices.length > 1 ? 's' : ''} where a piece longer than one ${stock} mm stick is joined: square butt ends at the joint centre, placed where the chord force is lowest (${splices.map(s => Math.abs(s.F) < 0.005 ? 'no force' : `${Math.abs(s.F).toFixed(2)} N ${s.tension ? 'tension: glue a splint across it' : 'compression'}`).join('; ')}).` : '';
  // 1. assembly drawing (side truss)
  const v = sideSVG(tr, plan, { labels: true, balloons: true, dims: true, b, color: colourMode, dash });
  const partsArr = plan.items.map(it => `<tr><td>${swatch(it.no)}${it.no}</td><td>${qty(it)}</td><td>${f1(it.long)}</td><td>${Math.abs(it.long - it.short) > 0.05 ? f1(it.short) : '—'}</td><td>${it.cuts.map(cutTxt).join(' / ')}</td><td>${lab(it)}${it.n > 1 ? ` (${it.n} sticks glued)` : ''}${pattern(it.no)}</td></tr>`)
    .concat(stopItem ? [`<tr><td>${swatch(stopItem.no)}${stopItem.no}</td><td>${qty(stopItem)}</td><td>${f1(STOP_LEN)}</td><td>—</td><td>square / square</td><td>Edge stop: glued under each corner joint, against the table's face</td></tr>`] : [])
    .concat(!cx && meta.ties && meta.ties.count ? [`<tr><td>T</td><td>${meta.ties.count}</td><td>${f1(meta.ties.len)}</td><td>—</td><td>square</td><td>Cross-tie between the trusses</td></tr>`] : []);
  const partsHead = `<tr><th colspan="6">PARTS LIST · ${nT} TRUSSES</th></tr><tr><th>ITEM</th><th>QTY</th><th>LENGTH</th><th>SHORT PT</th><th>END CUTS</th><th>DESCRIPTION</th></tr>`;
  const ownParts = partsArr.length > 10;   // too many rows to sit beside the drawing
  sheet('Assembly drawing', `${ownParts ? `<p class="note asmnote"><b>Parts list: next sheet${partsArr.length > 30 ? 's' : ''}.</b></p>` : `<table class="parts">${partsHead}${partsArr.join('')}</table>`}
    <p class="note asmnote">Side view of one truss, mm. Each part is dimensioned once (long point); identical parts carry the same item balloon. Build ${nT} identical trusses${cx ? (cx.sameTrusses ? ' (checked: the front and back trusses of the 3D model are identical)' : ' — <b>the front and back trusses differ: see the 3D sheets</b>') : ''}.${cx && cx.tilt ? ` In the 3D bridge each truss leans ${f1(cx.tilt)}° inward about its bottom chord; build it flat, exactly as drawn.` : ''}${spliceNote}${marks.length ? ` <b>Desk edge</b> (green marks): line these up with the desk edges${(+tr.design.supportOffset || 0) ? `; the support joints sit ${f1(+tr.design.supportOffset)} mm onto the desks` : ''}.` : ''}${stopItem ? ` <b>Edge stops</b>: ${stops.length * nT} sticks of ${STOP_LEN} mm glued under the corner joints, hanging down the table's face so the edge can push the bridge inward (${f1(stopItem.pieces.length * STOP_LEN)} mm of stick, not counted in the app's wood).` : ''}
    ${cx ? `Centre-to-centre wood ${f1(cc2 + ccX)} mm (side trusses ${f1(cc2)} + 3D parts ${f1(ccX)}; the app's "Wood in the 3D model" is ${f1(d3.r3.wood)} mm) · cut length ${f1(totalLen)} mm with joint allowances` : `Stick total ${f1(totalLen)} mm`} · ${meta.massNote || ''} · capacity ${meta.capNote || ''}.</p>
    <svg class="view" style="height:${ownParts ? 120 : Math.max(70, 112 - Math.max(0, partsArr.length - 7) * 5)}mm" viewBox="${v.box.join(' ')}">${v.svg}${spliceMarks(v.Y)}${markSVG(tr, marks, stops, v.Y, b, stopItem && colourMode === 'part' ? colOf(stopItem.no) : '#fff')}</svg>`);
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
      <div class="pf">Balsa ${b} × ${meta.h || b} · long point <b>${f1(it.long)}</b>${Math.abs(it.long - it.short) > 0.05 ? ` · short point ${f1(it.short)}` : ''}${isX(it) ? ` · c-c ${f1(it.cc)}` : ''} · ends ${it.cuts.map(cutTxt).join(' / ')}${isX(it) && it.cuts.some(c => c.kind === 'flush') ? ` (angle seen in the ${it.view})` : ''}${pattern(it.no)}</div></div>`).join('');
    sheet(`Part drawings ${allItems.length > per ? `(${Math.floor(s0 / per) + 1})` : ''}`, `<div class="pgrid">${cards}</div>`);
  }
  // 3. cut list, cutting plan and joints
  const barArr = bars.map((B, i) => { let x = 0;
    const segs = B.cuts.map(c => { const r = `<rect x="${x}" y="0" width="${c.len}" height="8" fill="${c.item === 'T' ? '#ddd' : colourMode === 'part' ? colOf(c.item) : '#fff'}" fill-opacity=".55" stroke="#333" stroke-width=".4"/><text x="${x + c.len / 2}" y="5.6" font-size="4.2" text-anchor="middle" font-family="Arial">${c.item}</text>`; x += c.len + kerf; return r; }).join('');
    return `<div class="bar"><span>Stick ${i + 1}${B.over ? ' (too long!)' : ''}</span><svg viewBox="-1 -1 ${stock + 2} 10" preserveAspectRatio="none">${segs}<rect x="0" y="0" width="${stock}" height="8" fill="none" stroke="#999" stroke-width=".3"/></svg></div>`; });
  const cutArr = allItems.map(it => `<tr><td>${swatch(it.no)}${it.no}</td><td>${lab(it)}</td><td>${qty(it)}</td><td><b>${f1(it.long)}</b></td><td>${f1(it.short)}</td><td>${cutTxt(it.cuts[0])}</td><td>${cutTxt(it.cuts[1])}</td></tr>`);
  const jArr = plan.joints.map(j => `<tr><td>${j.n}</td><td>${j.members.join(', ')}</td><td>${j.through == null ? '—' : j.through}</td><td>${j.end}${j.end === 'mitre' ? ' ' + j.split + '/' + (100 - j.split) : ''}</td></tr>`);
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
  const cutNote = `<p class="note">Measure the long point, mark the angle (part drawings, or the templates), and cut on the waste side. "Flush" ends sit flat on the member on top; "mitre" ends meet their partner on a shared line; "runs through" continues past the joint.${splices.length ? ' "Splice" ends butt square at a joint centre.' : ''}</p>`;
  const planNote = `<p class="note">${bars.length} stick${bars.length > 1 ? 's' : ''} of ${stock} mm, ${kerf} mm saw kerf.${bars.some(B => B.over) ? ' <b>A part is longer than one stick: join it at a joint (see the assembly drawing).</b>' : ''}</p>`;
  const jHead = '<tr><th>Joint</th><th>Members</th><th>On top</th><th>Others</th></tr>';
  if (cutArr.length <= 16 && barArr.length <= 22) {
    // a small set: cut list and cutting plan side by side, as before
    sheet('Cut list and cutting plan', `<div class="two"><div><h2>Cut list</h2><table class="grid">${cutHead}${cutArr.join('')}</table>${cutNote}</div><div><h2>Cutting plan</h2>${planNote}${barArr.join('')}</div></div>`);
  } else {
    const cc = chunk(cutArr, 24); cc.forEach((rows, i) => sheet(cont('Cut list', i, cc.length), `<h2>${cont('Cut list', i, cc.length)}</h2><table class="grid">${cutHead}${rows.join('')}</table>${i === cc.length - 1 ? cutNote : ''}`));
    const bc = chunk(barArr, 24); bc.forEach((rows, i) => sheet(cont('Cutting plan', i, bc.length), `<h2>${cont('Cutting plan', i, bc.length)}</h2>${i === 0 ? planNote : ''}${rows.join('')}`));
  }
  const jc = chunk(jArr, 30);
  const xjOwn = xjRows.length > 12;   // a long 3D joints table gets its own sheets
  jc.forEach((rows, i) => sheet(cont('Joints', i, jc.length), `<div class="two"><div><h2>${cont('Joints', i, jc.length)}</h2><table class="grid small">${jHead}${rows.join('')}</table></div><div>${i === 0 && !xjOwn ? xJoints : ''}</div></div>`));
  if (xjOwn) { const xc = chunk(xjRows, 22); xc.forEach((rows, i) => sheet(cont('3D joints', i, xc.length), `<h2>${cont('3D joints', i, xc.length)}</h2><table class="grid">${xjHead}${rows.join('')}</table>${i === xc.length - 1 ? xjNote : ''}`)); }
  // 4. build steps
  if (opt.steps) {
    const order = [['bot', 'Lay the bottom chord'], ['top', 'Add the top chord'], ['end', 'Add the end posts'], ['vert', 'Glue in the verticals'], ['diag', 'Glue in the diagonals'], ['brace', 'Add the edge braces'], ['claw', 'Add the claws']];
    const done = new Set(); let stepNo = 0;
    const callOf = its => Object.entries(its).map(([no, c]) => `<div class="part"><b>${c}×</b> ${ball(+no)} ${f1(allItems[no - 1].long)}</div>`).join('');
    const box = (callout, vv, title) => `<div class="step"><div class="sn">${++stepNo}</div><div class="callout">${callout}</div><svg viewBox="${vv.box.join(' ')}">${vv.svg}</svg><p>${title}</p></div>`;
    const steps = order.map(([ty, title]) => {
      const ks = tr.elems.map((e, k) => e.type === ty ? k : -1).filter(k => k >= 0); if (!ks.length) return '';
      const hi = new Set(ks), gr = new Set(done); ks.forEach(k => done.add(k));
      const vv = sideSVG(tr, plan, { highlight: new Set([...hi, ...gr]), grey: gr, b, color: colourMode === 'part' ? 'part' : '#c0392b', dash });
      const its = {}; plan.pieces.filter(q => q.members.some(k => hi.has(k))).forEach(q => { its[q.item] = (its[q.item] || 0) + 1; });
      const spl = ty === 'bot' || ty === 'top' ? splices.filter(s => s.type === ty) : [];
      return box(callOf(its), { box: vv.box, svg: vv.svg + (spl.length ? spliceMarks(vv.Y) : '') }, title + (spl.length ? ` (${spl.length + 1} pieces: butt them at the red marks${spl.some(s => s.tension) ? ', with a splint where marked' : ''})` : ''));
    }).filter(Boolean);
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
      steps.push(box('', sideAll, `Build the second truss on the same full-size template, then lay it on the first: every joint should line up${cx.sameTrusses ? '' : ' (the 3D model has different front and back trusses: check the 3D sheets)'}`));
      const endK = new Set([...endSt].flatMap(frameParts));
      const fe = frames.find(g => g.stations.includes(0)), fv0 = fe ? view3(m3, cx, { view: 'end', station: 0, colour: colourMode === 'part' ? 'part' : '#c0392b', b }) : null;
      if (fv0) steps.push(box('', fv0, `Stand both trusses upright, ${f1(Math.abs(m3.nodes[m3.frames[0].b + m3.n][1] - m3.nodes[m3.frames[0].b][1]))} mm apart at the bottom (centre to centre), on the full-size cross-frame templates${cx.tilt ? `, leaning ${f1(cx.tilt)}° inward` : ''}. Weight or pin them so they cannot move`));
      step3(cx.parts.filter(q => endK.has(q.k)), 'end', { station: 0 }, 'Glue the end frames first (ties and sway diagonals at the first and last station). Check each end is square on the template before the glue sets');
      step3(ofKind('tieTop', 'tieMid').filter(q => !built.has(q.k)), 'plan', {}, `Add the remaining top ties, working from the ends to the middle${cx.onTop ? ', glued flat on top of both chords' : ''}`);
      const xOnce = new Set(); cx.parts.forEach(q => { if ((q.kind === 'latTop' || q.kind === 'latBot' || q.kind === 'sway') && cx.parts.some(o2 => o2 !== q && o2.kind === q.kind && Math.abs((m3.nodes[o2.nodes[0]][0] + m3.nodes[o2.nodes[1]][0]) - (m3.nodes[q.nodes[0]][0] + m3.nodes[q.nodes[1]][0])) < 0.5 && cx.parts.indexOf(o2) < cx.parts.indexOf(q))) xOnce.add(q.k); });
      step3(ofKind('latTop').filter(q => !built.has(q.k) && !xOnce.has(q.k)), 'plan', {}, 'Glue in the top lateral bracing, butted between the chords under the ties');
      step3(ofKind('tieBot').filter(q => !built.has(q.k)), 'bottom', {}, 'Add the bottom ties, butted between the bottom chords (not under them)');
      step3(ofKind('latBot').filter(q => !built.has(q.k) && !xOnce.has(q.k)), 'bottom', {}, 'Glue in the bottom lateral bracing');
      step3(ofKind('sway').filter(q => !built.has(q.k) && !xOnce.has(q.k)), 'end', { station: Math.max(0, m3.frames.findIndex(f => f.code !== 'N' && !endSt.has(m3.frames.indexOf(f)))) }, 'Glue in the sway diagonals of the other cross-frames');
      const second = cx.parts.filter(q => xOnce.has(q.k) && !built.has(q.k));
      if (second.length) step3(second, second.every(q => q.kind === 'sway') ? 'end' : second.some(q => q.kind === 'latBot') && !second.some(q => q.kind === 'latTop') ? 'bottom' : 'plan', {}, 'Last: the second diagonal of each X. Measure the real gap after the first is set and cut to fit; never force a long one in');
      steps.push(`<div class="step"><div class="sn">${++stepNo}</div><p style="margin-top:12mm;font-size:11pt">Let the cement dry completely before anything is loaded (see the cement's label; overnight is safest). Check the bridge sits flat and square, and against the 3D view in the app.</p></div>`);
    }
    for (let s0 = 0; s0 < steps.length; s0 += 4) sheet('Build steps', `<h2 style="margin:0 0 4px">Build steps <span class="note">(${cx ? 'one truss first; then the 3D frame' : `one truss; build ${nT === 2 ? 'the second' : 'the others'} the same way, then join them with the cross-ties`})</span></h2><div class="steps">${steps.slice(s0, s0 + 4).join('')}</div>`);
  }
  // 5. full-size templates, tiled to fit the page
  const tpls = [];   // full-size template pages: [inner html]
  if (opt.templates) {
    const tw = 240, th = 160, xs = tr.nodes.map(p => p[0]), ys = tr.nodes.map(p => p[1]);
    const X0 = Math.min(...xs) - 6, X1 = Math.max(...xs) + 6, Y0 = Math.min(...ys, ...stops.map(s => s.y0)) - 6, Y1 = Math.max(...ys) + 6, hgt = Math.min(th, Y1 - Y0 + 24);
    const pieceOf = {}; plan.pieces.forEach(q => q.members.forEach(k => { pieceOf[k] = q; }));
    const edges = tr.elems.map((e, k) => { const p = tr.nodes[e.i], q = tr.nodes[e.j], d = unit(sub(q, p)), nv = mul(perp(d), b * Math.sqrt(e.n || 1) / 2);
      return `<polygon points="${[add(p, nv), add(q, nv), sub(q, nv), sub(p, nv)].map(z => `${z[0]},${Y1 - z[1]}`).join(' ')}" fill="${colourMode === 'part' ? colOf(pieceOf[k].item) : 'none'}" fill-opacity=".25" stroke="#000" stroke-width=".2"/><line x1="${p[0]}" y1="${Y1 - p[1]}" x2="${q[0]}" y2="${Y1 - q[1]}" stroke="#666" stroke-width=".15" stroke-dasharray="${dash ? dashOf(pieceOf[k].item) || '1 1' : '1 1'}"/>`; }).join('')
      + splices.map(s => { const p = tr.nodes[s.node]; return `<line x1="${p[0]}" y1="${Y1 - p[1] - 4}" x2="${p[0]}" y2="${Y1 - p[1] + 4}" stroke="#c0392b" stroke-width=".35"/>`; }).join('')
      + markSVG(tr, marks, stops, y => Y1 - y, b, 'none');
    const scale = (tx, h) => `<g stroke="#000" stroke-width=".3"><line x1="${tx + 5}" y1="${h - 6}" x2="${tx + 55}" y2="${h - 6}"/><line x1="${tx + 5}" y1="${h - 8}" x2="${tx + 5}" y2="${h - 4}"/><line x1="${tx + 55}" y1="${h - 8}" x2="${tx + 55}" y2="${h - 4}"/></g><text x="${tx + 30}" y="${h - 1}" font-size="3" text-anchor="middle" font-family="Arial">50 mm</text>`;
    const tiles = []; for (let tx = X0; tx < X1 - 1; tx += tw - 10) tiles.push(tx);
    tiles.forEach((tx, i) => tpls.push(`<p class="note">Full-size template${cx ? ' (side truss: build both on it)' : ''} · tile ${i + 1} of ${tiles.length} · print at 100% (actual size) and check that the bar measures 50 mm. Tiles overlap by 10 mm; line up the + marks.</p>
      <svg width="${tw}mm" height="${hgt}mm" viewBox="${tx} 0 ${tw} ${hgt}">${edges}${scale(tx, hgt)}
        ${[tx + tw - 10, tx + 10].map(mx => `<path d="M${mx - 3} 6 h6 M${mx} 3 v6" stroke="#000" stroke-width=".3"/>`).join('')}</svg>`));
    // 3D: one full-size template per different cross-frame (stand the trusses on it), and the top plane
    if (cx) {
      const m3 = d3.m3, full = (vv, cap) => { const [bx, by, bw, bh] = vv.box, h2 = bh + 14; return `<figure class="ftpl"><svg width="${bw}mm" height="${h2}mm" viewBox="${bx} ${by} ${bw} ${h2}">${vv.svg.replace(/fill="#e9e9e9"/g, 'fill="none"')}${scale(bx, by + h2)}</svg><figcaption>${cap}</figcaption></figure>`; };
      const ft = frames.map(g => { const vv = view3(m3, cx, { view: 'end', station: g.stations[0], balloons: true, colour: colourMode === 'part' ? 'part' : 'mono', b }); return vv ? full(vv, `Cross-frame, station${g.stations.length > 1 ? 's' : ''} ${g.stations.map(s => s + 1).join(', ')} · full size`) : ''; }).join('');
      tpls.push(`<p class="note">Full-size cross-frame templates · print at 100% and check the 50 mm bar. Stand the two trusses on these (front truss on the left) to set the spacing${cx.tilt ? ' and the lean' : ''}; build each frame flat on its template.</p><div class="ftpls">${ft}</div>`);
      const pv = view3(m3, cx, { view: 'plan', balloons: true, colour: colourMode === 'part' ? 'part' : 'mono', b });
      if (pv) { const [bx, by, bw, bh] = pv.box, ptiles = []; for (let tx = bx; tx < bx + bw - 1; tx += tw - 10) ptiles.push(tx);
        ptiles.forEach((tx, i) => tpls.push(`<p class="note">Full-size top plane (from above) · tile ${i + 1} of ${ptiles.length} · print at 100%. Lay it under the finished frame to place the ties and bracing.</p><svg width="${tw}mm" height="${bh + 14}mm" viewBox="${tx} ${by} ${tw} ${bh + 14}">${pv.svg}${scale(tx, by + bh + 14)}</svg>`)); }
    }
  }
  const total = sheets.length + tpls.length;
  // every printed page carries its number (#157): the sheets in their title blocks, the templates in their header
  const tplPages = tpls.map((h, i) => `<section class="sheet tpl"><p class="pgno">${esc(meta.name)} · page ${sheets.length + i + 1} of ${total} · template T${i + 1} of ${tpls.length}</p>${h}</section>`).join('');
  const html = sheets.map((s, i) => `<section class="sheet ${s.cls || ''}"><div class="frame"><div class="zones top"><span>4</span><span>3</span><span>2</span><span>1</span></div><div class="zones bot"><span>4</span><span>3</span><span>2</span><span>1</span></div><div class="content">${s.body}</div>
    <table class="title"><tr><td colspan="2" class="big">${esc(meta.name)}</td><td>SHEET ${i + 1} OF ${total}</td></tr>
    <tr><td>SE 310 Project I · balsa truss bridge</td><td>${esc(s.title)}</td><td>${today}</td></tr>
    <tr><td>Balsa ${b} × ${meta.h || b} mm</td><td>mm · angles from a square cut</td><td>${colourMode === 'part' ? 'colour = part' : 'black and white'}${dash ? ' · line pattern = part' : ''}</td></tr></table></div></section>`).join('');
  const css = `@page{size:letter landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;background:#ddd}
    .sheet{width:263mm;height:199mm;margin:8mm auto;background:#fffdf5;padding:3mm;overflow:hidden;page-break-after:always;break-after:page;box-shadow:0 2px 10px rgba(0,0,0,.2)}
    .frame{border:.5mm solid #111;height:100%;position:relative;padding:6mm 5mm 22mm}
    .content{height:100%;overflow:hidden}
    .zones{position:absolute;left:0;right:0;display:flex;justify-content:space-around;font-size:8pt;color:#555}.zones.top{top:.5mm}.zones.bot{bottom:.5mm}
    .title{position:absolute;right:3mm;bottom:3mm;border-collapse:collapse;font-size:8pt;width:150mm;background:#fffdf5}.title td{border:.3mm solid #111;padding:1mm 2mm}.title .big{font-size:12pt;font-weight:bold}
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

const api = { edgeMarks, edgeStops, jointsOf, defaultJoint, cutPlan, stockPlan, documentHTML, sideSVG, partDetail, cutTxt, TL, colOf, dashOf, crossPlan, crossKind, view3, distinctFrames, XL };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuildDoc = api;
})(typeof window !== 'undefined' ? window : globalThis);
