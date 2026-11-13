# White Hat Security Review Checklist (security standard 1.1)

Owner: **White Hat**. Version 1.1, 2026-11-13.
Home: `docs/security-checklist.md` in the repo (a lead commits White Hat's changes; TE-B-076).
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
| R9 | It adds or changes a way for **outside people to send us something**: a form link, a bug report, an upload, a shared file the team opens | strangers' data reaches the team |

A PR that meets R3-R9 carries the label `security: boundary`. Under auto-merge Brian's approval is the last gate, so he approves a labelled PR only after a "White Hat OK at <commit>" comment.

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
- **WH-I8** Limits are set **per file kind**, not one number for every door. A small kind gets its own small cap, checked before reading when the name says what it is, and again after parsing by what the file is (lesson of SEC-005: a bridge file has a 2 MB cap, sweeps 512 MB).
- **WH-I9** A value from a file that breaks the input limits is kept, marked and listed, and gives no PASS. It is never silently clamped and never trusted (UI-I10, the one limits table).

### Outputs: files people open or run (R4)
- **WH-O1** Names and other user text go into a .py only through the one escaping helper: single line, an allowlist of characters, escaped for where it lands (comment, string, f-string).
- **WH-O2** CSV cells go through the app's one `csvSafe()`: control characters (tab, CR, LF) become spaces first, then a cell starting with `=`, `+`, `-` or `@` that isn't a number gets a leading `'`, so it never becomes a formula. A new CSV writer uses that function, not a copy that can drift.
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
- **WH-T5** Packed theme CSS (`themepack.py`) has no `@import`, no `url()` outside the theme folder, and after packing no `http:`, `https:` or `//` outside a data: URI and no backslash escape.
- **WH-T6** A theme FILE (later, #265) may set only the shell's own token names, each value from a per-token allowlist (a colour pattern, a number with a unit, a font from a fixed list); anything else is dropped, not cleaned. It can't use a built-in theme's id and can't set a meaning colour (ok, bad, comp, tens, zero). It obeys the import door's size limits.

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

### Website and deploy (R8)
- **WH-W1** The deploy runs only on a `v*` tag, in the `production` environment, with Brian as its only required reviewer. Brian approves a deploy only for a release the Dev Lead announced on the board.
- **WH-W2** Upload is SFTP with a pinned host key (`StrictHostKeyChecking=yes`, known_hosts from a secret), never plain FTP. Only the built files are uploaded (`index.html`, `.htaccess`).
- **WH-W3** The Content-Security-Policy is made by `build.py` from the page's script hashes and sent as an HTTP header (no `unsafe-inline` scripts, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`). A PR never loosens it; a new outside source needs a White Hat review (WH-N1).
- **WH-W4** HTTPS only, with HSTS. The site sends `X-Content-Type-Options: nosniff`, a Referrer-Policy, and refuses framing (`frame-ancestors`). Checked on the live page after each release from a machine that can reach it.
- **WH-W5** Deploy secrets live only in the `production` environment; the repository-level secrets list is empty.
- **WH-W6** A hand upload (when GitHub is down) is compared with the CI build of the same commit before it goes up, and the two files it replaces are kept to put back.

### Forms and things people send us (R9)
- **WH-F1** A form link is one fixed full address in the code (no link shorteners), opened as a plain new-tab link with `rel="noopener noreferrer"`; nothing is posted or fetched by the page.
- **WH-F2** Pre-filled fields are named constants (`entry.<digits>`, tested), and every value goes through `encodeURIComponent`. Only values from White Hat's cleared list go in (TE-B-323): never the full user agent, time zone, location, file names, typed text or saved data.
- **WH-F3** The person sees exactly what will be sent, as text, before the form opens, and can leave names out.
- **WH-F4** Form settings: one file of at most 10 MB, image types only for screenshots, responses visible only to Brian, the upload folder not shared.
- **WH-F5** Handling a file someone sent: check its size in Drive first (over 1 MB goes to [52], unopened); open it only with the program's Open button in a fresh tab, never by double-clicking; never open a `.sweep.json` or `.tsweep` from a report; judge by content, not by name; note what was opened.

### GitHub account and merge rules (R6, R8)
- **WH-G1** `.github/CODEOWNERS` names Brian for every file, and the ruleset requires a code owner's review, so only Brian's approval counts.
- **WH-G2** The ruleset on `main` and `balsaPixel-1.0` requires a PR with 1 approval, dismisses stale approvals when the changes move, requires `run-all` with branches up to date, and blocks force pushes and deletions.
- **WH-G3** The bot account is a collaborator (Write), never an admin and never on a bypass list. An admin bypass is temporary, for a named hand-merge sitting, and removed the same day.
- **WH-G4** No password, token or recovery code is ever in a chat, the board, an issue or Drive. The bot signs in through the claude.ai GitHub connection; if a token is ever used, it is limited (no `workflow` scope) and expires within 90 days.
- **WH-G5** The bot's email mailbox has its own strong password and two-step sign-in where offered, since it can reset the bot.

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
| 2026-11-13 | 1.1: new trigger R9 and the `security: boundary` label; WH-I8, WH-I9 (per-kind limits, SEC-005; marked not clamped); WH-O2 now names the one `csvSafe()`; WH-T5, WH-T6 (theme packing and theme files); new sections WH-W1-W6 (website and deploy, #400), WH-F1-F5 (forms and things people send us, #418), WH-G1-G5 (GitHub account and merge rules, TE-B-360) |
