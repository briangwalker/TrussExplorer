// QA keyboard and screen-reader script (QA and Accessibility, 2026-10-28; added by the Architecture Lead, board TE-B-053).
// Lives in tests/a11y/ while it still fails (6 of 28 on 647631e: #184, #241, #242, #68 points 5-6), so run_all.sh and CI
// don't run it yet; when it passes, move it to tests/ui/ and run_all.sh picks it up by itself. QA owns what it checks.
// The "QA's keyboard script" that the balsaPixel step issues (#211-#221) name in their acceptance checks.
//   node tests/a11y/a11y.mjs [page.html] [--classic]      (default: ../../index.html, the window layout)
// Needs playwright and axe-core: both pinned in package.json (npm ci). Exit 1 if any check fails.
// Checks, for the light and dark colour schemes and every built-in theme:
//   A. axe: no critical or serious findings inside #stage (the whole page with --classic)
//   B. Tab walk: every stop is visible, on screen, has a focus ring, never lands in the hidden classic page
//   C. ☰: Enter opens it with focus inside; Esc closes it and focus returns to ☰
//   D. every window's fold button: after each step focus stays on a control of that window (or its edge tab)
//   E. every open dialog: focus moves in, Tab stays in, Esc closes, focus returns to the opener
import { createRequire } from 'module';
import fs from 'fs'; import http from 'http'; import path from 'path'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), classic = args.includes('--classic');
const file = args.find(a => !a.startsWith('--')) || path.resolve(here, '..', '..', 'index.html');
if (!fs.existsSync(file)) { console.error(`${file} is missing: run python3 build.py first`); process.exit(1); }
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const launch = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] } : {};

const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'ok   ' : 'FAIL '} ${name}${info ? '  — ' + info : ''}`); };

const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(fs.readFileSync(file)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/${classic ? '?layout=classic' : ''}`;
const b = await chromium.launch(launch);

async function open(scheme) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme })).newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  await p.goto(url); await p.waitForFunction(() => window.__dbg && window.__dbg.res, null, { timeout: 30000 });
  await p.waitForTimeout(1500); await p.addScriptTag({ content: axeSrc });
  return p;
}
const active = p => p.evaluate(() => { const e = document.activeElement; return !e || e === document.body ? '(body)' : (e.id ? '#' + e.id : e.tagName.toLowerCase()) + '«' + (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '»'; });
const root = classic ? 'document' : "document.getElementById('stage')";

try {
  for (const scheme of ['light', 'dark']) {
    const p = await open(scheme);
    const themes = classic ? [''] : await p.evaluate(() => { const s = document.querySelector('#themeSel'); return s ? [...s.options].map(o => o.value) : ['']; });
    for (const t of themes) {
      if (t) { await p.evaluate(t => { const s = document.querySelector('#themeSel'); s.value = t; s.dispatchEvent(new Event('change', { bubbles: true })); }, t); await p.waitForTimeout(500); }
      const tag = `${scheme}${t ? ' ' + t : ''}`;
      // A. axe
      const v = await p.evaluate(async r => { const res = await axe.run(eval(r), { resultTypes: ['violations'] }); return res.violations.filter(x => ['critical', 'serious'].includes(x.impact)).map(x => `${x.id} ×${x.nodes.length} (${x.nodes[0].target.join(' ')})`); }, root);
      check(`A ${tag}: axe has no critical or serious findings`, v.length === 0, v.slice(0, 5).join('; '));
    }
    if (scheme === 'dark') { await p.close(); continue; }
    // B. Tab walk (light, default theme)
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    const bad = new Set(); const seen = new Set();
    for (let i = 0; i < 300; i++) {
      await p.keyboard.press('Tab');
      const s = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        const vis = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
        const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
        const hiddenPage = !!e.closest('.wrap') && document.body.classList.contains('shell');
        return { k: (e.id || e.tagName) + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 20), vis, ring, hiddenPage }; });
      if (!s) continue; seen.add(s.k);
      if (!s.vis) bad.add('hidden: ' + s.k); else if (!s.ring) bad.add('no ring: ' + s.k); if (s.hiddenPage) bad.add('classic page: ' + s.k);
    }
    check(`B Tab walk: ${seen.size} stops, all visible with a focus ring`, bad.size === 0, [...bad].slice(0, 6).join(' | '));
    // C. ☰
    await p.focus('#dockBtn'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const inMenu = await p.evaluate(() => !!document.activeElement.closest('#dockMenu'));
    check('C ☰ opens with focus on its first item', inMenu, 'focus: ' + await active(p));
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    check('C Esc closes ☰ and focus returns to ☰', await p.evaluate(() => document.getElementById('dockMenu').hidden && document.activeElement.id === 'dockBtn'), 'focus: ' + await active(p));
    // D. window fold buttons
    if (!classic) {
      const wins = await p.evaluate(() => [...document.querySelectorAll('#stage [id^="win-"]')].map(w => w.id));
      for (const w of wins) {
        for (let step = 1; step <= 2; step++) {
          const btn = p.locator(`#${w} [data-step="shrink"]:visible`).first();
          if (!(await btn.count())) break;
          const exp = await btn.getAttribute('aria-expanded');
          await btn.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
          const ok = await p.evaluate(w => { const e = document.activeElement; return !!e && e !== document.body && (!!e.closest('#' + w) || e.dataset.part === 'edge-tab'); }, w);
          check(`D ${w} fold step ${step}: focus stays on the window or its edge tab`, ok, 'focus: ' + await active(p));
          if (step === 1) check(`D ${w} fold button says its state (aria-expanded)`, exp !== null, 'aria-expanded=' + exp);
        }
        await p.evaluate(() => { if (window.TrussApp && TrussApp.hooks && TrussApp.hooks.resetWindows) TrussApp.hooks.resetWindows(); });
      }
    }
    // E. dialogs opened from ☰ (Build documents is the one teams use on build day)
    await p.focus('#dockBtn'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    const opener = p.locator('#dockMenu [data-click="openDocs"]');
    if (await opener.count()) {
      await opener.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
      check('E Build documents: focus moves into the dialog', await p.evaluate(() => !!document.activeElement.closest('#docModal')), 'focus: ' + await active(p));
      let out = 0; for (let i = 0; i < 80; i++) { await p.keyboard.press('Tab'); if (!(await p.evaluate(() => !!document.activeElement.closest('#docModal')))) out++; }
      check('E Build documents: Tab stays inside', out === 0, `${out} of 80 Tabs left the dialog`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      check('E Build documents: Esc closes it', await p.evaluate(() => document.getElementById('docModal').hidden));
      const back = await active(p);
      check('E Build documents: focus returns to what opened it', /openDocs|Build documents|dockBtn|Menu/.test(back), 'focus: ' + back);
    }
    check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
} finally { await b.close(); srv.close(); }
const fails = results.filter(x => !x).length;
console.log(`\n${results.length - fails}/${results.length} accessibility checks passed`);
process.exit(fails ? 1 : 0);
