// When the OG theme unlocks (UI-T6, #162): after the first finished sweep or 20 minutes of use.
//   node --test tests/unlocks.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const U = require(path.join(__dirname, '..', 'src', 'unlocks.js'));

const T0 = Date.UTC(2026, 9, 31, 12, 0, 0);
// tick every 30 s for `ms` of use, starting at T0 (the first tick only sets the clock)
function ticked(ms, s = U.fresh()) {
  s = U.note(s, 'tick', T0);
  for (let t = 30000; t <= ms; t += 30000) s = U.note(s, 'tick', T0 + t);
  if (ms % 30000) s = U.note(s, 'tick', T0 + ms);
  return s;
}
const deepFreeze = o => { Object.values(o).forEach(v => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };

test('constants: OG badge and 20 minutes', () => {
  assert.deepStrictEqual(U.BADGE, { og: 'OG' });
  assert.strictEqual(U.MINUTES, 20);
});

test('fresh is locked', () => {
  assert.deepStrictEqual(U.unlocked(U.fresh()), { og: false });
  assert.deepStrictEqual(U.fresh(), { firstSweepAt: null, usedMs: 0, lastTickMs: null });
});

test('one finished sweep unlocks, and firstSweepAt is set only once', () => {
  const a = U.note(U.fresh(), 'sweep-finished', T0);
  assert.deepStrictEqual(U.unlocked(a), { og: true });
  assert.strictEqual(a.firstSweepAt, new Date(T0).toISOString());
  const b = U.note(a, 'sweep-finished', T0 + 3600000);
  assert.strictEqual(b.firstSweepAt, a.firstSweepAt);
});

test('20:00 of ticks unlocks, 19:59 does not', () => {
  const at1959 = ticked(19 * 60000 + 59000);
  assert.strictEqual(at1959.usedMs, 1199000);
  assert.deepStrictEqual(U.unlocked(at1959), { og: false });
  const at2000 = ticked(20 * 60000);
  assert.strictEqual(at2000.usedMs, 1200000);
  assert.deepStrictEqual(U.unlocked(at2000), { og: true });
});

test('a single tick of 2 hours counts as 60 s; a clock going backwards adds nothing', () => {
  let s = U.note(U.fresh(), 'tick', T0);
  s = U.note(s, 'tick', T0 + 2 * 3600000);
  assert.strictEqual(s.usedMs, 60000);
  s = U.note(s, 'tick', T0);                        // clock jumped back 2 h
  assert.strictEqual(s.usedMs, 60000);
  s = U.note(s, 'tick', T0 + 10000);
  assert.strictEqual(s.usedMs, 70000);
});

test('the first tick after loading only sets the clock', () => {
  const s = U.note({ firstSweepAt: null, usedMs: 5000 }, 'tick', T0);   // saved state without lastTickMs is fine
  assert.strictEqual(s.usedMs, 5000);
  assert.strictEqual(s.lastTickMs, T0);
});

test('a damaged state counts as fresh and never throws', () => {
  const bad = [null, undefined, 'state', 42, [], { firstSweepAt: null, usedMs: -1 }, { firstSweepAt: 'not a date', usedMs: 0 },
    { firstSweepAt: '2026-13-45T99:00:00Z', usedMs: 0 }, { firstSweepAt: null, usedMs: '600000' }, { firstSweepAt: null, usedMs: NaN },
    { firstSweepAt: null, usedMs: Infinity }, { firstSweepAt: 12345, usedMs: 0 }, { firstSweepAt: null, usedMs: 0, lastTickMs: 'x' }, {}];
  for (const b of bad) {
    assert.deepStrictEqual(U.unlocked(b), { og: false }, JSON.stringify(b));
    assert.deepStrictEqual(U.note(b, 'nothing', T0), U.fresh(), JSON.stringify(b));
    assert.doesNotThrow(() => U.note(b, 'tick', T0));
    assert.doesNotThrow(() => U.note(b, 'sweep-finished', T0));
  }
  // a damaged state with a huge usedMs still can't unlock: it's fresh
  assert.deepStrictEqual(U.unlocked({ firstSweepAt: 'yesterday', usedMs: 1e12 }), { og: false });
});

test('bad events and times change nothing', () => {
  const s = ticked(60000);
  assert.deepStrictEqual(U.note(s, 'explode', T0), s);
  assert.deepStrictEqual(U.note(s, 'tick', NaN), s);
  assert.deepStrictEqual(U.note(s, 'sweep-finished', 'soon'), s);
});

test('note() never changes its input', () => {
  const s = deepFreeze(ticked(90000));
  const copy = JSON.parse(JSON.stringify(s));
  const a = U.note(s, 'tick', T0 + 120000), b = U.note(s, 'sweep-finished', T0);
  assert.deepStrictEqual(s, copy);
  assert.notStrictEqual(a, s); assert.notStrictEqual(b, s);
  assert.notStrictEqual(U.note(s, 'nothing', T0), s);
});

test('the state survives a JSON round trip', () => {
  const s = U.note(ticked(300000), 'sweep-finished', T0);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s)), s);
  assert.deepStrictEqual(U.unlocked(JSON.parse(JSON.stringify(s))), { og: true });
});
