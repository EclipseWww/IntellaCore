/**
 * 汇总学生在课时中「完成活动」的记录，用于判定一节课有没有真正上过。
 * 每条记录：{ student, lesson, at }。同一提交有首次时间与最近提交时间时各算一条，
 * 这样学生课上提交、课后又修改，课上那次仍能落在时间窗口内。
 */
const AssignmentSubmission = require('../models/AssignmentSubmission');
const QuizSubmission = require('../models/QuizSubmission');
const TypingRecord = require('../models/TypingRecord');
const FlowchartSubmission = require('../models/FlowchartSubmission');
const PythonSubmission = require('../models/PythonSubmission');
const FillBlankSubmission = require('../models/FillBlankSubmission');
const SpreadsheetSubmission = require('../models/SpreadsheetSubmission');
const HtmlProject = require('../models/HtmlProject');

// 会产生提交记录、可以据此判断的活动类型
const TRACKABLE_TYPES = new Set(['quiz', 'typing', 'flowchart', 'spreadsheet', 'html', 'fillblank', 'python']);

const isLessonTrackable = (lesson) =>
  !!lesson && (lesson.activities || []).some(a => TRACKABLE_TYPES.has(a.type) || a.requireSubmission);

const SOURCES = [
  { model: AssignmentSubmission, student: 'student', lesson: 'lesson', times: ['createdAt', 'submittedAt'], extra: { status: { $ne: 'draft' } } },
  { model: QuizSubmission, student: 'studentId', lesson: 'lessonId', times: ['submitTime'], extra: { status: 'SUBMITTED' } },
  { model: TypingRecord, student: 'userId', lesson: 'lessonId', times: ['startTime', 'endTime'], extra: {} },
  { model: FlowchartSubmission, student: 'userId', lesson: 'lessonId', times: ['createdAt', 'submittedAt'], extra: { status: { $ne: 'draft' } } },
  { model: PythonSubmission, student: 'studentId', lesson: 'lessonId', times: ['createdAt', 'submittedAt'], extra: { status: 'submitted' } },
  { model: FillBlankSubmission, student: 'studentId', lesson: 'lessonId', times: ['createdAt', 'submittedAt'], extra: { status: { $ne: 'draft' } } },
  { model: SpreadsheetSubmission, student: 'userId', lesson: 'lessonId', times: ['createdAt', 'submittedAt'], extra: { status: { $ne: 'draft' } } },
  { model: HtmlProject, student: 'creator', lesson: 'linkedAssignment.lesson', times: ['linkedAssignment.submittedAt'], extra: {} }
];

const pick = (doc, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), doc);

/**
 * @param {object} q
 * @param {Array} q.studentIds  本班学生
 * @param {Array} q.lessonIds   限定课时（通常是某课程的全部课时）
 * @param {Date} [q.from]       时间窗口（可选）
 * @param {Date} [q.to]
 */
async function collectCompletions({ studentIds, lessonIds, from, to }) {
  if (!studentIds.length || !lessonIds.length) return [];
  const inWindow = (t) => t && (!from || t >= from) && (!to || t <= to);

  const results = await Promise.all(SOURCES.map(async (src) => {
    const q = { [src.student]: { $in: studentIds }, [src.lesson]: { $in: lessonIds }, ...src.extra };
    if (from || to) {
      const range = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
      q.$or = src.times.map(t => ({ [t]: range }));
    }
    const projection = [src.student, src.lesson, ...src.times].join(' ');
    const docs = await src.model.find(q).select(projection).lean();
    const out = [];
    for (const d of docs) {
      const times = src.times.map(t => pick(d, t)).filter(inWindow);
      if (!times.length) continue;
      out.push({ student: String(pick(d, src.student)), lesson: String(pick(d, src.lesson)), at: times[0] });
    }
    return out;
  }));
  return results.flat();
}

module.exports = { TRACKABLE_TYPES, isLessonTrackable, collectCompletions };
