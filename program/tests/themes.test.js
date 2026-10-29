// Themes (#265; docs/art-implementation.md section 7): packing, pictures, meaning colours and contrast.
//   node --test tests/themes.test.js
// The packer is tools/themepack.py (build.py uses it). Refusal cases are made in a temp folder here, so no bad file is committed.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..'), THEMES = path.join(ROOT, 'themes'), PACKER = path.join(ROOT, 'tools', 'themepack.py');
const runPack = dir => { const r = spawnSync('python3', [PACKER, dir], { encoding: 'utf8' }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
const packJson = dir => { const r = spawnSync('python3', [PACKER, dir, '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); assert.strictEqual(r.status, 0, r.stdout + r.stderr); return JSON.parse(r.stdout); };

// ---------- a throwaway themes folder: one theme in its own folder, plus the files a case adds
function caseDir(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'te-theme-'));
  const index = { format: 'truss-explorer-theme-index', version: 1, themes: [{ format: 'truss-explorer-theme', version: 1, id: 't', name: 'T', css: 't/theme.css' }] };
  const all = Object.assign({ 'index.json': JSON.stringify(index), 't/theme.css': '#stage[data-theme="t"]{--te-page:#fff}' }, files);
  for (const [name, body] of Object.entries(all)) { const f = path.join(d, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); }
  return d;
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const SVG_OK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120" class="te-catpic" role="img" aria-label="Load"><g data-in="book1"><rect width="10" height="5"/></g><g data-in="book2"><rect width="10" height="5"/></g><use href="#a"/></svg>';

test('theme-pack: the built-in themes pack, each under the 400 KB budget (fonts counted apart)', () => {
  const r = runPack(THEMES);
  assert.strictEqual(r.code, 0, r.out);
  for (const line of r.out.split('\n').filter(l => /^theme /.test(l))) { const kb = +line.match(/: (\d+) KB packed/)[1]; assert.ok(kb <= 400, line); }
  console.log('# ' + r.out.trim().split('\n').join('\n# '));
});

test('theme-pack: a relative image, a font and an SVG in the theme folder become data: URIs', () => {
  const d = caseDir({ 't/theme.css': '#stage[data-theme="t"]{background:url("img/paper.png")} @font-face{font-family:X;src:url(../fonts/x.woff2)}', 't/img/paper.png': PNG, 'fonts/x.woff2': 'wOF2fake', 't/icons/i.svg': SVG_OK });
  // '..' is refused even toward themes/fonts/: a theme names shared fonts through themes/fonts/fonts.css instead
  assert.match(runPack(d).out, /REFUSED.*'\.\.'/);
  const d2 = caseDir({ 't/theme.css': '#stage[data-theme="t"]{background:url("img/paper.png")} .i{background:url(icons/i.svg)}', 't/img/paper.png': PNG, 't/icons/i.svg': SVG_OK,
    'fonts/fonts.css': '@font-face{font-family:X;src:url(x.woff2) format("woff2")}', 'fonts/x.woff2': 'wOF2fake' });
  const p = packJson(d2), css = p.pack.files['t/theme.css'];
  assert.match(css, /url\("data:image\/png;base64,/); assert.match(css, /url\("data:image\/svg\+xml;base64,/);
  assert.doesNotMatch(css, /paper\.png|i\.svg/);
  assert.match(p.fonts, /url\("data:font\/woff2;base64,/);
});

const REFUSE = [
  ['an http url()', { 't/theme.css': '.a{background:url(http://example.com/x.png)}' }, /outside the theme/],
  ['a protocol-relative url()', { 't/theme.css': '.a{background:url(//example.com/x.png)}' }, /outside the theme/],
  ['@import', { 't/theme.css': '@import url("x.css"); .a{}' }, /@import/],
  ["'..' in a url()", { 't/theme.css': '.a{background:url(../other/x.png)}' }, /'\.\.'/],
  ['an absolute path', { 't/theme.css': '.a{background:url(/etc/x.png)}' }, /absolute/],
  ['a file type that is not allowed', { 't/theme.css': '.a{background:url(x.gif)}', 't/x.gif': 'GIF89a' }, /not an allowed file type/],
  ['a missing file', { 't/theme.css': '.a{background:url(nope.png)}' }, /not found/],
  ['a data: URI that is not an image or font', { 't/theme.css': '.a{background:url("data:text/html,<b>x</b>")}' }, /not allowed/],
  ['javascript: in a url()', { 't/theme.css': '.a{background:url(javascript:alert(1))}' }, /outside the theme/],
  ['a picture with a script', { 't/pictures/load.svg': '<svg><script>alert(1)</script></svg>' }, /<script>/],
  ['a picture with an on* attribute', { 't/pictures/load.svg': '<svg onload="x()"></svg>' }, /on\* event attribute/],
  ['a picture with a foreignObject', { 't/pictures/load.svg': '<svg><foreignObject><div/></foreignObject></svg>' }, /foreignObject/],
  ['a picture with an outside href', { 't/pictures/load.svg': '<svg><a href="https://example.com"><rect/></a></svg>' }, /outside link/],
  ['a picture with an embedded raster', { 't/pictures/load.svg': '<svg><image href="data:image/png;base64,AAAA"/></svg>' }, /raster|<image>/],
  ['an icons.svg with a script', { 't/icons.svg': '<svg><script/></svg>' }, /<script>/],
  ['an SVG used from CSS with a script', { 't/theme.css': '.a{background:url(x.svg)}', 't/x.svg': '<svg><script/></svg>' }, /<script>/],
  ['an inline SVG data: URI with a script', { 't/theme.css': `.a{background:url("data:image/svg+xml;base64,${Buffer.from('<svg onload="x()"/>').toString('base64')}")}` }, /on\*/],
];
for (const [name, files, why] of REFUSE) {
  test(`theme-pack refuses ${name}`, () => { const r = runPack(caseDir(files)); assert.strictEqual(r.code, 1, r.out); assert.match(r.out, /^REFUSED/m); assert.match(r.out, why); });
}

test('theme-pack: over 400 KB (fonts not counted) is refused; fonts alone are not', () => {
  const big = 'x'.repeat(410 * 1024);
  assert.match(runPack(caseDir({ 't/theme.css': `.a{content:"${big}"}` })).out, /over the 400 KB budget/);
  const font = `@font-face{font-family:X;src:url("data:font/woff2;base64,${'A'.repeat(500 * 1024)}")}`;
  assert.strictEqual(runPack(caseDir({ 't/theme.css': font })).code, 0);
});

test('theme-pack: the same files give the same bytes', () => {
  const a = spawnSync('python3', [PACKER, THEMES, '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 }).stdout;
  const b = spawnSync('python3', [PACKER, THEMES, '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 }).stdout;
  assert.ok(a.length > 1000); assert.strictEqual(a, b);
});

// ---------- pictures: hooks the app and the UI spec rely on (ART-H1, ART-H3, ART-H4)
const CATS = ['shape', 'geo', 'sup', 'load', 'sticks', 'mat', 'rules', 'd3'];
function pictureProblems(id, svg) {
  const p = [];
  if (CATS.includes(id)) { if (!/role="img"/.test(svg)) p.push(`${id}: no role="img"`); if (!/aria-label="[^"]+"/.test(svg)) p.push(`${id}: no aria-label`); if (!/viewBox="0 0 300 120"/.test(svg)) p.push(`${id}: viewBox is not 0 0 300 120`); }
  if (id === 'load' && !(/data-in="[^"]*\bbook1\b/.test(svg) && /data-in="[^"]*\bbook2\b/.test(svg))) p.push('load: no book1/book2 groups');
  if (id === 'd3') {
    if (!/data-lean="right"/.test(svg) || !/data-lean="left"/.test(svg)) p.push('d3: no data-lean right/left groups');
    if (!/data-lean-shear="[\d.]+ [\d.]+"/.test(svg)) p.push('d3: no data-lean-shear numbers');
    if (/data-lean="in"/.test(svg) && !/data-lean-matrix="[\d.]+ [\d.]+ [\d.]+ [\d.]+"/.test(svg)) p.push('d3: top bracing without data-lean-matrix');
  }
  return p;
}
test('picture-hooks: every packed picture has its hooks (and the check catches a missing one)', () => {
  const p = packJson(THEMES).pack.pictures || {};
  for (const [tid, pics] of Object.entries(p)) for (const [id, svg] of Object.entries(pics)) if (id !== 'css' && id !== 'icons') assert.deepStrictEqual(pictureProblems(id, svg), [], `theme ${tid}`);
  assert.deepStrictEqual(pictureProblems('load', SVG_OK.replace('Load', 'x')), []);
  assert.ok(pictureProblems('load', '<svg viewBox="0 0 300 120"></svg>').length >= 3);
  assert.ok(pictureProblems('d3', '<svg role="img" aria-label="3D" viewBox="0 0 300 120"><g data-lean="right"/></svg>').some(s => /left/.test(s)));
});

// ---------- meaning colours belong to the app (ART-K14, #197): no theme file may set them
test('meaning-colours: no theme file sets --comp, --tens, --zero, --ok or --bad', () => {
  for (const f of fs.readdirSync(THEMES, { recursive: true }).filter(f => String(f).endsWith('.css'))) {
    const css = fs.readFileSync(path.join(THEMES, String(f)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const hit = css.match(/(^|[;{\s])--(comp|tens|zero|ok|bad)\s*:/);
    assert.ok(!hit, `${f} sets --${hit && hit[2]}`);
  }
});

// ---------- contrast from the tokens (ART-C1 text 4.5 : 1, ART-C2 control edges 3 : 1)
// the --te-* tokens a theme sets on #stage itself: rules like #stage[data-theme="id"]{...} or #stage:is([data-theme^="prefix"], ...){...}
// (id null = the plain #stage rule, Wireframe's defaults in shell.css). Rules for parts inside the stage are skipped.
function tokens(css, id) {
  const out = {}; css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].split(';').pop().trim();   // text after an @import or @charset line is not part of the selector
    if (!/^#stage(\[|:is\(|$)/.test(sel)) continue;
    if (/\s/.test(sel.replace(/:is\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, ''))) continue;   // a part inside the stage
    const ids = [...sel.matchAll(/data-theme="([^"]+)"/g)].map(x => x[1]), pre = [...sel.matchAll(/data-theme\^="([^"]+)"/g)].map(x => x[1]);
    const hit = id == null ? sel === '#stage' : ids.includes(id) || pre.some(x => id.startsWith(x));
    if (hit) m[2].replace(/--te-([a-z0-9-]+)\s*:\s*([^;]+)/g, (_, k, v) => { out[k] = v.trim(); });
  }
  return out;
}
function rgba(v) {
  if (!v) return null; v = v.trim();
  let m = v.match(/^#([0-9a-f]{3,8})$/i);
  if (m) { let h = m[1]; if (h.length <= 4) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1); }
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
  return null;   // var(), color-mix(), names: not checked here
}
const over = (fg, bg) => fg[3] >= 1 ? fg : [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lum = c => { const v = c.slice(0, 3).map(x => x / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const PAIRS = [['ink', 'page', 4.5], ['ink', 'panel', 4.5], ['ink', 'surface', 4.5], ['ink', 'surface-2', 4.5], ['muted', 'page', 4.5], ['muted', 'panel', 4.5], ['muted', 'surface', 4.5], ['muted', 'surface-2', 4.5],
  ['on-strong', 'strong', 4.5], ['accent-ink', 'accent', 4.5], ['ctl-line', 'ctl-bg', 3]];
// filed and owned by Graphics (the token values are theirs): these print as KNOWN and don't fail
const KNOWN = { 'wireframe ctl-line/ctl-bg': '#288', 'blueprint ctl-line/ctl-bg': '#288', 'notebook-calc ctl-line/ctl-bg': '#288', 'notebook-calc muted/panel': '#288' };
test('contrast: the text and control-edge token pairs of each built-in theme', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'shell.css'), 'utf8');
  const themes = { wireframe: tokens(shell, null) };
  const idx = JSON.parse(fs.readFileSync(path.join(THEMES, 'index.json'), 'utf8'));
  const seenCss = new Set();   // variants sharing one CSS file (notebook-calc-gen, -calc) are checked once, under the first id
  for (const t of idx.themes) if (t.css && !seenCss.has(t.css) && seenCss.add(t.css)) themes[t.id] = Object.assign({}, themes.wireframe, tokens(fs.readFileSync(path.join(THEMES, t.css), 'utf8'), t.id));
  const fails = [], known = [];
  for (const [id, tk] of Object.entries(themes)) {
    const page = rgba(tk.page) || [255, 255, 255, 1];
    for (const [a, b, min] of PAIRS) {
      const fb = rgba(tk[b]), fa = rgba(tk[a]); if (!fa || !fb) continue;
      const bg = over(fb, page), r = ratio(over(fa, bg), bg), key = `${id} ${a}/${b}`;
      if (r + 1e-9 < min) (KNOWN[key] ? known : fails).push(`${key} ${r.toFixed(2)} : 1 (needs ${min})${KNOWN[key] ? ' [' + KNOWN[key] + ']' : ''}`);
    }
  }
  known.forEach(k => console.log('# KNOWN ' + k));
  assert.deepStrictEqual(fails, []);
  // a known item that now passes should come off the list (said, not failed, so a fix in another PR never turns this red)
  Object.keys(KNOWN).filter(k => !known.some(s => s.startsWith(k + ' '))).forEach(k => console.log(`# now passes, take it off KNOWN: ${k}`));
});
