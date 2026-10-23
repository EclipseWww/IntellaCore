const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../testing/reviewTestSupport');
function fixture() {
  const activity = { _id: 'activity', type: 'quiz', quizSettings: { quiz: 'quiz' } };
  const activities = [activity]; activities.id = id => id === 'activity' ? activity : null;
  const lesson = { activities, course: 'course', status: 'published' };
  const course = { accessibleClasses: ['class'] };
  const service = load(require.resolve('./quizSecurity'), {
    '../models/Lesson': { findById: async id => id === 'lesson' ? lesson : null, findOne: async () => lesson },
    '../models/Course': { find: () => ({ select: async () => [{ _id: 'course' }] }), findById: async () => course },
    '../models/User': { findById: () => ({ select: async () => ({ classId: 'class' }) }) }
  });
  return { ...service, lesson, course, activity };
}
test('strips answers from populated quizzes and historical snapshots without changing stored data', () => {
  const { withoutAnswers } = fixture();
  const input = { questions: [{ questionId: { options: [{ _id: 'option', text: 'A', isCorrect: true }], explanation: 'secret' } }], answers: [{ selectedOption: 'option', isCorrect: true, questionSnapshot: { options: [{ isCorrect: true }], explanation: 'secret' } }] };
  const output = JSON.parse(JSON.stringify(withoutAnswers(input)));
  assert.equal(output.questions[0].questionId.options[0].text, 'A');
  assert.equal(output.questions[0].questionId.options[0].isCorrect, undefined);
  assert.equal(output.answers[0].questionSnapshot.options[0].isCorrect, undefined);
  assert.equal(output.answers[0].questionSnapshot.explanation, undefined);
  assert.equal(input.questions[0].questionId.options[0].isCorrect, true);
});
test('rejects duplicate, unknown, null and malformed answers', () => {
  const { validateAnswers } = fixture(); const quiz = { questions: [{ questionId: { _id: 'q' } }] };
  for (const answers of [null, {}, [null], [{ questionId: 'unknown' }], [{ questionId: 'q' }, { questionId: 'q' }]]) assert.throws(() => validateAnswers(answers, quiz), { status: 400 });
  assert.doesNotThrow(() => validateAnswers([{ questionId: 'q' }], quiz));
});
test('requires a real matching activity and a published course accessible to the student', async () => {
  const f = fixture(); const student = { role: 'student', _id: 'student' };
  await assert.rejects(f.quizContext(student, 'quiz', null, 'activity', true), { status: 400 });
  await assert.rejects(f.quizContext(student, 'quiz', null, null, true), { status: 400 });
  await assert.rejects(f.quizContext(student, 'quiz', 'lesson', 'fake', true), { status: 400 });
  await assert.rejects(f.quizContext(student, 'different', 'lesson', 'activity', true), { status: 400 });
  assert.equal((await f.quizContext(student, 'quiz', 'lesson', 'activity', true))._id, 'activity');
  f.course.accessibleClasses = ['other'];
  await assert.rejects(f.quizContext(student, 'quiz', 'lesson', 'activity', true), { status: 403 });
  f.course.isPublic = true; f.lesson.status = 'draft';
  await assert.rejects(f.quizContext(student, 'quiz', 'lesson', 'activity', true), { status: 403 });
});

test('resolves student quiz access before checking activity publication', async () => {
  const f = fixture();
  const student = { role: 'student', _id: 'student' };
  assert.equal(await f.quizContext(student, 'quiz'), f.activity);
  f.activity.isPublished = false;
  await assert.rejects(f.quizContext(student, 'quiz'), { status: 403, message: '此活动未发布' });
  await assert.rejects(f.quizContext(student, 'quiz', 'lesson', 'activity'), { status: 403, message: '此活动未发布' });
});

test('a stale count cannot allocate a slot beyond the maximum after another submit commits', async () => {
  const rows = [{ _id: 'committed', attemptSlot: 1 }];
  const service = load(require.resolve('./quizSecurity'), {
    '../models/Lesson': {}, '../models/Course': {}, '../models/User': {},
    '../models/QuizSubmission': { find: () => ({ select: async () => rows }) }
  });
  await assert.rejects(service.allocateAttemptSlot({ quizId: 'quiz' }, 1), { status: 400 });
  assert.equal(await service.allocateAttemptSlot({ quizId: 'quiz' }, 2), 2);
  assert.equal(await service.allocateAttemptSlot({ quizId: 'quiz' }, 1, 'committed'), 1);
  rows[0] = { _id: 'legacy' };
  await assert.rejects(service.allocateAttemptSlot({ quizId: 'quiz' }, 1), { status: 400 });
});
