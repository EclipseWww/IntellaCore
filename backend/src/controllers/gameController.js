const User = require('../models/User');
const logger = require('../utils/logger');

// 获取当前用户的游戏剩余时长（秒）
// 同时检查学生是否登录满35分钟
const LOGIN_MINUTES_REQUIRED = 35;

exports.getRemainingTime = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const userRole = req.user?.role;
    logger.info('获取游戏剩余时长', { userId, role: userRole });

    const user = await User.findById(userId).select('gameTimeRemainingSeconds lastLogin role');
    if (!user) {
      logger.warn('未找到用户', { userId });
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 教师不受限制
    if (user.role === 'teacher') {
      return res.status(200).json({
        success: true,
        remainingSeconds: user.gameTimeRemainingSeconds || 0,
        isLocked: false
      });
    }

    // 学生：检查登录时间是否满足要求
    const now = new Date();
    const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
    let isLocked = false;
    let minutesPassed = 0;
    let unlockTime = null;
    let lockMessage = null;

    if (lastLogin) {
      minutesPassed = Math.floor((now - lastLogin) / 60000);
      if (minutesPassed < LOGIN_MINUTES_REQUIRED) {
        isLocked = true;
        unlockTime = new Date(lastLogin.getTime() + LOGIN_MINUTES_REQUIRED * 60000);
        lockMessage = `游戏将在登录后${LOGIN_MINUTES_REQUIRED}分钟解锁，您已登录${minutesPassed}分钟`;
        logger.info('游戏中心被锁定', { userId, minutesPassed, unlockTime });
      }
    } else {
      // 如果没有登录时间记录，也锁定
      isLocked = true;
      lockMessage = '无法获取登录时间，请重新登录';
      logger.warn('未找到用户登录时间', { userId });
    }

    return res.status(200).json({
      success: true,
      remainingSeconds: user.gameTimeRemainingSeconds || 0,
      isLocked,
      minutesPassed,
      unlockTime: unlockTime ? unlockTime.toISOString() : null,
      lockMessage
    });
  } catch (error) {
    logger.error('获取游戏剩余时长失败', { error: error.message, stack: error.stack, userId: req.user?.id });
    return res.status(500).json({ success: false, message: '获取失败' });
  }
};

// 更新当前用户的游戏剩余时长（秒）
exports.updateRemainingTime = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { remainingSeconds } = req.body || {};
    logger.info('更新游戏剩余时长', { userId, remainingSeconds });

    if (typeof remainingSeconds !== 'number' || Number.isNaN(remainingSeconds) || remainingSeconds < 0) {
      return res.status(400).json({ success: false, message: '无效的剩余时长' });
    }

    const user = await User.findById(userId).select('_id');
    if (!user) {
      logger.warn('未找到用户', { userId });
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    await User.findByIdAndUpdate(userId, { gameTimeRemainingSeconds: Math.floor(remainingSeconds) }, { new: false });

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('更新游戏剩余时长失败', { error: error.message, stack: error.stack, userId: req.user?.id });
    return res.status(500).json({ success: false, message: '更新失败' });
  }
};








