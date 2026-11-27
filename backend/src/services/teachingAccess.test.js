const test = require('node:test');
const assert = require('node:assert/strict');
const access = require('./teachingAccess');

const OWNER = '507f1f77bcf86cd799439011';
const CO = '507f1f77bcf86cd799439022';
const OTHER = '507f1f77bcf86cd799439033';
const A = '507f1f77bcf86cd7994390a1';
const B = '507f1f77bcf86cd7994390b2';
const C = '507f1f77bcf86cd7994390c3';
const teacher = id => ({ _id: id, role: 'teacher' });

test('owner and co-teachers teach a class; only the owner owns it', () => {
  const cls = { teacher: OWNER, coTeachers: [CO] };
  assert.equal(access.canTeachClass(teacher(OWNER), cls), true);
  assert.equal(access.canTeachClass(teacher(CO), cls), true);
  assert.equal(access.canTeachClass(teacher(OTHER), cls), false);
  assert.equal(access.canTeachClass({ role: 'admin', _id: OTHER }, cls), true);
  assert.equal(access.isClassOwner(teacher(OWNER), cls), true);
  assert.equal(access.isClassOwner(teacher(CO), cls), false);
  assert.equal(access.canTeachClass(teacher(OWNER), { teacher: { _id: OWNER, name: '张' } }), true, 'populated teacher');
  const q = access.classTeacherFilter(CO);
  assert.deepEqual(q.$or.map(c => String(Object.values(c)[0])), [CO, CO]);
  assert.deepEqual(Object.keys(access.withClassAccess({ role: 'admin' }, { x: 1 })), ['x']);
});

test('creators and collaborators maintain a course; only the creator owns it', () => {
  const course = { instructor: OWNER, coInstructors: [CO] };
  assert.equal(access.canMaintainCourse(teacher(CO), course), true);
  assert.equal(access.canMaintainCourse(teacher(OTHER), course), false);
  assert.equal(access.canMaintainCourse({ id: OWNER, role: 'teacher' }, course), true, 'req.user may carry id instead of _id');
  assert.equal(access.isCourseOwner(teacher(CO), course), false);
  assert.equal(access.canMaintainCourse(teacher(OWNER), { instructor: OWNER }), true, 'courses without collaborators');
});

test('saving a shared course keeps classes the editor does not teach', async () => {
  // 课程原来开放给 A（负责教师的班）和 B（共同执教的班）；共同执教教师只任教 B、C
  const merged = await access.mergeAccessibleClasses(teacher(CO), [A, B], [C], [B, C]);
  assert.deepEqual(merged.sort(), [A, C].sort(), 'A stays, B removed by the editor, C added');
  const ignored = await access.mergeAccessibleClasses(teacher(CO), [A], [A, 'not-an-id'], [C]);
  assert.deepEqual(ignored, [A], 'cannot add a class the editor does not teach; bad ids ignored');
  assert.deepEqual(await access.mergeAccessibleClasses({ role: 'admin' }, [A, B], [C]), [C], 'admins set the list directly');
});

test('teacher lists are cleaned of duplicates, bad ids and the owner', () => {
  assert.deepEqual(access.cleanTeacherIds([CO, CO, OWNER, 'x', null, { _id: OTHER }], OWNER), [CO, OTHER]);
  assert.deepEqual(access.cleanTeacherIds(undefined), []);
});
