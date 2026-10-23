const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { safeDownloadPath } = require('../utils/safeDownloadPath');
const { checkAssignmentDownload } = require('../services/downloadAccess');

// 统一下载处理函数
exports.downloadFile = async (req, res) => {
  try {
    const { fileType, filePath } = req.params;
    logger.info('下载文件请求', { fileType, filePath, userId: req.user?._id });
    
    // 根据文件类型确定基础目录
    let baseDir;
    switch (fileType) {
      case 'assignment':
        baseDir = 'uploads/assignments';
        break;
      case 'resource':
        baseDir = 'uploads/resources';
        break;
      case 'preview':
        baseDir = 'uploads/pdf_previews';
        break;
      default:
        logger.warn('无效的文件类型', { fileType });
        return res.status(400).json({ message: '无效的文件类型' });
    }

    // 构建完整的文件路径
    const absolutePath = await safeDownloadPath(path.join(__dirname, '../..', baseDir), filePath);
    if (fileType !== 'resource') await checkAssignmentDownload(req.user, absolutePath, fileType === 'preview');
    logger.info('文件路径构建', { 
      fileType, 
      baseDir, 
      filePath, 
      absolutePath 
    });

    // 检查文件是否存在
    if (!fs.existsSync(absolutePath)) {
      logger.warn('请求的文件不存在', { absolutePath });
      return res.status(404).json({ message: '文件不存在' });
    }

    // 获取文件信息
    const stats = fs.statSync(absolutePath);
    const fileName = path.basename(absolutePath);
    const ext = path.extname(fileName).toLowerCase();

    // MIME类型映射
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.py': 'text/plain',
      '.js': 'text/plain',
      '.c': 'text/x-c',
      '.cpp': 'text/x-c++',
      '.json': 'application/json',
      '.csv': 'text/csv',
      // images
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      // audio
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      // video
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska'
    };

    const isMedia = ['.mp4', '.avi', '.webm', '.mov', '.mkv', '.mp3', '.wav', '.ogg'].includes(ext);
    const inline = req.query.inline === '1' || req.query.inline === 'true';

    // 如果是媒体文件并且带有 Range 请求头，则按分块返回，支持拖拽/快进
    const range = req.headers.range;
    if (isMedia && range) {
      try {
        const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB per chunk
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + CHUNK_SIZE - 1, stats.size - 1);
        if (isNaN(start) || isNaN(end) || start < 0 || start > end || end >= stats.size) {
          logger.warn('无效的 Range 请求', { range, start, end, size: stats.size });
          return res.status(416).set({ 'Content-Range': `bytes */${stats.size}` }).end();
        }

        const contentLength = end - start + 1;
        const headers = {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': contentLength,
          'Content-Type': mimeTypes[ext] || 'application/octet-stream'
        };
        if (inline) {
          headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`;
        }

        logger.info('媒体 Range 响应', { fileName, start, end, size: stats.size });
        res.writeHead(206, headers);
        const stream = fs.createReadStream(absolutePath, { start, end });
        stream.on('error', (error) => {
          logger.error('媒体分块读取错误', { error: error.message, stack: error.stack, fileName });
          if (!res.headersSent) {
            res.status(500).json({ message: '读取文件失败', error: error.message });
          }
        });
        return stream.pipe(res);
      } catch (e) {
        logger.error('处理 Range 请求失败', { error: e.message, stack: e.stack });
        // 回退到普通下载
      }
    }

    // 设置响应头
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Length', stats.size);
    if (isMedia) {
      res.setHeader('Accept-Ranges', 'bytes');
    }
    res.setHeader(
      'Content-Disposition',
      inline ? `inline; filename*=UTF-8''${encodeURIComponent(fileName)}` : `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );

    logger.info('开始下载文件', { fileName, fileSize: stats.size, mimeType: mimeTypes[ext] || 'application/octet-stream' });

    // 创建文件流并发送
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.on('error', (error) => {
      logger.error('文件流读取错误', { error: error.message, stack: error.stack, fileName });
      if (!res.headersSent) {
        res.status(500).json({ message: '读取文件失败', error: error.message });
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    logger.error('下载文件失败', { error: error.message, stack: error.stack });
    const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
    res.status(status).json({ message: status === 404 ? '文件不存在' : status === 403 ? '无权访问此文件' : '下载文件失败' });
  }
};
