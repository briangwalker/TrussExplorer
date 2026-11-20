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

// ---------- RMA-7 (TE-B-388, WH-T6): each token's value must match its own kind; a bad one is dropped, never cleaned ----------
const good = o => theme({ tokens: o });
test('every THEME_TOKENS name has a kind, and there are no extra kinds', () => {
  assert.deepStrictEqual(Object.keys(F.THEME_KIND).sort(), [...F.THEME_TOKENS].sort());
  assert.ok(Object.values(F.THEME_KIND).every(k => ['colour', 'size', 'font'].includes(k)));
  assert.ok(Object.isFrozen(F.THEME_KIND) && Object.isFrozen(F.FONTS));
  assert.ok(['font-ui', 'font-head', 'font-mono'].every(k => F.THEME_KIND[k] === 'font'));
});

test('colour: #rgb, #rrggbb, #rrggbbaa pass; names, rgb(), hsl, 4 or 5 digits and odd text drop', () => {
  for (const v of ['#fff', '#FFF', '#1d232a', '#1d232a80']) { const r = good({ ink: v }); assert.ok(r.ok && r.warnings.length === 0 && r.doc.tokens.ink === v, v); }
  for (const v of ['red', 'transparent', 'rgb(1,2,3)', 'rgba(0,0,0,.5)', 'hsl(0,0%,0%)', '#ffff', '#fffff', '#ggg', '#1234567', '#', '12', 'currentcolor']) {
    const r = good({ ink: v, line: '#000' });
    // text with brackets is refused outright by the general check (error); plain wrong text is dropped with a warning
    assert.ok(!r.ok ? r.errors.includes('bad-token:ink') : (r.warnings.includes('dropped:ink') && !('ink' in r.doc.tokens) && r.doc.tokens.line === '#000'), v);
  }
});

test('size: a number with px, em or nothing, 0 to 200 (the kind exists for later tokens)', () => {
  for (const v of ['0', '4', '4px', '1.5em', '200', '200px', '12.25px']) assert.ok(F.tokenFits('size', v), v);
  for (const v of ['-1', '-4px', '201', '1000', '4rem', '4%', '4pt', '', ' 4', '4 ', '1e3', 'NaN', 'calc(4px)', 4, null]) assert.ok(!F.tokenFits('size', v), String(v));
});

test('font: 1 to 4 names, each from FONTS; no quotes, no other characters', () => {
  for (const v of ['Kalam', 'VT323', 'Barlow Semi Condensed', 'Kalam,cursive', 'Barlow,Segoe UI,system-ui,sans-serif', 'Kalam, cursive']) { const r = good({ 'font-ui': v }); assert.ok(r.ok && r.warnings.length === 0, v); }
  for (const v of ['Comic Sans MS', 'Kalam,Comic Sans MS', 'a,b,c,d,e', 'Kalam,Kalam,Kalam,Kalam,Kalam', '"Kalam"', "'Kalam'", 'kalam', 'Kalam;', 'Kalam,', ',Kalam', '', 'Kalam,,Kalam']) {
    const r = good({ 'font-ui': v, ink: '#000' });
    assert.ok(!r.ok ? r.errors.includes('bad-token:font-ui') : (r.warnings.includes('dropped:font-ui') && !('font-ui' in r.doc.tokens)), JSON.stringify(v));
  }
  // one stack with one unknown name drops whole; a fifth name drops
  assert.ok(good({ 'font-mono': 'Kalam,Nope', ink: '#000' }).warnings.includes('dropped:font-mono'));
  assert.ok(good({ 'font-mono': 'Kalam,VT323,Barlow,Menlo,monospace', ink: '#000' }).warnings.includes('dropped:font-mono'));
  // a colour value in a font token, and a font in a colour token, drop
  assert.ok(good({ 'font-ui': '#fff', ink: '#000' }).warnings.includes('dropped:font-ui'));
  assert.ok(good({ ink: 'Kalam', line: '#000' }).warnings.includes('dropped:ink'));
});

test('a value that is not a string is dropped, never turned into text (Black Hat, TE-B-374)', () => {
  for (const v of [['#000'], 3, {}, null, true, [], { a: 1 }]) {
    const r = good({ ink: v, line: '#000' });
    assert.ok(r.ok, JSON.stringify(v)); assert.ok(r.warnings.includes('dropped:ink'), JSON.stringify(v));
    assert.ok(!('ink' in r.doc.tokens), 'not in the result'); assert.strictEqual(r.doc.tokens.line, '#000');
  }
});

test('a dropped value is not changed or cleaned: the others stay exactly as given; all dropped gives empty-theme', () => {
  const r = good({ ink: 'red', line: '#abc', 'font-ui': 'Nope' });
  assert.deepStrictEqual(r.doc.tokens, { line: '#abc' }); assert.deepStrictEqual(r.warnings.filter(w => w.startsWith('dropped:')).sort(), ['dropped:font-ui', 'dropped:ink']);
  assert.ok(!r.warnings.includes('empty-theme'));
  const e = good({ ink: 'red', line: 'blue' });
  assert.ok(e.ok); assert.deepStrictEqual(e.doc.tokens, {}); assert.ok(e.warnings.includes('empty-theme'));
  assert.ok(!theme({}).warnings.includes('empty-theme'), 'no tokens at all is not "all dropped"');
  assert.ok(!good({ ink: '#000' }).warnings.includes('empty-theme'));
});

test('injection text stays a hard error (the general check comes first): url(, calc(, @import, expression(, backslash, javascript:', () => {
  for (const v of ['url(x.png)', 'calc(1px+2px)', '@import "x"', 'expression(alert(1))', 'a\\b', 'javascript:alert(1)', 'var(--x)']) assert.ok(good({ ink: v }).errors.includes('bad-token:ink'), v);
});

test('every Wireframe token in shell.css passes its own kind, so a built-in theme would load as a file', () => {
  const css = fs.readFileSync(path.join(SRC, 'shell.css'), 'utf8');
  const block = css.slice(css.indexOf('Wireframe: the default tokens')); const rule = block.slice(block.indexOf('#stage{'), block.indexOf('}', block.indexOf('#stage{')));
  const decl = [...rule.matchAll(/--te-([a-z0-9-]+)\s*:\s*((?:"[^"]*"|\([^)]*\)|[^;"(])*)/g)].map(m => [m[1], m[2].trim()]);
  assert.strictEqual(decl.length, F.THEME_TOKENS.length);
  const toHex = v => { const m = /^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/.exec(v); if (!m) return v;
    const h = n => (+n).toString(16).padStart(2, '0'); return '#' + h(m[1]) + h(m[2]) + h(m[3]) + (m[4] !== undefined ? h(Math.round(m[4] * 255)) : ''); };
  const tokens = {};
  for (const [name, raw] of decl) {
    const v = F.THEME_KIND[name] === 'font' ? raw.split(',').map(x => x.trim().replace(/^"|"$/g, '')).join(',') : toHex(raw);
    assert.ok(F.tokenFits(F.THEME_KIND[name], v), name + ' = ' + v); tokens[name] = v;
  }
  const r = good(tokens); assert.ok(r.ok, String(r.errors)); assert.deepStrictEqual(r.warnings, []); assert.deepStrictEqual(r.doc.tokens, tokens);
});
