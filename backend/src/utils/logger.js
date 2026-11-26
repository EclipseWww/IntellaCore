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

// 单条附加内容的最大长度，避免把整份课时/备份数据写进日志
const MAX_ARG_LENGTH = 4000;
const SPLAT = Symbol.for('splat');

const truncate = (text) => (text.length > MAX_ARG_LENGTH
  ? `${text.slice(0, MAX_ARG_LENGTH)}…(已截断，共 ${text.length} 字符)`
  : text);

// 把 logger.info('说明', 值1, 值2) 里的每个值转成文本：错误带堆栈，对象脱敏后转 JSON
const renderArg = (arg) => {
  if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
  if (arg && typeof arg === 'object') {
    try {
      return truncate(JSON.stringify(redactLog(arg)));
    } catch {
      return '[无法序列化的对象]';
    }
  }
  return truncate(String(arg));
};

// 创建格式化器
// 级别名先转大写再上色：若对已上色的文本整体转大写，颜色代码结尾的 m 会变成 M，
// 终端会把 ESC[32M 当作“删除 32 行”，导致 docker logs 中时间、级别被吞掉
const upperLevel = winston.format((info) => {
  info.level = String(info.level).toUpperCase();
  return info;
});

const line = winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    const args = info[SPLAT];
    let rest;
    let text = typeof message === 'string' ? message : renderArg(message);
    if (args && args.length) {
      rest = args.map(renderArg).join(' ');
      // winston 会把错误参数的 message 拼到说明后面，堆栈里已含该信息，去掉重复
      for (const arg of args) {
        if (arg instanceof Error && arg.message && text.endsWith(` ${arg.message}`)) {
          text = text.slice(0, -(arg.message.length + 1));
        }
      }
    } else {
      rest = Object.keys(meta).length ? renderArg(meta) : '';
      if (stack) rest = rest ? `${rest} ${stack}` : stack; // logger.error(err) 直接传错误对象时
    }
    return `${timestamp} [${level}]: ${text}${rest ? ` ${rest}` : ''}`;
});

const baseFormats = [winston.format.errors({ stack: true }), winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), upperLevel()];
// 日志文件：不带颜色
const format = winston.format.combine(...baseFormats, line);
// 控制台（docker logs）：带颜色
const consoleFormat = winston.format.combine(...baseFormats, winston.format.colorize(), line);

// 创建日志文件路径
const logDir = path.join(__dirname, '../../logs');

// 创建 Winston logger 实例
const logger = winston.createLogger({
  levels,
  // 默认 info；排查问题时可设置环境变量 LOG_LEVEL=debug
  level: process.env.LOG_LEVEL || 'info',
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
      format: consoleFormat,
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
