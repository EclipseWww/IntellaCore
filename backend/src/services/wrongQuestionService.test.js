const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWrongBook } = require('./wrongQuestionService');

const ev = (questionId, time, isCorrect, extra = {}) => ({
  questionId, time: new Date(time), isCorrect, snapshot: { content: questionId }, selectedIds: [], sourceTitle: '自由练习', showAnswers: true, ...extra
});

test('a question only enters the book after a wrong answer', () => {
  const book = buildWrongBook([ev('a', '2026-01-01', true), ev('b', '2026-01-01', false)]);
  assert.deepEqual(book.map(i => i.questionId), ['b']);
});
test('latest correct answer marks the question mastered; a later mistake reopens it', () => {
  const mastered = buildWrongBook([ev('a', '2026-01-01', false), ev('a', '2026-01-02', true)])[0];
  assert.equal(mastered.mastered, true);
  const reopened = buildWrongBook([ev('a', '2026-01-01', false), ev('a', '2026-01-02', true), ev('a', '2026-01-03', false)])[0];
  assert.equal(reopened.mastered, false);
  assert.equal(reopened.wrongCount, 2);
});
test('answers stay hidden if any mistake came from a quiz that hides answers', () => {
  const item = buildWrongBook([ev('a', '2026-01-01', false), ev('a', '2026-01-02', false, { showAnswers: false, sourceTitle: '测验：期中' })])[0];
  assert.equal(item.showAnswers, false);
  assert.deepEqual(item.sources, ['自由练习', '测验：期中']);
});
test('events without a definite result are ignored and the newest mistakes come first', () => {
  const book = buildWrongBook([ev('a', '2026-01-01', false), ev('b', '2026-01-05', false), ev('c', '2026-01-09', undefined)]);
  assert.deepEqual(book.map(i => i.questionId), ['b', 'a']);
});

const { buildClassStats } = require('./wrongQuestionService');
const snap = { content: 'Q', type: 'SINGLE_CHOICE', options: [{ _id: 'ok', content: '对', isCorrect: true }, { _id: 'x', content: '错1' }, { _id: 'y', content: '错2' }] };
const cev = (studentId, time, isCorrect, selectedIds, extra = {}) => ({
  studentId, questionId: 'q1', time: new Date(time), isCorrect, selectedIds, snapshot: snap, source: 'quiz', sourceTitle: '测验：期中', ...extra
});

test('class stats count error rate, wrong students and the most chosen wrong option', () => {
  const [item] = buildClassStats([
    cev('s1', '2026-01-01', false, ['x']), cev('s2', '2026-01-01', false, ['x']),
    cev('s3', '2026-01-01', false, ['y']), cev('s4', '2026-01-01', true, ['ok'])
  ]);
  assert.equal(item.errorRate, 75);
  assert.equal(item.wrongStudentCount, 3);
  assert.deepEqual(item.wrongOptions.map(o => [o.content, o.count]), [['错1', 2], ['错2', 1]]);
  assert.deepEqual(item.unmasteredStudentIds.sort(), ['s1', 's2', 's3']);
});
test('retries do not affect the error rate but do clear the unmastered list', () => {
  const [item] = buildClassStats([
    cev('s1', '2026-01-01', false, ['x']), cev('s2', '2026-01-01', true, ['ok']),
    cev('s1', '2026-01-03', true, ['ok'], { source: 'retry', sourceTitle: '错题重练' })
  ]);
  assert.equal(item.attempts, 2);
  assert.equal(item.errorRate, 50);
  assert.deepEqual(item.unmasteredStudentIds, []);
});
test('source filter limits the statistics to quizzes or free practice', () => {
  const events = [cev('s1', '2026-01-01', false, ['x']), cev('s2', '2026-01-01', false, ['x'], { source: 'practice' })];
  assert.equal(buildClassStats(events, { source: 'practice' })[0].attempts, 1);
  assert.equal(buildClassStats(events)[0].attempts, 2);
  assert.equal(buildClassStats([cev('s1', '2026-01-01', true, ['ok'])]).length, 0);
});
