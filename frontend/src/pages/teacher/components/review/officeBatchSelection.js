export const selectOfficeBatchSubmissions = (submissions = [], includeGraded = false, autoGradeKey, cache = {}) => {
  if (includeGraded) return submissions;
  return submissions.filter(submission => {
    const autoGrade = cache[submission._id] || submission[autoGradeKey];
    const needsReview = autoGrade?.results?.some(result => result.needsReview);
    const graded = submission.status === 'graded' || submission.grade?.score != null || submission.aiGrade?.score != null || (autoGrade?.score != null && !needsReview);
    return !graded;
  });
};
