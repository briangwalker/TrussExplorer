# Truss Explorer Art Standard (themes and art assets)

**Version 1.0 · 2026-10-28 · owner: Graphics Designer (Art Lead) · creative sign-off: Brian**

This is the one source of truth for how balsaPixel **looks and moves**: themes, tokens, materials, pictures, icons, textures and motion. Every rule has a number (`ART-…`). Build issues, pull requests and reviews cite those numbers.

- **Companion docs:**
  - [art-implementation.md](art-implementation.md): how UI, Dev Lead and Architecture Lead build a theme into the app.
  - [art-review-checklist.md](art-review-checklist.md): how a PR that touches the look is checked.
  - [ui-spec.md](ui-spec.md): **where** things are and **when** they happen (`UI-…`). This spec says **what they look like** and **how they move**. Where the two meet, one rule points to the other ([Creative Documentation Standard](ui-creative-doc-standard.md) §1).
- **Reference build:** the Motion Lab, https://claude.ai/artifact/LxaymNQizNMPGy4QaBSDUg (v14): the UI kit page (`kit.html`), motion tuning (`index.html`), pictures (`pictures.html`), and the Click-Through copies of the theme (`clickthrough/themes/`). Where the Motion Lab and this page disagree, **this page wins**. Tell Graphics on the board so the Motion Lab can be fixed.
- **Changing a rule:** Graphics opens an `art/` pull request touching only `docs/art*` (and `themes/` for assets), adds a change-log line, updates the two tables at the end, and posts a board row naming the rule numbers. Dev Lead merges (narrow standing approval for `art/` branches, Brian 2026-10-28). A dated copy goes in Drive **[30] Art Assets / Art Standard**.
- **Words:** *material* = what a surface pretends to be (paper, balsa, calculator). *Light* = paper, pencil, ink, tape, handwriting: things that come and go. *Heavy* = wood, the calculator: things that stay. *Theme* = one look for the whole stage. *Theme option* = a setting inside one theme (wood, window look, favicon).

---

## ART-P · Principles

| # | Rule | On screen | Source | Status |
|---|---|---|---|---|
| ART-P1 | **Materials carry meaning.** Temporary things are light (paper, handwriting, tape, pencil); lasting things are heavy (wood, the calculator). | A toast, tooltip or note is paper and handwriting; a window, control or readout is wood or calculator. | Brian, 2026-10-27 (Decisions row 50–58) | live in the Motion Lab |
| ART-P2 | **Heavy never sits on light.** A wooden or calculator object is never drawn on top of paper or handwriting. Light on heavy is fine. | Paper labels on a wood tray: yes. A wood button on a paper note: no. | Brian, 2026-10-27 | live |
| ART-P3 | **A theme changes looks, never places, meaning or words.** See UI-T2 for the full list. | Switching theme never moves, resizes, hides or renames anything. | UI-T2, #197, TE-B-014 | planned #221 |
| ART-P4 | **Meaning is never colour alone.** Every meaning colour comes with a letter, mark or shape (C/T/0, ✕, dashes, rings). | See UI-A17. | UI-A17 | live |
| ART-P5 | **Real objects behave like real objects.** A stick pressed in sinks and loses its front face; paper tears; ink wobbles; a calculator screen is drawn in pixels. | Pressed = lower and flat (ART-S3). Calculator buttons are pixel art (ART-W3). | Brian's notes 2026-10-26–28 | live |
| ART-P6 | **Original art only.** Every image is drawn by Graphics, generated from the theme's tokens, or photographed by Brian. No stock images, no copied logos or characters. | — | Standing Instructions rule 8 | live |

## ART-K · Tokens

A theme is a set of tokens plus per-part looks (UI-T1). These are the tokens a **shared** theme may set (data only, `formats.js`) and a **built-in** theme must set. In a `.theme.json` file the key is the CSS name without `--te-` (for example `page`, `mem-hi`).

| # | Token (`--te-…`) | Used for | Wireframe | Notebook + Calculator |
|---|---|---|---|---|
| ART-K1 | `page`, `grid` | the page behind everything; grid lines | `#f2f4f6`, faint grey | `#fbf8f1`, transparent (dots come from the texture) |
| ART-K2 | `panel`, `panel-peek` | window surfaces; a peeking window | white 94 %, 86 % | `#efdcb4`, 86 % |
| ART-K3 | `surface`, `surface-2` | cards, table rows, switch tracks | `#fff`, `#eef0f2` | `#fbf8f1`, `#f1e9d6` |
| ART-K4 | `line`, `line-soft` | window borders; dividers | `#b9c0c8`, `#d5dae0` | `#b48b52`, `rgba(110,80,40,.25)` |
| ART-K5 | `ink`, `muted` | text; secondary text | `#1d232a`, `#4f5964` | `#23262b`, `#5b6774` |
| ART-K6 | `strong`, `on-strong` | picked controls, top bar, tabs; text on them | `#3d4650`, `#fff` | `#8c5e22`, `#fff8ec` |
| ART-K7 | `ctl-bg`, `ctl-line` | unpicked controls: face and border | `#fff`, `#8e98a3` | `#ebd09b`, `#a9804a` |
| ART-K8 | `tab` | brown edge tabs | `#8a5a2b` | `#8a5a2b` |
| ART-K9 | `accent`, `accent-ink` | count badge, tour marks, **focus ring** | `#f0b45a`, `#2a1a04` | `#f0b45a`, `#2a1a04` |
| ART-K10 | `hot` | the highlighted row | `#fdebd6` | `rgba(255,210,60,.38)` |
| ART-K11 | `mem-hi`, `mem-hi-ink`, `mem-dim`, `mem-hi-flag` | the picked member (ART-D2) | `rgba(240,180,90,.6)`, `#1d232a`, `.6`, `#fff` | `#ffe14d`, `#2b1a0a`, `.85`, `#ffe14d` |
| ART-K12 | `font-ui`, `font-head`, `font-mono`, `font-hand` | text; titles; numbers and LCD; handwriting | Barlow, Barlow Semi Condensed, IBM Plex Mono, — | Barlow Semi Condensed, Kalam, VT323, Kalam |
| ART-K13 | **Images** (shared themes): `page`, `panel`, `control`, `control-pressed`, `control-end`, `screen`, `screen-key` | textures behind the parts above; `.png`, `.jpg` or `.webp`, file names only | none | `paper.webp`, `photo-balsa.webp`, `photo-balsa.webp`, `photo-top.webp`, `photo-endgrain.webp`, `lcd.png`, `pixelwood.png` |
| ART-K14 | **Never tokens.** The meaning colours (compression, tension, zero force, pass, fail) and the member-force colours on the drawing are owned by the app code and are the same in every theme except OG (UI-A18, UI-T6). | Reference values in `src/ui.html` today: C `#c23a2b`, T `#2160a8`, 0 `#9aa5af`, pass `#2f7a4b`. Fail must be **magenta + ✕** (decision 2026-10-25), but the app's `--bad` is `#b4232a` (red). That is a bug for Dev Lead: #258. | | |

A built-in theme may add private tokens with its own prefix (Notebook + Calculator uses `--nc-*` in the Click-Through and the plain names `--balsa-*`, `--stain*`, `--lcd*` in the kit). Private tokens never appear in a shared theme file.

## ART-C · Colour and contrast

| # | Rule | Values | Source | Status |
|---|---|---|---|---|
| ART-C1 | Text is at least **4.5 : 1** against what is directly behind it, measured on the texture's darkest area; large text (≥ 24 px, or ≥ 19 px bold) at least 3 : 1. | Balsa label `#3d2610` on photo balsa ≥ 7 : 1; label on stained wood `#fff8ec` ≥ 8 : 1; LCD ink `#1d2a1e` on `#c8d2b3` ≥ 9 : 1. | THEMING rules, QA #68 | live |
| ART-C2 | Lines, icons, focus rings and control edges are at least **3 : 1**. | | QA #68 | live |
| ART-C3 | **Help text on wood** uses `--te-ink` (never `--te-muted`) and at least 14 px; on a busy texture it sits on a paper label (ART-W1). | Fixes "light help text on the wood Inputs tray" (TE-B-026). | TE-B-026 | planned #221 |
| ART-C4 | **Dark mode** (`prefers-color-scheme: dark`, or the app's dark setting) uses generated wood, never the photo, and keeps every contrast above. | Notebook + Calculator: `wood = generated` in dark. | Brian, 2026-10-27 | live in kit |
| ART-C5 | Group colours (isolation tools, #148) avoid the five meaning hues. | `#7048b8`, `#d0731f`, `#13878f`, `#8a7a1f` | #148 | planned |

## ART-T · Type

| # | Rule | Values | Source | Status |
|---|---|---|---|---|
| ART-T1 | **Fonts are self-hosted**, OFL-licensed, `.woff2`, subset to Latin plus the symbols the app uses (✓ ✕ → ⇄ ▾ ▴ ‹ › Σ δ Δ σ ρ ≤ ≥ ×). Never loaded from Google or any other site. | Barlow Semi Condensed 500/600/700, Kalam 400/700, VT323 400 (and Barlow, IBM Plex Mono for Wireframe). Each family's `OFL.txt` ships beside it. | White Hat TE-B-014, TE-B-026, #3 | planned #221 |
| ART-T2 | Minimum sizes: UI text 13 px, handwriting 15 px, LCD (VT323) 16 px. Numbers on a calculator screen are VT323 at full size, condensed by tight spacing, never by shrinking. | | Brian, 2026-10-27 | live |
| ART-T3 | Handwriting (Kalam) is for light, temporary things only: toasts, tooltips, notes, labels on paper (ART-P1). Never for numbers that are results. | | ART-P1 | live |

## ART-S · Control states (sticks, keys, toggles)

| # | Rule | On screen | Values | Status |
|---|---|---|---|---|
| ART-S1 | **Default:** a balsa stick standing on the surface: top face lit, darker front face (the bottom third), cut ends in end grain, a cast shadow. | | Stick face gradient `--nc-face`; shadow `--nc-stick` | live |
| ART-S2 | **Hover:** lifts 1–2 px with a longer shadow. | | `translate(-1px,-2px)`, `--nc-lift` | live |
| ART-S3 | **Pressed / on / picked:** pushed in: 2–5 px lower, **one even colour top to bottom** (no front-face band), stained brown, a soft shadow under the top edge only, no cast shadow. | Uses the top-face texture (`photo-top.webp`, or the top of `balsa.webp` in generated wood). | `--nc-face-in` (shadow `rgba(40,20,4,.26)` → 0 at 16 %), `--nc-stain` (`#7a5120` 82 %), `--nc-wood-in`, `--nc-press` | live (Brian, 2026-10-28) |
| ART-S4 | **Disabled:** 50 % opacity and desaturated; no hover lift. | | `opacity:.5; filter:saturate(.3)` | live |
| ART-S5 | **Focus:** a 3 px `--te-accent` outline with 3 px offset, in every theme (UI-K4). Never removed, never only a colour change. | | | planned #218 |
| ART-S6 | **Picked differs from unpicked by more than colour:** height, shadow and stain all change together. | | | live |
| ART-S7 | **Glued groups:** sticks in one bar share edges; only the outer corners are rounded (4 px top, 1 px bottom). | Top bar, segmented pickers, the 2D/3D rocker. | | live |
| ART-S8 | **The 2D/3D switch is an all-wood rocker** cut from one stick: the current half is pushed in and stained, the other half stands up. Icons are burned into the wood. | | | live |
| ART-S9 | **Pixel wood keeps its grain when pressed.** A pressed pixel key is the stained pixel-wood texture (multiply), never a flat fill. | | `--pixelwood-3` × `pixelwood.png` | live (Brian, 2026-10-28) |

## ART-W · Window looks and their controls

A theme option chooses one window look; the controls inside a window are made of the same material as the window (ART-P2).

| # | Window look | Window | Toggles / buttons | Sliders (options, Brian to pick) | Status |
|---|---|---|---|---|---|
| ART-W1 | **Wood tray** (default) | a shallow balsa tray with a fixed-height header | push sticks (ART-S) | **A · stick in a tray** (current): balsa groove, the swept range pencilled in blue, end-grain ends, a stained value block | live |
| ART-W2 | **Paper labels** | a wooden block with paper labels | paper labels; on = an ink bar on the left edge | **C · paper ruler**: ruled paper tape, blue highlighter range, inked [ ] ends, ink pointer | option |
| ART-W3 | **Calculator** | the window is a small calculator; its rows are on the screen | **pixel art only** (UI-T5): pixel-wood keys, 2 px ink border, hard 2 px shadow; pressed = stained and sunk 2 px | **B · calculator**: dotted pixel track, checker range, [ ] keys, pixel-wood value key | live in the Click-Through |
| ART-W4 | **Tape labels** | wood tray with masking-tape labels | tape labels | **D · tape**: masking tape strip, blue felt-tip range, folded tape flags, push-pin value | option |
| ART-W5 | Every slider option keeps **three different handle shapes** (two range ends, one value), shows the swept band, and shows UI's limit zones (pink hatch for course rules, grey wall for model limits, UI-I2/I3). | | | | live |
| ART-W6 | The slider look **follows the window look** (one setting). | | | Graphics' call 2026-10-28 (Brian had no preference) | planned |
| ART-W7 | **Sweep window, icons state:** a square ▶ key (36 px), the count, and the fold keys; no words. | | | Brian, 2026-10-28 | live |
| ART-W8 | **Re-check sheet:** a thick paper block; both choices on one torn scrap with an inked "or", circled in black ink on hover. | | | Brian, 2026-10-27 | live in kit |
| ART-W9 | **Value tag editor:** the calculator pop-up with a joystick and a move bar (UI-I8 sets its size and behaviour). | | | Brian, 2026-10-27 | live in kit |

## ART-D · The drawing

| # | Rule | Values | Source | Status |
|---|---|---|---|---|
| ART-D1 | Member colours, widths and the C/T/0 labels come from the app; a theme may change the page, grid, joint symbols, supports, dimension lines and value tags only. | | ART-K14, UI-T2 | live |
| ART-D2 | **Picked member:** a halo in `--te-mem-hi` 4.6 × the line width, an ink outline 2.1 ×, the member colour 1.3 ×, ink rings (r = 2.2 × width) on both joints and its number in an ink flag; other members fade to `--te-mem-dim`. | Notebook + Calculator: yellow highlighter `#ffe14d`, ink `#2b1a0a`, others at 85 %. Comparison: Motion Lab `pip-art.html`. | Click-Through notes 2026-10-27; UI-D5 | live in the Click-Through |
| ART-D3 | **Books** are drawn as hardback books (cover colour, page edges, spine band). **The wood pile** is a bundle of square sticks seen end-on with end-grain rings and two twine loops. They never look alike. | `books.svg`, `woodpile.svg` | UI-D3 | live in the Click-Through |
| ART-D4 | No label is drawn twice: when UI's ✎ tag names the load, `books.svg` carries no text. | | UI-D6 | live |
| ART-D5 | **Value tags** on the drawing are small balsa tags (current) or, when edited, the calculator pop-up (ART-W9). | `data-part="value-tag"` | | live |

## ART-H · Pictures and hooks

Pictures are SVG and ship only in **built-in** themes for 1.0 (UI-T3). Every picture uses the hooks below; UI-T4 states the same hooks from the UI side.

| # | Rule | Hook | Source | Status |
|---|---|---|---|---|
| ART-H1 | Each category picture is `pictures/<category id>.svg`, viewBox `0 0 300 120`, class `te-catpic`, with `role="img"` and an `aria-label`. Ids: `shape`, `geo`, `sup`, `load`, `sticks`, `mat`, `rules`, `d3`, plus `topchord-note.svg`. | | #129 | live in the Click-Through |
| ART-H2 | Every part that belongs to an input is a group `<g data-in="key …">` holding the part twice: first a `.hl` copy (the highlighter underlay), then the drawn copy. The page adds class `lit` to the hot input's groups. | `pictures.css`: `.hl` stroke 10, lit = `rgba(255,153,51,.55)` | #129 | live |
| ART-H3 | Books in `load.svg` are groups `book1`, `book2`; for more books the page stacks copies of the last group, offset `translate(2·n, −9·n)`. The mass label sits outside the book groups and reads "2.5 kg in all". | `g[data-in~="book1"]` | UI-I6, UI-I7 | live |
| ART-H4 | **Tilt in `d3.svg` is a shear, not a rotation.** Near truss: `data-lean="right"`; far truss: `data-lean="left"`; both `data-lean-origin="center bottom"`, `data-lean-shear="1.34 0.82"`. With T = tan(tilt): right = `matrix(1,0,−1.34·T,1+0.82·T,0,0)`, left = `matrix(1,0,1.34·T,1−0.82·T,0,0)`, `transform-box: fill-box`. Top bracing: `data-lean="in"`, `data-lean-matrix="3.84 2.34 145.8 88.8"` → SVG attribute `matrix(1,0,3.84·T,1−2.34·T,−145.8·T,88.8·T)`. | | UI-I6 (UI's hook rotates today; needs the shear) | planned #215 |
| ART-H5 | Drawing pictures: `pictures/woodpile.svg` and `pictures/books.svg`, class `te-drawpic`, `data-pic="woodpile"` / `"books"`; drawn at the size the drawing sets, viewBox kept and centred. Missing = the built-in shapes. | | UI-T4 | live in the Click-Through |
| ART-H6 | SVG pictures contain no script, no `on*` attributes, no `foreignObject`, no external `href`, no embedded raster images, and only these fonts: the theme's hand font via class `hand`. | | White Hat TE-B-014 | live |

## ART-I · Icons

| # | Rule | Values | Status |
|---|---|---|---|
| ART-I1 | One SVG sprite per theme (`icons.svg`), symbols `i-<name>`, 24 × 24 viewBox, hand-drawn strokes 1.8–2 px, round caps and joins, `currentColor`, filled dots only via class `fill`. Each symbol has a `<title>`. | 25 icons today: menu, back, help, info, shrink-l, shrink-r, expand, full, grip, close, pip, sweep, edit, run, export, files, home, truss2d, truss3d, chart2d, chart3d, dims, forces, deformed, nodes | live in kit |
| ART-I2 | An icon is never the only label for a control a screen reader reaches: the button keeps `aria-label` (UI-T2). | | live |
| ART-I3 | Icons on pixel wood or an LCD are drawn on the LCD pixel grid (no anti-aliased curves at < 24 px). | | live |

## ART-X · Textures and image assets

| # | Rule | Values | Status |
|---|---|---|---|
| ART-X1 | **Formats:** photos and painted textures `.webp` (quality 80, no alpha unless needed); pixel art `.png` (indexed, `image-rendering: pixelated`); pictures and icons `.svg` (built-in only, ART-H6). No GIF, no JPEG in shipped themes. | | live |
| ART-X2 | **Sizes:** tiles are powers of two or the size they're drawn at (paper 512 × 512; balsa side 827 × 144; top face 400 × 79; end grain 256 × 256; pixel wood 96 × 24). Photos ≤ 1600 px on the long side. | | live |
| ART-X3 | Every tile is **seamless** in the direction it repeats; a stick texture repeats only along the grain. | | live |
| ART-X4 | **Budget:** a whole built-in theme (CSS, images, pictures, icons, fonts excluded) is **under 400 KB**; Notebook + Calculator is about 154 KB today. Fonts are shared between themes and counted once. | | live |
| ART-X5 | **Names:** lower-case, hyphens, what it is then a variant: `photo-balsa.webp`, `photo-top.webp`, `endgrain-2.webp`, `calc-te.svg`. No spaces, no version numbers in file names (the spec's change log carries versions). | | live |
| ART-X6 | Images are referenced only by relative file names inside the theme folder. No `http(s)` URLs, no `@import`, no data from another site. | | planned #221 (the Click-Through copy still `@import`s Google Fonts; ART-T1 removes it) |
| ART-X7 | **Photo wood** is the default in light mode (Brian's photos of real balsa). Generated wood (made from the colour tokens) is the dark-mode wood and the fallback when a photo is missing. | | live |
| ART-X8 | **Higher-quality photos** of the stick side, top face and the TE cut end replace the current ones when Brian supplies them (#134). The file names stay the same. | | blocked #134 |

## ART-M · Motion

UI owns **when** something moves (UI-M); this section owns **how**. Every motion has an off switch and a reduced-motion version (UI-M6). The numbers below are Brian's picks in the Motion Lab and are the defaults.

| # | Rule | Values (defaults) | Reduced motion | Source | Status |
|---|---|---|---|---|---|
| ART-M1 | **Scene transition** (Truss ↔ Analysis, Notebook + Calculator): the sweep line grows into the calculator and the paper slip zooms back, as **one damped spring** (no stop-then-bounce), with no flashes or black frames; the screen never shows what's behind it. | length **1000 ms**; anticipation 16 %; overshoot 8 %; stiffness 7; smear 1; ghosts 3; gap 0.06; dot delay 150 ms; dot time 1800 ms | 150 ms cross-fade | Brian, Motion Lab 2026-10-26 | planned #143 |
| ART-M2 | The spring is a damped step response: ζ from the overshoot, `ζ = −ln(os) / √(π² + ln² os)`, ω = stiffness, with a smoothstep tail over the last 8 % so it lands exactly. After landing the screen is clamped so it never pulls back past the edge. | | | Motion Lab `springX` | planned #143 |
| ART-M3 | **Restless bridge** (how it moves): the whole bridge wiggles; the part about to change shakes more; the ✎ tag pops and stains brown; a handwritten note appears. | mode **warn**; wiggle 50 %; changing part 120 %; shake 1.6 s | no wiggle; the change just happens | Brian, 2026-10-27 | planned #144 |
| ART-M4 | **Value tags put away** (when the view changes): tags fly to the Drawing window along an arc and shrink. | 650 ms each, 70 ms stagger, arc 70 px, lift 6 px, overshoot 6 %, stiffness 8, size 30 %, spin 14°, fade 70 %, nearest first, reverse on return | instant | Motion Lab | planned #143 |
| ART-M5 | **Press:** 120 ms ease-out. **Panel open/fold:** 280 ms. | `--t-press`, `--t-panel` | instant | | live |
| ART-M6 | **Chart dots** plot right to left like a TI-84, in LCD cells; the dot size and the LCD pixel size are separate settings. | dot 6 px; LCD pixel 3 px (choices 2, 3, 4, 6, 8) | dots appear at once | Brian, 2026-10-26 | planned #211 |
| ART-M7 | **Undo mark:** a hand-drawn red circle, redrawn with a new random wobble on every hover. | | static circle | Brian, 2026-10-27 | live in kit |
| ART-M8 | **UI-M5 says transitions last under 0.9 s; Brian picked 1000 ms in the Motion Lab.** Until Brian settles it, ART-M1 keeps 1000 ms and the setting goes from 100 to 6000 ms. | | | conflict | needs Brian |

## ART-O · Theme options (settings inside one theme)

All live under ☰ › Look and controls › Theme (UI-A16). They change looks only.

| # | Option | Values | Default | Status |
|---|---|---|---|---|
| ART-O1 | Wood | photo · generated | photo (dark mode: generated) | live in kit |
| ART-O2 | Window look (also picks the slider, ART-W6) | tray · calculator · paper labels · tape labels | tray | live in kit; calculator in the Click-Through |
| ART-O3 | Favicon | calc-te · calc-ok · calc-smile · end-hand · end-calc · random | calc-te | live in kit |
| ART-O4 | LCD pixel size; chart dot size | 2–8 px; 2–12 px | 3 px; 6 px | live in kit |
| ART-O5 | Motion tuning (ART-M1–M4 numbers), with Reset to defaults | | Brian's picks | live in the Motion Lab |

## ART-A · Asset register

Every shipped file of the built-in Notebook + Calculator theme, and the rules that use it. Paths are relative to `themes/notebook-calc/`.

| File | Size | Rules |
|---|---|---|
| `notebook-calc.css` (Click-Through build) / `theme.css` (kit build) | 25 KB / 92 KB | all |
| `paper.webp` | 3.7 KB | ART-K13, ART-W2 |
| `photo-balsa.webp` | 6.7 KB | ART-S1, ART-X7 |
| `photo-top.webp` | 1.5 KB | ART-S3 |
| `photo-endgrain.webp` | 7.1 KB | ART-S1, ART-W1 |
| `balsa.webp`, `endgrain.webp` | 2.9 KB, 3.4 KB | generated wood, ART-C4 |
| `lcd.png` | 11.3 KB | ART-W3 |
| `pixelwood.png` | 0.2 KB | ART-W3, ART-S9 |
| `plastic.webp` | 4.7 KB | calculator bezel |
| `pictures/shape.svg`, `geo.svg`, `sup.svg`, `load.svg`, `sticks.svg`, `mat.svg`, `rules.svg`, `d3.svg`, `topchord-note.svg`, `pictures.css` | 1–14 KB each | ART-H1–H4, ART-H6 |
| `pictures/woodpile.svg`, `books.svg` | 6.9 KB, 0.9 KB | ART-D3, ART-H5 |
| `icons.svg` | 4.9 KB | ART-I1 |
| `favicons/calc-te.svg`, `calc-ok.svg`, `calc-smile.svg`, `end-hand.svg`, `end-calc.svg` | 1–13 KB | ART-O3 |
| `textures/balsa-*.webp`, `endgrain-1..3.webp` (kit build) | 1–11 KB | ART-S1, ART-S3 |
| `preview.webp` | 20 KB | theme picker thumbnail |
| `textures.js`, `settings.js`, `hand.js` (kit build only) | 9 / 12 / 3 KB | prototype code; replaced in the app (see art-implementation.md §4) |

---

## Build steps and the rules they must meet

| Step | Issue | Must meet |
|---|---|---|
| 2 · Truss 2D full screen | #209 | ART-D1–D5, ART-S1–S9, ART-W1, ART-C1–C3, ART-I1–I2 |
| 3 · Sweep bar, results card, PIP | #210 | ART-D2, ART-W7, ART-W3 (results strip) |
| 4 · Analysis full screen | #211 | ART-M6, ART-C5 |
| 8 · Inputs screen | #215 | ART-H1–H4, ART-H6, ART-W5, ART-W6 |
| 11 · Keyboard and screen readers | #218 | ART-S5, ART-I2 |
| 13 · First-time tour | #220 | ART-M3 |
| 14 · Themes and OG | #221 | ART-P1–P6, ART-K1–K14, ART-C1–C4, ART-T1–T3, ART-W1–W9, ART-X1–X7, ART-O1–O5, ART-H5 |
| Transitions | #143 | ART-M1, ART-M2, ART-M4, ART-M5 |
| Restless bridge | #144 | ART-M3 |

## Coverage: rules not yet cited by a build issue

| Rules | Issue that should cover them | Note |
|---|---|---|
| ART-K14 (fail colour) | #258 | `--bad` in `src/ui.html` is red `#b4232a`; the decision is magenta + ✕ |
| ART-T1, ART-X6 | #221 (and TE-B-026) | self-hosted fonts; drop the Google Fonts `@import` |
| ART-H4 | #215 | UI's hook rotates; switch to the shear |
| ART-M8 | needs Brian | 1000 ms vs UI-M5's 0.9 s |
| ART-X8 | #134 | waiting on Brian's photos |
| ART-W2, ART-W4, slider options C and D | #221, after Brian picks | options only |

## Change log

- **1.0 · 2026-10-28** First numbered art standard. Gathers theme 1.0–1.2 (Motion Lab v1–v14), Brian's notes 2026-10-25 to 2026-10-28, the light/heavy rule and the photo/generated wood decision (Decisions rows 50–58), White Hat's limits (TE-B-014), UI's theme boundary (#109, UI-T1–T6), and the Click-Through notes (PIP member colour, books vs wood pile). Follows the Creative Documentation Standard 1.0.
