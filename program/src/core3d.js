// ===== 3D prototype: two side trusses (the 2D design) at +/- half the bridge width, tilted in y, joined by ties and bracing =====
// Coordinates: x along the bridge, y across it, z up. A 3D pin-jointed truss, 3 degrees of freedom per joint.
(function (root) {
'use strict';

// opts: { width, tilt (deg, + leans the tops inward), bottomTies,
//   topPat / botPat: lateral bracing in the top and bottom planes (xy), one code per panel, left half (mirrored):
//        'N' none, 'S' single diagonal, 'R' the other diagonal, 'X' both
//   framePat: cross-frames (zy plane) at each frame station, left half (mirrored):
//        'N' none, 'D' diagonal top-front to bottom-back, 'E' top-back to bottom-front, 'X' both, 'K' K-brace from a joint at mid-width of the top tie
//   older options still accepted: topBrace / botBrace ('none'|'single'|'x'), sway (end frames only) }
// helper: the code for station k of `count`, read from the left half and mirrored about mid-span (S <-> R, D <-> E swap on the right)
function mirroredCode(pat, k, count, swap) {
  const half = Math.ceil(count / 2), i = k < half ? k : count - 1 - k;
  const code = (pat && pat[Math.min(i, pat.length - 1)]) || 'N';
  return k < half || !swap ? code : (swap[code] || code);
}
function build3D(tr, o) {
  const W = +o.width || 60, phi = (+o.tilt || 0) * Math.PI / 180, sn = Math.sin(phi), cs = Math.cos(phi);
  const n = tr.nodes.length, S = tr.design.span || 200;
  const nodes = [], elems = [], warn = [];
  // front truss at y = -W/2, back truss at y = +W/2; each leans about its own bottom line (z = 0)
  tr.nodes.forEach(([x, z]) => nodes.push([x, -W / 2 + z * sn, z * cs]));
  tr.nodes.forEach(([x, z]) => nodes.push([x, W / 2 - z * sn, z * cs]));
  const F = i => i, B = i => i + n;
  tr.elems.forEach((e, k2) => {
    if (e.type === 'claw' || e.type === 'brace') return;   // table hooks are 2D-only for now
    elems.push({ i: F(e.i), j: F(e.j), type: e.type, n: e.n, bundle: e.bundle, side: 'front', e2: k2 });
    elems.push({ i: B(e.i), j: B(e.j), type: e.type, n: e.n, bundle: e.bundle, side: 'back', e2: k2 });
  });
  if (tr.elems.some(e => e.type === 'claw' || e.type === 'brace')) warn.push('Claws and edge braces are left out of the 3D prototype.');
  const deck = tr.deckNodes.slice().sort((a, b) => tr.nodes[a][0] - tr.nodes[b][0]);
  const byX = (a, b) => tr.nodes[a][0] - tr.nodes[b][0];
  // bottom-chord joints only (B0, B1, ... and the support joints SL / SR), never the claw or brace joints under the table
  // the bottom chord in path order: B0 … plus the table-corner joints CL / CR when an end drops down the face of the table
  // (at the corner the path goes down on the left, x = 0: CL before B1; and up on the right, x = span: B5 before CR)
  const bottom = tr.nodes.map((p, i) => i).filter(i => /^(B\d+|S[LR]|C[LR])$/.test(tr.keys[i]))
    .sort((a, b) => (tr.nodes[a][0] - tr.nodes[b][0]) || (tr.nodes[a][0] <= S / 2 ? tr.nodes[b][1] - tr.nodes[a][1] : tr.nodes[a][1] - tr.nodes[b][1]));
  // every top-chord joint (deck joints plus any over the desks) is tied across, so no joint is left free to swing sideways
  const top = [...new Set(tr.nodes.map((p, i) => i).filter(i => /^T/.test(tr.keys[i])).concat(deck))].sort(byX);
  const seen = new Set();
  const add = (i, j, type, plane) => { const k = i < j ? i + '-' + j : j + '-' + i; if (i === j || seen.has(k)) return; seen.add(k); elems.push({ i, j, type, n: 1, bundle: 'row', side: 'cross', plane: plane || (type === 'sway' ? 'frame' : '') }); };
  elems.forEach(e => seen.add(e.i < e.j ? e.i + '-' + e.j : e.j + '-' + e.i));
  top.forEach(d => add(F(d), B(d), 'tie'));
  if (o.bottomTies) bottom.forEach(b => add(F(b), B(b), 'tie'));
  // ---- xy planes: lateral bracing between consecutive joints of the top and of the bottom chords
  const legacy = m => m === 'x' ? ['X'] : m === 'none' ? ['N'] : ['S'];
  const topPat = o.topPat || legacy(o.topBrace || 'single'), botPat = o.botPat || legacy(o.botBrace || 'none');
  const lat = (list, pat, plane, asGiven) => {
    const cnt = list.length - 1;
    for (let k = 0; k < cnt; k++) {
      const a = list[k], b = list[k + 1], code = asGiven ? pat[0] : mirroredCode(pat, k, cnt, { S: 'R', R: 'S' });
      if (code === 'S' || code === 'X') add(F(a), B(b), 'lat', plane);
      if (code === 'R' || code === 'X') add(B(a), F(b), 'lat', plane);
    }
  };
  lat(top, topPat, 'top', !o.topPat); lat(bottom, botPat, 'bottom', !o.botPat);
  // ---- zy plane: cross-frames. A station is a top joint with the nearest bottom joint below it.
  const stations = top.map(d => {
    const xd = tr.nodes[d][0];
    const below = bottom.slice().sort((p, q) => Math.abs(tr.nodes[p][0] - xd) - Math.abs(tr.nodes[q][0] - xd))[0];
    return { t: d, b: below, x: xd };
  }).filter(s => s.b != null && s.b !== s.t);
  const framePat = o.framePat || (o.sway ? ['D', 'N'] : ['N']);
  const frames = [];
  stations.forEach((s, k) => {
    // legacy "end sway diagonals": only the first and last station
    const code = o.framePat ? mirroredCode(framePat, k, stations.length, { D: 'E', E: 'D' }) : ((k === 0 || k === stations.length - 1) && o.sway ? 'D' : 'N');
    frames.push({ x: s.x, code, t: s.t, b: s.b });
    if (code === 'D' || code === 'X') add(F(s.t), B(s.b), 'sway');
    if (code === 'E' || code === 'X') add(B(s.t), F(s.b), 'sway');
    if (code === 'K') {
      // a joint at mid-width on the top tie: the tie becomes two pieces and two diagonals run down to the bottom corners
      const pf = nodes[F(s.t)], pb = nodes[B(s.t)], mid = nodes.length;
      nodes.push([(pf[0] + pb[0]) / 2, (pf[1] + pb[1]) / 2, (pf[2] + pb[2]) / 2]);
      const ti = elems.findIndex(e => e.type === 'tie' && ((e.i === F(s.t) && e.j === B(s.t)) || (e.i === B(s.t) && e.j === F(s.t))));
      if (ti >= 0) elems.splice(ti, 1);
      add(F(s.t), mid, 'tie'); add(mid, B(s.t), 'tie');
      add(mid, F(s.b), 'sway'); add(mid, B(s.b), 'sway');
      // the mid joint also needs holding along the bridge: two short braces in the top plane to the next station's top joints
      const nb = stations[k + 1] || stations[k - 1];
      if (nb) { add(mid, F(nb.t), 'lat', 'top'); add(mid, B(nb.t), 'lat', 'top'); }
    }
  });
  // supports: the 2D supports, on both trusses. Left: front fixed in x, y, z; back in x, z. Right: z only.
  const supports = [];
  tr.supports.forEach(s => {
    if (s.claw || s.brace) return;
    const left = tr.nodes[s.node][0] < S / 2;
    // a joint held sideways by the table (a foot on the face, a table corner the ends bear on) is held along x in 3D too
    const hx = !!(s.xHold || s.abut || s.corner);
    supports.push({ node: F(s.node), dofs: left && s.pin ? [0, 1, 2] : hx ? [0, 2] : [2], left, main: !!s.pin || s.node === tr.roller || hx });
    supports.push({ node: B(s.node), dofs: left && s.pin ? [0, 2] : hx ? [0, 2] : [2], left, main: !!s.pin || s.node === tr.roller || hx });
  });
  // joints that belong only to claws or braces are not part of the 3D model: hold them still so they don't make it unstable
  const used = new Set(); elems.forEach(e => { used.add(e.i); used.add(e.j); });
  const ghost = new Set();
  for (let i = 0; i < nodes.length; i++) if (!used.has(i)) { ghost.add(i); supports.push({ node: i, dofs: [0, 1, 2], left: true, main: true, ghost: true }); }
  // names for the drawing and the table: side-truss parts keep their 2D number with f (front) or b (back);
  // cross pieces are T (ties), L (lateral bracing, xy planes) and S (sway diagonals, zy cross-frames); M joints sit mid-width
  const cnt = { tie: 0, lat: 0, sway: 0 };
  const elemLab = elems.map(e => e.side === 'cross' ? ({ tie: 'T', lat: 'L', sway: 'S' })[e.type] + (cnt[e.type]++) : e.e2 + (e.side === 'front' ? 'f' : 'b'));
  const nodeLab = nodes.map((p, i) => i < n ? i + 'f' : i < 2 * n ? (i - n) + 'b' : 'M' + (i - 2 * n));
  return { nodes, elems, supports, deck, n, W, elemLab, nodeLab, tilt: o.tilt || 0, tr, warn, ghost, top, bottom, frames, stationCount: stations.length, topPanels: Math.max(0, top.length - 1), botPanels: Math.max(0, bottom.length - 1) };
}

// opt.imperf (#117, default off): { alpha, beta, dir } adds the sideways loads a real, slightly crooked bridge puts on its
// bracing. Bowed compression chords: at every interior joint of a compression chord, alpha x |chord force| pushing out of
// the bridge (dir = +1) or in (-1), on both trusses alike. Out of plumb: at every loaded joint, beta x its vertical load
// sideways (+y x dir). The chord forces come from a first, perfect solve; the second solve carries both.
function analyze3D(m3, mat, load, opt) {
  const im = opt && opt.imperf && (+opt.imperf.alpha > 0 || +opt.imperf.beta > 0) ? opt.imperf : null;
  const r0 = solve3D(m3, mat, load, null);
  if (!im || !r0.stable) return r0;
  const n = m3.n, dir = +im.dir < 0 ? -1 : 1, a = +im.alpha || 0, bt = +im.beta || 0, extra = new Float64Array(3 * m3.nodes.length);
  const chordAt = {};
  m3.elems.forEach((e, k) => { if (e.side === 'cross' || (e.type !== 'top' && e.type !== 'bot')) return; [e.i, e.j].forEach(i => { (chordAt[i + e.type] = chordAt[i + e.type] || { i, ks: [] }).ks.push(k); }); });
  Object.values(chordAt).forEach(({ i, ks }) => {
    if (ks.length < 2) return;   // a chord end, not an interior joint
    const Fc = Math.min(...ks.map(k => r0.members[k].F)); if (!(Fc < 0)) return;   // compression only
    extra[3 * i + 1] += (i < n ? -1 : 1) * dir * a * -Fc;
  });
  r0.Fv.forEach((v, d) => { if (d % 3 === 2 && v) extra[d - 1] += dir * bt * Math.abs(v); });
  const r = solve3D(m3, mat, load, extra);
  if (r.stable) r.imperf = { alpha: a, beta: bt, dir, lateral: extra.reduce((s, v) => s + Math.abs(v), 0) };
  return r;
}
function solve3D(m3, mat, load, extra) {
  const nN = m3.nodes.length, ND = 3 * nN;
  const A = mat.b * mat.h, I = mat.b * Math.pow(mat.h, 3) / 12;
  const W = (load.mBook1 + load.mBook2) * load.g, P = mat.FS * W;   // the whole design load (both trusses)
  const nA = e => A * e.n, nI = e => e.n === 1 ? I : (e.bundle === 'compact' && e.n === 4 ? 16 * I : e.n * I);
  const geo = m3.elems.map(e => {
    const a = m3.nodes[e.i], b = m3.nodes[e.j], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d);
    return { L, c: d.map(v => v / L) };
  });
  const K = Array.from({ length: ND }, () => new Float64Array(ND));
  m3.elems.forEach((e, k) => {
    const { L, c } = geo[k], kk = mat.E * nA(e) / L;
    const dofs = [3 * e.i, 3 * e.i + 1, 3 * e.i + 2, 3 * e.j, 3 * e.j + 1, 3 * e.j + 2];
    const t = [c[0], c[1], c[2], -c[0], -c[1], -c[2]];
    for (let p = 0; p < 6; p++) for (let q = 0; q < 6; q++) K[dofs[p]][dofs[q]] += kk * t[p] * t[q];
  });
  // books: the 2D tributary shares, split between the two trusses by the lever rule about y = 0
  const Fv = new Float64Array(ND);
  m3.tr.trib.forEach(t => {
    const yf = m3.nodes[t.node][1], yb = m3.nodes[t.node + m3.n][1];
    const back = Math.abs(yb - yf) > 1e-9 ? (0 - yf) / (yb - yf) : 0.5;
    Fv[3 * t.node + 2] -= P * t.frac * (1 - back);
    Fv[3 * (t.node + m3.n) + 2] -= P * t.frac * back;
  });
  const Fz = Float64Array.from(Fv);   // the vertical loads alone (the imperfection loads are sized from these)
  if (extra) extra.forEach((v, d) => { Fv[d] += v; });
  let active = m3.supports.slice(), lifted = [], U = null, R = null, known = null;
  for (let it = 0; it < 12; it++) {
    known = []; active.forEach(s => s.dofs.forEach(d => known.push(3 * s.node + d)));
    const kset = new Set(known), unk = []; for (let i = 0; i < ND; i++) if (!kset.has(i)) unk.push(i);
    const u = (typeof root.TrussCore !== 'undefined' ? root.TrussCore : require('./core.js')).solveLinear(unk.map(p => unk.map(q => K[p][q])), unk.map(p => Fv[p]));
    if (!u) { U = null; break; }
    U = new Float64Array(ND); unk.forEach((p, k) => { U[p] = u[k]; });
    if (!Number.isFinite(Math.max(...U.map(Math.abs))) || Math.max(...U.map(Math.abs)) > 1e4) { U = null; break; }
    R = known.map(p => { let s = 0; for (let q = 0; q < ND; q++) s += K[p][q] * U[q]; return s - Fv[p]; });
    // a support that would have to pull the bridge down lets go (never the two main left supports)
    let worst = null;
    active.forEach(s => { if (s.left && s.main) return; const k = known.indexOf(3 * s.node + 2); if (k >= 0 && R[k] < -1e-6 * P && (!worst || R[k] < worst.v)) worst = { s, v: R[k] }; });
    if (!worst) break;
    active = active.filter(s => s !== worst.s); lifted.push(worst.s.node);
  }
  if (!U) return { stable: false, P, lifted, Fv: Fz };
  const capT = mat.sigT * A, capC = mat.sigC * A;
  const members = m3.elems.map((e, k) => {
    const { L, c } = geo[k];
    const du = (U[3 * e.j] - U[3 * e.i]) * c[0] + (U[3 * e.j + 1] - U[3 * e.i + 1]) * c[1] + (U[3 * e.j + 2] - U[3 * e.i + 2]) * c[2];
    let f = mat.E * nA(e) / L * du; if (Math.abs(f) < 1e-6 * P) f = 0;
    const Pcr = Math.PI * Math.PI * mat.E * nI(e) / Math.pow(mat.K * L, 2);
    let util = 0, mode = '';
    if (f < 0) { const ub = -f / Pcr, uc = -f / (capC * e.n); util = Math.max(ub, uc); mode = ub >= uc ? 'buckling' : 'crushing'; }
    else if (f > 0) { util = f / (capT * e.n); mode = 'tension'; }
    return { k, i: e.i, j: e.j, type: e.type, side: e.side, n: e.n, L, F: f, util, mode, fails: util >= 1 };
  });
  const maxUtil = Math.max(0, ...members.map(m => m.util));
  let dz = 0; m3.deck.forEach(d => { dz = Math.max(dz, Math.abs(U[3 * d + 2]), Math.abs(U[3 * (d + m3.n) + 2])); });
  let dy = 0; for (let i = 0; i < nN; i++) dy = Math.max(dy, Math.abs(U[3 * i + 1]));
  const wood = geo.reduce((s, g, k) => s + g.L * m3.elems[k].n, 0);
  const sumZ = known.reduce((s, p, k) => s + (p % 3 === 2 ? R[k] : 0), 0);
  return { stable: true, P, U, members, maxUtil, failing: members.filter(m => m.fails), deckDefl: dz, sideSway: dy, wood,
    capKg: maxUtil > 0 ? mat.FS * (load.mBook1 + load.mBook2) / maxUtil : Infinity, lifted, sumZ, Fv: Fz };
}

// members that would pass through the table top (beside the span, below the table surface)
function tableHits(m3, T, span) {
  const S = span || 200, out = [];
  m3.elems.forEach((e, k) => { const a = m3.nodes[e.i], b = m3.nodes[e.j];
    for (let t = 0.04; t < 0.97; t += 0.04) { const x = a[0] + t * (b[0] - a[0]), z = a[2] + t * (b[2] - a[2]); if ((x < -0.05 || x > S + 0.05) && z < -0.05 && z > -(T || 30) - 0.05) { out.push(k); break; } } });
  return out;
}
const api = { build3D, analyze3D, mirroredCode, tableHits };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Truss3D = api;
})(typeof window !== 'undefined' ? window : globalThis);
