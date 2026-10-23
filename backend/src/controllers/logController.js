const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const logController = {
  // 获取日志文件列表
  async getLogFiles(req, res) {
    try {
      const logDir = path.join(__dirname, '../../logs');
      const files = await fs.readdir(logDir);

      // 获取文件信息
      const filePromises = files.map(async (file) => {
        const filePath = path.join(logDir, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          size: stats.size,
          createdAt: stats.birthtime,
          updatedAt: stats.mtime
        };
      });

      const fileInfos = await Promise.all(filePromises);

      // 按更新时间排序
      fileInfos.sort((a, b) => b.updatedAt - a.updatedAt);

      res.json({
        success: true,
        data: fileInfos
      });
    } catch (error) {
      logger.error('获取日志文件列表失败', { error: error.message });
      res.status(500).json({ message: '获取日志文件列表失败' });
    }
  },

  // 获取指定日志文件的内容
  async getLogContent(req, res) {
    try {
      const { filename } = req.params;
      const { limit = 500 } = req.query; // 默认限制500条
      const logDir = path.join(__dirname, '../../logs');
      const filePath = path.join(logDir, filename);

      // 安全检查：确保文件在日志目录内
      if (!filePath.startsWith(logDir)) {
        logger.warn('尝试访问非法日志文件', { filename });
        return res.status(403).json({ message: '非法的文件访问' });
      }

      // 检查文件是否存在
      try {
        await fs.access(filePath);
      } catch {
        logger.warn('尝试访问不存在的日志文件', { filename });
        return res.status(404).json({ message: '日志文件不存在' });
      }

      // 获取文件大小
      const stats = await fs.stat(filePath);
      const fileSizeKB = (stats.size / 1024).toFixed(1);

      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8');

      // 将日志内容解析为结构化数据，只保留最后 limit 条
      const allLines = content.split('\n').filter(line => line.trim());
      const totalLines = allLines.length;
      const limitedLines = allLines.slice(-parseInt(limit));

      const logs = limitedLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      });

      res.json({
        success: true,
        data: {
          filename,
          logs,
          totalLines,
          displayedLines: logs.length,
          fileSizeKB,
          truncated: totalLines > parseInt(limit)
        }
      });
    } catch (error) {
      logger.error('获取日志内容失败', {
        error: error.message,
        filename: req.params.filename
      });
      res.status(500).json({ message: '获取日志内容失败' });
    }
  },

  // 获取实时日志（最新的 n 条）
  async getRecentLogs(req, res) {
    try {
      const { limit = 100 } = req.query;
      const logDir = path.join(__dirname, '../../logs');
      const today = new Date().toISOString().split('T')[0];
      const combinedLogFile = path.join(logDir, `combined-${today}.log`);
      const errorLogFile = path.join(logDir, `error-${today}.log`);

      let logs = [];

      // 读取综合日志
      try {
        const content = await fs.readFile(combinedLogFile, 'utf-8');
        logs = content.split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return { raw: line };
            }
          })
          .slice(-limit);
      } catch (error) {
        logger.warn('读取综合日志失败', { error: error.message });
      }

      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      logger.error('获取实时日志失败', { error: error.message });
      res.status(500).json({ message: '获取实时日志失败' });
    }
  },

  // 下载日志文件
  async downloadLogFile(req, res) {
    try {
      const { filename } = req.params;
      const logDir = path.join(__dirname, '../../logs');
      const filePath = path.join(logDir, filename);

      // 安全检查
      if (!filePath.startsWith(logDir)) {
        return res.status(403).json({ message: '非法的文件访问' });
      }

      // 检查文件是否存在
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ message: '日志文件不存在' });
      }

      res.download(filePath, filename);
    } catch (error) {
      logger.error('下载日志文件失败', { error: error.message });
      res.status(500).json({ message: '下载日志文件失败' });
    }
  },

  // 清空日志文件
  async clearLogFile(req, res) {
    try {
      const { filename } = req.params;
      const logDir = path.join(__dirname, '../../logs');
      const filePath = path.join(logDir, filename);

      // 安全检查
      if (!filePath.startsWith(logDir)) {
        return res.status(403).json({ message: '非法的文件访问' });
      }

      // 检查文件是否存在
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ message: '日志文件不存在' });
      }

      // 清空文件内容
      await fs.writeFile(filePath, '');
      logger.info('日志文件已清空', { filename });

      res.json({
        success: true,
        message: '日志文件已清空'
      });
    } catch (error) {
      logger.error('清空日志文件失败', { error: error.message });
      res.status(500).json({ message: '清空日志文件失败' });
    }
  },

  // 批量清空所有日志文件
  async clearAllLogs(req, res) {
    try {
      const logDir = path.join(__dirname, '../../logs');
      const files = await fs.readdir(logDir);

      let clearedCount = 0;
      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(logDir, file);
          await fs.writeFile(filePath, '');
          clearedCount++;
        }
      }

      logger.info('所有日志文件已清空', { clearedCount });

      res.json({
        success: true,
        message: `已清空 ${clearedCount} 个日志文件`,
        clearedCount
      });
    } catch (error) {
      logger.error('批量清空日志失败', { error: error.message });
      res.status(500).json({ message: '批量清空日志失败' });
    }
  }
};

module.exports = logController; 