// Shared bits for the Playwright tests: a tiny server for index.html, a browser, and check().
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

export const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
export const SHOTS = path.join(ROOT, 'tests', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

// Serve the built page the way GitHub Pages does (UTF-8 declared in the header). Pass {charset:false} to serve it bare.
export function serve(file = path.join(ROOT, 'index.html'), { charset = true } = {}) {
  return new Promise(res => {
    const srv = http.createServer((q, r) => { r.setHeader('content-type', charset ? 'text/html; charset=utf-8' : 'text/html'); r.end(fs.readFileSync(file)); });
    srv.listen(0, '127.0.0.1', () => res({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() }));
  });
}

export async function browser() { return chromium.launch(); }

// A page with Google Fonts answered empty (no network here) and errors collected
export async function openPage(b, url, viewport = { width: 1440, height: 900 }) {
  const p = await b.newPage({ viewport });
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__dbg && window.__dbg.res, null, { timeout: 15000 });
  return p;
}
// the starter sweep builds in the background after load; wait for it instead of sleeping 20-25 s
export const waitRows = (p, ms = 60000) => p.waitForFunction(() => (__dbg.rows || []).length > 0, null, { timeout: ms });

// known: ticket ID of a defect already filed. It's reported but doesn't fail the run.
export function checker(prefix = '') {
  const results = [];
  const check = (name, ok, info = '', known = '') => {
    const k = !ok && known;
    results.push({ name: prefix + name, ok: !!ok || !!k });
    console.log(`${ok ? 'ok   ' : k ? 'KNOWN' : 'FAIL '} ${prefix}${name}${info !== '' ? '  — ' + info : ''}${k ? '  [' + known + ']' : ''}`);
  };
  check.results = results;
  return check;
}
