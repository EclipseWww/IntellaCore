const mongoose = require('mongoose');
const ShopOperation = require('../models/ShopOperation');
const { PointShopItem, RedemptionRecord } = require('../models/PointShop');
const Achievement = require('../models/Achievement');
const { roundPoints } = require('../utils/pointPrecision');
const logger = require('../utils/logger');

// Each resource records its decision in the same atomic update as its mutation.
// Replaying an operation after a crash cannot reserve stock or debit points twice.
async function reserveStock(operation) {
  const id = String(operation._id);
  const accepted = { $and: [{ $eq: ['$isActive', true] }, { $or: [{ $eq: ['$stock', -1] }, { $gt: ['$stock', 0] }] }] };
  const reserved = { $and: [accepted, { $gt: ['$stock', 0] }] };
  await PointShopItem.updateOne({ _id: operation.itemId, 'shopReceipts.id': { $ne: id } }, [{ $set: {
    stock: { $cond: [reserved, { $subtract: ['$stock', 1] }, '$stock'] },
    shopReceipts: { $concatArrays: [{ $ifNull: ['$shopReceipts', []] }, [{ id: { $literal: id }, accepted, reserved }]] }
  } }]);
  const item = await PointShopItem.findById(operation.itemId).select({ shopReceipts: { $elemMatch: { id } } });
  return item?.shopReceipts.find(receipt => receipt.id === id) || { accepted: false, reserved: false };
}

async function debitPoints(operation) {
  const id = String(operation._id), amount = roundPoints(operation.pointCost);
  const accepted = { $gte: [{ $round: [{ $ifNull: ['$totalPoints', 0] }, 2] }, amount] };
  const transaction = { _id: new mongoose.Types.ObjectId(), amount: -amount, type: operation.transactionType || 'shop_purchase',
    description: operation.transactionDescription || `购买商品: ${operation.itemName}`, relatedId: operation.itemId, timestamp: new Date() };
  await Achievement.updateOne({ studentId: operation.studentId, 'shopReceipts.id': { $ne: id } }, [{ $set: {
    totalPoints: { $cond: [accepted, { $round: [{ $subtract: [{ $ifNull: ['$totalPoints', 0] }, amount] }, 2] }, '$totalPoints'] },
    pointTransactions: { $cond: [accepted, { $slice: [{ $concatArrays: [{ $literal: [transaction] }, { $ifNull: ['$pointTransactions', []] }] }, 100] }, '$pointTransactions'] },
    shopReceipts: { $concatArrays: [{ $ifNull: ['$shopReceipts', []] }, [{ id: { $literal: id }, accepted }]] }
  } }]);
  const achievement = await Achievement.findOne({ studentId: operation.studentId }).select({ shopReceipts: { $elemMatch: { id } } });
  if (!achievement) throw new Error('学生积分账户不存在，等待恢复处理');
  return achievement.shopReceipts.find(receipt => receipt.id === id);
}

async function releaseStock(operation, receipt) {
  if (!receipt.reserved) return;
  const id = String(operation._id);
  await PointShopItem.updateOne({ _id: operation.itemId, shopRefundIds: { $ne: id } }, [{ $set: {
    stock: { $cond: [{ $eq: ['$stock', -1] }, -1, { $add: ['$stock', 1] }] },
    shopRefundIds: { $concatArrays: [{ $ifNull: ['$shopRefundIds', []] }, { $literal: [id] }] }
  } }]);
}

async function settleOperation(operation) {
  if (operation.status === 'completed') return { record: await RedemptionRecord.findById(operation._id) };
  if (operation.status === 'cancelled') return { reason: operation.reason };
  const stock = await reserveStock(operation);
  let reason;
  if (!stock.accepted) reason = '商品已下架或库存不足';
  else {
    const points = await debitPoints(operation);
    if (!points.accepted) {
      await releaseStock(operation, stock);
      reason = '积分不足';
    }
  }
  if (reason) {
    await ShopOperation.updateOne({ _id: operation._id, status: 'pending' }, { $set: { status: 'cancelled', reason } });
    return { reason };
  }
  // Upsert a stable redemption identity. A lost acknowledgement is safe to retry.
  const record = await RedemptionRecord.findOneAndUpdate({ _id: operation._id }, { $setOnInsert: {
    studentId: operation.studentId, itemId: operation.itemId, itemName: operation.itemName,
    itemType: operation.itemType, pointCost: operation.pointCost, duration: operation.duration,
    status: 'pending', redeemTime: operation.createdAt
  } }, { upsert: true, new: true, runValidators: true });
  await ShopOperation.updateOne({ _id: operation._id, status: 'pending' }, { $set: { status: 'completed' } });
  return { record };
}

let recovering = false;
async function recoverShopOperations() {
  if (recovering) return;
  recovering = true;
  try {
    const operations = await ShopOperation.find({ status: 'pending' }).sort({ updatedAt: 1 }).limit(100);
    for (const operation of operations) {
      try { await settleOperation(operation); }
      catch (error) {
        logger.error('兑换恢复暂未完成', { operationId: operation.id, error: error.message });
        // Rotate failures so they cannot starve later operations.
        await ShopOperation.updateOne({ _id: operation._id }, { $set: { updatedAt: new Date() } });
      }
    }
  } finally { recovering = false; }
}
function startShopRecovery() {
  const recover = () => recoverShopOperations().catch(error => logger.error('兑换恢复失败', { error: error.message }));
  recover();
  const timer = setInterval(recover, 30000);
  timer.unref();
  return timer;
}
module.exports = { debitPoints, settleOperation, recoverShopOperations, startShopRecovery };
