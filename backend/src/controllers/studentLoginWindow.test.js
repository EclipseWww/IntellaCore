const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const logger = { info() {}, warn() {}, error() {}, debug() {} };
const response = () => ({ statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } });

async function setup({ isInClass, loginHistory = [], sessionId } = {}) {
  const student = { _id: 'stu1', username: 's1', name: '张三', role: 'student', isActive: true, classId: 'c1', seatNumber: 3,
    password: await bcrypt.hash('right-pass', 4), loginHistory, sessionId, sessionExpiresAt: sessionId ? new Date(Date.now() + 3600e3) : undefined,
    addLoginRecord: async () => {} };
  const select = value => ({ select: async () => value });
  const mocks = {
    '../models/User': { findOne: async () => student, findById: () => select(student), findByIdAndUpdate: async () => {} },
    '../models/Class': { findById: () => select({ _id: 'c1', isInClass, allowIpChange: true, status: 'active' }) },
    bcryptjs: bcrypt, jsonwebtoken: jwt, '../utils/logger': logger, '../utils/getClientIp': { getClientIp: () => '10.0.0.5' },
    crypto: require('node:crypto')
  };
  const context = { module: { exports: {} }, exports: {}, require: name => mocks[name] || {}, process: { env: { JWT_SECRET: 'test-secret' } }, console, Date };
  vm.runInNewContext(fs.readFileSync(require.resolve('./authController'), 'utf8'), context);
  return context.module.exports;
}
const login = async (controller, password) => {
  const res = response();
  await controller.login({ body: { username: 's1', password }, headers: { 'user-agent': 't' } }, res);
  return res;
};

test('during class students log in without a password', async () => {
  const c = await setup({ isInClass: true });
  for (const password of [undefined, '', 'anything']) assert.equal((await login(c, password)).statusCode, 200);
});

test('outside class time students cannot log in, even with the correct password', async () => {
  const c = await setup({ isInClass: false });
  for (const password of ['right-pass', 'wrong', '', undefined]) {
    const res = await login(c, password);
    assert.equal(res.statusCode, 403, String(password));
    assert.equal(res.body.code, 'CLASS_NOT_IN_SESSION');
  }
});

test('outside class time nothing about the student is revealed (no IP / device / name details)', async () => {
  const c = await setup({ isInClass: false, sessionId: 'other-device', loginHistory: [{ ip: '192.168.9.9' }] });
  const res = await login(c, undefined);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'CLASS_NOT_IN_SESSION');
  for (const key of ['oldIp', 'newIp', 'studentName', 'studentId', 'canRequestLogin']) assert.equal(res.body[key], undefined, key);
});

test('during class an existing session on another device still triggers the approval flow', async () => {
  const c = await setup({ isInClass: true, sessionId: 'other-device' });
  const res = await login(c, undefined);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'DEVICE_CONFLICT');
});
