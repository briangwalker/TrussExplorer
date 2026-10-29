# Building themes into balsaPixel (implementation guide)

**Version 1.0 · 2026-10-28 · owner: Graphics Designer (Art Lead) · for UI Designer, Dev Lead, Architecture Lead**

[art-spec.md](art-spec.md) says what a theme must look like (`ART-…` rules). This guide says **how to build it** into the balsaPixel-1.0 code, **who builds which part**, and **how a theme gets from Graphics to the live page**. It doesn't repeat the rules; it cites them.

Reading order:
- **Dev Lead:** §2, §3, §4, §6 and §8.
- **Architecture Lead:** §2, §3, §5 and §7.
- **UI Designer:** §1, §4 and §8.

---

## 1. Who owns what

| Piece | Owner | Notes |
|---|---|---|
| The look: tokens, textures, pictures, icons, motion curves, theme CSS | Graphics | `themes/<id>/`, `docs/art*` (via `art/` PRs; Dev Lead merges) |
| Where things are, when they happen, the hooks the page exposes | UI | `docs/ui*`, the Click-Through |
| The hooks in the app, the settings sheet, the motion engine | Dev Lead | `src/shell.js`, `src/shell.css`, `src/app.js` |
| Packing themes into the page, the shared theme format, the tests that guard both | Architecture Lead | `build.py`, `src/formats.js`, `tests/` |
| Security check of anything under `themes/` | White Hat | every PR that touches `themes/` |
| Final look and feel | Brian | creative sign-off |

A hook always has two rules: UI states the hook (`UI-T4`) and Graphics states the asset (`ART-H…`). Dev Lead builds the hook from both.

## 2. The theme package in the repo

Target layout, beside today's `themes/index.json` on balsaPixel-1.0 (path `program/themes/`):

```
themes/
  index.json                 format truss-explorer-theme-index, version 1
  blueprint.css              sample (one file, no folder)
  notebook-calc/
    theme.css                every rule scoped to #stage[data-theme^="notebook-calc"]
    options.css              the theme options (ART-O): [data-wood], [data-window] variants
    paper.webp  photo-balsa.webp  photo-top.webp  photo-endgrain.webp
    balsa.webp  endgrain.webp  lcd.png  pixelwood.png  plastic.webp
    icons.svg                symbol sprite (ART-I1)
    pictures/                category pictures, topchord-note.svg, woodpile.svg, books.svg, pictures.css
    favicons/                calc-te.svg  calc-ok.svg  calc-smile.svg  end-hand.svg  end-calc.svg
    preview.webp             thumbnail for the theme picker
    README.md                what the theme is, its options, its file list (= ART-A)
  fonts/                     shared by every theme (ART-T1)
    barlow-semi-condensed-*.woff2  kalam-*.woff2  vt323-400.woff2  ...  OFL.txt per family
```

**One theme, three ids today.** `index.json` lists `notebook-calc`, `notebook-calc-gen` and `notebook-calc-calc` as three themes. Once the theme options exist (§4.3), these become one theme `notebook-calc` with options `wood` and `window`. Until then, keep the three ids: they're how the Click-Through tests the options.

`index.json` entry (unchanged format, plus an optional folder key):

```json
{ "format": "truss-explorer-theme", "version": 1, "id": "notebook-calc", "name": "Notebook + Calculator",
  "css": "notebook-calc/theme.css", "folder": "notebook-calc" }
```

## 3. Packing it into the one-file page (Architecture Lead)

Today `build.py` inlines each theme's CSS as a string (`theme_pack()`), and the repo's `notebook-calc.css` is the hand-made one-file build with every image as a data URI (190 KB). Graphics would rather keep a real folder and have the build do the packing. Proposal, for an `arch/` PR:

1. **Images:** while packing a theme's CSS, replace every `url("<relative file>")` with a `data:` URI of that file.
   - Allowed: `.webp` `.png` `.jpg` `.svg` `.woff2`.
   - Refuse with a clear error: absolute URLs, `..`, and files outside the theme folder or `themes/fonts/`.
2. **Pictures:** add `pictures` to the pack, `{ "<theme id>": { "<picture id>": "<svg text>", "css": "<pictures.css>" } }`.
   - Clean each SVG with the same rules the Click-Through uses (strip `<script>`, `on*` attributes, `foreignObject`, `javascript:`). The build refuses an SVG that needed cleaning, so a bad file fails CI rather than shipping cleaned.
3. **Icons:** inline `icons.svg` once, as a hidden sprite at the top of `#stage`.
4. **Fonts:** pack the `@font-face` rules from `themes/fonts/fonts.css` into the page's `<style>`, with each `.woff2` as a data URI.
   - Only the active theme's families are needed at first paint. The rest can be packed and left unused (they're small once subset).
5. **Budget check** (ART-X4): the build prints each theme's packed size and fails over 400 KB (fonts counted separately).
6. **Determinism:** same input, same bytes (as `run_all.sh` already checks).

Until this lands, Graphics keeps handing over the one-file CSS (as it does for the Click-Through), and Dev Lead drops it in as `themes/notebook-calc.css`.

## 4. What the app must provide (Dev Lead)

### 4.1 Parts and states

The contract is `data-slot` + `data-part` (UI-T1), already started in `shell.js` (`PARTS`, `tagAll()`). Notebook + Calculator also styles these classes from the Click-Through, so keep their names or add the part names below.

| Part | Needed for | Markup the theme expects |
|---|---|---|
| `slider` with `slider-band`, `slider-thumb` | ART-W1–W6 | `.te-slider > .trk + .band + .th[data-end="from"\|"to"\|"val"]`, `data-swept` on the slider |
| `number` | ART-T2, growing boxes | `.te-num`; `aria-invalid="true"` on an error |
| `chip`, `sweep-toggle`, `picker`, `option`, `toggle`, `stepper` | ART-S, ART-W3 | `.te-chip`, `.te-swt`, `.te-pick`, `.te-opt`, `.te-tog[role=switch]`, `.stp` |
| `value-editor`, `joystick` | ART-W9 | `.te-editor`, `.te-joy` |
| `category-picture`, `sticky-note` | ART-H1, ART-H2 | an element the picture SVG goes into |
| `results`, `badge` | ART-W3 | `.res` (it already has its own bezel; it isn't a window) |
| state on any control | ART-S3, ART-S6 | `aria-pressed` / `aria-checked` / `aria-selected`, mirrored as `.on` (`tagAll()` does this) |

### 4.2 Picture hooks (ART-H, UI-T4)

- **Category pictures:** if the active theme has `pictures[<cat id>]`, insert that SVG instead of the built-in drawing. On hover or focus of an input row, add class `lit` to every `g[data-in~="<key>"]` in that card's picture, and remove it on leave. The Click-Through's `catPic()` and `stickyNote()` do exactly this.
- **Sticky note:** insert `topchord-note.svg`. Give each `<g data-in="top opt-<value>">` `role="button"`, `tabindex="0"`, `aria-pressed` and `aria-label="Top chord: <value>"`, and make it pick that value.
- **Books (ART-H3):** show `book1` … for the Books input. For three or more books, clone the last group with `transform="translate(2·n, −9·n)"`.
- **Tilt (ART-H4): shear, don't rotate.**
  - **The two trusses.** For each `[data-lean="left"|"right"]` group, read `data-lean-shear="a c"`. With T = tan(tilt angle), set `style.transform`:
    - right: `matrix(1, 0, −a·T, 1 + c·T, 0, 0)`;
    - left: `matrix(1, 0, a·T, 1 − c·T, 0, 0)`.

    Use `transform-box: fill-box` and `transform-origin` from `data-lean-origin` (default `center bottom`).
  - **The bracing.** For `[data-lean="in"]`, read `data-lean-matrix="a b c d"` and set the SVG attribute `transform="matrix(1, 0, a·T, 1 − b·T, −c·T, d·T)"`, in user units with no transform-origin.
- **Drawing pictures (ART-H5):** draw `woodpile.svg` and `books.svg` in the boxes the drawing already reserves for its built-in shapes, viewBox kept and centred. When `books.svg` is used, the drawing draws no books label of its own (ART-D4, UI-D6).

### 4.3 Theme options (ART-O)

Add a **Theme** section to ☰ › Look and controls (UI-A16):
- the theme picker (already there);
- the active theme's options, read from its `index.json` entry: `"options": { "wood": { "values": [...], "default": "photo", "dark": "generated" }, … }`.

Apply each option as an attribute on `#stage`, e.g. `data-wood="photo"` and `data-window="calc"`, which the theme's CSS selects on. Save the options in `S.shell.themeOpts[<theme id>]`, next to `S.shell.theme`. This adds no new storage key, and the Click-Through-era `te-*` keys are not carried over.

Two of the options need small pieces of code:
- **Favicon:** set `<link rel="icon">` to the chosen packed SVG, or pick one at random per visit when the choice is `random`.
- **Pixel size and dot size:** set them as CSS variables on `#stage` (`--lcd-pixel`, `--te-dot`) and pass them to the chart code (ART-M6).

### 4.4 Tokens the code reads

- **Picked member (ART-D2):** the drawing reads `--te-mem-hi`, `--te-mem-hi-ink`, `--te-mem-dim` and `--te-mem-hi-flag` with `getComputedStyle(stage)` when it draws. The widths in ART-D2 are the drawing's, not the theme's.
- **Meaning colours (ART-K14):** come from the app, never from `--te-*`. #197 keeps them where theme styles can't reach them.
- **Fix needed (#258):** the app's fail colour `--bad` is `#b4232a` (red). The decision is magenta + ✕, so it should be magenta, e.g. `#b0177a` light / `#f07cc4` dark as in the Click-Through.

### 4.5 Motion (ART-M)

The Motion Lab's code is a prototype. For the app, put it in one module, **`src/motion.js`**:
- **Where the code comes from:** `springX`, `zetaOf`, `phases`, the tag put-away and the wiggle, copied from the Motion Lab's `index.html` and `te-draw.js`.
- **Defaults:** the `"motion"` block of `themes/notebook-calc/theme.json` (= ART-M1, M3, M4).
- **Timing (UI's rules):** *when* to run comes from UI-M1–M7. Every motion takes one `reduced` flag from `matchMedia('(prefers-reduced-motion: reduce)')`; the reduced versions are in the ART-M table.

The Motion Lab's tuning panel doesn't ship. The app gets only the ☰ switches (UI-M6), plus ART-O5 if Brian asks for it.

## 5. Shared (data-only) themes (Architecture Lead)

`docs/formats.md` already has the safe format: tokens, image file names and font names, checked by `formats.js` (TE-B-014). This is the token list it asks for (TE-B-010):

- **Tokens:**
  - **keys:** exactly the ART-K1–K12 names without `--te-` (`page`, `grid`, `panel`, `panel-peek`, `surface`, `surface-2`, `line`, `line-soft`, `ink`, `muted`, `strong`, `on-strong`, `ctl-bg`, `ctl-line`, `tab`, `accent`, `accent-ink`, `hot`, `mem-hi`, `mem-hi-ink`, `mem-dim`, `mem-hi-flag`, `font-ui`, `font-head`, `font-mono`, `font-hand`);
  - **values:** colours, numbers, or one hosted font name each;
  - **mapping:** `formats.js` turns them into `--te-<key>` on `#stage[data-theme="<id>"]`.
- **Images:** the ART-K13 keys (`page`, `panel`, `control`, `control-pressed`, `control-end`, `screen`, `screen-key`) → `.png`, `.jpg` or `.webp` in the theme's own folder. A small built-in "shared base" stylesheet uses these images on the matching parts, so a data theme gets textures without any CSS of its own.
- **Not in 1.0:** pictures (SVG), icons, options, motion. Those exist only in built-in themes (UI-T3).
- **Check the contrast too:** `check()` warns (not refuses) when `ink` on `page`/`panel`/`surface` is under 4.5 : 1, or `on-strong` on `strong` is (ART-C1). The app shows the warning before applying the theme.

## 6. Fonts (Dev Lead + Graphics; TE-B-026)

1. **Graphics (`art/` PR):** adds `themes/fonts/` with subset `.woff2` files, a `fonts.css` of `@font-face` rules (relative URLs, `font-display: swap`) and each family's `OFL.txt`.
2. **Graphics:** removes the Google Fonts `@import` from every theme CSS (ART-X6).
3. **Architecture Lead:** packs them (§3.4). Then the website's CSP can stay `'self'`.

## 7. Tests (Architecture Lead)

Add these to `run_all.sh` (CI runs it):

| Test | Fails when | Rules |
|---|---|---|
| theme-pack | a theme's packed size is over 400 KB; a `url()` points outside its folder; any `http`/`@import`; an unknown file type | ART-X4, ART-X6 |
| picture-clean | an SVG in `pictures/` has script, `on*`, `foreignObject`, an external `href` or an embedded raster | ART-H6 |
| picture-hooks | a category picture lacks `role="img"`/`aria-label`; `load.svg` lacks `book1`/`book2`; `d3.svg` lacks `data-lean` groups with their numbers | ART-H1, ART-H3, ART-H4 |
| contrast | for each built-in theme, the ART-C1 text pairs drop under 4.5 : 1 (computed from the tokens, plus the darkest pixel of each texture under text) | ART-C1, ART-C2 |
| meaning-colours | a theme sets `--comp`, `--tens`, `--zero`, `--ok`, `--bad` or the member colours | ART-K14 |
| screenshots | (Playwright) the Truss and Inputs screens in each theme at 1440 × 900, saved as test artifacts for review; not compared pixel by pixel | review aid |

## 8. How a theme change gets to the app

1. **Brian's note** on the Motion Lab or the Click-Through, or a decision on an issue.
2. **Graphics prototypes it** in the Motion Lab and tests it on a local copy of the Click-Through.
3. **Graphics opens an `art/` PR** into balsaPixel-1.0, touching only `docs/art*` and `themes/**`. It contains:
   - the rule changes;
   - the change-log line;
   - the build-step and coverage tables;
   - the theme files;
   - screenshots at 1440 × 900 and 1152 × 1062.
4. **Reviews:**
   - White Hat reviews anything under `themes/`;
   - UI reviews if it touches a hook;
   - Dev Lead merges.
5. **Issues:** Graphics comments on each affected build issue with the rule numbers ([Creative Documentation Standard](ui-creative-doc-standard.md) §3.4).
6. **Board row:** "ART-… changed (spec 1.x): what, which issues."
7. **Drive copy:** Graphics saves the dated copy of `docs/art*` in **[30] Art Assets / Art Standard**.
8. **Click-Through copy (optional):** UI copies the theme files into the Click-Through for Brian's next test, or Graphics hands them over as a zip on #108.

## Change log

- **1.0 · 2026-10-28** First version. Packing proposal (§3), hooks (§4), shared format token list (§5, answers TE-B-010), fonts (§6, answers TE-B-026), tests (§7), flow (§8).
