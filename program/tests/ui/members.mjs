// The Members tab's table (#416, TE-B-332; UI-S6, UI-H4, UI-A17, UI-A18) on the real built page (balsaPixel layout).
//  1. its CSV is byte for byte the app's own "Copy table as CSV" (csvText(), less its "# " header lines);
//  2. the table, mounted on the stage with the shared table piece: every member, highest use first, hover / arrows / Enter
//     light a row and report it (UI-H4), light(k) from outside, one Tab stop, T/C in the app's colours (UI-A18),
//     text 13 px or more and 4.5 : 1 or better, in light and dark.
//   node tests/ui/members.mjs
import { serve, browser, openPage, checker } from './harness.mjs';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker('members: ');

// mount the table on the stage, the way the Dev Lead's wiring will (a window body inside #stage)
async function mount(p) {
  await p.evaluate(() => {
    const P = window.TrussPieces, V = window.TrussMembersView, app = window.TrussApp;
    P.install(document); V.install(document);
    const box = document.createElement('div'); box.id = 'mvTest'; box.dataset.pc = '';
    box.style.cssText = 'position:absolute;left:20px;top:20px;width:900px;max-height:600px;overflow:auto;z-index:500;background:var(--te-surface);padding:8px';
    const rows = window.TrussMembers.rows(null, app.res);
    box.innerHTML = V.toolbarHTML(P) + V.tableHTML(P, rows, { typeLabel: window.TrussExport.TYPE_LABEL, id: 'mvT' });
    document.getElementById('stage').appendChild(box);
    window.mvLog = [];
    window.mvT = P.mountTable(document.getElementById('mvT'), { onHover: k => mvLog.push('hover:' + k), onPick: k => mvLog.push('pick:' + k), onSort: k => mvLog.push('sort:' + k) });
  });
}

try {
  const p = await openPage(b, srv.url);
  // ---------- 1. the CSV equals the app's own ----------
  const got = await p.evaluate(async () => {
    let text = null; navigator.clipboard.writeText = async t => { text = t; };
    document.getElementById('copyCsv').click();
    for (let n = 0; n < 50 && text == null; n++) await new Promise(r => setTimeout(r, 20));
    const V = window.TrussMembersView;
    const mine = V.csvOf(V.csvRows(window.TrussMembers.rows(null, window.TrussApp.res), window.TrussExport.TYPE_LABEL));
    return { app: text == null ? null : text.split('\n').filter(l => !l.startsWith('# ')).join('\n'), mine, n: window.TrussApp.res.members.length };
  });
  check('the app\'s Copy table as CSV answered', got.app != null);
  check(`its CSV is byte for byte the app's (${got.n} members)`, got.app === got.mine, got.app === got.mine ? '' : `app ${JSON.stringify((got.app || '').slice(0, 120))} vs ${JSON.stringify(got.mine.slice(0, 120))}`);

  // ---------- 2. the table on the stage ----------
  await mount(p);
  const order = await p.evaluate(() => {
    const keys = [...document.querySelectorAll('#mvT tbody tr[data-key]')].map(r => +r.dataset.key);
    const use = Object.fromEntries(window.TrussMembers.rows(null, window.TrussApp.res).map(r => [r.k, r.use]));
    return { keys, n: window.TrussApp.res.members.length, sorted: keys.every((k, i) => i === 0 || use[keys[i - 1]] >= use[k]) };
  });
  check('every member has a row (UI-S6)', order.keys.length === order.n && new Set(order.keys).size === order.n, `${order.keys.length} of ${order.n}`);
  check('highest use first (UI-S6)', order.sorted);
  const k0 = order.keys[0], k1 = order.keys[1];
  await p.hover(`#mvT tr[data-key="${k1}"] td:nth-child(4)`);
  check('hover lights the row and reports the member (UI-H4)', await p.evaluate(k => document.querySelector(`#mvT tr[data-key="${k}"]`).classList.contains('lit') && mvLog.at(-1) === 'hover:' + k, k1), await p.evaluate(() => mvLog.join(' ')));
  await p.mouse.move(1400, 880);
  check('leaving the table reports none', await p.evaluate(() => mvLog.at(-1) === 'hover:null' && !document.querySelector('#mvT tr.lit')));
  check('one Tab stop for the whole table', await p.evaluate(() => document.querySelectorAll('#mvT [tabindex="0"]').length === 1));
  // the APG grid keys (ui-spec 1.5.7 UI-S6): cell by cell, one Tab stop, the lit member follows the focused row
  const at = () => p.evaluate(() => { const e = document.activeElement, tr = e.closest('tr'); return { key: tr && tr.dataset.key, ci: tr ? [...tr.children].indexOf(e.closest('th,td')) : -1, sort: !!e.closest('.te-sort'), tab: e.tabIndex, n: tr ? tr.children.length : 0 }; });
  check('the table is a grid (APG)', await p.evaluate(() => document.getElementById('mvT').getAttribute('role') === 'grid'));
  await p.focus(`#mvT tr[data-key="${k0}"] > :first-child`); await p.keyboard.press('ArrowDown');
  let a = await at();
  check('↓ moves to the next row\'s cell and lights that member (UI-H4)', a.key === String(k1) && a.ci === 0 && a.tab === 0 && await p.evaluate(k => document.querySelector(`#mvT tr[data-key="${k}"]`).classList.contains('lit') && mvLog.at(-1) === 'hover:' + k, k1), JSON.stringify(a));
  await p.keyboard.press('ArrowRight'); a = await at();
  check('→ moves one cell along the row', a.key === String(k1) && a.ci === 1, JSON.stringify(a));
  await p.keyboard.press('End'); a = await at();
  check('End goes to the last cell of the row', a.ci === a.n - 1, JSON.stringify(a));
  await p.keyboard.press('Home'); a = await at();
  check('Home goes to the first cell of the row', a.key === String(k1) && a.ci === 0, JSON.stringify(a));
  await p.keyboard.press('Control+End'); a = await at();
  check('Ctrl+End goes to the last row', a.key === String(order.keys.at(-1)) && a.ci === a.n - 1, JSON.stringify(a));
  await p.keyboard.press('Control+Home'); a = await at();
  check('Ctrl+Home goes to the first row', a.key === String(k0) && a.ci === 0, JSON.stringify(a));
  check('still one Tab stop after moving', await p.evaluate(() => document.querySelectorAll('#mvT [tabindex="0"]').length === 1));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowRight');
  await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab'); a = await at();
  check('Tab back in returns to the last cell (one Tab stop, APG)', a.key === String(k1) && a.ci === 1, JSON.stringify(a));
  await p.keyboard.press('Enter');
  check('Enter picks the row: it stays picked (aria-selected, UI-H4)', await p.evaluate(k => document.querySelector(`#mvT tr[data-key="${k}"]`).getAttribute('aria-selected') === 'true' && mvLog.includes('pick:' + k), k1));
  // the sort header: ↑ from the first row reaches it; it is the only aria-sort, and its button reports the sort
  await p.keyboard.press('Control+Home');
  for (let n = 0; n < 12; n++) await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowUp'); a = await at();
  check('↑ from the first row reaches the Use header\'s sort button', a.sort, JSON.stringify(a));
  check('Use carries the only aria-sort, descending (UI-S6 1.5.7)', await p.evaluate(() => { const s = [...document.querySelectorAll('#mvT [aria-sort]')]; return s.length === 1 && s[0].getAttribute('aria-sort') === 'descending' && /Use/.test(s[0].textContent); }));
  await p.keyboard.press('Enter');
  check('Enter on the sort button asks for the sort', await p.evaluate(() => mvLog.at(-1) === 'sort:use'), await p.evaluate(() => mvLog.slice(-3).join(' ')));
  // sideways: in a narrow window the Member column and the header row stay in place (UI-S6, UI-W23)
  await p.evaluate(() => { document.getElementById('mvTest').style.width = '320px'; });
  await p.focus(`#mvT tr[data-key="${k0}"] > :first-child`); await p.keyboard.press('End');
  const pin = await p.evaluate(() => { const box = document.getElementById('mvTest'), rh = document.activeElement.closest('tr').firstElementChild, bl = box.getBoundingClientRect().left, rl = rh.getBoundingClientRect().left; return { scrolled: box.scrollLeft, gap: Math.round(rl - bl), seen: (() => { const r = document.activeElement.getBoundingClientRect(), b = box.getBoundingClientRect(); return r.right <= b.right + 1 && r.left >= b.left - 1; })() }; });
  check('sideways scrolling follows focus, and the Member column stays in place', pin.scrolled > 0 && pin.gap <= 12 && pin.seen, JSON.stringify(pin));
  check('the All columns switch is above the table', await p.evaluate(() => { const t = document.querySelector('#mvTest [role="switch"]'); return !!t && /All columns/.test(t.closest('label').textContent) && t.compareDocumentPosition(document.getElementById('mvT')) & 4; }));
  await p.evaluate(k => mvT.light(k), k0);
  check('light(k) from the bridge picks that row and only it', await p.evaluate(k => [...document.querySelectorAll('#mvT [aria-selected="true"]')].map(r => r.dataset.key).join() === String(k), k0));
  await p.click(`#mvT tr[data-key="${k1}"] td:nth-child(2)`);
  check('a click picks a row', await p.evaluate(k => mvT.picked === String(k), k1));
  // UI-A18: the T/C letters take the app's own colours
  const tc = await p.evaluate(() => {
    const one = q => { const e = document.querySelector(q); if (!e) return null; const s = document.createElement('span'); s.style.color = q.includes('tc-T') ? 'var(--tens)' : 'var(--comp)'; e.parentNode.appendChild(s); const want = getComputedStyle(s).color; s.remove(); return getComputedStyle(e).color === want; };
    return [one('#mvT .mv-tc.tc-T'), one('#mvT .mv-tc.tc-C')];
  });
  check('T and C are drawn in the app\'s --tens / --comp colours, and spelled out (UI-A17, UI-A18)', tc.every(x => x !== false) && tc.some(x => x === true) && await p.evaluate(() => /tension|compression/.test(document.getElementById('mvT').textContent)), JSON.stringify(tc));
  check('numbers line up right-aligned in a monospace face', await p.evaluate(() => { const c = getComputedStyle(document.querySelector('#mvT td.num')); return c.textAlign === 'right' && /mono/i.test(c.fontFamily); }), await p.evaluate(() => getComputedStyle(document.querySelector('#mvT td.num')).fontFamily));
  check('no page errors', p.errs.length === 0, p.errs.join(' | '));
  await p.close();

  // text size and contrast, light and dark (ART-C1, UI-T1)
  for (const scheme of ['light', 'dark']) {
    const d = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    await d.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
    await d.goto(srv.url, { waitUntil: 'load' }); await d.waitForFunction(() => window.__dbg && window.__dbg.res);
    await mount(d);
    await d.evaluate(() => mvT.light(document.querySelector('#mvT tbody tr[data-key]').dataset.key));
    const low = await d.evaluate(() => {
      const P = window.TrussPieces, bad = [], small = [];
      const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/rgba?\(([^)]+)\)/); if (m) { const v = m[1].split(',').map(Number); if (v.length < 4 || v[3] > 0.5) return c; } } return 'rgb(255,255,255)'; };
      const rgb = c => 'rgb(' + c.match(/[\d.]+/g).slice(0, 3).join(',') + ')';
      document.querySelectorAll('#mvTest *').forEach(el => {
        if (el.closest('[aria-hidden="true"]')) return;
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
        const cs = getComputedStyle(el); if (parseFloat(cs.fontSize) < 13) small.push(el.tagName + ' ' + cs.fontSize);
        const r = P.contrast(rgb(cs.color), rgb(bgOf(el)));
        if (r < 4.5) bad.push({ app: !!el.closest('.mv-tc.tc-T,.mv-tc.tc-C,.mv-fail'), t: `${el.tagName.toLowerCase()}.${el.className} ${r.toFixed(2)}` });
      });
      return { bad, small };
    });
    const mine = low.bad.filter(x => !x.app), app = low.bad.filter(x => x.app);
    check(`${scheme}: table text is 13 px or more (UI-T1)`, low.small.length === 0, low.small.slice(0, 3).join(' | '));
    check(`${scheme}: table text is at least 4.5 : 1, zebra and lit rows too (ART-C1)`, mine.length === 0, mine.slice(0, 4).map(x => x.t).join(' | '));
    // KNOWN (CODE-T3): in dark mode the app's meaning colours switch to their dark values on the light stage (#393)
    check(`${scheme}: the app's T/C and fail colours read at 4.5 : 1`, app.length === 0, app.slice(0, 3).map(x => x.t).join(' | '), '#393');
    await d.close();
  }
} finally { await b.close(); srv.close(); }
const bad = check.results.filter(r => !r.ok);
console.log(`${check.results.length - bad.length}/${check.results.length} members checks pass`);
process.exit(bad.length ? 1 : 0);
