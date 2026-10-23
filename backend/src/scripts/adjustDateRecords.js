const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('../config');

// 导入模型
const AssignmentSubmission = require('../models/AssignmentSubmission');
const TypingRecord = require('../models/TypingRecord');
const QuizSubmission = require('../models/QuizSubmission');

// 辅助函数，格式化日期为易读格式
function formatDate(date) {
  if (!date) return 'null';
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

async function adjustDateRecords() {
  try {
    logger.info('开始调整数据库记录的日期');
    console.log('开始调整数据库记录的日期...');

    // 连接到数据库
    await mongoose.connect(config.mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    logger.info('已连接到数据库');
    console.log('已连接到数据库');

    // 设置固定时间 - 2025年3月1日
    const fixedDate = new Date('2025-03-01T00:00:00.000Z');
    const fixedDatePlus5Min = new Date('2025-03-01T00:05:00.000Z');
    console.log(`固定调整日期: ${formatDate(fixedDate)}`);
    console.log(`打字和测验记录时间: ${formatDate(fixedDatePlus5Min)}`);
    
    // 日期范围检查函数（不在2025年2月至2025年8月之间）
    const isOutsideDateRange = (date) => {
      if (!date) return false;
      
      // 检查日期是否在2025.2-2025.8范围内
      const feb2025 = new Date('2025-02-01T00:00:00.000Z');
      const aug2025 = new Date('2025-08-31T23:59:59.999Z');
      
      if (date >= feb2025 && date <= aug2025) {
        return false; // 日期在范围内，不需要修改
      }
      
      return true; // 日期在范围外，需要修改
    };

    // 1. 调整打字记录
    logger.info('开始处理打字记录');
    console.log('\n======== 开始处理打字记录 ========');
    
    // 找出所有不在指定日期范围内的记录
    const typingRecordsToUpdate = await TypingRecord.find({
      $or: [
        { startTime: { $lt: new Date('2025-02-01') } },
        { startTime: { $gt: new Date('2025-08-31') } },
        { endTime: { $lt: new Date('2025-02-01') } },
        { endTime: { $gt: new Date('2025-08-31') } }
      ]
    });
    
    console.log(`发现 ${typingRecordsToUpdate.length} 条需要调整的打字记录`);
    let typingUpdateCount = 0;

    // 批量更新这些记录
    for (const record of typingRecordsToUpdate) {
      console.log(`修改打字记录 ID: ${record._id}`);
      console.log(`  原始开始时间: ${formatDate(record.startTime)}`);
      console.log(`  原始结束时间: ${formatDate(record.endTime)}`);
      
      try {
        // 直接更新记录
        await TypingRecord.updateOne(
          { _id: record._id },
          { 
            $set: { 
              startTime: fixedDatePlus5Min,
              endTime: new Date(fixedDatePlus5Min.getTime() + 5 * 60 * 1000), // 5分钟后
              updatedAt: fixedDate
            } 
          }
        );
        
        console.log(`  新开始时间: ${formatDate(fixedDatePlus5Min)}`);
        console.log(`  新结束时间: ${formatDate(new Date(fixedDatePlus5Min.getTime() + 5 * 60 * 1000))}`);
        typingUpdateCount++;
      } catch (err) {
        console.error(`更新打字记录失败 ID: ${record._id}`, err.message);
      }
    }
    
    logger.info(`打字记录调整完成，共调整了 ${typingUpdateCount} 条记录`);
    console.log(`\n打字记录调整完成，共调整了 ${typingUpdateCount} 条记录`);

    // 2. 调整测验提交记录
    logger.info('开始处理测验提交记录');
    console.log('\n======== 开始处理测验提交记录 ========');
    
    // 找出所有不在指定日期范围内的记录
    const quizSubmissionsToUpdate = await QuizSubmission.find({
      $or: [
        { startTime: { $lt: new Date('2025-02-01') } },
        { startTime: { $gt: new Date('2025-08-31') } },
        { submitTime: { $lt: new Date('2025-02-01') } },
        { submitTime: { $gt: new Date('2025-08-31') } }
      ]
    });
    
    console.log(`发现 ${quizSubmissionsToUpdate.length} 条需要调整的测验提交记录`);
    let quizUpdateCount = 0;

    // 批量更新这些记录
    for (const submission of quizSubmissionsToUpdate) {
      console.log(`修改测验提交记录 ID: ${submission._id}`);
      console.log(`  原始开始时间: ${formatDate(submission.startTime)}`);
      console.log(`  原始提交时间: ${formatDate(submission.submitTime)}`);
      
      try {
        // 直接更新记录
        await QuizSubmission.updateOne(
          { _id: submission._id },
          { 
            $set: { 
              startTime: fixedDatePlus5Min,
              submitTime: new Date(fixedDatePlus5Min.getTime() + 10 * 60 * 1000), // 10分钟后
              updatedAt: fixedDate
            } 
          }
        );
        
        console.log(`  新开始时间: ${formatDate(fixedDatePlus5Min)}`);
        console.log(`  新提交时间: ${formatDate(new Date(fixedDatePlus5Min.getTime() + 10 * 60 * 1000))}`);
        quizUpdateCount++;
      } catch (err) {
        console.error(`更新测验提交记录失败 ID: ${submission._id}`, err.message);
      }
    }
    
    logger.info(`测验提交记录调整完成，共调整了 ${quizUpdateCount} 条记录`);
    console.log(`\n测验提交记录调整完成，共调整了 ${quizUpdateCount} 条记录`);

    // 3. 调整作业提交记录
    logger.info('开始处理作业提交记录');
    console.log('\n======== 开始处理作业提交记录 ========');
    
    // 找出所有不在指定日期范围内的记录
    const assignmentSubmissionsToUpdate = await AssignmentSubmission.find({
      $or: [
        { submittedAt: { $lt: new Date('2025-02-01') } },
        { submittedAt: { $gt: new Date('2025-08-31') } },
        { 'grade.gradedAt': { $lt: new Date('2025-02-01') } },
        { 'grade.gradedAt': { $gt: new Date('2025-08-31') } },
        { 'aiGrade.gradedAt': { $lt: new Date('2025-02-01') } },
        { 'aiGrade.gradedAt': { $gt: new Date('2025-08-31') } }
      ]
    });
    
    console.log(`发现 ${assignmentSubmissionsToUpdate.length} 条需要调整的作业提交记录`);
    let assignmentUpdateCount = 0;

    // 批量更新这些记录
    for (const submission of assignmentSubmissionsToUpdate) {
      console.log(`修改作业提交记录 ID: ${submission._id}`);
      console.log(`  原始提交时间: ${formatDate(submission.submittedAt)}`);
      if (submission.grade) console.log(`  原始评分时间: ${formatDate(submission.grade.gradedAt)}`);
      if (submission.aiGrade) console.log(`  原始AI评分时间: ${formatDate(submission.aiGrade.gradedAt)}`);
      
      const updateObj = { 
        submittedAt: fixedDate,
        updatedAt: fixedDate
      };
      
      // 如果有grade字段，更新gradedAt
      if (submission.grade && submission.grade.gradedAt) {
        updateObj['grade.gradedAt'] = new Date(fixedDate.getTime() + 2 * 60 * 60 * 1000); // 2小时后
      }
      
      // 如果有aiGrade字段，更新gradedAt
      if (submission.aiGrade && submission.aiGrade.gradedAt) {
        updateObj['aiGrade.gradedAt'] = new Date(fixedDate.getTime() + 10 * 60 * 1000); // 10分钟后
      }
      
      try {
        // 直接更新记录
        await AssignmentSubmission.updateOne(
          { _id: submission._id },
          { $set: updateObj }
        );
        
        console.log(`  新提交时间: ${formatDate(fixedDate)}`);
        if (submission.grade) console.log(`  新评分时间: ${formatDate(new Date(fixedDate.getTime() + 2 * 60 * 60 * 1000))}`);
        if (submission.aiGrade) console.log(`  新AI评分时间: ${formatDate(new Date(fixedDate.getTime() + 10 * 60 * 1000))}`);
        assignmentUpdateCount++;
      } catch (err) {
        console.error(`更新作业提交记录失败 ID: ${submission._id}`, err.message);
      }
    }
    
    logger.info(`作业提交记录调整完成，共调整了 ${assignmentUpdateCount} 条记录`);
    console.log(`\n作业提交记录调整完成，共调整了 ${assignmentUpdateCount} 条记录`);

    logger.info('所有记录调整完成！总共调整记录数：', {
      typingRecords: typingUpdateCount,
      quizSubmissions: quizUpdateCount,
      assignmentSubmissions: assignmentUpdateCount,
      total: typingUpdateCount + quizUpdateCount + assignmentUpdateCount
    });
    
    console.log('\n======== 所有记录调整完成 ========');
    console.log(`打字记录：${typingUpdateCount} 条`);
    console.log(`测验提交记录：${quizUpdateCount} 条`);
    console.log(`作业提交记录：${assignmentUpdateCount} 条`);
    console.log(`总计：${typingUpdateCount + quizUpdateCount + assignmentUpdateCount} 条`);

  } catch (error) {
    logger.error('调整数据库记录时出错', { error: error.message, stack: error.stack });
    console.error('调整数据库记录时出错：', error.message);
    console.error(error.stack);
  } finally {
    // 断开数据库连接
    await mongoose.connection.close();
    logger.info('数据库连接已关闭');
    console.log('数据库连接已关闭');
  }
}

// 执行脚本
adjustDateRecords(); 