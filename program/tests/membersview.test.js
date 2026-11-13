// The Members tab's table (#416; UI-S6, UI-A17, UI-A18): sorting, the CSV, and the markup, without a browser.
//   node --test tests/membersview.test.js   (the real page, against the app's own CSV, is tests/ui/members.mjs)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { DEFAULT, cases, solve2D, SRC } = require('./lib.js');
const P = require(path.join(SRC, 'pieces.js'));
const M = require(path.join(SRC, 'members.js'));
const V = require(path.join(SRC, 'membersview.js'));
const X = require(path.join(SRC, 'export.js'));

// REFERENCE: rowsForCsv() in src/app/30-drawing.js, as it reads today (the same copy tests/members.test.js keeps)
const appRows = res => {
  const head = ['Elem', 'i', 'j', 'Type', 'Sticks', 'L (mm)', 'F (N)', 'T/C', 'P_cr (N)', 'Buckling?(Y/N)', 'Capacity (N)', 'Use (%)', 'Governs'];
  if (!res.stable) return [head];
  return [head].concat(res.members.map(m => [m.k, m.i, m.j, X.TYPE_LABEL[m.type], m.n + (m.n === 4 && m.bundle === 'compact' ? ' (2x2)' : ''), m.L.toFixed(1), m.F.toFixed(2), m.TC, m.Pcr.toFixed(1), m.buckles,
    (m.F > 0 ? m.capT : m.F < 0 ? m.capC : 0).toFixed(1), (m.util * 100).toFixed(0), m.mode]));
};

test('csvRows() is exactly the app\'s rowsForCsv(), for every case in tests/lib.js', () => {
  let n = 0;
  for (const cs of [{ name: 'DEFAULT', state: DEFAULT }].concat(cases())) {
    const { tr, res } = solve2D(cs.state);
    assert.deepStrictEqual(V.csvRows(M.rows(tr, res, {}), X.TYPE_LABEL), appRows(res), cs.name); n++;
  }
  assert.ok(n >= 36);
});

test('csvOf() escapes like the app: formulas stay text, quotes doubled, numbers stay numbers', () => {
  assert.strictEqual(V.csvOf([['a', '-1.50', '=SUM(A1)', 'x,"y"', '+cmd', 3, 'a\nb']]), `a,-1.50,'=SUM(A1),"x,""y""",'+cmd,3,a b`);
});

test('sorted(): highest use first (UI-S6); ties keep member order; the input is not changed', () => {
  const rows = [{ k: 0, use: 0.2 }, { k: 1, use: 0.9 }, { k: 2, use: 0.2 }, { k: 3, use: 1.4 }];
  assert.deepStrictEqual(V.sorted(rows).map(r => r.k), [3, 1, 0, 2]);
  assert.deepStrictEqual(rows.map(r => r.k), [0, 1, 2, 3]);
  assert.throws(() => V.sorted(null), /rows must be/);
});

test('the table: every member, sorted, T/C in letters and words, fails in words, app meaning colours (UI-A17, UI-A18)', () => {
  const { tr, res } = solve2D(DEFAULT);
  const rows = M.rows(tr, res, {});
  const h = V.tableHTML(P, rows, { typeLabel: X.TYPE_LABEL, lit: rows[0].k });
  assert.strictEqual((h.match(/<tr data-key=/g) || []).length, rows.length);
  const keys = [...h.matchAll(/<tr data-key="(\d+)"/g)].map(m => +m[1]);
  assert.deepStrictEqual(keys, V.sorted(rows).map(r => r.k), 'highest use first');
  assert.match(h, /scope="col"/); assert.match(h, /<caption>/);
  assert.match(h, /tc-C">C <span class="mv-w">compression/); assert.match(h, /tc-T">T <span class="mv-w">tension/);
  assert.match(h, new RegExp(`data-key="${rows[0].k}"[^>]*aria-selected="true"`), 'the lit member');
  assert.doesNotMatch(h, /#[0-9a-f]{3,6}\b/i, 'no colour of its own');
  assert.match(h, /var\(--(tens|comp|warn|bad)\)/);
  const fail = Object.assign({}, rows[0], { use: 1.3, F_N: -2, TC: 'C', governs: 'buckling' });
  assert.match(V.tableHTML(P, [fail], { typeLabel: X.TYPE_LABEL }), /class="fail"[\s\S]*buckling[\s\S]*✕ fails/);
});

test('unstable: the table says so in words; the CSV is the header only', () => {
  const h = V.tableHTML(P, [], {});
  assert.match(h, /No results: the truss is unstable\./); assert.doesNotMatch(h, /data-key=/);
  assert.deepStrictEqual(V.csvRows([], X.TYPE_LABEL), [V.HEAD]);
});

test('hostile text stays text; no script, no on...= (CODE-S1, CODE-S2)', () => {
  const r = { k: 1, i: 0, j: 2, type: '<img src=x onerror=1>', sticks: 1, compact: false, L_mm: 1, F_N: -1, TC: 'C', Pcr_N: 1, buckles: 'N', cap_N: 1, use: 0.5, governs: '"><script>' };
  const h = V.tableHTML(P, [r], {});
  assert.doesNotMatch(h, /<script|<img/i); assert.doesNotMatch(h, /<[^>]*\son[a-z]+=/i);
  const t = V.toolbarHTML(P);
  assert.match(t, /data-act="members-copy"/); assert.match(t, /data-act="members-csv"/);
});

test('the table piece: header, numbers right-aligned, one Tab stop, an empty state (pieces 0.2)', () => {
  const h = P.tableHTML({ columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B', num: true }], rows: [{ key: 'x', cells: { a: 'x<', b: '1.0' } }, { key: 'y', cells: { a: 'y', b: '2.0' } }] });
  assert.match(h, /^<table class="te-tbl" data-part="table"[^>]*data-pc/);
  assert.match(h, /<th scope="col" class="num">B<\/th>/); assert.match(h, /<td class="num">1\.0<\/td>/); assert.match(h, /x&lt;/);
  assert.strictEqual((h.match(/tabindex="0"/g) || []).length, 1); assert.strictEqual((h.match(/tabindex="-1"/g) || []).length, 1);
  assert.match(P.tableHTML({ columns: [{ key: 'a', label: 'A' }], rows: [], empty: 'None.' }), /colspan="1">None\./);
  assert.throws(() => P.tableHTML({ columns: [] }), /needs columns/);
});

test('CSS: tokens and the app\'s meaning colours only, 13 px or more', () => {
  assert.doesNotMatch(V.CSS, /#[0-9a-f]{3,6}\b/i); assert.doesNotMatch(V.CSS, /url\(|@import/);
  const sizes = [...(P.CSS + V.CSS).matchAll(/(\d+)px var\(--te-font/g)].map(m => +m[1]);
  assert.ok(sizes.every(n => n >= 13), sizes.join(','));
});
