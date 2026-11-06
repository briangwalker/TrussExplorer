// The gallery page (#384; UI-G1-G5): the URL guard and the page it builds, without a browser.
//   node --test tests/gallery.test.js   (the browser half, with the Architecture Lead's guards a-e, is tests/ui/gallery.mjs)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const P = require(path.join(__dirname, '..', 'src', 'pieces.js'));
const G = require(path.join(__dirname, '..', 'src', 'gallery.js'));

test('only exactly ?gallery=1 opens it (UI-G2, guard a)', () => {
  for (const s of ['?gallery=1', 'gallery=1', '?layout=x&gallery=1', '?gallery=1&x=2']) assert.strictEqual(G.wanted(s), true, s);
  for (const s of ['', '?', '?gallery', '?gallery=', '?gallery=0', '?gallery=true', '?gallery=01', '?gallery=1&gallery=1', '?Gallery=1', '?galleryx=1', null, undefined])
    assert.strictEqual(G.wanted(s), false, String(s));
});

test('start() does nothing without the parameter (guard a)', () => {
  let touched = false;
  const doc = { addEventListener() { touched = true; }, readyState: 'loading', getElementById() { touched = true; } };
  assert.strictEqual(G.start(doc, { location: { search: '' } }), false);
  assert.strictEqual(G.start(doc, { location: { search: '?gallery=2' } }), false);
  assert.strictEqual(touched, false, 'no listener, no DOM');
});

test('start() waits for DOMContentLoaded while the page is loading (guard b)', () => {
  const calls = [];
  const doc = { readyState: 'loading', addEventListener(t, fn, o) { calls.push([t, o]); }, getElementById() { throw new Error('too early'); } };
  assert.strictEqual(G.start(doc, { location: { search: '?gallery=1' } }), true);
  assert.deepStrictEqual(calls, [['DOMContentLoaded', { once: true }]]);
});

test('every shared piece, in every state, each item labelled with its rules (UI-G1, UI-G3)', () => {
  const h = G.pageHTML(P, { themes: null });
  for (const part of ['window', 'window-title', 'edge-tab', 'stepper', 'button', 'icon-button', 'chip', 'toggle', 'tabs', 'tab', 'slider', 'slider-band', 'results', 'badge'])
    assert.match(h, new RegExp(`data-part="${part}"`), part);
  for (const st of ['W', 'I', 'T']) assert.match(h, new RegExp(`data-state="${st}"`), 'window state ' + st);
  for (const home of ['left', 'right', 'bottom']) assert.match(h, new RegExp(`data-home="${home}"`), home);
  assert.match(h, /aria-pressed="true"/, 'pressed'); assert.match(h, / disabled>/, 'disabled');
  assert.match(h, /role="switch"[^>]*aria-checked="true"/); assert.match(h, /role="switch"[^>]*aria-checked="false"/);
  assert.match(h, /data-over="rule"/, 'past a course rule'); assert.match(h, /data-wall="lo"/, 'at a model limit'); assert.match(h, /data-swept/, 'swept');
  assert.match(h, /✓ PASSES/); assert.match(h, /✕ FAILS/); assert.match(h, /✕ UNSTABLE/);
  assert.match(h, /class="te-pop"/, 'a pop-up');
  assert.match(h, /class="te-picture g-pic"/, 'windows float over a picture (UI-A3)');
  for (const s of G.sections(P)) { assert.ok(s.rules.length > 0, s.id + ' names its rules'); for (const r of s.rules) assert.match(r, /^(UI|ART)-[A-Z]+\d+$/, r); }
  assert.strictEqual((h.match(/<figure class="g-item"/g) || []).length, G.sections(P).length);
});

test('pieces that don\'t exist yet show as "not built yet" cards naming their rules (UI-G3)', () => {
  const h = G.pageHTML(P, { themes: null });
  assert.strictEqual((h.match(/data-g-notbuilt/g) || []).length, G.NOT_BUILT.length + 1, 'plus theme switching while there is no door');
  assert.match(h, /Switching themes in the gallery/);
  const h2 = G.pageHTML(P, { themes: [{ id: 'wireframe', name: 'Wireframe' }, { id: 'og', name: 'OG (v61)' }], theme: 'og' });
  assert.doesNotMatch(h2, /Switching themes in the gallery/, 'with the door, the picker replaces the card');
  assert.match(h2, /data-act="theme:wireframe"[^>]*aria-pressed="false"/); assert.match(h2, /data-act="theme:og"[^>]*aria-pressed="true"/);
});

test('the page ends with a coverage list: rules shown, and rules with no piece yet (UI-G1)', () => {
  const c = G.coverage(P, { themes: null });
  assert.ok(c.shown.includes('UI-A3') && c.shown.includes('ART-S5') && c.shown.includes('UI-K7'));
  assert.ok(c.missing.includes('UI-I8') && c.missing.includes('UI-W10') && c.missing.includes('UI-W7'));
  assert.ok(c.missing.every(r => !c.shown.includes(r)), 'a rule is in one list only');
  assert.ok(c.missing.includes('UI-G4') === false || !c.shown.includes('UI-G4'));
  const h = G.pageHTML(P, {});
  assert.match(h, /Rules shown \(\d+\)/); assert.match(h, /Rules with no piece yet \(\d+\)/);
});

test('the page carries no script, no on...= attribute, no outside URL (CODE-S2, guard e)', () => {
  const h = G.pageHTML(P, { themes: [{ id: 'x"><script>', name: '<img src=x onerror=1>' }] });
  assert.doesNotMatch(h, /<script/i); assert.doesNotMatch(h, /<[^>]*\son[a-z]+=/i, 'no on...= inside any tag'); assert.match(h, /&lt;img src=x onerror=1&gt;/, 'the hostile name stays text'); assert.doesNotMatch(h, /https?:\/\//);
  assert.doesNotMatch(G.CSS, /https?:|@import|url\(/);
});

test('its own CSS uses tokens and keeps text at 13 px or more (UI-T1, ART-T2)', () => {
  const sizes = [...G.CSS.matchAll(/(\d+)px var\(--te-font/g)].map(m => +m[1]).concat([...G.CSS.matchAll(/font-size:(\d+)px/g)].map(m => +m[1]));
  assert.ok(sizes.length && sizes.every(n => n >= 13), sizes.join(','));
  assert.doesNotMatch(G.CSS, /#[0-9a-f]{3,6}\b/i, 'no colour of its own: tokens only');
});
