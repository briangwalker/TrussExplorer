// Writes one exported .py per test case plus the JS answers, for cmp.py.
'use strict';
const fs = require('fs'), path = require('path');
const { SRC, C, cases, solve2D, design } = require('./lib.js');
const X = require(path.join(SRC, 'export.js'));
const tpl = require(path.join(SRC, 'template.js'));
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const list = [];
cases().forEach(cs => {
  const { tr, res } = solve2D(cs.state);
  if (!res.stable) return;
  const py = X.exportPy(tpl, cs.name, design(cs.state), tr, res, Object.assign({}, C.DEFAULT_MAT, cs.state.mat), cs.state.load, cs.state.opts);
  const f = cs.name.replace(/[^A-Za-z0-9_-]/g, '_');
  fs.writeFileSync(path.join(out, f + '.py'), py);
  list.push({ file: f, name: cs.name, F: res.members.map(m => m.F), defl: res.midDefl, mass: res.massTruss, lifted: res.lifted.length, sliding: res.activeSupports.some(s => s.sliding) });
});
fs.writeFileSync(path.join(out, 'js.json'), JSON.stringify(list));
console.log('exported', list.length);
