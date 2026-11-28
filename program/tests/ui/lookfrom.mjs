// Step 7 (#214, UI-V7): 3D "Look from" Side / Top / End. One button at the view cube's bottom-right opens Side / Top / End
// downward; Top shows both bracing planes, End each cross-frame with its key, both drawn from the 3D model's own members
// (m3) in the meaning colours (UI-A18); a switch leaves no pop-up open (#408); the active view again goes back to 3D.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { serve, browser, openPage, checker, SHOTS } from './harness.mjs';

const require = createRequire(import.meta.url);
let axeSrc = null; try { axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch (e) { /* npm ci not run: the axe check says so */ }
const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
const rect = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; }, sel);
const meets = (a, c) => !!a && !!c && a.l < c.r - 0.5 && c.l < a.r - 0.5 && a.t < c.b - 0.5 && c.t < a.b - 0.5;
// the test's own reading of the model: which members join two top-chord joints, two bottom-chord joints, or two joints of one station
const expected = () => {
  const m = __dbg.m3, r = __dbg.r3, n = m.n, top = new Set(), bot = new Set();
  m.top.forEach(t => { top.add(t); top.add(t + n); }); m.bottom.forEach(q => { bot.add(q); bot.add(q + n); });
  m.nodes.forEach((p, i) => { if (i >= 2 * n) top.add(i); });
  const pick = s => m.elems.map((e, k) => s.has(e.i) && s.has(e.j) ? k : -1).filter(k => k >= 0);
  const col = k => { const q = r && r.stable ? r.members[k] : null; return !q ? 'var(--ink)' : q.fails ? 'var(--bad)' : Math.abs(q.F) < 0.005 ? 'var(--zero)' : q.F < 0 ? 'var(--comp)' : 'var(--tens)'; };
  return { top: pick(top), bottom: pick(bot), col: Object.fromEntries(m.elems.map((e, k) => [k, col(k)])),
    latTop: m.elems.map((e, k) => e.type === 'lat' && e.plane === 'top' ? k : -1).filter(k => k >= 0),
    latBot: m.elems.map((e, k) => e.type === 'lat' && e.plane === 'bottom' ? k : -1).filter(k => k >= 0),
    chordTop: m.elems.map((e, k) => e.side !== 'cross' && e.type === 'top' ? k : -1).filter(k => k >= 0),
    sway: m.elems.map((e, k) => e.type === 'sway' ? k : -1).filter(k => k >= 0),
    frames: m.frames.map(f => f.code) };
};
const drawn = () => {
  const ks = sel => [...document.querySelectorAll(sel + ' line[data-k]')].map(l => ({ k: +l.dataset.k, c: l.getAttribute('stroke') }));
  return { top: ks('[data-plane="top"]'), bottom: ks('[data-plane="bottom"]'),
    frames: [...document.querySelectorAll('#lookView [data-frame]')].map(f => ({ ks: ks(`[data-frame="${f.dataset.frame}"]`), cap: f.querySelector('figcaption').textContent })) };
};
const sameSet = (a, c) => a.length === c.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...c].sort((x, y) => x - y)[i]);
const popupsShut = p => p.evaluate(() => ({ menu: document.getElementById('lookMenu').hidden, tip: document.getElementById('d3Tip').hidden, dim: document.getElementById('dimPop').hidden }));
try {
  for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    const tag = vp.width + 'x' + vp.height;
    const p = await openPage(b, srv.url, vp); await p.waitForTimeout(600);
    await p.evaluate(() => { const e = document.querySelector('#shellNav [data-sw="t:3"]'); if (e) e.click(); }); await p.waitForTimeout(1200);
    check(`${tag}: Truss 3D is on (the 3D model is built)`, await p.evaluate(() => __dbg.S.anaMode === '3d' && !!__dbg.m3));
    // ---- the button: at the cube's bottom-right, never over the cube; the list opens downward, under it (UI-V7)
    const cube = await rect(p, '#fsFill .navcube'), btn = await rect(p, '#lookBtn');
    check(`${tag}: Look from is one button under the view cube's bottom edge, at its right side, not over the cube`, !!btn && !!cube && btn.t >= cube.b - 8 && btn.t <= cube.b + 4 && btn.r <= cube.r + 1 && btn.r >= cube.l + 30, JSON.stringify({ cube, btn }));
    await p.focus('#lookBtn'); await p.waitForTimeout(100);
    const menu = await rect(p, '#lookMenu');
    check(`${tag}: focusing it opens Side / Top / End downward, under the button, clear of the cube`, !!menu && menu.t >= btn.b && !meets(menu, cube) && await p.evaluate(() => [...document.querySelectorAll('#lookMenu [role="menuitemradio"]')].map(e => e.textContent).join() === 'Side,Top,End'), JSON.stringify(menu));
    check(`${tag}: the button says it opens a menu and that it is open`, await p.evaluate(() => { const e = document.getElementById('lookBtn'); return e.getAttribute('aria-haspopup') === 'menu' && e.getAttribute('aria-expanded') === 'true'; }));
    // ---- keyboard: ↓ to Top, Enter picks it; Esc closes the list and gives focus back
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
    check(`${tag}: ↓ walks the list (Top has focus after two)`, await p.evaluate(() => document.activeElement && document.activeElement.dataset.look === 'top'));
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    check(`${tag}: Enter picks Top`, await p.evaluate(() => __look.view === 'top' && !document.getElementById('lookView').hidden));
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    check(`${tag}: after a pick, the list is shut and focus is back on the button`, await p.evaluate(() => document.getElementById('lookMenu').hidden && document.activeElement.id === 'lookBtn'));
    // #533 (UI-W8): Tab to Look from, ↓ to an item, then ONE Escape closes the list and puts focus on the button
    await p.evaluate(() => { document.activeElement && document.activeElement.blur(); const ids = [...document.querySelectorAll('button, [tabindex]')].filter(e => e.tabIndex >= 0 && e.getBoundingClientRect().width > 0); const i = ids.indexOf(document.getElementById('lookBtn')); (ids[i - 1] || document.body).focus(); });
    await p.keyboard.press('Tab'); await p.waitForTimeout(100);
    check(`${tag}: Tab reaches Look from and opens its list`, await p.evaluate(() => document.activeElement.id === 'lookBtn' && !document.getElementById('lookMenu').hidden));
    await p.keyboard.press('ArrowDown'); await p.waitForTimeout(50);
    check(`${tag}: ↓ puts focus on a list item`, await p.evaluate(() => !!document.activeElement.dataset.look));
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    check(`${tag}: one Escape on a list item closes the list and puts focus on Look from (#533)`, await p.evaluate(() => document.getElementById('lookMenu').hidden && document.getElementById('lookBtn').getAttribute('aria-expanded') === 'false' && document.activeElement.id === 'lookBtn'), JSON.stringify(await p.evaluate(() => ({ hidden: document.getElementById('lookMenu').hidden, act: document.activeElement.id || document.activeElement.tagName }))));
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    check(`${tag}: Escape again on the button keeps the list shut and focus on the button`, await p.evaluate(() => document.getElementById('lookMenu').hidden && document.activeElement.id === 'lookBtn'));
    // Esc on the button itself (list open by focus) still closes it in one press
    await p.evaluate(() => document.getElementById('lookBtn').blur()); await p.focus('#lookBtn'); await p.waitForTimeout(80);
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    check(`${tag}: Escape on the button with the list open closes it in one press`, await p.evaluate(() => document.getElementById('lookMenu').hidden && document.activeElement.id === 'lookBtn'));
    // ---- Top: both bracing planes, the model's own members, meaning colours
    let E = await p.evaluate(expected), D = await p.evaluate(drawn);
    check(`${tag}: Top draws exactly the model's top-plane members (chords, ties, lateral bracing)`, sameSet(D.top.map(x => x.k), E.top) && E.latTop.every(k => E.top.includes(k)) && E.chordTop.every(k => E.top.includes(k)), `${D.top.length} vs ${E.top.length}`);
    check(`${tag}: Top draws exactly the model's bottom-plane members`, sameSet(D.bottom.map(x => x.k), E.bottom) && E.latBot.every(k => E.bottom.includes(k)), `${D.bottom.length} vs ${E.bottom.length}`);
    check(`${tag}: no sway diagonal in Top (they are edge-on from above)`, !D.top.concat(D.bottom).some(x => E.sway.includes(x.k)));
    check(`${tag}: every member in Top has its meaning colour (UI-A18)`, D.top.concat(D.bottom).every(x => x.c === E.col[x.k]));
    check(`${tag}: Top has a colour key in words (fail is never colour only)`, await p.evaluate(() => /compression.*tension.*zero force.*✕ fails/.test(document.querySelector('#lookView [data-key="colours"]').textContent)));
    // the per-panel chips appear below; a click changes the bracing and the drawing follows
    const geo = () => p.evaluate(() => [...document.querySelectorAll('[data-plane="top"] line[data-k]')].map(l => ['x1', 'y1', 'x2', 'y2'].map(a => (+l.getAttribute(a)).toFixed(1)).join()).sort().join(';'));
    const before = await geo();
    await p.evaluate(() => document.querySelector('#lookView [data-look-chips="top"] [data-chip="topPat:0"]').click()); await p.waitForTimeout(500);
    D = await p.evaluate(drawn); E = await p.evaluate(expected);
    check(`${tag}: Top's bracing chips are below, and a click redraws Top from the new model`, sameSet(D.top.map(x => x.k), E.top) && await p.evaluate(() => __dbg.S.d3.topPat[0] === 'R') && (await geo()) !== before);
    await p.evaluate(() => document.querySelector('#lookView [data-look-chips="top"] [data-chip="topPat:0"]').click()); await p.waitForTimeout(200);
    await p.evaluate(() => { for (let i = 0; i < 2; i++) document.querySelector('#lookView [data-look-chips="top"] [data-chip="topPat:0"]').click(); }); await p.waitForTimeout(500);
    check(`${tag}: four clicks bring the chip round to where it started`, await p.evaluate(() => __dbg.S.d3.topPat[0] === 'S'), JSON.stringify(await p.evaluate(() => __dbg.S.d3.topPat)));
    // the picture sits in the free part of the stage: not under a window, the top bar or the cube
    const fig = await rect(p, '#lookView [data-plane="top"]'), under = await p.evaluate(() => ['#win-inputs', '#win-view', '#shellNav', '#win-drawing', '#fsFill .navcube', '#lookFrom'].map(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { s, l: r.left, t: r.top, r: r.right, b: r.bottom } : null; }).filter(Boolean));
    check(`${tag}: Top sits in the free part of the stage (under no window, bar or the cube)`, !!fig && under.every(q => !meets(fig, q)), JSON.stringify(under.filter(q => meets(fig, q)).map(q => q.s)));
    if (axeSrc) {
      await p.addScriptTag({ content: axeSrc });
      const v = await p.evaluate(async () => (await axe.run(document.getElementById('lookView').parentElement, { resultTypes: ['violations'] })).violations.filter(x => ['critical', 'serious'].includes(x.impact)).map(x => `${x.id} ×${x.nodes.length}`));
      check(`${tag}: axe finds nothing critical or serious on the Top view and its control`, v.length === 0, v.join('; '));
    } else check(`${tag}: axe-core is installed (npm ci) for the axe check`, false);
    await p.screenshot({ path: path.join(SHOTS, `lookfrom-top-${vp.width}.png`) });
    // ---- End: each cross-frame with its key, the model's own members
    await p.evaluate(() => __look.set('end')); await p.waitForTimeout(300);
    E = await p.evaluate(expected); D = await p.evaluate(drawn);
    const allEnd = new Set(D.frames.flatMap(f => f.ks.map(x => x.k)));
    check(`${tag}: End shows one frame per station`, D.frames.length === E.frames.length && E.frames.length > 0, `${D.frames.length} vs ${E.frames.length}`);
    check(`${tag}: each frame carries its key (the station's code)`, D.frames.every((f, i) => new RegExp(`key\\s.*\\b${E.frames[i]}\\b`).test(f.cap)), D.frames.map(f => f.cap).join(' | '));
    check(`${tag}: End draws every sway diagonal of the model, each in its station`, E.sway.every(k => allEnd.has(k)));
    check(`${tag}: End's members join two joints of their own station only, in meaning colours`, await p.evaluate(() => { const m = __dbg.m3, F = __look.members(); return [...document.querySelectorAll('#lookView [data-frame]')].every(f => { const want = F.frames[+f.dataset.frame].members, got = [...f.querySelectorAll('line[data-k]')].map(l => +l.dataset.k); return want.length === got.length && want.every(k => got.includes(k)); }); }) && D.frames.every(f => f.ks.every(x => x.c === E.col[x.k])));
    check(`${tag}: End's chips are the cross-frame chips`, await p.evaluate(() => document.querySelectorAll('#lookView [data-look-chips="frames"] [data-chip^="framePat:"]').length > 0));
    await p.screenshot({ path: path.join(SHOTS, `lookfrom-end-${vp.width}.png`) });
    // ---- a switch leaves no pop-up open (#408): the list, the member tip, the ✎ editor
    await p.evaluate(() => { document.getElementById('lookMenu').hidden = false; document.getElementById('d3Tip').hidden = false; });
    await p.evaluate(() => __look.set('top')); await p.waitForTimeout(200);
    let shut = await popupsShut(p);
    check(`${tag}: switching End → Top leaves no pop-up open`, shut.menu && shut.tip && shut.dim, JSON.stringify(shut));
    // the active view again: back to 3D
    await p.hover('#lookBtn', { force: true }).catch(() => {}); await p.evaluate(() => document.querySelector('#lookMenu [data-look="top"]').click()); await p.waitForTimeout(300);
    shut = await popupsShut(p);
    check(`${tag}: clicking the active view (Top) again goes back to 3D, with no pop-up left`, await p.evaluate(() => __look.view === '3d' && document.getElementById('lookView').hidden) && shut.menu && shut.tip && shut.dim);
    // Side turns the camera square to the front truss; Side again goes back to the 3D view
    await p.evaluate(() => __look.set('side')); await p.waitForTimeout(500);
    const side = await p.evaluate(() => ({ yaw: __dbg.v3.yaw, pitch: __dbg.v3.pitch, hidden: document.getElementById('lookView').hidden }));
    check(`${tag}: Side looks square at the front truss on the 3D canvas`, Math.abs(side.yaw) < 1e-6 && Math.abs(side.pitch) < 1e-6 && side.hidden, JSON.stringify(side));
    await p.evaluate(() => __look.set('side')); await p.waitForTimeout(500);
    check(`${tag}: Side again goes back to the 3D view`, await p.evaluate(() => __look.view === '3d' && Math.abs(__dbg.v3.pitch - 0.42) < 1e-6));
    check(`${tag}: the view is never saved with the design`, await p.evaluate(() => !JSON.stringify(__dbg.S).includes('look')));
    // ---- the app still works: back to 2D, the side view comes back with its results
    await p.evaluate(() => { const e = document.querySelector('#shellNav [data-sw="t:2"]'); if (e) e.click(); }); await p.waitForTimeout(800);
    check(`${tag}: back in 2D the side view and its results are there`, await p.evaluate(() => __dbg.S.anaMode === '2d' && __dbg.res && __dbg.res.stable));
    check(`${tag}: no page errors`, p.errs.length === 0, p.errs.slice(0, 3).join(' | '));
    await p.close();
  }
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`\nlookfrom: ${check.results.length - bad.length}/${check.results.length} passed`);
process.exit(bad.length ? 1 : 0);
