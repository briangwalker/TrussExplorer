// ===== Truss unlocks: when the OG theme unlocks (UI-T6, #162) =====
// UI-T6: OG "unlocks after the first finished sweep or 20 minutes". Badge: OG.
// State (plain JSON, safe to save): { firstSweepAt: ISO string or null, usedMs: number (ms of use), lastTickMs: number or null }
//   lastTickMs is the epoch ms of the last 'tick'; a state without it is still valid (it reads as null).
// note(state, event, nowMs) returns a NEW state and never edits the old one:
//   'sweep-finished'  sets firstSweepAt once (the first time only)
//   'tick'            adds the ms since the last tick, at most TICK_MAX_MS per tick, so a sleeping laptop, a page
//                     closed for a week or a clock jump can't unlock it; a clock going backwards adds nothing.
// A missing, damaged or wrong-type state counts as fresh() and nothing here throws (CODE-N2).
// No DOM, no app state (CODE-F1, CODE-F5): Node tests load it directly; build.py inlines it before app.js.
(function (root) {
'use strict';

const MINUTES = 20;                     // minutes of use that unlock OG
const TICK_MAX_MS = 60000;              // the most one tick can add, in ms
const BADGE = Object.freeze({ og: 'OG' });

const fresh = () => ({ firstSweepAt: null, usedMs: 0, lastTickMs: null });

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isIso = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(v) && Number.isFinite(Date.parse(v));

// A clean copy of a good state, or fresh() for anything damaged.
function clean(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return fresh();
  const last = s.lastTickMs === undefined ? null : s.lastTickMs;
  if (!(s.firstSweepAt === null || isIso(s.firstSweepAt))) return fresh();
  if (!isNum(s.usedMs) || s.usedMs < 0) return fresh();
  if (!(last === null || isNum(last))) return fresh();
  return { firstSweepAt: s.firstSweepAt, usedMs: s.usedMs, lastTickMs: last };
}

function note(state, event, nowMs) {
  const s = clean(state);
  if (!isNum(nowMs)) return s;
  if (event === 'sweep-finished') {
    if (s.firstSweepAt === null) s.firstSweepAt = new Date(nowMs).toISOString();
  } else if (event === 'tick') {
    if (s.lastTickMs !== null) s.usedMs += Math.min(TICK_MAX_MS, Math.max(0, nowMs - s.lastTickMs));
    s.lastTickMs = nowMs;
  }
  return s;
}

function unlocked(state) {
  const s = clean(state);
  return { og: s.firstSweepAt !== null || s.usedMs >= MINUTES * 60000 };
}

const api = { MINUTES, TICK_MAX_MS, BADGE, fresh, note, unlocked };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussUnlocks = api;
})(typeof window !== 'undefined' ? window : globalThis);
