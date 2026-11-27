const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const mongoose = require('mongoose');

// 多位教师共同执教教学班、共同维护课程
const OWNER = '507f1f77bcf86cd799439011';
const CO = '507f1f77bcf86cd799439022';
const OTHER = '507f1f77bcf86cd799439033';
const CLASS_ID = '507f1f77bcf86cd7994390c1';
const COURSE_ID = '507f1f77bcf86cd7994390d1';
const A = '507f1f77bcf86cd7994390a1';
const B = '507f1f77bcf86cd7994390b2';
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const response = () => ({ statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } });
const lean = value => ({ select: () => ({ lean: async () => value, sort: () => ({ lean: async () => value }) }), lean: async () => value });

function loadController(file, mocks) {
  const all = { mongoose, '../utils/logger': logger, '../services/teachingAccess': require('../services/teachingAccess'), ...mocks };
  const context = { module: { exports: {} }, require: name => all[name] || {}, console, Date, Map, Set, Number, String, Promise };
  context.exports = context.module.exports;
  vm.runInNewContext(fs.readFileSync(require.resolve(file), 'utf8'), context);
  return context.module.exports;
}

function classSetup({ coTeachers = [CO] } = {}) {
  const cls = { _id: CLASS_ID, type: 'elective', title: 'Python 社团', teacher: OWNER, coTeachers, status: 'active', saved: 0, async save() { this.saved++; } };
  const courseUpdates = [];
  const teachers = { [CO]: '李老师', [OTHER]: '王老师' };
  const controller = loadController('./classController', {
    '../models/Class': {
      findOne: async q => {
        if (String(q._id) !== CLASS_ID) return null;
        if (q.teacher) return String(q.teacher) === cls.teacher ? cls : null;
        if (q.$or) return [cls.teacher, ...cls.coTeachers].some(t => q.$or.some(c => String(c.teacher || c.coTeachers) === String(t))) ? cls : null;
        return cls;
      },
      exists: async q => cls.coTeachers.some(t => String(t) === String(q.coTeachers))
    },
    '../models/User': {
      find: q => lean(q._id.$in.filter(id => teachers[id]).map(id => ({ _id: id, name: teachers[id] })))
    },
    '../models/Course': { updateMany: async (q, u) => { courseUpdates.push({ q, u }); return { matchedCount: 2 }; } },
    '../services/classRoster': { isElective: c => !!c && c.type === 'elective' },
    '../utils/className': require('../utils/className')
  });
  const call = async (user, body) => {
    const res = response();
    await controller.setElectiveCoTeachers({ params: { classId: CLASS_ID }, user, body }, res);
    return res;
  };
  return { cls, call, courseUpdates };
}

test('the owner sets co-teachers and can share the class courses with them', async () => {
  const f = classSetup({ coTeachers: [] });
  const res = await f.call({ _id: OWNER, role: 'teacher' }, { teacherIds: [CO, OTHER, OWNER, CO], shareCourses: true });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(f.cls.coTeachers.map(String), [CO, OTHER], 'deduplicated, owner excluded');
  assert.equal(f.courseUpdates.length, 1);
  assert.equal(String(f.courseUpdates[0].q.instructor), OWNER, 'only courses the owner created');
  assert.equal(String(f.courseUpdates[0].q.accessibleClasses), CLASS_ID);
  assert.equal(res.body.data.sharedCourses, 2);
});

test('co-teachers cannot change the co-teacher list; unknown teachers are rejected', async () => {
  const f = classSetup();
  const co = await f.call({ _id: CO, role: 'teacher' }, { teacherIds: [] });
  assert.equal(co.statusCode, 403);
  assert.equal(f.cls.saved, 0);
  const bad = await classSetup().call({ _id: OWNER, role: 'teacher' }, { teacherIds: ['507f1f77bcf86cd799439099'] });
  assert.equal(bad.statusCode, 400);
});

function courseSetup({ course: c = {} } = {}) {
  const course = { _id: COURSE_ID, instructor: OWNER, coInstructors: [CO], accessibleClasses: [A, B], saved: 0, async save() { this.saved++; }, ...c };
  const updates = [];
  let deleted = false;
  const taught = { [CO]: [B], [OWNER]: [A] };
  const controller = loadController('./courseManagementController', {
    '../models/Course': {
      findById: async () => course,
      findByIdAndUpdate: async (id, u) => { updates.push(u.$set); return { ...course, ...u.$set }; },
      findByIdAndDelete: async () => { deleted = true; }
    },
    '../models/CourseUnit': { countDocuments: async () => 0 },
    '../models/User': { find: q => lean(q._id.$in.map(id => ({ _id: id, name: 'T' }))) },
    '../services/teachingAccess': {
      ...require('../services/teachingAccess'),
      mergeAccessibleClasses: (user, existing, submitted) =>
        require('../services/teachingAccess').mergeAccessibleClasses(user, existing, submitted, taught[String(user._id || user.id)] || [])
    }
  });
  const call = async (fn, user, body = {}) => {
    const res = response();
    await controller[fn]({ params: { id: COURSE_ID }, user, body }, res);
    return res;
  };
  return { course, updates, call, wasDeleted: () => deleted };
}

test('collaborators edit a course without dropping other teachers classes or changing ownership', async () => {
  const f = courseSetup();
  const res = await f.call('updateCourse', { id: CO, _id: CO, role: 'teacher' }, {
    title: '新标题', accessibleClasses: [], instructor: CO, coInstructors: []
  });
  assert.equal(res.statusCode, 200);
  assert.equal(f.updates[0].title, '新标题');
  assert.deepEqual(f.updates[0].accessibleClasses, [A], 'owner class A kept; the collaborator removed only their own class B');
  assert.equal(f.updates[0].instructor, undefined);
  assert.equal(f.updates[0].coInstructors, undefined);
  const other = await f.call('updateCourse', { id: OTHER, _id: OTHER, role: 'teacher' }, { title: 'x' });
  assert.equal(other.statusCode, 403);
});

test('only the creator deletes a course or manages collaborators', async () => {
  const f = courseSetup();
  assert.equal((await f.call('deleteCourse', { id: CO, _id: CO, role: 'teacher' })).statusCode, 403);
  assert.equal(f.wasDeleted(), false);
  assert.equal((await f.call('setCourseCoInstructors', { id: CO, _id: CO, role: 'teacher' }, { teacherIds: [] })).statusCode, 403);
  const ok = await f.call('setCourseCoInstructors', { id: OWNER, _id: OWNER, role: 'teacher' }, { teacherIds: [OTHER, OWNER] });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(f.course.coInstructors.map(String), [OTHER]);
  await f.call('deleteCourse', { id: OWNER, _id: OWNER, role: 'teacher' });
  assert.equal(f.wasDeleted(), true);
});

function lessonSetup({ version = 3, lastEditedBy = OWNER } = {}) {
  const lesson = { _id: 'l1', contentVersion: version, lastEditedBy, title: '旧' };
  const filters = [];
  const matches = (q, me) => q.$or.some(c =>
    (c.contentVersion !== undefined && typeof c.contentVersion === 'number' && c.contentVersion === lesson.contentVersion) ||
    (c.lastEditedBy !== undefined && String(c.lastEditedBy) === String(lesson.lastEditedBy)));
  const controller = loadController('./lessonController', {
    '../models/Lesson': {
      findOneAndUpdate: async (q, u) => {
        filters.push(q);
        if (q.$or && !matches(q)) return null;
        Object.assign(lesson, u.$set);
        lesson.contentVersion += u.$inc.contentVersion;
        return lesson;
      },
      findById: () => ({ select: () => ({ populate: () => ({ lean: async () => ({ lastEditedBy: { name: '张' }, updatedAt: new Date() }) }) }) })
    }
  });
  const save = async (user, body) => {
    const res = response();
    await controller.updateLesson({ params: { lessonId: 'l1' }, user, body }, res);
    return res;
  };
  return { lesson, filters, save };
}

test('saving a lesson another teacher changed since it was opened is refused', async () => {
  const f = lessonSetup({ version: 4, lastEditedBy: OWNER });
  const stale = await f.save({ _id: CO, role: 'teacher' }, { title: '新', contentVersion: 3 });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.body.code, 'LESSON_CHANGED');
  assert.match(stale.body.message, /张老师/);
  assert.equal(f.lesson.title, '旧');

  const fresh = await f.save({ _id: CO, role: 'teacher' }, { title: '新', contentVersion: 4, lastEditedBy: OTHER });
  assert.equal(fresh.statusCode, 200);
  assert.equal(f.lesson.contentVersion, 5);
  assert.equal(String(f.lesson.lastEditedBy), CO, 'editor recorded by the server, not the client');

  // 自己连续保存，页面里的版本号没来得及更新也不算冲突
  const again = await f.save({ _id: CO, role: 'teacher' }, { title: '再改', contentVersion: 4 });
  assert.equal(again.statusCode, 200);
  // 不带版本号（如只改标题的旧页面）照常保存
  const noVersion = await f.save({ _id: OTHER, role: 'teacher' }, { title: '标题' });
  assert.equal(noVersion.statusCode, 200);
  assert.equal(f.filters.at(-1).$or, undefined);
});
