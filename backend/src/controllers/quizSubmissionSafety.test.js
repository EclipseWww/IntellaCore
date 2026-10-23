const test = require('node:test');
const assert = require('node:assert/strict');
const { load, logger, response } = require('../testing/reviewTestSupport');
const security = require('../services/quizSecurity');
function fixture({ failSave = false } = {}) {
  const quiz = { _id: 'quiz', status: 'PUBLISHED', title: 'Quiz', questions: [{ questionId: { _id: 'question', type: 'SINGLE_CHOICE', options: [{ _id: 'option', isCorrect: true }] } }] };
  let saves = 0, awards = 0;
  const keys = new Set();
  class Submission {
    constructor(data) { Object.assign(this, data); this._id = 'submission'; }
    async save() {
      saves++;
      if (failSave) throw new Error('save failed');
      if (keys.has(this.attemptKey)) throw Object.assign(new Error('duplicate attempt'), { code: 11000 });
      keys.add(this.attemptKey);
    }
    static async create(data) { const submission = new Submission(data); await submission.save(); return submission; }
    static init() {}
    static async countDocuments() { return 0; }
    static findOne() { return { sort() { return this; }, select: async () => null, then: (resolve, reject) => Promise.resolve(null).then(resolve, reject) }; }
    static find() { return { sort: async () => [] }; }
  }
  const controller = load(require.resolve('./quizSubmissionController'), {
    '../services/quizSecurity': { ...security, quizContext: async () => ({}), allocateAttemptSlot: async () => 1 },
    '../services/quizPointsService': { settleQuizPoints: async () => { awards++; } },
    '../models/QuizSubmission': Submission, '../models/Quiz': { findById: () => ({ populate: async () => quiz }) },
    '../models/Question': {}, '../models/User': {}, '../models/Lesson': { findById: async () => null },
    '../utils/logger': logger, '../services/QuizAnalyticsService': {},
    '../services/questionVersionService': { createQuestionSnapshot: question => ({ options: question.options }) }, mongoose: { Types: { ObjectId: class {} } }
  });
  const request = answers => ({ user: { _id: 'student', role: 'student' }, body: { quizId: 'quiz', answers, activityId: 'activity', lessonId: 'lesson', duration: 0 } });
  return { controller, request, saves: () => saves, awards: () => awards };
}
test('duplicate answers are rejected before saving or awarding points', async () => {
  const f = fixture(); const res = response();
  await f.controller.submit(f.request([{ questionId: 'question', selectedOption: 'option' }, { questionId: 'question', selectedOption: 'option' }]), res);
  assert.equal(res.statusCode, 400); assert.equal(f.saves(), 0); assert.equal(f.awards(), 0);
});
test('failed submission save never awards points', async () => {
  const f = fixture({ failSave: true }); const res = response();
  await f.controller.submit(f.request([{ questionId: 'question', selectedOption: 'option' }]), res);
  assert.equal(res.statusCode, 500); assert.equal(f.saves(), 1); assert.equal(f.awards(), 0);
});
test('simultaneous submissions cannot claim the same attempt and answers are sanitized', async () => {
  const f = fixture(); const responses = [response(), response()];
  await Promise.all(responses.map(res => f.controller.submit(f.request([{ questionId: 'question', selectedOption: 'option' }]), res)));
  assert.deepEqual(responses.map(res => res.statusCode).sort(), [201, 409]);
  assert.equal(f.awards(), 1);
  const result = responses.find(res => res.statusCode === 201).body.data;
  assert.equal(result.answers[0].isCorrect, undefined);
  assert.equal(result.answers[0].questionSnapshot.options[0].isCorrect, undefined);
});
test('new attempt identity is uniquely indexed without imposing a new constraint on legacy rows', () => {
  const model = require('../models/QuizSubmission');
  const index = model.schema.indexes().find(([fields]) => fields.attemptKey === 1);
  assert.equal(index[1].unique, true); assert.equal(index[1].sparse, true);
  assert.equal(model.schema.options.optimisticConcurrency, true);
});

 test('simultaneous starts allocate one attempt rather than parallel progress records', async () => {
  const f = fixture(); const responses = [response(), response()];
  await Promise.all(responses.map(res => f.controller.start(f.request([]), res)));
  assert.deepEqual(responses.map(res => res.statusCode).sort(), [201, 409]);
  assert.equal(f.awards(), 0);
 });

test('students cannot use in-progress result statistics to discover answers', async () => {
  const controller = load(require.resolve('./quizSubmissionController'), {
    '../services/quizSecurity': security, '../services/quizPointsService': {},
    '../models/QuizSubmission': { findById: () => ({ populate: async () => ({ _id: 's', studentId: 'student', status: 'IN_PROGRESS' }) }) },
    '../models/Quiz': {}, '../models/Question': {}, '../models/User': {}, '../models/Lesson': {},
    '../utils/logger': logger, '../services/QuizAnalyticsService': {}, '../services/questionVersionService': {}, mongoose: {}
  });
  const res = response();
  await controller.getSubmission({ user: { _id: 'student', role: 'student' }, params: { submissionId: 's' } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.data, undefined);
});
