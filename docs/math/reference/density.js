'use strict';
// Reference for the "millions of designs" chart (docs/math/guide-millions-of-points.md).
// densityGrid: count designs per screen pixel, plus the best value per pixel and how many pass. Pure arithmetic on typed
// arrays, so it runs in a Web Worker; the main thread only paints the finished image.
(function (root) {
// xs, ys: Float32Array columns already in chart units (e.g. wood, capacity); view: { x0, x1, y0, y1 }; W, H: pixels
// opts.best: Float32Array value to keep the best of per pixel (e.g. capacity), opts.bestIsMax; opts.pass: Uint8Array 0/1
function densityGrid(xs, ys, view, W, H, opts) {
  opts = opts || {};
  const n = xs.length, count = new Uint32Array(W * H), passN = opts.pass ? new Uint32Array(W * H) : null;
  const best = opts.best ? new Float32Array(W * H).fill(opts.bestIsMax ? -Infinity : Infinity) : null, bestRow = opts.best ? new Int32Array(W * H).fill(-1) : null;
  const sx = W / (view.x1 - view.x0), sy = H / (view.y1 - view.y0);
  let inView = 0;
  for (let i = 0; i < n; i++) {
    const px = ((xs[i] - view.x0) * sx) | 0, py = (H - 1 - ((ys[i] - view.y0) * sy)) | 0;   // y up
    if (px < 0 || px >= W || py < 0 || py >= H || xs[i] !== xs[i] || ys[i] !== ys[i]) continue;   // off screen or NaN (unstable)
    const p = py * W + px; count[p]++; inView++;
    if (passN && opts.pass[i]) passN[p]++;
    if (best) { const v = opts.best[i]; if (opts.bestIsMax ? v > best[p] : v < best[p]) { best[p] = v; bestRow[p] = i; } }
  }
  return { count, passN, best, bestRow, inView };
}
// log colour scale for counts: 1 design and 100,000 designs in a pixel must both be visible
function logLevel(c, cmax) { return c ? Math.log1p(c) / Math.log1p(cmax) : 0; }

// grid index for the zoomed-in "real dots" mode: bucket every design by a coarse cell once, then a view only touches its cells
function buildIndex(xs, ys, bounds, G) {
  const sx = G / (bounds.x1 - bounds.x0 || 1), sy = G / (bounds.y1 - bounds.y0 || 1), cell = new Uint32Array(xs.length), counts = new Uint32Array(G * G + 1);
  for (let i = 0; i < xs.length; i++) { const cx = Math.min(G - 1, Math.max(0, ((xs[i] - bounds.x0) * sx) | 0)), cy = Math.min(G - 1, Math.max(0, ((ys[i] - bounds.y0) * sy) | 0)); cell[i] = cy * G + cx; counts[cell[i] + 1]++; }
  for (let c = 0; c < G * G; c++) counts[c + 1] += counts[c];
  const order = new Uint32Array(xs.length), fill = counts.slice(0, G * G); for (let i = 0; i < xs.length; i++) order[fill[cell[i]]++] = i;
  return { G, bounds, sx, sy, start: counts, order };
}
function inView(ix, view) {   // design numbers (row positions) of the cells that overlap the view
  const { G, bounds, sx, sy, start, order } = ix, c = v => Math.min(G - 1, Math.max(0, v | 0)), out = [];
  for (let cy = c((view.y0 - bounds.y0) * sy); cy <= c((view.y1 - bounds.y0) * sy); cy++)
    for (let cx = c((view.x0 - bounds.x0) * sx); cx <= c((view.x1 - bounds.x0) * sx); cx++) for (let k = start[cy * G + cx]; k < start[cy * G + cx + 1]; k++) out.push(order[k]);
  return out;
}
const api = { densityGrid, logLevel, buildIndex, inView };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TEDensity = api;
})(typeof window !== 'undefined' ? window : globalThis);
