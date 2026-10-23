const { PointShopItem, RedemptionRecord } = require('../models/PointShop');
const Achievement = require('../models/Achievement');
const logger = require('../utils/logger');
const User = require('../models/User');
const Class = require('../models/Class');
const ShopOperation = require('../models/ShopOperation');
const { settleOperation } = require('../services/shopOperationService');

// 获取所有商店商品
exports.getAllItems = async (req, res) => {
  try {
    logger.info('获取积分商店商品列表', { userId: req.user._id, role: req.user.role });

    let query = { isActive: true };
    let allowGameCenter = true;

    // 如果是学生，只显示其班级老师发布的商品
    if (req.user.role === 'student') {
      // 获取学生的班级
      const student = await User.findById(req.user._id).select('classId');
      if (student && student.classId) {
        // 获取班级的老师和游戏中心设置
        const classInfo = await Class.findById(student.classId).select('teacher allowGameCenter');
        if (classInfo && classInfo.teacher) {
          allowGameCenter = classInfo.allowGameCenter !== false;
          query.createdBy = classInfo.teacher;
          logger.info('学生查看商品，过滤班级老师', {
            studentId: req.user._id,
            classId: student.classId,
            teacherId: classInfo.teacher
          });
        } else {
          // 如果班级没有老师，返回空列表
          logger.warn('学生班级没有老师', { studentId: req.user._id, classId: student.classId });
          return res.status(200).json({
            success: true,
            items: [],
            hasGameItems: false
          });
        }
      } else {
        return res.status(200).json({
          success: true,
          items: [],
          hasGameItems: false
        });
      }
    } else if (req.user.role === 'teacher') {
      // 如果是老师，只显示自己发布的商品
      query.createdBy = req.user._id;
    }

    const items = await PointShopItem.find(query)
      .sort({ pointCost: 1 });

    // 检查是否有游戏类型的商品
    let hasGameItems = items.some(item => item.type === 'game');

    if (!allowGameCenter) hasGameItems = false;

    res.status(200).json({
      success: true,
      items,
      hasGameItems
    });
  } catch (error) {
    logger.error('获取积分商店商品失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取商品列表失败',
      error: error.message
    });
  }
};

// 获取单个商品详情
exports.getItemById = async (req, res) => {
  try {
    const { itemId } = req.params;
    logger.info('获取积分商店商品详情', { userId: req.user._id, itemId });

    const item = await PointShopItem.findById(itemId);

    if (!item) {
      logger.warn('未找到商品', { itemId });
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    res.status(200).json({
      success: true,
      item
    });
  } catch (error) {
    logger.error('获取积分商店商品详情失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取商品详情失败',
      error: error.message
    });
  }
};

// 兑换商品
exports.redeemItem = async (req, res) => {
  let operation;
  try {
    if (req.user.role !== 'student') return res.status(403).json({ success: false, message: '仅学生可以兑换商品' });
    const item = await PointShopItem.findById(req.params.itemId);
    if (!item || !item.isActive) return res.status(404).json({ success: false, message: '商品不存在或已下架' });
    const student = await User.findById(req.user._id).select('classId');
    const classInfo = student?.classId && await Class.findById(student.classId).select('teacher allowGameCenter');
    if (!classInfo?.teacher || String(classInfo.teacher) !== String(item.createdBy) ||
        (item.type === 'game' && classInfo.allowGameCenter === false)) {
      return res.status(403).json({ success: false, message: '无权兑换该商品' });
    }
    if (!await Achievement.exists({ studentId: req.user._id })) return res.status(404).json({ success: false, message: '学生积分账户不存在' });
    operation = await ShopOperation.create({ studentId: req.user._id, itemId: item._id,
      itemName: item.name, itemType: item.type, pointCost: item.pointCost,
      duration: ['network_time', 'game'].includes(item.type) ? item.duration : 0 });
    const result = await settleOperation(operation);
    if (result.reason) return res.status(400).json({ success: false, message: result.reason });
    return res.status(200).json({ success: true, message: '兑换成功', record: result.record });
  } catch (error) {
    logger.error('商品兑换处理失败', { operationId: operation?.id, error: error.message });
    if (operation) return res.status(202).json({ success: false, processing: true, operationId: operation.id,
      message: '兑换正在处理，请稍后查看兑换记录，勿重复兑换' });
    return res.status(500).json({ success: false, message: '兑换失败，请稍后重试' });
  }
};

// 获取学生的兑换记录
exports.getStudentRedemptions = async (req, res) => {
  try {
    logger.info('获取学生兑换记录', { userId: req.user._id });

    const records = await RedemptionRecord.find({ studentId: req.user._id })
      .sort({ redeemTime: -1 });

    res.status(200).json({
      success: true,
      records
    });
  } catch (error) {
    logger.error('获取学生兑换记录失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取兑换记录失败',
      error: error.message
    });
  }
};

// 使用网络时间或其他类型
exports.useNetworkTime = async (req, res) => {
  try {
    const { recordId } = req.params;
    logger.info('学生使用兑换券', { userId: req.user._id, recordId });

    // 查找兑换记录
    const record = await RedemptionRecord.findById(recordId);

    if (record?.itemType === 'game') return res.status(400).json({ success: false, message: '请使用游戏券激活接口' });

    if (!record) {
      logger.warn('未找到兑换记录', { recordId });
      return res.status(404).json({
        success: false,
        message: '未找到兑换记录'
      });
    }

    // 验证记录是否属于当前学生
    if (record.studentId.toString() !== req.user._id.toString()) {
      logger.warn('无权使用该记录', { userId: req.user._id, recordId });
      return res.status(403).json({
        success: false,
        message: '无权使用该记录'
      });
    }

    // 检查记录状态
    if (record.status !== 'pending') {
      logger.warn('记录状态不是待使用', { recordId, status: record.status });
      return res.status(400).json({
        success: false,
        message: '该记录已被使用或已过期'
      });
    }

    let networkDuration = 0;

    // 如果是网络时间类型，获取时长
    if (record.itemType === 'network_time') {
      // 查找记录对应的商品以获取网络时间时长
      const item = await PointShopItem.findById(record.itemId);
      networkDuration = 60; // 默认60分钟

      if (record.duration > 0) {
        networkDuration = record.duration;
      } else if (item && item.duration > 0) {
        networkDuration = item.duration;
      }
    }

    // 更新记录状态为已完成，并记录使用时间
    const consumed = await RedemptionRecord.findOneAndUpdate(
      { _id: record._id, studentId: req.user._id, status: 'pending' },
      { $set: { status: 'completed', useTime: new Date() } }, { new: true });
    if (!consumed) return res.status(400).json({ success: false, message: '该记录已被使用或已过期' });
    record.useTime = consumed.useTime;

    logger.info('兑换券使用成功', {
      userId: req.user._id,
      recordId,
      itemType: record.itemType,
      networkDuration: record.itemType === 'network_time' ? networkDuration : 0,
      useTime: record.useTime
    });

    const responseMessage = record.itemType === 'network_time'
      ? '上网时间已激活'
      : record.itemType === 'game'
        ? '游戏时间已记录'
        : '兑换券已使用';

    res.status(200).json({
      success: true,
      message: responseMessage,
      networkDuration: record.itemType === 'network_time' ? networkDuration : 0
    });

  } catch (error) {
    logger.error('使用兑换券失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '使用兑换券失败',
      error: error.message
    });
  }
};

// 使用游戏
exports.useGame = async (req, res) => {
  try {
    const { recordId } = req.params;
    logger.info('学生使用游戏', { userId: req.user._id, recordId });

    // 查找兑换记录
    const record = await RedemptionRecord.findById(recordId);

    if (!record) {
      logger.warn('未找到兑换记录', { recordId });
      return res.status(404).json({
        success: false,
        message: '未找到兑换记录'
      });
    }

    // 验证记录是否属于当前学生
    if (record.studentId.toString() !== req.user._id.toString()) {
      logger.warn('无权使用该记录', { userId: req.user._id, recordId });
      return res.status(403).json({
        success: false,
        message: '无权使用该记录'
      });
    }

    // 检查记录类型和状态
    if (record.itemType !== 'game') {
      logger.warn('记录类型不是游戏', { recordId, itemType: record.itemType });
      return res.status(400).json({
        success: false,
        message: '该记录不是游戏类型'
      });
    }

    if (record.status !== 'pending') {
      logger.warn('记录状态不是待使用', { recordId, status: record.status });
      return res.status(400).json({
        success: false,
        message: '该记录已被使用或已过期'
      });
    }

    // 不再检查过期时间

    // 获取游戏时长（分钟）
    let gameDuration = 15; // 默认15分钟
    if (record.duration > 0) {
      gameDuration = record.duration;
    }

    const incrementSeconds = Math.max(0, Math.floor(gameDuration * 60));
    // Delivery and its receipt are atomic on User. A retry after a crash cannot add time twice.
    let updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, usedGameRedemptions: { $ne: record._id } },
      { $inc: { gameTimeRemainingSeconds: incrementSeconds }, $addToSet: { usedGameRedemptions: record._id } },
      { new: true });
    if (!updatedUser) updatedUser = await User.findById(req.user._id).select('gameTimeRemainingSeconds');
    if (!updatedUser) throw new Error('学生账号不存在');
    const consumed = await RedemptionRecord.findOneAndUpdate(
      { _id: record._id, studentId: req.user._id, status: 'pending' },
      { $set: { status: 'completed', useTime: new Date() } }, { new: true });
    record.useTime = consumed?.useTime;

    const remainingSeconds = Math.max(0, Number(updatedUser?.gameTimeRemainingSeconds) || 0);

    logger.info('游戏使用成功并增加剩余时长', {
      userId: req.user._id,
      recordId,
      gameDurationMinutes: gameDuration,
      incrementSeconds,
      remainingSeconds,
      useTime: record.useTime
    });

    res.status(200).json({
      success: true,
      message: '游戏时长已增加',
      gameDuration,
      remainingSeconds
    });

  } catch (error) {
    logger.error('使用游戏失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '使用游戏失败',
      error: error.message
    });
  }
};

// ===== 管理员接口 =====

// 创建新商品
exports.createItem = async (req, res) => {
  try {
    // 检查用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      logger.warn('无权创建商品', { userId: req.user._id, role: req.user.role });
      return res.status(403).json({
        success: false,
        message: '无权进行此操作'
      });
    }

    const { name, description, pointCost, type, image, duration, stock } = req.body;

    logger.info('创建积分商店商品', { userId: req.user._id, itemName: name });

    const newItem = await PointShopItem.create({
      name,
      description,
      pointCost,
      type,
      image,
      duration: (type === 'network_time' || type === 'game') ? duration : 0,
      stock: stock ?? -1,
      isActive: true,
      createdBy: req.user._id  // 记录创建者
    });

    logger.info('积分商店商品创建成功', { userId: req.user._id, itemId: newItem._id });

    res.status(201).json({
      success: true,
      message: '商品创建成功',
      item: newItem
    });
  } catch (error) {
    logger.error('创建积分商店商品失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '商品创建失败',
      error: error.message
    });
  }
};

// 更新商品
exports.updateItem = async (req, res) => {
  try {
    // 检查用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      logger.warn('无权更新商品', { userId: req.user._id, role: req.user.role });
      return res.status(403).json({
        success: false,
        message: '无权进行此操作'
      });
    }

    const { itemId } = req.params;
    const updateData = {};
    for (const key of ['name', 'description', 'pointCost', 'type', 'image', 'duration', 'stock', 'isActive', 'gameUrl']) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    logger.info('更新积分商店商品', { userId: req.user._id, itemId });

    const updatedItem = await PointShopItem.findOneAndUpdate(
      { _id: itemId, ...(req.user.role === 'teacher' ? { createdBy: req.user._id } : {}) },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      logger.warn('未找到商品', { itemId });
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    logger.info('积分商店商品更新成功', { userId: req.user._id, itemId });

    res.status(200).json({
      success: true,
      message: '商品更新成功',
      item: updatedItem
    });
  } catch (error) {
    logger.error('更新积分商店商品失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '商品更新失败',
      error: error.message
    });
  }
};

// 删除商品
exports.deleteItem = async (req, res) => {
  try {
    // 检查用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      logger.warn('无权删除商品', { userId: req.user._id, role: req.user.role });
      return res.status(403).json({
        success: false,
        message: '无权进行此操作'
      });
    }

    const { itemId } = req.params;

    logger.info('删除积分商店商品', { userId: req.user._id, itemId });

    // Preserve durable reservation receipts for pending recovery and existing vouchers.
    const result = await PointShopItem.findOneAndUpdate({ _id: itemId, ...(req.user.role === 'teacher' ? { createdBy: req.user._id } : {}) }, { $set: { isActive: false } });

    if (!result) {
      logger.warn('未找到商品', { itemId });
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    logger.info('积分商店商品删除成功', { userId: req.user._id, itemId });

    res.status(200).json({
      success: true,
      message: '商品删除成功'
    });
  } catch (error) {
    logger.error('删除积分商店商品失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '商品删除失败',
      error: error.message
    });
  }
};

// 管理员获取所有学生兑换记录
exports.getAllStudentRedemptions = async (req, res) => {
  try {
    // 检查用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      logger.warn('无权获取所有学生兑换记录', { userId: req.user._id, role: req.user.role });
      return res.status(403).json({
        success: false,
        message: '无权进行此操作'
      });
    }

    logger.info('获取所有学生兑换记录', { userId: req.user._id });

    // 准备查询条件
    const query = {};

    // 支持按学生ID筛选
    if (req.query.studentId) {
      query.studentId = req.query.studentId;
    }

    // 支持按学号查询
    if (req.query.username) {
      // 先根据学号查找学生
      const student = await User.findOne({ username: req.query.username });
      if (student) {
        query.studentId = student._id;
      } else {
        // 如果找不到学生，返回空结果
        return res.status(200).json({
          success: true,
          records: [],
          total: 0
        });
      }
    }

    // 支持按商品类型筛选
    if (req.query.itemType) {
      query.itemType = req.query.itemType;
    }

    // 支持按状态筛选
    if (req.query.status) {
      query.status = req.query.status;
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
          records: [],
          total: 0
        });
      }
    }

    // 获取兑换记录，并关联学生信息
    const records = await RedemptionRecord.find(query)
      .populate({
        path: 'studentId',
        select: 'name avatar username classId',
        populate: {
          path: 'classId',
          select: 'name grade'
        }
      })
      .sort({ redeemTime: -1 });

    // 转换格式，使字段更易理解
    const formattedRecords = records.map(record => {
      const student = record.studentId || null;
      const classObj = student && student.classId ? student.classId : null;
      return {
        _id: record._id,
        studentId: student ? student._id : null,
        student: student ? {
          _id: student._id,
          name: student.name,
          avatar: student.avatar,
          username: student.username,
          classId: classObj ? classObj._id : null,
          className: classObj ? classObj.name : null,
          grade: classObj ? classObj.grade : null
        } : null,
        itemId: record.itemId,
        itemName: record.itemName,
        itemType: record.itemType,
        pointCost: record.pointCost,
        duration: record.duration,
        status: record.status,
        redeemTime: record.redeemTime,
        useTime: record.useTime,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        recordType: 'redemption' // 标记为兑换记录
      };
    });

    // 获取学生参与的众筹活动记录
    let crowdfundingContributions = [];
    if (!req.query.itemType || req.query.itemType === 'crowdfunding') {
      const { CrowdfundingContribution, Crowdfunding } = require('../models/Crowdfunding');

      // 构建众筹贡献查询条件
      const contributionQuery = {};

      if (query.studentId) {
        contributionQuery.studentId = query.studentId;
      }

      // 获取众筹贡献记录
      crowdfundingContributions = await CrowdfundingContribution.find(contributionQuery)
        .populate({
          path: 'studentId',
          select: 'name avatar username classId',
          populate: {
            path: 'classId',
            select: 'name grade'
          }
        })
        .populate({
          path: 'crowdfundingId',
          select: 'title type status'
        })
        .sort({ timestamp: -1 });

      // 转换格式
      crowdfundingContributions = crowdfundingContributions.map(contribution => {
        const student = contribution.studentId || null;
        const classObj = student && student.classId ? student.classId : null;
        const crowdfunding = contribution.crowdfundingId || null;
        return {
          _id: contribution._id,
          studentId: student ? student._id : null,
          student: student ? {
            _id: student._id,
            name: student.name,
            avatar: student.avatar,
            username: student.username,
            classId: classObj ? classObj._id : null,
            className: classObj ? classObj.name : null,
            grade: classObj ? classObj.grade : null
          } : null,
          itemId: crowdfunding ? crowdfunding._id : null,
          itemName: crowdfunding ? `众筹: ${crowdfunding.title}` : '众筹: 已删除',
          itemType: 'crowdfunding',
          pointCost: contribution.points,
          message: contribution.message,
          status: 'completed', // 众筹贡献一旦完成即视为已使用
          redeemTime: contribution.timestamp,
          useTime: contribution.timestamp,
          createdAt: contribution.createdAt,
          updatedAt: contribution.updatedAt,
          recordType: 'crowdfunding' // 标记为众筹记录
        };
      });
    }

    // 合并两种记录并按时间排序
    const allRecords = [...formattedRecords, ...crowdfundingContributions]
      .sort((a, b) => new Date(b.redeemTime) - new Date(a.redeemTime));

    logger.info('获取所有学生兑换和众筹记录成功', {
      userId: req.user._id,
      count: allRecords.length,
      redemptionCount: formattedRecords.length,
      crowdfundingCount: crowdfundingContributions.length
    });

    res.status(200).json({
      success: true,
      records: allRecords,
      total: allRecords.length
    });
  } catch (error) {
    logger.error('获取所有学生兑换记录失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取学生兑换记录失败',
      error: error.message
    });
  }
};
