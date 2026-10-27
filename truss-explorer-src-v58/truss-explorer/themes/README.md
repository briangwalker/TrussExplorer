# Themes (balsaPixel 1.0)

A theme is one CSS file scoped to `#stage[data-theme="<id>"]`. It sets the `--te-*` tokens and may add rules for
`[data-slot]` (bg, ctl, disp) and `[data-part]` (top-bar, nav-button, view-pill, switch, button, icon-button, tab,
segmented, menu-row, edge-tab, stepper, value-tag, window, sheet, window-title, label, scrim, drawing, pip-screen,
results, toast, badge, count-badge, table, chart-dot, progress). Picked controls carry `aria-pressed="true"` or `.on`.

Meaning colours never change: C red, T blue, 0 grey, fails magenta with ✕, passes green.

`build.py` inlines every CSS file listed in `index.json` into index.html, so the page stays one file.
Only the active theme's CSS is put on the page.

| id | file | from |
| --- | --- | --- |
| wireframe | built into `src/shell.css` | UI Designer's Click-Through |
| og | no CSS: the v61 look | #162 |
| blueprint | `blueprint.css` | Click-Through sample |
| notebook-calc (+ -gen, -calc) | `notebook-calc.css` | Graphics Designer, Motion Lab one-file build (images as data URIs) |
