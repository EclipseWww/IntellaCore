const { Crowdfunding, CrowdfundingContribution } = require('../models/Crowdfunding');
const Achievement = require('../models/Achievement');
const logger = require('../utils/logger');
const User = require('../models/User');
const CrowdfundingOperation = require('../models/CrowdfundingOperation');

// 创建众筹活动（管理员和教师权限）
exports.createCrowdfunding = async (req, res) => {
  try {
    logger.info('创建众筹活动', { userId: req.user._id });
    
    const { 
      title, 
      description, 
      targetPoints, 
      type, 
      reward, 
      image, 
      startDate, 
      endDate,
      classId
    } = req.body;
    
    // 验证班级ID是否存在
    if (!classId) {
      return res.status(400).json({
        success: false,
        message: '班级ID是必填项'
      });
    }
    
    // 创建新众筹活动
    const crowdfunding = await Crowdfunding.create({
      title,
      description,
      targetPoints,
      type,
      reward,
      image,
      startDate: startDate || new Date(),
      endDate,
      status: 'pending',
      createdBy: req.user._id,
      classId
    });
    
    logger.info('众筹活动创建成功', { crowdfundingId: crowdfunding._id, classId });
    
    res.status(201).json({
      success: true,
      message: '众筹活动创建成功',
      crowdfunding
    });
  } catch (error) {
    logger.error('创建众筹活动失败', { error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: '创建众筹活动失败',
      error: error.message
    });
  }
};

// 批量创建众筹活动（管理员和教师权限）
exports.batchCreateCrowdfunding = async (req, res) => {
  try {
    logger.info('批量创建众筹活动', { userId: req.user._id });
    
    const { 
      title, 
      description, 
      targetPoints, 
      type, 
      reward, 
      image, 
      startDate, 
      endDate,
      classIds // 班级ID数组
    } = req.body;
    
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少选择一个班级'
      });
    }
    
    // 创建众筹活动数组
    const crowdfundings = await Promise.all(
      classIds.map(async (classId) => {
        // 为每个班级创建独立的众筹活动
        return await Crowdfunding.create({
          title,
          description,
          targetPoints,
          type,
          reward,
          image,
          startDate: startDate || new Date(),
          endDate,
          status: 'pending',
          createdBy: req.user._id,
          classId
        });
      })
    );
    
    logger.info('批量众筹活动创建成功', { 
      count: crowdfundings.length, 
      classIds, 
      createdBy: req.user._id 
    });
    
    res.status(201).json({
      success: true,
      message: `成功为${crowdfundings.length}个班级创建众筹活动`,
      crowdfundings
    });
  } catch (error) {
    logger.error('批量创建众筹活动失败', { error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: '批量创建众筹活动失败',
      error: error.message
    });
  }
};

// 获取众筹活动列表
exports.getCrowdfundingList = async (req, res) => {
  try {
    logger.info('获取众筹活动列表', { userId: req.user._id, role: req.user.role });
    
    const { status, limit = 10, page = 1, classId, includeCompleted, includeExpired } = req.query;
    const skip = (page - 1) * limit;
    
    // 构建查询条件
    const query = {};
    
    // 根据用户角色应用不同的过滤条件
    if (req.user.role === 'teacher' || req.user.role === 'admin') {
      // 管理员或教师可以看到所有状态的众筹
      if (status) {
        query.status = status;
      }
      
      // 若是教师，只看到自己创建的众筹
      if (req.user.role === 'teacher') {
        query.createdBy = req.user._id;
      }
      
      // 如果提供了班级ID，只显示该班级的众筹
      if (classId) {
        query.classId = classId;
      }
    } else {
      // 学生查询条件处理
      if (status) {
        // 如果明确指定了状态，就按指定状态查询
        query.status = status;
      } else {
        // 默认查询状态
        const statusArray = ['pending', 'active', 'ready_to_complete'];
        
        // 根据includeCompleted和includeExpired参数决定是否包含已完成和已过期的众筹
        if (includeCompleted === 'true') {
          statusArray.push('completed');
        }
        
        if (includeExpired === 'true') {
          statusArray.push('expired');
        }
        
        query.status = { $in: statusArray };
      }
      
      // 获取学生所在班级
      const user = await User.findById(req.user._id);
      if (user && user.classId) {
        // 查询该班级的众筹活动
        query.classId = user.classId;
      } else {
        // 学生没有班级，返回空数组
        return res.status(200).json({
          success: true,
          crowdfundings: [],
          pagination: {
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: 0
          }
        });
      }
    }
    
    // 查询众筹活动
    const crowdfundings = await Crowdfunding.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'username fullName')
      .populate('classId', 'grade name')
      .select('-participants'); // 不返回参与者列表，减少数据量
    
    // 计算总数
    const total = await Crowdfunding.countDocuments(query);
    
    res.status(200).json({
      success: true,
      crowdfundings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('获取众筹活动列表失败', { error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: '获取众筹活动列表失败',
      error: error.message
    });
  }
};

// 获取众筹活动详情
exports.getCrowdfundingDetail = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('获取众筹活动详情', { userId: req.user._id, crowdfundingId: id });
    
    // 查找众筹活动
    const crowdfunding = await Crowdfunding.findById(id);
    
    if (!crowdfunding) {
      logger.warn('众筹活动不存在', { crowdfundingId: id });
      return res.status(404).json({
        success: false,
        message: '众筹活动不存在'
      });
    }
    
    // 获取贡献记录
    const contributions = await CrowdfundingContribution.find({ crowdfundingId: id })
      .sort({ timestamp: -1 })
      .populate('studentId', 'username name avatar'); // 关联查询学生信息
    
    // 检查当前用户是否已参与
    const hasParticipated = crowdfunding.participants.includes(req.user._id);
    
    // 计算当前用户的参与情况
    let userParticipation = { hasParticipated };
    
    if (hasParticipated) {
      // 筛选出当前用户的贡献记录
      const userContributions = contributions.filter(
        contribution => contribution.studentId._id.toString() === req.user._id.toString()
      );
      
      // 计算总贡献积分
      const totalPoints = userContributions.reduce((sum, record) => sum + record.points, 0);
      
      // 获取最后一次贡献时间
      const lastContribution = userContributions.length > 0 
        ? userContributions[0].timestamp 
        : null;
      
      userParticipation = {
        hasParticipated: true,
        totalPoints,
        contributionCount: userContributions.length,
        lastContribution
      };
    }
    
    // 检查并更新众筹状态
    const currentStatus = await crowdfunding.checkStatus();
    
    res.status(200).json({
      success: true,
      crowdfunding,
      contributions,
      userParticipation
    });
  } catch (error) {
    logger.error('获取众筹活动详情失败', { error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: '获取众筹活动详情失败',
      error: error.message
    });
  }
};

// 参与众筹活动（学生权限）
exports.contributeToCrowdfunding = async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ success: false, message: '仅学生可参与众筹' });
    const result = await Crowdfunding.addContribution(req.params.id, req.user._id, req.body.points, req.body.message || '');
    if (result.processing) return res.status(202).json({ success: true, processing: true, operationId: result.operationId, message: '贡献正在处理，请勿重复提交，稍后刷新查看结果' });
    return res.json({ success: true, message: '成功参与众筹', ...result });
  } catch (error) {
    logger.error('参与众筹失败', { error: error.message });
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// 激活众筹活动（管理员和教师权限）
exports.activateCrowdfunding = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('激活众筹活动', { adminId: req.user._id, crowdfundingId: id });
    
    const crowdfunding = await Crowdfunding.findById(id);
    
    if (!crowdfunding) {
      logger.warn('众筹活动不存在', { crowdfundingId: id });
      return res.status(404).json({
        success: false,
        message: '众筹活动不存在'
      });
    }
    
    if (crowdfunding.status !== 'pending') {
      logger.warn('只能激活待处理状态的众筹活动', { 
        crowdfundingId: id, 
        currentStatus: crowdfunding.status 
      });
      
      return res.status(400).json({
        success: false,
        message: '只能激活待处理状态的众筹活动'
      });
    }
    
    // 更新状态为激活
    crowdfunding.status = 'active';
    await crowdfunding.save();
    
    logger.info('众筹活动激活成功', { crowdfundingId: id });
    
    res.status(200).json({
      success: true,
      message: '众筹活动激活成功',
      crowdfunding
    });
  } catch (error) {
    logger.error('激活众筹活动失败', { error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: '激活众筹活动失败',
      error: error.message
    });
  }
};

// 完成众筹活动并发放奖励（管理员和教师权限）
exports.completeCrowdfunding = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('完成众筹活动', { adminId: req.user._id, crowdfundingId: id });
    
    const crowdfunding = await Crowdfunding.findById(id);
    
    if (!crowdfunding) {
      logger.warn('众筹活动不存在', { crowdfundingId: id });
      return res.status(404).json({
        success: false,
        message: '众筹活动不存在'
      });
    }
    
    // 检查众筹状态是否为ready_to_complete或completed
    if (crowdfunding.status !== 'ready_to_complete' && crowdfunding.status !== 'completed') {
      logger.warn('众筹活动尚未达成目标或未准备好完成', { 
        crowdfundingId: id, 
        currentStatus: crowdfunding.status,
        currentPoints: crowdfunding.currentPoints,
        targetPoints: crowdfunding.targetPoints
      });
      
      return res.status(400).json({
        success: false,
        message: '众筹活动尚未达成目标或未准备好完成'
      });
    }
    
    // 如果是教师，检查是否为创建者
    if (req.user.role === 'teacher' && crowdfunding.createdBy.toString() !== req.user._id.toString()) {
      logger.warn('无权完成此众筹活动', { 
        teacherId: req.user._id, 
        crowdfundingCreator: crowdfunding.createdBy
      });
      
      return res.status(403).json({
        success: false,
        message: '只有创建者才能完成众筹活动'
      });
    }
    
    // 更新众筹状态为已完成
    if (crowdfunding.status !== 'completed') {
      crowdfunding.status = 'completed';
      await crowdfunding.save();
      
      logger.info('众筹活动状态已更新为已完成', { crowdfundingId: id });
    }
    
    // 发放奖励逻辑（这里可以创建一个网络时间奖励记录或其他类型的奖励）
    // 例如，如果是网络时间奖励，可以在相应的网络时间管理模块中添加奖励时间
    
    logger.info('众筹活动奖励发放成功', { 
      crowdfundingId: id,
      rewardType: crowdfunding.reward.type,
      rewardDuration: crowdfunding.reward.duration
    });
    
    res.status(200).json({
      success: true,
      message: '众筹活动奖励发放成功',
      crowdfunding
    });
  } catch (error) {
    logger.error('完成众筹活动失败', { error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: '完成众筹活动失败',
      error: error.message
    });
  }
};

// 获取我参与的众筹活动（学生权限）
exports.getMyParticipations = async (req, res) => {
  try {
    logger.info('获取我参与的众筹活动', { userId: req.user._id });
    
    // 查找学生参与的贡献记录
    const contributions = await CrowdfundingContribution.find({ 
      studentId: req.user._id 
    })
    .sort({ timestamp: -1 })
    .select('crowdfundingId points timestamp');
    
    // 获取相关的众筹活动ID
    const crowdfundingIds = [...new Set(contributions.map(c => c.crowdfundingId))];
    
    // 查询众筹活动详情
    const crowdfundings = await Crowdfunding.find({
      _id: { $in: crowdfundingIds }
    }).select('title status currentPoints targetPoints type reward endDate');
    
    // 组合数据
    const participations = contributions.map(contribution => {
      const crowdfunding = crowdfundings.find(
        cf => cf._id.toString() === contribution.crowdfundingId.toString()
      );
      
      return {
        contribution: {
          _id: contribution._id,
          points: contribution.points,
          timestamp: contribution.timestamp
        },
        crowdfunding: crowdfunding || { title: '已删除的众筹活动' }
      };
    });
    
    res.status(200).json({
      success: true,
      participations
    });
  } catch (error) {
    logger.error('获取参与众筹记录失败', { error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: '获取参与众筹记录失败',
      error: error.message
    });
  }
};

// 更新众筹活动（管理员和教师权限）
exports.updateCrowdfunding = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('更新众筹活动', { userId: req.user._id, crowdfundingId: id });
    
    const { 
      title, 
      description, 
      targetPoints, 
      type, 
      reward, 
      image, 
      startDate, 
      endDate,
      classId
    } = req.body;
    
    // 查找众筹活动
    const crowdfunding = await Crowdfunding.findById(id);
    
    if (!crowdfunding) {
      logger.warn('众筹活动不存在', { crowdfundingId: id });
      return res.status(404).json({
        success: false,
        message: '众筹活动不存在'
      });
    }
    
    // 检查当前用户是否有权限修改此众筹活动
    if (req.user.role === 'teacher' && crowdfunding.createdBy.toString() !== req.user._id.toString()) {
      logger.warn('无权更新此众筹活动', { 
        teacherId: req.user._id, 
        crowdfundingCreator: crowdfunding.createdBy
      });
      
      return res.status(403).json({
        success: false,
        message: '只有创建者才能更新众筹活动'
      });
    }
    
    // 检查众筹状态：不允许编辑已完成的众筹活动；允许编辑已过期的众筹活动
    if (crowdfunding.status === 'completed') {
      logger.warn('不能修改已完成或已过期的众筹活动', { 
        crowdfundingId: id, 
        status: crowdfunding.status 
      });
      
      return res.status(400).json({
        success: false,
        message: '不能修改已完成的众筹活动'
      });
    }
    
    // 验证班级ID是否存在
    if (!classId) {
      return res.status(400).json({
        success: false,
        message: '班级ID是必填项'
      });
    }
    
    // 更新众筹活动
    crowdfunding.title = title;
    crowdfunding.description = description || '';
    crowdfunding.targetPoints = targetPoints;
    crowdfunding.type = type;
    crowdfunding.reward = reward;
    crowdfunding.image = image || '';
    crowdfunding.startDate = startDate || crowdfunding.startDate;
    crowdfunding.endDate = endDate;
    crowdfunding.classId = classId;
    
    await crowdfunding.save();

    // 重新计算并更新状态（支持对已过期活动延长时间、调整目标后自动恢复/变更状态）
    try {
      const now = new Date();
      let newStatus = crowdfunding.status;
      if (crowdfunding.status !== 'completed') {
        if (now > crowdfunding.endDate) {
          newStatus = 'expired';
        } else if ((crowdfunding.currentPoints || 0) >= (crowdfunding.targetPoints || 0)) {
          newStatus = 'ready_to_complete';
        } else if (now >= crowdfunding.startDate) {
          newStatus = 'active';
        } else {
          newStatus = 'pending';
        }
        if (newStatus !== crowdfunding.status) {
          crowdfunding.status = newStatus;
          await crowdfunding.save();
          logger.info('众筹活动状态因编辑而更新', { crowdfundingId: id, newStatus });
        }
      }
    } catch (statusErr) {
      logger.error('编辑后更新众筹状态失败', { error: statusErr.message, stack: statusErr.stack, crowdfundingId: id });
    }

    logger.info('众筹活动更新成功', { crowdfundingId: id });
    
    res.status(200).json({
      success: true,
      message: '众筹活动更新成功',
      crowdfunding
    });
  } catch (error) {
    logger.error('更新众筹活动失败', { error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: '更新众筹活动失败',
      error: error.message
    });
  }
};

// 删除众筹活动（管理员和教师权限）
exports.deleteCrowdfunding = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('删除众筹活动', { userId: req.user._id, crowdfundingId: id });
    
    // 查找众筹活动
    const crowdfunding = await Crowdfunding.findById(id);
    
    if (!crowdfunding) {
      logger.warn('众筹活动不存在', { crowdfundingId: id });
      return res.status(404).json({
        success: false,
        message: '众筹活动不存在'
      });
    }
    
    // 检查当前用户是否有权限删除此众筹活动
    if (req.user.role === 'teacher' && crowdfunding.createdBy.toString() !== req.user._id.toString()) {
      logger.warn('无权删除此众筹活动', { 
        teacherId: req.user._id, 
        crowdfundingCreator: crowdfunding.createdBy
      });
      
      return res.status(403).json({
        success: false,
        message: '只有创建者才能删除众筹活动'
      });
    }
    
    // 如果众筹已开始并且有学生参与，不允许删除
    if (crowdfunding.status !== 'pending' && crowdfunding.participants.length > 0) {
      logger.warn('已有学生参与的众筹活动不能删除', { 
        crowdfundingId: id, 
        status: crowdfunding.status,
        participantsCount: crowdfunding.participants.length
      });
      
      return res.status(400).json({
        success: false,
        message: '已有学生参与的众筹活动不能删除'
      });
    }
    
    // 删除众筹活动
    const deleted = await Crowdfunding.findOneAndDelete({ _id: id, participants: { $size: 0 }, $or: [{ reservedPoints: { $exists: false } }, { reservedPoints: 0 }] });
    if (!deleted) return res.status(409).json({ success: false, message: '已有贡献或贡献正在处理，不能删除' });
    
    // 删除相关的贡献记录
    await CrowdfundingContribution.deleteMany({ crowdfundingId: id });
    
    logger.info('众筹活动删除成功', { crowdfundingId: id });
    
    res.status(200).json({
      success: true,
      message: '众筹活动删除成功'
    });
  } catch (error) {
    logger.error('删除众筹活动失败', { error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: '删除众筹活动失败',
      error: error.message
    });
  }
};

// 获取众筹活动贡献记录
exports.getCrowdfundingContributions = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('获取众筹活动贡献记录', { userId: req.user._id, crowdfundingId: id });
    
    // 先查询众筹活动，确认存在
    const crowdfunding = await Crowdfunding.findById(id);
    
    if (!crowdfunding) {
      logger.warn('众筹活动不存在', { crowdfundingId: id });
      return res.status(404).json({
        success: false,
        message: '众筹活动不存在'
      });
    }
    
    // 检查权限：只有管理员或该活动的创建者教师可以查看
    if (req.user.role === 'teacher' && crowdfunding.createdBy.toString() !== req.user._id.toString()) {
      logger.warn('无权查看此众筹活动贡献记录', { 
        teacherId: req.user._id, 
        crowdfundingCreator: crowdfunding.createdBy
      });
      
      return res.status(403).json({
        success: false,
        message: '只有创建者才能查看此众筹活动的贡献记录'
      });
    }
    
    // 获取贡献记录
    const contributions = await CrowdfundingContribution.find({ crowdfundingId: id })
      .sort({ timestamp: -1 })
      .populate('studentId', 'username name avatar class'); // 关联查询学生信息
    
    res.status(200).json({
      success: true,
      contributions
    });
  } catch (error) {
    logger.error('获取众筹活动贡献记录失败', { error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: '获取众筹活动贡献记录失败',
      error: error.message
    });
  }
};

// 删除众筹贡献记录
exports.deleteCrowdfundingContribution = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info('删除众筹贡献记录', { userId: req.user._id, contributionId: id });
    if (await CrowdfundingOperation.exists({ _id: id, status: 'pending' })) return res.status(409).json({ success: false, message: '贡献正在处理，请稍后删除' });
    
    // 查找贡献记录
    const contribution = await CrowdfundingContribution.findById(id);
    
    if (!contribution) {
      logger.warn('贡献记录不存在', { contributionId: id });
      return res.status(404).json({
        success: false,
        message: '贡献记录不存在'
      });
    }
    
    // 查找相关众筹活动
    const crowdfunding = await Crowdfunding.findById(contribution.crowdfundingId);
    
    if (!crowdfunding) {
      logger.warn('关联的众筹活动不存在', { 
        contributionId: id, 
        crowdfundingId: contribution.crowdfundingId 
      });
      return res.status(404).json({
        success: false,
        message: '关联的众筹活动不存在'
      });
    }
    
    // 权限检查：只有管理员或活动创建者教师可以删除贡献
    if (req.user.role === 'teacher' && crowdfunding.createdBy.toString() !== req.user._id.toString()) {
      logger.warn('无权删除此贡献记录', { 
        teacherId: req.user._id, 
        crowdfundingCreator: crowdfunding.createdBy
      });
      
      return res.status(403).json({
        success: false,
        message: '只有创建者才能删除此众筹活动的贡献记录'
      });
    }
    
    // 更新众筹活动的当前积分
    await Crowdfunding.findByIdAndUpdate(
      contribution.crowdfundingId,
      {
        $inc: { 
          currentPoints: -contribution.points,
          contributionsCount: -1
        }
      }
    );
    
    // 删除贡献记录
    await CrowdfundingContribution.findByIdAndDelete(id);
    
    logger.info('贡献记录删除成功', { contributionId: id });
    
    res.status(200).json({
      success: true,
      message: '贡献记录删除成功'
    });
  } catch (error) {
    logger.error('删除贡献记录失败', { error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: '删除贡献记录失败',
      error: error.message
    });
  }
}; 