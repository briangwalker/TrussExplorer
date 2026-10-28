// ---------- bridge and sweep files, to share with partners (and, later, to publish)
const FILE_VER = TrussFormats.KINDS.bridge.current;   // the version written today; formats.js owns it with the upgrade steps (#149). 2 (v61): analysis model, 3D setup and build-document settings travel with the bridge; every file says which release made it
// a short code for the bridge (FNV-1a of its settings): the same in its file, its CSVs, its .py and on its printed
// documents, so a printout can be matched to the file it came from
function fingerprint(o) { const s = JSON.stringify(o); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
// the same facts as lines of text, for CSVs, the .py, the LP README and the build documents (over: { model, rules } of a sweep)
function infoLines(over) {
  const fi = fileInfo(over && over.model), r = Object.assign({}, fi.rules, over && over.rules);
  return [`SE 310 Truss Explorer ${fi.release} (solver ${fi.solver})`, `Design: ${S.name || 'Design'} · ${fi.model} analysis · saved ${fi.savedAt}`,
    `Rules: FS ${r.FS}, books ${r.bookKg} kg, deflection <= ${r.deflLimit} mm, overlap >= ${r.minOverlap} mm, width ${r.width} mm, envelope on outer faces`, `Bridge code: ${fi.bridgeCode}`];
}
// the rules a sweep's results were judged by (they can differ from the inputs on screen)
function sweepInfo() { const c = sweepCtx || {}; return { model: /3D/.test(String(c.sheet && c.sheet.analysis)) ? '3D' : '2D', rules: Object.assign({}, c.FS != null ? { FS: +c.FS } : {}, c.bookKg != null ? { bookKg: +(+c.bookKg).toFixed(3) } : {}, c.defl != null ? { deflLimit: +c.defl } : {}, c.minOv != null ? { minOverlap: +c.minOv } : {}) }; }
// what every saved file says about how its numbers were made
function fileInfo(model) {
  return { app: 'SE 310 Truss Explorer', release: APP_RELEASE, solver: APP_VER, savedAt: stamp(), model: model || (S.anaMode === '3d' ? '3D' : '2D'), bridgeCode: fingerprint(bridgeState()),
    rules: { FS: +S.mat.FS, bookKg: +(S.load.mBook1 + S.load.mBook2).toFixed(3), deflLimit: +S.opts.deflLimit, minOverlap: +S.opts.minOverlap, width: +S.opts.width, envelope: 'outer faces' } };
}
// settings that belong to this browser's screen, not to the bridge
const UI_ONLY = ['openMap', 'hideSame', 'bestN', 'expTab', 'tradeDim', 'topView', 'keys', 'showForces', 'popPos', 'migOv5', 'abSteps', 'abExt', 'anaMode', 'tab', 'wide', 'compact', 'inputsFirst', 'sideW', 'hideHelp', 'hideStats', 'history', 'baseline', 'hideG', 'showIds', 'showElems', 'showDef', 'defScale', 'showDims', 'showGhosts', 'resOnDraw', 'groupBy', 'axX', 'axY', 'colorFails', 'clickMode', 'c3', 'autoRerun', 'autoLimit', 'bigCap', 'woodBudget', 'loadTarget', 'refStep'];
function bridgeState() { const o = {}; Object.keys(S).forEach(k => { if (!UI_ONLY.includes(k)) o[k] = S[k]; }); o.anaMode = S.anaMode === '3d' ? '3d' : '2d'; return JSON.parse(JSON.stringify(o)); }
function bridgeSummary() {
  const model = S.anaMode === '3d' ? '3D' : '2D';
  return res.stable ? { model, wood: +res.wood.toFixed(1), capKg: +res.capKg.toFixed(2), deflection: +res.midDefl.toFixed(4), passes: !!res.passes, members: tr.elems.length, joints: tr.nodes.length } : { model, stable: false };
}
const stamp = () => new Date().toISOString();
$('saveBridge').addEventListener('click', () => {
  const doc = Object.assign({ format: 'se310-truss-bridge', version: FILE_VER }, fileInfo(), { name: S.name || 'Design', summary: bridgeSummary(), bridge: bridgeState() });
  saveFile(fileBase() + '.bridge.json', JSON.stringify(doc, null, 1));
});
$('saveSweepFile').addEventListener('click', () => {
  if (!sweepAll.length) { toast('Run a sweep first.', true); return; }
  const sweepModel = /3D/.test(String(sweepCtx && sweepCtx.sheet && sweepCtx.sheet.analysis)) ? '3D' : '2D';
  const doc = Object.assign({ format: 'se310-truss-sweep', version: FILE_VER }, fileInfo(sweepModel), { name: (S.name || 'Design') + ' sweep',
    message: $('sweepMsg').textContent, ctx: sweepCtx, sheet: sweepCtx && sweepCtx.sheet, mode: sweepMode, settings: { swOn: S.swOn, swVals: S.swVals, swSel: SW, focus: S.focus },
    bridge: bridgeState(), rows: sweepAll });
  saveFile(fileBase() + '.sweep.json', JSON.stringify(doc));
});
let pickFor = null, pendingSweep = null;
$('loadBridge').addEventListener('click', () => { pickFor = 'bridge'; $('filePick').value = ''; $('filePick').click(); });
$('loadSweepFile').addEventListener('click', () => { pickFor = 'sweep'; $('filePick').value = ''; $('filePick').click(); });
function applyBridge(b) {
  if (b.swOn) S.swOn = Object.assign({}, S.swOn, b.swOn);
  if (b.swVals) S.swVals = Object.assign({}, b.swVals);
  if (b.focus) S.focus = b.focus.slice();
  Object.keys(b).forEach(k => { if (!UI_ONLY.includes(k) && k in DEFAULT) S[k] = b[k]; });
  ['mat', 'load', 'opts'].forEach(k => { if (b[k]) S[k] = Object.assign({}, DEFAULT[k], b[k]); });
  if (b.swSel) ['panels', 'patterns', 'verts', 'claw', 'brace', 'loadShape', 'stickGroups', 'brace3', 'choice'].forEach(g => { if (b.swSel[g]) Object.keys(SW[g]).forEach(k => { if (k in b.swSel[g]) SW[g][k] = !!b.swSel[g][k]; }); });
  if (b.swVals) SW_IDS.forEach(id => { if (b.swVals[id] != null) $(id).value = b.swVals[id]; });
  ['swPanels', 'swPatterns', 'swVerts', 'swClaw', 'swBrace', 'swLoad', 'swStick'].forEach(id => { const el = $(id); if (el) el.querySelectorAll('button').forEach(() => {}); });
  toggleChips('swPanels', SW.panels); toggleChips('swPatterns', SW.patterns, PNAME); toggleChips('swVerts', SW.verts, { all: 'All', none: 'None' });
  toggleChips('swClaw', SW.claw, { off: 'No claws', on: 'Claws' }); toggleChips('swBrace', SW.brace, { off: 'No braces', on: 'Edge braces' });
  toggleChips('swLoad', SW.loadShape, LOAD_SHAPES); toggleChips('swStick', SW.stickGroups, STICK_GROUPS);
  SWV.forEach(v => { const cb = v.k === 'O' ? $('swVaryOv') : $('swOn' + v.k); if (cb) cb.checked = swOn(v.k); });
  // the 3D setup, the build-document settings and the analysis model travel with the bridge (#154)
  if (b.d3 && typeof b.d3 === 'object') { S.d3 = Object.assign({}, S.d3, b.d3); S.d3.imperf = Object.assign({ on: false, alpha: 0.02, beta: 0.005, dir: 1 }, b.d3.imperf || {}); }
  if (b.doc && typeof b.doc === 'object') { S.doc = Object.assign({}, S.doc, b.doc); S.doc.over = Object.assign({}, b.doc.over || {}); if (!b.doc.stock240 && +b.doc.stock === 914) S.doc.stock = 240; S.doc.stock240 = true; }
  if (b.anaMode === '3d' || b.anaMode === '2d') { S.anaMode = b.anaMode; paintAna(); }
  paintSwBlocks(); update(); if (typeof render3D === 'function') try { render3D(); } catch (e) {}
}
// #247: a bridge saved before the outer-face rule (v61), or from v61's 300 mm starter, is a few mm too long outside to
// outside. Say so when it opens, with the number to change, instead of only "Bridge loaded." and a red FAILS.
function tooLongNote(release) {
  const sz = res2d && res2d.size; if (!sz || !tr || sz.outer.length <= 300 + 1e-6) return '';
  const over = sz.outer.length - 300, ov = Math.floor((tr.overlap - over / 2) * 10) / 10;
  const old = !/^v\d+$/.test(String(release || '')) || +String(release).slice(1) < 61;
  // the overlap is what sets the length outside the span; "Same width as span panels" has no length to type, so it says to switch
  const fix = ov < S.opts.minOverlap - 1e-6 ? ` Shortening the overlap enough would take it under the ${S.opts.minOverlap} mm minimum on each desk; the notes under the drawing list what to change.`
    : S.deskMode === 'length' ? ` To fit, set Overlap onto each desk to ${ov.toFixed(1)} mm (Inputs).`
    : ` To fit, set Panels on each desk to "Set the overlap", then Overlap onto each desk to ${ov.toFixed(1)} mm (Inputs).`;
  return ` ${old ? 'This bridge was made before the outer-face rule (v61): it' : 'It'} is ${over.toFixed(1)} mm too long, ${sz.outer.length.toFixed(1)} mm outside to outside, and the limit is 300 mm.${fix}`;
}
$('filePick').addEventListener('change', async () => {
  const f = $('filePick').files[0]; if (!f) return;
  // parse, clean, detect, upgrade to the current version and check, all in formats.js (#149; spec in docs/formats.md)
  const o = TrussFormats.open(await f.text()), doc = o.doc, kind = o.kind;
  const FILE_ERR = { 'not-json': 'That file is not a bridge or sweep file (it is not valid JSON).', 'not-an-object': 'That file is not a bridge or sweep file.', 'not-truss-explorer': 'That is not a bridge or sweep file from the Truss Explorer.', 'no-bridge': 'That bridge file has no bridge in it.', 'no-rows': 'That sweep file has no results in it.', 'no-usable-rows': 'That sweep file has no usable results.' };
  // either Open button takes either kind of file, and says which it was (#158); materials and themes don't open here yet
  if (o.ok && kind !== 'bridge' && kind !== 'sweep') { toast('That is not a bridge or sweep file from the Truss Explorer.', true); return; }
  if (!o.ok) { toast(FILE_ERR[o.errors[0]] || 'That file could not be opened.', true); return; }
  const other = pickFor === 'bridge' && kind === 'sweep' ? 'That was a sweep file, so it opened as a sweep. ' : pickFor === 'sweep' && kind === 'bridge' ? 'That was a bridge file, so it opened as a bridge. ' : '';
  if (kind === 'bridge') {
    applyBridge(doc.bridge);
    let note = '';
    if (!doc.bridge.anaMode) {
      // a file from before v61 doesn't say 2D or 3D: open it in whichever model gives the wood it was saved with
      const want = doc.summary && +doc.summary.wood, near = () => res && res.stable && Math.abs(res.wood - want) < 0.6;
      if (want > 0 && !near()) {
        const was = S.anaMode; S.anaMode = was === '3d' ? '2d' : '3d'; paintAna(); update();
        if (near()) note = ` It was saved before v61, which didn't record 2D or 3D; its wood (${want.toFixed(0)} mm) matches the ${S.anaMode === '3d' ? '3D' : '2D'} analysis, so it opened in ${S.anaMode === '3d' ? '3D' : '2D'}.`;
        else { S.anaMode = was; paintAna(); update(); note = ` It was saved before v61 and doesn't say whether it was analysed in 2D or 3D; check the switch, and compare the wood with the file's ${want.toFixed(0)} mm.`; }
      }
    }
    if (o.tooNew) note += ' It was made by a newer release of the Explorer, so some settings may be ignored.';
    note += tooLongNote(doc.release);
    $('fileMsg').textContent = `Opened "${doc.name}" (saved ${new Date(doc.savedAt).toLocaleString()}${doc.release ? ` with ${doc.release}` : ''}).${note}`; toast(other + 'Bridge loaded.' + note, !!note);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  // every result row needs its numbers: rows with a missing or non-numeric one were left out by formats.js, and that is said
  if (o.rowsDropped) toast(`${o.rowsDropped.toLocaleString()} of ${o.rowsIn.toLocaleString()} rows in that file were incomplete and were left out.`, true);
  if (o.tooNew) toast('That sweep file was made by a newer release of the Explorer, so some settings may be ignored.', true);
  sweepAll = doc.rows; sweepCtx = doc.ctx || sweepCtx; sweepMode = 'file'; pendingSweep = doc;
  sweepRows = sweepAll.filter(r => r.passes).sort((x, y) => x.wood - y.wood || x.util - y.util).slice(0, 30);
  lastSig = null;
  $('sweepMsg').textContent = `Opened the sweep "${doc.name}" (saved ${new Date(doc.savedAt).toLocaleString()}): ${doc.rows.length.toLocaleString()} designs. ${doc.message || ''}`;
  $('sweepFileBox').hidden = false;
  $('sweepFileBox').innerHTML = `These results come from a sweep file. The inputs on the left are still your own. <button type="button" class="btn ghost sm" id="useSweepSetup">Also load its bridge and sweep settings</button>`;
  $('useSweepSetup').addEventListener('click', () => { const d = pendingSweep; if (!d) return; applyBridge(Object.assign({}, d.bridge, d.settings ? { swOn: d.settings.swOn, swVals: d.settings.swVals, swSel: d.settings.swSel, focus: d.settings.focus } : {})); lastSig = sweepSig(); checkStale(); $('sweepFileBox').hidden = true; toast('Bridge and sweep settings loaded.'); });
  renderSweep(); drawTrackers(); paintBigMode(); checkStale();
  if (other) toast(other + `${doc.rows.length.toLocaleString()} designs loaded.`);
});
// ---------- the floating View switch and menu, and simple bridges to start again from
function closeDock() { $('dockMenu').hidden = true; $('dockBtn').setAttribute('aria-expanded', 'false'); }
$('dockBtn').addEventListener('click', ev => { ev.stopPropagation(); const m = $('dockMenu'); m.hidden = !m.hidden; $('dockBtn').setAttribute('aria-expanded', String(!m.hidden)); if (!m.hidden) { paintBackups(); paintDockChecks(); } });
document.addEventListener('click', ev => { if (!ev.target.closest('#dock, #dockMenu, #dockBtn')) closeDock(); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('dockMenu').hidden) closeDock(); });
function paintDockChecks() { $('swCompact').checked = !!S.compact; $('swHelp').checked = !S.hideHelp; }
$('swCompact').addEventListener('change', () => { if (!!S.compact !== $('swCompact').checked) $('toggleCompact').click(); });
$('swHelp').addEventListener('change', () => { if (!S.hideHelp !== $('swHelp').checked) $('toggleHelp').click(); });
$('chartDimDock').addEventListener('click', ev => { const b = ev.target.closest('[data-cd]'); if (!b) return; ev.stopPropagation(); S.tab = b.dataset.cd; S.tradeDim = b.dataset.cd; save(); paintTabs(); drawTrackers(); if (fsEl === '#trackBody') setFs('#trackBody'); });
$('viewSwitch').addEventListener('click', ev => { if (ev.target.closest('#anaSwitch') || ev.target.closest('#chartDimDock')) return; const b = ev.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
$('viewSwitch').addEventListener('keydown', ev => {
  if (ev.target.closest('#anaSwitch')) return;
  const order = ['inputs', 'both', 'bridge', 'analysis'], i = order.indexOf(fsEl === '#trackBody' ? 'analysis' : curView());
  if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); const v = order[Math.max(0, Math.min(3, i + (ev.key === 'ArrowRight' ? 1 : -1)))]; setView(v); $('viewSwitch').querySelector(`[data-view="${v}"]`).focus(); }
});
$('backTab').addEventListener('click', () => setView('both'));
const PRESETS = [
  { name: 'Course sample · Pratt, 4 panels, h 70', set: {} },
  { name: 'Simple Warren · 4 panels, h 40', set: { family: 'warren', panels: 4, height: 40 } },
  { name: 'Howe · 6 panels, h 50', set: { pattern: 'howe', panels: 6, height: 50 } },
  { name: 'Shallow Pratt with a sagging bottom · h 30, p −20', set: { height: 30, bottom: 'parabola', curve: -20 } },
  { name: 'Arch on the table edges · Warren, top arch, feet', set: { family: 'warren', panels: 4, height: 45, topShape: 'parabola', topEnd: 0, deskMode: 'length', overlap: 30, deskEnds: 'feet', edgeBear: true } },
];
$('presetSel').innerHTML += PRESETS.map((q, i) => `<option value="${i}">${q.name}</option>`).join('');
$('presetSel').addEventListener('change', () => {
  const q = PRESETS[+$('presetSel').value]; if (!q) return;
  const base = JSON.parse(JSON.stringify(DEFAULT));
  UI_ONLY.forEach(k => { delete base[k]; });
  const b = Object.assign(base, q.set);
  b.name = TrussNames.make(b);   // a preset starts a new design, so it gets a generated name too (#27)
  if ($('presetSweep').checked) Object.assign(b, { swOn: { H: true, N: true, P: true }, swVals: {} });
  // the sweep switches not named go off; ranges keep their values unless reset
  if ($('presetSweep').checked) Object.keys(S.swOn).forEach(k => { if (!(k in b.swOn)) b.swOn[k] = false; });
  S.sticks = {}; S.loads = null; S.focus = [];
  applyBridge(b);
  $('presetSel').value = ''; closeDock(); toast(`Started from "${q.name}". Changed your mind? ☰ → Go back to an earlier bridge.`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('dlLp').addEventListener('click', () => saveFile(fileBase() + '_LP_data.zip', zip(lpFiles())));

