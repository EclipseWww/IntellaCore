const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;
const AssignmentSubmission = require('../models/AssignmentSubmission');
const User = require('../models/User');
const logger = require('../utils/logger');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function cleanOrphanedSubmissions() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('数据库连接成功');

    // 获取所有提交记录
    const submissions = await AssignmentSubmission.find();
    logger.info('获取到所有提交记录', { count: submissions.length });

    let deletedCount = 0;
    let deletedFiles = 0;
    let errors = 0;

    // 遍历每个提交记录
    for (const submission of submissions) {
      try {
        // 检查学生是否存在
        const student = await User.findById(submission.student);
        
        if (!student) {
          logger.warn('发现孤立的提交记录', {
            submissionId: submission._id,
            studentId: submission.student
          });

          // 删除相关文件
          if (submission.content?.file?.path) {
            try {
              const filePath = path.join(__dirname, '../..', submission.content.file.path);
              await fs.unlink(filePath).catch(err => {
                logger.warn('删除作业文件失败', {
                  filePath,
                  error: err.message
                });
              });
              deletedFiles++;

              // 删除PDF预览文件
              if (submission.content.file.pdfPreviewPath) {
                const pdfPath = path.join(__dirname, '../..', submission.content.file.pdfPreviewPath);
                await fs.unlink(pdfPath).catch(err => {
                  logger.warn('删除PDF预览文件失败', {
                    pdfPath,
                    error: err.message
                  });
                });
                deletedFiles++;
              }
            } catch (error) {
              logger.error('删除文件时出错', {
                submissionId: submission._id,
                error: error.message
              });
              errors++;
            }
          }

          // 删除提交记录
          await AssignmentSubmission.findByIdAndDelete(submission._id);
          deletedCount++;
        }
      } catch (error) {
        logger.error('处理提交记录时出错', {
          submissionId: submission._id,
          error: error.message
        });
        errors++;
      }
    }

    // 输出清理结果
    logger.info('清理完成', {
      totalSubmissions: submissions.length,
      deletedSubmissions: deletedCount,
      deletedFiles,
      errors
    });

    console.log('清理结果：');
    console.log(`- 总提交记录数：${submissions.length}`);
    console.log(`- 已删除提交记录：${deletedCount}`);
    console.log(`- 已删除文件数：${deletedFiles}`);
    console.log(`- 发生错误数：${errors}`);

  } catch (error) {
    logger.error('清理脚本执行失败', {
      error: error.message,
      stack: error.stack
    });
    console.error('清理脚本执行失败:', error);
  } finally {
    // 关闭数据库连接
    await mongoose.connection.close();
    logger.info('数据库连接已关闭');
    console.log('数据库连接已关闭');
  }
}

// 执行清理
cleanOrphanedSubmissions(); 