# Chart-open profile (#236)

Two scripts that measure how long the trade-off charts take to open, for the #236 plan and its acceptance check. Build the page first (`python3 build.py` in the app folder), then from the repo root:

    node docs/math/reference/chart-open/profile.mjs        # opens Analysis 2D, 3D, 2D again on the starter sweep; time to first frame + where the CPU time goes
    node docs/math/reference/chart-open/alternatives.mjs   # times today's drawing and sorting against the planned replacements on about 49,000 dots

Both use the Playwright harness in `tests/ui/harness.mjs` and the balsaPixel window layout. Numbers depend on the machine: compare before/after on the same one.
