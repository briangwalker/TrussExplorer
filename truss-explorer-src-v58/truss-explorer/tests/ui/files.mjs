// Opening files (bridge and sweep): what comes out of a file is data only, and opening it gives the same bridge.
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';

const srv = await serve();
const b = await browser();
const check = checker();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'te-files-'));
const write = (name, obj) => { const f = path.join(tmp, name); fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj)); return f; };
const open = async (p, which, file) => { await p.evaluate(w => { window.__pick = w; }, which); await p.click('#dockBtn'); await p.waitForSelector('#dockMenu:not([hidden])');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click(`#dockMenu [data-click="${which === 'bridge' ? 'loadBridge' : 'loadSweepFile'}"]`)]); await fc.setFiles(file); await p.waitForTimeout(600); };

try {
  // ---------- text in a file is shown as text, never as markup, wherever it lands
  {
    const p = await openPage(b, srv.url); await waitRows(p);
    p.on('dialog', d => { check('no dialog opened by a file', false, d.message()); d.dismiss(); });
    const mark = '<img src=x onerror="window.__ran=1">';
    const sweep = { format: 'se310-truss-sweep', version: 1, name: 'S' + mark, savedAt: new Date().toISOString(), message: mark, mode: 'sweep',
      ctx: { FS: 2, bookKg: 2.5, defl: 2, minOv: 5, sheet: { kind: 'Sweep' + mark, when: new Date().toISOString(), tested: 1, total: '1' + mark, analysis: '2D' + mark, FS: 2, bookKg: 2.5, defl: 2, minOv: 5, fixed: mark, rows: [{ name: 'h' + mark, from: '10' + mark, to: 20, step: 5, count: 3 }] } },
      rows: [{ wood: 'x' }, { wood: 3000, overall: 300, side: 90, mass: 4, members: 21, capKg: 9, util: 0.5, D: 0.1, passes: true, envOK: true, edgeOK: true, overlap: 50, height: 70, panels: 4, pattern: 'pratt' + mark, family: 'grid', label: mark }],
      bridge: { name: 'B' + mark }, '__proto__': { polluted: 1 } };
    await open(p, 'sweep', write('evil.sweep.json', JSON.stringify(sweep).replace('"__proto__"', '"__proto__"')));
    await p.evaluate(() => { const d = document.getElementById('s-sweep'); if (d) d.open = true; const t = document.getElementById('s-track'); if (t) t.open = true; });
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => ({ ran: !!window.__ran, imgs: [...document.querySelectorAll('img')].filter(i => /^x$|\/x$/.test(i.getAttribute('src') || '')).length, polluted: ({}).polluted }));
    check('opening a crafted sweep file runs nothing', !r.ran && r.imgs === 0, JSON.stringify(r));
    check('a file cannot change built-in objects', r.polluted === undefined);
    // save it to compare (the saved-sweeps list) and show the data sheet
    await p.evaluate(() => { window.__ran = 0; });
    await p.fill('#cmpName', 'n' + mark).catch(() => {}); await p.click('#saveSweep').catch(() => {}); await p.waitForTimeout(400);
    const r2 = await p.evaluate(() => ({ ran: !!window.__ran, imgs: [...document.querySelectorAll('img')].filter(i => /^x$|\/x$/.test(i.getAttribute('src') || '')).length }));
    check('saved-sweep list and data sheet show the text as text', !r2.ran && r2.imgs === 0, JSON.stringify(r2));
    // a crafted bridge file
    await p.evaluate(() => { window.__ran = 0; });
    await open(p, 'bridge', write('evil.bridge.json', { format: 'se310-truss-bridge', version: 1, name: 'B' + mark, savedAt: new Date().toISOString(), bridge: { name: 'D' + mark, panels: 4 } }));
    const r3 = await p.evaluate(() => ({ ran: !!window.__ran, name: document.getElementById('name').value }));
    check('a crafted bridge file name is plain text', !r3.ran && !/</.test(r3.name), JSON.stringify(r3));
    check('crafted files: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
} finally {
  await b.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
}
const fails = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} file checks passed`);
process.exit(fails.length ? 1 : 0);
