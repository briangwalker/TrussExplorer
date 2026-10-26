# Tests

    bash tests/run_all.sh            # build + every check (about 6 minutes)
    bash tests/run_all.sh --slow     # also t71: a huge space, pilot and time-limited run
    bash tests/run_all.sh --published saved-live-page.html   # also check the build against the live page

Needs Node 18+, Python 3 with numpy, pandas and matplotlib, and Playwright with Chromium (`npm i playwright && npx playwright install chromium`).

| File | What it checks |
|---|---|
| solver.test.js | 2D audit on 39 designs (Pratt/Howe/X with 2–6 panels, Warren, curved chords, one support, feet, every bridge file): joint equilibrium, ΣRy = load, the table never pulls, friction slips reported, Euler/crushing/tension formulas, capacity and wood bookkeeping, mirror symmetry. 3D: balance, ΣRz = design load, ties-only frames reported unstable, X bracing gives equal front/back forces. |
| regressions.test.js | The v58 diagnostics t29 (3D bracing), tfeet (face feet, edge bearing, friction), t46/t47 (lift-off), t61 (no member through the table), now as checks. Their v58 numbers are in golden.json. If a ticket changes results on purpose, run `node tests/regressions.test.js --update` and name the ticket in the commit. |
| cmp.py | Runs the course's own solver (sections 2–6 of TrussFEA_Bridge_SE310.py, unchanged) on each design's .py export and compares member forces. Pass = maxdF 0.000 N. |
| ui/smoke.mjs | Clean load, opening bridge files through the real file picker in 2D and 3D, the starter sweep, Large search hand-off, the storage key, phone width, and the charset. |
| ui/regressions.mjs | The v51–v58 browser tests t66, t67, t69, t70, t72, t74, t75 (+ t71 with --slow), now as checks. |

KNOWN lines have an open ticket (TE-052, TE-083, TE-084). They're reported but don't fail the run.

**tests/private/ is git-ignored** (rule 8). Put the course script TrussFEA_Bridge_SE310.py and any of Brian's own .bridge.json files there. Without the script, cmp.py says SKIP. tests/Partner_test.bridge.json is the one shared example.

History: the v58 tests were print-only and needed files that were never kept (core_v21_backup.js, core3d_v24_backup.js, a js_out.json generator). Their original versions are in the first commit. t44, t53 and t56 weren't in the v58 source (TE-026).
