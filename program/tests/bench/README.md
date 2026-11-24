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

- **alpha.4:** tag `v1.0.0-alpha.4`, commit `5091577` (509157717f18).
- **Tip:** `balsaPixel-1.0` at `922d4dd` (922d4dde6800), the merge of #483.
- **Machine:** one cloud container, Node v22.23.5, nothing else running. Three runs of each, alternating alpha.4, tip, alpha.4, tip, alpha.4, tip, between 21:09:56 and 21:10:01 UTC.
- **The solver code is the same in both.** `program/src/core.js`, `program/src/core3d.js`, `program/tests/lib.js` and this bench are byte-identical between the two commits (same git blobs). Everything that changed since alpha.4 is page code the bench doesn't load. So any gap below is this machine's noise, not a change.

"2D range" is the fastest and slowest per-case median in that run; "2D mid" is the median of the 35 case medians. Times are in ms; the sweep is 2,000 designs, and all 2,000 were stable in every run.

| Run | Commit | 2D range | 2D mid | 3D median | Sweep designs/s |
|---|---|---|---|---|---|
| 1 | alpha.4 | 0.042-0.501 | 0.154 | 1.842 | 4,197 |
| 1 | tip | 0.038-0.483 | 0.145 | 1.733 | 4,952 |
| 2 | alpha.4 | 0.037-0.686 | 0.169 | 3.100 | 4,672 |
| 2 | tip | 0.057-0.511 | 0.221 | 2.714 | 3,762 |
| 3 | alpha.4 | 0.040-0.505 | 0.153 | 1.885 | 4,248 |
| 3 | tip | 0.038-0.484 | 0.129 | 2.576 | 4,354 |

Median of the three runs, with the spread (lowest to highest):

| Number | alpha.4 | tip | Tip vs alpha.4 |
|---|---|---|---|
| 2D mid (ms) | 0.154 (0.153-0.169) | 0.145 (0.129-0.221) | 6% faster |
| 3D median (ms) | 1.885 (1.842-3.100) | 2.576 (1.733-2.714) | 37% slower |
| Sweep (designs/s) | 4,248 (4,197-4,672) | 4,354 (3,762-4,952) | 2.5% faster |

**Reading it.** The sweep loop and the 2D numbers are within noise. The 3D median is 37% slower on the tip, which is over the 15% line, but the spreads overlap: the fastest 3D run of all three is the tip's (1.733), and alpha.4's own runs go from 1.842 to 3.100. With byte-identical solver code that can only be noise from this shared machine, so no bisect was run. A run on a quiet machine of your own would settle it.
