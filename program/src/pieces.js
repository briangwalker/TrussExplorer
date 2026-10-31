// ===== Truss pieces: the shared screen pieces balsaPixel is built from (#354; TE-B-224, TE-B-227) =====
// One global, TrussPieces (CODE-F1). The pieces are: theme tokens, the window and its edge tab, the stick button,
// icon button, chip, toggle, tabs, slider, pop-up, and the results card. Every screen of balsaPixel (#209-#221) and
// the gallery page are built from these, so a UI- or ART- rule is met once, here, and tested once.
//   Rules: docs/ui-spec.md (UI-...) and docs/art-spec.md (ART-...). The map of rule -> piece -> test is docs/pieces.md.
//   Two halves:
//    - builders (windowHTML, buttonHTML, sliderHTML ...) are pure: options in, an HTML string out. No DOM, no app
//      state (CODE-F5), so tests/pieces.test.js runs them under Node.
//    - mount* functions add the behaviour to elements already on the page (states, peek, keys, dragging).
//   Never: read or write the app's state (S, tr, res), touch storage, or set a meaning colour (ART-K14, UI-A18):
//   pass and fail come from the app's --ok / --bad, never from a --te-* token.
//   Every piece carries data-part and data-slot (UI-T1) and the class names the built-in themes already style
//   (.s-pan, .s-ph, .tabE, .s-b, .s-ic, .te-chip, .te-tog, .te-slider), so a theme applies with no new CSS.
(function (root) {
'use strict';

const VERSION = '0.1.0';

// ---------- text ----------
// Everything a caller passes is text, never markup (CODE-S1).
const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const attr = (name, v) => (v == null || v === false ? '' : v === true ? ` ${name}` : ` ${name}="${escH(v)}"`);
const fail = msg => { throw new TypeError('TrussPieces: ' + msg); };   // programmer errors only (CODE-N3)

// ---------- tokens (ART-K) ----------
// The tokens a theme sets, with the rule that names each. A shared theme file uses the name without --te- (ART-K).
const TOKENS = [
  ['page', 'ART-K1'], ['grid', 'ART-K1'], ['panel', 'ART-K2'], ['panel-peek', 'ART-K2'], ['surface', 'ART-K3'], ['surface-2', 'ART-K3'],
  ['line', 'ART-K4'], ['line-soft', 'ART-K4'], ['ink', 'ART-K5'], ['muted', 'ART-K5'], ['strong', 'ART-K6'], ['on-strong', 'ART-K6'],
  ['ctl-bg', 'ART-K7'], ['ctl-line', 'ART-K7'], ['tab', 'ART-K8'], ['accent', 'ART-K9'], ['accent-ink', 'ART-K9'], ['hot', 'ART-K10'],
  ['mem-hi', 'ART-K11'], ['mem-hi-ink', 'ART-K11'], ['mem-dim', 'ART-K11'], ['mem-hi-flag', 'ART-K11'],
  ['font-ui', 'ART-K12'], ['font-head', 'ART-K12'], ['font-mono', 'ART-K12'], ['font-hand', 'ART-K12'],
].map(([name, rule]) => ({ name, css: '--te-' + name, rule }));

// Wireframe, the default theme: the values in the ART-K table (art-spec 1.0.4, PR #357). Brown is the action colour (ART-K6, TE-B-118);
// ctl-line #7f8893 clears ART-C2 (#355).
const WIREFRAME = {
  page: '#f2f4f6', grid: 'rgba(60,70,80,.05)', panel: 'rgba(255,255,255,.94)', 'panel-peek': 'rgba(255,255,255,.86)',
  surface: '#ffffff', 'surface-2': '#eef0f2', line: '#b9c0c8', 'line-soft': '#d5dae0', ink: '#1d232a', muted: '#4f5964',
  strong: '#7a4f1c', 'on-strong': '#ffffff', 'ctl-bg': '#ffffff', 'ctl-line': '#7f8893', tab: '#8a5a2b',
  accent: '#f0b45a', 'accent-ink': '#2a1a04', hot: '#fdebd6',
  'mem-hi': 'rgba(240,180,90,.6)', 'mem-hi-ink': '#1d232a', 'mem-dim': '.6', 'mem-hi-flag': '#ffffff',
  'font-ui': 'Barlow,"Segoe UI",system-ui,sans-serif', 'font-head': '"Barlow Semi Condensed","Arial Narrow",sans-serif',
  'font-mono': '"IBM Plex Mono",ui-monospace,Menlo,monospace', 'font-hand': '"Segoe Print","Comic Sans MS",cursive',
};

// The token block for one theme, scoped the way UI-T1 says: #stage[data-theme="<id>"].
function tokenCSS(id, values) {
  if (!/^[a-z0-9-]+$/.test(String(id))) fail('theme id must be lower-case letters, digits and hyphens');
  const v = values || WIREFRAME;
  const body = TOKENS.filter(t => v[t.name] != null).map(t => `${t.css}:${String(v[t.name]).replace(/[;{}<]/g, '')}`).join(';');
  return `#stage[data-theme="${id}"]{${body}}`;
}

// ---------- contrast (ART-C1, ART-C2) ----------
// A colour as '#rgb', '#rrggbb' or 'rgb(a)(r,g,b[,a])' -> {r,g,b,a} with r,g,b 0-255 and a 0-1; null if it isn't one.
function parseColour(c) {
  const s = String(c).trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
  m = s.match(/^#([0-9a-f]{6})$/);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
  return null;
}
// A see-through colour laid over an opaque one.
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
// WCAG contrast ratio (1 to 21) of text colour fg on background bg. A see-through bg is laid over `under` (default white).
function contrast(fg, bg, under) {
  const F = parseColour(fg), B0 = parseColour(bg), U = parseColour(under || '#ffffff');
  if (!F || !B0 || !U) return NaN;
  const B = B0.a < 1 ? over(B0, U) : B0, Fo = F.a < 1 ? over(F, B) : F;
  const [hi, lo] = [lum(Fo), lum(B)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}
// The pairs ART-C1 (text, 4.5) and ART-C2 (lines and focus, 3) check, for one theme's token values.
function contrastPairs(v) {
  return [
    { fg: 'ink', bg: 'page', min: 4.5, rule: 'ART-C1' }, { fg: 'ink', bg: 'surface', min: 4.5, rule: 'ART-C1' },
    { fg: 'ink', bg: 'panel', under: 'page', min: 4.5, rule: 'ART-C1' }, { fg: 'muted', bg: 'surface', min: 4.5, rule: 'ART-C1' },
    { fg: 'ink', bg: 'ctl-bg', min: 4.5, rule: 'ART-C1' }, { fg: 'on-strong', bg: 'strong', min: 4.5, rule: 'ART-C1' },
    { fg: 'on-strong', bg: 'tab', min: 4.5, rule: 'ART-C1' }, { fg: 'accent-ink', bg: 'accent', min: 4.5, rule: 'ART-C1' },
    { fg: 'ink', bg: 'hot', min: 4.5, rule: 'ART-C1' }, { fg: 'ink', bg: 'surface-2', min: 4.5, rule: 'ART-C1' },
    { fg: 'muted', bg: 'page', min: 4.5, rule: 'ART-C1' },
    { fg: 'ctl-line', bg: 'ctl-bg', min: 3, rule: 'ART-C2' }, { fg: 'strong', bg: 'surface', min: 3, rule: 'ART-C2' },
  ].map(p => Object.assign(p, { ratio: contrast(v[p.fg], v[p.bg], p.under ? v[p.under] : undefined) }))
    .map(p => Object.assign(p, { ok: p.ratio >= p.min }));
}

// ---------- the stick button, icon button and chip (ART-S1-S9, UI-A17, ART-I2) ----------
// opts: { label, icon, kind: 'stick' | 'icon' | 'chip', pressed (true/false = a toggle; omit = a plain button),
//         disabled, title, id, act (data-act value), sm }
// An icon-only button always keeps its words for screen readers (ART-I2): label is required.
const KIND = { stick: ['s-b', 'button'], icon: ['s-ic', 'icon-button'], chip: ['te-chip', 'chip'] };
function buttonHTML(o) {
  o = Object.assign({ kind: 'stick' }, o);
  const k = KIND[o.kind] || fail('button kind must be stick, icon or chip');
  if (!o.label) fail('a button needs a label (ART-I2: words for screen readers even when only an icon shows)');
  const cls = k[0] + (o.sm ? ' sm' : '') + (o.pressed ? ' on' : '');
  const face = o.kind === 'icon' ? escH(o.icon || o.label.slice(0, 1)) : (o.icon ? `<span class="te-bi" aria-hidden="true">${escH(o.icon)}</span>` : '') + escH(o.label);
  return `<button type="button" class="${cls}" data-part="${k[1]}" data-slot="ctl"${attr('id', o.id)}${attr('data-act', o.act)}`
    + `${o.kind === 'icon' ? attr('aria-label', o.label) : ''}${attr('title', o.title || (o.kind === 'icon' ? o.label : null))}`
    + `${o.pressed != null ? ` aria-pressed="${!!o.pressed}"` : ''}${attr('disabled', !!o.disabled)}>${face}</button>`;
}

// ---------- the toggle (ART-S3, ART-S6, UI-A17) ----------
// A switch: the stick is pushed in when on, and the words say what it switches. opts: { label, checked, id, disabled }
function toggleHTML(o) {
  if (!o || !o.label) fail('a toggle needs a label');
  return `<label class="te-togrow" data-part="toggle-row" data-slot="ctl"><button type="button" role="switch" class="te-tog${o.checked ? ' on' : ''}" data-part="toggle" data-slot="ctl"`
    + `${attr('id', o.id)} aria-checked="${!!o.checked}"${attr('disabled', !!o.disabled)}><i aria-hidden="true"></i></button><span>${escH(o.label)}</span></label>`;
}

// ---------- tabs (UI-S6, UI-K7) ----------
// opts: { label (for the tab list), tabs: [{ id, label }], selected (id), idPrefix }
// Roving focus: only the picked tab is in the Tab order; arrows, Home and End move between tabs (mountTabs).
function tabsHTML(o) {
  if (!o || !Array.isArray(o.tabs) || !o.tabs.length) fail('tabs need a list of { id, label }');
  const sel = o.tabs.some(t => t.id === o.selected) ? o.selected : o.tabs[0].id, pre = o.idPrefix || 'tab';
  return `<div class="te-tabs" role="tablist" data-part="tabs" data-slot="ctl"${attr('aria-label', o.label)}>`
    + o.tabs.map(t => `<button type="button" role="tab" class="tab${t.id === sel ? ' on' : ''}" data-part="tab" data-slot="ctl" data-tab-id="${escH(t.id)}"`
      + ` id="${escH(pre + '-' + t.id)}" aria-selected="${t.id === sel}" tabindex="${t.id === sel ? 0 : -1}">${escH(t.label)}</button>`).join('') + '</div>';
}

// ---------- the window and its edge tab (UI-A3, UI-A4, UI-W1-W9) ----------
// A window floats over the picture and never moves it (UI-A3). Three states: W words and icons, I icons only, T an edge tab.
const STATES = ['T', 'I', 'W'];
const HOMES = { left: 'l', right: 'r', top: 't', bottom: 'b' };
// The next state when ‹ (dir -1) or › (dir +1) is pressed: W -> I -> T and back, never past either end (UI-A4).
function nextState(state, dir) {
  const i = STATES.indexOf(state); if (i < 0) fail('window state must be W, I or T');
  return STATES[Math.max(0, Math.min(2, i + (dir > 0 ? 1 : -1)))];
}
// opts: { id, title, home: 'left'|'right'|'top'|'bottom', state: 'W'|'I'|'T', body (HTML the caller built), icons: [{ ic, label, icon, on }] }
function windowHTML(o) {
  if (!o || !/^[a-z][a-z0-9-]*$/.test(String(o.id))) fail('a window needs an id of lower-case letters, digits and hyphens');
  if (!HOMES[o.home]) fail('a window home is left, right, top or bottom');
  const st = STATES.includes(o.state) ? o.state : 'W', right = o.home === 'right', title = o.title || o.id;
  const shrink = right ? '›' : '‹', grow = right ? '‹' : '›';
  const icons = (o.icons || []).map(x => buttonHTML({ kind: 'icon', label: x.label, icon: x.icon, pressed: x.on, act: x.ic })).join('');
  return `<section class="s-pan" id="win-${o.id}" data-win="${o.id}" data-home="${o.home}" data-state="${st}" data-part="window" data-slot="bg" role="region" aria-label="${escH(title)}"${st === 'T' ? ' hidden' : ''}>`
    + `<div class="s-ph" data-part="window-title" data-slot="bg"><span class="grip" aria-hidden="true">⋮⋮</span><span class="wt">${escH(title)}</span>`
    + `<span class="stp" data-part="stepper" data-slot="ctl"><button type="button" class="s-ic sm" data-part="icon-button" data-slot="ctl" data-step="shrink" aria-label="${escH((st === 'W' ? 'Shrink ' : 'Hide ') + title + (st === 'W' ? ' to icons' : ''))}">${shrink}</button>`
    + `<button type="button" class="s-ic sm" data-part="icon-button" data-slot="ctl" data-step="grow" aria-label="${escH('Grow ' + title + ' to words and icons')}"${st === 'W' ? ' hidden' : ''}>${grow}</button></span></div>`
    + `<div class="s-bd">${o.body || ''}</div><div class="s-icons" role="toolbar" aria-label="${escH(title + ' (icons)')}">${icons}</div></section>`;
}
function edgeTabHTML(o) {
  if (!o || !HOMES[o.home]) fail('an edge tab needs the window home');
  const title = o.title || o.id;
  return `<button type="button" class="tabE ${HOMES[o.home]}" data-part="edge-tab" data-slot="ctl" data-tab="${escH(o.id)}" aria-controls="win-${escH(o.id)}" aria-label="${escH('Show ' + title)}" title="${escH('Show ' + title + ' (hover to peek)')}"${o.state === 'T' ? '' : ' hidden'}>${escH(title)}</button>`;
}

// ---------- the slider (ART-W1, ART-W5, UI-I1-I3) ----------
// The value can't go past a model limit (the wall, UI-I3); past a course rule it goes on and turns pink (UI-I2, never clamped).
// spec: { min, max, step, wall: { lo, hi }, rule: { lo, hi } } (all in the input's own unit; wall and rule optional)
function sliderValue(raw, spec) {
  let v = Number(raw); if (!isFinite(v)) return { value: NaN, ok: false, reason: 'not-a-number' };
  const st = spec.step > 0 ? spec.step : 0, w = spec.wall || {}, r = spec.rule || {};
  if (st) v = Math.round((v - spec.min) / st) * st + spec.min;
  v = Math.max(spec.min, Math.min(spec.max, v));
  let atWall = '';
  if (w.lo != null && v < w.lo) { v = w.lo; atWall = 'lo'; }
  if (w.hi != null && v > w.hi) { v = w.hi; atWall = 'hi'; }
  v = +v.toFixed(10);
  const overRule = (r.lo != null && v < r.lo) || (r.hi != null && v > r.hi);
  return { value: v, ok: true, atWall, overRule };
}
const pct = (v, o) => (o.max > o.min ? Math.max(0, Math.min(100, (v - o.min) / (o.max - o.min) * 100)) : 0);
const num = v => +(+v).toFixed(6);
// opts: { key, label, unit, min, max, step, value, from, to (the swept range; both or neither), wall, rule, wallNote, ruleNote }
function sliderHTML(o) {
  if (!o || !o.key || !o.label) fail('a slider needs a key and a label');
  if (!(o.max > o.min)) fail('a slider needs max > min');
  const sv = sliderValue(o.value, o), swept = o.from != null && o.to != null, u = o.unit ? ' ' + o.unit : '';
  const zones = [];
  const zone = (cls, lo, hi, note) => { const a = pct(lo, o), b = pct(hi, o); if (b > a) zones.push(`<span class="zone ${cls}" style="left:${num(a)}%;width:${num(b - a)}%"${attr('title', note)} aria-hidden="true"></span>`); };
  if (o.rule && o.rule.lo != null) zone('rule', o.min, o.rule.lo, o.ruleNote); if (o.rule && o.rule.hi != null) zone('rule', o.rule.hi, o.max, o.ruleNote);
  if (o.wall && o.wall.lo != null) zone('wall', o.min, o.wall.lo, o.wallNote); if (o.wall && o.wall.hi != null) zone('wall', o.wall.hi, o.max, o.wallNote);
  const th = (end, v, name) => `<span class="th${end === 'val' ? ' val' : ''}" data-end="${end}" role="slider" tabindex="0" style="left:${num(pct(v, o))}%"`
    + ` aria-label="${escH(name)}" aria-valuemin="${num(o.min)}" aria-valuemax="${num(o.max)}" aria-valuenow="${num(v)}" aria-valuetext="${escH(num(v) + u)}"></span>`;
  const lo = swept ? Math.min(o.from, o.to) : null, hi = swept ? Math.max(o.from, o.to) : null;
  return `<div class="te-slider" data-part="slider" data-slot="ctl" data-key="${escH(o.key)}"${swept ? ' data-swept' : ''}${sv.overRule ? ' data-over="rule"' : ''}${sv.atWall ? ` data-wall="${sv.atWall}"` : ''}`
    + ` data-min="${num(o.min)}" data-max="${num(o.max)}" data-step="${num(o.step || 0)}"`
    + `${o.wall && o.wall.lo != null ? ` data-wall-lo="${num(o.wall.lo)}"` : ''}${o.wall && o.wall.hi != null ? ` data-wall-hi="${num(o.wall.hi)}"` : ''}`
    + `${o.rule && o.rule.lo != null ? ` data-rule-lo="${num(o.rule.lo)}"` : ''}${o.rule && o.rule.hi != null ? ` data-rule-hi="${num(o.rule.hi)}"` : ''}>`
    + `<span class="trk" aria-hidden="true"></span>${zones.join('')}`
    + (swept ? `<span class="band" data-part="slider-band" style="left:${num(pct(lo, o))}%;width:${num(pct(hi, o) - pct(lo, o))}%" aria-hidden="true"></span>`
      + th('from', lo, o.label + ': sweep from') + th('to', hi, o.label + ': sweep to') : '')
    + th('val', sv.value, o.label) + '</div>';
}

// ---------- the results card (UI-W2, UI-W12, UI-A17, ART-W3) ----------
// Numbers only, each next to the limit it's checked by, then the verdict in words and a mark (✓ / ✕), never colour alone.
// opts: { checks: [{ label, value, limit, op: '>=' | '<=' | '=', unit, ok }], verdict: 'pass' | 'fail' | 'unstable', note, expanded, id }
const OPS = { '>=': ['≥', '<'], '<=': ['≤', '>'], '=': ['=', '≠'] };
function resultsHTML(o) {
  o = o || {};
  const V = { pass: ['ok', '✓ PASSES'], fail: ['bad', '✕ FAILS'], unstable: ['bad', '✕ UNSTABLE'] }[o.verdict] || fail('verdict must be pass, fail or unstable');
  const items = o.verdict === 'unstable' ? [`<span class="chk">${escH(o.note || 'no capacity: the truss is a mechanism')}</span>`]
    : (o.checks || []).map(c => {
      const op = OPS[c.op] || fail('a check op is >=, <= or ='), u = c.unit ? ' ' + c.unit : '';
      return `<span class="chk${c.ok ? '' : ' bad'}" data-ok="${!!c.ok}"${attr('title', c.label)}>${c.label ? `<span class="lbl">${escH(c.label)}</span> ` : ''}`
        + `${escH(c.value)} ${escH(c.ok ? op[0] : op[1])} ${escH(c.limit)}${escH(u)}${c.ok ? '' : ' <span class="x" aria-hidden="true">✕</span>'}</span>`;
    });
  return `<button type="button" class="res" data-part="results" data-slot="disp"${attr('id', o.id)} aria-expanded="${!!o.expanded}" aria-haspopup="dialog">`
    + `<span class="chks">${items.join('<span class="sep" aria-hidden="true"> · </span>')}</span>`
    + `<span class="pill ${V[0]}" data-part="badge" data-slot="disp">${V[1]}</span><span aria-hidden="true">▾</span></button>`;
}

// ---------- CSS ----------
// The look of the pieces in Wireframe, using only --te-* tokens and the app's meaning colours (--ok, --bad).
// Scoped to #stage like everything themed (UI-T1); a theme's own rules are more specific and win.
// UI-A3: .te-picture is the base layer, inset 0 always; windows are absolute on top and never change its box.
// Course-rule pink is a meaning colour like pass and fail (ART-K16): read from the app's --rule, never a --te-* token.
const CSS = `
#stage .te-picture{position:absolute;inset:0;z-index:0}
#stage .s-pan{position:absolute;box-sizing:border-box;background:var(--te-panel);color:var(--te-ink);border:1px solid var(--te-line);border-radius:10px;box-shadow:0 4px 16px rgba(20,30,40,.12);z-index:76;display:flex;flex-direction:column;min-width:0;max-height:calc(100% - 24px);max-width:40%}
#stage .s-pan[hidden]:not(.peek){display:none}
#stage .s-pan.peek{display:flex;border:2px dashed var(--te-strong);background:var(--te-panel-peek);z-index:79}
#stage .s-pan[data-home="left"]{left:var(--te-gap,12px);top:var(--te-home-top,60px)}
#stage .s-pan[data-home="right"]{right:var(--te-gap,12px);top:var(--te-home-top,60px)}
#stage .s-pan[data-home="top"]{left:var(--te-gap,12px);top:var(--te-home-top,60px)}
#stage .s-pan[data-home="bottom"]{left:var(--te-gap,12px);bottom:var(--te-gap,12px)}
#stage .s-pan[data-state="W"]{width:var(--te-win-w,320px)}
#stage .s-pan[data-state="I"]{width:auto}
#stage .s-pan:is([data-home="left"],[data-home="right"])[data-state="I"]{width:var(--te-win-i,52px)}
#stage .s-pan:is([data-home="left"],[data-home="right"])[data-state="I"] .stp{flex-direction:column}
#stage .s-ph{display:flex;align-items:center;gap:8px;padding:5px 6px 5px 10px;border-bottom:1px solid var(--te-line-soft);font:700 13px var(--te-font-head);letter-spacing:.05em;text-transform:uppercase;flex:none;min-height:38px;box-sizing:border-box}
#stage .s-ph .wt{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#stage .s-ph .grip{font:500 13px var(--te-font-mono);color:var(--te-muted)}
#stage .s-pan>.s-bd{overflow:auto;min-height:0;flex:1 1 auto;padding:8px 10px;overscroll-behavior:contain}
#stage .s-pan>.s-icons{display:none;gap:6px;padding:6px;flex-wrap:wrap}
#stage .s-pan[data-state="I"]>.s-bd{display:none}
#stage .s-pan[data-state="I"]>.s-icons{display:flex}
#stage .s-pan[data-state="I"] .s-ph .wt,#stage .s-pan[data-state="I"] .s-ph .grip{display:none}
#stage .s-pan[data-state="I"] .s-ph{justify-content:center;padding:5px}
#stage .s-pan[data-home="left"][data-state="I"]>.s-icons,#stage .s-pan[data-home="right"][data-state="I"]>.s-icons{flex-direction:column;align-items:center}
#stage .stp{display:inline-flex;gap:4px;flex:none}
#stage :is(.s-pan,.te-tabs,.te-slider,.res) [hidden]{display:none}
#stage .tabE{position:absolute;border:0;background:var(--te-tab);color:var(--te-on-strong);font:700 13px var(--te-font-head);letter-spacing:.06em;text-transform:uppercase;padding:14px 8px;writing-mode:vertical-rl;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2);z-index:80}
#stage .tabE[hidden]{display:none}
#stage .tabE.l,#stage .tabE.r{width:28px;padding:14px 0;box-sizing:border-box}
#stage .tabE.l{left:0;top:35%;border-radius:0 10px 10px 0}
#stage .tabE.r{right:0;top:35%;border-radius:10px 0 0 10px}
#stage .tabE.t,#stage .tabE.b{writing-mode:horizontal-tb;height:28px;padding:0 14px;box-sizing:border-box;left:40px}
#stage .tabE.t{top:var(--te-home-top,52px);border-radius:0 0 10px 10px}
#stage .tabE.b{bottom:0;border-radius:10px 10px 0 0}
#stage .s-b,#stage .s-ic,#stage .te-chip,#stage .te-tog{box-sizing:border-box;font:600 14px var(--te-font-ui);color:var(--te-ink);background:var(--te-ctl-bg);border:1px solid var(--te-ctl-line);border-radius:6px;cursor:pointer;
  box-shadow:0 2px 0 var(--te-ctl-line),0 3px 6px rgba(20,30,40,.12);transition:transform var(--t-press,120ms) ease-out,box-shadow var(--t-press,120ms) ease-out}
#stage .s-b{min-height:32px;padding:0 12px;display:inline-flex;align-items:center;gap:6px}
#stage .s-b.sm{min-height:28px;font-size:13px;padding:0 10px}
#stage .s-ic{width:36px;height:36px;padding:0;display:inline-flex;align-items:center;justify-content:center;flex:none;font-size:15px}
#stage .s-ic.sm{width:28px;height:28px;font-size:13px}
#stage .te-chip{min-height:28px;padding:0 10px;font-size:13px;display:inline-flex;align-items:center}
#stage :is(.s-b,.s-ic,.te-chip,.te-tog):hover:not(:disabled):not(.on){transform:translate(-1px,-2px);box-shadow:0 3px 0 var(--te-ctl-line),2px 6px 10px rgba(20,30,40,.18)}
#stage :is(.s-b,.s-ic,.te-chip,.te-tog).on,#stage :is(.s-b,.s-ic,.te-chip)[aria-pressed="true"],#stage .te-tog[aria-checked="true"]{background:var(--te-strong);border-color:var(--te-strong);color:var(--te-on-strong);transform:translateY(2px);box-shadow:inset 0 3px 4px rgba(0,0,0,.28)}
#stage :is(.s-b,.s-ic,.te-chip,.te-tog):disabled{opacity:.5;filter:saturate(.3);cursor:default;transform:none}
#stage :is(button,[role="slider"],[tabindex]):focus-visible{outline:3px solid var(--te-accent);outline-offset:3px}
#stage .te-togrow{display:inline-flex;align-items:center;gap:8px;font:500 14px var(--te-font-ui);cursor:pointer}
#stage .te-tog{position:relative;width:34px;height:30px;padding:0;flex:none}
#stage .te-tog i{position:absolute;top:6px;left:10px;width:12px;height:10px;border-radius:2px;background:var(--te-ctl-line)}
#stage .te-tog[aria-checked="true"] i{top:9px;background:var(--te-on-strong)}
#stage .te-tabs{display:flex;flex-wrap:wrap}
#stage .te-tabs .tab{border:1px solid var(--te-ctl-line);border-radius:0;margin-left:-1px;background:var(--te-ctl-bg);color:var(--te-ink);font:600 13px var(--te-font-ui);padding:4px 10px;cursor:pointer;transition:transform var(--t-press,120ms) ease-out}
#stage .te-tabs .tab:first-child{margin-left:0;border-radius:4px 0 0 1px}#stage .te-tabs .tab:last-child{border-radius:0 4px 1px 0}
#stage .te-tabs .tab[aria-selected="true"]{background:var(--te-strong);border-color:var(--te-strong);color:var(--te-on-strong);transform:translateY(2px);box-shadow:inset 0 3px 4px rgba(0,0,0,.28)}
#stage .te-slider{position:relative;height:26px;min-width:120px;touch-action:none}
#stage .te-slider .trk{position:absolute;left:0;right:0;top:11px;height:4px;border-radius:2px;background:var(--te-line)}
#stage .te-slider .zone{position:absolute;top:6px;height:14px;pointer-events:auto}
#stage .te-slider .zone.rule{background:repeating-linear-gradient(-45deg,transparent 0 3px,var(--rule,#c8288c) 3px 5px)}
#stage .te-slider .zone.wall{background:var(--te-line-soft);border-left:2px solid var(--te-muted);border-right:2px solid var(--te-muted)}
#stage .te-slider .band{position:absolute;top:8px;height:10px;background:var(--te-hot);border:1px solid var(--te-strong);border-radius:2px;box-sizing:border-box}
#stage .te-slider .th{position:absolute;top:3px;width:10px;height:20px;margin-left:-5px;box-sizing:border-box;background:var(--te-ctl-bg);border:2px solid var(--te-strong);cursor:grab}
#stage .te-slider .th[data-end="from"]{border-right:0;border-radius:3px 0 0 3px}
#stage .te-slider .th[data-end="to"]{border-left:0;border-radius:0 3px 3px 0}
#stage .te-slider .th.val{width:16px;margin-left:-8px;border-radius:3px;background:var(--te-strong)}
#stage .te-slider[data-over="rule"] .th.val{background:var(--rule,#c8288c);border-color:#7a0e52}
#stage .res{display:inline-flex;align-items:center;gap:8px;min-height:36px;border:1px solid var(--te-line);border-radius:18px;background:var(--te-surface);color:var(--te-ink);padding:0 8px 0 14px;font:500 13px var(--te-font-mono);cursor:pointer;white-space:nowrap}
#stage .res .lbl{font-family:var(--te-font-ui);color:var(--te-muted)}
#stage .res .chk.bad{color:var(--bad,#b0177a)}
#stage .res .pill{font:700 13px var(--te-font-head);letter-spacing:.08em;border:1.5px solid currentColor;border-radius:10px;padding:1px 7px}
#stage .res .pill.ok{color:var(--ok,#2f7a4b)}#stage .res .pill.bad{color:var(--bad,#b0177a)}
#stage .te-pop{position:absolute;z-index:90;background:var(--te-surface);color:var(--te-ink);font:400 13px var(--te-font-ui);border:1px solid var(--te-ctl-line);border-radius:10px;box-shadow:0 12px 40px rgba(20,30,40,.25);padding:10px 12px}
#stage .te-pop[hidden]{display:none}
@media (prefers-reduced-motion:reduce){#stage :is(.s-b,.s-ic,.te-chip,.te-tog){transition:none}}
`;
// Put the CSS on the page once (one <style id="te-pieces">), the way shell.js adds #themeCss. Returns the element.
function install(doc) {
  doc = doc || (typeof document !== 'undefined' ? document : null); if (!doc) fail('install needs a document');
  let s = doc.getElementById('te-pieces');
  if (!s) { s = doc.createElement('style'); s.id = 'te-pieces'; s.textContent = CSS; doc.head.appendChild(s); }
  return s;
}

// ---------- behaviour (DOM) ----------
const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); return () => el.removeEventListener(ev, fn, o); };

// A window and its edge tab. opts.onState(newState, id) is called after every change (the caller saves it).
// Returns { get state, setState(st), destroy() }.
function mountWindow(win, tab, opts) {
  opts = opts || {};
  const id = win.dataset.win, title = win.getAttribute('aria-label') || id;
  let peekT = 0;
  const off = [];
  // UI-W17: a peek sits 8 px from its own tab, lined up with the tab's top (left/right) or left edge (top/bottom),
  // kept inside the stage. The window's own inline position is put back when the peek ends.
  let saved = null;
  function placePeek() {
    if (!tab) return;
    const home = win.dataset.home, P = win.offsetParent || win.parentElement, pw = P.clientWidth, ph = P.clientHeight, GAP = 8;
    if (!saved) saved = { left: win.style.left, right: win.style.right, top: win.style.top, bottom: win.style.bottom };
    const t = { l: tab.offsetLeft, t: tab.offsetTop, w: tab.offsetWidth, h: tab.offsetHeight }, w = win.offsetWidth, h = win.offsetHeight;
    const clampX = x => Math.max(0, Math.min(pw - w, x)), clampY = y => Math.max(0, Math.min(ph - h, y));
    const pos = { left: 'auto', right: 'auto', top: 'auto', bottom: 'auto' };
    if (home === 'left') { pos.left = (t.l + t.w + GAP) + 'px'; pos.top = clampY(t.t) + 'px'; }
    else if (home === 'right') { pos.right = (pw - t.l + GAP) + 'px'; pos.top = clampY(t.t) + 'px'; }
    else if (home === 'top') { pos.top = (t.t + t.h + GAP) + 'px'; pos.left = clampX(t.l) + 'px'; }
    else { pos.bottom = (ph - t.t + GAP) + 'px'; pos.left = clampX(t.l) + 'px'; }
    Object.assign(win.style, pos);
  }
  function unplacePeek() { if (saved) { Object.assign(win.style, saved); saved = null; } }
  function paint() {
    if (!win.classList.contains('peek')) unplacePeek();
    const st = win.dataset.state;
    win.hidden = st === 'T' && !win.classList.contains('peek');
    if (tab) tab.hidden = st !== 'T';
    const sh = win.querySelector('[data-step="shrink"]'), gr = win.querySelector('[data-step="grow"]');
    if (sh) sh.setAttribute('aria-label', st === 'W' ? `Shrink ${title} to icons` : `Hide ${title}`);
    if (gr) gr.hidden = st === 'W';
  }
  function setState(st) {
    if (!STATES.includes(st)) fail('window state must be W, I or T');
    win.classList.remove('peek'); win.dataset.state = st; paint();
    if (opts.onState) opts.onState(st, id);
  }
  off.push(on(win, 'click', ev => {
    const b = ev.target.closest('[data-step]');
    if (b && win.contains(b)) { setState(nextState(win.dataset.state, b.dataset.step === 'grow' ? 1 : -1)); if (win.dataset.state === 'T' && tab) tab.focus(); return; }
    if (win.classList.contains('peek')) setState('W');   // a click on a peek keeps it open (UI-W9)
  }));
  if (tab) {
    const unpeek = () => { clearTimeout(peekT); peekT = setTimeout(() => { if (!win.matches(':hover') && !tab.matches(':hover')) { win.classList.remove('peek'); paint(); } }, opts.unpeekMs == null ? 400 : opts.unpeekMs); };
    off.push(on(tab, 'click', () => { setState('W'); const f = win.querySelector('.s-bd :is(button,input,select,[tabindex="0"])'); if (f) f.focus({ preventScroll: true }); }));
    off.push(on(tab, 'mouseenter', () => { clearTimeout(peekT); peekT = setTimeout(() => { if (win.dataset.state === 'T') { win.classList.add('peek'); paint(); placePeek(); } }, opts.peekMs == null ? 220 : opts.peekMs); }));
    off.push(on(tab, 'mouseleave', unpeek));
    off.push(on(win, 'mouseleave', () => { if (win.classList.contains('peek')) unpeek(); }));
    off.push(on(win, 'mouseenter', () => clearTimeout(peekT)));
  }
  paint();
  return { get state() { return win.dataset.state; }, setState, destroy() { clearTimeout(peekT); off.forEach(f => f()); } };
}

// Toggle and pressed-button behaviour: click flips aria-pressed / aria-checked and .on (ART-S6), then onChange(value, el).
function mountToggle(el, opts) {
  opts = opts || {};
  const a = el.getAttribute('role') === 'switch' ? 'aria-checked' : 'aria-pressed';
  if (!el.hasAttribute(a)) fail('mountToggle needs a toggle or a button with aria-pressed');
  return on(el, 'click', () => { if (el.disabled) return; const v = el.getAttribute(a) !== 'true'; el.setAttribute(a, String(v)); el.classList.toggle('on', v); if (opts.onChange) opts.onChange(v, el); });
}

// Tabs: click or arrows pick a tab (roving tabindex; UI-K7). opts.onSelect(id, tabEl).
function mountTabs(list, opts) {
  opts = opts || {};
  const tabs = () => [...list.querySelectorAll('[role="tab"]')];
  function select(t, focus) {
    tabs().forEach(x => { const s = x === t; x.setAttribute('aria-selected', String(s)); x.classList.toggle('on', s); x.tabIndex = s ? 0 : -1; });
    if (focus) t.focus(); if (opts.onSelect) opts.onSelect(t.dataset.tabId, t);
  }
  const offs = [on(list, 'click', ev => { const t = ev.target.closest('[role="tab"]'); if (t && list.contains(t)) select(t, false); }),
    on(list, 'keydown', ev => {
      const all = tabs(), i = all.indexOf(document.activeElement); if (i < 0) return;
      const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[ev.key];
      if (j == null) return; ev.preventDefault(); select(all[(j + all.length) % all.length], true);
    })];
  return { select: id => { const t = tabs().find(x => x.dataset.tabId === id); if (t) select(t, false); }, destroy() { offs.forEach(f => f()); } };
}

// Slider: drag a handle or use the keys (arrows = one step, PageUp/PageDown = ten, Home/End = the ends).
// The value stops at a wall (UI-I3) and goes past a course rule, marked (UI-I2). opts.onInput({ end, value, from, to, overRule, atWall }).
function mountSlider(el, opts) {
  opts = opts || {};
  const d = el.dataset, spec = { min: +d.min, max: +d.max, step: +d.step || 0,
    wall: { lo: d.wallLo != null ? +d.wallLo : null, hi: d.wallHi != null ? +d.wallHi : null }, rule: { lo: d.ruleLo != null ? +d.ruleLo : null, hi: d.ruleHi != null ? +d.ruleHi : null } };
  const th = e => el.querySelector(`.th[data-end="${e}"]`), band = el.querySelector('.band');
  const get = e => (th(e) ? +th(e).getAttribute('aria-valuenow') : null);
  function set(end, raw) {
    let r = sliderValue(raw, spec); if (!r.ok) return;
    if (end === 'from' && th('to')) r = sliderValue(Math.min(r.value, get('to')), spec);
    if (end === 'to' && th('from')) r = sliderValue(Math.max(r.value, get('from')), spec);
    const t = th(end); t.setAttribute('aria-valuenow', String(r.value)); t.setAttribute('aria-valuetext', String(r.value) + (opts.unit ? ' ' + opts.unit : '')); t.style.left = num(pct(r.value, spec)) + '%';
    if (end === 'val') { if (r.overRule) el.dataset.over = 'rule'; else delete el.dataset.over; if (r.atWall) el.dataset.wall = r.atWall; else delete el.dataset.wall; }
    if (band) { const a = pct(get('from'), spec), b = pct(get('to'), spec); band.style.left = num(a) + '%'; band.style.width = num(b - a) + '%'; }
    if (opts.onInput) opts.onInput({ end, value: r.value, from: get('from'), to: get('to'), overRule: r.overRule, atWall: r.atWall });
  }
  const step = spec.step || (spec.max - spec.min) / 100;
  const offs = [on(el, 'keydown', ev => {
    const t = ev.target.closest('.th'); if (!t) return;
    const v = +t.getAttribute('aria-valuenow'), k = { ArrowRight: v + step, ArrowUp: v + step, ArrowLeft: v - step, ArrowDown: v - step, PageUp: v + 10 * step, PageDown: v - 10 * step, Home: spec.min, End: spec.max }[ev.key];
    if (k == null) return; ev.preventDefault(); set(t.dataset.end, k);
  }), on(el, 'pointerdown', ev => {
    const t = ev.target.closest('.th'); if (!t || ev.button !== 0) return;
    ev.preventDefault(); t.focus(); t.setPointerCapture && t.setPointerCapture(ev.pointerId);
    const box = el.getBoundingClientRect();
    const move = e => set(t.dataset.end, spec.min + (e.clientX - box.left) / box.width * (spec.max - spec.min));
    const up = () => { t.removeEventListener('pointermove', move); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', up); };
    t.addEventListener('pointermove', move); t.addEventListener('pointerup', up); t.addEventListener('pointercancel', up);
  })];
  return { set, get, destroy() { offs.forEach(f => f()); } };
}

// Pop-ups (UI-W8): a pointer-down outside the open pop-up closes it and does nothing else; Esc closes the top-most
// one and returns focus to its opener. One manager per document; open(pop, opener) / close(pop).
function popups(doc) {
  doc = doc || document;
  const stack = [];
  function close(pop) { const i = stack.findIndex(x => x.pop === pop); if (i < 0) return; const [x] = stack.splice(i, 1); pop.hidden = true; if (x.opener) x.opener.setAttribute('aria-expanded', 'false'); return x; }
  function open(pop, opener) { if (stack.some(x => x.pop === pop)) return; pop.hidden = false; stack.push({ pop, opener }); if (opener) opener.setAttribute('aria-expanded', 'true'); }
  const down = ev => {
    if (!stack.length) return; const top = stack[stack.length - 1];
    if (top.pop.contains(ev.target) || (top.opener && top.opener.contains(ev.target))) return;
    ev.preventDefault(); ev.stopPropagation(); close(top.pop);
    // the click that follows this pointer-down must do nothing either (UI-W8)
    const eat = e => { e.preventDefault(); e.stopPropagation(); }; doc.addEventListener('click', eat, { capture: true, once: true });
    setTimeout(() => doc.removeEventListener('click', eat, { capture: true }), 400);
  };
  const key = ev => { if (ev.key !== 'Escape' || !stack.length) return; ev.preventDefault(); ev.stopPropagation(); const x = close(stack[stack.length - 1].pop); if (x && x.opener) x.opener.focus(); };
  doc.addEventListener('pointerdown', down, true); doc.addEventListener('keydown', key, true);
  return { open, close, get open_count() { return stack.length; }, destroy() { doc.removeEventListener('pointerdown', down, true); doc.removeEventListener('keydown', key, true); } };
}

const api = { VERSION, TOKENS, WIREFRAME, STATES, tokenCSS, parseColour, contrast, contrastPairs, escH,
  buttonHTML, toggleHTML, tabsHTML, windowHTML, edgeTabHTML, nextState, sliderValue, sliderHTML, resultsHTML,
  CSS, install, mountWindow, mountToggle, mountTabs, mountSlider, popups };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussPieces = api;
})(typeof window !== 'undefined' ? window : globalThis);
