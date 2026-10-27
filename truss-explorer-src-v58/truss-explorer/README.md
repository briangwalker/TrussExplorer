# SE 310 Truss Explorer

A single-page web app for designing balsa truss bridges for SE 310 Project I (UIUC, Fall 2026): hold two textbooks with a factor of safety of 2 using as little wood as possible. It solves 2D and 3D pin-jointed trusses, sweeps millions of designs, charts wood against capacity, and prints build documents.

Version: v59 (2026-10-27). Live copy: the claude.ai artifact "SE 310 Truss Explorer"; coming soon at briangwalker.com/truss-explorer/.

## Build
    python3 build.py      # writes index.html from src/
Open index.html in a browser. Everything runs in the page; saved bridges stay in your browser (localStorage / IndexedDB) or in files you save.

## Layout
- src/core.js: 2D geometry and direct-stiffness solver (TrussCore)
- src/core3d.js: 3D model and solver (Truss3D)
- src/export.js, src/template.js: export to the course FEA script format
- src/builddoc.js: build documents
- src/app.js, src/ui.html: the interface
- tests/: node tests, Playwright UI tests, cmp.py (compares with the course script). Paths inside the tests still point at the original build folder; set D at the top of each.

## Before making this repo public
- src/template.js embeds the course's TrussFEA_Bridge_SE310.py. Get the professor's permission or remove it from the public build.
- Pick a licence.

Full project documentation lives in the "[13] Truss Explorer" Google Drive folder (Standing Instructions, Technical Handoff, Tickets).
