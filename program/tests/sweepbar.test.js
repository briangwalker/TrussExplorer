// TrussSweepBar (src/sweepbar.js; RMA-10, board TE-B-497b): the sweep bar's state as a pure function of plain facts. Spec: UI-A2, UI-S5, UI-S9, CODE-F1, CODE-F4, CODE-F5.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const B = require(path.join(SRC, 'sweepbar.js'));
const S = require(path.join(SRC, 'strings.js'));
const key = k => 'sweepbar.state.' + k.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
const base = () => ({ mode: 'none', running: false, pilot: false, cancel: false, busy: false, stale: false, rows: 0 });
const st = (o, p) => B.state(Object.assign(base(), o), p);

test('one case per kind: the kind, the counts, the buttons and the words from strings.js', () => {
  let s = st({});
  assert.strictEqual(s.kind, 'idle'); assert.strictEqual(s.msg, S.t(key('idle'))); assert.deepStrictEqual([s.canRun, s.canCancel, s.canResume, s.canDiscard], [true, false, false, false]);
  s = st({ running: true, busy: true }, { i: 250, n: 1000, eta: '2 min' });
  assert.strictEqual(s.kind, 'pilot-running'); assert.strictEqual(s.msg, 'Pilot: 250 of 1,000 designs…'); assert.deepStrictEqual([s.count, s.total, s.eta], [250, 1000, '2 min']);
  assert.deepStrictEqual([s.canRun, s.canCancel, s.canResume, s.canDiscard], [false, true, false, false]);
  s = st({ running: true, busy: true, pilot: true }, { i: 1500, n: 2000000, eta: '3 h 10 min' });
  assert.strictEqual(s.kind, 'full-running'); assert.strictEqual(s.msg, 'Full search: 1,500 of 2,000,000 designs · 3 h 10 min left · progress saved, so a reload can resume');
  s = st({ mode: 'pilot', rows: 1000, pilot: true });
  assert.strictEqual(s.kind, 'pilot-done'); assert.ok(s.msg.startsWith('Low-fidelity pilot: these charts show only 1,000 random designs.')); assert.strictEqual(s.canRun, true);
  s = st({ mode: 'full', rows: 12345 });
  assert.strictEqual(s.kind, 'done'); assert.strictEqual(s.msg, '12,345 designs tested.'); assert.strictEqual(st({ mode: 'sweep', rows: 4 }).kind, 'done');
  s = st({ mode: 'sweep', rows: 40, stale: true });
  assert.strictEqual(s.kind, 'out-of-date'); assert.strictEqual(s.msg, S.t(key('out-of-date'))); assert.strictEqual(s.canRun, true);
  s = st({ resumable: { done: 4000, total: 90000 } });
  assert.strictEqual(s.kind, 'resumable'); assert.strictEqual(s.msg, 'A full search stopped at 4,000 of 90,000 designs. Resume it, or discard it.');
  assert.deepStrictEqual([s.canRun, s.canCancel, s.canResume, s.canDiscard], [false, false, true, true]);
});

test('precedence: running beats resumable beats out-of-date beats done', () => {
  const all = { mode: 'full', rows: 10, stale: true, resumable: { done: 1, total: 2 } };
  assert.strictEqual(st(all).kind, 'resumable');
  assert.strictEqual(st(Object.assign({}, all, { running: true, busy: true })).kind, 'pilot-running');
  assert.strictEqual(st({ mode: 'full', rows: 10, stale: true }).kind, 'out-of-date');
  assert.strictEqual(st({ mode: 'full', rows: 10 }).kind, 'done');
  assert.strictEqual(st({ stale: true, rows: 0 }).kind, 'out-of-date');
  assert.strictEqual(st({ busy: true, rows: 5, mode: 'full' }).kind, 'idle', 'a sweep that is busy but not running shows nothing new');
});

test('progress phase wins when given; without it a run is a full search only when a pilot exists', () => {
  assert.strictEqual(st({ running: true, busy: true, pilot: true }, { i: 1, n: 2, phase: 'pilot' }).kind, 'pilot-running');
  assert.strictEqual(st({ running: true, busy: true }, { i: 1, n: 2, phase: 'full' }).kind, 'full-running');
  assert.strictEqual(st({ running: true, busy: true, pilot: true }).kind, 'full-running');
  const s = st({ running: true, busy: true }); assert.deepStrictEqual([s.count, s.total, s.eta], [0, 0, '']); assert.ok(!/NaN|undefined/.test(s.msg));
});

test('cancel asked: the run still shows, but there is nothing more to cancel', () => {
  const s = st({ running: true, busy: true, cancel: true }, { i: 1, n: 2 }); assert.strictEqual(s.kind, 'pilot-running'); assert.strictEqual(s.canCancel, false);
});

test('extra fields are ignored; odd ones read as off; damaged input reads as idle and never throws (CODE-N2)', () => {
  const a = B.state(Object.assign(base(), { mode: 'full', rows: 3 }));
  const b = B.state(Object.assign(base(), { mode: 'full', rows: 3, banana: 1, big: { running: true }, sweepAll: [1], fn() {} }), { i: 1, n: 2, extra: 9 });
  assert.deepStrictEqual(a, b);
  for (const bad of [null, undefined, 'x', 7, [], {}, { rows: 'many', running: 'yes', resumable: 'x', stale: 1 }, { rows: NaN, resumable: { done: 'a', total: -1 } }]) {
    let s; assert.doesNotThrow(() => { s = B.state(bad, 'x'); }, JSON.stringify(bad));
    assert.ok(B.KINDS.includes(s.kind) && typeof s.msg === 'string' && !/NaN|undefined/.test(s.msg), JSON.stringify(bad));
  }
  assert.strictEqual(B.state(null).kind, 'idle');
});

test('the words: every kind has a sweepbar.state.<kind> key in strings.js, and every such key is a kind', () => {
  for (const k of B.KINDS) assert.doesNotThrow(() => S.t(key(k)), k);
  assert.deepStrictEqual(Object.keys(S.TEXT).filter(k => k.startsWith('sweepbar.')).map(k => k.slice(15)).sort(), B.KINDS.map(k => k.replace(/-([a-z])/g, (m, c) => c.toUpperCase())).sort());
});

test('pure: no DOM or timers (CODE-F5), a frozen standalone global (CODE-F1), the facts() getter is plain data', () => {
  const src = fs.readFileSync(path.join(SRC, 'sweepbar.js'), 'utf8'), code = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  for (const w of ['document', 'innerHTML', 'querySelector', 'getElementById', 'localStorage', 'setTimeout', 'setInterval', 'performance']) assert.ok(!code.includes(w), w);
  assert.ok(Object.isFrozen(B));
  const vm = require('vm'), ctx = vm.createContext({}); vm.runInContext(src, ctx); assert.ok(ctx.TrussSweepBar && typeof ctx.TrussSweepBar.state === 'function');
  // the getter in 60-sweep.js returns only numbers, booleans and strings: its source holds no element, function or sweep array
  const sw = fs.readFileSync(path.join(SRC, 'app', '60-sweep.js'), 'utf8'), m = sw.match(/facts: \(\) => \(\{[\s\S]*?\}\),/);
  assert.ok(m, 'facts() is in SweepState');
  assert.ok(!/\$\(|document|=>|sweepAll(?!\.length)|sweepRows|sweepCtx/.test(m[0].replace(/^facts: \(\) =>/, '')), m[0]);
});
