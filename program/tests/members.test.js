// The Members tab's data (#211): the same numbers as v61's member table (rowsForCsv() in src/app/30-drawing.js).
//   node --test tests/members.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { C, DEFAULT, design, cases, solve2D, SRC } = require('./lib.js');
const M = require(path.join(SRC, 'members.js'));
const X = require(path.join(SRC, 'export.js'));

// REFERENCE: rowsForCsv()'s row formula, copied from src/app/30-drawing.js (v61 member table), as it reads today.
// If that formula changes, this copy must change with it, and the test below says which field moved.
const csvRow = m => [m.k, m.i, m.j, X.TYPE_LABEL[m.type], m.n + (m.n === 4 && m.bundle === 'compact' ? ' (2x2)' : ''), m.L.toFixed(1), m.F.toFixed(2), m.TC, m.Pcr.toFixed(1), m.buckles,
  (m.F > 0 ? m.capT : m.F < 0 ? m.capC : 0).toFixed(1), (m.util * 100).toFixed(0), m.mode];
// The same columns, written from a TrussMembers row the way a screen would round them.
const fromRow = r => [r.k, r.i, r.j, X.TYPE_LABEL[r.type], r.sticks + (r.compact ? ' (2x2)' : ''), r.L_mm.toFixed(1), r.F_N.toFixed(2), r.TC, r.Pcr_N.toFixed(1), r.buckles,
  r.cap_N.toFixed(1), (r.use * 100).toFixed(0), r.governs];
const COLS = ['Elem', 'i', 'j', 'Type', 'Sticks', 'L (mm)', 'F (N)', 'T/C', 'P_cr (N)', 'Buckling?(Y/N)', 'Capacity (N)', 'Use (%)', 'Governs'];
const FIELDS = ['k', 'i', 'j', 'type', 'sticks', 'compact', 'L_mm', 'F_N', 'TC', 'Pcr_N', 'buckles', 'cap_N', 'use', 'governs'];

function check(name, state) {
  const { tr, res } = solve2D(state);
  const rows = M.rows(tr, res, {});
  if (!res.stable) { assert.deepStrictEqual(rows, [], name + ': unstable gives []'); return; }
  assert.strictEqual(rows.length, res.members.length, name + ': one row per member');
  rows.forEach((r, n) => {
    const m = res.members[n];
    assert.deepStrictEqual(Object.keys(r), FIELDS, `${name} member ${n}: fields`);
    assert.strictEqual(r.k, m.k, `${name}: same order as res.members`);
    // unrounded values, exactly as the solver gives them
    assert.strictEqual(r.L_mm, m.L); assert.strictEqual(r.F_N, m.F); assert.strictEqual(r.Pcr_N, m.Pcr); assert.strictEqual(r.use, m.util);
    assert.strictEqual(r.cap_N, m.F > 0 ? m.capT : m.F < 0 ? m.capC : 0);
    // and every CSV column comes out the same once rounded
    const want = csvRow(m), got = fromRow(r);
    COLS.forEach((c, x) => assert.strictEqual(got[x], want[x], `${name} member ${m.k}, column ${c}`));
  });
  return rows.length;
}

test('DEFAULT: the same members and numbers as the v61 table', () => { assert.ok(check('DEFAULT', DEFAULT) > 0); });

test('every case in tests/lib.js: same count, order and numbers', () => {
  let n = 0;
  for (const cs of cases()) { check(cs.name, cs.state); n++; }
  assert.ok(n >= 35);
});

test('4 sticks glued 2x2 show as compact, and use is a fraction', () => {
  const { tr, res } = solve2D(DEFAULT);
  const k = res.members.find(m => m.type === 'top').k;
  const key = tr.elems[k].key;
  const st = Object.assign({}, DEFAULT, { sticks: { [key]: { n: 4, bundle: 'compact' } } });
  const s2 = solve2D(st), rows = M.rows(s2.tr, s2.res, {});
  const m = s2.res.members[k];
  assert.strictEqual(m.n, 4); assert.strictEqual(m.bundle, 'compact');
  assert.strictEqual(rows[k].sticks, 4); assert.strictEqual(rows[k].compact, true);
  check('2x2', st);
  for (const r of rows) assert.ok(r.use >= 0 && r.use < 50, 'use is a fraction, not a percent string');
});

test('an unstable bridge, or no result, gives []', () => {
  const { tr, res } = solve2D(DEFAULT);
  assert.deepStrictEqual(M.rows(tr, Object.assign({}, res, { stable: false }), {}), []);
  assert.deepStrictEqual(M.rows(tr, null, {}), []);
  assert.deepStrictEqual(M.rows(tr, undefined), []);
  assert.deepStrictEqual(M.rows(tr, { stable: true }), []);
  // a truss with no diagonals is a mechanism: the solver says unstable, and the rows are empty
  const st = Object.assign({}, DEFAULT, { panels: 4, diagLeft: ['N', 'N'], diagMiddle: 'N' });
  const s = solve2D(st);
  assert.strictEqual(s.res.stable, false);
  assert.deepStrictEqual(M.rows(s.tr, s.res, {}), []);
});

test('rows() does not change the result it reads', () => {
  const { tr, res } = solve2D(DEFAULT);
  const before = JSON.stringify(res.members);
  M.rows(tr, res, {});
  assert.strictEqual(JSON.stringify(res.members), before);
});
