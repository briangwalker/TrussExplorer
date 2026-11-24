// ---------- the Members tab in Analysis (#416, TE-B-332; UI-S6, UI-W21, UI-H4)
// The last tab of the Analysis tab row. The table is the UI Engineer's TrussMembersView on the shared table piece,
// fed by TrussMembers.rows(tr, res) (the same res as the CSV); Copy table and Download CSV give the app's own csvText(),
// "# " header lines and all, so the file is the same as the Drawing window's. Hovering or picking a row lights the
// member in the drawing (highlight); a row picked stays picked across redraws.
let memMount = null, memPicked = null;
// the screen's view of the table, per viewer (UI-S6 1.5.5/1.5.7): All columns on or off, and the Use sort's direction.
// Its own small key, not the app state, so saved bridge files never change (rule 4i); a blocked storage just forgets.
const MEM_VIEW_KEY = 'te-members-view';
let memView = { all: false, dir: 'descending' };
let memWhole = false;   // 3D only: the Whole bridge (3D) table is showing (UI-S10 5); not kept between visits, the side truss is the default
try { const v = JSON.parse(localStorage.getItem(MEM_VIEW_KEY) || 'null'); if (v && typeof v === 'object') memView = { all: v.all === true, dir: v.dir === 'ascending' ? 'ascending' : 'descending' }; } catch (e) {}
function memViewSave() { try { localStorage.setItem(MEM_VIEW_KEY, JSON.stringify(memView)); } catch (e) {} }
// UI-S10: the Members tab sets sticks and focus. Each change is a design change: the results update (update()), a toast says what
// changed with Undo (UI-W10), and the sweep is marked out of date by the app's own check (UI-S5). Undo puts the two lists back.
function memUndoable(text, change) {
  const before = { sticks: JSON.parse(JSON.stringify(S.sticks || {})), focus: JSON.parse(JSON.stringify(S.focus || [])) };
  change();
  const T = window.__shell && window.__shell.toasts;
  if (T) T.show({ text, undo: () => { S.sticks = before.sticks; S.focus = before.focus; update(); } });
}
function memStep(k, d) {
  const e = tr.elems[k]; if (!e) return; const n0 = e.n, n1 = Math.max(1, Math.min(4, n0 + d)); if (n1 === n0) return;
  memUndoable(`Member ${k}: ${n0} → ${n1} stick${n1 === 1 ? '' : 's'}`, () => setSticks(k, c => ({ n: Math.max(1, Math.min(4, c.n + d)) })));
}
function memBundle(k) {
  const e = tr.elems[k]; if (!e || e.n !== 4) return; const to = e.bundle === 'compact' ? 'row' : '2×2';
  memUndoable(`Member ${k}: 4 sticks, ${to}`, () => setSticks(k, c => ({ bundle: c.bundle === 'compact' ? 'row' : 'compact' })));
}
function memFocusToggle(k) {
  const on = isFocus(k);
  memUndoable(`Member ${k}: ${on ? 'out of' : 'in'} the sweep's focus list`, () => toggleFocus(k));
}
function memResetSticks() {
  if (!Object.keys(S.sticks || {}).length) return;
  memUndoable('All members set to 1 stick', () => { S.sticks = {}; update(); });
}
function renderMembers() {
  const box = $('memPanel'), P = window.TrussPieces, V = window.TrussMembersView;
  if (!box || !P || !V || box.hidden) return;
  P.install(document); V.install(document);
  const editing = memMount ? memMount.editing : null;
  const rows = TrussMembers.rows(tr, res), keep = box.querySelector('.te-tbl-wrap, .tablewrap');
  const sx = keep ? keep.scrollLeft : 0, sy = keep ? keep.scrollTop : 0;
  if (memMount) { memMount.destroy(); memMount = null; }
  // a redraw while a cell has focus keeps focus on the same member and column (Chaos Tester TE-B-462); the switch and the
  // sort button keep theirs through their own handlers below
  const fCell = box.contains(document.activeElement) ? document.activeElement.closest('#memTbl tbody :is(td,th)') : null;
  const focusKey = fCell ? fCell.parentElement.dataset.key : null, focusCol = fCell ? [...fCell.parentElement.children].indexOf(fCell) : 0;
  const is3 = S.anaMode === '3d', whole = is3 && memWhole; tbl3Show = whole;
  const pick = is3 ? `<div class="mv-tools" data-pc role="group" aria-label="Which table">${P.buttonHTML({ kind: 'chip', label: 'Side truss (2D)', act: 'mem-side', pressed: !whole })}${P.buttonHTML({ kind: 'chip', label: 'Whole bridge (3D)', act: 'mem-whole', pressed: whole })}</div>` : '';
  box.innerHTML = V.toolbarHTML(P, { all: memView.all, switchId: 'memAll' }) + pick
    + (whole ? '' : '<p class="hint" style="margin:0 0 8px">Sticks: use − and + to double up a member (its mirror twin changes with it). Area, stiffness, tension and crushing capacity grow with the stick count. Buckling grows n× for sticks glued in a row; at 4 sticks you can pick a 2×2 bundle instead (16× one stick). ◎ marks a member for the sweep\'s focus list. Tap a member in the drawing to find its row.</p>')
    + `<div id="tbl3Box" hidden style="margin-bottom:14px"><p class="hint" id="tbl3Note" style="margin:0 0 8px"></p><div class="tablewrap" style="max-height:420px;overflow:auto"><table id="tbl3"></table></div></div>`
    + `<div class="tablewrap" id="memWrap"${whole ? ' hidden' : ''}>${V.tableHTML(P, rows, { typeLabel: X.TYPE_LABEL, id: 'memTbl', lit: memPicked, all: memView.all, dir: memView.dir, edit: true, isFocus })}</div>`
    + `<details class="mv-facts" style="margin:12px 0 0"><summary>Design facts (hand-check)</summary><dl class="kv" id="facts" style="margin:8px 0 0"></dl></details>`
    + `<p class="note" style="margin:10px 0 0">Forces are under the factored design load (FS already applied), so a member is fine while its use stays under 100%. Use = |F| ÷ the smaller of Euler P<sub>cr</sub> and crushing capacity σ<sub>c</sub>A in compression, or F ÷ σ<sub>t</sub>A in tension. The course script only reports buckling; the crushing and tension checks are extra. The project rules ask you to hand-check member forces, so try a joint or two by hand before you trust this.</p>`;
  renderTable(); renderTable3();
  const sw = $('memAll'); if (sw) P.mountToggle(sw, { onChange: on => { memView.all = !!on; memViewSave(); renderMembers(); const s2 = $('memAll'); if (s2) s2.focus(); } });
  const w = $('memWrap'); w.scrollLeft = sx; w.scrollTop = sy;
  const tbl = $('memTbl');
  if (tbl && tbl.tagName === 'TABLE') memMount = P.mountTable(tbl, {
    onHover: k => highlight(k == null ? (memPicked == null ? -1 : +memPicked) : +k),
    onPick: k => { memPicked = k; highlight(k == null ? -1 : +k); },
    onCellKey: e => {   // the Sticks cell being edited (UI-S10): ← → or − + change the count, Space toggles row / 2×2
      if (e.key === 'ArrowRight' || e.key === '+' || e.key === '=') { memStep(+e.row, 1); return true; }
      if (e.key === 'ArrowLeft' || e.key === '-') { memStep(+e.row, -1); return true; }
      if (e.key === ' ') { memBundle(+e.row); return true; }
      return false;
    },
    onSort: () => { memView.dir = memView.dir === 'descending' ? 'ascending' : 'descending'; memViewSave(); renderMembers(); const b = document.querySelector('#memTbl .te-sort'); if (b) b.focus(); },
  });
  if (memMount && editing) memMount.focusKey(editing.key, { col: editing.col, focus: true, edit: editing.edit });
  else if (memMount && focusKey != null) memMount.focusKey(focusKey, { col: focusCol, focus: true });
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
  const row = b.closest('tr'), k = row ? +row.dataset.key : null;
  if (b.dataset.act === 'mem-less') memStep(k, -1);
  else if (b.dataset.act === 'mem-more') memStep(k, 1);
  else if (b.dataset.act === 'mem-bundle') memBundle(k);
  else if (b.dataset.act === 'mem-focus') memFocusToggle(k);
  else if (b.dataset.act === 'mem-reset') memResetSticks();
  else if (b.dataset.act === 'mem-whole' || b.dataset.act === 'mem-side') { memWhole = b.dataset.act === 'mem-whole'; renderMembers(); const nb = document.querySelector(`#memPanel [data-act="${b.dataset.act}"]`); if (nb) nb.focus(); }
  else if (b.dataset.act === 'members-copy') copy(S.anaMode === '3d' && memWhole ? csv3Text() : csvText(), 'Copied the table as CSV.');
  else if (b.dataset.act === 'members-csv') S.anaMode === '3d' && memWhole ? saveFile(fileBase() + '_members_3d.csv', csv3Text()) : saveFile(fileBase() + '_members.csv', csvText());
});
