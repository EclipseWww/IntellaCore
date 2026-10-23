const mongoose = require('mongoose');
const Question = require('../models/Question');
const QuizSubmission = require('../models/QuizSubmission');
const QuizAnalytics = require('../models/QuizAnalytics');
const logger = require('../utils/logger');

/**
 * 获取题目的全局分析数据
 * 这个函数会分析所有测验中该题目的表现
 */
exports.getQuestionAnalytics = async (req, res) => {
  try {
    const { questionId } = req.params;
    
    // 验证 questionId 是否有效
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        success: false,
        message: '无效的题目ID'
      });
    }
    
    // 获取题目详情
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }
    
    // 查找所有包含该题目的测验分析数据
    const analyticsData = await QuizAnalytics.find({
      'questionAnalytics.questionId': new mongoose.Types.ObjectId(questionId)
    }).populate('quizId');
    
    // 查找所有包含该题目的提交记录
    const submissions = await QuizSubmission.find({
      'answers.questionId': new mongoose.Types.ObjectId(questionId)
    })
    .populate({
      path: 'studentId',
      populate: {
        path: 'classId',
        model: 'Class'
      }
    })
    .populate('quizId');
    
    // 提取该题目的所有答案
    const allAnswers = [];
    submissions.forEach(submission => {
      submission.answers.forEach(answer => {
        if (answer.questionId && answer.questionId.toString() === questionId) {
          allAnswers.push({
            ...answer.toObject(),
            studentId: submission.studentId,
            quizId: submission.quizId,
            submittedAt: submission.submittedAt
          });
        }
      });
    });
    
    // 计算总体统计数据
    const totalAttempts = allAnswers.length;
    const correctAttempts = allAnswers.filter(answer => answer.isCorrect).length;
    const correctRate = totalAttempts > 0 ? (correctAttempts / totalAttempts * 100).toFixed(2) : 0;
    
    // 计算选项/分值分布
    const optionDistribution = {};
    if (question.type === 'PSYCHOLOGICAL_SCALE') {
      // 量表题：单个量表使用 scale_{value}，矩阵量表使用 matrix_{rowId}_{value}
      allAnswers.forEach(ans => {
        if (ans.matrixAnswers) {
          const entries = (ans.matrixAnswers instanceof Map)
            ? Array.from(ans.matrixAnswers.entries())
            : Object.entries(ans.matrixAnswers);
          entries.forEach(([rowId, v]) => {
            const value = Number(v) + 1; // 0基转1..N
            const key = `matrix_${rowId}_${value}`;
            optionDistribution[key] = (optionDistribution[key] || 0) + 1;
          });
        } else if (ans.scaleValue != null) {
          const key = `scale_${Number(ans.scaleValue)}`;
          optionDistribution[key] = (optionDistribution[key] || 0) + 1;
        }
      });
    } else if (question.options && question.options.length > 0) {
      // 选择题：按选项ID统计
      question.options.forEach((option, index) => {
        const optionId = option._id.toString();
        const count = allAnswers.filter(answer => 
          answer.selectedOption && answer.selectedOption.toString() === optionId
        ).length;
        
        optionDistribution[optionId] = {
          content: option.content,
          isCorrect: option.isCorrect || false,
          count,
          percentage: totalAttempts > 0 ? (count / totalAttempts * 100).toFixed(2) : 0
        };
      });
    }
    
    // 按测验分组的统计数据
    const quizStats = {};
    submissions.forEach(submission => {
      const quizId = submission.quizId._id.toString();
      if (!quizStats[quizId]) {
        quizStats[quizId] = {
          quizName: submission.quizId.title || '未命名测验',
          totalAttempts: 0,
          correctAttempts: 0,
          correctRate: 0
        };
      }
      
      submission.answers.forEach(answer => {
        if (answer.questionId && answer.questionId.toString() === questionId) {
          quizStats[quizId].totalAttempts++;
          if (answer.isCorrect) {
            quizStats[quizId].correctAttempts++;
          }
        }
      });
    });
    
    // 计算每个测验的正确率
    Object.keys(quizStats).forEach(quizId => {
      const stats = quizStats[quizId];
      stats.correctRate = stats.totalAttempts > 0 
        ? (stats.correctAttempts / stats.totalAttempts * 100).toFixed(2) 
        : 0;
    });
    
    // 按班级分组的统计数据
    const classStats = {};
    submissions.forEach(submission => {
      if (submission.studentId && submission.studentId.classId) {
        const classId = submission.studentId.classId._id || submission.studentId.classId;
        const classIdStr = classId.toString();
        
        // 获取班级名称，确保有值
        let className = '未知班级';
        if (submission.studentId.classId.name) {
          // 如果 classId 被 populate 为完整对象
          const grade = submission.studentId.classId.grade || '';
          className = `${grade}级${submission.studentId.classId.name}班`;
        } else if (submission.studentId.className) {
          // 直接使用 className
          className = submission.studentId.className;
        } else if (submission.studentId.grade) {
          // 使用年级和班级ID的后两位作为班级名
          className = `${submission.studentId.grade}级${classIdStr.substr(-2)}班`;
        }
        
        if (!classStats[classIdStr]) {
          classStats[classIdStr] = {
            className,
            totalAttempts: 0,
            correctAttempts: 0,
            correctRate: 0
          };
        }
        
        submission.answers.forEach(answer => {
          if (answer.questionId && answer.questionId.toString() === questionId) {
            classStats[classIdStr].totalAttempts++;
            if (answer.isCorrect) {
              classStats[classIdStr].correctAttempts++;
            }
          }
        });
      }
    });
    
    // 计算每个班级的正确率
    Object.keys(classStats).forEach(classId => {
      const stats = classStats[classId];
      stats.correctRate = stats.totalAttempts > 0 
        ? (stats.correctAttempts / stats.totalAttempts * 100).toFixed(2) 
        : 0;
    });
    
    // 返回结果
    return res.status(200).json({
      success: true,
      data: {
        question: {
          _id: question._id,
          title: question.title,
          content: question.content,
          type: question.type,
          difficulty: question.difficulty,
          tags: question.tags,
          options: question.options,
          // 量表题补充字段，前端用来渲染
          scaleLevel: question.scaleLevel,
          scaleLabels: question.scaleLabels,
          matrixRows: question.matrixRows
        },
        stats: {
          totalAttempts,
          correctAttempts,
          correctRate,
          optionDistribution,
          quizStats: Object.values(quizStats),
          classStats: Object.values(classStats)
        }
      }
    });
    
  } catch (error) {
    logger.error('获取题目分析数据失败', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: '获取题目分析数据失败',
      error: error.message
    });
  }
};

/**
 * 获取所有题目的分析数据列表
 */
exports.getAllQuestionsAnalytics = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', tags = [], difficulty, type, sortBy = 'correctRate', sortOrder = 'asc' } = req.query;
    
    logger.info('获取题目分析列表', { page, limit, sortBy, sortOrder });
    
    // 获取所有标签
    const allTags = await Question.distinct('tags');
    
    // 构建查询条件
    const matchQuery = {};
    
    if (search) {
      matchQuery.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (tags && tags.length > 0) {
      matchQuery.tags = { $in: Array.isArray(tags) ? tags : [tags] };
    }
    
    if (difficulty) {
      // 如果difficulty是数组，则使用$in查询
      if (Array.isArray(difficulty)) {
        matchQuery.difficulty = { $in: difficulty.map(d => parseInt(d)) };
      } else if (typeof difficulty === 'string' && difficulty.includes(',')) {
        // 如果是逗号分隔的字符串，转换为数组
        const difficultyArray = difficulty.split(',').map(d => parseInt(d));
        matchQuery.difficulty = { $in: difficultyArray };
      } else {
        // 单个难度值
        matchQuery.difficulty = parseInt(difficulty);
      }
    }
    
    if (type) {
      matchQuery.type = type;
    }
    
    // 查询题目总数
    const total = await Question.countDocuments(matchQuery);
    
    // 查询所有题目及其分析数据
    // 首先获取所有题目ID (不分页，先获取所有匹配的题目)
    const allQuestions = await Question.find(matchQuery).lean();
    const allQuestionIds = allQuestions.map(q => q._id);
    
    // 查询这些题目的分析数据
    const analyticsData = await QuizAnalytics.aggregate([
      { $unwind: '$questionAnalytics' },
      { 
        $match: { 
          'questionAnalytics.questionId': { 
            $in: allQuestionIds.map(id => new mongoose.Types.ObjectId(id)) 
          } 
        } 
      },
      {
        $group: {
          _id: '$questionAnalytics.questionId',
          totalAttempts: { $sum: '$questionAnalytics.totalAttempts' },
          correctAttempts: { $sum: '$questionAnalytics.correctAttempts' }
        }
      }
    ]);
    
    // 将分析数据映射到题目
    const analyticsMap = {};
    analyticsData.forEach(item => {
      analyticsMap[item._id.toString()] = {
        totalAttempts: item.totalAttempts,
        correctAttempts: item.correctAttempts,
        correctRate: item.totalAttempts > 0 
          ? (item.correctAttempts / item.totalAttempts * 100).toFixed(2)
          : 0
      };
    });
    
    // 组合结果
    const result = allQuestions.map(question => {
      const questionId = question._id.toString();
      const analytics = analyticsMap[questionId] || {
        totalAttempts: 0,
        correctAttempts: 0,
        correctRate: 0
      };
      
      return {
        ...question,
        analytics
      };
    });
    
    // 在后端进行完整排序
    const sortedResult = [...result].sort((a, b) => {
      // 首先按有无作答记录排序
      const aHasAttempts = a.analytics.totalAttempts > 0;
      const bHasAttempts = b.analytics.totalAttempts > 0;
      
      if (aHasAttempts && !bHasAttempts) return -1; // a有作答记录但b没有，a排前面
      if (!aHasAttempts && bHasAttempts) return 1;  // b有作答记录但a没有，b排前面
      
      // 如果都有作答记录或都没有作答记录，按照请求的排序字段和顺序排序
      if (sortBy === 'correctRate') {
        // 按正确率排序
        const aValue = parseFloat(a.analytics.correctRate);
        const bValue = parseFloat(b.analytics.correctRate);
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      } else if (sortBy === 'totalAttempts') {
        // 按作答次数排序
        return sortOrder === 'asc' 
          ? a.analytics.totalAttempts - b.analytics.totalAttempts 
          : b.analytics.totalAttempts - a.analytics.totalAttempts;
      } else if (sortBy === 'difficulty') {
        // 按难度排序
        return sortOrder === 'asc' 
          ? a.difficulty - b.difficulty 
          : b.difficulty - a.difficulty;
      }
      
      // 默认按创建时间排序
      return sortOrder === 'asc' 
        ? new Date(a.createdAt) - new Date(b.createdAt) 
        : new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // 应用分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResult = sortedResult.slice(startIndex, endIndex);
    
    logger.info('题目分析数据排序完成', { 
      sortBy, 
      sortOrder, 
      totalQuestions: sortedResult.length,
      paginatedCount: paginatedResult.length
    });
    
    // 返回结果
    return res.status(200).json({
      success: true,
      data: {
        questions: paginatedResult,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        },
        allTags
      }
    });
    
  } catch (error) {
    logger.error('获取题目分析列表失败', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: '获取题目分析列表失败',
      error: error.message
    });
  }
};
