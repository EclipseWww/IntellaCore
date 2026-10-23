/**
 * 确保学生用户都有 Achievement 记录的中间件
 * 如果没有，会自动创建一个
 */
const Achievement = require('../models/Achievement');
const logger = require('../utils/logger');

module.exports = async (req, res, next) => {
  try {
    // 只检查学生用户
    if (req.user && req.user.role === 'student') {
      // 检查是否已有成就记录
      const achievement = await Achievement.findOne({ studentId: req.user._id });
      
      if (!achievement) {
        logger.info('用户没有成就记录，自动创建', { userId: req.user._id });
        
        // 创建初始成就记录
        const newAchievement = new Achievement({
          studentId: req.user._id,
          totalPoints: 100, // 初始积分值
          level: 1,
          pointTransactions: [{
            amount: 100,
            type: 'system_reward',
            description: '初始欢迎奖励',
            timestamp: new Date()
          }]
        });
        
        await newAchievement.save();
        logger.info('成就记录创建成功', { userId: req.user._id, achievementId: newAchievement._id });
      }
    }
    
    next();
  } catch (error) {
    logger.error('检查成就记录失败', { error: error.message, stack: error.stack });
    // 即使发生错误，也继续处理请求，不阻止用户访问
    next();
  }
}; 