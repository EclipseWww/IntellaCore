const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const logger = require('../utils/logger');

// 检测运行环境
const isDocker = fs.existsSync('/.dockerenv') || process.env.DOCKER_CONTAINER;
logger.info(`Running in ${isDocker ? 'Docker' : 'local'} environment`);

// 尝试加载 .env 文件，但如果不存在也不报错
try {
  // 获取 .env 文件的绝对路径
  const envPath = path.resolve(__dirname, '../../.env');

  // 检查文件是否存在
  if (fs.existsSync(envPath)) {
    logger.info(`Loading .env file from ${envPath}`);
    // 读取文件内容并移除 BOM
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.charCodeAt(0) === 0xFEFF) {
      envContent = envContent.slice(1);
    }

    // 手动解析并设置环境变量，但不覆盖已存在的环境变量
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    });
  } else {
    logger.info('No .env file found, using environment variables');
  }
} catch (error) {
  logger.info('Error loading .env file, using environment variables:', error.message);
}

// 根据环境调整 MongoDB 连接 URI
let mongoUri = process.env.MONGODB_URI;

// 如果在 Docker 中运行，确保使用容器名称而不是 localhost
if (isDocker && mongoUri && mongoUri.includes('127.0.0.1')) {
  mongoUri = mongoUri.replace('127.0.0.1', 'mongodb');
  logger.info('Running in Docker, adjusted MongoDB URI to use container name');
}

// 打印当前环境变量
logger.info('Environment variables:');
logger.info('PORT:', process.env.PORT);
logger.info('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
logger.info('ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);

// 验证必需的环境变量
const requiredEnvVars = ['PORT', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('Missing environment variables:', missingEnvVars);

  throw new Error(`Missing required environment variables: [ ${missingEnvVars.join(', ')} ]`);
}

// 如果没有 MongoDB URI，使用默认值
if (!mongoUri) {
  mongoUri = isDocker 
    ? 'mongodb://admin:password@mongodb:27017/student-ai-chat?authSource=admin'
    : 'mongodb://127.0.0.1:27017/student-ai-chat';
  logger.info('No MongoDB URI provided, using environment default');
}

// 允许的源列表（CORS）
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:4000,http://localhost:4001,http://localhost:5003')
  .split(',')
  .map(origin => origin.trim());

// 添加通配符支持
const corsOptions = {
  origin: function (origin, callback) {
    // 允许没有来源的请求（如移动应用或curl）
    if (!origin) return callback(null, true);
    
    // 检查是否匹配通配符
    const wildcardMatched = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        // * 只匹配一段域名、IP 或端口中的字符（不含 / ），其余字符按原样匹配，并要求整串一致：
        // http://*.school.cn 不会匹配 http://x.school.cn.evil.com 或 http://evilxschool.cn
        const pattern = allowed.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return allowed === origin;
    });

    if (allowedOrigins.indexOf(origin) !== -1 || wildcardMatched) {
      callback(null, true);
    } else {
      logger.warn(`Origin ${origin} not allowed by CORS`);
      callback(null, process.env.CORS_STRICT !== 'true'); // 默认放行；CORS_STRICT=true 时拒绝白名单外来源
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-Real-IP', 'X-Setup-Request']
};

// 导出配置
module.exports = {
  port: process.env.PORT || 5003,
  mongoUri: mongoUri,
  jwtSecret: process.env.JWT_SECRET,
  openaiApiKey: process.env.OPENAI_API_KEY,
  cors: corsOptions
};
