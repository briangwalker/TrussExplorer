// ---------- the one door other layers use (balsaPixel's src/shell.js; the first draft of the UI module boundary, #109) ----------
window.TrussApp = Object.freeze({
  get state() { return S; }, get res() { return res; }, get rows() { return sweepAll; }, get fsEl() { return fsEl; }, release: APP_RELEASE,
  hooks: HOOKS,   // setFs(key), renderKey(), renderSweep(): replace one to run code around the original
  save, toast, escH, topOn,
  redraw() { try { renderDrawing(); } catch (e) {} try { drawTrackers(); } catch (e) {} try { if (topOn()) render3D(); } catch (e) {} try { paintResOverlay(); } catch (e) {} },
});
window.__dbg = { get S() { return S; }, drawTrackers: () => drawTrackers(), get rows() { return sweepAll; }, get res() { return res; }, load: p => loadParams(p), get ctx() { return sweepCtx; }, get tr() { return tr; }, get m3() { return m3; }, get r3() { return r3; }, get v3() { return v3; } };
})();
