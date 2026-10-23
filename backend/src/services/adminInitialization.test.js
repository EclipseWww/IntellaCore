const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const BootstrapState = require('../models/BootstrapState');
const bcrypt = require('bcryptjs');
const { initializeAdmin, getInitializationStatus } = require('./adminInitialization');

test('initialization requires a strong password, refuses an existing administrator, and uses a stable identity', async () => {
  const original = { init: User.init, exists: User.exists, save: User.prototype.save, markerExists: BootstrapState.exists, markerUpdate: BootstrapState.updateOne };
  let existing = false, saved, marked = false;
  BootstrapState.exists = async () => marked;
  BootstrapState.updateOne = async () => { marked = true; };
  User.init = async () => {};
  User.exists = async () => existing;
  User.prototype.save = async function () { saved = this; return this; };
  try {
    await assert.rejects(initializeAdmin({ username: 'admin', password: 'short' }), /至少6/);
    await assert.rejects(initializeAdmin({ username: 'admin', password: '密'.repeat(25) }), /72字节/);
    const result = await initializeAdmin({ username: ' site-admin ', password: 'abc123' });
    assert.equal(result.username, 'site-admin'); assert.equal(saved.role, 'admin'); assert.equal(saved.isActive, true);
    assert.equal(String(saved._id), '000000000000000000000001');
    existing = true;
    await assert.rejects(initializeAdmin({ username: 'another', password: 'strong-admin-password' }), /已初始化/);
    existing = false;
    assert.equal((await getInitializationStatus()).initialized, true);
  } finally { User.init = original.init; User.exists = original.exists; User.prototype.save = original.save; BootstrapState.exists = original.markerExists; BootstrapState.updateOne = original.markerUpdate; }
});

test('web bootstrap of an existing school verifies an active teacher and always creates an administrator role', async () => {
  const original = { init: User.init, exists: User.exists, findOne: User.findOne, save: User.prototype.save, markerExists: BootstrapState.exists, markerUpdate: BootstrapState.updateOne };
  let saved, marked = false;
  const teacher = { password: await bcrypt.hash('teacher-password', 4) };
  User.init = async () => {};
  User.exists = async filter => filter.role === 'teacher';
  User.findOne = async filter => {
    assert.equal(filter.role, 'teacher'); assert.equal(filter.isActive, true);
    return filter.username === 'teacher' ? teacher : null;
  };
  User.prototype.save = async function () { saved = this; return this; };
  BootstrapState.exists = async () => marked;
  BootstrapState.updateOne = async () => { marked = true; };
  const input = { username: 'admin', password: 'strong-admin-password' };
  try {
    assert.deepEqual(await getInitializationStatus(), { initialized: false, requiresTeacherVerification: true });
    await assert.rejects(initializeAdmin(input, { web: true }), error => error.status === 403);
    await assert.rejects(initializeAdmin({ ...input, teacherUsername: 'teacher', teacherPassword: 'wrong' }, { web: true }), error => error.status === 403);
    await initializeAdmin({ ...input, teacherUsername: 'teacher', teacherPassword: 'teacher-password', role: 'student' }, { web: true });
    assert.equal(saved.role, 'admin'); assert.equal(marked, true);
    await assert.rejects(initializeAdmin(input, { web: true }), error => error.status === 409);
  } finally {
    User.init = original.init; User.exists = original.exists; User.findOne = original.findOne; User.prototype.save = original.save;
    BootstrapState.exists = original.markerExists; BootstrapState.updateOne = original.markerUpdate;
  }
});

test('existing database administrators permanently close setup without changing user data', async () => {
  const original = { exists: User.exists, markerExists: BootstrapState.exists, markerUpdate: BootstrapState.updateOne };
  let marked = false;
  User.exists = async filter => filter.role === 'admin';
  BootstrapState.exists = async () => marked;
  BootstrapState.updateOne = async () => { marked = true; };
  try {
    assert.equal((await getInitializationStatus()).initialized, true); assert.equal(marked, true);
    User.exists = async () => false;
    assert.equal((await getInitializationStatus()).initialized, true);
  } finally { User.exists = original.exists; BootstrapState.exists = original.markerExists; BootstrapState.updateOne = original.markerUpdate; }
});
