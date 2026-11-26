const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const mongoose = require('mongoose');

const response = () => ({ statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } });
const CLASS_ID = '507f1f77bcf86cd799439011';

function setup({ owned = true, duplicate = false } = {}) {
  const saved = [];
  const classObj = { _id: CLASS_ID, grade: 2024, name: 1, teacher: 't1', save: async function () { saved.push({ grade: this.grade, name: this.name }); } };
  const queries = [];
  const Class = {
    findOne: (query) => {
      queries.push(query);
      if (query.grade !== undefined) return { select: async () => (duplicate ? { _id: 'other' } : null) };
      return Promise.resolve(owned || !query.teacher ? classObj : null);
    }
  };
  const mocks = { '../models/Class': Class, mongoose, '../utils/logger': { info() {}, warn() {}, error() {}, debug() {} } };
  const context = { module: { exports: {} }, exports: {}, require: name => mocks[name] || {}, console, Date, Map, Number, String };
  vm.runInNewContext(fs.readFileSync(require.resolve('./classController'), 'utf8'), context);
  return { controller: context.module.exports, saved, queries };
}
const call = async (f, user, body, classId = CLASS_ID) => {
  const res = response();
  await f.controller.updateClassInfo({ params: { classId }, user, body }, res);
  return res;
};

test('the owning teacher can change grade and class number', async () => {
  const f = setup();
  const res = await call(f, { _id: 't1', role: 'teacher' }, { grade: 2025, name: 3 });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(f.saved, [{ grade: 2025, name: 3 }]);
  assert.equal(f.queries[0].teacher, 't1');
});
test('another teacher cannot edit; an admin can edit any class', async () => {
  const other = setup({ owned: false });
  assert.equal((await call(other, { _id: 't2', role: 'teacher' }, { grade: 2025, name: 3 })).statusCode, 404);
  const admin = setup({ owned: false });
  assert.equal((await call(admin, { _id: 'a1', role: 'admin' }, { grade: 2025, name: 3 })).statusCode, 200);
});
test('rejects students, bad input and duplicate grade/class pairs', async () => {
  assert.equal((await call(setup(), { _id: 's1', role: 'student' }, { grade: 2025, name: 3 })).statusCode, 403);
  assert.equal((await call(setup(), { _id: 't1', role: 'teacher' }, { grade: 25, name: 3 })).statusCode, 400);
  assert.equal((await call(setup(), { _id: 't1', role: 'teacher' }, { grade: 2025, name: 0 })).statusCode, 400);
  assert.equal((await call(setup(), { _id: 't1', role: 'teacher' }, { grade: 2025, name: 3 }, 'not-an-id')).statusCode, 400);
  const dup = setup({ duplicate: true });
  const res = await call(dup, { _id: 't1', role: 'teacher' }, { grade: 2025, name: 3 });
  assert.equal(res.statusCode, 400); assert.equal(dup.saved.length, 0);
});
