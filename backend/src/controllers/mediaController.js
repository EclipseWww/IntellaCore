const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const mkdir = promisify(fs.mkdir);
const logger = require('../utils/logger');

// 确保上传目录存在
const PUBLIC_MEDIA_DIR = path.join(__dirname, '../../uploads/public/media');
if (!fs.existsSync(PUBLIC_MEDIA_DIR)) {
  fs.mkdirSync(PUBLIC_MEDIA_DIR, { recursive: true });
}

/**
 * 上传媒体文件（图片或视频）到公共目录
 * 该媒体文件可以不需要token直接访问
 */
exports.uploadMedia = async (req, res) => {
  try {
    logger.info('上传公共媒体文件');
    
    if (!req.file) {
      logger.warn('没有上传文件');
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }

    const { courseId, unitId, lessonId } = req.params;
    
    // 获取文件扩展名并确定媒体类型
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isVideo = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mkv'].includes(ext);
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
    const mediaType = isVideo ? 'video' : isImage ? 'image' : 'other';
    
    // 添加特殊文件夹映射逻辑，对题库相关的媒体文件进行分类处理
    let mediaPath;
    if (courseId === 'question-bank') {
      // 题库相关的媒体文件
      const questionType = unitId; // 题目类型作为第二级目录
      const questionId = lessonId;  // 题目ID作为第三级目录
      mediaPath = `/public/media/question-bank/${questionType}/${questionId}/${req.file.filename}`;
      logger.info('题库媒体文件上传', { courseId: 'question-bank', questionType, questionId });
    } else {
      // 常规课程媒体文件
      mediaPath = `/public/media/${courseId}/${unitId}/${lessonId}/${req.file.filename}`;
    }
    
    // 构建媒体对象
    const media = {
      originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      filename: req.file.filename,
      path: mediaPath, // 公开访问的URL路径
      fullPath: req.file.path,
      size: req.file.size,
      mediaType: mediaType, // 添加媒体类型
      uploadTime: new Date()
    };

    logger.info('媒体文件上传成功', { media });
    res.json({
      success: true,
      message: '媒体文件上传成功',
      data: media
    });
  } catch (error) {
    logger.error('媒体文件上传失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '媒体文件上传失败', error: error.message });
  }
}; 

/**
 * 获取指定课程、单元、课时的公开媒体文件列表
 */
exports.getMediaFiles = async (req, res) => {
  try {
    const { courseId, unitId, lessonId } = req.params;
    logger.info('获取公开媒体文件列表', { courseId, unitId, lessonId });
    
    // 构建目录路径
    let dirPath;
    
    // 题库媒体文件特殊处理
    if (courseId === 'question-bank') {
      if (lessonId) {
        // 题目类型作为第二级目录，题目ID作为第三级目录
        dirPath = path.join(PUBLIC_MEDIA_DIR, courseId, unitId, lessonId);
      } else if (unitId) {
        // 题目类型作为第二级目录
        dirPath = path.join(PUBLIC_MEDIA_DIR, courseId, unitId);
      } else {
        // 整个题库的媒体
        dirPath = path.join(PUBLIC_MEDIA_DIR, courseId);
      }
      logger.info('查询题库媒体文件', { dirPath });
    } else {
      // 常规课程媒体文件
      if (lessonId) {
        dirPath = path.join(PUBLIC_MEDIA_DIR, courseId, unitId, lessonId);
      } else if (unitId) {
        dirPath = path.join(PUBLIC_MEDIA_DIR, courseId, unitId);
      } else if (courseId) {
        dirPath = path.join(PUBLIC_MEDIA_DIR, courseId);
      } else {
        return res.status(400).json({ 
          success: false, 
          message: '请提供至少一个参数：courseId, unitId 或 lessonId' 
        });
      }
    }
    
    // 检查目录是否存在
    if (!fs.existsSync(dirPath)) {
      logger.info('没有找到公开媒体文件', { dirPath });
      return res.json({
        success: true,
        message: '没有找到公开媒体文件',
        data: []
      });
    }
    
    // 读取目录及其子目录下的所有文件
    const getAllFiles = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat && stat.isDirectory()) {
          // 如果是目录，递归获取子目录中的文件
          results = results.concat(getAllFiles(filePath));
        } else {
          // 判断文件类型
          const ext = path.extname(file).toLowerCase();
          const isVideo = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mkv'].includes(ext);
          const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
          
          if (isImage || isVideo) {
            // 获取文件的相对路径（用于构建URL）
            const relativePath = path.relative(PUBLIC_MEDIA_DIR, filePath).split(path.sep).join('/');
            
            results.push({
              filename: file,
              path: `/public/media/${relativePath}`,
              size: stat.size,
              mediaType: isVideo ? 'video' : 'image',
              uploadTime: stat.mtime // 使用文件修改时间作为上传时间
            });
          }
        }
      });
      
      return results;
    };
    
    const mediaFiles = getAllFiles(dirPath);
    logger.info('获取公开媒体文件列表成功', { count: mediaFiles.length });
    
    res.json({
      success: true,
      message: '获取公开媒体文件列表成功',
      data: mediaFiles
    });
  } catch (error) {
    logger.error('获取公开媒体文件列表失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取公开媒体文件列表失败', error: error.message });
  }
};

/**
 * 删除指定的公开媒体文件
 */
exports.deleteMedia = async (req, res) => {
  try {
    const { courseId, unitId, lessonId, filename } = req.params;
    logger.info('删除公开媒体文件', { courseId, unitId, lessonId, filename });
    
    // 构建文件路径
    let filePath;
    
    // 题库媒体文件特殊处理
    if (courseId === 'question-bank') {
      // 题目类型作为第二级目录，题目ID作为第三级目录
      filePath = path.join(PUBLIC_MEDIA_DIR, courseId, unitId, lessonId, filename);
      logger.info('删除题库媒体文件', { filePath });
    } else {
      // 常规课程媒体文件
      filePath = path.join(PUBLIC_MEDIA_DIR, courseId, unitId, lessonId, filename);
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logger.warn('媒体文件不存在', { filePath });
      return res.status(404).json({ success: false, message: '媒体文件不存在' });
    }
    
    // 删除文件
    fs.unlinkSync(filePath);
    
    logger.info('媒体文件删除成功', { filename });
    res.json({
      success: true,
      message: '媒体文件删除成功'
    });
  } catch (error) {
    logger.error('删除媒体文件失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '删除媒体文件失败', error: error.message });
  }
}; 