const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const mongoose = require('mongoose');

// 在教学班里直接新建没有行政班的学生账号，以及教学班老师管理这些账号
const ELECTIVE = '507f1f77bcf86cd799439022';
const HOME = '507f1f77bcf86cd799439011';
const OLD_HOME = '507f1f77bcf86cd799439033';
const response = () => ({ statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } });
const lean = value => ({ select: () => ({ lean: async () => value }), lean: async () => value });

function setup({ capacity = 0, users = [], members = [], archivedHomes = [] } = {}) {
  const created = [];
  const memberships = members.map(student => ({ class: ELECTIVE, student }));
  const saved = [];
  const cls = { _id: ELECTIVE, type: 'elective', title: 'Python 社团', teacher: 't1', capacity, status: 'active' };
  const mocks = {
    mongoose,
    '../models/Class': {
      findOne: async q => (String(q._id) === ELECTIVE && (!q.teacher || q.teacher === 't1') ? cls : null),
      exists: async q => q.teacher === 't1' && String(q._id) === HOME,
      find: q => lean((q._id.$in || []).filter(id => archivedHomes.includes(String(id))).map(_id => ({ _id })))
    },
    '../models/User': {
      find: q => lean(users.filter(u => q.username.$in.includes(u.username))),
      create: async doc => { const u = { ...doc, _id: `new-${doc.username}` }; created.push(u); return u; },
      findById: async id => {
        const u = users.find(x => x._id === id);
        return u && { ...u, save: async function () { saved.push({ name: this.name, password: this.password }); } };
      },
      findOne: async q => {
        const u = users.find(x => x._id === q._id && x.role === 'student');
        return u && { ...u, save: async function () { saved.push({ name: this.name, password: this.password }); } };
      }
    },
    '../models/ClassMembership': {
      find: () => ({ distinct: async () => memberships.map(m => m.student) }),
      updateOne: async (q) => { memberships.push({ class: q.class, student: q.student }); },
      exists: async q => memberships.some(m => m.student === q.student),
      findOne: async q => (memberships.some(m => m.student === q.student) ? { seatNumber: null, boundIp: null } : null),
      findOneAndUpdate: async () => ({ seatNumber: null, boundIp: null })
    },
    '../services/classRoster': { isElective: c => !!c && c.type === 'elective' },
    '../utils/className': require('../utils/className'),
    '../utils/studentPassword': require('../utils/studentPassword'),
    '../utils/logger': { info() {}, warn() {}, error() {}, debug() {} }
  };
  const context = { module: { exports: {} }, exports: {}, require: name => mocks[name] || {}, console, Date, Map, Set, Number, String };
  vm.runInNewContext(fs.readFileSync(require.resolve('./classController'), 'utf8'), context);
  const controller = context.module.exports;
  const create = async (students, user = { _id: 't1', role: 'teacher' }) => {
    const res = response();
    await controller.createElectiveStudents({ params: { classId: ELECTIVE }, user, body: { students } }, res);
    return res;
  };
  const update = async (studentId, body) => {
    const res = response();
    await controller.updateElectiveMember({ params: { classId: ELECTIVE, studentId }, user: { _id: 't1', role: 'teacher' }, body }, res);
    return res;
  };
  const updateStudent = async (studentId, body) => {
    const res = response();
    await controller.updateStudent({ params: { studentId }, user: { _id: 't1', role: 'teacher' }, body }, res);
    return res;
  };
  return { create, update, updateStudent, created, memberships, saved };
}

test('creates accounts without a home class and adds them to the elective', async () => {
  const f = setup();
  const res = await f.create([{ username: '20250101', name: '王五', password: '123456' }, { username: 'x-2', name: '赵六', password: 'abcdef' }]);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.created, 2);
  assert.deepEqual(f.created.map(u => [u.username, u.role, u.classId]), [['20250101', 'student', null], ['x-2', 'student', null]]);
  assert.equal(f.memberships.length, 2);
});

test('an existing student number joins the elective without changing the account', async () => {
  const f = setup({ users: [{ _id: '507f1f77bcf86cd799439044', username: '20240301', role: 'student', classId: HOME }] });
  const res = await f.create([{ username: '20240301', name: '别的名字', password: '123456' }]);
  assert.equal(res.body.data.created, 0);
  assert.equal(res.body.data.joined, 1);
  assert.equal(f.created.length, 0);
  assert.equal(f.memberships.length, 1);
});

test('rejects bad rows, teacher numbers and graduated students; respects capacity', async () => {
  assert.equal((await setup().create([{ username: 'a b', name: '甲', password: '123456' }])).statusCode, 400);
  assert.equal((await setup().create([{ username: 'a1', name: '', password: '123456' }])).statusCode, 400);
  assert.equal((await setup().create([{ username: 'a1', name: '甲', password: '123' }])).statusCode, 400);
  assert.equal((await setup().create([{ username: 'a1', name: '甲', password: '123456' }, { username: 'a1', name: '乙', password: '123456' }])).statusCode, 400);
  const teacher = setup({ users: [{ _id: 't9', username: 'T001', role: 'teacher' }] });
  assert.equal((await teacher.create([{ username: 'T001', name: '甲', password: '123456' }])).statusCode, 400);
  assert.equal(teacher.created.length, 0);

  const graduated = setup({ users: [{ _id: 's9', username: '2019001', role: 'student', classId: OLD_HOME }], archivedHomes: [OLD_HOME] });
  const g = await graduated.create([{ username: '2019001', name: '甲', password: '123456' }]);
  assert.equal(g.body.data.joined, 0);
  assert.equal(graduated.memberships.length, 0);

  const full = setup({ capacity: 2, members: ['m1'] });
  const res = await full.create([{ username: 'a1', name: '甲', password: '123456' }, { username: 'a2', name: '乙', password: '123456' }]);
  assert.equal(res.body.data.created, 1);
  assert.equal(res.body.data.overCapacity, 1);
});

test('only the elective teacher can create accounts', async () => {
  const res = await setup().create([{ username: 'a1', name: '甲', password: '123456' }], { _id: 't2', role: 'teacher' });
  assert.equal(res.statusCode, 404);
  const student = await setup().create([{ username: 'a1', name: '甲', password: '123456' }], { _id: 's1', role: 'student' });
  assert.equal(student.statusCode, 403);
});

test('the elective teacher can rename or reset the password only for members without a home class', async () => {
  const SOLO = '507f1f77bcf86cd799439055';
  const HOMED = '507f1f77bcf86cd799439066';
  const f = setup({
    users: [
      { _id: SOLO, username: 'a1', role: 'student', classId: null, name: '甲' },
      { _id: HOMED, username: 'a2', role: 'student', classId: HOME, name: '乙' }
    ],
    members: [SOLO, HOMED]
  });
  const ok = await f.update(SOLO, { name: '丙', password: '654321' });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(f.saved, [{ name: '丙', password: '654321' }], 'saved through the document so the password is hashed');
  const homed = await f.update(HOMED, { password: '654321' });
  assert.equal(homed.statusCode, 400, 'accounts with a home class are managed by that class');
  assert.equal((await f.update(SOLO, { password: '12' })).statusCode, 400);
  assert.equal((await f.update('507f1f77bcf86cd799439077', { name: '丁' })).statusCode, 404, 'not a member');
  assert.equal(f.saved.length, 1);
});

test('passwords are optional because students log in without one during class', async () => {
  const f = setup();
  const res = await f.create([{ username: 'a1', name: '甲' }]);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.created, 1);
  assert.match(f.created[0].password, /^[0-9a-f]{24}$/, 'a random password fills the required field');
});

test('editing a home-class student saves through the document so a new password is hashed', async () => {
  const f = setup({ users: [{ _id: 'homed', username: 'a2', role: 'student', classId: HOME, name: '乙' }] });
  const res = await f.updateStudent('homed', { name: '丙', password: 'newpass1' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(f.saved, [{ name: '丙', password: 'newpass1' }]);
});
