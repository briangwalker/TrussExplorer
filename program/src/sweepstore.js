// ===== Sweep store: a sweep's rows prepared once, for charts that open fast (#236 step 2; grows into #175's SweepStore) =====
// Plan: Math's profile and the Architecture Lead's order of work on #236. Pure: no DOM, no app state, so Node tests load it.
//   TrussSweepStore.make(rows)        a store over these rows (the array is read, never changed)
//   store.col(key, get?)              Float64Array of one number per row (NaN when missing), built once per key and kept
//   store.range(key, idx?)            [min, max] of the finite values, by a loop (no Math.min(...spread): #223)
//   store.groups(keyOf, order?)       [{ key, idx: Int32Array }], rows grouped by keyOf(row), groups in `order` (default: numbers up, then text)
//   store.frontier(idx, yOf, ok)      row indices on the wood-vs-y frontier, exactly as 70-charts frontier() picks them
//   store.lightest(idx, ok)           index of the least-wood row that passes ok (first one on a tie), or -1
// Keys built with a custom `get` are cached under the key, so give each different `get` its own key.
(function (root) {
'use strict';

function make(rows) {
  rows = Array.isArray(rows) ? rows : [];
  const n = rows.length, cols = new Map();
  let all = null;
  const allIdx = () => { if (!all) { all = new Int32Array(n); for (let i = 0; i < n; i++) all[i] = i; } return all; };

  function col(key, get) {
    let c = cols.get(key);
    if (c) return c;
    c = new Float64Array(n);
    for (let i = 0; i < n; i++) { const v = get ? get(rows[i]) : rows[i][key]; c[i] = typeof v === 'number' ? v : v == null || v === '' ? NaN : +v; }
    cols.set(key, c);
    return c;
  }

  function range(key, idx) {
    const c = col(key); idx = idx || allIdx();
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < idx.length; k++) { const v = c[idx[k]]; if (v === v && v !== Infinity && v !== -Infinity) { if (v < lo) lo = v; if (v > hi) hi = v; } }
    return lo <= hi ? [lo, hi] : null;
  }

  function groups(keyOf, order) {
    const m = new Map();
    for (let i = 0; i < n; i++) { const k = keyOf(rows[i]); let g = m.get(k); if (!g) { g = []; m.set(k, g); } g.push(i); }
    const keys = [...m.keys()].sort(order || ((a, b) => typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))));
    return keys.map(k => ({ key: k, idx: Int32Array.from(m.get(k)) }));
  }

  // The same rule as frontier() in src/app/70-charts.js: rows with a finite y that pass ok, by wood up then y down
  // (earlier row first on a full tie, as a stable sort gives), kept while y climbs by more than 1e-9.
  function frontier(idx, yOf, ok) {
    idx = idx || allIdx();
    const wood = col('wood'), y = new Float64Array(n), cand = [];
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k], r = rows[i], v = yOf ? yOf(r) : r.capKg;
      if (!isFinite(v) || (ok && !ok(r))) continue;
      y[i] = v; cand.push(i);
    }
    const s = Int32Array.from(cand);
    s.sort((a, b) => (wood[a] - wood[b]) || (y[b] - y[a]) || (a - b));
    const out = []; let best = -Infinity;
    for (let k = 0; k < s.length; k++) { const i = s[k]; if (y[i] > best + 1e-9) { out.push(i); best = y[i]; } }
    return out;
  }

  function lightest(idx, ok) {
    idx = idx || allIdx();
    const wood = col('wood'); let best = -1;
    for (let k = 0; k < idx.length; k++) { const i = idx[k]; if (ok && !ok(rows[i])) continue; if (best < 0 || wood[i] < wood[best]) best = i; }
    return best;
  }

  return { rows, length: n, col, range, groups, frontier, lightest, all: allIdx };
}

const api = { make };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussSweepStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
