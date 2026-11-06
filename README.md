# TrussExplorer

A single-page web app for designing balsa truss bridges for SE 310 Project I (UIUC, Fall 2026): hold two textbooks with a factor of safety of 2 using as little wood as possible. It solves 2D and 3D pin-jointed trusses, sweeps millions of designs, charts wood against capacity, and prints build documents.

Live at **https://briangwalker.com/truss-explorer/** (balsaPixel: Truss Explorer 1.0.0-alpha.2, from the `balsaPixel-1.0` branch).

The app lives in `truss-explorer-src-v58/truss-explorer/`; the paths below are relative to that folder.

## Start here

**Use it:** open **https://briangwalker.com/truss-explorer/** in a browser. It works best on a computer. There's nothing to install: the program runs in the page, and the bridges you make stay in your browser or in files you save.

1. **Pick a bridge.** Open ☰ › *Start from a simple bridge*. Or open a `.truss` file someone sent you with ☰ › *Import and export* › *Open bridge file…*.
2. **Change it.** The *Inputs* window changes the span, height, panels, pattern and more. The drawing and the results card follow, and the card says whether the bridge holds the load and what limits it.
3. **Run a sweep.** In the *Sweep* window at the bottom, choose the inputs to vary and press *Run sweep*. Then pick *Analysis* in the top bar to see every design's wood against its capacity.
4. **Build it.** ☰ › *Build documents…* gives a cut list, full-size templates and step-by-step instructions.

*For learning and model bridges, not for designing real structures.*

**Found a bug, or have a question?** [Open an issue](https://github.com/briangwalker/TrussExplorer/issues/new/choose); it needs a free GitHub account. Say what you did, what you expected and what happened. A screenshot and your `.truss` file help. A *Report a bug* form inside the program is planned.

**Want to look at the code or help?** The website runs the `balsaPixel-1.0` branch; the program is in its `program/` folder. `main` is the older v6x line. Build it with `python3 build.py` and run every test with `bash tests/run_all.sh`. [CONTRIBUTING.md](CONTRIBUTING.md) explains the rest. Pull requests from outside the team get a security review before they're merged.

## Build
    python3 build.py      # writes index.html from src/
Open index.html in a browser. Everything runs in the page; saved bridges stay in your browser (localStorage / IndexedDB) or in files you save.

## Layout
- src/core.js: 2D geometry and direct-stiffness solver (TrussCore)
- src/core3d.js: 3D model and solver (Truss3D)
- src/export.js, src/template.js: export to the course FEA script format
- src/builddoc.js: build documents
- src/app.js, src/ui.html: the interface
- tests/: everything runs with `bash tests/run_all.sh`: solver checks, a comparison with the course script, and browser tests (see tests/README.md).

## Contributing

Work is tracked in [Issues](https://github.com/briangwalker/TrussExplorer/issues). Labels give the type, priority (`P1`–`P3`), status and the role that acts next (`role: dev-lead`, `role: ui`, ...). New here? Try a `good first issue`. [CONTRIBUTING.md](CONTRIBUTING.md) explains how to claim an issue, branch, run the tests and open a pull request.
