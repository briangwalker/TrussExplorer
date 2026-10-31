// ===== Truss members: the Members tab's data (#211, UI-S6) =====
// rows(tr, res, opts) gives one plain object per member, in res.members order, with the SAME values the v61 member
// table / CSV (rowsForCsv() in src/app/30-drawing.js) puts in its columns, but unrounded and without words:
//   k, i, j        member number and its two joints
//   type           the member type code ('top', 'bot', 'end', 'vert', 'diag', 'brace', 'claw'); the screen turns it
//                  into words with TrussExport.TYPE_LABEL, as the CSV does
//   sticks         sticks glued in the member (1-4); compact: true when 4 sticks are glued 2x2 (the CSV's "(2x2)")
//   L_mm           length, mm
//   F_N            axial force, N (+ tension, - compression)
//   TC             'T', 'C' or '0'
//   Pcr_N          buckling load, N
//   buckles        'Y' or 'N'
//   cap_N          capacity in the member's own direction, N (tension capacity if F > 0, compression if F < 0, else 0)
//   use            use as a fraction of capacity (0.93, not '93')
//   governs        what governs ('' when nothing does)
// The screen does the rounding, sorting and words (UI-S6, UI-A17). An unstable result, or no result, gives [].
// No DOM, no S / tr / res globals: they come in as arguments (CODE-F1, CODE-F5). tr and opts are taken for the
// screen's call shape; every value comes from res.members today.
(function (root) {
'use strict';

function rows(tr, res, opts) {
  if (!res || typeof res !== 'object' || !res.stable || !Array.isArray(res.members)) return [];
  return res.members.map(m => ({
    k: m.k, i: m.i, j: m.j, type: m.type,
    sticks: m.n, compact: m.n === 4 && m.bundle === 'compact',
    L_mm: m.L, F_N: m.F, TC: m.TC, Pcr_N: m.Pcr, buckles: m.buckles,
    cap_N: m.F > 0 ? m.capT : m.F < 0 ? m.capC : 0,
    use: m.util, governs: m.mode,
  }));
}

const api = { rows };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussMembers = api;
})(typeof window !== 'undefined' ? window : globalThis);
