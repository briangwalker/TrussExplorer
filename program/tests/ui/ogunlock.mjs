// #221 / #162 (UI-T6): the OG (v61) look is hidden until the first finished sweep or 20 minutes of use; then it's listed,
// a toast says so once, the OG badge shows while OG is the look, and the unlock survives a reload (TrussUnlocks state in S.shell).
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';
const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
const opts = p => p.evaluate(() => [...document.querySelectorAll('#themeSel option')].map(o => o.value));
try {
  const p = await openPage(b, srv.url); await waitRows(p);
  check('fresh page: OG is not in the theme picker, the note says how it unlocks', !(await opts(p)).includes('og') && /unlocks after/.test(await p.evaluate(() => document.getElementById('themeNote').textContent)));
  check('fresh page: ogUnlocked() is false and the badge is hidden', await p.evaluate(() => __shell.ogUnlocked() === false && document.getElementById('themeBadge').hidden));
  await p.evaluate(() => __shell.applyTheme('og')); await p.waitForTimeout(100);
  check('applying og while locked falls back to the default theme (Notebook + Calculator)', await p.evaluate(() => document.getElementById('stage').dataset.theme === 'notebook-calc' && __shell.state.theme === 'notebook-calc'));
  // the time path: 19.5 minutes saved, then one tick (at most 60 s more) -> still locked; a saved 20 minutes less a moment -> the next tick unlocks
  await p.evaluate(() => { __shell.state.unlocks = { firstSweepAt: null, usedMs: 19.5 * 60000, lastTickMs: null }; });
  await p.waitForTimeout(150);
  check('a tick at 19.5 minutes of use does not unlock', await p.evaluate(() => __shell.noteUnlock('tick') === false));
  // seed so the total (saved + this visit's memory) sits 50 ms short of 20 minutes; the next tick (150 ms later) passes it
  await p.evaluate(() => { const inMem = __shell.unlockState.usedMs - __shell.state.unlocks.usedMs; __shell.state.unlocks = { firstSweepAt: null, usedMs: 20 * 60000 - 50 - inMem, lastTickMs: null }; });
  check('just short of 20 minutes: still locked', await p.evaluate(() => __shell.ogUnlocked() === false));
  await p.waitForTimeout(150);
  check('a tick that passes 20 minutes unlocks', await p.evaluate(() => __shell.noteUnlock('tick') === true));
  check('the unlock is saved at once (whole use time folded in)', await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('se310-truss-v5')); return s.shell.unlocks.usedMs >= 20 * 60000; }));
  await p.waitForTimeout(100);
  const t1 = await p.evaluate(() => { const t = document.querySelector('.te-toast'); return t && !t.hidden ? t.textContent : ''; });
  check('the unlock shows one toast (UI-W10) that names OG and where to find it', /OG/.test(t1) && /Theme/.test(t1), t1);
  check('OG is now in the picker', (await opts(p)).includes('og'));
  await p.evaluate(() => __shell.applyTheme('og')); await p.waitForTimeout(100);
  check('OG applies and the OG badge shows (UI-T6)', await p.evaluate(() => document.getElementById('stage').dataset.theme === 'og' && !document.getElementById('themeBadge').hidden && document.getElementById('themeBadge').textContent === 'OG'));
  await p.evaluate(() => __shell.applyTheme('wireframe')); await p.waitForTimeout(50);
  check('back on Wireframe the badge hides', await p.evaluate(() => document.getElementById('themeBadge').hidden));
  await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__shell, null, { timeout: 15000 });
  check('after a reload OG stays unlocked (saved state)', await p.evaluate(() => __shell.ogUnlocked() === true) && (await opts(p)).includes('og'));
  // the sweep path on a fresh state: a finished sweep unlocks at once, however little time was used
  await p.evaluate(() => { __shell.state.unlocks = { firstSweepAt: null, usedMs: 0, lastTickMs: null }; });
  check('fresh state again: locked', await p.evaluate(() => __shell.ogUnlocked() === false));
  check("'sweep-finished' unlocks at once", await p.evaluate(() => __shell.noteUnlock('sweep-finished') === true));
  // a damaged saved state never throws and reads as fresh
  await p.evaluate(() => { __shell.state.unlocks = 'junk'; });
  check('a damaged state reads as fresh, nothing throws', await p.evaluate(() => { try { return __shell.noteUnlock('tick') === false && typeof __shell.state.unlocks === 'object'; } catch (e) { return false; } }));
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} OG-unlock checks passed`);
process.exit(fails.length ? 1 : 0);
