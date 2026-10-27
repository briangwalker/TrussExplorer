# Sweep file format `.tsweep`, version 1

*Math Consultant, 2026-10-27. Status: proposal for review. Reference code and tests: [`reference/tsweep.js`](reference/tsweep.js), [`reference/tsweep.test.js`](reference/tsweep.test.js).*

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

```json
{
  "format": "truss-explorer-sweep",
  "formatVersion": 1,
  "app": { "name": "SE 310 Truss Explorer", "version": "v60", "appVer": 34 },
  "name": "Shallow Pratt study",
  "savedAt": "2026-10-27",
  "sweep": {
    "analysis": "2d",
    "dims": [ { "key": "panels", "values": [4, 5, 6] }, { "key": "height", "values": [40, 45, 50] }, { "key": "st_top", "values": [1] } ],
    "total": "27",
    "sampling": { "method": "all" }
  },
  "base": { "...": "every fixed input that is not sweepable (span, table thickness, loads list, ...)" },
  "material": { "b": 3.18, "h": 3.18, "E": 3000, "sigT": 7.5, "sigC": 4.5, "rho": 1.6e-7, "K": 1 },
  "rules": { "FS": 2, "bookKg": 2.5, "deflLimit": 2, "minOverlap": 20 },
  "rows": 27,
  "columns": [ { "name": "wood", "type": "f32", "offset": 0, "length": 108 }, "..." ],
  "fingerprint": "sha256:…",
  "payloadSha256": "…",
  "checks": [ { "date": "2026-10-28", "appVer": 34, "sampled": 300, "frontier": 41, "mismatches": 0 } ],
  "stats": { "tested": 27, "unstable": 0, "fail": { "strength": 3, "deflection": 1, "envelope": 0, "edge": 0, "slip": 0 } }
}
```

| Field | Meaning |
|---|---|
| `app.version`, `app.appVer` | The version name (for people) and the solver/data version number (`APP_VER` in app.js), which goes into the fingerprint. |
| `sweep.dims` | **Every sweepable input, in a fixed order, including the ones not swept** (one value). That is what makes merging work: a sweep that held height at 40 and one that swept 40–60 describe the same input. Last dimension changes fastest (as `candAt` does today). Values are numbers, strings or small objects (choices). |
| `sweep.total` | Number of designs in the grid, as a string (exact past 2^53). |
| `sweep.sampling` | `{"method":"all"}` for a full grid; `{"method":"feistel-v1","keys":["…"],"tested":n}` for a large search (the #18 shuffle: keys plus count say exactly which designs were tried); `{"method":"merged","parts":[…]}` after a merge. |
| `base`, `material`, `analysis` | Everything else that changes a result. |
| `rules` | FS, book mass, deflection limit, minimum overlap: the **reference rules** the stored use and deflection were computed at. Not in the fingerprint, because results rescale exactly (factor k = FS′·m′ ⁄ FS·m). |
| `fingerprint` | `sha256` of the canonical JSON of `{appVer, analysis, base, material}` (sorted keys, no spaces, shortest number form). Two files can merge only if their fingerprints are equal. |
| `payloadSha256` | Hash of the binary part: shows the numbers were not changed after saving. It proves the file is intact, not that the results are true. Part 2 of the guide covers that. |
| `checks` | Results of spot-check re-solves, appended by whoever checked. Informational only: a checker always re-checks with its own random picks. |
| `stats` | Counters for the #90 charts (why designs fail), so they are available without reading every row. |

No personal details go in a file: no user names, emails or grades. `name` is the sweep's name.

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

**Unstable designs are stored too**, with NaN results and `flags = 0`, so a library knows they were already tried.

**Pass/fail is not stored; it's worked out on loading** from `use`, `defl`, `overlap`, `flags` and the rules in use. So a file never disagrees with the rules the reader picks.

## Merging

1. Fingerprints must be equal; otherwise refuse and say which setting differs.
2. **Union grid:** for each input, the union of both value lists (numbers sorted). For example, 20–100 by 10 merged with 25–95 by 10 gives 20–100 by 5.
3. Map every row to its design number in the union grid, rescaling `use` and `defl` to the target rules.
4. If the same design appears in both files, the results must agree (relative tolerance 1e-5). If they don't, **drop both copies** and list the design as a conflict to re-solve; never pick one silently.
5. Recount `stats` from the merged rows. Never add two files' counters, because the files can overlap.

## Versioning

A new `appVer` (a solver change) means a new fingerprint, so results from different solver versions never mix; a library keeps them as separate sets. A new `formatVersion` means a new magic line; readers refuse versions they don't know.
