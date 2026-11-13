# Sweep file format `.tsweep`, version 1

*Math Consultant, 2026-10-27; updated 2026-10-28 to match the app's writer (#179, PR #274). Status: in the app. Reference code and tests: [`reference/tsweep.js`](reference/tsweep.js), [`reference/tsweep.test.js`](reference/tsweep.test.js).*

## Goals

1. **Carries its own identity:** the app version that made it, and everything about the sweep (which inputs, which values, how the designs were picked).
2. **Mergeable:** two files made with the same solver and settings combine into one exactly, even if their grids differ or were saved under different FS or book mass.
3. **Checkable:** anyone can tell whether the file was changed after saving, and whether its results are true (by re-solving a sample; see the build guide, part 2).
4. **Smaller, not smallest:** plain 32-bit numbers rather than squeezed ones, so values come back to about 7 significant digits and the file stays simple to read and write.

Tested on the repo's sample sweep (23,917 designs from a 3.8 × 10¹¹-design grid): **18.1 MB → 353 kB, about 15 bytes per design, 51× smaller**. The largest change from storage is 0.000006%. Encoding takes 72 ms; decoding and verifying take 13 ms.

## Layout

The whole file is **gzip-compressed** (browsers have `CompressionStream('gzip')` built in, so no library is needed). Inside:

```
TRUSS-EXPLORER-SWEEP 1\n          <- magic line (text)
{ ...header JSON... }   \n         <- one line of JSON, padded with spaces so the next byte is on an 8-byte boundary
[ column blocks ... ]              <- binary, each block starting on an 8-byte boundary
```

8-byte alignment lets the app load each number column straight into a `Float32Array` with no parsing, which the big charts need.

## Header (JSON)

The header uses the **shared v2 header** names from [`docs/formats.md`](../formats.md) (`release`, `solver`, `model`, `savedAt`, `bridgeCode`, `rules`), so a `.tsweep` and a `.sweep.json` from the same release describe themselves the same way.

```json
{
  "format": "truss-explorer-tsweep",
  "version": 1,
  "app": "SE 310 Truss Explorer",
  "release": "v61",
  "solver": 35,
  "model": "2D",
  "savedAt": "2026-10-27T17:07:12.000Z",
  "bridgeCode": "3a899a02",
  "name": "Shallow Pratt study",
  "sweep": {
    "dims": [ { "key": "panels", "values": [4, 5, 6] }, { "key": "height", "values": [40, 45, 50] }, { "key": "st_top", "values": [1] } ],
    "total": "27",
    "sampling": { "method": "all" }
  },
  "base": { "...": "every fixed input that is not sweepable (span, table thickness, loads list, ...)" },
  "material": { "b": 3.18, "h": 3.18, "E": 3000, "sigT": 7.5, "sigC": 4.5, "rho": 1.6e-7, "K": 1 },
  "rules": { "FS": 2, "bookKg": 2.5, "deflLimit": 2, "minOverlap": 5, "width": 60, "envelope": "outer faces" },
  "rows": 27,
  "columns": [ { "name": "wood", "type": "f32", "offset": 0, "length": 108 }, "..." ],
  "fingerprint": "sha256:…",
  "payloadSha256": "…",
  "checks": [ { "date": "2026-10-28", "solver": 35, "sampled": 300, "frontier": 41, "mismatches": 0 } ],
  "stats": { "tested": 27, "unstable": 0, "fail": { "strength": 3, "deflection": 1, "envelope": 0, "edge": 0, "slip": 0 } }
}
```

| Field | Meaning |
|---|---|
| `format`, `version` | `truss-explorer-tsweep` and the **header schema** version. The name is deliberately different from the JSON sweep's names (`se310-truss-sweep`, `truss-explorer-sweep`) so the two kinds can't be confused. |
| `release`, `solver` | The release name for people (free text, never compared), and `APP_VER`, which *is* compared and goes into the fingerprint. |
| `model` | `"2D"` or `"3D"`: the analysis the numbers came from. In the fingerprint. |
| `bridgeCode` | The short FNV-1a code printed on CSVs and build documents, for matching printouts to files. Display only: merge safety uses `fingerprint`. |
| `sweep.dims` | **Every sweepable input, in a fixed order, including the ones not swept** (one value). That is what makes merging work: a sweep that held height at 40 and one that swept 40–60 describe the same input. Last dimension changes fastest (as `candAt` does). Values are numbers, strings or small objects (choices). |
| `sweep.total` | Number of designs in the grid, as a string (exact past 2^53). |
| `sweep.sampling` | `{"method":"all"}` for a full grid; `{"method":"feistel-v1","keys":["…"],"tested":n}` for a large search (the #18 shuffle: keys plus count say exactly which designs were tried); `{"method":"merged","parts":[…]}` after a merge. `{"method":"rows","tested":n}` when the stored rows are exactly the designs tried (what the app writes, #179). |
| `base`, `material` | Everything else that changes a result, and **nothing that doesn't** (see "What goes in `base`" below): a setting that only changes the screen would give two identical sweeps different fingerprints, so they could never merge. **`material` is in solver units** (mm, N, MPa; `rho` in kg/mm³), like a bridge file, not the SI of a `.material.json`. |
| `rules` | The shared rules object. **Only `FS`, `bookKg`, `deflLimit` and `minOverlap` are rescalable**: use and deflection are stored at these reference values and rescale exactly when they change (k = FS′·m′ ⁄ FS·m), and the overlap check re-runs on the stored `overlap`. **`width` and `envelope` are not rescalable** (they change which designs pass), so they are in the fingerprint. |
| `fingerprint` | `sha256` of the canonical JSON of `{solver, model, base, material, width, envelope}` (sorted keys, no spaces, shortest number form). Two files can merge only if their fingerprints are equal. |
| `payloadSha256` | Hash of the binary part: shows the numbers were not changed after saving. It proves the file is intact, not that the results are true; the build guide, part 2, covers that. |
| `checks` | Results of spot-check re-solves, appended by whoever checked. Informational only: a checker always re-checks with its own random picks. |
| `stats` | Counters for the #90 charts (why designs fail), so they are available without reading every row. |

No personal details go in a file: no user names, emails or grades. `name` is the sweep's name (never uploaded to a public database; see `autoName` in formats.md).

## Columns (one value per stored design, sorted by design number)

| Column | Type | Content |
|---|---|---|
| `wood` | f32 | Wood ΣL, mm (2D: both trusses + ties; 3D: everything) |
| `use` | f32 | Highest member use at the reference rules (1 = at its limit). Capacity = FS·bookKg ⁄ use, so capacity is not stored. |
| `defl` | f32 | Mid-span (2D) or largest deck (3D) deflection at the reference rules, mm |
| `overlap` | f32 | How far the bridge reaches onto each desk, mm (so the minimum-overlap rule can change later) |
| `braceWood` | f32 | 3D only: wood in ties and bracing, mm |
| `flags` | u8 | Bits: 1 stable, 2 inside the envelope, 4 overlap OK at the reference minimum, 8 no slip, 16 no member through the table |
| `gov` | u8 | What governs the most-used member: 0 unknown, 1 tension, 2 crushing, 3 buckling, 4 bracing, 5 deflection |
| `idx` | varint-delta | Design numbers, ascending, each stored as the gap from the previous one (7 bits per byte). Works past 2^53. |

**Columns a writer adds for itself** are allowed, named `x.<name>` so no one mistakes them for spec columns; other readers skip them. The app (#179) uses `f32`, or `u8` with `"coded": "bool"` (0 not set, 1 false, 2 true) or `"coded": "list"` plus a `values` list (0 not set, k = `values[k-1]`). Likewise a writer may add its own header block (the app's is `explorer`); readers keep but ignore it, and it is **not** in the fingerprint.

**When book mass is swept** (`bookKg` is a dimension with more than one value), each row was solved at its own mass. Store `use` and `defl` **at `rules.bookKg`** anyway, by multiplying by m_ref ⁄ m_row (exact: both are linear in the load); a reader that needs the row's own value multiplies back by m_row ⁄ m_ref. That keeps rule 1 of rescaling true for every row. A writer that can't do this must write `rules.bookKg: null`, and readers then don't rescale.

**Unstable designs are stored too**, with NaN results and `flags = 0`, so a library knows they were already tried.

**Pass/fail is not stored; it's worked out on loading** from `use`, `defl`, `overlap`, `flags` and the rules in use. So a file never disagrees with the rules the reader picks.

## What goes in `base`

`base` holds every **fixed** input that can change a result: geometry, supports and desks, loads and books, stick counts and patterns, the friction values, the 3D settings (for a 3D sweep), and from the analysis options `width`, `tieJoint` and `crossTies`. Leave out:

- the swept inputs (they are in `sweep.dims`);
- the four rescalable rules (`FS`, `bookKg`, `deflLimit`, `minOverlap`), wherever they sit (in the app, `deflLimit` and `minOverlap` are inside `opts`);
- anything that only changes the screen or the printouts. In the app (v63) that is `name`, `swOn`, `swVals`, `swSel`, `focus`, `dragUnit`, `dragMode`, `tradeDrag`, `c3Drag`, `bigHours` and the build-document settings `doc`.

When unsure, **leave it in**. An extra key only stops a merge, which is safe; a missing one could merge two sweeps that differ.

## Merging

1. Fingerprints must be equal; otherwise refuse and say which setting differs.
2. **Union grid:** for each input, the union of both value lists (numbers sorted). For example, 20–100 by 10 merged with 25–95 by 10 gives 20–100 by 5.
3. Map every row to its design number in the union grid, rescaling `use` and `defl` to the target rules.
4. If the same design appears in both files, the results must agree (relative tolerance 1e-5). If they don't, **drop both copies** and list the design as a conflict to re-solve; never pick one silently.
5. Recount `stats` from the merged rows. Never add two files' counters, because the files can overlap.

## Versions and safety

There are **two version numbers**, and they behave differently:

- **The magic line** (`TRUSS-EXPLORER-SWEEP 1`) is the *binary layout*. A reader refuses a layout number it doesn't know. This is the one deliberate exception to formats.md rule 4, because a binary layout can't be read past a change.
- **The header `version`** is the *header schema*. A newer one opens with a warning ("made by a newer release") and keeps fields it doesn't know (rule 4). Every column is listed with its offset and length, so a reader **skips columns it doesn't know**. Adding a column therefore needs only a header version bump, never a new layout.

A new `solver` (a solver change) means a new fingerprint, so results from different solver versions never mix; a library keeps them as separate sets.

**Opening a file safely** (the binary door into `TrussFormats.open`, for White Hat #125):
1. Check the magic line.
2. Gunzip **with a cap on the unzipped size** (512 MB in the reference); stop and refuse past it, because a few-kB gzip can expand to gigabytes.
3. Check every column lies inside the data and holds exactly `rows` values.
4. Pass the header JSON through the same `cleanData` as JSON files: `sweep.dims` values include strings (pattern names, choices) that appear on screen. The number columns can't carry markup.
5. Check `payloadSha256` and the fingerprint. If either fails, say why and open read-only.
