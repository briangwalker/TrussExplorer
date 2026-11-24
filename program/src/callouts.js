// ===== Result callouts: the three words on the drawing (determinacy, deflection, fits), as one pure unit (RMA-9; board TE-B-496b, TE-B-495 (1)) =====
// callouts(res, opts) -> exactly three, in this order: { id: 'determinacy', ok, text, at: 'support' }, { id: 'delta', ok, text, at: 'mid' }, { id: 'fits', ok, text, at: 'envelope' }.
// The drawing only PLACES them (at: where on the drawing); the words and the pass/fail are decided here, from one place, so Marketing can reword them in strings.js.
// Reads only these fields of core.js's analysis result: stable, m, r, j, det ('determinate' | 'indeterminate' | 'unstable'), midDefl (mm), deflOK,
// envelope (array of strings; empty = fits), edgeOK, overlap (mm); and from opts: deflLimit (mm), minOverlap (mm), dim (2 or 3; anything else reads as 2).
// dim is the analysis: today the page knows it as S.anaMode ('2d' or '3d'); the wiring passes 3 for a 3D result, because a 3D truss counts 3 equations per joint (m + r vs 3j).
// An unstable truss (res.stable false) gives all three ok: false with the unstable text. A missing or damaged field gives ok: false and the bad text, never a throw (CODE-N2).
// Every text is plain text from TrussStrings ('callout.<id>.<ok|bad>', {name} filled in by fill()); whatever draws it sets textContent or escapes it.
// No DOM, no app state, no timers (CODE-F1, CODE-F4, CODE-F5); Node tests load it directly. A key that is not in strings.js throws (CODE-N3, strings.js's rule).
(function (root) {
'use strict';

const IDS = Object.freeze([
  Object.freeze({ id: 'determinacy', at: 'support' }),
  Object.freeze({ id: 'delta', at: 'mid' }),
  Object.freeze({ id: 'fits', at: 'envelope' }),
]);

const strings = () => (typeof module !== 'undefined' && module.exports ? require('./strings.js') : root.TrussStrings);
const isNum = v => typeof v === 'number' && isFinite(v);

// text for a key with {name} placeholders filled from the map (a placeholder with no value is a programmer error: CODE-N3)
function fill(key, map) {
  return String(strings().t(key)).replace(/\{([a-zA-Z0-9]+)\}/g, (all, name) => {
    if (!map || !Object.prototype.hasOwnProperty.call(map, name)) throw new TypeError('TrussCallouts: no value for {' + name + '} in "' + key + '"');
    return String(map[name]);
  });
}

function callouts(res, opts) {
  const r = res && typeof res === 'object' ? res : {}, o = opts && typeof opts === 'object' ? opts : {};
  const mk = (i, ok, text) => ({ id: IDS[i].id, ok, text, at: IDS[i].at });
  if (r.stable === false) { const t = fill('callout.all.unstable', {}); return [mk(0, false, t), mk(1, false, t), mk(2, false, t)]; }

  // determinacy: ok unless the truss is unstable; the text shows m + r against dim * j (dim from opts.dim: 2, or 3 for a 3D result; anything else reads as 2) and the word.
  // 'indeterminate' has its own words (Physics, TE-B-521): the model gives redundant bracing full credit only for ideal, tight joints.
  const dim = o.dim === 3 ? 3 : 2;
  const have = isNum(r.m) && isNum(r.r) && isNum(r.j) && (r.det === 'determinate' || r.det === 'indeterminate' || r.det === 'unstable');
  const dkey = r.det === 'unstable' ? 'callout.determinacy.bad' : r.det === 'indeterminate' ? 'callout.determinacy.indet' : 'callout.determinacy.ok';
  const det = !have ? mk(0, false, fill('callout.determinacy.missing', {}))
    : mk(0, r.det !== 'unstable', fill(dkey, { mr: r.m + r.r, jn: dim * r.j, dim, det: r.det }));

  // delta: ok = res.deflOK; 3 decimals, the limit as given
  const dOk = isNum(r.midDefl) && isNum(o.deflLimit) && typeof r.deflOK === 'boolean';
  const delta = !dOk ? mk(1, false, fill('callout.delta.missing', {}))
    : mk(1, r.deflOK, fill(r.deflOK ? 'callout.delta.ok' : 'callout.delta.bad', { d: r.midDefl.toFixed(3), limit: String(o.deflLimit) }));

  // fits: no envelope reason and both desks reached; the text names the first thing that fails
  const env = Array.isArray(r.envelope) ? r.envelope.filter(e => typeof e === 'string' && e) : null;
  let fits;
  if (env === null || typeof r.edgeOK !== 'boolean') fits = mk(2, false, fill('callout.fits.missing', {}));
  else if (env.length) fits = mk(2, false, fill('callout.fits.envelope', { reason: env[0] }));
  else if (!r.edgeOK) fits = mk(2, false, isNum(r.overlap) && isNum(o.minOverlap) ? fill('callout.fits.desk', { ov: r.overlap.toFixed(0), min: o.minOverlap.toFixed(0) }) : fill('callout.fits.missing', {}));
  else fits = mk(2, true, fill('callout.fits.ok', {}));
  return [det, delta, fits];
}

const api = Object.freeze({ callouts, fill, IDS });
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussCallouts = api;
})(typeof window !== 'undefined' ? window : globalThis);
