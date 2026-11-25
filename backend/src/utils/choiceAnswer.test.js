const test = require('node:test');
const assert = require('node:assert/strict');
const { gradeChoiceAnswer, getSelectedOptionIds } = require('./choiceAnswer');

const multi = {
  type: 'MULTIPLE_CHOICE',
  options: [
    { _id: 'a', isCorrect: true },
    { _id: 'b', isCorrect: false },
    { _id: 'c', isCorrect: true }
  ]
};

test('multiple choice keeps every selected option and needs the exact correct set', () => {
  assert.deepEqual(gradeChoiceAnswer(multi, ['c', 'a']), { selectedOption: 'c', selectedOptions: ['c', 'a'], isCorrect: true });
  assert.equal(gradeChoiceAnswer(multi, ['a']).isCorrect, false);
  assert.equal(gradeChoiceAnswer(multi, ['a', 'b', 'c']).isCorrect, false);
  assert.deepEqual(gradeChoiceAnswer(multi, ['a', 'a', 'x', 'c']).selectedOptions, ['a', 'c']);
  assert.equal(gradeChoiceAnswer(multi, []), null);
  assert.equal(gradeChoiceAnswer(multi, ['x']), null);
});

test('single choice and true/false grade one option', () => {
  const single = { type: 'TRUE_FALSE', options: [{ _id: 't', isCorrect: false }, { _id: 'f', isCorrect: true }] };
  assert.deepEqual(gradeChoiceAnswer(single, 'f'), { selectedOption: 'f', selectedOptions: undefined, isCorrect: true });
  assert.equal(gradeChoiceAnswer(single, ['t']).isCorrect, false);
  assert.equal(gradeChoiceAnswer(single, undefined), null);
});

test('reading saved answers falls back to the legacy single option', () => {
  assert.deepEqual(getSelectedOptionIds({ selectedOptions: ['a', 'c'], selectedOption: 'a' }), ['a', 'c']);
  assert.deepEqual(getSelectedOptionIds({ selectedOptions: [], selectedOption: 'b' }), ['b']);
  assert.deepEqual(getSelectedOptionIds({}), []);
});
