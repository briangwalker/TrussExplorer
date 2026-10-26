// Sampler walk (TE-063) and frontier filter (TE-066), tested on the code inside app.js itself:
// the functions are cut out of the source by name and run in a sandbox.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SRC } = require('./lib.js');
const APP = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');

// the text of a top-level `function name(` (to its matching brace) or one-line `const name =`
function cut(name) {
  let at = APP.search(new RegExp(`^function ${name}\\(`, 'm'));
  if (at >= 0) { let d = 0, i = APP.indexOf('{', at); for (; i < APP.length; i++) { if (APP[i] === '{') d++; else if (APP[i] === '}' && --d === 0) break; } return APP.slice(at, i + 1); }
  at = APP.search(new RegExp(`^const ${name} =`, 'm'));
  assert.ok(at >= 0, `${name} not found in app.js`);
  return APP.slice(at, APP.indexOf('\n', at));
}
function load(names, extra = {}) {
  const ctx = vm.createContext(Object.assign({ Math, Number, BigInt, Set, Infinity, isFinite }, extra));
  vm.runInContext(names.map(cut).join('\n') + '\n;this.__ = {' + names.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',') + '};', ctx);
  return ctx.__;
}

let W0; const Wl = () => W0 || (W0 = load(['WALK_SPLIT_MAX', 'mulmod', 'addmod', 'mulmodX', 'walkFn']));
const gcd = (x, y) => { while (y) [x, y] = [y, x % y]; return x; };
const stepFor = T => { let m = Math.floor(T * 0.53); if (m % 2 === 0) m++; while (gcd(m, T) !== 1) m++; return m; };

test('TE-063: the walk is exact, repeat-free and even at every space size up to 2^53', () => {
  const W = Wl();
  for (const T of [2e9, 2 ** 37 - 1, 2 ** 37 + 1, 2e11, 1e12, 1e13, 1e15, 2 ** 53 - 1]) {
    const m = stepFor(T), b = Math.floor(T * 0.123), f = W.walkFn(T, m, b), n = 50000;
    let wrong = 0; const seen = new Set(); let dup = 0; const low = new Array(8).fill(0);
    for (let i = 0; i < n; i++) {
      const v = f(i), ex = (BigInt(m) * BigInt(i) + BigInt(b)) % BigInt(T);
      if (BigInt(v) !== ex) wrong++;
      if (seen.has(v)) dup++; seen.add(v); low[v % 8]++;
    }
    assert.equal(wrong, 0, `T=${T}: ${wrong} of ${n} positions wrong`);
    assert.equal(dup, 0, `T=${T}: ${dup} repeats`);
    const mean = n / 8; low.forEach((c, k) => assert.ok(Math.abs(c - mean) < 6 * Math.sqrt(mean), `T=${T}: last digit ${k} count ${c} vs ~${mean}`));
  }
});

test('TE-063: below 2^37 the walk is unchanged from v58 (old searches and checkpoints reproduce)', () => {
  const W = Wl();
  for (const T of [51100, 3.1e6, 2e9, 2 ** 37]) {
    const m = stepFor(T), b = Math.floor(T / 7), f = W.walkFn(T, m, b), old = i => (W.mulmod(m, i, T) + b) % T;
    for (let i = 0; i < 20000; i += 7) assert.equal(f(i), old(i));
  }
});

test('TE-063: a v58 checkpoint past 2^37 resumes on the walk it started with', () => {
  const W = Wl();
  const T = 1e13, m = stepFor(T), b = 12345, legacy = W.walkFn(T, m, b, true);
  for (let i = 0; i < 5000; i += 13) assert.equal(legacy(i), (W.mulmod(m, i, T) + b) % T);
  assert.equal(W.walkFn(T, m, b).wv, 2);
});

test('TE-063: on a small space the walk visits every design exactly once', () => {
  const W = Wl();
  const T = 9973 * 6, m = stepFor(T), f = W.walkFn(T, m, 17), seen = new Set();
  for (let i = 0; i < T; i++) seen.add(f(i));
  assert.equal(seen.size, T);
});

test('TE-066: a design that slips off the table is not on the trade-off frontier', () => {
  const F = load(['okRow', 'frontOK', 'frontier'], { sweepCtx: { defl: 2.0 } });
  const row = (id, wood, util, D, extra) => Object.assign({ id, wood, util, D, capKg: 5 / util, envOK: true, edgeOK: true, slipOK: true }, extra || {});
  // Math Consultant F1: the slipping design has less wood and more capacity, and used to push "ok" off the line
  assert.equal(F.frontier([row('slips', 900, 0.4, 0.5, { slipOK: false }), row('ok', 1000, 0.5, 0.5)]).map(r => r.id).join(), 'ok');
  // a row from an older sweep file (no slipOK) still counts
  assert.equal(F.frontier([row('old', 900, 0.4, 0.5, { slipOK: undefined })]).map(r => r.id).join(), 'old');
  assert.equal(F.frontOK(row('s', 1, 0.5, 0.5, { slipOK: false })), false, 'large-search flag bit 4 uses frontOK');
});
