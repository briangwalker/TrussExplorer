// Names in exports stay on one line: whatever a design's name holds, the exported .py has the same
// top-level statements as the course script's, and still compiles.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');
const { SRC, C, cases, solve2D, design } = require('./lib.js');
const X = require(path.join(SRC, 'export.js'));
const tpl = require(path.join(SRC, 'template.js'));

const cs = cases().find(c => solve2D(c.state).res.stable);
const { tr, res } = solve2D(cs.state);
const py = name => X.exportPy(tpl, name, design(cs.state), tr, res, Object.assign({}, C.DEFAULT_MAT, cs.state.mat), cs.state.load, cs.state.opts);
// the kinds of the top-level statements, from Python's own parser
const shape = src => execFileSync('python3', ['-c', 'import ast,sys; print(",".join(type(n).__name__ for n in ast.parse(sys.stdin.read()).body))'], { input: src }).toString().trim();

test('pyName keeps names to one safe line', () => {
  assert.equal(X.pyName('Design A'), 'Design A');
  assert.equal(X.pyName('Pratt · h 70 (v2)'), 'Pratt · h 70 (v2)');
  for (const bad of ['A\nB = 1', 'A\r\nB', 'A\u2028B', 'A{x}B', 'A"B', "A'B", 'A\\B', 'A\tB'])
    assert.ok(!/[\n\r\u2028\u2029"'{}\\\t]/.test(X.pyName(bad)), JSON.stringify(bad));
  assert.equal(X.pyName(''), 'Design');
  assert.ok(X.pyName('x'.repeat(500)).length <= 80);
});

test('a name with line breaks and quotes does not change the exported script', () => {
  const clean = shape(py('Design A'));
  for (const name of ['A\nB = 1', 'A\r\n# B\nC', 'A"\nB', "A'''\nB", 'A{1}\u2028B', 'A\\\nB'])
    assert.equal(shape(py(name)), clean, JSON.stringify(name));
});
