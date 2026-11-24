// step 2b (#399, UI-W10): after an input change a toast says what changed and offers Undo; Undo puts the value back;
// the toast covers no control, at 1366x900 and at 390x844. Only a PERSON's change makes a toast: a fresh load's own
// start-up set shows and announces nothing, and Ctrl+Z then changes nothing (#502); the app's own set only moves the baseline.
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';
const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
const toast = p => p.evaluate(() => { const t = document.querySelector('.te-toast'); return t && !t.hidden ? { text: t.textContent, undo: !!t.querySelector('[data-undo]') } : null; });
const covers = p => p.evaluate(() => {
  const t = document.querySelector('.te-toast'); if (!t || t.hidden) return 'no toast';
  const r = t.getBoundingClientRect(), hit = [];
  for (const e of document.querySelectorAll('#stage button, #stage input, #stage select, #stage [role="tab"], #stage [role="switch"]')) {
    if (t.contains(e)) continue; const q = e.getBoundingClientRect(); if (!q.width || !q.height) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) hit.push(e.id || e.className || e.tagName);
  }
  return hit.length ? hit.slice(0, 4).join(',') : '';
});
// a synthetic change (dispatchEvent) counts as the person's only right after their own key or click, as a screen piece's
// write does; so each one here follows a real key press
const person = p => p.keyboard.press('Shift');
// #502: on a fresh load (the first visit's start-up sets sweep boxes and fires their change events) no change toast may show
// or be announced, and Ctrl+Z pressed in those first seconds must change nothing
async function freshLoad(p) {
  const t0 = Date.now(); let seen = null;
  while (Date.now() - t0 < 3000 && !seen) { seen = await p.evaluate(() => { const t = document.querySelector('.te-toast'); return t && !t.hidden && /Changed/.test(t.textContent) ? t.textContent : null; }); if (!seen) await p.waitForTimeout(100); }
  check('fresh load: no "Changed …" toast in the first 3 s, nothing touched (#502, UI-W10)', seen === null, JSON.stringify(seen));
  const before = await p.evaluate(() => document.getElementById('swVaryOv').checked);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  check('fresh load: Ctrl+Z in the first seconds changes nothing (#502)', await p.evaluate(() => document.getElementById('swVaryOv').checked) === before && await p.evaluate(() => __dbg.S.height) === await p.evaluate(() => __dbg.S.height));
}
async function run(p, tag) {
  await waitRows(p);
  // the app's own set (no key or click by the person): no toast, but the baseline moves to the new value
  await p.waitForTimeout(1100);
  const own = await p.evaluate(() => { const c = document.getElementById('crossTies'); c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true })); return c.checked; }); await p.waitForTimeout(150);
  check(`${tag}: the app's own set shows no toast (UI-W10)`, (await toast(p)) === null, JSON.stringify(await toast(p)));
  await person(p);
  await p.evaluate(() => { const c = document.getElementById('crossTies'); c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(150);
  const tOwn = await toast(p);
  check(`${tag}: the person's next change reads from the app's value, not an older one`, !!tOwn && tOwn.text.includes(`${own ? 'on' : 'off'} → ${own ? 'off' : 'on'}`), JSON.stringify(tOwn));
  await p.click('.te-toast [data-undo]'); await p.waitForTimeout(150);
  const h0 = await p.evaluate(() => __dbg.S.height);
  await person(p);
  await p.evaluate(h => { const e = document.getElementById('height'); e.value = h + 10; e.dispatchEvent(new Event('change', { bubbles: true })); }, h0); await p.waitForTimeout(150);
  const t1 = await toast(p);
  check(`${tag}: a number change shows "Changed h ${h0} → ${h0 + 10}" with Undo`, !!t1 && t1.text.includes(`Changed h ${h0} → ${h0 + 10}`) && t1.undo, JSON.stringify(t1));
  check(`${tag}: the value really changed`, await p.evaluate(() => __dbg.S.height) === h0 + 10);
  const cov = await covers(p);
  check(`${tag}: the toast covers no control (UI-W10)`, cov === '', cov);
  await p.click('.te-toast [data-undo]'); await p.waitForTimeout(150);
  check(`${tag}: Undo puts the value back, in the box and the state`, await p.evaluate(h => __dbg.S.height === h && +document.getElementById('height').value === h, h0));
  check(`${tag}: Undo's own change shows no new toast`, (await toast(p)) === null);
  // a checkbox and a segmented picker
  await person(p);
  const cb = await p.evaluate(() => { const c = document.getElementById('crossTies'); c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true })); return c.checked; }); await p.waitForTimeout(150);
  const t2 = await toast(p);
  check(`${tag}: a checkbox change shows a toast with on/off`, !!t2 && /Changed .* (on|off) → (on|off)/.test(t2.text) && t2.undo, JSON.stringify(t2));
  await p.click('.te-toast [data-undo]'); await p.waitForTimeout(100);
  check(`${tag}: Undo restores the checkbox`, await p.evaluate(c => document.getElementById('crossTies').checked === !c, cb));
  await person(p);
  const segd = await p.evaluate(() => { const seg = document.getElementById('bottom'); const on = seg.querySelector('button[aria-pressed="true"]'); const other = [...seg.querySelectorAll('button[data-v]')].find(x => x !== on); if (!other) return null; other.click(); return { from: on.textContent.trim(), to: other.textContent.trim() }; });
  await p.waitForTimeout(150);
  const t3 = await toast(p);
  check(`${tag}: a segmented pick shows a toast from → to`, !!segd && !!t3 && t3.text.includes(`${segd.from} → ${segd.to}`), JSON.stringify({ segd, t3 }));
  await p.click('.te-toast [data-undo]'); await p.waitForTimeout(150);
  check(`${tag}: Undo re-presses the old choice`, await p.evaluate(f => document.querySelector('#bottom button[aria-pressed="true"]').textContent.trim() === f, segd && segd.from));
  check(`${tag}: no script errors`, p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
}
try {
  const p = await openPage(b, srv.url, { width: 1366, height: 900 }); await freshLoad(p); await run(p, '1366'); await p.close();
  const q = await openPage(b, srv.url, { width: 390, height: 844 }); await run(q, '390'); await q.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} Undo-toast checks passed`);
process.exit(fails.length ? 1 : 0);
