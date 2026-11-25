const test = require('node:test');
const assert = require('node:assert/strict');
const hide = require('./hideServerErrorDetails');

function run(status, body, env = {}) {
  const saved = { NODE_ENV: process.env.NODE_ENV, EXPOSE_ERROR_DETAILS: process.env.EXPOSE_ERROR_DETAILS };
  Object.assign(process.env, { NODE_ENV: '', EXPOSE_ERROR_DETAILS: '' }, env);
  let sent;
  const res = { statusCode: status, json(b) { sent = b; return this; } };
  hide({}, res, () => {});
  res.json(body);
  Object.assign(process.env, saved);
  return sent;
}

test('5xx responses drop error/stack but keep message and other fields', () => {
  assert.deepEqual(run(500, { success: false, message: '获取失败', error: 'Cast to ObjectId failed at /srv/app', stack: 'x' }), { success: false, message: '获取失败' });
});

test('4xx and success responses are untouched', () => {
  const body = { success: false, message: '复制游戏', code: 'GAME_COPY', error: 'detail' };
  assert.deepEqual(run(400, body), body);
  assert.deepEqual(run(200, { data: [1], error: null }), { data: [1], error: null });
  assert.deepEqual(run(500, [1, 2]), [1, 2]);
});

test('details are kept when explicitly enabled for debugging', () => {
  assert.equal(run(500, { message: 'm', error: 'e' }, { NODE_ENV: 'development' }).error, 'e');
  assert.equal(run(500, { message: 'm', error: 'e' }, { EXPOSE_ERROR_DETAILS: 'true' }).error, 'e');
});
