# Tests

    bash tests/run_all.sh            # build + every check (about 6 minutes)
    bash tests/run_all.sh --slow     # also t71: a huge space, pilot and time-limited run
    bash tests/run_all.sh --published saved-live-page.html   # also check the build against the live page

run_all.sh builds index.html first, twice, and checks both builds are byte-identical; on balsaPixel-1.0 the page isn't committed. To run one browser test on its own, run `python3 build.py` first. New `tests/*.test.js` and `tests/ui/*.mjs` files are picked up without editing run_all.sh.

You need Node 22 and Python 3.12 (the versions CI uses). From the app folder: `npm ci --ignore-scripts` (the pinned Playwright and axe-core; no install scripts needed), `npx playwright install chromium`, and `pip install --require-hashes -r tests/requirements.txt`. Run the suite the way CI does, `CI=1 bash tests/run_all.sh`, after rebasing on the branch you're targeting, so a green local run means a green CI run.

**tests/a11y/a11y.mjs** is QA's keyboard and screen-reader script (#68, #218), which the balsaPixel step issues name in their acceptance checks. Run it by hand with `node tests/a11y/a11y.mjs` after `python3 build.py`. It isn't in run_all.sh or CI yet, because it still fails (6 of 28 on 647631e: #184, #241, #242, #68). When it passes, move it to tests/ui/ and run_all.sh runs it by itself.

| File | What it checks |
|---|---|
| solver.test.js | 2D audit on 39 designs (Pratt/Howe/X with 2–6 panels, Warren, curved chords, one support, feet, every bridge file): joint equilibrium, ΣRy = load, the table never pulls, friction slips reported, Euler/crushing/tension formulas, capacity and wood bookkeeping, mirror symmetry. 3D: balance, ΣRz = design load, ties-only frames reported unstable, X bracing gives equal front/back forces. |
| regressions.test.js | The v58 diagnostics t29 (3D bracing), tfeet (face feet, edge bearing, friction), t46/t47 (lift-off), t61 (no member through the table), now as checks. Their v58 numbers are in golden.json. If a ticket changes results on purpose, run `node tests/regressions.test.js --update` and name the ticket in the commit. |
| formats.test.js | File formats (#149, spec in docs/formats.md): every older version of the bridge, sweep and material files opens through src/formats.js and upgrades to the current one (fixtures in tests/formats/fixtures/, plus Partner_test and the repo's v1 sample sweep); refused files say why; cleaning keeps markup and prototype keys out; files in tests/private/ are checked too. `node tests/formats/make-fixtures.mjs` re-makes the current-version fixtures from the built page; run it when the file version goes up and keep the old fixtures. |
| names.test.js | Generated default names (#27), "<Word> <Type> <code>" e.g. "Maple Pratt k3f9": the word list (unique, letters only), the bridge type, the 4-character time code (UTC minutes since 2026-01-01, written in digits and consonants only so it can never spell a word), never the same word twice in a row, plain-text file-safe names. ui/smoke.mjs checks a first visit and a preset get one, and that a reload keeps it. |
| specs.test.js | Spec first (#253, docs/spec-checks.md): every docs/*-spec.md is well formed (no rule ID defined twice, no reference to a missing rule, every build step has an issue and rules), and every step marked (shipped) has its hooks (data-..., --te-..., *.svg) in src/ or themes/. Rules no step cites and hooks not built yet are reported, not failed: `node tests/tools/specs.js`. |
| spec-cited.test.js | The spec-cited PR check (tests/tools/spec-cited.mjs, .github/workflows/spec-cited.yml): which changed files need a citation, which descriptions satisfy it, and that the description is only matched as text. |
| cmp.py | Runs the course's own solver (sections 2–6 of TrussFEA_Bridge_SE310.py, unchanged) on each design's .py export and compares member forces. Pass = maxdF 0.000 N. |
| ui/smoke.mjs | Clean load, opening bridge files through the real file picker in 2D and 3D, the starter sweep, Large search hand-off, the storage key, phone width, and the charset. |
| ui/saving.mjs | Every save (bridge, sweep, .py, CSV, LP data, build documents) in the Inputs, Both, Bridge and Analysis views and every full-screen mode: the name pop-up is on top and a file downloads. With claude.ai simulated: a failed download request does not stick, a refusal says "cancelled", and a save that may have failed offers Copy and Try again. |
| ui/regressions.mjs | The v51–v58 browser tests t66, t67, t69, t70, t72, t74, t75 (+ t71 with --slow), now as checks. |

KNOWN lines have an open ticket (TE-052, TE-083, TE-084). They're reported but don't fail the run.

**tests/reference/TrussFEA_Bridge_SE310.py** is the course's own solver (Professor Dong cleared it for this MIT repo, #147), so cmp.py runs everywhere, CI included. It stays a reference check, not a limit on future physics. **tests/private/ is git-ignored** (rule 8): Brian's own .bridge.json files go there. tests/Partner_test.bridge.json is the one shared example.

History: the v58 tests were print-only and needed files that were never kept (core_v21_backup.js, core3d_v24_backup.js, a js_out.json generator). Their original versions are in the first commit. t44, t53 and t56 weren't in the v58 source (TE-026).
