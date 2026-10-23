import { getResultQuestions } from './resultQuestions';
test('question payload stays answer-free until an authorized result supplies a snapshot', () => {
  const questions = [{ originalQuestionId: 'q', options: [{ _id: 'a', content: 'A' }, { _id: 'b', content: 'B' }] }];
  const hidden = [{ questionId: 'q', questionSnapshot: { options: [{ _id: 'a', content: 'A' }] } }];
  expect(getResultQuestions(questions, hidden)[0]).toBe(questions[0]);
  const visible = [{ questionId: 'q', questionSnapshot: { options: [{ _id: 'a', content: 'A', isCorrect: true }] } }];
  expect(getResultQuestions(questions, visible)[0].options[0].isCorrect).toBe(true);
  expect(questions[0].options[0].isCorrect).toBeUndefined();
});
test('legacy results use only the correct option provided by the server', () => {
  const questions = [{ originalQuestionId: 'q', options: [{ _id: 'a' }, { _id: 'b' }] }];
  const result = getResultQuestions(questions, [], [{ questionId: 'q', correctOption: 'b' }]);
  expect(result[0].options.map(option => option.isCorrect)).toEqual([false, true]);
});
