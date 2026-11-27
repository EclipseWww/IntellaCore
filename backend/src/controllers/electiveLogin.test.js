const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// 学生登录到教学班（社团、选修）：所选班级、按班级绑定的 IP、一次性放行
const ADMIN = '507f1f77bcf86cd799439011';
const ELECTIVE = '507f1f77bcf86cd799439022';
const OTHER = '507f1f77bcf86cd799439033';
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const response = () => ({ statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } });

function setup({ homeClass = ADMIN, adminLive = false, electiveLive = true, member = true, boundIp = null, loginHistory = [], handoff = null, ip = '10.0.0.5', sessionId } = {}) {
  const updates = [];
  const membershipUpdates = [];
  const records = [];
  const student = {
    _id: 'stu1', username: 's1', name: '张三', role: 'student', isActive: true, classId: homeClass, seatNumber: homeClass ? 'A1' : undefined,
    loginHistory, loginHandoff: handoff, sessionId, sessionExpiresAt: sessionId ? new Date(Date.now() + 3600e3) : undefined,
    addLoginRecord: async (...args) => { records.push(args); }
  };
  const classes = {
    [ADMIN]: { _id: ADMIN, type: 'admin', grade: 2024, name: 3, isInClass: adminLive, allowIpChange: false, status: 'active' },
    [ELECTIVE]: { _id: ELECTIVE, type: 'elective', title: 'Python 社团', isInClass: electiveLive, allowIpChange: false, status: 'active' },
    [OTHER]: { _id: OTHER, type: 'elective', title: '机器人社团', isInClass: true, allowIpChange: false, status: 'active' }
  };
  const membership = member ? { _id: 'm1', class: ELECTIVE, student: 'stu1', seatNumber: 'C3', boundIp } : null;
  const select = value => ({ select: async () => value });
  const mocks = {
    '../models/User': {
      findOne: async () => student,
      findById: () => select(student),
      findByIdAndUpdate: async (id, update) => { updates.push(update); }
    },
    '../models/Class': { findById: id => select(classes[String(id)] || null) },
    '../models/ClassMembership': {
      findOne: async q => (membership && String(q.class) === String(membership.class) ? membership : null),
      updateOne: async (q, u) => { membershipUpdates.push(u); }
    },
    '../services/classRoster': require('../services/classRoster'),
    '../utils/className': require('../utils/className'),
    mongoose,
    bcryptjs: require('bcryptjs'), jsonwebtoken: jwt, '../utils/logger': logger,
    '../utils/getClientIp': { getClientIp: () => ip },
    crypto: require('node:crypto')
  };
  const context = { module: { exports: {} }, exports: {}, require: name => mocks[name] || {}, process: { env: { JWT_SECRET: 'test-secret' } }, console, Date };
  vm.runInNewContext(fs.readFileSync(require.resolve('./authController'), 'utf8'), context);
  const login = async (classId) => {
    const res = response();
    await context.module.exports.login({ body: { username: 's1', ...(classId && { classId }) }, headers: { 'user-agent': 't' } }, res);
    return res;
  };
  return { login, updates, membershipUpdates, records };
}

test('a member logs in to a live elective even when the home class is not in session', async () => {
  const f = setup();
  const res = await f.login(ELECTIVE);
  assert.equal(res.statusCode, 200);
  assert.equal(String(res.body.classInfo.classId), ELECTIVE);
  assert.equal(res.body.classInfo.className, 'Python 社团');
  assert.equal(res.body.user.seatNumber, 'C3', 'elective seat, not the home-class seat');
  assert.equal(String(f.updates[0].sessionClassId), ELECTIVE);
  assert.equal(String(f.records[0][2]), ELECTIVE, 'login record remembers the class');
  assert.deepEqual(JSON.parse(JSON.stringify(f.membershipUpdates)), [{ $set: { boundIp: '10.0.0.5' } }], 'first elective login binds this computer');
});

test('without choosing a class the home class is used, and it must be in session', async () => {
  const res = await setup().login();
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'CLASS_NOT_IN_SESSION');
});

test('students cannot log in to an elective they are not a member of', async () => {
  const notMember = await setup({ member: false }).login(ELECTIVE);
  assert.equal(notMember.statusCode, 403);
  assert.equal(notMember.body.code, 'NOT_IN_CLASS');
  const otherElective = await setup().login(OTHER);
  assert.equal(otherElective.body.code, 'NOT_IN_CLASS');
});

test('an elective compares against its own bound IP and sends approval to that class', async () => {
  const res = await setup({ boundIp: '10.0.0.9' }).login(ELECTIVE);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'IP_CHANGE_REQUIRED');
  assert.equal(res.body.oldIp, '10.0.0.9');
  assert.equal(String(res.body.classId), ELECTIVE);
});

test('home-class IP binding ignores logins made in electives', async () => {
  const history = [{ ip: '10.0.0.7', classId: ELECTIVE }, { ip: '10.0.0.5' }];
  const same = await setup({ adminLive: true, loginHistory: history }).login();
  assert.equal(same.statusCode, 200);
  const moved = await setup({ adminLive: true, loginHistory: history, ip: '10.0.0.7' }).login();
  assert.equal(moved.statusCode, 401);
  assert.equal(moved.body.oldIp, '10.0.0.5');
});

test('a student signed out by the elective can log in from the same computer without approval, once', async () => {
  const handoff = { classId: ELECTIVE, ip: '10.0.0.5', expiresAt: new Date(Date.now() + 600e3) };
  const f = setup({ boundIp: '10.0.0.9', handoff });
  const res = await f.login(ELECTIVE);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(f.updates[0].loginHandoff)), { classId: null, ip: null, expiresAt: null }, 'pass is used up');
  assert.equal(f.membershipUpdates.length, 0, 'the elective seat binding is kept');

  const elsewhere = await setup({ boundIp: '10.0.0.9', handoff, ip: '10.0.0.8' }).login(ELECTIVE);
  assert.equal(elsewhere.body.code, 'IP_CHANGE_REQUIRED', 'another computer still needs approval');
  const expired = await setup({ boundIp: '10.0.0.9', handoff: { ...handoff, expiresAt: new Date(Date.now() - 1000) } }).login(ELECTIVE);
  assert.equal(expired.body.code, 'IP_CHANGE_REQUIRED');
});

test('an active session elsewhere still goes through the approval flow for the chosen class', async () => {
  const res = await setup({ sessionId: 'old' }).login(ELECTIVE);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'DEVICE_CONFLICT');
  assert.equal(String(res.body.classId), ELECTIVE);
});

test('a student without a home class logs in only through an elective they belong to', async () => {
  const f = setup({ homeClass: null });
  const res = await f.login(ELECTIVE);
  assert.equal(res.statusCode, 200);
  assert.equal(String(res.body.classInfo.classId), ELECTIVE);
  assert.equal(res.body.user.seatNumber, 'C3');
  assert.equal(String(f.updates[0].sessionClassId), ELECTIVE);

  const none = await setup({ homeClass: null }).login();
  assert.equal(none.statusCode, 400);
  assert.equal(none.body.code, 'SELECT_CLASS');
  const notMember = await setup({ homeClass: null, member: false }).login(ELECTIVE);
  assert.equal(notMember.body.code, 'NOT_IN_CLASS');
  const someoneElsesHome = await setup({ homeClass: null }).login(ADMIN);
  assert.equal(someoneElsesHome.body.code, 'NOT_IN_CLASS');
});
