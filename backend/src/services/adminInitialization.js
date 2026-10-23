const mongoose = require('mongoose');
const User = require('../models/User');
const BootstrapState = require('../models/BootstrapState');
const bcrypt = require('bcryptjs');

// A fixed bootstrap identity also makes simultaneous initialization attempts safe.
const BOOTSTRAP_ADMIN_ID = '000000000000000000000001';
const fail = (message, status) => Object.assign(new Error(message), { status });
async function markInitialized() {
  await BootstrapState.updateOne({ _id: 'administrator' }, { $setOnInsert: { initializedAt: new Date() } }, { upsert: true });
}
async function getInitializationStatus() {
  if (await BootstrapState.exists({ _id: 'administrator' })) return { initialized: true, requiresTeacherVerification: false };
  if (await User.exists({ role: 'admin' })) {
    await markInitialized();
    return { initialized: true, requiresTeacherVerification: false };
  }
  return { initialized: false, requiresTeacherVerification: Boolean(await User.exists({ role: 'teacher' })) };
}
async function initializeAdmin({ username, password, name = '系统管理员', teacherUsername, teacherPassword }, { web = false } = {}) {
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' ||
      username.trim().length > 64 || typeof name !== 'string' || !name.trim() || name.trim().length > 64 ||
      password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
    throw fail('用户名和姓名须为1至64个字符，密码须至少6个字符且不超过72字节', 400);
  }
  await User.init();
  const state = await getInitializationStatus();
  if (state.initialized) throw fail('系统已初始化，请使用管理员后台管理账号', 409);
  if (web && state.requiresTeacherVerification) {
    if (typeof teacherUsername !== 'string' || !teacherUsername.trim() || typeof teacherPassword !== 'string') {
      throw fail('请先验证现有教师账号', 403);
    }
    const teacher = await User.findOne({ username: teacherUsername.trim(), role: 'teacher', isActive: true });
    if (!teacher || !await bcrypt.compare(teacherPassword, teacher.password)) throw fail('教师账号或密码不正确', 403);
  }
  const user = new User({ _id: new mongoose.Types.ObjectId(BOOTSTRAP_ADMIN_ID),
    username: username.trim(), password, name: name.trim(), role: 'admin', isActive: true });
  await user.save();
  await markInitialized();
  return { id: user.id, username: user.username };
}
module.exports = { initializeAdmin, getInitializationStatus };
