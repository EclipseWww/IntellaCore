const User = require('../models/User');
const Class = require('../models/Class');
const logger = require('../utils/logger');

// 获取用户的班级设置
exports.getClassSettings = async (req, res) => {
  try {
    const { userId } = req.params;
    logger.info('获取用户班级设置', { userId });

    // 检查用户是否存在
    const user = await User.findById(userId);
    if (!user) {
      logger.warn('用户不存在', { userId });
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 如果不是学生，返回错误
    if (user.role !== 'student') {
      logger.warn('非学生用户尝试获取班级设置', { userId, role: user.role });
      return res.status(400).json({
        success: false,
        message: '只有学生可以获取班级设置'
      });
    }

    // 获取学生所在班级的设置
    const classSettings = await Class.findById(user.classId)
      .select('allowIpChange isInClass allowAiUsage currentCourse currentUnit currentLesson autoRedirectToLesson');

    if (!classSettings) {
      logger.warn('未找到学生所在班级', { userId, classId: user.classId });
      return res.status(404).json({
        success: false,
        message: '未找到学生所在班级'
      });
    }

    logger.info('成功获取班级设置', { userId, classId: user.classId });
    res.status(200).json(classSettings);
  } catch (error) {
    logger.error('获取班级设置失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}; 