// TrussPile (src/pile.js; RMA-11, board TE-B-498b): the wood pile's end-on bundle, pure. Spec: UI-D3, UI-T4, CODE-F1, CODE-F5, CODE-N2.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const P = require(path.join(SRC, 'pile.js'));
const STICK = { b: 3.18, h: 3.18, stock: 240 };
const EMPTY = { sticks: 0, rows: 0, cols: 0, w: 0, h: 0, leftover: 0 };

test('no wood gives the empty pile; one stick; a part stick still counts as one', () => {
  assert.deepStrictEqual(P.pile(0, STICK), EMPTY);
  assert.deepStrictEqual(P.pile(240, STICK), { sticks: 1, rows: 1, cols: 1, w: 3.18, h: 3.18, leftover: 0 });
  const part = P.pile(100, STICK); assert.strictEqual(part.sticks, 1); assert.strictEqual(part.leftover, 140);
  assert.strictEqual(P.pile(0.001, STICK).sticks, 1);
});

test('exactly n stocks is n sticks; n stocks and 1 mm is n + 1', () => {
  for (const n of [1, 2, 3, 4, 5, 9, 10, 17, 100]) {
    assert.strictEqual(P.pile(n * 240, STICK).sticks, n, 'n = ' + n); assert.strictEqual(P.pile(n * 240, STICK).leftover, 0);
    const more = P.pile(n * 240 + 1, STICK); assert.strictEqual(more.sticks, n + 1); assert.strictEqual(more.leftover, 239);
  }
  assert.strictEqual(P.pile(0.3 * 3, { b: 1, h: 1, stock: 0.1 }).sticks, 9, 'float rounding does not add a stick (0.3 * 3 / 0.1)');
});

test('the bundle is near-square: never taller than wide, and never more than one row short of square', () => {
  for (let n = 1; n <= 400; n++) {
    const p = P.pile(n * 240, STICK);
    assert.ok(p.cols * p.rows >= n && p.cols * p.rows - n < p.cols, 'n = ' + n + ' holds the sticks with no empty row');
    assert.ok(p.rows <= p.cols, 'n = ' + n + ' wider than tall'); assert.ok(p.cols - p.rows <= 1 || p.rows * p.cols - n >= 0, 'n = ' + n);
    assert.ok(p.cols - p.rows <= 1, 'n = ' + n + ': ' + p.cols + ' x ' + p.rows);
    assert.ok(Math.abs(p.w - p.cols * 3.18) < 1e-9 && Math.abs(p.h - p.rows * 3.18) < 1e-9);
  }
  assert.deepStrictEqual([P.pile(5 * 240, STICK).cols, P.pile(5 * 240, STICK).rows], [3, 2]);
  assert.deepStrictEqual([P.pile(9 * 240, STICK).cols, P.pile(9 * 240, STICK).rows], [3, 3]);
});

test('the box uses the stick width and depth separately', () => {
  const p = P.pile(6 * 100, { b: 2, h: 5, stock: 100 }); assert.deepStrictEqual([p.sticks, p.cols, p.rows, p.w, p.h], [6, 3, 2, 6, 10]);
});

test('bundleRects: one rect per stick, bottom row first left to right, none overlap, all inside the box', () => {
  for (const n of [1, 2, 3, 5, 8, 9, 10, 23]) {
    const p = P.pile(n * 240, STICK), r = P.bundleRects(p, STICK);
    assert.strictEqual(r.length, p.sticks);
    assert.deepStrictEqual([r[0].x, r[0].y], [0, 0]); if (n > 1) assert.ok(r[1].x > r[0].x && r[1].y === r[0].y || p.cols === 1);
    r.forEach(a => { assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= p.w + 1e-9 && a.y + a.h <= p.h + 1e-9); assert.deepStrictEqual([a.w, a.h], [3.18, 3.18]); });
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      const a = r[i], b = r[j], ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      assert.ok(!(ox > 1e-9 && oy > 1e-9), 'rects ' + i + ' and ' + j + ' overlap (n = ' + n + ')');
    }
  }
  const p = P.pile(5 * 240, STICK), r = P.bundleRects(p, STICK);
  assert.deepStrictEqual(r.map(a => a.y).filter((y, i, A) => A.indexOf(y) === i), [0, 3.18], 'two rows, the full one at the bottom');
  assert.strictEqual(r.filter(a => a.y === 0).length, 3);
});

test('a gap spreads the sticks and the box; a bad gap is 0', () => {
  const p = P.pile(4 * 240, STICK), r = P.bundleRects(p, STICK, 1);
  assert.deepStrictEqual(r.map(a => [a.x, a.y]), [[0, 0], [4.18, 0], [0, 4.18], [4.18, 4.18]]);
  for (const g of [undefined, null, -1, NaN, 'x', 0]) assert.deepStrictEqual(P.bundleRects(p, STICK, g), P.bundleRects(p, STICK, 0));
});

test('bad inputs give the empty pile and no rects, never NaN, never a throw (CODE-N2)', () => {
  for (const w of [NaN, -5, Infinity, 'abc', null, undefined, {}, [], 0]) assert.deepStrictEqual(P.pile(w, STICK), EMPTY, String(w));
  for (const s of [null, undefined, {}, 'x', [], { b: 3, h: 3 }, { b: 0, h: 3, stock: 240 }, { b: 3, h: NaN, stock: 240 }, { b: 3, h: 3, stock: -1 }, { b: '3', h: 3, stock: 240 }])
    assert.deepStrictEqual(P.pile(480, s), EMPTY, JSON.stringify(s));
  for (const p of [null, undefined, {}, EMPTY, { sticks: 2.5, cols: 2 }, { sticks: 3, cols: 0 }, 'x']) assert.deepStrictEqual(P.bundleRects(p, STICK), [], JSON.stringify(p));
  assert.deepStrictEqual(P.bundleRects(P.pile(480, STICK), null), []);
  assert.ok(!/NaN/.test(JSON.stringify(P.pile(NaN, null))));
});

test('pure and standalone: no DOM or timers (CODE-F5), a frozen global (CODE-F1)', () => {
  const src = fs.readFileSync(path.join(SRC, 'pile.js'), 'utf8'), code = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  for (const w of ['document', 'innerHTML', 'querySelector', 'localStorage', 'setTimeout', 'performance', 'Math.random']) assert.ok(!code.includes(w), w);
  assert.ok(Object.isFrozen(P));
  const vm = require('vm'), ctx = vm.createContext({}); vm.runInContext(src, ctx); assert.ok(ctx.TrussPile && typeof ctx.TrussPile.pile === 'function' && typeof ctx.TrussPile.bundleRects === 'function');
});
