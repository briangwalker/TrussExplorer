// The v51–v58 Playwright tests (t66–t75), turned into checks (TE-002). One server, one browser.
// Usage: node tests/ui/regressions.mjs [--slow]     (--slow adds t71, a pilot + time-limited large search, ~1 min)
import { serve, browser, openPage, waitRows, checker, SHOTS } from './harness.mjs';
import path from 'path';

const slow = process.argv.includes('--slow');
const srv = await serve();
const b = await browser();
const check = checker();
const shot = (p, name, el) => (el ? p.locator(el).screenshot({ path: path.join(SHOTS, name) }) : p.screenshot({ path: path.join(SHOTS, name) })).catch(() => {});

async function section(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;   // ONLY=t66 node tests/ui/regressions.mjs
  console.log(`\n-- ${name}`);
  try { await fn(); } catch (e) { check(`${name} ran to the end`, false, e.message.split('\n')[0]); }
}

try {
  // t66 (v51): the bridge view is still on the page and moves only in full screen
  await section('t66 still bridge view', async () => {
    const p = await openPage(b, srv.url);
    const vb = () => p.$eval('#draw', e => e.getAttribute('viewBox'));
    const v0 = await vb(); const dw = await p.locator('#draw').boundingBox();
    await p.mouse.move(dw.x + 200, dw.y + 100); await p.mouse.wheel(0, -500); await p.waitForTimeout(150);
    check('2D: wheel on the page view does not zoom', v0 === await vb());
    check('2D: no nav pad on the page view', !(await p.isVisible('#drawWrap .navpad')));
    await p.click('.fsbtn[data-fs="#sideSheet"]'); await p.waitForTimeout(400);
    const f = await p.locator('#draw').boundingBox(); await p.mouse.move(f.x + f.width / 2, f.y + f.height / 2); await p.mouse.wheel(0, -500); await p.waitForTimeout(150);
    check('2D: wheel in full screen zooms', v0 !== await vb());
    check('2D: nav pad shown in full screen', await p.isVisible('#fsFill .navpad'));
    await p.click('#dockEsc'); await p.waitForTimeout(300);
    check('2D: leaving full screen restores the view', v0 === await vb());
    await p.click('#anaSwitch [data-ana="3d"]'); await p.waitForTimeout(500);
    // compare the camera, not the picture: the drag ends in a click, which highlights the member under it
    const cam = () => p.evaluate(() => JSON.stringify([__v3.yaw, __v3.pitch, __v3.zoom, __v3.px, __v3.py]));
    const img = () => p.$eval('#c3d', e => e.toDataURL().length);
    const k0 = await cam(); const c = await p.locator('#c3d').boundingBox();
    await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await p.mouse.down(); await p.mouse.move(c.x + c.width / 2 + 150, c.y + c.height / 2, { steps: 5 }); await p.mouse.up(); await p.mouse.wheel(0, -400); await p.waitForTimeout(150);
    check('3D: drag/wheel on the page view does not move it', k0 === await cam());
    check('3D: no view cube on the locked page view', !(await p.isVisible('#topD3Slot .navcube')));
    await p.click('.fsbtn[data-fs="#sideSheet"]'); await p.waitForTimeout(400);
    const c2 = await p.locator('#c3d').boundingBox(); const j0 = await img();
    await p.mouse.move(c2.x + c2.width / 2, c2.y + c2.height / 2); await p.mouse.down(); await p.mouse.move(c2.x + c2.width / 2 + 150, c2.y + c2.height / 2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
    check('3D: drag in full screen turns it', j0 !== await img());
    check('3D: view cube shown in full screen', await p.isVisible('#fsFill .navcube'));
    check('t66: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  });

  // t67 (v52): "All groups are hidden" notice, and the 3D Move/Lock view button
  await section('t67 all-hidden notice, Move/Lock view', async () => {
    const p = await openPage(b, srv.url); await waitRows(p);
    await p.evaluate(() => { document.getElementById('s-track').open = true; });
    await p.selectOption('#groupBy', 'pattern'); await p.waitForTimeout(400);
    for (const tab of ['trade', 'c3', 'curve']) {
      await p.evaluate(t => { __dbg.S.tab = t; __dbg.drawTrackers(); }, tab); await p.waitForTimeout(300);
      const lg = { trade: '#tradeLegend', c3: '#c3Legend', curve: '#curveLegend' }[tab];
      const ha = await p.$(lg + ' [data-hideall]');
      if (ha) await ha.click();
      else { await p.evaluate(l => document.querySelectorAll(l + ' [data-g]').forEach(s => { __dbg.S.hideG[__dbg.S.groupBy + '|' + s.dataset.g] = 1; }), lg); await p.evaluate(() => __dbg.drawTrackers()); }
      await p.waitForTimeout(300);
      const vis = await p.isVisible('.allhid');
      check(`${tab}: notice shows when every group is hidden`, vis);
      if (vis) { await p.click('.allhid button'); await p.waitForTimeout(300); }
      check(`${tab}: notice goes after Show all`, !(await p.isVisible('.allhid')));
    }
    await p.click('#anaSwitch [data-ana="3d"]'); await p.waitForTimeout(500);
    const st = () => p.evaluate(() => JSON.stringify([__v3.yaw, __v3.zoom]));
    const drag = async () => { await p.$eval('#c3d', e => e.scrollIntoView({ block: 'center' })); const c = await p.locator('#c3d').boundingBox(); await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await p.mouse.down(); await p.mouse.move(c.x + c.width / 2 + 150, c.y + c.height / 2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150); };
    const s0 = await st(); await drag();
    check('locked 3D view does not move', s0 === await st());
    await p.click('#free3d'); await drag();
    check('after Move view the 3D view turns', s0 !== await st());
    check('view cube shown while unlocked', await p.isVisible('#topD3Slot .navcube'));
    await p.click('#free3d');
    check('Lock view puts it back', s0 === await st());
    check('t67: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  });

  // t69 (v54): 3D input labels, tilt editor, drag-to-edit on 3D, data switch
  await section('t69 3D labels and editor', async () => {
    const p = await openPage(b, srv.url, { width: 1600, height: 1000 });
    await p.click('#anaSwitch [data-ana="3d"]'); await p.waitForTimeout(800);
    for (const id of ['showIds', 'showForces', 'showDef', 'showGhosts', 'showDims']) await p.$eval('#' + id, e => { if (!e.checked) e.click(); });
    for (const id of ['showElems', 'resOnDraw']) await p.$eval('#' + id, e => { if (e.checked) e.click(); });
    await p.waitForTimeout(400); await p.$eval('#c3d', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
    const labs = await p.$$eval('.d3lab', l => l.map(x => x.textContent));
    check('3D input labels drawn', labs.length >= 5, labs.length + ' labels');
    await shot(p, 't69-3d.png', '#c3d');
    await p.click('.d3lab[data-var="tilt3d"]'); await p.waitForTimeout(300);
    check('label editor opens over the 3D view', await p.isVisible('#dimPop') && await p.$eval('#dimPop', e => e.parentElement.contains(document.getElementById('c3d'))));
    await p.fill('#dpVal', '12'); await p.press('#dpVal', 'Enter'); await p.$eval('#dpVal', e => e.dispatchEvent(new Event('change'))); await p.waitForTimeout(500);
    check('tilt set from the editor', await p.$eval('#tilt3d', e => e.value) === '12');
    await p.click('#dpClose');
    const c = await p.locator('#c3d').boundingBox();
    await p.click('.d3lab[data-var="height"]'); await p.waitForTimeout(200);
    const h0 = await p.$eval('#height', e => e.value);
    await p.mouse.move(c.x + 300, c.y + 300); await p.mouse.down(); await p.mouse.move(c.x + 300, c.y + 220, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(400);
    const h1 = await p.$eval('#height', e => e.value);
    check('dragging on 3D changes the picked input', h0 !== h1, `${h0} -> ${h1}`);
    await p.$eval('#dpClose', e => e.click());
    await p.click('#toggleData2'); await p.waitForTimeout(200);
    check('data-and-notes switch leaves the sweep open', await p.$eval('#s-sweep', e => e.open));
    check('t69: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  });

  // t70 (v54): sweep rows load back with the same wood, in 2D and 3D, and a 2D sweep is flagged in 3D
  await section('t70 sweep rows reload exactly', async () => {
    const p = await openPage(b, srv.url, { width: 1600, height: 1000 }); await waitRows(p);
    const pick = () => p.evaluate(() => { const rows = __dbg.rows.filter(r => r.passes).sort((a, b) => a.wood - b.wood); return [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]].map(r => { const w = r.wood; __dbg.load(r); return [Math.round(w), Math.round(__dbg.res.wood)]; }); });
    const a = await pick();
    check('2D sweep, 2D mode: row wood = loaded wood', a.every(([x, y]) => x === y), JSON.stringify(a));
    await p.click('#anaSwitch [data-ana="3d"]'); await p.waitForTimeout(2500);
    check('2D sweep shown in 3D mode is flagged', await p.isVisible('.staleMsg'));
    await p.$eval('#runSweep', e => e.click());
    await p.waitForFunction(() => /3D/.test(JSON.stringify(window.__dbg.ctx || {})) || !document.querySelector('.staleMsg') || document.querySelector('.staleMsg').hidden, null, { timeout: 240000 }).catch(() => {});
    for (let i = 0; i < 80; i++) { const m = await p.textContent('#sweepMsg'); if (!/running|…|%/.test(m)) break; await p.waitForTimeout(3000); }
    const c = await pick();
    check('3D sweep, 3D mode: row wood = loaded wood', c.every(([x, y]) => x === y), JSON.stringify(c));
    check('t70: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  });

  // t72 (v55): results overlay sits below the full-screen bars
  await section('t72 results below full-screen bars', async () => {
    const p = await openPage(b, srv.url);
    await p.$eval('#resOnDraw', e => { if (!e.checked) e.click(); });
    await p.click('.fsbtn[data-fs="#sideSheet"]'); await p.waitForTimeout(500);
    const bars = await p.evaluate(() => Math.max(...['dock', 'fsBar'].map(id => document.getElementById(id).getBoundingClientRect().bottom)));
    const tc = await p.evaluate(() => document.querySelector('#resOv .tc').getBoundingClientRect().top);
    check('2D full screen: capacity text starts below the bars', tc >= bars - 0.5, `bars end ${bars.toFixed(0)}, text at ${tc.toFixed(0)}`);
    await shot(p, 't72-fs2d.png');
    await p.click('#dockEsc'); await p.waitForTimeout(300);
    check('t72: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  });

  // t74 (v57): same-value columns grey out and can be hidden
  await section('t74 same-value columns', async () => {
    const p = await openPage(b, srv.url); await waitRows(p); await p.waitForTimeout(500);
    const same = await p.$$eval('#sweepTbl th.samecol', l => l.length);
    check('Best results table marks same-value columns', same > 0, same + ' columns');
    await p.click('#sameTgl2'); await p.waitForTimeout(200);
    check('"Hide same columns" hides them', await p.$$eval('#sweepTbl td.samecol', c => c.filter(x => getComputedStyle(x).display !== 'none').length) === 0);
    check('t74: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  });

  // t75 (v58): the pilot box folds and never overflows
  await section('t75 pilot box', async () => {
    const p = await openPage(b, srv.url); await waitRows(p);
    await p.click('#anaSwitch [data-ana="3d"]'); await p.waitForTimeout(800);
    await p.$eval('#bigSearch', e => e.click());
    await p.waitForSelector('#bigFull', { timeout: 120000 });
    check('pilot finishes and offers the full run', await p.isVisible('#bigFull'));
    const over = () => p.$eval('#bigBox', e => { const r = e.getBoundingClientRect(); return Math.max(e.scrollWidth - e.clientWidth, [...e.querySelectorAll('td')].map(t => t.getBoundingClientRect().right).reduce((a, c) => Math.max(a, c), 0) - r.right); });
    check('pilot box does not overflow (notes hidden)', await over() <= 1, (await over()).toFixed(1) + ' px');
    await p.click('#toggleData2'); await p.waitForTimeout(300);
    check('pilot box does not overflow (notes shown)', await over() <= 1, (await over()).toFixed(1) + ' px');
    await shot(p, 't75-pilot.png', '#bigBox');
    check('t75: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  });

  // TE-063 (v59): a large search on a 2^37..2^53 space is interrupted, the page reloads, and Resume carries on
  // with the exact walk: design numbers stay whole, inside the space and never repeat. Slow, so only with --slow.
  if (slow) await section('TE-063 interrupted large search resumes', async () => {
    const p = await openPage(b, srv.url, { width: 1600, height: 1000 }); await waitRows(p);
    await p.evaluate(() => {
      const set = (k, a, b2, s) => { const on = k === 'O' ? document.getElementById('swVaryOv') : document.getElementById('swOn' + k); if (!on.checked) on.click(); for (const [id, v] of [['sw' + k + '0', a], ['sw' + k + '1', b2], ['sw' + k + 's', s]]) { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } };
      set('H', 10, 100, 0.1); set('D', -60, 120, 0.1); set('O', 0, 50, 0.1); set('S', 0, 50, 0.05);
      __dbg.S.bigCap = 150000;
    });
    await p.waitForTimeout(800);
    const total = +(await p.textContent('#sweepCount')).replace(/[^0-9]/g, '');
    check('space is between 2^37 and 2^53', total > 2 ** 37 && total < 2 ** 53, total.toLocaleString());
    await p.$eval('#bigSearch', e => e.click()); await p.waitForSelector('#bigFull', { timeout: 200000 });
    await p.click('#bigFull'); await p.waitForTimeout(300);
    await p.fill('#bigHrs', '0').catch(() => {}); await p.$eval('#bigHrs', e => e.dispatchEvent(new Event('change'))).catch(() => {});
    await p.click('#bigGo');
    const ck = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('se310-truss', 1); r.onsuccess = () => { const q = r.result.transaction('big').objectStore('big').get('ckpt'); q.onsuccess = () => res(q.result ? { k: q.result.k, n: q.result.n, wv: q.result.wv, total: q.result.total } : null); }; }));
    let c0 = null; for (let i = 0; i < 60 && !(c0 && c0.k > 0); i++) { await p.waitForTimeout(1000); c0 = await ck(); }
    check('a checkpoint is saved during the run', c0 && c0.k > 0, c0 ? `at ${c0.k} of ${c0.n}` : 'none');
    check('the checkpoint records the exact walk (wv 2)', c0 && c0.wv === 2);
    await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__dbg && __dbg.res, null, { timeout: 15000 });
    await p.waitForSelector('#ckResume', { timeout: 30000 });
    await p.click('#ckResume');
    for (let i = 0; i < 100; i++) { await p.waitForTimeout(3000); if (/Full search:|Time limit|Cancelled/.test(await p.textContent('#sweepMsg'))) break; }
    const msg = await p.textContent('#sweepMsg');
    check('resumed search finishes', /Full search:/.test(msg), msg.slice(0, 120));
    const r = await p.evaluate(T => { const ids = __dbg.rows.map(r => Number(r.idx)).filter(v => v === v); return { n: ids.length, whole: ids.every(Number.isInteger), inside: ids.every(v => v >= 0 && v < T), distinct: new Set(ids).size === ids.length }; }, total);
    check('kept design numbers are whole, inside the space and distinct', r.n > 0 && r.whole && r.inside && r.distinct, JSON.stringify(r));
    check('TE-063: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  });

  // t71 (v54): huge space, pilot, time-limited full run. Slow, so only with --slow.
  if (slow) await section('t71 huge space with a time limit', async () => {
    const p = await openPage(b, srv.url, { width: 1600, height: 1000 }); await waitRows(p);
    await p.evaluate(() => {
      const set = (k, a, b2, s) => { const on = k === 'O' ? document.getElementById('swVaryOv') : document.getElementById('swOn' + k); if (!on.checked) on.click(); for (const [id, v] of [['sw' + k + '0', a], ['sw' + k + '1', b2], ['sw' + k + 's', s]]) { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } };
      set('H', 10, 100, 0.01); set('D', -60, 120, 0.01); set('O', 0, 50, 0.01); set('S', 0, 50, 0.01); set('R', 0.5, 2, 0.001); set('A', 20, 90, 0.01);
    });
    await p.waitForTimeout(800);
    const cnt = await p.textContent('#sweepCount');
    check('space is past 2^53 designs', (cnt.replace(/[^0-9]/g, '').length) >= 16, cnt.trim());
    await p.$eval('#bigSearch', e => e.click());
    await p.waitForSelector('#bigFull', { timeout: 200000 });
    await p.click('#bigFull'); await p.waitForTimeout(300);
    await p.fill('#bigHrs', '0.005'); await p.$eval('#bigHrs', e => e.dispatchEvent(new Event('change'))); await p.waitForTimeout(300);
    await p.click('#bigGo');
    for (let i = 0; i < 60; i++) { await p.waitForTimeout(3000); if (/Time limit|Full search:|Cancelled/.test(await p.textContent('#sweepMsg'))) break; }
    const msg = await p.textContent('#sweepMsg');
    check('time-limited run stops on its own', /Time limit|Full search:/.test(msg), msg.slice(0, 120));
    check('rows kept after the run', await p.evaluate(() => __dbg.rows.length) > 0);
    check('t71: no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  });
} finally {
  await b.close(); srv.close();
}
const fails = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} UI regression checks passed`);
process.exit(fails.length ? 1 : 0);
