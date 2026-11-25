// Number boxes and steppers (TrussInputs) on the real built page (UI-I2, UI-I3, UI-I9, UI-I10).
// A stand-in check plays the limits table: height 10-100 (a limit: refused), above 95 a course rule (allowed, pink),
// below 20 a warning. When src/limits.js is in the build (RMA-4, #462), one more check runs against the real table.
//   node tests/ui/inputs.mjs
import { serve, browser, openPage, checker } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('inputs: ');

try {
  const p = await openPage(b, srv.url, { width: 1366, height: 900 });
  await p.evaluate(() => {
    const P = window.TrussPieces, I = window.TrussInputs;
    P.install(document); I.install(document);
    const host = document.createElement('div'); host.id = 'inTest'; host.setAttribute('data-pc', '');
    host.style.cssText = 'position:absolute;left:24px;top:24px;z-index:500;padding:12px;background:var(--te-surface)';
    host.innerHTML = I.numberHTML(P, { id: 'tH', label: 'Height h', unit: 'mm', value: 70 }) + ' <button id="away" type="button">away</button>';
    document.getElementById('stage').appendChild(host);
    window.commits = [];
    const chk = v => v < 10 || v > 100 ? { kind: 'limit', msg: 'Height must be 10-100 mm.' } : v > 95 ? { kind: 'rule', msg: 'Over the course rule h ≤ 95 mm.' } : v < 20 ? { kind: 'warn', msg: 'Low height: members get short.' } : null;
    window.box = I.mountNumber(host.querySelector('.te-num'), { check: chk, step: 5, value: 70, onCommit: v => commits.push(v) });
  });
  const st = () => p.evaluate(() => { const el = document.querySelector('#inTest .te-num'), n = el.querySelector('.te-num-n'); return { v: el.querySelector('input').value, state: el.dataset.state || '', note: n.hidden ? '' : n.textContent, inv: el.querySelector('input').getAttribute('aria-invalid'), good: box.value, commits: commits.join(',') }; });
  // typing a value past the limit: said at once, refused on Enter, back to the last good value (UI-I3, UI-I10)
  await p.fill('#tH', '120');
  let s = await st();
  check('typing past a limit: the ⟂ note says why at once, the box is marked invalid', s.state === 'limit' && /^⟂ Height must be 10-100 mm\.$/.test(s.note) && s.inv === 'true', JSON.stringify(s));
  await p.press('#tH', 'Enter'); s = await st();
  check('Enter refuses it: back to the last good value, nothing committed, the note stays', s.v === '70' && s.good === 70 && s.commits === '' && s.state === 'limit', JSON.stringify(s));
  // a good value commits
  await p.fill('#tH', '80'); await p.press('#tH', 'Enter'); s = await st();
  check('a good value commits and the note clears', s.v === '80' && s.commits === '80' && s.state === '' && s.note === '', JSON.stringify(s));
  // past a course rule: allowed, pink, the note names the rule (UI-I2, never clamped)
  await p.fill('#tH', '98'); await p.click('#away'); s = await st();
  check('past a course rule: committed on leaving the box, pink, the rule named (UI-I2)', s.commits === '80,98' && s.state === 'rule' && /course rule/.test(s.note), JSON.stringify(s));
  const pink = await p.evaluate(() => { const i = document.getElementById('tH'), cs = getComputedStyle(i), t = document.createElement('span'); t.style.color = 'var(--te-ink)'; document.getElementById('inTest').appendChild(t); const ink = getComputedStyle(t).color; t.remove(); return { edge: cs.borderTopColor === 'rgb(200, 40, 140)' && cs.borderTopWidth === '2px', text: cs.color === ink, got: cs.borderTopColor + ' ' + cs.borderTopWidth }; });
  check('the box\'s edge is 2 px course-rule pink rgb(200, 40, 140) (--rule or its ART-K16 fallback, #519) and the number stays ink (UI-A18, ART-C1, Graphics TE-B-443)', pink.edge && pink.text, JSON.stringify(pink));
  // steppers and arrows: by the step, and they STOP at the wall
  await p.fill('#tH', '90'); await p.press('#tH', 'Enter');
  await p.click('#inTest .te-step[data-dir="1"]'); await p.click('#inTest .te-step[data-dir="1"]'); await p.click('#inTest .te-step[data-dir="1"]');
  s = await st();
  check('+ steps by 5 and stops at the wall: 90 -> 95 -> 100, then refused with the note (UI-I3)', s.v === '100' && s.good === 100 && s.state === 'limit' && /10-100/.test(s.note), JSON.stringify(s));
  await p.focus('#tH'); await p.keyboard.press('Shift+ArrowDown'); s = await st();
  check('Shift+↓ goes 10 steps down: 100 -> 50', s.v === '50' && s.good === 50 && s.state === '', JSON.stringify(s));
  await p.keyboard.press('Shift+ArrowDown'); s = await st();
  check('…and stops at the lower wall (10), saying why', s.v === '10' && s.good === 10 && s.state === 'limit' && /10-100/.test(s.note), JSON.stringify(s));
  // typing nonsense: no commit, Enter puts the good value back
  await p.fill('#tH', 'abc'); s = await st();
  check('not a number: "Type a number.", marked invalid', s.state === 'nan' && /Type a number/.test(s.note) && s.inv === 'true', JSON.stringify(s));
  await p.press('#tH', 'Escape'); s = await st();
  check('Esc puts the last good value back', s.v === '10' && s.state !== 'nan', JSON.stringify(s));
  // a file's bad value: kept EXACTLY, marked, never clamped, not committed (UI-I10)
  await p.evaluate(() => { document.getElementById('tH').value = '-300'; box.markFile('This file has a value no bridge can have: Height h -300 mm.'); });
  await p.click('#away'); s = await st();
  check('a bad value from a file stays as the file had it, marked and listed, nothing clamped (UI-I10)', s.v === '-300' && s.state === 'file' && /^⟂ This file has/.test(s.note) && s.inv === 'true', JSON.stringify(s));
  // UI Designer's MUST (TE-B-454): a second impossible value, or Esc, goes back to the FILE's value, not an older one
  await p.fill('#tH', '500'); await p.press('#tH', 'Enter'); s = await st();
  check('another impossible value + Enter goes back to the file\'s -300, still marked (UI-I10)', s.v === '-300' && s.state === 'file' && /^⟂ This file has/.test(s.note) && s.commits.indexOf('-300') < 0, JSON.stringify(s));
  await p.fill('#tH', '75'); await p.press('#tH', 'Escape'); s = await st();
  check('Esc goes back to the file\'s -300 too', s.v === '-300' && s.state === 'file', JSON.stringify(s));
  await p.evaluate(() => box.markFile(-7, 'This file has a value no bridge can have: Height h -7 mm.')); s = await st();
  check('markFile(value, msg) puts the file\'s value in the box and marks it', s.v === '-7' && s.state === 'file', JSON.stringify(s));
  await p.fill('#tH', '60'); await p.press('#tH', 'Enter'); s = await st();
  check('typing a good value fixes it', s.v === '60' && s.good === 60 && s.state === '', JSON.stringify(s));
  // the note is quiet while typing and speaks on Enter (UI Designer's SHOULD, TE-B-454)
  await p.fill('#tH', '130');
  const quiet = await p.evaluate(() => document.querySelector('#inTest .te-num-n').getAttribute('aria-live'));
  await p.press('#tH', 'Enter');
  const loud = await p.evaluate(() => document.querySelector('#inTest .te-num-n').getAttribute('aria-live'));
  check('the note is silent while typing (aria-live off) and polite on Enter', quiet === 'off' && loud === 'polite', quiet + ' / ' + loud);
  // width grows with the value: 52-96 px (UI-I9)
  const w = await p.evaluate(async () => { const i = document.getElementById('tH'), out = []; for (const t of ['5', '60', '123456789012']) { i.value = t; i.dispatchEvent(new Event('input')); out.push(Math.round(i.getBoundingClientRect().width)); } return out; });
  check('the box is as wide as its value, 52-96 px (UI-I9)', w[0] >= 52 && w[2] <= 96 && w[1] <= w[2], w.join(','));
  // sizes and contrast (ART-T2, ART-C1)
  const low = await p.evaluate(() => {
    const P = window.TrussPieces, rgb = c => 'rgb(' + c.match(/[\d.]+/g).slice(0, 3).join(',') + ')', bad = [];
    const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/rgba?\(([^)]+)\)/); if (m) { const v = m[1].split(',').map(Number); if (v.length < 4 || v[3] > 0.5) return c; } } return 'rgb(255,255,255)'; };
    box.set(70);
    for (const el of document.querySelectorAll('#inTest .te-num-l, #inTest .te-num-i, #inTest .te-step')) { const cs = getComputedStyle(el), r = P.contrast(rgb(cs.color), rgb(bgOf(el))); if (r < 4.5 || parseFloat(cs.fontSize) < 13) bad.push(el.className + ' ' + r.toFixed(2)); }
    return bad;
  });
  check('text 13 px or more and 4.5 : 1 or better', low.length === 0, low.join(' | '));
  // with the real limits table, when it's in the build
  const real = await p.evaluate(() => {
    if (!window.TrussLimits) return null;
    const c = TrussInputs.fromLimits(TrussLimits, 'height', () => ({ height: 70 }));
    return { lo: c(5), ok: c(70), hi: c(250) };
  });
  if (real) check('with TrussLimits: 5 and 250 are refused with the table\'s message, 70 passes', real.lo && real.lo.kind === 'limit' && real.hi && real.hi.kind === 'limit' && real.ok === null, JSON.stringify(real));
  check('no page errors', p.errs.length === 0, p.errs.join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`${check.results.length - bad.length}/${check.results.length} inputs checks pass`);
process.exit(bad.length ? 1 : 0);
