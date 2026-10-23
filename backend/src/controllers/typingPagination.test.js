const test = require('node:test');
const assert = require('node:assert/strict');
const { load, logger, response } = require('../testing/reviewTestSupport');
function setup(total = 35) {
  const calls = {};
  const query = {
    populate() { return this; }, sort(value) { calls.sort = value; return this; },
    skip(value) { calls.skip = value; return this; }, limit(value) { calls.limit = value; return this; },
    then(resolve, reject) { return Promise.resolve([{ _id: 'record', userId: { _id: 'student', name: 'Student' } }]).then(resolve, reject); }
  };
  const controller = load(require.resolve('./typingController'), {
    '../models/TypingText': {},
    '../models/TypingRecord': {
      find: filter => { calls.filter = filter; return query; },
      countDocuments: async () => { calls.counted = true; return total; },
      aggregate: async pipeline => { calls.pipeline = pipeline; return [{ totalPractices: 4, passedPractices: 3, totalSpeed: 202, totalAccuracy: 370 }]; }
    },
    '../models/User': { find: () => ({ select: async () => [{ _id: 'student' }] }) },
    '../models/Class': { find: () => ({ select: () => ({ sort: async () => [] }) }) },
    '../utils/logger': logger, '../models/Achievement': {}, '../utils/pointsManager': {}, mongoose: {}
  });
  return { controller, calls };
}
for (const [name, params, page, size, skip] of [
  ['second page', { page: '2', pageSize: '10' }, 2, 10, 10],
  ['size capped', { page: '1', pageSize: '1000' }, 1, 100, 0],
  ['invalid values', { page: '-3', pageSize: 'bad' }, 1, 10, 0],
  ['page after deletion', { page: '99', pageSize: '10' }, 4, 10, 30]
]) {
  test(name, async () => {
    const { controller, calls } = setup(); const res = response();
    await controller.getTeacherRecords({ query: { ...params, classId: 'class', lessonId: 'lesson' }, user: { _id: 'teacher' } }, res);
    assert.equal(res.statusCode, 200); assert.equal(res.body.total, 35);
    assert.equal(res.body.page, page); assert.equal(res.body.pageSize, size);
    assert.equal(calls.skip, skip); assert.equal(calls.limit, size);
    assert.equal(calls.filter.lessonId, 'lesson'); assert.equal(calls.filter.userId.$in[0], 'student');
  });
}
test('classroom callers retain full records without pagination parameters', async () => {
  const { controller, calls } = setup(); const res = response();
  await controller.getTeacherRecords({ query: {}, user: { _id: 'teacher' } }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.records.length, 1);
  assert.equal(calls.limit, undefined); assert.equal(calls.counted, undefined);
});
test('empty results stay on page one', async () => {
  const { controller } = setup(0); const res = response();
  await controller.getTeacherRecords({ query: { page: '8' }, user: { _id: 'teacher' } }, res);
  assert.equal(res.body.page, 1); assert.equal(res.body.total, 0);
});
test('statistics aggregate the full filtered set', async () => {
  const { controller, calls } = setup(); const res = response();
  await controller.getTeacherStats({ query: { classId: 'class' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.averageSpeed, 51); assert.equal(res.body.averageAccuracy, 93);
  assert.equal(res.body.totalPractices, 4); assert.equal(res.body.passRate, 75);
  assert.equal(calls.pipeline[0].$match.userId.$in[0], 'student');
});
