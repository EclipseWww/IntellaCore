const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const User = require('../models/User');
const secretFields = new Set(['isCorrect', 'correctOption', 'correctAnswer', 'correctAnswers', 'answer', 'explanation']);
function withoutAnswers(value) {
  if (value?.toObject) value = value.toObject();
  if (Array.isArray(value)) return value.map(withoutAnswers);
  if (!value || typeof value !== 'object' || value instanceof Date || value._bsontype) return value;
  if (value instanceof Map) return Object.fromEntries([...value].map(([k,v]) => [k, withoutAnswers(v)]));
  return Object.fromEntries(Object.entries(value).filter(([key]) => !secretFields.has(key)).map(([key, item]) => [key, withoutAnswers(item)]));
}
const fail = (message, status = 403) => { throw Object.assign(new Error(message), { status }); };
async function quizContext(user, quizId, lessonId, activityId, requireActivity = false) {
  if (!!lessonId !== !!activityId) fail('课时和活动必须同时提供', 400);
  if (user.role === 'student' && requireActivity && !activityId) fail('请从课程活动中进入测验', 400);
  const student = user.role === 'student' ? await User.findById(user._id || user.id).select('classId') : null;
  if (student && !student.classId) fail('学生未分配班级');
  let lesson;
  if (lessonId) lesson = await Lesson.findById(lessonId);
  else if (student) {
    const courses = await Course.find({ $or: [{ isPublic: true }, { accessibleClasses: student.classId }] }).select('_id');
    lesson = await Lesson.findOne({ course: { $in: courses.map(c => c._id) }, status: 'published', 'activities.quizSettings.quiz': quizId });
  }
  if (!lesson && user.role === 'student') fail('无权访问此测验');
  if (!lesson) return null;
  const activity = activityId ? lesson.activities.id(activityId) : lesson.activities.find(a => String(a.quizSettings?.quiz) === String(quizId));
  if (!activity || activity.type !== 'quiz' || String(activity.quizSettings?.quiz) !== String(quizId)) fail('测验与课程活动不匹配', 400);
  if (student) {
    if (activity.isPublished === false) fail('此活动未发布');
    const course = await Course.findById(lesson.course);
    if (lesson.status !== 'published' || !course || (!course.isPublic && !course.accessibleClasses.some(id => String(id) === String(student.classId)))) fail('无权访问此测验');
  }
  return activity;
}
function validateAnswers(answers, quiz) {
  if (!Array.isArray(answers)) fail('答案必须是数组', 400);
  const ids = new Set(quiz.questions.filter(q => q.questionId).map(q => String(q.questionId._id)));
  const seen = new Set();
  for (const answer of answers) {
    const id = answer?.questionId;
    if (typeof id !== 'string' || !ids.has(id) || seen.has(id)) fail('答案包含重复或无效的题目', 400);
    seen.add(id);
  }
  if (!ids.size) fail('测验没有可用题目', 400);
}
async function allocateAttemptSlot(query, maxAttempts, existingId = null) {
  const rows = await require('../models/QuizSubmission').find({ ...query, status: { $in: ['IN_PROGRESS', 'SUBMITTED'] } }).select('_id attemptSlot');
  const others = rows.filter(row => String(row._id) !== String(existingId));
  const used = new Set(others.filter(row => row.attemptSlot != null).map(row => row.attemptSlot));
  // Older rows had no slot. Reserve capacity for them without rewriting history.
  for (const row of others.filter(row => row.attemptSlot == null)) {
    let slot = 1; while (used.has(slot)) slot++;
    used.add(slot);
  }
  const current = rows.find(row => String(row._id) === String(existingId));
  if (current?.attemptSlot != null) return current.attemptSlot;
  for (let slot = 1; slot <= maxAttempts; slot++) if (!used.has(slot)) return slot;
  fail('已达到最大答题次数', 400);
}
module.exports = { withoutAnswers, quizContext, validateAnswers, allocateAttemptSlot };
