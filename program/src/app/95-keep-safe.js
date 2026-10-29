// ---------- keeping work safe across reloads and new versions
// 1. the current sweep results are saved in this browser and brought back on load
function queueSweepSave() {
  clearTimeout(queueSweepSave.t);
  queueSweepSave.t = setTimeout(() => {
    try { if (!SweepState.rows().length || sweepBusy) return; } catch (e) { return; }
    if (queueSweepSave.ref === SweepState.rows() && queueSweepSave.len === SweepState.rows().length) return;
    queueSweepSave.ref = SweepState.rows(); queueSweepSave.len = SweepState.rows().length;
    idbPut('cur', { ver: APP_VER, when: new Date().toISOString(), msg: $('sweepMsg').textContent, rows: SweepState.rows(), top: SweepState.top(), ctx: SweepState.ctx(), sig: lastSig, mode: SweepState.mode() }).catch(() => {});
  }, 800);
}
(async () => {
  let v = null, ck = null;
  try { v = await idbGet('cur'); } catch (e) { v = null; }
  if (v && v.rows && v.rows.length && !SweepState.rows().length) {
    SweepState.set(v.rows, { top: v.top || [], ctx: v.ctx || SweepState.ctx(), mode: v.mode === 'pilot' ? 'sweep' : (v.mode || 'sweep') }); lastSig = v.sig || null;
    queueSweepSave.ref = SweepState.rows(); queueSweepSave.len = SweepState.rows().length;
    const old = v.ver !== APP_VER;
    $('sweepMsg').innerHTML = `<b>Restored</b> the sweep from ${new Date(v.when).toLocaleString()}${old ? ` (made with an older version of the Explorer${v.ver ? ` (v${v.ver})` : ''}; the solver may have changed since, so <button type="button" class="btn ghost sm" id="rerunOld">re-run it</button> to be sure)` : ''}. ` + escH(v.msg || '');
    if ($('rerunOld')) $('rerunOld').addEventListener('click', () => $('runSweep').click());
    renderSweep(); drawTrackers(); paintBigMode(); checkStale();
  } else if (!SweepState.rows().length) starterSweep();
  // 2. a large search that was interrupted can carry on where it stopped
  try { ck = await idbGet('ckpt'); } catch (e) { ck = null; }
  if (ck && ck.k < ck.n) {
    $('bigMsg').innerHTML = `A large search stopped at ${ck.k.toLocaleString()} of ${ck.n.toLocaleString()} designs (${new Date(ck.when).toLocaleString()}). <button type="button" class="btn acc sm" id="ckResume">Resume it</button> <button type="button" class="btn ghost sm" id="ckDrop">Discard</button>`;
    $('ckResume').addEventListener('click', () => {
      if (sweepSig() !== ck.sig || sweepDims().total !== ck.total) { $('bigMsg').textContent = 'The inputs or sweep ranges have changed since that search, so resuming would mix two different searches. Set them back, or start a new search.'; return; }
      if (!ck.wv && ck.total > WALK_SPLIT_MAX && typeof ck.m === 'number') toast(`That search started before v59. For spaces past 137 billion designs its sampler favoured some designs and repeated others, so it carries on the same way. For a fair sample, start a new search.`, true);
      else if (ck.ver !== APP_VER) toast('That search was started in an older version; the rest will use the new solver.');
      $('s-sweep') && ($('s-sweep').open = true);
      runFull(ck);
    });
    $('ckDrop').addEventListener('click', () => { idbPut('ckpt', null).catch(() => {}); $('bigMsg').textContent = 'Discarded.'; });
  }
})();
// a starter sweep, so the charts have something to show before anyone runs one. A first visit gets a ready-made set of ranges (about 51,000 designs).
function starterSweep() {
  if (FIRST_VISIT) {
    const set = (id, v) => { const el = $(id); if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('swH0', 10); set('swH1', 100); set('swHs', 1.25);
    set('swD0', -30); set('swD1', 30); set('swDs', 10);
    set('swO0', 5); set('swO1', 45); set('swOs', 10);
    ['swOnD'].forEach(id => { const c = $(id); if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } });
    const vo = $('swVaryOv'); if (vo && !vo.checked) { vo.checked = true; vo.dispatchEvent(new Event('change', { bubbles: true })); }
    S.swOn.H = true; S.swOn.N = true; S.swOn.P = true; save(); paintSwBlocks(); updateSweepCount();
  }
  if (sweepProblems().length) return;
  const n = sweepDims().total;
  if (!n || n > 60000) { $('sweepMsg').textContent = `No sweep has been run yet. Your ranges hold ${n.toLocaleString()} designs: press Run sweep${n > 60000 ? ' (or Large search)' : ''} to fill the charts.`; return; }
  $('sweepMsg').textContent = `Building a starter sweep (${n.toLocaleString()} designs) so the charts have something to show…`;
  toast(`Building a starter sweep of ${n.toLocaleString()} designs in the background…`);
  setTimeout(() => { if (!sweepBusy && !big.running && !SweepState.rows().length) $('runSweep').click(); }, 1200);
}
function escH(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// 3. ask before leaving while something is running
window.addEventListener('beforeunload', ev => { if (sweepBusy || big.running) { ev.preventDefault(); ev.returnValue = ''; } });
// 4. earlier bridges: a copy is kept before every reset, preset or file load, and every few minutes while you work
const BKEY = 'se310-truss-backups';
function readBackups() { try { const l = cleanData(JSON.parse(localStorage.getItem(BKEY) || '[]')); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
function snapBridge() { const b = bridgeState(); b.swSel = JSON.parse(JSON.stringify(SW)); b.swVals = {}; SW_IDS.forEach(id => { b.swVals[id] = $(id).value; }); return b; }
function backupBridge(why, force) {
  const b = snapBridge(), str = JSON.stringify(b), list = readBackups();
  if (list.length && JSON.stringify(list[0].bridge) === str) { if (force) { list[0].why = why; try { localStorage.setItem(BKEY, JSON.stringify(list)); } catch (e) {} renderHistory(); } return; }
  let sum = {}; try { sum = bridgeSummary(); } catch (e) {}
  list.unshift({ when: new Date().toISOString(), why, name: S.name || 'Design', sum, bridge: b });
  while (list.length > 40) list.pop();
  try { localStorage.setItem(BKEY, JSON.stringify(list)); } catch (e) { list.pop(); try { localStorage.setItem(BKEY, JSON.stringify(list)); } catch (e2) {} }
  paintBackups(); try { renderHistory(); } catch (e) {}
}
function paintBackups() {
  const sel = $('backupSel'); if (!sel) return;
  const list = readBackups();
  sel.innerHTML = `<option value="">${list.length ? 'choose…' : 'none yet'}</option>` + list.map((q, i) => {
    const t = new Date(q.when), s = q.sum || {};
    return `<option value="${i}">${t.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${escH(q.name)}${s.wood ? ` · ${Math.round(s.wood)} mm${s.passes ? ' · passes' : ''}` : ''} (${q.why})</option>`;
  }).join('');
}
{
  const ab = applyBridge;
  applyBridge = function (b, why) { backupBridge(why || 'before loading another bridge'); return ab(b); };
}
$('backupSel').addEventListener('change', () => {
  const q = readBackups()[+$('backupSel').value]; if (!q) return;
  applyBridge(q.bridge, 'before going back to an earlier bridge');
  $('backupSel').value = ''; closeDock(); toast(`Back to the bridge from ${new Date(q.when).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
});
setTimeout(() => backupBridge('when the page opened'), 600);   // after the first solve, so the copy has its results
setInterval(() => { if (!document.hidden) backupBridge('saved automatically'); }, 180000);

update();
drawTrackers();
// ---------- result tables: grey out what does not change, so the differences stand out
// a column with one value in every row is greyed (header marked "="), or hidden with the "Hide same columns" switch;
// in the other columns, a value repeating the row above is faded
S.hideSame = !!S.hideSame;
function markSame(tb) {
  if (!tb || tb._marking) return; tb._marking = true;
  try {
    const rows = [...tb.querySelectorAll('tbody tr')].filter(r => r.cells.length > 1);
    tb.querySelectorAll('.samecol, .dit').forEach(c => c.classList.remove('samecol', 'dit'));
    const head = tb.tHead && tb.tHead.rows.length ? tb.tHead.rows[tb.tHead.rows.length - 1] : null;
    let nSame = 0;
    if (rows.length > 1) {
      const nc = Math.max(...rows.map(r => r.cells.length));
      for (let c = 0; c < nc; c++) {
        const cells = rows.map(r => r.cells[c]);
        if (cells.some(x => !x || x.colSpan > 1 || x.querySelector('button, input, select'))) continue;
        const txt = cells.map(x => x.textContent.trim());
        if (txt.every(t => t === txt[0])) {
          nSame++;
          cells.forEach(x => x.classList.add('samecol'));
          if (head && head.cells[c]) { head.cells[c].classList.add('samecol'); head.cells[c].title = `Same in every row: ${txt[0]}`; }
        } else for (let k = 1; k < txt.length; k++) if (txt[k] === txt[k - 1] && txt[k] !== '') cells[k].classList.add('dit');
      }
    }
    tb.dataset.same = nSame;
  } finally { setTimeout(() => { tb._marking = false; }, 0); }
}
['sweepTbl', 'frontTbl', 'histTbl', 'curveTbl'].forEach(id => {
  const tb = $(id); if (!tb) return;
  new MutationObserver(() => { if (!tb._marking) markSame(tb); }).observe(tb, { childList: true, subtree: true });
  markSame(tb);
});
function paintSame() {
  document.body.classList.toggle('hidesame', S.hideSame);
  document.querySelectorAll('.sametgl').forEach(b => { b.textContent = S.hideSame ? 'Show same columns' : 'Hide same columns'; b.setAttribute('aria-pressed', String(S.hideSame)); b.title = S.hideSame ? 'Show the columns that have the same value in every row (greyed, marked =)' : 'Hide the columns that have the same value in every row, so only what differs is left'; });
}
[['sweepBtns', 'sameTgl2'], [null, 'sameTgl']].forEach(([host, id]) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost sm sametgl'; b.id = id;
  if (host) $(host).appendChild(b); else $('toggleData').after(b);
  b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); S.hideSame = !S.hideSame; paintSame(); save(); });
});
paintSame();
