// 错题本：汇总学生在自由练习、错题重练与课程测验中答错的选择题
//
// 规则
// - 每道题按全部作答记录的时间先后判断：最近一次答对即为“已掌握”，否则为“未掌握”。
// - 测验活动设置为“提交后不显示分数”时，学生本来看不到每题对错，这类记录不计入错题本。
// - 测验活动未开启“提交后显示答案”时，错题本不显示正确答案与解析，也不能拿来重练，
//   避免错题本绕过老师的答案公布设置。
const PracticeSession = require('../models/PracticeSession');
const QuizSubmission = require('../models/QuizSubmission');
const Question = require('../models/Question');
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const { getSelectedOptionIds } = require('../utils/choiceAnswer');

const CHOICE_TYPES = new Set(['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE']);
const toPlain = (value) => (value && value.toObject ? value.toObject() : value);
const idOf = (value) => (value && value._id ? String(value._id) : value ? String(value) : '');

function activitySettings(lessonMap, lessonId, activityId) {
  const defaults = { showAnswers: false, showScore: true, activityTitle: null };
  if (!lessonId || !activityId) return defaults;
  const lesson = lessonMap.get(String(lessonId));
  const activity = lesson?.activities?.find(a => String(a._id) === String(activityId));
  const settings = activity?.quizSettings || {};
  return {
    showAnswers: settings.showAnswerAfterSubmit === true,
    showScore: settings.showScoreAfterSubmit !== false,
    activityTitle: activity?.title || null
  };
}

/**
 * 把作答事件汇总为错题列表（纯函数，便于测试）
 * 事件字段：questionId, time, isCorrect, snapshot, selectedIds, source, sourceTitle, showAnswers
 */
function buildWrongBook(events) {
  const byQuestion = new Map();
  for (const event of events) {
    if (!event.questionId || typeof event.isCorrect !== 'boolean') continue;
    if (!byQuestion.has(event.questionId)) byQuestion.set(event.questionId, []);
    byQuestion.get(event.questionId).push(event);
  }

  const items = [];
  for (const [questionId, list] of byQuestion) {
    list.sort((a, b) => new Date(a.time) - new Date(b.time));
    const wrongs = list.filter(e => !e.isCorrect);
    if (wrongs.length === 0) continue;
    const lastWrong = wrongs[wrongs.length - 1];
    const latest = list[list.length - 1];
    // 任何一次答错来自“不公布答案”的测验，就不显示答案（保守处理）
    const showAnswers = wrongs.every(e => e.showAnswers);
    items.push({
      questionId,
      wrongCount: wrongs.length,
      lastWrongAt: lastWrong.time,
      mastered: latest.isCorrect === true,
      masteredAt: latest.isCorrect ? latest.time : null,
      showAnswers,
      sources: [...new Set(wrongs.map(e => e.sourceTitle).filter(Boolean))],
      lastWrong
    });
  }
  items.sort((a, b) => new Date(b.lastWrongAt) - new Date(a.lastWrongAt));
  return items;
}

function presentItem(item, currentQuestion) {
  const snapshot = toPlain(item.lastWrong.snapshot) || toPlain(currentQuestion) || {};
  const options = (snapshot.options || []).map(opt => {
    const { isCorrect, ...rest } = toPlain(opt);
    return item.showAnswers ? { ...rest, isCorrect: !!isCorrect } : rest;
  });
  return {
    questionId: item.questionId,
    title: snapshot.title,
    content: snapshot.content,
    type: snapshot.type,
    options,
    tags: snapshot.tags || [],
    explanation: item.showAnswers ? (snapshot.explanation || snapshot.analysis || '') : undefined,
    userAnswers: item.lastWrong.selectedIds,
    wrongCount: item.wrongCount,
    lastWrongAt: item.lastWrongAt,
    mastered: item.mastered,
    masteredAt: item.masteredAt,
    showAnswers: item.showAnswers,
    // 已删除或已停用的题目无法重新判分，不能重练
    canRetry: item.showAnswers && !!currentQuestion,
    sources: item.sources
  };
}

// 读取若干学生的作答事件。since：只看该时间之后的记录（教师统计按时间范围筛选）
async function collectEvents(studentIds, { since } = {}) {
  const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
  const practiceQuery = { studentId: { $in: ids }, status: 'COMPLETED' };
  const quizQuery = { studentId: { $in: ids }, status: 'SUBMITTED' };
  if (since) {
    practiceQuery.endTime = { $gte: since };
    quizQuery.submitTime = { $gte: since };
  }
  const [sessions, submissions] = await Promise.all([
    PracticeSession.find(practiceQuery).select('studentId mode endTime startTime questions').lean(),
    QuizSubmission.find(quizQuery).select('studentId quizId lessonId activityId submitTime answers').lean()
  ]);

  const lessonIds = [...new Set(submissions.map(s => s.lessonId).filter(Boolean).map(String))];
  const quizIds = [...new Set(submissions.map(s => String(s.quizId)))];
  const [lessons, quizzes] = await Promise.all([
    lessonIds.length ? Lesson.find({ _id: { $in: lessonIds } }).select('activities._id activities.title activities.quizSettings').lean() : [],
    quizIds.length ? Quiz.find({ _id: { $in: quizIds } }).select('title isScaleTest').lean() : []
  ]);
  const lessonMap = new Map(lessons.map(l => [String(l._id), l]));
  const quizMap = new Map(quizzes.map(q => [String(q._id), q]));

  const events = [];
  for (const session of sessions) {
    const retry = session.mode === 'wrong_retry';
    for (const q of session.questions || []) {
      events.push({
        studentId: String(session.studentId),
        questionId: idOf(q.questionId),
        time: session.endTime || session.startTime,
        isCorrect: q.isCorrect,
        snapshot: q.questionSnapshot,
        selectedIds: getSelectedOptionIds(q),
        source: retry ? 'retry' : 'practice',
        sourceTitle: retry ? '错题重练' : '自由练习',
        showAnswers: true,
        showScore: true
      });
    }
  }
  for (const submission of submissions) {
    const quiz = quizMap.get(String(submission.quizId));
    if (quiz?.isScaleTest) continue;
    const settings = activitySettings(lessonMap, submission.lessonId, submission.activityId);
    for (const answer of submission.answers || []) {
      events.push({
        studentId: String(submission.studentId),
        questionId: idOf(answer.questionId),
        time: submission.submitTime,
        isCorrect: answer.isCorrect,
        snapshot: answer.questionSnapshot,
        selectedIds: getSelectedOptionIds(answer),
        source: 'quiz',
        sourceTitle: `测验：${quiz?.title || settings.activityTitle || '课程测验'}`,
        showAnswers: settings.showAnswers,
        showScore: settings.showScore
      });
    }
  }
  return events;
}

async function loadCurrentQuestions(ids) {
  if (!ids.length) return new Map();
  const questions = await Question.find({
    _id: { $in: ids }, deletedAt: null, isArchived: { $ne: true }, type: { $in: [...CHOICE_TYPES] }
  }).lean();
  return new Map(questions.map(q => [String(q._id), q]));
}

async function getWrongBook(studentId) {
  // 学生看不到每题对错的测验（不显示分数）不计入错题本
  const events = (await collectEvents(studentId)).filter(e => e.showScore);
  const items = buildWrongBook(events)
    .filter(item => {
      const type = toPlain(item.lastWrong.snapshot)?.type;
      return !type || CHOICE_TYPES.has(type);
    });
  const current = await loadCurrentQuestions(items.map(i => i.questionId));
  return items
    .map(item => presentItem(item, current.get(item.questionId)))
    .filter(item => item.content);
}

/** 选出可重练的未掌握错题（最近答错的优先），返回当前版本的题目文档 */
async function pickRetryQuestions(studentId, limit) {
  const book = await getWrongBook(studentId);
  const ids = book.filter(i => !i.mastered && i.canRetry).slice(0, limit).map(i => i.questionId);
  const current = await loadCurrentQuestions(ids);
  return ids.map(id => current.get(id)).filter(Boolean);
}

/** 学生未掌握错题中出现最多的知识点标签（自由练习按此加强抽题），最多 limit 个 */
async function getWeakTags(studentId, limit = 5) {
  const book = await getWrongBook(studentId);
  const counts = new Map();
  for (const item of book) {
    if (item.mastered) continue;
    for (const tag of item.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => tag);
}

/**
 * 班级高频错题统计（纯函数，便于测试）
 * - 错误率只统计自由练习与测验（错题重练只出错题，会让错误率失真）；source 可限定 'quiz' / 'practice'
 * - “仍未掌握”按每个学生最近一次作答判断，包括错题重练
 */
function buildClassStats(events, { source = 'all' } = {}) {
  const byQuestion = new Map();
  const sorted = [...events].sort((a, b) => new Date(a.time) - new Date(b.time));
  for (const e of sorted) {
    if (!e.questionId || typeof e.isCorrect !== 'boolean') continue;
    if (!byQuestion.has(e.questionId)) {
      byQuestion.set(e.questionId, { attempts: 0, wrong: 0, students: new Set(), wrongStudents: new Set(), latest: new Map(), optionCounts: new Map(), unanswered: 0, sources: new Set(), snapshot: null });
    }
    const q = byQuestion.get(e.questionId);
    q.latest.set(e.studentId, e.isCorrect);
    if (e.snapshot) q.snapshot = e.snapshot;
    const counted = e.source !== 'retry' && (source === 'all' || e.source === source);
    if (!counted) continue;
    q.attempts++;
    q.students.add(e.studentId);
    if (!e.isCorrect) {
      q.wrong++;
      q.wrongStudents.add(e.studentId);
      if (e.sourceTitle) q.sources.add(e.sourceTitle);
      if (!e.selectedIds || e.selectedIds.length === 0) q.unanswered++;
      for (const id of e.selectedIds || []) q.optionCounts.set(String(id), (q.optionCounts.get(String(id)) || 0) + 1);
    }
  }
  const items = [];
  for (const [questionId, q] of byQuestion) {
    if (q.wrong === 0) continue;
    const snapshot = toPlain(q.snapshot) || {};
    const options = (snapshot.options || []).map(toPlain);
    const correctIds = new Set(options.filter(o => o.isCorrect).map(o => String(o._id)));
    items.push({
      questionId,
      title: snapshot.title,
      content: snapshot.content,
      type: snapshot.type,
      tags: snapshot.tags || [],
      explanation: snapshot.explanation || '',
      options: options.map(o => ({ _id: String(o._id), content: o.content, isCorrect: !!o.isCorrect, wrongCount: q.optionCounts.get(String(o._id)) || 0 })),
      // 学生选中的错误选项，按人次从多到少
      wrongOptions: [...q.optionCounts.entries()]
        .filter(([id]) => !correctIds.has(id))
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({ optionId: id, content: options.find(o => String(o._id) === id)?.content || '（已删除的选项）', count })),
      attempts: q.attempts,
      wrongAttempts: q.wrong,
      errorRate: q.attempts ? Math.round((q.wrong / q.attempts) * 1000) / 10 : 0,
      studentCount: q.students.size,
      wrongStudentCount: q.wrongStudents.size,
      unansweredCount: q.unanswered,
      unmasteredStudentIds: [...q.latest.entries()].filter(([sid, ok]) => !ok && q.wrongStudents.has(sid)).map(([sid]) => sid),
      sources: [...q.sources]
    });
  }
  items.sort((a, b) => b.errorRate - a.errorRate || b.wrongStudentCount - a.wrongStudentCount);
  return items;
}

async function getClassWrongStats(studentIds, { since, source } = {}) {
  if (!studentIds.length) return [];
  const items = buildClassStats(await collectEvents(studentIds, { since }), { source });
  return items.filter(item => item.content && (!item.type || CHOICE_TYPES.has(item.type)));
}

module.exports = { buildWrongBook, buildClassStats, getWrongBook, getWeakTags, getClassWrongStats, pickRetryQuestions };
