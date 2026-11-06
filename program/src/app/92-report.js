
// ---------- Report a bug (#115; UI-W14, UI-W13, UI-W22, UI-W23, UI-A21; White Hat TE-B-136 and TE-B-315)
// ☰'s last row opens a dialog that says exactly what the form link carries (version, model, bridge code), then
// saves this bridge as TE-bug-<code>.truss (the normal bridge save) and opens Brian's Google Form in a new tab,
// pre-filled with those three things and the technical details White Hat cleared (TE-B-323), shown before it opens. Nothing is uploaded by the page: the person attaches the file by hand.
// The form's address is ONE fixed constant (never built from a file, a setting or the page address).
const BUG_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSfyuQGRg7v4PAn3nU8owBNG84E3ukX3w4WCOAkwjL7MWnJWgg/viewform';
// the form's pre-fill fields, from Brian's pre-filled link (TE-B-338, 11-05 23:25); each value goes through encodeURIComponent
const BUG_FORM_FIELDS = { release: 'entry.1594388703', model: 'entry.700670228', code: 'entry.1525333786', tech: 'entry.1232166955' };
// the bridge as it will be saved: with 'Leave names out' ticked the typed name is replaced, so the code is worked out
// AFTER that, and the code in the dialog, the link and the file name matches the saved file (White Hat, TE-B-341 note 2)
function bugBridge() { const b = bridgeState(), nr = $('bugNamesRow'), nb = $('bugNames'); if (nr && !nr.hidden && nb && nb.checked) b.name = TrussNames.looksGenerated(S.autoName) ? S.autoName : 'Design'; return b; }
function bugFacts() { const fi = fileInfo(), b = bugBridge(); return { release: fi.release, model: fi.model, code: fingerprint(b), tech: bugTech(), bridge: b }; }
// the last error, as its kind + where only (White Hat, TE-B-323 (2)): never its message, which can hold values from a file
let bugLastErr = '';
window.addEventListener('error', ev => { const f = String(ev.filename || '').split(/[?#]/)[0].split('/').pop() || 'page';
  bugLastErr = `${(ev.error && ev.error.name) || 'Error'} at ${f}:${ev.lineno || 0}`; });
window.addEventListener('unhandledrejection', ev => { bugLastErr = `${(ev.reason && ev.reason.name) || 'Rejection'} (promise)`; });
// 'Technical details': ONLY White Hat's cleared list (TE-B-323 (1)-(2)), built here from fixed sources, shown in the
// dialog before the form opens. Never the full user agent, time zone, names, file names, saved data or the page address.
function bugBrowser() {
  const ua = navigator.userAgent || '', os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'other';
  const m = ua.match(/(Edg|OPR|Firefox|Chrome|CriOS|FxiOS|Version)\/(\d+)/), name = m ? ({ Edg: 'Edge', OPR: 'Opera', CriOS: 'Chrome', FxiOS: 'Firefox', Version: 'Safari' }[m[1]] || m[1]) : 'other';
  return `${name}${m ? ' ' + m[2] : ''} / ${os}`;
}
function bugTech() {
  const sh = window.__shell && window.__shell.state, mq = q => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  const dpr = +(window.devicePixelRatio || 1).toFixed(2);
  let store = 'yes'; try { localStorage.setItem('te-probe', '1'); localStorage.removeItem('te-probe'); } catch (e) { store = 'no'; }
  const theme = (document.getElementById('stage') || {}).dataset ? (document.getElementById('stage').dataset.theme || 'classic') : 'classic';
  const place = sh ? sh.place : 'classic', view = place === 'analysis' ? (S.tab || '') : (S.anaMode === '3d' ? '3D' : '2D');
  const wins = sh && sh.w && sh.w[sh.place] ? Object.entries(sh.w[sh.place]).map(([k, v]) => k + ':' + v).join(' ') + ' bar:' + sh.bar : '';
  const parts = [bugBrowser(), `win ${innerWidth}x${innerHeight}, screen ${screen.width}x${screen.height} @${dpr}`,
    `theme ${theme}`, `${place} ${view}`, wins, `lang ${(navigator.language || '').split('-')[0] || '?'}`,
    `pointer ${mq('(pointer: coarse)') ? 'touch' : 'mouse'}`, `reduced-motion ${mq('(prefers-reduced-motion: reduce)') ? 'on' : 'off'}`, `forced-colours ${mq('(forced-colors: active)') ? 'on' : 'off'}`,
    `joints ${tr && tr.nodes ? tr.nodes.length : 0}, members ${tr && tr.elems ? tr.elems.length : 0}, sweep rows ${SweepState.rows().length}`, `storage ${store}`, `last error ${bugLastErr || 'none'}`];
  return parts.filter(Boolean).join(' · ').slice(0, 1200);
}
function bugFormUrl(f) {
  const q = Object.entries(BUG_FORM_FIELDS).map(([k, e]) => e + '=' + encodeURIComponent(f[k] == null ? '' : String(f[k])));
  return BUG_FORM + '?usp=pp_url&' + q.join('&');
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
      <dl class="kv"><dt>Version</dt><dd id="bugRel"></dd><dt>Model</dt><dd id="bugModel"></dd><dt>Bridge code</dt><dd id="bugCode"></dd><dt>Technical details</dt><dd id="bugTech" class="bugtech"></dd></dl>
      <p class="note">No name, email or files are sent by the link: only what's listed here. Google asks you to sign in to attach files; attaching is optional.</p>
            <label class="check" id="bugNamesRow" hidden><input type="checkbox" id="bugNames" checked> Leave names out (the design's name isn't saved in the file)</label>
    </div>
    <div class="btns bugft"><a class="btn acc" id="bugGo" target="_blank" rel="noopener noreferrer">Save bridge and open form</a><button type="button" class="btn ghost" id="bugCancel">Cancel</button></div>
  </div>`;
  document.body.appendChild(md);
  let opener = null;
  function open() {
    opener = document.activeElement; if (typeof closeDock === 'function') closeDock();
    $('bugNamesRow').hidden = !typedName(); $('bugNames').checked = true;
    fill(); md.hidden = false; $('bugGo').focus();
  }
  function fill() {
    const f = bugFacts(); $('bugRel').textContent = f.release; $('bugModel').textContent = f.model; $('bugCode').textContent = f.code;
    $('bugTech').textContent = f.tech; $('bugGo').href = bugFormUrl(f);
  }
  $('bugNames').addEventListener('change', fill);
  function close() { md.hidden = true; const o = opener; opener = null; if (o && o.isConnected && o.offsetParent && typeof o.focus === 'function') o.focus(); else if ($('dockBtn')) $('dockBtn').focus(); }   // the opener sits in the closed ☰, so focus goes back to ☰ (QA, TE-B-315)
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
    const f = bugFacts(), b = f.bridge;
    const doc = Object.assign({ format: 'se310-truss-bridge', version: FILE_VER }, fileInfo(), { bridgeCode: f.code, name: b.name || 'Design', summary: bridgeSummary(), bridge: b });
    const fn = 'TE-bug-' + f.code + TrussFormats.KINDS.bridge.ext;
    saveNamed(fn, JSON.stringify(doc, null, 1)).then(() => toast(`Saved ${fn} · attach it to the form`));
    setTimeout(close, 0);
  });
})();
