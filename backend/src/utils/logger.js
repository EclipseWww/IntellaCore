const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const { redactLog } = require('./redactLog');

// 定义日志级别
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// 定义日志颜色
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

// 添加颜色支持
winston.addColors(colors);

// 创建格式化器
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${
      Object.keys(meta).length ? JSON.stringify(redactLog(meta)) : ''
    }`;
  })
);

// 创建日志文件路径
const logDir = path.join(__dirname, '../../logs');

// 创建 Winston logger 实例
const logger = winston.createLogger({
  levels,
  format,
  transports: [
    // 错误日志文件
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
    }),
    // 所有日志文件
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        format
      ),
    }),
  ],
});

// 导出日志实例
module.exports = logger;

// 使用示例：
// logger.error('这是一个错误日志');
// logger.warn('这是一个警告日志');
// logger.info('这是一个信息日志');
// logger.debug('这是一个调试日志');
