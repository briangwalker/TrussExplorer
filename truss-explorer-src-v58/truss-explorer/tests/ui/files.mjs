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
  // ---------- #154: a bridge file carries the 3D setup and the build-document settings to a partner
  {
    const p = await openPage(b, srv.url); await waitRows(p);
    await p.click('#anaSwitch [data-ana="3d"]'); await p.waitForTimeout(400);
    // tilt 10, bottom ties off, X on top (a non-default bracing), imperfection loads on
    await p.evaluate(() => { const S = __dbg.S; S.d3.topPat = ['X']; S.d3.botPat = ['S']; S.d3.framePat = ['X']; });
    await p.fill('#tilt3d', '10'); await p.dispatchEvent('#tilt3d', 'change');
    await p.uncheck('#botTies3d').catch(() => {}); await p.check('#imperf3d'); await p.waitForTimeout(400);
    // build-document settings: stock 200, square joints, kerf 2, one joint override
    await p.click('#dockBtn'); await p.click('#dockMenu [data-click="openDocs"]'); await p.waitForSelector('#docModal:not([hidden])');
    await p.fill('#docStock', '200'); await p.dispatchEvent('#docStock', 'change');
    await p.fill('#docKerf', '2'); await p.dispatchEvent('#docKerf', 'change');
    await p.check('input[name="jstyle"][value="square"]');
    await p.selectOption('#docJoints select[data-f="end"] >> nth=0', 'flush');
    const mine = await p.evaluate(() => ({ ana: __dbg.S.anaMode, wood: +__dbg.res.wood.toFixed(1), sum: document.getElementById('docSum').textContent, stock: document.getElementById('docStock').value, kerf: document.getElementById('docKerf').value, style: document.querySelector('input[name="jstyle"]:checked').value, over: Object.keys(__dbg.S.doc.over).length, tilt: __dbg.S.d3.tilt, ties: __dbg.S.d3.botTies, imp: __dbg.S.d3.imperf.on }));
    await p.click('#docNo');
    const dl = p.waitForEvent('download'); await p.click('#dockBtn'); await p.click('#dockMenu [data-click="saveBridge"]'); await p.waitForSelector('#saveModal:not([hidden])'); await p.click('#saveGo');
    const file = path.join(tmp, 'shared.bridge.json'); await (await dl).saveAs(file);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    check('#154: the file says which release, model and rules made it', saved.release && saved.model === '3D' && saved.rules && saved.rules.FS > 0 && saved.version >= 2, JSON.stringify({ r: saved.release, m: saved.model, v: saved.version }));
    await p.close();
    // a partner with a fresh browser opens it
    const q = await openPage(b, srv.url); await waitRows(q);
    await open(q, 'bridge', file); await q.waitForTimeout(600);
    await q.click('#dockBtn'); await q.click('#dockMenu [data-click="openDocs"]'); await q.waitForSelector('#docModal:not([hidden])');
    const theirs = await q.evaluate(() => ({ ana: __dbg.S.anaMode, wood: +__dbg.res.wood.toFixed(1), sum: document.getElementById('docSum').textContent, stock: document.getElementById('docStock').value, kerf: document.getElementById('docKerf').value, style: document.querySelector('input[name="jstyle"]:checked').value, over: Object.keys(__dbg.S.doc.over).length, tilt: __dbg.S.d3.tilt, ties: __dbg.S.d3.botTies, imp: __dbg.S.d3.imperf.on }));
    check('#154: opens in 3D with the same wood as the file', theirs.ana === '3d' && Math.abs(theirs.wood - saved.summary.wood) < 0.15, JSON.stringify({ ana: theirs.ana, wood: theirs.wood, file: saved.summary.wood }));
    check('#154: same 3D setup (tilt, bottom ties, imperfection loads)', theirs.tilt == mine.tilt && theirs.ties === mine.ties && theirs.imp === mine.imp, JSON.stringify([mine, theirs].map(x => [x.tilt, x.ties, x.imp])));
    check('#154: same build-document settings and summary', ['stock', 'kerf', 'style', 'over', 'sum'].every(k => theirs[k] === mine[k]), JSON.stringify({ mine: [mine.stock, mine.kerf, mine.style, mine.over], theirs: [theirs.stock, theirs.kerf, theirs.style, theirs.over] }));
    // a file saved before v61 (no anaMode) opens in the model its wood matches
    const old = JSON.parse(JSON.stringify(saved)); delete old.bridge.anaMode; old.version = 1; delete old.release;
    const q2 = await openPage(b, srv.url); await waitRows(q2);
    await open(q2, 'bridge', write('old.bridge.json', old)); await q2.waitForTimeout(600);
    const o2 = await q2.evaluate(() => ({ ana: __dbg.S.anaMode, wood: +__dbg.res.wood.toFixed(1), msg: document.getElementById('toast').textContent }));
    check('#154: an older file opens in the model its wood matches, and says so', o2.ana === '3d' && Math.abs(o2.wood - saved.summary.wood) < 0.15 && /before v61/.test(o2.msg), JSON.stringify(o2));
    check('#154: no script errors', p.errs.length + q.errs.length + q2.errs.length === 0, q.errs.concat(q2.errs).slice(0, 2).join(' | '));
    await q.close(); await q2.close();
  }
  // ---------- #158: either Open button takes either kind of file
  {
    const p = await openPage(b, srv.url); await waitRows(p);
    const sw = write('two.sweep.json', { format: 'se310-truss-sweep', version: 2, name: 'Two', savedAt: new Date().toISOString(), rows: [{ wood: 3000, capKg: 9, util: 0.5, D: 0.1, overall: 300, side: 90, mass: 4, height: 70, panels: 4, members: 21, passes: true, envOK: true, edgeOK: true, overlap: 50, pattern: 'pratt', family: 'grid' }, { wood: 3100, capKg: 10, util: 0.4, D: 0.1, overall: 300, side: 90, mass: 4, height: 72, panels: 4, members: 21, passes: true, envOK: true, edgeOK: true, overlap: 50, pattern: 'pratt', family: 'grid' }] });
    await open(p, 'bridge', sw);
    const r = await p.evaluate(() => ({ rows: __dbg.rows.length, msg: document.getElementById('toast').textContent }));
    check('#158: a sweep file through Open bridge file opens as a sweep, and says so', r.rows === 2 && /sweep file, so it opened as a sweep/.test(r.msg), JSON.stringify(r));
    await open(p, 'sweep', write('x.json', { hello: 1 }));
    check('#158: anything else is named plainly', /not a bridge or sweep file/.test(await p.textContent('#toast')));
    await p.close();
  }
  // ---------- #156: a number box never shows one value while the app uses another
  {
    const p = await openPage(b, srv.url); await waitRows(p);
    await p.click('#anaSwitch [data-ana="3d"]'); await p.waitForTimeout(400);
    await p.evaluate(() => { const g = document.getElementById('g-3d'); if (g) g.open = true; });
    const tryBox = async (id, v) => { await p.fill(id, String(v)); await p.dispatchEvent(id, 'change'); await p.waitForTimeout(150); return { box: await p.inputValue(id), msg: await p.textContent('#toast') }; };
    const used = () => p.evaluate(() => ({ tilt: +__dbg.S.d3.tilt, width: +__dbg.S.opts.width, stock: +__dbg.S.doc.stock, kerf: +__dbg.S.doc.kerf }));
    const u0 = await used();
    for (const [id, v, key] of [['#tilt3d', 89, 'tilt'], ['#width3d', 0, 'width'], ['#width3d', -10, 'width'], ['#width3d', 500, 'width'], ['#width', 500, 'width']]) {
      const r = await tryBox(id, v), u = await used();
      check(`#156: ${id} = ${v} is refused, the box shows the value in use`, +r.box === u[key] && u[key] === u0[key] && /must be/.test(r.msg), JSON.stringify({ box: r.box, used: u[key], msg: r.msg }));
    }
    await p.click('#dockBtn'); await p.click('#dockMenu [data-click="openDocs"]'); await p.waitForSelector('#docModal:not([hidden])');
    for (const [id, v, key] of [['#docStock', 0, 'stock'], ['#docStock', '', 'stock'], ['#docStock', -5, 'stock'], ['#docKerf', -1, 'kerf'], ['#docKerf', 1000, 'kerf']]) {
      const r = await tryBox(id, v), u = await used();
      check(`#156: ${id} = "${v}" is refused, the box shows the value in use`, +r.box === u[key] && u[key] === u0[key], JSON.stringify({ box: r.box, used: u[key], msg: r.msg }));
    }
    await tryBox('#docStock', 50);
    check('#156: stock shorter than a piece that can\'t be spliced is warned about', /can't be spliced/.test(await p.textContent('#docSum')), (await p.textContent('#docSum')).slice(0, 160));
    check('#156: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
  // ---------- every export says which release, model and rules made it, with the same bridge code
  {
    const p = await openPage(b, srv.url); await waitRows(p);
    const grab = async (what, sel) => { const dl = p.waitForEvent('download'); await p.click('#dockBtn'); await p.click(`#dockMenu [data-click="${what}"]`);
      if (sel) { await p.waitForSelector(sel); await p.click(sel === '#docModal:not([hidden])' ? '#docGo' : sel); }
      await p.waitForSelector('#saveModal:not([hidden])'); await p.uncheck('#saveAsDesign'); await p.click('#saveGo'); const f = path.join(tmp, 'x-' + what); await (await dl).saveAs(f);
      await p.evaluate(() => document.querySelectorAll('.modal').forEach(m => { m.hidden = true; })); await p.waitForTimeout(300); return fs.readFileSync(f, 'latin1'); };
    const bridge = JSON.parse(await grab('saveBridge')), code = bridge.bridgeCode;
    const outs = { csv: await grab('dlCsv'), py: await grab('dlPy'), lp: await grab('dlLp'), docs: await grab('openDocs', '#docModal:not([hidden])'), sweep: await grab('saveSweepFile') };
    check('exports: the bridge file has a release, model and bridge code', /^(v\d+|balsaPixel \d+\.\d+)/.test(bridge.release) && bridge.model && /^[0-9a-f]{8}$/.test(code), JSON.stringify({ r: bridge.release, m: bridge.model, code }));
    for (const [k, txt] of Object.entries(outs)) check(`exports: ${k} carries the release and the same bridge code`, txt.includes(bridge.release) && txt.includes(code), txt.slice(0, 120).replace(/\s+/g, ' '));
    check('exports: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
  // ---------- #179: a sweep saved from ☰ as .tsweep opens again with the same rows and message, through the same Open button
  {
    const p = await openPage(b, srv.url); await waitRows(p);
    await p.evaluate(() => { const d = document.getElementById('s-sweep'); if (d) d.open = true; });
    await p.click('#runSweep'); await p.waitForFunction(() => (__dbg.rows || []).length > 0 && !document.getElementById('runSweep').disabled && !/Running/.test(document.getElementById('sweepMsg').textContent), null, { timeout: 120000 });
    const before = await p.evaluate(() => ({ n: __dbg.rows.length, rows: JSON.stringify(__dbg.rows.map(r => [r.height, r.panels, r.pattern, +r.wood.toFixed(2), +r.capKg.toFixed(3), r.passes])), msg: document.getElementById('sweepMsg').textContent }));
    const dl = p.waitForEvent('download'); await p.click('#dockBtn'); await p.click('#dockMenu [data-click="saveSweepTsweep"]');
    await p.waitForSelector('#saveModal:not([hidden])'); const ext = await p.textContent('#saveExt'); await p.click('#saveGo');
    const file = path.join(tmp, 'mine.tsweep'); await (await dl).saveAs(file);
    const bytes = fs.readFileSync(file);
    check('#179: ☰ Save compact sweep writes a gzip .tsweep', ext === '.tsweep' && bytes[0] === 0x1f && bytes[1] === 0x8b, `${ext}, ${bytes.length} B`);
    await p.reload(); await waitRows(p);
    await open(p, 'sweep', file); await p.waitForTimeout(600);
    const after = await p.evaluate(() => ({ n: __dbg.rows.length, rows: JSON.stringify(__dbg.rows.map(r => [r.height, r.panels, r.pattern, +r.wood.toFixed(2), +r.capKg.toFixed(3), r.passes])), msg: document.getElementById('sweepMsg').textContent }));
    check('#179: the .tsweep opens with the same rows', after.n === before.n && after.rows === before.rows, `${before.n} -> ${after.n}`);
    check('#179: and the same summary', after.msg.includes(before.msg.slice(0, 40)), after.msg.slice(0, 120));
    check('#179: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
} finally {
  await b.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
}
const fails = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} file checks passed`);
process.exit(fails.length ? 1 : 0);
