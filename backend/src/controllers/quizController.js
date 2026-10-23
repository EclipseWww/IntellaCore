const { withoutAnswers, quizContext } = require('../services/quizSecurity');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const QuizSubmission = require('../models/QuizSubmission');
const User = require('../models/User');
const logger = require('../utils/logger');

// 创建测验
exports.createQuiz = async (req, res) => {
  try {
    const {
      title,
      description,
      questions,
      isScaleTest,
      settings
    } = req.body;

    const quiz = await Quiz.create({
      title,
      description,
      questions,
      isScaleTest,
      settings,
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, data: quiz });
  } catch (error) {
    console.error('创建测验失败:', error);
    res.status(500).json({
      success: false,
      message: '创建测验失败',
      error: error.message
    });
  }
};

// 获取测验列表
exports.getQuizzes = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {
      createdBy: req.user._id // 只返回当前用户创建的测验
    };

    if (status) query.status = status;

    const quizzes = await Quiz.find(query)
      .populate('createdBy', 'name')
      .populate('questions.questionId')
      .sort('-createdAt');

    res.status(200).json({ success: true, data: quizzes });
  } catch (error) {
    console.error('获取测验列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取测验列表失败',
      error: error.message
    });
  }
};

// 获取单个测验
exports.getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('questions.questionId');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: '测验不存在'
      });
    }

    if (req.user.role === 'student') {
      if (quiz.status !== 'PUBLISHED') return res.status(403).json({ success: false, message: '测验未发布' });
      await quizContext(req.user, quiz._id);
    }
    res.status(200).json({ success: true, data: req.user.role === 'student' ? withoutAnswers(quiz) : quiz });
  } catch (error) {
    console.error('获取测验失败:', error);
    res.status(error.status || 500).json({
      success: false,
      message: '获取测验失败',
      error: error.message
    });
  }
};

// 更新测验
exports.updateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: '测验不存在'
      });
    }

    // 检查权限
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '没有权限修改此测验'
      });
    }

    // // 如果测验已发布，只能修改状态
    // if (quiz.status !== 'DRAFT' && req.body.status === undefined) {
    //   return res.status(400).json({ 
    //     success: false, 
    //     message: '测验已发布，无法修改内容' 
    //   });
    // }

    const updatedQuiz = await Quiz.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('questions.questionId');

    res.status(200).json({ success: true, data: updatedQuiz });
  } catch (error) {
    console.error('更新测验失败:', error);
    res.status(500).json({
      success: false,
      message: '更新测验失败',
      error: error.message
    });
  }
};

// 删除测验
exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: '测验不存在'
      });
    }

    // 检查权限
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '没有权限删除此测验'
      });
    }

    // 如果测验已发布或进行中，不允许删除
    if (quiz.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: '测验已发布或进行中，无法删除'
      });
    }

    await Quiz.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error('删除测验失败:', error);
    res.status(500).json({
      success: false,
      message: '删除测验失败',
      error: error.message
    });
  }
};

// 发布测验
exports.publishQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: '测验不存在'
      });
    }

    // 如果是草稿状态，改为已发布；如果是已发布状态，改为草稿
    if (quiz.status === 'DRAFT') {
      quiz.status = 'PUBLISHED';
    } else if (quiz.status === 'PUBLISHED') {
      quiz.status = 'DRAFT';
    } else {
      return res.status(400).json({
        success: false,
        message: '只有草稿或已发布状态的测验可以修改状态'
      });
    }

    await quiz.save();

    res.status(200).json({ success: true, data: quiz });
  } catch (error) {
    console.error('修改测验状态失败:', error);
    res.status(500).json({
      success: false,
      message: '修改测验状态失败',
      error: error.message
    });
  }
};

// 添加题目到测验
exports.addQuestions = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: '测验不存在'
      });
    }

    // 检查权限
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '没有权限修改此测验'
      });
    }

    // 如果测验已发布，不允许修改题目
    if (quiz.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: '测验已发布，无法修改题目'
      });
    }

    const { questions } = req.body; // 格式：[{questionId: '...', order: 1}, ...]

    // 验证所有题目是否存在
    const questionIds = questions.map(q => q.questionId);
    const existingQuestions = await Question.find({ _id: { $in: questionIds } });

    if (existingQuestions.length !== questionIds.length) {
      return res.status(400).json({
        success: false,
        message: '部分题目不存在'
      });
    }

    // 验证题目类型是否匹配测验类型
    const hasInvalidType = existingQuestions.some(q =>
      (quiz.isScaleTest && q.type !== 'PSYCHOLOGICAL_SCALE') ||
      (!quiz.isScaleTest && q.type === 'PSYCHOLOGICAL_SCALE')
    );

    if (hasInvalidType) {
      return res.status(400).json({
        success: false,
        message: '题目类型与测验类型不匹配'
      });
    }

    // 添加新题目
    quiz.questions = questions;
    await quiz.save();

    const updatedQuiz = await Quiz.findById(quiz._id)
      .populate('questions.questionId')
      .populate('createdBy', 'name');

    res.status(200).json({ success: true, data: updatedQuiz });
  } catch (error) {
    console.error('添加题目失败:', error);
    res.status(500).json({
      success: false,
      message: '添加题目失败',
      error: error.message
    });
  }
};

// 从测验中移除题目
exports.removeQuestion = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: '测验不存在'
      });
    }

    // 检查权限
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '没有权限修改此测验'
      });
    }

    // 如果测验已发布，不允许修改题目
    if (quiz.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: '测验已发布，无法修改题目'
      });
    }

    const { questionId } = req.params;

    // 移除题目并重新排序
    quiz.questions = quiz.questions
      .filter(q => q.questionId.toString() !== questionId)
      .map((q, index) => ({
        ...q,
        order: index + 1
      }));

    await quiz.save();

    const updatedQuiz = await Quiz.findById(quiz._id)
      .populate('questions.questionId')
      .populate('createdBy', 'name');

    res.status(200).json({ success: true, data: updatedQuiz });
  } catch (error) {
    console.error('移除题目失败:', error);
    res.status(500).json({
      success: false,
      message: '移除题目失败',
      error: error.message
    });
  }
};

// 更新题目顺序
exports.updateQuestionsOrder = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: '测验不存在'
      });
    }

    // 检查权限
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '没有权限修改此测验'
      });
    }

    // 如果测验已发布，不允许修改题目顺序
    if (quiz.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: '测验已发布，无法修改题目顺序'
      });
    }

    const { questions } = req.body; // 格式：[{questionId: '...', order: 1}, ...]

    // 验证所有题目是否存在于当前测验中
    const currentQuestionIds = quiz.questions.map(q => q.questionId.toString());
    const newQuestionIds = questions.map(q => q.questionId);

    if (currentQuestionIds.length !== newQuestionIds.length ||
      !currentQuestionIds.every(id => newQuestionIds.includes(id))) {
      return res.status(400).json({
        success: false,
        message: '题目列表不匹配'
      });
    }

    quiz.questions = questions;
    await quiz.save();

    const updatedQuiz = await Quiz.findById(quiz._id)
      .populate('questions.questionId')
      .populate('createdBy', 'name');

    res.status(200).json({ success: true, data: updatedQuiz });
  } catch (error) {
    console.error('更新题目顺序失败:', error);
    res.status(500).json({
      success: false,
      message: '更新题目顺序失败',
      error: error.message
    });
  }
};

// 复制测验
exports.duplicateQuiz = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;
    logger.info('复制测验请求', { userId, quizId: id });

    const sourceQuiz = await Quiz.findById(id).populate('questions.questionId');
    if (!sourceQuiz) {
      logger.warn('未找到测验', { quizId: id });
      return res.status(404).json({ success: false, message: '测验不存在' });
    }

    // 权限检查：创建者或管理员
    if (sourceQuiz.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '没有权限复制此测验' });
    }

    // 复制题目引用与设置
    const copiedQuestions = (sourceQuiz.questions || []).map(q => ({
      questionId: q?.questionId?._id || q?.questionId,
      order: q?.order
    }));

    // 深拷贝设置，避免引用同一对象
    const copiedSettings = sourceQuiz.settings ? JSON.parse(JSON.stringify(sourceQuiz.settings)) : undefined;

    const newQuiz = await Quiz.create({
      title: `${sourceQuiz.title} (副本)`,
      description: sourceQuiz.description,
      questions: copiedQuestions,
      isScaleTest: sourceQuiz.isScaleTest,
      settings: copiedSettings,
      createdBy: req.user._id,
      status: 'DRAFT'
    });

    logger.info('复制测验成功', { userId, sourceQuizId: id, newQuizId: newQuiz._id });

    const populatedQuiz = await Quiz.findById(newQuiz._id)
      .populate('questions.questionId')
      .populate('createdBy', 'name');

    return res.status(201).json({ success: true, data: populatedQuiz });
  } catch (error) {
    logger.error('复制测验失败', { error: error.message, stack: error.stack, userId: req.user?._id || req.user?.id });
    return res.status(500).json({ success: false, message: '复制测验失败', error: error.message });
  }
};

// 获取学生未完成的测验
exports.getPendingQuizzes = async (req, res) => {
  try {
    const studentId = req.user._id;
    const student = await User.findById(studentId);
    if (!student || !student.classId) {
      return res.json({ success: true, data: [] });
    }

    // 1. 查找班级可访问的所有课程
    const courses = await Course.find({ accessibleClasses: student.classId }).select('_id title');
    const courseIds = courses.map(c => c._id);

    if (courseIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 2. 查找这些课程下的所有已发布Lesson
    const lessons = await Lesson.find({
      course: { $in: courseIds },
      status: 'published'
    }).select('course unit title activities order').lean();

    // 3. 提取所有测验类型的活动
    const quizActivities = [];
    for (const lesson of lessons) {
      if (!lesson.activities) continue;

      for (const activity of lesson.activities) {
        // 只筛选测验类型，且关联了具体测验ID的活动
        if (activity.type === 'quiz' && activity.quizSettings?.quiz) {
          quizActivities.push({
            courseId: lesson.course,
            unitId: lesson.unit,
            lessonId: lesson._id,
            activityId: activity._id,
            title: activity.title,
            quizId: activity.quizSettings.quiz
          });
        }
      }
    }

    if (quizActivities.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 4. 查询学生的提交记录
    const quizIds = quizActivities.map(qa => qa.quizId);

    // 查找该学生对这些测验的提交记录 (状态为已提交)
    // 注意：如果是允许重复提交的测验，逻辑可能需要调整。
    // 这里简单处理：只要有提交记录视为"已完成"（或者是最后一次状态是完成？）
    // 通常 pending 列表是"从未做过"或"做了一半"（IN_PROGRESS）。
    // 如果测验允许多次提交，是否算 Pending？
    // 用户的需求是 "未完成测验"，通常指还没做的。如果做过一次，就算完成了。
    const submissions = await QuizSubmission.find({
      studentId: studentId,
      quizId: { $in: quizIds },
      // 排除掉还在进行中的？不，如果有了提交记录（SUBMITTED/GRADED），就不算Pending了。
      // IN_PROGRESS 算 Pending 吗？算。
      // 所以我们查找已经完成的提交。
      status: { $in: ['SUBMITTED', 'GRADED'] }
    }).select('quizId');

    const submittedQuizIds = new Set(submissions.map(s => s.quizId.toString()));

    // 5. 过滤出未提交的测验
    const courseMap = {};
    courses.forEach(c => courseMap[c._id.toString()] = c.title);

    const pendingQuizzes = quizActivities
      .filter(qa => !submittedQuizIds.has(qa.quizId.toString()))
      .map(qa => ({
        id: qa.quizId, // 测验ID
        activityId: qa.activityId, // 活动ID
        title: qa.title,
        courseName: courseMap[qa.courseId.toString()] || '未知课程',
        courseId: qa.courseId,
        unitId: qa.unitId,
        lessonId: qa.lessonId,
        type: 'quiz',
        // 可以添加截止时间等额外信息，如果有的话
        status: 'PENDING'
      }));

    res.json({ success: true, data: pendingQuizzes });

  } catch (error) {
    logger.error('获取未完成测验失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取未完成测验失败' });
  }
};