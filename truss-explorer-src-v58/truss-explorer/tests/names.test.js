// Generated default names (#27): "<Word> <Type> <code>", e.g. "Maple Pratt k3f9".
//   node --test tests/names.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const N = require(path.join(__dirname, '..', 'src', 'names.js'));

test('the word list: unique, letters only, short, capitalised', () => {
  assert.ok(N.WORDS.length >= 100, 'enough words that repeats are rare');
  assert.strictEqual(new Set(N.WORDS).size, N.WORDS.length, 'no duplicates');
  for (const w of N.WORDS) assert.match(w, /^[A-Z][a-z]{1,9}$/, w);
});

test('bridge type from family and pattern, letters only', () => {
  assert.strictEqual(N.bridgeType({ family: 'grid', pattern: 'pratt' }), 'Pratt');
  assert.strictEqual(N.bridgeType({ family: 'grid', pattern: 'howe' }), 'Howe');
  assert.strictEqual(N.bridgeType({ family: 'grid', pattern: 'altP' }), 'AltPratt');
  assert.strictEqual(N.bridgeType({ family: 'grid', pattern: 'x' }), 'X');
  assert.strictEqual(N.bridgeType({ family: 'warren', pattern: 'pratt' }), 'Warren', 'family wins');
  assert.strictEqual(N.bridgeType({ family: 'grid', pattern: 'something-new' }), 'Truss', 'unknown pattern');
  assert.strictEqual(N.bridgeType(null), 'Truss');
});

test('time code: 4 base-36 characters, from UTC minutes, the same in every time zone', () => {
  assert.strictEqual(N.timeCode(Date.UTC(2026, 0, 1)), '0000');
  assert.strictEqual(N.timeCode(Date.UTC(2026, 0, 1, 0, 1)), '0001');
  assert.strictEqual(N.timeCode(Date.UTC(2026, 0, 1, 0, 1, 59)), '0001', 'whole minutes');
  const t = Date.UTC(2026, 9, 27, 17, 47);
  assert.match(N.timeCode(t), /^[0-9a-z]{4}$/);
  assert.strictEqual(N.timeCode(new Date(t)), N.timeCode(t), 'Date or ms');
  assert.notStrictEqual(N.timeCode(t), N.timeCode(t + 60000), 'a minute later differs');
  assert.ok(N.timeCode(t) < N.timeCode(t + 3600000), 'sorts in time order (within a cycle)');
  assert.strictEqual(N.timeCode(Date.UTC(2025, 11, 31, 23, 59)), 'zzzz', 'before 2026 wraps, never negative');
});

test('make(): the agreed shape, and never the same word twice in a row', () => {
  const t = Date.UTC(2026, 9, 27, 17, 47);
  const a = N.make({ family: 'grid', pattern: 'pratt' }, t, () => 0);
  assert.strictEqual(a, `Acorn Pratt ${N.timeCode(t)}`);
  const b = N.make({ family: 'grid', pattern: 'pratt' }, t, () => 0);
  assert.notStrictEqual(a, b, 'same instant, same random number: still a different name');
  for (let i = 0; i < 500; i++) {
    const s = N.make({ family: i % 2 ? 'warren' : 'grid', pattern: 'howe' }, t + i * 60000);
    assert.ok(N.looksGenerated(s), s); assert.ok(s.length <= 24, s);
  }
});

test('a generated name is a clean file name and plain text', () => {
  const s = N.make({ family: 'grid', pattern: 'altH' });
  assert.match(s, /^[A-Za-z0-9 ]+$/);
  assert.ok(!N.looksGenerated('Design A') && !N.looksGenerated('<b>Maple</b> Pratt k3f9') && !N.looksGenerated('Maple Pratt k3f9 sweep'));
});
