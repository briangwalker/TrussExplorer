# Build guide: compact sweep files, the result check, and millions of points on screen

*Math Consultant, 2026-10-27, for Dev Lead (with White Hat for part 2 and Graphics for the colours in part 3). Every number below was measured with the reference code in [`reference/`](reference/) on v60.*

The three parts build on each other: the **file** (part 1) stores results as plain number columns, the **result check** (part 2) makes shared files trustworthy, and the **big charts** (part 3) draw straight from those columns. Build them in order; each part ships on its own.

---

## Part 1: the `.tsweep` file

Spec: [`sweep-file-format.md`](sweep-file-format.md). Reference: `reference/tsweep.js` (encode, decode, merge), tests: `node docs/math/reference/tsweep.test.js`.

**Steps**

1. **Keep results as columns inside the app, not one object per design.** Today `sweepAll` holds one object of about 750 bytes per design. Add a small `SweepStore` holding `Float32Array`s for wood, use, defl, overlap (and braceWood in 3D), `Uint8Array`s for flags and gov, and the design numbers. Keep the existing row objects only for the few hundred designs shown in tables (best results, frontier). This step also unlocks part 3.
2. **List every sweepable input in `sweep.dims`**, one value when it isn't swept, in one fixed order. `sweepDims()` already builds most of this; add the inputs it leaves out as one-value dims.
3. **Fingerprint:** canonical JSON of `{appVer, analysis, base, material}`, hashed with `crypto.subtle.digest('SHA-256')`. `sweepSig()` is the starting point. Leave out the four rule fields (FS, bookKg, deflLimit, minOverlap).
4. **Save:** `TSweep.encode(header, rows)` and download as `name.tsweep`. **Load:** `TSweep.decode(bytes)`. If `problems` isn't empty, show it and open the file read-only.
5. **Pass/fail on load:** passes = stable ∧ envOK ∧ slipOK ∧ tableOK ∧ use·k ≤ 1 ∧ defl·k ≤ limit ∧ overlap ≥ minOverlap, with k = (FS × bookKg of the rules in use) ÷ (FS × bookKg in the header). This is the same maths as today's Re-check, so the Re-check button just changes the rules and redraws.
6. **Keep reading old `.sweep.json` files** (convert on load, as `fromOldSweep` in the test does). Never remove that path, because people have saved sweeps.
7. **Merge button** ("Add a sweep to this one"): `TSweep.merge(A, B)`. Show the union grid, the rows gained, and any conflicts.

**Acceptance check:** `tsweep.test.js` passes. The sample sweep round-trips at 51× smaller with no row changed by more than 1e-6 relative. A merged pair re-checks to the same best design as one sweep run over the union grid. An old `.sweep.json` still opens.

---

## Part 2: the result check (for shared files)

**Why:** the data hash proves a file wasn't changed after saving. It can't prove the numbers were right when saved. They may come from an older solver, a bug, or be made up so a weak design looks best. White Hat's 10-27 log covers making files *safe to open* (escaping, CSP, size limits). This part covers making their *results trustworthy*. White Hat to review before it's used for a shared library.

**The check, in order**

1. **Intact?** `decode()` checks `payloadSha256`, and that `fingerprint` matches the header. If either fails, reject the file.
2. **Same solver?** `app.appVer` must equal the running app's. If not, the file can be *viewed* but not *verified* or merged into a library; label it "made with an older solver".
3. **Random spot-check:** re-solve `s` rows chosen **with the checker's own randomness** (`crypto.getRandomValues`). Never derive the choice from the file: an uploader could keep tweaking a file until the checked rows happened to be honest ones.
   - If a fraction f of rows is wrong, the chance at least one is caught is **1 − (1 − f)ˢ**.
   - s = 300 catches a file that's 1% wrong 95% of the time; s = 460 does it 99% of the time; s = 1,000 catches 0.3% wrong 95% of the time.
   - Cost: about 0.1 s for 300 rows in 2D, about 0.5–1 s in 3D.
4. **Always re-solve the designs that matter:** every row on the 3-objective frontier (wood, use, deflection), plus the best 30 passing designs. A fake only matters if it wins, and a winning fake is always caught.
5. **Compare:** wood, use, defl and overlap to a relative 1e-5; flags exactly. Any mismatch rejects the whole file and lists the rows that failed.
6. **Record:** append `{date, appVer, sampled, frontier, mismatches}` to `checks`. A library re-runs the check itself; it never trusts a `checks` entry it didn't write.

**Where it must run** is White Hat's call. Options: in each user's browser before merging (simple, but anyone can skip it), as a GitHub check on pull requests that add files to a `sweeps/` folder (free and can't be skipped), or on a server. For a growing shared dataset, the GitHub check is the natural first step.

**Acceptance check:** over 1,000 trials at s = 300, a file with 1% of rows altered is rejected 92–98% of the time (theory: 95.1%). A file with only its best design faked is rejected every time. An honest file passes 100 of 100 trials. A file from another `appVer` opens but can't be merged.

---

## Part 3: millions of designs on screen, smoothly

Reference: `reference/density.js`; benchmark: `node docs/math/reference/density.bench.js 10`.

Measured on 10 million designs, 1200 × 600 px, one CPU core:

| Step | Time |
|---|---|
| Count every design into its pixel, keep the best per pixel | 226 ms |
| Build a grid index for zoomed-in views (once per axis pair) | 595 ms |
| Find the designs in a zoomed-in view | 0.3 ms |
| Memory as columns | 90 MB (today's objects: about 7.5 GB) |

**Steps**

1. **Columns first** (part 1, step 1). Without them, 10 M designs don't fit in a browser tab.
2. **Zoomed out: draw a density picture.** For each design, find its pixel and add 1, keeping per pixel the count, the number passing and the best value plus which design it was (`densityGrid`). Paint one image with a **log colour scale**, so pixels holding 1 and 100,000 designs are both visible. Three colour modes:
   - *count* (where the designs are);
   - *share passing* (where the good region is);
   - *best in pixel*, the best capacity among the designs in that pixel. This keeps a single brilliant design visible even in the densest spot. The benchmark checks it.
   Graphics picks the colour ramps (colour-blind safe, light and dark themes).
3. **Run the counting in a Web Worker,** sending the columns once as transferable buffers. While a new count runs after a pan or zoom, **stretch the previous image** to the new view so the chart reacts instantly. Split the count across `navigator.hardwareConcurrency` workers by row range and add the grids: 4 cores bring 226 ms to about 60 ms.
4. **Zoomed in: switch to real dots.** When the grid index says fewer than about 50,000 designs are in view, draw them as dots with hover and click (open the design). The index makes the switch instant.
5. **Always on top:** the best-design line, passing designs as dots when they're few enough, the current design, and the hover highlight.
6. **While a sweep runs,** add each finished batch into the existing grid (counts only grow), so the picture fills in live.
7. **For 30+ frames per second at 10 M while dragging, use the graphics card (WebGL).** Upload the columns once as vertex buffers, draw `gl.POINTS` with additive blending into a floating-point texture (the GPU does the counting), then colour that texture with the same ramps. On ordinary laptop graphics this redraws 10 M points in a few milliseconds. Start with the worker version (steps 2–6); move to WebGL when the worker version is too slow on Brian's laptop.
8. **3D chart:** WebGL points with transparency up to a few million. Beyond that, count into a 64³ grid of 3D cells and draw each cell as a soft dot sized and coloured by count or best value, and show the 2D density picture on each face of the cube (ties into #102).

**Acceptance check:** with 10 M synthetic designs on Brian's laptop, panning and zooming responds within 1 frame (stretched image) and the sharp picture arrives within 0.3 s with workers, or 30+ frames per second with WebGL. The "best in pixel" mode shows a planted single best design. The chart switches to clickable dots below 50,000 designs in view. Memory stays under 300 MB.

---

### How the parts connect

```
run a sweep ──► SweepStore columns ──► .tsweep file ──► result check ──► shared library (later)
                      │                                                         │
                      └──────────────► density charts ◄─────────────────────────┘
```
