const test = require('node:test');
const assert = require('node:assert/strict');
const { courseMaintainer } = require('./courseMaintainer');

const COURSE = '507f1f77bcf86cd7994390d1';
const MINE = '507f1f77bcf86cd7994390d2';
const UNIT = '507f1f77bcf86cd7994390e1';
const LESSON = '507f1f77bcf86cd7994390f1';
const lean = v => ({ select: () => ({ lean: async () => v }) });
const models = {
  CourseUnit: { findById: id => lean(id === UNIT ? { course: COURSE } : null) },
  Lesson: { findById: id => lean(id === LESSON ? { course: COURSE, unit: UNIT } : null) }
};
const run = async (user, params, maintainers = ['co']) => {
  const checked = [];
  const mw = courseMaintainer(models, async (u, courseId) => { checked.push(String(courseId)); return maintainers.includes(u._id); });
  const res = { statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } };
  let passed = false;
  await mw({ user, params }, res, () => { passed = true; });
  return { passed, status: res.statusCode, checked };
};
const co = { _id: 'co', role: 'teacher' };
const other = { _id: 'other', role: 'teacher' };

test('creators and collaborators may change course content; other teachers and students may not', async () => {
  assert.equal((await run(co, { lessonId: LESSON })).passed, true);
  assert.equal((await run(other, { lessonId: LESSON })).status, 403);
  assert.equal((await run({ _id: 's', role: 'student' }, { lessonId: LESSON })).status, 403);
  assert.equal((await run(undefined, { lessonId: LESSON })).status, 401);
});

test('the course comes from the most specific id, and mixed ids must agree', async () => {
  assert.deepEqual((await run(co, { courseId: COURSE, unitId: UNIT, lessonId: LESSON })).checked, [COURSE]);
  assert.deepEqual((await run(co, { unitId: UNIT })).checked, [COURSE]);
  // 用自己课程的编号搭配别人课时的编号
  const mixed = await run({ _id: 'me', role: 'teacher' }, { courseId: MINE, unitId: UNIT, lessonId: LESSON }, ['me']);
  assert.equal(mixed.status, 400);
  assert.equal(mixed.passed, false);
  assert.equal((await run(co, { lessonId: 'bad' })).status, 400);
  assert.equal((await run(co, { lessonId: '507f1f77bcf86cd799439000' })).status, 404);
});
