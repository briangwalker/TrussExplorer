// ===== Number boxes and steppers: shared pieces for step 8, the Inputs (TrussInputs; UI-I2, UI-I3, UI-I9, UI-I10) =====
// Beside pieces.js and sheets.js, with the same rules (CODE-F1 one global, pure builders, behaviour in mount functions,
// CSS scoped to #stage and installed once). The limits are NOT written here: a box asks a check function, and
// fromLimits() builds that function from the one limits table (TrussLimits, src/limits.js, RMA-4 / #462), so the boxes and
// the file loader read the same rows (UI-I10).
//   numberHTML(P, o)   a labelled number box with − and + steppers, its unit and a note line.
//                      o = { id, label, unit, value, title }
//   mountNumber(el, o) its behaviour. o = { check(v) -> null | { kind, msg }, onCommit(v), step, value }
//                      kind 'limit'   (a model limit or a value no bridge can have, UI-I3 / UI-I10): REFUSED. The box shows the
//                                      ⟂ note and, on Enter or leaving the box, goes back to the last good value. A stepper or
//                                      an arrow key stops at the wall instead of passing it.
//                      kind 'rule'    (a course rule, UI-I2): ALLOWED and committed, the box's edge turns pink (the number stays
//                                      ink, ART-C1; Graphics TE-B-443), the note names the rule.
//                      kind 'warn'    (allowed but unusual): committed, the note says why, no colour.
//                      Returns { value, set(v), markFile(msg), clear(), destroy() }.
//                      markFile(value, msg) is the file case of UI-I10: the value stays EXACTLY as the file had it (never clamped),
//                      the box gets the I3 look and the note, until the person types a good value; a refused value or Esc
//                      goes back to the FILE's value, not to an older one (UI Designer's MUST, TE-B-454).
//   fromLimits(L, id, values, rule) -> check(v): asks L.checkInputs / L.warnInputs with the box's value put into values()
//                      (a function returning the other inputs now), so expressions like 'height-10' use live values.
//   install(doc)       the CSS, once, in <style id="te-inputs">
(function (root) {
'use strict';

function fail(msg) { throw new Error('TrussInputs: ' + msg); }
const NUM = /^\s*[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?\s*$/i;
function parse(s) { return NUM.test(String(s)) ? +s : null; }
// the box's text for a number: no float noise (0.30000000000000004 -> 0.3), no exponent for ordinary sizes
function show(v) { return String(+(+v).toPrecision(12)); }

function numberHTML(P, o) {
  if (!P || !P.escH) fail('pass TrussPieces as the first argument');
  if (!o || !o.id || !o.label) fail('a number box needs an id and a label');
  const esc = P.escH, id = esc(o.id), lab = esc(o.label), v = o.value == null ? '' : esc(show(o.value));
  return `<span class="te-num" data-part="number" data-slot="ctl" data-pc>`
    + `<label class="te-num-l" for="${id}">${lab}</label>`
    + `<span class="te-num-row"><button type="button" class="te-step" data-dir="-1" tabindex="-1" aria-label="Less ${lab}">−</button>`
    + `<input class="te-num-i" id="${id}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${v}" aria-describedby="${id}-note"${o.title ? ` title="${esc(o.title)}"` : ''}>`
    + (o.unit ? `<span class="te-num-u" aria-hidden="true">${esc(o.unit)}</span>` : '')
    + `<button type="button" class="te-step" data-dir="1" tabindex="-1" aria-label="More ${lab}">+</button></span>`
    + `<span class="te-num-n" id="${id}-note" role="status" aria-live="polite" hidden></span></span>`;
}

function mountNumber(el, o) {
  o = o || {};
  const doc = el.ownerDocument, inp = el.querySelector('.te-num-i'), note = el.querySelector('.te-num-n');
  if (!inp || !note) fail('mountNumber needs the markup from numberHTML');
  const check = typeof o.check === 'function' ? o.check : () => null;
  const step = o.step > 0 ? o.step : 1;
  let good = o.value != null ? +o.value : parse(inp.value), fromFile = false, fileText = null, fileMsg = '';
  const offs = [];
  const on = (t, ev, fn) => { t.addEventListener(ev, fn); offs.push(() => t.removeEventListener(ev, fn)); };
  // width grows with the value: about 52-96 px (UI-I9; the look is ART-T2)
  const fit = () => { inp.style.width = `calc(${Math.max(2, Math.min(10, inp.value.length))}ch + 16px)`; };
  const say = (kind, msg) => {
    el.dataset.state = kind || '';
    if (!kind) { delete el.dataset.state; inp.removeAttribute('aria-invalid'); note.hidden = true; note.textContent = ''; return; }
    if (kind === 'limit' || kind === 'nan' || kind === 'file') inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
    note.hidden = false; note.textContent = (kind === 'limit' || kind === 'file' ? '⟂ ' : kind === 'rule' ? '! ' : '') + msg;
  };
  const judge = v => { if (v === null) return { kind: 'nan', msg: 'Type a number.' }; const r = check(v); return r && r.kind ? r : null; };
  const commit = v => { good = v; fromFile = false; if (o.onCommit) o.onCommit(v); };
  // typing: say at once what the value would be; nothing is committed until Enter or leaving the box
  // while typing the note updates silently; it is announced on Enter, on leaving the box and on a stepper (TE-B-454)
  on(inp, 'input', () => { fit(); note.setAttribute('aria-live', 'off'); const v = parse(inp.value), r = judge(v); say(r && r.kind, r && r.msg); });
  on(inp, 'change', () => note.setAttribute('aria-live', 'polite'));
  on(inp, 'keydown', ev => { if (ev.key === 'Enter' || ev.key === 'Escape' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown') note.setAttribute('aria-live', 'polite'); });
  const finish = () => {
    const v = parse(inp.value), r = judge(v);
    if (r && (r.kind === 'limit' || r.kind === 'nan')) {            // refused (UI-I3, UI-I10): back to the last good value
      if (fromFile) { backToFile(); return; }                        // ...or to the file's own value, kept until a good one is typed
      inp.value = good == null ? '' : show(good); fit();
      if (r.kind === 'limit') say('limit', r.msg);                   // keep saying why it went back
      else { const g = good == null ? null : judge(good); say(g && g.kind, g && g.msg); }
      return;
    }
    if (v !== good) commit(v);
    inp.value = show(v); fit(); say(r && r.kind, r && r.msg);
  };
  on(inp, 'change', finish);
  on(inp, 'keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); finish(); return; }
    if (ev.key === 'Escape' && fromFile && inp.value !== fileText) { ev.preventDefault(); ev.stopPropagation(); backToFile(); return; }
    if (ev.key === 'Escape' && !fromFile && parse(inp.value) !== good) { ev.preventDefault(); ev.stopPropagation(); inp.value = good == null ? '' : show(good); fit(); const r = good == null ? null : judge(good); say(r && r.kind, r && r.msg); return; }
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); nudge(ev.key === 'ArrowUp' ? 1 : -1, ev.shiftKey ? 10 : 1); }
  });
  // UI-I10: a file's impossible value is kept exactly as the file had it, in the 'file' state, until a good value is typed
  function backToFile() { inp.value = fileText; fit(); say('file', fileMsg); }
  // a stepper or an arrow key moves by the step and STOPS at a wall (UI-I3); past a course rule it goes on, pink (UI-I2)
  function nudge(dir, times) {
    const base = parse(inp.value) !== null ? parse(inp.value) : good;
    if (base === null) return;
    let v = base, last = null;
    for (let n = 0; n < times; n++) {
      const next = +(Math.round((v + dir * step) / step) * step).toPrecision(12), r = judge(next);
      if (r && r.kind === 'limit') { last = r; break; }
      v = next;
    }
    if (v !== base) { inp.value = show(v); fit(); commit(v); const r = judge(v); say(r && r.kind, r && r.msg); }
    if (last) say('limit', last.msg);
  }
  el.querySelectorAll('.te-step').forEach(b => on(b, 'click', () => { note.setAttribute('aria-live', 'polite'); nudge(+b.dataset.dir, 1); inp.focus(); }));
  fit();
  if (good !== null) { const r = judge(good); if (r && r.kind !== 'limit') say(r.kind, r.msg); }
  return {
    get value() { return good; },
    set(v) { good = +v; fromFile = false; inp.value = show(v); fit(); const r = judge(good); say(r && r.kind, r && r.msg); },
    // UI-I10, opening a file: keep the file's value exactly, mark it, say why; never clamp, never commit
    // markFile(msg) marks the value now in the box; markFile(value, msg) puts the file's value in first
    markFile(a, b) {
      if (b !== undefined || typeof a === 'number') { inp.value = a == null ? '' : String(a); }
      const msg = b !== undefined ? b : (typeof a === 'string' ? a : undefined);
      fromFile = true; fileText = inp.value; fileMsg = msg || 'This value is outside what any bridge can have.'; fit(); say('file', fileMsg);
    },
    clear() { say('', ''); },
    destroy() { offs.forEach(f => f()); },
  };
}

// the limits table as a box's check function: errors are 'limit', warnings 'warn' (course rules come from the rule table, later)
// rule(v) -> null | msg (optional): the course rules for this input (UI-I2), which limits.js doesn't hold; a value inside the
// limits but past a course rule is 'rule' (committed, marked pink). Errors win over rules, rules over warnings.
function fromLimits(L, id, values, rule) {
  if (!L || typeof L.checkInputs !== 'function') fail('pass TrussLimits (src/limits.js)');
  const get = typeof values === 'function' ? values : () => ({});
  return v => {
    const all = Object.assign({}, get(), { [id]: v });
    const e = L.checkInputs(all).find(x => x.id === id);
    if (e) return { kind: 'limit', msg: e.msg };
    const rm = typeof rule === 'function' ? rule(v, all) : null;
    if (rm) return { kind: 'rule', msg: rm };
    const w = typeof L.warnInputs === 'function' ? L.warnInputs(all).find(x => x.id === id) : null;
    return w ? { kind: 'warn', msg: w.msg } : null;
  };
}

const CSS = `
#stage .te-num{display:inline-flex;flex-direction:column;gap:2px;font:400 13px var(--te-font-ui);color:var(--te-ink);vertical-align:top}
#stage .te-num-l{font:600 13px var(--te-font-ui);color:var(--te-ink)}
#stage .te-num-row{display:inline-flex;align-items:center;gap:4px}
#stage .te-num-i{min-width:52px;max-width:96px;box-sizing:border-box;padding:3px 6px;font:400 14px var(--te-font-mono);font-variant-numeric:tabular-nums;text-align:right;
  color:var(--te-ink);background:var(--te-ctl-bg);border:1px solid var(--te-ctl-line);border-radius:4px}
#stage .te-num-u{font:400 13px var(--te-font-ui);color:var(--te-muted)}
#stage .te-step{min-width:24px;min-height:24px;padding:0;font:700 14px var(--te-font-ui);color:var(--te-ink);background:var(--te-ctl-bg);border:1px solid var(--te-ctl-line);border-radius:4px;cursor:pointer}
#stage .te-num :is(.te-num-i,.te-step):focus-visible{outline:3px solid var(--te-focus, var(--te-accent));outline-offset:2px}
#stage .te-num-n{font:400 13px var(--te-font-ui);color:var(--te-ink);max-width:28em}
#stage .te-num[data-state="limit"] .te-num-i,#stage .te-num[data-state="file"] .te-num-i{border:2px solid var(--te-muted);background:var(--te-line-soft)}
#stage .te-num[data-state="rule"] .te-num-i{border:2px solid var(--rule);color:var(--te-ink)}
#stage .te-num[data-state="nan"] .te-num-i{border:2px dashed var(--te-muted)}`;

function install(doc) {
  if (!doc || doc.getElementById('te-inputs')) return false;
  const st = doc.createElement('style'); st.id = 'te-inputs'; st.textContent = CSS; doc.head.appendChild(st); return true;
}

const api = { VERSION: '0.1.1', numberHTML, mountNumber, fromLimits, parse, show, CSS, install };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussInputs = api;
})(typeof window !== 'undefined' ? window : globalThis);
