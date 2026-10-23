const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

test('student logout validates stored hash and never clears session on invalid credentials', async () => {
  let cleared = 0;
  let setting = { value: await bcrypt.hash('new-password', 4) };
  const mocks = {
    '../models/User': { findByIdAndUpdate: async () => { cleared++; } },
    '../models/Setting': { findOne: async () => setting },
    bcryptjs: bcrypt,
    '../utils/logger': { info() {}, error() {} }
  };
  const context = { module: { exports: {} }, require: name => mocks[name] || {}, process: { env: {} }, console };
  vm.runInNewContext(fs.readFileSync(require.resolve('./authController'), 'utf8'), context);
  async function logout(password, role = 'student') {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await context.module.exports.logout({ user: { id: 'student', role }, body: { teacherPassword: password } }, res);
    return res;
  }
  assert.equal((await logout('wrong')).code, 403);
  assert.equal((await logout(undefined)).code, 403);
  assert.equal(cleared, 0);
  assert.equal((await logout('new-password')).code, 200);
  assert.equal(cleared, 1);
  for (const password of ['', 'a']) {
    setting = { value: await bcrypt.hash(password, 4) };
    assert.equal((await logout(password)).code, 200);
    assert.equal((await logout('wrong')).code, 403);
  }
  assert.equal(cleared, 3);
  setting = null;
  assert.equal((await logout('new-password')).code, 403);
  assert.equal(cleared, 3);
  assert.equal((await logout(undefined, 'teacher')).code, 200);
});
