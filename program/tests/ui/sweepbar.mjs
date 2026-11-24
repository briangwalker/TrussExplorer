// balsaPixel 1.0, step 3 piece 1: the sweep bar (UI-A2, UI-W15, UI-W16, UI-S5, UI-S9, UI-W20)
import { serve, browser, openPage, waitRows, checker, SHOTS } from './harness.mjs';
import path from 'path';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
const box = (p, q) => p.evaluate(q => { const all = [...document.querySelectorAll(q)]; const e = all.find(x => x.getBoundingClientRect().width > 0 && !x.closest('[hidden]')) || all[0]; if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, vis: r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') }; }, q);
const hit = (a, c) => !!a && !!c && a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
const inside = (a, c) => !!a && !!c && a.l >= c.l - 1 && a.r <= c.r + 1 && a.t >= c.t - 1 && a.b <= c.b + 1;

try {
  for (const [w, h] of [[1366, 900], [390, 844]]) {
    const tag = `${w}x${h}`, phone = w < 700;
    const p = await openPage(b, srv.url, { width: w, height: h }); await waitRows(p); await p.waitForTimeout(500);
    for (const place of ['truss2d', 'truss3d', 'analysis']) {
      if (place === 'truss3d') { await p.evaluate(() => { const e = document.querySelector('[data-go="3d"], #mode3d, [data-mode="3d"]'); if (e) e.click(); }); await p.waitForTimeout(300); }
      if (place === 'analysis') { await p.evaluate(() => { const e = document.querySelector('#shellNav [data-go="analysis"]'); if (e) e.click(); }); await p.waitForTimeout(600); }
      const W = await box(p, '#win-sweep'), stage = await box(p, '#stage');
      const t = `${tag} ${place}`;
      check(`${t}: the sweep bar is on screen, bottom-left (UI-A2)`, !!W && W.vis && inside(W, stage) && W.l < stage.w * 0.6 && W.b > stage.b - 24, JSON.stringify(W));
      const run = await box(p, '#win-sweep #runSweep, #win-sweep [data-ic="run"]');
      check(`${t}: Run sweep is inside the bar`, !!run && run.vis && inside(run, W), JSON.stringify([run, W]));
      if (!phone) {
        check(`${t}: the bar is 640 px at most (UI-W15)`, W.w <= 641, JSON.stringify(W));
        check(`${t}: the bar's content is one row: its parts sit on one line`, await p.evaluate(() => { const k = [...document.querySelectorAll('#win-sweep .s-sum > *')].filter(e => e.getBoundingClientRect().width > 0); const m = k.map(e => { const r = e.getBoundingClientRect(); return (r.top + r.bottom) / 2; }); return k.length >= 3 && Math.max(...m) - Math.min(...m) < 14; }));
        check(`${t}: the bar has no grip (UI-W20)`, await p.evaluate(() => !document.querySelector('#win-sweep .grip')));
        const pip = { l: stage.r - 360, t: stage.b - 240, r: stage.r, b: stage.b };
        check(`${t}: the bar stays out of the bottom-right PIP area (UI-W16)`, !hit(W, pip), JSON.stringify([W, pip]));
      }
      for (const q of ['#shellNav', '#resCard', '#win-drawing:not([hidden])', '#win-view:not([hidden])', '#win-inputs:not([hidden])', '.navcube, .navpad, #viewCtl, [data-part="view-control"]']) {
        const o = await box(p, q);
        if (o && o.vis && o.w > 0) check(`${t}: the bar does not overlap ${q.split(':')[0]}`, !hit(W, o), JSON.stringify([W, o]));
      }
    }
    if (!phone) {
      // back to Truss 2D: the words state carries the whole bar
      await p.evaluate(() => { const e = document.querySelector('#shellNav [data-go="truss"]'); if (e) e.click(); }); await p.waitForTimeout(500);
      check(`${tag}: the count line shows in the bar`, /designs|Step is 0/.test(await p.textContent('#win-sweep .s-sum #sweepCount')));
      check(`${tag}: Settings stay folded until asked`, !(await box(p, '#win-sweep .s-bd')).vis);
      await p.click('#sweepMore'); await p.waitForTimeout(200);
      check(`${tag}: Sweep settings opens the old sweep body in the same window`, (await box(p, '#win-sweep .s-bd')).vis && await p.evaluate(() => document.getElementById('win-sweep').contains(document.getElementById('bigSearch'))));
      await p.click('#sweepMore'); await p.waitForTimeout(200);
      // UI-S5: out of date stripes the bar orange; a fresh sweep clears it
      await p.evaluate(() => { const i = document.getElementById('height'); if (i) { i.value = String(+i.value + 1); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } });
      await p.waitForTimeout(400);
      // a first sweep exists only after a run: run one, then change an input
      await p.evaluate(() => { document.getElementById('runSweep').click(); }); await p.waitForFunction(() => !document.getElementById('runSweep').disabled, null, { timeout: 120000 }); await p.waitForTimeout(400);
      check(`${tag}: after a sweep the bar is not striped`, await p.evaluate(() => !document.getElementById('win-sweep').classList.contains('stale')));
      await p.evaluate(() => { const i = document.getElementById('height'); i.value = String(+i.value + 2); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
      await p.waitForTimeout(900);
      check(`${tag}: UI-S5 out of date: the bar stripes orange`, await p.evaluate(() => document.getElementById('win-sweep').classList.contains('stale') || !document.querySelector('.staleMsg').hidden === false));
      // UI-S9: a pilot shows its progress and Cancel in the bar
      await p.evaluate(() => { document.getElementById('bigCap').value = 1000; document.getElementById('bigCap').dispatchEvent(new Event('change', { bubbles: true })); });
      await p.evaluate(() => document.getElementById('bigSearch').click());
      await p.waitForFunction(() => !document.getElementById('bigCancel').hidden || document.getElementById('bigMsg').textContent.length > 0, null, { timeout: 20000 }).catch(() => {});
      const cancel = await box(p, '#win-sweep .s-sum #bigCancel'), msg = await box(p, '#win-sweep .s-sum #bigMsg'), pr = await box(p, '#win-sweep .s-sum .te-sweepprog');
      check(`${tag}: a running pilot shows the progress bar and Cancel in the bar`, !!cancel && !!msg && !!pr && inside(pr, await box(p, '#win-sweep')), JSON.stringify([cancel, msg, pr]));
      if (cancel && cancel.vis) { await p.evaluate(() => document.getElementById('bigCancel').click()); await p.waitForTimeout(1500); }
      await p.screenshot({ path: path.join(SHOTS, 'sweepbar-1366.png') });
    } else {
      check(`${tag}: on a phone the bar starts as icons with ▶`, await p.evaluate(() => document.getElementById('win-sweep').dataset.state === 'I' && !!document.querySelector('#win-sweep [data-ic="run"]')));
      await p.screenshot({ path: path.join(SHOTS, 'sweepbar-390.png') });
    }
    check(`${tag}: no script errors`, p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} sweep-bar checks passed`);
process.exit(fails.length ? 1 : 0);
