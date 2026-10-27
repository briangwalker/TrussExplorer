'use strict';
// Benchmark + correctness for density.js on synthetic sweeps. Run: node docs/math/reference/density.bench.js [millions]
const assert = require('assert'); const D = require('./density.js');
const N = Math.round((+process.argv[2] || 10) * 1e6), W = 1200, H = 600;
let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
const wood = new Float32Array(N), cap = new Float32Array(N), pass = new Uint8Array(N);
for (let i = 0; i < N; i++) { const w = 800 + 6000 * r() ** 2; wood[i] = w; cap[i] = Math.max(0.1, (w / 1000) ** 1.3 * (0.2 + 0.8 * r())); pass[i] = cap[i] > 5 ? 1 : 0; }
// one "brilliant" design hidden in the densest area: very high capacity for its wood
wood[123] = 2000; cap[123] = 40;
const view = { x0: 0, x1: 8000, y0: 0, y1: 45 };
let t = performance.now(); const g = D.densityGrid(wood, cap, view, W, H, { best: cap, bestIsMax: true, pass }); const tBin = performance.now() - t;
let total = 0; for (const c of g.count) total += c; assert.strictEqual(total, g.inView);
const px = ((2000 - view.x0) * W / 8000) | 0, py = (H - 1 - ((40 - view.y0) * H / 45)) | 0;
assert.strictEqual(g.bestRow[py * W + px], 123, 'best-per-pixel mode must keep the single brilliant design');
t = performance.now(); const ix = D.buildIndex(wood, cap, view, 256); const tIdx = performance.now() - t;
t = performance.now(); const vis = D.inView(ix, { x0: 1990, x1: 2010, y0: 30, y1: 45 }); const tQ = performance.now() - t;
assert(vis.includes(123));
const mem = (wood.byteLength + cap.byteLength + pass.byteLength) / 1e6;
console.log(`${(N / 1e6).toFixed(0)} M designs, ${W}x${H} px: density pass ${tBin.toFixed(0)} ms (${(N / tBin / 1e3).toFixed(0)} M designs/s), grid index built in ${tIdx.toFixed(0)} ms, zoomed view query ${tQ.toFixed(1)} ms (${vis.length} designs)`);
console.log(`memory for 2 float columns + pass flags: ${mem.toFixed(0)} MB (today's row objects would need about ${(N * 750 / 1e9).toFixed(1)} GB)`);
console.log('density checks: all passed (counts add up; the single best design survives in its crowded pixel; zoom query finds it)');
