// The ✎ value editor (TrussInputs.editorHTML / mountEditor) on the real built page (UI-I8, UI-W20, UI-W8, UI-I1, UI-I4).
//   node tests/ui/valueeditor.mjs
import { serve, browser, openPage, checker } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('valueeditor: ');

try {
  const p = await openPage(b, srv.url, { width: 1366, height: 900 });
  await p.evaluate(() => {
    const P = window.TrussPieces, I = window.TrussInputs;
    P.install(document); I.install(document);
    const host = document.createElement('div'); host.id = 'veHost'; host.setAttribute('data-pc', '');
    host.style.cssText = 'position:absolute;left:0;top:0;width:900px;height:600px;z-index:500';
    host.innerHTML = '<button id="pen" type="button">✎ h</button> <button id="away" type="button" style="position:absolute;left:800px;top:500px">away</button>'
      + I.editorHTML(P, { id: 'veH', label: 'Height h', unit: 'mm', value: 70, sweep: { on: true, from: 50, to: 90, step: 5 } });
    document.getElementById('stage').appendChild(host);
    window.log = { commits: [], sweeps: [], closes: [], away: 0 };
    document.getElementById('away').addEventListener('click', () => log.away++);
    const chk = v => v < 10 || v > 100 ? { kind: 'limit', msg: 'Height must be 10-100 mm.' } : null;
    const el = document.getElementById('veH'); el.style.left = '100px'; el.style.top = '60px';
    window.ed = I.mountEditor(el, { check: chk, step: 1, value: 70, opener: document.getElementById('pen'),
      onCommit: v => log.commits.push(v), onSweep: r => log.sweeps.push(r), onClose: w => log.closes.push(w) });
    document.getElementById('pen').addEventListener('click', () => ed.show());
  });
  await p.click('#pen');
  const box = await p.evaluate(() => { const r = document.getElementById('veH').getBoundingClientRect(); return { w: Math.round(r.width), open: !document.getElementById('veH').hidden, f: document.activeElement.id }; });
  check('opens from ✎, 320 px wide, focus in the value box (UI-I8)', box.open && box.w === 320 && box.f === 'veH-v', JSON.stringify(box));
  const cnt = await p.textContent('#veH .te-ve-count');
  check('the sweep line reads from → to · step = N values (UI-I1)', cnt === '50 → 90 mm · step 5 = 9 values', cnt);

  // moves by its title bar, and stays inside its box
  const h = await p.locator('#veH .te-ve-h').boundingBox();
  await p.mouse.move(h.x + 40, h.y + 10); await p.mouse.down(); await p.mouse.move(h.x + 240, h.y + 110, { steps: 5 }); await p.mouse.up();
  let pos = await p.evaluate(() => ({ l: parseFloat(veH.style.left), t: parseFloat(veH.style.top) }));
  check('dragging the title bar moves it (UI-I8, UI-W20)', Math.abs(pos.l - 300) <= 2 && Math.abs(pos.t - 160) <= 2, JSON.stringify(pos));
  await p.mouse.move(h.x + 240, h.y + 110); const h2 = await p.locator('#veH .te-ve-h').boundingBox();
  await p.mouse.move(h2.x + 40, h2.y + 10); await p.mouse.down(); await p.mouse.move(h2.x + 2000, h2.y + 2000, { steps: 4 }); await p.mouse.up();
  pos = await p.evaluate(() => { const r = veH.getBoundingClientRect(), H = veHost.getBoundingClientRect(); return { right: Math.round(r.right), bottom: Math.round(r.bottom), hr: Math.round(H.right), hb: Math.round(H.bottom) }; });
  check('it can\'t be dragged out of its box', pos.right <= pos.hr && pos.bottom <= pos.hb, JSON.stringify(pos));
  await p.evaluate(() => { veH.style.left = '100px'; veH.style.top = '60px'; });

  // the joystick: a small push changes slowly, a full push faster; it springs back; it stops at the wall
  const j = await p.locator('#veH .te-ve-joy').boundingBox(), mid = j.x + j.width / 2, y = j.y + j.height / 2;
  const hold = async (dx, ms) => { const v0 = await p.inputValue('#veH-v'); await p.mouse.move(mid, y); await p.mouse.down(); await p.mouse.move(mid + dx, y); await p.waitForTimeout(ms); await p.mouse.up(); return (+await p.inputValue('#veH-v')) - (+v0); };
  const slow = await hold(j.width * 0.15, 600), fast = await hold(j.width * 0.5, 600);
  check('the farther you push, the faster it changes (UI-I8)', slow >= 0 && fast > slow && fast >= 5, `slow ${slow}, fast ${fast}`);
  await p.waitForTimeout(250);
  const knob = await p.evaluate(() => getComputedStyle(veH.querySelector('.te-ve-knob')).transform);
  check('let go, the joystick springs back to the middle', knob === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(knob) || /translateX\(0/.test(knob), knob);
  const back = await hold(-j.width * 0.5, 600);
  check('pushing left counts down', back < 0, String(back));
  await p.fill('#veH-v', '98'); await p.press('#veH-v', 'Enter');
  await hold(j.width * 0.5, 800);
  check('it stops at the wall like the steppers (UI-I3)', await p.inputValue('#veH-v') === '100', await p.inputValue('#veH-v'));
  // keys on the joystick
  await p.fill('#veH-v', '70'); await p.press('#veH-v', 'Enter');
  await p.focus('#veH .te-ve-joy'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Shift+ArrowLeft');
  check('the joystick takes ← → (and Shift ×10) from the keyboard', await p.inputValue('#veH-v') === '61', await p.inputValue('#veH-v'));
  const commits = await p.evaluate(() => log.commits.length);
  check('the value commits as it changes', commits > 5, String(commits));

  // the sweep range: over the cap, Done is refused and nothing is cut (UI-I4)
  await p.fill('#veH-step', '0.01'); await p.press('#veH-step', 'Enter');
  const over = await p.textContent('#veH .te-ve-count');
  check('over 400 values the line says so (UI-I4)', /= 4001 values · over 400: use a coarser step/.test(over), over);
  await p.click('#veH .te-ve-done');
  let st = await p.evaluate(() => ({ open: !veH.hidden, sweeps: log.sweeps.length, f: document.activeElement.id }));
  check('Done is refused over the cap and focus goes to Step', st.open && st.sweeps === 0 && st.f === 'veH-step', JSON.stringify(st));
  await p.fill('#veH-step', '10'); await p.press('#veH-step', 'Enter');
  await p.click('#veH .te-ve-done');
  st = await p.evaluate(() => ({ open: !veH.hidden, sw: JSON.stringify(log.sweeps), c: log.closes.join(), f: document.activeElement.id }));
  check('Done applies the range, closes, and focus goes back to ✎', !st.open && st.sw === '[{"on":true,"from":50,"to":90,"step":10}]' && st.c === 'done' && st.f === 'pen', JSON.stringify(st));

  // Esc closes; an outside click closes and does nothing else (UI-W8)
  await p.click('#pen'); await p.keyboard.press('Escape');
  st = await p.evaluate(() => ({ open: !veH.hidden, c: log.closes.join(), f: document.activeElement.id }));
  check('Esc closes and focus goes back to ✎', !st.open && st.c === 'done,esc' && st.f === 'pen', JSON.stringify(st));
  await p.click('#pen'); await p.click('#away');
  st = await p.evaluate(() => ({ open: !veH.hidden, c: log.closes.join(), away: log.away }));
  check('an outside click closes it, and that click does nothing else (UI-W8)', !st.open && st.c === 'done,esc,outside' && st.away === 0, JSON.stringify(st));
  await p.click('#away'); st = await p.evaluate(() => log.away);
  check('the next click works as normal', st === 1, String(st));
  const errs = await p.evaluate(() => (window.__errors || []).length);
  check('no page errors', errs === 0, String(errs));
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`${check.results.length - bad.length}/${check.results.length} value editor checks pass`);
process.exit(bad.length ? 1 : 0);
