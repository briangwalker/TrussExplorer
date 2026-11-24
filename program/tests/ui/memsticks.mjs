// UI-S10 (ui-spec 1.5.8; TE-B-496, TE-B-499, TE-B-500): the Members tab also sets sticks and focus, on the real built page.
//   node tests/ui/memsticks.mjs
import { serve, browser, openPage, checker } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('members sticks: ');
const st = p => p.evaluate(() => ({ sticks: JSON.stringify(__dbg.S.sticks || {}), focus: __dbg.S.focus.map(f => f.label).join('|'), toast: (document.querySelector('#toasts, .te-toast, [role="status"]') || {}).textContent || '' }));
try {
  const p = await openPage(b, srv.url, { width: 1366, height: 900 });
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.evaluate(() => __shell.go('analysis')); await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelector('#trackTabs [data-t="mem"]').click()); await p.waitForTimeout(500);
  const cols = await p.evaluate(() => [...document.querySelectorAll('#memTbl thead th')].map(x => x.textContent.trim().replace(/\s+/g, ' ')));
  check('Sticks and Focus are shown without All columns (UI-S10 1, 2)', cols.some(c => /^Sticks/.test(c)) && cols.some(c => /^Focus/.test(c)), cols.join('|'));
  const key = await p.evaluate(() => { const r = [...document.querySelectorAll('#memTbl tbody tr[data-key]')].find(r => r.querySelector('[data-act="mem-more"]:not([disabled])')); return r.dataset.key; });
  const n0 = await p.evaluate(k => __dbg.tr.elems[k].n, key);
  await p.click(`#memTbl tr[data-key="${key}"] [data-act="mem-more"]`); await p.waitForTimeout(400);
  const n1 = await p.evaluate(k => __dbg.tr.elems[k].n, key);
  const mir = await p.evaluate(k => { const e = __dbg.tr.elems[k], m = __dbg.tr.elems[e.mirror]; return { me: e.n, mirror: m ? m.n : null, same: m === e }; }, key);
  check('+ adds a stick, and the mirror member changes with it', n1 === n0 + 1 && (mir.same || mir.mirror === n1), JSON.stringify({ n0, n1, mir }));
  const tt = await p.evaluate(() => document.body.innerText);
  check('a toast says what changed, with Undo (UI-W10)', new RegExp(`Member ${key}: ${n0} → ${n1} stick`).test(tt) && /Undo/.test(tt));
  await p.click('text=Undo >> visible=true').catch(() => {}); await p.waitForTimeout(400);
  check('Undo puts the sticks back', await p.evaluate(k => __dbg.tr.elems[k].n, key) === n0);
  // four sticks: the row / 2x2 switch appears
  for (let i = 0; i < 4; i++) { const ok = await p.evaluate(k => { const b = document.querySelector(`#memTbl tr[data-key="${k}"] [data-act="mem-more"]`); if (b && !b.disabled) { b.click(); return true; } return false; }, key); if (!ok) break; await p.waitForTimeout(250); }
  check('at 4 sticks a row / 2×2 switch appears and toggles', await (async () => { const has = await p.$(`#memTbl tr[data-key="${key}"] [data-act="mem-bundle"]`); if (!has) return false; await has.click(); await p.waitForTimeout(300); return await p.evaluate(k => __dbg.tr.elems[k].bundle === 'compact', key); })());
  // keyboard: Enter on the Sticks cell, ← steps down, Esc leaves
  await p.evaluate(k => { const c = document.querySelector(`#memTbl tr[data-key="${k}"] td[data-edit="cell"]`); c.focus(); }, key);
  await p.keyboard.press('Enter'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(300);
  check('Enter then ← on the Sticks cell takes one stick off, and focus stays in the cell', await p.evaluate(k => __dbg.tr.elems[k].n === 3 && !!document.activeElement.closest(`#memTbl tr[data-key="${k}"] td[data-edit="cell"]`), key));
  await p.keyboard.press('Escape');
  // focus toggle
  await p.click(`#memTbl tr[data-key="${key}"] [data-act="mem-focus"]`); await p.waitForTimeout(300);
  let s = await st(p);
  check('the Focus toggle adds the member to the sweep\'s focus list and shows pressed', s.focus.length > 0 && await p.evaluate(k => document.querySelector(`#memTbl tr[data-key="${k}"] [data-act="mem-focus"]`).getAttribute('aria-pressed') === 'true', key), JSON.stringify(s));
  await p.click(`#memTbl tr[data-key="${key}"] [data-act="mem-focus"]`); await p.waitForTimeout(300);
  check('the Focus toggle takes it off again', (await st(p)).focus === '');
  // all members to 1 stick, with Undo
  await p.click('#memPanel [data-act="mem-reset"]'); await p.waitForTimeout(400);
  check('All members to 1 stick clears every stick change', (await st(p)).sticks === '{}');
  // the design facts: a closed disclosure under the table, today's words (UI-S10 4)
  const f = await p.evaluate(() => { const d = document.querySelector('#memPanel details.mv-facts'); return d ? { open: d.open, text: d.textContent } : null; });
  check('Design facts (hand-check) is a closed disclosure with the facts in it', !!f && !f.open && /Design load on one truss/.test(f.text) && /Wood used, whole bridge/.test(f.text), JSON.stringify(f && f.text.slice(0, 80)));
  check('Copy table still gives the app\'s own CSV (13 columns, no facts)', await p.evaluate(async () => { let t = null; navigator.clipboard.writeText = async x => { t = x; }; document.querySelector('#memPanel [data-act="members-copy"]').click(); for (let n = 0; n < 50 && t == null; n++) await new Promise(r => setTimeout(r, 20)); const hd = (t || '').split('\n').find(l => !l.startsWith('# ')) || ''; return hd.split(',').length === 13 && !/Design load/.test(t || ''); }));
  // 3D: a two-way switch above the table; the side truss is the default, the whole bridge is read-only (UI-S10 5)
  await p.evaluate(() => document.querySelector('#anaSwitch [data-ana="3d"]').click()); await p.waitForTimeout(900);
  await p.evaluate(() => document.querySelector('#trackTabs [data-t="mem"]')?.click()); await p.waitForTimeout(500);
  const sw = await p.evaluate(() => ({ side: document.querySelector('#memPanel [data-act="mem-side"]')?.getAttribute('aria-pressed'), whole: document.querySelector('#memPanel [data-act="mem-whole"]')?.getAttribute('aria-pressed'), editable: !!document.querySelector('#memTbl [data-act="mem-more"]') }));
  check('3D: the switch shows Side truss (2D) by default, and Sticks can be set there', sw.side === 'true' && sw.whole === 'false' && sw.editable, JSON.stringify(sw));
  await p.click('#memPanel [data-act="mem-whole"]'); await p.waitForTimeout(500);
  const wh = await p.evaluate(() => ({ box: !document.getElementById('tbl3Box').hidden, rows: document.querySelectorAll('#tbl3 tbody tr').length, controls: document.querySelectorAll('#tbl3 button, #tbl3 input').length, side: document.getElementById('memWrap').hidden }));
  check('3D: Whole bridge (3D) shows the 3D table, read-only, and hides the side-truss table', wh.box && wh.rows > 0 && wh.controls === 0 && wh.side, JSON.stringify(wh));
  check('3D: Copy table gives the 3D table\'s CSV while it is showing', await p.evaluate(async () => { let t = null; navigator.clipboard.writeText = async x => { t = x; }; document.querySelector('#memPanel [data-act="members-copy"]').click(); for (let n = 0; n < 50 && t == null; n++) await new Promise(r => setTimeout(r, 20)); return /Where/.test(t || ''); }));
  await p.click('#memPanel [data-act="mem-side"]'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#anaSwitch [data-ana="2d"]').click()); await p.waitForTimeout(500);
  // #453: the Drawing window no longer holds a member table, in 2D and 3D, in each state, at both sizes
  for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    const q = await openPage(b, srv.url, vp);
    for (const mode of ['2d', '3d']) {
      for (const state of ['W', 'I', 'T']) {
        const r = await q.evaluate(([mode, state]) => { __shell.go('truss'); try { document.querySelector('[data-mode="' + mode + '"], #mode' + mode.toUpperCase())?.click(); } catch (e) {} __shell.setState('drawing', state); const w = document.getElementById('win-drawing'), r = w.getBoundingClientRect();
          return { tbl: !!w.querySelector('table, #tbl, #s-members, #resetSticks'), top: r.top }; }, [mode, state]);
        check(`${vp.width}x${vp.height} ${mode} ${state}: no member table in the Drawing window, and nothing above its top edge`, !r.tbl && r.top >= -1, JSON.stringify(r));
      }
    }
    await q.close();
  }
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} Members-tab sticks and focus checks passed`);
process.exit(fails.length ? 1 : 0);
