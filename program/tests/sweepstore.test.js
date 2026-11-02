// Sweep store (#236 step 2): the same answers as today's chart code, prepared once.
//   node --test tests/sweepstore.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const T = require(path.join(__dirname, '..', 'src', 'sweepstore.js'));
const F = require(path.join(__dirname, '..', 'src', 'formats.js'));

// today's code in src/app/70-charts.js, copied so the store is checked against it
function frontierOld(rows, yOf, ok) {
  yOf = yOf || (r => r.capKg);
  const s = rows.filter(r => isFinite(yOf(r)) && ok(r)).slice().sort((a, b) => a.wood - b.wood || yOf(b) - yOf(a));
  const f = []; let best = -Infinity;
  s.forEach(r => { if (yOf(r) > best + 1e-9) { f.push(r); best = yOf(r); } });
  return f;
}
const lightestOld = rows => rows.filter(r => r.passes).sort((x, y) => x.wood - y.wood)[0];
function groupsOld(rows, g) {
  const m = new Map();
  rows.forEach(r => { const key = g === 'overlap' ? Math.round(r[g]) : r[g]; if (!m.has(key)) m.set(key, []); m.get(key).push(r); });
  return [...m.entries()].sort((a, b) => (typeof a[0] === 'number' ? a[0] - b[0] : String(a[0]).localeCompare(String(b[0])))).map(([k, rr]) => ({ k, rows: rr }));
}
// a seeded random sweep with many exact ties in wood and capacity
function fake(n, seed) {
  let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: n }, (_, i) => ({ i, wood: Math.round(rnd() * 400) * 10 + 1000, capKg: Math.round(rnd() * 200) / 10, util: 0.2 + rnd(), D: rnd() * 3, passes: rnd() > 0.3,
    pattern: ['pratt', 'howe', 'warren'][Math.floor(rnd() * 3)], panels: 4 + 2 * Math.floor(rnd() * 3), overlap: 30 + rnd() * 40 }));
}
const sets = () => {
  const out = [['fake 5k', fake(5000, 7)], ['fake 20k', fake(20000, 11)]];
  const fx = path.join(__dirname, 'formats', 'fixtures', 'v2-v61-height-panels.sweep.json');
  if (fs.existsSync(fx)) out.push(['v2 fixture', F.open(fs.readFileSync(fx, 'utf8')).doc.rows]);
  return out;
};
const okDefl = r => !(r.D > 0) || r.D <= 2;

test('frontier: the same rows, in the same order, as 70-charts frontier()', () => {
  for (const [name, rows] of sets()) {
    const st = T.make(rows);
    const combined = r => Math.min(r.util > 0 ? 1 / r.util : Infinity, r.D > 0 ? 2 / r.D : Infinity);
    for (const [yName, yOf] of [['capacity', null], ['combined', combined]]) {
      const want = frontierOld(rows, yOf || undefined, okDefl), got = st.frontier(null, yOf, okDefl).map(i => rows[i]);
      assert.strictEqual(got.length, want.length, `${name} ${yName}: length`);
      got.forEach((r, k) => assert.strictEqual(r, want[k], `${name} ${yName}: row ${k}`));
      assert.ok(want.length > 0, `${name} ${yName}: non-empty`);
    }
  }
});

test('groups and per-group frontier and lightest match the chart code', () => {
  for (const [name, rows] of sets()) {
    const st = T.make(rows);
    for (const g of ['pattern', 'panels', 'overlap']) {
      const old = groupsOld(rows, g), got = st.groups(r => g === 'overlap' ? Math.round(r[g]) : r[g]);
      assert.deepStrictEqual(got.map(x => x.key), old.map(x => x.k), `${name} by ${g}: group order`);
      got.forEach((x, k) => {
        assert.deepStrictEqual([...x.idx].map(i => rows[i]), old[k].rows, `${name} ${g}=${x.key}: members`);
        assert.deepStrictEqual(st.frontier(x.idx, null, okDefl).map(i => rows[i]), frontierOld(old[k].rows, undefined, okDefl), `${name} ${g}=${x.key}: frontier`);
        const l = st.lightest(x.idx, r => r.passes);
        assert.strictEqual(l < 0 ? undefined : rows[l], lightestOld(old[k].rows), `${name} ${g}=${x.key}: lightest passing`);
      });
    }
  }
});

test('columns are built once and kept; ranges skip missing values', () => {
  const rows = [{ wood: 3, capKg: 1 }, { wood: '5', capKg: null }, { wood: 1, capKg: NaN }, { wood: 2 }];
  const st = T.make(rows);
  assert.strictEqual(st.col('wood'), st.col('wood'));
  assert.deepStrictEqual([...st.col('wood')], [3, 5, 1, 2]);
  assert.deepStrictEqual(st.range('wood'), [1, 5]);
  assert.deepStrictEqual(st.range('capKg'), [1, 1]);
  assert.strictEqual(T.make([]).range('wood'), null);
  assert.strictEqual(T.make([]).lightest(null, () => true), -1);
  assert.deepStrictEqual(T.make([]).frontier(), []);
});

test('#223: a 1,000,000-row sweep gets its ranges (no spread into Math.min)', () => {
  const n = 1000000, rows = new Array(n);
  for (let i = 0; i < n; i++) rows[i] = { wood: 1000 + (i % 977), capKg: (i % 131) / 7 };
  const st = T.make(rows);
  assert.deepStrictEqual(st.range('wood'), [1000, 1976]);
  assert.deepStrictEqual(st.range('capKg'), [0, 130 / 7]);
  assert.throws(() => Math.min(...rows.map(r => r.wood)), RangeError, 'the old way overflows the stack here');
});

test('speed: frontier and lightest per group on 50k rows, prepared once', () => {
  const rows = fake(50000, 3), t0 = performance.now();
  const st = T.make(rows), gs = st.groups(r => r.pattern);
  gs.forEach(g => { st.frontier(g.idx, null, okDefl); st.lightest(g.idx, r => r.passes); });
  const ms = performance.now() - t0, t1 = performance.now();
  groupsOld(rows, 'pattern').forEach(g => { frontierOld(g.rows, undefined, okDefl); lightestOld(g.rows); });
  console.log(`# 50k rows, 3 groups: store ${ms.toFixed(0)} ms, today's code ${(performance.now() - t1).toFixed(0)} ms`);
  assert.ok(ms < 1000, 'well under a second');
});
