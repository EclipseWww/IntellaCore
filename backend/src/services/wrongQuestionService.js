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

async function collectEvents(studentId) {
  const [sessions, submissions] = await Promise.all([
    PracticeSession.find({ studentId, status: 'COMPLETED' })
      .select('mode endTime startTime questions').lean(),
    QuizSubmission.find({ studentId, status: 'SUBMITTED' })
      .select('quizId lessonId activityId submitTime answers').lean()
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
        questionId: idOf(q.questionId),
        time: session.endTime || session.startTime,
        isCorrect: q.isCorrect,
        snapshot: q.questionSnapshot,
        selectedIds: getSelectedOptionIds(q),
        sourceTitle: retry ? '错题重练' : '自由练习',
        showAnswers: true
      });
    }
  }
  for (const submission of submissions) {
    const quiz = quizMap.get(String(submission.quizId));
    if (quiz?.isScaleTest) continue;
    const settings = activitySettings(lessonMap, submission.lessonId, submission.activityId);
    if (!settings.showScore) continue;
    for (const answer of submission.answers || []) {
      events.push({
        questionId: idOf(answer.questionId),
        time: submission.submitTime,
        isCorrect: answer.isCorrect,
        snapshot: answer.questionSnapshot,
        selectedIds: getSelectedOptionIds(answer),
        sourceTitle: `测验：${quiz?.title || settings.activityTitle || '课程测验'}`,
        showAnswers: settings.showAnswers
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
  const items = buildWrongBook(await collectEvents(studentId))
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

module.exports = { buildWrongBook, getWrongBook, pickRetryQuestions };
