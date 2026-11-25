// UI-I10, the results card's half (TE-B-590): while a bridge file's values break the limits table, the results card and the
// key strip show "No result" with the note's first line: never PASS, never a capacity in kg. Fixing the last value (F5)
// brings the kg back. Behind TE_FLAGS.limitsBoxes (?limits=1) until step 8 (#215); without the flag nothing changes.
//   node tests/ui/noresult.mjs
import { serve, browser, openPage, checker } from './harness.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('noresult: ');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'te-noresult-'));
const file = (name, bridge) => { const f = path.join(tmp, name); fs.writeFileSync(f, JSON.stringify({ format: 'se310-truss-bridge', version: 1, name, savedAt: new Date().toISOString(), bridge })); return f; };
const BAD = file('bad.bridge.json', { name: 'Bad', height: 500, panels: 4, mat: { E: 99999 } });
const GOOD = file('good.bridge.json', { name: 'Good', height: 60, panels: 4, mat: { E: 3000 } });
const open = async (p, f) => { await p.setInputFiles('#filePick', f); await p.waitForTimeout(900); };
const card = p => p.evaluate(() => { const c = document.getElementById('resCard'), k = document.getElementById('keyStrip'); return { card: c ? c.textContent : '', key: k ? k.textContent : '' }; });
const errors = [];

try {
  // without the flag: a bad file shows its kg and verdict as before
  {
    const p = await openPage(b, srv.url, { width: 1366, height: 900 });
    p.on('pageerror', e => errors.push(String(e)));
    await open(p, BAD);
    const c = await card(p);
    check('flag off: the card still shows kg and a verdict (as today)', /kg/.test(c.card) && /PASSES|FAILS|UNSTABLE/.test(c.card) && !/No result/.test(c.card), JSON.stringify(c));
    await p.close();
  }
  const p = await openPage(b, srv.url + '?limits=1', { width: 1366, height: 900 });
  p.on('pageerror', e => errors.push(String(e)));
  await p.evaluate(() => document.querySelectorAll('#inputsPane details').forEach(d => { d.open = true; }));
  await open(p, GOOD);
  let c = await card(p);
  check('a good file: the card shows kg and a verdict, no "No result"', /kg/.test(c.card) && /PASSES|FAILS/.test(c.card) && !/No result/.test(c.card), JSON.stringify(c));
  await open(p, BAD);
  c = await card(p);
  check('a bad file: the card says No result', /No result/.test(c.card), JSON.stringify(c));
  check('a bad file: the card has no kg and no PASS or FAILS', !/kg/.test(c.card) && !/PASSES|FAILS/.test(c.card), JSON.stringify(c));
  check("the card carries the note's first line", /2 values are outside the limits/.test(c.card), JSON.stringify(c));
  check('the No result pill is not the fail colour (UI-A18: magenta is for fails)', await p.evaluate(() => { const q = document.querySelector('#resCard .pill'); return !!q && !q.classList.contains('bad') && !q.classList.contains('ok'); }));
  check('the key strip says No result too, with no kg', /No result/.test(c.key) && !/\d kg\b(?! of)/.test(c.key.replace(/books × FS = [\d.]+ kg/, '')), JSON.stringify(c.key));
  const win = await p.evaluate(() => { const st = document.getElementById('stats'), pl = document.getElementById('statusPill'); return { stats: st ? st.textContent : '', pill: pl ? pl.textContent : '' }; });
  check('the Results window: No result, no capacity in kg, no Passes or Fails', /No result/.test(win.pill) && !/Passes|Fails/.test(win.pill) && !/\d kg/.test(win.stats), JSON.stringify(win));
  const ov = await p.evaluate(() => { const S = window.__dbg.S; S.resOnDraw = true; window.TrussApp.redraw(); const o = document.getElementById('resOv'); return o && !o.hidden ? o.textContent : null; });
  check('results on the drawing: no kg either', ov === null || !/\d kg/.test(ov), JSON.stringify(ov));
  // F5: one fixed, still no result; both fixed, the kg comes back
  await p.fill('#height-tb', '60'); await p.press('#height-tb', 'Enter'); await p.waitForTimeout(300);
  c = await card(p);
  check('F5: one value fixed, the other still bad: still No result', /No result/.test(c.card) && /1 value is outside the limits/.test(c.card), JSON.stringify(c));
  await p.fill('#E-tb', '3000'); await p.press('#E-tb', 'Enter'); await p.waitForTimeout(300);
  c = await card(p);
  check('F5: both fixed: the kg and the verdict come back', /kg/.test(c.card) && /PASSES|FAILS/.test(c.card) && !/No result/.test(c.card), JSON.stringify(c));
  // file text stays text on the card
  const XSS = file('x.bridge.json', { name: '<img src=x onerror="window.__ran=1">', height: 500 });
  await open(p, XSS);
  const r = await p.evaluate(() => ({ ran: !!window.__ran, imgs: document.querySelectorAll('#resCard img, #keyStrip img').length, no: /No result/.test(document.getElementById('resCard').textContent) }));
  check('a bad file named like markup: No result, and nothing runs', r.no && !r.ran && r.imgs === 0, JSON.stringify(r));
  check('no page errors', errors.length === 0, errors.join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
const bad = check.results.filter(r => !r.ok);
console.log(`${check.results.length - bad.length}/${check.results.length} no-result checks pass`);
process.exit(bad.length ? 1 : 0);
