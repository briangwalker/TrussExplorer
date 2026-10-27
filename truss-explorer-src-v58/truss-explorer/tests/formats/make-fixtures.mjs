// Makes the current-version fixture files in tests/formats/fixtures/ by driving the built page in Chromium,
// exactly as a person would click "Save bridge file" and "Save sweep file" (#149).
//   node tests/formats/make-fixtures.mjs
// Run it again whenever FILE_VER goes up, and commit the new files next to the old ones (old fixtures are never
// deleted: they are what proves an old file still opens). Nothing personal goes in: the bridges are the
// built-in presets and the sweep is the app's own small starter sweep.
import fs from 'fs';
import path from 'path';
import { serve, browser, openPage, waitRows, here } from '../ui/harness.mjs';

const OUT = path.join(here, '..', 'formats', 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const srv = await serve(), b = await browser();
const tmp = fs.mkdtempSync(path.join(OUT, '.tmp-'));
try {
  const p = await openPage(b, srv.url); await waitRows(p);
  const ver = await p.evaluate(() => TrussFormats.KINDS.bridge.current);
  const release = await p.evaluate(() => document.documentElement.innerHTML.match(/APP_RELEASE = '([^']+)'/)?.[1] || '');
  const grab = async (what, name) => {
    const dl = p.waitForEvent('download');
    await p.click('#dockBtn'); await p.click(`#dockMenu [data-click="${what}"]`);
    await p.waitForSelector('#saveModal:not([hidden])'); await p.uncheck('#saveAsDesign'); await p.click('#saveGo');
    const f = path.join(tmp, name); await (await dl).saveAs(f);
    await p.evaluate(() => document.querySelectorAll('.modal').forEach(m => { m.hidden = true; })); await p.waitForTimeout(300);
    // re-indent so a diff of two fixture versions is readable; the content is unchanged
    const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    fs.writeFileSync(path.join(OUT, name), JSON.stringify(doc, null, 1) + '\n');
    console.log(`wrote ${name} (format ${doc.format}, version ${doc.version}, release ${doc.release})`);
  };
  const tag = `v${ver}-${release}`;
  // 1. the course sample in 2D
  await grab('saveBridge', `${tag}-course-sample-2d.bridge.json`);
  // a small sweep (height x panel count only, so the file stays small enough to commit), run with the Sweep button
  await p.evaluate(() => ['swOnD', 'swVaryOv', 'swOnP'].forEach(id => { const c = document.getElementById(id); if (c && c.checked) { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); } }));
  const before = await p.evaluate(() => __dbg.rows.length);
  await p.$eval('#runSweep', e => e.click());
  await p.waitForFunction(n => __dbg.rows.length > 0 && __dbg.rows.length !== n && !/running|…/i.test(document.getElementById('sweepMsg').textContent), before, { timeout: 120000 });
  await p.waitForTimeout(500);
  await grab('saveSweepFile', `${tag}-height-panels.sweep.json`);
  // 2. the same bridge analysed in 3D, so the 3D setup travels in a fixture too (#154)
  await p.click('#anaSwitch [data-ana="3d"]'); await p.waitForTimeout(600);
  await grab('saveBridge', `${tag}-course-sample-3d.bridge.json`);
  // 3. a preset with a curved bottom chord, so non-default shape fields are covered
  await p.click('#dockBtn'); await p.selectOption('#presetSel', '3'); await p.waitForTimeout(600);
  await grab('saveBridge', `${tag}-shallow-pratt-sag.bridge.json`);
  if (p.errs.length) { console.error('script errors:', p.errs); process.exitCode = 1; }
  await p.close();
} finally {
  await b.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
}
