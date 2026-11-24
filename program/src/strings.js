// ===== Words on screen, in one place (TrussStrings; TE-B-364, the Architecture Lead's pick on TE-B-387) =====
// A frozen object of PLAIN TEXT (never HTML: whatever uses it escapes it or sets it as text), keyed 'step.piece.name'.
// Marketing hands wording as key = text lines; a piece asks for its words with t(key), which throws on a key that isn't here
// (a programmer error, CODE-N3), so a typo can't put a blank on screen. New steps put their words here, not in literals.
(function (root) {
'use strict';

const TEXT = Object.freeze({
  // sheets and dialogs (src/sheets.js; UI-W22, UI-W23)
  'sheets.close.label': 'Close',
  'sheets.close.title': 'Close (Esc)',
  // toasts (UI-W10)
  'toast.button.undo': 'Undo',
  'toast.key.undo': 'Ctrl+Z',        // shown beside Undo, and the key works while the toast is up (QA TE-B-502)
  'toast.key.undoMac': '⌘Z',
  // the sweep bar (src/sweepbar.js; UI-A2, UI-S5, UI-S9): one line per state; {n}, {total}, {eta} are filled in by TrussSweepBar; plain text only
  'sweepbar.state.idle': 'Run a sweep to list the best designs here.',
  'sweepbar.state.pilotRunning': 'Pilot: {n} of {total} designs…',
  'sweepbar.state.fullRunning': 'Full search: {n} of {total} designs · {eta} left · progress saved, so a reload can resume',
  'sweepbar.state.pilotDone': 'Low-fidelity pilot: these charts show only {n} random designs. Check the audit in the Sweep section, then run the full search.',
  'sweepbar.state.done': '{n} designs tested.',
  'sweepbar.state.outOfDate': 'Inputs changed since the last sweep, so the results and charts below are out of date.',
  'sweepbar.state.resumable': 'A full search stopped at {n} of {total} designs. Resume it, or discard it.',
  // the table piece and the Members tab (pieces.js, membersview.js; the Drawing window's old table in app/30-drawing.js
  // still says the unstable line itself until #453 takes that table out)
  'pieces.table.empty': 'Nothing to show.',
  'members.table.unstable': 'No results: the truss is unstable.',
  // callouts (src/callouts.js; UI-A13): the three result words on the drawing. {name} is filled in by TrussCallouts.fill; plain text only.
  'callout.determinacy.ok': '{mr} vs {jn} · m + r vs {dim}j · {det}',
  'callout.determinacy.indet': '{mr} vs {jn} · m + r vs {dim}j · indeterminate: assumes tight joints',
  'callout.determinacy.bad': '{mr} vs {jn} · m + r vs {dim}j · {det}',
  'callout.determinacy.missing': 'Determinacy: not available',
  'callout.delta.ok': 'δ {d} mm ≤ {limit} mm',
  'callout.delta.bad': 'δ {d} mm is over the {limit} mm limit',
  'callout.delta.missing': 'δ: not available',
  'callout.fits.ok': 'Fits the envelope and both desks',
  'callout.fits.envelope': '{reason}',
  'callout.fits.desk': 'Each end reaches only {ov} mm onto the desks; the edge check needs at least {min} mm, or a slightly off-centre bridge could slip into the gap. Add desk panels or lengthen the bridge.',
  'callout.fits.missing': 'Fit: not available',
  'callout.all.unstable': 'No results: the truss is unstable.',
});

function t(key) {
  if (!Object.prototype.hasOwnProperty.call(TEXT, key)) throw new Error('TrussStrings: no text for "' + key + '"');
  return TEXT[key];
}

const api = { TEXT, t };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussStrings = api;
})(typeof window !== 'undefined' ? window : globalThis);
