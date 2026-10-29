// Spec first checks (#253): the numbered specs in docs/*-spec.md are well formed, and the code provides the hooks that
// shipped build steps rely on. Docs: docs/spec-checks.md. Report of what's not covered yet: node tests/tools/specs.js
//   FAILS on: a rule ID defined twice; a reference to a rule that doesn't exist (including in the build-step table);
//             a build step marked "(shipped)" whose rules name a hook (data-..., --te-..., *.svg) that isn't in the code.
//   REPORTS (doesn't fail): rules no build step or coverage row cites, and hooks of later steps not built yet.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const S = require('./tools/specs.js');

test('the spec reader: definitions, ranges, steps, coverage and hooks', () => {
  const spec = [
    '## UI-X · Things', '| # | Rule |', '|---|---|', '| UI-X1 | **One** | uses `data-part="tray"` and `--te-ink` |', '| UI-X2 | **Two** | see UI-X1 |',
    '- **UI-Y1** Pictures: `books.svg` and `data-lean="left"`.', '  continues here with `data-in="key …"`.', '- **UI-Y2 Named rule.** Nothing.',
    '## Coverage', '| Rules | Issue | Note |', '|---|---|---|', '| UI-Y2 | #9 | |',
    '## Build steps and the rules they must meet', '| Step | Issue | Must meet |', '|---|---|---|', '| 1 | #5 (shipped) | UI-X1–X2 |', '| 2 | #6 | UI-Y1, UI-Z9 |',
  ].join('\n');
  const p = S.parseSpec(spec, 'UI', 'test');
  assert.deepStrictEqual([...p.defs.keys()], ['UI-X1', 'UI-X2', 'UI-Y1', 'UI-Y2']);
  assert.deepStrictEqual(p.steps.map(s => [s.issue, s.shipped, s.rules]), [[5, true, ['UI-X1', 'UI-X2']], [6, false, ['UI-Y1', 'UI-Z9']]]);
  assert.deepStrictEqual(p.coverage[0].rules, ['UI-Y2']);
  assert.ok(p.refs.has('UI-Z9') && !p.defs.has('UI-Z9'), 'a reference to a missing rule is seen');
  assert.deepStrictEqual(p.defs.get('UI-X1').hooks.map(h => h.label), ['data-part="tray"', '--te-ink']);
  assert.deepStrictEqual(p.defs.get('UI-Y1').hooks.map(h => h.label), ['books.svg', 'data-lean="left"', 'data-in'], 'list items continue onto the next line');
  assert.deepStrictEqual(S.expandRefs('UI-D1–D3, UI-W6-W8, UI-A3', 'UI'), ['UI-D1', 'UI-D2', 'UI-D3', 'UI-W6', 'UI-W7', 'UI-W8', 'UI-A3']);
  assert.deepStrictEqual(S.parseSpec('| UI-A1 | a |\n| UI-A1 | b |', 'UI', 't').dupes.length, 1, 'duplicates found');
  const code = { text: 'el.dataset.part = "tray"; color: var(--te-ink);', names: new Set(['books.svg']) };
  assert.ok(S.hookPresent({ kind: 'attr', name: 'data-part', value: 'tray' }, code), 'dataset.part counts as data-part');
  assert.ok(S.hookPresent({ kind: 'token', name: '--te-ink' }, code) && S.hookPresent({ kind: 'picture', name: 'books.svg' }, code));
  assert.ok(!S.hookPresent({ kind: 'attr', name: 'data-lean', value: 'left' }, code));
});

const specs = S.loadSpecs();
const reports = S.report(specs);

test('every spec in docs/ is well formed: no rule ID defined twice, no reference to a rule that does not exist', () => {
  assert.ok(specs.some(s => s.prefix === 'UI'), 'docs/ui-spec.md is found');
  for (const r of reports) {
    assert.ok(r.rules > 0, `${r.file} defines rules`);
    assert.deepStrictEqual(r.dupes, [], `${r.file}: rule IDs defined twice`);
    assert.deepStrictEqual(r.undefinedRefs, [], `${r.file}: references to rules that don't exist`);
  }
});

test('every build step names rules, and every step marked (shipped) has its hooks in the code', () => {
  for (const s of specs) for (const st of s.steps) assert.ok(st.rules.length > 0 && st.issue, `${s.file} line ${st.line}: a build step needs an issue and its rules`);
  for (const r of reports) assert.deepStrictEqual(r.missing, [], `${r.file}: hooks that shipped rules need, missing from src/ or themes/`);
});

test('report: rules not cited by a build step, and hooks not built yet (information, not a failure)', () => {
  for (const r of reports) {
    console.log(`# ${r.file}: ${r.rules} rules; not cited by a build step or coverage row: ${r.uncited.join(', ') || 'none'}`);
    console.log(`# ${r.file}: hooks of later steps not in the code yet: ${r.pending.length}`);
  }
});
