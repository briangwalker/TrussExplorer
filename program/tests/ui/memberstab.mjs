// The Members tab in Analysis (#416, TE-B-332; UI-S6, UI-W21, UI-H4) on the real built page (balsaPixel layout):
// the last tab of Analysis, every member highest use first, Copy / Download give the app's own CSV, a row lights the
// member in the drawing, and it redraws when the bridge changes.
//   node tests/ui/memberstab.mjs
import { serve, browser, openPage, checker } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('members tab: ');
try {
  for (const vp of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    const p = await openPage(b, srv.url, vp), tag = ` (${vp.width}x${vp.height})`;
    await p.evaluate(() => __shell.go('analysis')); await p.waitForTimeout(600);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#trackTabs [role="tab"]')].map(t => t.dataset.t));
    check('Members is the last tab of Analysis (UI-S6)' + tag, tabs[tabs.length - 1] === 'mem', tabs.join());
    await p.evaluate(() => document.querySelector('#trackTabs [data-t="mem"]').click()); await p.waitForTimeout(400);
    const t = await p.evaluate(() => {
      const tbl = document.getElementById('memTbl'), panel = document.getElementById('memPanel'), r = panel.getBoundingClientRect();
      const keys = [...tbl.querySelectorAll('tbody tr[data-key]')].map(x => +x.dataset.key);
      const use = keys.map(k => __dbg.res.members.find(m => m.k === k).util);
      return { shown: !panel.hidden && r.width > 0 && r.height > 0, n: keys.length, want: __dbg.res.members.length, sorted: use.every((u, i) => i === 0 || use[i - 1] >= u),
        onScreen: r.top < innerHeight && r.bottom > 0, clear: (() => { const tb = panel.querySelector('[data-act="members-csv"]').getBoundingClientRect(), x = document.elementFromPoint(tb.left + tb.width / 2, tb.top + tb.height / 2); return !!x && !!x.closest('[data-act="members-csv"]') && tb.bottom <= innerHeight && tb.right <= innerWidth; })(),
        wrapIn: (() => { const w = document.getElementById('memWrap').getBoundingClientRect(); return w.bottom <= innerHeight && w.right <= innerWidth; })(), sel: document.querySelector('#trackTabs [data-t="mem"]').getAttribute('aria-selected'),
        btns: [...panel.querySelectorAll('[data-act]')].map(x => x.dataset.act).join() };
    });
    check('the tab shows the table on screen, every member, highest use first' + tag, t.shown && t.onScreen && t.n === t.want && t.n > 0 && t.sorted && t.sel === 'true', JSON.stringify(t));
    check('Copy table and Download CSV are there, on screen and not under a window (UI-A21)' + tag, t.btns === 'members-copy,members-csv' && t.clear, JSON.stringify({ btns: t.btns, clear: t.clear }));
    check('the table scrolls inside the free part of the screen, nothing off the page' + tag, t.wrapIn);
    if (vp.width === 1280) {
      // Download gives the app's own CSV, byte for byte (the Drawing window's file)
      await p.click('#memPanel [data-act="members-csv"]');
      await p.waitForSelector('#saveModal:not([hidden])', { timeout: 4000 }).catch(() => null);   // the app's usual name pop-up
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.click('#saveGo').catch(() => null)]);
      const txt = dl ? await (await import('fs')).promises.readFile(await dl.path(), 'utf8') : '';
      const want = await p.evaluate(() => window.TrussApp && typeof window.TrussApp.csvText === 'function' ? window.TrussApp.csvText() : null);
      const body = txt.split('\n').filter(l => !l.startsWith('# ')).join('\n');
      const viaView = await p.evaluate(() => TrussMembersView.csvOf(TrussMembersView.csvRows(TrussMembers.rows(__dbg.tr, __dbg.res), TrussExport.TYPE_LABEL)));
      check('Download CSV saves <name>_members.csv with the app\'s own table', !!dl && /_members\.csv$/.test(dl.suggestedFilename()) && body === viaView && (want == null || txt === want) && /^# /.test(txt), dl ? dl.suggestedFilename() : 'no download');
      // hover a row: that member lights in the drawing; leave: it goes out; pick: it stays
      const k = await p.evaluate(() => document.querySelector('#memTbl tbody tr[data-key]').dataset.key);
      await p.hover(`#memTbl tbody tr[data-key="${k}"]`); await p.waitForTimeout(100);
      const lit = await p.evaluate(k => document.querySelector(`#memTbl tbody tr[data-key="${k}"]`).classList.contains('lit') && [...document.querySelectorAll('#draw .mem')].some(l => +l.dataset.k === +k && +l.getAttribute('stroke-width') === 5.5), k);
      check('hovering a row lights the row and that member in the drawing (UI-H4)', lit);
      await p.click(`#memTbl tbody tr[data-key="${k}"]`); await p.mouse.move(2, 2); await p.waitForTimeout(100);
      const kept = await p.evaluate(k => document.querySelector(`#memTbl tbody tr[data-key="${k}"]`).getAttribute('aria-selected') === 'true' && [...document.querySelectorAll('#draw .mem')].some(l => +l.dataset.k === +k && +l.getAttribute('stroke-width') === 5.5), k);
      check('a picked row stays lit, and so does its member, after the pointer leaves', kept);
      // the bridge changes: the table redraws with the new numbers and keeps the pick
      const before = await p.evaluate(() => document.querySelector('#memTbl tbody').textContent);
      await p.evaluate(() => { __dbg.S.height = (+__dbg.S.height || 60) + 15; window.TrussApp.update ? window.TrussApp.update() : null; });
      await p.evaluate(() => { const el = document.getElementById('height'); if (el) { el.value = String(__dbg.S.height); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); } }); await p.waitForTimeout(300);
      const after = await p.evaluate(k => ({ txt: document.querySelector('#memTbl tbody').textContent, kept: (document.querySelector(`#memTbl tbody tr[data-key="${k}"]`) || {}).ariaSelected }), k);
      check('it redraws when the bridge changes, and the pick stays', after.txt !== before && after.kept === 'true', JSON.stringify({ kept: after.kept }));
      // keys: one Tab stop, arrows move
      await p.focus('#memTbl tbody tr[tabindex="0"]'); await p.keyboard.press('ArrowDown');
      const keys = await p.evaluate(() => ({ focus: document.activeElement.closest && !!document.activeElement.closest('#memTbl'), stops: document.querySelectorAll('#memTbl tbody tr[tabindex="0"]').length }));
      check('one Tab stop, and the arrow keys move inside the table', keys.focus && keys.stops === 1, JSON.stringify(keys));
      // after a reload, the tab is remembered
      await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__dbg && window.__dbg.res); await p.waitForTimeout(600);
      check('the Members tab is remembered after a reload', await p.evaluate(() => __dbg.S.tab === 'mem' && !document.getElementById('memPanel').hidden && !!document.getElementById('memTbl')));
    }
    check('no script errors' + tag, p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - bad.length}/${check.results.length} Members tab checks passed`);
process.exit(bad.length ? 1 : 0);
