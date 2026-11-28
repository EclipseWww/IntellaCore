/**
 * 修改课程内容（单元、课时、活动、课时资源与媒体）前检查：只有课程创建者、协作教师或管理员可以修改。
 *
 * 课程按网址中最具体的编号确定：课时 > 单元 > 课程。网址里同时带了几个编号时必须彼此一致，
 * 防止用自己课程的编号搭配别人课时的编号绕过检查（或把文件写进别人课程的目录）。
 */
const mongoose = require('mongoose');
const access = require('../services/teachingAccess');

const valid = id => typeof id === 'string' && mongoose.isValidObjectId(id);

async function resolveCourseId(params, models) {
  const { Lesson, CourseUnit } = models;
  const { courseId, unitId, lessonId } = params;
  for (const id of [courseId, unitId, lessonId]) {
    if (id !== undefined && !valid(id)) return { status: 400, message: '编号无效' };
  }
  let course = courseId || null;
  if (unitId) {
    const unit = await CourseUnit.findById(unitId).select('course').lean();
    if (!unit) return { status: 404, message: '单元不存在' };
    if (course && String(unit.course) !== String(course)) return { status: 400, message: '单元不属于该课程' };
    course = unit.course;
  }
  if (lessonId) {
    const lesson = await Lesson.findById(lessonId).select('course unit').lean();
    if (!lesson) return { status: 404, message: '课时不存在' };
    if (course && String(lesson.course) !== String(course)) return { status: 400, message: '课时不属于该课程或单元' };
    if (unitId && lesson.unit && String(lesson.unit) !== String(unitId)) return { status: 400, message: '课时不属于该单元' };
    course = lesson.course;
  }
  if (!course) return { status: 400, message: '缺少课程信息' };
  return { courseId: course };
}

function courseMaintainer(models = {
  get Lesson() { return require('../models/Lesson'); },
  get CourseUnit() { return require('../models/CourseUnit'); }
}, check = access.canMaintainCourseId) {
  return async function requireCourseMaintainer(req, res, next) {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: '请先登录' });
      if (!['teacher', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: '只有教师或管理员可以修改课程内容' });
      }
      const resolved = await resolveCourseId(req.params || {}, models);
      if (!resolved.courseId) return res.status(resolved.status).json({ success: false, message: resolved.message });
      if (!await check(req.user, resolved.courseId)) {
        return res.status(403).json({ success: false, message: '只有课程创建者和协作教师可以修改此课程' });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

const requireCourseMaintainer = courseMaintainer();
module.exports = requireCourseMaintainer;
module.exports.courseMaintainer = courseMaintainer;
module.exports.resolveCourseId = resolveCourseId;
