// ===== Sheets, dialogs and toasts: shared pieces (TrussSheets; UI-A16, UI-W8, UI-W10, UI-W13, UI-W22, UI-W23) =====
// Steps 10 and 2b (#217, #410, #411, #399). Kept beside pieces.js (same rules: CODE-F1 one global, pure builders,
// behaviour in mount functions, CSS scoped to #stage and installed once) so the open pieces PRs don't collide.
//   sheetHTML(P, o)   markup for a ☰ sheet or a dialog: a fixed HEADER (title and ✕), a MIDDLE that scrolls, a fixed BUTTON
//                     ROW (UI-W23). o = { id, kind: 'sheet'|'dialog', title, body (HTML the caller built and escaped),
//                     buttons: [{ label, act, main, cancel }] }. The main button names the action (UI-W13): never "OK".
//   modals(doc)       one manager per page: open(el, opener) / close(el, why) / top(). One sheet or dialog at a time
//                     (opening another closes the first, UI-A16). Esc closes the top one; a click on the dimmed backdrop
//                     closes it the same way and does nothing else on the page behind (UI-W22). A DIALOG holding typed
//                     values not applied yet (el.dataset.dirty, or o.isDirty(el) returning true) ignores the backdrop
//                     click and flashes its Cancel button once, so nothing typed is lost. Focus moves in on open, Tab
//                     stays inside, and focus goes back to the opener on close (WAI-ARIA APG dialog).
//   toasts(doc, o)    one toast at a time, bottom centre (UI-W10): show({ text, undo, ms }) -> { close() }. It fades after
//                     about 4 s (longer for long text), waits while the pointer or focus is on it (WCAG 2.2.1), and
//                     carries Undo when undo is given. role="status", so screen readers read it without moving focus.
//   install(doc)      the CSS, once, in <style id="te-sheets">
(function (root) {
'use strict';

function fail(msg) { throw new Error('TrussSheets: ' + msg); }
// words from TrussStrings (src/strings.js), looked up when used, so load order doesn't matter
function t(key) { const T = root.TrussStrings || (typeof require === 'function' ? require('./strings.js') : null); if (!T) fail('TrussStrings is missing'); return T.t(key); }

function sheetHTML(P, o) {
  if (!P || !P.escH) fail('pass TrussPieces as the first argument');
  if (!o || !o.id || !o.title) fail('a sheet needs an id and a title');
  const kind = o.kind || 'sheet';
  if (kind !== 'sheet' && kind !== 'dialog') fail('kind is sheet or dialog');
  const esc = P.escH, id = esc(o.id), btns = Array.isArray(o.buttons) ? o.buttons : [];
  if (kind === 'dialog' && !btns.some(b => b.main)) fail('a dialog needs a main button that names its action (UI-W13)');
  for (const b of btns) {
    if (!b.label) fail('a button needs a label');
    if (b.main && /^\s*(ok|okay|yes|go|submit)\s*$/i.test(b.label)) fail('the main button names the action and its size, never "' + b.label + '" (UI-W13)');
  }
  const row = btns.map(b => P.buttonHTML({ label: b.label, act: b.act || (b.cancel ? 'cancel' : null) })
    .replace('<button ', `<button${b.main ? ' data-main' : ''}${b.cancel ? ' data-cancel' : ''} `)).join('');
  return `<dialog class="te-sheet" id="${id}" data-kind="${kind}" data-part="sheet" data-slot="bg" data-pc aria-labelledby="${id}-t">`
    + `<div class="te-sh-h" data-part="sheet-header"><h2 class="te-sh-t" id="${id}-t">${esc(o.title)}</h2>`
    + `<button type="button" class="te-sh-x" data-close aria-label="${esc(t('sheets.close.label'))}" title="${esc(t('sheets.close.title'))}">✕</button></div>`
    + `<div class="te-sh-m" data-part="sheet-middle" tabindex="-1">${o.body || ''}</div>`
    + (row ? `<div class="te-sh-b" data-part="sheet-buttons">${row}</div>` : '')
    + `</dialog>`;
}

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function modals(doc, opts) {
  doc = doc || document; opts = opts || {};
  const stack = [];
  const visible = el => [...el.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null || x === doc.activeElement);
  const dirty = el => el.dataset.dirty != null || !!(opts.isDirty && opts.isDirty(el));
  function close(el, why) {
    const i = stack.findIndex(x => x.el === el); if (i < 0) return false;
    const [x] = stack.splice(i, 1);
    x.off.forEach(f => f());
    if (el.open) el.close();
    if (opts.onClose) opts.onClose(el, why || 'close');
    if (x.opener && x.opener.isConnected && typeof x.opener.focus === 'function') x.opener.focus();
    return true;
  }
  function flash(el) {
    const c = el.querySelector('[data-cancel]') || el.querySelector('.te-sh-x');
    if (!c) return; c.classList.remove('te-flash'); void c.offsetWidth; c.classList.add('te-flash');
    setTimeout(() => c.classList.remove('te-flash'), 700);
  }
  function open(el, opener) {
    if (!el || stack.some(x => x.el === el)) return;
    while (stack.length) close(stack[stack.length - 1].el, 'replaced');
    const on = (t, ev, fn) => { t.addEventListener(ev, fn); return () => t.removeEventListener(ev, fn); };
    const off = [
      // Esc: the dialog element's own cancel event; we close it ourselves so the opener gets focus back
      on(el, 'cancel', ev => { ev.preventDefault(); close(el, 'esc'); }),
      // the backdrop: a pointer-down whose point is outside the dialog's box (the ::backdrop reports the dialog as target)
      on(el, 'pointerdown', ev => {
        const r = el.getBoundingClientRect();
        const out = ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
        if (!out) return;
        ev.preventDefault(); ev.stopPropagation();
        if (el.dataset.kind === 'dialog' && dirty(el)) { flash(el); return; }
        close(el, 'backdrop');
      }),
      on(el, 'click', ev => {
        if (ev.target.closest('[data-close],[data-cancel]')) close(el, ev.target.closest('[data-cancel]') ? 'cancel' : 'close');
      }),
      // Tab stays inside (APG): wrap from the last focusable to the first and back
      on(el, 'keydown', ev => {
        if (ev.key !== 'Tab') return;
        const f = visible(el); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (ev.shiftKey && doc.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && doc.activeElement === last) { ev.preventDefault(); first.focus(); }
      }),
      // focus is never hidden (UI-W23, WCAG 2.4.11): whatever gets focus in the middle is scrolled fully into view
      on(el, 'focusin', ev => { if (ev.target.closest('.te-sh-m') && ev.target.scrollIntoView) ev.target.scrollIntoView({ block: 'nearest' }); }),
    ];
    stack.push({ el, opener: opener || doc.activeElement, off });
    if (!el.open) el.showModal();
    // focus: the first field in the middle if there is one, else the main button, else the ✕ (APG dialog)
    const field = el.querySelector('.te-sh-m :is(input,select,textarea):not([disabled])');
    (field || el.querySelector('[data-main]') || el.querySelector('.te-sh-x')).focus();
  }
  return { open, close, flash, top() { return stack.length ? stack[stack.length - 1].el : null; } };
}

function toasts(doc, o) {
  doc = doc || document; o = o || {};
  let box = null, timer = null, cur = null;
  function ensure() {
    if (box && box.isConnected) return box;
    box = doc.createElement('div');
    box.className = 'te-toast'; box.dataset.part = 'toast'; box.dataset.slot = 'disp'; box.setAttribute('data-pc', '');
    box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); box.hidden = true;
    (o.host || doc.getElementById('stage') || doc.body).appendChild(box);
    const hold = () => { clearTimeout(timer); timer = null; };
    const resume = () => { if (cur && !box.matches(':hover') && !box.contains(doc.activeElement)) arm(cur.ms); };
    box.addEventListener('pointerenter', hold); box.addEventListener('pointerleave', resume);
    box.addEventListener('focusin', hold); box.addEventListener('focusout', ev => { if (!box.contains(ev.relatedTarget)) resume(); });
    box.addEventListener('click', ev => {
      if (!ev.target.closest('[data-undo]') || !cur) return;
      const fn = cur.undo; hide(); if (fn) fn();
    });
    return box;
  }
  function arm(ms) { clearTimeout(timer); timer = setTimeout(hide, ms); }
  function hide() { clearTimeout(timer); timer = null; cur = null; if (box) { box.hidden = true; box.textContent = ''; } }
  function show(m) {
    if (!m || !m.text) throw new Error('TrussSheets: a toast needs text');
    const b = ensure();
    const ms = m.ms || Math.max(4000, String(m.text).length * 70);
    cur = { undo: typeof m.undo === 'function' ? m.undo : null, ms };
    b.textContent = '';
    const s = doc.createElement('span'); s.className = 'te-toast-t'; s.textContent = m.text; b.appendChild(s);
    if (cur.undo) { const u = doc.createElement('button'); u.type = 'button'; u.className = 'te-toast-u'; u.dataset.undo = ''; u.textContent = t('toast.button.undo'); b.appendChild(u); }
    b.hidden = false; arm(ms);
    return { close: hide };
  }
  return { show, hide, get el() { return box; } };
}

// The look, Wireframe values from --te-* tokens (themes win: their rules are more specific). Text 13 px or more.
const CSS = `
#stage dialog.te-sheet{padding:0;border:1px solid var(--te-line);border-radius:6px;background:var(--te-panel);color:var(--te-ink);
  width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:auto;font:400 14px var(--te-font-ui)}
#stage dialog.te-sheet:not([open]){display:none}
#stage dialog.te-sheet::backdrop{background:rgba(0,0,0,.35)}
#stage .te-sh-h{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--te-line);background:var(--te-panel)}
#stage .te-sh-t{flex:1;margin:0;font:700 16px var(--te-font-head);color:var(--te-ink)}
#stage .te-sh-x{font:400 16px var(--te-font-ui);min-width:32px;min-height:32px;border:1px solid var(--te-ctl-line);border-radius:4px;background:var(--te-ctl-bg);color:var(--te-ink);cursor:pointer}
#stage .te-sh-m{flex:1 1 auto;min-height:72px;overflow:auto;padding:12px;scroll-padding:12px}
#stage .te-sh-b{position:sticky;bottom:0;z-index:1;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:10px 12px;border-top:1px solid var(--te-line);background:var(--te-panel)}
#stage .te-sh-b [data-main]{font-weight:700}
#stage :where(dialog.te-sheet) :is(button,input,select,textarea,[tabindex]):focus-visible{outline:3px solid var(--te-accent);outline-offset:2px}
#stage .te-flash{animation:te-flash .6s ease-out 1}
@keyframes te-flash{0%,100%{box-shadow:none}30%{box-shadow:0 0 0 4px var(--te-accent)}}
@media (prefers-reduced-motion: reduce){#stage .te-flash{animation:none;outline:3px solid var(--te-accent)}}
#stage .te-toast{position:fixed;left:50%;bottom:var(--te-toast-bottom,72px);transform:translateX(-50%);z-index:900;max-width:min(560px,calc(100vw - 32px));
  display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:6px;background:var(--te-strong);color:var(--te-on-strong);font:400 14px var(--te-font-ui);box-shadow:0 2px 8px rgba(0,0,0,.25)}
#stage .te-toast[hidden]{display:none}
#stage .te-toast-u{font:700 14px var(--te-font-ui);color:var(--te-on-strong);background:transparent;border:1px solid var(--te-on-strong);border-radius:4px;padding:2px 10px;cursor:pointer}
#stage .te-toast-u:focus-visible{outline:3px solid var(--te-accent);outline-offset:2px}`;

function install(doc) {
  if (!doc || doc.getElementById('te-sheets')) return false;
  const st = doc.createElement('style'); st.id = 'te-sheets'; st.textContent = CSS; doc.head.appendChild(st); return true;
}

const api = { VERSION: '0.1.0', sheetHTML, modals, toasts, CSS, install };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussSheets = api;
})(typeof window !== 'undefined' ? window : globalThis);
