# src/app/: app.js, cut into parts (#109 step 1)

`app.js` (3,732 lines, one IIFE) was cut along its own section lines into the files below. `build.py` joins `src/app/*.js` **in name order, with nothing added between them**, into the `/*APP*/` spot of `ui.html`. So the page is the same single IIFE as before: every part still sees the same shared variables (`S`, `tr`, `res`, `sweepAll`, …), and the built page was byte-identical to the one built from `app.js`.

| Part | Sections (in order) | Owner (board TE-B-019) |
|---|---|---|
| `10-state.js` | opens the IIFE; left-panel regroup; `COURSE`, the storage key, `DEFAULT`, loading saved state; state helpers | Architecture Lead |
| `20-inputs.js` | collapsible sections, controls wiring, chips, main update | Dev Lead |
| `30-drawing.js` | loads on the deck, the 2D drawing and its labels, drag-to-adjust, wood helpers, stats, member table | Dev Lead |
| `40-outputs.js` | .py export, LP data, build-documents dialog | Dev Lead |
| `50-files.js` | bridge and sweep files (through `TrussFormats`), the View switch and menu, presets | Architecture Lead |
| `60-sweep.js` | sweep, the variable list, stale results, large search | Architecture Lead |
| `70-charts.js` | trackers, saved sweeps, trade-off chart, 3D chart | Dev Lead |
| `80-view3d.js` | 3D view, 2D/3D analysis | Dev Lead |
| `85-sweep-sheets.js` | sweep data sheet, sweep between two bridges (A↔B) | Architecture Lead |
| `90-controls.js` | mouse and keys, ☰ menu, settings, find-stable, full screen | Dev Lead |
| `95-keep-safe.js` | keeping work safe across reloads (backups, IndexedDB restore), result tables | Architecture Lead |
| `99-door.js` | `window.TrussApp` (the shell's door) and the IIFE's close | Dev Lead (the door's list is agreed by both) |

## Rules

- **A part doesn't parse on its own** (the IIFE opens in `10` and closes in `99`). `run_all.sh` checks the joined text, so run that, not `node --check` on one part.
- **Order matters.** Top-level `const`/`let` must be declared before code that runs at load uses them. Keep code in the part, and the place, it was cut from. To add a part, pick a number between two others (`65-…`). The order lives in the file names, never in a list.
- **Ownership:** edit someone else's part through them or the board (rulebook rule 3, P8d).
- **Step 2** (TE-B-019) gives parts real interfaces one at a time: the sweep engine first (#35 moves it into a Web Worker), then files, then the drawing (`renderDrawing(target, design)` for the PIP, #210/#237).
- **`main` still has the unsplit `src/app.js`.** See CONTRIBUTING for forward merges.
