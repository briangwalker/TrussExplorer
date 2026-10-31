// ---------- export
function fileBase() { return (S.name || 'design').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'design'; }
function pyText() { return infoLines().map(l => '# ' + l).join('\n') + '\n' + X.exportPy(PROF_TEMPLATE, S.name || 'Design', design(), tr, res, Object.assign({}, C.DEFAULT_MAT, S.mat), S.load, S.opts); }
function renderExport() { $('pyOut').value = pyText(); $('dlPy').disabled = !res.stable; }
function toast(msg, err) { const t = $('toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => { t.textContent = ''; }, Math.max(4000, String(msg).length * 70)); }
async function copy(text, okMsg, fallbackEl) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e) { if (fallbackEl) { const d = fallbackEl.closest('details'); if (d) d.open = true; fallbackEl.focus(); fallbackEl.select(); toast('Copy was blocked here. The text is selected; press Ctrl+C or Cmd+C.', true); } else toast('Copy was blocked in this view.', true); }
}
$('copyPy').addEventListener('click', () => copy(pyText(), 'Copied the .py text.', $('pyOut')));
$('copyCsv').addEventListener('click', () => copy(csvText(), 'Copied the table as CSV.'));

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  files.forEach(f => {
    const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  });
  const cSize = central.reduce((s, p) => s + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cSize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)]);
}
// Pop-ups live inside the Sweep section in the markup; move them to the page itself so they show even when that
// section is folded, in the Inputs-only view and over full screen (#98)
document.querySelectorAll('.modal').forEach(m => document.body.appendChild(m));
// Saving (#105, #97). On claude.ai the page asks the host for its 'downloads' capability; anywhere else
// (briangwalker.com, a local copy) it uses an ordinary browser download. A failed request is never remembered,
// so the next save asks again, and a save that may have failed offers to copy the contents instead.
const onClaude = () => !!(window.claude && window.claude.use);
let downloadsP = null;
function getDownloads() {
  if (!onClaude()) return Promise.resolve(null);
  if (!downloadsP) downloadsP = window.claude.use('downloads').then(dl => { if (!dl) throw new Error('no downloads'); return dl; }).catch(() => { downloadsP = null; return null; });
  return downloadsP;
}
function browserDownload(filename, data) {
  try {
    const type = /\.(json)$/i.test(filename) ? 'application/json' : /\.truss$/i.test(filename) ? 'application/octet-stream' : /\.csv$/i.test(filename) ? 'text/csv' : /\.html$/i.test(filename) ? 'text/html' : /\.zip$/i.test(filename) ? 'application/zip' : 'text/plain';
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch (e) { return false; }
}
// the save may not have worked: say so plainly and offer what does work here
function saveFallback(filename, data) {
  const text = typeof data === 'string';
  $('saveFbText').textContent = text
    ? `This view may have blocked the download of ${filename}. If no file appeared, copy the contents and paste them into a new text file named ${filename}, or try again.`
    : `This view may have blocked the download of ${filename}. If no file appeared, try again in a moment.`;
  $('saveFbCopy').hidden = !text; $('saveFbArea').hidden = true; $('saveFbArea').value = '';
  $('saveFbModal').hidden = false;
  const close = () => { $('saveFbModal').hidden = true; $('saveFbArea').value = ''; };
  $('saveFbClose').onclick = close;
  $('saveFbRetry').onclick = () => { close(); saveNamed(filename, data); };
  $('saveFbCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(data); toast(`Copied. Paste it into a new file named ${filename}.`); close(); }
    catch (e) { const a = $('saveFbArea'); a.hidden = false; a.value = data; a.focus(); a.select(); toast('Copy was blocked here. The text is selected; press Ctrl+C or Cmd+C.', true); }
  };
  $('saveFbModal').onkeydown = ev => { if (ev.key === 'Escape') close(); };
  setTimeout(() => ($('saveFbCopy').hidden ? $('saveFbRetry') : $('saveFbCopy')).focus(), 30);
}
async function saveNamed(filename, data) {
  if (onClaude()) {
    const dl = await getDownloads();
    if (dl) {
      try { await dl.save({ filename, data }); toast('Saved ' + filename + '.'); return; }
      catch (e) {
        if (e && e.code === 'declined') { toast('Download cancelled.', true); return; }
        if (e && e.code === 'rate_limited') { toast('A save prompt is already open.', true); return; }
        downloadsP = null;   // ask the host again next time
      }
    }
    browserDownload(filename, data);   // may or may not be allowed inside claude.ai, so offer the fallback too
    saveFallback(filename, data);
    return;
  }
  if (browserDownload(filename, data)) toast('Saved ' + filename + ' to your downloads.');
  else saveFallback(filename, data);
}
// every export asks for its file name first (Enter saves, Esc cancels); the name can also become the design's name
function askFileName(filename) {
  return new Promise(resolve => {
    const m = filename.match(/^(.*?)((\.bridge|\.sweep)?\.[A-Za-z0-9]+)$/) || [filename, filename, ''];
    const base = m[1], ext = m[2] || '';
    const md = $('saveModal'); md.hidden = false;
    $('saveExt').textContent = ext; $('saveName').value = base; $('saveAsDesign').checked = ext === TrussFormats.KINDS.bridge.ext || ext === '.bridge.json';
    setTimeout(() => { $('saveName').focus(); $('saveName').select(); }, 30);
    const done = ok => { md.hidden = true; $('saveGo').onclick = $('saveNo').onclick = null; $('saveName').onkeydown = null;
      if (!ok) { resolve(null); return; }
      const nm = ($('saveName').value || base).trim().replace(/[\\/:*?"<>|]+/g, '_') || base;
      if ($('saveAsDesign').checked && nm !== S.name) { S.name = nm; $('name').value = nm; sizeName(); update(); }
      resolve(nm + ext); };
    $('saveGo').onclick = () => done(true); $('saveNo').onclick = () => done(false);
    $('saveName').onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); done(true); } else if (ev.key === 'Escape') { ev.preventDefault(); done(false); } };
  });
}
async function saveFile(filename, data) {
  const nm = await askFileName(filename); if (!nm) { toast('Not saved.'); return; }
  return saveNamed(nm, data);
}
$('dlPy').addEventListener('click', () => { const b = fileBase(); saveFile(b + '_TrussFEA.zip', zip([{ name: b + '_TrussFEA_Bridge_SE310.py', text: pyText() }])); });
$('dlCsv').addEventListener('click', () => saveFile(fileBase() + '_members.csv', csvText()));

// ---------- LP data
function lpFiles() {
  const nN = tr.nodes.length;
  const F = new Array(2 * nN).fill(0); res.Fval.forEach(([n, , v]) => { F[2 * n + 1] += v; });
  const supAt = {}; tr.supports.forEach(s => { supAt[s.node] = s; });
  const lifted = new Set((res.lifted || []).map(s => s.node));
  const A = S.mat.b * S.mat.h, I = S.mat.b * Math.pow(S.mat.h, 3) / 12;
  const nodes = [['node', 'label', 'x_mm', 'y_mm', 'load_x_N', 'load_y_N', 'support', 'fixed_x', 'fixed_y', 'lifted_off_in_FEA']];
  tr.nodes.forEach((p, i) => {
    const s = supAt[i];
    nodes.push([i, tr.keys[i], p[0].toFixed(4), p[1].toFixed(4), F[2 * i].toFixed(6), F[2 * i + 1].toFixed(6), s ? (s.pin ? 'pin' : 'roller') : 'none', s && s.pin ? 1 : 0, s ? 1 : 0, lifted.has(i) ? 1 : 0]);
  });
  const mem = [['member', 'i', 'j', 'type', 'L_mm', 'cos_x', 'cos_y', 'tension_limit_N', 'euler_Pcr_N', 'crush_limit_N', 'compression_limit_N', 'FEA_force_N']];
  tr.elems.forEach((e, k) => {
    const a = tr.nodes[e.i], b = tr.nodes[e.j], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const Pcr = Math.PI * Math.PI * S.mat.E * I / Math.pow(S.mat.K * L, 2);
    const cc = S.mat.sigC * A;
    mem.push([k, e.i, e.j, X.TYPE_LABEL[e.type], L.toFixed(4), ((b[0] - a[0]) / L).toFixed(6), ((b[1] - a[1]) / L).toFixed(6),
      (S.mat.sigT * A).toFixed(4), Pcr.toFixed(4), cc.toFixed(4), Math.min(Pcr, cc).toFixed(4), res.stable ? res.members[k].F.toFixed(6) : '']);
  });
  const head = ['row', 'node', 'direction', 'is_support_row'].concat(tr.elems.map((_, k) => 'm' + k));
  const B = [head];
  for (let n = 0; n < nN; n++) for (const dir of ['x', 'y']) {
    const row = [`n${n}_${dir}`, n, dir, (supAt[n] && (dir === 'y' || supAt[n].pin)) ? 1 : 0];
    tr.elems.forEach((e, k) => {
      let v = 0;
      if (e.i === n || e.j === n) {
        const me = tr.nodes[n], other = tr.nodes[e.i === n ? e.j : e.i];
        const L = Math.hypot(other[0] - me[0], other[1] - me[1]);
        v = (dir === 'x' ? other[0] - me[0] : other[1] - me[1]) / L;
      }
      row.push(v === 0 ? 0 : v.toFixed(6));
    });
    B.push(row);
  }
  const readme = `SE 310 Truss Explorer - LP data for "${X.pyName(S.name)}"
${summaryOf({ family: S.family, pattern: S.pattern, panels: S.panels, height: S.height, overall: tr.overall, ratio: S.ratio, sideAngle: S.sideAngle, curve: tr.info.curve, bottom: tr.info.shape, supportOffset: tr.info.supportOffset })}
Exported ${new Date().toISOString().slice(0, 10)}. Units: mm, N. One side truss (the loads are this truss's share).
${infoLines().join('\n')}

FILES
nodes.csv
  node, label        joint number (same numbering as the FEA script) and T/B label (top/bottom chord)
  x_mm, y_mm         coordinates
  load_x_N, load_y_N applied load on this truss, already multiplied by FS ${S.mat.FS} and divided by ${S.load.nTruss} trusses
                     (downward is negative). The book is ${(+S.bookLen).toFixed(0)} mm long, spread over the deck joints by tributary length.
  support            pin / roller / none (pin at the left main support joint; rollers at the matching right joint and, in
                     "every desk joint can bear" mode, at the other bottom joints that rest on a desk)
  fixed_x, fixed_y   1 if the table can push on this joint in that direction
  lifted_off_in_FEA  1 if the stiffness solution found this roller would have to pull down, so it was dropped there.
                     A table can only push up; how you treat that in your model is your call.

members.csv
  member, i, j       member number and its two joints
  L_mm               length (wood used per truss is the sum of these)
  cos_x, cos_y       direction cosines from joint i toward joint j
  tension_limit_N    sigma_t x A  = ${S.mat.sigT} MPa x ${A.toFixed(2)} mm^2
  euler_Pcr_N        pi^2 E I / (K L)^2 with E = ${S.mat.E} MPa, I = ${I.toFixed(3)} mm^4, K = ${S.mat.K}
  crush_limit_N      sigma_c x A  = ${S.mat.sigC} MPa x ${A.toFixed(2)} mm^2
  compression_limit_N  the smaller of the two above
  FEA_force_N        the stiffness-method force in this member for this exact design (tension positive), for comparison

equilibrium_matrix.csv
  One row per joint direction (n<node>_x, n<node>_y), one column per member.
  Entry = component, in that direction, of the unit vector pointing FROM that joint TOWARD the member's other end.
  So with member forces taken as tension positive, the column for member e tells you how a unit tension in e pulls on each joint.
  is_support_row = 1 marks rows where the table can supply a reaction.

Everything here is data from the current design. Writing the LP (variables, objective, constraints, and what the
dual values mean) is the part to do yourself.
`;
  return [
    { name: 'README.txt', text: readme },
    { name: 'nodes.csv', text: csvOf(nodes) },
    { name: 'members.csv', text: csvOf(mem) },
    { name: 'equilibrium_matrix.csv', text: csvOf(B) },
  ];
}
// ---------- build documents: joint styles, cut list, drawing, steps, templates
S.doc = Object.assign({ style: 'through', over: {}, stock: 240, kerf: 1, steps: true, tpl: true, colour: true, dash: false, bentTop: false }, S.doc || {});
// the kit's sticks are 240 mm (#116): move the old 914 mm default over once; a length set on purpose stays
if (!S.doc.stock240) { if (+S.doc.stock === 914) S.doc.stock = 240; S.doc.stock240 = true; }
// the 3D model and results the documents describe, when the 3D analysis is on
function doc3D() { return S.anaMode === '3d' && res && res.mode3 && res.mode3.m3 && res.mode3.r3 && res.mode3.r3.stable ? { m3: res.mode3.m3, r3: res.mode3.r3, tieJoint: S.opts.tieJoint } : null; }
function docPlan() {
  const b = +S.mat.b || 3.18;
  // keep only overrides that still match this design's joints
  const J = BuildDoc.jointsOf(tr), ok = {};
  Object.keys(S.doc.over).forEach(n => { const j = J.find(q => q.n === +n); if (!j) return; const o = S.doc.over[n]; if (o.through != null && !j.m.some(q => q.k === o.through)) return; ok[n] = o; });
  S.doc.over = ok;
  // pieces longer than one stock stick are spliced where the chord force is lowest (the worst of the two trusses in 3D)
  return BuildDoc.cutPlan(tr, b, { style: S.doc.style, over: S.doc.over, stock: +S.doc.stock || 240, force: k => res && res.members && res.members[k] ? res.members[k].F : 0, bentTop: !!S.doc.bentTop && topCurves() });
}
// a top chord that bends at its joints can be built as one stick bent to the curve (#282)
function topCurves() { return BuildDoc.cutPlan(tr, +S.mat.b || 3.18, { bentTop: true }).bendAt.length > 0; }
function renderDocDialog() {
  const plan = docPlan(), b = +S.mat.b || 3.18;
  document.querySelectorAll('input[name="jstyle"]').forEach(r => { r.checked = r.value === S.doc.style; });
  const curves = topCurves(); $('docBentBox').hidden = !curves; $('docBent').checked = !!S.doc.bentTop;
  const bck = curves && S.doc.bentTop ? BuildDoc.bentCheck(tr, plan, res, Object.assign({}, C.DEFAULT_MAT, S.mat)) : null;
  $('docBentNote').innerHTML = !curves ? '' : !bck ? 'Off: the curved top chord is cut as straight pieces, joint to joint.'
    : bck.tooTight ? `<b style="color:var(--bad)">✕ Too tight for one stick:</b> bent to this curve the chord reaches ${Math.round(bck.worstUse * 100)}% of its strength at the design load. Untick this for straight pieces, or flatten the curve.`
    : `Tightest radius ${bck.Rmin.toFixed(0)} mm: ${bck.mustSoak ? `<b>soak or steam it</b> and let it dry on the bending form (bent dry, the wood stretches ${(bck.strain * 100).toFixed(2)}%; it breaks at ${(bck.strainLimit * 100).toFixed(2)}%)` : 'it can be bent dry'}. Once dried to shape it uses up to ${Math.round(bck.worstUse * 100)}% of its strength at the design load. The documents add a bending form, the checks and the steps.`;
  $('docNest').checked = !!S.doc.nest;
  $('docBendRow').hidden = !(bck && !bck.tooTight); $('docBendN').value = bendCopies();
  $('docStock').value = S.doc.stock; $('docKerf').value = S.doc.kerf; $('docSteps').checked = S.doc.steps; $('docTpl').checked = S.doc.tpl; $('docColour').checked = S.doc.colour; $('docDash').checked = S.doc.dash;
  // view with joint numbers
  const v = BuildDoc.sideSVG(tr, plan, { labels: false, b, color: S.doc.colour ? 'part' : 'mono', dash: S.doc.dash });
  const lbl = tr.nodes.map((p, n) => `<text x="${p[0] + 2}" y="${v.Y(p[1]) - 2}" font-size="5" fill="#b0601a" font-family="Arial" font-weight="bold">${n}</text>`).join('');
  $('docView').setAttribute('viewBox', v.box.join(' ')); $('docView').innerHTML = v.svg + lbl;
  const nT = +S.load.nTruss || 2, total = plan.pieces.reduce((s, q) => s + q.long * q.n, 0) * nT;
  const d3 = doc3D(), cx = d3 ? BuildDoc.crossPlan(d3.m3, d3.r3, b, { tieJoint: S.opts.tieJoint, startNo: plan.items.length + 1 }) : null;
  $('docTieBox').hidden = !d3; document.querySelectorAll('input[name="tiejoint"]').forEach(r => { r.checked = r.value === (S.opts.tieJoint || 'ontop'); });
  const spl = (plan.splices || []).length;
  $('docSum').textContent = `${plan.pieces.length} pieces per truss in ${plan.items.length} different cuts · ${total.toFixed(0)} mm of stick for ${nT} trusses` + (cx ? ` + ${cx.parts.length} ties and braces between them (${cx.items.length} different cuts, ${cx.parts.reduce((s, q) => s + q.long, 0).toFixed(0)} mm).` : S.anaMode === '3d' ? ' (the 3D model is unstable, so its ties and bracing are left out).' : ' (before cross-ties).')
    + (spl ? ` ${spl} chord splice${spl > 1 ? 's' : ''}: a piece is longer than one ${+S.doc.stock || 240} mm stick.` : '')
    + (plan.pieces.some(q => q.long > (+S.doc.stock || 240) + 1e-9) ? ` ${plan.pieces.filter(q => q.long > (+S.doc.stock || 240) + 1e-9).length} piece${plan.pieces.filter(q => q.long > (+S.doc.stock || 240) + 1e-9).length > 1 ? 's are' : ' is'} longer than one ${+S.doc.stock || 240} mm stick and can't be spliced (a single member that long): use longer sticks.` : '')
    + ((plan.bad || []).length ? ` ${plan.bad.length} piece${plan.bad.length > 1 ? 's' : ''} can't be cut as set: change the joints marked below.` : '')
    + ((plan.short || []).length ? ` ${plan.short.length} member${plan.short.length > 1 ? 's are' : ' is'} under ${(6 * b).toFixed(0)} mm (6 stick widths): the pin-jointed results are less reliable there.` : '');
  const sw = no => S.doc.colour ? `<span style="display:inline-block;width:10px;height:10px;margin-right:4px;background:${BuildDoc.colOf(no)}"></span>` : '';
  $('docItems').innerHTML = '<thead><tr><th>Item</th><th class="l">Part</th><th>Qty</th><th>Long point</th><th>Short point</th><th class="l">End cuts</th></tr></thead><tbody>' +
    plan.items.map(it => `<tr><td>${sw(it.no)}${it.no}</td><td class="l">${BuildDoc.TL[it.type] || it.type}${it.bent ? ' (one bent stick)' : ''}</td><td>${it.pieces.length * nT * it.n}</td><td>${it.long.toFixed(1)}</td><td>${it.short.toFixed(1)}</td><td class="l">${it.cuts.map(BuildDoc.cutTxt).join(' / ')}</td></tr>`).join('')
    + (cx ? cx.items.map(it => `<tr><td>${sw(it.no)}${it.no}</td><td class="l">${it.label}</td><td>${it.pieces.length}</td><td>${it.long.toFixed(1)}</td><td>${it.short.toFixed(1)}</td><td class="l">${it.cuts.map(BuildDoc.cutTxt).join(' / ')}</td></tr>`).join('') : '') + '</tbody>';
  const name = k => `${k} ${(BuildDoc.TL[tr.elems[k].type] || '').toLowerCase()}`;
  $('docJoints').innerHTML = '<thead><tr><th>Joint</th><th class="l">On top / runs through</th><th class="l">Other ends</th><th>Mitre %</th></tr></thead><tbody>' +
    plan.joints.map(j => {
      const two = j.members.length === 2;
      const opts = ['<option value="">none</option>'].concat(j.members.map(k => `<option value="${k}" ${j.through === k ? 'selected' : ''}>${name(k)}</option>`)).join('');
      const ends = ['flush', 'square'].concat(two ? ['mitre'] : []).map(s => `<option value="${s}" ${j.end === s ? 'selected' : ''}>${s === 'flush' ? 'flush to it' : s === 'square' ? 'square (90°)' : 'mitre'}</option>`).join('');
      return `<tr${S.doc.over[j.n] ? ' style="background:var(--accent-soft)"' : ''}><td>${j.n}</td><td class="l"><select data-j="${j.n}" data-f="through">${opts}</select></td><td class="l"><select data-j="${j.n}" data-f="end">${ends}</select>${j.notes && j.notes.length ? `<div class="hint" style="margin:2px 0 0">Changed automatically: ${escH(j.notes.join('; '))}</div>` : ''}</td><td>${j.end === 'mitre' ? `<input type="number" min="5" max="95" step="5" value="${j.split}" data-j="${j.n}" data-f="split" style="width:60px">` : '—'}</td></tr>`;
    }).join('') + '</tbody>';
}
$('openDocs').addEventListener('click', () => { if (!res.stable) { toast('Make the design stable first: the build documents need a working bridge.', true); return; } renderDocDialog(); $('docModal').hidden = false; });
function showExport(x) {
  S.expTab = x; save(); $('s-export').open = true;
  document.querySelectorAll('#expTabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.x === x)));
  document.querySelectorAll('[data-xp]').forEach(p => { p.hidden = p.dataset.xp !== x; });
  if (x === 'docs') $('openDocs').click();
}
$('expTabs').addEventListener('click', ev => { const b = ev.target.closest('[data-x]'); if (!b) return; ev.preventDefault(); ev.stopPropagation(); showExport(b.dataset.x); });
showExport(S.expTab || 'bridge');
$('docNo').addEventListener('click', () => { $('docModal').hidden = true; });
$('docModal').addEventListener('keydown', ev => { if (ev.key === 'Escape') $('docModal').hidden = true; });
document.querySelectorAll('input[name="jstyle"]').forEach(r => r.addEventListener('change', () => { S.doc.style = r.value; save(); renderDocDialog(); }));
document.querySelectorAll('input[name="tiejoint"]').forEach(r => r.addEventListener('change', () => { S.opts.tieJoint = r.value; update(); renderDocDialog(); }));
$('docStock').addEventListener('change', () => guardNum('docStock', 50, 2000, S.doc.stock, v => { S.doc.stock = v; save(); renderDocDialog(); }, 'Stock stick length'));
$('docKerf').addEventListener('change', () => guardNum('docKerf', 0, 10, S.doc.kerf, v => { S.doc.kerf = v; save(); renderDocDialog(); }, 'Saw kerf'));
[['docSteps', 'steps'], ['docTpl', 'tpl'], ['docColour', 'colour'], ['docDash', 'dash'], ['docBent', 'bentTop']].forEach(([id, k]) => $(id).addEventListener('change', () => { S.doc[k] = $(id).checked; save(); renderDocDialog(); }));
$('docResetJ').addEventListener('click', () => { S.doc.over = {}; save(); renderDocDialog(); });
$('docJoints').addEventListener('change', ev => {
  const t = ev.target, n = t.dataset.j, f = t.dataset.f; if (n == null) return;
  const cur = Object.assign({}, S.doc.over[n] || {});
  if (f === 'through') cur.through = t.value === '' ? null : +t.value;
  else if (f === 'end') cur.end = t.value;
  else if (f === 'split') cur.split = Math.max(5, Math.min(95, +t.value || 50));
  if (cur.end === 'mitre' && cur.through === undefined) cur.through = null;
  S.doc.over[n] = cur; save(); renderDocDialog();
});
// TE-B-162: the bending sheet on its own (steps + 1:1 forms). Default one form per truss; the box sets more (spares).
function bendCopies() { return Math.max(1, Math.min(8, Math.round(+S.doc.bendN || +S.load.nTruss || 2))); }
$('docBendN').addEventListener('change', () => { S.doc.bendN = Math.max(1, Math.min(8, Math.round(+$('docBendN').value || 1))); save(); renderDocDialog(); });
$('docBendGo').addEventListener('click', () => {
  const plan = docPlan(), mat = Object.assign({}, C.DEFAULT_MAT, S.mat);
  const html = BuildDoc.bendingSheetHTML(tr, plan, res, { mat, name: S.name || 'Design', code: fingerprint(bridgeState()), b: +mat.b, h: +mat.h, nTruss: +S.load.nTruss || 2,
    info: (() => { const fi = fileInfo(); return `${fi.release} · ${fi.model} · bridge code ${fi.bridgeCode}`; })() }, { copies: bendCopies() });
  if (html) saveFile(fileBase() + '_bending_sheet.html', html);
});
function docMeta() {
  const mat = Object.assign({}, C.DEFAULT_MAT, S.mat);
  return { mat, name: S.name || 'Design', b: +mat.b, h: +mat.h, nTruss: +S.load.nTruss || 2, stock: +S.doc.stock || 240, kerf: +S.doc.kerf,
    ties: S.opts.crossTies ? { count: tr.deckNodes.length, len: +S.opts.width || 60 } : null, d3: doc3D(),
    massNote: `bridge mass ${res.massTotal.toFixed(1)} g`, capNote: `${res.capKg.toFixed(1)} kg of books (needs ${((S.load.mBook1 + S.load.mBook2) * S.mat.FS).toFixed(1)} kg)`,
    scaleNote: 'Templates: 1:1', info: (() => { const fi = fileInfo(); return `${fi.release} · ${fi.model} · bridge code ${fi.bridgeCode} · FS ${fi.rules.FS}, books ${fi.rules.bookKg} kg, envelope on outer faces`; })() };
}
$('docGo').addEventListener('click', () => {
  const html = BuildDoc.documentHTML(tr, res, docMeta(), docPlan(), { steps: S.doc.steps, templates: S.doc.tpl, colour: S.doc.colour, dash: S.doc.dash });
  saveFile(fileBase() + '_build_documents.html', html);
});
// TE-B-169: the minimum build set in black and white (steps, a one-page cut guide, end-angle templates, full-size templates)
$('docNest').addEventListener('change', () => { S.doc.nest = $('docNest').checked; save(); });
$('docMini').addEventListener('click', () => {
  const html = BuildDoc.documentHTML(tr, res, Object.assign(docMeta(), { code: fingerprint(bridgeState()) }), docPlan(), { minimal: true, nest: !!S.doc.nest });
  saveFile(fileBase() + '_build_set_bw.html', html);
});
