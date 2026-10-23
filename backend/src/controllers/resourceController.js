const Lesson = require('../models/Lesson');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const mkdir = promisify(fs.mkdir);
const logger = require('../utils/logger');
const { safeDownloadPath } = require('../utils/safeDownloadPath');

// 确保上传目录存在
const UPLOAD_DIR = path.join(__dirname, '../../uploads/resources');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

exports.uploadActivityResource = async (req, res) => {
  try {
    if (!req.file) {
      logger.warn('没有上传文件');
      return res.status(400).json({ message: '没有上传文件' });
    }

    const { courseId, unitId, lessonId } = req.params;
    const { activityIndex } = req.body;

    // 获取课时信息
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      logger.warn('课时不存在', { lessonId });
      return res.status(404).json({ message: '课时不存在' });
    }

    // 对文件名进行解码和处理
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // 构建资源对象
    const resource = {
      title: originalName,
      type: getFileType(originalName),
      filename: originalName,
      path: path.join('resources', courseId, unitId, lessonId, req.file.filename).split(path.sep).join('/'), // 使用相对路径，统一使用正斜杠
      size: req.file.size,
      uploadTime: new Date()
    };

    // 添加资源到指定活动
    if (!lesson.activities[activityIndex].resources) {
      lesson.activities[activityIndex].resources = [];
    }
    lesson.activities[activityIndex].resources.push(resource);

    // 保存更新
    await lesson.save();

    logger.info('文件上传成功', { resource });
    res.json({
      message: '文件上传成功',
      resource
    });
  } catch (error) {
    logger.error('文件上传失败', { error: error.message });
    res.status(500).json({ message: '文件上传失败', error: error.message });
  }
};

// 获取文件类型
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const typeMap = {
    '.doc': 'document',
    '.docx': 'document',
    '.pdf': 'document',
    '.ppt': 'document',
    '.pptx': 'document',
    '.xls': 'document',
    '.xlsx': 'document',
    '.txt': 'document',
    '.c': 'document',
    '.cpp': 'document',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.gif': 'image',
    '.mp4': 'video',
    '.avi': 'video',
    '.mp3': 'audio',
    '.wav': 'audio',
    '.py': 'document',
    '.zip': 'other',
    '.rar': 'other'
  };
  return typeMap[ext] || 'other';
}

// 下载资源
exports.downloadResource = async (req, res) => {
  try {
    const filePath = await safeDownloadPath(UPLOAD_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) {
      logger.warn('文件不存在', { filename: req.params.filename });
      return res.status(404).json({ message: '文件不存在' });
    }
    
    // 设置正确的 Content-Type
    const ext = path.extname(req.params.filename).toLowerCase();
    const mimeTypes = {
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pdf': 'application/pdf',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.py': 'text/plain',
    '.c': 'text/x-c',
    '.cpp': 'text/x-c++',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(req.params.filename)}`);
    logger.info('开始下载文件', { filename: req.params.filename });
    res.sendFile(filePath);
  } catch (error) {
    logger.error('文件下载失败', { error: error.message });
    res.status(error.status || (error.code === 'ENOENT' ? 404 : 500)).json({ message: '文件不存在或无权访问' });
  }
};

// 删除资源
exports.deleteResource = async (req, res) => {
  try {
    const { courseId, unitId, lessonId, filename } = req.params;

    // 获取课时信息
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      logger.warn('课时不存在', { lessonId });
      return res.status(404).json({ message: '课时不存在' });
    }

    // 删除文件
    const filePath = path.join(UPLOAD_DIR, courseId, unitId, lessonId, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info('文件已删除', { filename });
    }

    // 从数据库中移除资源记录
    for (let activity of lesson.activities) {
      activity.resources = activity.resources.filter(resource => !resource.path.endsWith(filename));
    }
    await lesson.save();

    res.json({ message: '资源删除成功' });
  } catch (error) {
    logger.error('删除资源失败', { error: error.message });
    res.status(500).json({ message: '删除资源失败', error: error.message });
  }
};
