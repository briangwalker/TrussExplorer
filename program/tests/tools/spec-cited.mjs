// "Spec cited" pull-request check (Spec first, rulebook rule 3; #253). Run by .github/workflows/spec-cited.yml.
// A PR that changes the screen (shell, page markup, the drawing/inputs/charts/3D/controls parts of src/app, themes/) or a
// file format (formats.js, docs/formats.md) must say which spec rules it follows, in its description:
//   - one or more rule IDs that exist in docs/*-spec.md (UI-A3, ART-M2 ...), or "formats.md" for a format change; or
//   - "Spec: none - <why>" (at least three words of why), e.g. "Spec: none - internal refactor, nothing on screen changes".
// It is NOT a required check (making it one is Brian's call): a red mark is a reminder, it blocks nothing.
//   Local: PR_BODY="..." node tests/tools/spec-cited.mjs file1 file2 ...     (paths from the repo root)
//   CI:    PR_BODY, BASE_SHA and HEAD_SHA from the workflow; the changed files come from git.
// The PR text is untrusted: it is only read from the environment and matched, never run or put in a shell command.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { loadSpecs } = require('./specs.js');

const APP = 'program/';
export const SCREEN = [/^src\/shell\.(js|css)$/, /^src\/ui\.html$/, /^src\/app\/(20|30|70|80|90)-[^/]+\.js$/, /^themes\//];
export const FORMAT = [/^src\/formats\.js$/, /^docs\/formats\.md$/];

// files: paths from the repo root; ids: Set of every defined rule ID. Returns what was needed and what was found.
export function decide(body, files, ids) {
  body = String(body || '');
  const rel = f => f.startsWith(APP) ? f.slice(APP.length) : f;
  const screen = files.filter(f => SCREEN.some(r => r.test(rel(f))));
  const format = files.filter(f => FORMAT.some(r => r.test(rel(f))) || /^docs\/formats\.md$/.test(f));
  const res = { needed: screen.length + format.length > 0, screen, format, cited: [], unknown: [], none: null, ok: true, why: [] };
  if (!res.needed) { res.why.push('No screen or file-format files changed, so no spec citation is needed.'); return res; }
  const mentioned = [...new Set(body.match(/\b[A-Z]{2,5}-[A-Z]{1,2}\d+\b/g) || [])].filter(id => /^(UI|ART|[A-Z]{2,5})-/.test(id) && !/^(TE|SEC|CVE)-/.test(id));
  res.cited = mentioned.filter(id => ids.has(id));
  res.unknown = mentioned.filter(id => !ids.has(id) && [...ids].some(k => k.split('-')[0] === id.split('-')[0]));
  const none = body.match(/Spec:\s*none\s*[-–—:]\s*(.+)/i);
  if (none && none[1].trim().split(/\s+/).length >= 3) res.none = none[1].trim();
  const formatsCited = /formats\.md/.test(body) || res.cited.length > 0;
  if (res.unknown.length) { res.ok = false; res.why.push(`These rule IDs aren't in any spec (typo, or the rule was renumbered): ${res.unknown.join(', ')}.`); }
  if (res.none) res.why.push(`Says "Spec: none - ${res.none}".`);
  else {
    if (screen.length && !res.cited.length) { res.ok = false; res.why.push(`Changes the screen (${screen.map(rel).join(', ')}) but names no rule from docs/ui-spec.md or docs/art-spec.md. Add the rule IDs it follows, e.g. "Spec rules met: UI-A3, UI-W5", or "Spec: none - <why>".`); }
    if (format.length && !formatsCited) { res.ok = false; res.why.push(`Changes a file format (${format.map(rel).join(', ')}) but doesn't name the docs/formats.md section it follows, or "Spec: none - <why>".`); }
  }
  if (res.ok && res.cited.length) res.why.push(`Names ${res.cited.join(', ')}.`);
  return res;
}

function changedFiles() {
  const base = process.env.BASE_SHA, head = process.env.HEAD_SHA || 'HEAD';
  if (!/^[0-9a-f]{7,40}$/.test(base || '') || !/^([0-9a-f]{7,40}|HEAD)$/.test(head)) throw new Error('BASE_SHA/HEAD_SHA missing or not a commit hash');
  return execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { encoding: 'utf8' }).split('\n').filter(Boolean);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.length > 2 ? process.argv.slice(2) : changedFiles();
  const ids = new Set(loadSpecs().flatMap(s => [...s.defs.keys()]));
  const r = decide(process.env.PR_BODY, files, ids);
  const lines = [`## Spec cited: ${r.ok ? 'yes' : 'not yet'}`, '', ...r.why.map(w => `- ${w}`), '',
    '_Spec first (rulebook rule 3, #253). Not a required check: it reminds, it doesn\'t block. Rules: docs/ui-spec.md, docs/art-spec.md, docs/formats.md. Report: node tests/tools/specs.js._'];
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  process.exit(r.ok ? 0 : 1);
}
