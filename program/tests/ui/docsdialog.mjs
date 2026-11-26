// #285 (UI-W13): the Build documents dialog takes keyboard focus when it opens, keeps it inside on Tab and Shift+Tab,
// closes on Esc, gets focus back after a download's name pop-up (so Esc still closes it), and gives focus back to ☰.
// BPD-15 (TE-B-652): its button row never scrolls away (UI-W23 / UI-A21, #411), and a click on the dimmed backdrop
// closes it the way Esc does and does nothing else (UI-W22, #410).
//   node tests/ui/docsdialog.mjs
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('build documents dialog: ');
const inside = p => p.evaluate(() => document.getElementById('docModal').contains(document.activeElement));
// every button of the button row lies inside the viewport and inside the card, with nothing scrolled
const footOk = p => p.evaluate(() => {
  const md = document.getElementById('docModal'), card = md.querySelector('.modalcard'), mid = md.querySelector('.docMid') || card;
  const vw = innerWidth, vh = innerHeight, c = card.getBoundingClientRect(), bad = [];
  const btns = [...md.querySelectorAll('.docFoot button, .docFoot label, .modalcard > .btns button')];
  for (const e of btns) { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= vh + 0.5 && r.right <= vw + 0.5 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5)) bad.push(`${e.id || e.textContent.trim().slice(0, 20)} ${Math.round(r.top)}-${Math.round(r.bottom)}/${vh}`); }
  return { ok: btns.length >= 4 && !bad.length && card.scrollTop === 0 && document.scrollingElement.scrollTop === 0, scrolls: mid.scrollHeight > mid.clientHeight + 1, cardScroll: card.scrollTop, n: btns.length, bad };
});
// a point on the dimmed backdrop, outside the card
const backdropPt = p => p.evaluate(() => {
  const c = document.querySelector('#docModal .modalcard').getBoundingClientRect();
  if (c.left > 6) return { x: c.left / 2, y: innerHeight / 2 };
  if (c.top > 6) return { x: innerWidth / 2, y: c.top / 2 };
  return { x: innerWidth / 2, y: (c.bottom + innerHeight) / 2 };
});
const snap = p => p.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const openIt = async p => { await p.click('#dockBtn'); await p.waitForTimeout(200); await p.click('#dockMenu [data-click="openDocs"]'); await p.waitForSelector('#docModal:not([hidden])'); await p.waitForTimeout(150); };
try {
  for (const vp of [{ width: 1366, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 1366, height: 600 }]) {
    const p = await openPage(b, srv.url, vp), tag = ` (${vp.width}x${vp.height})`; await waitRows(p);
    await openIt(p);
    check('focus is inside the dialog when it opens' + tag, await inside(p));
    const f0 = await footOk(p);
    check('UI-W23: the button row is on screen without scrolling' + tag, f0.ok, JSON.stringify(f0));
    if (vp.height <= 768) check('UI-W23: the middle is what scrolls' + tag, f0.scrolls, JSON.stringify(f0));
    await p.evaluate(() => { const m = document.querySelector('#docModal .docMid') || document.querySelector('#docModal .modalcard'); m.scrollTop = m.scrollHeight; });
    await p.waitForTimeout(50);
    const f1 = await footOk(p);
    check('UI-W23: the button row stays put with the middle scrolled to the end' + tag, f1.ok, JSON.stringify(f1));
    await p.evaluate(() => { (document.querySelector('#docModal .docMid') || document.querySelector('#docModal .modalcard')).scrollTop = 0; });
    let out = 0; for (let i = 0; i < 60; i++) { await p.keyboard.press('Tab'); if (!(await inside(p))) out++; }
    for (let i = 0; i < 20; i++) { await p.keyboard.press('Shift+Tab'); if (!(await inside(p))) out++; }
    check('Tab and Shift+Tab stay inside the dialog' + tag, out === 0, `${out} stops outside`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    check('Esc closes it and focus goes back to ☰' + tag, await p.evaluate(() => document.getElementById('docModal').hidden && document.activeElement === document.getElementById('dockBtn')));
    // UI-W22: a click inside the card doesn't close it; a click on the backdrop does, like Esc, and changes nothing
    await openIt(p);
    const h = await p.$('#docH'); const hb = await h.boundingBox();
    await p.mouse.click(hb.x + 5, hb.y + hb.height / 2); await p.waitForTimeout(100);
    check('UI-W22: a click inside the sheet leaves it open' + tag, await p.evaluate(() => !document.getElementById('docModal').hidden));
    const pt = await backdropPt(p);
    await p.mouse.move(hb.x + 5, hb.y + hb.height / 2); await p.mouse.down(); await p.mouse.move(pt.x, pt.y, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(100);
    check('UI-W22: a drag from inside the sheet to the backdrop leaves it open' + tag, await p.evaluate(() => !document.getElementById('docModal').hidden));
    const before = await snap(p);
    await p.evaluate(() => { window.__teBehind = 0; const f = e => { if (!document.getElementById('docModal').contains(e.target)) window.__teBehind++; }; ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'].forEach(t => document.addEventListener(t, f, true)); });
    await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(250);
    check('UI-W22: a click on the backdrop closes it and focus goes back to ☰' + tag, await p.evaluate(() => document.getElementById('docModal').hidden && document.activeElement === document.getElementById('dockBtn')));
    check('UI-W22: the click reaches nothing behind the sheet' + tag, await p.evaluate(() => window.__teBehind === 0), String(await p.evaluate(() => window.__teBehind)));
    check('UI-W22: the design and saved state are unchanged' + tag, before === await snap(p));
    if (vp.width === 1366) {
      await openIt(p);
      await p.focus('#docGo'); await p.keyboard.press('Enter');
      await p.waitForSelector('#saveModal:not([hidden])');
      await p.waitForFunction(() => document.getElementById('saveModal').contains(document.activeElement), null, { timeout: 5000 }).catch(() => {});   // the name pop-up has taken focus
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), p.keyboard.press('Enter')]);
      await p.waitForTimeout(300);
      check('a download works from the keyboard', !!dl && /_build_documents\.html$/.test(dl.suggestedFilename()), dl ? dl.suggestedFilename() : 'no download');
      check('after the name pop-up closes, focus is back on the download button', await p.evaluate(() => !document.getElementById('docModal').hidden && document.activeElement === document.getElementById('docGo')));
      await p.keyboard.press('Escape'); await p.waitForTimeout(150);
      check('and Esc still closes the dialog, focus on ☰', await p.evaluate(() => document.getElementById('docModal').hidden && document.activeElement === document.getElementById('dockBtn')));
      await openIt(p); await p.click('#docNo'); await p.waitForTimeout(150);
      check('the close button gives focus back to ☰ too', await p.evaluate(() => document.getElementById('docModal').hidden && document.activeElement === document.getElementById('dockBtn')));
    }
    check('no script errors' + tag, p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - bad.length}/${check.results.length} Build documents dialog checks passed`);
process.exit(bad.length ? 1 : 0);
