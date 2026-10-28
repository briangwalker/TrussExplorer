# White Hat Security Review Checklist (security standard 1.0)

Owner: **White Hat**. Version 1.0, 2026-10-28.
Home: `docs/security-review-checklist.md` in the repo, once committed. Until then: the project file "White Hat Security Review Checklist" and a dated copy in Drive [51] Test Cases.
This file is public and safe to share. It lists what is checked, never how to break anything. Real weaknesses go only in Drive [52] Security (Private) as SEC-NNN files (rulebook rule 1).

## 1. Which pull requests need a White Hat review

A PR needs a White Hat review comment **before Dev Lead merges** when any of these is true:

| # | Trigger | Why |
|---|---|---|
| R1 | It comes from someone outside the team (Project Instructions: required) | unknown author |
| R2 | It comes from a code assistant (RedMangoArch, later BluePeachDev) | automation acting as briangwalker |
| R3 | It touches the **import boundary**: `src/formats.js`, any file-open or stored-data load path, `cleanData` / `cleanRows` | everything from outside enters here |
| R4 | It touches **files people open or run**: `export.js`, `template.js`, `builddoc.js`, CSV / .py / HTML / zip output | output reaches other people's computers |
| R5 | It touches **themes or the page shell**: `themes/`, theme loading, `shell.*`, anything that styles results | a theme can change what a result says |
| R6 | It touches **CI, build or dependencies**: `.github/`, `build.py`, `tests/run_all.sh`, `package.json`, `package-lock.json`, `requirements.txt`, any new tool | runs on reviewers' machines and in CI |
| R7 | It adds **network, storage or code-loading** behaviour: requests, fonts, CDNs, new storage keys, dynamic code | changes what the page can reach |
| R8 | It touches the website deploy, hosting, secrets or (later) the database / server | public attack surface |

Other PRs don't need one. The author can still ask.

## 2. Before running a PR

- **WH-R1** Read the diff of `build.py`, `tests/`, `.github/` and any manifest or lock file *before* running anything. Running the tests runs the PR's code.
- **WH-R2** Run R1/R2 PRs only in a disposable sandbox (a cloud session or container), never on the machine that can publish. Use `npm ci --ignore-scripts`.
- **WH-R3** Check the base branch (main or balsaPixel-1.0, the right one) and that the author stayed inside its files (assistants: only the files their Task row names).

## 3. The checks

Mark each one ✓ (met), ✗ (not met) or n/a in the review comment.

### Inputs: files and stored data (R3)
- **WH-I1** Every new way in (file, drop, paste, URL, localStorage, IndexedDB) goes through `TrussFormats.open()` or `cleanData()`. There's no second door.
- **WH-I2** No text from a file or storage reaches `innerHTML`, `insertAdjacentHTML`, `document.write`, or an attribute or style string, unless it went through `escH()`. Plain text uses `textContent`.
- **WH-I3** Numbers from outside are checked as numbers and kept inside the model's limits (the same limits as the number boxes, #156) before the solver or a layout uses them.
- **WH-I4** Strings from outside are one line (control characters removed) and length-capped. Prototype keys are dropped.
- **WH-I5** Files have a size limit and sweeps a row limit, checked before the expensive work. A too-big file gets a clear message, not a frozen tab.
- **WH-I6** Unknown or newer format versions get a warning and are never trusted silently. A new field gets a type check in `check()`.
- **WH-I7** Results from a file are shown as *from the file*. Nothing marks them verified unless the app re-solved them (#174).

### Outputs: files people open or run (R4)
- **WH-O1** Names and other user text go into a .py only through the one escaping helper: single line, an allowlist of characters, escaped for where it lands (comment, string, f-string).
- **WH-O2** CSV cells that start with `=`, `+`, `-` or `@` are prefixed with `'`, so they never become formulas.
- **WH-O3** Build-document HTML escapes every user string. No script runs in a printed document.
- **WH-O4** An export test opens a file with awkward names (line breaks, quotes, braces, formula characters) and checks the output: `python -c "import ast; ast.parse(...)"` for the .py, and a parse check for the CSV.

### Network and code loading (R7)
- **WH-N1** No new outside requests (`fetch`, XHR, WebSocket, `sendBeacon`, remote images, fonts, styles or scripts) without a White Hat review and a line in the PR saying why.
- **WH-N2** No `eval`, `new Function`, string timers, dynamic `import()` or `javascript:` URLs.
- **WH-N3** Once the website has a Content-Security-Policy, the PR doesn't loosen it, and any new inline script's hash is added by the build.
- **WH-N4** Fonts and images are served by the site itself (self-hosted), not from third parties.

### Themes and the shell (R5)
- **WH-T1** Themes are built-in only. Nothing lets a user load CSS or JS. A shared theme (later) is a data file checked by `formats.js` (tokens and images), never raw CSS.
- **WH-T2** A theme can't change what a result says: verdicts, member force colours and the results card keep their meaning (C red, T blue, zero grey, fails magenta with ✕, passes green).
- **WH-T3** Build documents print with a built-in look, whatever theme is on screen.
- **WH-T4** SVG pictures in themes are built-in only (UI-T3) and contain no script or outside links.

### Saved data (R3, R7)
- **WH-S1** The storage keys never change (`se310-truss-v5`, backups, IndexedDB `cur` / `last` / `ckpt`). A new key's data is cleaned when it's read back.
- **WH-S2** A bad saved value can't stop the app from opening. It's dropped or reset, and the user is told.

### CI, build and dependencies (R6)
- **WH-C1** The workflow stays on `pull_request` (never `pull_request_target`), with `permissions: contents: read` and no secrets.
- **WH-C2** No `${{ github.event.* }}` or `${{ github.head_ref }}` inside a `run:` step. (Inside `concurrency.group` it's fine.)
- **WH-C3** Dependencies are exact versions with a lock file and integrity hashes (`npm ci`). Python packages are pinned. A new dependency needs a White Hat review and a reason.
- **WH-C4** No prebuilt binaries are committed. WebAssembly or other compiled code is built from source in CI.
- **WH-C5** Third-party GitHub Actions are pinned (by commit SHA once #250-style pinning reaches them).
- **WH-C6** The required check stays named `run-all`. The PR doesn't remove or loosen a test assertion without the test owner's OK.

### Secrets and privacy (all PRs, rulebook rule 8)
- **WH-P1** No keys, tokens, passwords or private URLs anywhere: code, tests, fixtures, docs or commit messages.
- **WH-P2** No partners' names, grades or emails, no personal details of Brian's, and no saved data of his unless he picked the file.
- **WH-P3** The PR, commits and comments say nothing exploitable. Fixes for a private finding use neutral wording.

## 4. The review comment

Post on the PR, signed:

```
White Hat review (security standard 1.0)
Triggers: R3, R6
Checked: WH-I1 ✓ WH-I2 ✓ WH-I4 ✓ WH-C1 ✓ WH-C3 ✓ ... (the rest n/a)
Result: OK to merge  |  OK with suggestions (listed)  |  SECURITY HOLD (see the board)
- White Hat
```

- **OK with suggestions:** the suggestions don't block a merge. Each one that matters becomes an issue.
- **SECURITY HOLD:** Dev Lead doesn't merge or publish until White Hat clears it or Brian overrides it. The reason goes in [52] Security (Private). The PR comment and the board row say only "security hold, see [52] SEC-NNN".
- A ✗ found after a merge becomes an issue citing the WH- number (or a SEC-NNN file, if it's exploitable).

## 5. Changes to this checklist

Only White Hat changes it, with a board row naming the changed WH- numbers.

| Date | Change |
|---|---|
| 2026-10-28 | 1.0: first version (from the 10-27/10-28 reviews of #169, #178, #248, #250 and the balsaPixel shell) |
