const Setting = require('../models/Setting');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const User = require('../models/User');
const Class = require('../models/Class');
const Course = require('../models/Course');
const fs = require('fs');
const path = require('path');
const util = require('util');
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const logger = require('../utils/logger');
const semesterUtils = require('../utils/semesterUtils');

// A single, bounded traversal counts files and bytes, without following symlinks.
async function scanDirectory(root) {
  let size = 0, fileCount = 0;
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    let entries;
    try { entries = await fs.promises.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const entry of entries) {
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(location);
      else if (entry.isFile()) {
        try { size += (await stat(location)).size; fileCount++; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
  }
  return { size, fileCount };
}

const settingController = {
  // 获取设置
  async getSetting(req, res) {
    try {
      logger.info('获取设置', { key: req.params.key });
      const { key } = req.params;
      const setting = await Setting.findOne({ key });
      if (!setting && key === 'rag.enabled') return res.json({ key, value: false });
      if (!setting) {
        logger.warn('设置不存在', { key });
        return res.status(404).json({ message: '设置不存在' });
      }
      res.json(setting.key === 'studentLogoutPassword' ? { key: setting.key, configured: true } : setting);
    } catch (error) {
      logger.error('获取设置失败', { error: error.message, stack: error.stack });
      res.status(500).json({ message: '服务器错误' });
    }
  },

  // 更新设置
  async updateSetting(req, res) {
    try {
      logger.info('更新设置', { key: req.params.key });
      const { key } = req.params;
      let { value, description } = req.body;
      if (key === 'rag.enabled') {
        if (req.user.role !== 'admin') return res.status(403).json({ message: '仅管理员可以修改此开关' });
        if (typeof value !== 'boolean') return res.status(400).json({ message: '开关必须为布尔值' });
      }
      if (key === 'studentLogoutPassword') {
        if (req.user.role !== 'admin') return res.status(403).json({ message: '仅管理员可以设置退出密码' });
        if (typeof value !== 'string' || value.length > 72) return res.status(400).json({ message: '密码须为字符串，最多72个字符，可留空' });
        value = await require('bcryptjs').hash(value, 12);
      }

      const setting = await Setting.findOneAndUpdate(
        { key },
        { value, description },
        { new: true, upsert: true }
      );

      res.json(setting.key === 'studentLogoutPassword' ? { key: setting.key, configured: true } : setting);
    } catch (error) {
      logger.error('更新设置失败', { error: error.message, stack: error.stack });
      res.status(500).json({ message: '服务器错误' });
    }
  },

  // 获取所有设置
  async getAllSettings(req, res) {
    try {
      logger.info('获取所有设置');
      const settings = await Setting.find();
      res.json(settings.map(s => s.key === 'studentLogoutPassword' ? { key: s.key, configured: true } : s));
    } catch (error) {
      logger.error('获取所有设置失败', { error: error.message, stack: error.stack });
      res.status(500).json({ message: '服务器错误' });
    }
  },

  // 获取系统统计信息
  async getSystemStats(req, res) {
    try {
      logger.info('获取系统统计信息');
      
      // 统计上传目录信息
      const uploadsPath = path.join(__dirname, '../../uploads');
      const uploadsFolders = {};
      
      // 检查上传目录是否存在
      if (fs.existsSync(uploadsPath)) {
        // 获取上传目录下的所有文件夹
        const folders = await readdir(uploadsPath);
        
        // 统计每个子文件夹的信息
        for (const folder of folders) {
          const folderPath = path.join(uploadsPath, folder);
          const folderStat = await fs.promises.lstat(folderPath);
          
          // 只统计目录
          if (folderStat.isDirectory()) {
            const { size, fileCount } = await scanDirectory(folderPath);
            
            uploadsFolders[folder] = {
              name: folder,
              size,
              fileCount,
              sizeFormatted: formatBytes(size)
            };
          }
        }
      }
      
      // 计算总大小和总文件数
      const totalSize = Object.values(uploadsFolders).reduce((total, folder) => total + folder.size, 0);
      const totalFileCount = Object.values(uploadsFolders).reduce((total, folder) => total + folder.fileCount, 0);
      
      // 获取当前服务器时间
      const serverTime = new Date();
      
      // 获取当前学期
      const currentSemester = semesterUtils.getCurrentSemester();
      
      // 获取当前有效年级
      const validGrades = semesterUtils.getCurrentValidGrades();
      
      // 获取系统运行信息
      const systemInfo = {
        uptime: process.uptime(), // 系统运行时间（秒）
        memoryUsage: process.memoryUsage(), // 内存使用情况
        cpuUsage: process.cpuUsage(), // CPU使用情况
        nodeVersion: process.version, // Node.js版本
        platform: process.platform, // 平台信息
        arch: process.arch, // 架构信息
        serverTime: serverTime, // 服务器当前时间
        currentSemester: currentSemester, // 当前学期
        validGrades: validGrades // 当前有效年级
      };
      
      // 获取按班级和课程分类的文件统计
      const fileStatsByClass = await getFileStatsByClassAndCourse();
      
      res.json({
        uploadsStats: {
          totalSize,
          totalSizeFormatted: formatBytes(totalSize),
          totalFileCount,
          folders: uploadsFolders
        },
        fileStatsByClass,
        systemInfo
      });
    } catch (error) {
      logger.error('获取系统统计信息失败', { error: error.message, stack: error.stack });
      res.status(500).json({ message: '服务器错误' });
    }
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

// 获取按班级和课程分类的文件统计
async function getFileStatsByClassAndCourse() {
  try {
    logger.info('开始获取按班级和课程分类的文件统计');
    
    const result = {
      courses: {},
      classes: {}
    };
    
    // 获取所有作业提交记录，并关联课程和学生信息
    const submissions = await AssignmentSubmission.find({})
      .populate('course', 'title instructor')
      .populate({
        path: 'course',
        populate: {
          path: 'instructor',
          select: 'name'
        }
      })
      .populate('student', 'name classId')
      .populate({
        path: 'student',
        populate: {
          path: 'classId',
          select: 'grade name'
        }
      })
      .select('course student content.file').lean();
    
    logger.info(`找到 ${submissions.length} 条作业提交记录`);
    
    // 统计每个提交记录的文件信息
    let processedCount = 0;
    let totalFileCount = 0;
    let totalFileSize = 0;
    
    for (const submission of submissions) {
      try {
        const { fileCount, size: fileSize } = await getSubmissionStats(submission);
        
        if (fileCount > 0) {
          totalFileCount += fileCount;
          totalFileSize += fileSize;
          processedCount++;
          
          logger.debug('处理提交记录', {
            submissionId: submission._id,
            fileCount,
            fileSize: formatBytes(fileSize),
            courseName: submission.course?.title,
            className: submission.student?.classId ? `${submission.student.classId.grade}级${submission.student.classId.name}班` : '未知班级'
          });
        }
        
        // 按课程统计
        if (submission.course) {
          const courseTitle = submission.course.title || '未知课程';
          const instructorName = submission.course.instructor?.name || '未知教师';
          
          if (!result.courses[courseTitle]) {
            result.courses[courseTitle] = {
              fileCount: 0,
              size: 0,
              sizeFormatted: '0 B',
              instructor: instructorName
            };
          }
          
          result.courses[courseTitle].fileCount += fileCount;
          result.courses[courseTitle].size += fileSize;
          result.courses[courseTitle].sizeFormatted = formatBytes(result.courses[courseTitle].size);
        }
        
        // 按班级统计
        if (submission.student && submission.student.classId) {
          const classInfo = submission.student.classId;
          const className = `${classInfo.grade}级${classInfo.name}班`;
          
          if (!result.classes[className]) {
            // 统计班级学生数量
            const studentCount = await User.countDocuments({
              classId: classInfo._id,
              role: 'student'
            });
            
            result.classes[className] = {
              fileCount: 0,
              size: 0,
              sizeFormatted: '0 B',
              studentCount
            };
          }
          
          result.classes[className].fileCount += fileCount;
          result.classes[className].size += fileSize;
          result.classes[className].sizeFormatted = formatBytes(result.classes[className].size);
        }
      } catch (error) {
        logger.warn('处理提交记录时出错', { 
          submissionId: submission._id, 
          error: error.message 
        });
      }
    }
    
    logger.info('文件统计处理完成', { 
      totalSubmissions: submissions.length,
      processedWithFiles: processedCount,
      totalFileCount,
      totalFileSize: formatBytes(totalFileSize)
    });
    
    logger.info('文件统计完成', { 
      courseCount: Object.keys(result.courses).length,
      classCount: Object.keys(result.classes).length
    });
    
    return result;
  } catch (error) {
    logger.error('获取文件统计失败', { error: error.message, stack: error.stack });
    return { courses: {}, classes: {} };
  }
}

// 计算单个提交记录的文件数量
async function getSubmissionStats(submission) {
  const file = submission.content?.file;
  let size = 0, fileCount = 0;
  if (!file) return { size, fileCount };
  for (const [storedPath, deleted] of [[file.path, file.fileDeleted], [file.pdfPreviewPath, file.pdfPreviewDeleted]]) {
    if (!storedPath || deleted) continue;
    const location = path.isAbsolute(storedPath) ? storedPath : path.resolve(__dirname, '../..', storedPath);
    try {
      const info = await stat(location);
      if (info.isFile()) { size += info.size; fileCount++; }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { size, fileCount };
}

const { runController } = require('../services/maintenanceTasks');
const calculateStats = settingController.getSystemStats;
let cachedStats = null;
let updatedAt = 0;
let refreshing = null;
let refreshError = null;
let failedAt = 0;
let generation = 0;
settingController.invalidateStats = () => { generation++; updatedAt = 0; };
settingController.getSystemStats = (req, res) => {
  if (!refreshing && Date.now() - failedAt > 10000 && (!cachedStats || Date.now() - updatedAt > 5 * 60 * 1000)) {
    refreshError = null;
    const scanGeneration = generation;
    refreshing = runController(calculateStats, req).then(result => {
      cachedStats = result;
      updatedAt = scanGeneration === generation ? Date.now() : 0;
    }).catch(error => { refreshError = error.message; failedAt = Date.now(); })
      .finally(() => { refreshing = null; });
  }
  res.set('Cache-Control', 'no-store');
  if (!cachedStats && refreshError) return res.status(503).json({ message: refreshError });
  if (!cachedStats) return res.status(202).json({ status: 'running', message: refreshError });
  res.json({ ...cachedStats, cache: { updatedAt, refreshing: !!refreshing } });
};
module.exports = settingController;
