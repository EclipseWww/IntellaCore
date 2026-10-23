const cron = require('node-cron');
const logger = require('../utils/logger');
const Class = require('../models/Class');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// 备份目录
const BACKUP_DIR = path.join(__dirname, '../../backups');
// 最大保留备份数量
const MAX_BACKUP_FILES = 5;

// 定期检查班级状态的任务
function startClassScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // 查找所有已到达预期下课时间的班级
      const classesToEnd = await Class.find({
        isInClass: true,
        scheduledEndTime: { $lte: now }
      });

      logger.info('定时任务已触发');
      if (classesToEnd.length > 0) {
        logger.info(`找到${classesToEnd.length}个需要自动下课的班级`);
        
        // 批量更新这些班级状态
        const results = await Class.updateMany(
          { _id: { $in: classesToEnd.map(c => c._id) } },
          { $set: { isInClass: false, scheduledEndTime: null } }
        );
        
        logger.info('班级自动下课完成', {
          matchedCount: results.matchedCount,
          modifiedCount: results.modifiedCount,
          classIds: classesToEnd.map(c => c._id)
        });
      }
    } catch (error) {
      logger.error('自动下课任务出错', { error: error.message });
    }
  });
}

// 初始化函数
async function initClassEndTimes() {
  try {
    // 检查是否有未正确结束的班级
    const outdatedClasses = await Class.find({
      isInClass: true,
      scheduledEndTime: { $lte: new Date() }
    });
    
    if (outdatedClasses.length > 0) {
      logger.info(`初始化时发现${outdatedClasses.length}个过期上课状态的班级，正在更新状态`);
      
      await Class.updateMany(
        { _id: { $in: outdatedClasses.map(c => c._id) } },
        { $set: { isInClass: false, scheduledEndTime: null } }
      );
    }
    
    logger.info('班级状态初始化完成');
  } catch (error) {
    logger.error('班级状态初始化出错', { error: error.message });
  }
}

// 自动备份任务
function startBackupScheduler() {
  // 确保备份目录存在
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info(`创建备份目录: ${BACKUP_DIR}`);
  }

  // 每天凌晨3点执行自动备份
  cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('开始执行自动备份任务');
      await createBackup();
      await cleanupOldBackups();
      logger.info('自动备份任务完成');
    } catch (error) {
      logger.error('自动备份任务出错', { error: error.message, stack: error.stack });
    }
  });
}

// 创建备份文件
async function createBackup() {
  try {
    logger.info('开始创建备份...');
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupFileName = `auto-backup-${timestamp}.zip`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    
    // 创建输出流和归档
    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高压缩级别
    });

    // 监听关闭事件
    const archivePromise = new Promise((resolve, reject) => {
      output.on('close', () => {
        logger.info(`备份完成: ${archive.pointer()} 总字节`, {
          backupFile: backupFileName,
          backupPath: backupPath,
          size: archive.pointer()
        });
        resolve();
      });
      
      // 监听错误事件
      archive.on('error', (err) => {
        logger.error('创建备份时出错', { error: err.message, stack: err.stack });
        reject(err);
      });
      
      // 监听警告事件
      archive.on('warning', (err) => {
        logger.warn('备份警告', { warning: err.message });
      });
    });

    // 将输出流连接到归档
    archive.pipe(output);

    // 添加上传的资源文件
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (fs.existsSync(uploadsDir)) {
      logger.info(`添加上传目录: ${uploadsDir}`);
      
      // 遍历uploads目录，添加所有文件和目录（排除temp目录）
      const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name !== 'temp') {
          if (entry.isDirectory()) {
            const dirPath = path.join(uploadsDir, entry.name);
            logger.info(`添加目录: ${dirPath}`);
            archive.directory(dirPath, `uploads/${entry.name}`);
          } else if (entry.isFile()) {
            const filePath = path.join(uploadsDir, entry.name);
            logger.info(`添加文件: ${filePath}`);
            archive.file(filePath, { name: `uploads/${entry.name}` });
          }
        }
      }
    } else {
      logger.warn(`上传目录不存在: ${uploadsDir}`);
    }

    // 添加数据库备份
    // 导出各个集合的数据
    const User = require('../models/User');
    const Course = require('../models/Course');
    const CourseUnit = require('../models/CourseUnit');
    const Lesson = require('../models/Lesson');
    const Quiz = require('../models/Quiz');
    const ClassModel = require('../models/Class');
    const AssignmentSubmission = require('../models/AssignmentSubmission');
    const Chat = require('../models/Chat');
    const ClassroomLayout = require('../models/ClassroomLayout');
    const Message = require('../models/Message');
    const Question = require('../models/Question');
    const QuizAnalytics = require('../models/QuizAnalytics');
    const QuizSubmission = require('../models/QuizSubmission');
    const Setting = require('../models/Setting');
    const TypingRecord = require('../models/TypingRecord');
    const TypingText = require('../models/TypingText');
    const Achievement = require('../models/Achievement');
    const Progress = require('../models/Progress');
    const { PointShopItem, RedemptionRecord } = require('../models/PointShop');
    const { Crowdfunding, CrowdfundingContribution } = require('../models/Crowdfunding');

    // 定义要备份的模型和文件名
    const modelsToBackup = [
      { model: User, fileName: 'users.json' },
      { model: Course, fileName: 'courses.json' },
      { model: CourseUnit, fileName: 'courseUnits.json' },
      { model: Lesson, fileName: 'lessons.json' },
      { model: Quiz, fileName: 'quizzes.json' },
      { model: ClassModel, fileName: 'classes.json' },
      { model: AssignmentSubmission, fileName: 'assignmentsubmissions.json' },
      { model: Chat, fileName: 'chats.json' },
      { model: ClassroomLayout, fileName: 'classroomLayouts.json' },
      { model: Message, fileName: 'messages.json' },
      { model: Question, fileName: 'questions.json' },
      { model: QuizAnalytics, fileName: 'quizAnalytics.json' },
      { model: QuizSubmission, fileName: 'quizSubmissions.json' },
      { model: Setting, fileName: 'settings.json' },
      { model: TypingRecord, fileName: 'typingRecords.json' },
      { model: TypingText, fileName: 'typingTexts.json' },
      { model: Achievement, fileName: 'achievements.json' },
      { model: Progress, fileName: 'progress.json' },
      { model: PointShopItem, fileName: 'pointShopItems.json' },
      { model: RedemptionRecord, fileName: 'redemptionRecords.json' },
      { model: Crowdfunding, fileName: 'crowdfunding.json' },
      { model: CrowdfundingContribution, fileName: 'crowdfundingContributions.json' }
    ];
    
    // 获取并添加所有模型数据到归档
    for (const { model, fileName } of modelsToBackup) {
      try {
        const data = await model.find({}).lean();
        logger.info(`获取到 ${data.length} 个 ${model.modelName} 记录`);
        archive.append(JSON.stringify(data, null, 2), { name: fileName });
      } catch (err) {
        logger.error(`获取 ${model.modelName} 数据时出错:`, { error: err.message });
        // 继续处理其他模型
      }
    }

    // 完成归档
    await archive.finalize();
    await archivePromise;
    
    logger.info('备份文件创建成功', { backupFile: backupFileName });
    return backupPath;
  } catch (error) {
    logger.error('创建备份文件失败', { error: error.message, stack: error.stack });
    throw error;
  }
}

// 清理旧的备份文件
async function cleanupOldBackups() {
  try {
    logger.info('开始清理旧备份文件...');
    
    // 读取备份目录中所有文件
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('auto-backup-') && file.endsWith('.zip'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        mtime: fs.statSync(path.join(BACKUP_DIR, file)).mtime
      }))
      // 按修改时间降序排序
      .sort((a, b) => b.mtime - a.mtime);
    
    logger.info(`找到 ${files.length} 个自动备份文件`);
    
    // 如果超过最大保留数量，删除最旧的文件
    if (files.length > MAX_BACKUP_FILES) {
      const filesToDelete = files.slice(MAX_BACKUP_FILES);
      logger.info(`将删除 ${filesToDelete.length} 个旧备份文件`);
      
      for (const file of filesToDelete) {
        try {
          fs.unlinkSync(file.path);
          logger.info(`已删除旧备份文件: ${file.name}`);
        } catch (err) {
          logger.error(`删除旧备份文件失败: ${file.name}`, { error: err.message });
        }
      }
    } else {
      logger.info(`当前备份文件数量 ${files.length} 不超过最大保留数量 ${MAX_BACKUP_FILES}，无需删除`);
    }
  } catch (error) {
    logger.error('清理旧备份文件时出错', { error: error.message, stack: error.stack });
    throw error;
  }
}

// 初始化所有定时任务
function initAllSchedulers() {
  startClassScheduler();
  startBackupScheduler();
  logger.info('所有定时任务已初始化');
}

module.exports = {
  startClassScheduler,
  initClassEndTimes,
  startBackupScheduler,
  createBackup,
  cleanupOldBackups,
  initAllSchedulers
};