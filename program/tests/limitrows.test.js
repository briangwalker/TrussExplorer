// TrussLimitRows without a browser: its shape, and that every row it depends on is a real limits-table id (TE-B-494, TE-B-444).
//   node --test tests/limitrows.test.js   (the real page is tests/ui/limitsboxes.mjs)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const R = require(path.join(SRC, 'limitrows.js'));
const L = require(path.join(SRC, 'limits.js'));

test('one global, a mount function, CSS scoped to #stage, no hex colours', () => {
  assert.deepStrictEqual(Object.keys(R).sort(), ['CSS', 'DEPENDS', 'VERSION', 'install', 'mount']);
  for (const rule of R.CSS.split('}').filter(x => x.trim())) assert.match(rule.trim(), /^#stage /, rule);
  assert.doesNotMatch(R.CSS, /#[0-9a-f]{3,8}\b(?![-\w])/i);
});
test('the dependent inputs (Math TE-B-444) are all rows of the limits table', () => {
  const ids = new Set(L.TABLE.map(r => r.id));
  for (const id of R.DEPENDS) assert.ok(ids.has(id), id);
});
test('curve and topEnd check the rows again: they move the outer height the height course rule judges (TE-B-619)', () => {
  for (const id of ['curve', 'topEnd']) assert.ok(R.DEPENDS.includes(id), id);
  assert.strictEqual(R.VERSION, '0.1.3');
});
test('mount refuses to run without the three libraries', () => {
  assert.throws(() => R.mount({}, {}), /TrussPieces, TrussInputs and TrussLimits/);
});
