require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const User = require('../models/User');

async function checkTeacherPasswords() {
  try {
    logger.info('开始检查教师密码存储状态');

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('数据库连接成功');

    // 查找所有教师用户
    const teachers = await User.find({ role: 'teacher' }).lean();
    logger.info(`找到 ${teachers.length} 个教师账号`);

    // 检查每个教师的密码
    teachers.forEach((teacher, index) => {
      logger.info(`教师账号 ${index + 1}:`, {
        username: teacher.username,
        hasPassword: !!teacher.password,
        passwordLength: teacher.password?.length,
        passwordFormat: teacher.password?.startsWith('$2') ? 'bcrypt格式' : '非bcrypt格式'
      });
    });

  } catch (error) {
    logger.error('检查过程中发生错误', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('数据库连接已关闭');
  }
}

// 执行检查
if (require.main === module) {
  checkTeacherPasswords()
    .then(() => {
      logger.info('密码检查完成');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('密码检查失败', { error: error.message });
      process.exit(1);
    });
}

module.exports = checkTeacherPasswords; 