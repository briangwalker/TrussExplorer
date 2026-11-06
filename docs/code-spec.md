# Code standard (CODE-…)

*Architecture Lead, 2026-10-31. Version 0.1, a first draft for the team (TE-B-155a, all-hands 10-30 item 2: "code standard: NO STANDARD YET"). It writes down what the program already does and what reviews have asked for, so a builder can cite it like UI-… and ART-… rules (`Spec rules met: CODE-F4, CODE-T1`). The file is named `*-spec.md` so the spec checks (`tests/tools/specs.js`, docs/spec-checks.md) read its rules. Changes go through a PR the Architecture Lead approves (A2). A new section that changes how modules talk to each other is A3.*

## CODE-F · Files and modules

| # | Rule | Example |
|---|---|---|
| CODE-F1 | **One module, one global, standing alone.** A file in `program/src/` defines one global (`TrussFormats`, `TrussNames`, `TrussSweepStore`, `BuildDoc`…) and runs nothing at load that needs another module. It also works under Node (`module.exports`) so it can be tested without a browser. | `src/sweepstore.js` |
| CODE-F2 | **Adding a module is adding the file.** `build.py` places every other `src/*.js` by itself; no list to edit (TE-B-018). | |
| CODE-F3 | **App parts share one IIFE** (`src/app/10-…99-`), in name order, each with one owner (`src/app/README.md`). Edit another owner's part through them or the board. | |
| CODE-F4 | **Parts talk through doors, not shared variables.** Sweep results: `SweepState` (#255 B). The 2D drawing: `drawingSVG(design)` / `renderDrawing(target)` (#255 A). The shell: `window.TrussApp` (`99-door.js`). A test fails if a part reaches past a door (`tests/sweep-state.test.js`). | |
| CODE-F5 | **Data functions stay pure:** no DOM, no `S` / `tr` / `res`. They take what they need as arguments and return plain objects (`cutPlan`, `finishedParts`, `toTsweep`). Screen code calls them. | |
| CODE-F6 | **Anything from outside enters through one door:** `TrussFormats.open` (text) or `openBytes` (binary), within `TrussFormats.LIMITS`. Nothing else parses a file, storage or a URL. | docs/formats.md rule 6 |

## CODE-C · Comments

| # | Rule | Example |
|---|---|---|
| CODE-C1 | **Every file starts with what it is**, the spec or issue it follows, and what it must never do. | `// No DOM, no app state: Node tests load it directly` |
| CODE-C2 | **A function's comment says the contract, not the code:** inputs, units, what it returns, and why it exists. Don't restate the line below. | `finishedParts` in builddoc.js |
| CODE-C3 | **Cite the source of a rule** next to the code that carries it: an issue (`#298`), a spec rule (`UI-H5`, `ART-K14`) or a board row (`TE-B-187a`). A reader should find the reason in one click. | |
| CODE-C4 | **Units are always named:** in the name or the comment (mm, N, kg, MPa; angles say what they're measured from, e.g. "degrees from a square cut"). | |
| CODE-C5 | **No commented-out code and no stale TODOs.** Unfinished work is an issue, linked from a one-line comment. | |

## CODE-N · Names and calls

| # | Rule | Example |
|---|---|---|
| CODE-N1 | Functions are verbs (`openBytes`, `drawInto`); data and options are nouns (`plan`, `opts`). Booleans read as yes/no (`passes`, `edgeOK`). | |
| CODE-N2 | **Expected bad input is a result, not an exception.** Return `{ ok, errors, warnings }` with short kebab-case codes (`too-big`, `bad-value:autoName`). The screen turns codes into words, so wording changes never touch the logic. | `TrussFormats.open` |
| CODE-N3 | **Throw only for programmer errors** (a wrong argument type, an impossible state), and never let a throw cross a door into the shell. | `drawInto` refuses `#draw` |
| CODE-N4 | **Options are one object with defaults** (`fn(x, opts)`, `opts = Object.assign({…defaults}, opts)`), not long argument lists. | `renderDrawing(target, design, opts)` |

## CODE-T · Tests

| # | Rule | Example |
|---|---|---|
| CODE-T1 | **New behaviour comes with a test:** a Node test (`tests/*.test.js`) for pure modules, a browser check (`tests/ui/*.mjs`) for the screen. Both run from `run_all.sh` with no edit there. | |
| CODE-T2 | **Results don't move silently:** `cmp.py` stays at maxdF 0.000 against the course script, and `tests/golden.json` is unchanged, unless Math or Physics review the change (the 'Results:' line in the PR). | |
| CODE-T3 | **A known failure is KNOWN with an issue number**, printed and not failed. It comes off the list when fixed (the test says so). | `tests/themes.test.js` contrast |
| CODE-T4 | **Tests make their own data** (temp folders, generated fixtures). Never anyone's saved files: `tests/private/` stays git-ignored (rule 8). | |
| CODE-T5 | **Run `CI=1 bash program/tests/run_all.sh` before opening a PR** and put its counts in the PR. | |

## CODE-S · Safety

| # | Rule | Example |
|---|---|---|
| CODE-S1 | **Text from outside never becomes markup:** cleaned at the door (`cleanData`) and escaped where it's shown (`escH`). | |
| CODE-S2 | **No `eval`, `new Function`, inline `on…=` handlers or `<script src>`.** The website's CSP allows only this build's script hashes (#297). | `tests/ui/csp.mjs` |
| CODE-S3 | **Stored keys and file names never change** without an upgrade path (formats.md rules 2 and 7). | |
| CODE-S4 | **The build is deterministic:** the same source gives the same bytes (checked by `run_all.sh`). | |

## CODE-R · Pull requests

| # | Rule | Example |
|---|---|---|
| CODE-R1 | **One issue per PR.** The description has `Closes #n`, `Spec rules met:` (or `Spec: none - <why>`), a `Results:` line, the reviews it needs, and the test counts. | CONTRIBUTING section 5 |
| CODE-R2 | **Signed with the role** in commits, PRs and comments (one shared account). | |
| CODE-R3 | **A big move is its own commit** (a pure `git mv`) and is merged with a merge commit, so history follows the files. | #329 |

## Coverage

| Rule | Issue |
|---|---|
| CODE-F1–F6 | #109, #255 |
| CODE-C1–C5 | TE-B-155a |
| CODE-N1–N4 | TE-B-155a |
| CODE-T1–T5 | #147, #253 |
| CODE-S1–S4 | #125, #297 |
| CODE-R1–R3 | #253, #305 |
