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
  // the table piece and the Members tab (moved here from pieces.js and membersview.js once #419 / #438 merge)
  'pieces.table.empty': 'Nothing to show.',
  'members.table.unstable': 'No results: the truss is unstable.',
});

function t(key) {
  if (!Object.prototype.hasOwnProperty.call(TEXT, key)) throw new Error('TrussStrings: no text for "' + key + '"');
  return TEXT[key];
}

const api = { TEXT, t };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussStrings = api;
})(typeof window !== 'undefined' ? window : globalThis);
