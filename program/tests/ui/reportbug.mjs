// #115 Report a bug (UI-W14, UI-W13, UI-W22, UI-W23, UI-A21; White Hat TE-B-136, TE-B-315): ☰'s last row opens a dialog
// that names what the link carries; its button saves TE-bug-<code>.truss and opens the fixed form address in a new tab
// (a plain link, noopener noreferrer) carrying only version, model and bridge code; Esc and the backdrop close it.
import { serve, browser, openPage, waitRows, checker } from './harness.mjs';
const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSfyuQGRg7v4PAn3nU8owBNG84E3ukX3w4WCOAkwjL7MWnJWgg/viewform';
const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
async function openDialog(p) {
  await p.click('#dockBtn'); await p.waitForTimeout(200);
  return p.evaluate(() => { const m = document.getElementById('dockMenu'), vis = [...m.children].filter(e => e.offsetParent && !e.classList.contains('dsep'));
    const last = vis[vis.length - 1]; const r = { last: last && last.id, text: last && last.textContent.trim() }; document.getElementById('reportBugBtn').click(); return r; });
}
try {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
  await ctx.route(u => !/^http:\/\/(127\.0\.0\.1|localhost)/.test(u.toString()), r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>form</title>' }));
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(srv.url); await waitRows(p);
  const m = await openDialog(p); await p.waitForTimeout(200);
  check('UI-W14: Report a bug is the last row of ☰', m.last === 'reportBugBtn' && /Report a bug/.test(m.text), JSON.stringify(m));
  const d = await p.evaluate(() => { const md = document.getElementById('bugModal'), card = md.querySelector('[role=dialog]'), go = document.getElementById('bugGo'), r = go.getBoundingClientRect();
    return { open: !md.hidden, modal: card.getAttribute('aria-modal'), name: document.getElementById(card.getAttribute('aria-labelledby')).textContent, focus: document.activeElement === go,
      rel: document.getElementById('bugRel').textContent, model: document.getElementById('bugModel').textContent, code: document.getElementById('bugCode').textContent,
      href: go.href, tech: document.getElementById('bugTech').textContent, target: go.target, relAttr: go.rel, btnOn: r.top >= 0 && r.bottom <= innerHeight, text: card.textContent }; });
  check('UI-W13: a named, modal dialog with focus on its main button', d.open && d.modal === 'true' && d.name === 'Report a bug' && d.focus, JSON.stringify({ ...d, text: undefined }));
  check('UI-W14: it lists version, model and bridge code, and says no name, email or files go by the link', /^1\.0\.0-alpha\.\d+$/.test(d.rel) && /^[23]D$/.test(d.model) && /^[0-9a-f]{8}$/.test(d.code) && /No name, email or files/.test(d.text), JSON.stringify({ rel: d.rel, model: d.model, code: d.code }));
  check('White Hat: a plain link in a new tab, noopener noreferrer, to the ONE fixed form address', d.href.startsWith(FORM) && d.target === '_blank' && /noopener/.test(d.relAttr) && /noreferrer/.test(d.relAttr), d.href);
  const q = new URL(d.href).searchParams, keys = [...q.keys()];
  const want = { 'entry.1594388703': d.rel, 'entry.700670228': d.model, 'entry.1525333786': d.code };
  check('the link pre-fills exactly version, model, bridge code and technical details (Brian\'s four fields), nothing else',
    keys.sort().join() === ['usp', 'entry.1594388703', 'entry.700670228', 'entry.1525333786', 'entry.1232166955'].sort().join() && q.get('usp') === 'pp_url' && Object.entries(want).every(([k, v]) => q.get(k) === v), d.href);
  check('White Hat (TE-B-341 note 1): every field name is entry.<digits>, plus usp=pp_url only', keys.every(k => k === 'usp' || /^entry\.[0-9]+$/.test(k)) && q.getAll('usp').length === 1, keys.join());
  const tech = q.get('entry.1232166955');
  check('technical details: the same text the dialog shows, under 2,000 characters in the link', tech === d.tech && d.href.length < 2000, `${d.href.length} chars`);
  check('technical details: White Hat\'s cleared items (reduced browser, sizes, theme, view, windows, language, pointer, counts, storage, last error)',
    /^\S+ \d* ?\/ \S+/.test(tech) && /win \d+x\d+, screen \d+x\d+ @[\d.]+/.test(tech) && /theme \w/.test(tech) && /lang \w/.test(tech) && /pointer (touch|mouse)/.test(tech) && /joints \d+, members \d+, sweep rows \d+/.test(tech) && /storage (yes|no)/.test(tech) && /last error /.test(tech), tech);
  const ua = await p.evaluate(() => navigator.userAgent), nm = await p.evaluate(() => __dbg.S.name);
  check('never the full user agent, the design name or the page address', !tech.includes(ua) && !tech.includes('Mozilla') && !(nm && tech.includes(nm)) && !tech.includes('127.0.0.1'), tech);
  check('UI-A21 / UI-W23: Save bridge and open form is on screen without scrolling at 1280 x 720', d.btnOn);
  // the click saves TE-bug-<code>.truss and opens the form in a new tab
  const [dl, pop] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null), p.click('#bugGo')]);
  check('it saves the bridge as TE-bug-<code>.truss', !!dl && dl.suggestedFilename() === `TE-bug-${d.code}.truss`, dl ? dl.suggestedFilename() : 'no download');
  if (dl) { const txt = await (await import('fs')).promises.readFile(await dl.path(), 'utf8'); const doc = JSON.parse(txt);
    check('the saved file is a normal bridge file that says which release made it', doc.format === 'se310-truss-bridge' && doc.release === d.rel && doc.bridgeCode === d.code, JSON.stringify({ f: doc.format, r: doc.release, c: doc.bridgeCode })); }
  check('the form opens in a new tab', !!pop && pop.url().startsWith(FORM), pop ? pop.url() : 'no tab');
  await p.waitForTimeout(300);
  check('the dialog closes after it', await p.evaluate(() => document.getElementById('bugModal').hidden));
  // Esc and the backdrop close it, and focus goes back
  await openDialog(p); await p.waitForTimeout(150); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  check('Esc closes it and focus goes back to ☰ (the menu it was opened from)', await p.evaluate(() => document.getElementById('bugModal').hidden && document.activeElement === document.getElementById('dockBtn')));
  await openDialog(p); await p.waitForTimeout(150); await p.click('#bugCancel'); await p.waitForTimeout(150);
  check('Cancel closes it and focus goes back to ☰', await p.evaluate(() => document.getElementById('bugModal').hidden && document.activeElement === document.getElementById('dockBtn')));
  await openDialog(p); await p.waitForTimeout(150); await p.mouse.click(5, 715); await p.waitForTimeout(150);
  check('UI-W22: a click on the backdrop closes it', await p.evaluate(() => document.getElementById('bugModal').hidden));
  // focus stays inside while it's open
  await openDialog(p); await p.waitForTimeout(150); for (let i = 0; i < 6; i++) await p.keyboard.press('Tab');
  check('UI-W13: Tab stays inside the dialog', await p.evaluate(() => document.getElementById('bugModal').contains(document.activeElement)));
  await p.keyboard.press('Escape');
  // a typed design name: the Leave names out box shows, ticked
  await p.evaluate(() => { const n = document.getElementById('name') || document.querySelector('input[aria-label*="name" i]'); if (n) { n.value = 'Somebody Typed'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); } });
  await openDialog(p); await p.waitForTimeout(150);
  check('#260: a typed design name shows "Leave names out", ticked', await p.evaluate(() => !document.getElementById('bugNamesRow').hidden && document.getElementById('bugNames').checked));
  // White Hat (TE-B-341 note 2): with the name left out, the code is the SAVED file's code, in the dialog, the link and the file name
  const dn = await p.evaluate(() => { const g = id => document.getElementById(id); const on = { code: g('bugCode').textContent, href: g('bugGo').href }; g('bugNames').click(); const off = { code: g('bugCode').textContent, href: g('bugGo').href }; g('bugNames').click(); return { on, off, back: g('bugCode').textContent }; });
  check('unticking "Leave names out" changes the code shown and in the link, ticking it again puts it back', dn.on.code !== dn.off.code && dn.back === dn.on.code && new URL(dn.on.href).searchParams.get('entry.1525333786') === dn.on.code && new URL(dn.off.href).searchParams.get('entry.1525333786') === dn.off.code, JSON.stringify(dn));
  const [dl2, pop2] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.context().waitForEvent('page', { timeout: 8000 }).catch(() => null), p.click('#bugGo')]);
  if (pop2) await pop2.close().catch(() => {});
  let d2 = null; if (dl2) { d2 = JSON.parse(await (await import('fs')).promises.readFile(await dl2.path(), 'utf8')); }
  check('names left out: the saved file has no typed name, and its code matches the dialog, the link and the file name', !!d2 && !JSON.stringify(d2).includes('Somebody Typed') && d2.bridgeCode === dn.on.code && dl2.suggestedFilename() === `TE-bug-${dn.on.code}.truss`, d2 ? JSON.stringify({ c: d2.bridgeCode, n: d2.name, fn: dl2.suggestedFilename() }) : 'no download');
  const fnv = o => { const t = JSON.stringify(o); let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };   // the app's fingerprint() (50-files.js)
  check('and the code is the fingerprint of the bridge inside the saved file', !!d2 && fnv(d2.bridge) === d2.bridgeCode, d2 ? fnv(d2.bridge) + ' vs ' + d2.bridgeCode : '');
  // QA (TE-B-315): 'last error' carries only a plain error kind and the script's own file:line, never typed text or a file name
  const le = await p.evaluate(() => { const e = new Error('Somebody Typed my.truss'); e.name = 'Somebody Typed my.truss'; window.dispatchEvent(new ErrorEvent('error', { error: e, message: e.message, filename: 'https://x.test/a/My Bridge.truss?q=1', lineno: 7 })); const zero = bugLastErrFor();
    const t = new TypeError('Somebody Typed'); window.dispatchEvent(new ErrorEvent('error', { error: t, message: t.message, filename: 'https://x.test/app.js?v=2#h', lineno: 12 })); const one = bugLastErrFor();
    window.dispatchEvent(new ErrorEvent('error', { error: { name: 'Plain' }, message: 'x', filename: 'app.js', lineno: 3 })); const two = bugLastErrFor();
    return { zero, one, two }; function bugLastErrFor() { document.getElementById('reportBugBtn').click(); const s = document.getElementById('bugTech').textContent; document.getElementById('bugCancel').click(); return s; } });
  check('last error: a plain kind + file:line only, nothing typed and no file name', /last error Error at page:7$/.test(le.zero) && /last error TypeError at app\.js:12$/.test(le.one) && /last error Error at app\.js:3$/.test(le.two) && !/Somebody|\.truss|x\.test/.test(le.zero + le.one), JSON.stringify(le));
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  // phone
  const ph = await b.newContext({ viewport: { width: 390, height: 844 } }); const q2 = await ph.newPage(); await q2.goto(srv.url); await waitRows(q2);
  await openDialog(q2); await q2.waitForTimeout(200);
  check('UI-A21: the main button is on screen at 390 x 844 too', await q2.evaluate(() => { const r = document.getElementById('bugGo').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; }));
  await ph.close(); await ctx.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} Report a bug checks passed`);
process.exit(fails.length ? 1 : 0);
