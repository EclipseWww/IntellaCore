const test = require('node:test');
const assert = require('node:assert/strict');
const { load, logger, response } = require('../testing/reviewTestSupport');
function fixture({ total = 10, correct = 5, earnedToday = 0 } = {}) {
  const questions = Array.from({ length: total }, (_, i) => ({ _id: 'q' + i, options: [{ _id: 'right', isCorrect: true }] }));
  const session = { _id: 'session', questions: questions.map(q => ({ questionId: q._id })), totalQuestions: 10, pointsPerQuestion: 5, status: 'IN_PROGRESS', save: async () => {} };
  const awards = [];
  const controller = load(require.resolve('./freePracticeController'), {
    '../models/PracticeSession': { findOne: async () => session.status === 'IN_PROGRESS' ? session : null },
    '../models/Question': { find: async () => questions },
    '../models/Setting': {}, '../models/User': {}, '../models/Class': {},
    '../models/Achievement': { findOne: async () => ({ pointTransactions: [{ type: 'free_practice', amount: earnedToday, timestamp: new Date() }] }) },
    '../utils/pointsManager': { addPoints: async (...args) => awards.push(args) },
    '../utils/logger': logger, mongoose: {}
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
    '../models/Setting': {}, '../utils/pointsManager': {}, '../utils/logger': logger, mongoose: {}
  });
  const res = response(); await controller.startPractice({ user: { id: 'student' } }, res);
  assert.equal(res.statusCode, 201); assert.equal(created.totalQuestions, 3);
});
