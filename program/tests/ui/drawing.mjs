// The 2D drawing as a reusable piece (#255 part A; UI-A3, UI-H5): the same picture in two places at two sizes,
// drawn from the design alone, without moving or changing the main view.
import { serve, browser, openPage, checker } from './harness.mjs';

const srv = await serve();
const b = await browser();
const check = checker();
try {
  const p = await openPage(b, srv.url);
  await p.waitForFunction(() => window.__dbg && window.__dbg.res && document.querySelector('#draw .mem'));
  const r = await p.evaluate(() => {
    const main = document.getElementById('draw'), before = { html: main.innerHTML, vb: main.getAttribute('viewBox') };
    const NS = 'http://www.w3.org/2000/svg', mk = (w, h) => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('width', w); s.setAttribute('height', h); document.body.appendChild(s); return s; };
    const small = mk(240, 120), big = mk(900, 450);
    TrussApp.drawInto(small); TrussApp.drawInto(big);
    const count = el => ({ mem: el.querySelectorAll('.mem').length, joints: el.querySelectorAll('circle').length, paths: el.querySelectorAll('path').length });
    const mainCount = count(main), sc = count(small), bc = count(big);
    let threw = false; try { TrussApp.drawInto(main); } catch (e) { threw = true; }
    const ids = mk(240, 120); TrussApp.drawInto(ids, { dims: true });
    return { same: before.html === main.innerHTML && before.vb === main.getAttribute('viewBox'), mainCount, sc, bc, smallVb: small.getAttribute('viewBox'), bigVb: big.getAttribute('viewBox'),
      members: __dbg.res.members.length, threw, dimsOnAsk: ids.querySelectorAll('.dimlab').length };
  });
  check('the main drawing is untouched by drawing elsewhere', r.same);
  check('two other <svg>s at two sizes get the same members as the main view', r.sc.mem === r.members && r.bc.mem === r.members && r.mainCount.mem === r.members, JSON.stringify({ main: r.mainCount, small: r.sc, big: r.bc }));
  check('and the same joints and supports', r.sc.joints === r.bc.joints && r.sc.paths === r.bc.paths && r.sc.joints > 0, JSON.stringify([r.sc, r.bc]));
  check('each gets its own fitted viewBox, the same picture area', !!r.smallVb && r.smallVb === r.bigVb, r.smallVb);
  check('drawInto refuses the main drawing (it has its own path)', r.threw);
  check('dimension labels only when asked', r.dimsOnAsk > 0, String(r.dimsOnAsk));
  check('no script errors', p.errs.length === 0, p.errs.slice(0, 2).join(' | '));
  await p.close();
} finally { await b.close(); srv.close(); }
const fails = check.results.filter(x => !x.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} drawing checks passed`);
process.exit(fails.length ? 1 : 0);
