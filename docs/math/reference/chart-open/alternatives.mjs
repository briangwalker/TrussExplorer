// #236 (Math Consultant, 2026-10-28): time the alternatives for about 49,000 dots in the same headless Chromium as the profile
import path from 'path';
import { fileURLToPath } from 'url';
// Run from the repo root after building the page:  node docs/math/reference/chart-open/<this file>.mjs [app dir]
const APP = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../program');
const H = await import(path.join(APP, 'tests/ui/harness.mjs'));
const b = await H.browser(), p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.setContent('<canvas id=c width=1200 height=600></canvas>');
const out = await p.evaluate(() => {
  const N = 49480, W = 1200, H = 600; let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rows = Array.from({ length: N }, () => { const wood = 800 + 6000 * r() ** 2; const capKg = (wood / 1000) ** 1.3 * (0.2 + 0.8 * r()); return { wood, capKg, passes: capKg > 5, envOK: true, edgeOK: true, slipOK: true, D: 0.5 }; });
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  const X = v => v / 7000 * W, Y = v => H - v / 30 * H;
  const flush = () => ctx.getImageData(0, 0, 1, 1);   // force the GPU/raster work to finish before timing stops
  const T = f => { const t = performance.now(); f(); flush(); return +(performance.now() - t).toFixed(1); };
  const res = {};
  // sorting work in drawTrade today
  res.sortFrontierLikeToday = T(() => { for (let k = 0; k < 2; k++) { const s2 = rows.filter(q => isFinite(q.capKg)).slice().sort((a, b) => a.wood - b.wood || b.capKg - a.capKg); let best = -Infinity, f = []; s2.forEach(q => { if (q.capKg > best + 1e-9) { f.push(q); best = q.capKg; } }); } rows.filter(q => q.passes).sort((a, b) => a.wood - b.wood)[0]; });
  // once per sweep: columns + index sort on a typed array, frontier once, lightest by a loop
  let cols; res.prepOncePerSweep = T(() => { const n = rows.length, w = new Float64Array(n), c = new Float32Array(n); rows.forEach((q, i) => { w[i] = q.wood; c[i] = q.capKg; });
    const key = new Float64Array(n); for (let i = 0; i < n; i++) key[i] = w[i] * 1e7 + i;   // sort by wood, row number as tie-break packed in
    const ord = Float64Array.from(key).sort(); let best = -Infinity; const f = []; for (let k = 0; k < n; k++) { const i = Math.round(ord[k] - Math.floor(ord[k] / 1e7) * 1e7); if (c[i] > best + 1e-9) { f.push(i); best = c[i]; } }
    let lw = -1; for (let i = 0; i < n; i++) if (rows[i].passes && (lw < 0 || w[i] < w[lw])) lw = i; cols = { w, c, f, lw }; });
  // drawing
  res.drawPerDotToday = T(() => { ctx.clearRect(0, 0, W, H); rows.forEach(q => { ctx.fillStyle = q.passes ? '#8c5e22' : '#7d8892'; ctx.globalAlpha = q.passes ? 0.7 : 0.3; ctx.beginPath(); ctx.arc(X(q.wood), Y(q.capKg), 2.5, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1; });
  res.drawOnePathPerColour = T(() => { ctx.clearRect(0, 0, W, H); for (const pass of [false, true]) { ctx.fillStyle = pass ? '#8c5e22' : '#7d8892'; ctx.globalAlpha = pass ? 0.7 : 0.3; ctx.beginPath(); for (let i = 0; i < rows.length; i++) if (rows[i].passes === pass) { const x = X(cols.w[i]), y = Y(cols.c[i]); ctx.moveTo(x + 2.5, y); ctx.arc(x, y, 2.5, 0, 7); } ctx.fill(); } ctx.globalAlpha = 1; });
  const sprite = c => { const o = new OffscreenCanvas(6, 6), g = o.getContext('2d'); g.fillStyle = c; g.beginPath(); g.arc(3, 3, 2.5, 0, 7); g.fill(); return o; };
  const sp = sprite('#8c5e22'), sf = sprite('#7d8892');
  res.drawSpriteStamps = T(() => { ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 0.3; for (let i = 0; i < rows.length; i++) if (!rows[i].passes) ctx.drawImage(sf, X(cols.w[i]) - 3, Y(cols.c[i]) - 3); ctx.globalAlpha = 0.7; for (let i = 0; i < rows.length; i++) if (rows[i].passes) ctx.drawImage(sp, X(cols.w[i]) - 3, Y(cols.c[i]) - 3); ctx.globalAlpha = 1; });
  // write pixels straight into an ImageData: a 5-pixel disc per dot, alpha-blended in a Uint32 view, one putImageData
  res.drawImageDataStamps = T(() => { const img = ctx.createImageData(W, H), px = new Uint32Array(img.data.buffer); const disc = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) disc.push(dy * W + dx);
    const blend = (p, r1, g1, b1, a) => { const o = px[p], ia = 1 - a; const r0 = o & 255, g0 = (o >> 8) & 255, b0 = (o >> 16) & 255, a0 = o >>> 24; px[p] = ((Math.max(a0, a * 255) | 0) << 24) | (((b0 * ia + b1 * a) | 0) << 16) | (((g0 * ia + g1 * a) | 0) << 8) | ((r0 * ia + r1 * a) | 0); };
    for (const pass of [false, true]) { const [r1, g1, b1, a] = pass ? [140, 94, 34, 0.7] : [125, 136, 146, 0.3]; for (let i = 0; i < rows.length; i++) if (rows[i].passes === pass) { const x = X(cols.w[i]) | 0, y = Y(cols.c[i]) | 0; if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue; const c0 = y * W + x; for (const o of disc) blend(c0 + o, r1, g1, b1, a); } }
    ctx.putImageData(img, 0, 0); });
  let bmp; res.cacheRestImage = T(() => { bmp = new OffscreenCanvas(W, H); bmp.getContext('2d').drawImage(cv, 0, 0); });
  res.reopenFromCache = T(() => { ctx.clearRect(0, 0, W, H); ctx.drawImage(bmp, 0, 0); });
  // 3D: per-dot colour read vs once
  const root = document.documentElement; root.style.setProperty('--accent', '#8c5e22');
  res.cssvPerDot3D = T(() => { for (let i = 0; i < N; i++) getComputedStyle(root).getPropertyValue('--accent'); });
  res.cssvOnce = T(() => { getComputedStyle(root).getPropertyValue('--accent'); });
  // 3D depth order: full sort per frame vs 32 depth buckets (counting sort, O(n))
  const d = Float32Array.from({ length: N }, () => r());
  res.depthSortPerFrame = T(() => { Array.from({ length: N }, (_, i) => ({ i, d: d[i] })).sort((a, b) => b.d - a.d); });
  res.depthBuckets32 = T(() => { const B = 32, cnt = new Uint32Array(B + 1); for (let i = 0; i < N; i++) cnt[Math.min(B - 1, (d[i] * B) | 0) + 1]++; for (let k = 0; k < B; k++) cnt[k + 1] += cnt[k]; const o = new Uint32Array(N); for (let i = 0; i < N; i++) o[cnt[Math.min(B - 1, (d[i] * B) | 0)]++] = i; });
  return res;
});
console.log(JSON.stringify(out, null, 1)); await b.close();
