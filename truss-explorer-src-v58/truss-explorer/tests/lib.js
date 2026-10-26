// Shared helpers for the Truss Explorer tests. Paths are relative to this file (TE-002).
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const C = require(path.join(SRC, 'core.js'));
const T3 = require(path.join(SRC, 'core3d.js'));

// App defaults (app.js DEFAULT, v58) for the inputs the solver reads.
const DEFAULT = {
  name: 'Design A', family: 'grid', height: 70, panels: 4, ratio: 1, sideAngle: 90, sideLean: 'in',
  overall: 300, bookLen: 242, loads: null, approachDiag: 'P', edgeVert: true, deskVert: true, deskMode: 'match', deskPanels: 1,
  bottom: 'flat', curve: -30, deskEnds: 'truss', supportMode: 'all', topShape: 'flat', topEnd: 0, botEnd: 0, edgeBear: false,
  bookContact: 'rigid', claw: 'off', brace: 'off', tableThick: 30, braceDepth: 20, fricK: 2, fricMu: 0.4, supportOffset: 0, overlap: 50, sticks: {},
  diagLeft: ['P', 'P'], diagMiddle: 'X', vertLeft: [true, true],
  mat: Object.assign({}, C.DEFAULT_MAT), load: { mBook1: 1.5, mBook2: 1.0, g: 9.81, nTruss: 2 }, opts: { deflLimit: 2, width: 60, crossTies: true, minOverlap: 20 },
};

// Same mapping as app.js design(): saved state -> solver input.
function design(S) {
  return { family: S.family, span: 200, overall: +S.overall, height: +S.height, panels: +S.panels, ratio: +S.ratio,
    diagLeft: S.diagLeft.slice(), diagMiddle: S.diagMiddle, vertLeft: S.vertLeft.slice(), approachDiag: S.approachDiag, edgeVert: S.edgeVert, deskVert: S.deskVert,
    deskMode: S.deskMode, deskPanels: +S.deskPanels, overlap: +S.overlap, bottom: S.bottom, curve: +S.curve, deskEnds: S.deskEnds, supportMode: S.supportMode,
    topShape: S.topShape, topEnd: +S.topEnd, botEnd: +S.botEnd, edgeBear: !!S.edgeBear, bookContact: S.bookContact, claw: S.claw === 'on', brace: S.brace === 'on',
    tableThick: +S.tableThick, braceDepth: +S.braceDepth, fricK: +S.fricK, fricMu: +S.fricMu, supportOffset: +S.supportOffset, sticks: S.sticks,
    sideAngle: +S.sideAngle, sideLean: S.sideLean, deck: 'top', bookLen: +S.bookLen, loads: S.loads ? S.loads.map(L => Object.assign({}, L)) : null };
}

// Bridge files used as test cases: the shared one in tests/, plus Brian's own in tests/private/
// (git-ignored, rule 8: his saved data stays out of the repo unless he picks a file).
function bridgeFiles() {
  const out = [];
  for (const dir of [__dirname, path.join(__dirname, 'private')]) if (fs.existsSync(dir))
    fs.readdirSync(dir).filter(f => f.endsWith('.bridge.json')).forEach(f => out.push(path.join(dir, f)));
  return out;
}
function fixtures() {
  return bridgeFiles().map(file => { const f = path.basename(file);
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { name: f.replace('.bridge.json', ''), state: Object.assign({}, DEFAULT, j.bridge), summary: j.summary };
  });
}

// A spread of 2D cases: the defaults across patterns, panel counts and chord shapes, plus the saved bridges.
function cases() {
  const out = [];
  const pats = { pratt: 'P', howe: 'H', x: 'X' };
  for (const [pn, code] of Object.entries(pats)) for (const N of [2, 3, 4, 5, 6]) for (const h of [30, 70]) {
    const half = Math.floor(N / 2);
    out.push({ name: `${pn}-N${N}-h${h}`, state: Object.assign({}, DEFAULT, { panels: N, height: h, diagLeft: Array(half).fill(code), vertLeft: Array(half).fill(true) }) });
  }
  out.push({ name: 'warren-N4', state: Object.assign({}, DEFAULT, { family: 'warren' }) });
  out.push({ name: 'parabola-bottom', state: Object.assign({}, DEFAULT, { bottom: 'parabola', curve: -30 }) });
  out.push({ name: 'arc-top', state: Object.assign({}, DEFAULT, { topShape: 'arc', topEnd: 20 }) });
  out.push({ name: 'one-support', state: Object.assign({}, DEFAULT, { supportMode: 'one' }) });
  out.push({ name: 'feet', state: Object.assign({}, DEFAULT, { deskEnds: 'feet' }) });
  fixtures().forEach(f => out.push({ name: 'saved:' + f.name, state: f.state, summary: f.summary }));
  return out;
}

function solve2D(state) {
  const tr = C.buildTruss(design(state));
  const res = C.analyze(tr, state.mat, state.load, state.opts);
  return { tr, res };
}

module.exports = { ROOT, SRC, bridgeFiles, C, T3, DEFAULT, design, fixtures, cases, solve2D };
