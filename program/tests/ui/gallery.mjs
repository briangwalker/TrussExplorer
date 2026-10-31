// The gallery page on the real built page (#384; UI-G1-G5), with the Architecture Lead's guards (TE-B-230):
//  (a) nothing without exactly ?gallery=1, (b) it starts after the page loads, (c) <section id="gallery" data-slot="bg">
//  inside #stage, the app's windows hidden only while it's open, (d) storage byte-identical after a visit,
//  (e) no network, no page errors. Plus UI-G1: every piece and state, labelled, and the coverage list.
//   node tests/ui/gallery.mjs
import { serve, browser, openPage, waitRows, checker, SHOTS } from './harness.mjs';
import path from 'path';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('gallery: ');
const base = srv.url.replace(/\?.*$/, '');

// localStorage plus every record of the IndexedDB store 'big' (cur, last, ckpt), as one string
const snapshot = p => p.evaluate(async () => {
  const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
  const idb = await new Promise(res => { try {
    const r = indexedDB.open('se310-truss', 1); r.onupgradeneeded = () => r.result.createObjectStore('big');
    r.onerror = () => res('no idb'); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('big')) { db.close(); return res({}); }
      const out = {}, tx = db.transaction('big', 'readonly'), st = tx.objectStore('big'), c = st.openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { out[String(cur.key)] = JSON.stringify(cur.value); cur.continue(); } };
      tx.oncomplete = () => { db.close(); res(out); }; tx.onerror = () => { db.close(); res('idb error'); }; };
  } catch (e) { res('no idb'); } });
  return JSON.stringify({ ls: Object.keys(ls).sort().map(k => [k, ls[k]]), idb });
});
// the program keeps writing for a moment after a load (the starter sweep saves its rows): wait until two snapshots 700 ms apart agree
async function settled(p, ms = 20000) {
  let prev = await snapshot(p); const t0 = Date.now();
  while (Date.now() - t0 < ms) { await p.waitForTimeout(700); const cur = await snapshot(p); if (cur === prev) return cur; prev = cur; }
  return prev;
}
const load = async (p, url) => { await p.goto(url, { waitUntil: 'load' }); await p.waitForFunction(() => window.__dbg && window.__dbg.res); await waitRows(p); };
const visible = (p, q) => p.evaluate(q => { const e = document.querySelector(q); if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; }, q);

try {
  // ---------- (a) without exactly ?gallery=1 it does nothing ----------
  for (const q of ['', '?gallery=0', '?gallery', '?gallery=true', '?gallery=1&gallery=1']) {
    const p = await openPage(b, base + q); await p.waitForTimeout(200);
    const none = await p.evaluate(() => !document.getElementById('gallery') && !document.getElementById('te-gallery') && !document.getElementById('te-pieces') && window.TrussGallery && !TrussGallery.active);
    check(`'${q || '(no parameter)'}' builds nothing (UI-G2, guard a)`, none);
    await p.close();
  }

  // ---------- (d) storage: a saved bridge first, then a normal load twice (the baseline), then the gallery ----------
  const p0 = await openPage(b, base); await waitRows(p0); await p0.waitForTimeout(800);
  await p0.evaluate(() => { const h = document.getElementById('h') || document.querySelector('input[type=number]'); if (h) { h.value = String(+h.value + 1); h.dispatchEvent(new Event('input', { bubbles: true })); h.dispatchEvent(new Event('change', { bubbles: true })); } });
  await p0.waitForTimeout(800);
  const ctx = p0.context();
  await load(p0, base);
  const normalReqs = new Set(); const onReq = r => { if (!/^data:|^blob:/.test(r.url())) normalReqs.add(r.url().replace(/\?gallery=1$/, '')); };
  p0.on('request', onReq);
  const before = await settled(p0);
  await load(p0, base);
  const baseline = await settled(p0);
  p0.off('request', onReq);
  check('baseline: two normal loads leave storage the same (so the gallery check below means something)', before === baseline);

  // ---------- open the gallery in the same browser context, so it sees the same storage ----------
  const reqs = [], errs = [];
  const p = p0; p.on('request', r => { if (!/^data:|^blob:/.test(r.url())) reqs.push(r.url()); }); p.on('pageerror', e => errs.push(e.message));
  await load(p, base + '?gallery=1'); await settled(p);
  // (e) the gallery adds no request of its own: everything it loads, a normal load of the program loads too
  const gReqs = reqs.map(u => u.replace(/\?gallery=1$/, '')).filter(u => !normalReqs.has(u));

  // ---------- (b), (c) ----------
  check('?gallery=1 opens it after the page loads (UI-G2, guard b)', await p.evaluate(() => TrussGallery.active && !!document.getElementById('gallery')));
  check('it is <section id="gallery" data-slot="bg"> inside #stage (guard c)', await p.evaluate(() => { const g = document.getElementById('gallery'); return g.tagName === 'SECTION' && g.dataset.slot === 'bg' && g.parentElement.id === 'stage'; }));
  check('the app\'s windows are hidden while it is open (guard c)', !(await visible(p, '#win-inputs')) && !(await visible(p, '#shellNav')) && await visible(p, '#gallery'));
  check('the program underneath still ran (its results exist) and kept its own theme', await p.evaluate(() => !!(window.__dbg && __dbg.res) && !!document.getElementById('stage').dataset.theme));

  // ---------- UI-G1: every piece, every state, labelled; coverage ----------
  const parts = await p.evaluate(() => ['window', 'window-title', 'edge-tab', 'stepper', 'button', 'icon-button', 'chip', 'toggle', 'tabs', 'tab', 'slider', 'slider-band', 'results', 'badge']
    .filter(x => !document.querySelector(`#gallery [data-part="${x}"]`)));
  check('every shared piece is on the page (UI-G1)', parts.length === 0, parts.join(', '));
  check('windows in words, icons and tab, over a picture (UI-G1, UI-A3)', await p.evaluate(() => ['W', 'I', 'T'].every(s => document.querySelector(`#gallery .s-pan[data-state="${s}"]`)) && document.querySelectorAll('#gallery .g-frame .te-picture').length >= 4));
  check('the peek is shown open by the window\'s own code (UI-W9, UI-W17)', await p.evaluate(() => document.getElementById('win-g-peek').classList.contains('peek')) && await visible(p, '#win-g-peek'));
  check('controls default, pressed and disabled; toggles on and off; sliders past a rule and at a wall', await p.evaluate(() => {
    const q = s => document.querySelector('#gallery ' + s);
    return q('.s-b[aria-pressed="true"]') && q('.s-b:disabled') && q('.te-chip[aria-pressed="false"]') && q('[role="switch"][aria-checked="true"]') && q('[role="switch"][aria-checked="false"]')
      && q('.te-slider[data-over="rule"]') && q('.te-slider[data-wall="lo"]') && q('.te-slider[data-swept]');
  }));
  check('the results card passing, failing and unstable, and a pop-up open (UI-G1)', await p.evaluate(() => { const t = document.getElementById('gallery').textContent; return /✓ PASSES/.test(t) && /✕ FAILS/.test(t) && /✕ UNSTABLE/.test(t); }) && await visible(p, '#g-pop'));
  check('every item names its rules (UI-G1)', await p.evaluate(() => [...document.querySelectorAll('#gallery .g-item')].every(f => /(UI|ART)-[A-Z]+\d/.test(f.querySelector('figcaption').textContent))));
  check('pieces not built yet show as cards naming their rules (UI-G3)', await p.evaluate(() => document.querySelectorAll('#gallery [data-g-notbuilt]').length >= 9));
  check('the page ends with the coverage list (UI-G1)', await p.evaluate(() => /UI-A3/.test(document.querySelector('[data-g-shown]').textContent) && /UI-I8/.test(document.querySelector('[data-g-missing]').textContent)));
  check('the contrast table is filled from this theme\'s tokens', await p.evaluate(() => document.querySelectorAll('[data-g-pairs] tbody tr').length >= 10));
  await p.screenshot({ path: path.join(SHOTS, 'gallery-top.png') });

  // ---------- use everything: clicks and keys must stay inside the gallery ----------
  await p.keyboard.press('Escape');
  check('Esc closes the open pop-up and returns focus to the results card (UI-W8)', !(await visible(p, '#g-pop')) && await p.evaluate(() => document.activeElement.id === 'g-res'));
  await p.click('#win-g-left [data-step="shrink"]');
  await p.click('#gallery .te-chip[aria-pressed="false"]');
  await p.click('#gallery [role="switch"][aria-checked="false"]');
  await p.click('#g-tabs-hist'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('End');
  await p.focus('#gallery [data-key="h"] .th.val'); await p.keyboard.press('End'); await p.keyboard.press('Home');
  for (const k of ['h', 't', 'a', 'F6', 'Escape']) await p.keyboard.press(k);   // the app's own keys must not act from inside the gallery
  await p.click('#g-res'); const reopened = await visible(p, '#g-pop'); await p.click('#gallery h1');
  check('the card reopens its pop-up; an outside click closes it and does nothing else (UI-W8)', reopened && !(await visible(p, '#g-pop')));
  await p.mouse.wheel(0, 600); await p.waitForTimeout(300);
  check('the controls worked inside the gallery', await p.evaluate(() => document.getElementById('win-g-left').dataset.state === 'I' && document.getElementById('g-tabs-mem').getAttribute('aria-selected') === 'true'));
  check('the app didn\'t react: still in the same place, gallery still open', await p.evaluate(() => __shell.state.place === 'truss' && TrussGallery.active && !!document.getElementById('gallery')));

  // ---------- themes, through the shell's no-save door when it exists (UI-G3, UI-G4) ----------
  const door = await p.evaluate(() => TrussGallery.door);
  if (door) {
    const ids = await p.evaluate(() => __shell.themes.map(t => t.id));
    const seen = [];
    for (const id of ids) { await p.click(`#gallery [data-act="theme:${id}"]`); await p.waitForTimeout(250); seen.push(await p.evaluate(() => document.getElementById('stage').dataset.theme)); await p.screenshot({ path: path.join(SHOTS, `gallery-${id}.png`), fullPage: false }); }
    check('every built-in theme, OG included, through previewTheme (UI-G1, UI-G3)', ids.includes('og') && ids.every((id, i) => seen[i] === id), JSON.stringify(seen));
  } else {
    check('without the shell\'s no-save door, theme switching is a "not built yet" card (UI-G3; BPD-4 pending)', await p.evaluate(() => /Switching themes in the gallery/.test(document.getElementById('gallery').textContent) && !document.querySelector('#gallery [data-act^="theme:"]')));
  }

  // ---------- (d) and (e) ----------
  const after = await settled(p);
  check('storage is byte-identical after the visit (UI-G4, guard d)', after === baseline, after === baseline ? '' : 'changed');
  check('the gallery adds no network request of its own (guard e)', gReqs.length === 0, gReqs.slice(0, 3).join(' '));
  check('no page errors (guard e)', errs.length === 0, errs.join(' | '));

  // ---------- leaving: the program is exactly as it was (UI-G4) ----------
  await load(p, base); const left = await settled(p);
  check('leaving the gallery shows the program as it was (UI-G4)', await p.evaluate(() => !document.getElementById('gallery')) && await visible(p, '#win-inputs') && left === baseline);
  await ctx.close();
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`${check.results.length - bad.length}/${check.results.length} gallery checks pass`);
process.exit(bad.length ? 1 : 0);
