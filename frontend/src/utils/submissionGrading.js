function isAutomaticGrade(submission) {
  const grade = submission?.grade;
  if (['ppt_auto', 'excel_auto'].includes(grade?.source)) return true;
  if (grade?.source === 'manual') return false;
  // Legacy auto grades used the teacher as gradedBy; compare the saved result instead.
  return ['pptAutoGrade', 'excelAutoGrade'].some(key => {
    const result = submission?.[key];
    return grade?.score != null && result?.score != null && grade.score === result.score && grade.feedback === result.feedback && grade.gradedAt && result.gradedAt && Math.abs(new Date(grade.gradedAt) - new Date(result.gradedAt)) < 1000;
  });
}
function isManualGrade(submission) {
  return submission?.grade?.score != null && !isAutomaticGrade(submission);
}

function getAutoGrade(submission, key) {
  const grade = submission?.[key] || submission?.grade?.[key];
  return grade && grade.score != null && Array.isArray(grade.results) ? grade : null;
}
const gradeResultRank = item => item.needsReview ? 1 : item.passed ? 2 : 0;
const sortGradeResults = (results = []) => results.map((item,index)=>({item,index})).sort((a,b)=>gradeResultRank(a.item)-gradeResultRank(b.item) || a.index-b.index).map(({item})=>item);
export { isAutomaticGrade, isManualGrade, getAutoGrade, sortGradeResults };
