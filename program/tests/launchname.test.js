// TE-B-246 / TE-B-280 (Brian 54c): the launch name 'balsaPixel: Truss Explorer' is SHOWN words only, held in one string
// (BuildDoc.PRODUCT_NAME). The tab title, the classic header and the build-document line show it; saved files don't change.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { C, design, DEFAULT } = require('./lib.js');
const BD = require('../src/builddoc.js');
const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');

test('the name is one string, spelled as decided', () => {
  assert.equal(BD.PRODUCT_NAME, 'balsaPixel: Truss Explorer');
  assert.equal(BD.DOC_LINE, 'balsaPixel: Truss Explorer · briangwalker.com');
});

test('the tab title and the classic header start as the name, and the app sets them from PRODUCT_NAME', () => {
  const ui = src('ui.html');
  assert.match(ui, /<title>balsaPixel: Truss Explorer<\/title>/);
  assert.match(ui, /<h1 id="appName">balsaPixel: Truss Explorer<\/h1>/);
  assert.match(src('app/10-state.js'), /document\.title = BuildDoc\.PRODUCT_NAME/);
});

test('the black-and-white set and the bending sheet carry the line, in its own case, and not the old line', () => {
  const st = Object.assign({}, DEFAULT, { height: 90, topShape: 'parabola', topEnd: 50, panels: 6, diagLeft: ['X', 'X', 'X'], vertLeft: [true, true, true] });
  const tr = C.buildTruss(design(st)), res = C.analyze(tr, st.mat, st.load, st.opts), plan = BD.cutPlan(tr, 3.18, { stock: 240, force: k => res.members[k].F, bentTop: true });
  const meta = { name: 't', b: 3.18, h: 3.18, nTruss: 2, stock: 240, kerf: 1, massNote: '', capNote: '', mat: C.DEFAULT_MAT };
  const bw = BD.documentHTML(tr, res, meta, plan, { minimal: true });
  assert.ok(bw.includes('<div class="ft">balsaPixel: Truss Explorer · briangwalker.com</div>'));
  assert.match(bw, /\.ft\{[^}]*text-transform:none/, 'the page is ALL CAPS, the name keeps its case');
  assert.doesNotMatch(bw, /CORPORATE AI AGENT TEAM/);
  const bend = BD.bendingSheetHTML(tr, plan, res, meta, { copies: 1 });
  if (bend) { assert.ok(bend.includes('balsaPixel: Truss Explorer · briangwalker.com')); assert.doesNotMatch(bend, /CORPORATE AI AGENT TEAM/); }
});

test('saved files keep app: SE 310 Truss Explorer (shown words only, no saved-file change)', () => {
  assert.match(src('app/50-files.js'), /app: 'SE 310 Truss Explorer'/);
});
