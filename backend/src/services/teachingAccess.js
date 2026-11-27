/**
 * 教师对班级、课程的访问权限（支持多位教师共同执教）。
 *
 * 班级：
 * - teacher 是负责教师（创建者）：可以修改班级名称、归档、删除，并管理共同执教的教师。
 * - coTeachers 是共同执教的教师（只有教学班——社团、选修课——可以设置）：
 *   与负责教师一样可以上课、排课、管理成员与座位、批阅、审批登录等日常教学操作。
 *
 * 课程：
 * - instructor 是创建者：可以删除课程，并管理协作教师。
 * - coInstructors 是协作教师：可以和创建者一样编辑课程、单元、课时与测验，查看并批阅提交。
 */
const mongoose = require('mongoose');

const idOf = v => (v && typeof v === 'object' && v._id ? v._id : v);
const sameId = (a, b) => a != null && b != null && String(idOf(a)) === String(idOf(b));
const userIdOf = user => (user ? (user._id || user.id) : null);
const asObjectId = id => (mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(String(idOf(id))) : id);

/** 查询“这位教师任教的班级”（负责或共同执教） */
function classTeacherFilter(teacherId) {
  const id = asObjectId(idOf(teacherId));
  return { $or: [{ teacher: id }, { coTeachers: id }] };
}

/** 在已有条件上加上“这位教师任教”的限制（admin 不限制） */
function withClassAccess(user, query = {}) {
  if (user && user.role === 'admin') return query;
  return { $and: [query, classTeacherFilter(userIdOf(user))] };
}

/** 是否为该班级的负责教师 */
function isClassOwner(user, cls) {
  return !!cls && sameId(cls.teacher, userIdOf(user));
}

/** 是否任教该班级（负责或共同执教；admin 视为可以） */
function canTeachClass(user, cls) {
  if (!user || !cls) return false;
  if (user.role === 'admin') return true;
  const uid = userIdOf(user);
  return sameId(cls.teacher, uid) || (cls.coTeachers || []).some(t => sameId(t, uid));
}

/** 这位教师任教的全部班级 ID */
async function taughtClassIds(teacherId, extra = {}) {
  const Class = require('../models/Class');
  return Class.find({ ...extra, ...classTeacherFilter(teacherId) }).distinct('_id');
}

/** 查询“这位教师可以维护的课程”（创建或协作） */
function courseTeacherFilter(teacherId) {
  const id = asObjectId(idOf(teacherId));
  return { $or: [{ instructor: id }, { coInstructors: id }] };
}

/** 是否为课程创建者 */
function isCourseOwner(user, course) {
  return !!course && sameId(course.instructor, userIdOf(user));
}

/** 是否可以维护课程（创建者、协作教师或 admin） */
function canMaintainCourse(user, course) {
  if (!user || !course) return false;
  if (user.role === 'admin') return true;
  const uid = userIdOf(user);
  return sameId(course.instructor, uid) || (course.coInstructors || []).some(t => sameId(t, uid));
}

/** 按课程 ID 判断能否维护 */
async function canMaintainCourseId(user, courseId) {
  if (!user || !courseId || !mongoose.isValidObjectId(String(idOf(courseId)))) return false;
  if (user.role === 'admin') return true;
  const Course = require('../models/Course');
  return !!await Course.exists({ _id: idOf(courseId), ...courseTeacherFilter(userIdOf(user)) });
}

/** 这位教师可以维护的课程里用到的测验 ID */
async function sharedQuizIds(user) {
  const Course = require('../models/Course');
  const Lesson = require('../models/Lesson');
  const courseIds = await Course.find(courseTeacherFilter(userIdOf(user))).distinct('_id');
  if (!courseIds.length) return [];
  return Lesson.find({ course: { $in: courseIds } }).distinct('activities.quizSettings.quiz');
}

/** 是否可以修改测验：创建者、管理员，或测验用在自己创建/协作的课程里 */
async function canEditQuiz(user, quiz) {
  if (!user || !quiz) return false;
  if (user.role === 'admin' || sameId(quiz.createdBy, userIdOf(user))) return true;
  if (user.role !== 'teacher') return false;
  const Course = require('../models/Course');
  const Lesson = require('../models/Lesson');
  const courseIds = await Course.find(courseTeacherFilter(userIdOf(user))).distinct('_id');
  return !!courseIds.length && !!await Lesson.exists({ course: { $in: courseIds }, 'activities.quizSettings.quiz': idOf(quiz) });
}

/**
 * 保存课程的可访问班级时，保留编辑者看不到（不任教）的班级：
 * 多位教师共同维护课程时，一位教师保存不会把其他教师班级的访问权去掉。
 */
async function mergeAccessibleClasses(user, existing, submitted, taught) {
  const next = (Array.isArray(submitted) ? submitted : []).filter(id => mongoose.isValidObjectId(String(idOf(id)))).map(id => String(idOf(id)));
  if (user && user.role === 'admin') return [...new Set(next)];
  const mine = new Set((taught || await taughtClassIds(userIdOf(user))).map(String));
  const kept = (existing || []).map(id => String(idOf(id))).filter(id => !mine.has(id));
  const added = next.filter(id => mine.has(id));
  return [...new Set([...kept, ...added])];
}

/** 清理教师 ID 列表：去重、去掉无效值和指定的 ID（如负责教师自己） */
function cleanTeacherIds(list, exclude) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const id = String(idOf(raw) || '');
    if (!mongoose.isValidObjectId(id) || seen.has(id) || (exclude && sameId(id, exclude))) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

module.exports = {
  sameId,
  userIdOf,
  classTeacherFilter,
  withClassAccess,
  isClassOwner,
  canTeachClass,
  taughtClassIds,
  courseTeacherFilter,
  isCourseOwner,
  canMaintainCourse,
  canMaintainCourseId,
  mergeAccessibleClasses,
  sharedQuizIds,
  canEditQuiz,
  cleanTeacherIds
};
