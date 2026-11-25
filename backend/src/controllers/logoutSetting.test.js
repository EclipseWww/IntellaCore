const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

test('only administrator can save empty or short logout passwords; responses hide hashes', async () => {
  let stored;
  const mocks = {
    '../models/Setting': { findOneAndUpdate: async (query, update) => (stored = { ...query, ...update }) },
    '../utils/logger': { info() {}, error() {} },
    '../services/maintenanceTasks': {}
  };
  const context = { module: { exports: {} }, require: name => {
    if (mocks[name]) return mocks[name];
    if (name.startsWith('../')) return {};
    return require(name);
  }, __dirname, Date, console };
  vm.runInNewContext(fs.readFileSync(require.resolve('./settingController'), 'utf8'), context);
  async function save(value, role = 'admin') {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await context.module.exports.updateSetting({ params: { key: 'studentLogoutPassword' }, body: { value }, user: { role } }, res);
    return res;
  }
  for (const password of ['', 'a', 'short']) {
    const res = await save(password);
    assert.equal(res.code, 200);
    assert.equal(await bcrypt.compare(password, stored.value), true);
    assert.equal(res.body.value, undefined);
    assert.equal(res.body.configured, true);
  }
  assert.equal((await save('', 'teacher')).code, 403);
  assert.equal((await save(null)).code, 400);
  assert.equal((await save('a'.repeat(73))).code, 400);
});

test('AI service settings (API key) are readable and writable only by administrators', async () => {
  const docs = [{ key: 'ai.apiKey', value: 'sk-secret' }, { key: 'ai.model', value: 'm' }, { key: 'reviewEnabled', value: true }, { key: 'rag.enabled', value: true }];
  let writes = 0;
  const mocks = {
    '../models/Setting': {
      find: async () => docs,
      findOne: async ({ key }) => docs.find(d => d.key === key) || null,
      findOneAndUpdate: async (query, update) => { writes++; return { ...query, ...update }; }
    },
    '../utils/logger': { info() {}, warn() {}, error() {} },
    '../services/maintenanceTasks': {}
  };
  const context = { module: { exports: {} }, require: name => mocks[name] || (name.startsWith('../') ? {} : require(name)), __dirname, Date, console };
  vm.runInNewContext(fs.readFileSync(require.resolve('./settingController'), 'utf8'), context);
  const c = context.module.exports;
  const call = async (fn, key, role, body) => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(b) { this.body = b; } };
    await c[fn]({ params: { key }, body: body || {}, user: { role } }, res);
    return res;
  };
  for (const role of ['student', 'teacher']) {
    assert.equal((await call('getSetting', 'ai.apiKey', role)).code, 403);
    assert.equal((await call('updateSetting', 'ai.apiKey', role, { value: 'x' })).code, 403);
    const all = await call('getAllSettings', undefined, role);
    assert.deepEqual(all.body.map(s => s.key), ['reviewEnabled', 'rag.enabled']);
    assert.equal((await call('getSetting', 'reviewEnabled', role)).code, 200);
  }
  assert.equal(writes, 0);
  assert.equal((await call('getSetting', 'ai.apiKey', 'admin')).body.value, 'sk-secret');
  assert.equal((await call('getAllSettings', undefined, 'admin')).body.length, 4);
});
