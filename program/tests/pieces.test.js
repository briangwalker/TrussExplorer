// The shared screen pieces (#354): builders, the slider's limits, window states and the token contrast.
//   node --test tests/pieces.test.js   (the browser half is tests/ui/pieces.mjs; the rule map is docs/pieces.md)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const P = require(path.join(__dirname, '..', 'src', 'pieces.js'));

const has = (html, re, msg) => assert.match(html, re, msg);

test('tokens: every ART-K1-K12 name, each with its rule (ART-K, UI-T1)', () => {
  const names = P.TOKENS.map(t => t.name);
  for (const n of ['page', 'grid', 'panel', 'panel-peek', 'surface', 'surface-2', 'line', 'line-soft', 'ink', 'muted', 'strong', 'on-strong', 'ctl-bg', 'ctl-line',
    'tab', 'accent', 'accent-ink', 'hot', 'mem-hi', 'mem-hi-ink', 'mem-dim', 'mem-hi-flag', 'font-ui', 'font-head', 'font-mono', 'font-hand']) assert.ok(names.includes(n), n);
  assert.ok(P.TOKENS.every(t => /^ART-K(1[0-2]|[1-9])$/.test(t.rule) && t.css === '--te-' + t.name));
  assert.ok(P.TOKENS.every(t => P.WIREFRAME[t.name] != null), 'Wireframe sets every token');
});

test('tokens: Wireframe strong is brown #7a4f1c (ART-K6, TE-B-118); no meaning colour is a token (ART-K14, UI-A18)', () => {
  assert.strictEqual(P.WIREFRAME.strong, '#7a4f1c');
  const css = P.tokenCSS('wireframe');
  has(css, /^#stage\[data-theme="wireframe"\]\{/);
  assert.doesNotMatch(css, /--(comp|tens|zero|ok|bad)\b/);
  assert.doesNotMatch(P.CSS, /--te-(comp|tens|zero|ok|bad|pass|fail)\b/, 'pieces read pass/fail only from the app (--ok, --bad)');
  assert.throws(() => P.tokenCSS('Bad id"'), /theme id/);
  assert.doesNotMatch(P.tokenCSS('x', { ink: 'red;}body{display:none' }), /[;]\}body|\}body/, 'a value cannot close the rule');
});

test('contrast: the WCAG formula on known pairs', () => {
  assert.ok(Math.abs(P.contrast('#000', '#fff') - 21) < 1e-9);
  assert.ok(Math.abs(P.contrast('#fff', '#fff') - 1) < 1e-9);
  assert.ok(Math.abs(P.contrast('#767676', '#ffffff') - 4.54) < 0.01);
  assert.ok(Number.isNaN(P.contrast('nope', '#fff')));
  assert.ok(P.contrast('#1d232a', 'rgba(255,255,255,.94)', '#f2f4f6') > 4.5, 'see-through panels are laid over the page');
});

test('contrast: Wireframe meets ART-C1 (text 4.5:1) and ART-C2 (lines and focus 3:1)', () => {
  // KNOWN (CODE-T3): pairs with an open issue are printed, not failed. Remove the entry when the issue is fixed.
  const KNOWN = { 'ctl-line on ctl-bg': '#355' };
  const pairs = P.contrastPairs(P.WIREFRAME), key = p => `${p.fg} on ${p.bg}`;
  for (const p of pairs) if (!p.ok && KNOWN[key(p)]) console.log(`KNOWN ${key(p)} ${p.ratio.toFixed(2)} < ${p.min} (${p.rule}) [${KNOWN[key(p)]}]`);
  for (const p of pairs) if (p.ok && KNOWN[key(p)]) assert.fail(`${key(p)} passes now: take it off KNOWN (${KNOWN[key(p)]})`);
  const bad = pairs.filter(p => !p.ok && !KNOWN[key(p)]).map(p => `${key(p)} ${p.ratio.toFixed(2)} < ${p.min} (${p.rule})`);
  assert.deepStrictEqual(bad, []);
});

test('buttons: stick, icon and chip carry their class, part and slot (UI-T1, ART-S)', () => {
  has(P.buttonHTML({ label: 'Run sweep' }), /^<button type="button" class="s-b" data-part="button" data-slot="ctl">Run sweep<\/button>$/);
  has(P.buttonHTML({ kind: 'icon', label: 'Menu', icon: '☰' }), /class="s-ic" data-part="icon-button".*aria-label="Menu".*>☰</);
  has(P.buttonHTML({ kind: 'chip', label: 'Sweep h', pressed: true }), /class="te-chip on" data-part="chip".*aria-pressed="true"/);
  has(P.buttonHTML({ label: 'Off', pressed: false }), /aria-pressed="false"/);
  has(P.buttonHTML({ label: 'X', disabled: true }), / disabled>/);
});

test('buttons: an icon button keeps its words for screen readers (ART-I2); text is escaped (CODE-S1)', () => {
  assert.throws(() => P.buttonHTML({ kind: 'icon', icon: '☰' }), /ART-I2/);
  assert.throws(() => P.buttonHTML({ kind: 'lever', label: 'x' }), /kind/);
  const h = P.buttonHTML({ label: '<img src=x onerror=alert(1)>', title: '"q"' });
  assert.doesNotMatch(h, /<img/); has(h, /&lt;img/); has(h, /title="&quot;q&quot;"/);
});

test('toggle: a switch with aria-checked and its words (ART-S6, UI-A17)', () => {
  const h = P.toggleHTML({ label: 'Member forces', checked: true, id: 'tF' });
  has(h, /role="switch" class="te-tog on" data-part="toggle".*id="tF" aria-checked="true"/);
  has(h, /<i aria-hidden="true"><\/i><\/button><span>Member forces<\/span>/);
  assert.throws(() => P.toggleHTML({}), /label/);
});

test('tabs: one tablist, the picked tab is the only one in the Tab order (UI-S6, UI-K3)', () => {
  const h = P.tabsHTML({ label: 'Analysis', tabs: [{ id: 'wood', label: 'Required wood' }, { id: 'hist', label: 'History' }, { id: 'win', label: 'Winners' }, { id: 'mem', label: 'Members' }], selected: 'hist' });
  has(h, /role="tablist" data-part="tabs" data-slot="ctl" aria-label="Analysis"/);
  assert.strictEqual((h.match(/role="tab"/g) || []).length, 4);
  assert.strictEqual((h.match(/tabindex="0"/g) || []).length, 1);
  has(h, /data-tab-id="hist" id="tab-hist" aria-selected="true" tabindex="0"/);
  has(P.tabsHTML({ tabs: [{ id: 'a', label: 'A' }], selected: 'zz' }), /data-tab-id="a"[^>]*aria-selected="true"/, 'an unknown pick falls back to the first tab');
});

test('window: three states W -> I -> T stepped one at a time, never past an end (UI-A4)', () => {
  assert.strictEqual(P.nextState('W', -1), 'I'); assert.strictEqual(P.nextState('I', -1), 'T'); assert.strictEqual(P.nextState('T', -1), 'T');
  assert.strictEqual(P.nextState('T', 1), 'I'); assert.strictEqual(P.nextState('I', 1), 'W'); assert.strictEqual(P.nextState('W', 1), 'W');
  assert.throws(() => P.nextState('X', 1), /W, I or T/);
});

test('window: a named region with a title, ‹ › stepper, body and icon toolbar (UI-W1-W7, UI-K4)', () => {
  const h = P.windowHTML({ id: 'inputs', title: 'Inputs', home: 'left', state: 'W', body: '<p>x</p>', icons: [{ ic: 'g0', label: 'Shape', icon: 'S' }] });
  has(h, /^<section class="s-pan" id="win-inputs" data-win="inputs" data-home="left" data-state="W" data-part="window" data-slot="bg" role="region" aria-label="Inputs">/);
  has(h, /data-step="shrink" aria-label="Shrink Inputs to icons">‹</);
  has(h, /data-step="grow" aria-label="Grow Inputs to words and icons" hidden>›</);
  has(h, /<div class="s-bd"><p>x<\/p><\/div>/);
  has(h, /role="toolbar" aria-label="Inputs \(icons\)"><button[^>]*data-act="g0"[^>]*aria-label="Shape"/);
  has(P.windowHTML({ id: 'drawing', title: 'Drawing', home: 'right', state: 'I' }), /data-step="shrink"[^>]*>›<.*data-step="grow"[^>]*>‹</, 'the right edge folds the other way');
  has(P.windowHTML({ id: 'sweep', home: 'bottom', state: 'T' }), /data-state="T"[^>]*hidden>/);
  assert.throws(() => P.windowHTML({ id: 'x', home: 'middle' }), /home/);
  assert.throws(() => P.windowHTML({ id: 'Bad Id', home: 'left' }), /id/);
});

test('edge tab: names its window, shown only in the T state (UI-A4, UI-W9)', () => {
  has(P.edgeTabHTML({ id: 'inputs', title: 'Inputs', home: 'left', state: 'T' }), /^<button type="button" class="tabE l" data-part="edge-tab" data-slot="ctl" data-tab="inputs" aria-controls="win-inputs" aria-label="Show Inputs"[^>]*>Inputs<\/button>$/);
  has(P.edgeTabHTML({ id: 'drawing', home: 'right', state: 'W' }), /class="tabE r".* hidden>/);
});

test('slider: a course rule never clamps, it marks (UI-I2); a model limit stops at the wall (UI-I3)', () => {
  const h = { min: 0, max: 140, step: 1, rule: { hi: 100 }, wall: { lo: 20 } };
  assert.deepStrictEqual(P.sliderValue(120, h), { value: 120, ok: true, atWall: '', overRule: true });
  assert.deepStrictEqual(P.sliderValue(90, h), { value: 90, ok: true, atWall: '', overRule: false });
  assert.deepStrictEqual(P.sliderValue(5, h), { value: 20, ok: true, atWall: 'lo', overRule: false });
  assert.strictEqual(P.sliderValue(999, h).value, 140, 'the axis ends still hold');
  assert.strictEqual(P.sliderValue(70.4, h).value, 70, 'snaps to the step');
  assert.strictEqual(P.sliderValue(0.30000000000000004, { min: 0, max: 1, step: 0.1 }).value, 0.3, 'no float dust');
  assert.strictEqual(P.sliderValue('abc', h).ok, false);
});

test('slider: track, zones, swept band and three different handles (ART-W1, ART-W5, UI-I1)', () => {
  const s = P.sliderHTML({ key: 'h', label: 'Height h', unit: 'mm', min: 0, max: 140, step: 1, value: 120, from: 60, to: 100, rule: { hi: 100 }, wall: { lo: 20 }, ruleNote: 'Course rule: h ≤ 100 mm' });
  has(s, /class="te-slider" data-part="slider" data-slot="ctl" data-key="h" data-swept data-over="rule"/);
  has(s, /<span class="trk"/);
  has(s, /class="zone rule" style="left:71.428571%;width:28.571429%" title="Course rule: h ≤ 100 mm"/);
  has(s, /class="zone wall" style="left:0%;width:14.285714%"/);
  has(s, /class="band" data-part="slider-band" style="left:42.857143%;width:28.571429%"/);
  for (const e of ['from', 'to', 'val']) has(s, new RegExp(`data-end="${e}" role="slider" tabindex="0"`));
  has(s, /class="th val" data-end="val"[^>]*aria-label="Height h" aria-valuemin="0" aria-valuemax="140" aria-valuenow="120" aria-valuetext="120 mm"/);
  const plain = P.sliderHTML({ key: 'n', label: 'Panels', min: 2, max: 12, step: 1, value: 6 });
  assert.doesNotMatch(plain, /data-swept|class="band"|data-end="from"/, 'not swept: one handle, no band');
  assert.throws(() => P.sliderHTML({ key: 'x', label: 'x', min: 5, max: 5 }), /max > min/);
});

test('results card: each number next to its limit, verdict in words and a mark (UI-W2, UI-A17, ART-W3)', () => {
  const pass = P.resultsHTML({ verdict: 'pass', checks: [{ label: 'capacity', value: '18.6', op: '>=', limit: '5.0', unit: 'kg', ok: true }, { label: 'sag', value: '0.131', op: '<=', limit: '2', unit: 'mm', ok: true }] });
  has(pass, /class="res" data-part="results" data-slot="disp" aria-expanded="false" aria-haspopup="dialog"/);
  has(pass, /18\.6 ≥ 5\.0 kg/); has(pass, /0\.131 ≤ 2 mm/);
  has(pass, /class="pill ok" data-part="badge" data-slot="disp">✓ PASSES</);
  const failing = P.resultsHTML({ verdict: 'fail', checks: [{ label: 'capacity', value: '3.9', op: '>=', limit: '5.0', unit: 'kg', ok: false }] });
  has(failing, /class="chk bad" data-ok="false"[^>]*>.*3\.9 &lt; 5\.0 kg <span class="x" aria-hidden="true">✕<\/span>/);
  has(failing, /class="pill bad"[^>]*>✕ FAILS</);
  has(P.resultsHTML({ verdict: 'unstable' }), /mechanism.*✕ UNSTABLE/);
  assert.throws(() => P.resultsHTML({ verdict: 'maybe' }), /verdict/);
});

test('CSS: the picture is the base layer, inset 0; windows sit on top (UI-A3, #237)', () => {
  has(P.CSS, /#stage \.te-picture\{position:absolute;inset:0;z-index:0\}/);
  has(P.CSS, /#stage \.s-pan\{position:absolute;[^}]*z-index:76/);
  assert.doesNotMatch(P.CSS, /--free-/, 'nothing makes the picture shrink around a window');
});

test('CSS: focus ring 3 px accent with 3 px offset (ART-S5, UI-K4); disabled 50 % and desaturated (ART-S4); hover lift (ART-S2)', () => {
  has(P.CSS, /:focus-visible\{outline:3px solid var\(--te-accent\);outline-offset:3px\}/);
  has(P.CSS, /:disabled\{opacity:\.5;filter:saturate\(\.3\)/);
  has(P.CSS, /:hover:not\(:disabled\):not\(\.on\)\{transform:translate\(-1px,-2px\)/);
  has(P.CSS, /\[aria-pressed="true"\][^{]*\{[^}]*transform:translateY\(2px\)/, 'pressed sinks (ART-S3, ART-S6)');
  has(P.CSS, /prefers-reduced-motion:reduce/);
});
