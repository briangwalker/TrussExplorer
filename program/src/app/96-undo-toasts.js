// ---------- step 2b (#399, UI-W10): after an input change, a toast says what changed and offers Undo ----------
// One listener on the inputs pane. It remembers each control's last value and, on a change, shows the shell's toast
// ("Changed h 70 → 80 · Undo"); Undo puts the old value back through the control itself, so every handler runs as if
// the person had typed it. Only the balsaPixel shell has toasts (window.__shell, set up after app.js); the v61 layout
// is unchanged. Nothing here reads files or storage.
// Only a PERSON's change makes a toast (UI-W10, #502): start-up, restore, open and the app's own sets change values
// without one, and announce nothing. A change counts as the person's when its event is trusted (typed, clicked,
// dragged) or when it follows the person's own click or key within a second (a screen piece writing the value for
// them, as the ✎ editor and the limits-table boxes do). Any other change only moves the baseline, so a later Undo
// puts back the value the person really started from, never an older bridge's (#501).
(() => {
  const pane = $('inputsPane'); if (!pane) return;
  const last = new Map();          // control id -> last value seen (as a string)
  let undoing = false;             // an Undo in flight: its own change gets no toast
  const GESTURE_MS = 1000;         // a synthetic change this soon after the person's own click or key is theirs
  let gestureAt = -Infinity;
  ['pointerdown', 'pointerup', 'keydown', 'keyup', 'touchstart', 'touchend', 'input'].forEach(n =>
    document.addEventListener(n, ev => { if (ev.isTrusted) gestureAt = performance.now(); }, true));
  const byPerson = ev => ev.isTrusted || performance.now() - gestureAt < GESTURE_MS;
  const sh = () => (window.__shell && window.__shell.toasts) || null;
  const isBox = el => el && el.matches && el.matches('input[type="number"], input[type="range"], input[type="checkbox"], select') && el.id && el.type !== 'file';
  const val = el => el.type === 'checkbox' ? (el.checked ? 'on' : 'off') : String(el.value);
  // the words: the row's label up to its " · " (h, L, Books …), else the control's own label or aria-label
  function nameOf(el) {
    const row = el.closest('.row'), lbl = row && row.querySelector('.lbl');
    let t = lbl ? lbl.textContent : '';
    if (!t) { const l = el.id && pane.querySelector(`label[for="${el.id}"]`); t = l ? l.textContent : (el.getAttribute('aria-label') || el.closest('label') && el.closest('label').textContent || el.id); }
    t = String(t).trim().split(' · ')[0].trim();
    return t.length > 28 ? t.slice(0, 27) + '…' : t;
  }
  const seen = el => { if (isBox(el)) last.set(el.id, val(el)); };
  pane.querySelectorAll('input, select').forEach(seen);
  // a range and its number box are one input (pair in 20-inputs.js): the range's id ends in R and the box has the base id
  const boxFor = el => (el.type === 'range' && /R$/.test(el.id) && $(el.id.slice(0, -1))) || el;
  // the baseline is what a control holds when the person reaches it: a value set meanwhile by Open, a restore or the app
  // itself (no toast for those) is read fresh here, so "Changed h 70 → 72" names the value they saw (#501)
  pane.addEventListener('focusin', ev => { const el = ev.target; if (!isBox(el)) return; seen(el); const box = boxFor(el); if (box !== el) seen(box); });
  function show(name, from, to, undo) {
    const T = sh(); if (!T) return;
    T.show({ text: `Changed ${name} ${from} → ${to}`, undo });
  }
  pane.addEventListener('change', ev => {
    const el = ev.target; if (!isBox(el)) return;
    const box = boxFor(el), id = box.id, now = val(box);
    const was = last.has(id) ? last.get(id) : (el !== box ? last.get(el.id) : undefined);
    last.set(id, now); if (el !== box) last.set(el.id, val(el));
    if (undoing || was === undefined || was === now || !byPerson(ev)) return;
    show(nameOf(box), was, now, () => {
      undoing = true;
      try {
        if (box.type === 'checkbox') { box.checked = was === 'on'; box.dispatchEvent(new Event('change', { bubbles: true })); }
        else setInput(box, was, 'change');
      } finally { undoing = false; }
    });
  });
  // segmented pickers (family, pattern, bottom …): the pressed button is the value
  pane.addEventListener('click', ev => {   // capture: read the pressed button before the picker's own handler repaints it
    const b = ev.target.closest && ev.target.closest('.seg button[data-v]'); if (!b || undoing || !byPerson(ev)) return;
    const seg = b.closest('.seg'); if (!seg || !seg.id) return;
    const prev = [...seg.querySelectorAll('button[data-v]')].find(x => x.getAttribute('aria-pressed') === 'true' && x !== b);
    if (!prev || prev.dataset.v === b.dataset.v) return;
    const row = seg.closest('.row'), lbl = row && row.querySelector('.lbl');
    const name = (lbl ? lbl.textContent : seg.getAttribute('aria-label') || seg.id).trim().split(' · ')[0].trim();
    // after the click's own handler has repainted the pressed state
    setTimeout(() => { if (b.getAttribute('aria-pressed') !== 'true') return; show(name, prev.textContent.trim(), b.textContent.trim(), () => { undoing = true; try { prev.click(); } finally { undoing = false; } }); }, 0);
  }, true);
})();
