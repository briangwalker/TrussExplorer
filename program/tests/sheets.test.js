// Sheets, dialogs and toasts (TrussSheets; UI-W13, UI-W22, UI-W23, UI-W10): the markup, without a browser.
//   node --test tests/sheets.test.js   (behaviour on the real page: tests/ui/sheets.mjs)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const P = require(path.join(__dirname, '..', 'src', 'pieces.js'));
const S = require(path.join(__dirname, '..', 'src', 'sheets.js'));

const dlg = (o = {}) => S.sheetHTML(P, Object.assign({ id: 'bd', kind: 'dialog', title: 'Build documents', body: '<p>x</p>',
  buttons: [{ label: 'Cancel', cancel: true }, { label: 'Make the build documents', act: 'bd-make', main: true }] }, o));

test('three parts: a fixed header (title and ✕), a middle that scrolls, a fixed button row (UI-W23)', () => {
  const h = dlg();
  assert.match(h, /^<dialog class="te-sheet" id="bd" data-kind="dialog" data-part="sheet" data-slot="bg" data-pc aria-labelledby="bd-t">/);
  assert.match(h, /<div class="te-sh-h" data-part="sheet-header"><h2 class="te-sh-t" id="bd-t">Build documents<\/h2><button type="button" class="te-sh-x" data-close aria-label="Close"/);
  assert.match(h, /<div class="te-sh-m" data-part="sheet-middle" tabindex="-1"><p>x<\/p><\/div>/);
  assert.match(h, /<div class="te-sh-b" data-part="sheet-buttons"><button data-cancel type="button"[^>]*>Cancel<\/button><button data-main type="button"[^>]*data-act="bd-make"[^>]*>Make the build documents<\/button><\/div><\/dialog>$/);
  const order = ['te-sh-h', 'te-sh-m', 'te-sh-b'].map(c => h.indexOf(c));
  assert.deepStrictEqual(order, [...order].sort((a, b) => a - b), 'header, middle, buttons in that order');
});

test('a sheet may have no buttons; a dialog needs a main button that names its action, never OK (UI-W13)', () => {
  assert.doesNotMatch(S.sheetHTML(P, { id: 'keys', title: 'Keys and help', body: '' }), /te-sh-b/);
  assert.match(S.sheetHTML(P, { id: 'keys', title: 'Keys' }), /data-kind="sheet"/);
  assert.throws(() => dlg({ buttons: [{ label: 'Cancel', cancel: true }] }), /main button/);
  for (const bad of ['OK', 'ok', ' Yes ', 'Submit', 'Go']) assert.throws(() => dlg({ buttons: [{ label: bad, main: true }] }), /never/, bad);
  assert.throws(() => S.sheetHTML(P, { id: 'x' }), /title/);
  assert.throws(() => S.sheetHTML(P, { id: 'x', title: 'X', kind: 'drawer' }), /sheet or dialog/);
  assert.throws(() => S.sheetHTML(null, { id: 'x', title: 'X' }), /TrussPieces/);
});

test('hostile text stays text; no script, no on...= (CODE-S1, CODE-S2)', () => {
  const h = dlg({ id: 'a"><script>', title: '<img src=x onerror=1>', buttons: [{ label: '<b>x</b>', main: true }] });
  assert.doesNotMatch(h, /<script|<img|<b>/i); assert.doesNotMatch(h, /<[^>]*\son[a-z]+=/i);
  assert.match(h, /&lt;img src=x onerror=1&gt;/);
});

test('CSS: tokens only, text 13 px or more, reduced motion respected, no outside URL', () => {
  assert.doesNotMatch(S.CSS, /#[0-9a-f]{3,6}\b/i, 'no colour of its own');
  assert.doesNotMatch(S.CSS, /https?:|@import|url\(/);
  const sizes = [...S.CSS.matchAll(/(\d+)px var\(--te-font/g)].map(m => +m[1]);
  assert.ok(sizes.length && sizes.every(n => n >= 13), sizes.join(','));
  assert.match(S.CSS, /prefers-reduced-motion: reduce/);
  assert.match(S.CSS, /\.te-sh-b\{position:sticky;bottom:0/, 'the button row pinned to the bottom edge');
  assert.match(S.CSS, /\.te-toast\{position:fixed;left:50%;bottom:/, 'toasts bottom centre (UI-W10)');
});

test('words come from TrussStrings: plain text, keys step.piece.name, an unknown key throws (TE-B-387)', () => {
  const T = require(path.join(__dirname, '..', 'src', 'strings.js'));
  assert.ok(Object.isFrozen(T.TEXT));
  for (const [k, v] of Object.entries(T.TEXT)) {
    assert.match(k, /^[a-z0-9]+(\.[a-zA-Z0-9]+){2}$/, k);
    assert.ok(typeof v === 'string' && v.trim() && !/[<>&]/.test(v), k + ' is plain text');
  }
  assert.throws(() => T.t('sheets.nope.x'), /no text for/);
  assert.match(dlg(), new RegExp(`aria-label="${T.t('sheets.close.label')}" title="${T.t('sheets.close.title').replace(/[()]/g, '\\$&')}"`));
});
