// Answer flags only arrive in a result payload when the server permits review.
export function getResultQuestions(questions, answers, details = []) {
  return questions.map(question => {
    const id = String(question.originalQuestionId || question.questionId?._id || question._id);
    const answer = answers.find(item => String(item.questionId) === id);
    const snapshot = answer?.questionSnapshot;
    if (snapshot?.options?.some(option => typeof option.isCorrect === 'boolean')) {
      return { ...question, ...snapshot, originalQuestionId: id };
    }
    const detail = details.find(item => String(item.questionId) === id);
    if (!detail?.correctOption) return question;
    return { ...question, options: (question.options || []).map(option => ({ ...option, isCorrect: String(option._id) === String(detail.correctOption) })) };
  });
}
