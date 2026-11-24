// step 7 (#214, TE-B-384 BPD-11): Look from Side / Top / End on the 3D view (UI-S2, UI-V7, UI-W8, UI-A18).
// Top draws one bracing plane and End one cross-frame, straight on, from the 3D model's own members; the chips pick
// the plane or the frame; the active view again goes back to 3D; nothing is saved; no pop-up is left open.
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const AXE = require.resolve('axe-core/axe.min.js');
const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
// chips and menu items are clicked through the DOM: in the shell the Drawing window still sits over the cube's corner
// (UI-W19's 'Drawing opens 8 px below the view control' is shell.js's, not this step's; see the PR)
const sw = (p, d) => p.evaluate(d => { const x = document.querySelector(`[data-sw="t:${d}"]`); if (x) x.click(); return !!x; }, d);
const st = p => p.evaluate(() => {
  const vis = el => !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  const svg = document.getElementById('lookSvg'), menu = document.getElementById('lookMenu'), chips = document.getElementById('lookChips');
  return { view: window.__look.view, svg: vis(svg), menu: vis(menu), chips: vis(chips), canvas: vis(document.getElementById('c3d')),
    drawn: svg ? [...svg.querySelectorAll('line.lookm')].map(l => +l.dataset.k).sort((x, y) => x - y) : [],
    label: svg ? svg.getAttribute('aria-label') : '', chipN: chips ? chips.querySelectorAll('button').length : 0,
    btn: (document.getElementById('lookBtn') || {}).textContent };
});
const pick = (p, k) => p.evaluate(k => document.querySelector(`#lookMenu [data-look="${k}"]`).click(), k);
const same = (a, c) => a.length === c.length && a.every((x, i) => x === c[i]);
for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
  const tag = `${vp.width}x${vp.height}: `;
  const p = await openPage(b, srv.url, vp); await waitRows(p);
  await sw(p, 3); await p.waitForTimeout(600);
  const store0 = await p.evaluate(() => JSON.stringify(localStorage));
  const btnOk = await p.evaluate(() => { const bt = document.getElementById('lookBtn'), cube = bt && bt.closest('.chartbox').querySelector('.navcube');
    if (!bt || !cube) return { bt: !!bt, cube: !!cube }; const r = bt.getBoundingClientRect(), c = cube.getBoundingClientRect();
    return { vis: r.width > 0, right: Math.abs(r.right - c.right) <= 2, below: r.top >= c.top + c.height / 2 }; });
  const top3d = await p.evaluate(() => { const c = document.getElementById('c3d'), r = c.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el === c || !!(el && el.closest('.d3labs')); });
  check(tag + 'in 3D nothing of Look from covers the 3D picture (a drag still turns it)', top3d);
  check(tag + 'Look from is one button at the view cube\'s bottom-right (UI-V7)', btnOk.vis && btnOk.right && btnOk.below, JSON.stringify(btnOk));
  await p.focus('#lookBtn'); await p.waitForTimeout(100);
  let s = await st(p);
  const menuPos = await p.evaluate(() => { const m = document.getElementById('lookMenu').getBoundingClientRect(), c = document.querySelector('#lookBtn').closest('.chartbox').querySelector('.navcube').getBoundingClientRect(), bt = document.getElementById('lookBtn').getBoundingClientRect();
    return { under: m.top >= bt.bottom - 1, clearOfCube: m.top >= c.bottom - 1 || m.left >= c.right, items: [...document.querySelectorAll('#lookMenu [data-look]')].map(x => x.textContent) }; });
  check(tag + 'focusing it opens Side / Top / End downward, under the button, clear of the cube', s.menu && menuPos.under && menuPos.items.join() === 'Side,Top,End', JSON.stringify(menuPos));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100); s = await st(p);
  check(tag + 'Esc closes the list and focus stays on the button (UI-K2)', !s.menu && await p.evaluate(() => document.activeElement && document.activeElement.id === 'lookBtn'));
  const sets = await p.evaluate(() => { const x = window.__look.sets(); const m3 = window.__dbg.m3;
    return { top: x.top.members, bottom: x.bottom.members, frames: x.frames.map(f => ({ m: f.members, code: f.code })),
      latTop: m3.elems.map((e, k) => (e.type === 'lat' && e.plane === 'top') ? k : -1).filter(k => k >= 0),
      latBot: m3.elems.map((e, k) => (e.type === 'lat' && e.plane === 'bottom') ? k : -1).filter(k => k >= 0),
      sway: m3.elems.map((e, k) => e.type === 'sway' ? k : -1).filter(k => k >= 0) }; });
  // TOP
  await pick(p, 'top'); await p.waitForTimeout(150); s = await st(p);
  check(tag + 'Top: the flat view replaces the 3D picture and the plane chips show', s.view === 'top' && s.svg && !s.canvas && s.chips && s.chipN === 2, JSON.stringify({ ...s, drawn: s.drawn.length }));
  check(tag + 'Top plane: drawn members = the model\'s top-plane members, every top lateral brace among them', same(s.drawn, sets.top) && sets.latTop.every(k => s.drawn.includes(k)) && sets.top.length > 0, `${s.drawn.length} vs ${sets.top.length}`);
  await p.evaluate(() => document.querySelector('#lookChips [data-plane="bottom"]').click()); await p.waitForTimeout(100); s = await st(p);
  check(tag + 'Bottom plane chip: drawn members = the model\'s bottom-plane members, every bottom lateral brace among them', same(s.drawn, sets.bottom) && sets.latBot.every(k => s.drawn.includes(k)) && sets.bottom.length > 0 && /bottom/.test(s.label), `${s.drawn.length} vs ${sets.bottom.length}`);
  const colours = await p.evaluate(() => [...document.querySelectorAll('#lookSvg line.lookm')].map(l => l.getAttribute('stroke')));
  check(tag + 'members are drawn in the meaning colours (UI-A18)', colours.length > 0 && colours.every(c => /var\(--(comp|tens|zero|bad|ink)\)/.test(c)), colours.slice(0, 3).join());
  // END
  await pick(p, 'end'); await p.waitForTimeout(150); s = await st(p);
  check(tag + 'End: one chip per cross-frame, each with its key', s.view === 'end' && s.svg && s.chipN === sets.frames.length && sets.frames.length > 0, `${s.chipN} vs ${sets.frames.length}`);
  let allFrames = true, swayCovered = new Set();
  for (let i = 0; i < sets.frames.length; i++) {
    await p.evaluate(i => document.querySelector(`#lookChips [data-frame="${i}"]`).click(), i); await p.waitForTimeout(40); const si = await st(p);
    if (!same(si.drawn, sets.frames[i].m)) allFrames = false; si.drawn.forEach(k => swayCovered.add(k));
  }
  check(tag + 'every frame chip draws exactly that frame\'s members', allFrames);
  check(tag + 'every sway diagonal of the model shows in some frame', sets.sway.every(k => swayCovered.has(k)), `${sets.sway.filter(k => !swayCovered.has(k))}`);
  const keyTxt = await p.evaluate(() => document.getElementById('lookSvg').textContent);
  check(tag + 'the End view carries its key (frame codes and the force colours)', /key:/.test(keyTxt) && /this frame:/.test(keyTxt) && /compression/.test(keyTxt) && /tension/.test(keyTxt));
  // the active view again: back to 3D
  await pick(p, 'end'); await p.waitForTimeout(150); s = await st(p);
  check(tag + 'clicking the active view again returns to 3D', s.view === '3d' && !s.svg && s.canvas && !s.chips, JSON.stringify({ view: s.view, svg: s.svg, canvas: s.canvas }));
  const store1 = await p.evaluate(() => JSON.stringify(localStorage));
  check(tag + 'Top, End and their chips save nothing (it is a view)', store0 === store1);
  await pick(p, 'side'); await p.waitForTimeout(700);
  const side = await p.evaluate(() => ({ yaw: window.__dbg.v3.yaw, pitch: window.__dbg.v3.pitch, view: window.__look.view }));
  check(tag + 'Side turns the 3D bridge to straight-on from the side', side.view === 'side' && Math.abs(side.yaw) < 1e-6 && Math.abs(side.pitch) < 1e-6, JSON.stringify(side));
  // a cube click goes back to the 3D picture
  await pick(p, 'top'); await p.waitForTimeout(100);
  await p.evaluate(() => { const h = document.querySelector('#lookBtn').closest('.chartbox').querySelector('.navcube .home'); if (h) h.click(); }); await p.waitForTimeout(100);
  s = await st(p); check(tag + 'the cube\'s ⌂ goes back to the 3D picture', s.view === '3d' && s.canvas && !s.svg);
  // a 3D <-> 2D switch leaves no pop-up open (#408's pattern) and nothing saved
  await pick(p, 'end'); await p.focus('#lookBtn'); await p.waitForTimeout(100);
  await sw(p, 2); await p.waitForTimeout(400); s = await st(p);
  check(tag + 'after 3D -> 2D: no Look from list or flat view left on screen', !s.menu && !s.svg && !s.chips, JSON.stringify(s));
  await sw(p, 3); await p.waitForTimeout(400);
  // axe on the flat view
  await pick(p, 'top'); await p.waitForTimeout(150);
  await p.addScriptTag({ path: AXE });
  const ax = await p.evaluate(async () => { const r = await window.axe.run(document.querySelector('#lookSvg').parentElement, { resultTypes: ['violations'] });
    return r.violations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).slice(0, 2).join('|')); });
  check(tag + 'axe: no critical or serious finding on the view and its controls', ax.length === 0, ax.join(' ; '));
  await p.screenshot({ path: `/tmp/claude-0/s/look-${vp.width}.png` });
  check(tag + 'no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
}
await b.close(); srv.close();
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} Look from checks passed`);
process.exit(fails.length ? 1 : 0);
