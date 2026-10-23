require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const User = require('../models/User');

async function resetTeacherPassword(username, newPassword) {
  try {
    logger.info('开始重置教师密码');

    if (!username || !newPassword) {
      throw new Error('用户名和新密码都是必需的');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('数据库连接成功');

    // 查找教师用户
    const teacher = await User.findOne({ username, role: 'teacher' });
    if (!teacher) {
      throw new Error(`未找到用户名为 ${username} 的教师账号`);
    }

    // 生成新的密码哈希
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 更新密码
    await User.findByIdAndUpdate(teacher._id, {
      $set: { password: hashedPassword }
    });

    logger.info('密码重置成功', {
      username,
      passwordLength: hashedPassword.length,
      passwordFormat: hashedPassword.startsWith('$2') ? 'bcrypt格式' : '非bcrypt格式'
    });

  } catch (error) {
    logger.error('密码重置过程中发生错误', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('数据库连接已关闭');
  }
}

// 从命令行参数获取用户名和新密码
if (require.main === module) {
  const username = process.argv[2];
  const newPassword = process.argv[3];

  if (!username || !newPassword) {
    console.error('使用方法: node resetTeacherPassword.js <用户名> <新密码>');
    process.exit(1);
  }

  resetTeacherPassword(username, newPassword)
    .then(() => {
      logger.info('密码重置脚本执行成功');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('密码重置脚本执行失败', { error: error.message });
      process.exit(1);
    });
}

module.exports = resetTeacherPassword; 