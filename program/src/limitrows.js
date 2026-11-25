// ===== The Inputs pane's number rows on the limits table, ahead of step 8 (TrussLimitRows; TE-B-494, UI-I2, UI-I3, UI-I9, UI-I10) =====
// Beside inputs.js (TrussInputs) so the ✎ value editor (#478) and this can merge in either order. One global (CODE-F1).
// mount(doc, o) puts a TrussInputs box + stepper on each number row named in the limits table (TrussLimits.TABLE), with the
// check built by TrussInputs.fromLimits, so a box refuses what the table refuses (⟂ note, back on Enter) and marks a course
// rule pink. The app's own <input type="number"> STAYS in the row, hidden: it is still the value the app reads and writes,
// so every existing 'change' handler (pair(), guardNum(), the Undo toasts of #482) runs exactly as before:
//   - a value the box commits is put into the app's input with a 'change' event, as if typed there;
//   - a value the app writes into its input (update(), a range slider, Undo, a file) is followed by the box.
// When an input that other rows depend on changes (height, tableThick, bS, hS, minOverlap, bigCap; Math TE-B-444) or a
// shape/model button is pressed, every mounted row is checked again. braceDepth isn't checked while tableThick is 0 (TE-B-445).
//   o = { P: TrussPieces, I: TrussInputs, L: TrussLimits, pane, extra() -> { bottom, topShape, model }, rule(id, v, all) -> msg|null,
//         ids (default: every TABLE id with a number box in the pane) }
//   Returns { rows: Map(id -> box), values(), recheck(), destroy() }.
// Off by default: the app mounts it only when window.TE_FLAGS.limitsBoxes is true (?limits=1), until step 8 (#215) turns it on.
(function (root) {
'use strict';

const DEPENDS = ['height', 'tableThick', 'bS', 'hS', 'minOverlap', 'bigCap'];
const UNIT = { mm: 'mm', kg: 'kg', deg: '°', MPa: 'MPa', 'kg/m3': 'kg/m³', 'N/mm': 'N/mm' };
const CSS = `#stage .te-num[data-quiet] .te-num-l{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
#stage .row > .te-num[data-quiet], #stage .slide > .te-num[data-quiet]{display:inline-flex;flex-direction:column;align-items:flex-end}`;

function install(doc) {
  doc = doc || document;
  if (doc.getElementById('te-limitrows')) return;
  const st = doc.createElement('style'); st.id = 'te-limitrows'; st.textContent = CSS; doc.head.appendChild(st);
}

function mount(doc, o) {
  doc = doc || document; o = o || {};
  const { P, I, L } = o;
  if (!P || !I || !L || !L.TABLE) throw new Error('TrussLimitRows: pass TrussPieces, TrussInputs and TrussLimits');
  const pane = o.pane || doc;
  const win = doc.defaultView, proto = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value');
  const extra = typeof o.extra === 'function' ? o.extra : () => ({});
  const srcs = new Map(), rows = new Map(), offs = [];
  const raw = el => proto.get.call(el);
  // every limits-table input as a number, read from the app's own boxes, plus the shape and model ids (WHEN_IDS)
  function values() {
    const v = {};
    for (const r of L.TABLE) { const el = srcs.get(r.id) || doc.getElementById(r.id); if (el && el.type === 'number') { const n = I.parse(raw(el)); if (n !== null) v[r.id] = n; } }
    return Object.assign(v, extra());
  }
  const ids = (o.ids || L.TABLE.map(r => r.id)).filter(id => { const el = pane.querySelector('#' + id); return el && el.type === 'number' && !el.closest('.te-num'); });
  let following = false;
  for (const id of ids) {
    const src = pane.querySelector('#' + id), row = L.TABLE.find(r => r.id === id) || {};
    const rowEl = src.closest('.row'), lbl = rowEl && rowEl.querySelector('.lbl');
    const label = (lbl ? lbl.textContent : id).trim();
    const unit = UNIT[row.unit] && !label.includes('(' + row.unit + ')') ? UNIT[row.unit] : '';
    const step = +src.step > 0 ? +src.step : (row.step > 0 ? row.step : 1);
    const base = I.fromLimits(L, id, values, typeof o.rule === 'function' ? (v, all) => o.rule(id, v, all) : null);
    const check = v => (id === 'braceDepth' && values().tableThick === 0 ? null : base(v));   // TE-B-445
    src.insertAdjacentHTML('afterend', I.numberHTML(P, { id: id + '-tb', label, unit, value: I.parse(raw(src)) }));
    const el = src.nextElementSibling; el.dataset.quiet = ''; el.dataset.for = id;
    src.hidden = true; src.tabIndex = -1; src.setAttribute('aria-hidden', 'true');
    const box = I.mountNumber(el, {
      check, step, value: I.parse(raw(src)),
      onCommit: v => {
        following = true;
        try { proto.set.call(src, String(v)); src.dispatchEvent(new win.Event('input', { bubbles: true })); src.dispatchEvent(new win.Event('change', { bubbles: true })); }
        finally { following = false; }
        if (DEPENDS.includes(id)) recheck(id);
      },
    });
    // follow what the app writes into its own box (update(), a slider, Undo, a file): the box shows it and judges it again
    Object.defineProperty(src, 'value', {
      configurable: true,
      get() { return proto.get.call(src); },
      set(v) {
        proto.set.call(src, v);
        if (following) return;
        const n = I.parse(v);
        if (n !== null && n !== box.value) { box.set(n); if (DEPENDS.includes(id)) recheck(id); }
      },
    });
    srcs.set(id, src); rows.set(id, { box, el, src });
  }
  // check every row again (a dependency moved): a box keeps its value and says its state for the new limits
  function recheck(except) { for (const [id, r] of rows) if (id !== except && r.box.value !== null) r.box.set(r.box.value); }
  // shape and model buttons (topShape, bottom, the 2D/3D switch, which sits outside the pane) change which rows apply:
  // check again once the app has run (a click anywhere is cheap: about 40 rows)
  const later = () => win.setTimeout(() => recheck(), 0);
  doc.addEventListener('click', later); offs.push(() => doc.removeEventListener('click', later));
  return {
    rows, values, recheck: () => recheck(),
    destroy() {
      offs.forEach(f => f());
      for (const [, r] of rows) { r.box.destroy(); delete r.src.value; r.src.hidden = false; r.src.removeAttribute('tabindex'); r.src.removeAttribute('aria-hidden'); r.el.remove(); }
      rows.clear();
    },
  };
}

const api = { VERSION: '0.1.0', DEPENDS, mount, install, CSS };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussLimitRows = api;
})(typeof window !== 'undefined' ? window : globalThis);
