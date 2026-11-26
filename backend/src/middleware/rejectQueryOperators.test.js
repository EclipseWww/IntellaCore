const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const reject = require('./rejectQueryOperators');

test('query strings with Mongo operators are rejected, normal ones pass', async () => {
  const app = express(); app.use(reject); app.get('/x', (req, res) => res.json(req.query));
  const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}/x`;
  try {
    for (const q of ['?username[$ne]=a', '?a[b][$gt]=1', '?%24where=1', '?filters[$regex]=.*'])
      assert.equal((await fetch(base + q)).status, 400, q);
    for (const q of ['', '?page=1&pageSize=10', '?tags=a&tags=b', '?tags[]=a', '?search=%24100', '?startDate=2026-01-01'])
      assert.equal((await fetch(base + q)).status, 200, q);
  } finally { server.close(); }
});

test('JSON 请求体中的 Mongo 操作符被拒绝，正常数据与游戏存档不受影响', async () => {
  const app = express(); app.use(express.json()); app.use(reject);
  app.all('*', (req, res) => res.json({ ok: true }));
  const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}`;
  const send = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    for (const body of [{ studentId: { $ne: null }, username: 'a' }, { filters: { status: { $ne: 'x' } } }, { $where: '1' }, { list: [{ $gt: 1 }] }])
      assert.equal((await send('/api/login-requests/request', body)).status, 400, JSON.stringify(body));
    for (const body of [{ username: 'stu1', note: '$100 元' }, { price: '$5' }, { a: { b: { c: { $deep: 1 } } } },
      { spreadsheetData: [{ name: 'Sheet1', celldata: [{ r: 0, c: 0, v: { v: '=SUM($A$1:$A$3)' } }] }] }])
      assert.equal((await send('/api/x', body)).status, 200, JSON.stringify(body));
    assert.equal((await fetch(base + '/api/games/play/_save', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { $engineKey: 1 } }) })).status, 200);
  } finally { server.close(); }
});
