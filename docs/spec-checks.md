# Spec checks: catching drift between the specs and the build

*Architecture Lead, 2026-10-28. Asked for by Brian after the communication-gap audit (#253); goes with "Spec first" (rulebook rule 3) and the [creative documentation standard](ui-creative-doc-standard.md).*

#253 found one pattern behind every gap: **a rule was written down in one place, and nothing made the code or the pull request point back to it.** These two checks make that drift show up by itself.

| Check | Where | When it runs | Fails when | Blocks a merge? |
|---|---|---|---|---|
| **1. Spec cited** | `.github/workflows/spec-cited.yml` → `tests/tools/spec-cited.mjs` | every PR: opened, edited, new commits | the PR changes the screen or a file format, and its description names no spec rule (or names one that doesn't exist) | **No.** It isn't a required check, so a red mark is a reminder. Making it required is Brian's call (A4). |
| **2. Specs ↔ code** | `tests/specs.test.js` (in `run_all.sh`, so in the required `run-all` check) | every test run | a spec defines a rule ID twice, refers to a rule that doesn't exist, or a build step marked **(shipped)** names a hook that isn't in the code | **Yes**, like any failing test. It only fails on real errors, never on work that's still planned. |

Both read the specs with one small reader, `tests/tools/specs.js` (plain Node, no dependencies).

## 1. Spec cited (the PR check)

A PR **needs a citation** if it changes any of these (paths inside `program/`):

- **screen:** `src/shell.js`, `src/shell.css`, `src/ui.html`, `src/app/20-inputs.js`, `30-drawing.js`, `70-charts.js`, `80-view3d.js`, `90-controls.js`, anything in `themes/`;
- **file format:** `src/formats.js`, `docs/formats.md`.

The description satisfies it with any of:

- the rule IDs it meets, which must exist in `docs/*-spec.md`, e.g. `Spec rules met: UI-A3, UI-W5, ART-M2`;
- for a format change, a mention of `docs/formats.md` (best with the section);
- `Spec: none - <why>`, with at least three words of why, e.g. `Spec: none - internal refactor, nothing on screen changes`.

A rule ID that isn't in any spec (a typo, or a renumbered rule) turns it red even if other IDs are right. Board rows (`TE-B-…`) and findings (`SEC-…`) aren't mistaken for rules. Editing the description re-runs the check, so the fix needs no new commit. The result is in the run's summary.

**Security:** the description is untrusted text. It reaches the script only through an environment variable and is only matched against patterns, never run. The job has read-only permissions.

Locally: `PR_BODY="Spec rules met: UI-A3" node tests/tools/spec-cited.mjs program/src/shell.js`

## 2. Specs ↔ code (`tests/specs.test.js`)

The reader treats every `docs/<area>-spec.md` as a spec with rules `<AREA>-…`: `ui-spec.md` → `UI-…`, and `art-spec.md` → `ART-…` once Graphics adds it. Nothing needs registering. It reads the spec the way the creative documentation standard writes it:

- **A rule is defined** by a table row whose first cell is its ID (`| UI-A3 | …`) or a list item starting with it in bold (`- **UI-N1** …`). Its text runs to the next rule or heading.
- **A reference** is any `UI-A3`, or a range such as `UI-D1–D6` or `UI-W6-W8` within one group.
- **The build-step table** ("## Build steps …"): one row per step, with its issue and the rules it must meet. `(shipped)` after the issue marks a step that's built.
- **The coverage table** ("## Coverage"): rules built by an issue outside the steps.
- **A hook** is something in backticks in a rule's text that the code must provide: an attribute (`data-part="tray"`, `data-in`), a colour token (`--te-mem-hi`) or a picture (`books.svg`). It's looked for in `src/` (including `dataset.part` for `data-part`) and `themes/`.

**It fails** (and so does `run-all`) when:

1. a rule ID is defined twice (the standard: never reuse a number);
2. anything refers to a rule that doesn't exist, including the build-step table;
3. a build step has no issue or no rules;
4. **a step marked (shipped) relies on a hook that isn't in the code.** That's the drift #253 is about: the spec says it's built, but the code doesn't have it.

**It reports, without failing:** rules that no build step or coverage row cites (the gap rule), and the hooks of later steps that aren't built yet. These are planned work, not errors. To see the full report:

    node tests/tools/specs.js

On balsaPixel-1.0 today (`docs/ui-spec.md` 1.1): 96 rules, 14 steps, no errors. 8 rules aren't cited by any step or coverage row (UI-A1, A2, A9, A17, W4, S1, N4, N5), and 10 hooks belong to later steps.

## Who does what

- **Spec owners** (UI, Graphics): when a step ships, mark it `(shipped)` in your build-step table. From then on its hooks are checked on every run. Keep the coverage table current; the report shows what's missing.
- **Builders** (Dev Lead, Architecture Lead, RedMangoArch): put the rule IDs in the PR description. The PR template (Dev Lead, board TE-B-075) gives them a line.
- **Project Manager:** the all-hands can paste `node tests/tools/specs.js` for the coverage list (#253's standing fix).
- **Architecture Lead:** owns these files (build and test structure). Change the reader if the spec format changes.
