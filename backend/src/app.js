const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const dotenv = require('dotenv');
const User = require('./models/User');
const { startClassScheduler, initClassEndTimes, startBackupScheduler, initAllSchedulers } = require('./services/scheduler');
const swaggerUi = require('swagger-ui-express');
const swaggerDocs = require('./config/swagger');
const path = require('path');
const ensureAchievement = require('./middleware/ensureAchievement');
const auth = require('./middleware/auth');
const { startQuizPointsRecovery } = require('./services/quizPointsService');
const { startCrowdfundingRecovery } = require('./services/crowdfundingOperationService');
const { startShopRecovery } = require('./services/shopOperationService');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const reviewRoutes = require('./routes/review');
const settingRoutes = require('./routes/setting');
const courseRoutes = require('./routes/courseRoutes');
const achievementRoutes = require('./routes/achievementRoutes');
const courseUnitRoutes = require('./routes/courseUnitRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const downloadRoutes = require('./routes/downloadRoutes');
const aiGradeRoutes = require('./routes/aiGradeRoutes');
const courseManagementRouter = require('./routes/courseManagement');
const classRoutes = require('./routes/classRoutes');
const typingRoutes = require('./routes/typingRoutes');
const quizRoutes = require('./routes/quizRoutes');
const userRoutes = require('./routes/userRoutes');
const logRoutes = require('./routes/log');
const classroomLayoutRoutes = require('./routes/classroomLayout');
const aiRagRoutes = require('./routes/aiRagRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const questionAnalyticsRoutes = require('./routes/questionAnalyticsRoutes');
const backupRoutes = require('./routes/backupRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const pointShopRoutes = require('./routes/pointShopRoutes');
const crowdfundingRoutes = require('./routes/crowdfundingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userMessageRoutes = require('./routes/userMessageRoutes');
const gameRoutes = require('./routes/gameRoutes');
const flowchartRoutes = require('./routes/flowchartRoutes');
const spreadsheetRoutes = require('./routes/spreadsheet');
const spreadsheetSubmissionRoutes = require('./routes/spreadsheetSubmission');
const emailRoutes = require('./routes/emailRoutes');
const htmlProjectRoutes = require('./routes/htmlProjectRoutes');
const fillBlankRoutes = require('./routes/fillBlankRoutes');
const pythonRoutes = require('./routes/pythonRoutes');
const assignmentTreeRoutes = require('./routes/assignmentTreeRoutes');
const examRoutes = require('./routes/examRoutes');
const loginRequestRoutes = require('./routes/loginRequestRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');

const app = express();

// 确保在连接数据库之前加载.env文件
dotenv.config();

// 检查MONGODB_URI是否加载成功

// 打印配置信息（不包含敏感信息）
console.log('Configuration loaded:', {
  port: config.port,
  mongoUri: config.mongoUri ? 'Set' : 'Not set',
  jwtSecret: config.jwtSecret ? 'Set' : 'Not set'
});

// 安全响应头。游戏/课件通过 iframe 与跨源资源加载，故关闭 CSP、frame、跨源策略相关项，仅保留其余默认头
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  frameguard: false,
  hsts: false,
  noSniff: false,
  referrerPolicy: false,
  originAgentCluster: false
}));

// 配置 CORS
// 默认保持宽松（与历史行为一致）；设置 CORS_STRICT=true 后按 ALLOWED_ORIGINS 白名单严格校验
const corsStrict = process.env.CORS_STRICT === 'true';
app.use(cors(config.cors));
if (!corsStrict) {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client-Real-IP, X-Setup-Request');
    next();
  });
}

// 配置Express信任代理，以便正确获取客户端IP
// 在Docker环境中，请求经过nginx代理，需要信任代理以正确解析X-Forwarded-For等头
// 参考：https://expressjs.com/en/guide/behind-proxies.html
app.set('trust proxy', true);

// 添加预检请求的处理
app.options('*', cors(config.cors));

// 中间件
// 文件上传走 multer，不受此限制；JSON/表单体默认 100MB，可用 JSON_BODY_LIMIT 调整
const bodyLimit = process.env.JSON_BODY_LIMIT || '100mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// 5xx 响应默认不返回 error/stack 等内部细节
app.use(require('./middleware/hideServerErrorDetails'));

// 静态文件目录 - 公开访问的媒体资源
app.use('/public/media', express.static(path.join(__dirname, '../uploads/public/media')));

// Swagger 文档
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "学习平台 API 文档"
}));

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend service is running' });
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/course-management', courseManagementRouter);
app.use('/api/classes', classRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/course-units', courseUnitRoutes);
app.use('/api', assignmentRoutes);
app.use('/api/achievements', auth, ensureAchievement, achievementRoutes);
// 登录请求路由 - 必须在 resourceRoutes 之前，因为 resourceRoutes 使用 router.use(auth) 全局中间件
app.use('/api/login-requests', loginRequestRoutes);
// 游戏路由同样必须在 resourceRoutes 之前：游戏文件、封面以游戏票 Cookie 鉴权或公开访问，不带登录令牌
app.use('/api/games', gameRoutes);
app.use('/api', resourceRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api', aiGradeRoutes);
app.use('/api/typing', typingRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/classroom-layout', classroomLayoutRoutes);
app.use('/api/ai-rag', aiRagRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/question-analytics', questionAnalyticsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/point-shop', auth, ensureAchievement, pointShopRoutes);
app.use('/api/crowdfunding', auth, ensureAchievement, crowdfundingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/im', userMessageRoutes);
app.use('/api/flowchart', flowchartRoutes);
app.use('/api/spreadsheet', spreadsheetRoutes);
app.use('/api/spreadsheet-submissions', spreadsheetSubmissionRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/html-projects', htmlProjectRoutes);
app.use('/api/fillblank', fillBlankRoutes);
app.use('/api/python', pythonRoutes);
app.use('/api/teacher', assignmentTreeRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/quiz/free-practice', require('./routes/freePracticeRoutes'));

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || '服务器错误',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 启动服务器
const startServer = async () => {
  try {
    // 连接数据库
    console.log('正在连接数据库...');
    mongoose.set('debug', process.env.MONGOOSE_DEBUG === 'true'); // 查询日志含学生数据，需显式开启

    // 使用配置文件中的 mongoUri
    const mongoUri = config.mongoUri;

    // 添加重试逻辑
    let retries = 10;
    while (retries) {
      try {
        await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });
        console.log('数据库连接成功');
        break;
      } catch (err) {
        if (retries === 1) throw err;
        retries -= 1;
        console.log(`数据库连接失败，剩余重试次数: ${retries}`);
        console.log(`错误信息: ${err.message}`);
        // 等待 5 秒后重试
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // 启动服务器
    const server = app.listen(config.port, () => {
      console.log(`服务器运行在端口 ${config.port}`);
      console.log(`API URL: http://localhost:${config.port}/api`);
      console.log(`健康检查: http://localhost:${config.port}/api/health`);

      // 初始化所有定时任务
      initAllSchedulers();
      startShopRecovery();
      startQuizPointsRecovery();
      startCrowdfundingRecovery();
      console.log('所有定时任务已启动');
    });

    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('未捕获的异常:', error);
      // 不要立即退出，给服务器一些时间来处理现有请求
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // 处理未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的 Promise 拒绝:', reason);
    });

    // 处理终止信号
    process.on('SIGTERM', () => {
      console.log('收到 SIGTERM 信号，正在优雅关闭...');
      server.close(() => {
        console.log('HTTP 服务器已关闭');
        mongoose.connection.close(false, () => {
          console.log('MongoDB 连接已关闭');
          process.exit(0);
        });
      });
    });

  } catch (err) {
    console.error('启动服务器失败:', err);
    process.exit(1);
  }
};

// 启动服务器
startServer();
