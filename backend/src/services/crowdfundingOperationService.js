const { Crowdfunding, CrowdfundingContribution } = require('../models/Crowdfunding');
const Operation = require('../models/CrowdfundingOperation');
const User = require('../models/User');
const Achievement = require('../models/Achievement');
const { debitPoints } = require('./shopOperationService');
const logger = require('../utils/logger');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
async function reserve(operation) {
  const id = String(operation._id);
  const available = { $max: [0, { $round: [{ $subtract: [{ $subtract: ['$targetPoints', { $ifNull: ['$currentPoints', 0] }] }, { $ifNull: ['$reservedPoints', 0] }] }, 2] }] };
  const eligible = { $and: [{ $eq: ['$status', 'active'] }, { $lte: ['$startDate', new Date()] }, { $gt: ['$endDate', new Date()] }] };
  const amount = { $cond: [eligible, { $min: [operation.points, available] }, 0] };
  await Crowdfunding.updateOne({ _id: operation.crowdfundingId, 'contributionReceipts.id': { $ne: id } }, [{ $set: {
    reservedPoints: { $add: [{ $ifNull: ['$reservedPoints', 0] }, amount] },
    contributionReceipts: { $concatArrays: [{ $ifNull: ['$contributionReceipts', []] }, [{ id: { $literal: id }, amount }]] }
  } }]);
  const campaign = await Crowdfunding.findById(operation.crowdfundingId).select({ contributionReceipts: { $elemMatch: { id } } });
  return campaign?.contributionReceipts.find(receipt => receipt.id === id) || { amount: 0 };
}
async function finalize(operation, amount, accepted) {
  const id = String(operation._id);
  const current = { $add: [{ $ifNull: ['$currentPoints', 0] }, accepted ? amount : 0] };
  await Crowdfunding.updateOne({ _id: operation.crowdfundingId, settledContributionIds: { $ne: id } }, [{ $set: {
    reservedPoints: { $max: [0, { $subtract: [{ $ifNull: ['$reservedPoints', 0] }, amount] }] },
    currentPoints: current,
    contributionsCount: { $add: [{ $ifNull: ['$contributionsCount', 0] }, accepted ? 1 : 0] },
    participants: accepted ? { $setUnion: [{ $ifNull: ['$participants', []] }, { $literal: [operation.studentId] }] } : { $ifNull: ['$participants', []] },
    status: { $cond: [{ $and: [{ $eq: ['$status', 'active'] }, { $gte: [current, '$targetPoints'] }] }, 'ready_to_complete', '$status'] },
    settledContributionIds: { $concatArrays: [{ $ifNull: ['$settledContributionIds', []] }, { $literal: [id] }] }
  } }]);
}
async function settle(operation) {
  if (operation.status === 'cancelled') return { reason: operation.reason };
  if (operation.status === 'completed') return {
    contribution: await CrowdfundingContribution.findById(operation._id), crowdfunding: await Crowdfunding.findById(operation.crowdfundingId)
  };
  const receipt = await reserve(operation);
  let reason;
  if (receipt.amount <= 0) reason = '众筹未开始、已结束或已筹满';
  else {
    const debit = await debitPoints({ _id: operation._id, studentId: operation.studentId, pointCost: receipt.amount,
      itemId: operation.crowdfundingId, transactionType: 'crowdfunding', transactionDescription: '参与众筹' });
    if (!debit.accepted) reason = '积分不足';
    await finalize(operation, receipt.amount, debit.accepted);
  }
  if (reason) {
    await Operation.updateOne({ _id: operation._id, status: 'pending' }, { $set: { status: 'cancelled', reason } });
    return { reason };
  }
  const contribution = await CrowdfundingContribution.findOneAndUpdate({ _id: operation._id }, { $setOnInsert: {
    crowdfundingId: operation.crowdfundingId, studentId: operation.studentId, points: receipt.amount,
    message: operation.message || '', timestamp: operation.createdAt
  } }, { upsert: true, new: true, runValidators: true });
  await Operation.updateOne({ _id: operation._id, status: 'pending' }, { $set: { status: 'completed' } });
  return { contribution, crowdfunding: await Crowdfunding.findById(operation.crowdfundingId) };
}
async function contribute(crowdfundingId, studentId, points, message = '') {
  if (typeof points !== 'number' || !Number.isSafeInteger(points) || points < 1) fail('积分必须为正整数');
  if (typeof message !== 'string' || message.length > 500) fail('留言最多500字');
  const [student, campaign] = await Promise.all([User.findById(studentId), Crowdfunding.findById(crowdfundingId)]);
  if (!campaign) fail('众筹活动不存在', 404);
  if (!student || student.role !== 'student' || !student.classId || String(student.classId) !== String(campaign.classId)) fail('无权参与此班级的众筹', 403);
  if (!await Achievement.exists({ studentId })) await Achievement.updateOne({ _id: studentId }, { $setOnInsert: { studentId, totalPoints: 0, level: 1 } }, { upsert: true });
  const operation = await Operation.create({ crowdfundingId, studentId, points, message });
  try {
    const result = await settle(operation);
    if (result.reason) fail(result.reason);
    return result;
  } catch (error) {
    if (error.status) throw error;
    logger.error('众筹等待恢复', { operationId: operation._id, error: error.message });
    return { processing: true, operationId: operation._id };
  }
}
let recovering = false;
async function recoverCrowdfunding() {
  if (recovering) return;
  recovering = true;
  try {
    const operations = await Operation.find({ status: 'pending' }).sort({ updatedAt: 1 }).limit(100);
    for (const operation of operations) {
      try { await settle(operation); }
      catch (error) {
        logger.error('众筹恢复失败', { operationId: operation._id, error: error.message });
        await Operation.updateOne({ _id: operation._id }, { $set: { updatedAt: new Date() } });
      }
    }
  } finally { recovering = false; }
}
function startCrowdfundingRecovery() {
  const run = () => recoverCrowdfunding().catch(error => logger.error('众筹恢复异常', { error: error.message }));
  run(); const timer = setInterval(run, 30000); timer.unref(); return timer;
}
module.exports = { contribute, settle, recoverCrowdfunding, startCrowdfundingRecovery };
