// Theme file checks (#265; TE-B-374 (a), (b)): the colour pairs a file may not break, and the built-in names it may not take.
const test = require('node:test'); const assert = require('node:assert');
const T = require('../src/themefile.js');
const F = require('../src/formats.js');
const fs = require('fs'), path = require('path');
const FIX = path.join(__dirname, 'formats', 'fixtures');

// the Wireframe values from shell.css, read from the file so the two can't drift
function wireframe() {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'shell.css'), 'utf8');
  const block = /#stage\{((?:--te-[^;]+;)+)/.exec(css)[1], out = {};
  for (const m of block.matchAll(/--te-([a-z0-9-]+):([^;]+);/g)) out[m[1]] = m[2];
  return out;
}

test('contrast: known pairs, alpha laid over the ground, unreadable values give null', () => {
  assert.strictEqual(T.contrast('#000', '#fff').toFixed(1), '21.0');
  assert.strictEqual(T.contrast('#fff', '#fff'), 1);
  assert.ok(T.contrast('#1d232a', '#fff') > 15);
  assert.ok(T.contrast('#0000', '#fff') < 1.01, 'transparent text over white is white');
  assert.ok(T.contrast('rgba(255,255,255,.94)', '#1d232a') > 10, 'rgba is read, the alpha laid over the ground');
  assert.strictEqual(T.contrast('red', '#fff'), null); assert.strictEqual(T.contrast('url(x)', '#fff'), null); assert.strictEqual(T.contrast(null, '#fff'), null);
});

test('check: the built-in Wireframe values pass every pair (rule 4i: a built-in theme would load as a file)', () => {
  const w = wireframe();
  const r = T.check(w, {}, { name: 'My theme', builtIn: ['Wireframe'] });
  assert.deepStrictEqual(r.errors, [], JSON.stringify(r.pairs.filter(p => p.ratio === null || p.ratio < p.need)));
  assert.strictEqual(r.pairs.length, T.PAIRS.length);
});

test('check: hidden text is refused, with the file value and the default together; untouched pairs are not checked', () => {
  const w = wireframe();
  assert.deepStrictEqual(T.check({ ink: '#fff' }, w).errors.filter(e => e.startsWith('contrast:ink/')).length > 0, true, 'white ink on the white defaults');
  assert.ok(T.check({ ink: '#0000' }, w).errors.includes('contrast:ink/surface'), 'transparent ink');
  assert.ok(T.check({ surface: '#1d232a' }, w).errors.includes('contrast:ink/surface'), 'ink = surface by the ground');
  assert.ok(T.check({ 'ctl-line': '#fff' }, w).errors.includes('contrast:ctl-line/ctl-bg'), 'a control edge at 3:1');
  assert.deepStrictEqual(T.check({ accent: '#f0b45a' }, w).errors, [], 'the same value as the default passes');
  assert.deepStrictEqual(T.check({}, w).pairs, [], 'no tokens: nothing to check');
  assert.ok(T.check({ ink: '#fff' }, {}).errors.length > 0, 'no defaults at all: an unreadable pair fails, never passes by accident');
});

test('check: a display name that copies a built-in is refused, whatever its case or spaces', () => {
  const b = ['Wireframe', 'Notebook + Calculator'];
  assert.ok(T.check({}, {}, { name: ' wireframe ', builtIn: b }).errors.includes('name:taken'));
  assert.ok(T.check({}, {}, { name: 'notebook + calculator', builtIn: b }).errors.includes('name:taken'));
  assert.deepStrictEqual(T.check({}, {}, { name: 'Wireframe 2', builtIn: b }).errors, []);
});

test('vars: only token names become --te- variables; the fixture theme passes formats.js, and its red accent fails the badge pair until accent-ink is set too', () => {
  assert.deepStrictEqual(T.vars({ ink: '#111', 'font-ui': 'Kalam' }), { '--te-ink': '#111', '--te-font-ui': 'Kalam' });
  assert.deepStrictEqual(T.vars({ 'Bad Name': '#111', ink: 3 }), {});
  const o = F.open(fs.readFileSync(path.join(FIX, 'v1-test-graph-paper.theme.json'), 'utf8'));
  assert.ok(o.ok && o.kind === 'theme');
  const w = wireframe();
  assert.deepStrictEqual(T.check(o.doc.tokens, w, { name: o.doc.name, builtIn: ['Wireframe'] }).errors, ['contrast:accent-ink/accent'], 'the default dark-brown badge text on the file\'s red accent is 3.1:1');
  assert.deepStrictEqual(T.check(Object.assign({}, o.doc.tokens, { 'accent-ink': '#fff' }), w, { name: o.doc.name, builtIn: ['Wireframe'] }).errors, [], 'with white badge text it passes');
});
