// ===== The wood pile: an end-on bundle of sticks, sized from the wood used (RMA-11; board TE-B-498b, TE-B-495 (2); UI-D3, UI-T4, ART-D3) =====
// pile(woodMm, stick) -> { sticks, rows, cols, w, h, leftover }, with stick = { b, h, stock } in mm (bS, hS and docStock from the inputs).
//   sticks = ceil(woodMm / stock); cols = ceil(sqrt(sticks)); rows = ceil(sticks / cols) (a near-square bundle, never taller than wide);
//   w = cols * b and h = rows * stick.h (the box in mm, no gaps); leftover = sticks * stock - woodMm (mm of the last stick that is not used).
// bundleRects(p, stick, gap) -> [{ x, y, w, h }] for each stick end, bottom row first, left to right, origin at the pile's bottom-left (y up),
//   gap in mm between sticks (default 0). The drawing paints these rects and does no geometry of its own; with a gap the box is wider by (cols - 1) * gap and taller by (rows - 1) * gap.
// A theme may supply its own picture of the pile (woodpile.svg, UI-T4); it takes its size from this unit, so both agree.
// A bad or missing number gives the empty pile, never NaN and never a throw (CODE-N2). Pure: no DOM, no app state, nothing rounded but the count (CODE-F1, CODE-F5).
(function (root) {
'use strict';

const EMPTY = () => ({ sticks: 0, rows: 0, cols: 0, w: 0, h: 0, leftover: 0 });
const pos = v => typeof v === 'number' && isFinite(v) && v > 0;
const EPS = 1e-9;   // so that exactly n stocks of wood is n sticks, not n + 1, whatever the float rounding

function pile(woodMm, stick) {
  const s = stick && typeof stick === 'object' ? stick : {};
  if (!pos(woodMm) || !pos(s.b) || !pos(s.h) || !pos(s.stock)) return EMPTY();
  const sticks = Math.max(1, Math.ceil(woodMm / s.stock - EPS));
  const cols = Math.ceil(Math.sqrt(sticks) - EPS), rows = Math.ceil(sticks / cols - EPS);
  return { sticks, rows, cols, w: cols * s.b, h: rows * s.h, leftover: Math.max(0, sticks * s.stock - woodMm) };
}

function bundleRects(p, stick, gap) {
  const s = stick && typeof stick === 'object' ? stick : {}, q = p && typeof p === 'object' ? p : {};
  if (!pos(s.b) || !pos(s.h) || !Number.isInteger(q.sticks) || q.sticks < 1 || !Number.isInteger(q.cols) || q.cols < 1) return [];
  const g = pos(gap) ? gap : 0, out = [];
  for (let i = 0; i < q.sticks; i++) out.push({ x: (i % q.cols) * (s.b + g), y: Math.floor(i / q.cols) * (s.h + g), w: s.b, h: s.h });
  return out;
}

const api = Object.freeze({ pile, bundleRects });
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussPile = api;
})(typeof window !== 'undefined' ? window : globalThis);
