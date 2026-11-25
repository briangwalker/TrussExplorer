// UI-I10 file case (Physics F1-F5): a bridge file whose values break the limits table opens, nothing is clamped, each bad
// value is marked on its box and listed in one note at the top of the Inputs window; the note goes once all are fixed.
// Behind TE_FLAGS.limitsBoxes (?limits=1) until step 8 (#215). Without the flag nothing changes.
//   node tests/ui/filebad.mjs
import { serve, browser, openPage, checker } from './harness.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('filebad: ');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'te-filebad-'));
const file = (name, bridge) => { const f = path.join(tmp, name); fs.writeFileSync(f, JSON.stringify({ format: 'se310-truss-bridge', version: 1, name, savedAt: new Date().toISOString(), bridge })); return f; };
const BAD = file('bad.bridge.json', { name: 'Bad', height: 500, panels: 4, mat: { E: 99999 } });
const GOOD = file('good.bridge.json', { name: 'Good', height: 60, panels: 4, mat: { E: 3000 } });
const open = async (p, f) => { await p.setInputFiles('#filePick', f); await p.waitForTimeout(900); };
const st = (p, id) => p.evaluate(id => { const el = document.querySelector(`.te-num[data-for="${id}"]`); return { v: el.querySelector('input').value, state: el.dataset.state || '', app: document.getElementById(id).value }; }, id);
const note = p => p.evaluate(() => { const n = document.getElementById('fileBad'); return n ? { text: n.textContent, first: n === document.getElementById('inputsPane').firstElementChild, role: n.getAttribute('role'), btn: n.querySelector('button') && n.querySelector('button').textContent } : null; });

try {
  // without the flag: a bad file opens exactly as before, no note
  {
    const p = await openPage(b, srv.url, { width: 1366, height: 900 });
    await open(p, BAD);
    const r = await p.evaluate(() => ({ note: !!document.getElementById('fileBad'), msg: document.getElementById('fileMsg').textContent }));
    check('flag off: no note, and the open line has no limits text (as today)', !r.note && !/outside the limits/.test(r.msg), JSON.stringify(r));
    await p.close();
  }
  const p = await openPage(b, srv.url + '?limits=1', { width: 1366, height: 900 });
  await p.evaluate(() => document.querySelectorAll('#inputsPane details').forEach(d => { d.open = true; }));
  // F4: a good file gets nothing new
  await open(p, GOOD);
  let n = await note(p);
  let msg = await p.textContent('#fileMsg');
  check('F4: a good file: no note, no limits text', n === null && !/outside the limits/.test(msg), msg);
  // F1-F3: the bad file opens, values kept as the file had them, marked, all listed in one note at the top
  await open(p, BAD);
  const h = await st(p, 'height'), E = await st(p, 'E');
  check('F3: height kept as the file had it (500), never clamped, marked as a file value', h.v === '500' && h.app === '500' && h.state === 'file', JSON.stringify(h));
  check('F3: E kept (99999) and marked', E.v === '99999' && E.app === '99999' && E.state === 'file', JSON.stringify(E));
  await p.click('#inputsPane', { position: { x: 5, y: 5 } }); await p.waitForTimeout(200);
  check('a click anywhere (limitrows rechecks every row) keeps the file marks', (await st(p, 'height')).state === 'file' && (await st(p, 'E')).state === 'file');
  n = await note(p);
  check('F2: one note at the top of the Inputs window lists both values', !!n && n.first && n.role === 'status' && /2 values are outside the limits/.test(n.text) && /Height/.test(n.text) && /\bE\b/.test(n.text), JSON.stringify(n));
  msg = await p.textContent('#fileMsg');
  check('F1: the open line says it too', /2 values are outside the limits/.test(msg), msg);
  check('the note starts with the file glyph and lists each value with its units (UI-I10)', !!n && /^\u27c2 /.test(n.text) && /Height 500 mm/.test(n.text) && /Stiffness \(E\) 99999 MPa/.test(n.text), JSON.stringify(n));
  check('the Fix button sits on its own line', await p.evaluate(() => { const g = document.querySelector('#fileBad button'); return !!g && !!g.previousSibling && g.previousSibling.nodeName === 'BR'; }));
  check('the first fix is one click away (button names it)', !!n && /^Fix Height/.test(n.btn || ''), JSON.stringify(n));
  await p.click('#fileBad button');
  check('the Fix button focuses the height box', await p.evaluate(() => document.activeElement && document.activeElement.id) === 'height-tb');
  // F5: fixing one leaves the note; fixing both clears it
  await p.fill('#height-tb', '60'); await p.press('#height-tb', 'Enter'); await p.waitForTimeout(300);
  check('F5: one fixed, the other still listed: the note stays', (await note(p)) !== null && (await st(p, 'height')).state !== 'file');
  await p.fill('#E-tb', '3000'); await p.press('#E-tb', 'Enter'); await p.waitForTimeout(300);
  check('F5: both fixed: the note goes', (await note(p)) === null, JSON.stringify(await note(p)));
  // text in the file never becomes markup in the note
  const XSS = file('x.bridge.json', { name: '<img src=x onerror="window.__ran=1">', height: 500 });
  await open(p, XSS);
  const r = await p.evaluate(() => ({ ran: !!window.__ran, imgs: document.querySelectorAll('#fileBad img').length, note: !!document.getElementById('fileBad') }));
  check('the note is text only', r.note && !r.ran && r.imgs === 0, JSON.stringify(r));
  // a second open replaces the note, it never stacks
  await open(p, BAD);
  check('a second open: still one note', await p.evaluate(() => document.querySelectorAll('#fileBad').length) === 1);
  await open(p, GOOD);
  check('a good file after a bad one: the note goes', (await note(p)) === null);
  // QA and UI Designer MUST on #517: Fix opens a collapsed group before it focuses the box
  const EONLY = file('e.bridge.json', { name: 'E only', height: 60, panels: 4, mat: { E: 99999 } });
  await p.evaluate(() => { document.getElementById('g-loads').open = false; });
  await open(p, EONLY);
  n = await note(p);
  check('E only: the button names E', !!n && /^Fix Stiffness \(E\)/.test(n.btn || ''), JSON.stringify(n));
  await p.click('#fileBad button');
  const fx = await p.evaluate(() => ({ id: document.activeElement && document.activeElement.id, open: document.getElementById('g-loads').open }));
  check('E only with Loads collapsed: Fix opens the group and focuses the E box', fx.id === 'E-tb' && fx.open === true, JSON.stringify(fx));
  check('no page errors', p.errs.length === 0, p.errs.join(' | '));
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`${check.results.length - bad.length}/${check.results.length} file-values checks pass`);
process.exit(bad.length ? 1 : 0);
