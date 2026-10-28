# Contributing to Truss Explorer

Thanks for helping. This page covers how to pick up an issue, make a change, test it, and get it merged.

## How the project runs

- **Issues are the to-do list.** Every change starts as an issue: https://github.com/briangwalker/TrussExplorer/issues
- **Labels say what an issue is and who acts next:**
  - type: `bug` `feature` `design` `ui` `math` `physics` `docs` `infra`
  - priority: `P1` now, `P2` soon, `P3` someday
  - status: no label = new, then `status: ready`, `status: in progress`, `status: review`; `status: blocked` means it's waiting on something
  - role: `role: dev-lead`, `role: ui`, `role: physics` and so on name who acts next
- **Good places to start:** `good first issue` and `help wanted`.
- **Dev Lead reviews and merges every pull request** and is the only one who publishes the live app. `main` only changes through a reviewed pull request.

## 1. Claim an issue

Comment on the issue, for example "I'll take this". Wait for a reply before starting, so two people don't do the same work. If an issue isn't `status: ready` yet, ask in a comment first: it may still be missing details or an acceptance check.

Have an idea or found a bug that isn't listed? Open an issue first with **Details**, an **Acceptance check** (how we'll know it works) and **Notes**. Keep it to one testable change.

## 2. Make a branch

**Pick the line first.** The project has two lines of code (rulebook rule 4h):

- **Fixes to the live app** branch from `main` and go back into `main`. The live page is built only from `main`.
- **New interface work** (balsaPixel: the window layout, themes and the rest of the UI overhaul) branches from `balsaPixel-1.0` and goes back into `balsaPixel-1.0`. It never goes into `main`.

If you're not sure which line a change belongs to, ask on its issue. Then start the branch name with the prefix for the area you're changing:

| Prefix | Area |
|---|---|
| `dev` | code, tests, builds |
| `art` | graphics: icons, colours, drawings, build-document sheets |
| `ui` | layout and interaction |
| `math` | numerical methods, sampling, optimisation |
| `phys` | the structural model: materials, buckling, supports |
| `docs` | documentation |
| `admin` | issue queue and project rules |
| `hist` | design history |
| `arch` | code structure, build, file formats, performance |
| `qa` | test cases, accessibility, chaos testing |
| `sec` | security reviews |

Use the same prefix in commit messages and mention the issue number:

    git checkout main && git pull        # or balsaPixel-1.0 for new interface work
    git checkout -b ui/scale-bar-toggle
    ...
    git commit -m "ui: show the scale bar only when displacement is on (#32)"

## 3. Make the change

**Spec first** (rulebook rule 3). Before you build, read the spec for the area you're changing, and name the rules your change meets:

| Area | Spec | Owner |
|---|---|---|
| Layout and interaction | `docs/ui-spec.md` (rules `UI-…`), on `balsaPixel-1.0` | UI Designer |
| Look, colour, motion, themes | `docs/art-spec.md` (rules `ART-…`), on `balsaPixel-1.0` | Graphics Designer |
| Files the app saves and opens | `docs/formats.md` | Architecture Lead |
| Solver, sampling, statistics | `docs/math/` and the spec named on the issue | Math Consultant |
| The structural model | the spec named on the issue | Physics Consultant |

If the area has no spec yet, ask its owner on the issue before you build. A decision isn't done until it's in the repo spec and an issue cites it.

The app lives in `truss-explorer-src-v58/truss-explorer/`:

- `src/` holds the source: `core.js` (2D solver), `core3d.js` (3D), `export.js` and `template.js` (.py export), `builddoc.js` (build documents), `formats.js` (every file format and the one way files come in; spec in `docs/formats.md`), `ui.html` and `app/` (the interface: on `balsaPixel-1.0`, `app.js` is cut into parts `src/app/10-state.js` … `99-door.js`, joined in name order by `build.py`; see `src/app/README.md` for the parts and their owners).
- **Adding a module:** put `src/yourmodule.js` in, and `build.py` adds it to the page by itself (alphabetically, before `app.js`), with no list to edit. It must stand alone: define one global (like `TrussFormats`) and run nothing at load that needs another module. Only modules whose position matters have their own `<script>/*NAME*/</script>` line in `ui.html`.
- `index.html` is **built** from `src/`. Never edit it by hand. On `balsaPixel-1.0` it is **not committed** (it's in `.gitignore`): run `python3 build.py` to make it, and don't add it to your commit. On `main` (v61) it is still committed, so a change there commits the rebuilt `index.html`.
- **Merging `main` forward into `balsaPixel-1.0`:** git stops with a modify/delete conflict on `index.html` every time. Keep it deleted: `git rm truss-explorer-src-v58/truss-explorer/index.html`, then finish the merge.
- **A `main` fix to `app.js`, merged forward:** `main` still has the unsplit `src/app.js`, so git reports a modify/delete conflict on it. Port the fix by hand into the matching part in `src/app/` (find it with the section comment above the changed lines), keep `src/app.js` deleted (`git rm truss-explorer-src-v58/truss-explorer/src/app.js`), and run `bash tests/run_all.sh` before finishing the merge.

A few rules protect existing work:

- **The 2D solver must keep matching the course's TrussFEA script** (member forces equal to 0.000 N). New physics goes on top of it as an option, never by changing the baseline.
- **Never rename the browser storage keys** (`se310-truss-v5` and the IndexedDB stores). People's saved bridges live there; convert old data instead.
- **One issue per pull request**, kept as small as it can be.
- **Keep personal details out of the repo:** no names, grades or emails, and no saved bridges or sweeps from your own browser.

## 4. Test

From the repo root:

    bash truss-explorer-src-v58/truss-explorer/tests/run_all.sh

This builds the page, then runs the solver checks, a comparison with the course script, and the browser tests. It takes about 6 minutes and ends with `ALL GREEN` when everything passes. Add `--slow` for the very large search tests.

You need Node 22 and Python 3.12 (the versions CI uses). From `truss-explorer-src-v58/truss-explorer/`: `npm ci --ignore-scripts` (the pinned Playwright and axe-core; no install scripts needed), `npx playwright install chromium`, and `pip install -r tests/requirements.txt`. Run the suite the way CI does, `CI=1 bash tests/run_all.sh`, after rebasing on the branch you're targeting, so a green local run means a green CI run.

- **The course script is in `tests/reference/`** (`TrussFEA_Bridge_SE310.py`, by Professor Dong, cleared for this repo), so the comparison runs for everyone and in CI. Don't edit it: it's the reference the 2D solver must match.
- **Lines marked `KNOWN`** are open issues. They're reported but don't fail the run.
- **If the regression test says results "changed since v58"**, your change moved some solver numbers. If that's intended, re-record them with `node truss-explorer-src-v58/truss-explorer/tests/regressions.test.js --update` and say why in the pull request. If it isn't, you've found a bug.
- **New behaviour should come with a test:** a Node test for solver or maths changes, a browser check in `tests/ui/` for interface changes. `run_all.sh` runs every `tests/*.test.js` and every `tests/ui/*.mjs` by itself, so a new test file needs no other edit.
- **Name the spec rules your PR follows** (Spec first, rulebook rule 3). If it changes the screen (`shell.*`, `ui.html`, the drawing, inputs, charts, 3D or controls parts of `src/app/`, `themes/`) or a file format, say which rules it meets in the description, e.g. `Spec rules met: UI-A3, UI-W5`, or `docs/formats.md (theme section)`, or `Spec: none - <why>`. The **spec-cited** check reminds you (it doesn't block). `tests/specs.test.js` checks the specs themselves and fails if a step marked shipped is missing a hook in the code. Details: `docs/spec-checks.md`.

## 5. Open a pull request

Open it **into the line you branched from**: `main` for fixes, `balsaPixel-1.0` for new interface work. The pull request template asks for:

- `Closes #n` so the issue closes when it merges
- what changed and why, in a few lines
- the spec rules it meets on a `Spec rules met:` line (`UI-…`, `ART-…`, `docs/formats.md`, a Math or Physics spec); on `balsaPixel-1.0` the `spec-cited` check reads it (`docs/spec-checks.md`)
- the reviews it asks for: UI or Graphics for anything on screen, Math or Physics when results can change, White Hat when it hits a trigger R1–R8 in `docs/security-checklist.md` (it reads files, writes exports, touches themes, CI, the build or dependencies, and more)
- the result lines from your own `run_all.sh` run (the `tests`, `pass` and `checks passed` counts), so a reviewer can check them
- screenshots at 1440 × 900 and at 390 px wide for anything visible

Dev Lead reviews it, runs the tests, and either merges it or asks for changes. Merged changes reach the live app in the next release.

## Questions

Ask on the issue you're working on, or open a new issue labelled `question`.
