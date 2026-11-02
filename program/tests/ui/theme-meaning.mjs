// No theme changes the meaning colours or moves anything (UI-A18, UI-T2, ART-K14; #197, #221). Board TE-B-237.
// With Wireframe, read the colour of every member line in #draw (.mem, by data-k), the pass/fail marks, and
// swatches of the meaning colours drawn inside the drawing; then pick every other theme in #themeSel and check each
// colour is IDENTICAL, and that no member or joint moved. OG is exempt (UI-A18, ART-K15).
// A theme that fails is reported KNOWN (themes/ belongs to Graphics; the Architecture Lead files the issue).
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';

const KNOWN = 'TE-B-237: theme changes meaning, issue to file for Graphics';
const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();

// Everything the theme must not change, read from the page as computed values.
const snapshot = p => p.evaluate(() => {
  const draw = document.getElementById('draw'), cs = e => getComputedStyle(e);
  const moved = e => { const s = cs(e); return [s.transform, s.translate, s.rotate, s.scale].filter(v => v && v !== 'none').join(' '); };
  const mem = {}, pos = {}, joints = [];
  draw.querySelectorAll('line.mem').forEach(l => {
    mem[l.dataset.k] = cs(l).stroke;
    pos[l.dataset.k] = ['x1', 'y1', 'x2', 'y2'].map(a => l.getAttribute(a)).join(',') + (moved(l) ? ' moved:' + moved(l) : '');
  });
  draw.querySelectorAll('circle').forEach(c => joints.push(c.getAttribute('cx') + ',' + c.getAttribute('cy') + (moved(c) ? ' moved:' + moved(c) : '')));
  // fail halos (red under a failing member) and the pass/fail marks on the drawing's results overlay
  const halos = [...draw.querySelectorAll('line:not(.mem)')].filter(l => l.getAttribute('stroke') === 'var(--bad)').map(l => cs(l).stroke);
  const marks = [...document.querySelectorAll('#resOv:not([hidden]) .tc b, #resOv:not([hidden]) .bc b')].map(e => e.parentElement.className + ' ' + cs(e).color);
  // swatches: one element per meaning colour, inside the drawing, so pass and fail are both covered whatever the design
  const host = document.getElementById('drawWrap') || draw.parentElement, sw = {};
  for (const v of ['comp', 'tens', 'zero', 'ok', 'bad']) {
    const d = document.createElement('span'); d.style.color = `var(--${v})`; d.style.borderTop = `1px solid var(--${v})`; host.appendChild(d);
    sw[v] = cs(d).color; d.remove();
  }
  return { mem, pos, joints, halos, marks, sw, vb: draw.getAttribute('viewBox'), svg: moved(draw), theme: document.getElementById('stage').dataset.theme };
});
const pick = (p, id) => p.evaluate(id => { const s = document.getElementById('themeSel'); s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); }, id);
const settle = async p => { await p.waitForTimeout(400); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
const diff = (a, b) => Object.keys(Object.assign({}, a, b)).filter(k => a[k] !== b[k]);

try {
  const p = await openPage(b, srv.url); await waitRows(p);
  await p.waitForFunction(() => document.querySelector('#draw line.mem') && document.getElementById('themeSel'));
  // turn on "Results on the drawing" so the capacity and deflection pass/fail marks are on screen
  await p.evaluate(() => { const c = document.getElementById('resOnDraw'); if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } });
  await pick(p, 'wireframe'); await settle(p);
  const base = await snapshot(p);
  const nMem = Object.keys(base.mem).length;
  check('Wireframe: member lines and meaning colours read from the drawing', base.theme === 'wireframe' && nMem > 0 && Object.values(base.sw).every(Boolean),
    `${nMem} members, ${base.joints.length} joints, ${base.marks.length} marks, ${base.halos.length} fail halos`);
  check('the pass/fail marks are on the drawing (capacity and deflection)', base.marks.length === 2, base.marks.join(' | '));
  check('the meaning colours are five different colours', new Set(Object.values(base.sw)).size === 5, JSON.stringify(base.sw));

  const themes = await p.$$eval('#themeSel option', o => o.map(x => x.value));
  check('there are other themes to check', themes.filter(t => t !== 'wireframe' && t !== 'og').length > 0, themes.join(', '));
  for (const t of themes) {
    if (t === 'wireframe') continue;
    if (t === 'og') { console.log('OG exempt (UI-A18, ART-K15)'); continue; }
    await pick(p, t); await settle(p);
    const s = await snapshot(p);
    if (s.theme !== t) { check(`theme ${t}: applied`, false, 'stage shows ' + s.theme); continue; }
    const memD = diff(base.mem, s.mem), swD = diff(base.sw, s.sw);
    check(`theme ${t}: every member line keeps its meaning colour`, memD.length === 0,
      memD.length ? memD.slice(0, 4).map(k => `member ${k} ${base.mem[k]} -> ${s.mem[k]}`).join('; ') : `${nMem} members`, KNOWN);
    check(`theme ${t}: C, T, zero, pass and fail colours are unchanged`, swD.length === 0,
      swD.map(k => `${k} ${base.sw[k]} -> ${s.sw[k]}`).join('; '), KNOWN);
    check(`theme ${t}: pass/fail marks and fail halos are unchanged`, JSON.stringify(s.marks) === JSON.stringify(base.marks) && JSON.stringify(s.halos) === JSON.stringify(base.halos),
      `${s.marks.join(' | ')}`, KNOWN);
    const posD = diff(base.pos, s.pos);
    check(`theme ${t}: no member or joint moves (UI-T2)`, posD.length === 0 && JSON.stringify(s.joints) === JSON.stringify(base.joints) && s.vb === base.vb && s.svg === base.svg,
      posD.length ? posD.slice(0, 3).map(k => `member ${k}: ${base.pos[k]} -> ${s.pos[k]}`).join('; ') : s.svg ? 'drawing moved: ' + s.svg : s.vb !== base.vb ? `viewBox ${base.vb} -> ${s.vb}` : '', KNOWN);
  }
  await pick(p, 'wireframe'); await settle(p);
  check('back to Wireframe: the same colours as at the start', JSON.stringify((await snapshot(p)).mem) === JSON.stringify(base.mem));
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} theme-meaning checks passed`);
process.exit(fails.length ? 1 : 0);
