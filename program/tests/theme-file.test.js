// A theme file may only set the shell's own tokens and never a built-in theme's id (CODE-F4, #265). Board TE-B-374.
//   node --test tests/theme-file.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const F = require(path.join(__dirname, '..', 'src', 'formats.js'));

const SRC = path.join(__dirname, '..', 'src'), THEMES = path.join(__dirname, '..', 'themes');
const theme = o => F.open(Object.assign({ format: 'truss-explorer-theme', version: 1, id: 'my-theme', name: 'Mine' }, o));

// the --te-* names declared in shell.css's Wireframe block (the "#stage{...}" rule right after the Wireframe comment)
function shellTokens() {
  const css = fs.readFileSync(path.join(SRC, 'shell.css'), 'utf8');
  const block = css.slice(css.indexOf('Wireframe: the default tokens'));
  const rule = block.slice(block.indexOf('#stage{'), block.indexOf('}', block.indexOf('#stage{')));
  return [...rule.matchAll(/--te-([a-z0-9-]+)\s*:/g)].map(m => m[1]);
}

test('THEME_TOKENS equals the --te-* list in shell.css, and is frozen', () => {
  assert.deepStrictEqual([...F.THEME_TOKENS].sort(), [...new Set(shellTokens())].sort());
  assert.ok(Object.isFrozen(F.THEME_TOKENS));
  assert.ok(F.THEME_TOKENS.length >= 15);
});

test('a good two-token file passes', () => {
  const r = theme({ tokens: { ink: '#112233', 'font-ui': 'Inter, Arial' } });
  assert.ok(r.ok, String(r.errors));
});

test('an unknown token is refused as bad-token:<name>', () => {
  for (const k of ['paper', 'radius', 'line-width', 'te-ink', 'bg']) assert.ok(theme({ tokens: { [k]: '#fff' } }).errors.includes('bad-token:' + k), k);
});

test('meaning-colour names are refused (UI-A18)', () => {
  for (const k of ['ok', 'bad', 'comp', 'tens', 'zero']) assert.ok(theme({ tokens: { [k]: '#fff' } }).errors.includes('bad-token:' + k), k);
});

test('every built-in theme id is refused, and the frozen list matches themes/index.json', () => {
  const idx = JSON.parse(fs.readFileSync(path.join(THEMES, 'index.json'), 'utf8')).themes.map(t => t.id);
  assert.deepStrictEqual([...F.BUILTIN_THEME_IDS].sort(), idx.slice().sort());
  assert.ok(Object.isFrozen(F.BUILTIN_THEME_IDS));
  for (const id of idx) assert.ok(theme({ id }).errors.includes('bad-value:id'), id);
  assert.ok(theme({ id: 'not-built-in' }).ok);
});

test('values with url(, @import, expression(, a backslash or javascript: are each refused', () => {
  const bad = ['url(https://x.example/a.png)', '@import "x.css"', 'expression(alert(1))', 'a\\b', 'javascript:alert(1)', 'red; } body { display:none', '#fff url(x)'];
  for (const v of bad) assert.ok(theme({ tokens: { ink: v } }).errors.includes('bad-token:ink'), v);
});

test('checking a theme never throws on odd input', () => {
  for (const tokens of [null, 5, [], 'x']) assert.doesNotThrow(() => theme({ tokens }));
  assert.doesNotThrow(() => theme({ id: 42 }));
});
