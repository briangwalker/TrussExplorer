// TrussCallouts (src/callouts.js; RMA-9, board TE-B-496b): the three result words, pure. Spec: UI-A13, CODE-F1, CODE-F4, CODE-F5.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const K = require(path.join(SRC, 'callouts.js'));
const S = require(path.join(SRC, 'strings.js'));
const { C, design, DEFAULT } = require(path.join(__dirname, 'lib.js'));

const OPTS = { deflLimit: 2, minOverlap: 20 };
const good = () => ({ stable: true, m: 9, r: 3, j: 6, det: 'determinate', midDefl: 0.412, deflOK: true, envelope: [], edgeOK: true, overlap: 50 });
const ids = a => a.map(x => x.id);

test('a passing result gives exactly three ok callouts, in order, with the expected words and places', () => {
  const a = K.callouts(good(), OPTS);
  assert.strictEqual(a.length, 3); assert.deepStrictEqual(ids(a), ['determinacy', 'delta', 'fits']);
  assert.deepStrictEqual(a.map(x => x.at), ['support', 'mid', 'envelope']);
  assert.ok(a.every(x => x.ok === true));
  assert.strictEqual(a[0].text, '12 vs 12 · m + r vs 2j · determinate');
  assert.strictEqual(a[1].text, 'δ 0.412 mm ≤ 2 mm');
  assert.strictEqual(a[2].text, 'Fits the envelope and both desks');
});

test('each failure flips its own callout only', () => {
  const d = K.callouts(Object.assign(good(), { midDefl: 2.31, deflOK: false }), OPTS);
  assert.deepStrictEqual(d.map(x => x.ok), [true, false, true]); assert.strictEqual(d[1].text, 'δ 2.310 mm > 2 mm');
  const e = K.callouts(Object.assign(good(), { envelope: ['Height is 120 mm.', 'second'] }), OPTS);
  assert.deepStrictEqual(e.map(x => x.ok), [true, true, false]); assert.strictEqual(e[2].text, 'Height is 120 mm.', 'the first reason');
  const o = K.callouts(Object.assign(good(), { edgeOK: false, overlap: 12.4 }), OPTS);
  assert.deepStrictEqual(o.map(x => x.ok), [true, true, false]);
  assert.ok(o[2].text.startsWith('Each end reaches only 12 mm onto the desks; the edge check needs at least 20 mm'), o[2].text);
  assert.strictEqual(K.callouts(Object.assign(good(), { envelope: ['x'], edgeOK: false }), OPTS)[2].text, 'x', 'the envelope reason comes before the desk one');
  const u = K.callouts(Object.assign(good(), { det: 'unstable', m: 5, r: 3, j: 5 }), OPTS);
  assert.deepStrictEqual(u.map(x => x.ok), [false, true, true]); assert.strictEqual(u[0].text, '8 vs 10 · m + r vs 2j · unstable');
  assert.strictEqual(K.callouts(Object.assign(good(), { det: 'indeterminate' }), OPTS)[0].ok, true);
});

test('an unstable result (stable false) gives three bad callouts with the unstable words', () => {
  const a = K.callouts({ stable: false, det: 'unstable' }, OPTS);
  assert.strictEqual(a.length, 3); assert.ok(a.every(x => x.ok === false && x.text === 'No results: the truss is unstable.'));
  assert.deepStrictEqual(ids(a), ['determinacy', 'delta', 'fits']);
});

test('missing or damaged fields give ok: false and words, never a throw (CODE-N2)', () => {
  for (const bad of [null, undefined, 'x', 7, [], {}, { stable: true }, { stable: true, midDefl: NaN, deflOK: true, envelope: 'x', edgeOK: 1 }]) {
    let a; assert.doesNotThrow(() => { a = K.callouts(bad, null); }, JSON.stringify(bad));
    assert.strictEqual(a.length, 3); assert.ok(a.every(x => x.ok === false && typeof x.text === 'string' && x.text.length && !/NaN|undefined/.test(x.text)), JSON.stringify(bad));
  }
  assert.strictEqual(K.callouts(good(), {})[1].ok, false, 'no deflection limit: no verdict');
  assert.strictEqual(K.callouts(Object.assign(good(), { edgeOK: false, overlap: undefined }), OPTS)[2].ok, false);
});

test('a real analysed design: the callouts agree with the solver (determinacy, deflection, fits)', () => {
  const st = Object.assign({}, DEFAULT), tr = C.buildTruss(design(st)), res = C.analyze(tr, st.mat, st.load, st.opts);
  const a = K.callouts(res, st.opts);
  assert.strictEqual(a[1].ok, res.deflOK); assert.strictEqual(a[2].ok, res.envelope.length === 0 && res.edgeOK); assert.strictEqual(a[0].ok, res.det !== 'unstable');
  assert.ok(a[1].text.startsWith('δ ' + res.midDefl.toFixed(3) + ' mm '), a[1].text);
});

test('every callout.* key the unit uses exists in strings.js, and the keys are the ones the unit reads', () => {
  const src = fs.readFileSync(path.join(SRC, 'callouts.js'), 'utf8'), used = new Set(src.match(/callout\.[a-z]+(\.[a-z]+)*/g));
  assert.ok(used.size >= 10, 'found ' + used.size);
  for (const k of used) assert.doesNotThrow(() => S.t(k), k);
  const text = fs.readFileSync(path.join(SRC, 'strings.js'), 'utf8');
  for (const k of Object.keys(S.TEXT).filter(k => k.startsWith('callout.'))) assert.ok(used.has(k), k + ' is in strings.js but not read by callouts.js');
});

test('fill: placeholders are filled from the map, a missing one is a programmer error (CODE-N3), a bad key throws', () => {
  assert.strictEqual(K.fill('callout.delta.ok', { d: '1.000', limit: 2 }), 'δ 1.000 mm ≤ 2 mm');
  assert.throws(() => K.fill('callout.delta.ok', { d: '1' }), TypeError);
  assert.throws(() => K.fill('callout.nope', {}), /no text for/);
});

test('plain text only, no DOM names (CODE-F5), a frozen standalone global (CODE-F1)', () => {
  const src = fs.readFileSync(path.join(SRC, 'callouts.js'), 'utf8');
  const code = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  for (const w of ['document', 'window.document', 'innerHTML', 'querySelector', 'getElementById', 'localStorage', 'setTimeout']) assert.ok(!code.includes(w), w);
  assert.ok(Object.isFrozen(K) && Object.isFrozen(K.IDS));
  const ctx = require('vm').createContext({}); require('vm').runInContext(src, ctx); const root = ctx;
  assert.ok(root.TrussCallouts && typeof root.TrussCallouts.callouts === 'function');
});
