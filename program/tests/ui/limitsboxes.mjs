// The Inputs pane's number rows on the limits table, ahead of step 8 (TrussLimitRows, TE-B-494; UI-I2, UI-I3, UI-I10).
// Off by default; ?limits=1 turns it on. The app's own boxes stay (hidden) and keep their handlers.
//   node tests/ui/limitsboxes.mjs
import { serve, browser, openPage, checker } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('limitsboxes: ');
const paneIds = p => p.evaluate(() => [...document.querySelectorAll('#inputsPane input, #inputsPane select')].filter(e => !e.closest('.te-num')).map(e => e.id + ':' + e.type).join(','));

try {
  // without the flag: nothing changes in the pane
  const off = await openPage(b, srv.url, { width: 1366, height: 900 });
  const idsOff = await paneIds(off);
  const o = await off.evaluate(() => ({ flag: window.TE_FLAGS && window.TE_FLAGS.limitsBoxes, boxes: document.querySelectorAll('#inputsPane .te-num').length, hidden: document.getElementById('height').hidden }));
  check('without ?limits=1: the flag is off, no new boxes, the app\'s boxes are as they were', o.flag === false && o.boxes === 0 && o.hidden === false, JSON.stringify(o));
  await off.close();

  const p = await openPage(b, srv.url + '?limits=1', { width: 1366, height: 900 });
  await p.evaluate(() => document.querySelectorAll('#inputsPane details').forEach(d => { d.open = true; }));
  const idsOn = await paneIds(p);
  check('with it: the app\'s own inputs are all still there, same ids and types', idsOn === idsOff, idsOn.length + ' vs ' + idsOff.length);
  const m = await p.evaluate(() => ({ n: document.querySelectorAll('#inputsPane .te-num[data-for]').length, h: !!document.getElementById('height-tb'), src: document.getElementById('height').hidden, v: document.getElementById('height-tb').value, app: document.getElementById('height').value }));
  check('each limits row gets a TrussInputs box; the app\'s box is hidden and shows the same value', m.n >= 20 && m.h && m.src && m.v === m.app && m.v !== '', JSON.stringify(m));
  const st = id => p.evaluate(id => { const el = document.querySelector(`.te-num[data-for="${id}"]`), n = el.querySelector('.te-num-n'); return { v: el.querySelector('input').value, state: el.dataset.state || '', note: n.hidden ? '' : n.textContent, app: document.getElementById(id).value }; }, id);

  // a model limit: refused, the ⟂ note says why, Enter goes back (UI-I3)
  await p.fill('#height-tb', '80'); await p.press('#height-tb', 'Enter');
  let s = await st('height');
  check('a good value reaches the app\'s own box (and its slider)', s.app === '80' && await p.inputValue('#heightR') === '80', JSON.stringify(s));
  await p.fill('#height-tb', '201');
  s = await st('height');
  check('typing 201: the ⟂ note from the limits table at once', s.state === 'limit' && /^⟂ Height must be 10 to 200 mm/.test(s.note), JSON.stringify(s));
  await p.press('#height-tb', 'Enter'); s = await st('height');
  check('Enter refuses it: back to 80, the app never saw 201', s.v === '80' && s.app === '80' && s.state === 'limit', JSON.stringify(s));

  // the Undo toast of #482 comes from the app's box's change event
  await p.fill('#height-tb', '75'); await p.press('#height-tb', 'Enter');
  const toast = await p.waitForFunction(() => [...document.querySelectorAll('.te-toast, [data-part="toast"]')].map(t => t.textContent).find(t => /Changed .*80 → 75/.test(t)), null, { timeout: 3000 }).then(h => h.jsonValue()).catch(() => '');
  check('a change in the new box gives the Undo toast (#482)', !!toast, toast);
  if (toast) {
    await p.locator('.te-toast button, [data-part="toast"] button').filter({ hasText: 'Undo' }).last().click();
    s = await st('height');
    check('Undo puts 80 back, and the new box follows the app', s.v === '80' && s.app === '80', JSON.stringify(s));
  }

  // the slider writes the app's box: the new box follows
  await p.evaluate(() => { const r = document.getElementById('heightR'); r.value = '66'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  s = await st('height');
  check('moving the slider: the new box follows', s.v === '66' && s.app === '66', JSON.stringify(s));

  // a course rule (UI-I2): allowed, committed, pink edge, the rule named
  await p.fill('#width-tb', '90'); await p.press('#width-tb', 'Enter'); s = await st('width');
  check('width 90: committed, marked as a course rule', s.app === '90' && s.state === 'rule' && /Course rule/.test(s.note), JSON.stringify(s));
  // compare with the real pink, not a var(--rule) probe (a probe resolves to ink when --rule is missing: Graphics #519 MUST 2)
  const edge = id => p.evaluate(id => { const cs = getComputedStyle(document.getElementById(id)), t = document.createElement('span'); t.style.color = 'var(--te-ink)'; document.getElementById(id).parentElement.appendChild(t); const ink = getComputedStyle(t).color; t.remove(); return { color: cs.borderTopColor, width: cs.borderTopWidth, text: cs.color, ink }; }, id);
  let look = await edge('width-tb');
  check('its edge is a 2 px pink rgb(200, 40, 140) and its number stays ink (Graphics TE-B-443, #519)', look.color === 'rgb(200, 40, 140)' && look.width === '2px' && look.text === look.ink, JSON.stringify(look));
  await p.fill('#width-tb', '60'); await p.press('#width-tb', 'Enter');

  // the height course rule (UIE-9, TE-B-577b): on the OUTER height, like the result's 100 mm line (Math TE-B-577),
  // so the box and the results switch at the same number
  const out = () => p.evaluate(() => { const r = __dbg.res; return { top: r.size.outer.height, flag: r.envelope.some(t => /over the 100 mm limit/.test(t)) }; });
  await p.fill('#height-tb', '101'); await p.press('#height-tb', 'Enter'); s = await st('height');
  let e = await out();
  check('height 101: committed, pink, the course-rule note names the outer height the result uses', s.app === '101' && s.state === 'rule' && e.flag
    && s.note.includes(`Course rule: the bridge height is at most 100 mm (this one is ${e.top.toFixed(1)} mm to its top face).`), JSON.stringify([s, e]));
  look = await edge('height-tb');
  check('height 101: its edge is a 2 px pink rgb(200, 40, 140), number in ink (UI-I2, #519)', look.color === 'rgb(200, 40, 140)' && look.width === '2px' && look.text === look.ink, JSON.stringify(look));
  const under = Math.floor(100 - (e.top - 101)) - 1;   // a height whose outer face is under 100 mm
  await p.fill('#height-tb', String(under)); await p.press('#height-tb', 'Enter'); s = await st('height'); e = await out();
  check(`height ${under} (outer under 100): committed, no mark, and no 100 mm line in the result`, s.app === String(under) && s.state === '' && s.note === '' && e.top <= 100 && !e.flag, JSON.stringify([s, e]));
  await p.fill('#height-tb', '100'); await p.press('#height-tb', 'Enter'); s = await st('height'); e = await out();
  check('height 100 (outer over 100): pink exactly when the result flags it', s.app === '100' && (s.state === 'rule') === e.flag && e.flag === e.top > 100, JSON.stringify([s, e]));
  await p.fill('#height-tb', '201'); s = await st('height');
  check('height 201 is still refused by the table', s.state === 'limit' && /^⟂ Height must be 10 to 200 mm/.test(s.note), JSON.stringify(s));
  await p.press('#height-tb', 'Enter');
  // the outer height also moves with topEnd (and curve), so the height box is checked again when they move (TE-B-619):
  // at h 95.4 with a parabola top, topEnd 10 puts the top face over 100 mm and -20 under it; the mark follows the result's line
  const pinkIsFlag = (s, e) => s.app === '95.4' && (s.state === 'rule') === e.flag;
  await p.evaluate(() => document.querySelector('#topShape button[data-v="parabola"]').click()); await p.waitForSelector('#topEnd-tb', { state: 'visible' });
  await p.fill('#topEnd-tb', '10'); await p.press('#topEnd-tb', 'Enter');
  await p.fill('#height-tb', '95.4'); await p.press('#height-tb', 'Enter'); s = await st('height'); e = await out();
  check('h 95.4, parabola top, topEnd 10: over 100 mm, pink and flagged', pinkIsFlag(s, e) && e.flag, JSON.stringify([s, e]));
  await p.fill('#topEnd-tb', '-20'); await p.press('#topEnd-tb', 'Enter'); s = await st('height'); e = await out();
  check('topEnd to -20 in its box: the top face drops under 100 mm, the height mark goes with the result\'s line', pinkIsFlag(s, e) && !e.flag && s.note === '', JSON.stringify([s, e]));
  await p.evaluate(() => { const r = document.getElementById('topEndR'); r.value = '10'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
  s = await st('height'); e = await out();
  check('topEnd back to 10 on its slider: pink again, with the new outer height in the note', pinkIsFlag(s, e) && e.flag && s.note.includes(`(this one is ${e.top.toFixed(1)} mm`), JSON.stringify([s, e]));
  await p.evaluate(() => document.querySelector('#topShape button[data-v="flat"]').click());
  await p.fill('#height-tb', '80'); await p.press('#height-tb', 'Enter');

  // a row that depends on height is checked again when height moves (Math TE-B-444)
  await p.fill('#height-tb', '80'); await p.press('#height-tb', 'Enter');
  await p.fill('#botEnd-tb', '50'); await p.press('#botEnd-tb', 'Enter');
  s = await st('botEnd');
  check('botEnd 50 under h 80 is fine', s.app === '50' && s.state !== 'limit', JSON.stringify(s));
  await p.fill('#height-tb', '55'); await p.press('#height-tb', 'Enter');
  s = await st('botEnd');
  check('h down to 55: botEnd is checked again and shows the limit (max h − 10)', s.state === 'limit' && /Bottom chord end/.test(s.note), JSON.stringify(s));
  await p.fill('#height-tb', '80'); await p.press('#height-tb', 'Enter');
  s = await st('botEnd');
  check('h back to 80: the note goes away again', s.state !== 'limit', JSON.stringify(s));

  // braceDepth isn't checked while the table is 0 thick (TE-B-445)
  await p.fill('#tableThick-tb', '0'); await p.press('#tableThick-tb', 'Enter');
  s = await st('braceDepth');
  check('table thickness 0: braceDepth shows no limit', s.state !== 'limit', JSON.stringify(s));

  // keyboard: the hidden app boxes take no Tab stop
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#inputsPane .te-num[data-for]')].every(el => { const src = document.getElementById(el.dataset.for); return src.tabIndex === -1 && src.hidden; }));
  check('the hidden app boxes are out of the Tab order', tabs);
  check('no page errors', p.errs.length === 0, p.errs.join(' | '));
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`${check.results.length - bad.length}/${check.results.length} limits boxes checks pass`);
process.exit(bad.length ? 1 : 0);
