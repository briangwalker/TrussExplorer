// ---------- the one door other layers use (balsaPixel's src/shell.js; the first draft of the UI module boundary, #109) ----------
window.TrussApp = Object.freeze({
  get state() { return S; }, get res() { return res; }, get rows() { return sweepAll; }, get fsEl() { return fsEl; }, release: APP_RELEASE,
  hooks: HOOKS,   // setFs(key), renderKey(), renderSweep(): replace one to run code around the original
  save, toast, escH, topOn,
  // the same 2D drawing in any <svg> (#255 part A, UI-H5: the PIP and the main view share one drawing code). The picture only:
  // no listeners, no ghosts or dimension labels unless asked; never moves the main view. Redraw it after TrussApp.redraw().
  drawInto(target, opts) { if (!(target instanceof SVGSVGElement) || target === $('draw')) throw new Error('drawInto needs an <svg> other than the main drawing'); renderDrawing(target, currentDesign(), opts); },
  redraw() { try { renderDrawing(); } catch (e) {} try { drawTrackers(); } catch (e) {} try { if (topOn()) render3D(); } catch (e) {} try { paintResOverlay(); } catch (e) {} },
});
window.__dbg = { get S() { return S; }, drawTrackers: () => drawTrackers(), get rows() { return sweepAll; }, get res() { return res; }, load: p => loadParams(p), get ctx() { return sweepCtx; } };
})();
