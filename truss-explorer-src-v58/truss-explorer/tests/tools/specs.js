// Spec reader for the Spec-first checks (#253, rulebook rule 3). Reads the numbered specs in docs/*-spec.md
// (docs/ui-spec.md -> rules UI-..., docs/art-spec.md -> ART-..., any future docs/<area>-spec.md -> <AREA>-...).
//   node tests/tools/specs.js        prints the coverage report (rules no build step cites, hooks not in the code yet)
// Used by tests/specs.test.js (runs in run_all.sh) and tests/tools/spec-cited.mjs (the PR check). Plain Node, no dependencies.
//
// How a spec is read (docs/ui-creative-doc-standard.md section 2):
//   a rule is DEFINED by a table row whose first cell is its ID  (| UI-A3 | ...)  or a list item starting with it in bold
//   (- **UI-N1** ...). Its text runs to the next definition or heading.
//   a rule is REFERENCED anywhere as UI-A3, or as a range UI-D1–D6 / UI-W6-W8 (same group letter).
//   "## Build steps" table: | step | #issue (shipped?) | rules |. "## Coverage" table: rules cited by an issue outside the steps.
//   a HOOK is something in backticks the code must provide: data-x="y", data-x, a --te-* token, or a *.svg picture.
'use strict';
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..', '..');            // truss-explorer-src-v58/truss-explorer
const REPO = path.resolve(APP, '..', '..');                  // repo root
const DOCS = path.join(REPO, 'docs');

// a rule ID, alone or as a range (UI-D1–D6, UI-W6-W8, UI-D1–UI-D6)
const idRe = pfx => new RegExp(`\\b(${pfx})-([A-Z]{1,2})(\\d+)(?:\\s*[–-]\\s*(?:\\1-)?([A-Z]{1,2})?(\\d+))?\\b`, 'g');

function parseSpec(text, prefix, file) {
  const lines = text.split('\n'), defs = new Map(), refs = new Map(), dupes = [];
  const defRe = new RegExp(`^\\s*(?:\\|\\s*|[-*]\\s+\\*\\*)(${prefix}-[A-Z]{1,2}\\d+)\\b`);
  let cur = null, section = '';
  const steps = [], coverage = [];
  lines.forEach((line, i) => {
    if (/^#{1,6}\s/.test(line)) { cur = null; section = line.replace(/^#+\s*/, '').toLowerCase(); }
    const d = line.match(defRe);
    if (d && !/^build steps|^coverage|^change log/.test(section)) {
      if (defs.has(d[1])) dupes.push(`${d[1]} (lines ${defs.get(d[1]).line} and ${i + 1})`);
      else defs.set(d[1], { id: d[1], line: i + 1, text: line });
      cur = defs.get(d[1]);
    } else if (cur && line.trim() && !/^\s*\|/.test(line)) cur.text += '\n' + line;   // list continuation
    else if (cur && /^\s*\|/.test(line) && !d) cur = null;
    for (const r of expandRefs(line, prefix)) { if (!refs.has(r)) refs.set(r, []); refs.get(r).push(i + 1); }
    if (/^build steps/.test(section) && /^\|/.test(line) && !/^\|\s*-/.test(line) && !/^\|\s*Step\s*\|/i.test(line)) {
      const cells = line.split('|').map(c => c.trim()).filter((c, k, a) => k > 0 && k < a.length - 1);
      const issue = (cells[1] || '').match(/#(\d+)/);
      steps.push({ step: cells[0], issue: issue ? +issue[1] : null, shipped: /shipped/i.test(cells[1] || ''), rules: expandRefs(cells[2] || '', prefix), line: i + 1 });
    }
    if (/^coverage/.test(section) && /^\|/.test(line) && !/^\|\s*-/.test(line) && !/^\|\s*Rules\s*\|/i.test(line)) {
      const cells = line.split('|').map(c => c.trim()).filter((c, k, a) => k > 0 && k < a.length - 1);
      coverage.push({ rules: expandRefs(cells[0] || '', prefix), issues: ((cells[1] || '').match(/#\d+/g) || []), line: i + 1 });
    }
  });
  for (const r of defs.values()) r.hooks = hooksIn(r.text);
  return { file, prefix, defs, refs, dupes, steps, coverage };
}

function expandRefs(s, prefix) {
  const out = [];
  for (const m of s.matchAll(idRe(prefix))) {
    const [, p, g, a, g2, b] = m;
    if (b === undefined) { out.push(`${p}-${g}${a}`); continue; }
    if (g2 && g2 !== g) { out.push(`${p}-${g}${a}`, `${p}-${g2}${b}`); continue; }   // UI-A1–W3: just the two ends
    for (let n = +a; n <= +b && n - +a < 100; n++) out.push(`${p}-${g}${n}`);
  }
  return out;
}

// what the code must provide, from the backticked parts of a rule's text
function hooksIn(text) {
  const hooks = [];
  for (const m of text.matchAll(/`([^`]+)`/g)) {
    const t = m[1].trim();
    let h;
    if ((h = t.match(/^(data-[a-z][a-z0-9-]*)="([^"<>]+?)(?:\s*…)?"$/))) {
      const vals = h[2].split(/\s+/).filter(v => /^[a-z0-9][a-z0-9_-]*$/i.test(v) && v !== 'key');
      if (vals.length && !/<|\.\.\./.test(h[2])) vals.forEach(v => hooks.push({ kind: 'attr', name: h[1], value: v, label: `${h[1]}="${v}"` }));
      else hooks.push({ kind: 'attr', name: h[1], label: h[1] });
    } else if ((h = t.match(/^(data-[a-z][a-z0-9-]*)$/))) hooks.push({ kind: 'attr', name: h[1], label: h[1] });
    else if (/^--te-[a-z0-9-]+$/.test(t)) hooks.push({ kind: 'token', name: t, label: t });
    else if (/^[a-z0-9][a-z0-9_-]*\.svg$/.test(t)) hooks.push({ kind: 'picture', name: t, label: t });
  }
  const seen = new Set(); return hooks.filter(h => !seen.has(h.label) && seen.add(h.label));
}

function loadSpecs(docs = DOCS) {
  if (!fs.existsSync(docs)) return [];
  return fs.readdirSync(docs).filter(f => /^[a-z]+-spec\.md$/.test(f)).sort().map(f => {
    const prefix = f.replace(/-spec\.md$/, '').toUpperCase();
    return parseSpec(fs.readFileSync(path.join(docs, f), 'utf8'), prefix, 'docs/' + f);
  });
}

// the text a hook has to be found in: the page source, the shell, the app parts and the theme folder
function codeText(app = APP) {
  const files = [];
  const walk = d => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|css|html|json|svg)$/.test(e.name)) files.push(p); } };
  walk(path.join(app, 'src')); walk(path.join(app, 'themes'));
  return { text: files.map(f => fs.readFileSync(f, 'utf8')).join('\n'), names: new Set(files.map(f => path.basename(f))) };
}
function hookPresent(h, code) {
  if (h.kind === 'picture') return code.names.has(h.name) || code.text.includes(h.name);
  if (h.kind === 'token') return code.text.includes(h.name);
  const camel = h.name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());    // data-in-x -> dataset.inX
  const named = code.text.includes(h.name) || new RegExp(`dataset\\.${camel}\\b`).test(code.text);
  if (!h.value) return named;
  return named && new RegExp(`["'\\s]${h.value.replace(/[-]/g, '\\-')}["'\\s]`).test(code.text);
}

// the report: rules no build step or coverage row cites; hooks of shipped steps (must be there) and of later steps (pending)
function report(specs = loadSpecs(), code = codeText()) {
  const out = [];
  for (const s of specs) {
    const cited = new Set([...s.steps.flatMap(x => x.rules), ...s.coverage.flatMap(x => x.rules)]);
    const shippedRules = new Set(s.steps.filter(x => x.shipped).flatMap(x => x.rules));
    const uncited = [...s.defs.keys()].filter(id => !cited.has(id));
    const missing = [], pending = [];
    for (const r of s.defs.values()) for (const h of r.hooks) if (!hookPresent(h, code)) (shippedRules.has(r.id) ? missing : pending).push(`${r.id}: ${h.label}`);
    const undefinedRefs = [...s.refs.keys()].filter(id => !s.defs.has(id)).map(id => `${id} (line ${s.refs.get(id).join(', ')})`);
    out.push({ file: s.file, prefix: s.prefix, rules: s.defs.size, dupes: s.dupes, undefinedRefs, uncited, missing, pending, steps: s.steps.length, shipped: [...shippedRules] });
  }
  return out;
}

module.exports = { parseSpec, expandRefs, hooksIn, loadSpecs, codeText, hookPresent, report, APP, REPO, DOCS };

if (require.main === module) {
  for (const r of report()) {
    console.log(`${r.file}: ${r.rules} rules, ${r.steps} build steps (${r.shipped.length} rules in shipped steps)`);
    console.log(`  duplicate IDs: ${r.dupes.length ? r.dupes.join('; ') : 'none'}`);
    console.log(`  references to rules that don't exist: ${r.undefinedRefs.length ? r.undefinedRefs.join('; ') : 'none'}`);
    console.log(`  rules no build step or coverage row cites (${r.uncited.length}): ${r.uncited.join(', ') || 'none'}`);
    console.log(`  hooks of shipped steps missing from the code (${r.missing.length}): ${r.missing.join('; ') || 'none'}`);
    console.log(`  hooks of later steps not in the code yet (${r.pending.length}): ${r.pending.join('; ') || 'none'}`);
  }
}
