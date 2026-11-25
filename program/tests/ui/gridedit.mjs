// Cells that hold controls in the table piece (TrussPieces 0.2.4; UI-S10 in ui-spec 1.5.8, APG grid editing; TE-B-500).
// A bare page built only from TrussPieces: a Members-like grid with a Sticks cell (− count + and row / 2×2) and a Focus toggle.
//   node tests/ui/gridedit.mjs
import { browser, checker, ROOT } from './harness.mjs';
import fs from 'fs';
import path from 'path';

const pieces = fs.readFileSync(path.join(ROOT, 'src', 'pieces.js'), 'utf8');
const strings = fs.readFileSync(path.join(ROOT, 'src', 'strings.js'), 'utf8');
const check = checker('gridedit: ');
const b = await browser();
try {
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="stage"><button id="before" type="button">before</button><div id="host"></div><button id="after" type="button">after</button></div></body></html>');
  await p.addScriptTag({ content: strings }); await p.addScriptTag({ content: pieces });
  await p.evaluate(() => {
    const P = window.TrussPieces; P.install(document);
    window.M = { 1: { n: 1, b: false, f: false }, 2: { n: 2, b: false, f: false }, 3: { n: 4, b: false, f: true } };
    window.log = [];
    const sticks = (k, m) => `<span class="st"><button type="button" data-a="less" aria-label="Fewer sticks, member ${k}"${m.n <= 1 ? ' disabled' : ''}>−</button> <span class="n">${m.n}</span> <button type="button" data-a="more" aria-label="More sticks, member ${k}"${m.n >= 4 ? ' disabled' : ''}>+</button>`
      + (m.n === 4 ? ` <button type="button" data-a="bundle" aria-pressed="${m.b}">2×2</button>` : '') + '</span>';
    const focus = (k, m) => `<button type="button" data-a="focus" aria-pressed="${m.f}" aria-label="Focus member ${k} in the sweep">${m.f ? '●' : '◎'}</button>`;
    const set = (k, f) => { f(M[k]); M[k].n = Math.max(1, Math.min(4, M[k].n)); if (M[k].n < 4) M[k].b = false; log.push(k + ':' + M[k].n + (M[k].b ? 'b' : '') + (M[k].f ? 'f' : '')); draw(); };
    window.draw = () => {
      const was = window.T ? T.editing : null, had = window.T && document.getElementById('gT').contains(document.activeElement);
      const fc = had ? document.activeElement.closest('td,th') : null, key = fc ? fc.parentElement.dataset.key : null, col = fc ? [...fc.parentElement.children].indexOf(fc) : 0;
      if (window.T) T.destroy();
      document.getElementById('host').innerHTML = P.tableHTML({ id: 'gT', caption: 'Members', rowHeader: 'k',
        columns: [{ key: 'k', label: 'Member' }, { key: 'use', label: 'Use', num: true }, { key: 'sticks', label: 'Sticks', edit: 'cell' }, { key: 'focus', label: 'Focus', edit: 'widget' }],
        rows: Object.entries(M).map(([k, m]) => ({ key: k, cells: { k, use: (k * 21) + ' %' }, html: { sticks: sticks(k, m), focus: focus(k, m) } })) });
      const tbl = document.getElementById('gT');
      window.T = P.mountTable(tbl, {
        onCellKey: e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === '+') { set(e.row, m => { m.n++; }); return true; }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === '-') { set(e.row, m => { m.n--; }); return true; }
          if (e.key === ' ') { if (M[e.row].n === 4) set(e.row, m => { m.b = !m.b; }); return true; }
          return false;
        },
      });
      tbl.addEventListener('click', ev => { const a = ev.target.closest('button[data-a]'); if (!a) return; const k = a.closest('tr').dataset.key;
        set(k, m => { if (a.dataset.a === 'less') m.n--; else if (a.dataset.a === 'more') m.n++; else if (a.dataset.a === 'bundle') m.b = !m.b; else m.f = !m.f; }); });
      if (was) T.focusKey(was.key, { col: was.col, focus: true, edit: was.edit });
      else if (key != null) T.focusKey(key, { col, focus: true });
    };
    draw();
  });
  const at = () => p.evaluate(() => { const a = document.activeElement, c = a.closest && a.closest('td,th'); return { tag: a.tagName, id: a.id, a: a.dataset && a.dataset.a || '', key: c ? c.parentElement.dataset.key : null, col: c ? [...c.parentElement.children].indexOf(c) : null, editing: c ? c.hasAttribute('data-editing') : false }; });
  const stops = () => p.evaluate(() => document.querySelectorAll('#gT [tabindex="0"]').length);

  // one Tab stop; the controls inside are out of the Tab order
  await p.focus('#before'); await p.keyboard.press('Tab');
  let s = await at();
  check('one Tab stop: Tab lands on the first cell, not on a control', s.key === '1' && s.col === 0 && s.tag === 'TH', JSON.stringify(s));
  check('only one element in the grid has tabindex 0', await stops() === 1, String(await stops()));
  await p.keyboard.press('Tab'); s = await at();
  check('Tab again leaves the grid (the − / + / toggles are not Tab stops)', s.id === 'after', JSON.stringify(s));

  // arrows reach the Sticks cell (the cell itself) and the Focus toggle (the widget itself)
  await p.keyboard.press('Shift+Tab'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); s = await at();
  check('→ → lands on the Sticks cell itself (an editing cell)', s.tag === 'TD' && s.col === 2 && !s.editing, JSON.stringify(s));
  await p.keyboard.press('ArrowRight'); s = await at();
  check('→ lands on the Focus toggle button itself (one widget)', s.tag === 'BUTTON' && s.a === 'focus' && s.col === 3, JSON.stringify(s));
  await p.keyboard.press('Space'); s = await at();
  check('Space presses the toggle; focus stays on it after the redraw', (await p.evaluate(() => M[1].f)) && s.a === 'focus' && s.key === '1', JSON.stringify(s));
  await p.keyboard.press('Enter');
  check('Enter presses it too', !(await p.evaluate(() => M[1].f)));
  await p.keyboard.press('ArrowLeft'); s = await at();
  check('← from the toggle goes back to the Sticks cell', s.tag === 'TD' && s.col === 2, JSON.stringify(s));

  // Enter or F2 enters the cell; keys change it; Esc leaves it
  await p.keyboard.press('Enter'); s = await at();
  check('Enter enters the Sticks cell: focus on its first live control', s.editing && s.tag === 'BUTTON' && s.a === 'more', JSON.stringify(s));   // − is disabled at 1
  await p.keyboard.press('ArrowRight'); s = await at();
  check('→ inside the cell adds a stick; editing and the focused control (+) survive the redraw', (await p.evaluate(() => M[1].n)) === 2 && s.editing && s.key === '1' && s.a === 'more', JSON.stringify(s));
  await p.keyboard.press('ArrowLeft');
  check('← takes one away', (await p.evaluate(() => M[1].n)) === 1);
  await p.keyboard.press('Escape'); s = await at();
  check('Esc leaves the cell: focus back on the cell, not editing', s.tag === 'TD' && s.col === 2 && !s.editing, JSON.stringify(s));
  check('…and the controls are out of the Tab order again', await stops() === 1, String(await stops()));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('F2'); s = await at();
  check('F2 enters too (member 3, 4 sticks)', s.editing && s.key === '3', JSON.stringify(s));
  await p.keyboard.press('Tab'); const t1 = await at(); await p.keyboard.press('Tab'); const t2 = await at(); await p.keyboard.press('Tab'); const t3 = await at();
  check('Tab cycles inside the cell and never leaves it (+ is disabled at 4, so − and 2×2 take turns)', [t1, t2, t3].every(x => x.key === '3' && x.col === 2 && x.editing) && t1.a !== s.a && t2.a === s.a && t3.a === t1.a, [s, t1, t2, t3].map(x => x.a).join(' → '));
  await p.keyboard.press('Space');
  check('Space switches row / 2×2 at 4 sticks', await p.evaluate(() => M[3].b === true));
  await p.keyboard.press('Enter'); s = await at();
  check('Enter leaves the cell', s.tag === 'TD' && !s.editing && s.key === '3', JSON.stringify(s));
  await p.keyboard.press('ArrowUp'); s = await at();
  check('arrows move the grid again after leaving', s.key === '2' && s.col === 2, JSON.stringify(s));

  // a click on − / + works directly; clicking away stops editing
  await p.click('#gT tr[data-key="2"] button[data-a="less"]');
  check('a click on − works directly', (await p.evaluate(() => M[2].n)) === 1, await p.evaluate(() => log.join(' ')));
  await p.keyboard.press('Enter'); await p.click('#before'); s = await at();
  const ed = await p.evaluate(() => document.querySelectorAll('#gT [data-editing]').length);
  check('focus leaving the cell stops editing', ed === 0 && s.id === 'before', JSON.stringify(s));
  check('one Tab stop after all of that', await stops() === 1, String(await stops()));
  check('no page errors', p.errs.length === 0, p.errs.join(' | '));
} finally { await b.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`${check.results.length - bad.length}/${check.results.length} grid editing checks pass`);
process.exit(bad.length ? 1 : 0);
