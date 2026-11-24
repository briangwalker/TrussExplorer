// ===== The sweep bar's state: one pure function of plain facts (RMA-10; board TE-B-497b, TE-B-495 (3); UI-A2, UI-W15, UI-S5, UI-S9) =====
// state(facts, progress) -> { kind, count, total, eta, msg, canRun, canCancel, canResume, canDiscard }
//   kind: 'idle' | 'pilot-running' | 'full-running' | 'pilot-done' | 'done' | 'out-of-date' | 'resumable'
//   precedence: running > resumable > out-of-date > done / pilot-done > idle.
// facts: what SweepState.facts() hands over (app/60-sweep.js): { mode ('none' | 'sweep' | 'pilot' | 'full'), running, pilot (a pilot exists to run the full search from),
//   cancel (a cancel was asked), busy (any sweep is running), stale (the inputs changed since the last sweep), rows (how many results there are),
//   resumable: { done, total } or missing/null when a saved full search can be resumed (UI-S9) }. Unknown extra fields are ignored; a missing or odd one reads as off.
// progress: { i, n, eta, phase? } from the progress callback, or null. While running, phase ('pilot' | 'full') says which run it is; without it a run is a full search
//   when a pilot already exists (facts.pilot) and a pilot otherwise.
// canRun is true whenever nothing is running, the resumable state too (UI-A2: Run sweep is always in the bar); in that state a new run discards the saved
// search, so the bar asks first with its UI-W13 dialog (UI Designer, UI-S9); nothing is discarded until the person confirms.
// msg is plain text from TrussStrings ('sweepbar.state.<kind>', camelCase: sweepbar.state.pilotRunning) with {n}, {total}, {eta} filled in; whatever paints it sets textContent.
// Pure: no DOM, no timers, no app state (CODE-F1, CODE-F4, CODE-F5). Damaged input reads as idle and never throws (CODE-N2).
(function (root) {
'use strict';

const KINDS = Object.freeze(['idle', 'pilot-running', 'full-running', 'pilot-done', 'done', 'out-of-date', 'resumable']);
const strings = () => (typeof module !== 'undefined' && module.exports ? require('./strings.js') : root.TrussStrings);
const num = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);
const show = n => Math.round(n).toLocaleString('en-US');
function fill(key, map) {
  return String(strings().t(key)).replace(/\{([a-z]+)\}/g, (all, name) => {
    if (!Object.prototype.hasOwnProperty.call(map, name)) throw new TypeError('TrussSweepBar: no value for {' + name + '} in "' + key + '"');
    return String(map[name]);
  });
}

function state(facts, progress) {
  const f = facts && typeof facts === 'object' ? facts : {}, p = progress && typeof progress === 'object' ? progress : null;
  const running = f.running === true, busy = running || f.busy === true;
  const rows = Math.floor(num(f.rows)), ck = f.resumable && typeof f.resumable === 'object' ? { done: num(f.resumable.done), total: num(f.resumable.total) } : null;
  let kind, count = 0, total = 0, eta = '';
  if (running) {
    const phase = p && (p.phase === 'pilot' || p.phase === 'full') ? p.phase : (f.pilot === true ? 'full' : 'pilot');
    kind = phase === 'full' ? 'full-running' : 'pilot-running';
    count = p ? num(p.i) : 0; total = p ? num(p.n) : 0; eta = p && typeof p.eta === 'string' ? p.eta : '';
  } else if (ck && !busy) { kind = 'resumable'; count = ck.done; total = ck.total; }
  else if (f.stale === true && !busy) { kind = 'out-of-date'; count = rows; }
  else if (rows > 0 && !busy) { kind = f.mode === 'pilot' ? 'pilot-done' : 'done'; count = rows; total = rows; }
  else kind = 'idle';
  const msg = fill('sweepbar.state.' + kind.replace(/-([a-z])/g, (m, c) => c.toUpperCase()), { n: show(count), total: show(total), eta });
  return { kind, count, total, eta, msg,
    canRun: !busy, canCancel: running && f.cancel !== true, canResume: kind === 'resumable', canDiscard: kind === 'resumable' };
}

const api = Object.freeze({ state, KINDS });
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussSweepBar = api;
})(typeof window !== 'undefined' ? window : globalThis);
