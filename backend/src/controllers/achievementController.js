const { roundPoints } = require('../utils/pointPrecision');
const Achievement = require('../models/Achievement');
const User = require('../models/User');
const logger = require('../utils/logger');

// 获取学生的所有成就
exports.getStudentAchievements = async (req, res) => {
  try {
    const achievements = await Achievement.find({ studentId: req.user._id })
      .populate('badgeId')
      .sort({ earnedAt: -1 });
    res.json(achievements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 获取学生的统计数据
exports.getStudentStats = async (req, res) => {
  try {
    const stats = await Achievement.aggregate([
      {
        $match: { studentId: req.user._id }
      },
      {
        $group: {
          _id: null,
          totalCourses: { $sum: '$coursesCompleted' },
          totalHours: { $sum: '$studyHours' },
          totalAssignments: { $sum: '$assignmentsCompleted' },
          totalBadges: { $sum: 1 }
        }
      }
    ]);

    res.json(stats[0] || {
      totalCourses: 0,
      totalHours: 0,
      totalAssignments: 0,
      totalBadges: 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 更新学习时长
exports.updateStudyTime = async (req, res) => {
  try {
    const { courseId, duration } = req.body;
    const result = await Achievement.findOneAndUpdate(
      { studentId: req.user._id },
      {
        $inc: { studyHours: duration },
        $push: {
          studyLog: {
            courseId,
            duration,
            timestamp: new Date()
          }
        }
      },
      { new: true, upsert: true }
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 完成作业时更新成就
exports.completeAssignment = async (req, res) => {
  try {
    const { courseId, assignmentId } = req.body;
    const result = await Achievement.findOneAndUpdate(
      { studentId: req.user._id },
      {
        $inc: { assignmentsCompleted: 1 },
        $push: {
          completedAssignments: {
            courseId,
            assignmentId,
            completedAt: new Date()
          }
        }
      },
      { new: true, upsert: true }
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 获取学生的积分总额
exports.getPointBalance = async (req, res) => {
  try {
    logger.info('获取学生积分余额', { userId: req.user._id });
    
    const achievement = await Achievement.findOne({ studentId: req.user._id });
    
    if (!achievement) {
      // 如果没有成就记录，创建一个新的记录
      const newAchievement = await Achievement.create({
        studentId: req.user._id,
        totalPoints: 0,
        level: 1
      });
      
      return res.status(200).json({
        success: true,
        totalPoints: 0,
        level: 1
      });
    }
    
    res.status(200).json({
      success: true,
      totalPoints: roundPoints(achievement.totalPoints),
      level: achievement.level
    });
  } catch (error) {
    logger.error('获取积分余额失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取积分余额失败',
      error: error.message
    });
  }
};

// 获取学生的积分交易记录
exports.getPointTransactions = async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    logger.info('获取学生积分交易记录', { userId: req.user._id, limit, skip });
    
    const achievement = await Achievement.findOne({ studentId: req.user._id });
    
    if (!achievement) {
      return res.status(200).json({
        success: true,
        transactions: [],
        totalCount: 0
      });
    }
    
    // 从子文档中分页获取交易记录
    const totalCount = achievement.pointTransactions.length;
    const transactions = achievement.pointTransactions
      .slice(parseInt(skip), parseInt(skip) + parseInt(limit));
    
    res.status(200).json({
      success: true,
      transactions,
      totalCount
    });
  } catch (error) {
    logger.error('获取积分交易记录失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取积分交易记录失败',
      error: error.message
    });
  }
};

// 添加积分（仅管理员可用）
exports.addPoints = async (req, res) => {
  try {
    const { studentId, amount, reason } = req.body;
    
    if (!studentId || !amount) {
      return res.status(400).json({
        success: false,
        message: '学生ID和积分数量为必填项'
      });
    }
    
    logger.info('管理员添加积分', { adminId: req.user._id, studentId, amount, reason });
    
    // 使用静态方法添加积分交易记录
    const achievement = await Achievement.addPointTransaction(
      studentId,
      parseInt(amount),
      'system_reward',
      reason || '系统奖励积分'
    );
    
    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: '未找到学生记录'
      });
    }
    
    res.status(200).json({
      success: true,
      message: '积分添加成功',
      newBalance: roundPoints(achievement.totalPoints)
    });
  } catch (error) {
    logger.error('添加积分失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '添加积分失败',
      error: error.message
    });
  }
};

// 获取所有学生积分余额（仅管理员可用）
exports.getStudentsPointBalance = async (req, res) => {
  try {
    // 检查用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      logger.warn('无权获取学生积分信息', { userId: req.user._id, role: req.user.role });
      return res.status(403).json({
        success: false,
        message: '无权进行此操作'
      });
    }
    
    logger.info('获取所有学生积分余额', { userId: req.user._id });
    
    // 准备查询条件
    const query = {};
    
    // 支持按学生ID筛选
    if (req.query.studentId) {
      query.studentId = req.query.studentId;
    }
    
    // 支持按班级筛选
    if (req.query.classId) {
      // 查找特定班级的学生
      const classStudents = await User.find({ classId: req.query.classId }).select('_id');
      if (classStudents && classStudents.length > 0) {
        const studentIds = classStudents.map(student => student._id);
        query.studentId = { $in: studentIds };
      } else {
        // 如果班级没有学生，返回空结果
        return res.status(200).json({
          success: true,
          students: [],
          total: 0
        });
      }
    }
    
    // 获取学生成就记录
    const achievements = await Achievement.find(query)
      .populate({
        path: 'studentId',
        select: 'name avatar username classId',
        populate: {
          path: 'classId',
          select: 'name grade'
        }
      })
      .sort({ totalPoints: -1 });
    
    // 获取学生的兑换记录统计
    const redemptionStats = await require('../models/PointShop').RedemptionRecord.aggregate([
      {
        $group: {
          _id: '$studentId',
          redemptionCount: { $sum: 1 },
          pendingRedemptions: { 
            $sum: { 
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] 
            } 
          },
          completedRedemptions: { 
            $sum: { 
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] 
            } 
          },
          expiredRedemptions: { 
            $sum: { 
              $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] 
            } 
          },
          totalPointsSpent: { $sum: '$pointCost' }
        }
      }
    ]);
    
    // 创建学生ID到兑换统计的映射
    const statsMap = {};
    redemptionStats.forEach(stat => {
      statsMap[stat._id.toString()] = stat;
    });
    
    // 转换格式，使字段更易理解
    const formattedData = achievements.map(achievement => {
      const student = achievement.studentId || null;
      const studentId = student ? student._id.toString() : null;
      const stats = studentId && statsMap[studentId] ? statsMap[studentId] : {
        redemptionCount: 0,
        pendingRedemptions: 0,
        completedRedemptions: 0,
        expiredRedemptions: 0,
        totalPointsSpent: 0
      };
      const classObj = student && student.classId ? student.classId : null;
      
      return {
        _id: studentId,
        name: student ? student.name : null,
        avatar: student ? student.avatar : null,
        username: student ? student.username : null,
        class: classObj ? {
          _id: classObj._id,
          name: classObj.name,
          grade: classObj.grade
        } : null,
        totalPoints: roundPoints(achievement.totalPoints),
        level: achievement.level,
        redemptionCount: stats.redemptionCount,
        pendingRedemptions: stats.pendingRedemptions,
        completedRedemptions: stats.completedRedemptions,
        expiredRedemptions: stats.expiredRedemptions,
        totalPointsSpent: stats.totalPointsSpent
      };
    });
    
    logger.info('获取所有学生积分余额成功', { userId: req.user._id, count: formattedData.length });
    
    res.status(200).json({
      success: true,
      students: formattedData,
      total: formattedData.length
    });
  } catch (error) {
    logger.error('获取所有学生积分余额失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取学生积分余额失败',
      error: error.message
    });
  }
};

// 获取特定学生的积分交易记录（管理员和教师权限）
exports.getStudentPointTransactions = async (req, res) => {
  try {
    // 检查用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      logger.warn('无权获取学生积分交易记录', { userId: req.user._id, role: req.user.role });
      return res.status(403).json({
        success: false,
        message: '无权进行此操作'
      });
    }
    
    const { studentId } = req.params;
    const { limit = 20, skip = 0 } = req.query;
    
    logger.info('获取特定学生积分交易记录', { 
      adminId: req.user._id, 
      studentId,
      limit,
      skip
    });
    
    // 查找学生成就记录
    const achievement = await Achievement.findOne({ studentId })
      .populate({
        path: 'studentId',
        select: 'name avatar username classId',
        populate: {
          path: 'classId',
          select: 'name grade'
        }
      });
    
    if (!achievement) {
      logger.warn('未找到学生成就记录', { studentId });
      return res.status(200).json({
        success: true,
        transactions: [],
        totalCount: 0,
        student: null
      });
    }
    
    // 从子文档中分页获取交易记录
    const totalCount = achievement.pointTransactions.length;
    
    // 按时间倒序排序
    const sortedTransactions = [...achievement.pointTransactions]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const transactions = sortedTransactions
      .slice(parseInt(skip), parseInt(skip) + parseInt(limit));
    
    // 提取学生基本信息
    const student = {
      _id: achievement.studentId._id,
      name: achievement.studentId.name,
      avatar: achievement.studentId.avatar,
      username: achievement.studentId.username,
      classId: achievement.studentId.classId ? achievement.studentId.classId._id : null,
      className: achievement.studentId.classId ? achievement.studentId.classId.name : null,
      grade: achievement.studentId.classId ? achievement.studentId.classId.grade : null,
      totalPoints: roundPoints(achievement.totalPoints),
      level: achievement.level
    };
    
    logger.info('获取学生积分交易记录成功', { adminId: req.user._id, studentId, count: transactions.length });
    
    res.status(200).json({
      success: true,
      transactions,
      totalCount,
      student
    });
  } catch (error) {
    logger.error('获取学生积分交易记录失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取学生积分交易记录失败',
      error: error.message
    });
  }
};

module.exports = exports;
