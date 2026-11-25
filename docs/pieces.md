# Shared screen pieces: which piece meets which rule

**Version 0.1 · 2026-10-31 · owner: UI Engineer · issue #354 · for the Dev Lead, BluePeachDev, UI Designer, Graphics Designer**

balsaPixel's screens (#209–#221) and the gallery page are built from one small set of pieces in `program/src/pieces.js` (global `TrussPieces`). A UI- or ART- rule is met once, in its piece, and checked once, by its test. A screen built from the pieces meets those rules without re-reading the spec text. This page is the map: **rule → piece → test**.

This page holds no rules. The rules live in [ui-spec.md](ui-spec.md) (`UI-…`), [art-spec.md](art-spec.md) (`ART-…`) and docs/code-spec.md (`CODE-…`, PR #351). Where this page and a spec differ, the spec wins; tell the UI Engineer on the board.

## The pieces

| Piece | Builder (pure, Node) | Behaviour (browser) | Classes and parts it emits |
|---|---|---|---|
| Theme tokens | `TOKENS`, `WIREFRAME`, `tokenCSS(id, values)`, `contrast()`, `contrastPairs()` | — | `--te-*` on `#stage[data-theme="<id>"]` |
| Picture layer | — (CSS) | — | `.te-picture`: the drawing or chart goes in here |
| Window | `windowHTML({ id, title, home, state, body, icons, movable })` (⋮⋮ grip only when `movable: true`, UI-W20), `nextState()` | `mountWindow(win, tab, { onState })` | `.s-pan` `window` · `.s-ph` `window-title` · `.stp` `stepper` |
| Edge tab | `edgeTabHTML({ id, title, home, state })` | (in `mountWindow`) | `.tabE.l/.r/.t/.b` `edge-tab` |
| Stick button, icon button, chip | `buttonHTML({ kind, label, icon, pressed, disabled })` | `mountToggle()` for a pressed button | `.s-b` `button` · `.s-ic` `icon-button` · `.te-chip` `chip` |
| Toggle | `toggleHTML({ label, checked })` | `mountToggle()` | `.te-tog[role=switch]` `toggle` |
| Tabs | `tabsHTML({ label, tabs, selected })` | `mountTabs(list, { onSelect })` | `.te-tabs[role=tablist]` `tabs` · `.tab[role=tab]` `tab` |
| Slider | `sliderHTML({ key, label, min, max, step, value, from, to, wall, rule })`, `sliderValue()` | `mountSlider(el, { onInput })` | `.te-slider` `slider` > `.trk`, `.zone.rule`, `.zone.wall`, `.band` `slider-band`, `.th[data-end=from/to/val]` |
| Results card | `resultsHTML({ checks, verdict })` | opens its full view with `popups()` | `.res` `results` · `.pill` `badge` |
| Pop-up | — | `popups(doc).open(pop, opener)` / `.close(pop)` | `.te-pop` |
| Table (0.2.1, an APG grid) | `tableHTML({ id, caption, columns: [{ key, label, num, sort }], rows, rowHeader, lit, empty })` | `mountTable(tbl, { onHover, onPick, onSort })` → `{ light(key), picked, focusKey(key) }` | `.te-tbl` `table[role=grid]`: `th[scope=col]`, one `th[aria-sort]` with a `.te-sort` button, `th.rh[scope=row]` held in place, `td.num` right-aligned mono, `tr.lit` / `tr[aria-selected]` |

The Members tab (#416) is built from the table piece by `src/membersview.js` (`TrussMembersView`): `tableHTML(P, TrussMembers.rows(tr, res), { typeLabel, lit })`, `toolbarHTML(P)`, and `csvRows()` / `csvOf()`, which give exactly the app's `rowsForCsv()` / CSV text (Node: every case in tests/lib.js; browser: byte for byte against the app's Copy table as CSV). Tests: `tests/membersview.test.js`, `tests/ui/members.mjs`.

`TrussPieces.install(document)` puts the pieces' CSS on the page once (`<style id="te-pieces">`). It is safe to call on the program page: every element a piece builds carries `data-pc`, and the rules on class names the shell also uses (`.s-pan`, `.tabE`, `.s-b`, `.s-ic`, `.res`, `.s-ph`, `.stp`, the focus ring) reach only those elements. A browser test checks that installing it changes nothing the shell drew, in Wireframe and OG (TE-B-235). The marker sits in `:where()`, so a theme's own rules still win (UI-T1). Call it from the code that uses the pieces, never at load (CODE-F1, TE-B-230). The class names are the ones the built-in themes already style, so Notebook + Calculator applies to the pieces unchanged (checked in the browser test).

**What the pieces never do:** read or write the app's state (`S`, `tr`, `res`), touch storage, or set a meaning colour. Pass and fail come from the app's `--ok` and `--bad` (ART-K14, UI-A18). A screen passes the numbers in; the piece draws them.

## Rule → piece → test

Tests: **N** = `program/tests/pieces.test.js` (Node), **B** = `program/tests/ui/pieces.mjs` (browser). Both run in `run_all.sh`.

| Rule | What it asks | Piece | Test |
|---|---|---|---|
| **UI-A3** | The picture is the base layer; windows float over it and never move or resize it. Brian's render rule (#237, 2026-10-31): a menu hides only its own box. | picture layer, window | N: CSS has `.te-picture{inset:0}` and no `--free-*` · B: every window through W/I/T, a peek and a pop-up leave the picture's box unchanged; the picture shows around windows |
| UI-A4 | Three states, stepped by one ‹ | window, edge tab | N: `nextState` · B: ‹ → icons → tab; › back; grow hidden in words |
| UI-A9 | Each view keeps its own window layout | window (`onState` reports every change; the caller saves it per view) | B: onState log |
| UI-A17 | Meaning is never colour alone | results card (✓ / ✕ and words), toggle (pushed in), slider (hatch, wall) | N: results card text · B: fail shows ✕ and FAILS |
| UI-A18 | Meaning colours never change | results card reads `--ok` / `--bad` only | N: no `--te-` pass/fail token · B: the pill follows `--bad` |
| UI-W1–W7 | Each window's home and its three states | window (`home`: left, right, top, bottom) | N: window markup · B: states. The exact homes and stacking are the screen's layout (#209–#211), not the piece. |
| UI-W2 | Results card: numbers only, each against its limit, verdict pill, ▾ | results card | N: `18.6 ≥ 5.0 kg`, `3.9 < 5.0 kg ✕`, pills · B: card text |
| UI-W8 | Outside click closes a pop-up and does nothing else; Esc closes the top one and returns focus | pop-up | B: outside click eaten, next click works, Esc returns focus |
| UI-W9 | Hover a tab to peek without covering it; click the peek to keep it | window, edge tab | B: peek beside the tab; click keeps it |
| UI-W15 | Window sizes: 52 px icons, 28 px tab, never over 40 % of the stage, heights up to stage − 24 px | window, edge tab | B: 52 px icons, 28 px tab |
| UI-W17 | A peek sits 8 px beside its tab, top aligned, inside the stage; closes 400 ms after leaving | window (`mountWindow`) | B: peek position |
| UI-W18 | The results card's full view is a pop-up | pop-up | B: card opens its pop-up; content is #210's |
| UI-W12 | Project facts one click away | results card's full view (a pop-up) | B: card opens its pop-up (`aria-expanded`). The facts themselves come from #210. |
| UI-S6 | Analysis tabs | tabs | N: tablist markup |
| UI-S6 (Members), UI-H4, UI-A17, UI-A18 | Members sorted by use; hover / pick lights a member; T/C in words; app meaning colours | table, Members view | N: membersview.test.js; B: ui/members.mjs |
| UI-K7 | Tabs: one Tab stop; arrows move and pick, wrapping; Home and End go to the ends (ui-spec 1.5.1, #367; UI-K3 is for chart dots) | tabs (roving focus) | N: one tab in the Tab order · B: arrows, Home, End, wrap |
| UI-K4 | Named regions; focus ring kept by every theme | window (`role=region`, `aria-label`), CSS focus ring | N: markup · B: ring |
| UI-I1 | Swept range shown on the slider with both ends | slider | N: band and ends · B: from can't pass to; band follows |
| UI-I2 | Course rule: never clamped, turns pink | slider (`data-over="rule"`, pink hatch zone) | N: `sliderValue(120)` = 120, marked · B: End runs to 140, marked |
| UI-I3 | Model limit: stops at the wall | slider (`data-wall`, grey wall zone) | N: `sliderValue(5)` = 20 · B: Home stops at 20 |
| UI-T1 | Every part has `data-slot` and `data-part`; colours are `--te-*` on `#stage[data-theme]` | every piece; `tokenCSS` | N: markup · B: every part present, slots only bg/ctl/disp |
| UI-T2 | A theme changes looks, never places | every piece | B: Notebook and Calculator themes leave the picture's box unchanged |
| ART-K1–K12 | The token names and Wireframe values | tokens | N: every name, rule and Wireframe value |
| ART-K6 | Wireframe `strong` is brown `#7a4f1c` | tokens | N |
| ART-K14 | Meaning colours are never tokens | tokens, results card | N |
| ART-C1, ART-C2 | Text 4.5 : 1, lines and focus 3 : 1 | tokens (`contrastPairs`) | N: 13 Wireframe pairs. `ctl-line` is `#7f8893`, 3.59 : 1 (#355, art-spec 1.0.4) |
| ART-S1 | Default: a stick standing up, with a shadow | button, chip, toggle | B: screenshots; theme look in Notebook |
| ART-S2 | Hover lifts 1–2 px | button, chip, toggle | N: CSS · B: hover transform |
| ART-S3, ART-S6 | Pressed sinks, one even colour; picked differs by more than colour | button, chip, toggle | N: CSS · B: pressed sits 2 px lower |
| ART-S4 | Disabled: 50 %, desaturated, no lift | button | N: CSS · B: computed opacity and filter |
| ART-S5 | Focus: 3 px accent outline, 3 px offset | every control | N: CSS · B: computed outline |
| ART-T2 | UI text at least 13 px | every piece's CSS | N: no font under 13 px; pill, tabs, pop-up |
| ART-K16, ART-S10, ART-W12, ART-W13 | Course-rule pink, Wireframe stick states, pop-up, tabs (art-spec 1.0.4, PR #357) | slider, buttons, pop-up, tabs | N: CSS checks |
| ART-I2 | An icon button keeps its words for screen readers | icon button | N: an icon button without a label is refused |
| ART-W1, ART-W5 | Stick-in-a-tray slider; three different handle shapes; swept band; limit zones | slider | N: markup · B: three computed handle shapes |
| ART-W3 | Results strip | results card (`.res`, the theme draws the bezel) | B: Notebook screenshot |
| ART-M5 | Press 120 ms; reduced motion has none | button CSS (`--t-press`) | N: reduced-motion rule |
| CODE-F1, F5, S1, N3 | One global; builders are pure; text escaped; throw only for programmer errors | all | N: runs under Node; escaping test; refusals |

## Gaps found while building (TE-B-224 item 3)

Building the pieces turned up ten questions no spec answered. Each one now has a spec rule (art-spec 1.0.4, #357; ui-spec 1.5, #364, both merged), and the piece cites that rule. The last column says where the rule is met.

| # | Gap and the rule that answers it | Owner | Where the rule is met |
|---|---|---|---|
| G1 | **The "pink" of a course rule.** ART-K16 (art-spec 1.0.4, #357) makes it a meaning colour, `#c8288c` with a `#7a0e52` edge, read from the app's `--rule`; solid 2 px stripes with a 3 px gap. | Graphics | done: `var(--rule, #c8288c)` |
| G2 | **Wireframe's stick states.** ART-S10 (#357) takes the pieces' values as the rule. | Graphics | done |
| G3 | **What a pop-up is made of.** ART-W12 (#357): paper in Notebook, `surface` in Wireframe, 1 px `ctl-line` edge, text 13 px minimum. | Graphics | done |
| G4 | **How tabs look.** ART-W13 (#357): a glued stick group in Notebook; in Wireframe, flat segments that each keep a 1 px `ctl-line` edge, the picked one sunk 2 px. | Graphics | done |
| G5 | **Window widths.** UI-W15 (ui-spec 1.5, #364): Inputs 400, Drawing 340, View options 640, Sweep 640, full results 540 px, never over 40 % of the stage; icons 52 px; tab 28 px. | UI | pieces: 40 % cap, 52 px icons, 28 px tab; the screen sets each window's `--te-win-w` |
| G6 | **Stacking on a shared edge.** UI-W16 (#364): View options then Inputs on the left, 12 px from the edge, 8 px apart; a window that doesn't fit opens one state smaller. | UI | pieces: 12 px edge gap; the stacking itself is the screen's layout (BluePeachDev rows) |
| G7 | **Where a peek sits.** UI-W17 (#364): 8 px beside its tab, lined up with the tab's top, inside the stage; closes 400 ms after leaving both. | UI | done in `mountWindow` (tested) |
| G8 | **The results card's full view.** UI-W18 (#364): a pop-up under the strip; checks with what governs them, the project facts, two links; 540 px. | UI | the pop-up piece; the content is #210's |
| G9 | **The gallery page.** UI-G1–G5 (#364), place from TE-B-230. The theme switch it needs without saving (UI-G3, UI-G4) is the shell's `previewTheme(id)` door, decided on TE-B-251. | UI | the gallery PR (next), `src/gallery.js` |
| G10 | **The restless-bridge stop rule.** UI-M8 (#364). | UI | not a piece (#144) |
| G11 | **How a data table looks** (row height, header, zebra, the lit row, number font). Graphics: keep the look (TE-B-347): zebra ART-K3, header line ART-K4 `line`, the use bar's track a 1 px `line-soft` edge and its fill pass / fail only (never course-rule pink), zebra in every theme. UI: place, columns and keys in ui-spec 1.5.5 / 1.5.7 UI-S6. The ART- rule itself is Graphics' next art-spec. | Graphics, UI | answered |

## Not pieces (who builds them)

- **Where each window sits and how they stack** (UI-W1–W7 homes, UI-A2): the screen's layout, Dev Lead (#209–#211). The window piece only says which edge it belongs to.
- **The drawing in the PIP** (UI-H5): the Architecture Lead's `renderDrawing(target, design)` door.
- **Chart zoom, dots, the view cube** (UI-C, UI-V, ART-M6): Dev Lead and RedMangoArch.
- **Value editor, number box, stepper, ☰ sheets, toasts, dialogs** (UI-I8, UI-I9, UI-A16, UI-W10, UI-W13): the next pieces, version 0.2.
- **The gallery page**: waits on UI's gallery rule in ui-spec and the Architecture Lead's answer on where it lives (TE-B-230, TE-B-231).

## How a screen uses the pieces

```js
const P = window.TrussPieces; P.install(document);
host.insertAdjacentHTML('beforeend', P.windowHTML({ id: 'drawing', title: 'Drawing', home: 'right', state: saved.drawing, body: P.toggleHTML({ label: 'Member forces', checked: S.showForces, id: 'tForces' }) })
  + P.edgeTabHTML({ id: 'drawing', title: 'Drawing', home: 'right', state: saved.drawing }));
P.mountWindow(document.getElementById('win-drawing'), document.querySelector('.tabE[data-tab="drawing"]'), { onState: st => { saved.drawing = st; save(); } });
P.mountToggle(document.getElementById('tForces'), { onChange: v => { S.showForces = v; redraw(); } });
```

The drawing or chart goes inside one `.te-picture` element that is never resized for a window (UI-A3).

## Change log

- **0.2.4 · 2026-11-24** Cells that hold controls (UI-S10 in ui-spec 1.5.8, PR #486; the UI Designer's ask, TE-B-500), as in the APG grid's editing cells. A column with `edit: 'cell'` (the Sticks − / + and row / 2×2) is one Tab stop like any cell. Enter or F2 enters it: focus goes to its first live control, Tab and Shift+Tab stay inside, and other keys go to `onCellKey({ key, shift, row, col, target })` (return true to take the key). Esc, Enter or F2 leaves it, and so does focus leaving the cell. A column with `edit: 'widget'` (the Focus toggle) lets the control itself take the grid's focus, and Enter / Space press it. A click on a control works directly. After a redraw, `focusKey(key, { col, focus: true, edit })` with `mountTable(...).editing` puts the person back in the same cell, on the same control.
- **app height course rule · 2026-11-25** The app's `rule()` for the limits rows marks a height whose OUTER face is over 100 mm pink, read from `TrussCore.envelopeSize`, so the box and the results switch at the same height (UIE-9, TE-B-577b; Math TE-B-577). limitrows.js and inputs.js are unchanged.
- **inputs 0.2.0 · 2026-11-23** The ✎ value editor (UI-I8): value, joystick, sweep range, Done; 320 px, moves by its title bar; the 400-value cap is never cut (UI-I4).
- **limitrows 0.1.0 · 2026-11-24** The Inputs pane's number rows on the limits table, behind `TE_FLAGS.limitsBoxes` (TE-B-494). The app's boxes stay, hidden, so every handler still runs.
- **sheets 0.1.3 · 2026-11-24** The Undo ring's colour on the toast is pinned with `!important`, because Notebook's catch-all `button:focus-visible{outline:… !important}` painted it in the toast's own colour (1.00:1; QA TE-B-510b). The theme still sets the ring's style and width. A new check measures it in every built-in theme (Wireframe 7.09, Blueprint 10.02, the three Notebooks 5.32).
- **sheets 0.1.2 · 2026-11-24** QA's two MUSTs on the Undo toast (TE-B-502): Ctrl+Z / ⌘Z runs Undo while a toast is up, but not while a text field has focus (the browser's own undo stays); the button shows the key in a `<kbd>` and has `aria-keyshortcuts`. Its focus ring is `--te-on-strong`, the colour of the toast's strong ground (ART-S5 1.0.7), 3:1 or better in every theme. New strings: `toast.key.undo`, `toast.key.undoMac`.
- **sheets 0.1.1 · 2026-11-24** A toast that holds focus (Undo pressed with the keyboard, or a new toast replacing it) gives focus back to where it was before, never to the page (WCAG 2.4.3). Found in my look at #482's Undo toasts.
- **0.2.3 · 2026-11-23** The table's empty line ('Nothing to show.') and the Members tab's unstable line now come from TrussStrings (`pieces.table.empty`, `members.table.unstable`), not literals (TE-B-387). The Drawing window's old Member forces table (app/30-drawing.js) keeps its own copy until #453 takes it out.
- **0.2.2 · 2026-11-23** `mountTable(...).focusKey(key, { col, focus })`: after a caller redraws the table while a cell had focus, focus goes back to the same row and column (a vanished row falls back to the first row), so it never drops to the page (Chaos Tester, TE-B-462). The Members tab uses it.
- **0.2.1 · 2026-11-13** The table is an APG grid (ui-spec 1.5.7 UI-S6; TE-B-346): `role="grid"`, one Tab stop that remembers the last cell, ↑ ↓ ← → by cell, Home/End along the row, Ctrl+Home/End to the first/last row, PageUp/PageDown 10 rows; ↑ from the first row reaches the header. One sort column (`sort`) carries the only `aria-sort` and a real button (`onSort`). A row-header column (`rowHeader`) and the header row stay in place when the table scrolls. Members view: the short column set and an *All columns* switch (UI-S6 1.5.5), sorting by Use both ways (the CSV keeps member order), the caption counts the members, and Graphics' four points (TE-B-347). Gallery: a Members table item.
- **0.2 + movable · 2026-11-13** `windowHTML` takes `movable` (default false). The ⋮⋮ grip is drawn only on a window that can be moved, today the ✎ value editor and the PIP (UI-W20, Brian 55a, TE-B-301). The gallery shows one fixed and one movable window side by side.
- **0.2 · 2026-11-05** The table piece (`tableHTML`, `mountTable`: hover, arrows, Enter or click lights a row, one Tab stop; UI-S6, UI-H4, UI-K7) and the Members tab view (`src/membersview.js`, #416, TE-B-332). Gap G11: no table-look rule yet.

- **0.1 · 2026-10-31** First set: tokens, picture layer, window and edge tab, stick button, icon button, chip, toggle, tabs, slider, results card, pop-up (#354; TE-B-224, TE-B-227).
- **0.1.5 · 2026-10-31** `install()` is safe next to the shell: rules on shared class names reach only what the pieces built (`data-pc` inside `:where()`); it's tested on the program page in Wireframe and OG (BluePeachDev's BPD-3 question 1, TE-B-235).
- **0.1.4 · 2026-10-31** After #356, #357 and #364 merged: the gaps table cites its rules (TE-B-243, TE-B-249). The tab keys cite UI-K7 instead of UI-K3 (UI's review, TE-B-232; #367). The rule map gains UI-W15, UI-W17 and UI-W18.
- **0.1.3 · 2026-10-31** ui-spec 1.5 (#364) answers G5–G10. The pieces follow UI-W15 (52 px icons, 28 px tabs, 40 % cap, 12 px edge gap) and UI-W17 (the peek sits 8 px beside its tab, lined up with its top, and closes after 400 ms).
- **0.1.2 · 2026-10-31** Graphics' review (TE-B-232): pill 13 px (ART-T2); art-spec 1.0.4 values (#357): `ctl-line #7f8893` (#355), course-rule pink from `--rule` as solid stripes (ART-K16), edged Wireframe tabs (ART-W13), 13 px pop-up (ART-W12); two more contrast pairs. G1–G4 answered.
- **0.1.1 · 2026-10-31** Added the Gaps table: what the pieces needed that no spec says (TE-B-224 item 3).

## Sheets, dialogs and toasts (src/sheets.js, `TrussSheets` 0.1.0)

These sit beside `pieces.js` and follow its rules: one global, pure builders, behaviour in mount functions, and CSS in `<style id="te-sheets">` scoped to `#stage`. Steps 10 and 2b (#217, #410, #411, #399) build on them.

| Piece | Markup | Behaviour | Rules | Tests |
|---|---|---|---|---|
| Sheet / dialog | `sheetHTML(P, { id, kind: 'sheet'\|'dialog', title, body, buttons: [{ label, act, main, cancel }] })` (**`body` is HTML the caller builds and escapes**, as for `windowHTML`; the title and labels are escaped here): a native `<dialog>` with a fixed header (title, ✕), a middle that scrolls and a fixed button row. A dialog must have a main button that names its action; "OK", "Yes", "Go" and "Submit" are refused. | `modals(doc, { onClose, isDirty })` → `open(el, opener)`, `close(el, why)`, `flash(el)`, `top()`. Only one is open at a time. Esc closes it. A click on the backdrop closes it the same way and does nothing else on the page. A dialog with values typed but not applied yet (`data-dirty`, or `isDirty(el)`) ignores the backdrop click and flashes Cancel once. On open, focus goes to the first field, else the main button, else ✕. Tab stays inside. On close, focus returns to the opener. Whatever gets focus in the middle is scrolled fully into view. | UI-A16, UI-W8, UI-W13, UI-W22, UI-W23 | N: sheets.test.js; B: ui/sheets.mjs (button row and header on screen at 1366×768, 1440×900, 125 % zoom, 1366×600 and 1024×480; no field hidden while tabbing through 30 fields) |
| Toast | — | `toasts(doc).show({ text, undo, ms })` → `{ close }`. One toast at a time, bottom centre (`--te-toast-bottom`), `role="status"`. It fades after about 4 s (longer for long text) and waits while the pointer or focus is on it. Undo appears when `undo` is given. | UI-W10, UI-W13, WCAG 2.2.1 | B: ui/sheets.mjs |

**Gap G12 (for the UI Designer):** UI-W22 covers the backdrop click when a dialog holds typed values. It doesn't say whether **Esc** should also be refused then. Today Esc closes the dialog like Cancel, since Esc is a deliberate key.

**Words:** the sheets' own words (Close, Close (Esc), Undo) come from `src/strings.js` (`TrussStrings.t(key)`, plain text, keys `step.piece.name`; the Architecture Lead's pick, TE-B-387). The table's and the Members tab's defaults move there once #419 and #438 merge.

**Gallery:** sheets, dialogs and toasts have their own items (open one, type in the dialog, show a toast); they're no longer 'not built yet' cards. Branch uie/gallery-sheets stacks on #438, #433 and #441.

## Number boxes and steppers (src/inputs.js, `TrussInputs` 0.2.0)

These are for step 8, the Inputs (#215). They follow the same rules as the pieces. A box never holds its own limits: it asks a check function, and `fromLimits(TrussLimits, id, values)` builds that function from the one limits table (`src/limits.js`, RMA-4 #462), so the boxes and the file loader read the same rows (UI-I10).

| Piece | Markup | Behaviour | Rules | Tests |
|---|---|---|---|---|
| Number box + stepper | `numberHTML(P, { id, label, unit, value, title })`: a label, − and + buttons, a text box with `inputmode="decimal"`, the unit, and a `role="status"` note line | `mountNumber(el, { check, step, value, onCommit })` → `{ value, set, markFile, clear, destroy }`. While typing, the note says at once what the value would be. Enter or leaving the box commits. **limit**: refused, back to the last good value, ⟂ note. **rule**: committed; the box's edge is pink (`--rule`) and the number stays ink (ART-C1); the rule is named. Course rules come in through `fromLimits(L, id, values, rule)`. **warn**: committed, with a note. − / + and ↑ ↓ (Shift: ×10) move by the step and **stop at the wall**. Esc puts the last good value back. `markFile(value, msg)`: a file's bad value stays exactly as the file had it, marked, never clamped and never committed, until a good one is typed; a refused value or Esc goes back to the file's value. The note is quiet while typing and speaks on Enter, on leaving the box and on a stepper. The box grows with its value, 52–96 px. | UI-I2, UI-I3, UI-I9, UI-I10, ART-T2 | N: inputs.test.js; B: ui/inputs.mjs (19 checks without TrussLimits in the build, 20 with it) |

### The ✎ value editor (`TrussInputs` 0.2.0, UI-I8)

| Piece | Markup | Behaviour | Rules | Tests |
|---|---|---|---|---|
| ✎ value editor | `editorHTML(P, { id, label, unit, value, sweep: { on, from, to, step } })`: a 320 px `role="dialog"` pop-up with a ⋮⋮ title bar, the value (a number box), the joystick (`role="slider"`), the sweep range (From, To, Step and the `from → to · step = N values` line; only when `sweep` is given), then Done | `mountEditor(el, { check, sweepCheck, step, cap, opener, onCommit, onSweep, onClose })` → `{ value, show, close, destroy }`. The value commits as it changes (through the number box, so limits and rules act the same). Joystick: drag left or right, the rate grows with the square of the push (up to 20 steps/s), springs back on release, stops at a wall; ← → one step, Shift ×10. Title bar drag moves it, kept inside its container. Done applies the sweep range and closes; over the cap (400) Done is refused, nothing is cut, focus goes to Step. Esc or an outside click closes (UI-W8: that click does nothing else); focus goes back to the opener | UI-I8, UI-W20, UI-W8, UI-I1, UI-I3, UI-I4, ART-K17 | `tests/inputs.test.js`, `tests/ui/valueeditor.mjs` (17) |

**Not yet:** `asked → run` and its ⓘ (UI-I5) need the sweep planner, so they sit in the Inputs wiring. Closing when you leave its screen is the wiring's job (call `close('screen')`). The course-rule table (UI-I2's h ≤ 100, width 50–75) isn't in `limits.js`; the Inputs wiring passes those rules in its own check until it is.

### The Inputs pane on the limits table, ahead of step 8 (`src/limitrows.js`, `TrussLimitRows` 0.1.0; TE-B-494)

Off until step 8 (#215): the app mounts it only when `window.TE_FLAGS.limitsBoxes` is true, and `?limits=1` turns that on for the tests. `mount(doc, { P, I, L, pane, extra, rule })` puts a TrussInputs box + stepper on every number row the limits table names, with the check from `fromLimits`. The app's own `<input type="number">` stays in its row, hidden and out of the Tab order. It is still the value the app reads and writes, so `pair()`, `guardNum()` and the Undo toasts (#482) run as before. A value the new box commits is put into it with a `change` event; a value the app writes into it (`update()`, a slider, Undo, a file) is followed by the box. When height, tableThick, bS, hS, minOverlap or bigCap change (Math, TE-B-444), or a shape or model button is pressed, every row is checked again. braceDepth isn't checked while tableThick is 0 (TE-B-445). Course rules the table doesn't hold come in through `rule(id, v)`; today those are the bridge width 50–75 mm and the height ≤ 100 mm on the OUTER face (UI-I2; UIE-9, TE-B-577b). The height rule reads the same outer height as `TrussCore.envelopeSize` and the results' 'Height is ... over the 100 mm limit' line (Math TE-B-577), so the box turns pink at the same height the results fail; the table itself stops at 200 (#505). Tests: `tests/limitrows.test.js`, `tests/ui/limitsboxes.mjs` (21).

**Gap for Math and the UI Designer (closed):** UI-I2 calls h ≤ 100 a course rule (pink, never clamped). The limits table now stops at 200 (#505), and the height course rule above is pink, so a height over 100 mm (outer face) is allowed, marked and fails in the results.
