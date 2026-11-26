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
