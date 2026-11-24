// Number boxes and steppers (TrussInputs; UI-I2, UI-I3, UI-I9, UI-I10): markup and the limits bridge, without a browser.
//   node --test tests/inputs.test.js   (behaviour on the real page: tests/ui/inputs.mjs)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const P = require(path.join(__dirname, '..', 'src', 'pieces.js'));
const I = require(path.join(__dirname, '..', 'src', 'inputs.js'));

test('a labelled box with − and + steppers, its unit and a note line', () => {
  const h = I.numberHTML(P, { id: 'height', label: 'Height h', unit: 'mm', value: 70 });
  assert.match(h, /^<span class="te-num" data-part="number" data-slot="ctl" data-pc>/);
  assert.match(h, /<label class="te-num-l" for="height">Height h<\/label>/);
  assert.match(h, /<input class="te-num-i" id="height" type="text" inputmode="decimal"[^>]*value="70" aria-describedby="height-note">/);
  assert.match(h, /aria-label="Less Height h">−<\/button>/); assert.match(h, /aria-label="More Height h">\+<\/button>/);
  assert.match(h, /<span class="te-num-u" aria-hidden="true">mm<\/span>/);
  assert.match(h, /<span class="te-num-n" id="height-note" role="status" aria-live="polite" hidden><\/span><\/span>$/);
  assert.doesNotMatch(I.numberHTML(P, { id: 'n', label: 'Panels' }), /te-num-u/, 'no unit, no unit span');
  assert.throws(() => I.numberHTML(P, { id: 'x' }), /label/);
  assert.throws(() => I.numberHTML(null, { id: 'x', label: 'X' }), /TrussPieces/);
});

test('numbers: plain numbers only; shown without float noise', () => {
  for (const [s, v] of [['70', 70], [' -2.5 ', -2.5], ['.5', 0.5], ['1e2', 100], ['+3', 3]]) assert.strictEqual(I.parse(s), v, s);
  for (const s of ['', 'abc', '1,5', '1.2.3', '0x10', '1e', 'Infinity', 'NaN']) assert.strictEqual(I.parse(s), null, s);
  assert.strictEqual(I.show(0.1 + 0.2), '0.3'); assert.strictEqual(I.show(70), '70');
});

test('fromLimits: errors from the one limits table are refused ("limit"), warnings pass ("warn"), live values feed expressions', () => {
  // a stand-in with TrussLimits' API (src/limits.js on #462): checkInputs / warnInputs over a values object
  const L = {
    checkInputs: v => (v.curve > v.height - 10 ? [{ id: 'curve', msg: 'The bottom chord must stay at least 10 mm below the top chord.' }] : [])
      .concat(v.height < 10 || v.height > 100 ? [{ id: 'height', msg: 'Height must be 10-100 mm.' }] : []),
    warnInputs: v => (v.height < 20 ? [{ id: 'height', msg: 'Low height: members get short.' }] : []),
  };
  let live = { height: 60 };
  const h = I.fromLimits(L, 'height', () => live), c = I.fromLimits(L, 'curve', () => live);
  assert.strictEqual(h(70), null);
  assert.deepStrictEqual(h(5), { kind: 'limit', msg: 'Height must be 10-100 mm.' });
  assert.deepStrictEqual(h(15), { kind: 'warn', msg: 'Low height: members get short.' });
  assert.strictEqual(c(50), null); assert.strictEqual(c(51).kind, 'limit');
  live = { height: 80 }; assert.strictEqual(c(51), null, 'the expression reads the live height');
  assert.throws(() => I.fromLimits({}, 'h'), /TrussLimits/);
  // a course rule (UI-I2) passed in by the wiring: 'rule' sits between an error and a warning
  const hr = I.fromLimits(L, 'height', () => live, v => (v > 95 ? 'Over the course rule h ≤ 95 mm.' : null));
  assert.deepStrictEqual(hr(98), { kind: 'rule', msg: 'Over the course rule h ≤ 95 mm.' });
  assert.strictEqual(hr(150).kind, 'limit', 'a limit wins over a rule'); assert.strictEqual(hr(70), null);
});

test('hostile text stays text; CSS: tokens only, 13 px or more, the focus ring reads --te-focus', () => {
  const h = I.numberHTML(P, { id: 'a"><script>', label: '<img src=x onerror=1>', unit: '<b>', title: '"x' });
  assert.doesNotMatch(h, /<script|<img|<b>/i); assert.doesNotMatch(h, /\son[a-z]+="/i, "no on...= attribute");
  assert.doesNotMatch(I.CSS, /#[0-9a-f]{3,6}\b/i); assert.doesNotMatch(I.CSS, /url\(|@import/);
  const sizes = [...I.CSS.matchAll(/(\d+)px var\(--te-font/g)].map(m => +m[1]);
  assert.ok(sizes.length && sizes.every(n => n >= 13), sizes.join(','));
  assert.match(I.CSS, /min-width:52px;max-width:96px/, 'UI-I9 widths'); assert.match(I.CSS, /var\(--te-focus, var\(--te-accent\)\)/);
});
