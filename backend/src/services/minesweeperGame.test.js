const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { GAMES_ROOT } = require('./gameAccess');
const { summarize } = require('./gameProgress');

// 取出扫雷页面中的规则脚本单独运行
const html = fs.readFileSync(path.join(GAMES_ROOT, 'minesweeper', 'index.html'), 'utf8');
const logic = /<script id="ms-logic">([\s\S]*?)<\/script>/.exec(html)[1];
const ctx = {};
vm.runInNewContext(logic, ctx);
const { MineBoard } = ctx;

/** 按给定雷位置造一个已开局的棋盘（行优先下标） */
function boardWith(rows, cols, mines) {
  const b = new MineBoard(rows, cols, mines.length);
  mines.forEach(i => { b.cells[i].mine = true; });
  b.cells.forEach((c, i) => { c.n = b.neighbors(i).filter(j => b.cells[j].mine).length; });
  b.state = 'playing';
  return b;
}

test('第一下及其周围 8 格不会有雷，且翻开一片', () => {
  for (let k = 0; k < 200; k++) {
    const b = new MineBoard(9, 9, 10);
    const first = Math.floor(Math.random() * 81);
    b.reveal(first);
    assert.equal(b.state, 'playing');
    for (const j of [first, ...b.neighbors(first)]) assert.equal(b.cells[j].mine, false);
    assert.equal(b.cells[first].n, 0);
    assert.ok(b.opened > 1);
    assert.equal(b.cells.filter(c => c.mine).length, 10);
  }
});

test('高级难度布满 99 颗雷', () => {
  const b = new MineBoard(16, 30, 99);
  b.reveal(0);
  assert.equal(b.cells.filter(c => c.mine).length, 99);
});

test('快速翻开：旗数等于数字时翻开周围其余格子', () => {
  // 3x3，雷在左上角(0)，点中间(4)的数字为 1
  const b = boardWith(3, 3, [0]);
  b.reveal(4);
  assert.equal(b.cells[4].n, 1);
  b.toggleFlag(0);
  const r = b.chord(4);
  assert.equal(r.result, 'opened');
  assert.equal(b.state, 'won');
  assert.equal(b.flags, 1);
});

test('快速翻开：旗数不对时什么都不翻开，返回要提示的格子', () => {
  const b = boardWith(3, 3, [0]);
  b.reveal(4);
  const r = b.chord(4);
  assert.equal(r.result, 'mismatch');
  assert.equal(r.cells.length, 8);
  assert.equal(b.opened, 1);
  assert.equal(b.state, 'playing');
});

test('快速翻开：旗插错了会踩雷，并记录踩中的雷', () => {
  const b = boardWith(3, 3, [0]);
  b.reveal(4);
  b.toggleFlag(8);
  const r = b.chord(4);
  assert.equal(r.result, 'lost');
  assert.equal(b.state, 'lost');
  assert.deepEqual([...b.boom], [0]);
});

test('未翻开的格子、0 和游戏结束后不触发快速翻开', () => {
  const b = boardWith(1, 5, [3]);
  assert.equal(b.chord(0).result, 'none');
  b.reveal(0); // 0 周围无雷，展开到 2 为止，4 仍未翻开
  assert.equal(b.opened, 3);
  assert.equal(b.chord(0).result, 'none');
  b.reveal(3);
  assert.equal(b.state, 'lost');
  b.toggleFlag(3);
  assert.equal(b.chord(2).result, 'none');
});

test('空白区域展开不会翻开插了旗的格子；旗数可以超过雷数', () => {
  const b = boardWith(1, 5, [4]);
  b.toggleFlag(1);
  b.toggleFlag(2);
  b.reveal(0);
  assert.equal(b.cells[1].open, false);
  assert.equal(b.flags, 2);
  assert.equal(b.total - b.flags, -1);
});

test('插错的旗必须拔掉才能过关', () => {
  const b = boardWith(1, 3, [2]);
  b.toggleFlag(0);
  b.reveal(1);
  assert.equal(b.state, 'playing');
  b.toggleFlag(0);
  b.reveal(0);
  assert.equal(b.state, 'won');
});

test('游戏中心进度显示扫雷最快纪录', () => {
  assert.equal(summarize('minesweeper', { ls: {} }), null);
  assert.deepEqual(
    summarize('minesweeper', { ls: { minesweeper_best_easy: '12.3', minesweeper_best_hard: '201' } }),
    { text: '最快 初级 12.3 秒，高级 201 秒', percent: null }
  );
});
