// #256: a new design keeps its generated name (autoName) through a rename, in the file it saves, and when that file reopens.
import { serve, browser, openPage, checker } from './harness.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
const srv = await serve();
const b = await browser();
const check = checker();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'te-autoname-'));
try {
  const p = await openPage(b, srv.url);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.__dbg && window.__dbg.res);
  const first = await p.evaluate(() => ({ name: __dbg.S.name, auto: __dbg.S.autoName, ok: TrussNames.looksGenerated(__dbg.S.autoName) }));
  check('a first visit gets an autoName equal to its generated name', first.ok && first.auto === first.name, JSON.stringify(first));
  await p.fill('#name', 'Our Friday bridge'); await p.dispatchEvent('#name', 'input');
  check('renaming the design keeps the autoName', await p.evaluate(a => __dbg.S.name === 'Our Friday bridge' && __dbg.S.autoName === a, first.auto));
  const dl = p.waitForEvent('download'); await p.click('#dockBtn'); await p.click('#dockMenu [data-click="saveBridge"]'); await p.waitForSelector('#saveModal:not([hidden])');
  await p.uncheck('#saveAsDesign').catch(() => {}); await p.click('#saveGo');
  const file = path.join(tmp, 'a.bridge.json'); await (await dl).saveAs(file);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('the saved file carries it, at the top and in the bridge', saved.autoName === first.auto && saved.bridge.autoName === first.auto && saved.name === 'Our Friday bridge', JSON.stringify({ a: saved.autoName, b: saved.bridge.autoName, n: saved.name }));
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.__dbg && window.__dbg.res);
  await p.click('#dockBtn'); await p.waitForSelector('#dockMenu:not([hidden])');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#dockMenu [data-click="loadBridge"]')]); await fc.setFiles(file); await p.waitForTimeout(600);
  check('reopening the file brings the autoName back', await p.evaluate(a => __dbg.S.autoName === a && __dbg.S.name === 'Our Friday bridge', first.auto));
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} autoName checks passed`);
process.exit(fails.length ? 1 : 0);
