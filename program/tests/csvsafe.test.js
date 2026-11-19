// csvSafe (src/app/30-drawing.js): a cell a spreadsheet would run as a formula gets a leading ', leading spaces and tabs
// included (TE-B-346/359); plain numbers, signed numbers and ordinary text are left alone. The function is read from the
// app's own source, so this tests the code that ships.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '30-drawing.js'), 'utf8');
const line = src.split('\n').find(l => l.startsWith('function csvSafe('));
const csvSafe = new Function(line + '; return csvSafe;')();

test('formula-looking cells get a leading quote, also after leading spaces, tabs or line breaks', () => {
  for (const v of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', ' =1+1', '\t=HYPERLINK("x")', '\r=1', '\n@x', '  +A1'])
    assert.ok(csvSafe(v).startsWith("'"), JSON.stringify(v) + ' -> ' + JSON.stringify(csvSafe(v)));
});
test('numbers and ordinary text are unchanged', () => {
  for (const v of ['-12.5', '+3', '1e-3', '-.5', 'C', 'T', 'Top chord', '', 'a=b'])
    assert.strictEqual(csvSafe(v), v);
  assert.strictEqual(csvSafe(42), 42);
});
test('control characters become spaces', () => {
  assert.strictEqual(csvSafe('a\u0007b'), 'a b');
});
