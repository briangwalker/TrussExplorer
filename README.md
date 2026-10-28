# TrussExplorer

> **This is the `balsaPixel-1.0` branch:** the full-screen UI and theme overhaul, in development (Decisions, 2026-10-27). The stable app is **v61 on `main`**, which the live page runs. Fixes land on `main` first and are merged in here.

A single-page web app for designing balsa truss bridges for SE 310 Project I (UIUC, Fall 2026): hold two textbooks with a factor of safety of 2 using as little wood as possible. It solves 2D and 3D pin-jointed trusses, sweeps millions of designs, charts wood against capacity, and prints build documents.

Version: v64 (2026-10-28). Live copy: the claude.ai artifact "SE 310 Truss Explorer"; coming soon at briangwalker.com/truss-explorer/.

The app lives in `truss-explorer-src-v58/truss-explorer/`; the paths below are relative to that folder.

## Build
    python3 build.py      # writes index.html from src/
Open index.html in a browser. Everything runs in the page; saved bridges stay in your browser (localStorage / IndexedDB) or in files you save.

**On the balsaPixel-1.0 branch, index.html is not in the repo:** run `python3 build.py` to make it (two builds give the same bytes, and `run_all.sh` checks that). Each release carries the built page as an attached file (Brian attaches it, since the coding sessions can't edit releases), so you can also download it from the release. `main` (v61) still has its committed copy until balsaPixel replaces it.

## Layout
- src/core.js: 2D geometry and direct-stiffness solver (TrussCore)
- src/core3d.js: 3D model and solver (Truss3D)
- src/export.js, src/template.js: export to the course FEA script format
- src/builddoc.js: build documents
- src/app.js, src/ui.html: the interface
- tests/: everything runs with `bash tests/run_all.sh`: solver checks, a comparison with the course script, and browser tests (see tests/README.md).

## Contributing

Work is tracked in [Issues](https://github.com/briangwalker/TrussExplorer/issues). Labels give the type, priority (`P1`–`P3`), status and the role that acts next (`role: dev-lead`, `role: ui`, ...). New here? Try a `good first issue`. [CONTRIBUTING.md](CONTRIBUTING.md) explains how to claim an issue, branch, run the tests and open a pull request.
