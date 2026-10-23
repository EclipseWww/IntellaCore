const path = require('path');
const fs = require('fs');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const PointsManager = require('../utils/pointsManager');
const { gradePptSubmission } = require('./pptAutoGradeService');
const { gradeExcelSubmission } = require('./excelAutoGradeService');
const storedPath = value => value ? (path.isAbsolute(value) ? value : path.join(__dirname, '../..', value)) : null;

async function runOfficeAutoGrade(submission, activity, kind, actorId) {
  const settings = activity[kind + 'GradingSettings'];
  if (!settings?.enabled) return null;
  const studentPath = storedPath(submission.content?.file?.path);
  const referencePath = storedPath(settings.referenceFile?.path);
  const originalPath = storedPath(settings.originalFile?.path);
  if (!studentPath || !referencePath || !fs.existsSync(studentPath) || !fs.existsSync(referencePath) || (originalPath && !fs.existsSync(originalPath))) throw new Error('自动评阅文件不存在');
  const result = await (kind === 'ppt' ? gradePptSubmission : gradeExcelSubmission)({studentPath, referencePath, originalPath, rules: settings.rules || []});
  const autoKey = kind + 'AutoGrade';
  const requiresReview = result.results.some(item => item.needsReview);
  const autoGrade = Object.fromEntries(['score','maxScore','rawScore','feedback','passedCount','totalRules','results','gradedAt'].map(key => [key, result[key]]));
  const changes = { [autoKey]: autoGrade };
  if (!requiresReview) {
    changes.grade = { source: kind + '_auto', score: result.score, feedback: result.feedback, gradedBy: actorId, gradedAt: result.gradedAt, rubricScores: result.results.map(item => ({criterion:item.title,score:item.score,feedback:item.message || (item.passed ? '通过' : '未通过')})) };
    changes.status = 'graded';
  }
  const previousPoints = Number(((submission.grade?.score ?? submission.aiGrade?.score ?? 0) * 10).toFixed(2));
  await PointsManager.reconcileAssignmentPoints(submission.student, previousPoints, submission._id, '迁移作业积分', previousPoints, true);
  // A newer upload or manual grade must never be overwritten by an older request.
  const updated = await AssignmentSubmission.findOneAndUpdate(
    {_id:submission._id, 'content.file.filename':submission.content.file.filename, 'grade.gradedAt':submission.grade?.gradedAt ?? null},
    {$set:changes}, {new:true,runValidators:true}
  );
  if (!updated) throw new Error('作业或评分已更新，请刷新后重试');
  if (!requiresReview) await PointsManager.syncAssignmentPoints(updated._id, kind.toUpperCase() + '自动评阅');
  return {result,submission:updated,requiresReview};
}
module.exports = { runOfficeAutoGrade };
