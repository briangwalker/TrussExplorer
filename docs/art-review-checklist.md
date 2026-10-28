# Art review checklist

**Version 1.0 · 2026-10-28 · owner: Graphics Designer (Art Lead)**

Use this for every pull request that changes what people see: a theme, the drawing, the controls, pictures, icons or motion. Graphics reviews it rule by rule against [art-spec.md](art-spec.md) and posts one comment signed "Graphics Designer". The review doesn't block merging: Dev Lead still merges. A ✗ that ships becomes an issue citing the rule number.

**The author attaches:**
- screenshots at **1440 × 900** and **1152 × 1062**, in light and dark, for each built-in theme the change touches (390 px wide too for phone work);
- the list of `ART-…` rules the PR meets.

## Comment template

```
Art review (Graphics Designer) · PR #___ · art-spec 1.x
✓ ART-…   ✗ ART-… (what's wrong, where)   ? ART-… (can't tell from the screenshots)
Notes:
```

## The checks

**Materials (ART-P)**
- [ ] Light things (toasts, tips, notes) are paper or handwriting; lasting things are wood or calculator. (P1)
- [ ] Nothing heavy sits on something light. (P2)
- [ ] Nothing moved, resized, hid or got renamed when the theme changed. (P3)
- [ ] Every meaning has a letter, mark or shape as well as a colour. (P4)

**Tokens and colour (ART-K, ART-C)**
- [ ] Colours come from `--te-*` tokens or the theme's own private tokens; no stray hex values in shared parts. (K1–K13)
- [ ] Meaning colours and member colours are untouched. Fails are magenta + ✕. (K14)
- [ ] Text is 4.5 : 1 on the darkest part of its texture; lines and icons are 3 : 1. (C1, C2)
- [ ] Help text on wood uses `--te-ink` at 14 px or more, or sits on a paper label. (C3)
- [ ] Dark mode uses generated wood and still passes C1 and C2. (C4)

**Type (ART-T)**
- [ ] No font is loaded from another site; every family is self-hosted with its OFL.txt. (T1)
- [ ] Sizes are at or above the minimums; LCD numbers are full size. (T2)
- [ ] Handwriting is used only for light things, never for result numbers. (T3)

**States (ART-S)**
- [ ] Default, hover, pressed, on, disabled and focus all look different. (S1–S5)
- [ ] Pressed and on are one even colour top to bottom, lower, with no cast shadow. (S3)
- [ ] The focus ring is the 3 px accent outline. (S5)
- [ ] Picked differs by height and shadow as well as colour. (S6)
- [ ] Pixel keys keep their grain when pressed. (S9)

**Windows and controls (ART-W)**
- [ ] Controls are made of their window's material; buttons on a calculator screen are pixel art only. (W1–W4)
- [ ] Sliders show three different handle shapes, the swept band and the limit zones. (W5)
- [ ] The sweep window's icons state shows only a ▶ key and the count. (W7)

**Drawing and pictures (ART-D, ART-H)**
- [ ] The picked member has a halo, an outline, joint rings and a number flag, and the others are only slightly faded. (D2)
- [ ] Books look like books, and the wood pile like a stick bundle. (D3)
- [ ] No label is drawn twice. (D4)
- [ ] Each picture has `role="img"` and an `aria-label`, and its input groups light up on hover. (H1, H2)
- [ ] Books follow the Books input. (H3)
- [ ] The 3D picture leans with Tilt, and the bracing stays joined. (H4)
- [ ] No SVG has script, `on*`, `foreignObject`, an external link or an embedded raster. (H6)

**Icons and assets (ART-I, ART-X)**
- [ ] Icons are from the sprite at the right stroke weight, and every button keeps an `aria-label`. (I1, I2)
- [ ] File types, sizes, seams and names follow X1–X5. Every new file is listed in the asset register (ART-A).
- [ ] The theme is under 400 KB, with no `http`, `@import` or outside URL. (X4, X6)

**Motion (ART-M)**
- [ ] Timings match the ART-M defaults. The transition is one spring with no stop-then-bounce and no flash. (M1, M2)
- [ ] Every motion has its reduced-motion version and its ☰ switch. (M1–M7, UI-M6)
- [ ] Input is never blocked during motion (UI-M5).

**Theme options (ART-O)**
- [ ] Each option changes looks only, is saved per theme, and survives a reload. (O1–O5)

## Change log

- **1.0 · 2026-10-28** First version, matching art-spec 1.0.
