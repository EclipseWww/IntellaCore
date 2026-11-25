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
