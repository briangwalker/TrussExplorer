// ===== Truss core: geometry builder + direct-stiffness solver =====
// Units: mm, N, MPa. Mirrors TrussFEA_Bridge_SE310.py conventions.
(function (root) {
'use strict';

const DEFAULT_MAT = {
  b: 3.18, h: 3.18, E: 3000, sigT: 7.5, sigC: 4.5, rho: 160e-9, FS: 2.0, K: 1.0,
};

// Span panel widths: end panels weight 1, centre panel(s) weight `ratio`, linear between.
function panelWidths(N, span, ratio) {
  const w = [];
  const dmax = Math.abs(0.5 / N - 0.5);
  for (let i = 0; i < N; i++) {
    const d = Math.abs((i + 0.5) / N - 0.5);
    w.push(dmax > 1e-12 ? 1 + (ratio - 1) * (1 - d / dmax) : 1);
  }
  const s = w.reduce((a, b) => a + b, 0);
  return w.map(v => v * span / s);
}

// codes: 'P' = slopes down toward mid-span (Pratt), 'H' = slopes up toward mid-span (Howe),
// 'X' = both, 'N' = none.  Middle panel (odd count) may only be 'X' or 'N'.
function mirror(left, M, middle) {
  const out = new Array(M);
  const half = Math.floor(M / 2);
  for (let i = 0; i < half; i++) { out[i] = left[i] || 'P'; out[M - 1 - i] = out[i]; }
  if (M % 2 === 1) out[half] = (middle === 'N' ? 'N' : 'X');
  return out;
}
function expandDiagonals(N, left, middle) { return mirror(left, N, middle); }
function expandVerticals(N, leftInterior) {
  const v = new Array(N + 1).fill(false);
  v[0] = v[N] = true;
  for (let p = 1; p <= Math.floor(N / 2); p++) { const on = leftInterior[p - 1] !== false; v[p] = on; v[N - p] = on; }
  return v;
}
function patternLeft(pattern, half) {
  const a = [];
  for (let i = 0; i < half; i++) {
    switch (pattern) {
      case 'pratt': a.push('P'); break;
      case 'howe': a.push('H'); break;
      case 'altP': a.push(i % 2 === 0 ? 'P' : 'H'); break;
      case 'altH': a.push(i % 2 === 0 ? 'H' : 'P'); break;
      case 'x': a.push('X'); break;
      default: a.push('P');
    }
  }
  return a;
}

/*
 design = {
   family: 'grid' | 'warren', span: 200, height (top chord above the desk, >= 0), panels (across the span), ratio,
   diagLeft, diagMiddle, vertLeft (span interior points, left half),
   deskMode: 'match' (desk panels as wide as the end span panel) | 'length' (desk panels fill `overall`),
   deskPanels: k per side, overall (length mode, 200..300),
   approachDiag: code for desk panels, edgeVert, deskVert,
   bottom: 'flat' | 'parabola' | 'arc', depth (mm below the desk at mid-span, between the desk edges),
   sideAngle, sideLean, deck: 'top', bookLen,
   supportMode: 'all' (every bottom joint on a desk can push up; pin at the chosen one) | 'one' (only the chosen joint each side),
   supportJoint: 0 = desk edge, 1 = one panel back, ...
 }
*/
// Bottom-chord offset at x for a curve through both desk edges with signed mid-span value `curve`
// (negative = sags below the desk, positive = arches up). Shapes: parabola, arc, catenary.
const _catA = {};
function catenaryA(h, d) {
  const key = h + ':' + d; if (_catA[key]) return _catA[key];
  let lo = Math.log(h / 700), hi = Math.log(1e9);           // a(cosh(h/a)-1) falls as a grows
  for (let it = 0; it < 200; it++) {
    const m = (lo + hi) / 2, a = Math.exp(m), g = a * (Math.cosh(h / a) - 1);
    if (g > d) lo = m; else hi = m;
  }
  return (_catA[key] = Math.exp((lo + hi) / 2));
}
function bottomY(x, S, shape, curve) {
  if (!curve || shape === 'flat' || x <= 1e-9 || x >= S - 1e-9) return 0;
  const d = Math.abs(curve), sg = curve < 0 ? -1 : 1, h = S / 2, u = x - h;
  let mag;
  if (shape === 'arc') {
    const R = (h * h + d * d) / (2 * d);
    mag = Math.sqrt(Math.max(0, R * R - u * u)) - (R - d);
  } else if (shape === 'catenary') {
    const a = catenaryA(h, d);
    mag = a * (Math.cosh(h / a) - Math.cosh(u / a));
  } else {
    mag = d * (1 - (u / h) * (u / h));
  }
  return sg * mag;
}
function buildTruss(d) {
  const S = d.span || 200, H = Math.max(0, +d.height || 0), N = Math.max(1, Math.round(d.panels));
  const EPS = 1e-6;
  const warn = [];
  const wSpan = panelWidths(N, S, d.ratio || 1);
  // ---- desk (approach) panels
  let k = Math.max(0, Math.round(d.deskPanels == null ? (d.overall > S + 0.5 ? 1 : 0) : d.deskPanels));
  let wd = 0;
  if ((d.deskMode || 'match') === 'length') {
    const L = d.overlap != null ? S + 2 * Math.max(0, Math.min(50, +d.overlap)) : Math.max(S, Math.min(300, d.overall == null ? S : +d.overall));
    const oh = (L - S) / 2;
    if (oh < 0.5) k = 0; else { k = Math.max(1, k); wd = oh / k; }
  } else {
    wd = wSpan[0];
    if (k > 0 && S + 2 * k * wd > 300 + 1e-6) {
      const kk = Math.floor(((300 - S) / 2) / wd + 1e-9);
      warn.push(`${k} desk panel${k > 1 ? 's' : ''} of ${wd.toFixed(1)} mm per side would make the bridge ${(S + 2 * k * wd).toFixed(0)} mm, over the 300 mm limit; using ${kk}.`);
      k = kk;
    }
  }
  if (k === 0) wd = 0;
  // Δp (bottom chord) and Δh (top chord) at the desk edges. Below 0 means the end goes down the inside face of the table edge.
  const Tt0 = Math.max(0, d.tableThick == null ? 30 : +d.tableThick), faceMax = Math.min(Tt0, 50);
  const botEnd = Math.max(-faceMax, Math.min(H, +d.botEnd || 0));
  const topEndIn = d.topShape && d.topShape !== 'flat' ? (d.topEnd == null ? 0 : +d.topEnd) : H;
  const intoFace = botEnd < -1e-9 || topEndIn < -1e-9;
  // with desk panels, a chord end below the table top keeps the desk panels: a foot post runs from the table corner down the face
  let M = N + 2 * k;
  let w = [...Array(k).fill(wd), ...wSpan, ...Array(k).fill(wd)];
  const px = [-k * wd]; for (let i = 0; i < M; i++) px.push(px[i] + w[i]);
  px[k] = 0; px[M - k] = S; px[M] = S + k * wd;
  // support position: a set distance back from each desk edge
  const ovl = -px[0];
  let sOff = Math.max(0, Math.min(ovl, d.supportOffset != null ? +d.supportOffset : (d.supportJoint ? px[k] - px[k - Math.min(k, d.supportJoint)] : 0)));
  if (d.supportOffset != null && +d.supportOffset > ovl + 1e-6) warn.push(`The support can only go as far back as the bridge reaches onto the desk (${ovl.toFixed(0)} mm).`);
  const deskEnds0 = k > 0 ? (d.deskEnds || 'truss') : 'truss';
  // with truss desk panels, the support point becomes a full panel point so a vertical and diagonal reach it
  if (k > 0 && deskEnds0 !== 'feet' && sOff > 0.25 && !px.some(x => Math.abs(x + sOff) < 0.25)) {
    const iL = px.findIndex((x, i) => i < k && x < -sOff && -sOff < px[i + 1]);
    px.splice(iL + 1, 0, -sOff);
    const iR = px.findIndex((x, i) => i >= px.length - 1 - k && x < S + sOff && S + sOff < px[i + 1]);
    px.splice(iR + 1, 0, S + sOff);
    k += 1; M += 2;
    w = px.slice(1).map((x, i) => x - px[i]);
  }
  const shape = d.bottom || 'flat';
  let curve = shape === 'flat' ? 0 : (d.curve != null ? +d.curve : -(+d.depth || 0));
  if (curve > H - 1e-9 && curve > 0) { if (curve > H + 1e-9) warn.push(`An arch can rise only as high as the top chord (${H.toFixed(0)} mm); using ${H.toFixed(0)} mm.`); curve = H; }
  const depth = Math.max(0, -curve);
  const by = px.map(x => (x < -1e-9 || x > S + 1e-9) ? 0 : botEnd + bottomY(x, S, shape, curve - botEnd));
  // top chord: flat at h, or an arch from Δh at each desk edge up to h at mid-span (flat at Δh over the desks)
  const topShape = d.topShape && d.topShape !== 'flat' ? d.topShape : 'flat';
  const topEnd = topShape === 'flat' ? H : Math.max(-faceMax, Math.min(H, d.topEnd == null ? 0 : +d.topEnd));
  // over the desks the top chord stays at Δh, but never below the table top
  const topY = x => topShape === 'flat' ? H : (x < -1e-9 || x > S + 1e-9) ? Math.max(0, topEnd) : (x <= 1e-9 || x >= S - 1e-9) ? topEnd : topEnd + bottomY(x, S, topShape, H - topEnd);
  const faceBot = botEnd < -1e-9 && k > 0;   // bottom chord end on the face, with a corner joint on the table above it
  for (let i = 0; i <= M; i++) if (by[i] > topY(px[i]) + 1e-6) { warn.push(`The bottom chord rises above the top chord near x = ${px[i].toFixed(0)} mm; lower the bottom arch or raise the top.`); break; }
  const deskEnds = k > 0 ? (d.deskEnds || 'truss') : 'truss';
  const lo = deskEnds === 'feet' ? k : 0, hi = deskEnds === 'feet' ? M - k : M;  // outer joints of the truss proper

  const nodeList = [], alias = {}, members = [];
  const addNode = (key, x, y) => { nodeList.push({ key, x, y }); };
  const res = key => alias[key] || key;
  const info = { supportOffset: 0, sideAngleActual: 90, merged: false, diag: null, vert: null, approach: k > 0, a: k, M, deskWidth: wd, depth, curve, shape, deskEnds, lo, hi, topShape, topEnd, botEnd, intoFace, faceBot };
  for (let i = 0; i <= M; i++) addNode('B' + i, px[i], by[i]);
  if (faceBot) { addNode('CL', 0, 0); addNode('CR', S, 0); }
  let supL = null, supR = null, splitL = -1, splitR = -1;
  for (let i = 0; i <= k; i++) if (Math.abs(px[i] + sOff) < 0.25) supL = 'B' + i;
  for (let i = M - k; i <= M; i++) if (Math.abs(px[i] - S - sOff) < 0.25) supR = 'B' + i;
  // the support has to be a joint that sits on the table: the corner joint, or else the last desk joint
  if (faceBot) { if (supL === 'B' + k) supL = 'CL'; if (supR === 'B' + (M - k)) supR = 'CR'; }
  if (!faceBot && botEnd > 1e-9) {
    if (supL === 'B' + k) { supL = k > 0 ? 'B' + (k - 1) : supL; if (k === 0) warn.push(`With Δp ${botEnd.toFixed(1)} mm and no desk panels, the bridge ends ${botEnd.toFixed(1)} mm above the table: nothing really touches it. Add desk panels or set Δp to 0.`); }
    if (supR === 'B' + (M - k)) supR = k > 0 ? 'B' + (M - k + 1) : supR;
  }
  if (!supL) { for (let i = 0; i < k; i++) if (px[i] < -sOff && -sOff < px[i + 1]) splitL = i; addNode('SL', -sOff, 0); supL = 'SL'; }
  if (!supR) { for (let i = M - k; i < M; i++) if (px[i] < S + sOff && S + sOff < px[i + 1]) splitR = i; addNode('SR', S + sOff, 0); supR = 'SR'; }
  info.supportOffset = sOff;
  if (deskEnds0 === 'feet' && sOff > 0.25 && (d.supportMode || 'all') === 'one')
    warn.push('With feet only and the support behind the desk edge, nothing braces the foot: the truss would hang off a single flat stick. Use "Every desk joint can bear", or full-truss desk panels so a vertical and diagonal reach the support.');

  const pushBottom = () => {
    for (let i = 0; i < M; i++) {
      if (i === splitL) { members.push({ a: 'B' + i, b: 'SL', type: 'bot' }, { a: 'SL', b: 'B' + (i + 1), type: 'bot' }); continue; }
      if (i === splitR) { members.push({ a: 'B' + i, b: 'SR', type: 'bot' }, { a: 'SR', b: 'B' + (i + 1), type: 'bot' }); continue; }
      if (faceBot && i === k - 1) { members.push({ a: 'B' + i, b: 'CL', type: 'bot' }, { a: 'CL', b: 'B' + (i + 1), type: 'end' }); continue; }
      if (faceBot && i === M - k) { members.push({ a: 'B' + i, b: 'CR', type: 'end' }, { a: 'CR', b: 'B' + (i + 1), type: 'bot' }); continue; }
      members.push({ a: 'B' + i, b: 'B' + (i + 1), type: 'bot' });
    }
  };
  if (d.family === 'warren') {
    for (let i = lo; i < hi; i++) {
      const xm = (px[i] + px[i + 1]) / 2, ym = topY(xm);
      const flatHere = ym < EPS && Math.abs(by[i]) < EPS && Math.abs(by[i + 1]) < EPS;
      if (!flatHere) addNode('T' + i, xm, ym);
    }
    const tops = nodeList.filter(n => n.key[0] === 'T');
    for (let q = 0; q < tops.length - 1; q++) members.push({ a: tops[q].key, b: tops[q + 1].key, type: 'top' });
    pushBottom();
    const firstT = tops.length ? +tops[0].key.slice(1) : -1, lastT = tops.length ? +tops[tops.length - 1].key.slice(1) : -1;
    for (let i = 0; i < M; i++) {
      if (!tops.some(t => t.key === 'T' + i)) continue;
      const dropEnd = deskEnds === 'noEndPost';
      if (!(dropEnd && i === firstT)) members.push({ a: 'B' + i, b: 'T' + i, type: i === firstT ? 'end' : 'diag' });
      if (!(dropEnd && i === lastT)) members.push({ a: 'T' + i, b: 'B' + (i + 1), type: i === lastT ? 'end' : 'diag' });
    }
    if (tops.length) { const t0 = tops[0]; info.sideAngleActual = Math.atan2(t0.y - by[firstT], t0.x - px[firstT]) * 180 / Math.PI; }
  } else {
    const spanDiag = expandDiagonals(N, d.diagLeft || [], d.diagMiddle);
    const spanVert = expandVerticals(N, d.vertLeft || []);
    const ad = d.approachDiag || 'P';
    const diag = [...Array(k).fill(ad), ...spanDiag, ...Array(k).fill(ad)];
    const vert = new Array(M + 1).fill(false);
    for (let p = 0; p <= N; p++) vert[p + k] = spanVert[p];
    if (k > 0) {
      for (let p = 1; p < k; p++) { vert[p] = vert[M - p] = d.deskVert !== false; }
      vert[k] = vert[M - k] = d.edgeVert !== false;
    }
    vert[0] = vert[M] = true;
    info.diag = diag; info.vert = vert;
    // sloped ends (only meaningful when the top chord sits above the outer bottom joint)
    let ang = Math.min(90, Math.max(20, d.sideAngle == null ? 90 : d.sideAngle));
    const rise = topY(px[lo]) - by[lo];
    let off = (ang >= 89.999 || rise < EPS) ? 0 : rise / Math.tan(ang * Math.PI / 180);
    let merged = false;
    if (d.sideLean === 'out') {
      const room = Math.max(0, (300 - (px[M] - px[0])) / 2 + (px[lo] - px[0]));
      if (off > room + 1e-9) { off = room; warn.push(room < 0.5 ? 'No room to lean out: the bridge is already 300 mm long.' : 'Side angle limited so overall length stays at or below 300 mm.'); }
      off = -off;
    } else if (hi - lo >= 2 && off >= w[lo] - 0.5) {
      if (off > w[lo] + 0.5) warn.push('Side angle is too shallow for the end panel width; end post now runs to the next joint.');
      off = w[lo]; merged = true;
    }
    info.merged = merged;
    info.sideAngleActual = Math.abs(off) < 1e-9 ? 90 : Math.atan2(rise, Math.abs(off)) * 180 / Math.PI;
    for (let i = lo; i <= hi; i++) {
      if (merged && (i === lo || i === hi)) continue;
      let x = px[i];
      if (i === lo) x = px[lo] + off; if (i === hi) x = px[hi] - off;
      const yt = topY(Math.min(Math.max(x, -1e9), 1e9));
      if (Math.abs(yt - by[i]) < EPS && Math.abs(x - px[i]) < EPS) { alias['T' + i] = 'B' + i; continue; } // chords meet: one joint
      addNode('T' + i, x, yt);
    }
    const T = i => res((merged && i === lo) ? 'T' + (lo + 1) : (merged && i === hi) ? 'T' + (hi - 1) : 'T' + i);
    const topKeys = []; for (let i = lo; i <= hi; i++) { if (merged && (i === lo || i === hi)) continue; topKeys.push(res('T' + i)); }
    for (let q = 0; q < topKeys.length - 1; q++) members.push({ a: topKeys[q], b: topKeys[q + 1], type: 'top' });
    pushBottom();
    const dropEnd = deskEnds === 'noEndPost';
    for (let p = lo; p <= hi; p++) {
      if (p === lo) { if (!dropEnd) members.push({ a: T(lo), b: 'B' + lo, type: 'end' }); continue; }
      if (p === hi) { if (!dropEnd) members.push({ a: T(hi), b: 'B' + hi, type: 'end' }); continue; }
      if (vert[p]) members.push({ a: T(p), b: 'B' + p, type: 'vert' });
    }
    for (let i = lo; i < hi; i++) {
      if (merged && (i === lo || i === hi - 1)) continue;
      const leftHalf = (i + 0.5) < M / 2;
      const c = diag[i];
      const down = leftHalf ? { a: T(i), b: 'B' + (i + 1) } : { a: T(i + 1), b: 'B' + i };
      const up = leftHalf ? { a: 'B' + i, b: T(i + 1) } : { a: 'B' + (i + 1), b: T(i) };
      if (c === 'P' || c === 'X') members.push({ a: down.a, b: down.b, type: 'diag' });
      if (c === 'H' || c === 'X') members.push({ a: up.a, b: up.b, type: 'diag' });
    }
    if (H < EPS && Math.abs(curve) < EPS && topShape === 'flat') warn.push('With 0 mm height and a flat bottom chord, the whole truss is a flat line. Add height or curve the bottom chord.');
  }

  // resolve aliases, drop zero-length and duplicate members (first one listed wins)
  const idx = {}; nodeList.forEach((n, i) => { idx[n.key] = i; });
  const seen = new Set(), elems = [];
  members.forEach(m => {
    const i = idx[res(m.a)], j = idx[res(m.b)];
    if (i === undefined || j === undefined || i === j) return;
    const key = i < j ? i + '-' + j : j + '-' + i;
    if (seen.has(key)) return;
    seen.add(key);
    const mk = [res(m.a), res(m.b)].sort().join('|');
    const st = (d.sticks && d.sticks[mk]) || {};
    elems.push({ i, j, type: m.type, key: mk, n: Math.max(1, Math.min(6, Math.round(st.n || (d.stickByType && d.stickByType[m.type]) || 1))), bundle: st.bundle === 'compact' ? 'compact' : 'row' });
  });
  // number nodes like the course script: top-chord-only joints first, then bottom joints
  const order = nodeList.map((n, i) => i).sort((p, q) => {
    const tp = nodeList[p].key[0] === 'T' ? 0 : 1, tq = nodeList[q].key[0] === 'T' ? 0 : 1;
    return tp - tq || nodeList[p].x - nodeList[q].x;
  });
  const remap = {}; order.forEach((old, nw) => { remap[old] = nw; });
  const nodes = order.map(o => [nodeList[o].x, nodeList[o].y]);
  const keys = order.map(o => nodeList[o].key);
  elems.forEach(e => { e.i = remap[e.i]; e.j = remap[e.j]; });
  const NI = key => remap[idx[res(key)]];

  // supports: pin at the left support joint, roller at its mirror; 'all' adds rollers at every other desk joint
  const supports = [];
  const pinNode = NI(supL), rollNode = NI(supR);
  supports.push({ node: pinNode, pin: true, x: -sOff });
  supports.push({ node: rollNode, pin: false, x: S + sOff });
  if ((d.supportMode || 'all') === 'all') {
    for (let i = 0; i <= k; i++) { const nn = NI('B' + i); if (nn !== pinNode && Math.abs(nodes[nn][1]) < 1e-6) supports.push({ node: nn, pin: false, x: px[i] }); }
    for (let i = M - k; i <= M; i++) { const nn = NI('B' + i); if (nn !== rollNode && Math.abs(nodes[nn][1]) < 1e-6) supports.push({ node: nn, pin: false, x: px[i] }); }
  }
  // ---- inside-edge braces and under-table claws (mirrored). Both hang from the bottom-chord joint at each desk edge.
  //  brace: a joint pressed against the inside face of the table, e mm below the top. The face pushes it sideways;
  //         friction gives a little vertical hold (a soft spring, checked against mu x the face force).
  //  claw:  a hook that reaches the underside of the table top (T mm down). It is pinned there but can only pull down.
  const Tt = Math.max(0, d.tableThick == null ? 30 : +d.tableThick);
  info.tableThick = Tt; info.clawNote = ''; info.braceNote = '';
  const edgeJoint = xe => nodes.findIndex(p => Math.abs(p[0] - xe) < 1e-6 && Math.abs(p[1]) < 1e-6);
  const pushNode = (x, y, key) => { nodes.push([x, y]); keys.push(key); return nodes.length - 1; };
  const pushElem = (i, j, type, key) => { const st = (d.sticks && d.sticks[key]) || {}; elems.push({ i, j, type, key, n: Math.max(1, Math.min(6, Math.round(st.n || (d.stickByType && d.stickByType[type]) || 1))), bundle: st.bundle === 'compact' ? 'compact' : 'row' }); };
  const eL = edgeJoint(0), eR = edgeJoint(S);
  const hang = { L: eL, R: eR };   // the joint the claw hangs from on each side (the brace joint if there is one)
  const onFace = xe => nodes.some((p, i) => Math.abs(p[0] - xe) < 1e-6 && p[1] < -1e-6 && /^(B\d+|T\d+)$/.test(keys[i]));
  if (d.brace && onFace(0) && onFace(S)) info.braceNote = 'A chord end already presses on the inside face of each table edge (Δh or Δp below 0), so no separate edge brace is added: it would be the same support twice.';
  else if (d.brace) {
    const e = Math.max(1, Math.min(d.braceDepth == null ? 20 : +d.braceDepth, Tt, 50));
    if ((d.braceDepth || 20) > Tt + 1e-9) info.braceNote = `Brace depth is limited to the ${Tt} mm table thickness.`;
    const inner = side => { let best = -1, bx = side === 'L' ? Infinity : -Infinity;
      nodes.forEach((p, i) => { if (keys[i][0] !== 'B') return; if (side === 'L' ? (p[0] > 1e-6 && p[0] < bx) : (p[0] < S - 1e-6 && p[0] > bx)) { bx = p[0]; best = i; } }); return best; };
    const iL = inner('L'), iR = inner('R');
    if (eL < 0 || eR < 0 || iL < 0 || iR < 0) info.braceNote = 'Inside-edge braces need a bottom-chord joint at each desk edge and one inside the span; this design has none, so no braces were added.';
    else if (Tt < 1) info.braceNote = 'With no table thickness there is no edge face to brace against, so no braces were added.';
    else [['L', 0, eL, iL, 1], ['R', S, eR, iR, -1]].forEach(([side, xe, ej, ij, dirX]) => {
      const bn = pushNode(xe, -e, 'BRACE' + side);
      pushElem(ej, bn, 'brace', 'BRACE' + side + '|v');
      pushElem(ij, bn, 'brace', 'BRACE' + side + '|d');
      supports.push({ node: bn, pin: false, xHold: true, dirX, ySpring: true, brace: true, x: xe });
      hang[side] = bn;
    });
  }
  if (d.claw) {
    if (eL < 0 || eR < 0) info.clawNote = 'Claws need a bottom-chord joint at each desk edge to hang from; this design has none, so no claws were added.';
    else if (Tt > 50 + 1e-9) info.clawNote = `The ${Tt} mm table top is deeper than the 50 mm allowed below the deck, so a claw can't reach under it. No claws were added.`;
    else if (Tt < 1) info.clawNote = 'With no table thickness there is nothing to hook under, so no claws were added.';
    else [['L', 0], ['R', S]].forEach(([side, xe]) => {
      const cn = pushNode(xe, -Tt, 'CLAW' + side);
      pushElem(hang[side], cn, 'claw', 'CLAW' + side);
      supports.push({ node: cn, pin: false, xHold: true, dirY: -1, claw: true, x: xe });
    });
  }
  // ---- arch feet. A chord end below the table top presses on the inside face of the table edge: the face pushes it inward,
  //      friction gives a little vertical hold (the same soft spring as the edge braces). With "ends bear on the table edge",
  //      the support at the top corner of each edge also takes an inward push, so an arch can't spread.
  const endJoints = xe => nodes.map((p, i) => i).filter(i => Math.abs(nodes[i][0] - xe) < 1e-6 && nodes[i][1] < 1e-6 && /^(B\d+|T\d+)$/.test(keys[i]));
  [[0, 1], [S, -1]].forEach(([xe, dirX]) => {
    endJoints(xe).forEach(i => {
      let s = supports.find(q => q.node === i);
      if (nodes[i][1] < -1e-6) {
        if (!s) { s = { node: i, x: xe }; supports.push(s); }
        // if a foot post ties this joint to the table corner above it, the joint may slip down the face and let the corner carry the load
        const corner = n2 => Math.abs(nodes[n2][0] - xe) < 1e-6 && Math.abs(nodes[n2][1]) < 1e-6;
        const canSlip = elems.some(e => (e.i === i && corner(e.j)) || (e.j === i && corner(e.i)));
        Object.assign(s, { pin: false, xHold: true, dirX, ySpring: true, abut: true, canSlip });
      }
      else if (d.edgeBear && s && !s.claw && !s.brace) { s.xHold = true; s.dirX = dirX; s.corner = true; }
    });
    // the top corner of the edge carries load whenever a joint sits on it
    if (!supports.some(q => Math.abs(nodes[q.node][0] - xe) < 1e-6 && !q.abut && !q.claw && !q.brace)) {
      const cn = nodes.findIndex(p => Math.abs(p[0] - xe) < 1e-6 && Math.abs(p[1]) < 1e-6);
      if (cn >= 0) supports.push(Object.assign({ node: cn, pin: xe === 0, x: xe }, (d.edgeBear || faceBot) ? { xHold: true, dirX, corner: true } : {}));
    }
    // a foot post against the face: the edge also stops the corner joint sliding outward
    if (faceBot) { const cn = nodes.findIndex(p => Math.abs(p[0] - xe) < 1e-6 && Math.abs(p[1]) < 1e-6); const s = supports.find(q => q.node === cn); if (s && !s.pin) Object.assign(s, { xHold: true, dirX, corner: true }); }
  });
  if (intoFace && !supports.some(q => !q.abut && !q.claw && !q.brace)) warn.push('Both chord ends are below the table top, so only friction on the edge faces holds the bridge up. Check the slip messages.');
  // mirror partner of each member (x -> S - x), for symmetric edits
  const mirrorNode = nodes.map(p => nodes.findIndex(q => Math.abs(q[0] - (S - p[0])) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6));
  elems.forEach(e => {
    const a = mirrorNode[e.i], b = mirrorNode[e.j];
    e.mirror = elems.findIndex(f => (f.i === a && f.j === b) || (f.i === b && f.j === a));
  });

  // deck = the top chord (joints at the top-chord level), books spread over it by tributary length
  const deckSet = new Set();
  if (d.family === 'warren') nodeList.forEach(n => { if (n.key[0] === 'T') deckSet.add(NI(n.key)); });
  else { for (let i = lo; i <= hi; i++) { const t = (info.merged && (i === lo || i === hi)) ? null : 'T' + i; if (t) deckSet.add(NI(t)); } }
  if (d.family === 'warren' && H < EPS) { for (let i = 0; i <= M; i++) if (Math.abs(by[i]) < EPS) deckSet.add(NI('B' + i)); }
  const chord = [...deckSet].map(n => ({ n, x: nodes[n][0] })).sort((p, q) => p.x - q.x);
  const deckLen = chord.length ? chord[chord.length - 1].x - chord[0].x : 0;
  const Lb = Math.max(1, d.bookLen || S);
  // Loads: a list of {type, a, b | x, w}. type 'uniform' or 'partial' spread evenly over a..b, 'ramp' rises (or falls, dir 'down') from 0 to 2x the mean over a..b,
  // 'point' sits at x. a, b, x are mm from the left desk edge; w is a relative weight (normalised to the total book mass).
  // Default: the book, uniform and centred on mid-span.
  const loadList = (Array.isArray(d.loads) && d.loads.length) ? d.loads : [{ type: 'uniform', a: S / 2 - Lb / 2, b: S / 2 + Lb / 2, w: 1 }];
  const wSum = loadList.reduce((s, L) => s + Math.max(0, +L.w || 0), 0) || 1;
  const tw = chord.map(() => 0);   // share of the total load taken by each deck joint
  const edgesOf = q => [q === 0 ? -Infinity : (chord[q - 1].x + chord[q].x) / 2, q === chord.length - 1 ? Infinity : (chord[q + 1].x + chord[q].x) / 2];
  const tribIndex = x => { for (let q = 0; q < chord.length; q++) { const [lo, hi] = edgesOf(q); if (x >= lo && x < hi) return q; } return chord.length - 1; };
  const bounds = [];
  loadList.forEach(L => {
    const w = Math.max(0, +L.w || 0) / wSum;
    if (!chord.length || w <= 0) return;
    if (L.type === 'point') {
      const x = +L.x; bounds.push([x, x]);
      if (x <= chord[0].x) { tw[0] += w; return; }
      if (x >= chord[chord.length - 1].x) { tw[chord.length - 1] += w; return; }
      // lever rule: split between the two deck joints that bracket the point (keeps the force and its moment)
      const q = chord.findIndex((c, i) => i < chord.length - 1 && x >= c.x && x <= chord[i + 1].x);
      const t = (x - chord[q].x) / (chord[q + 1].x - chord[q].x);
      tw[q] += w * (1 - t); tw[q + 1] += w * t;
      return;
    }
    const a = Math.min(+L.a, +L.b), b = Math.max(+L.a, +L.b);
    bounds.push([a, b]);
    if (b - a < 1e-9) { tw[tribIndex(a)] += w; return; }
    if (L.type === 'uniform' || L.type === 'partial' || !L.type) {
      chord.forEach((c, q) => { const [lo, hi] = edgesOf(q); const ov = Math.max(0, Math.min(hi, b) - Math.max(lo, a)); tw[q] += w * ov / (b - a); });
    } else {
      const N = 400;   // ramp: sample the density and hand each slice to its tributary joint
      for (let s = 0; s < N; s++) {
        const t = (s + 0.5) / N, dens = L.dir === 'down' ? 2 * (1 - t) : 2 * t;
        tw[tribIndex(a + t * (b - a))] += w * dens / N;
      }
    }
  });
  let trib = chord.map((c, q) => ({ node: c.n, frac: tw[q] })).filter(t => t.frac > 1e-9);
  info.bookContact = 'spread';
  if (!(Array.isArray(d.loads) && d.loads.length) && (d.bookContact || 'rigid') === 'rigid' && chord.length) {
    const b0 = S / 2 - Lb / 2, b1 = S / 2 + Lb / 2;
    const under = chord.filter(c => c.x >= b0 - 1e-6 && c.x <= b1 + 1e-6);
    const zTop = Math.max(...under.map(c => nodes[c.n][1]));
    const touch = under.filter(c => nodes[c.n][1] >= zTop - 0.05);
    if (touch.length && touch.length < under.length) {
      // a rigid hardcover rests on the highest joint(s); its weight acts at mid-span, shared by the lever rule
      info.bookContact = 'rigid'; info.bookZ = zTop; info.touch = touch.map(c => c.n);
      for (let q = warn.length - 1; q >= 0; q--) if (/^Part of the load/.test(warn[q])) warn.splice(q, 1);   // the overhang note is about a spread load
      const xc = S / 2;
      if (touch.length === 1) trib = [{ node: touch[0].n, frac: 1 }];
      else {
        const lft = touch.filter(c => c.x <= xc + 1e-9).sort((p, q) => q.x - p.x)[0], rgt = touch.filter(c => c.x >= xc - 1e-9).sort((p, q) => p.x - q.x)[0];
        if (!lft || !rgt) { const only = lft || rgt; trib = [{ node: only.n, frac: 1 }]; warn.push('The book rests on joints all to one side of its centre, so it would tip off.'); }
        else if (lft.n === rgt.n || rgt.x - lft.x < 1e-9) trib = [{ node: lft.n, frac: 1 }];
        else { const t = (xc - lft.x) / (rgt.x - lft.x); trib = [{ node: lft.n, frac: 1 - t }, { node: rgt.n, frac: t }]; }
      }
    }
  }
  const f0 = bounds.length ? Math.min(...bounds.map(p => p[0])) : S / 2 - Lb / 2, f1 = bounds.length ? Math.max(...bounds.map(p => p[1])) : S / 2 + Lb / 2;
  if (chord.length && info.bookContact !== 'rigid' && (f0 < chord[0].x - 0.5 || f1 > chord[chord.length - 1].x + 0.5))
    warn.push(`Part of the load (${f0.toFixed(0)} to ${f1.toFixed(0)} mm) lies beyond the ${deckLen.toFixed(0)} mm deck chord; the end deck joints carry the overhang.`);

  const allx = nodes.map(n => n[0]), ally = nodes.map(n => n[1]);
  const overlap = Math.min(0 - px[0], px[M] - S);   // how far the bottom chord reaches onto each desk
  return { overlap, nodes, keys, elems, supports, pin: pinNode, roller: rollNode,
    trib, deckLen, bookSpan: [f0, f1], overall: Math.max(...allx) - Math.min(...allx), minY: Math.min(...ally), maxY: Math.max(...ally),
    widths: w, spanWidths: wSpan, panelPts: px, warn, info, design: d, deskPanels: k,
    deckNodes: chord.map(c => c.n) };
}

function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((r, i) => Array.from(r).concat([b[i]]));
  let scale = 0; for (let i = 0; i < n; i++) scale = Math.max(scale, Math.abs(A[i][i]));
  const tol = 1e-9 * (scale || 1);
  for (let c = 0; c < n; c++) {
    let p = c, mv = Math.abs(M[c][c]);
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > mv) { mv = Math.abs(M[r][c]); p = r; }
    if (mv < tol) return null;
    if (p !== c) { const t = M[p]; M[p] = M[c]; M[c] = t; }
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

function analyze(tr, matIn, loadIn, opts) {
  const mat = Object.assign({}, DEFAULT_MAT, matIn || {});
  const load = Object.assign({ mBook1: 1.5, mBook2: 1.0, g: 9.81, nTruss: 2 }, loadIn || {});
  opts = Object.assign({ deflLimit: 2.0, width: 60, crossTies: true, minOverlap: 20 }, opts || {});
  const A = mat.b * mat.h, I = mat.b * Math.pow(mat.h, 3) / 12;
  const W = (load.mBook1 + load.mBook2) * load.g;
  const Pdesign = mat.FS * W;
  const Ptruss = Pdesign / load.nTruss;

  const nN = tr.nodes.length, nE = tr.elems.length, ND = 2 * nN;
  const K = Array.from({ length: ND }, () => new Float64Array(ND));
  const nA = e => A * e.n;
  const nI = e => e.n === 1 ? I : (e.bundle === 'compact' && e.n === 4 ? 16 * I : e.n * I);  // row: n x I; 2x2 bundle: 16 x I
  const geo = tr.elems.map(e => {
    const [x1, y1] = tr.nodes[e.i], [x2, y2] = tr.nodes[e.j];
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    return { L, lx: dx / L, ly: dy / L };
  });
  tr.elems.forEach((e, k) => {
    const { L, lx, ly } = geo[k];
    const kk = mat.E * nA(e) / L;
    const dofs = [2 * e.i, 2 * e.i + 1, 2 * e.j, 2 * e.j + 1];
    const t = [lx, ly, -lx, -ly];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) K[dofs[a]][dofs[b]] += kk * t[a] * t[b];
  });
  // friction at an inside-edge brace: a soft vertical spring (N/mm)
  const kf = Math.max(0, tr.design.fricK == null ? 2 : +tr.design.fricK), mu = Math.max(0, tr.design.fricMu == null ? 0.4 : +tr.design.fricMu);
  // friction at an edge face is treated as rigid until it slips: |vertical force| must stay within mu x the face push
  const F = new Array(ND).fill(0);
  const Fval = tr.trib.map(t => [t.node, 2, -Ptruss * t.frac]);
  Fval.forEach(([n, dof, v]) => { F[2 * n + dof - 1] += v; });
  const F0 = F.slice();
  // sliding friction: a foot that slides still feels mu x the face push, opposing the slide
  const applyFric = list => { for (let i = 0; i < ND; i++) F[i] = F0[i]; list.forEach(s => { if (s._slide) F[2 * s.node + 1] += s._slide * s._fric; }); };

  let mid = tr.deckNodes[0], best = 1e9;
  tr.deckNodes.forEach(n => { const dd = Math.abs(tr.nodes[n][0] - (tr.design.span || 200) / 2); if (dd < best - 1e-9) { best = dd; mid = n; } });

  const allDisp = [];
  tr.supports.forEach(s => { if (s.pin || s.xHold) allDisp.push([s.node, 1, 0]); allDisp.push([s.node, 2, 0]); });
  const loose = looseJoints(tr, geo);
  const m = nE, j = nN;

  // solve, dropping any roller that would have to pull the bridge down onto the table
  let active = tr.supports.slice(), lifted = [], released = [], U = null, R = null, DispCon = null, det = '';
  tr.supports.forEach(s => { delete s.yFree; delete s.xFree; delete s._slide; delete s._fric; });
  applyFric([]);
  for (let iter = 0; iter < 60; iter++) {
    DispCon = [];
    // friction at an edge face holds rigidly until it slips (checked after the solve)
    active.forEach(s => { if ((s.pin || s.xHold) && !s.xFree) DispCon.push([s.node, 1, 0]); if (!s.yFree) DispCon.push([s.node, 2, 0]); });
    const r = DispCon.length;
    det = m + r === 2 * j ? 'determinate' : (m + r > 2 * j ? 'indeterminate' : 'unstable');
    const known = DispCon.map(([n, dof]) => 2 * n + dof - 1);
    const unk = []; for (let i = 0; i < ND; i++) if (!known.includes(i)) unk.push(i);
    if (det === 'unstable') { U = null; break; }
    const u = solveLinear(unk.map(p => unk.map(q => K[p][q])), unk.map(p => F[p]));
    if (!u) { U = null; break; }
    U = new Array(ND).fill(0); unk.forEach((p, k) => { U[p] = u[k]; });
    if (!isFinite(Math.max(...U.map(Math.abs))) || Math.max(...U.map(Math.abs)) > 1e4) { U = null; break; }
    R = known.map(p => { let s = 0; for (let q = 0; q < ND; q++) s += K[p][q] * U[q]; return s - F[p]; });
    // reactions of each active support; a table can only push up, a claw can only pull down, an edge face can only push
    const pulls = [], tol = 1e-6 * Ptruss;
    let worst = null;
    active.forEach(s => {
      const k = DispCon.findIndex(dc => dc[0] === s.node && dc[1] === 2);
      const kx = DispCon.findIndex(dc => dc[0] === s.node && dc[1] === 1);
      s._Ry = k >= 0 ? R[k] : (s._slide ? s._slide * s._fric : 0);   // a sliding foot still carries its sliding friction
      s._Rx = kx >= 0 ? R[kx] : 0;
      if (s.claw) { if (k >= 0 && R[k] > tol && (!worst || R[k] > worst.v)) worst = { s, v: R[k], kind: 'claw' }; return; }
      if (s.dirX && kx >= 0 && R[kx] * s.dirX < -tol && (!worst || -R[kx] * s.dirX > worst.v)) worst = { s, v: -R[kx] * s.dirX, kind: 'brace' };
      if (s.brace || s.abut) return;
      if (k >= 0 && R[k] < -tol) pulls.push(s);
    });
    if (worst) {   // a claw that would have to push up lets go; a brace the face would have to pull lets go sideways
      if (worst.kind === 'claw') { worst.s.yFree = true; released.push({ node: worst.s.node, x: worst.s.x, kind: 'claw' }); }   // the hook just hangs; it still sits against the edge
      else { worst.s.xFree = true; released.push({ node: worst.s.node, x: worst.s.x, kind: 'brace' }); }
      continue;
    }
    if (!pulls.length) {
      // a foot on the face that needs more friction than it has slides down; its foot post then hangs the rest of the load on the table corner.
      // While it slides, friction still pushes back with mu x the face force (sliding friction), so the corner takes only what is left.
      const slip = active.find(s => (s.abut || s.brace) && s.canSlip && !s.yFree && Math.abs(s._Ry) > mu * Math.abs(s._Rx) + tol);
      if (slip) { slip._slide = Math.sign(slip._Ry) || 1; slip._fric = mu * Math.abs(slip._Rx); slip.yFree = true; released.push({ node: slip.node, x: slip.x, kind: 'slip' }); applyFric(active); continue; }
      // the face force changes once friction is applied, so update the friction until it settles
      const moved = active.filter(s => s._slide && Math.abs(mu * Math.abs(s._Rx) - s._fric) > tol);
      if (moved.length) { moved.forEach(s => { s._fric = mu * Math.abs(s._Rx); }); applyFric(active); continue; }
      break;
    }
    // a pin that would pull down keeps its sideways hold but lets go vertically
    const pinPull = pulls.find(s => s.pin);
    if (pinPull && pulls.length === 1) { pinPull.yFree = true; lifted.push(pinPull); continue; }
    pulls.splice(pulls.indexOf(pinPull), pinPull ? 1 : 0);
    // drop the worst one and re-solve
    pulls.sort((p, q) => p._Ry - q._Ry);
    lifted.push(pulls[0]);
    active = active.filter(s => s !== pulls[0]);
  }
  const base = { A, I, W, Pdesign, Ptruss, Fval, DispCon, m, r: DispCon.length, j, det, mat, load, opts, midNode: mid, loose,
    activeSupports: active.map(s => ({ node: s.node, pin: s.pin, x: s.x, Ry: s._Ry, Rx: s._Rx || 0, yFree: !!s.yFree, sliding: !!s._slide, xFree: !!s.xFree, claw: !!s.claw, brace: !!s.brace, abut: !!s.abut, corner: !!s.corner, dirX: s.dirX || 0 })),
    lifted: lifted.map(s => ({ node: s.node, x: s.x, pin: !!s.pin })), released, kf, mu };
  if (!U) return Object.assign(base, { stable: false });

  const ftol = 1e-6 * Ptruss;
  const capT = mat.sigT * A, capC = mat.sigC * A;
  const members = tr.elems.map((e, k) => {
    const { L, lx, ly } = geo[k];
    const du = (U[2 * e.j] - U[2 * e.i]) * lx + (U[2 * e.j + 1] - U[2 * e.i + 1]) * ly;
    let f = mat.E * nA(e) / L * du;
    if (Math.abs(f) <= ftol) f = 0;
    const Pcr = Math.PI * Math.PI * mat.E * nI(e) / Math.pow(mat.K * L, 2);
    const cC = capC * e.n, cT = capT * e.n;
    let util = 0, mode = '';
    if (f < 0) { const ub = -f / Pcr, uc = -f / cC; util = Math.max(ub, uc); mode = ub >= uc ? 'buckling' : 'crushing'; }
    else if (f > 0) { util = f / cT; mode = 'tension'; }
    return { k, i: e.i, j: e.j, type: e.type, key: e.key, n: e.n, bundle: e.bundle, mirror: e.mirror, Aeff: nA(e), Ieff: nI(e), L, F: f, TC: f > 0 ? 'T' : (f < 0 ? 'C' : '0'),
      Pcr, capC: Math.min(Pcr, cC), capT: cT, buckles: f < 0 && -f >= Pcr ? 'Y' : 'N', stress: f / nA(e), util, mode, fails: util >= 1,
      lx, ly };
  });

  let dmax = 0, dnode = 0;
  for (let n = 0; n < nN; n++) { const v = Math.abs(U[2 * n + 1]); if (v > dmax) { dmax = v; dnode = n; } }
  const totalLen = geo.reduce((s, g, k) => s + g.L * tr.elems[k].n, 0);   // stick length, counting doubled members
  const massTruss = totalLen * load.nTruss * A * mat.rho * 1000;
  const nTies = tr.deckNodes.length;
  const massTies = nTies * opts.width * A * mat.rho * 1000;
  const failing = members.filter(x => x.fails);
  const maxUtil = Math.max(0, ...members.map(x => x.util));
  const envelope = [];
  // the envelope (#133): checked on the built bridge's outer faces, which are bigger than the joint centrelines by half
  // a stick on every side, plus the tie layer when the ties lie on top of the top chords, and the outside of the trusses
  // at the bottom when they lean (tilt). Over the limits on the outside means it fails (Brian, 2026-10-27).
  const size = envelopeSize(tr, mat, opts);
  { const o = size.outer, c = size.centre, f = v => (Math.round(v * 10) / 10).toFixed(1);
    if (o.height > 100 + 1e-9) envelope.push(`Height is ${f(o.height)} mm to the top face${size.tiesOnTop ? ' of the ties' : ''} (${f(c.height)} mm to the chord centreline), over the 100 mm limit above the deck.`);
    if (o.length > 300 + 1e-6) envelope.push(`Overall length is ${f(o.length)} mm outside to outside (${f(c.length)} mm between end joints), over 300 mm.`);
    if (o.depth > 50 + 1e-6) envelope.push(`The bridge reaches ${f(o.depth)} mm below the deck to its underside (${f(c.depth)} mm to the centreline), more than 50 mm.`);
    if (o.width < 50 - 1e-9 || o.width > 75 + 1e-9) envelope.push(`Bridge width is ${f(o.width)} mm outside to outside (${f(c.width)} mm centre to centre); it must be 50 to 75 mm.`); }
  // no member may pass through the table top beside the span
  { const T = Math.max(0, +tr.design.tableThick || 0), Sp = tr.design.span || 200, hit = [];
    tr.elems.forEach((e, k) => { const a = tr.nodes[e.i], b = tr.nodes[e.j]; for (let t = 0.04; t < 0.97; t += 0.04) { const x = a[0] + t * (b[0] - a[0]), y = a[1] + t * (b[1] - a[1]); if ((x < -0.05 || x > Sp + 0.05) && y < -0.05 && y > -T - 0.05) { hit.push(k); break; } } });
    if (hit.length) envelope.push(`Member${hit.length > 1 ? 's' : ''} ${hit.join(', ')} would pass through the table top.`); }
  const edgeOK = tr.overlap >= opts.minOverlap - 1e-6;
  // a brace slips if the friction it needs is more than mu x the face force
  const slips = base.activeSupports.filter(s => (s.brace || s.abut) && Math.abs(s.Ry) > mu * Math.abs(s.xFree ? 0 : s.Rx) + 1e-4 * Ptruss)
    .map(s => ({ node: s.node, need: Math.abs(s.Ry), have: mu * Math.abs(s.xFree ? 0 : s.Rx) }));
  // a support on the table top that has to hold sideways (an arch foot, say) only has friction: |Rx| must stay within mu x Ry
  base.activeSupports.filter(s => !s.brace && !s.abut && !s.claw && !s.corner && !s.xFree && Math.abs(s.Rx) > mu * Math.max(0, s.Ry) + 1e-4 * Ptruss)
    .forEach(s => slips.push({ node: s.node, need: Math.abs(s.Rx), have: mu * Math.max(0, s.Ry), top: true }));
  const midDefl = Math.abs(U[2 * mid + 1]);
  const deflOK = midDefl <= opts.deflLimit;
  // capacity: book load (kg) at which the first member reaches its limit. Forces scale linearly.
  const capFactor = maxUtil > 0 ? mat.FS / maxUtil : Infinity; // multiples of the book weight
  const wood = totalLen * load.nTruss + (opts.crossTies ? nTies * opts.width : 0);
  return Object.assign(base, { stable: true, U, R, members, dmax, dnode, midDefl,
    totalLen, massTruss, massTies, nTies, massTotal: massTruss + (opts.crossTies ? massTies : 0), wood,
    failing, maxUtil, deflOK, envelope, edgeOK, overlap: tr.overlap, capFactor, capKg: capFactor * (load.mBook1 + load.mBook2),
    slips, size, passes: failing.length === 0 && deflOK && envelope.length === 0 && edgeOK && slips.length === 0 });
}
// the built size: every stick's outline (width b x sqrt(sticks), as drawn) around its centreline; opts.tilt (deg,
// 3D only) leans each truss about its bottom chord; opts.tiesOnTop adds one stick above the top chords
function envelopeSize(tr, mat, opts) {
  const b = +mat.b || 3.18, ph = (+opts.tilt || 0) * Math.PI / 180, cs = Math.cos(ph), sn = Math.abs(Math.sin(ph));
  let top = -Infinity, bot = Infinity, lo = Infinity, hi = -Infinity;
  tr.elems.forEach(e => {
    const p = tr.nodes[e.i], q = tr.nodes[e.j], L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, w = b * Math.sqrt(e.n || 1) / 2;
    const nx = Math.abs((q[1] - p[1]) / L) * w, ny = Math.abs((q[0] - p[0]) / L) * w;   // the outline's reach across the stick
    [p, q].forEach(z => { top = Math.max(top, z[1] + ny); bot = Math.min(bot, z[1] - ny); lo = Math.min(lo, z[0] - nx); hi = Math.max(hi, z[0] + nx); });
  });
  if (!tr.elems.length) { top = tr.maxY; bot = tr.minY; lo = 0; hi = tr.overall; }
  const tiesOnTop = !!opts.tiesOnTop, W = +opts.width || 60;
  const outer = { height: top * cs + (top > 0 ? b / 2 * sn : 0) + (tiesOnTop ? b : 0), depth: Math.max(0, -bot * cs), length: hi - lo, width: W + b * (cs + sn) };
  const centre = { height: tr.design.height, depth: Math.max(0, -tr.minY), length: tr.overall, width: W };
  return { measure: 'outer', outer, centre, tiesOnTop, b };
}

function looseJoints(tr, geo) {
  const loose = [];
  const supNodes = new Set(tr.supports.map(s => s.node));
  for (let n = 0; n < tr.nodes.length; n++) {
    if (n === tr.pin) continue;
    const dirs = [];
    tr.elems.forEach((e, k) => { if (e.i === n || e.j === n) dirs.push([geo[k].lx, geo[k].ly]); });
    if (supNodes.has(n)) { const s = tr.supports.find(q => q.node === n); if (!s.ySpring) dirs.push([0, 1]); if (s.xHold || s.ySpring) dirs.push([1, 0]); if (s.ySpring) dirs.push([0, 1]); }
    let ok = false;
    for (let a = 0; a < dirs.length && !ok; a++) for (let b = a + 1; b < dirs.length; b++)
      if (Math.abs(dirs[a][0] * dirs[b][1] - dirs[a][1] * dirs[b][0]) > 1e-6) { ok = true; break; }
    if (!ok) loose.push(n);
  }
  return loose;
}

const api = { DEFAULT_MAT, panelWidths, expandDiagonals, expandVerticals, patternLeft, buildTruss, analyze, solveLinear, envelopeSize };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
