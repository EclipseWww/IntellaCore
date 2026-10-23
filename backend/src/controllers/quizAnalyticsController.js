const QuizAnalytics = require('../models/QuizAnalytics');
const QuizSubmission = require('../models/QuizSubmission');
const Quiz = require('../models/Quiz');
const QuizAnalyticsService = require('../services/QuizAnalyticsService');
const logger = require('../utils/logger');

/**
 * 获取测验分析数据
 * @route GET /api/analytics/quizzes/:quizId
 * @access 仅教师
 */
exports.getQuizAnalytics = async (req, res) => {
  const { quizId } = req.params;
  const { classId } = req.query; // 获取班级ID参数
  
  try {
    const { refresh } = req.query;
    logger.info('获取测验分析数据', { quizId, classId, refresh });
    
    // 支持强制重算
    if (refresh === '1' || refresh === 'true') {
      logger.info('强制刷新测验分析数据', { quizId });
      await QuizAnalyticsService.updateQuizAnalytics(quizId);
    }
    
    // 缓存优先，无缓存则计算一次
    let analytics = await QuizAnalyticsService.getQuizAnalytics(quizId);
    if (!analytics) {
      await QuizAnalyticsService.updateQuizAnalytics(quizId);
      analytics = await QuizAnalyticsService.getQuizAnalytics(quizId);
    }
    
    // 获取分析数据
    if (!analytics) {
      logger.warn('未找到测验分析数据', { quizId });
      return res.status(404).json({ message: '未找到测验分析数据' });
    }
    
    // 构建查询条件，如果有班级ID则按班级筛选
    const submissionQuery = { quizId };
    if (classId) {
      // 不直接查询 classId，而是通过关联的学生信息查询
      logger.info('按班级筛选测验提交记录', { quizId, classId });
    }
    
    // 获取提交记录
    const submissions = await QuizSubmission.find(submissionQuery)
      .sort({ submitTime: -1 })
      .populate('studentId', 'name email classId')
      .populate({ path: 'answers.questionId', select: 'type' });
    
    // 如果有班级ID，过滤出该班级的提交记录
    let filteredSubmissions = submissions;
    if (classId) {
      filteredSubmissions = submissions.filter(submission => 
        submission.studentId && 
        submission.studentId.classId && 
        submission.studentId.classId.toString() === classId
      );
      
      logger.info('班级筛选结果', { 
        quizId, 
        classId,
        totalSubmissions: submissions.length,
        filteredSubmissions: filteredSubmissions.length 
      });
    }
    
    logger.info('获取到测验提交记录', { 
      quizId, 
      classId: classId || 'all',
      submissionCount: filteredSubmissions.length 
    });
    
    // 如果按班级筛选，需要重新计算每个题目的选项选择比例和统计数据
    const optionStatistics = {};
    const questionAttempts = {}; // 记录每个题目的尝试次数和正确次数
    
    filteredSubmissions.forEach(submission => {
      submission.answers.forEach(answer => {
        const questionId = answer.questionId && answer.questionId._id ? answer.questionId._id.toString() : null;
        if (!questionId) return;
        
        // 更新选项统计
        if (!optionStatistics[questionId]) {
          optionStatistics[questionId] = {};
        }
        
        // 根据题型分别统计：量表题使用 scaleValue 或 matrixAnswers
        const qType = answer.questionId?.type;
        if (qType === 'PSYCHOLOGICAL_SCALE') {
          const matrixEntries = (answer.matrixAnswers instanceof Map)
            ? Array.from(answer.matrixAnswers.entries())
            : (answer.matrixAnswers ? Object.entries(answer.matrixAnswers) : []);
          if (matrixEntries.length > 0) {
            matrixEntries.forEach(([rowId, v]) => {
              const numeric = Number(v);
              const oneBased = Number.isFinite(numeric) ? (numeric + 1) : v;
              const key = `matrix_${rowId}_${oneBased}`;
              optionStatistics[questionId][key] = (optionStatistics[questionId][key] || 0) + 1;
            });
          } else if (answer.scaleValue != null) {
            const oneBased = Number(answer.scaleValue);
            const key = `scale_${oneBased}`;
            optionStatistics[questionId][key] = (optionStatistics[questionId][key] || 0) + 1;
          }
        } else {
          const selectedOption = answer.selectedOption ? answer.selectedOption.toString() : 'none';
          optionStatistics[questionId][selectedOption] = (optionStatistics[questionId][selectedOption] || 0) + 1;
        }
        
        // 更新尝试次数和正确次数
        if (!questionAttempts[questionId]) {
          questionAttempts[questionId] = {
            totalAttempts: 0,
            correctAttempts: 0
          };
        }
        
        questionAttempts[questionId].totalAttempts++;
        if (answer.isCorrect) {
          questionAttempts[questionId].correctAttempts++;
        }
      });
    });
    
    // 计算扩展统计数据（基于筛选后的提交记录）
    const stats = calculateExtendedStats(analytics, filteredSubmissions);
    
    // 将 Mongoose 对象转换为普通 JavaScript 对象
    const analyticsObj = analytics.toObject();
    
    // 如果按班级筛选，使用重新计算的题目分析数据
    if (classId) {
      // 更新总提交数量为筛选后的数量
      analyticsObj.totalSubmissions = filteredSubmissions.length;
      
      // 重新计算平均分
      if (filteredSubmissions.length > 0) {
        const totalScore = filteredSubmissions.reduce((sum, s) => sum + s.score, 0);
        analyticsObj.averageScore = totalScore / filteredSubmissions.length;
      } else {
        analyticsObj.averageScore = 0;
      }
      
      // 更新题目分析数据（按班级筛选后重新统计）
      analyticsObj.questionAnalytics = analyticsObj.questionAnalytics.map(question => {
        const questionId = question.questionId.toString();
        const attempts = questionAttempts[questionId] || { totalAttempts: 0, correctAttempts: 0 };
        
        // 直接使用整数计数，与不筛选班级时保持一致的数据格式
        const optionDist = optionStatistics[questionId] || {};
        
        return {
          ...question,
          totalAttempts: attempts.totalAttempts,
          correctAttempts: attempts.correctAttempts,
          optionDistribution: optionDist
        };
      });
    } else {
      // 过滤掉以 $ 开头的键
      if (analyticsObj.questionAnalytics) {
        analyticsObj.questionAnalytics.forEach((question, index) => {
          // 处理 optionDistribution
          if (analytics.questionAnalytics[index].optionDistribution instanceof Map) {
            // 如果是 Map 类型，转换为普通对象
            const optionDistEntries = Array.from(analytics.questionAnalytics[index].optionDistribution.entries())
              .filter(([key]) => !key.startsWith('$'));
            question.optionDistribution = Object.fromEntries(optionDistEntries);
          }
          
          // 处理 attemptWiseAccuracy
          if (analytics.questionAnalytics[index].attemptWiseAccuracy instanceof Map) {
            const accuracyEntries = Array.from(analytics.questionAnalytics[index].attemptWiseAccuracy.entries())
              .filter(([key]) => !key.startsWith('$'));
            question.attemptWiseAccuracy = Object.fromEntries(accuracyEntries);
          }
          
          // 过滤掉以 $ 开头的键
          Object.keys(question).forEach(key => {
            if (key.startsWith('$')) {
              delete question[key];
            }
          });
        });
      }
    }
    
    // 获取测验详情，包括题目信息
    const quiz = await Quiz.findById(quizId).populate('questions.questionId').populate('questions.questionId.options');
    if (!quiz) {
      logger.warn('未找到测验详情', { quizId });
      return res.status(404).json({ message: '未找到测验详情' });
    }
    
    // 提取题目信息，建立题目ID到题目内容的映射
    const questionDetails = {};
    
    // 首先添加当前测验中的题目
    quiz.questions.forEach(question => {
      if (question.questionId && question.questionId._id) {
        questionDetails[question.questionId._id.toString()] = {
          title: question.questionId.title || '未知标题',
          content: question.questionId.content || '',
          type: question.questionId.type || 'SINGLE_CHOICE',
          order: question.order || 0,
          options: question.questionId.options || [],
          scaleLevel: question.questionId.scaleLevel,
          scaleLabels: question.questionId.scaleLabels,
          matrixRows: question.questionId.matrixRows
        };
      }
    });
    
    // 然后检查分析数据中是否有"孤儿"题目（已从测验中删除但仍有提交记录的题目）
    const Question = require('../models/Question');
    const orphanQuestionIds = [];
    
    if (analyticsObj.questionAnalytics) {
      for (const questionAnalytic of analyticsObj.questionAnalytics) {
        const questionId = questionAnalytic.questionId.toString();
        if (!questionDetails[questionId]) {
          orphanQuestionIds.push(questionId);
        }
      }
    }
    
    // 获取孤儿题目的详细信息
    if (orphanQuestionIds.length > 0) {
      logger.info('发现孤儿题目，正在获取详细信息', { quizId, orphanQuestionIds });
      
      const orphanQuestions = await Question.find({
        _id: { $in: orphanQuestionIds }
      });
      
      orphanQuestions.forEach((question, index) => {
        questionDetails[question._id.toString()] = {
          title: question.title || '未知标题',
          content: question.content || '',
          type: question.type || 'SINGLE_CHOICE',
          order: quiz.questions.length + index + 1, // 将孤儿题目排在最后
          options: question.options || [],
          scaleLevel: question.scaleLevel,
          scaleLabels: question.scaleLabels,
          matrixRows: question.matrixRows,
          isOrphan: true // 标记为孤儿题目
        };
      });
      
      // 记录找不到的题目
      const foundQuestionIds = orphanQuestions.map(q => q._id.toString());
      const missingQuestionIds = orphanQuestionIds.filter(id => !foundQuestionIds.includes(id));
      if (missingQuestionIds.length > 0) {
        logger.warn('部分孤儿题目已被彻底删除', { quizId, missingQuestionIds });
        
        // 为彻底删除的题目创建占位符
        missingQuestionIds.forEach((questionId, index) => {
          questionDetails[questionId] = {
            title: '已删除题目',
            content: '该题目已被删除，但仍有历史提交记录',
            type: 'UNKNOWN',
            order: quiz.questions.length + orphanQuestions.length + index + 1,
            options: [],
            isDeleted: true // 标记为已删除题目
          };
        });
      }
    }
    
    // 修复选项ID映射问题
    analyticsObj.questionAnalytics.forEach(questionAnalytic => {
      const questionId = questionAnalytic.questionId.toString();
      const questionDetail = questionDetails[questionId];
      
      // 如果找到问题详情且存在选项分布数据
      if (questionDetail && questionDetail.options && questionDetail.options.length > 0 && questionAnalytic.optionDistribution) {
        // 获取原始选项分布数据
        const originalDist = questionAnalytic.optionDistribution;
        
        // 检查是否需要进行映射
        // 比较原选项ID和当前题目选项ID，检查是否有任何一个ID匹配
        const oldOptionIds = Object.keys(originalDist);
        const currentOptionIds = questionDetail.options.map(o => o._id.toString());
        
        // 检查是否有ID匹配（交集）
        const hasMatchingIds = oldOptionIds.some(id => currentOptionIds.includes(id));
        
        logger.info('检查选项ID匹配情况', { 
          questionId,
          oldOptionIds,
          currentOptionIds,
          hasMatchingIds
        });
        
        // 如果没有匹配的ID，则需要进行映射
        if (!hasMatchingIds) {
          // 创建一个新的映射过的选项分布
          const mappedDist = {};
          
          // 简单按顺序映射
          if (oldOptionIds.length <= questionDetail.options.length) {
            oldOptionIds.forEach((oldId, index) => {
              if (index < questionDetail.options.length) {
                const newId = questionDetail.options[index]._id.toString();
                mappedDist[newId] = originalDist[oldId];
                
                logger.info('映射选项', {
                  questionId,
                  oldId,
                  newId,
                  count: originalDist[oldId]
                });
              }
            });
            
            // 更新选项分布
            questionAnalytic.optionDistribution = mappedDist;
            
            logger.info('完成选项映射', {
              questionId,
              mappedOptionsCount: Object.keys(mappedDist).length
            });
          } else {
            logger.warn('无法映射选项分布，选项数量不匹配', { 
              questionId,
              oldOptionCount: oldOptionIds.length,
              newOptionCount: questionDetail.options.length
            });
          }
        } else {
          logger.info('选项ID已匹配，无需映射', { questionId });
        }
      }
    });
    
    // 返回结果，使用前端期望的数据结构
    return res.status(200).json({
      success: true,
      data: {
        analytics: analyticsObj,
        stats,
        questionDetails,
        submissions: filteredSubmissions.map(s => ({
          id: s._id,
          student: s.studentId ? {
            id: s.studentId._id,
            name: s.studentId.name,
            email: s.studentId.email,
            classId: s.studentId.classId
          } : {
            id: s.userId,
            name: '未知用户',
            email: '',
            classId: null
          },
          score: s.score,
          startTime: s.startTime,
          submitTime: s.submitTime,
          attemptNumber: s.attemptNumber || 1,
          duration: (new Date(s.submitTime) - new Date(s.startTime)) / (1000 * 60) // 分钟
        }))
      }
    });
  } catch (error) {
    logger.error('获取测验分析数据失败', { 
      quizId, 
      classId: classId || 'all',
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ 
      success: false,
      message: '获取测验分析数据失败', 
      error: error.message 
    });
  }
};

/**
 * 获取问题分析数据
 * @route GET /api/analytics/questions/:questionId
 * @access 仅教师
 */
exports.getQuestionAnalytics = async (req, res) => {
  try {
    logger.info('获取问题分析数据', { questionId: req.params.questionId, userId: req.user._id });
    
    const analytics = await QuizAnalyticsService.getAllQuizQuestionAnalytics(req.params.questionId);
    
    if (!analytics || analytics.length === 0) {
      logger.warn('未找到问题分析数据', { questionId: req.params.questionId });
      return res.status(404).json({
        success: false,
        message: '未找到问题分析数据'
      });
    }
    
    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('获取问题分析数据失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取问题分析数据失败',
      error: error.message
    });
  }
};

/**
 * 获取心理量表分析数据
 * @route GET /api/analytics/scales/:quizId
 * @access 仅教师
 */
exports.getScaleAnalytics = async (req, res) => {
  try {
    logger.info('获取心理量表分析数据', { quizId: req.params.quizId, userId: req.user._id });
    
    // 先更新分析数据
    await QuizAnalyticsService.updateQuizAnalytics(req.params.quizId);
    
    // 获取分析数据
    const analytics = await QuizAnalytics.findOne({ quizId: req.params.quizId });
    
    if (!analytics) {
      logger.warn('未找到心理量表分析数据', { quizId: req.params.quizId });
      return res.status(404).json({
        success: false,
        message: '未找到心理量表分析数据'
      });
    }
    
    // 获取量表提交记录
    const submissions = await QuizSubmission.find({
      quizId: req.params.quizId,
      status: 'SUBMITTED'
    }).populate('studentId', 'name email');
    
    // 计算维度统计
    const dimensionStats = calculateDimensionStats(analytics, submissions);
    
    // 将 Mongoose Map 转换为普通对象
    const scaleAnalyticsObj = analytics.scaleAnalytics.toObject 
      ? analytics.scaleAnalytics.toObject() 
      : JSON.parse(JSON.stringify(analytics.scaleAnalytics));
    
    // 确保所有 Map 类型的数据都被正确转换为普通对象
    if (scaleAnalyticsObj.dimensionAverages) {
      try {
        // 过滤掉以 $ 开头的键
        const dimensionAvgEntries = analytics.scaleAnalytics.dimensionAverages instanceof Map 
          ? Array.from(analytics.scaleAnalytics.dimensionAverages.entries()).filter(([key]) => !key.startsWith('$'))
          : Object.entries(scaleAnalyticsObj.dimensionAverages).filter(([key]) => !key.startsWith('$'));
        
        scaleAnalyticsObj.dimensionAverages = Object.fromEntries(dimensionAvgEntries);
        
        logger.info('转换维度平均分成功', { 
          quizId: req.params.quizId,
          dimensionCount: Object.keys(scaleAnalyticsObj.dimensionAverages).length
        });
      } catch (error) {
        logger.error('转换维度平均分失败', { 
          error: error.message, 
          quizId: req.params.quizId 
        });
        scaleAnalyticsObj.dimensionAverages = {};
      }
    }
    
    if (scaleAnalyticsObj.dimensionDistribution) {
      try {
        const dimensionDistObj = {};
        
        // 过滤掉以 $ 开头的维度键
        const dimensions = analytics.scaleAnalytics.dimensionDistribution instanceof Map
          ? Array.from(analytics.scaleAnalytics.dimensionDistribution.keys()).filter(key => !key.startsWith('$'))
          : Object.keys(scaleAnalyticsObj.dimensionDistribution).filter(key => !key.startsWith('$'));
        
        for (const dimension of dimensions) {
          const distribution = analytics.scaleAnalytics.dimensionDistribution.get 
            ? analytics.scaleAnalytics.dimensionDistribution.get(dimension)
            : scaleAnalyticsObj.dimensionDistribution[dimension];
          
          if (distribution instanceof Map) {
            // 过滤掉以 $ 开头的分布键
            const distEntries = Array.from(distribution.entries()).filter(([key]) => !key.startsWith('$'));
            dimensionDistObj[dimension] = Object.fromEntries(distEntries);
          } else if (typeof distribution === 'object') {
            // 过滤掉以 $ 开头的分布键
            const distEntries = Object.entries(distribution).filter(([key]) => !key.startsWith('$'));
            dimensionDistObj[dimension] = Object.fromEntries(distEntries);
          } else {
            dimensionDistObj[dimension] = {};
          }
        }
        
        scaleAnalyticsObj.dimensionDistribution = dimensionDistObj;
        
        logger.info('转换维度分布成功', { 
          quizId: req.params.quizId,
          dimensionCount: Object.keys(dimensionDistObj).length
        });
      } catch (error) {
        logger.error('转换维度分布失败', { 
          error: error.message, 
          quizId: req.params.quizId 
        });
        scaleAnalyticsObj.dimensionDistribution = {};
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        scaleAnalytics: scaleAnalyticsObj,
        dimensionStats,
        submissions: submissions.map(s => ({
          id: s._id,
          student: {
            id: s.studentId._id,
            name: s.studentId.name,
            email: s.studentId.email
          },
          scaleResults: s.scaleResults,
          submitTime: s.submitTime
        }))
      }
    });
  } catch (error) {
    logger.error('获取心理量表分析数据失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取心理量表分析数据失败',
      error: error.message
    });
  }
};

/**
 * 计算扩展统计数据
 */
function calculateExtendedStats(analytics, submissions) {
  // 将 scoreDistribution 从 Mongoose Map 转换为普通对象
  const scoreDistribution = {};
  
  try {
    if (analytics.scoreDistribution) {
      // 检查是否是 Map 类型
      if (analytics.scoreDistribution instanceof Map) {
        // 过滤掉以 $ 开头的键
        Array.from(analytics.scoreDistribution.entries())
          .filter(([key]) => !key.startsWith('$'))
          .forEach(([key, value]) => {
            scoreDistribution[key] = value;
          });
      } else if (typeof analytics.scoreDistribution === 'object') {
        // 如果已经是普通对象，过滤掉以 $ 开头的键
        Object.entries(analytics.scoreDistribution)
          .filter(([key]) => !key.startsWith('$'))
          .forEach(([key, value]) => {
            scoreDistribution[key] = value;
          });
      }
      
      logger.info('转换分数分布成功', { 
        scoreDistributionKeys: Object.keys(scoreDistribution) 
      });
    }
  } catch (error) {
    logger.error('转换分数分布失败', { 
      error: error.message 
    });
    // 如果转换失败，使用空对象
  }
  
  // 计算用时分布
  const durationDistribution = {};
  
  if (submissions.length > 0) {
    // 计算每个提交的用时（分钟）
    const durations = submissions.map(s => {
      const start = new Date(s.startTime);
      const end = new Date(s.submitTime);
      return (end - start) / (1000 * 60); // 转换为分钟
    });
    
    // 找出最小和最大用时
    let minDuration = Math.min(...durations);
    let maxDuration = Math.max(...durations);
    
    // 根据用时范围确定区间数量和单位
    let intervalCount = 5; // 默认5个区间
    let unit = '分钟';
    let divisor = 1; // 默认以分钟为单位
    
    // 检查是否所有时间都非常短（几乎为0）
    const maxTimeInSeconds = maxDuration * 60;
    if (maxTimeInSeconds < 3) {
      // 如果最长时间不到3秒，可能是数据问题，使用小单位
      unit = '秒';
      divisor = 60;
      intervalCount = 3;
      
      // 将所有时间从分钟转换为秒
      const durationsInSeconds = durations.map(d => d * 60);
      minDuration = 0; // 从0开始
      maxDuration = Math.max(3, Math.ceil(maxTimeInSeconds)); // 至少3秒的范围
      
      logger.info('检测到非常短的测验时间', { 
        maxTimeInSeconds, 
        unit, 
        minDuration, 
        maxDuration 
      });
    } else if (maxDuration > 60) {
      // 如果最长时间超过1小时，使用更大的区间
      intervalCount = 8;
      logger.info('检测到超过1小时的测验时间', { maxDuration });
    } else if (maxDuration - minDuration < 5) {
      // 如果范围小于5分钟但不是极短时间，转换为秒
      // 将所有时间从分钟转换为秒
      const durationsInSeconds = durations.map(d => d * 60);
      const minDurationInSeconds = Math.min(...durationsInSeconds);
      const maxDurationInSeconds = Math.max(...durationsInSeconds);
      
      logger.info('转换为秒单位', { 
        minDurationInMinutes: minDuration,
        maxDurationInMinutes: maxDuration,
        minDurationInSeconds,
        maxDurationInSeconds
      });
      
      // 使用秒作为单位
      unit = '秒';
      divisor = 60; // 将分钟转换为秒
      
      // 重新计算区间数量
      if (maxDurationInSeconds - minDurationInSeconds < 30) {
        intervalCount = 3; // 如果范围小于30秒，使用3个区间
      } else if (maxDurationInSeconds - minDurationInSeconds < 60) {
        intervalCount = 4; // 如果范围小于60秒，使用4个区间
      } else {
        intervalCount = 5; // 否则使用5个区间
      }
      
      // 更新最小和最大值，保持为秒
      minDuration = minDurationInSeconds;
      maxDuration = maxDurationInSeconds;
    } else if (maxDuration - minDuration < 10) {
      intervalCount = 3; // 如果范围小于10分钟，使用3个区间
    }
    
    // 确保区间大小不为0（避免除以0错误）
    if (minDuration === maxDuration) {
      // 如果最小值等于最大值，创建一个小范围
      if (unit === '秒') {
        minDuration = Math.max(0, minDuration - 1);
        maxDuration = minDuration + 2;
      } else {
        minDuration = Math.max(0, minDuration - 0.5);
        maxDuration = minDuration + 1;
      }
      logger.info('调整最小最大时间范围', { minDuration, maxDuration, unit });
    }
    
    // 计算区间大小
    const intervalSize = (maxDuration - minDuration) / intervalCount;
    
    logger.info('时长分布计算参数', { 
      minDuration, 
      maxDuration, 
      intervalSize, 
      intervalCount, 
      unit, 
      divisor 
    });
    
    // 创建区间并计算每个区间的提交数量
    for (let i = 0; i < intervalCount; i++) {
      const start = minDuration + i * intervalSize;
      const end = start + intervalSize;
      
      // 格式化区间边界（保留一位小数）
      const startFormatted = Math.round(start * 10) / 10;
      const endFormatted = Math.round(end * 10) / 10;
      
      // 最后一个区间使用 ≤ 符号
      const key = i === intervalCount - 1 
        ? `${startFormatted}-${endFormatted}` 
        : `${startFormatted}-${endFormatted}`;
      
      // 计算该区间内的提交数量
      // 根据使用的单位调整比较逻辑
      let count;
      if (unit === '秒') {
        // 对于秒单位，我们比较秒值
        count = durations.filter(d => {
          const durationInSeconds = d * 60;
          return durationInSeconds >= start && (i === intervalCount - 1 ? durationInSeconds <= end : durationInSeconds < end);
        }).length;
      } else {
        // 对于分钟单位，直接比较
        count = durations.filter(d => {
          return d >= start && (i === intervalCount - 1 ? d <= end : d < end);
        }).length;
      }
      
      durationDistribution[`${key}${unit}`] = count;
      
      logger.info('添加时长分布区间', { 
        interval: `${key}${unit}`, 
        count, 
        start, 
        end, 
        unit 
      });
    }
  } else {
    // 如果没有提交，使用默认区间
    for (let i = 0; i < 5; i++) {
      const min = i * 5;
      const max = min + 4;
      durationDistribution[`${min}-${max}分钟`] = 0;
    }
  }
  
  // 动态计算分数分布
  if (submissions.length > 0) {
    // 清空之前的分数分布
    Object.keys(scoreDistribution).forEach(key => delete scoreDistribution[key]);
    
    const scores = submissions.map(s => s.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    
    // 根据分数范围确定合适的间隔
    let intervalCount = 5; // 默认5个区间
    
    if (maxScore - minScore > 50) {
      intervalCount = 8; // 如果范围大于50，使用8个区间
    } else if (maxScore - minScore < 10) {
      intervalCount = Math.max(3, maxScore - minScore + 1); // 如果范围小于10，每个分数一个区间，但至少3个区间
    } else if (maxScore - minScore < 20) {
      intervalCount = 4; // 如果范围小于20，使用4个区间
    }
    
    // 如果分数范围非常小（小于3），直接为每个分数创建一个区间
    if (maxScore - minScore < 3) {
      for (let score = minScore; score <= maxScore; score++) {
        const count = scores.filter(s => s === score).length;
        scoreDistribution[`${score}`] = count;
      }
    } else {
      // 计算每个区间的大小（向上取整到整数）
      const intervalSize = Math.ceil((maxScore - minScore) / intervalCount);
      
      // 创建区间
      for (let i = 0; i < intervalCount; i++) {
        const start = minScore + i * intervalSize;
        const end = minScore + (i + 1) * intervalSize - 1;
        
        // 确保最后一个区间包含最高分
        const adjustedEnd = i === intervalCount - 1 ? Math.max(end, maxScore) : end;
        
        // 格式化区间标签
        const key = `${start}-${adjustedEnd}`;
        
        // 计算该区间内的提交数量
        const count = scores.filter(s => s >= start && s <= adjustedEnd).length;
        
        if (count > 0) { // 只添加有数据的区间
          scoreDistribution[key] = count;
        }
      }
    }
  } else {
    // 如果没有提交，使用默认区间
    for (let i = 0; i < 5; i++) {
      const min = i * 20;
      const max = min + 19;
      scoreDistribution[`${min}-${max}`] = 0;
    }
  }
  
  // 计算及格率
  const passCount = submissions.filter(s => s.score >= 60).length;
  const passRate = submissions.length ? (passCount / submissions.length) * 100 : 0;
  
  // 计算最高分、最低分和平均分
  const scores = submissions.map(s => s.score);
  const highestScore = scores.length ? Math.max(...scores) : 0;
  const lowestScore = scores.length ? Math.min(...scores) : 0;
  
  // 根据筛选后的提交记录计算平均分，而不是直接使用 analytics.averageScore
  const averageScore = submissions.length > 0 
    ? submissions.reduce((sum, s) => sum + s.score, 0) / submissions.length 
    : 0;
  
  logger.info('计算统计数据完成', { 
    totalSubmissions: submissions.length,
    averageScore,
    highestScore,
    lowestScore,
    passRate
  });
  
  return {
    totalSubmissions: submissions.length,
    averageScore,
    highestScore,
    lowestScore,
    passRate,
    scoreDistribution,
    durationDistribution
  };
}

/**
 * 计算心理量表维度统计
 */
function calculateDimensionStats(analytics, submissions) {
  const dimensionStats = {};
  
  // 获取所有维度
  const dimensions = new Set();
  submissions.forEach(submission => {
    if (submission.scaleResults) {
      Object.keys(submission.scaleResults).forEach(dim => dimensions.add(dim));
    }
  });
  
  // 计算每个维度的统计数据
  dimensions.forEach(dimension => {
    const scores = submissions
      .filter(s => s.scaleResults && s.scaleResults[dimension] !== undefined)
      .map(s => s.scaleResults[dimension]);
    
    if (scores.length > 0) {
      const sum = scores.reduce((a, b) => a + b, 0);
      const avg = sum / scores.length;
      const max = Math.max(...scores);
      const min = Math.min(...scores);
      
      // 计算分布
      const distribution = {};
      scores.forEach(score => {
        const range = Math.floor(score / 5) * 5;
        const key = `${range}-${range + 4}`;
        distribution[key] = (distribution[key] || 0) + 1;
      });
      
      dimensionStats[dimension] = {
        average: avg,
        max,
        min,
        distribution
      };
    }
  });
  
  return dimensionStats;
}