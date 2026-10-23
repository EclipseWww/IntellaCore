const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function load(file, mocks) {
  const context = { module: { exports: {} }, exports: {}, require: name => mocks[name] || {},
    process: { env: { JWT_SECRET: 'test-secret' } }, console, Date };
  vm.runInNewContext(fs.readFileSync(require.resolve(file), 'utf8'), context);
  return typeof context.module.exports === 'function' || Object.keys(context.module.exports).length ? context.module.exports : context.exports;
}
function response() { return { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } }; }
const logger = { info() {}, warn() {}, error() {} };

test('administrator login requires a database account and valid hashed password', async () => {
  const user = { _id: 'admin-id', username: 'admin', name: 'Admin', role: 'admin', isActive: true,
    password: await bcrypt.hash('a-strong-admin-password', 4), addLoginRecord: async () => {} };
  const controller = load('./authController', { '../models/User': { findOne: async () => user }, bcryptjs: bcrypt,
    jsonwebtoken: jwt, '../utils/logger': logger, '../utils/getClientIp': { getClientIp: () => '127.0.0.1' } });
  for (const password of ['admin123456', undefined]) {
    const res = response(); await controller.login({ body: { username: 'admin', password }, headers: {} }, res);
    assert.equal(res.statusCode, 401);
  }
  const res = response(); await controller.login({ body: { username: 'admin', password: 'a-strong-admin-password' }, headers: {} }, res);
  assert.equal(res.statusCode, 200); assert.equal(jwt.verify(res.body.token, 'test-secret').id, 'admin-id');
  user.isActive = false;
  const disabled = response(); await controller.login({ body: { username: 'admin', password: 'a-strong-admin-password' }, headers: {} }, disabled);
  assert.equal(disabled.statusCode, 401);
});

test('public registration is rejected without creating a user', () => {
  let handler;
  load('../routes/auth', { express: { Router: () => ({ post(route, ...callbacks) { if (route === '/register') handler = callbacks[0]; }, get() {} }) } });
  const res = response(); handler({ body: { username: 'attacker', role: 'admin' } }, res);
  assert.equal(res.statusCode, 403);
});

test('concurrent game activation and a retry after record failure deliver time only once', async () => {
  let remaining = 0, delivered = false, completed = false, failCompletion = true;
  const record = () => ({ _id: 'coupon', studentId: 'student', itemType: 'game', duration: 15, status: completed ? 'completed' : 'pending' });
  const controller = load('./pointShopController', {
    '../utils/logger': logger,
    '../models/PointShop': { RedemptionRecord: {
      findById: async () => record(),
      findOneAndUpdate: async () => {
        if (failCompletion) { failCompletion = false; throw new Error('lost database connection'); }
        if (completed) return null;
        completed = true; return { useTime: new Date() };
      }
    } },
    '../models/User': {
      findOneAndUpdate: async (filter, update) => {
        assert.equal(filter.usedGameRedemptions.$ne, 'coupon');
        if (delivered) return null;
        delivered = true; remaining += update.$inc.gameTimeRemainingSeconds;
        return { gameTimeRemainingSeconds: remaining };
      },
      findById: () => ({ select: async () => ({ gameTimeRemainingSeconds: remaining }) })
    }
  });
  const request = { params: { recordId: 'coupon' }, user: { _id: 'student' } };
  const first = response(); await controller.useGame(request, first);
  assert.equal(first.statusCode, 500); assert.equal(remaining, 900); assert.equal(completed, false);
  await Promise.all([controller.useGame(request, response()), controller.useGame(request, response())]);
  assert.equal(remaining, 900); assert.equal(completed, true);
  const reused = response(); await controller.useGame(request, reused); assert.equal(reused.statusCode, 400);
});

test('student tokens without a live database session and old synthetic admin tokens are rejected', async () => {
  const auth = load('../middleware/auth', { jsonwebtoken: jwt, '../models/User': { findById: () => ({ select: async () => null }) } });
  for (const payload of [{ role: 'student', id: 'student' }, { role: 'admin', isAdmin: true }]) {
    const token = jwt.sign(payload, 'test-secret'); const res = response(); let passed = false;
    await auth({ header: () => `Bearer ${token}`, headers: {}, query: {} }, res, () => { passed = true; });
    assert.equal(res.statusCode, 401); assert.equal(passed, false);
  }
});
