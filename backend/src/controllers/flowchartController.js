const FlowchartSubmission = require('../models/FlowchartSubmission');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const Class = require('../models/Class');
const logger = require('../utils/logger');
const PointsManager = require('../utils/pointsManager');

// 提交流程图
exports.submitFlowchart = async (req, res) => {
  try {
    logger.info('提交流程图', { userId: req.user._id });

    const { lessonId, activityId, flowchartData, duration } = req.body;

    // 验证必填字段
    if (!lessonId || !activityId || !flowchartData) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段'
      });
    }

    // 验证流程图数据格式（支持 JSON 和 XML 两种格式）
    let isValidFormat = false;
    let nodeCount = 0;
    let edgeCount = 0;

    // 尝试解析为 JSON 格式（旧版 React Flow 格式）
    try {
      const parsedData = JSON.parse(flowchartData);
      if (parsedData.nodes && Array.isArray(parsedData.nodes)) {
        isValidFormat = true;
        nodeCount = parsedData.nodes.length;
        edgeCount = parsedData.edges ? parsedData.edges.length : 0;
      }
    } catch (e) {
      // 不是 JSON，尝试解析为 XML 格式（mxGraph 格式）
      if (typeof flowchartData === 'string' && flowchartData.trim().startsWith('<')) {
        // 基本的 XML 格式验证
        if (flowchartData.includes('<mxGraphModel') || flowchartData.includes('<mxCell')) {
          isValidFormat = true;
          // 简单计算 mxCell 数量（每个节点/边都是一个 mxCell）
          const cellMatches = flowchartData.match(/<mxCell[^>]*>/g);
          if (cellMatches) {
            // 减去默认的两个根节点（id=0 和 id=1）
            const totalCells = cellMatches.length;
            // 边通常有 edge="1" 或 edge=1 属性
            const edgeMatches = flowchartData.match(/<mxCell[^>]*edge[^>]*>/g);
            edgeCount = edgeMatches ? edgeMatches.length : 0;
            nodeCount = Math.max(0, totalCells - 2 - edgeCount);
          }
        }
      }
    }

    if (!isValidFormat) {
      return res.status(400).json({
        success: false,
        message: '流程图数据格式无效'
      });
    }

    // 检查是否已有提交记录
    const existingSubmission = await FlowchartSubmission.findOne({
      userId: req.user._id,
      lessonId,
      activityId
    });

    if (existingSubmission) {
      // 更新现有记录
      existingSubmission.flowchartData = flowchartData;
      existingSubmission.duration = duration || 0;
      existingSubmission.submittedAt = new Date();
      existingSubmission.status = 'submitted';
      let submission;
      if (req.user.role === 'student') {
        submission = await existingSubmission.save();
        logger.info('流程图更新成功(已写入数据库)', {
          submissionId: existingSubmission._id,
          nodeCount: existingSubmission.nodeCount,
          edgeCount: existingSubmission.edgeCount
        });
      } else {
        submission = existingSubmission;
        logger.info('教师模拟：流程图更新成功(未写入数据库)', {
          submissionId: existingSubmission._id,
          nodeCount: existingSubmission.nodeCount,
          edgeCount: existingSubmission.edgeCount
        });
      }

      return res.status(200).json({
        success: true,
        message: '流程图更新成功',
        submission: existingSubmission
      });
    }

    // 创建新记录
    const submission = new FlowchartSubmission({
      userId: req.user._id,
      lessonId,
      activityId,
      flowchartData,
      duration: duration || 0,
      status: 'submitted'
    });

    if (req.user.role === 'student') {
      await submission.save();

      // 添加积分奖励（首次提交）
      try {
        await PointsManager.addPoints(
          req.user._id,
          50,  // 流程图提交奖励50积分
          'task_completion',
          '流程图绘制提交',
          submission._id
        );
        logger.info('流程图提交积分添加成功', { userId: req.user._id, points: 50 });
      } catch (pointError) {
        logger.error('添加积分失败', { error: pointError.message });
      }
      logger.info('流程图提交成功(已写入数据库)', {
        submissionId: submission._id,
        nodeCount: submission.nodeCount,
        edgeCount: submission.edgeCount
      });
    } else {
      submission._id = new require('mongoose').Types.ObjectId();
      logger.info('教师模拟：流程图提交成功(未写入数据库)', {
        submissionId: submission._id,
        nodeCount: submission.nodeCount,
        edgeCount: submission.edgeCount
      });
    }

    res.status(201).json({
      success: true,
      message: '流程图提交成功',
      submission
    });
  } catch (error) {
    logger.error('提交流程图失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '提交流程图失败',
      error: error.message
    });
  }
};

// 保存流程图草稿
exports.saveDraft = async (req, res) => {
  try {
    logger.info('保存流程图草稿', { userId: req.user._id });

    const { lessonId, activityId, flowchartData } = req.body;

    if (!lessonId || !activityId || !flowchartData) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段'
      });
    }

    // 查找或创建草稿
    let submission = await FlowchartSubmission.findOne({
      userId: req.user._id,
      lessonId,
      activityId
    });

    if (submission) {
      submission.flowchartData = flowchartData;
      await submission.save();
    } else {
      submission = new FlowchartSubmission({
        userId: req.user._id,
        lessonId,
        activityId,
        flowchartData,
        status: 'draft'
      });
      await submission.save();
    }

    logger.info('流程图草稿保存成功', { submissionId: submission._id });

    res.status(200).json({
      success: true,
      message: '草稿保存成功',
      submission
    });
  } catch (error) {
    logger.error('保存流程图草稿失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '保存草稿失败',
      error: error.message
    });
  }
};

// 获取用户的流程图提交记录
exports.getSubmission = async (req, res) => {
  try {
    const { lessonId, activityId } = req.query;

    logger.info('获取流程图提交记录', {
      userId: req.user._id,
      lessonId,
      activityId
    });

    const submission = await FlowchartSubmission.findOne({
      userId: req.user._id,
      lessonId,
      activityId
    });

    if (!submission) {
      return res.status(200).json({
        success: true,
        submission: null
      });
    }

    res.status(200).json({
      success: true,
      submission
    });
  } catch (error) {
    logger.error('获取流程图提交记录失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取提交记录失败',
      error: error.message
    });
  }
};

// 教师端 - 获取活动的所有提交记录
exports.getActivitySubmissions = async (req, res) => {
  try {
    const { lessonId, activityId, classId } = req.query;

    logger.info('获取活动流程图提交列表', {
      teacherId: req.user._id,
      lessonId,
      activityId,
      classId
    });

    let query = { lessonId, activityId };

    // 如果指定了班级，筛选该班级的学生
    if (classId) {
      const studentsInClass = await User.find({ classId }).select('_id');
      const studentIds = studentsInClass.map(s => s._id);
      query.userId = { $in: studentIds };
    }

    const submissions = await FlowchartSubmission.find(query)
      .populate({
        path: 'userId',
        select: 'name studentId role classId',
        populate: {
          path: 'classId',
          select: 'grade name status'
        }
      })
      .sort({ submittedAt: -1 });

    // 过滤掉教师模拟提交的记录（只保留学生的提交），并过滤掉已被归档班级的学生
    const studentSubmissions = submissions.filter(s => {
      const isStudent = s.userId?.role === 'student';
      const isArchived = s.userId?.classId?.status === 'archived';
      return isStudent && !isArchived;
    });

    res.status(200).json({
      success: true,
      submissions: studentSubmissions
    });
  } catch (error) {
    logger.error('获取活动流程图提交列表失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取提交列表失败',
      error: error.message
    });
  }
};

// 教师端 - 评分流程图
exports.gradeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { score, feedback } = req.body;

    logger.info('评分流程图', {
      teacherId: req.user._id,
      submissionId,
      score
    });

    // 如果score不是null，验证范围
    if (score !== null && score !== undefined && (score < 0 || score > 10)) {
      return res.status(400).json({
        success: false,
        message: '评分必须在0-10之间'
      });
    }

    const submission = await FlowchartSubmission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: '提交记录不存在'
      });
    }

    // 保存旧分数用于积分更新
    const oldScore = submission.grade ? submission.grade.score : null;

    // 如果score为null，则清除评分
    if (score === null) {
      submission.grade = null;
      submission.status = 'submitted';  // 恢复为已提交状态
    } else {
      submission.grade = {
        score,
        feedback: feedback || '',
        gradedAt: new Date(),
        gradedBy: req.user._id
      };
      submission.status = 'graded';
    }

    await submission.save();

    // 更新积分
    try {
      if (score === null) {
        // 清除评分时，撤销积分
        if (oldScore !== null) {
          await PointsManager.deductPoints(
            submission.userId,
            oldScore * 10,
            'task_completion_revoked',
            '流程图评分已清除',
            submissionId
          );
        }
      } else {
        await PointsManager.updatePoints(
          submission.userId,
          score * 10,  // 新积分
          oldScore !== null ? oldScore * 10 : null, // 旧积分
          submissionId,
          'task_completion',
          `流程图评分: ${score}分`
        );
      }
      logger.info('流程图评分积分更新成功', {
        submissionId,
        studentId: submission.userId,
        score
      });
    } catch (pointsError) {
      logger.error('流程图评分积分更新失败', { error: pointsError.message });
      // 积分更新失败不影响评分结果
    }

    logger.info(score === null ? '流程图评分已清除' : '流程图评分成功', {
      submissionId,
      score,
      studentId: submission.userId
    });

    res.status(200).json({
      success: true,
      message: score === null ? '评分已清除' : '评分成功',
      submission
    });
  } catch (error) {
    logger.error('评分流程图失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '评分失败',
      error: error.message
    });
  }
};


// 教师端 - 获取班级的流程图统计
exports.getClassStats = async (req, res) => {
  try {
    const { lessonId, activityId, classId } = req.query;

    logger.info('获取班级流程图统计', {
      teacherId: req.user._id,
      lessonId,
      activityId,
      classId
    });

    // 获取班级学生
    const studentsInClass = await User.find({ classId }).select('_id name studentId');
    const studentIds = studentsInClass.map(s => s._id);

    // 获取提交记录
    const submissions = await FlowchartSubmission.find({
      lessonId,
      activityId,
      userId: { $in: studentIds }
    });

    // 计算统计数据
    const totalStudents = studentsInClass.length;
    const submittedCount = submissions.length;
    const gradedCount = submissions.filter(s => s.status === 'graded').length;
    const averageScore = gradedCount > 0
      ? Math.round(submissions.filter(s => s.grade?.score).reduce((sum, s) => sum + s.grade.score, 0) / gradedCount)
      : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        submittedCount,
        notSubmittedCount: totalStudents - submittedCount,
        gradedCount,
        averageScore,
        submissionRate: totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0
      }
    });
  } catch (error) {
    logger.error('获取班级流程图统计失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    });
  }
};

// 删除流程图提交记录（教师专用）
exports.deleteSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;

    logger.info('删除流程图提交记录', {
      teacherId: req.user._id,
      submissionId
    });

    const submission = await FlowchartSubmission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: '提交记录不存在'
      });
    }

    // 如果已经添加过积分，扣除积分
    try {
      await PointsManager.deductPoints(
        submission.userId,
        50,
        'task_completion_revoked',
        '流程图提交记录删除',
        submission._id
      );
      logger.info('已扣除流程图提交积分', { studentId: submission.userId, points: 50 });
    } catch (pointError) {
      logger.error('扣除积分失败', { error: pointError.message });
    }

    await FlowchartSubmission.findByIdAndDelete(submissionId);

    logger.info('流程图提交记录删除成功', { submissionId });

    res.status(200).json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    logger.error('删除流程图提交记录失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '删除失败',
      error: error.message
    });
  }
};

