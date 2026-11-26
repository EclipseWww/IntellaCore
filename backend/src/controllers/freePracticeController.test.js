const test = require('node:test');
const assert = require('node:assert/strict');
const { load, logger, response } = require('../testing/reviewTestSupport');
function fixture({ total = 10, correct = 5, earnedToday = 0, mode } = {}) {
  const questions = Array.from({ length: total }, (_, i) => ({ _id: 'q' + i, options: [{ _id: 'right', isCorrect: true }] }));
  const session = { _id: 'session', questions: questions.map(q => ({ questionId: q._id })), totalQuestions: 10, pointsPerQuestion: 5, status: 'IN_PROGRESS', mode, save: async () => {} };
  const awards = [];
  const controller = load(require.resolve('./freePracticeController'), {
    '../models/PracticeSession': { findOne: async () => session.status === 'IN_PROGRESS' ? session : null },
    '../models/Question': { find: async () => questions },
    '../models/Setting': {}, '../models/User': {}, '../models/Class': {},
    '../models/Achievement': { findOne: async () => ({ pointTransactions: [{ type: 'free_practice', amount: earnedToday, timestamp: new Date() }] }) },
    '../utils/pointsManager': { addPoints: async (...args) => awards.push(args) },
    '../utils/logger': logger, '../utils/choiceAnswer': require('../utils/choiceAnswer'), mongoose: {}, '../services/wrongQuestionService': {}
  });
  const answers = Object.fromEntries(questions.slice(0, correct).map(q => [q._id, 'right']));
  return { controller, session, awards, req: { user: { id: 'student' }, body: { sessionId: 'session', answers } } };
}
for (const [correct, expected] of [[0, 0], [5, 0], [6, 30], [10, 50]]) {
  test(correct + '/10 correct earns ' + expected + ' points', async () => {
    const f = fixture({ correct }); const res = response();
    await f.controller.submitPractice(f.req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.pointsEarned, expected);
    assert.equal(f.session.pointsEarned, expected);
    assert.equal(f.session.status, 'COMPLETED');
    assert.equal(f.awards.length, expected > 0 ? 1 : 0);
    assert.equal(res.body.data.rewardEligible, correct >= 6);
    if (!expected) assert.match(res.body.data.rewardMessage, /60%/);
  });
}
test('uses the actual question count even for legacy sessions with the default count', async () => {
  const f = fixture({ total: 5, correct: 3 }); const res = response();
  await f.controller.submitPractice(f.req, res);
  assert.equal(res.body.data.totalQuestions, 5);
  assert.equal(f.session.totalQuestions, 5);
  assert.equal(res.body.data.pointsEarned, 15);
});
test('59.6% does not become eligible by rounding to 60%', async () => {
  const f = fixture({ total: 250, correct: 149 }); const res = response();
  await f.controller.submitPractice(f.req, res);
  assert.equal(res.body.data.pointsEarned, 0);
  assert.equal(f.awards.length, 0);
});
test('passing practice retains the existing daily points cap', async () => {
  const f = fixture({ correct: 6, earnedToday: 490 }); const res = response();
  await f.controller.submitPractice(f.req, res);
  assert.equal(res.body.data.pointsEarned, 10);
  assert.equal(f.awards[0][1], 10);
  assert.match(res.body.data.limitMessage, /500/);
});
test('retrying a completed session does not award again; a new passing session can earn points', async () => {
  const first = fixture({ correct: 5 });
  await first.controller.submitPractice(first.req, response());
  const retry = response(); await first.controller.submitPractice(first.req, retry);
  assert.equal(retry.statusCode, 404); assert.equal(first.awards.length, 0);
  const second = fixture({ correct: 6 });
  await second.controller.submitPractice(second.req, response());
  await second.controller.submitPractice(second.req, response());
  assert.equal(second.awards.length, 1); assert.equal(second.awards[0][1], 30);
});
test('starting practice stores the number actually drawn from the question bank', async () => {
  let created;
  const questions = Array.from({ length: 3 }, (_, i) => ({ _id: 'q' + i, options: [] }));
  const controller = load(require.resolve('./freePracticeController'), {
    '../models/PracticeSession': { create: async data => { created = data; return { _id: 'session', ...data }; } },
    '../models/Question': { aggregate: async () => questions },
    '../models/User': { findById: () => ({ select: async () => ({ classId: 'class' }) }) },
    '../models/Class': { findById: () => ({ select: async () => ({}) }) },
    '../models/Setting': {}, '../utils/pointsManager': {}, '../utils/logger': logger, '../utils/choiceAnswer': require('../utils/choiceAnswer'), mongoose: {}, '../services/wrongQuestionService': {}
  });
  const res = response(); await controller.startPractice({ user: { id: 'student' } }, res);
  assert.equal(res.statusCode, 201); assert.equal(created.totalQuestions, 3);
});
test('wrong-question retry never awards points even when every answer is right', async () => {
  const f = fixture({ correct: 10, mode: 'wrong_retry' }); const res = response();
  await f.controller.submitPractice(f.req, res);
  assert.equal(res.body.data.pointsEarned, 0);
  assert.equal(f.awards.length, 0);
  assert.equal(res.body.data.mode, 'wrong_retry');
  assert.match(res.body.data.rewardMessage, /不计积分/);
});
function retryController({ picked = [], classSettings = {} } = {}) {
  let created;
  const controller = load(require.resolve('./freePracticeController'), {
    '../models/PracticeSession': { create: async data => { created = data; return { _id: 'session', ...data }; } },
    '../models/Question': {}, '../models/Setting': {}, '../utils/pointsManager': {},
    '../models/User': { findById: () => ({ select: async () => ({ classId: 'class' }) }) },
    '../models/Class': { findById: () => ({ select: async () => ({ freePracticeSettings: classSettings }) }) },
    '../utils/logger': logger, '../utils/choiceAnswer': require('../utils/choiceAnswer'), mongoose: {},
    '../services/wrongQuestionService': { pickRetryQuestions: async () => picked }
  });
  return { controller, created: () => created };
}
test('wrong-question retry creates a no-points session and hides answers', async () => {
  const picked = [{ _id: 'q1', type: 'SINGLE_CHOICE', content: 'c', options: [{ _id: 'a', content: 'A', isCorrect: true }] }];
  const r = retryController({ picked }); const res = response();
  await r.controller.startWrongRetry({ user: { id: 'student' } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(r.created().mode, 'wrong_retry');
  assert.equal(r.created().pointsPerQuestion, 0);
  assert.equal(res.body.data.questions[0].options[0].isCorrect, undefined);
});
test('wrong-question retry follows the class free-practice switch and reports an empty book', async () => {
  const off = retryController({ picked: [{ _id: 'q1', options: [] }], classSettings: { isEnabled: false } }); const r1 = response();
  await off.controller.startWrongRetry({ user: { id: 'student' } }, r1);
  assert.equal(r1.statusCode, 403);
  const empty = retryController(); const r2 = response();
  await empty.controller.startWrongRetry({ user: { id: 'student' } }, r2);
  assert.equal(r2.statusCode, 404);
});
test('free practice draws about half of the questions from the student weak tags', async () => {
  const matches = [];
  const pool = n => Array.from({ length: n }, (_, i) => ({ _id: 'q' + matches.length + '-' + i, options: [] }));
  let created;
  const controller = load(require.resolve('./freePracticeController'), {
    '../models/PracticeSession': { create: async data => { created = data; return { _id: 'session', ...data }; } },
    '../models/Question': { aggregate: async pipeline => { matches.push(pipeline); return pool(pipeline[1].$sample.size); } },
    '../models/User': { findById: () => ({ select: async () => ({ classId: 'class' }) }) },
    '../models/Class': { findById: () => ({ select: async () => ({ freePracticeSettings: { questionCount: 10, allowedTags: ['循环', '变量'] } }) }) },
    '../models/Setting': {}, '../utils/pointsManager': {}, '../utils/logger': logger, '../utils/choiceAnswer': require('../utils/choiceAnswer'), mongoose: {},
    '../services/wrongQuestionService': { getWeakTags: async () => ['循环', '列表'] }
  });
  const res = response(); await controller.startPractice({ user: { id: 'student' } }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(JSON.parse(JSON.stringify(res.body.data.focusTags)), ['循环']); // “列表”不在老师允许的标签内
  assert.deepEqual(JSON.parse(JSON.stringify(matches[0][0].$match.tags)), { $in: ['循环'] });
  assert.equal(matches[0][1].$sample.size, 5);
  assert.equal(matches[1][1].$sample.size, 5);
  assert.equal(created.totalQuestions, 10);
});
test('class wrong-question stats are limited to the teacher own class', async () => {
  const controller = load(require.resolve('./freePracticeController'), {
    '../models/PracticeSession': {}, '../models/Question': {}, '../models/Setting': {}, '../utils/pointsManager': {},
    '../models/Class': { findOne: query => ({ select: async () => (query.teacher === 'owner' || !query.teacher ? { _id: query._id } : null) }) },
    '../models/User': {},
    '../services/classRoster': { findRoster: async () => [{ _id: 's1', name: '张三' }] },
    '../utils/logger': logger, '../utils/choiceAnswer': require('../utils/choiceAnswer'), mongoose: require('mongoose'),
    '../services/wrongQuestionService': { getClassWrongStats: async () => [{ questionId: 'q1', unmasteredStudentIds: ['s1'] }] }
  });
  const classId = '507f1f77bcf86cd799439011';
  const other = response(); await controller.getClassWrongQuestions({ params: { classId }, query: {}, user: { id: 'someone', role: 'teacher' } }, other);
  assert.equal(other.statusCode, 404);
  const own = response(); await controller.getClassWrongQuestions({ params: { classId }, query: { days: '7' }, user: { id: 'owner', role: 'teacher' } }, own);
  assert.equal(own.statusCode, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(own.body.data.list[0].unmasteredStudents)), ['张三']);
});
