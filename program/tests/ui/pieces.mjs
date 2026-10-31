// The shared screen pieces (#354) in a real browser, on a bare page built only from TrussPieces (no app state).
// Checks the behaviour the Node test can't: Brian's render rule (UI-A3, #237), window states and peek, tabs and slider
// keys, pop-ups closing on an outside click, the focus ring, and that a built-in theme styles the pieces unchanged.
//   node tests/ui/pieces.mjs   (rule map: docs/pieces.md)
import { browser, checker, ROOT, SHOTS } from './harness.mjs';
import fs from 'fs';
import path from 'path';

const pieces = fs.readFileSync(path.join(ROOT, 'src', 'pieces.js'), 'utf8');
const notebook = fs.readFileSync(path.join(ROOT, 'themes', 'notebook-calc.css'), 'utf8');
const check = checker('pieces: ');
const b = await browser();

// One stage: a picture under four windows with their edge tabs, a results card with its pop-up, tabs, toggles and sliders.
async function stagePage(theme = 'wireframe', viewport = { width: 1440, height: 900 }) {
  const p = await b.newPage({ viewport });
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.setContent('<!doctype html><html><head><meta charset="utf-8"><style id="theme"></style></head><body style="margin:0"></body></html>');
  await p.addScriptTag({ content: pieces });
  await p.evaluate(([theme, css]) => {
    const P = window.TrussPieces; P.install(document);
    document.getElementById('theme').textContent = P.tokenCSS('wireframe') + (theme.startsWith('notebook') ? css : '');
    const st = document.createElement('div'); st.id = 'stage'; st.dataset.theme = theme;
    st.style.cssText = 'position:fixed;inset:0;overflow:hidden;background:var(--te-page);font-family:var(--te-font-ui);color:var(--te-ink)';
    const win = (id, title, home, state, body, icons) => P.windowHTML({ id, title, home, state, body, icons }) + P.edgeTabHTML({ id, title, home, state });
    st.innerHTML = '<div class="te-picture" id="pic"><svg width="100%" height="100%" aria-label="the bridge"><rect width="100%" height="100%" fill="none" stroke="#999" stroke-dasharray="4"/></svg></div>'
      + win('inputs', 'Inputs', 'left', 'W', P.sliderHTML({ key: 'h', label: 'Height h', unit: 'mm', min: 0, max: 140, step: 1, value: 80, from: 60, to: 100, rule: { hi: 100 }, wall: { lo: 20 } })
        + P.sliderHTML({ key: 'n', label: 'Panels', min: 2, max: 12, step: 1, value: 6 })
        + P.buttonHTML({ kind: 'chip', label: '⇄ sweep', pressed: true, id: 'chip' }), [{ ic: 'g0', label: 'Shape', icon: 'S' }, { ic: 'g1', label: 'Geometry', icon: 'G' }])
      + win('drawing', 'Drawing', 'right', 'I', P.toggleHTML({ label: 'Member forces', checked: false, id: 'tog' }), [{ ic: 'forces', label: 'Member forces', icon: 'F', on: false }])
      + win('view', 'View options', 'top', 'W', P.tabsHTML({ label: 'Analysis', idPrefix: 'an', selected: 'wood', tabs: [{ id: 'wood', label: 'Required wood' }, { id: 'hist', label: 'History' }, { id: 'win', label: 'Winners' }, { id: 'mem', label: 'Members' }] }))
      + win('sweep', 'Sweep', 'bottom', 'W', P.buttonHTML({ label: 'Run sweep', icon: '▶', id: 'run' }) + P.buttonHTML({ label: 'Disabled', disabled: true, id: 'dis' }))
      + '<div style="position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:80">' + P.resultsHTML({ id: 'res', verdict: 'fail', checks: [{ label: 'capacity', value: '3.9', op: '>=', limit: '5.0', unit: 'kg', ok: false }, { label: 'sag', value: '0.131', op: '<=', limit: '2', unit: 'mm', ok: true }] }) + '</div>'
      + '<div class="te-pop" id="pop" role="dialog" aria-label="Full results" hidden style="left:40%;top:56px">Every number <button type="button" id="inPop">inside</button></div>';
    document.body.appendChild(st);
    document.getElementById('win-inputs').style.top = '220px';   // the app's layout stacks Inputs under View options; here by hand
    window.W = {}; window.log = [];
    st.querySelectorAll('.s-pan').forEach(w => { window.W[w.dataset.win] = P.mountWindow(w, st.querySelector(`.tabE[data-tab="${w.dataset.win}"]`), { peekMs: 50, unpeekMs: 50, onState: (s, id) => log.push(id + ':' + s) }); });
    P.mountTabs(st.querySelector('[role="tablist"]'), { onSelect: id => log.push('tab:' + id) });
    P.mountToggle(document.getElementById('tog'), { onChange: v => log.push('tog:' + v) });
    P.mountToggle(document.getElementById('chip'));
    st.querySelectorAll('.te-slider').forEach(s => P.mountSlider(s, { onInput: e => log.push(`sl:${e.end}:${e.value}`) }));
    window.POP = P.popups(document);
    document.getElementById('res').addEventListener('click', ev => POP.open(document.getElementById('pop'), ev.currentTarget));
    document.getElementById('run').addEventListener('click', () => log.push('run clicked'));
  }, [theme, notebook]);
  return p;
}
const rect = (p, q) => p.evaluate(q => { const r = document.querySelector(q).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round).join(','); }, q);
const shown = (p, q) => p.evaluate(q => { const e = document.querySelector(q); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; }, q);
const attr = (p, q, a) => p.evaluate(([q, a]) => document.querySelector(q).getAttribute(a), [q, a]);

try {
  const p = await stagePage();
  // ---------- UI-A3 and Brian's render rule (#237): the picture always fills the stage; a window hides only its own box ----------
  const full = await rect(p, '#pic'), stageBox = await rect(p, '#stage');
  check('the picture fills the whole stage (UI-A3)', full === stageBox, `${full} vs ${stageBox}`);
  check('windows sit over the picture (z-order), not beside it', await p.evaluate(() => { const r = document.getElementById('win-inputs').getBoundingClientRect(); const e = document.elementFromPoint(r.left + 20, r.top + 60); return document.getElementById('win-inputs').contains(e); }));
  check('around a window the picture shows', await p.evaluate(() => document.getElementById('pic').contains(document.elementFromPoint(innerWidth / 2, innerHeight / 2))));
  const moves = [];
  for (const id of ['inputs', 'drawing', 'view', 'sweep']) for (const s of ['W', 'I', 'T', 'I', 'W']) { await p.evaluate(([id, s]) => W[id].setState(s), [id, s]); if (await rect(p, '#pic') !== full) moves.push(`${id}:${s}`); }
  await p.evaluate(() => W.inputs.setState('T')); await p.hover('.tabE[data-tab="inputs"]'); await p.waitForTimeout(150);
  if (await rect(p, '#pic') !== full) moves.push('peek');
  await p.click('#res'); if (await rect(p, '#pic') !== full) moves.push('pop-up');
  await p.keyboard.press('Escape');
  check('opening, shrinking, hiding, peeking every window and a pop-up never moves or resizes the picture (UI-A3, #237)', moves.length === 0, moves.join(' '));
  await p.evaluate(() => W.inputs.setState('W')); await p.mouse.move(700, 450);

  // ---------- window states (UI-A4) ----------
  await p.click('#win-inputs [data-step="shrink"]');
  check('‹ shrinks a window to icons: body hidden, icon toolbar shown', await attr(p, '#win-inputs', 'data-state') === 'I' && !(await shown(p, '#win-inputs .s-bd')) && await shown(p, '#win-inputs .s-icons button[aria-label="Shape"]'));
  check('in words, only ‹ shows; in icons, ‹ and › both show (UI-A4)', await p.evaluate(() => getComputedStyle(document.querySelector('#win-view [data-step="grow"]')).display === 'none') && await shown(p, '#win-inputs [data-step="grow"]'));
  check('the icons state is one 52 px column (UI-W15)', +(await rect(p, '#win-inputs')).split(',')[2] === 52, await rect(p, '#win-inputs'));
  await p.click('#win-inputs [data-step="shrink"]');
  check('‹ again leaves only the brown edge tab, and focus goes to it', !(await shown(p, '#win-inputs')) && await shown(p, '.tabE[data-tab="inputs"]') && await p.evaluate(() => document.activeElement.dataset.tab === 'inputs'));
  await p.hover('.tabE[data-tab="inputs"]'); await p.waitForTimeout(150);
  const tabBox = (await rect(p, '.tabE[data-tab="inputs"]')).split(',').map(Number), peekBox = (await rect(p, '#win-inputs')).split(',').map(Number);
  check('hovering the tab peeks at the window, without covering the tab (UI-W9)', await shown(p, '#win-inputs.peek') && peekBox[0] >= tabBox[0] + tabBox[2] - 1, `tab ${tabBox} peek ${peekBox}`);
  check('the peek sits 8 px beside its tab, lined up with the tab\'s top (UI-W17)', Math.abs(peekBox[0] - (tabBox[0] + tabBox[2] + 8)) <= 1 && Math.abs(peekBox[1] - tabBox[1]) <= 1, `tab ${tabBox} peek ${peekBox}`);
  check('the edge tab is 28 px thick (UI-W15)', tabBox[2] === 28, String(tabBox[2]));
  await p.click('#win-inputs .s-ph .wt');
  check('a click on the peek keeps it open (UI-W9)', await attr(p, '#win-inputs', 'data-state') === 'W' && !(await p.evaluate(() => document.getElementById('win-inputs').classList.contains('peek'))));
  check('after the peek is kept, the window goes back to its own home (top 220 px here)', (await rect(p, '#win-inputs')).split(',')[1] === '220', await rect(p, '#win-inputs'));
  await p.evaluate(() => W.sweep.setState('T')); await p.click('.tabE[data-tab="sweep"]');
  check('clicking an edge tab opens the window in words and moves focus into it', await attr(p, '#win-sweep', 'data-state') === 'W' && await p.evaluate(() => document.getElementById('win-sweep').contains(document.activeElement)));
  check('every change is reported to the caller (onState), so it can be saved per view (UI-A9)', await p.evaluate(() => log.includes('inputs:I') && log.includes('inputs:T') && log.includes('sweep:W')));
  check('the right-hand window folds toward its edge (› shrinks)', await p.textContent('#win-drawing [data-step="shrink"]') === '›');

  // ---------- buttons, toggle, focus (ART-S) ----------
  await p.click('#tog'); await p.mouse.move(700, 450); await p.waitForTimeout(250);
  check('a toggle flips aria-checked and .on together (ART-S6)', await attr(p, '#tog', 'aria-checked') === 'true' && await p.evaluate(() => document.getElementById('tog').classList.contains('on')));
  const st = await p.evaluate(() => { const g = id => getComputedStyle(document.getElementById(id)); return { on: g('tog').transform, off: g('run').transform, dis: [g('dis').opacity, g('dis').filter] }; });
  check('picked sits lower than unpicked: more than a colour change (ART-S3, ART-S6)', st.on !== st.off && /matrix\(1, 0, 0, 1, 0, 2\)/.test(st.on), `${st.on} vs ${st.off}`);
  check('disabled is 50 % and desaturated (ART-S4)', st.dis[0] === '0.5' && /saturate\(0\.3\)/.test(st.dis[1]), st.dis.join(' '));
  await p.focus('#run'); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab');
  const ring = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return [s.outlineStyle, s.outlineWidth, s.outlineOffset].join(' '); });
  check('keyboard focus shows a 3 px ring with a 3 px offset (ART-S5, UI-K4)', ring === 'solid 3px 3px', ring);
  await p.hover('#run'); await p.waitForTimeout(200);
  check('hover lifts a stick (ART-S2)', /matrix\(1, 0, 0, 1, -1, -2\)/.test(await p.evaluate(() => getComputedStyle(document.getElementById('run')).transform)));

  // ---------- tabs (UI-S6, UI-K3) ----------
  await p.click('#an-hist'); await p.keyboard.press('ArrowRight');
  check('arrow keys move to the next tab and pick it; one tab is in the Tab order', await attr(p, '#an-win', 'aria-selected') === 'true' && await p.evaluate(() => document.activeElement.id === 'an-win' && document.querySelectorAll('[role="tab"][tabindex="0"]').length === 1));
  await p.keyboard.press('End'); await p.keyboard.press('ArrowRight');
  check('arrows wrap round and Home/End go to the ends', await attr(p, '#an-wood', 'aria-selected') === 'true');

  // ---------- slider (UI-I1-I3, ART-W5) ----------
  const val = '[data-key="h"] .th[data-end="val"]';
  await p.focus(val); await p.keyboard.press('End');
  check('a course rule never clamps: h runs on to 140 and the slider is marked (UI-I2)', await attr(p, val, 'aria-valuenow') === '140' && await attr(p, '[data-key="h"]', 'data-over') === 'rule');
  await p.keyboard.press('Home');
  check('a model limit stops the value at the wall (UI-I3)', await attr(p, val, 'aria-valuenow') === '20' && await attr(p, '[data-key="h"]', 'data-wall') === 'lo' && await attr(p, '[data-key="h"]', 'data-over') === null);
  await p.focus('[data-key="h"] .th[data-end="from"]'); await p.keyboard.press('End');
  check('the sweep start can\'t pass the sweep end; the band follows (UI-I1)', await attr(p, '[data-key="h"] .th[data-end="from"]', 'aria-valuenow') === '100' && await p.evaluate(() => document.querySelector('[data-key="h"] .band').style.width === '0%'));
  const shapes = await p.evaluate(() => ['from', 'to', 'val'].map(e => { const s = getComputedStyle(document.querySelector(`[data-key="h"] .th[data-end="${e}"]`)); return [s.width, s.borderTopLeftRadius, s.borderTopRightRadius, s.borderLeftWidth, s.borderRightWidth, s.backgroundColor].join('/'); }));
  check('three different handle shapes: two range ends and the value (ART-W5)', new Set(shapes).size === 3, shapes.join(' | '));
  { const box = await p.evaluate(() => { const r = document.querySelector('[data-key="n"]').getBoundingClientRect(); const t = document.querySelector('[data-key="n"] .th.val').getBoundingClientRect(); return { x: t.left + t.width / 2, y: t.top + t.height / 2, right: r.right }; });
    await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.mouse.move(box.right + 40, box.y, { steps: 5 }); await p.mouse.up(); }
  check('dragging the handle moves the value, held at the axis end', await attr(p, '[data-key="n"] .th.val', 'aria-valuenow') === '12');

  // ---------- pop-ups (UI-W8) and the results card (UI-W2) ----------
  check('the results card names each check against its limit, with ✕ and words for a fail (UI-W2, UI-A17)', /3\.9 < 5\.0 kg ✕/.test(await p.textContent('#res')) && /✕ FAILS/.test(await p.textContent('#res')));
  await p.evaluate(() => log.length = 0);
  await p.click('#res');
  check('the card opens its full view as a pop-up (aria-expanded)', await shown(p, '#pop') && await attr(p, '#res', 'aria-expanded') === 'true');
  await p.click('#inPop');
  check('a click inside the pop-up keeps it open', await shown(p, '#pop'));
  await p.click('#run');
  check('an outside click closes the pop-up and does nothing else (UI-W8)', !(await shown(p, '#pop')) && await p.evaluate(() => !log.includes('run clicked')), await p.evaluate(() => log.join(',')));
  await p.click('#run');
  check('the next click works as normal', await p.evaluate(() => log.includes('run clicked')));
  await p.click('#res'); await p.keyboard.press('Escape');
  check('Esc closes the pop-up and returns focus to its opener (UI-W8)', !(await shown(p, '#pop')) && await p.evaluate(() => document.activeElement.id === 'res'));

  // ---------- the theme contract (UI-T1) ----------
  check('every piece carries data-part and a slot of bg, ctl or disp (UI-T1)', await p.evaluate(() => {
    const need = ['window', 'window-title', 'edge-tab', 'icon-button', 'button', 'chip', 'toggle', 'tabs', 'tab', 'slider', 'slider-band', 'results', 'badge', 'stepper'];
    return need.every(n => document.querySelector(`#stage [data-part="${n}"]`)) && [...document.querySelectorAll('#stage [data-slot]')].every(e => ['bg', 'ctl', 'disp'].includes(e.dataset.slot));
  }));
  check('the meaning colours come from the app, not the theme: the FAILS pill reads --bad (ART-K14, UI-A18)', await p.evaluate(() => { document.getElementById('stage').style.setProperty('--bad', 'rgb(1, 2, 3)'); return getComputedStyle(document.querySelector('.pill.bad')).color === 'rgb(1, 2, 3)'; }));
  await p.evaluate(() => document.getElementById('stage').style.removeProperty('--bad'));
  check('no page errors (Wireframe)', p.errs.length === 0, p.errs.join(' | '));
  await p.screenshot({ path: path.join(SHOTS, 'pieces-wireframe.png') });
  await p.close();

  // Notebook + Calculator applies to the pieces unchanged: same markup, its own look
  for (const th of ['notebook-calc', 'notebook-calc-calc']) {
    const q = await stagePage(th);
    const look = await q.evaluate(() => { const g = s => getComputedStyle(document.querySelector(s)); return { tog: g('#tog').backgroundImage, val: g('[data-key="h"] .th.val').backgroundImage, ph: g('#win-inputs .s-ph').fontSize, tab: g('.tabE').fontSize }; });
    check(`${th}: the theme's own rules style the pieces (stick, slider handle, window title)`, look.val !== 'none' && look.ph !== '13px', JSON.stringify(look).slice(0, 160));
    const full2 = await rect(q, '#pic'); await q.evaluate(() => { W.inputs.setState('T'); W.drawing.setState('W'); W.view.setState('I'); });
    check(`${th}: a theme never moves the picture (UI-T2, UI-A3)`, await rect(q, '#pic') === full2 && full2 === await rect(q, '#stage'));
    check(`${th}: no page errors`, q.errs.length === 0, q.errs.join(' | '));
    await q.evaluate(() => { W.inputs.setState('W'); W.view.setState('W'); });
    await q.screenshot({ path: path.join(SHOTS, `pieces-${th}.png`) });
    await q.close();
  }
} finally { await b.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`${check.results.length - bad.length}/${check.results.length} pieces checks pass`);
process.exit(bad.length ? 1 : 0);
