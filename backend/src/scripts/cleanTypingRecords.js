/**
 * 清理打字记录脚本
 * 1. 删除速度大于100的记录
 * 2. 去重，去掉endTime在同分钟内的记录，只保留其中一条
 */

const mongoose = require('mongoose');
const TypingRecord = require('../models/TypingRecord');
const logger = require('../utils/logger');
require('dotenv').config();

// 连接数据库
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  logger.info('MongoDB 连接成功，开始清理打字记录');
  cleanTypingRecords();
})
.catch(err => {
  logger.error('MongoDB 连接失败', { error: err.message });
  process.exit(1);
});

/**
 * 清理打字记录的主函数
 */
async function cleanTypingRecords() {
  try {
    // 步骤1: 删除速度大于100的记录
    const speedResult = await removeHighSpeedRecords();
    
    // 步骤2: 去重，去掉endTime在同分钟内的记录
    const duplicateResult = await removeDuplicateRecords();
    
    logger.info('打字记录清理完成', {
      removedHighSpeed: speedResult.deletedCount,
      removedDuplicates: duplicateResult
    });
    
    // 断开数据库连接
    await mongoose.disconnect();
    logger.info('数据库连接已关闭');
    process.exit(0);
  } catch (error) {
    logger.error('清理打字记录时出错', { error: error.message, stack: error.stack });
    await mongoose.disconnect();
    process.exit(1);
  }
}

/**
 * 删除速度大于100的记录
 */
async function removeHighSpeedRecords() {
  logger.info('开始删除速度大于100的记录');
  const result = await TypingRecord.deleteMany({ speed: { $gt: 100 } });
  logger.info(`已删除 ${result.deletedCount} 条速度大于100的记录`);
  return result;
}

/**
 * 去重，去掉endTime在同分钟内的记录，只保留其中一条
 */
async function removeDuplicateRecords() {
  logger.info('开始去除同一用户在同一分钟内的重复记录');
  
  // 获取所有记录
  const allRecords = await TypingRecord.find().sort({ endTime: 1 });
  
  // 按用户ID分组
  const recordsByUser = {};
  allRecords.forEach(record => {
    const userId = record.userId.toString();
    if (!recordsByUser[userId]) {
      recordsByUser[userId] = [];
    }
    recordsByUser[userId].push(record);
  });
  
  let totalRemoved = 0;
  
  // 处理每个用户的记录
  for (const userId in recordsByUser) {
    const userRecords = recordsByUser[userId];
    const recordsToKeep = [];
    const recordsToRemove = [];
    
    // 按分钟分组
    const recordsByMinute = {};
    
    userRecords.forEach(record => {
      const endTime = new Date(record.endTime);
      // 创建分钟级别的时间戳键 (YYYY-MM-DD HH:MM)
      const minuteKey = `${endTime.getFullYear()}-${(endTime.getMonth() + 1).toString().padStart(2, '0')}-${endTime.getDate().toString().padStart(2, '0')} ${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
      
      if (!recordsByMinute[minuteKey]) {
        recordsByMinute[minuteKey] = [];
      }
      recordsByMinute[minuteKey].push(record);
    });
    
    // 对于每个分钟，只保留一条记录
    for (const minuteKey in recordsByMinute) {
      const minuteRecords = recordsByMinute[minuteKey];
      if (minuteRecords.length > 1) {
        // 保留第一条记录，删除其余记录
        recordsToKeep.push(minuteRecords[0]);
        recordsToRemove.push(...minuteRecords.slice(1));
      } else {
        recordsToKeep.push(minuteRecords[0]);
      }
    }
    
    // 删除需要移除的记录
    if (recordsToRemove.length > 0) {
      const recordIdsToRemove = recordsToRemove.map(record => record._id);
      await TypingRecord.deleteMany({ _id: { $in: recordIdsToRemove } });
      totalRemoved += recordsToRemove.length;
    }
  }
  
  logger.info(`已删除 ${totalRemoved} 条重复记录`);
  return totalRemoved;
}
