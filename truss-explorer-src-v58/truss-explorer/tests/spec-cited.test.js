// The "Spec cited" PR check (tests/tools/spec-cited.mjs, .github/workflows/spec-cited.yml; #253). Docs: docs/spec-checks.md
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');

const P = 'truss-explorer-src-v58/truss-explorer/';
const ids = new Set(['UI-A3', 'UI-W5', 'UI-H5', 'ART-M2']);
let decide;
test.before(async () => { ({ decide } = await import(pathToFileURL(path.join(__dirname, 'tools', 'spec-cited.mjs')).href)); });

test('no screen or format file changed: nothing needed', () => {
  const r = decide('', [P + 'src/core.js', P + 'tests/solver.test.js', 'README.md'], ids);
  assert.ok(r.ok && !r.needed);
});

test('a screen change must name a rule that exists', () => {
  for (const f of ['src/shell.js', 'src/shell.css', 'src/ui.html', 'src/app/30-drawing.js', 'src/app/90-controls.js', 'themes/blueprint.css']) {
    assert.ok(!decide('Fixes the tray.', [P + f], ids).ok, f + ' without a rule');
    assert.ok(decide('Spec rules met: UI-A3, UI-W5', [P + f], ids).ok, f + ' with rules');
  }
  assert.ok(decide('', [P + 'src/app/60-sweep.js'], ids).ok, 'the sweep engine part is not screen code');
});

test('a rule ID that is not in any spec is a mistake, even next to good ones', () => {
  const r = decide('Spec rules met: UI-A3, UI-Q9', [P + 'src/shell.js'], ids);
  assert.ok(!r.ok); assert.deepStrictEqual(r.unknown, ['UI-Q9']);
  assert.ok(decide('Board TE-B-073, finding SEC-003 aside; meets ART-M2', [P + 'themes/x.css'], ids).ok, 'board rows and finding IDs are not rule IDs');
});

test('a format change names docs/formats.md, a rule, or says why not', () => {
  assert.ok(!decide('Tidy up.', [P + 'src/formats.js'], ids).ok);
  assert.ok(decide('Follows docs/formats.md (theme section).', [P + 'src/formats.js'], ids).ok);
  assert.ok(decide('', ['docs/formats.md'], ids).ok === false);
});

test('"Spec: none - why" is accepted with a reason of at least three words', () => {
  assert.ok(decide('Spec: none - internal refactor only, nothing on screen changes', [P + 'src/ui.html'], ids).ok);
  assert.ok(!decide('Spec: none - n/a', [P + 'src/ui.html'], ids).ok, 'a reason is needed');
});

test('the description is only matched as text', () => {
  const r = decide('$(rm -rf /) `curl x` UI-A3 <script>alert(1)</script>', [P + 'src/shell.js'], ids);
  assert.ok(r.ok); assert.deepStrictEqual(r.cited, ['UI-A3']);
});
