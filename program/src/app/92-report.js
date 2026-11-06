
// ---------- Report a bug (#115; UI-W14, UI-W13, UI-W22, UI-W23, UI-A21; White Hat TE-B-136 and TE-B-315)
// ☰'s last row opens a dialog that says exactly what the form link carries (version, model, bridge code), then
// saves this bridge as TE-bug-<code>.truss (the normal bridge save) and opens Brian's Google Form in a new tab,
// pre-filled with those three things only. Nothing is uploaded by the page: the person attaches the file by hand.
// The form's address is ONE fixed constant (never built from a file, a setting or the page address).
const BUG_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSfyuQGRg7v4PAn3nU8owBNG84E3ukX3w4WCOAkwjL7MWnJWgg/viewform';
// the pre-fill field of the form's first question ('Version, model, bridge code'), from Brian's pre-filled link
// (TE-B-315). While it is null the form opens empty and the dialog shows the three values to copy in.
const BUG_FORM_ENTRY = null;
function bugFacts() { const fi = fileInfo(); return { release: fi.release, model: fi.model, code: fi.bridgeCode }; }
function bugFormUrl(f) {
  if (!BUG_FORM_ENTRY) return BUG_FORM;
  return BUG_FORM + '?usp=pp_url&' + BUG_FORM_ENTRY + '=' + encodeURIComponent(`${f.release} · ${f.model} · ${f.code}`);
}
// a design name the person typed may be a person's name (#260); the generated one never is
const typedName = () => !!S.name && S.name !== S.autoName && !TrussNames.looksGenerated(S.name);
(function reportBug() {
  const sep = document.createElement('div'); sep.className = 'dsep';
  const row = document.createElement('button'); row.type = 'button'; row.id = 'reportBugBtn'; row.className = 'btn ghost sm reportrow'; row.textContent = 'Report a bug…';
  const menu = $('dockMenu'), hid = menu.querySelector(':scope > span[hidden]');
  menu.insertBefore(sep, hid); menu.insertBefore(row, hid);
  const md = document.createElement('div'); md.className = 'modal bugmodal'; md.id = 'bugModal'; md.hidden = true;
  md.innerHTML = `<div class="modalcard bugcard" role="dialog" aria-modal="true" aria-labelledby="bugTitle">
    <div class="bughd"><h2 id="bugTitle">Report a bug</h2><button type="button" class="btn ghost sm" id="bugX" aria-label="Close">✕</button></div>
    <div class="bugbd">
      <p>TE saves this bridge as a file, then opens a short Google form in a new tab. Attach the file there.</p>
      <p>The form link carries only:</p>
      <dl class="kv"><dt>Version</dt><dd id="bugRel"></dd><dt>Model</dt><dd id="bugModel"></dd><dt>Bridge code</dt><dd id="bugCode"></dd></dl>
      <p class="note">No name, email or files are sent by the link. Google asks you to sign in to attach files; attaching is optional.</p>
      <p class="note" id="bugCopy" hidden>Copy the three values above into the form's first question.</p>
      <label class="check" id="bugNamesRow" hidden><input type="checkbox" id="bugNames" checked> Leave names out (the design's name isn't saved in the file)</label>
    </div>
    <div class="btns bugft"><a class="btn acc" id="bugGo" target="_blank" rel="noopener noreferrer">Save bridge and open form</a><button type="button" class="btn ghost" id="bugCancel">Cancel</button></div>
  </div>`;
  document.body.appendChild(md);
  let opener = null;
  function open() {
    opener = document.activeElement; if (typeof closeDock === 'function') closeDock();
    const f = bugFacts(); $('bugRel').textContent = f.release; $('bugModel').textContent = f.model; $('bugCode').textContent = f.code;
    $('bugGo').href = bugFormUrl(f); $('bugCopy').hidden = !!BUG_FORM_ENTRY;
    $('bugNamesRow').hidden = !typedName(); $('bugNames').checked = true;
    md.hidden = false; $('bugGo').focus();
  }
  function close() { md.hidden = true; const o = opener; opener = null; if (o && o.isConnected && typeof o.focus === 'function') o.focus(); else if ($('dockBtn')) $('dockBtn').focus(); }
  row.addEventListener('click', ev => { ev.stopPropagation(); open(); });
  $('bugX').addEventListener('click', close); $('bugCancel').addEventListener('click', close);
  // UI-W22: a click on the dimmed backdrop closes it (nothing is typed here) and does nothing else
  md.addEventListener('pointerdown', ev => { if (ev.target === md) { ev.preventDefault(); ev.stopPropagation(); close(); } });
  md.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { ev.stopPropagation(); close(); return; }
    if (ev.key === 'Tab') {   // focus stays inside the dialog (UI-W13)
      const f = [...md.querySelectorAll('a[href], button, input')].filter(e => e.offsetParent); if (!f.length) return;
      const i = f.indexOf(document.activeElement), n = ev.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
      ev.preventDefault(); f[n].focus();
    }
  });
  // the link opens the form itself (a plain link in a new tab, never fetched by the page); the click also saves the file
  $('bugGo').addEventListener('click', () => {
    const f = bugFacts(), b = bridgeState();
    if (!$('bugNamesRow').hidden && $('bugNames').checked) { b.name = TrussNames.looksGenerated(S.autoName) ? S.autoName : 'Design'; }
    const doc = Object.assign({ format: 'se310-truss-bridge', version: FILE_VER }, fileInfo(), { name: b.name || 'Design', summary: bridgeSummary(), bridge: b });
    const fn = 'TE-bug-' + f.code + TrussFormats.KINDS.bridge.ext;
    saveNamed(fn, JSON.stringify(doc, null, 1)).then(() => toast(`Saved ${fn} · attach it to the form`));
    setTimeout(close, 0);
  });
})();
