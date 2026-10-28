// Build documents print completely (#153) and every page carries its number (#157), on the bridges with the most parts.
import { browser, checker } from './harness.mjs';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
const require = createRequire(import.meta.url);
const { C, T3, DEFAULT, design } = require('../lib.js');
const BD = require('../../src/builddoc.js');

const b = await browser();
const check = checker();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'te-docs-'));
const half = n => Math.floor(n / 2);
const many = (n, top) => Object.assign({}, DEFAULT, { panels: n, diagLeft: Array(half(n)).fill('P'), vertLeft: Array(half(n)).fill(true) }, top ? { topShape: top, topEnd: 20 } : {});
// [name, bridge, 3D options or null]
const D3 = (o) => Object.assign({ width: 60, tilt: 0, bottomTies: true, topPat: ['S'], botPat: ['S'], framePat: ['D', 'N'] }, o || {});
const CASES = [
  ['default 2D', DEFAULT, null],
  ['default 3D', DEFAULT, D3()],
  ['3D width 120', DEFAULT, D3({ width: 120 })],
  ['3D 12 panels flat', many(12), D3()],
  ['3D arc 4 panels', Object.assign({}, DEFAULT, { topShape: 'arc', topEnd: 20 }), D3()],
  ['3D 12-panel catenary', many(12, 'catenary'), D3()],
  ['3D 12-panel arc, tilt 25, width 120, X everywhere', many(12, 'arc'), D3({ tilt: 25, width: 120, topPat: ['X'], botPat: ['X'], framePat: ['X'] })],
  ['2D edge bear, s 10', Object.assign({}, DEFAULT, { edgeBear: true, supportOffset: 10 }), null],
  // #298: an arch through the flat bottom chord (the BDT-004 style): the bottom chord is cut at the crossings
  ['3D arch through the bottom chord', Object.assign({}, DEFAULT, { height: 30, panels: 4, deskMode: 'length', overlap: 48.4, deskEnds: 'feet', topShape: 'catenary', topEnd: -27, pattern: 'pratt', diagLeft: ['P', 'P'], vertLeft: [true, true] }), D3({ framePat: ['D'] })],
  // #282: the curved top chord as one stick bent to the curve (a bending form page, the checks sheet, a day-before step)
  ['2D bent top chord, 6-panel parabola h 90', Object.assign({}, DEFAULT, { height: 90, topShape: 'parabola', topEnd: 50, panels: 6, diagLeft: ['X', 'X', 'X'], vertLeft: [true, true, true] }), null, { bentTop: true }],
  ['3D bent top chord, 12-panel arc', many(12, 'arc'), D3(), { bentTop: true }],
];
try {
  for (const [name, st, o, cfg] of CASES) {
    const tr = C.buildTruss(design(st)), res = C.analyze(tr, st.mat, st.load, st.opts);
    const plan = BD.cutPlan(tr, 3.18, Object.assign({ stock: 240, force: k => res.members[k].F }, cfg || {}));
    let d3 = null; if (o) { const m3 = T3.build3D(tr, o), r3 = T3.analyze3D(m3, Object.assign({}, C.DEFAULT_MAT), st.load); if (r3.stable) d3 = { m3, r3, tieJoint: 'ontop' }; }
    if (o && !d3) { check(`${name}: 3D model is stable`, false); continue; }
    const html = BD.documentHTML(tr, res, { name, b: 3.18, h: 3.18, nTruss: 2, stock: 240, kerf: 1, massNote: 'm', capNote: 'c', d3, ties: { count: tr.deckNodes.length, len: 60 } }, plan, { steps: true, templates: true, colour: true });
    const f = path.join(tmp, name.replace(/\W+/g, '_') + '.html'); fs.writeFileSync(f, html);
    const p = await b.newPage({ viewport: { width: 1200, height: 900 } }); await p.goto('file://' + f);
    const r = await p.evaluate(() => {
      const sheets = [...document.querySelectorAll('section.sheet')], cut = [];
      sheets.forEach((s, i) => { const c = s.querySelector('.content'); if (c && (c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1)) cut.push(`page ${i + 1} (${(s.querySelector('.title td:nth-child(2)') || {}).textContent || 'template'}) +${c.scrollHeight - c.clientHeight}px`);
        if (!c) { const sr = s.getBoundingClientRect(); [...s.children].forEach(ch => { const r = ch.getBoundingClientRect(); if (r.bottom > sr.bottom + 1 || r.right > sr.right + 1) cut.push(`template page ${i + 1}`); }); } });
      const said = (document.body.textContent.match(/(\d+) sticks? of 240 mm/) || [])[1];
      const nums = [...document.querySelectorAll('.title tr:first-child td:last-child')].map(td => td.textContent.trim());
      const pg = [...document.querySelectorAll('.pgno')].map(e => e.textContent);
      return { pages: sheets.length, cut, said: +said, drawn: document.querySelectorAll('.bar').length, nums, pg };
    });
    check(`${name}: nothing is cut off (${r.pages} pages)`, r.cut.length === 0, r.cut.slice(0, 4).join('; '));
    check(`${name}: every stick of the cutting plan is drawn`, r.said === r.drawn, `${r.drawn} drawn of ${r.said}`);
    const items = plan.items.length + (d3 ? BD.crossPlan(d3.m3, d3.r3, 3.18, {}).items.length : 0) + (st.edgeBear ? 1 : 0);
    const listed = await p.evaluate(() => [...document.querySelectorAll('table.grid')].filter(t => /Long pt/.test(t.textContent)).reduce((s, t) => s + t.querySelectorAll('tr').length - 1, 0));
    check(`${name}: every item is in the cut list`, listed === items, `${listed} of ${items}`);
    // #300: the 3D plan lists its ties as parts, so the 2D cross-tie 'T' pieces are added only without 3D (edge stops or not)
    const tCuts = await p.evaluate(() => [...document.querySelectorAll('.bar text')].filter(e => e.textContent === 'T').length);
    check(`${name}: cross-ties counted once in the cutting plan (${d3 ? 'none as T in 3D' : tr.deckNodes.length + ' T in 2D'})`, tCuts === (d3 ? 0 : tr.deckNodes.length), `${tCuts} T pieces`);
    const N = r.pages, okNums = r.nums.every((s, i) => s === `SHEET ${i + 1} OF ${N}`) && r.pg.every((s, i) => s.includes(`page ${r.nums.length + i + 1} of ${N}`));
    check(`${name}: page numbers match the ${N} printed pages`, okNums, r.nums.slice(-1)[0] + ' / ' + (r.pg.slice(-1)[0] || ''));
    // #302: the steps start with printing the templates and cutting the parts, name their templates, and splint what's marked;
    // #299: the platform check comes first only when a chord end sits below the deck
    const st2 = await p.evaluate(() => { const s = [...document.querySelectorAll('.step')].map(e => e.textContent); return { first: s.slice(0, 4).join(' | '), all: s.join(' | '), n: s.length }; });
    const low = Math.min(...tr.nodes.map(q => q[1])) < -0.5;
    check(`${name}: steps start with ${low ? 'the platform check, then ' : ''}printing the templates and cutting the parts`, (!low || /measure the real test platforms/.test(st2.first)) && /Print and check the templates/.test(st2.first) && /Cut and label every part/.test(st2.first) && /template T1/.test(st2.all) && (low || !/measure the real test platforms/.test(st2.all)), st2.first.slice(0, 300));
    const marked = /splint/.test(await p.evaluate(() => [...document.querySelectorAll('table.grid, .note')].map(e => e.textContent).join(' ')));
    check(`${name}: every splint the documents mark has a step`, !marked || /Splint/.test(st2.all), '');
    if (cfg && cfg.bentTop) {
      const bt = await p.evaluate(() => ({ sheet: [...document.querySelectorAll('.title td')].some(td => td.textContent === 'Bent top chord'), form: [...document.querySelectorAll('.tpl .note')].filter(n => /Bending form/.test(n.textContent)).length, day: [...document.querySelectorAll('.step p')].some(e => /The day before/.test(e.textContent)), bar: [...document.querySelectorAll('.tpl')].filter(s => /Bending form/.test(s.textContent)).every(s => s.querySelector('svg').getAttribute('width') === '240mm'), splices: (document.body.textContent.match(/Splices/g) || []).length }));
      check(`${name}: the bent top chord gets its checks sheet, a full-size bending form (240 mm wide, 1:1) and a day-before step`, bt.sheet && bt.form > 0 && bt.day && bt.bar, JSON.stringify(bt));
    }
    await p.close();
  }
} finally { await b.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
const fails = check.results.filter(r => !r.ok);
console.log(`\n${check.results.length - fails.length}/${check.results.length} document checks passed`);
process.exit(fails.length ? 1 : 0);
