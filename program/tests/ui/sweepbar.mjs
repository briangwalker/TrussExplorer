// balsaPixel 1.0, step 3 piece 1: the sweep bar (UI-A2, UI-W15, UI-W16, UI-S5, UI-S9, UI-W20)
import { serve, browser, openPage, waitRows, checker, SHOTS } from './harness.mjs';
import path from 'path';

const srv = await serve(undefined, { shell: true });
const b = await browser();
const check = checker();
const box = (p, q) => p.evaluate(q => { const all = [...document.querySelectorAll(q)]; const e = all.find(x => x.getBoundingClientRect().width > 0 && !x.closest('[hidden]')) || all[0]; if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, vis: r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') }; }, q);
const hit = (a, c) => !!a && !!c && a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
const inside = (a, c) => !!a && !!c && a.l >= c.l - 1 && a.r <= c.r + 1 && a.t >= c.t - 1 && a.b <= c.b + 1;
const allIn = p => p.evaluate(() => { const W = document.getElementById('win-sweep'), r = W.getBoundingClientRect(); const out = [...W.querySelectorAll('button')].filter(e => { const q = e.getBoundingClientRect(); return q.width > 0 && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden'; }).map(e => { const q = e.getBoundingClientRect(); return { id: e.id || e.dataset.ic || e.textContent.trim().slice(0, 12), over: Math.max(r.left - q.left, q.right - r.right, r.top - q.top, q.bottom - r.bottom) }; }).filter(x => x.over > 1); return { out, state: W.dataset.state, fit: W.dataset.fit || '', w: r.width, vw: innerWidth }; });

try {
  // UI-W15 (#534): the bar's width is checked at 1440, 1366 and 1024; the run / pilot steps below run once, at 1366
  for (const [w, h] of [[1440, 900], [1366, 900], [1024, 768], [390, 844]]) {
    const tag = `${w}x${h}`, phone = w < 700, full = w === 1366;
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
        check(`${t}: the bar is 640 px at most and never wider than 40 % of the stage (UI-W15, #534)`, W.w <= 641 && W.w <= 0.4 * stage.w + 1, JSON.stringify([W, stage.w]));
        const more = await box(p, '#win-sweep #sweepMore');
        check(`${t}: Run sweep and Sweep settings stay on screen`, !!more && more.vis && inside(more, stage) && inside(run, stage), JSON.stringify([more, run]));
        check(`${t}: the bar's content is one row: its parts sit on one line`, await p.evaluate(() => { const k = [...document.querySelectorAll('#win-sweep .s-sum > *')].filter(e => e.getBoundingClientRect().width > 0); const m = k.map(e => { const r = e.getBoundingClientRect(); return (r.top + r.bottom) / 2; }); return k.length >= 3 && Math.max(...m) - Math.min(...m) < 14; }));
        check(`${t}: Run sweep keeps one line; the count line is what ellipsises (UI-W15)`, run.h < 34, JSON.stringify(run));
        check(`${t}: every button of the bar lies inside the bar`, (await allIn(p)).out.length === 0, JSON.stringify(await allIn(p)));
        check(`${t}: the bar has no grip (UI-W20)`, await p.evaluate(() => !document.querySelector('#win-sweep .grip')));
        const pip = { l: stage.r - 360, t: stage.b - 240, r: stage.r, b: stage.b };
        check(`${t}: the bar stays out of the bottom-right PIP area (UI-W16)`, !hit(W, pip), JSON.stringify([W, pip]));
      }
      for (const q of ['#shellNav', '#resCard', '#win-drawing:not([hidden])', '#win-view:not([hidden])', '#win-inputs:not([hidden])', '.navcube, .navpad, #viewCtl, [data-part="view-control"]']) {
        const o = await box(p, q);
        if (o && o.vis && o.w > 0) check(`${t}: the bar does not overlap ${q.split(':')[0]}`, !hit(W, o), JSON.stringify([W, o]));
      }
    }
    if (full) {
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
      // auto re-run off for this step, so the out-of-date state stays long enough to see (it would re-run a small sweep after 700 ms)
      await p.evaluate(() => { const a = document.getElementById('autoRerun'); if (a && a.checked) { a.checked = false; a.dispatchEvent(new Event('change', { bubbles: true })); } });
      // book length, not height: the default sweep sweeps height and overlap, so changing those doesn't put it out of date
      await p.evaluate(() => { const i = document.getElementById('bookLen'); i.value = String(+i.value + 2); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
      await p.waitForTimeout(900);
      check(`${tag}: UI-S5 out of date: the bar stripes orange`, await p.evaluate(() => document.getElementById('win-sweep').classList.contains('stale') && document.querySelector('.staleMsg').hidden === false));
      // UI-S9: a pilot shows its progress and Cancel in the bar
      await p.evaluate(() => { document.getElementById('bigCap').value = 1000; document.getElementById('bigCap').dispatchEvent(new Event('change', { bubbles: true })); });
      await p.evaluate(() => document.getElementById('bigSearch').click());
      await p.waitForFunction(() => !document.getElementById('bigCancel').hidden || document.getElementById('bigMsg').textContent.length > 0, null, { timeout: 20000 }).catch(() => {});
      const cancel = await box(p, '#win-sweep .s-sum #bigCancel'), msg = await box(p, '#win-sweep .s-sum #bigMsg'), pr = await box(p, '#win-sweep .s-sum .te-sweepprog');
      check(`${tag}: a running pilot shows the progress bar and Cancel in the bar`, !!cancel && !!msg && !!pr && inside(pr, await box(p, '#win-sweep')), JSON.stringify([cancel, msg, pr]));
      if (cancel && cancel.vis) { await p.evaluate(() => document.getElementById('bigCancel').click()); await p.waitForTimeout(1500); }
      await p.screenshot({ path: path.join(SHOTS, 'sweepbar-1366.png') });
    } else if (phone) {
      check(`${tag}: on a phone the bar starts as icons with ▶`, await p.evaluate(() => document.getElementById('win-sweep').dataset.state === 'I' && !!document.querySelector('#win-sweep [data-ic="run"]')));
      await p.screenshot({ path: path.join(SHOTS, 'sweepbar-390.png') });
    }
    check(`${tag}: no script errors`, p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
  // UI-W15 with UI-W16 (UI Designer's MUST on #538): every control of the bar lies inside the bar. Where the 40 % cap leaves less than the
  // words state needs (700-770 px with Inputs as icons), the bar opens one state smaller, icons with ▶; at 1100 (Inputs open) the same rule holds.
  // FVL MUST on #538: the same checks in a Notebook theme, whose thick bezel and 2 px button borders the fit must count (948: the words
  // used to be kept at a 379 px bar that was 5-10 px too narrow).
  const setTheme = (p, t) => p.evaluate(t => { const s = document.getElementById('themeSel'); s.value = t; s.dispatchEvent(new Event('change', { bubbles: true })); }, t);
  for (const th of ['wireframe', 'notebook-calc']) for (const [w, h] of [[700, 800], [740, 800], [948, 800], [1100, 800]]) {
    const tag = `${th} ${w}x${h}`;
    const p = await openPage(b, srv.url, { width: w, height: h }); await waitRows(p); await p.waitForTimeout(300);
    if (th !== 'wireframe') { await setTheme(p, th); await p.waitForTimeout(300); await p.reload(); await waitRows(p); }
    await p.waitForTimeout(500);
    check(`${tag}: the theme is ${th}`, await p.evaluate(() => document.getElementById('stage').dataset.theme) === th);
    const r = await allIn(p);
    check(`${tag}: every button of the sweep bar lies inside the bar (UI-W15, UI-W16)`, r.out.length === 0, JSON.stringify(r));
    const W = await box(p, '#win-sweep'), stage = await box(p, '#stage');
    check(`${tag}: the bar is 640 px at most and never wider than 40 % of the stage`, W.w <= 641 && W.w <= 0.4 * stage.w + 1, JSON.stringify([W, stage.w]));
    if (r.fit === 'I') {
      check(`${tag}: a bar that doesn't fit shows ▶ Run the sweep as an icon`, !!(await box(p, '#win-sweep [data-ic="run"]'))?.vis);
      check(`${tag}: in the fitted icons state '‹ Shrink Sweep to icons' is hidden (UI-W15 1.5.13)`, await p.evaluate(() => { const e = document.querySelector('#win-sweep .s-ph [data-step="shrink"]'); return !e || e.hidden || e.getBoundingClientRect().width === 0; }));
      // ⋯ is the person asking for the words: the bar uses the room beside the windows, every button inside it and on screen
      await p.click('#win-sweep [data-ic="grow"]'); await p.waitForTimeout(300);
      const g = await allIn(p), G = await box(p, '#win-sweep'), more = await box(p, '#win-sweep #sweepMore'), dr = await box(p, '#win-drawing:not([hidden])');
      check(`${tag}: after ⋯ the bar shows its words, every button inside it`, g.state === 'W' && g.out.length === 0 && !!more && more.vis && inside(more, stage), JSON.stringify([g, more]));
      check(`${tag}: after ⋯ the bar stays clear of Drawing`, !dr || !dr.vis || !hit(G, dr), JSON.stringify([G, dr]));
      // a wider stage gives the words back without a click (the saved state was words all along)
      await p.setViewportSize({ width: 1366, height: 900 }); await p.waitForTimeout(500);
      const k = await allIn(p);
      check(`${tag}: resized to 1366 the bar is words again, every button inside`, k.state === 'W' && k.fit === '' && k.out.length === 0, JSON.stringify(k));
      // on a fresh page at 1366 (the ⋯ choice above is kept in memory on this one)
      const q = await openPage(b, srv.url, { width: 1366, height: 900 }); await waitRows(q); await q.waitForTimeout(300);
      if (th !== 'wireframe') { await setTheme(q, th); await q.waitForTimeout(300); await q.reload(); await waitRows(q); await q.waitForTimeout(300); }
      // focus follows a resize switch (UI-W15 1.5.13, QA note 1): Sweep settings -> ⋯ -> Sweep settings, Run sweep -> ▶ -> Run sweep
      for (const [from, to] of [['#sweepMore', 'grow'], ['#runSweep', 'run']]) {
        await q.focus(from); await q.setViewportSize({ width: w, height: h }); await q.waitForTimeout(500);
        const a = await q.evaluate(() => { const e = document.activeElement; return { ic: e.dataset.ic || '', id: e.id, fit: document.getElementById('win-sweep').dataset.fit }; });
        check(`${tag}: a resize to icons moves focus from ${from} to [data-ic=${to}], not <body>`, a.fit === 'I' && a.ic === to, JSON.stringify(a));
        await q.setViewportSize({ width: 1366, height: 900 }); await q.waitForTimeout(500);
        const z = await q.evaluate(() => '#' + document.activeElement.id);
        check(`${tag}: and back to words it is on ${from} again`, z === from, z);
      }
      await q.close();
      check(`${tag}: at 1366 '‹ Shrink' is back in the words state`, await p.evaluate(() => { const e = document.querySelector('#win-sweep .s-ph [data-step="shrink"]'); return !!e && !e.hidden && e.getBoundingClientRect().width > 0; }));
    }
    check(`${tag}: Run sweep keeps one line`, await p.evaluate(() => { const e = document.getElementById('runSweep'); const r = e.getBoundingClientRect(); return r.width === 0 || r.height < 34; }));
    check(`${tag}: no script errors`, p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
  // QA MUST on #538 (TE-B-714, TE-B-715): load at 1366, so Inputs opens in words, then resize to 740 / 800. If the bar has fallen to
  // icons, Enter on ⋯ must show the words with Sweep settings inside the bar and focused (Inputs goes to icons to make room, UI-W16),
  // and Enter on Sweep settings opens it. ⋯ never does nothing.
  for (const th of ['wireframe', 'notebook-calc']) for (const w of [740, 800]) {
    const tag = `${th} 1366->${w}`;
    const p = await openPage(b, srv.url, { width: 1366, height: 900 }); await waitRows(p); await p.waitForTimeout(300);
    if (th !== 'wireframe') { await setTheme(p, th); await p.waitForTimeout(300); await p.reload(); await waitRows(p); }
    await p.waitForTimeout(400);
    check(`${tag}: the theme is ${th}`, await p.evaluate(() => document.getElementById('stage').dataset.theme) === th);
    check(`${tag}: at 1366 Inputs opens in words`, await p.evaluate(() => document.getElementById('win-inputs').dataset.state === 'W'));
    await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(500);
    const r0 = await allIn(p);
    if (r0.fit === 'I') {
      await p.focus('#win-sweep [data-ic="grow"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
    }
    const g = await allIn(p), G = await box(p, '#win-sweep'), stage = await box(p, '#stage'), more = await box(p, '#win-sweep #sweepMore');
    check(`${tag}: after Enter on ⋯ the bar shows its words (was fit '${r0.fit}')`, g.state === 'W' && g.fit === '', JSON.stringify(g));
    check(`${tag}: Sweep settings is on screen and inside the bar`, !!more && more.vis && inside(more, G) && inside(more, stage), JSON.stringify([more, G]));
    check(`${tag}: every button of the bar lies inside the bar`, g.out.length === 0, JSON.stringify(g));
    if (r0.fit === 'I') check(`${tag}: focus is on Sweep settings`, await p.evaluate(() => document.activeElement && document.activeElement.id === 'sweepMore'));
    else await p.focus('#sweepMore');
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    check(`${tag}: Enter on Sweep settings opens it`, await p.evaluate(() => document.getElementById('sweepMore').getAttribute('aria-expanded') === 'true') && (await box(p, '#win-sweep .s-bd')).vis);
    check(`${tag}: no script errors`, p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
  // #532 (UI-A2, UI-W15, TE-B-774): load at 1366 with the bar in words, then narrow the window to 600, 480, 390, 360 and 320 px: the bar
  // never runs past the stage's right edge and 'Sweep settings' stays reachable (on screen, or the bar is icons / its tab, as a fresh load
  // at that width gives); back at 1366 the words come back. Then the same after ⋯ forced the words at 480 (no room even with Inputs as
  // icons, growSweep step 3): a narrower stage gives the icons back instead of pushing Sweep settings off the right edge.
  const edge = p => p.evaluate(() => { const W = document.getElementById('win-sweep'), r = W.getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); const bs = [...W.querySelectorAll('button')].filter(e => { const q = e.getBoundingClientRect(); return q.width > 0 && !e.closest('[hidden]'); }).map(e => e.getBoundingClientRect().right); const m = document.getElementById('sweepMore'), mr = m && m.getBoundingClientRect(); return { r: r.right, stR: st.right, btnR: Math.max(0, ...bs), state: W.dataset.state, fit: W.dataset.fit || '', more: !!mr && mr.width > 0 && mr.left >= st.left - 1 && mr.right <= st.right + 1 && !m.closest('[hidden]') }; });
  const narrowOk = r => r.r <= r.stR + 0.5 && r.btnR <= r.stR + 0.5 && (r.more || r.state === 'I' || r.state === 'T');
  for (const th of ['wireframe', 'notebook-calc']) for (const mode of ['load', 'forced']) {
    const p = await openPage(b, srv.url, { width: 1366, height: 900 }); await waitRows(p); await p.waitForTimeout(300);
    if (th !== 'wireframe') { await setTheme(p, th); await p.waitForTimeout(300); await p.reload(); await waitRows(p); }
    await p.waitForTimeout(400);
    let tag = `${th} 1366 (${mode})`;
    check(`${tag}: the bar starts in words`, (await edge(p)).state === 'W');
    let widths = [600, 480, 390, 360, 320];
    if (mode === 'forced') {
      await p.setViewportSize({ width: 480, height: 900 }); await p.waitForTimeout(500);
      await p.focus('#win-sweep [data-ic="grow"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
      const f = await edge(p);
      check(`${th} 480: ⋯ shows the words, Sweep settings on screen and focused`, f.state === 'W' && f.more && await p.evaluate(() => document.activeElement.id === 'sweepMore'), JSON.stringify(f));
      widths = [390, 360, 320];
    }
    for (const w of widths) {
      await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(500);
      const r = await edge(p); tag = `${th} ${mode} -> ${w}`;
      check(`${tag}: the bar and its buttons stay inside the stage's right edge; Sweep settings on screen or the bar is icons (#532)`, narrowOk(r), JSON.stringify(r));
      check(`${tag}: focus is not dropped to <body>`, await p.evaluate(() => document.activeElement !== document.body || !document.getElementById('win-sweep').contains(document.activeElement)));
    }
    if (mode === 'forced') check(`${th} forced -> 320: focus followed Sweep settings to ⋯`, await p.evaluate(() => document.activeElement.dataset.ic === 'grow'));
    await p.setViewportSize({ width: 1366, height: 900 }); await p.waitForTimeout(500);
    const z = await edge(p);
    check(`${th} ${mode} -> 1366: the words come back, Sweep settings on screen`, z.state === 'W' && z.fit === '' && z.more && narrowOk(z), JSON.stringify(z));
    check(`${th} ${mode}: the saved Sweep state is still words`, await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('se310-truss-v5') || '{}'); const w = s.shell && s.shell.w; return !w || Object.values(w).every(x => !x.sweep || x.sweep === 'W' || x.sweep === 'I'); }));
    check(`${th} ${mode}: no script errors`, p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
    await p.close();
  }
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} sweep-bar checks passed`);
process.exit(fails.length ? 1 : 0);
