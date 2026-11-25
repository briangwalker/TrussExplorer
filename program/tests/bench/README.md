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

## Runs

### 2026-11-24: alpha.4 against the balsaPixel-1.0 tip (RMA-14, TE-B-538)

- **alpha.4:** tag `v1.0.0-alpha.4` = `5091577`. **Tip:** balsaPixel-1.0 at `922d4dd` (after #475 and #483).
- Same cloud machine (4 cores), Node v22.23.5, 3 runs each, alternating (alpha.4, tip, alpha.4, tip ...), 21:09 UTC.
- `solver.bench.js` and `tests/lib.js` are the same file on both commits, and the case list, joints and members match row for row.
- "2D range" is the fastest and slowest of the 35 case medians; "2D middle" is the median of those 35.

| run | commit | 2D range (ms) | 2D middle (ms) | 3D default (ms) | sweep (designs/s) |
|---|---|---|---|---|---|
| 1 | alpha.4 `5091577` | 0.032-0.588 | 0.149 | 1.976 | 5757 |
| 1 | tip `922d4dd` | 0.031-0.390 | 0.103 | 1.279 | 6081 |
| 2 | alpha.4 `5091577` | 0.031-0.409 | 0.099 | 1.285 | 6074 |
| 2 | tip `922d4dd` | 0.032-0.432 | 0.107 | 1.363 | 5801 |
| 3 | alpha.4 `5091577` | 0.031-0.454 | 0.099 | 1.286 | 6572 |
| 3 | tip `922d4dd` | 0.031-0.381 | 0.104 | 1.345 | 5978 |

**Median of the 3 runs (spread):** alpha.4: 2D middle 0.099 ms (0.099-0.149), 3D 1.286 ms (1.285-1.976), sweep 6074/s (5757-6572). Tip: 2D middle 0.104 ms (0.103-0.107), 3D 1.345 ms (1.279-1.363), sweep 5978/s (5801-6081).

**Result:** the tip is within noise of alpha.4: sweep 1.6% slower, 3D 4.6% slower, 2D middle 5% slower, each well inside the other side's spread and under the 15% line. All 2,000 sweep designs are stable on both. No bisect needed. alpha.4's first run was the slowest of all six (a cold machine), so its spread is wider.

RedMangoArch
