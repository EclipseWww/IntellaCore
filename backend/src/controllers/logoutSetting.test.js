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
