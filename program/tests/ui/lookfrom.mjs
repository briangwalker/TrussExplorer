// Step 7 (#214, TE-B-384, BPD-11): Look from Side / Top / End on the 3D view cube (UI-V7, UI-S2, UI-W19, UI-A18).
// For the default 3D bridge: Top draws both bracing planes and End draws each cross-frame, and the members drawn are
// the 3D model's own members in those planes (m3), in the meaning colours of the 3D results (r3). Switching Top / End /
// 3D leaves no pop-up open (#408's pattern), axe finds nothing critical or serious in the control or the view, and the
// control is on screen and clickable at 1366x900 and 390x844.
import { createRequire } from 'module';
import fs from 'fs';
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';
const require = createRequire(import.meta.url);
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
const sw = (p, d) => p.evaluate(d => { const x = document.querySelector(`[data-sw="t:${d}"]`); if (x) x.click(); return !!x; }, d);
const state = p => p.evaluate(() => ({
  look: __dbg.v3.look, list: !document.getElementById('lookList').hidden, expanded: document.getElementById('lookBtn').getAttribute('aria-expanded'),
  flat: !document.getElementById('lookView').hidden, ctl: !document.getElementById('lookFrom').hidden, pop: !document.getElementById('dimPop').hidden,
  chips: document.getElementById('lookChips').hidden ? 0 : document.querySelectorAll('#lookChips [data-chip]').length }));
// the members drawn, and what the model says should be there (worked out here from the model, not from the app's list)
const drawn = p => p.evaluate(() => [...document.querySelectorAll('#lookSvg line[data-k3]')].map(l => +l.dataset.k3).sort((a, c) => a - c));
const modelTop = p => p.evaluate(() => { const m3 = __dbg.m3; return m3.elems.map((e, k) => [e, k])
  .filter(([e]) => (e.side === 'cross' && (e.plane === 'top' || e.plane === 'bottom')) || (e.side !== 'cross' && (e.type === 'top' || e.type === 'bot'))).map(([, k]) => k); });
const modelFrame = (p, i) => p.evaluate(i => { const m3 = __dbg.m3, fr = m3.frames[i], at = n => Math.abs(m3.nodes[n][0] - fr.x) < 1.5;
  return m3.elems.map((e, k) => [e, k]).filter(([e]) => at(e.i) && at(e.j)).map(([, k]) => k); }, i);
const colours = p => p.evaluate(() => { const r3 = __dbg.r3, bad = [];
  document.querySelectorAll('#lookSvg line[data-k3]').forEach(l => { const m = r3.members[+l.dataset.k3];
    const want = m.fails ? 'var(--bad)' : Math.abs(m.F) < 0.005 ? 'var(--zero)' : m.F < 0 ? 'var(--comp)' : 'var(--tens)';
    if (l.getAttribute('stroke') !== want) bad.push(`${l.dataset.k3}:${l.getAttribute('stroke')}≠${want}`); });
  return bad; });
const pick = async (p, look) => { await p.hover('#lookBtn'); await p.waitForTimeout(120); await p.click(`#lookList [data-look="${look}"]`); await p.waitForTimeout(450); await p.mouse.move(700, 600); await p.waitForTimeout(150); };
const clickable = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return 'missing'; const r = e.getBoundingClientRect();
  if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight || !r.width) return `off screen ${JSON.stringify(r)}`;
  const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t && e.contains(t) ? 'ok' : `covered by ${t && (t.id || t.className)}`; }, sel);
const same = (a, c) => a.length === c.length && a.every((x, i) => x === c[i]);
try {
  for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    const tag = `${vp.width}x${vp.height}`;
    const p = await openPage(b, srv.url, vp); await waitRows(p);
    await sw(p, 2); await p.waitForTimeout(300);
    check(`${tag} Truss 2D: no Look from (it is a 3D view control, UI-V1)`, !(await state(p)).ctl);
    check(`${tag} the 3D switch is in the top bar`, await sw(p, 3)); await p.waitForTimeout(700);
    const s0 = await state(p);
    check(`${tag} Truss 3D: Look from is shown, closed, and the view is the free 3D view`, s0.ctl && !s0.list && s0.expanded === 'false' && !s0.look && !s0.flat, JSON.stringify(s0));
    const cl = await clickable(p, '#lookBtn');
    check(`${tag} Look from is on screen and nothing covers it`, cl === 'ok', cl);
    if (vp.width === 390) { check('no script errors (phone)', p.errs.length === 0, p.errs.slice(0, 2).join(' | ')); await p.close(); continue; }
    // hover opens Side / Top / End under the button (UI-V7); every item is reachable
    await p.hover('#lookBtn'); await p.waitForTimeout(150);
    const s1 = await state(p);
    check('hovering Look from opens Side / Top / End', s1.list && s1.expanded === 'true', JSON.stringify(s1));
    for (const id of ['side', 'top', 'end']) { const c = await clickable(p, `#lookList [data-look="${id}"]`); check(`the ${id} item is on screen and clickable`, c === 'ok', c); }
    const under = await p.evaluate(() => { const a = document.getElementById('lookBtn').getBoundingClientRect(), l = document.getElementById('lookList').getBoundingClientRect(); return l.top >= a.bottom - 1; });
    check('the list opens downward, under the button', under);
    // Top: both bracing planes, the model's members, meaning colours
    await pick(p, 'top');
    const s2 = await state(p);
    check('Top: the flat view shows, the list closes, the plane chips show', s2.look === 'top' && s2.flat && !s2.list && s2.chips === 3, JSON.stringify(s2));
    const dT = await drawn(p), mT = await modelTop(p);
    check('Top: the members drawn are the model\'s top and bottom planes (chords and lateral bracing)', same(dT, mT), `drawn ${dT.length}, model ${mT.length}`);
    const planes = await p.evaluate(ks => { const m3 = __dbg.m3; return { top: ks.filter(k => m3.elems[k].plane === 'top').length, bottom: ks.filter(k => m3.elems[k].plane === 'bottom').length }; }, dT);
    check('Top shows BOTH bracing planes (lateral bracing of the top and of the bottom plane)', planes.top > 0 && planes.bottom > 0, JSON.stringify(planes));
    const cT = await colours(p);
    check('Top: every member in its meaning colour from the 3D results (UI-A18)', cT.length === 0, cT.slice(0, 4).join(' '));
    await p.click('#lookChips [data-chip="top"]'); await p.waitForTimeout(200);
    const onlyTop = await p.evaluate(() => { const m3 = __dbg.m3; return [...document.querySelectorAll('#lookSvg line[data-k3]')].every(l => { const e = m3.elems[+l.dataset.k3]; return e.side === 'cross' ? e.plane === 'top' : e.type === 'top'; }); });
    check('Top › Top plane chip: only the top plane is drawn', onlyTop);
    await p.click('#lookChips [data-chip="both"]'); await p.waitForTimeout(200);
    const key = await p.evaluate(() => document.getElementById('lookKey').textContent);
    check('the view has its key in words (compression, tension, zero force)', /compression/.test(key) && /tension/.test(key) && /zero force/.test(key), key);
    // End: each frame with its key; the members drawn are the model's members at that station
    await pick(p, 'end');
    const s3 = await state(p), nF = await p.evaluate(() => __dbg.m3.frames.length);
    check('End: one chip per cross-frame', s3.look === 'end' && s3.flat && s3.chips === nF && nF > 0, JSON.stringify({ ...s3, nF }));
    const badF = [];
    for (let i = 0; i < nF; i++) {
      await p.click(`#lookChips [data-chip="${i}"]`); await p.waitForTimeout(200);
      const d = await drawn(p), m = await modelFrame(p, i), c = await colours(p), t = await p.evaluate(() => document.getElementById('lookSvg').querySelector('title').textContent);
      if (!same(d, m) || c.length || !new RegExp(`frame ${i + 1} of ${nF}`).test(t)) badF.push(`frame ${i + 1}: drawn ${d} model ${m} colours ${c.slice(0, 2)} title "${t}"`);
    }
    check('End: every frame draws exactly the model\'s members at its station, in meaning colours, named in its title', badF.length === 0, badF.slice(0, 2).join(' | '));
    const sel = await p.evaluate(() => __dbg.S.d3.sec);
    check('the frame picked in End is the 3D model\'s chosen station', sel === nF - 1, String(sel));
    // axe on the control and the view
    await p.hover('#lookBtn'); await p.waitForTimeout(150);
    await p.addScriptTag({ content: axeSrc });
    const ax = await p.evaluate(async () => { const r = await axe.run({ include: [['#lookFrom'], ['#lookView']] }); return r.violations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => `${v.id}: ${v.nodes.length}`); });
    check('axe: no critical or serious findings in Look from and the Top/End view', ax.length === 0, ax.join(' | '));
    await p.mouse.move(700, 600); await p.waitForTimeout(150);
    // clicking the active view again returns to 3D (UI-V7)
    await pick(p, 'end');
    const s4 = await state(p);
    check('clicking the active view (End) again returns to the 3D view', !s4.look && !s4.flat && !s4.list && s4.chips === 0, JSON.stringify(s4));
    // Side: the front straight on, still the 3D picture
    await pick(p, 'side'); await p.waitForTimeout(300);
    const sd = await p.evaluate(() => ({ look: __dbg.v3.look, yaw: __dbg.v3.yaw, pitch: __dbg.v3.pitch, flat: !document.getElementById('lookView').hidden }));
    check('Side: the 3D bridge from the front, straight on', sd.look === 'side' && !sd.flat && Math.abs(sd.yaw) < 1e-6 && Math.abs(sd.pitch) < 1e-6, JSON.stringify(sd));
    // #408's pattern: Top -> End -> the cube, and Top -> 2D, leave nothing open
    await pick(p, 'top'); await pick(p, 'end');
    await p.evaluate(() => { const f = document.querySelector('#c3d').parentElement.querySelector('.navcube .face'); f.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await p.waitForTimeout(400);
    const s5 = await state(p);
    check('a click on the cube leaves Top/End: back in 3D, no list, no chips, no pop-up', !s5.look && !s5.flat && !s5.list && s5.chips === 0 && !s5.pop, JSON.stringify(s5));
    await pick(p, 'top'); await sw(p, 2); await p.waitForTimeout(500);
    const s6 = await state(p);
    check('Top then the 2D switch: no Look from, no flat view, no pop-up left open', !s6.ctl && !s6.flat && !s6.list && !s6.pop && !s6.look, JSON.stringify(s6));
    await sw(p, 3); await p.waitForTimeout(600);
    const s7 = await state(p);
    check('back in 3D: the free 3D view, not the old Top', s7.ctl && !s7.flat && !s7.look, JSON.stringify(s7));
    // keyboard: focus opens the list, Enter picks, Esc closes and gives focus back
    await p.mouse.move(700, 600); await p.focus('#lookBtn'); await p.waitForTimeout(100);
    const k1 = await state(p);
    check('keyboard: focusing Look from opens its list', k1.list && k1.expanded === 'true', JSON.stringify(k1));
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    const fTop = await p.evaluate(() => document.activeElement && document.activeElement.dataset.look);
    await p.keyboard.press('Enter'); await p.waitForTimeout(400);
    check('keyboard: Tab, Tab, Enter picks Top', fTop === 'top' && (await state(p)).look === 'top', String(fTop));
    await p.focus('#lookBtn'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    const k2 = await state(p), fb = await p.evaluate(() => document.activeElement && document.activeElement.id);
    check('keyboard: Esc closes the list and focus stays on Look from', !k2.list && k2.expanded === 'false' && fb === 'lookBtn', JSON.stringify({ ...k2, fb }));
    await p.screenshot({ path: 'tests/shots/lookfrom-top-1366.png' });
    check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} Look from checks passed`);
process.exit(fails.length ? 1 : 0);
