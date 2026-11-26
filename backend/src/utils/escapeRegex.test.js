const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeRegex } = require('./escapeRegex');

test('搜索词按普通文字匹配，特殊字符不再生效', () => {
  assert.equal(new RegExp(escapeRegex('a.b'), 'i').test('axb'), false);
  assert.equal(new RegExp(escapeRegex('a.b'), 'i').test('A.B'), true);
  assert.equal(new RegExp(escapeRegex('C++ (入门)'), 'i').test('学习 c++ (入门) 课程'), true);
  assert.equal(escapeRegex(['x', 'y']), 'x,y');
  assert.equal(escapeRegex(undefined), '');
});

test('恶意正则被转义后不会长时间运行', () => {
  const evil = '(a+)+$';
  const start = Date.now();
  new RegExp(escapeRegex(evil)).test('a'.repeat(30) + '!');
  assert.ok(Date.now() - start < 50);
});
