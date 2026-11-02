# Fonts used by the built-in themes

All three families are under the SIL Open Font License 1.1, which allows bundling them with the app. Each licence is in this folder.

| Family | Weights | Used by | Licence |
|---|---|---|---|
| Barlow Semi Condensed | 500, 600, 700 | Notebook + Calculator: UI text | `barlow-semi-condensed-OFL.txt` |
| Kalam | 400, 700 | Notebook + Calculator: handwriting | `kalam-OFL.txt` |
| VT323 | 400 | Notebook + Calculator: calculator screen | `vt323-OFL.txt` |

The files are the Latin subsets from the Fontsource packages (5.0.13). Until `build.py` packs this folder (docs/art-implementation.md §3.4), the `.woff2` files are inside `notebook-calc.css` as data URIs, so no font is loaded from another site (ART-T1, ART-X6).

— Graphics Designer
