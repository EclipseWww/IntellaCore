const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { detectGameCopy, getFingerprints } = require('./gameCopyGuard');
const { GAMES_ROOT, listGameIds } = require('./gameAccess');

const read = (...p) => fs.readFileSync(path.join(GAMES_ROOT, ...p), 'utf8');

test('每个游戏都有指纹', () => {
  const fp = getFingerprints();
  for (const id of listGameIds()) assert.ok(fp.has(id), `${id} 没有指纹`);
});

test('原样复制游戏页面 -> 判为复制', () => {
  for (const id of listGameIds()) {
    const html = read(id, 'index.html');
    // 外部脚本较多的游戏（如 dino）把它的主脚本内联进来，模拟学生把源码拼成单个网页
    const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1])
      .filter(src => !/^https?:/.test(src))
      .map(src => { try { return read(id, src); } catch { return ''; } });
    const page = html + '<script>' + scripts.join('\n') + '</script>';
    const r = detectGameCopy(page);
    assert.ok(r && r.gameId === id, `${id} 未被识别：${JSON.stringify(r)}`);
  }
});

test('改了缩进、注释、部分变量名后复制 -> 仍判为复制', () => {
  const html = read('klotski', 'index.html')
    .replace(/\n\s+/g, '\n')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\bpieces\b/g, 'blocks')
    .replace(/\bselected\b/g, 'chosen');
  const r = detectGameCopy(html);
  assert.equal(r && r.gameId, 'klotski');
});

test('只复制 JS 部分 -> 判为复制', () => {
  const html = read('linkup', 'index.html');
  const js = html.slice(html.indexOf('<script>'));
  const r = detectGameCopy(`<html><body><h1>我的游戏</h1>${js}</body></html>`);
  assert.equal(r && r.gameId, 'linkup');
});

test('直接引用游戏地址 -> 判为复制', () => {
  assert.equal(detectGameCopy('<iframe src="/api/games/play/snake/index.html"></iframe>').reason, 'reference');
  assert.equal(detectGameCopy('<script src="/games/dino/index.js"></script>').gameId, 'dino');
  assert.equal(detectGameCopy('<p>我喜欢玩 games/snake 这个游戏</p>'), null);
});

test('HTML 编辑器教程示例与普通网页 -> 不误判', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../../frontend/src/components/HtmlEditor/HtmlTutorials.js'), 'utf8');
  const codes = [...src.matchAll(/code:\s*`([\s\S]*?)`\s*\n\s*}/g)].map(m => m[1]);
  assert.ok(codes.length >= 20, '教程示例数量异常');
  for (const c of codes) assert.equal(detectGameCopy(c), null, c.slice(0, 80));
  // 全部教程拼成一个大网页也不应误判
  assert.equal(detectGameCopy(codes.join('\n')), null);
  const ownGame = `<!DOCTYPE html><html><body><canvas id="c" width="400" height="400"></canvas><script>
    const c = document.getElementById('c'); const ctx = c.getContext('2d');
    let snake = [{x: 10, y: 10}], dir = {x: 1, y: 0}, food = {x: 5, y: 5};
    document.addEventListener('keydown', e => { if (e.key === 'ArrowUp') dir = {x: 0, y: -1}; if (e.key === 'ArrowDown') dir = {x: 0, y: 1};
      if (e.key === 'ArrowLeft') dir = {x: -1, y: 0}; if (e.key === 'ArrowRight') dir = {x: 1, y: 0}; });
    setInterval(() => { const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y}; snake.unshift(head);
      if (head.x === food.x && head.y === food.y) food = {x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20)}; else snake.pop();
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 400, 400); ctx.fillStyle = 'green'; snake.forEach(p => ctx.fillRect(p.x * 20, p.y * 20, 18, 18));
      ctx.fillStyle = 'red'; ctx.fillRect(food.x * 20, food.y * 20, 18, 18); }, 150);
  </script></body></html>`;
  assert.equal(detectGameCopy(ownGame), null, '学生自己写的贪吃蛇被误判');
});
