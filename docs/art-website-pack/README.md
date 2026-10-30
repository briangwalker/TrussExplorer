# Truss Explorer art pack for the website

**Version 1.0 · 2026-10-28 · Graphics Designer · for BGW Design's homepage (BGW-FB-005, TE-B-123)**

This is everything the homepage needs to feature Truss Explorer (TE) and let the site's look carry into the TE page. All of it is original art (ART-P6): drawn by Graphics, generated from the theme's tokens, or made from Brian's own balsa photos. The fonts are SIL Open Font License 1.1, and each one's licence sits next to it. There are no names or personal details in any file (rule 8).

The rules behind it are in `docs/art-spec.md` (ART-K for colours, ART-T for fonts, ART-X for textures).

## What's in it

| Folder | File | Use it for |
|---|---|---|
| `logo/` | `te-mark.svg` | The cut-end **TE** mark: the end of a balsa stick with TE stamped into it. Any size; it's vector. |
| | `logo-light.png`, `logo-light@2x.png` | Mark + "Truss Explorer" wordmark on a light background (transparent PNG). |
| | `logo-dark.png`, `logo-dark@2x.png` | The same on a dark background (`#0f141a`). |
| | `te-calc-pixel.svg` | TE in calculator pixel art, for a small badge or a hover state. |
| `favicon/` | `favicon.svg`, `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `site.webmanifest` | The TE page's tab icon and home-screen icon. |
| `cover/` | `homepage-cover-1600x900.webp` | The homepage feature card or hero: TE's logo, one line, and the alpha taped onto notebook paper above a balsa stick. |
| | `alpha-notebook-1600x900.webp` | A plain screenshot of the alpha in the Notebook + Calculator theme. |
| | `social-preview-1280x640.png` | `og:image` / `twitter:image` for the TE page. |
| `tokens/` | `palette.css`, `palette.json` | The colours and font stacks as CSS custom properties. |
| `textures/` | `paper.webp`, `photo-balsa.webp`, `photo-top.webp`, `photo-endgrain.webp`, `balsa.webp`, `pixelwood.png`, `lcd.png` | Notebook paper, balsa (side, top face, end grain; `balsa.webp` is the generated version), pixel wood, and the calculator screen. |
| `fonts/` | `fonts.css` + 11 `.woff2` files + 5 `*-OFL.txt` licences | Barlow, Barlow Semi Condensed, IBM Plex Mono, Kalam (handwriting), VT323 (calculator). Latin subset. |

## Bleeding the homepage into the TE page (Brian's ask)

Pick a few of these; you don't need all of them.

- **Paper:** `background: #fbf8f1 url(textures/paper.webp) 0 0 / 512px 512px;` on the TE section.
- **A balsa stick as a divider or shelf:** `background: url(textures/photo-balsa.webp) 0 0 / auto 100%;` on a 24–44 px tall strip, with a soft shadow under it. A stick repeats only along its grain (ART-X3).
- **Handwritten notes:** Kalam 700 in `#3d2610`, rotated 2–4°, with a highlighter mark (`linear-gradient(transparent 62%, rgba(255,225,77,.7) 62%)`) under a word.
- **The calculator:** VT323 numbers on `#c8d2b3` with ink `#1d2a1e`, or `te-calc-pixel.svg` as a badge.
- **The action colour is brown:** buttons and links `#8c5e22` with text `#fff8ec` (light), focus ring `#f0b45a`.

Two things to avoid: don't put a heavy material (wood, the calculator) on top of a light one (paper, tape) (ART-P1). And don't use the meaning colours (red, blue, grey, green, magenta) as decoration, because in TE they mean compression, tension, zero force, pass and fail.

## Favicon snippet for the TE page

```html
<link rel="icon" href="/truss-explorer/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/truss-explorer/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/truss-explorer/apple-touch-icon.png">
<link rel="manifest" href="/truss-explorer/site.webmanifest">
<meta property="og:image" content="https://briangwalker.com/truss-explorer/social-preview-1280x640.png">
```

## Fonts

Serve them from your own site with `fonts/fonts.css` (no Google Fonts link; White Hat and Black Hat asked for self-hosting, ART-T1). Keep each `*-OFL.txt` next to its font files.

## Licence for the art

The logo, mark, cover and textures are original Truss Explorer art, made for Brian's own sites. Please don't recolour or redraw the TE mark. Use the light or dark version instead.

## Sizes

About 1.3 MB in total. The homepage only needs the cover (≈ 80 KB), the mark (2 KB) and whichever textures and fonts you use.
