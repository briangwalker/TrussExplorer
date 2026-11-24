// ===== Theme file: what a theme from a FILE may do to the page (#265; TE-B-374 (a), (b), (d); WH-T6) =====
// A theme file is data (tokens checked by formats.js, RMA-5 and RMA-7). This module adds the two checks that need
// the VALUES together, not one at a time, and turns the tokens into the CSS variables the shell sets:
//   TrussThemeFile.contrast(fg, bg)              WCAG contrast ratio of two colours (#hex, rgb(), rgba()); null if unreadable
//   TrussThemeFile.check(tokens, defaults, names)  -> { ok, errors: ['contrast:ink/surface', 'name:taken'], pairs: [...] }
//   TrussThemeFile.vars(tokens)                  -> { '--te-ink': '#1d232a', ... } for the tokens that passed
// Pure: no DOM, no app state, so Node tests load it (CODE-F1 one global, CODE-F4: the shell calls it, nothing else).
// Rules: (a) a text colour and the ground it sits on must keep ART-C contrast, so 'transparent', #0000 or ink = surface
// can't hide text; a pair is checked with the file's value where it has one and the built-in default otherwise.
// (b) a file theme's display name may not copy a built-in theme's name; the picker always adds '(from a file)'.
(function (root) {
'use strict';

// text on its ground: ART-C1 4.5:1 for text, ART-C2 / ART-C6 3:1 for control edges, the focus ring and 'strong' used as a line
const PAIRS = Object.freeze([
  ['ink', 'page', 4.5], ['ink', 'surface', 4.5], ['ink', 'surface-2', 4.5], ['ink', 'panel', 4.5], ['ink', 'panel-peek', 4.5], ['ink', 'ctl-bg', 4.5], ['ink', 'hot', 4.5],
  ['muted', 'page', 4.5], ['muted', 'surface', 4.5], ['muted', 'surface-2', 4.5], ['muted', 'panel', 4.5], ['muted', 'ctl-bg', 4.5],
  ['on-strong', 'strong', 4.5], ['on-strong', 'tab', 4.5], ['accent-ink', 'accent', 4.5],
  ['ctl-line', 'ctl-bg', 3], ['focus', 'surface', 3], ['focus', 'hot', 3], ['strong', 'page', 3], ['strong', 'surface', 3], ['strong', 'panel-peek', 3],
]);
// the grounds a file may set, and the MEANING colours (ui.html's --ok, --bad, --comp, --tens, --zero, --warn; not theme tokens) that
// must stay visible on every one of them: a theme can never change what a result says (TE-B-014 (2), #197, SEC-007).
// ok and bad are the verdict's text (4.5:1); comp, tens and warn are member and chart colours (3:1, WCAG 1.4.11); zero is the
// faint grey of a member carrying nothing, which the built-in themes keep at about 2.2-2.5:1 on purpose, so it only has to stay visible (2:1).
const GROUNDS = Object.freeze(['page', 'surface', 'surface-2', 'panel', 'panel-peek', 'ctl-bg', 'hot']);
const MEANING = Object.freeze({ ok: 4.5, bad: 4.5, comp: 3, tens: 3, zero: 2, warn: 3 });

// #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(r,g,b), rgba(r,g,b,a) -> [r, g, b, a] in 0..1, or null
function rgba(s) {
  if (typeof s !== 'string') return null;
  s = s.trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) { const p = h.split('').map(c => parseInt(c + c, 16) / 255); return [p[0], p[1], p[2], h.length === 4 ? p[3] : 1]; }
    if (h.length === 6 || h.length === 8) { const p = [0, 2, 4, 6].map(i => i < h.length ? parseInt(h.slice(i, i + 2), 16) / 255 : 1); return [p[0], p[1], p[2], h.length === 8 ? p[3] : 1]; }
    return null;
  }
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255, m[4] === undefined ? 1 : +m[4]];
  if (/^transparent$/i.test(s)) return [0, 0, 0, 0];
  return null;
}
// a colour with alpha, laid over an opaque ground (both [r,g,b,a]) -> opaque [r,g,b,1]
const over = (c, g) => [0, 1, 2].map(i => c[i] * c[3] + g[i] * (1 - c[3])).concat([1]);
const lum = c => { const f = v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const WHITE = [1, 1, 1, 1];

// fg over bg over white; null when either colour can't be read
function contrast(fg, bg) {
  const f = rgba(fg), b = rgba(bg);
  if (!f || !b) return null;
  const ground = over(b, WHITE), text = over(f, ground);
  const l1 = lum(text), l2 = lum(ground);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// tokens: the file's tokens after formats.js (name -> value). defaults: the built-in values the file doesn't set (name -> value).
// names: { name, builtIn: ['Wireframe', ...] } for rule (b); optional.
// meaning: the page's meaning colours as shown on the stage ({ ok: '#2f7a4b', ... }); every ground the file sets is checked against
// each of them. A missing meaning colour counts as unreadable, so a file that sets a ground never passes by accident.
function check(tokens, defaults, names, meaning) {
  tokens = tokens && typeof tokens === 'object' ? tokens : {}; defaults = defaults && typeof defaults === 'object' ? defaults : {};
  meaning = meaning && typeof meaning === 'object' ? meaning : {};
  const errors = [], pairs = [];
  const val = k => Object.prototype.hasOwnProperty.call(tokens, k) ? tokens[k] : defaults[k];
  for (const [fg, bg, need] of PAIRS) {
    if (!(fg in tokens) && !(bg in tokens)) continue;   // the file didn't touch this pair: the built-in theme already passed it
    const r = contrast(val(fg), val(bg));
    pairs.push({ fg, bg, need, ratio: r });
    if (r === null || r < need) errors.push('contrast:' + fg + '/' + bg);
  }
  for (const g of GROUNDS) {
    if (!(g in tokens)) continue;
    for (const m of Object.keys(MEANING)) {
      const r = contrast(meaning[m], tokens[g]);
      pairs.push({ fg: m, bg: g, need: MEANING[m], ratio: r });
      if (r === null || r < MEANING[m]) errors.push('meaning:' + m + '/' + g);
    }
  }
  if (names && typeof names.name === 'string' && Array.isArray(names.builtIn)) {
    const n = names.name.trim().toLowerCase();
    if (names.builtIn.some(b => typeof b === 'string' && b.trim().toLowerCase() === n)) errors.push('name:taken');
  }
  return { ok: errors.length === 0, errors, pairs };
}

// the CSS variables for the tokens (only names formats.js let through reach here)
function vars(tokens) {
  const out = {};
  if (tokens && typeof tokens === 'object') for (const k of Object.keys(tokens)) if (/^[a-z][a-z0-9-]{0,30}$/.test(k) && typeof tokens[k] === 'string') out['--te-' + k] = tokens[k];
  return out;
}

const api = Object.freeze({ PAIRS, GROUNDS, MEANING, contrast, check, vars });
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussThemeFile = api;
})(typeof window !== 'undefined' ? window : globalThis);
