// #255 part B: the sweep's results are read and replaced only through SweepState (src/app/60-sweep.js).
//   node --test tests/sweep-state.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'src', 'app');
const OWNERS = ['60-sweep.js', '85-sweep-sheets.js'];   // the sweep engine's own parts (src/app/README.md)
const NAMES = /\b(sweepAll|sweepRows|sweepCtx|sweepMode)\b/;
const code = f => fs.readFileSync(path.join(APP, f), 'utf8').replace(/\/\/.*$/gm, '');   // comments may name them

test('no part outside 60-sweep and 85-sweep-sheets names the sweep variables', () => {
  const bad = [];
  for (const f of fs.readdirSync(APP).filter(f => f.endsWith('.js') && !OWNERS.includes(f)))
    code(f).split('\n').forEach((l, i) => { if (NAMES.test(l)) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 100)}`); });
  assert.deepStrictEqual(bad, [], 'use SweepState.rows() / top() / ctx() / mode() and SweepState.set() / add()');
});

test('even inside the owners, the rows are replaced only by SweepState (so its version always moves)', () => {
  const bad = [];
  for (const f of OWNERS) code(f).split('\n').forEach((l, i) => { if (/\bsweepAll\s*=[^=]/.test(l) && !/SweepState|set\(rows, o\)/.test(l) && !/^let /.test(l.trim())) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 100)}`); });
  assert.deepStrictEqual(bad, []);
});
