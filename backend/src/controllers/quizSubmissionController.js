const { withoutAnswers, quizContext, validateAnswers, allocateAttemptSlot } = require('../services/quizSecurity');
const { settleQuizPoints } = require('../services/quizPointsService');
const QuizSubmission = require('../models/QuizSubmission');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const logger = require('../utils/logger'); // 导入 logger 模块
const QuizAnalyticsService = require('../services/QuizAnalyticsService');
const questionVersionService = require('../services/questionVersionService');
const mongoose = require('mongoose');

// 提交测验（包含所有答案）
exports.submit = async (req, res) => {
  try {
    const { quizId, answers, duration, activityId, lessonId } = req.body;
    const studentId = req.user._id;

    // 使用服务器时间作为提交时间
    const submitTime = new Date();
    // 根据duration计算开始时间（做防负数处理）
    const safeDuration = Math.max(0, duration || 0);
    const startTime = new Date(submitTime.getTime() - safeDuration);

    // 记录请求信息
    logger.info('提交测验请求', {
      studentId,
      quizId,
      answersCount: answers?.length,
      duration,
      serverSubmitTime: submitTime,
      calculatedStartTime: startTime
    });

    // 获取测验信息
    const quiz = await Quiz.findById(quizId)
      .populate('questions.questionId');

    if (!quiz) {
      logger.warn('测验不存在', { quizId });
      return res.status(404).json({
        success: false,
        message: '测验不存在'
      });
    }

    // 检查测验状态
    if (quiz.status !== 'PUBLISHED') {
      logger.warn('测验未发布或已结束', { quizId, status: quiz.status });
      return res.status(400).json({
        success: false,
        message: '测验未发布或已结束'
      });
    }

    await quizContext(req.user, quizId, lessonId, activityId, true);
    validateAnswers(answers, quiz);
    await QuizSubmission.init();
    // 获取测验设置 (优先使用活动配置)
    let quizSettings = {
      allowMultipleAttempts: false,
      maxAttempts: 1,
      randomizeQuestions: false,
      randomizeOptions: false,
      showAnswerAfterSubmit: false,
      showScoreAfterSubmit: true
    };

    // 如果是课程活动，尝试从课时活动中获取设置
    if (lessonId && activityId) {
      try {
        const lesson = await Lesson.findById(lessonId);
        if (lesson) {
          const activity = lesson.activities.id(activityId);
          if (activity && activity.quizSettings) {
            // 合并设置，覆盖默认值
            // 注意：activity.quizSettings 是 Mongoose 文档，需要转换为对象或直接访问属性
            // 使用 Object.assign 或扩展运算符时要注意 Mongoose 对象的行为
            const activitySettings = activity.quizSettings.toObject ? activity.quizSettings.toObject() : activity.quizSettings;

            // 确保只合并存在的配置项
            if (activitySettings.allowMultipleAttempts !== undefined) quizSettings.allowMultipleAttempts = activitySettings.allowMultipleAttempts;
            if (activitySettings.maxAttempts !== undefined) quizSettings.maxAttempts = activitySettings.maxAttempts;
            if (activitySettings.randomizeQuestions !== undefined) quizSettings.randomizeQuestions = activitySettings.randomizeQuestions;
            if (activitySettings.randomizeOptions !== undefined) quizSettings.randomizeOptions = activitySettings.randomizeOptions;
            if (activitySettings.showAnswerAfterSubmit !== undefined) quizSettings.showAnswerAfterSubmit = activitySettings.showAnswerAfterSubmit;
            if (activitySettings.showScoreAfterSubmit !== undefined) quizSettings.showScoreAfterSubmit = activitySettings.showScoreAfterSubmit;

            console.log('使用了活动层级的测验配置:', { lessonId, activityId, settings: quizSettings });
          }
        }
      } catch (err) {
        console.error('获取课时活动配置失败:', err);
        // 出错时继续使用默认配置或Quiz模型配置(如果还存在)
      }
    } else if (quiz.settings) {
      // 兼容旧逻辑：如果不是通过活动提交，或者活动中没有配置，尝试使用Quiz模型上的配置（如果存在）
      quizSettings = { ...quizSettings, ...quiz.settings };
    }

    // 检查提交次数（如果有activityId则按活动计数，否则按测验计数以向后兼容）
    const submissionQuery = {
      quizId,
      studentId,
      status: 'SUBMITTED'
    };
    // 如果提供了activityId，则按活动独立计数
    if (activityId) {
      submissionQuery.activityId = activityId;
    }
    const submissionCount = await QuizSubmission.countDocuments(submissionQuery);
    const lastAttempt = await QuizSubmission.findOne({ quizId, studentId, status: { $in: ['IN_PROGRESS', 'SUBMITTED', 'DELETED'] }, ...(activityId ? { activityId } : {}) }).sort('-attemptNumber').select('attemptNumber');
    const nextAttempt = (lastAttempt?.attemptNumber || 0) + 1;

    console.log('提交检查:', {
      studentId,
      quizId,
      activityId: activityId || '无(按测验计数)',
      currentSubmissionCount: submissionCount,
      allowMultipleAttempts: quizSettings.allowMultipleAttempts,
      maxAttempts: quizSettings.maxAttempts
    });

    // 如果不允许多次尝试，且已有提交记录，则返回错误
    if (!quizSettings.allowMultipleAttempts && submissionCount > 0) {
      console.log('拒绝提交: 不允许多次尝试');
      return res.status(400).json({
        success: false,
        message: '该测验不允许多次提交'
      });
    }

    // 如果允许多次尝试，检查是否超过最大尝试次数
    if (quizSettings.allowMultipleAttempts && submissionCount >= quizSettings.maxAttempts) {
      console.log('拒绝提交: 超过最大尝试次数', {
        submissionCount,
        maxAttempts: quizSettings.maxAttempts
      });
      return res.status(400).json({
        success: false,
        message: `已达到最大提交次数 (${quizSettings.maxAttempts} 次)`
      });
    }

    // 检查是否在考试时间内
    const now = new Date();
    if ((quiz.startTime && now < quiz.startTime) || (quiz.endTime && now > quiz.endTime)) {
      return res.status(400).json({
        success: false,
        message: '不在考试时间范围内'
      });
    }

    // 处理答案
    console.log('开始处理答案:', {
      receivedAnswers: answers,
      quizQuestions: quiz.questions.map(q => ({
        id: q.questionId._id,
        content: q.questionId.content
      }))
    });

    const processedAnswers = answers.map(answer => {
      console.log('处理单个答案:', answer);

      const question = quiz.questions.find(
        q => q.questionId._id.toString() === answer.questionId
      )?.questionId;

      console.log('找到的题目:', {
        questionId: answer.questionId,
        foundQuestion: question ? {
          id: question._id,
          content: question.content,
          type: question.type
        } : null
      });

      if (!question) {
        console.log('未找到对应题目，跳过此答案');
        return null;
      }

      const answerData = {
        questionId: answer.questionId,
        // 版本控制：记录提交时的题目版本和快照
        questionVersion: question.version ?? 1,
        questionSnapshot: questionVersionService.createQuestionSnapshot(question),
        selectedOption: undefined,
        scaleValue: undefined,
        isCorrect: false,
        matrixAnswers: undefined
      };

      if (question.type === 'PSYCHOLOGICAL_SCALE') {
        // 矩阵量表：传入 matrixAnswers 对象（行ID -> 列索引），无需selectedOption
        if (answer.matrixAnswers && typeof answer.matrixAnswers === 'object') {
          // 确保matrixAnswers是Map格式
          answerData.matrixAnswers = new Map(Object.entries(answer.matrixAnswers));
          console.log('处理矩阵量表答案:', {
            questionId: answer.questionId,
            originalMatrixAnswers: answer.matrixAnswers,
            convertedMatrixAnswers: answerData.matrixAnswers
          });
        } else if (answer.scaleValue != null) {
          // 单个量表：传入scaleValue（1-N）
          answerData.scaleValue = Number(answer.scaleValue);
          console.log('处理单个量表答案:', {
            questionId: answer.questionId,
            scaleValue: answerData.scaleValue
          });
        } else if (answer.selectedOption != null && typeof answer.selectedOption === 'object') {
          // 前端把矩阵答案放在selectedOption里的情况
          answerData.matrixAnswers = new Map(Object.entries(answer.selectedOption));
          console.log('处理selectedOption中的矩阵答案:', {
            questionId: answer.questionId,
            originalSelectedOption: answer.selectedOption,
            convertedMatrixAnswers: answerData.matrixAnswers
          });
        } else if (answer.selectedOption != null) {
          // 兼容旧前端：传入的是索引（0-based），转换为1-N
          const parsed = Number(answer.selectedOption);
          if (!Number.isNaN(parsed)) {
            answerData.scaleValue = parsed + 1;
          }
          console.log('处理兼容模式量表答案:', {
            questionId: answer.questionId,
            originalSelectedOption: answer.selectedOption,
            convertedScaleValue: answerData.scaleValue
          });
        } else {
          console.warn('量表题目缺少答案数据:', {
            questionId: answer.questionId,
            questionType: question.type,
            answerKeys: Object.keys(answer)
          });
        }
      } else {
        // 非量表题目：按选项ID判断正误
        if (answer.selectedOption) {
          answerData.selectedOption = answer.selectedOption;
          const correctOption = question.options.find(opt => opt.isCorrect);
          answerData.isCorrect = answer.selectedOption === correctOption?._id?.toString();
          console.log('答案判断:', {
            questionType: question.type,
            selectedOption: answer.selectedOption,
            correctOption: correctOption?._id,
            isCorrect: answerData.isCorrect
          });
        }
      }

      return answerData;
    }).filter(Boolean);

    console.log('处理后的答案:', {
      totalAnswers: processedAnswers.length,
      answers: processedAnswers
    });

    // 查找是否存在 IN_PROGRESS 的记录
    const existingInProgress = await QuizSubmission.findOne({
      quizId,
      studentId,
      status: 'IN_PROGRESS',
      ...(activityId ? { activityId } : {})
    });

    const attemptSlot = await allocateAttemptSlot({ quizId, studentId, ...(activityId ? { activityId } : {}) }, quizSettings.allowMultipleAttempts ? quizSettings.maxAttempts : 1, existingInProgress?._id);
    let submission;
    if (existingInProgress) {
      // 更新现有记录
      existingInProgress.answers = processedAnswers;
      // 不要用前端算出的 startTime 覆盖后端原有的 startTime，因为前端时间可能不准确
      // existingInProgress.startTime = startTime; 
      existingInProgress.submitTime = submitTime;
      existingInProgress.status = 'SUBMITTED';
      existingInProgress.score = 0; // 下面会计算
      // scaleResults 等其他字段

      submission = existingInProgress;
    } else {
      // 创建新提交记录（兼容旧逻辑或无进度情况）
      submission = new QuizSubmission({
        quizId,
        studentId,
        answers: processedAnswers,
        startTime: startTime,
        submitTime: submitTime,
        status: 'SUBMITTED',
        attemptNumber: nextAttempt,
        activityId: activityId || undefined,
        lessonId: lessonId || undefined
      });
    }

    // 计算分数
    let score = 0;
    const quizQuestions = quiz.questions || [];

    // ... (score calculation logic continues)

    // 记录测验用时（分钟）
    let actualDurationMs = duration || 0;
    if (existingInProgress && existingInProgress.startTime) {
      actualDurationMs = submitTime.getTime() - existingInProgress.startTime.getTime();
    } else {
      actualDurationMs = Math.max(0, actualDurationMs);
    }
    const durationInMinutes = actualDurationMs ? (actualDurationMs / (1000 * 60)) : 0;
    logger.info('测验完成', {
      studentId,
      quizId,
      durationInMinutes: durationInMinutes.toFixed(2),
      score: submission.score,
      attemptNumber: submissionCount + 1
    });

    let finalScore = 0;
    let pointsEarned = 0;

    // 计算得分
    if (!quiz.isScaleTest) {
      // 计算得分：正确答案数量
      const correctAnswers = processedAnswers.filter(answer => answer.isCorrect).length;
      const totalQuestions = quiz.questions.length;

      // 计算百分比得分
      finalScore = Math.min(100, Math.round((correctAnswers / totalQuestions) * 100));
      submission.score = correctAnswers; // 原始得分保存为正确题目数

      // 获取之前的最高分
      let previousHighestScore = 0;
      if (req.user.role === 'student') {
        const previousSubmissions = await QuizSubmission.find({
          quizId,
          studentId,
          status: 'SUBMITTED'
        }).sort('-score');

        if (previousSubmissions.length > 0) {
          const prevBestSubmission = previousSubmissions[0];
          const prevCorrectAnswers = prevBestSubmission.score;
          previousHighestScore = Math.round((prevCorrectAnswers / totalQuestions) * 100);
        }
      }

      logger.info('计算测验得分', {
        studentId,
        quizId,
        correctAnswers,
        totalQuestions,
        percentageScore: finalScore,
        previousHighestScore
      });

      // Persist award intent with the submission; settlement is atomic and replayable.
      submission.pointsTarget = finalScore;
      submission.pointsBaseline = Math.min(100, previousHighestScore);
      submission.pointsPending = req.user.role === 'student';
      pointsEarned = Math.max(0, finalScore - submission.pointsBaseline);
    } else {
      // 计算心理量表得分
      const scaleResults = {};
      processedAnswers.forEach(answer => {
        const question = quiz.questions.find(
          q => q.questionId._id.toString() === answer.questionId
        )?.questionId;
        if (question) {
          question.tags.forEach(tag => {
            if (!scaleResults[tag]) scaleResults[tag] = 0;
            scaleResults[tag] += answer.scaleValue || 0;
          });
        }
      });
      submission.scaleResults = scaleResults;
      // 心理量表不奖励积分
    }

    if (req.user.role === 'student') {
      submission.attemptSlot = attemptSlot;
      submission.attemptKey = [quizId, studentId, activityId || 'legacy', attemptSlot].join(':');
      await submission.save();
      if (submission.pointsPending) {
        try { await settleQuizPoints(submission); submission.pointsPending = false; }
        catch (error) { logger.error('测验积分等待恢复', { submissionId: submission._id, error: error.message }); }
      }
      logger.info('测验提交成功(已写入数据库)', { submissionId: submission._id });
    } else {
      submission._id = new mongoose.Types.ObjectId(); // mock id
      logger.info('教师模拟：测验提交成功(未写入数据库)', { simulatedId: submission._id });
    }

    // 返回结果时包含剩余尝试次数信息
    const remainingAttempts = quizSettings.allowMultipleAttempts
      ? quizSettings.maxAttempts - (submissionCount + 1)
      : 0;

    res.status(201).json({
      success: true,
      data: req.user.role === 'student' && !quizSettings.showAnswerAfterSubmit ? withoutAnswers(submission) : submission,
      meta: {
        attemptNumber: submission.attemptNumber,
        remainingAttempts,
        maxAttempts: quizSettings.maxAttempts || 1,
        pointsEarned: pointsEarned,
        pointsPending: !!submission.pointsPending
      }
    });
  } catch (error) {
    logger.error('提交测验失败', { error: error.message, stack: error.stack });
    console.error('提交测验失败:', error);
    res.status(error.status || (error.code === 11000 || error.name === 'VersionError' ? 409 : 500)).json({
      success: false,
      message: '提交测验失败',
      error: error.message
    });
  }
};

// 获取答题记录
exports.getSubmission = async (req, res) => {
  try {
    logger.info('获取答题记录', { submissionId: req.params.submissionId });

    const submission = await QuizSubmission.findById(req.params.submissionId)
      .populate({
        path: 'quizId',
        populate: {
          path: 'questions.questionId'
        }
      });

    if (!submission || submission.status === 'DELETED') {
      return res.status(404).json({
        success: false,
        message: '答题记录不存在'
      });
    }

    // 检查权限（学生只能查看自己的，教师可以查看所有的）
    if (
      submission.studentId.toString() !== req.user._id.toString() &&
      req.user.role !== 'teacher'
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限查看此答题记录'
      });
    }

    if (req.user.role === 'student' && submission.status !== 'SUBMITTED') {
      return res.status(403).json({ success: false, message: '提交后才可查看答题结果' });
    }

    const quiz = await Quiz.findById(submission.quizId)
      .populate('questions.questionId');

    // 获取答案可见性设置
    let showAnswerAfterSubmit = false;

    // 优先从关联的课时活动中获取配置
    if (submission.lessonId && submission.activityId) {
      try {
        const lesson = await Lesson.findById(submission.lessonId);
        if (lesson) {
          const activity = lesson.activities.id(submission.activityId);
          if (activity && activity.quizSettings && activity.quizSettings.showAnswerAfterSubmit !== undefined) {
            showAnswerAfterSubmit = activity.quizSettings.showAnswerAfterSubmit;
          }
        }
      } catch (err) {
        console.error('获取课时活动配置失败(getSubmission):', err);
      }
    } else if (quiz.settings) {
      // 兼容旧逻辑
      showAnswerAfterSubmit = quiz.settings.showAnswerAfterSubmit || false;
    }

    // 教师始终可以查看答案；否则依据测验设置
    const canViewAnswers = ['teacher', 'admin'].includes(req.user.role) || (submission.status === 'SUBMITTED' && showAnswerAfterSubmit);

    if (canViewAnswers) {
      res.status(200).json({
        success: true,
        data: {
          submission,
          questions: submission.answers.map(answer => {
            const question = quiz.questions.find(q =>
              q.questionId && q.questionId._id.toString() === answer.questionId.toString()
            );

            // 如果找不到对应的题目，返回基本信息
            if (!question || !question.questionId) {
              return {
                questionId: answer.questionId,
                content: "题目信息不可用",
                selectedOption: answer.selectedOption,
                isCorrect: answer.isCorrect
              };
            }

            // 找到正确选项（如果存在）
            const correctOption = question.questionId.options &&
              question.questionId.options.find(opt => opt.isCorrect);

            return {
              questionId: question.questionId._id,
              content: question.questionId.content,
              selectedOption: answer.selectedOption,
              correctOption: correctOption ? correctOption._id : undefined,
              isCorrect: answer.isCorrect
            };
          }),
        }
      });
    } else {
      // 不允许查看答案，返回基础数据
      const correctCount = submission.answers.filter(answer => answer.isCorrect).length;
      const totalCount = submission.answers.length;
      const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

      res.status(200).json({
        success: true,
        data: {
          submission: withoutAnswers(submission),
          accuracy,
          totalCount,
          correctCount
        }
      });
    }
  } catch (error) {
    console.error('获取答题记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取答题记录失败',
      error: error.message
    });
  }
};

// 获取测验的所有提交记录
exports.getSubmissionsByQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { role, _id: userId } = req.user;

    logger.info('获取测验提交记录', { quizId, userId, role });

    // 构建查询条件
    const query = { quizId, status: { $ne: 'DELETED' } };

    // 如果是学生，只能查看自己的提交记录
    if (role !== 'teacher') {
      query.studentId = userId;
    }

    let submissions = await QuizSubmission.find(query)
      .populate({
        path: 'studentId',
        select: 'name classId',
        populate: {
          path: 'classId',
          model: 'Class',
          select: 'name grade status'
        }
      })
      .sort('-submitTime');

    // 过滤掉所在班级已归档的学生
    if (role === 'teacher' || role === 'admin') {
      submissions = submissions.filter(s => {
        const isArchived = s.studentId?.classId?.status === 'archived';
        return !isArchived;
      });
    }

    logger.info('获取测验提交记录成功', {
      quizId,
      userId,
      role,
      submissionsCount: submissions.length
    });

    res.status(200).json({
      success: true,
      data: role === 'student' ? withoutAnswers(submissions) : submissions
    });
  } catch (error) {
    logger.error('获取测验提交记录失败', { error: error.message, stack: error.stack });
    console.error('获取测验提交记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取测验提交记录失败',
      error: error.message
    });
  }
};

// 导出测验提交记录到Excel
exports.exportSubmissions = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { classId } = req.query;
    const { role, _id: userId } = req.user;

    logger.info('导出测验提交记录', { quizId, userId, role, classId });

    // 只有教师可以导出
    if (role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '只有教师可以导出测验记录'
      });
    }

    // 获取测验信息
    const quiz = await Quiz.findById(quizId)
      .populate('questions.questionId');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: '测验不存在'
      });
    }

    // 构建查询条件
    const query = { quizId, status: 'SUBMITTED' };

    // 获取提交记录
    let submissions = await QuizSubmission.find(query)
      .populate({
        path: 'studentId',
        select: 'name username email classId',
        populate: {
          path: 'classId',
          model: 'Class',
          select: 'name grade'
        }
      })
      .sort('-submitTime');

    logger.info('原始提交记录示例', {
      submissionExample: submissions.length > 0 ? {
        id: submissions[0]._id,
        studentName: submissions[0].studentId?.name,
        studentUsername: submissions[0].studentId?.username,
        classId: submissions[0].studentId?.classId?._id,
        className: submissions[0].studentId?.classId?.name,
        classGrade: submissions[0].studentId?.classId?.grade,
        answersCount: submissions[0].answers?.length,
        firstAnswer: submissions[0].answers?.[0]
      } : null
    });

    // 如果指定了班级，进行过滤（兼容已populate与未populate两种情况）
    if (classId) {
      submissions = submissions.filter(submission => {
        const cls = submission?.studentId?.classId;
        const id = cls && cls._id ? cls._id.toString() : (cls ? cls.toString() : null);
        return id === classId;
      });
    }

    logger.info('查询到的提交记录数量', { count: submissions.length });

    // 使用exceljs创建工作簿
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();

    // 创建单个工作表包含所有信息
    const sheet = workbook.addWorksheet('测验答题记录');

    // 准备题目信息和表头（支持矩阵量表按行展开 & 孤儿题目）
    const questionMap = {}; // questionId -> { order, content, type, matrixRows, isOrphan }

    logger.info('测验题目信息', {
      questionsCount: quiz.questions?.length,
      questionsExample: quiz.questions?.[0] ? {
        id: quiz.questions[0]._id,
        questionId: quiz.questions[0].questionId?._id,
        questionType: quiz.questions[0].questionId?.type
      } : null
    });

    if (quiz.questions && quiz.questions.length > 0) {
      quiz.questions.forEach((q, index) => {
        if (q.questionId && q.questionId._id) {
          const qid = q.questionId._id.toString();
          const questionContent = (q.questionId.content || '').replace(/<[^>]*>/g, '').trim();
          questionMap[qid] = {
            order: index + 1,
            content: questionContent,
            type: q.questionId.type,
            matrixRows: Array.isArray(q.questionId.matrixRows) ? q.questionId.matrixRows : [],
            isOrphan: false
          };
        }
      });
    }

    // 收集所有出现过的题目ID，补齐孤儿题目
    const answeredQuestionIds = new Set();
    submissions.forEach(sub => {
      (sub.answers || []).forEach(ans => {
        if (ans.questionId) answeredQuestionIds.add(ans.questionId.toString());
      });
    });
    const missingIds = Array.from(answeredQuestionIds).filter(id => !questionMap[id]);
    if (missingIds.length > 0) {
      const orphanQuestions = await Question.find({ _id: { $in: missingIds } });
      let lastOrder = Object.values(questionMap).reduce((m, x) => Math.max(m, x.order), 0);
      orphanQuestions.forEach((oq) => {
        const qid = oq._id.toString();
        if (!questionMap[qid]) {
          lastOrder += 1;
          const content = (oq.content || '').replace(/<[^>]*>/g, '').trim();
          questionMap[qid] = {
            order: lastOrder,
            content,
            type: oq.type,
            matrixRows: Array.isArray(oq.matrixRows) ? oq.matrixRows : [],
            isOrphan: true
          };
        }
      });
    }

    // 构建导出列：普通题1列；单量表1列；矩阵量表每行1列
    const exportColumns = [];
    const sortedQuestions = Object.entries(questionMap)
      .sort((a, b) => a[1].order - b[1].order);
    sortedQuestions.forEach(([qid, meta]) => {
      const shortContent = meta.content.length > 30 ? meta.content.substring(0, 30) + '...' : meta.content;
      const baseTitle = `题目${meta.order}：${shortContent}`;
      if (meta.type === 'PSYCHOLOGICAL_SCALE' && meta.matrixRows && meta.matrixRows.length > 0) {
        meta.matrixRows.forEach(row => {
          const rowLabel = row && row.content ? row.content : (row && row.id ? row.id : '项目');
          exportColumns.push({ questionId: qid, matrixRowId: row?.id, header: `${baseTitle}-${rowLabel}` });
        });
      } else {
        exportColumns.push({ questionId: qid, header: baseTitle });
      }
    });

    logger.info('题目映射创建完成', {
      questionCount: sortedQuestions.length,
      columnCount: exportColumns.length
    });

    // 构建完整表头：基本信息 + 每个题目
    const headers = [
      '学生姓名', '学号', '年级', '班级', '提交时间', '开始时间',
      '用时(分钟)', '得分', '尝试次数', ...exportColumns.map(c => c.header)
    ];
    sheet.addRow(headers);

    // 设置表头样式
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // 添加详细答题数据（每个学生一行）
    for (const submission of submissions) {
      const duration = (new Date(submission.submitTime) - new Date(submission.startTime)) / (1000 * 60);

      // 获取班级信息
      const student = submission.studentId;
      const classInfo = student?.classId;
      const grade = classInfo?.grade || '未知';
      const className = classInfo?.name || '未知';

      // 调试班级信息
      logger.info('学生班级信息处理', {
        studentName: student?.name,
        studentUsername: student?.username,
        hasClassId: !!student?.classId,
        classId: classInfo?._id,
        grade: grade,
        className: className,
        rawClassInfo: classInfo
      });

      // 基本信息
      const rowData = [
        student?.name || '未知',
        student?.username || '未知',
        grade,
        className,
        new Date(submission.submitTime).toLocaleString('zh-CN'),
        new Date(submission.startTime).toLocaleString('zh-CN'),
        Math.round(duration * 10) / 10,
        submission.score || 0,
        submission.attemptNumber || 1
      ];

      // 为每个题目创建答案映射
      const answerMap = {};
      if (submission.answers && submission.answers.length > 0) {
        submission.answers.forEach(answer => {
          if (answer.questionId) {
            answerMap[answer.questionId.toString()] = answer;
          }
        });
      }

      logger.info('学生答案处理', {
        studentName: submission.studentId?.name,
        answersCount: submission.answers?.length,
        answerMapKeys: Object.keys(answerMap),
        firstAnswerExample: submission.answers?.[0] ? {
          questionId: submission.answers[0].questionId,
          isCorrect: submission.answers[0].isCorrect,
          selectedOption: submission.answers[0].selectedOption
        } : null
      });

      // 按导出列顺序输出每题值
      exportColumns.forEach((col, colIndex) => {
        const meta = questionMap[col.questionId] || {};
        const answer = answerMap[col.questionId];
        let value = 0;
        if (answer) {
          if (meta.type === 'PSYCHOLOGICAL_SCALE') {
            if (col.matrixRowId) {
              // 矩阵量表：按行输出，值+1（从0基转为1..N），无则0
              let v = null;
              if (answer.matrixAnswers instanceof Map) {
                v = answer.matrixAnswers.get(col.matrixRowId);
              } else if (answer.matrixAnswers) {
                v = answer.matrixAnswers[col.matrixRowId];
              }
              value = v != null ? Number(v) + 1 : 0;
            } else {
              // 单个量表
              value = answer.scaleValue != null ? Number(answer.scaleValue) : 0;
            }
          } else {
            // 问卷为心理量表时，普通选择题导出选项序号（A=1,B=2,...），而不是1/0得分
            if (quiz.isScaleTest) {
              const qInQuiz = (quiz.questions || []).find(q => q.questionId && q.questionId._id && q.questionId._id.toString() === col.questionId);
              const options = qInQuiz?.questionId?.options || [];
              const selectedId = answer.selectedOption ? answer.selectedOption.toString() : '';
              const idx = options.findIndex(opt => (opt._id && opt._id.toString()) === selectedId);
              value = idx >= 0 ? (idx + 1) : 0;
            } else {
              value = answer.isCorrect ? 1 : 0;
            }
          }
        }
        rowData.push(value);
        if (colIndex === 0) {
          logger.info('题目答案匹配', {
            studentName: submission.studentId?.name,
            questionId: col.questionId,
            hasAnswer: !!answer,
            value
          });
        }
      });

      sheet.addRow(rowData);
    }

    // 自动调整列宽
    sheet.columns.forEach((column, index) => {
      if (index < 9) { // 基本信息列（学生姓名、学号、年级、班级、提交时间、开始时间、用时、得分、尝试次数）
        column.width = 15;
      } else { // 题目列
        column.width = 20; // 题目列稍微宽一些，因为包含题干内容
      }
    });

    // 设置响应头
    const fileName = `${quiz.title}-测验记录-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

    // 将工作簿写入响应
    await workbook.xlsx.write(res);

    logger.info('导出测验提交记录成功', {
      quizId,
      submissionsCount: submissions.length,
      fileName
    });

  } catch (error) {
    logger.error('导出测验提交记录失败', {
      error: error.message,
      stack: error.stack
    });
    console.error('导出测验提交记录失败:', error);
    res.status(500).json({
      success: false,
      message: '导出失败',
      error: error.message
    });
  }
};

// 工具函数：随机打乱数组
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// 开始答题（创建或恢复 IN_PROGRESS 记录）
exports.start = async (req, res) => {
  try {
    const { quizId, activityId, lessonId } = req.body;
    const studentId = req.user._id;

    logger.info('开始答题请求', { studentId, quizId, activityId, lessonId });

    // 获取测验信息
    const quiz = await Quiz.findById(quizId)
      .populate('questions.questionId');

    if (!quiz) {
      logger.warn('测验不存在', { quizId });
      return res.status(404).json({
        success: false,
        message: '测验不存在'
      });
    }

    // 检查测验状态
    if (quiz.status !== 'PUBLISHED') {
      logger.warn('测验未发布', { quizId, status: quiz.status });
      return res.status(400).json({
        success: false,
        message: '测验未发布或已结束'
      });
    }

    await quizContext(req.user, quizId, lessonId, activityId, true);
    await QuizSubmission.init();
    // 获取测验设置
    let quizSettings = {
      allowMultipleAttempts: false,
      maxAttempts: 1,
      randomizeQuestions: false,
      randomizeOptions: false,
      timeLimit: 0 // 时间限制（分钟），0表示不限时
    };

    if (lessonId && activityId) {
      try {
        const lesson = await Lesson.findById(lessonId);
        if (lesson) {
          const activity = lesson.activities.id(activityId);
          if (activity && activity.quizSettings) {
            const activitySettings = activity.quizSettings.toObject ? activity.quizSettings.toObject() : activity.quizSettings;
            if (activitySettings.allowMultipleAttempts !== undefined) quizSettings.allowMultipleAttempts = activitySettings.allowMultipleAttempts;
            if (activitySettings.maxAttempts !== undefined) quizSettings.maxAttempts = activitySettings.maxAttempts;
            if (activitySettings.randomizeQuestions !== undefined) quizSettings.randomizeQuestions = activitySettings.randomizeQuestions;
            if (activitySettings.randomizeOptions !== undefined) quizSettings.randomizeOptions = activitySettings.randomizeOptions;
            if (activitySettings.timeLimit !== undefined) quizSettings.timeLimit = activitySettings.timeLimit;
          }
        }
      } catch (err) {
        console.error('获取课时活动配置失败:', err);
      }
    }

    // 检查是否存在 IN_PROGRESS 的记录（强制继续旧记录）
    const existingQuery = {
      quizId,
      studentId,
      status: 'IN_PROGRESS'
    };
    if (activityId) {
      existingQuery.activityId = activityId;
    }

    const existingSubmission = await QuizSubmission.findOne(existingQuery);

    if (existingSubmission) {
      // 检查答题是否已超时
      if (quizSettings.timeLimit > 0) {
        const elapsed = Math.floor((Date.now() - new Date(existingSubmission.startTime).getTime()) / 1000);
        const remaining = quizSettings.timeLimit * 60 - elapsed;

        if (remaining <= 0) {
          // 答题超时，自动提交这个 IN_PROGRESS 记录
          logger.info('答题超时，自动提交', {
            studentId,
            quizId,
            submissionId: existingSubmission._id,
            elapsed
          });

          // 更新状态为 SUBMITTED
          existingSubmission.status = 'SUBMITTED';
          existingSubmission.submitTime = new Date();

          // 计算分数（使用已保存的答案）
          let score = 0;
          const quizQuestions = quiz.questions || [];
          for (const ans of existingSubmission.answers) {
            if (ans.isCorrect) {
              score++;
            }
          }
          existingSubmission.score = score;
          await existingSubmission.save();

          // 返回表示已自动提交
          return res.status(200).json({
            success: true,
            data: {
              autoSubmitted: true,
              submissionId: existingSubmission._id,
              score,
              message: '答题时间已耗尽，该次答题已自动提交'
            }
          });
        }
      }

      // 返回现有记录，恢复进度
      logger.info('恢复现有答题进度', {
        studentId,
        quizId,
        submissionId: existingSubmission._id
      });

      // 构建答案映射
      const answersMap = {};
      existingSubmission.answers.forEach(ans => {
        if (ans.questionId) {
          answersMap[ans.questionId.toString()] = ans.selectedOption || ans.scaleValue || ans.matrixAnswers;
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          submissionId: existingSubmission._id,
          isResume: true,
          questionOrder: existingSubmission.questionOrder,
          optionOrderMap: Object.fromEntries(existingSubmission.optionOrderMap || new Map()),
          answers: answersMap,
          startTime: existingSubmission.startTime,
          lastSaveTime: existingSubmission.lastSaveTime
        }
      });
    }

    // 检查已完成的提交次数
    const submissionQuery = {
      quizId,
      studentId,
      status: 'SUBMITTED'
    };
    if (activityId) {
      submissionQuery.activityId = activityId;
    }
    const submissionCount = await QuizSubmission.countDocuments(submissionQuery);
    const lastAttempt = await QuizSubmission.findOne({ quizId, studentId, status: { $in: ['IN_PROGRESS', 'SUBMITTED', 'DELETED'] }, ...(activityId ? { activityId } : {}) }).sort('-attemptNumber').select('attemptNumber');
    const nextAttempt = (lastAttempt?.attemptNumber || 0) + 1;

    // 检查是否可以开始新答题
    if (!quizSettings.allowMultipleAttempts && submissionCount > 0) {
      return res.status(400).json({
        success: false,
        message: '该测验不允许多次提交'
      });
    }

    if (quizSettings.allowMultipleAttempts && submissionCount >= quizSettings.maxAttempts) {
      return res.status(400).json({
        success: false,
        message: `已达到最大提交次数 (${quizSettings.maxAttempts} 次)`
      });
    }

    // 生成题目顺序
    let questionOrder = quiz.questions
      .filter(q => q.questionId && q.questionId._id)
      .sort((a, b) => a.order - b.order)
      .map(q => q.questionId._id);

    if (quizSettings.randomizeQuestions) {
      questionOrder = shuffleArray(questionOrder);
    }

    // 生成选项顺序（如果需要随机化）
    const optionOrderMap = new Map();
    if (quizSettings.randomizeOptions) {
      quiz.questions.forEach(q => {
        if (q.questionId && q.questionId.options && q.questionId.options.length > 0) {
          const optionIds = q.questionId.options.map(opt => opt._id);
          optionOrderMap.set(q.questionId._id.toString(), shuffleArray(optionIds));
        }
      });
    }

    // 创建新的 IN_PROGRESS 记录
    const startTime = new Date();
    const attemptSlot = await allocateAttemptSlot({ quizId, studentId, ...(activityId ? { activityId } : {}) }, quizSettings.allowMultipleAttempts ? quizSettings.maxAttempts : 1);
    const newSubmission = await QuizSubmission.create({
      attemptSlot,
      attemptKey: [quizId, studentId, activityId || 'legacy', attemptSlot].join(':'),
      quizId,
      studentId,
      questionOrder,
      optionOrderMap,
      answers: [],
      startTime,
      status: 'IN_PROGRESS',
      attemptNumber: nextAttempt,
      activityId: activityId || undefined,
      lessonId: lessonId || undefined
    });

    logger.info('创建新答题记录', {
      studentId,
      quizId,
      submissionId: newSubmission._id,
      attemptNumber: submissionCount + 1
    });

    res.status(201).json({
      success: true,
      data: {
        submissionId: newSubmission._id,
        isResume: false,
        questionOrder,
        optionOrderMap: Object.fromEntries(optionOrderMap),
        answers: {},
        startTime,
        remainingAttempts: quizSettings.allowMultipleAttempts
          ? quizSettings.maxAttempts - submissionCount - 1
          : 0
      }
    });
  } catch (error) {
    logger.error('开始答题失败', { error: error.message, stack: error.stack });
    res.status(error.status || (error.code === 11000 || error.name === 'VersionError' ? 409 : 500)).json({
      success: false,
      message: '开始答题失败',
      error: error.message
    });
  }
};

// 保存答题进度
exports.saveProgress = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { answers } = req.body;
    const studentId = req.user._id;

    // 查找提交记录
    const submission = await QuizSubmission.findById(submissionId);

    if (!submission || submission.status === 'DELETED') {
      return res.status(404).json({
        success: false,
        message: '答题记录不存在'
      });
    }

    // 验证权限
    if (submission.studentId.toString() !== studentId.toString()) {
      return res.status(403).json({
        success: false,
        message: '没有权限修改此答题记录'
      });
    }

    // 检查状态
    if (submission.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: '此答题已提交，无法修改'
      });
    }

    // 获取测验信息用于判断题目类型
    const quiz = await Quiz.findById(submission.quizId)
      .populate('questions.questionId');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: '测验不存在'
      });
    }

    // 更新答案
    const existingAnswers = submission.answers || [];
    const answerMap = new Map();

    // 先将现有答案放入Map
    existingAnswers.forEach(ans => {
      if (ans.questionId) {
        answerMap.set(ans.questionId.toString(), ans);
      }
    });

    // 更新或添加新答案
    Object.entries(answers).forEach(([questionId, answer]) => {
      const question = quiz.questions.find(
        q => q.questionId && q.questionId._id.toString() === questionId
      )?.questionId;

      if (!question) return;

      const answerData = {
        questionId,
        questionVersion: question.version ?? 1,
        questionSnapshot: questionVersionService.createQuestionSnapshot(question),
        selectedOption: undefined,
        scaleValue: undefined,
        isCorrect: false,
        matrixAnswers: undefined
      };

      if (question.type === 'PSYCHOLOGICAL_SCALE') {
        if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
          // 矩阵量表
          answerData.matrixAnswers = new Map(Object.entries(answer));
        } else if (answer != null) {
          // 单个量表值
          answerData.scaleValue = Number(answer) + 1; // 前端传0-based，存1-based
        }
      } else {
        // 选择题
        if (answer != null) {
          answerData.selectedOption = Array.isArray(answer) ? answer[0] : answer;
          const correctOption = question.options?.find(opt => opt.isCorrect);
          answerData.isCorrect = answerData.selectedOption === correctOption?._id?.toString();
        }
      }

      answerMap.set(questionId, answerData);
    });

    // 更新记录
    submission.answers = Array.from(answerMap.values());
    submission.lastSaveTime = new Date();
    await submission.save();

    logger.info('保存答题进度成功', {
      submissionId,
      studentId,
      answersCount: submission.answers.length
    });

    res.status(200).json({
      success: true,
      data: {
        lastSaveTime: submission.lastSaveTime,
        answersCount: submission.answers.length
      }
    });
  } catch (error) {
    logger.error('保存答题进度失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '保存答题进度失败',
      error: error.message
    });
  }
};

// 获取学生正在进行的答题记录
exports.getInProgress = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { activityId } = req.query;
    const studentId = req.user._id;

    const query = {
      quizId,
      studentId,
      status: 'IN_PROGRESS'
    };

    if (activityId) {
      query.activityId = activityId;
    }

    const submission = await QuizSubmission.findOne(query);

    if (!submission || submission.status === 'DELETED') {
      return res.status(200).json({
        success: true,
        data: null
      });
    }

    // 构建答案映射
    const answersMap = {};
    submission.answers.forEach(ans => {
      if (ans.questionId) {
        if (ans.matrixAnswers && ans.matrixAnswers.size > 0) {
          answersMap[ans.questionId.toString()] = Object.fromEntries(ans.matrixAnswers);
        } else if (ans.scaleValue != null) {
          answersMap[ans.questionId.toString()] = ans.scaleValue - 1; // 转回0-based
        } else if (ans.selectedOption) {
          answersMap[ans.questionId.toString()] = ans.selectedOption;
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        submissionId: submission._id,
        questionOrder: submission.questionOrder,
        optionOrderMap: Object.fromEntries(submission.optionOrderMap || new Map()),
        answers: answersMap,
        startTime: submission.startTime,
        lastSaveTime: submission.lastSaveTime
      }
    });
  } catch (error) {
    logger.error('获取进行中答题失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: '获取进行中答题失败',
      error: error.message
    });
  }
};

// 删除提交记录
exports.deleteSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;

    // 检查是否为教师
    if (req.user.role !== 'teacher') {
      logger.warn('非教师用户尝试删除测验记录', {
        userId: req.user._id,
        role: req.user.role,
        submissionId
      });
      return res.status(403).json({
        success: false,
        message: '只有教师可以删除测验记录'
      });
    }

    // 查找记录并检查是否存在
    const submission = await QuizSubmission.findById(submissionId)
      .populate('quizId', 'title isScaleTest');

    if (!submission || submission.status === 'DELETED') {
      logger.warn('测验提交记录不存在', { submissionId });
      return res.status(404).json({
        success: false,
        message: '测验提交记录不存在'
      });
    }

    const quiz = await Quiz.findById(submission.quizId._id);
    if (!quiz || String(quiz.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: '只有测验创建者可以删除答题记录' });
    }
    // Keep a tombstone so deletion and award revocation can recover together.
    const deleted = await QuizSubmission.updateOne({ _id: submissionId, status: { $ne: 'DELETED' } }, {
      $set: { status: 'DELETED', pointsPending: !quiz.isScaleTest }, $inc: { __v: 1 }, $unset: { attemptKey: 1 }
    });
    if (!deleted.matchedCount) return res.status(409).json({ success: false, message: '该记录已删除' });
    submission.status = 'DELETED';
    submission.__v = (submission.__v || 0) + 1;
    if (!quiz.isScaleTest) {
      try { await settleQuizPoints(submission); }
      catch (error) { logger.error('删除测验后积分等待恢复', { submissionId, error: error.message }); }
    }

    logger.info('测验提交记录删除成功', {
      submissionId,
      teacherId: req.user._id,
      studentId: submission.studentId,
      quizId: submission.quizId._id
    });

    // 异步刷新测验分析数据，避免展示旧统计
    try {
      await QuizAnalyticsService.updateQuizAnalytics(submission.quizId._id.toString());
    } catch (refreshError) {
      logger.error('删除提交后刷新测验分析失败', {
        error: refreshError.message,
        stack: refreshError.stack,
        quizId: submission.quizId._id
      });
    }

    res.status(200).json({
      success: true,
      message: '测验提交记录删除成功'
    });
  } catch (error) {
    logger.error('删除测验提交记录失败', {
      error: error.message,
      stack: error.stack,
      submissionId: req.params.submissionId
    });

    res.status(500).json({
      success: false,
      message: '删除测验提交记录失败',
      error: error.message
    });
  }
};

// 获取班级学生的测验提交记录
exports.getClassQuizSubmissions = async (req, res) => {
  try {
    const { classId, quizId } = req.params;

    logger.info('获取班级测验提交记录', { classId, quizId });

    // 验证权限（只有老师能获取班级提交记录）
    if (req.user.role !== 'teacher') {
      logger.warn('非教师用户尝试获取班级测验提交记录', { userId: req.user._id, role: req.user.role });
      return res.status(403).json({
        success: false,
        message: '权限不足，只有教师可以获取班级测验提交记录'
      });
    }

    // 获取班级所有学生
    const classStudents = await User.find({
      classId: classId,
      role: 'student'
    }).select('_id name username');

    if (!classStudents || classStudents.length === 0) {
      logger.warn('班级中没有学生', { classId });
      return res.json({
        success: true,
        message: '班级中没有学生',
        submissions: []
      });
    }

    // 获取班级学生的所有提交记录
    const studentIds = classStudents.map(student => student._id);

    // 查询条件
    let query = {
      studentId: { $in: studentIds },
      status: 'SUBMITTED'
    };

    // 如果指定了quizId，则只获取该quiz的提交记录
    if (quizId) {
      query.quizId = quizId;
    }

    // 获取提交记录
    const submissions = await QuizSubmission.find(query)
      .populate('studentId', 'name username')
      .populate('quizId', 'title questions')
      .sort('-submitTime');  // 按提交时间降序排序

    // 处理结果，为每个学生构建提交记录
    const submissionsByStudent = {};

    // 初始化每个学生的记录
    classStudents.forEach(student => {
      submissionsByStudent[student._id] = {
        student: {
          _id: student._id,
          name: student.name,
          username: student.username
        },
        submissions: []
      };
    });

    // 添加提交记录
    submissions.forEach(submission => {
      const studentId = submission.studentId._id.toString();
      if (submissionsByStudent[studentId]) {
        // 计算正确率
        let correctCount = 0;
        let totalQuestions = 0;

        if (submission.quizId && submission.quizId.questions) {
          // 优先使用学生实际回答的题目数量（answers数组长度）
          totalQuestions = submission.answers ? submission.answers.length : submission.quizId.questions.length;
          correctCount = submission.score || 0; // 得分就是正确题目数

          // 确保正确题目数不超过总题目数
          if (correctCount > totalQuestions) {
            logger.warn('数据不一致: 正确题目数超过总题目数', {
              submissionId: submission._id,
              studentId: submission.studentId._id,
              quizId: submission.quizId._id,
              score: correctCount,
              answersLength: submission.answers ? submission.answers.length : 'undefined',
              questionsLength: submission.quizId.questions.length
            });
            // 使用两者中的较大值作为总题目数，确保百分比计算合理
            totalQuestions = Math.max(totalQuestions, correctCount);
          }
        }

        // 计算正确率，确保不超过100%
        const accuracy = totalQuestions > 0 ? Math.min((correctCount / totalQuestions) * 100, 100) : 0;

        submissionsByStudent[studentId].submissions.push({
          _id: submission._id,
          quizId: submission.quizId._id,
          quizTitle: submission.quizId.title,
          score: submission.score,
          correctCount,
          totalQuestions,
          accuracy: Math.round(accuracy),
          submitTime: submission.submitTime,
          attemptNumber: submission.attemptNumber
        });
      }
    });

    // 转换为数组
    const result = Object.values(submissionsByStudent);

    logger.info('班级测验提交记录获取成功', {
      classId,
      quizId,
      studentCount: classStudents.length,
      totalSubmissions: submissions.length
    });

    return res.json({
      success: true,
      students: result
    });

  } catch (error) {
    logger.error('获取班级测验提交记录失败', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      message: '获取班级测验提交记录失败',
      error: error.message
    });
  }
};