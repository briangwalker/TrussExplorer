// Sheets, dialogs and toasts (TrussSheets) on the real built page (UI-A16, UI-W8, UI-W10, UI-W13, UI-W22, UI-W23).
// The pieces are mounted on #stage the way the shell will mount them (#217, #410, #411, #399).
//   node tests/ui/sheets.mjs
import { serve, browser, openPage, checker } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('sheets: ');

// a long dialog: 30 fields in the middle, a main button, Cancel; and a short sheet with no fields
async function mount(p) {
  await p.evaluate(() => {
    const P = window.TrussPieces, S = window.TrussSheets;
    P.install(document); S.install(document);
    let rows = '';
    for (let n = 1; n <= 30; n++) rows += `<p><label>Field ${n} <input id="f${n}" value="${n}"></label></p>`;
    const host = document.createElement('div'); host.id = 'shTest';
    host.innerHTML = S.sheetHTML(P, { id: 'dlgT', kind: 'dialog', title: 'Build documents', body: rows,
      buttons: [{ label: 'Cancel', cancel: true }, { label: 'Make the build documents', act: 'bd-make', main: true }] })
      + S.sheetHTML(P, { id: 'shT', kind: 'sheet', title: 'Keys and help', body: '<p>Esc closes this sheet.</p>' })
      + '<button id="opener" type="button" style="position:absolute;left:30px;top:120px;z-index:400">Open</button>'
      + '<button id="behind" type="button" style="position:absolute;left:30px;top:20px;z-index:400">Behind</button>';
    document.getElementById('stage').appendChild(host);
    window.shLog = []; window.behindClicks = 0;
    document.getElementById('behind').addEventListener('click', () => { window.behindClicks++; });
    window.M = S.modals(document, { onClose: (el, why) => shLog.push(el.id + ':' + why) });
    window.T = S.toasts(document);
  });
}
const open = (p, id) => p.evaluate(id => { const o = document.getElementById('opener'); o.focus(); M.open(document.getElementById(id), o); }, id);
const active = p => p.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.textContent.trim().slice(0, 30)));

try {
  // ---------- at three window sizes and 125 % zoom: the button row is on screen as soon as it opens (UI-W23) ----------
  for (const [w, h, z] of [[1366, 768, 1], [1440, 900, 1], [1440, 900, 1.25], [1366, 600, 1], [1024, 480, 1]]) {
    const p = await openPage(b, srv.url, { width: Math.round(w / z), height: Math.round(h / z) });
    await mount(p); await open(p, 'dlgT');
    const r = await p.evaluate(() => {
      const d = document.getElementById('dlgT'), btn = d.querySelector('[data-main]'), hd = d.querySelector('.te-sh-h');
      const in_ = el => { const q = el.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight + 0.5 && q.left >= 0 && q.right <= innerWidth + 0.5; };
      return { main: in_(btn), head: in_(hd), mid: d.querySelector('.te-sh-m').scrollHeight > d.querySelector('.te-sh-m').clientHeight || d.scrollHeight > d.clientHeight };
    });
    check(`${w}x${h}${z !== 1 ? ' at 125%' : ''}: the main button and the header are on screen when it opens, the middle scrolls (UI-W23)`, r.main && r.head && r.mid, JSON.stringify(r));
    // focus is never hidden: Tab through every field; each is fully inside the visible middle, clear of header and buttons
    const hidden = await p.evaluate(async () => {
      const d = document.getElementById('dlgT'), m = d.querySelector('.te-sh-m'), bad = [];
      for (let n = 1; n <= 30; n++) {
        const f = document.getElementById('f' + n); f.focus();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const q = f.getBoundingClientRect(), hb = d.querySelector('.te-sh-h').getBoundingClientRect(), bb = d.querySelector('.te-sh-b').getBoundingClientRect();
        if (q.top < hb.bottom - 0.5 || q.bottom > bb.top + 0.5 || q.top < 0 || q.bottom > innerHeight) bad.push(n);
      }
      return bad;
    });
    check(`${w}x${h}${z !== 1 ? ' at 125%' : ''}: focus is never hidden under the header or the button row (UI-W23, WCAG 2.4.11)`, hidden.length === 0, 'hidden: ' + hidden.join(','));
    if (w === 1440 && z === 1) {
      // ---------- behaviour, once ----------
      await p.evaluate(() => M.close(document.getElementById('dlgT'))); await open(p, 'dlgT');
      check('on open, focus goes to the first field (APG dialog)', await active(p) === 'f1', await active(p));
      await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Shift+Tab');
      await p.evaluate(() => document.getElementById('f30').focus()); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
      check('Tab stays inside the dialog: after the last button it comes back to the top', await p.evaluate(() => document.getElementById('dlgT').contains(document.activeElement)), await active(p));
      await p.keyboard.press('Escape');
      check('Esc closes it and focus goes back to its opener (UI-A16, UI-W8)', await p.evaluate(() => !document.getElementById('dlgT').open && document.activeElement.id === 'opener' && shLog.at(-1) === 'dlgT:esc'), await p.evaluate(() => shLog.join(' ')));
      // backdrop: closes a clean dialog and does nothing else on the page behind
      await open(p, 'dlgT');
      const bh = await p.evaluate(() => { const r = document.getElementById('behind').getBoundingClientRect(); return [r.left + 5, r.top + 5]; });
      await p.mouse.click(bh[0], bh[1]);
      check('a click on the backdrop closes a dialog with nothing typed, and does nothing else (UI-W22)', await p.evaluate(() => !document.getElementById('dlgT').open && behindClicks === 0 && shLog.at(-1) === 'dlgT:backdrop' && document.activeElement.id === 'opener'), await p.evaluate(() => [behindClicks, shLog.join(' ')].join(' | ')));
      // typed values not applied yet: the click is ignored and Cancel flashes once
      await open(p, 'dlgT'); await p.keyboard.type('7');
      await p.evaluate(() => { document.getElementById('dlgT').dataset.dirty = ''; });
      await p.mouse.click(bh[0], bh[1]);
      const kept = await p.evaluate(() => ({ open: document.getElementById('dlgT').open, flash: document.querySelector('#dlgT [data-cancel]').classList.contains('te-flash'), v: document.getElementById('f1').value, behind: behindClicks }));
      check('with typed values, the backdrop click is ignored and Cancel flashes once, nothing lost (UI-W22)', kept.open && kept.flash && /^(17|71)$/.test(kept.v) && kept.behind === 0, JSON.stringify(kept));
      await p.click('#dlgT [data-cancel]');
      check('Cancel closes it', await p.evaluate(() => !document.getElementById('dlgT').open && shLog.at(-1) === 'dlgT:cancel'));
      // a sheet: ✕ closes; opening a second closes the first (one at a time, UI-A16)
      await open(p, 'shT');
      check('a sheet with no field takes focus on its ✕', await p.evaluate(() => document.activeElement.classList.contains('te-sh-x')));
      await open(p, 'dlgT');
      check('one at a time: opening a dialog closes the open sheet (UI-A16)', await p.evaluate(() => !document.getElementById('shT').open && document.getElementById('dlgT').open && shLog.includes('shT:replaced')));
      await p.evaluate(() => { delete document.getElementById('dlgT').dataset.dirty; });
      await p.click('#dlgT .te-sh-x');
      check('✕ closes it', await p.evaluate(() => !document.getElementById('dlgT').open && shLog.at(-1) === 'dlgT:close'));
      // ---------- toasts (UI-W10) ----------
      const tz = await p.evaluate(() => {
        window.undone = 0; T.show({ text: 'Changed h 70 → 80', undo: () => { undone++; }, ms: 600 });
        const el = T.el, r = el.getBoundingClientRect();
        return { role: el.getAttribute('role'), live: el.getAttribute('aria-live'), text: el.textContent, mid: Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 2, low: r.bottom > innerHeight * 0.7, focus: document.activeElement.id };
      });
      check('a toast is bottom centre, role=status, says what changed and offers Undo, without taking focus (UI-W10)', tz.role === 'status' && tz.live === 'polite' && /Changed h 70 → 80\s*Undo/.test(tz.text) && tz.mid && tz.low && tz.focus === 'opener', JSON.stringify(tz));
      await p.waitForTimeout(900);
      check('it fades by itself', await p.evaluate(() => T.el.hidden));
      await p.evaluate(() => T.show({ text: 'Changed w 60 → 50', undo: () => { undone++; }, ms: 500 }));
      await p.hover('.te-toast-u'); await p.waitForTimeout(800);
      check('it waits while the pointer is on it (WCAG 2.2.1)', await p.evaluate(() => !T.el.hidden));
      await p.click('.te-toast-u');
      check('Undo runs the undo and closes the toast', await p.evaluate(() => undone === 1 && T.el.hidden));
      await p.evaluate(() => { T.show({ text: 'one', ms: 5000 }); T.show({ text: 'two', ms: 5000 }); });
      check('one toast at a time: a new one replaces the old', await p.evaluate(() => document.querySelectorAll('.te-toast').length === 1 && T.el.textContent === 'two'));
      // contrast of the toast and the dialog text (ART-C1)
      const low = await p.evaluate(() => {
        const P = window.TrussPieces, bad = [], rgb = c => 'rgb(' + c.match(/[\d.]+/g).slice(0, 3).join(',') + ')';
        const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/rgba?\(([^)]+)\)/); if (m) { const v = m[1].split(',').map(Number); if (v.length < 4 || v[3] > 0.5) return c; } } return 'rgb(255,255,255)'; };
        M.open(document.getElementById('shT'));
        for (const el of [T.el.querySelector('.te-toast-t'), document.querySelector('#shT .te-sh-t'), document.querySelector('#shT .te-sh-m p')]) {
          const cs = getComputedStyle(el), r = P.contrast(rgb(cs.color), rgb(bgOf(el)));
          if (r < 4.5 || parseFloat(cs.fontSize) < 13) bad.push(el.className + ' ' + r.toFixed(2) + ' ' + cs.fontSize);
        }
        return bad;
      });
      check('toast and sheet text: 4.5 : 1 or better, 13 px or more (ART-C1, UI-T1)', low.length === 0, low.join(' | '));
      check('no page errors', p.errs.length === 0, p.errs.join(' | '));
    }
    await p.close();
  }
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`${check.results.length - bad.length}/${check.results.length} sheets checks pass`);
process.exit(bad.length ? 1 : 0);
