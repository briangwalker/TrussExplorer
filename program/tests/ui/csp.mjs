// #297 (WH-N3): the built page runs under the Content-Security-Policy that build.py writes to index.csp.txt, with no
// 'unsafe-inline' for scripts: every inline <script> is allowed by its hash, and nothing else may run.
import { browser, checker, ROOT } from './harness.mjs';
import fs from 'fs';
import http from 'http';
import path from 'path';

const html = fs.readFileSync(path.join(ROOT, 'index.html'));
const policy = fs.readFileSync(path.join(ROOT, 'index.csp.txt'), 'utf8').split('\n').find(l => l && !l.startsWith('#'));
const srv = await new Promise(res => { const s = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.setHeader('content-security-policy', policy); r.end(html); }); s.listen(0, '127.0.0.1', () => res(s)); });
const url = `http://127.0.0.1:${srv.address().port}/`;
const b = await browser();
const check = checker();
// the page still links Google Fonts until the fonts are self-hosted (ART-T1, #268 and the ui.html <link>): KNOWN, not a failure
const KNOWN = /fonts\.(googleapis|gstatic)\.com/;
try {
  check('the policy has no unsafe-inline or unsafe-eval for scripts', !/script-src[^;]*unsafe-(inline|eval)/.test(policy));
  for (const layout of ['', '?layout=classic']) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    const v = [], errs = [];
    await p.exposeFunction('__cspv', s => v.push(s));
    await p.addInitScript(() => document.addEventListener('securitypolicyviolation', e => window.__cspv(`${e.violatedDirective} ${e.blockedURI || ''}`)));
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(url + layout, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__dbg && window.__dbg.res && (__dbg.rows || []).length > 0, null, { timeout: 90000 });
    const real = v.filter(s => !KNOWN.test(s));
    // one hash per script element the browser actually parsed (a '<script>' inside a JS string is not one)
    if (!layout) { const n = await p.evaluate(() => document.scripts.length); check('one hash per script element', (policy.match(/'sha256-/g) || []).length === n, `${n} scripts`); }
    check(`${layout || 'window layout'}: the page solves and runs its starter sweep under the policy`, await p.evaluate(() => !!__dbg.res.stable && __dbg.rows.length > 0));
    check(`${layout || 'window layout'}: no CSP violations`, real.length === 0, real.slice(0, 3).join(' | '));
    if (v.length > real.length) console.log(`KNOWN ${v.length - real.length} Google Fonts loads blocked (self-hosted fonts: ART-T1)`);
    check(`${layout || 'window layout'}: no script errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
    await p.close();
  }
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} CSP checks passed`);
process.exit(fails.length ? 1 : 0);
