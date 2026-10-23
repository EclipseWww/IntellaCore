const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const extract = require('extract-zip');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const User = require('../models/User');
const Course = require('../models/Course');
const CourseUnit = require('../models/CourseUnit');
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const Class = require('../models/Class');
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
// 新增模型导入
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Email = require('../models/Email');
const EmailAccount = require('../models/EmailAccount');
const EmailTemplate = require('../models/EmailTemplate');
const ExamConfig = require('../models/ExamConfig');
const FillBlankSubmission = require('../models/FillBlankSubmission');
const FlowchartSubmission = require('../models/FlowchartSubmission');
const HtmlProject = require('../models/HtmlProject');
const PythonSubmission = require('../models/PythonSubmission');
const Spreadsheet = require('../models/Spreadsheet');
const SpreadsheetSubmission = require('../models/SpreadsheetSubmission');
const PracticeSession = require('../models/PracticeSession');
const UserMessage = require('../models/UserMessage');
const logger = require('../utils/logger');

// 临时目录用于存储备份文件
const BACKUP_DIR = path.join(__dirname, '../../backups');

// 确保备份目录存在
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`创建备份目录: ${BACKUP_DIR}`);
  logger.info(`创建备份目录: ${BACKUP_DIR}`);
}

// 确保上传目录存在
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`创建上传目录: ${UPLOADS_DIR}`);
  logger.info(`创建上传目录: ${UPLOADS_DIR}`);
}

// 导出备份
exports.exportBackup = async (req, res) => {
  try {
    logger.info('开始导出备份...');
    console.log('开始导出备份...');
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupFileName = `backup-${timestamp}.zip`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    console.log(`备份文件路径: ${backupPath}`);
    logger.info(`备份文件路径: ${backupPath}`);

    // 获取用户选择的备份选项
    const includeAssignments = req.query.includeAssignments === 'true';

    console.log('备份选项:', {
      includeAssignments,
      resourcesAlwaysIncluded: true
    });
    logger.info('备份选项', {
      includeAssignments,
      resourcesAlwaysIncluded: true
    });

    // 确保备份目录存在
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log(`创建备份目录: ${BACKUP_DIR}`);
    }

    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高压缩级别
    });

    // 监听关闭事件
    output.on('close', () => {
      console.log(`备份完成: ${archive.pointer()} 总字节`);
      console.log(`准备下载文件: ${backupFileName}`);
      logger.info(`备份完成: ${archive.pointer()} 总字节`);

      // 设置响应头，增加超时
      res.setTimeout(300000); // 5分钟超时
      res.setHeader('Content-Disposition', `attachment; filename=${backupFileName}`);
      res.setHeader('Content-Type', 'application/zip');

      // 创建文件读取流并直接管道到响应
      const fileStream = fs.createReadStream(backupPath);
      fileStream.pipe(res);

      // 处理文件流结束
      fileStream.on('end', () => {
        console.log('文件流传输完成');
        logger.info('备份文件下载完成');
        // 立即删除文件，不再使用定时器
        fs.unlink(backupPath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('删除临时备份文件时出错:', unlinkErr);
            logger.error('删除临时备份文件时出错', { error: unlinkErr.message, stack: unlinkErr.stack });
          } else {
            console.log(`临时备份文件已删除: ${backupPath}`);
            logger.info(`临时备份文件已删除: ${backupPath}`);
          }
        });
      });

      // 处理错误
      fileStream.on('error', (err) => {
        console.error('文件流传输错误:', err);
        logger.error('文件流传输错误', { error: err.message, stack: err.stack });
        if (!res.headersSent) {
          res.status(500).json({ message: '文件传输错误', error: err.message });
        }
      });
    });

    // 监听错误事件
    archive.on('error', (err) => {
      console.error('创建备份时出错:', err);
      res.status(500).json({ message: '创建备份时出错', error: err.message });
    });

    // 监听警告事件
    archive.on('warning', (err) => {
      console.warn('备份警告:', err);
    });

    // 将输出流连接到归档
    archive.pipe(output);

    // 获取所有集合的数据
    console.log('开始获取数据...');

    // 定义要备份的模型和文件名
    const modelsToBackup = [
      { model: User, fileName: 'users.json' },
      { model: Course, fileName: 'courses.json' },
      { model: CourseUnit, fileName: 'courseUnits.json' },
      { model: Lesson, fileName: 'lessons.json' },
      { model: Quiz, fileName: 'quizzes.json' },
      { model: Class, fileName: 'classes.json' },
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
      { model: CrowdfundingContribution, fileName: 'crowdfundingContributions.json' },
      // 新增模型备份
      { model: Contact, fileName: 'contacts.json' },
      { model: Conversation, fileName: 'conversations.json' },
      { model: Email, fileName: 'emails.json' },
      { model: EmailAccount, fileName: 'emailAccounts.json' },
      { model: EmailTemplate, fileName: 'emailTemplates.json' },
      { model: ExamConfig, fileName: 'examConfigs.json' },
      { model: FillBlankSubmission, fileName: 'fillBlankSubmissions.json' },
      { model: FlowchartSubmission, fileName: 'flowchartSubmissions.json' },
      { model: HtmlProject, fileName: 'htmlProjects.json' },
      { model: PythonSubmission, fileName: 'pythonSubmissions.json' },
      { model: Spreadsheet, fileName: 'spreadsheets.json' },
      { model: SpreadsheetSubmission, fileName: 'spreadsheetSubmissions.json' },
      { model: PracticeSession, fileName: 'practiceSessions.json' },
      { model: UserMessage, fileName: 'userMessages.json' }
    ];

    // 获取并添加所有模型数据到归档
    for (const { model, fileName } of modelsToBackup) {
      try {
        const data = await model.find({}).lean();
        console.log(`获取到 ${data.length} 个 ${model.modelName} 记录`);
        archive.append(JSON.stringify(data, null, 2), { name: fileName });
      } catch (err) {
        console.error(`获取 ${model.modelName} 数据时出错:`, err);
        // 继续处理其他模型
      }
    }

    console.log('数据添加到归档完成');

    // 添加上传的资源文件，根据用户选择有选择地添加
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (fs.existsSync(uploadsDir)) {
      console.log(`处理上传目录: ${uploadsDir}`);

      // 始终备份resources目录
      const resourcesDir = path.join(uploadsDir, 'resources');
      if (fs.existsSync(resourcesDir)) {
        console.log(`添加resources目录: ${resourcesDir}`);
        archive.directory(resourcesDir, 'uploads/resources');
      } else {
        console.log(`resources目录不存在: ${resourcesDir}`);
      }

      // 根据用户选择备份 assignments 目录
      if (includeAssignments) {
        const assignmentsDir = path.join(uploadsDir, 'assignments');
        if (fs.existsSync(assignmentsDir)) {
          console.log(`添加assignments目录: ${assignmentsDir}`);
          archive.directory(assignmentsDir, 'uploads/assignments');
        } else {
          console.log(`assignments目录不存在: ${assignmentsDir}`);
        }
      } else {
        console.log('用户选择不备份assignments目录');
      }

      // 备份其他可能存在的目录（非resources、pdf_previews、assignments）
      const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirName = entry.name;
          if (dirName !== 'resources' && dirName !== 'pdf_previews' && dirName !== 'assignments' && dirName !== 'temp') {
            const otherDir = path.join(uploadsDir, dirName);
            console.log(`添加其他目录: ${otherDir}`);
            archive.directory(otherDir, `uploads/${dirName}`);
          }
        } else if (entry.isFile()) {
          // 备份uploads目录下的文件
          const filePath = path.join(uploadsDir, entry.name);
          console.log(`添加文件: ${filePath}`);
          archive.file(filePath, { name: `uploads/${entry.name}` });
        }
      }
    } else {
      console.log(`上传目录不存在: ${uploadsDir}`);
    }

    // 完成归档
    console.log('完成归档...');
    await archive.finalize();
    console.log('归档已完成');
  } catch (error) {
    console.error('导出备份时出错:', error);
    logger.error('导出备份时出错', { error: error.message, stack: error.stack });
    res.status(500).json({ message: '导出备份时出错', error: error.message });
  }
};

// 导入备份
exports.importBackup = async (req, res) => {
  try {
    if (!req.file) {
      logger.warn('未提供备份文件');
      return res.status(400).json({ message: '未提供备份文件' });
    }

    logger.info('开始导入备份...');
    console.log('开始导入备份...');
    console.log('备份文件:', req.file);
    logger.info('备份文件信息', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      path: req.file.path
    });

    // 获取用户选择的导入选项
    const includeAssignments = req.body.includeAssignments === 'true';

    console.log('导入选项:', {
      includeAssignments,
      resourcesAlwaysIncluded: true
    });
    logger.info('导入选项', {
      includeAssignments,
      resourcesAlwaysIncluded: true
    });

    const backupFilePath = req.file.path;
    const extractDir = path.join(BACKUP_DIR, `extract-${Date.now()}`);

    // 确保解压目录存在
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
      console.log(`创建解压目录: ${extractDir}`);
      logger.info(`创建解压目录: ${extractDir}`);
    }

    console.log(`解压备份文件到: ${extractDir}`);
    logger.info(`解压备份文件到: ${extractDir}`);
    // 解压备份文件
    await extract(backupFilePath, { dir: extractDir });
    console.log('解压完成');
    logger.info('备份文件解压完成');

    // 读取并导入数据
    const importCollection = async (fileName, Model) => {
      const filePath = path.join(extractDir, fileName);
      if (fs.existsSync(filePath)) {
        console.log(`导入数据文件: ${fileName}`);
        logger.info(`导入数据文件: ${fileName}`);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

          // 清空现有集合
          await Model.deleteMany({});

          // 导入新数据
          if (data.length > 0) {
            // 确保_id是ObjectId类型，并处理可能缺失的必填字段
            const processedData = data.map(item => {
              // 转换_id为ObjectId
              if (item._id && typeof item._id === 'string') {
                item._id = new ObjectId(item._id);
              }

              // 针对User模型特殊处理
              if (Model.modelName === 'User' && !item.name) {
                // 如果缺少name字段，使用username或其他可用字段
                item.name = item.username || item.email || `User_${item._id}`;
              }

              // 针对Achievement模型特殊处理
              if (Model.modelName === 'Achievement' && item.pointTransactions && Array.isArray(item.pointTransactions)) {
                // 确保pointTransactions中的type字段有效
                const validTypes = ['task_completion', 'quiz_reward', 'course_completion', 'shop_purchase', 'system_reward', 'crowdfunding', 'task_completion_revoked', 'other'];

                item.pointTransactions = item.pointTransactions.map(transaction => {
                  // 如果发现不支持的类型，进行修正
                  if (!validTypes.includes(transaction.type)) {
                    console.log(`修正transaction类型 ${transaction.type} -> other`);
                    logger.warn(`修正积分交易类型`, { original: transaction.type, corrected: 'other' });
                    transaction.type = 'other';
                  }
                  return transaction;
                });
              }

              return item;
            });

            // 使用选项跳过验证和中间件
            const options = {
              validateBeforeSave: false,
              timestamps: false
            };

            try {
              // 尝试批量插入
              await Model.insertMany(processedData, options);
              console.log(`已导入 ${processedData.length} 条 ${fileName} 数据`);
              logger.info(`已导入 ${processedData.length} 条 ${fileName} 数据`);
            } catch (bulkError) {
              console.error(`批量导入 ${fileName} 失败，尝试逐条导入:`, bulkError.message);
              logger.error(`批量导入 ${fileName} 失败，尝试逐条导入`, { error: bulkError.message });

              // 如果批量导入失败，尝试逐条导入
              let successCount = 0;
              for (const item of processedData) {
                try {
                  // 使用save方法而不是create，以便我们可以跳过验证
                  const doc = new Model(item);
                  doc.$__.skipValidation = true; // 内部标记，跳过验证
                  await doc.save({ validateBeforeSave: false });
                  successCount++;
                } catch (singleError) {
                  console.error(`导入单条记录失败 (${fileName}):`, singleError.message);
                  logger.error(`导入单条记录失败 (${fileName})`, { error: singleError.message });
                }
              }
              console.log(`已逐条导入 ${successCount}/${processedData.length} 条 ${fileName} 数据`);
              logger.info(`已逐条导入 ${successCount}/${processedData.length} 条 ${fileName} 数据`);
            }
          }
        } catch (parseError) {
          console.error(`解析 ${fileName} 文件失败:`, parseError.message);
          logger.error(`解析 ${fileName} 文件失败`, { error: parseError.message, stack: parseError.stack });
        }
      } else {
        console.log(`数据文件不存在: ${fileName}`);
        logger.warn(`数据文件不存在: ${fileName}`);
      }
    };

    // 定义要导入的模型和文件名
    const modelsToImport = [
      { model: User, fileName: 'users.json' },
      { model: Course, fileName: 'courses.json' },
      { model: CourseUnit, fileName: 'courseUnits.json' },
      { model: Lesson, fileName: 'lessons.json' },
      { model: Quiz, fileName: 'quizzes.json' },
      { model: Class, fileName: 'classes.json' },
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
      { model: CrowdfundingContribution, fileName: 'crowdfundingContributions.json' },
      // 新增模型导入
      { model: Contact, fileName: 'contacts.json' },
      { model: Conversation, fileName: 'conversations.json' },
      { model: Email, fileName: 'emails.json' },
      { model: EmailAccount, fileName: 'emailAccounts.json' },
      { model: EmailTemplate, fileName: 'emailTemplates.json' },
      { model: ExamConfig, fileName: 'examConfigs.json' },
      { model: FillBlankSubmission, fileName: 'fillBlankSubmissions.json' },
      { model: FlowchartSubmission, fileName: 'flowchartSubmissions.json' },
      { model: HtmlProject, fileName: 'htmlProjects.json' },
      { model: PythonSubmission, fileName: 'pythonSubmissions.json' },
      { model: Spreadsheet, fileName: 'spreadsheets.json' },
      { model: SpreadsheetSubmission, fileName: 'spreadsheetSubmissions.json' },
      { model: PracticeSession, fileName: 'practiceSessions.json' },
      { model: UserMessage, fileName: 'userMessages.json' }
    ];

    // 导入各集合数据
    try {
      for (const { model, fileName } of modelsToImport) {
        try {
          await importCollection(fileName, model);
        } catch (modelError) {
          console.error(`导入 ${fileName} 时出错:`, modelError);
          logger.error(`导入 ${fileName} 时出错`, { error: modelError.message, stack: modelError.stack });
        }
      }
    } catch (importError) {
      console.error('导入数据时出错:', importError);
      logger.error('导入数据时出错', { error: importError.message, stack: importError.stack });
    }

    // 复制上传的资源文件
    const backupUploadsDir = path.join(extractDir, 'uploads');
    const targetUploadsDir = path.join(__dirname, '../../uploads');

    if (fs.existsSync(backupUploadsDir)) {
      // 确保目标目录存在
      if (!fs.existsSync(targetUploadsDir)) {
        fs.mkdirSync(targetUploadsDir, { recursive: true });
        console.log(`创建上传目录: ${targetUploadsDir}`);
      }

      // 递归复制函数
      const copyDir = (src, dest) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });

        entries.forEach(entry => {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);

          if (entry.isDirectory()) {
            if (!fs.existsSync(destPath)) {
              fs.mkdirSync(destPath, { recursive: true });
            }
            copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        });
      };

      // 选择性地复制目录
      const dirsToCopy = [];

      // 始终复制resources目录
      const resourcesSrcDir = path.join(backupUploadsDir, 'resources');
      const resourcesDestDir = path.join(targetUploadsDir, 'resources');
      if (fs.existsSync(resourcesSrcDir)) {
        dirsToCopy.push({ src: resourcesSrcDir, dest: resourcesDestDir, name: 'resources' });
      } else {
        console.log(`备份中不包含resources目录: ${resourcesSrcDir}`);
      }

      // 根据用户选择复制 assignments 目录
      if (includeAssignments) {
        const assignmentsSrcDir = path.join(backupUploadsDir, 'assignments');
        const assignmentsDestDir = path.join(targetUploadsDir, 'assignments');
        if (fs.existsSync(assignmentsSrcDir)) {
          dirsToCopy.push({ src: assignmentsSrcDir, dest: assignmentsDestDir, name: 'assignments' });
        } else {
          console.log(`备份中不包含assignments目录: ${assignmentsSrcDir}`);
        }
      } else {
        console.log('用户选择不导入assignments目录');
      }

      // 复制其他可能存在的目录（非resources、pdf_previews、assignments）
      const entries = fs.readdirSync(backupUploadsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirName = entry.name;
          if (dirName !== 'resources' && dirName !== 'pdf_previews' && dirName !== 'assignments') {
            const otherSrcDir = path.join(backupUploadsDir, dirName);
            const otherDestDir = path.join(targetUploadsDir, dirName);
            dirsToCopy.push({ src: otherSrcDir, dest: otherDestDir, name: dirName });
          }
        } else if (entry.isFile()) {
          // 复制uploads目录下的文件
          const srcFilePath = path.join(backupUploadsDir, entry.name);
          const destFilePath = path.join(targetUploadsDir, entry.name);
          try {
            fs.copyFileSync(srcFilePath, destFilePath);
            console.log(`复制文件: ${srcFilePath} -> ${destFilePath}`);
          } catch (copyError) {
            console.error(`复制文件失败: ${entry.name}`, copyError);
          }
        }
      }

      // 执行目录复制
      for (const { src, dest, name } of dirsToCopy) {
        try {
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
          }
          console.log(`复制目录: ${src} -> ${dest}`);
          copyDir(src, dest);
          console.log(`${name}目录复制完成`);
        } catch (copyError) {
          console.error(`复制${name}目录失败:`, copyError);
        }
      }

      console.log('文件复制完成');
    } else {
      console.log(`备份中不包含上传目录: ${backupUploadsDir}`);
    }

    // 清理临时文件
    try {
      console.log('清理临时文件...');
      logger.info('开始清理临时文件');

      // 删除上传的备份文件
      if (fs.existsSync(backupFilePath)) {
        fs.unlinkSync(backupFilePath);
        console.log(`已删除临时备份文件: ${backupFilePath}`);
        logger.info(`已删除临时备份文件: ${backupFilePath}`);
      }

      // 删除解压目录
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
        console.log(`已删除解压目录: ${extractDir}`);
        logger.info(`已删除解压目录: ${extractDir}`);
      }

      console.log('临时文件清理完成');
      logger.info('临时文件清理完成');
    } catch (cleanupError) {
      console.error('清理临时文件时出错:', cleanupError);
      logger.error('清理临时文件时出错', { error: cleanupError.message, stack: cleanupError.stack });
    }

    console.log('备份导入成功');
    logger.info('备份导入成功');
    res.status(200).json({ message: '备份导入成功' });
  } catch (error) {
    console.error('导入备份时出错:', error);
    logger.error('导入备份时出错', { error: error.message, stack: error.stack });
    res.status(500).json({ message: '导入备份时出错', error: error.message });
  }
};

// 获取备份列表
exports.getBackupList = async (req, res) => {
  try {
    logger.info('获取备份列表');

    if (!fs.existsSync(BACKUP_DIR)) {
      logger.info('备份目录不存在，返回空列表');
      return res.json({ backups: [] });
    }

    const files = fs.readdirSync(BACKUP_DIR);
    const backups = [];

    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);

      // 只处理.zip文件
      if (path.extname(file) === '.zip' && stats.isFile()) {
        backups.push({
          name: file,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime
        });
      }
    }

    // 按创建时间倒序排列（最新的在前面）
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    logger.info(`找到 ${backups.length} 个备份文件`);
    res.json({ backups });
  } catch (error) {
    console.error('获取备份列表时出错:', error);
    logger.error('获取备份列表时出错', { error: error.message, stack: error.stack });
    res.status(500).json({ message: '获取备份列表失败', error: error.message });
  }
};

// 删除备份
exports.deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    logger.info('删除备份文件', { filename });

    // 验证文件名，防止路径遍历攻击
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      logger.warn('无效的备份文件名', { filename });
      return res.status(400).json({ message: '无效的文件名' });
    }

    // 确保只能删除.zip文件
    if (path.extname(filename) !== '.zip') {
      logger.warn('只能删除.zip备份文件', { filename });
      return res.status(400).json({ message: '只能删除备份文件' });
    }

    const filePath = path.join(BACKUP_DIR, filename);

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logger.warn('备份文件不存在', { filename, filePath });
      return res.status(404).json({ message: '备份文件不存在' });
    }

    // 获取文件信息用于日志
    const stats = fs.statSync(filePath);
    const fileSize = formatBytes(stats.size);

    // 删除文件
    fs.unlinkSync(filePath);

    logger.info('备份文件删除成功', { filename, size: fileSize });
    res.json({
      message: '备份文件删除成功',
      filename,
      size: fileSize
    });
  } catch (error) {
    console.error('删除备份文件时出错:', error);
    logger.error('删除备份文件时出错', { error: error.message, stack: error.stack });
    res.status(500).json({ message: '删除备份文件失败', error: error.message });
  }
};

// 仅生成备份（后台异步执行，立即返回）
exports.createBackup = async (req, res) => {
  try {
    logger.info('开始创建备份（后台执行）...');
    console.log('开始创建备份（后台执行）...');
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupFileName = `backup-${timestamp}.zip`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    // 使用临时文件名，完成后再重命名，避免未完成的文件出现在列表中
    const tempBackupPath = path.join(BACKUP_DIR, `backup-${timestamp}.tmp`);
    console.log(`备份临时文件路径: ${tempBackupPath}`);
    console.log(`备份最终文件路径: ${backupPath}`);
    logger.info(`备份临时文件路径: ${tempBackupPath}`);
    logger.info(`备份最终文件路径: ${backupPath}`);

    // 获取用户选择的备份选项
    const includeAssignments = req.query.includeAssignments === 'true';

    console.log('备份选项:', {
      includeAssignments,
      resourcesAlwaysIncluded: true
    });
    logger.info('备份选项', {
      includeAssignments,
      resourcesAlwaysIncluded: true
    });

    // 确保备份目录存在
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log(`创建备份目录: ${BACKUP_DIR}`);
    }

    // 立即返回响应，告知用户备份已开始生成
    res.json({
      message: '备份已开始生成，请稍后刷新列表查看',
      backupFileName: backupFileName,
      status: 'started'
    });

    // 在后台异步执行备份生成
    setImmediate(async () => {
      try {
        const output = fs.createWriteStream(tempBackupPath);
        const archive = archiver('zip', {
          zlib: { level: 9 } // 最高压缩级别
        });

        // 使用 Promise 来处理异步操作
        const archivePromise = new Promise((resolve, reject) => {
          output.on('close', () => {
            console.log(`备份完成: ${archive.pointer()} 总字节`);
            logger.info(`备份完成: ${archive.pointer()} 总字节`);
            resolve();
          });

          archive.on('error', (err) => {
            console.error('创建备份时出错:', err);
            reject(err);
          });

          archive.on('warning', (err) => {
            console.warn('备份警告:', err);
          });
        });

        // 将输出流连接到归档
        archive.pipe(output);

        // 获取所有集合的数据
        console.log('开始获取数据...');

        // 定义要备份的模型和文件名
        const modelsToBackup = [
          { model: User, fileName: 'users.json' },
          { model: Course, fileName: 'courses.json' },
          { model: CourseUnit, fileName: 'courseUnits.json' },
          { model: Lesson, fileName: 'lessons.json' },
          { model: Quiz, fileName: 'quizzes.json' },
          { model: Class, fileName: 'classes.json' },
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
          { model: CrowdfundingContribution, fileName: 'crowdfundingContributions.json' },
          // 新增模型备份
          { model: Contact, fileName: 'contacts.json' },
          { model: Conversation, fileName: 'conversations.json' },
          { model: Email, fileName: 'emails.json' },
          { model: EmailAccount, fileName: 'emailAccounts.json' },
          { model: EmailTemplate, fileName: 'emailTemplates.json' },
          { model: ExamConfig, fileName: 'examConfigs.json' },
          { model: FillBlankSubmission, fileName: 'fillBlankSubmissions.json' },
          { model: FlowchartSubmission, fileName: 'flowchartSubmissions.json' },
          { model: HtmlProject, fileName: 'htmlProjects.json' },
          { model: PythonSubmission, fileName: 'pythonSubmissions.json' },
          { model: Spreadsheet, fileName: 'spreadsheets.json' },
          { model: SpreadsheetSubmission, fileName: 'spreadsheetSubmissions.json' },
          { model: PracticeSession, fileName: 'practiceSessions.json' },
          { model: UserMessage, fileName: 'userMessages.json' }
        ];

        // 获取并添加所有模型数据到归档
        for (const { model, fileName } of modelsToBackup) {
          try {
            const data = await model.find({}).lean();
            console.log(`获取到 ${data.length} 个 ${model.modelName} 记录`);
            archive.append(JSON.stringify(data, null, 2), { name: fileName });
          } catch (err) {
            console.error(`获取 ${model.modelName} 数据时出错:`, err);
            // 继续处理其他模型
          }
        }

        console.log('数据添加到归档完成');

        // 添加上传的资源文件，根据用户选择有选择地添加
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (fs.existsSync(uploadsDir)) {
          console.log(`处理上传目录: ${uploadsDir}`);

          // 始终备份resources目录
          const resourcesDir = path.join(uploadsDir, 'resources');
          if (fs.existsSync(resourcesDir)) {
            console.log(`添加resources目录: ${resourcesDir}`);
            archive.directory(resourcesDir, 'uploads/resources');
          } else {
            console.log(`resources目录不存在: ${resourcesDir}`);
          }

          // 根据用户选择备份 assignments 目录
          if (includeAssignments) {
            const assignmentsDir = path.join(uploadsDir, 'assignments');
            if (fs.existsSync(assignmentsDir)) {
              console.log(`添加assignments目录: ${assignmentsDir}`);
              archive.directory(assignmentsDir, 'uploads/assignments');
            } else {
              console.log(`assignments目录不存在: ${assignmentsDir}`);
            }
          } else {
            console.log('用户选择不备份assignments目录');
          }

          // 备份其他可能存在的目录（非resources、pdf_previews、assignments）
          const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const dirName = entry.name;
              if (dirName !== 'resources' && dirName !== 'pdf_previews' && dirName !== 'assignments' && dirName !== 'temp') {
                const otherDir = path.join(uploadsDir, dirName);
                console.log(`添加其他目录: ${otherDir}`);
                archive.directory(otherDir, `uploads/${dirName}`);
              }
            } else if (entry.isFile()) {
              // 备份uploads目录下的文件
              const filePath = path.join(uploadsDir, entry.name);
              console.log(`添加文件: ${filePath}`);
              archive.file(filePath, { name: `uploads/${entry.name}` });
            }
          }
        } else {
          console.log(`上传目录不存在: ${uploadsDir}`);
        }

        // 完成归档
        console.log('完成归档...');
        await archive.finalize();
        await archivePromise;
        console.log('归档已完成');

        // 重命名临时文件为最终文件名
        fs.renameSync(tempBackupPath, backupPath);
        console.log(`已将临时文件重命名为: ${backupFileName}`);

        // 获取文件信息
        const stats = fs.statSync(backupPath);
        logger.info('备份创建成功', { filename: backupFileName, size: formatBytes(stats.size) });
        console.log(`备份创建成功: ${backupFileName} (${formatBytes(stats.size)})`);
      } catch (bgError) {
        console.error('后台创建备份时出错:', bgError);
        logger.error('后台创建备份时出错', { error: bgError.message, stack: bgError.stack });
        // 如果备份失败，删除可能生成的不完整临时文件
        if (fs.existsSync(tempBackupPath)) {
          try {
            fs.unlinkSync(tempBackupPath);
            console.log('已删除不完整的临时备份文件');
          } catch (unlinkErr) {
            console.error('删除不完整临时备份文件失败:', unlinkErr);
          }
        }
      }
    });
  } catch (error) {
    console.error('启动备份任务时出错:', error);
    logger.error('启动备份任务时出错', { error: error.message, stack: error.stack });
    res.status(500).json({ message: '启动备份任务时出错', error: error.message });
  }
};

// 下载备份文件
exports.downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    logger.info('下载备份文件', { filename });

    // 验证文件名，防止路径遍历攻击
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      logger.warn('无效的备份文件名', { filename });
      return res.status(400).json({ message: '无效的文件名' });
    }

    // 确保只能下载.zip文件
    if (path.extname(filename) !== '.zip') {
      logger.warn('只能下载.zip备份文件', { filename });
      return res.status(400).json({ message: '只能下载备份文件' });
    }

    const filePath = path.join(BACKUP_DIR, filename);

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logger.warn('备份文件不存在', { filename, filePath });
      return res.status(404).json({ message: '备份文件不存在' });
    }

    // 获取文件信息
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    logger.info('开始下载备份文件', { filename, size: formatBytes(fileSize) });

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', fileSize);

    // 创建文件读取流并管道到响应
    const fileStream = fs.createReadStream(filePath);

    fileStream.on('error', (err) => {
      console.error('读取备份文件时出错:', err);
      logger.error('读取备份文件时出错', { error: err.message, stack: err.stack });
      if (!res.headersSent) {
        res.status(500).json({ message: '读取备份文件时出错', error: err.message });
      }
    });

    fileStream.on('end', () => {
      logger.info('备份文件下载完成', { filename });
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error('下载备份文件时出错:', error);
    logger.error('下载备份文件时出错', { error: error.message, stack: error.stack });
    res.status(500).json({ message: '下载备份文件时出错', error: error.message });
  }
};

// 格式化字节大小为人类可读格式
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}