// Step 2b (#399): results live on the drawing (UI-A13, UI-D3, UI-D6, UI-T4). Books drawn as books, the wood pile end-on,
// three callouts (determinacy, deflection, fits) with leaders; the results card holds numbers only; text never overlaps text.
import path from 'path';
import { serve, browser, openPage, checker, SHOTS } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
const probe = () => {
  const svg = document.getElementById('draw');
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const texts = [...svg.querySelectorAll('text')].filter(t => t.getBoundingClientRect().width > 0).map(t => ({ s: t.textContent.slice(0, 24), ...box(t) }));
  // the three drawn here (callouts, the books line, the two labels moved off x = 100) must clear every other text; 'lifts off' crowding the
  // node numbers and the overlap tag is older (filed as a UI-D6 follow-up) and is only counted
  const mine = s => /^(determinacy|mid-span|fits|books ·|50 mm max|clear span)|[✓✕]|\bvs\b/.test(s);
  let overlap = [], older = 0;
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], c = texts[j], ix = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), iy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
    if (ix > 0.8 && iy > 0.8) { if (mine(a.s) || mine(c.s)) overlap.push(a.s + ' | ' + c.s); else older++; }
  }
  const bk = [...svg.querySelectorAll('[data-book]')].map(g => ({ id: g.dataset.book, ...box(g.querySelector('rect')) }));
  const pile = svg.querySelector('[data-pile]');
  const call = {}; svg.querySelectorAll('[data-callout]').forEach(g => { call[g.dataset.callout] = { stroke: g.querySelector('rect').getAttribute('stroke'), text: g.textContent }; });
  const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const brk = [...svg.querySelectorAll('[data-break]')].map(g => { const l = g.querySelector('line'); return { side: g.dataset.break, x: +l.getAttribute('x1'), lines: g.querySelectorAll('line').length, len: Math.abs(+l.getAttribute('y2') - +l.getAttribute('y1')) }; });
  const card = document.getElementById('stats').textContent;
  const svgBox = svg.getBoundingClientRect();
  const inside = [...svg.querySelectorAll('[data-callout] rect, [data-pile]')].every(e => { const r = e.getBoundingClientRect(); return r.left >= svgBox.left - 1 && r.right <= svgBox.right + 1 && r.top >= svgBox.top - 1 && r.bottom <= svgBox.bottom + 1; });
  return { overlap, older, brk, vb, bk, pile: pile ? { n: +pile.dataset.pile, w: +pile.dataset.pileW } : null, call, card, inside, res: { deflOK: __dbg.res.deflOK, ok: __dbg.res.stable } };
};
try {
  for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    const tag = vp.width + 'x' + vp.height;
    const p = await openPage(b, srv.url, vp); await p.waitForTimeout(700);
    const r = await p.evaluate(probe);
    check(`${tag}: two books drawn as books (book1 under book2)`, r.bk.length === 2 && r.bk[0].id === 'book1' && r.bk[1].id === 'book2' && r.bk[1].y < r.bk[0].y - 0.1, JSON.stringify(r.bk));
    check(`${tag}: the wood pile is on the drawing`, !!r.pile && r.pile.n >= 1 && r.pile.w > 0, JSON.stringify(r.pile));
    check(`${tag}: three callouts (determinacy, deflection, fits)`, ['det', 'defl', 'fits'].every(k => r.call[k]), Object.keys(r.call).join());
    check(`${tag}: the deflection callout carries the pass/fail colour`, r.call.defl && r.call.defl.stroke === (r.res.deflOK ? 'var(--ok)' : 'var(--bad)'), r.call.defl && r.call.defl.stroke);
    check(`${tag}: callout words are in the text, not only in colour`, r.call.defl && /✓|✕/.test(r.call.defl.text) && r.call.fits && /✓|✕/.test(r.call.fits.text));
    check(`${tag}: the results card holds numbers only (no determinacy or joint sentence; the deflection limit number stays, TE-B-500)`, !/determinate|supports|joint \d/.test(r.card) && /limit \d+(\.\d+)? mm/.test(r.card), r.card.replace(/\s+/g, ' ').slice(0, 200));
    check(`${tag}: text never overlaps text on the drawing (UI-D6)`, r.overlap.length === 0, r.overlap.slice(0, 4).join(' ; '));
    check(`${tag}: callouts and pile stay inside the drawing`, r.inside);
    check(`${tag}: the tables run to both edges and end in a double-rule break line each (UI-S1, UI-D2)`, r.brk.length === 2 && r.brk.every(k => k.lines === 2 && k.len > 40) && Math.abs(r.brk.find(k => k.side === 'left').x - r.vb[0]) < 6 && Math.abs(r.brk.find(k => k.side === 'right').x - (r.vb[0] + r.vb[2])) < 6, JSON.stringify([r.brk, r.vb]));
    if (vp.width === 1366) {
      await p.screenshot({ path: path.join(SHOTS, 'resdraw-1366.png') });
      // more panels = more wood = a bigger pile
      const before = r.pile.w;
      await p.evaluate(() => { const e = document.getElementById('panels'); e.value = 12; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
      await p.waitForTimeout(500);
      const r2 = await p.evaluate(probe);
      check('1366x900: more panels, more wood, a wider pile', r2.pile && r2.pile.n > r.pile.n && r2.pile.w >= before, `${r.pile.n}/${before} -> ${r2.pile && r2.pile.n}/${r2.pile && r2.pile.w}`);
      check('1366x900: still no text overlap with 12 panels', r2.overlap.length === 0, r2.overlap.slice(0, 4).join(' ; '));
    } else await p.screenshot({ path: path.join(SHOTS, 'resdraw-390.png') });
    if (vp.width >= 700) {
      // White Hat (TE-B-503): a theme picture is used only with a plain viewBox; anything else falls back to the built-in shape
      const pics = bad => p.evaluate(bad => { window.TrussDrawPics = { books: { viewBox: bad ? '0 0 10 10" onload="x' : '0 0 10 10', inner: '<rect width="10" height="10"/>' } }; document.getElementById('height').dispatchEvent(new Event('change', { bubbles: true })); const g = document.querySelector('#draw [data-pic="books"], #draw [data-book]'); return { pic: !!document.querySelector('#draw svg.te-drawpic'), builtin: !!document.querySelector('#draw [data-book]') }; }, bad);
      const ok = await pics(false); await p.waitForTimeout(300); const ok2 = await p.evaluate(() => ({ pic: !!document.querySelector('#draw svg.te-drawpic') }));
      const bad = await pics(true); await p.waitForTimeout(300); const bad2 = await p.evaluate(() => ({ pic: !!document.querySelector('#draw svg.te-drawpic'), builtin: !!document.querySelector('#draw [data-book]') }));
      check(`${tag}: a picture with a plain viewBox is used, one with a hostile viewBox falls back (WH-T4)`, ok2.pic && !bad2.pic && bad2.builtin, JSON.stringify({ ok2, bad2 }));
      await p.evaluate(() => { delete window.TrussDrawPics; });
    }
    check(`${tag}: no script errors`, p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
  // UI-D7 (#503, BPD-16): Home, the first view and a new bridge fit the drawing, its labels, the sweep legend and the three callouts into the
  // stage area the windows leave free in their default homes (Inputs on the left, the sweep bar at the bottom, the view control and the
  // Drawing icons on the right), 16 px margin; moving or folding a window never refits; nothing sits on the books or the pile; phone fits the stage.
  const fitProbe = () => {
    const svg = document.getElementById('draw'), bx = el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const win = id => { const e = document.querySelector(`#stage .s-pan[data-win="${id}"]`); return e && e.getBoundingClientRect().width > 0 ? bx(e) : null; };
    const pad = document.querySelector('#drawWrap .navpad'), dr = win('drawing');
    const ins = win('inputs'), sw = win('sweep');
    const free = { l: ins ? ins.r : 0, r: Math.min(pad ? bx(pad).l : innerWidth, dr ? dr.l : innerWidth), t: bx(svg).t, b: sw ? sw.t : innerHeight };
    const items = [...svg.querySelectorAll('[data-callout] rect')].map(e => ({ k: 'callout ' + e.parentNode.dataset.callout, ...bx(e) }))
      .concat([...svg.querySelectorAll('text[data-legend]')].map(e => ({ k: 'legend ' + e.dataset.legend, ...bx(e) })));
    const books = svg.querySelector('[data-pic="books"]'), pile = svg.querySelector('[data-pile]');
    const hit = (a, c) => a && c && Math.min(a.r, c.r) - Math.max(a.l, c.l) > 0.5 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 0.5;
    const obst = { books: books && bx(books), pile: pile && bx(pile), inputs: ins, sweep: sw };
    const bad = [];
    items.forEach(it => {
      if (it.l < free.l - 0.5 || it.r > free.r + 0.5 || it.t < free.t - 0.5 || it.b > free.b + 0.5) bad.push(`${it.k} outside the free area`);
      Object.entries(obst).forEach(([k, o]) => { if (hit(it, o)) bad.push(`${it.k} on the ${k}`); });
    });
    return { vb: svg.getAttribute('viewBox'), n: items.length, legend: items.filter(i => /^legend/.test(i.k)).length, bad, free: [free.l, free.t, free.r, free.b].map(Math.round) };
  };
  for (const vp of [{ width: 1366, height: 900 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    const tag = vp.width + 'x' + vp.height;
    const p = await openPage(b, srv.url, vp); await p.waitForTimeout(700);
    const r0 = await p.evaluate(fitProbe);
    check(`${tag}: first view: the 3 callouts and every sweep legend line sit in the free area, off the books, pile, Inputs and sweep bar (UI-D7)`, r0.n >= 3 && r0.legend >= 1 && r0.bad.length === 0, `${r0.n} items, ${r0.legend} legend · ${r0.bad.slice(0, 3).join('; ')} · free ${r0.free}`);
    // pan and zoom away, then Home: back to the same fitted box
    // the pad's own click handler (the Drawing window's icons sit over the + button at these sizes, a separate issue)
    const pad = d => p.evaluate(d => document.querySelector(`#drawWrap .navpad [data-d="${d}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })), d);
    await pad('right'); await pad('in'); await p.waitForTimeout(150);
    const moved = await p.evaluate(() => document.getElementById('draw').getAttribute('viewBox'));
    await pad('home'); await p.waitForTimeout(200);
    const r1 = await p.evaluate(fitProbe);
    check(`${tag}: after Home the drawing is fitted again, same box as the first view`, moved !== r0.vb && r1.vb === r0.vb && r1.bad.length === 0, `${r0.vb} -> ${moved} -> ${r1.vb} ${r1.bad.slice(0, 2).join('; ')}`);
    // folding a window (Inputs to its tab, the sweep bar to icons) never refits; only Home does
    await p.evaluate(() => { window.__shell.setState('inputs', 'T'); window.__shell.setState('sweep', 'I'); }); await p.waitForTimeout(400);
    const r2 = await p.evaluate(fitProbe);
    await pad('home'); await p.waitForTimeout(200);
    const r3 = await p.evaluate(fitProbe);
    check(`${tag}: folding Inputs and the sweep bar doesn't refit, and Home still uses the default homes`, r2.vb === r0.vb && r3.vb === r0.vb, `${r0.vb} / ${r2.vb} / ${r3.vb}`);
    await p.evaluate(() => { window.__shell.setState('inputs', 'W'); window.__shell.setState('sweep', 'W'); }); await p.waitForTimeout(300);
    if (vp.width === 1366) await p.screenshot({ path: path.join(SHOTS, 'homefit-1366.png') });
    check(`${tag}: no script errors (UI-D7)`, p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
  {
    const p = await openPage(b, srv.url, { width: 390, height: 844 }); await p.waitForTimeout(700);
    const r = await p.evaluate(() => { const s = document.getElementById('draw'), v = s.getAttribute('viewBox').split(/\s+/).map(Number); return { v, ar: s.getBoundingClientRect().width / s.getBoundingClientRect().height, x0: Math.min(...[...s.querySelectorAll('[data-break]')].map(g => +g.querySelector('line').getAttribute('x1'))) }; });
    // with a free area under 480 px the drawing's own box is the view (the whole stage): its left edge is the left table's break line
    check('390x844: the free area is under 480 px, so the drawing fits the whole stage (UI-D7)', Math.abs(r.v[0] - r.x0 + 1) < 1.5, JSON.stringify(r));
    await p.close();
  }
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} results-on-the-drawing checks passed`);
process.exit(fails.length ? 1 : 0);
