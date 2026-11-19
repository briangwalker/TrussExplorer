// ---------- the Members tab in Analysis (#416, TE-B-332; UI-S6, UI-W21, UI-H4)
// The last tab of the Analysis tab row. The table is the UI Engineer's TrussMembersView on the shared table piece,
// fed by TrussMembers.rows(tr, res) (the same res as the CSV); Copy table and Download CSV give the app's own csvText(),
// "# " header lines and all, so the file is the same as the Drawing window's. Hovering or picking a row lights the
// member in the drawing (highlight); a row picked stays picked across redraws.
let memMount = null, memPicked = null;
function renderMembers() {
  const box = $('memPanel'), P = window.TrussPieces, V = window.TrussMembersView;
  if (!box || !P || !V || box.hidden) return;
  P.install(document); V.install(document);
  const rows = TrussMembers.rows(tr, res), keep = box.querySelector('.te-tbl-wrap, .tablewrap');
  const sx = keep ? keep.scrollLeft : 0, sy = keep ? keep.scrollTop : 0;
  if (memMount) { memMount.destroy(); memMount = null; }
  box.innerHTML = V.toolbarHTML(P) + `<div class="tablewrap" id="memWrap">${V.tableHTML(P, rows, { typeLabel: X.TYPE_LABEL, id: 'memTbl', lit: memPicked })}</div>`;
  const w = $('memWrap'); w.scrollLeft = sx; w.scrollTop = sy;
  const tbl = $('memTbl');
  if (tbl && tbl.tagName === 'TABLE') memMount = P.mountTable(tbl, {
    onHover: k => highlight(k == null ? (memPicked == null ? -1 : +memPicked) : +k),
    onPick: k => { memPicked = k; highlight(k == null ? -1 : +k); },
  });
  if (memMount && memPicked != null && rows.some(r => String(r.k) === String(memPicked))) memMount.light(memPicked);
  memFit();
}
// As the full-screen picture (UI-A3), the table sits in the free part of the screen: clear of the top bar, the windows
// and the edge tabs floating over it (the next step stays visible, UI-A21), and it scrolls inside itself.
function memFit() {
  const box = $('memPanel'), w = $('memWrap'); if (!box || box.hidden || !w) return;
  if (!box.closest('#fsFill')) { ['style', 'data-fit'].forEach(a => { box.removeAttribute(a); w.removeAttribute(a); }); return; }
  const st = document.getElementById('stage'), H = innerHeight, W = innerWidth; let t = 8, b = 8, l = 8, r = 8;
  if (st) [...st.children].forEach(e => {
    if (getComputedStyle(e).position !== 'absolute') return; const q = e.getBoundingClientRect(); if (q.width < 2 || q.height < 2) return;
    if (q.width < 60 && q.height > q.width && q.left < W * 0.2) l = Math.max(l, q.right + 8);   // an edge tab (UI-W2)
    else if (q.width < 60 && q.height > q.width && q.right > W * 0.8) r = Math.max(r, W - q.left + 8);
    else if (q.top < H * 0.35 && q.bottom < H * 0.6) t = Math.max(t, q.bottom + 8);
    else if (q.bottom > H * 0.7 && q.top > H * 0.4) b = Math.max(b, H - q.top + 8);
    else if (q.left < W * 0.2) l = Math.max(l, q.right + 8);
    else if (q.right > W * 0.8) r = Math.max(r, W - q.left + 8);
  });
  const bs = `display:flex;flex-direction:column;box-sizing:border-box;height:100%;padding:${t}px ${r}px ${b}px ${l}px`, ws = 'flex:1 1 auto;min-height:0;overflow:auto';
  if (box.getAttribute('data-fit') !== bs) { box.setAttribute('data-fit', bs); box.style.cssText = bs; }
  if (w.getAttribute('data-fit') !== ws) { w.setAttribute('data-fit', ws); w.style.cssText = ws; }
}
window.addEventListener('resize', () => { clearTimeout(memFit.t); memFit.t = setTimeout(memFit, 120); });
// a window opened, folded or moved changes the free part of the screen
new MutationObserver(recs => { const box = $('memPanel'); if (!box || box.hidden || recs.every(x => box.contains(x.target))) return; cancelAnimationFrame(memFit.f); memFit.f = requestAnimationFrame(memFit); })
  .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-state', 'style', 'hidden'] });
$('memPanel').addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'members-copy') copy(csvText(), 'Copied the table as CSV.');
  else if (b.dataset.act === 'members-csv') saveFile(fileBase() + '_members.csv', csvText());
});
