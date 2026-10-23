const test = require('node:test');
const assert = require('node:assert/strict');
const maintenance = require('../services/maintenanceTasks');

test('statistics requests share a scan, return cached results, and invalidate after cleanup', async () => {
  const original = maintenance.runController;
  const modulePath = require.resolve('./settingController');
  let finish, calls = 0;
  maintenance.runController = () => {
    calls++;
    return new Promise(resolve => { finish = resolve; });
  };
  delete require.cache[modulePath];
  try {
    const controller = require('./settingController');
    const request = () => {
      const response = { code: 200, set() { return this; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      controller.getSystemStats({}, response);
      return response;
    };
    assert.equal(request().code, 202);
    assert.equal(request().code, 202);
    assert.equal(calls, 1);
    finish({ uploadsStats: { totalFileCount: 10 } });
    await new Promise(resolve => setImmediate(resolve));
    const cached = request();
    assert.equal(cached.code, 200);
    assert.equal(cached.body.uploadsStats.totalFileCount, 10);
    assert.equal(calls, 1);
    controller.invalidateStats();
    assert.equal(request().body.cache.refreshing, true);
    assert.equal(calls, 2);
    finish({ uploadsStats: { totalFileCount: 0 } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(request().body.uploadsStats.totalFileCount, 0);
  } finally {
    maintenance.runController = original;
    delete require.cache[modulePath];
  }
});
