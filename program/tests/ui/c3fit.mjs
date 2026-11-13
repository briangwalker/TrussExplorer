// #409 (TE-B-313): the 3D trade-off chart's default view fills the picture (UI-A3, UI-C7): drawn at 1366 x 900 as the
// full-screen picture, the box and its points span most of the free height, centred below the top bar; it refits on resize.
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';
const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
// the bounding box of everything drawn on the chart canvas (pixels that aren't transparent), in CSS px
const drawn = p => p.evaluate(() => { const c = document.getElementById('c3Canvas'), x = c.getContext('2d'), W = c.width, H = c.height, d = x.getImageData(0, 0, W, H).data, k = W / c.clientWidth;
  let x0 = W, x1 = 0, y0 = H, y1 = 0; for (let y = 0; y < H; y += 2) for (let i = 0; i < W; i += 2) if (d[(y * W + i) * 4 + 3] > 20) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0: x0 / k, x1: x1 / k, y0: y0 / k, y1: y1 / k, w: c.clientWidth, h: c.clientHeight }; });
try {
  const p = await openPage(b, srv.url); await waitRows(p);
  await p.evaluate(() => { const x = document.querySelector('[data-sw="a:3"]'); x && x.click(); }); await p.waitForTimeout(1200);
  const a = await drawn(p);
  check('#409: the 3D chart is the full-screen picture', a.w >= 1300 && a.h >= 850, JSON.stringify(a));
  check('#409: its default view spans at least 82% of the free height (it was 76%)', (a.y1 - a.y0) >= 0.82 * (a.h - 106), JSON.stringify(a));
  check('#409: and stays below the top bar and above the bottom tabs', a.y0 >= 60 && a.y1 <= a.h - 20, JSON.stringify(a));
  await p.setViewportSize({ width: 1024, height: 700 }); await p.waitForTimeout(1200);
  const c = await drawn(p);
  check('#409: it refits on resize', c.w <= 1030 && (c.y1 - c.y0) >= 0.82 * (c.h - 106) && c.x1 <= c.w + 1, JSON.stringify(c));
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} 3D-chart fit checks passed`);
process.exit(fails.length ? 1 : 0);
