# Truss Explorer UI Standard

**Version 1.2 · 2026-10-28 · owner: UI Designer · creative sign-off: Brian**

This is the one source of truth for how balsaPixel looks and behaves. Every rule has a number (`UI-…`). Build issues, pull requests and reviews cite those numbers.

- **Reference build:** the Click-Through test page (version 17), https://claude.ai/artifact/LcGGba4i1LQ3RBaRkumRSf. It's a clickable wireframe of every rule here. Where this page and the Click-Through disagree, **this page wins**. Tell UI on the board so the Click-Through can be fixed.
- **Background:** the Full-Screen UI Spec (https://claude.ai/artifact/2FRogn4xehALxypnuBB44y), the design canvas (https://claude.ai/artifact/B6wbMfBwERvYGDAALyiWtD), and Brian's Interface & Program Design Axioms. They explain *why*. This page says *what*.
- **Changing a rule:** UI opens a `ui/` pull request touching only `docs/ui*`, adds a line to the change log at the bottom, and posts a board row naming the changed rule numbers. Dev Lead merges it. Brian's notes on the Click-Through are the usual source of changes.
- **Checking a build:** see [ui-review-checklist.md](ui-review-checklist.md). A pull request that changes the window layout (`shell.js`, `shell.css`, the drawing, chart or Inputs UI) lists the rules it meets and gets a UI review comment. The review doesn't gate merging; Dev Lead still merges.

Words: **window** = a floating panel with three states (UI-W). **Pop-up** = a menu, list, card or editor that opens from a button and closes again (UI-W8). **Picture** = the full-screen drawing or chart under everything (UI-A3).

---

## UI-A · Core rules

| # | Rule | What it means on screen |
|---|---|---|
| UI-A1 | **Like things have like abilities** | 2D and 3D have the same tools and the same windows. Every chart has the same options window. |
| UI-A2 | **Same thing, same place** | Run sweep is always in the bottom-left sweep bar. A view's options window sits under the top bar, at the left. The PIP tab and ⓘ are always bottom-right. |
| UI-A3 | **The picture is the base layer** | The bridge drawing (2D or 3D) or the chart fills the whole stage. Every window floats over it. Opening, closing, resizing or moving a window never moves or resizes the picture. Nothing is laid out as a page section. |
| UI-A4 | **Every window has three states** | Words + icons → icons only → brown edge tab, stepped by one ‹ button. The top bar and the PIP follow the same rule. |
| UI-A5 | **☰ is always visible** | Even when the top bar is a tab. |
| UI-A6 | **The top bar is where people go** | It holds only the two places, **Truss** and **Analysis**, each with its own 2D/3D switch, plus ☰, ← and the last-tab icon. |
| UI-A7 | **One 2D/3D switch per place** | The only 2D/3D switches are the two in the top bar. No window has a second one (no "3D bridge / 2D side view", no "Trade-off chart · 2D · 3D"). |
| UI-A8 | **You can always get where you'd expect** | The word Analysis returns to where you last were; its switch always lands on the chart. The last-tab icon jumps back to your last Analysis tab, and ← undoes the trip. No button leads to a dead end. |
| UI-A9 | **Each view remembers itself** | Truss and Analysis each keep their own 2D/3D setting and their own window layout. |
| UI-A10 | **Hover previews, click loads** | Dots and History or Winners rows preview on hover and load on click. There are no Load buttons on rows. P pins a preview to compare. |
| UI-A11 | **A preview never looks loaded** | A preview is drawn dashed and "taped on" with NOT LOADED; the loaded bridge is solid. The Truss view always shows a state badge under the results strip: **✓ LOADED #id**, or **PREVIEW #id · NOT LOADED** with *Load it* and *Back to #id*. |
| UI-A12 | **Inputs live on the drawing** | Every input is an engineering dimension with a ✎ value tag. The Inputs window is for fine-tuning; the Inputs screen is for precise sweeps. |
| UI-A13 | **Results live on the drawing** | The books stack on the deck, the wood pile sits on the floor under the bridge, and δ, determinacy and "fits" are callouts. The results card then shows numbers only. |
| UI-A14 | **Never a blank screen** | Before a sweep, the chart shows your bridge as one dot and points to Run sweep. Stale or partial results say so and offer the fix (UI-S5). |
| UI-A15 | **Start small** | Windows open as icons; only one window per side is wide. H clears the screen; hovering a tab peeks. |
| UI-A16 | **Rare things live in ☰** | Export, files, theme, view settings (cube, ring, Home, restless bridge, transitions), keys and help. Sheets open in the middle, one at a time; Esc closes them. |
| UI-A17 | **Meaning is never colour alone** | C / T / 0 letters, ✕ for fails, dashes for previews, shape cues for picked members (UI-D5). |
| UI-A18 | **Meaning colours never change** | Compression red, tension blue, zero-force grey, pass green, fail **magenta + ✕**. Grey means zero force only, never "fails". Themes can't change these (UI-T2); OG is the only exception, kept as-is. |

## UI-W · Windows and where they sit

| # | Window | Home | Words + icons | Icons only | Tab |
|---|---|---|---|---|---|
| UI-W1 | **Top bar** | top left | ☰ · ← · Truss [2D/3D] · Analysis [2D/3D] [last tab] · ‹ | ☰ · ← · the two switches · last tab | ☰ + "› Truss · 2D" |
| UI-W2 | **Results card** | top centre | numbers only (Σ · kg · δ · m + r = 2j) + PASSES/FAILS pill; ▾ opens the full card as a pop-up | — | — |
| UI-W3 | **View options** (Analysis options; in 3D Truss its Look-from part moved to the cube, UI-V) | under the top bar, left | tabs, that screen's tools, a count line | tab icons, then tool icons | ▸ named with the open tab |
| UI-W4 | **Inputs** (fine-tuning) | left edge | steppers and sweep ranges; ⤢ opens the Inputs screen | category icons | ▸ INPUTS |
| UI-W5 | **Drawing** | **right edge** | toggles (dimensions, forces, numbers, results on drawing, deformed shape, sweep ranges) + the legend | toggle icons | ◂ DRAWING |
| UI-W6 | **Sweep bar** | bottom left; opens in the **words state** by default | count line ▾ (data sheet, re-check) + progress + Run sweep | ▶ + count | ▴ SWEEP |
| UI-W7 | **PIP** | bottom right, above ⓘ; the tab is **always there** | the other screen, live | numbers only | ◂ ⧉ PIP |
| UI-W8 | **Pop-ups close on an outside click** | — | A pointer-down outside any pop-up (☰, results card, ✎ editor, picker lists, ⓘ box, PIP ▾, sweep ▾) closes it and **does nothing else**. Esc closes the top-most pop-up and returns focus to its opener. Windows (UI-W1–W7) aren't pop-ups. | | |
| UI-W9 | **Peek** | — | Hovering a tab peeks at its window without covering the tab; clicking anywhere on the peek keeps it open. | | |
| UI-W10 | **Toasts** | bottom centre | fade after about 4 s, never cover a control, and carry Undo after a change ("Changed h 70 → 80 · Undo"). | | |
| UI-W11 | **Chart key / legend** | floats like any window | never pushes or resizes the chart (UI-A3). | | |

## UI-S · Screens

| # | Screen | How you get there | What it shows |
|---|---|---|---|
| UI-S1 | **Truss · 2D** | Truss switch on 2D | The side view as an engineering drawing: every input is a dimension with a ✎ value, the tables run to both edges and end in break lines, and the results sit on the drawing (UI-A13). |
| UI-S2 | **Truss · 3D** | Truss switch on 3D | The 3D bridge, full stage. Views (Side, Top with one bracing plane, End with one frame) come from the view cube (UI-V). There are no Plan/End inset boxes. |
| UI-S3 | **Inputs screen** | ⤢ in the Inputs window | Category cards on one screen, each with a picture that lights up the input you touch: Shape · Geometry (spans both rows) · Supports · Load · Sticks and material · Pass rules (pink, "can stop a pass") · 3D. No "1 ·" numbering. |
| UI-S4 | **Analysis · chart** | Analysis switch (always) | The trade-off chart, with your bridge circled. 3D adds a third axis. |
| UI-S5 | **Chart data states** | — | No sweep yet: your bridge is the only dot, with an arrow to Run sweep. Quick look: the pilot says so. Out of date: dots fade, the sweep bar stripes orange, and a banner names what changed. Sweeping: dots appear as designs finish. |
| UI-S6 | **Analysis · tabs** | the word Analysis, the last-tab icon, or a tab | **Required wood · History · Winners · Members.** There is **no Trade-off tab**; the chart is reached from the top bar. Members lists every member of the loaded bridge sorted by use, and hovering a row lights the member in the PIP. |
| UI-S7 | **Compare** | hover a design, press P | The PIP shows loaded vs pinned side by side with the differences; its header has the Truss 2D/3D switch. ⛶ opens a full-screen compare. |
| UI-S8 | **Phone** (< 700 px) | — | The top bar opens icons-only. Options become a bottom sheet, the PIP docks above the sweep bar, and the Inputs screen shows one category at a time. |

## UI-N · Navigation

- **UI-N1** The Truss and Analysis switches go to that view in that setting. The Analysis switch always lands on the chart.
- **UI-N2** The word Analysis goes back to wherever you last were in Analysis.
- **UI-N3** The last-tab icon sits next to the Analysis switch, so Members → Truss → Members is one click each way.
- **UI-N4** ← undoes each trip and is also the browser's Back.
- **UI-N5** H clears the screen to tabs; T and A switch views.

## UI-H · Hover, click, pin, PIP

- **UI-H1** Hovering a dot, a History row or a Winners row previews it in the PIP (dashed, taped, NOT LOADED). The preview goes away when you move off.
- **UI-H2** Clicking loads it, with an Undo toast.
- **UI-H3** P (long-press on a phone) keeps the preview and turns the PIP into Compare. The PIP shows "P pins it" as a hint, not a button. Unpin, Esc or ✕ ends it.
- **UI-H4** In Members, hovering a row lights the member on the bridge in the PIP. Clicking a member on the bridge (2D or 3D) lights its row, and it stays lit.
- **UI-H5** **The PIP and the main view use the same drawing code**, so preview and pin behave the same at both sizes.
- **UI-H6** **PIP to main.** Clicking a dot in a PIP chart opens that design as a preview in the main view (UI-A11). Esc or *Back* returns to the loaded bridge.
- **UI-H7** **No PIP inside a PIP.** Inside the PIP, actions that would open another PIP aren't offered, and the PIP says so.
- **UI-H8** The PIP ▾ picks what it shows (Truss, Inputs, the chart or any Analysis tab), and ⛶ swaps it with the full screen. There is one PIP at a time, and the PIP keeps a constant height when its content changes.

## UI-D · The drawing

- **UI-D1** Every input is a ✎ value tag on its dimension. A ✎ opens the value editor (UI-I8).
- **UI-D2** Tables run to both edges and end in break lines.
- **UI-D3** Results on the drawing (UI-A13). Books are drawn as books, and the wood pile as a stick bundle seen end-on, so the two never look alike. A theme may supply both pictures (UI-T4).
- **UI-D4** An unstable bridge turns grey (there are no forces to colour). The loose part is outlined in magenta (a ring for a joint, a box for a panel) with a plain-words reason, and the results show ✕ UNSTABLE with *Find the closest stable bridge* and *Undo*. In 3D the message names the plane or frame that needs bracing.
- **UI-D5** **Picked member:** a halo, an ink outline, ink rings on its two joints and its number in a flag. The other members fade only slightly. Tokens: `--te-mem-hi`, `--te-mem-hi-ink`, `--te-mem-dim`, `--te-mem-hi-flag`.
- **UI-D6** Text never overlaps text. In particular, the books ✎ tag sits above the books and replaces the plain books label when dimensions are on.

## UI-V · 3D view controls (view cube, style D)

- **UI-V1** **One view system per mode.** 3D Truss has the view cube; 2D views and charts have the round pad. They are never both on screen.
- **UI-V2** The cube has **26 click targets** (6 faces, 12 edges, 8 corners), each a preset camera angle. The sections are **hidden** until hovered: only the face, edge or corner under the pointer lights up, and its name is in the tooltip. There is no hint text under the cube.
- **UI-V3** **Click jumps, drag orbits.** A single click goes to that view with a short animation (none with reduced motion). Pressing and dragging the cube turns the bridge freely.
- **UI-V4** **Rotate ring** (N, E, S, W) around the cube. Dragging it turns only around the vertical axis, and clicking a letter looks from that side. Setting in ☰ › View and display: **Always · On hover · Off**.
- **UI-V5** **Straight-on views:** arrows around the face step to the next face. Top and Bottom views also get ↺ ↻ (90° turns).
- **UI-V6** **Home ⌂** sits at the cube's top-left. ☰ › View and display has *Set this view as Home* and *Reset Home*.
- **UI-V7** **Look from** is one button at the cube's bottom-right. Hovering or focusing it opens **Side / Top / End downward**, under the button, so it never covers the cube and nothing else moves. In Top or End, the bracing-plane or frame chips appear below. Clicking the active view again returns to 3D. No panel or background sits behind the cube.
- **UI-V8** In 2D, the round pad pans (▲ ◀ ⌂ ▶ ▼) with + and − under it.

## UI-I · Inputs and limits

- **UI-I1** The ⇄ sweep chip sits on the input's own line. A swept number shows `from → to · step = N values` inline under it, and the slider shows the swept band and both ends.
- **UI-I2** **Course rule** (h ≤ 100 mm, width 50–75 mm): never clamped. The value turns **pink** while you type or drag, whether or not the input is swept, and the design still runs and is marked failing with the rule named. Sliders show a pink hatched zone.
- **UI-I3** **Model limit** (Δh or Δp below the −30 mm table face or above h, support past the overlap, tilt over 30°): the value can't be built. The input stops at the wall and a ⟂ note says why. Sliders show a grey wall zone.
- **UI-I4** **Software cap** (400 values in one range): never cut silently. Run sweep is blocked, with two choices: a coarser step, or sample 400 evenly.
- **UI-I5** A swept range shows `asked → run` when the two differ, and ⓘ lists the reasons with counts. Dependent pairs are counted per combination, duplicate designs never run, and the sweep bar shows how many were skipped.
- **UI-I6** Each category picture lights the input you hover. Theme pictures use `data-in="key …"`. The Load picture shows as many books as the Books input, and the 3D picture shears with Tilt (theme hooks, UI-T4 and ART-H4).
- **UI-I7** Inputs content:
  - The books input is one total mass, "Mass of all the books", default 2.5 kg.
  - The truss family of this bridge has its own picker beside the sweep chips.
  - Stick size is one input, 3.18 mm square (non-square sticks are asked in #232).
  - The top-chord sticky note sits on its own row and covers nothing.
- **UI-I8** **Value editor** (✎):
  - 320 px wide, and moves by its title bar;
  - holds the value, the joystick (drag it: the farther you push, the faster it changes) and the sweep range, then Done;
  - closes when you leave its screen and on an outside click (UI-W8).

## UI-C · Charts

- **UI-C1** Fails are **magenta ✕** marks; passes are dots. The capacity rule line is pink and labelled.
- **UI-C2** **Group select (#148).** Drag on empty chart space to box-select (2D and 3D). Shift+drag adds to the group, Shift+click toggles one dot, and Esc clears. The group bar offers Dim others, Hide others, Invert, What do these share? and ✕.
- **UI-C3** **What do these share?** ranks each input by how alike it is in the group compared with the whole sweep, with a bar for each. The panel opens on the side away from the group.
- **UI-C4** The chart fills the stage (UI-A3); the key and options float over it (UI-W11).
- **UI-C5** *(planned, #230, #231)* Numbers stay on the visible edges when zoomed, and the axis titles can always be shown.

## UI-T · Themes

- **UI-T1** Every part of the screen belongs to one of three slots: `data-slot="bg"` (background and titles), `ctl` (controls) and `disp` (display). Parts carry `data-part` names, listed in the Click-Through's `themes/README.html`. All colours are `--te-*` tokens scoped to `#stage[data-theme="<id>"]`.
- **UI-T2** **A theme changes looks, never places, meaning or words.** It may set tokens, per-part looks, pictures and icon art (with a word for screen readers). It may not move, resize or hide anything, change the meaning colours (UI-A18), change any text, verdict, number or the results card (#197), run code, or go below the contrast and focus rules (UI-K4).
- **UI-T3** Shared themes are data only (formats.js); built-in themes go through a reviewed PR. Theme pictures are SVG, so for 1.0 they ship in built-in themes only.
- **UI-T4** **Picture hooks** in a theme's `pictures/` folder:
  - the 8 category pictures and `topchord-note.svg` (with `data-in`);
  - `woodpile.svg` and `books.svg` (drawn where the drawing places them, with the built-in shapes as fallback);
  - book groups `book1` and `book2`, with copies stacked for more books;
  - Tilt **shears** the 3D picture, it doesn't rotate it. The page applies the matrices in **ART-H4**: `data-lean` groups (left, right and in) with their `data-lean-shear` and `data-lean-matrix` numbers, with T = tan(tilt). Graphics owns the numbers; this rule only says the page must apply them.
- **UI-T5** **Calculator screens:** any button drawn on an LCD screen is pixel art only. Balsa-stick buttons are for controls on paper or wood.
- **UI-T6** **OG** is the v60 look, kept warts and all, and is exempt from the contrast checklist. It unlocks after the first finished sweep or 20 minutes (#162). Badge: **OG**.

## UI-K · Keyboard and screen readers

- **UI-K1** The focus order is the same in every view: top bar, results card, view options, Inputs, the picture, Drawing window, sweep bar, PIP, ⓘ.
- **UI-K2** F6 jumps window to window, Tab moves inside a window, and Esc returns focus to the opener.
- **UI-K3** Arrow keys move between chart dots: focus previews, Enter loads, P pins.
- **UI-K4** Each window is a named region, and the drawing has a text twin. Toasts and sweep progress are read politely, at most once every 5 s. The focus ring is a 3 px amber outline that every theme keeps. QA's keyboard script (#218) is the test.

## UI-F · First-time tour

- **UI-F1** Four steps, one at a time: the top bar, a ✎ value, Run sweep, ⓘ.
- **UI-F2** The bridge wiggles and changes one setting every 6 s while the tour runs, and goes back to the student's own settings when it ends. The tour stays in ☰ → Help.

## UI-M · Motion: the restless bridge and scene transitions

UI owns **when, where and what stops it**. Graphics owns **how it looks and moves** (curves, timings, art), in the Motion Lab (https://claude.ai/artifact/LxaymNQizNMPGy4QaBSDUg) and the Graphics spec. Brian's picks are the defaults.

- **UI-M1 Restless bridge (#144): when it runs.** Only for a new user: no saved bridge and no file opened yet. It runs on the Truss view while the user has been idle for about 6 s. It never runs while a sweep is running, a pop-up or sheet is open, or the page is hidden.
- **UI-M2 What it does.** Brian's picks (Warn mode, wiggle 50 %, changing part 120 %, shake 1.6 s), in order:
  1. The bridge wiggles, and the part about to change shakes more.
  2. One input changes: height, panel count, flat ↔ arched top, or flat ↔ sagging bottom.
  3. That ✎ tag pops and is stained brown, and a handwritten note appears ("ooh, an arch!").
  4. The results update.

  Changes made by the restless bridge are not logged in History one by one.
- **UI-M3 What stops it, for good.** It stops at the first of these:
  - any input change by the user;
  - Load, opening a file, or Run sweep;
  - **That's my bridge**;
  - turning off *Restless bridge* in ☰ › View and display.

  The stop is remembered per browser, and the bridge stays as it is when it stops.
- **UI-M4 "That's my bridge" lives in the state badge.** While the bridge is restless, the badge under the results strip (UI-A11) reads **Restless bridge · That's my bridge ✓**. Clicking it keeps the current design, saves it as the first History entry, and turns the badge into ✓ LOADED.
- **UI-M5 Scene transitions (#143).**
  - **When:** only when you switch between Truss and Analysis with the top-bar switches. Not on a PIP swap, and not on tab changes inside Analysis.
  - **Look:** each theme supplies its own; Notebook + Calculator has the sweep line growing into the calculator and the paper slip zooming back. Wireframe uses a plain fade.
  - **Length:** under 0.9 s.
  - **Input is never blocked:** a click or key during a transition jumps to its end.
- **UI-M6 Reduced motion and off switches.**
  - With `prefers-reduced-motion`: no wiggle; transitions become a 150 ms fade; the cube snap is instant (UI-V3).
  - ☰ › View and display has *Restless bridge* and *Scene transitions* switches.
- **UI-M7 The tour reuses the restless bridge.** The first-time tour (UI-F2) uses the same mechanism and the same stop rules, then returns to the student's own settings.

## Coverage: rules that aren't in a build step yet

Every rule above must be cited by a build issue. These weren't, until now:

| Rules | Issue that builds them | Note |
|---|---|---|
| UI-M1–M4, UI-M7 | #144, as part of step 13 (#220) | #144 was waiting on UI's stop rules; they're above |
| UI-M5, UI-M6 | #143, as part of step 14 (#221) | transitions are theme-specific |
| UI-C2, UI-C3 | #148 | group select; not in the 14 steps |
| UI-I2–I5 | #87, #131, inside step 8 (#215) | |
| UI-C5 | #230, #231 | planned |

---

## Build steps and the rules they must meet

Acceptance for each step: the rules below are met (UI review comment on the PR), plus the checks already in the issue.

| Step | Issue | Must meet |
|---|---|---|
| 1 | #183 (shipped) | UI-A4, UI-A5, UI-A6, UI-A7, UI-W1 |
| 2 · Truss 2D full screen | #209 | **UI-A3**, UI-A7, UI-A12, UI-A13, UI-A17, UI-S1, UI-D1–D6, UI-W3, UI-W4, UI-W5, UI-W10, UI-V8 |
| 3 · Sweep bar, results card, PIP | #210 | UI-A2, UI-W2, UI-W6, UI-W7, UI-W8, UI-A11, UI-H5–H8 |
| 4 · Analysis full screen | #211 | **UI-A3**, UI-A1, UI-A7, UI-A17, UI-A8, UI-S4, UI-S6, UI-C1, UI-C4, UI-W11, UI-N1–N3 |
| 5 · Hover previews, click loads | #212 | UI-A10, UI-A11, UI-H1, UI-H2, UI-H4 |
| 6 · Compare | #213 | UI-H3, UI-S7 |
| 7 · 3D Look from | #214 | UI-S2, UI-V1–V7 (and #33) |
| 8 · Inputs screen | #215 | UI-S3, UI-I1–I8, UI-T4 (Tilt shear, ART-H4) |
| 9 · Empty and in-between states | #216 | UI-A14, UI-S5, UI-D4 |
| 10 · ☰ and sheets | #217 | UI-A16, UI-W8, UI-W9, UI-A15, UI-A9, UI-N4 |
| 11 · Keyboard and screen readers | #218 | UI-K1–K4, UI-N5 |
| 12 · Phone | #219 | UI-S8 |
| 13 · First-time tour | #220 | UI-F1–F2, UI-M1–M4, UI-M7 (#144) |
| 14 · Themes and OG | #221 | UI-T1–T6, UI-A18, UI-M5–M6 (#143) |

## Change log

- **1.2 · 2026-10-28** Tilt hook is a shear, not a rotation (UI-T4, UI-I6 → ART-H4; TE-B-083). Build-step table now cites the 8 rules the spec report found uncited (TE-B-086): UI-A1, UI-A2, UI-A9, UI-A17, UI-W4, UI-S1, UI-N4, UI-N5. Step 8 cites UI-T4.
- **1.1 · 2026-10-28** Added UI-M (motion): the restless bridge's run and stop rules, "That's my bridge" in the state badge (#144), and when scene transitions play (#143). Added the coverage table. Steps 13 and 14 now cite UI-M. Follows the [creative documentation standard](ui-creative-doc-standard.md).
- **1.0 · 2026-10-28** First numbered standard. It gathers:
  - the Full-Screen UI Spec (rounds 5–10);
  - Click-Through versions 1–17;
  - decisions on #33 (cube style D), #87 and #131 (limits), #148 (group select), #108 (theme hooks) and #237 (preview check: UI-A3, UI-A7, UI-W6–W8, UI-W11);
  - the 2026-10-25 decision that fails are magenta + ✕.
