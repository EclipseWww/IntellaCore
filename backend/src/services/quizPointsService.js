const mongoose = require('mongoose');
const Achievement = require('../models/Achievement');
const QuizSubmission = require('../models/QuizSubmission');
const logger = require('../utils/logger');
async function settleQuizPoints(submission) {
  const studentId = submission.studentId, quizId = submission.quizId?._id || submission.quizId;
  const quiz = await require('../models/Quiz').findById(quizId);
  if (!quiz || quiz.isScaleTest) {
    await QuizSubmission.updateOne({ _id: submission._id, status: submission.status, __v: submission.__v }, { $set: { pointsPending: false } });
    return;
  }
  const percentage = row => Math.max(0, Math.min(100, row.pointsTarget ?? Math.round((row.score || 0) / Math.max(1, quiz.questions.length) * 100)));
  const read = async () => {
    const rows = await QuizSubmission.find({ studentId, quizId, status: { $in: ['SUBMITTED', 'DELETED'] } }).select('status score pointsTarget');
    return {
      target: Math.max(0, ...rows.filter(row => row.status === 'SUBMITTED').map(percentage)),
      baseline: Math.max(0, ...rows.filter(row => row.pointsTarget == null).map(percentage))
    };
  };
  if (!await Achievement.exists({ studentId })) {
    await Achievement.updateOne({ _id: studentId }, { $setOnInsert: { studentId, totalPoints: 0, level: 1 } }, { upsert: true });
  }
  const key = 'quizAwards.' + String(quizId);
  for (let attempt = 0; attempt < 20; attempt++) {
    const { target, baseline } = await read();
    const achievement = await Achievement.findOne({ studentId }).select('+quizAwards');
    const tracked = achievement.quizAwards?.get(String(quizId));
    const previous = tracked ?? baseline;
    const delta = target - previous;
    const amount = { $max: [delta, { $multiply: [-1, { $ifNull: ['$totalPoints', 0] }] }] };
    const transaction = { _id: new mongoose.Types.ObjectId(), type: delta < 0 ? 'quiz_reward_revoked' : 'quiz_reward', relatedId: submission._id,
      description: '测验成绩积分同步', timestamp: new Date() };
    const result = await Achievement.updateOne({ _id: achievement._id, [key]: tracked ?? { $exists: false } }, [{ $set: {
      [key]: target,
      totalPoints: { $round: [{ $add: [{ $ifNull: ['$totalPoints', 0] }, amount] }, 2] },
      pointTransactions: { $cond: [{ $ne: [amount, 0] }, { $slice: [{ $concatArrays: [[{ ...transaction, amount }], { $ifNull: ['$pointTransactions', []] }] }, 100] }, { $ifNull: ['$pointTransactions', []] }] }
    } }]);
    if (!result.matchedCount) continue;
    if ((await read()).target !== target) continue;
    await QuizSubmission.updateOne({ _id: submission._id, status: submission.status, __v: submission.__v }, { $set: { pointsPending: false } });
    return;
  }
  throw new Error('测验成绩正在变化，稍后重试积分同步');
}
let running = false;
async function recoverQuizPoints() {
  if (running) return;
  running = true;
  try {
    const submissions = await QuizSubmission.find({ status: { $in: ['SUBMITTED', 'DELETED'] }, pointsPending: true }).sort({ updatedAt: 1 }).limit(100);
    for (const submission of submissions) {
      try { await settleQuizPoints(submission); }
      catch (error) {
        logger.error('测验积分恢复失败', { submissionId: submission._id, error: error.message });
        await QuizSubmission.updateOne({ _id: submission._id }, { $set: { updatedAt: new Date() } });
      }
    }
  } finally { running = false; }
}
function startQuizPointsRecovery() {
  const run = () => recoverQuizPoints().catch(error => logger.error('测验积分恢复异常', { error: error.message }));
  run();
  const timer = setInterval(run, 30000); timer.unref(); return timer;
}
module.exports = { settleQuizPoints, recoverQuizPoints, startQuizPointsRecovery };
