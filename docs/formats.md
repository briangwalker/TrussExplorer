# Truss Explorer file and storage formats

*Architecture Lead, 2026-10-27 (#149). Status: version 1.1 of this spec (folds in the Math, Physics and White Hat reviews on #178 and board TE-B-014). Code: [`src/formats.js`](../truss-explorer-src-v58/truss-explorer/src/formats.js). Tests: [`tests/formats.test.js`](../truss-explorer-src-v58/truss-explorer/tests/formats.test.js) with fixtures in `tests/formats/fixtures/`.*

Everything the Explorer saves, to a file or in the browser, is listed here with its name, its versions and what changed between them. These layouts become the public database's layout later (#16), so change them only through this page.

## Rules for every format

1. **Every file says what it is.** A JSON file has `format` (a name from the table below) and `version` (a whole number). A file with a known `format` and no `version` is version 1.
2. **Old files always open.** Each version change gets an upgrade step in `formats.js` (`UP[kind][n]` turns version n into n + 1). Steps are never deleted, so a file from any version opens in every later release. Each older version has a fixture file and a test.
3. **Upgrades don't guess.** A value an old file never recorded is set to `null`, not invented. (Example: a v1 bridge doesn't say 2D or 3D; the upgrade leaves it unknown and the app works it out from the saved wood, as it did before.)
4. **Newer files open with a warning.** A file whose version is higher than the app knows opens as far as possible, says "made by a newer release", and keeps fields it doesn't understand. (The binary `.tsweep` is the exception; see below.)
5. **Unknown fields are kept.** Upgrading copies everything and only adds or renames what the step names.
6. **Everything from outside goes through one door:** `TrussFormats.open(text)`: parse, clean (text can't become markup, every string is one line with control characters turned into spaces, prototype keys dropped, string length capped), detect, upgrade, check. Nothing in `app.js` parses a file itself. White Hat reviews this door (#125).
7. **Stored keys are never renamed.** Browser storage keys and IndexedDB stores (table at the end) keep their names forever; old contents are converted on load instead.
8. **No personal details in any file** (Standing Instructions rule 8): no user names, emails or grades. `name` is the design's or sweep's own name.
9. **Bumping a version:** add the upgrade step and a fixture of the old version, raise `KINDS[kind].current` in `formats.js` (app.js reads `FILE_VER` from it), run `node tests/formats/make-fixtures.mjs` to make the new current-version fixtures, update this page, and bump `APP_VER` too if saved results change meaning.

## The formats

| Kind | Extension | `format` name(s) | Current version | Status |
|---|---|---|---|---|
| Bridge | `.bridge.json` | `se310-truss-bridge` (also accepted: `truss-explorer-bridge`) | 2 (v61) | in the app |
| Sweep | `.sweep.json` | `se310-truss-sweep` (also accepted: `truss-explorer-sweep`) | 2 (v61) | in the app |
| Compact sweep | `.tsweep` (gzip, binary) | header `truss-explorer-tsweep`; magic line `TRUSS-EXPLORER-SWEEP 1` | header 1, layout 1 | proposal ([docs/math/sweep-file-format.md](math/sweep-file-format.md)); in the app with #179 |
| Material | `.material.json` | `truss-explorer-material` | 1 (draft) | checked by `formats.js`; nothing writes it yet (#150) |
| Theme | `.theme.json` | `truss-explorer-theme` | 1 (draft) | balsaPixel themes (#108); a theme from outside the app is data only (see below) |

**Names.** Files written today keep the `se310-truss-*` names so older releases can still open them. New kinds use `truss-explorer-*`, because the app is growing past SE 310 (any material, any bridge). The bridge and sweep files switch to their `truss-explorer-*` names at their next version bump; every name a kind has ever used stays readable forever. *(Brian approved the `truss-explorer-*` naming, 2026-10-27.)*

## Shared header (bridge and sweep, version 2)

Written by `fileInfo()` in app.js.

| Field | Type | Meaning |
|---|---|---|
| `format`, `version` | string, integer | See above. |
| `app` | string | `"SE 310 Truss Explorer"`. |
| `release` | string | The release that saved it, for people: `"v61"` on main, `"balsaPixel 1.0-dev"` on the balsaPixel line. **Free text**: never parse it or compare it as a number. `null` after upgrading a v1 file. |
| `solver` | integer | `APP_VER`: the solver and saved-data version. This is the number to compare: a different `solver` means results may differ, so offer a re-run. `null` after upgrading a v1 file. |
| `savedAt` | string | ISO 8601 time, UTC. |
| `model` | `"2D"` / `"3D"` / null | The analysis model the numbers came from. `null` when an upgraded v1 file didn't say. |
| `bridgeCode` | string | 8 hex digits: FNV-1a of the bridge settings. The same code is printed on the CSVs, the .py and the build documents, so a printout can be matched to its file. `null` after upgrading a v1 file (it isn't recomputed, because the app's own settings list has changed since). |
| `rules` | object | The pass/fail rules the numbers were judged by: `FS`, `bookKg`, `deflLimit` (mm), `minOverlap` (mm), `width` (mm), `envelope` (`"outer faces"`). An upgraded v1 file gets whatever its bridge or sweep context recorded. **Only `FS`, `bookKg`, `deflLimit` and `minOverlap` can be rescaled** (results scale exactly with them); `width` and `envelope` change which designs pass, so two sweeps that differ in them must never be merged or compared as if they matched (Math review). |
| `name` | string | Design or sweep name, as the person typed it. Never uploaded to the public database (#16). |
| `autoName` | string | *Planned (#27):* the generated name (`<Word> <Type> <code>`, e.g. `Maple Pratt k3f9`, from `src/names.js`) the design got when it was made. Kept if the person renames the design; the only title the public database shows (#16). Because of that, the server **never accepts free text here**: it rebuilds the name or checks it against the exact pattern (a listed word, a known bridge type, a 4-character base-36 code), and a file whose `autoName` doesn't match opens without it (White Hat, TE-B-014). |

## Bridge file

Version 2 (v61, #154):

```json
{ "format": "se310-truss-bridge", "version": 2, "app": "SE 310 Truss Explorer", "release": "v61", "solver": 35,
  "savedAt": "2026-10-27T17:07:12.000Z", "model": "2D", "bridgeCode": "3a899a02",
  "rules": { "FS": 2, "bookKg": 2.5, "deflLimit": 2, "minOverlap": 5, "width": 60, "envelope": "outer faces" },
  "name": "Design A",
  "summary": { "model": "2D", "wood": 3632.3, "capKg": 18.55, "deflection": 0.1307, "passes": false, "members": 25, "joints": 14 },
  "bridge": { "family": "grid", "panels": 4, "height": 70, "...": "every design input; see below" } }
```

- **`summary`**: what the app showed when the file was saved. `{ "model", "stable": false }` if the design was unstable. It's informational: the app always re-solves.
- **`bridge`**: the app state `S` minus the screen-only settings (`UI_ONLY` in app.js), in the app's units (mm, N, MPa; **density in kg/mm³**). It holds the shape inputs (`family`, `panels`, `height`, `pattern`, `diagLeft`, `vertLeft`, chord shapes and ends, desks and supports, `sticks`, `loads`), `mat` (`b`, `h`, `E`, `sigT`, `sigC`, `rho`, `FS`, `K`), `load` (`mBook1`, `mBook2`, `g`, `nTruss`), `opts` (`deflLimit`, `width`, `crossTies`, `minOverlap`, `tieJoint`), `d3` (the 3D setup: tilt, ties, bracing patterns, sway, imperfections, sections), `doc` (build-document settings), `swOn` / `swVals` (the sweep setup), and **`anaMode`** (`"2d"` / `"3d"`). Unknown keys are ignored when applied (`applyBridge`).
- **Known leak (harmless):** a few screen settings that aren't in `UI_ONLY` still travel in `bridge`: `bigHours`, `c3Drag`, `dragMode`, `dragUnit`, `tradeDrag`. Adding them to `UI_ONLY` is a follow-up for Dev Lead; nothing depends on them.

| Version | Release | Change | Upgrade step |
|---|---|---|---|
| 1 | before v61 | `format`, `version`, `app`, `savedAt`, `name`, `summary`, `bridge`. No 2D/3D (`anaMode`), no release or rules. Some files also carry `swSel`, `showData`, `histBase`, `free3d` or `topView` in `bridge`, which are ignored. | – |
| 2 | v61 | Shared header added; `bridge.anaMode` added; 3D setup and document settings guaranteed to travel. | `UP.bridge[1]`: header added with `release`, `solver` and `bridgeCode` = null; `model` from `bridge.anaMode` if present, else null; `rules` from `bridge.mat` / `load` / `opts`. `bridge.anaMode` is left out when the file didn't have it, so app.js still infers 2D/3D from `summary.wood`. |

## Sweep file

Version 2 (v61):

```json
{ "format": "se310-truss-sweep", "version": 2, "...": "shared header",
  "name": "Design A sweep", "message": "204 of 365 pass · …",
  "ctx": { "FS": 2, "bookKg": 2.5, "defl": 2, "minOv": 5, "sheet": { "kind": "Sweep", "analysis": "2D", "tested": 365, "total": 365, "rows": ["…"] } },
  "sheet": { "...": "same object as ctx.sheet" },
  "mode": "sweep",
  "settings": { "swOn": {}, "swVals": {}, "swSel": {}, "focus": [] },
  "bridge": { "...": "as in a bridge file" },
  "rows": [ { "idx": 0, "height": 40, "panels": 4, "wood": 3012.5, "capKg": 12.1, "util": 0.41, "D": 0.21, "passes": true, "...": "…" } ] }
```

- **`ctx`**: the rules the sweep was judged by (`FS`, `bookKg`, `defl`, `minOv`) and `sheet`, the data-sheet summary (what was swept, how many tested, 2D or 3D).
- **`mode`**: `"sweep"`, `"pilot"` (a quick first pass), `"full"` (Large search) or `"file"`.
- **`rows`**: one object per stored design. **Required numbers** (a row missing any is dropped on opening, and the app says how many): `wood`, `capKg`, `util`, `D`, `overall`, `side`, `mass`, `height`, `panels`, `members`. Optional numbers: `curve`, `supportOffset`, `ratio`, `overlap`, `topEnd`, `botEnd`, `tilt3`, `width3`. Flags: `passes`, `envOK`, `edgeOK`, `slipOK`. Choices: `family`, `pattern`, `vert`, `bottom`, `topShape`, `claw`, `brace`, `brace3`, `ties3`, `loadShape`, `loadX`, `bookKg`, `swOv`. `idx` is the design's number in the sweep grid.

| Version | Release | Change | Upgrade step |
|---|---|---|---|
| 1 (earlier files) | before v61 | `ctx` = `{ bookKg, FS, defl }` only, no `sheet`. Rows have no 3D columns (`brace3`, `ties3`, `tilt3`, `width3`) or `slipOK`; some have `refined`, or `st_*` / `c_*` columns. | – |
| 1 (later files) | before v61 | `ctx` adds `minOv` and `sheet`; top-level `sheet`. | – |
| 2 | v61 | Shared header added. | `UP.sweep[1]`: header added; `model` from `sheet.analysis` (null if there is no sheet); `rules` from `ctx` (`defl` → `deflLimit`, `minOv` → `minOverlap`); an early file's sheet, if only in `ctx`, is also copied to top level. Rows are unchanged: missing optional columns stay missing. |

## Compact sweep (`.tsweep`)

Specified by the Math Consultant in [docs/math/sweep-file-format.md](math/sweep-file-format.md) (PR #164, updated in PR #196 after the review on #178): gzip, a magic line, one line of JSON header, then 8-byte-aligned binary columns; mergeable through a fingerprint. It reaches the app with #179. Settled in the review:

1. **Name and version field.** Header `format` is `truss-explorer-tsweep` (not `truss-explorer-sweep`, which is a name the JSON sweep may use), with `version` like every other format. `formats.js` knows the kind; a `.tsweep` header outside its binary file is refused (`binary-format`).
2. **Two version numbers.** The **magic line** (`TRUSS-EXPLORER-SWEEP 1`) is the binary layout: an unknown one is **refused**, the one deliberate exception to rule 4. The header **`version`** is the header schema: a newer one opens with a warning, and columns the reader doesn't know are skipped (the header lists every column with its offset and length).
3. **Units.** Its `material` block is in solver units (`rho` in kg/mm³), like a bridge file; a material file is SI (kg/m³).
4. **Fingerprint** = `{ solver, model, base, material, width, envelope }`. Only the four rescalable rules stay outside it (see the shared header).
5. **The bytes door** (#179, for White Hat #125): `openBytes(buf)` checks the magic line, gunzips with a **cap on the unzipped size**, checks `rows` against every column length, and passes the header JSON through the same `cleanData` as every other file, since `sweep.dims` holds strings that reach the screen.

## Material file (draft, #150)

One file per material. **SI on disk** (mm, N, MPa, kg/m³). Fields follow the Physics spec on #150 and the Physics review on #178. These were settled before anything writes the format, so it needs no new version.

```json
{ "format": "truss-explorer-material", "version": 1, "savedAt": "2026-10-27T12:00:00.000Z",
  "material": { "name": "Balsa (SE 310 course values)", "source": "SE 310 Project I challenge PDF", "asOf": "2026-10-27",
    "condition": "as supplied in the course kit", "behaviour": "brittle-wood",
    "E": 3000, "sigT": 7.5, "sigC": 4.5, "rho": 160, "sigCperp": null, "sigPL": null, "sigTult": null, "creep": null,
    "sizes": [ { "b": 3.18, "h": 3.18 } ],
    "estimated": [], "sources": {},
    "anisotropy": "grain along the stick", "variability": { "note": "varies by batch" }, "joints": {}, "notes": "" } }
```

| Field | Required | Meaning |
|---|---|---|
| `name`, `source`, `asOf`, `notes` | `name`; `source` warned if missing | Where the values came from. |
| `condition` | – | What the values depend on: `"12% moisture"`, `"printed XY, 90% infill"`. |
| `behaviour` | yes | `brittle-wood`, `ductile-metal` or `polymer`: picks the column curve and the tension check. |
| `E`, `sigT`, `sigC` | yes, > 0 | MPa. `sigT` is yield for metals and plastics, ultimate for wood; `sigC` is crushing or yield. |
| `rho` | yes, > 0 | kg/m³. `materialToMat()` converts it to the app's kg/mm³ (× 10⁻⁹). |
| `sizes` | yes, non-empty | Sections available, `{ b, h }` in mm. Square sticks today; rectangular sticks and strips later without a new version. |
| `sigCperp` | – (> 0 if given) | Bearing strength across the grain, MPa: shoes (#152) and side-bearing joints. Empty until the dent test (#23). |
| `sigPL` | – (> 0 if given) | Proportional limit, MPa: where Euler stops for metals (start of the Johnson curve). If missing, σc/2 for ductile metals. |
| `sigTult` | ductile only | Ultimate tension, MPa (reports the margin past yield). |
| `creep` | polymer only (warned if missing) | `{ factor, duration }`: long-term reduction of E and strength. |
| `estimated` | – | Names of the value fields that are assumptions, not data (e.g. PLA's `sigC`). The app marks them. |
| `sources` | – | `{ field: "source" }`, overriding `source` for one value. |
| `joints` | – | `{ "<joint type>": { "<method>": { tension, shear, slip, source } } }`: tension and shear in N, slip in mm, all optional and ≥ 0. Joint types from #141 (`butt-flush`, `butt-mitre`, `splinted`, `lap`, `double-lap`, `splice`); methods like `wood-cement`, `epoxy`, `weld`, `pin`. |
| `variability` | – | `{ cov: { E: 0.2, … } }` or `{ low: {…}, high: {…} }`, plus a free-text `note` (#53). |

`TrussFormats.materialToMat(material, i)` gives the solver's `mat` object for section `i` (default the first); for the course balsa it equals `C.DEFAULT_MAT`. Library files (balsa, basswood, aluminium 6061-T6, printed PLA) are Dev Lead's follow-up on #150. The fixture `v1-balsa-course.material.json` holds the course values only.

## Theme file (draft, balsaPixel)

Two kinds of theme, with different rules (White Hat, board TE-B-014):

- **Built-in themes** live in `themes/` on the balsaPixel-1.0 branch, listed in `themes/index.json` (`"format": "truss-explorer-theme-index"`, version 1). Each entry has `"format": "truss-explorer-theme"`, `"version": 1`, an `id`, and may point at a `.css` file. They're trusted because they arrive through a reviewed pull request (White Hat checklist). `build.py` packs them into the page and refuses an unknown format or version. Since PR #199, only built-in themes load.
- **A theme from outside the app** (opened, shared, or later from the database) is **data only**, checked by `formats.js`. That is the shared format once Graphics and UI settle the token list (#108, board TE-B-010):

```json
{ "format": "truss-explorer-theme", "version": 1, "id": "graph-paper", "name": "Graph paper",
  "tokens": { "paper": "#fbfaf5", "grid": "#cfe0ee", "ink": "#1d2a3a", "radius": "4px" },
  "fonts": [ "Inter" ], "images": { "background": "paper-grain.png" }, "notes": "" }
```

| Rule | Enforced by `check()` |
|---|---|
| Only `format`, `version`, `id`, `name`, `savedAt`, `tokens`, `images`, `fonts`, `notes` | any other key (`css`, `js`, `script`, `html`, …) is an error |
| Token names are lower-case words with hyphens; values are a colour (`#rgb` to `#rrggbbaa`), a number with an optional unit (`px`, `rem`, `em`, `%`, `deg`) or a short plain word list | `url(…)`, `;`, braces and quotes are refused, so a value can't add CSS or reach out |
| Images are file names in the theme's own folder: `.png`, `.jpg`, `.webp` | no paths, no SVG (it can carry script) |
| Fonts are names of fonts the site hosts | never URLs (the website's CSP stays `'self'`) |

**A theme can never change what a result says:** the verdict, the member-force colours and the numbers in the results card are drawn where theme styles can't reach them, and build documents always print with a built-in theme (#197).

## Browser storage (never renamed)

| Where | Key / store | Holds | Versioning today |
|---|---|---|---|
| localStorage | `se310-truss-v5` | The current design and screen settings (`S`). | Converted on load in app.js (`migOv5`, `opts.tieJoint`, `envMeasure` removed). No version number yet. |
| localStorage | `se310-truss-saved` | Saved sweeps for comparing (name, FS, book mass, rows). | None. |
| localStorage | `se310-truss-backups` | Up to 40 earlier bridges `{ when, why, name, sum, bridge }`. | None (`bridge` has the same layout as a bridge file's `bridge`). |
| IndexedDB `se310-truss` (v1), store `big` | key `cur` | The last sweep on screen `{ ver: APP_VER, when, msg, rows, top, ctx, sig, mode }`. | `ver` = APP_VER. An older one offers a re-run. |
| | key `last` | The last Large search result `{ when, msg, rows, top, ctx, sig }`. | None. |
| | key `ckpt` | Large-search checkpoint (typed arrays, BigInts) `{ ver, wv, sig, total, n, k, … }`. | `ver` = APP_VER; `wv` = 2 since v59 (the fair sampler; a checkpoint without `wv` continues the old way and says so). |

**Follow-up (not in this change):** move those load-time conversions into `formats.js` as a `state` kind with its own version, so every stored record has a version and one upgrade path. Nothing is renamed; the record gains a `version` field the first time it's saved.

## What is tested

`tests/formats.test.js`, in `run_all.sh` and CI:

- Every fixture opens, upgrades to the current version, passes the check, and upgrading twice changes nothing.
- v1 bridge (`Partner_test.bridge.json`), a v1 bridge saved while unstable, and a bridge with no `version` field → v2, with nothing guessed.
- Early v1 sweep (no sheet) and later v1 sweep (the repo's 23,917-row sample) → v2, with no rows lost.
- v61 files open with no upgrade steps and no warnings; a v61 file marked `balsaPixel 1.0-dev` opens the same way.
- A version 3 file opens with a warning, keeps its unknown fields and isn't downgraded.
- Not-JSON, not-an-object, not ours, no bridge, no rows and no usable rows are each refused with their own reason (the app turns each into a sentence).
- Cleaning: markup characters are neutralised, `__proto__` is dropped, row numbers become numbers.
- The draft material file passes the check, bad values are reported, and `materialToMat` gives the course `DEFAULT_MAT`.
- Files in `tests/private/` (git-ignored, Brian's own) all open, with no rows lost. On 2026-10-27, all eight of Brian's saved v1 files did (3 bridges and 5 sweeps, 913 to 36,570 rows).
