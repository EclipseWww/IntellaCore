const TypingText = require('../models/TypingText');
const TypingRecord = require('../models/TypingRecord');
const User = require('../models/User');
const Class = require('../models/Class');
const logger = require('../utils/logger');
const Achievement = require('../models/Achievement');
const PointsManager = require('../utils/pointsManager');
const mongoose = require('mongoose');

// 文本管理
exports.createText = async (req, res) => {
  try {
    const text = new TypingText({
      ...req.body,
      createdBy: req.user._id
    });
    await text.save();
    logger.info('创建新的打字文本', { textId: text._id });
    res.status(201).json(text);
  } catch (error) {
    logger.error('创建打字文本失败', { error: error.message });
    res.status(400).json({ message: error.message });
  }
};

exports.getTexts = async (req, res) => {
  try {
    const { category, difficulty } = req.query;
    const query = { isActive: true };

    if (category) query.category = category;
    if (difficulty) query.difficulty = parseInt(difficulty);

    const texts = await TypingText.find(query);
    logger.info('获取打字文本列表', { count: texts.length });
    res.json(texts);
  } catch (error) {
    logger.error('获取打字文本失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
};

exports.getTextById = async (req, res) => {
  try {
    const text = await TypingText.findById(req.params.id);
    if (!text) {
      logger.warn('文本不存在', { textId: req.params.id });
      return res.status(404).json({ message: '文本不存在' });
    }
    logger.info('获取文本信息', { textId: text._id });
    res.json(text);
  } catch (error) {
    logger.error('获取文本信息失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
};

exports.updateText = async (req, res) => {
  try {
    const text = await TypingText.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { $set: req.body },
      { new: true }
    );

    if (!text) {
      logger.warn('文本不存在或无权限修改', { textId: req.params.id });
      return res.status(404).json({ message: '文本不存在或无权限修改' });
    }

    logger.info('更新文本信息', { textId: text._id });
    res.json(text);
  } catch (error) {
    logger.error('更新文本失败', { error: error.message });
    res.status(400).json({ message: error.message });
  }
};

exports.deleteText = async (req, res) => {
  try {
    const text = await TypingText.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!text) {
      logger.warn('文本不存在或无权限删除', { textId: req.params.id });
      return res.status(404).json({ message: '文本不存在或无权限删除' });
    }

    logger.info('文本已删除', { textId: text._id });
    res.json({ message: '文本已删除' });
  } catch (error) {
    logger.error('删除文本失败', { error: error.message });
    res.status(400).json({ message: error.message });
  }
};

// 统一接口处理打字记录的创建和更新
exports.recordTyping = async (req, res) => {
  logger.info('接收到的请求体:', req.body);
  try {
    const { textId, input, duration, targetSpeed, targetAccuracy, lessonId, activityId, timeLimit, speed, accuracy, isPassed } = req.body;

    // 获取文本内容
    const text = await TypingText.findById(textId);
    if (!text) {
      logger.warn('文本不存在', { textId });
      return res.status(404).json({ message: '文本不存在' });
    }

    // 记录输入和文本内容
    logger.info('输入内容:', input);
    logger.info('文本内容:', text.content);

    // 使用前端传来的速度和准确率，不再由后端计算
    logger.info('前端计算的速度和准确率:', { speed, accuracy, isPassed });

    // 使用服务器时间作为结束时间
    const endTime = new Date();
    // 根据duration计算开始时间
    const startTime = new Date(endTime.getTime() - (duration || 0));

    // 记录练习时长（秒），使用服务器计算的时间
    const practiceTimeInSeconds = (duration || 0) / 1000;
    logger.info('练习时长(秒):', practiceTimeInSeconds);

    // 验证正确率是否达到最低要求（50%）
    if (accuracy < 50) {
      logger.warn('正确率过低，拒绝创建打字记录', {
        userId: req.user._id,
        accuracy,
        speed,
        textId
      });
      return res.status(400).json({
        message: '正确率过低，请认真练习',
        shouldSave: false,
        isTooLowAccuracy: true
      });
    }

    // 区分课程模式和独立模式
    const isLessonMode = lessonId && activityId;

    // 创建新记录，使用服务器计算的时间
    const newRecord = new TypingRecord({
      userId: req.user._id,
      textId,
      lessonId: isLessonMode ? lessonId : null,
      activityId: isLessonMode ? activityId : null,
      startTime: startTime,
      endTime: endTime,
      speed,
      accuracy,
      targetSpeed,
      targetAccuracy,
      targetAccuracy,
      isPassed,
      input // 保存用户输入
    });

    let savedRecord = newRecord;
    if (req.user.role === 'student') {
      await newRecord.save();
      logger.info('新记录已创建(已写入数据库):', newRecord);
    } else {
      savedRecord._id = new require('mongoose').Types.ObjectId();
      logger.info('教师模拟：新记录已处理(未写入数据库):', savedRecord);
    }

    // 计算积分 = 实际速度/目标速度 * 100，最高100分
    let pointsEarned = Math.floor((speed / targetSpeed) * 100);

    // 限制最高积分为100
    pointsEarned = Math.min(pointsEarned, 100);
    if (req.user.role !== 'student') {
      pointsEarned = 0;
    }

    // 每日打字积分上限
    const DAILY_TYPING_POINTS_LIMIT = 500;

    // 查询今日已获得的打字积分
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const achievement = await Achievement.findOne({ studentId: req.user._id });
    let todayTypingPoints = 0;

    if (achievement && achievement.pointTransactions) {
      // 计算今天打字练习获得的积分总和
      todayTypingPoints = achievement.pointTransactions
        .filter(t =>
          t.timestamp >= today &&
          t.type === 'task_completion' &&
          t.description &&
          t.description.includes('打字练习')
        )
        .reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0);
    }

    // 如果今日已达上限，不再添加积分
    if (todayTypingPoints >= DAILY_TYPING_POINTS_LIMIT) {
      logger.info('今日打字积分已达上限，不再添加积分', {
        studentId: req.user._id,
        todayTypingPoints,
        limit: DAILY_TYPING_POINTS_LIMIT
      });
      pointsEarned = 0;
    } else {
      // 限制积分不超过今日剩余额度
      const remainingQuota = DAILY_TYPING_POINTS_LIMIT - todayTypingPoints;
      if (pointsEarned > remainingQuota) {
        logger.info('调整打字积分以符合每日上限', {
          studentId: req.user._id,
          originalPoints: pointsEarned,
          adjustedPoints: remainingQuota,
          todayTypingPoints,
          limit: DAILY_TYPING_POINTS_LIMIT
        });
        pointsEarned = remainingQuota;
      }
    }

    logger.info('计算打字练习积分', {
      studentId: req.user._id,
      speed,
      targetSpeed,
      pointsEarned,
      todayTypingPoints,
      dailyLimit: DAILY_TYPING_POINTS_LIMIT
    });

    // 添加积分记录
    if (pointsEarned > 0) {
      try {
        await PointsManager.addPoints(
          req.user._id,
          pointsEarned,
          'task_completion',
          `打字练习完成：${text.content.substring(0, 20)}...`,
          newRecord._id
        );

        logger.info('积分添加成功', {
          studentId: req.user._id,
          pointsEarned,
          recordId: newRecord._id
        });
      } catch (pointError) {
        logger.error('添加积分失败', {
          error: pointError.message,
          stack: pointError.stack
        });
        // 积分添加失败不影响记录创建的结果返回
      }
    }


    return res.status(201).json({
      speed,
      accuracy,
      isPassed,
      recordId: newRecord._id,
      pointsEarned, // 返回获得的积分
      message: isLessonMode ? '课程记录已创建' : '练习记录已创建',
      shouldSave: true
    });
  } catch (error) {
    logger.error('记录创建失败:', error);
    res.status(400).json({ message: error.message });
  }
};

exports.getRecords = async (req, res) => {
  try {
    const { lessonId, textId, startDate, endDate, activityId } = req.query;
    const query = { userId: req.user._id };

    if (startDate) query.startTime = { $gte: new Date(startDate) };
    if (endDate) query.endTime = { $lte: new Date(endDate) };

    // 判断模式
    const isLessonMode = lessonId && activityId;

    logger.info('获取打字记录', {
      userId: req.user._id,
      isLessonMode,
      lessonId,
      activityId
    });

    if (isLessonMode) {
      // 课程模式：返回当前活动的记录
      if (textId) query.textId = textId;
      query.lessonId = lessonId;
      query.activityId = activityId;

      const records = await TypingRecord.find(query)
        .sort({ startTime: -1 })
        .populate('textId', 'content category');

      logger.info('返回课程模式打字记录', { count: records.length });
      return res.json(records);
    } else {
      // 独立模式：返回所有打字记录，按时间倒序排列
      const records = await TypingRecord.find(query)
        .sort({ startTime: -1 })
        .limit(10)  // 限制返回最近的10条记录
        .populate('textId', 'content category');

      logger.info('返回独立模式打字记录', { count: records.length });
      return res.json(records);
    }
  } catch (error) {
    logger.error('获取打字记录失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
};

// 统计信息
exports.getStats = async (req, res) => {
  try {
    const { lessonId } = req.query;
    const query = { userId: req.user._id };

    if (lessonId) query.lessonId = lessonId;

    logger.info('获取打字统计数据', { userId: req.user._id, lessonId });

    // 获取总练习次数和达标次数
    const [totalCount, passedCount] = await Promise.all([
      TypingRecord.countDocuments(query),
      TypingRecord.countDocuments({ ...query, isPassed: true })
    ]);

    logger.info('打字记录统计', { totalCount, passedCount });

    // 如果没有记录，直接返回默认值
    if (totalCount === 0) {
      logger.info('用户没有打字记录，返回默认值', { userId: req.user._id });
      return res.json({
        totalCount: 0,
        passedCount: 0,
        bestRecord: null,
        recentRecords: [],
        averages: { avgSpeed: 0, avgAccuracy: 0 },
        totalPracticeTime: 0 // 添加总练习时间字段
      });
    }

    // 获取最佳记录
    const bestRecord = await TypingRecord.findOne(query)
      .sort({ speed: -1 })
      .limit(1);

    // 获取最近进步
    const recentRecords = await TypingRecord.find(query)
      .sort({ startTime: -1 })
      .limit(10);

    // 获取所有记录用于计算平均值和总练习时间
    const allRecords = await TypingRecord.find(query);

    // 手动计算平均速度和准确率
    let totalSpeed = 0;
    let totalAccuracy = 0;

    // 计算总练习时间（毫秒）
    let totalPracticeTime = 0;

    for (const record of allRecords) {
      totalSpeed += record.speed;
      totalAccuracy += record.accuracy;

      // 计算每条记录的练习时长（秒）
      const startTime = new Date(record.startTime);
      const endTime = new Date(record.endTime);
      const duration = Math.round((endTime - startTime) / 1000); // 转换为秒
      totalPracticeTime += duration;
    }

    const avgSpeed = totalCount > 0 ? totalSpeed / totalCount : 0;
    const avgAccuracy = totalCount > 0 ? totalAccuracy / totalCount : 0;

    const averages = {
      avgSpeed: avgSpeed,
      avgAccuracy: avgAccuracy
    };

    logger.info('计算打字统计数据完成', {
      userId: req.user._id,
      avgSpeed,
      avgAccuracy,
      totalPracticeTime
    });

    res.json({
      totalCount,
      passedCount,
      bestRecord,
      recentRecords,
      averages,
      totalPracticeTime // 添加总练习时间字段
    });
  } catch (error) {
    logger.error('获取打字统计数据失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: '获取打字统计数据失败' });
  }
};

// 教师端 - 获取打字记录
exports.getTeacherRecords = async (req, res) => {
  try {
    const { startDate, endDate, classId, lessonId, activityId } = req.query;
    // Other callers (classroom live records) still need the complete result.
    const paginated = req.query.page !== undefined || req.query.pageSize !== undefined;
    const toPositiveInteger = (value, fallback) => {
      const number = Number(value);
      return Number.isSafeInteger(number) && number > 0 ? number : fallback;
    };
    const pageSize = Math.min(toPositiveInteger(req.query.pageSize, 10), 100);
    const requestedPage = toPositiveInteger(req.query.page, 1);
    const query = {};

    // 添加时间范围筛选
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // 添加课时和活动筛选
    if (lessonId) {
      query.lessonId = lessonId;
    }
    if (activityId) {
      query.activityId = activityId;
    }

    // 获取教师的所有班级
    const classes = await Class.find({ teacher: req.user._id })
      .select('name grade')
      .sort('grade name');

    logger.info('获取教师班级列表', { teacherId: req.user._id, classCount: classes.length });

    // 添加班级筛选
    if (classId) {
      // 从 User 模型中查找属于该班级的学生
      const studentsInClass = await User.find({ classId }).select('_id');
      const studentIds = studentsInClass.map(student => student._id);
      query.userId = { $in: studentIds };

      logger.info('获取班级学生记录', { classId, studentCount: studentIds.length });
    }

    const total = paginated ? await TypingRecord.countDocuments(query) : undefined;
    const page = paginated ? Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize))) : 1;
    let recordsQuery = TypingRecord.find(query)
      .populate('userId', 'name')
      .populate('textId', 'content')
      .sort({ createdAt: -1, _id: -1 });
    if (paginated) recordsQuery = recordsQuery.skip((page - 1) * pageSize).limit(pageSize);
    const records = await recordsQuery;

    logger.info('查询到的记录数', { count: records.length, lessonId, activityId });

    // 格式化返回数据
    const formattedRecords = records.map(record => ({
      _id: record._id,
      student: record.userId,
      studentId: record.userId?._id,
      text: record.textId,
      speed: record.speed,
      accuracy: record.accuracy,
      isPassed: record.isPassed,
      lessonId: record.lessonId,
      activityId: record.activityId,
      createdAt: record.createdAt
    }));

    // 格式化班级列表
    const formattedClasses = classes.map(cls => ({
      _id: cls._id,
      name: `${cls.grade}年级${cls.name}班`
    }));

    res.json({
      records: formattedRecords,
      classes: formattedClasses,
      ...(paginated ? { total, page, pageSize } : {})
    });
  } catch (error) {
    logger.error('获取打字记录失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
};

// 教师端 - 获取统计数据
exports.getTeacherStats = async (req, res) => {
  try {
    const { startDate, endDate, classId } = req.query;
    const query = {};

    // 添加时间范围筛选
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // 添加班级筛选
    if (classId) {
      // 从 User 模型中查找属于该班级的学生
      const studentsInClass = await User.find({ classId }).select('_id');
      const studentIds = studentsInClass.map(student => student._id);
      query.userId = { $in: studentIds };

      logger.info('获取班级学生统计数据', { classId, studentCount: studentIds.length });
    }

    const [summary] = await TypingRecord.aggregate([
      { $match: query },
      { $group: {
        _id: null,
        totalPractices: { $sum: 1 },
        passedPractices: { $sum: { $cond: ['$isPassed', 1, 0] } },
        totalSpeed: { $sum: '$speed' },
        totalAccuracy: { $sum: '$accuracy' }
      } }
    ]);

    // 计算统计数据
    const totalPractices = summary?.totalPractices || 0;
    const passedPractices = summary?.passedPractices || 0;

    const stats = {
      averageSpeed: totalPractices > 0
        ? Math.round(summary.totalSpeed / totalPractices)
        : 0,
      averageAccuracy: totalPractices > 0
        ? Math.round(summary.totalAccuracy / totalPractices)
        : 0,
      totalPractices,
      passRate: totalPractices > 0
        ? Math.round((passedPractices / totalPractices) * 100)
        : 0
    };

    logger.info('统计数据计算完成', { stats });
    res.json(stats);
  } catch (error) {
    logger.error('获取统计数据失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
};

// 教师端 - 删除打字记录
exports.deleteTypingRecord = async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否为教师
    if (req.user.role !== 'teacher') {
      logger.warn('非教师用户尝试删除打字记录', {
        userId: req.user._id,
        role: req.user.role,
        recordId: id
      });
      return res.status(403).json({
        success: false,
        message: '只有教师可以删除打字记录'
      });
    }

    // 查找记录并检查是否存在
    const record = await TypingRecord.findById(id);
    if (!record) {
      logger.warn('打字记录不存在', { recordId: id });
      return res.status(404).json({
        success: false,
        message: '打字记录不存在'
      });
    }

    // 获取记录相关的积分信息
    const pointsToDeduct = Math.min(Math.floor((record.speed / record.targetSpeed) * 100), 100);

    // 尝试扣除积分，但即使失败也继续删除
    if (pointsToDeduct > 0) {
      try {
        await PointsManager.deductPoints(
          record.userId,
          pointsToDeduct,
          'task_completion_revoked',
          `打字练习记录删除：速度${record.speed}，正确率${record.accuracy}%`,
          record._id
        );

        logger.info('已扣除学生打字练习积分', {
          studentId: record.userId,
          pointsDeducted: pointsToDeduct,
          recordId: id
        });
      } catch (pointError) {
        // 记录错误但继续删除记录操作
        logger.error('扣除积分失败，但将继续删除记录', {
          error: pointError.message,
          stack: pointError.stack,
          studentId: record.userId,
          recordId: id
        });
      }
    }

    // 删除记录
    await TypingRecord.findByIdAndDelete(id);

    logger.info('打字记录删除成功', {
      recordId: id,
      teacherId: req.user._id,
      studentId: record.userId,
      pointsDeducted: pointsToDeduct
    });

    res.status(200).json({
      success: true,
      message: '打字记录删除成功',
      pointsDeducted: pointsToDeduct
    });
  } catch (error) {
    logger.error('删除打字记录失败', {
      error: error.message,
      stack: error.stack,
      recordId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: '删除打字记录失败',
      error: error.message
    });
  }
};

// 学生端 - 获取打字排行榜（全校/班级）
exports.getLeaderboard = async (req, res) => {
  try {
    const { scope = 'school', timeRange = 'all' } = req.query;
    const studentId = req.user._id;

    // 获取当前学生的班级信息
    const currentUser = await User.findById(studentId).select('classId');
    const currentClassId = currentUser?.classId;

    // 构建时间筛选条件
    let timeFilter = {};
    const now = new Date();

    if (timeRange === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      timeFilter = { createdAt: { $gte: weekAgo } };
    } else if (timeRange === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      timeFilter = { createdAt: { $gte: monthAgo } };
    }

    // 根据 scope 决定查询范围
    let studentFilter = { role: 'student' };
    if (scope === 'class' && currentClassId) {
      studentFilter.classId = currentClassId;
    }

    // 获取符合条件的学生
    const students = await User.find(studentFilter).select('_id name classId');
    const studentIds = students.map(s => s._id);

    if (studentIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 聚合排行榜数据 - 每个学生取最高速度的记录
    const leaderboardData = await TypingRecord.aggregate([
      {
        $match: {
          userId: { $in: studentIds },
          lessonId: null, // 只统计自由练习，排除课程练习
          ...timeFilter
        }
      },
      {
        $group: {
          _id: '$userId',
          maxSpeed: { $max: '$speed' },
          avgSpeed: { $avg: '$speed' },
          avgAccuracy: { $avg: '$accuracy' },
          practiceCount: { $sum: 1 }
        }
      },
      {
        $sort: { maxSpeed: -1 }
      },
      {
        $limit: 100
      }
    ]);

    // 获取班级信息
    const classIds = [...new Set(students.map(s => s.classId?.toString()).filter(Boolean))];
    const classes = await Class.find({ _id: { $in: classIds } }).select('_id name grade');
    const classMap = new Map(classes.map(c => [c._id.toString(), c]));

    // 构建学生映射
    const studentMap = new Map(students.map(s => [s._id.toString(), s]));

    // 补充学生和班级信息
    const leaderboard = leaderboardData.map((item, index) => {
      const student = studentMap.get(item._id.toString());
      const cls = student?.classId ? classMap.get(student.classId.toString()) : null;
      return {
        rank: index + 1,
        studentId: item._id,
        studentName: student?.name || '未知',
        className: cls ? `${cls.name}班` : '未知',
        grade: cls?.grade || null,
        gradeClassName: cls ? `${cls.grade}年级${cls.name}班` : '未知',
        maxSpeed: Math.round(item.maxSpeed),
        avgSpeed: Math.round(item.avgSpeed),
        avgAccuracy: Math.round(item.avgAccuracy),
        practiceCount: item.practiceCount,
        isCurrentUser: item._id.toString() === studentId.toString()
      };
    });

    // 查找当前用户的排名（如果不在前100名）
    let currentUserRank = leaderboard.find(l => l.isCurrentUser);
    if (!currentUserRank) {
      // 查询当前用户的排行信息
      const userStats = await TypingRecord.aggregate([
        {
          $match: {
            userId: studentId,
            lessonId: null,
            ...timeFilter
          }
        },
        {
          $group: {
            _id: '$userId',
            maxSpeed: { $max: '$speed' },
            avgSpeed: { $avg: '$speed' },
            avgAccuracy: { $avg: '$accuracy' },
            practiceCount: { $sum: 1 }
          }
        }
      ]);

      if (userStats.length > 0) {
        const userMaxSpeed = userStats[0].maxSpeed;
        // 计算排名
        const higherCount = await TypingRecord.aggregate([
          {
            $match: {
              userId: { $in: studentIds },
              lessonId: null,
              ...timeFilter
            }
          },
          {
            $group: {
              _id: '$userId',
              maxSpeed: { $max: '$speed' }
            }
          },
          {
            $match: {
              maxSpeed: { $gt: userMaxSpeed }
            }
          }
        ]);

        const student = studentMap.get(studentId.toString());
        const cls = student?.classId ? classMap.get(student.classId.toString()) : null;

        currentUserRank = {
          rank: higherCount.length + 1,
          studentId: studentId,
          studentName: student?.name || '未知',
          className: cls ? `${cls.name}班` : '未知',
          grade: cls?.grade || null,
          gradeClassName: cls ? `${cls.grade}年级${cls.name}班` : '未知',
          maxSpeed: Math.round(userStats[0].maxSpeed),
          avgSpeed: Math.round(userStats[0].avgSpeed),
          avgAccuracy: Math.round(userStats[0].avgAccuracy),
          practiceCount: userStats[0].practiceCount,
          isCurrentUser: true
        };
      }
    }

    logger.info('获取打字排行榜成功', {
      scope,
      timeRange,
      leaderboardCount: leaderboard.length,
      studentId
    });

    res.json({
      success: true,
      data: leaderboard,
      currentUserRank
    });
  } catch (error) {
    logger.error('获取打字排行榜失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取排行榜失败',
      error: error.message
    });
  }
};

// 学生端 - 获取按文章的排行榜
exports.getTextLeaderboard = async (req, res) => {
  try {
    const { textId } = req.params;
    const { timeRange = 'all' } = req.query;
    const studentId = req.user._id;

    if (!textId) {
      return res.status(400).json({
        success: false,
        message: '请提供文章ID'
      });
    }

    // 构建时间筛选条件
    let timeFilter = {};
    const now = new Date();

    if (timeRange === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      timeFilter = { createdAt: { $gte: weekAgo } };
    } else if (timeRange === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      timeFilter = { createdAt: { $gte: monthAgo } };
    }

    // 聚合该文章的排行榜数据 - 每个学生取最高速度
    const leaderboardData = await TypingRecord.aggregate([
      {
        $match: {
          textId: new mongoose.Types.ObjectId(textId),
          lessonId: null, // 只统计自由练习
          ...timeFilter
        }
      },
      {
        $group: {
          _id: '$userId',
          maxSpeed: { $max: '$speed' },
          bestAccuracy: { $max: '$accuracy' },
          practiceCount: { $sum: 1 }
        }
      },
      {
        $sort: { maxSpeed: -1 }
      },
      {
        $limit: 50
      }
    ]);

    // 获取学生信息
    const studentIds = leaderboardData.map(item => item._id);
    const students = await User.find({ _id: { $in: studentIds } }).select('_id name classId');
    const studentMap = new Map(students.map(s => [s._id.toString(), s]));

    // 获取班级信息
    const classIds = [...new Set(students.map(s => s.classId?.toString()).filter(Boolean))];
    const classes = await Class.find({ _id: { $in: classIds } }).select('_id name grade');
    const classMap = new Map(classes.map(c => [c._id.toString(), c]));

    // 构建排行榜
    const leaderboard = leaderboardData.map((item, index) => {
      const student = studentMap.get(item._id.toString());
      const cls = student?.classId ? classMap.get(student.classId.toString()) : null;
      return {
        rank: index + 1,
        studentId: item._id,
        studentName: student?.name || '未知',
        className: cls ? `${cls.name}班` : '未知',
        grade: cls?.grade || null,
        gradeClassName: cls ? `${cls.grade}年级${cls.name}班` : '未知',
        maxSpeed: Math.round(item.maxSpeed),
        bestAccuracy: Math.round(item.bestAccuracy),
        practiceCount: item.practiceCount,
        isCurrentUser: item._id.toString() === studentId.toString()
      };
    });

    // 获取文章信息
    const text = await TypingText.findById(textId).select('content');

    logger.info('获取文章排行榜成功', {
      textId,
      timeRange,
      leaderboardCount: leaderboard.length
    });

    res.json({
      success: true,
      data: leaderboard,
      textPreview: text?.content?.substring(0, 50) || ''
    });
  } catch (error) {
    logger.error('获取文章排行榜失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取文章排行榜失败',
      error: error.message
    });
  }
};