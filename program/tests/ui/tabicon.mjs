// ART-O3 (Brian's decision 72a, TE-B-757): the tab icon is one of Graphics' four (A pixel b, B cream b, C truss b, D TE mark),
// picked at random on each page load. It stays the same for the whole visit and never changes while the page is open, and it
// is not a setting the person picks. build.py inlines the four as data: icons (TE-B-317) and a one-line script picks one.
import { serve, browser, openPage, checker, ROOT } from './harness.mjs';
import fs from 'fs';
import path from 'path';
const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
const four = path.join(ROOT, '..', 'docs', 'art-website-pack', 'favicon', 'four');
const FOUR = ['a-pixel-b', 'b-cream-b', 'c-truss-b', 'd-te-mark'].map(n => 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(path.join(four, n + '.svg'), 'utf8').trim(), 'utf8').toString('base64'));
const icon = p => p.evaluate(() => { const l = document.querySelectorAll('link[rel="icon"]'); return { n: l.length, href: l.length ? l[0].href : '' }; });
try {
  const seen = new Set(); let errs = 0, bad = 0, n = 0;
  for (let i = 0; i < 12; i++) {
    const p = await openPage(b, srv.url);
    const a = await icon(p);
    if (a.n !== 1) n++;
    if (!FOUR.includes(a.href)) bad++;
    seen.add(FOUR.indexOf(a.href));
    errs += p.errs.length;
    if (i === 0) {
      // the pick holds for the visit: a theme change, a place change and a resize leave it alone
      await p.evaluate(() => { const t = document.querySelector('[data-go="analysis"]'); t && t.click(); });
      await p.setViewportSize({ width: 1024, height: 700 }); await p.waitForTimeout(800);
      const c = await icon(p);
      check('ART-O3: the icon stays the same for the whole visit', c.href === a.href, `${FOUR.indexOf(a.href)} -> ${FOUR.indexOf(c.href)}`);
    }
    await p.close();
  }
  check('ART-O3: the page has exactly one icon link on every load', n === 0, `${n} loads with another count`);
  check('ART-O3: every load shows one of the four icons from the art pack', bad === 0, `${bad} loads with another icon`);
  check('ART-O3: over 12 loads the pick varies (two or more of A, B, C, D seen)', seen.size >= 2, 'seen: ' + [...seen].sort().join(','));
  check('no script errors', errs === 0, `${errs} errors`);
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} tab-icon checks passed`);
process.exit(fails.length ? 1 : 0);
