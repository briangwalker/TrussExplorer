// #255 part B: the sweep's results are read and replaced only through SweepState (src/app/60-sweep.js).
//   node --test tests/sweep-state.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'src', 'app');
const OWNERS = ['60-sweep.js', '85-sweep-sheets.js'];   // the sweep engine's own parts (src/app/README.md)
const NAMES = /\b(sweepAll|sweepRows|sweepCtx|sweepMode|liveRun)\b/;   // liveRun: the run in progress, read through SweepState.live() (TE-B-838)
const code = f => fs.readFileSync(path.join(APP, f), 'utf8').replace(/\/\/.*$/gm, '');   // comments may name them

test('no part outside 60-sweep and 85-sweep-sheets names the sweep variables', () => {
  const bad = [];
  for (const f of fs.readdirSync(APP).filter(f => f.endsWith('.js') && !OWNERS.includes(f)))
    code(f).split('\n').forEach((l, i) => { if (NAMES.test(l)) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 100)}`); });
  assert.deepStrictEqual(bad, [], 'use SweepState.rows() / top() / ctx() / mode() / live() and SweepState.set() / add()');
});

test('even inside the owners, the rows are replaced only by SweepState (so its version always moves)', () => {
  const bad = [];
  for (const f of OWNERS) code(f).split('\n').forEach((l, i) => { if (/\bsweepAll\s*=[^=]/.test(l) && !/SweepState|set\(rows, o\)/.test(l) && !/^let /.test(l.trim())) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 100)}`); });
  assert.deepStrictEqual(bad, []);
});

// UIE-12b seam (TE-B-838 a): SweepState.live() -> { rows, done, total, kind } is how a chart draws dots as designs finish.
// Every run (the normal sweep, the pilot and its 3D stage, the full search) sets liveRun at its start with its kind, and live()
// only answers while a run is on. The browser check is tests/ui/sweep-state.mjs.
test('SweepState.live() exists and every run sets the run in progress with its kind', () => {
  const src = code('60-sweep.js');
  assert.match(src, /live: \(\) => liveRun && \(big\.running \|\| sweepBusy\)/, 'live() answers only while a run is on');
  assert.match(src, /onLive\(fn\)/, 'onLive(fn) hears each step');
  const kinds = [...src.matchAll(/liveRun = \{ kind: '(\w+)'/g)].map(m => m[1]).sort();
  assert.deepStrictEqual(kinds, ['full', 'pilot', 'pilot', 'sweep'], 'the normal sweep, the pilot (2D and its 3D stage) and the full search each start a live run');
  assert.ok((src.match(/liveRun = null/g) || []).length >= 6, 'each run clears it at its end, on an error and on a stuck cancel');
  assert.ok(!/liveRun\.rows\b(?!\(\))/.test(src.replace(/rows: \(\) =>/g, '')), 'rows is read through its getter (the full search replaces its sample)');
});
