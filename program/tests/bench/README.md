# Solver benchmark (`tests/bench/`)

Timing for the 2D and 3D solvers, so a speed-up (#35) can be measured against a fixed starting point. Step 0 of #35: it measures and changes nothing.

## Run it

From the repo root:

    node program/tests/bench/solver.bench.js

Plain Node 22, no dependencies, no build needed. It finishes in a few seconds (the limit is 60 s).

**It isn't part of `run_all.sh`.** Timing depends on the machine and on what else is running, so it can't pass or fail. Run it by hand before and after a solver change, on the same machine, and compare.

## What the numbers mean

1. **2D cases.** Every built-in case from `tests/lib.js` `cases()` (Pratt, Howe and X patterns at 2-6 panels and two heights, plus Warren, parabola bottom, arc top, one support and feet). The saved bridges (`saved:…`) are skipped, so the numbers don't depend on files in `tests/private/`. Each row times `C.buildTruss` + `C.analyze`: 3 warm-up runs, then 20 timed runs, and the **median** in milliseconds. `joints` and `members` give the size of the model.
2. **3D.** The default design through `T3.build3D` (60 mm wide, no tilt, bottom ties, the same options as `tests/solver.test.js`) + `T3.analyze3D`, timed the same way.
3. **Sweep-like loop.** 2,000 2D designs made from the defaults, with height 20-100 mm and 2-8 panels picked by a fixed-seed generator (seed 310: the same designs on every run). It reports **designs per second**, 2D only, close to what a sweep spends per design in the solver.

All cases get one untimed pass first, so the first rows aren't slowed by the JavaScript engine warming up.

## Comparing runs

The last line starts with `BENCH ` and is JSON: Node version, date, every median, and the sweep's designs per second. Keep that line from a run before a change and one after, on the same machine:

    node program/tests/bench/solver.bench.js | grep '^BENCH ' > before.txt

Differences under about 10% are usually noise; run it a few times if it matters.
