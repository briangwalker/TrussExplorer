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

// ui.html's light meaning colours, read from the file so they can't drift
function meaningLight() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.html'), 'utf8');
  const line = /:root, #stage:not\(\[data-theme="og"\]\) \{\s*([^}]*)/.exec(html)[1], out = {};
  for (const m of line.matchAll(/--(ok|bad|comp|tens|zero|warn):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
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
  const r = T.check(w, {}, { name: 'My theme', builtIn: ['Wireframe'] }, meaningLight());
  assert.deepStrictEqual(r.errors, [], JSON.stringify(r.pairs.filter(p => p.ratio === null || p.ratio < p.need)));
  assert.strictEqual(r.pairs.length, T.PAIRS.length + T.GROUNDS.length * Object.keys(T.MEANING).length);
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

test('check: a ground a file sets must keep every meaning colour visible (SEC-007); Wireframe passes with the real meaning colours', () => {
  const w = wireframe(), M = meaningLight();
  assert.deepStrictEqual(Object.keys(M).sort(), Object.keys(T.MEANING).sort(), 'ui.html and MEANING name the same colours');
  assert.deepStrictEqual(T.check(w, {}, null, M).errors, [], 'the built-in grounds pass every meaning colour');
  // Black Hat's recipe: every ground = the pass green, every listed text pair white or black, so every text pair passes
  const hide = Object.assign({}, w); for (const g of T.GROUNDS) hide[g] = M.ok;
  Object.assign(hide, { ink: '#fff', muted: '#fff', 'ctl-line': '#fff', focus: '#fff', strong: '#fff', tab: '#fff', 'on-strong': '#000', accent: '#fff', 'accent-ink': '#000', 'line-soft': '#000' });
  const r = T.check(hide, w, null, M);
  assert.ok(r.errors.includes('meaning:ok/surface'), 'the verdict word would vanish on its own green');
  assert.ok(r.errors.filter(e => e.startsWith('contrast:')).length === 0, 'the listed text pairs all pass, which is the gap the meaning check closes');
  for (const g of T.GROUNDS) for (const m of ['bad', 'comp', 'tens']) assert.ok(T.check({ [g]: M[m] }, w, null, M).errors.includes('meaning:' + m + '/' + g), g + ' = ' + m);
  // a ground near a meaning colour is refused too; a ground the file doesn't set is not checked; no meaning colours given = fail closed
  assert.ok(T.check({ surface: '#3a8a5a' }, w, null, M).errors.includes('meaning:ok/surface'));
  assert.deepStrictEqual(T.check({ ink: '#1d232a' }, w, null, M).errors, []);
  assert.ok(T.check({ surface: '#fff' }, w, null, {}).errors.length === 6, 'no meaning colours known: every meaning pair fails');
});

test('check: the second SEC-007 gap, a dark panel-peek alone hides the peeked text; muted and strong pairs are in', () => {
  const w = wireframe(), M = meaningLight();
  assert.ok(T.check({ 'panel-peek': '#1d232a' }, w, null, M).errors.includes('contrast:ink/panel-peek'));
  assert.ok(T.check({ muted: '#eee' }, w, null, M).errors.includes('contrast:muted/page'));
  assert.ok(T.check({ strong: '#f2f4f6' }, w, null, M).errors.includes('contrast:strong/page'));
});

test('drift guard: every token shell.css uses as a text colour is a fg in PAIRS, and every one it uses as a ground is a bg', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'shell.css'), 'utf8');
  const fgs = new Set(PAIRS_FG()), bgs = new Set(PAIRS_BG());
  const asText = new Set([...css.matchAll(/(?:^|[;{\s])color:\s*var\(--te-([a-z0-9-]+)\)/g)].map(m => m[1]));
  const asGround = new Set([...css.matchAll(/background(?:-color)?:\s*var\(--te-([a-z0-9-]+)\)/g)].map(m => m[1]));
  const fonts = k => k.startsWith('font-');
  for (const k of asText) if (!fonts(k) && !['line', 'line-soft', 'grid', 'accent'].includes(k)) assert.ok(fgs.has(k), 'text colour --te-' + k + ' has no pair');
  for (const k of asGround) if (!['line', 'line-soft', 'grid', 'strong', 'tab', 'accent'].includes(k)) assert.ok(bgs.has(k), 'ground --te-' + k + ' has no pair');
  function PAIRS_FG() { return T.PAIRS.map(p => p[0]); } function PAIRS_BG() { return T.PAIRS.map(p => p[1]).concat(T.GROUNDS); }
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
  const M = meaningLight();
  assert.deepStrictEqual(T.check(o.doc.tokens, w, { name: o.doc.name, builtIn: ['Wireframe'] }, M).errors, ['contrast:accent-ink/accent'], 'the default dark-brown badge text on the file\'s red accent is 3.1:1');
  assert.deepStrictEqual(T.check(Object.assign({}, o.doc.tokens, { 'accent-ink': '#fff' }), w, { name: o.doc.name, builtIn: ['Wireframe'] }, M).errors, [], 'with white badge text it passes');
});

test('check: a solid ground with alpha is refused, a panel below 80% opaque is refused, hot may be a tint (Black Hat, SEC-007 SHOULD); every built-in ground passes', () => {
  const w = wireframe(), M = meaningLight();
  const solid = T.GROUNDS.filter(g => !T.SEE_THROUGH.includes(g) && g !== 'hot');
  assert.deepStrictEqual(solid, ['page', 'surface', 'surface-2', 'ctl-bg']);
  // 'hot' is a tint over checked grounds (Notebook's is rgba(255,210,60,.38)): alpha is allowed, its pairs are still checked
  for (const v of ['rgba(255,210,60,.38)', '#fdebd680']) assert.ok(!T.check({ hot: v }, w, null, M).errors.includes('opaque:hot'), v);
  for (const g of solid) for (const v of ['#ffffff80', '#fff8', 'rgba(255,255,255,0.5)', '#ffffffFE', 'rgba(255,255,255,.94)']) assert.ok(T.check({ [g]: v }, w, null, M).errors.includes('opaque:' + g), g + ' = ' + v);
  for (const g of T.GROUNDS) for (const v of ['#ffffff', '#fff', '#ffffffff', 'rgb(255,255,255)', 'rgba(255,255,255,1)']) assert.ok(!T.check({ [g]: v }, w, null, M).errors.some(e => e.startsWith('opaque:')), g + ' = ' + v);
  for (const g of T.SEE_THROUGH) {
    for (const v of ['#ffffff80', 'rgba(255,255,255,.79)', '#0000', 'rgba(255,255,255,0)']) assert.ok(T.check({ [g]: v }, w, null, M).errors.includes('opaque:' + g), g + ' = ' + v);
    for (const v of ['rgba(255,255,255,.8)', 'rgba(255,255,255,.86)', 'rgba(255,255,255,.94)']) assert.ok(!T.check({ [g]: v }, w, null, M).errors.includes('opaque:' + g), g + ' = ' + v);
  }
  // rule 4i: the panel values of every built-in theme that has plain values (shell.css Wireframe, themes/*.css) pass this rule
  const css = [fs.readFileSync(path.join(__dirname, '..', 'src', 'shell.css'), 'utf8')].concat(fs.readdirSync(path.join(__dirname, '..', 'themes')).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(path.join(__dirname, '..', 'themes', f), 'utf8')));
  let seen = 0;
  for (const c of css) for (const m of c.matchAll(/--te-(page|surface|surface-2|panel|panel-peek|ctl-bg|hot):([^;}]+)/g)) {
    if (/var\(|color-mix/.test(m[2])) continue;
    seen++; assert.ok(!T.check({ [m[1]]: m[2].trim() }, w, null, M).errors.includes('opaque:' + m[1]), m[1] + ' = ' + m[2]);
  }
  assert.ok(seen >= 14, 'read the built-in grounds: ' + seen);
  assert.ok(!T.check({ ink: '#1d232aee' }, w, null, M).errors.some(e => e.startsWith('opaque:')));
});

test('check: invisible characters in a name do not get past the built-in name rule (Black Hat NOTE 1)', () => {
  const b = ['OG', 'Wireframe'];
  for (const n of ['OG​', '​OG', 'O‍G', '⁦Wireframe⁩', 'Wire﻿frame', 'OG‎']) assert.ok(T.check({}, {}, { name: n, builtIn: b }).errors.includes('name:taken'), JSON.stringify(n));
  assert.deepStrictEqual(T.check({}, {}, { name: 'OG 2', builtIn: b }).errors, []);
});

test('check: ink on line-soft is a pair (a refused number box value, inputs.js; Black Hat NOTE 2); every built-in theme passes it (rule 4i)', () => {
  const w = wireframe();
  assert.ok(T.PAIRS.some(([f, b, n]) => f === 'ink' && b === 'line-soft' && n === 4.5));
  assert.ok(T.check({ 'line-soft': w.ink }, w).errors.includes('contrast:ink/line-soft'), 'line-soft = ink hides the value');
  assert.ok(T.check({ ink: w['line-soft'] }, w).errors.includes('contrast:ink/line-soft'), 'ink = line-soft by the text');
  // the plain ink and line-soft of each built-in (shell.css Wireframe, themes/*.css), each with the other from the same block
  const dir = path.join(__dirname, '..', 'themes');
  const css = [fs.readFileSync(path.join(__dirname, '..', 'src', 'shell.css'), 'utf8')].concat(fs.readdirSync(dir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')));
  let seen = 0;
  for (const c of css) for (const blk of c.matchAll(/\{([^{}]*--te-line-soft:[^{}]*)\}/g)) {
    const ink = /--te-ink:([^;}]+)/.exec(blk[1]), soft = /--te-line-soft:([^;}]+)/.exec(blk[1]);
    if (!ink || !soft || /var\(|color-mix/.test(ink[1] + soft[1])) continue;
    seen++; const r = T.contrast(ink[1].trim(), soft[1].trim());
    assert.ok(r >= 4.5, ink[1] + ' on ' + soft[1] + ': ' + r);
  }
  assert.ok(seen >= 3, 'read the built-in ink/line-soft pairs: ' + seen);
});
