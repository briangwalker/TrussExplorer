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
//   editorHTML / mountEditor   the ✎ value editor (UI-I8), below
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

// ---------- the ✎ value editor (UI-I8, UI-W20, UI-W8, UI-I1, UI-I4) ----------
// editorHTML(P, o): a 320 px pop-up that moves by its title bar (⋮⋮ grip). It holds the value (a number box), the joystick
// and, when o.sweep is given, the sweep range (from, to, step, and the 'from → to · step = N values' line), then Done.
//   o = { id, label, unit, value, step, sweep: { on, from, to, step } | null }
// mountEditor(el, o): o = { check, step, sweepCheck, onCommit(v), onSweep({ on, from, to, step }), onClose(why), opener, cap }
//   The joystick: drag it left or right; the farther you push, the faster the value changes (UI-I8); it springs back when let
//   go, and it stops at a wall like the steppers (UI-I3). Keys on the joystick: ← → one step, Shift ×10 (role="slider").
//   Done (or Enter on Done) applies the sweep range and closes. Esc, or a click outside, closes it too (UI-W8: that click does
//   nothing else); the value itself was already committed as it changed. The sweep range over the cap (400 values, UI-I4)
//   is never cut: Done is refused and the note offers a coarser step.
//   Returns { value, close(why), destroy() }.
function editorHTML(P, o) {
  if (!P || !P.escH) fail('pass TrussPieces as the first argument');
  if (!o || !o.id || !o.label) fail('a value editor needs an id and a label');
  const esc = P.escH, id = esc(o.id), sw = o.sweep;
  const swHTML = sw ? `<fieldset class="te-ve-sw" data-part="sweep"><legend><label><input type="checkbox" class="te-ve-on"${sw.on ? ' checked' : ''}> ⇄ Sweep this input</label></legend>`
      + numberHTML(P, { id: o.id + '-from', label: 'From', unit: o.unit, value: sw.from })
      + numberHTML(P, { id: o.id + '-to', label: 'To', unit: o.unit, value: sw.to })
      + numberHTML(P, { id: o.id + '-step', label: 'Step', unit: o.unit, value: sw.step })
      + `<p class="te-ve-count" role="status"></p></fieldset>` : '';
  // the title keeps the label's case: h and H are different inputs (UI-A17), so no page h2 rule may upper-case it
  return `<section class="te-ve" id="${id}" data-part="value-editor" data-slot="bg" data-movable data-pc role="dialog" aria-labelledby="${id}-t" hidden>`
    + `<div class="te-ve-h" data-part="window-title"><span class="grip" aria-hidden="true">⋮⋮</span><h2 class="te-ve-t" id="${id}-t">✎ ${esc(o.label)}</h2></div>`
    + `<div class="te-ve-b">` + numberHTML(P, { id: o.id + '-v', label: o.label, unit: o.unit, value: o.value })
    + `<div class="te-ve-joy" role="slider" tabindex="0" aria-label="Change ${esc(o.label)} faster: push farther" aria-valuetext="hold and push left or right"><span class="te-ve-knob"></span></div>`
    + swHTML + `</div><div class="te-ve-f"><button type="button" class="te-ve-done" data-main>Done</button></div></section>`;
}

// how many values a range gives: from, from + step, … up to to (both ends counted), or null when it isn't a range
function rangeCount(from, to, step) {
  if (![from, to, step].every(Number.isFinite) || step <= 0 || to < from) return null;
  return Math.floor((to - from) / step + 1e-9) + 1;
}

function mountEditor(el, o) {
  o = o || {};
  const doc = el.ownerDocument, win = doc.defaultView, cap = o.cap > 0 ? o.cap : 400;
  const step = o.step > 0 ? o.step : 1;
  const val = mountNumber(el.querySelector('.te-ve-b > .te-num'), { check: o.check, step, value: o.value, onCommit: v => { if (o.onCommit) o.onCommit(v); } });
  const offs = [];
  const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); offs.push(() => t.removeEventListener(ev, fn, opt)); };
  // the sweep range
  const swEl = el.querySelector('.te-ve-sw'), sw = {};
  if (swEl) {
    const nums = [...swEl.querySelectorAll('.te-num')];
    const read = () => ({ on: swEl.querySelector('.te-ve-on').checked, from: sw.from.value, to: sw.to.value, step: sw.step.value });
    const count = () => {
      const r = read(), n = rangeCount(r.from, r.to, r.step), line = swEl.querySelector('.te-ve-count');
      const u = el.querySelector('.te-num-u') ? ' ' + el.querySelector('.te-num-u').textContent : '';
      line.textContent = n === null ? 'Set From ≤ To and a step above 0.' : `${show(r.from)} → ${show(r.to)}${u} · step ${show(r.step)} = ${n} value${n === 1 ? '' : 's'}` + (n > cap ? ` · over ${cap}: use a coarser step (UI-I4)` : '');
      el.dataset.over = n !== null && n > cap ? 'cap' : '';
      return n;
    };
    const sc = typeof o.sweepCheck === 'function' ? o.sweepCheck : o.check;
    sw.from = mountNumber(nums[0], { check: sc, step, value: o.sweep && o.sweep.from, onCommit: count });
    sw.to = mountNumber(nums[1], { check: sc, step, value: o.sweep && o.sweep.to, onCommit: count });
    sw.step = mountNumber(nums[2], { check: v => (v > 0 ? null : { kind: 'limit', msg: 'The step must be above 0.' }), step, value: o.sweep && o.sweep.step, onCommit: count });
    sw.read = read; sw.count = count;
    on(swEl.querySelector('.te-ve-on'), 'change', count);
    count();
  }
  // the joystick: rate grows with the push (squared), up to 20 steps a second at the edge; it springs back when let go
  const joy = el.querySelector('.te-ve-joy'), knob = joy.querySelector('.te-ve-knob');
  const inp = el.querySelector('.te-ve-b > .te-num .te-num-i');
  let push = 0, raf = 0, last = 0, acc = 0;
  const pressKey = (key, shift) => inp.dispatchEvent(new win.KeyboardEvent('keydown', { key, shiftKey: !!shift, bubbles: true }));
  const tick = t => {
    if (!push) { raf = 0; return; }
    const dt = last ? (t - last) / 1000 : 0; last = t;
    acc += Math.sign(push) * push * push * 20 * dt;           // steps owed so far
    while (Math.abs(acc) >= 1) { pressKey(acc > 0 ? 'ArrowUp' : 'ArrowDown'); acc -= Math.sign(acc); }
    raf = win.requestAnimationFrame(tick);
  };
  const setPush = p => { push = Math.max(-1, Math.min(1, p)); knob.style.transform = `translateX(${(push * 50).toFixed(1)}%)`; if (push && !raf) { last = 0; acc = 0; raf = win.requestAnimationFrame(tick); } };
  on(joy, 'pointerdown', ev => {
    ev.preventDefault(); joy.setPointerCapture && joy.setPointerCapture(ev.pointerId);
    const r = joy.getBoundingClientRect(), mid = r.left + r.width / 2, half = r.width / 2;
    const move = e => setPush((e.clientX - mid) / half);
    const up = () => { setPush(0); joy.removeEventListener('pointermove', move); joy.removeEventListener('pointerup', up); joy.removeEventListener('pointercancel', up); };
    joy.addEventListener('pointermove', move); joy.addEventListener('pointerup', up); joy.addEventListener('pointercancel', up);
    move(ev);
  });
  on(joy, 'keydown', ev => {
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') { ev.preventDefault(); pressKey('ArrowUp', ev.shiftKey); }
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') { ev.preventDefault(); pressKey('ArrowDown', ev.shiftKey); }
  });
  // moves by its title bar (UI-I8, UI-W20), kept inside its container
  const head = el.querySelector('.te-ve-h');
  on(head, 'pointerdown', ev => {
    ev.preventDefault();
    const box = el.offsetParent || doc.body, br = box.getBoundingClientRect(), r = el.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    const move = e => {
      const x = Math.max(0, Math.min(br.width - r.width, e.clientX - br.left - dx)), y = Math.max(0, Math.min(br.height - r.height, e.clientY - br.top - dy));
      el.style.left = x + 'px'; el.style.top = y + 'px';
    };
    const up = () => { doc.removeEventListener('pointermove', move); doc.removeEventListener('pointerup', up); };
    doc.addEventListener('pointermove', move); doc.addEventListener('pointerup', up);
  });
  // closing: Done applies the sweep; Esc or a click outside closes (UI-W8: the outside click does nothing else)
  let open = !el.hidden;
  function close(why) {
    if (!open) return; open = false; setPush(0); el.hidden = true;
    if (o.onClose) o.onClose(why);
    if (o.opener && o.opener.isConnected) o.opener.focus();
  }
  on(el.querySelector('.te-ve-done'), 'click', () => {
    if (swEl) {
      const n = sw.count(), r = sw.read();
      if (r.on && (n === null || n > cap)) { swEl.querySelectorAll('.te-num-i')[2].focus(); return; }   // never cut (UI-I4): fix the step first
      if (o.onSweep) o.onSweep(r);
    }
    close('done');
  });
  on(doc, 'pointerdown', ev => {
    if (!open || el.contains(ev.target) || (o.opener && o.opener.contains(ev.target))) return;
    ev.preventDefault(); ev.stopPropagation(); close('outside');
    const eat = e => { e.preventDefault(); e.stopPropagation(); }; doc.addEventListener('click', eat, { capture: true, once: true });
    win.setTimeout(() => doc.removeEventListener('click', eat, { capture: true }), 400);
  }, true);
  on(el, 'keydown', ev => { if (ev.key === 'Escape' && !ev.defaultPrevented) { ev.preventDefault(); close('esc'); } });
  return {
    get value() { return val.value; },
    show() { el.hidden = false; open = true; inp.focus(); },
    close, destroy() { setPush(0); offs.forEach(f => f()); val.destroy(); },
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
#stage .te-num[data-state="rule"] .te-num-i{border:2px solid var(--rule,#c8288c);color:var(--te-ink)}
#stage .te-num[data-state="nan"] .te-num-i{border:2px dashed var(--te-muted)}
#stage .te-ve{position:absolute;z-index:700;width:320px;box-sizing:border-box;background:var(--te-panel);color:var(--te-ink);border:1px solid var(--te-line);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.25);font:400 13px var(--te-font-ui)}
#stage .te-ve[hidden]{display:none}
#stage .te-ve-h{display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--te-line);cursor:move;touch-action:none;user-select:none}
#stage .te-ve-t{margin:0;font:700 14px var(--te-font-head);color:var(--te-ink);text-transform:none;letter-spacing:normal}
#stage .te-ve-b{display:flex;flex-direction:column;gap:10px;padding:10px}
#stage .te-ve-joy{position:relative;height:28px;border:1px solid var(--te-ctl-line);border-radius:14px;background:var(--te-ctl-bg);touch-action:none;cursor:ew-resize}
#stage .te-ve-knob{position:absolute;left:calc(50% - 12px);top:1px;width:24px;height:24px;border-radius:50%;background:var(--te-ink);transition:transform .12s ease-out}
#stage .te-ve-joy:focus-visible,#stage .te-ve-done:focus-visible,#stage .te-ve-on:focus-visible{outline:3px solid var(--te-focus, var(--te-accent));outline-offset:2px}
#stage .te-ve-sw{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:6px 8px;border:1px solid var(--te-line);border-radius:4px}
#stage .te-ve-sw legend{font:600 13px var(--te-font-ui);padding:0 4px}
#stage .te-ve-count{flex-basis:100%;margin:0;font:400 13px var(--te-font-ui)}
#stage .te-ve-f{display:flex;justify-content:flex-end;padding:8px 10px;border-top:1px solid var(--te-line)}
#stage .te-ve-done{font:700 14px var(--te-font-ui);padding:4px 14px;color:var(--te-ink);background:var(--te-ctl-bg);border:1px solid var(--te-ctl-line);border-radius:4px;cursor:pointer}
@media (prefers-reduced-motion: reduce){#stage .te-ve-knob{transition:none}}`;

function install(doc) {
  if (!doc || doc.getElementById('te-inputs')) return false;
  const st = doc.createElement('style'); st.id = 'te-inputs'; st.textContent = CSS; doc.head.appendChild(st); return true;
}

const api = { VERSION: '0.2.0', numberHTML, mountNumber, fromLimits, editorHTML, mountEditor, rangeCount, parse, show, CSS, install };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussInputs = api;
})(typeof window !== 'undefined' ? window : globalThis);
