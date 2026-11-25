const mongoose = require('mongoose');
const logger = require('../utils/logger');
require('dotenv').config();

const dbConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('数据库连接成功');
  } catch (error) {
    logger.error('数据库连接失败:', error);
    process.exit(1);
  }
};

module.exports = dbConnect;
