# Shared screen pieces: which piece meets which rule

**Version 0.1 · 2026-10-31 · owner: UI Engineer · issue #354 · for the Dev Lead, BluePeachDev, UI Designer, Graphics Designer**

balsaPixel's screens (#209–#221) and the gallery page are built from one small set of pieces in `program/src/pieces.js` (global `TrussPieces`). A UI- or ART- rule is met once, in its piece, and checked once, by its test. A screen built from the pieces meets those rules without re-reading the spec text. This page is the map: **rule → piece → test**.

This page holds no rules. The rules live in [ui-spec.md](ui-spec.md) (`UI-…`), [art-spec.md](art-spec.md) (`ART-…`) and docs/code-spec.md (`CODE-…`, PR #351). Where this page and a spec differ, the spec wins; tell the UI Engineer on the board.

## The pieces

| Piece | Builder (pure, Node) | Behaviour (browser) | Classes and parts it emits |
|---|---|---|---|
| Theme tokens | `TOKENS`, `WIREFRAME`, `tokenCSS(id, values)`, `contrast()`, `contrastPairs()` | — | `--te-*` on `#stage[data-theme="<id>"]` |
| Picture layer | — (CSS) | — | `.te-picture`: the drawing or chart goes in here |
| Window | `windowHTML({ id, title, home, state, body, icons })`, `nextState()` | `mountWindow(win, tab, { onState })` | `.s-pan` `window` · `.s-ph` `window-title` · `.stp` `stepper` |
| Edge tab | `edgeTabHTML({ id, title, home, state })` | (in `mountWindow`) | `.tabE.l/.r/.t/.b` `edge-tab` |
| Stick button, icon button, chip | `buttonHTML({ kind, label, icon, pressed, disabled })` | `mountToggle()` for a pressed button | `.s-b` `button` · `.s-ic` `icon-button` · `.te-chip` `chip` |
| Toggle | `toggleHTML({ label, checked })` | `mountToggle()` | `.te-tog[role=switch]` `toggle` |
| Tabs | `tabsHTML({ label, tabs, selected })` | `mountTabs(list, { onSelect })` | `.te-tabs[role=tablist]` `tabs` · `.tab[role=tab]` `tab` |
| Slider | `sliderHTML({ key, label, min, max, step, value, from, to, wall, rule })`, `sliderValue()` | `mountSlider(el, { onInput })` | `.te-slider` `slider` > `.trk`, `.zone.rule`, `.zone.wall`, `.band` `slider-band`, `.th[data-end=from/to/val]` |
| Results card | `resultsHTML({ checks, verdict })` | opens its full view with `popups()` | `.res` `results` · `.pill` `badge` |
| Pop-up | — | `popups(doc).open(pop, opener)` / `.close(pop)` | `.te-pop` |

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

## Gaps found while building (TE-B-224 item 3): all answered

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

- **0.1 · 2026-10-31** First set: tokens, picture layer, window and edge tab, stick button, icon button, chip, toggle, tabs, slider, results card, pop-up (#354; TE-B-224, TE-B-227).
- **0.1.5 · 2026-10-31** `install()` is safe next to the shell: rules on shared class names reach only what the pieces built (`data-pc` inside `:where()`); it's tested on the program page in Wireframe and OG (BluePeachDev's BPD-3 question 1, TE-B-235).
- **0.1.4 · 2026-10-31** After #356, #357 and #364 merged: the gaps table cites its rules (TE-B-243, TE-B-249). The tab keys cite UI-K7 instead of UI-K3 (UI's review, TE-B-232; #367). The rule map gains UI-W15, UI-W17 and UI-W18.
- **0.1.3 · 2026-10-31** ui-spec 1.5 (#364) answers G5–G10. The pieces follow UI-W15 (52 px icons, 28 px tabs, 40 % cap, 12 px edge gap) and UI-W17 (the peek sits 8 px beside its tab, lined up with its top, and closes after 400 ms).
- **0.1.2 · 2026-10-31** Graphics' review (TE-B-232): pill 13 px (ART-T2); art-spec 1.0.4 values (#357): `ctl-line #7f8893` (#355), course-rule pink from `--rule` as solid stripes (ART-K16), edged Wireframe tabs (ART-W13), 13 px pop-up (ART-W12); two more contrast pairs. G1–G4 answered.
- **0.1.1 · 2026-10-31** Added the Gaps table: what the pieces needed that no spec says (TE-B-224 item 3).
