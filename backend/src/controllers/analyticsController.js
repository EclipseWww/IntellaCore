const logger = require('../utils/logger');
const TypingRecord = require('../models/TypingRecord');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const QuizSubmission = require('../models/QuizSubmission');
const FlowchartSubmission = require('../models/FlowchartSubmission');
const PythonSubmission = require('../models/PythonSubmission');
const FillBlankSubmission = require('../models/FillBlankSubmission');
const SpreadsheetSubmission = require('../models/SpreadsheetSubmission');
const User = require('../models/User');
const mongoose = require('mongoose');
const semesterUtils = require('../utils/semesterUtils');

/**
 * 获取学生的打字记录统计
 */
exports.getStudentTypingStats = async (req, res) => {
  try {
    logger.info('获取学生打字记录统计', { studentId: req.params.studentId });

    const { studentId } = req.params;

    // 验证学生ID是否有效
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: '无效的学生ID' });
    }

    // 验证学生是否存在
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: '未找到学生' });
    }

    // 获取最近30天的打字记录
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 统计总记录
    const totalRecords = await TypingRecord.countDocuments({ userId: studentId });

    // 统计近30天记录
    const recentRecords = await TypingRecord.countDocuments({
      userId: studentId,
      startTime: { $gte: thirtyDaysAgo }
    });

    // 计算平均速度和准确率
    const stats = await TypingRecord.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(studentId) } },
      {
        $group: {
          _id: null,
          avgSpeed: { $avg: '$speed' },
          avgAccuracy: { $avg: '$accuracy' },
          totalPassedCount: { $sum: { $cond: ['$isPassed', 1, 0] } }
        }
      }
    ]);

    // 获取按日期分组的练习统计
    const dailyStats = await TypingRecord.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(studentId),
          startTime: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } },
          count: { $sum: 1 },
          avgSpeed: { $avg: '$speed' },
          avgAccuracy: { $avg: '$accuracy' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const typingStats = {
      totalRecords,
      recentRecords,
      averageSpeed: stats.length > 0 ? Math.round(stats[0].avgSpeed) : 0,
      averageAccuracy: stats.length > 0 ? Math.round(stats[0].avgAccuracy * 100) / 100 : 0,
      totalPassedCount: stats.length > 0 ? stats[0].totalPassedCount : 0,
      dailyStats: dailyStats.map(day => ({
        date: day._id,
        count: day.count,
        averageSpeed: Math.round(day.avgSpeed),
        averageAccuracy: Math.round(day.avgAccuracy * 100) / 100
      }))
    };

    res.status(200).json({ success: true, data: typingStats });
  } catch (error) {
    logger.error('获取学生打字记录统计失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取打字记录统计失败', error: error.message });
  }
};

/**
 * 获取学生的测验提交统计
 */
exports.getStudentQuizStats = async (req, res) => {
  try {
    logger.info('获取学生测验提交统计', { studentId: req.params.studentId });

    const { studentId } = req.params;

    // 验证学生ID是否有效
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: '无效的学生ID' });
    }

    // 验证学生是否存在
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: '未找到学生' });
    }

    // 获取最近30天的测验提交
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 统计总记录和近期记录
    const totalSubmissions = await QuizSubmission.countDocuments({
      studentId,
      status: 'SUBMITTED'
    });

    const recentSubmissions = await QuizSubmission.countDocuments({
      studentId,
      status: 'SUBMITTED',
      submitTime: { $gte: thirtyDaysAgo }
    });

    // 获取平均分数
    const scoreStats = await QuizSubmission.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(studentId),
          status: 'SUBMITTED'
        }
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$score' }
        }
      }
    ]);

    // 获取按日期分组的测验提交统计
    const dailyStats = await QuizSubmission.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(studentId),
          status: 'SUBMITTED',
          submitTime: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$submitTime" } },
          count: { $sum: 1 },
          avgScore: { $avg: '$score' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const quizStats = {
      totalSubmissions,
      recentSubmissions,
      averageScore: scoreStats.length > 0 ? Math.round(scoreStats[0].avgScore * 100) / 100 : 0,
      dailyStats: dailyStats.map(day => ({
        date: day._id,
        count: day.count,
        averageScore: Math.round(day.avgScore * 100) / 100
      }))
    };

    res.status(200).json({ success: true, data: quizStats });
  } catch (error) {
    logger.error('获取学生测验提交统计失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取测验提交统计失败', error: error.message });
  }
};

/**
 * 获取学生的作业提交统计
 */
exports.getStudentAssignmentStats = async (req, res) => {
  try {
    logger.info('获取学生作业提交统计', { studentId: req.params.studentId });

    const { studentId } = req.params;

    // 验证学生ID是否有效
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: '无效的学生ID' });
    }

    // 验证学生是否存在
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: '未找到学生' });
    }

    // 获取最近30天的作业提交
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 统计总记录和近期记录
    const totalSubmissions = await AssignmentSubmission.countDocuments({
      student: new mongoose.Types.ObjectId(studentId),
      status: { $in: ['submitted', 'graded', 'returned'] }
    });

    const recentSubmissions = await AssignmentSubmission.countDocuments({
      student: new mongoose.Types.ObjectId(studentId),
      status: { $in: ['submitted', 'graded', 'returned'] },
      submitDate: { $gte: thirtyDaysAgo }
    });

    // 统计已批阅的作业平均分
    const scoreStats = await AssignmentSubmission.aggregate([
      {
        $match: {
          student: new mongoose.Types.ObjectId(studentId),
          status: { $in: ['graded', 'returned'] },
          'grade.score': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$grade.score' }
        }
      }
    ]);

    // 获取按日期分组的作业提交统计
    const dailyStats = await AssignmentSubmission.aggregate([
      {
        $match: {
          student: new mongoose.Types.ObjectId(studentId),
          status: { $in: ['submitted', 'graded', 'returned'] },
          submitDate: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$submitDate" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const assignmentStats = {
      totalSubmissions,
      recentSubmissions,
      averageScore: scoreStats.length > 0 ? Math.round(scoreStats[0].avgScore * 100) / 100 : 0,
      dailyStats: dailyStats.map(day => ({
        date: day._id,
        count: day.count
      }))
    };

    res.status(200).json({ success: true, data: assignmentStats });
  } catch (error) {
    logger.error('获取学生作业提交统计失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取作业提交统计失败', error: error.message });
  }
};

/**
 * 获取学生的综合学习统计
 */
exports.getStudentLearningStats = async (req, res) => {
  try {
    logger.info('获取学生综合学习统计', { studentId: req.params.studentId });

    const { studentId } = req.params;

    // 验证学生ID是否有效
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: '无效的学生ID' });
    }

    // 验证学生是否存在
    const student = await User.findById(studentId).select('username name role');
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: '未找到学生' });
    }

    // 获取打字统计
    const typingStats = await TypingRecord.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(studentId) } },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          avgSpeed: { $avg: '$speed' },
          avgAccuracy: { $avg: '$accuracy' },
          totalPassedCount: { $sum: { $cond: ['$isPassed', 1, 0] } }
        }
      }
    ]);

    // 获取测验统计
    const quizStats = await QuizSubmission.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(studentId),
          status: 'SUBMITTED'
        }
      },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          avgScore: { $avg: '$score' }
        }
      }
    ]);

    // 获取作业统计
    const assignmentStats = await AssignmentSubmission.aggregate([
      {
        $match: {
          student: new mongoose.Types.ObjectId(studentId),
          status: { $in: ['submitted', 'graded', 'returned'] }
        }
      },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          gradedSubmissions: {
            $sum: {
              $cond: [
                { $in: ['$status', ['graded', 'returned']] },
                1,
                0
              ]
            }
          },
          avgScore: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', ['graded', 'returned']] },
                    { $ifNull: ['$grade.score', false] }
                  ]
                },
                '$grade.score',
                null
              ]
            }
          }
        }
      }
    ]);

    const learningStats = {
      student: {
        id: student._id,
        username: student.username,
        name: student.name
      },
      typing: {
        totalRecords: typingStats.length > 0 ? typingStats[0].totalRecords : 0,
        averageSpeed: typingStats.length > 0 ? Math.round(typingStats[0].avgSpeed) : 0,
        averageAccuracy: typingStats.length > 0 ? Math.round(typingStats[0].avgAccuracy * 100) / 100 : 0,
        totalPassedCount: typingStats.length > 0 ? typingStats[0].totalPassedCount : 0
      },
      quiz: {
        totalSubmissions: quizStats.length > 0 ? quizStats[0].totalSubmissions : 0,
        averageScore: quizStats.length > 0 ? Math.round(quizStats[0].avgScore * 100) / 100 : 0
      },
      assignment: {
        totalSubmissions: assignmentStats.length > 0 ? assignmentStats[0].totalSubmissions : 0,
        gradedSubmissions: assignmentStats.length > 0 ? assignmentStats[0].gradedSubmissions : 0,
        averageScore: assignmentStats.length > 0 ? Math.round(assignmentStats[0].avgScore * 100) / 100 : 0
      }
    };

    res.status(200).json({ success: true, data: learningStats });
  } catch (error) {
    logger.error('获取学生综合学习统计失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取学习统计失败', error: error.message });
  }
};

/**
 * 获取班级学生的学习统计
 */
exports.getClassLearningStats = async (req, res) => {
  try {
    logger.info('获取班级学习统计', { classId: req.params.classId });

    const { classId } = req.params;

    // 验证班级ID是否有效
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ success: false, message: '无效的班级ID' });
    }

    // 查找班级中的所有学生
    const students = await User.find({
      role: 'student',
      classId: new mongoose.Types.ObjectId(classId)
    }).select('_id username name');

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: '未找到班级学生' });
    }

    const studentIds = students.map(student => student._id);

    // 获取打字统计
    const typingStats = await TypingRecord.aggregate([
      { $match: { userId: { $in: studentIds } } },
      {
        $group: {
          _id: '$userId',
          totalRecords: { $sum: 1 },
          avgSpeed: { $avg: '$speed' },
          avgAccuracy: { $avg: '$accuracy' },
          totalPassedCount: { $sum: { $cond: ['$isPassed', 1, 0] } }
        }
      }
    ]);

    // 获取测验统计
    const quizStats = await QuizSubmission.aggregate([
      {
        $match: {
          studentId: { $in: studentIds },
          status: 'SUBMITTED'
        }
      },
      {
        $group: {
          _id: '$studentId',
          totalSubmissions: { $sum: 1 },
          avgScore: { $avg: '$score' }
        }
      }
    ]);

    // 获取作业统计
    const assignmentStats = await AssignmentSubmission.aggregate([
      {
        $match: {
          student: { $in: studentIds },
          status: { $in: ['submitted', 'graded', 'returned'] }
        }
      },
      {
        $group: {
          _id: '$student',
          totalSubmissions: { $sum: 1 },
          gradedSubmissions: {
            $sum: {
              $cond: [
                { $in: ['$status', ['graded', 'returned']] },
                1,
                0
              ]
            }
          },
          avgScore: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', ['graded', 'returned']] },
                    { $ifNull: ['$grade.score', false] }
                  ]
                },
                '$grade.score',
                null
              ]
            }
          }
        }
      }
    ]);

    // 整合每个学生的统计数据
    const studentsStats = students.map(student => {
      const typing = typingStats.find(stat => stat._id.toString() === student._id.toString()) || {};
      const quiz = quizStats.find(stat => stat._id.toString() === student._id.toString()) || {};
      const assignment = assignmentStats.find(stat => stat._id.toString() === student._id.toString()) || {};

      return {
        student: {
          id: student._id,
          username: student.username,
          name: student.name
        },
        typing: {
          totalRecords: typing.totalRecords || 0,
          averageSpeed: typing.avgSpeed ? Math.round(typing.avgSpeed) : 0,
          averageAccuracy: typing.avgAccuracy ? Math.round(typing.avgAccuracy * 100) / 100 : 0,
          totalPassedCount: typing.totalPassedCount || 0
        },
        quiz: {
          totalSubmissions: quiz.totalSubmissions || 0,
          averageScore: quiz.avgScore ? Math.round(quiz.avgScore * 100) / 100 : 0
        },
        assignment: {
          totalSubmissions: assignment.totalSubmissions || 0,
          gradedSubmissions: assignment.gradedSubmissions || 0,
          averageScore: assignment.avgScore ? Math.round(assignment.avgScore * 100) / 100 : 0
        }
      };
    });

    res.status(200).json({ success: true, data: studentsStats });
  } catch (error) {
    logger.error('获取班级学习统计失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '获取班级学习统计失败', error: error.message });
  }
};

/**
 * 计算学生平日成绩
 * 综合计算打字成绩、作业成绩和测验成绩的综合计算
 */
// 导出内部计算函数供其他控制器使用
exports.calculateStudentDailyScoreInternal = async (studentId, semester) => {
  // 验证学生ID是否有效
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw new Error('无效的学生ID');
  }

  // 验证学生是否存在
  const student = await User.findById(studentId).select('username name role classId');
  if (!student || student.role !== 'student') {
    throw new Error('未找到学生');
  }

  // 解析学期日期范围
  const { startDate, endDate } = semesterUtils.parseSemesterDateRange(semester);

  // 构建日期过滤条件
  const typingDateFilter = {};
  if (startDate && endDate) {
    typingDateFilter.startTime = { $gte: startDate, $lte: endDate };
  }

  // 获取课程活动关联的打字记录（排除自由练习）
  const typingRecords = await TypingRecord.find({
    userId: new mongoose.Types.ObjectId(studentId),
    lessonId: { $ne: null },
    activityId: { $ne: null },
    ...typingDateFilter
  }).select('speed targetSpeed accuracy lessonId activityId');

  // 计算打字成绩：按活动分组，每个活动只取最高分
  let typingScore = 0;
  const typingScoreMap = {}; // key: lessonId_activityId, value: highest score

  for (const record of typingRecords) {
    const recordScore = Math.min(10, (record.speed / record.targetSpeed) * 10);
    const activityKey = `${record.lessonId}_${record.activityId}`;

    // 只保留每个活动的最高分
    if (!typingScoreMap[activityKey] || recordScore > typingScoreMap[activityKey]) {
      typingScoreMap[activityKey] = recordScore;
    }
  }

  // 累加所有活动的最高分
  for (const key in typingScoreMap) {
    typingScore += typingScoreMap[key];
  }

  // 构建测验提交日期过滤条件
  const quizDateFilter = {};
  if (startDate && endDate) {
    quizDateFilter.submitTime = { $gte: startDate, $lte: endDate };
  }

  // 获取有活动关联的测验提交记录
  const quizSubmissions = await QuizSubmission.find({
    studentId: new mongoose.Types.ObjectId(studentId),
    status: 'SUBMITTED',
    activityId: { $exists: true, $ne: null },
    lessonId: { $exists: true, $ne: null },
    ...quizDateFilter
  }).populate({
    path: 'quizId',
    select: 'questions isScaleTest'
  });

  // 计算所有quiz的(实际得分/总分*10)的和
  let quizScore = 0;

  // 按活动分组，只取每个活动的最高分
  const quizScoreMap = {};

  for (const submission of quizSubmissions) {
    // 如果没有关联的quiz，跳过
    if (!submission.quizId) continue;

    // 如果是心理量表测验，跳过计分
    if (submission.quizId.isScaleTest) continue;

    // 计算测验总分 (直接使用answers.length)
    const totalPoints = submission.answers ? submission.answers.length : 0;

    // 如果总分为0，跳过此quiz
    if (totalPoints === 0) continue;

    // 计算得分：(实际得分/总分) * 10
    const submissionScore = Math.min(10, (submission.score / totalPoints) * 10);

    // 按活动分组（同一课时同一活动只取最高分）
    const activityKey = `${submission.lessonId}_${submission.activityId}`;

    // 如果是第一次遇到这个活动或得分比之前记录的高，则更新
    if (!quizScoreMap[activityKey] || submissionScore > quizScoreMap[activityKey]) {
      quizScoreMap[activityKey] = submissionScore;
    }
  }

  // 累加所有活动的最高分
  for (const key in quizScoreMap) {
    quizScore += quizScoreMap[key];
  }

  // 构建作业提交日期过滤条件
  const assignmentDateFilter = {};
  if (startDate && endDate) {
    assignmentDateFilter.submittedAt = { $gte: startDate, $lte: endDate };
  }

  // 获取所有作业提交
  const assignmentSubmissions = await AssignmentSubmission.find({
    student: new mongoose.Types.ObjectId(studentId),
    status: { $in: ['submitted', 'graded', 'returned'] },
    ...assignmentDateFilter
  }).select('grade aiGrade status');

  // 计算所有作业分数的和（优先使用教师评分）
  let assignmentScore = 0;

  for (const submission of assignmentSubmissions) {
    let score = null;

    // 优先使用教师评分，如果没有则使用AI评分
    if ((submission.status === 'graded' || submission.status === 'returned') && submission.grade && submission.grade.score !== undefined) {
      score = submission.grade.score;
    } else if (submission.aiGrade && submission.aiGrade.score !== undefined) {
      score = submission.aiGrade.score;
    }

    if (score !== null) {
      assignmentScore += score;
    }
  }

  // ===== 流程图成绩计算 =====
  const flowchartDateFilter = {};
  if (startDate && endDate) {
    flowchartDateFilter.submittedAt = { $gte: startDate, $lte: endDate };
  }

  const flowchartSubmissions = await FlowchartSubmission.find({
    userId: new mongoose.Types.ObjectId(studentId),
    status: 'graded',
    'grade.score': { $exists: true, $ne: null },
    ...flowchartDateFilter
  }).select('lessonId activityId grade.score');

  let flowchartScore = 0;
  const flowchartScoreMap = {}; // key: lessonId_activityId

  for (const submission of flowchartSubmissions) {
    const normalizedScore = Math.min(10, submission.grade.score); // 已经是0-10
    const activityKey = `${submission.lessonId}_${submission.activityId}`;

    if (!flowchartScoreMap[activityKey] || normalizedScore > flowchartScoreMap[activityKey]) {
      flowchartScoreMap[activityKey] = normalizedScore;
    }
  }

  for (const key in flowchartScoreMap) {
    flowchartScore += flowchartScoreMap[key];
  }

  // ===== Python编程成绩计算 =====
  const pythonDateFilter = {};
  if (startDate && endDate) {
    pythonDateFilter.submittedAt = { $gte: startDate, $lte: endDate };
  }

  const pythonSubmissions = await PythonSubmission.find({
    studentId: new mongoose.Types.ObjectId(studentId),
    status: 'submitted',
    score: { $exists: true, $ne: null },
    ...pythonDateFilter
  }).select('lessonId activityId score');

  let pythonScore = 0;
  const pythonScoreMap = {}; // key: lessonId_activityId

  for (const submission of pythonSubmissions) {
    const score = Math.min(10, submission.score); // 已是0-10
    const activityKey = `${submission.lessonId}_${submission.activityId}`;

    if (!pythonScoreMap[activityKey] || score > pythonScoreMap[activityKey]) {
      pythonScoreMap[activityKey] = score;
    }
  }

  for (const key in pythonScoreMap) {
    pythonScore += pythonScoreMap[key];
  }

  // ===== 填空题成绩计算 =====
  const fillblankDateFilter = {};
  if (startDate && endDate) {
    fillblankDateFilter.submittedAt = { $gte: startDate, $lte: endDate };
  }

  const fillblankSubmissions = await FillBlankSubmission.find({
    studentId: new mongoose.Types.ObjectId(studentId),
    status: { $in: ['submitted', 'graded'] },
    ...fillblankDateFilter
  }).select('lessonId activityId autoScore grade.bonusScore grade.score status');

  let fillblankScore = 0;
  const fillblankScoreMap = {}; // key: lessonId_activityId

  for (const submission of fillblankSubmissions) {
    // 使用自动评分 + 奖励分
    const autoScore = submission.autoScore || 0;
    const bonusScore = (submission.grade && submission.grade.bonusScore) || 0;
    const totalScore = Math.min(10, autoScore + bonusScore);
    const activityKey = `${submission.lessonId}_${submission.activityId}`;

    if (!fillblankScoreMap[activityKey] || totalScore > fillblankScoreMap[activityKey]) {
      fillblankScoreMap[activityKey] = totalScore;
    }
  }

  for (const key in fillblankScoreMap) {
    fillblankScore += fillblankScoreMap[key];
  }

  // ===== 电子表格成绩计算 =====
  const spreadsheetDateFilter = {};
  if (startDate && endDate) {
    spreadsheetDateFilter.submittedAt = { $gte: startDate, $lte: endDate };
  }

  const spreadsheetSubmissions = await SpreadsheetSubmission.find({
    userId: new mongoose.Types.ObjectId(studentId),
    status: 'graded',
    'grade.score': { $exists: true, $ne: null },
    ...spreadsheetDateFilter
  }).select('lessonId activityId grade.score');

  let spreadsheetScore = 0;
  const spreadsheetScoreMap = {}; // key: lessonId_activityId

  for (const submission of spreadsheetSubmissions) {
    const normalizedScore = Math.min(10, submission.grade.score / 10); // 0-100 -> 0-10
    const activityKey = `${submission.lessonId}_${submission.activityId}`;

    if (!spreadsheetScoreMap[activityKey] || normalizedScore > spreadsheetScoreMap[activityKey]) {
      spreadsheetScoreMap[activityKey] = normalizedScore;
    }
  }

  for (const key in spreadsheetScoreMap) {
    spreadsheetScore += spreadsheetScoreMap[key];
  }

  // 计算综合成绩 - 使用原始分数，不做加权
  const dailyScore = typingScore + assignmentScore + quizScore +
    flowchartScore + pythonScore + fillblankScore + spreadsheetScore;

  // 计算成绩等级和是否及格
  let grade = '';
  let isPassing = false;

  // 根据班级平均分和标准差来计算等级和及格线
  // 需要获取班级所有学生的平日成绩
  const classId = student.classId;
  let classStats = { avg: 0, stdDev: 0, count: 0 };

  if (classId) {
    // 获取班级内其他学生
    const classmates = await User.find({
      classId: classId,
      role: 'student',
      _id: { $ne: new mongoose.Types.ObjectId(studentId) }
    }).select('_id');

    if (classmates.length > 0) {
      // 计算班级其他学生的成绩
      const classmateScores = [];

      for (const classmate of classmates) {
        // 应用相同的学期过滤条件，获取所有类型的成绩数据
        const [cmTypingRecords, cmAssignments, cmQuizzes, cmFlowcharts, cmPythons, cmFillblanks, cmSpreadsheets] = await Promise.all([
          TypingRecord.find({
            userId: classmate._id,
            lessonId: { $ne: null },
            activityId: { $ne: null },
            ...typingDateFilter
          }).select('speed targetSpeed lessonId activityId'),

          AssignmentSubmission.find({
            student: classmate._id,
            status: { $in: ['submitted', 'graded', 'returned'] },
            ...assignmentDateFilter
          }).select('grade aiGrade status'),

          QuizSubmission.find({
            studentId: classmate._id,
            status: 'SUBMITTED',
            activityId: { $exists: true, $ne: null },
            lessonId: { $exists: true, $ne: null },
            ...quizDateFilter
          }).populate({
            path: 'quizId',
            select: 'questions isScaleTest'
          }),

          FlowchartSubmission.find({
            userId: classmate._id,
            status: 'graded',
            'grade.score': { $exists: true, $ne: null },
            ...assignmentDateFilter
          }).select('lessonId activityId grade.score'),

          PythonSubmission.find({
            studentId: classmate._id,
            status: 'submitted',
            score: { $exists: true, $ne: null },
            ...assignmentDateFilter
          }).select('lessonId activityId score'),

          FillBlankSubmission.find({
            studentId: classmate._id,
            status: { $in: ['submitted', 'graded'] },
            ...assignmentDateFilter
          }).select('lessonId activityId autoScore grade.bonusScore'),

          SpreadsheetSubmission.find({
            userId: classmate._id,
            status: 'graded',
            'grade.score': { $exists: true, $ne: null },
            ...assignmentDateFilter
          }).select('lessonId activityId grade.score')
        ]);

        // 计算打字成绩：按活动分组，每个活动只取最高分
        let cmTypingScore = 0;
        const cmTypingScoreMap = {};
        for (const record of cmTypingRecords) {
          const recordScore = Math.min(10, (record.speed / record.targetSpeed) * 10);
          const activityKey = `${record.lessonId}_${record.activityId}`;
          if (!cmTypingScoreMap[activityKey] || recordScore > cmTypingScoreMap[activityKey]) {
            cmTypingScoreMap[activityKey] = recordScore;
          }
        }
        for (const key in cmTypingScoreMap) {
          cmTypingScore += cmTypingScoreMap[key];
        }

        // 计算作业成绩
        let cmAssignmentScore = 0;
        for (const assignment of cmAssignments) {
          if ((assignment.status === 'graded' || assignment.status === 'returned') && assignment.grade && assignment.grade.score !== undefined) {
            cmAssignmentScore += assignment.grade.score;
          } else if (assignment.aiGrade && assignment.aiGrade.score !== undefined) {
            cmAssignmentScore += assignment.aiGrade.score;
          }
        }

        // 计算测验成绩：按活动分组，只取每个活动的最高分
        let cmQuizScore = 0;
        const cmQuizScoreMap = {};
        for (const quiz of cmQuizzes) {
          if (!quiz.quizId) continue;
          if (quiz.quizId.isScaleTest) continue;
          const totalPoints = quiz.answers ? quiz.answers.length : 0;
          if (totalPoints === 0) continue;
          const submissionScore = Math.min(10, (quiz.score / totalPoints) * 10);
          const activityKey = `${quiz.lessonId}_${quiz.activityId}`;
          if (!cmQuizScoreMap[activityKey] || submissionScore > cmQuizScoreMap[activityKey]) {
            cmQuizScoreMap[activityKey] = submissionScore;
          }
        }
        for (const key in cmQuizScoreMap) {
          cmQuizScore += cmQuizScoreMap[key];
        }

        // 计算流程图成绩
        let cmFlowchartScore = 0;
        const cmFlowchartScoreMap = {};
        for (const sub of cmFlowcharts) {
          const normalizedScore = Math.min(10, sub.grade.score);
          const activityKey = `${sub.lessonId}_${sub.activityId}`;
          if (!cmFlowchartScoreMap[activityKey] || normalizedScore > cmFlowchartScoreMap[activityKey]) {
            cmFlowchartScoreMap[activityKey] = normalizedScore;
          }
        }
        for (const key in cmFlowchartScoreMap) {
          cmFlowchartScore += cmFlowchartScoreMap[key];
        }

        // 计算Python成绩
        let cmPythonScore = 0;
        const cmPythonScoreMap = {};
        for (const sub of cmPythons) {
          const score = Math.min(10, sub.score);
          const activityKey = `${sub.lessonId}_${sub.activityId}`;
          if (!cmPythonScoreMap[activityKey] || score > cmPythonScoreMap[activityKey]) {
            cmPythonScoreMap[activityKey] = score;
          }
        }
        for (const key in cmPythonScoreMap) {
          cmPythonScore += cmPythonScoreMap[key];
        }

        // 计算填空题成绩
        let cmFillblankScore = 0;
        const cmFillblankScoreMap = {};
        for (const sub of cmFillblanks) {
          const autoScore = sub.autoScore || 0;
          const bonusScore = (sub.grade && sub.grade.bonusScore) || 0;
          const totalScore = Math.min(10, autoScore + bonusScore);
          const activityKey = `${sub.lessonId}_${sub.activityId}`;
          if (!cmFillblankScoreMap[activityKey] || totalScore > cmFillblankScoreMap[activityKey]) {
            cmFillblankScoreMap[activityKey] = totalScore;
          }
        }
        for (const key in cmFillblankScoreMap) {
          cmFillblankScore += cmFillblankScoreMap[key];
        }

        // 计算电子表格成绩
        let cmSpreadsheetScore = 0;
        const cmSpreadsheetScoreMap = {};
        for (const sub of cmSpreadsheets) {
          const normalizedScore = Math.min(10, sub.grade.score / 10);
          const activityKey = `${sub.lessonId}_${sub.activityId}`;
          if (!cmSpreadsheetScoreMap[activityKey] || normalizedScore > cmSpreadsheetScoreMap[activityKey]) {
            cmSpreadsheetScoreMap[activityKey] = normalizedScore;
          }
        }
        for (const key in cmSpreadsheetScoreMap) {
          cmSpreadsheetScore += cmSpreadsheetScoreMap[key];
        }

        // 计算该同学的总分（包含所有类型）
        const cmTotalScore = cmTypingScore + cmAssignmentScore + cmQuizScore +
          cmFlowchartScore + cmPythonScore + cmFillblankScore + cmSpreadsheetScore;
        classmateScores.push(cmTotalScore);
      }

      // 添加当前学生的成绩
      classmateScores.push(dailyScore);

      // 计算平均值和标准差
      const sum = classmateScores.reduce((a, b) => a + b, 0);
      const avg = sum / classmateScores.length;

      const squaredDifferences = classmateScores.map(score => Math.pow(score - avg, 2));
      const variance = squaredDifferences.reduce((a, b) => a + b, 0) / classmateScores.length;
      const stdDev = Math.sqrt(variance);

      classStats = {
        avg,
        stdDev,
        count: classmateScores.length
      };

      // 根据平均值和标准差设置等级
      if (dailyScore >= avg + 1.5 * stdDev) {
        grade = 'A+';
        isPassing = true;
      } else if (dailyScore >= avg + stdDev) {
        grade = 'A';
        isPassing = true;
      } else if (dailyScore >= avg + 0.5 * stdDev) {
        grade = 'B+';
        isPassing = true;
      } else if (dailyScore >= avg) {
        grade = 'B';
        isPassing = true;
      } else if (dailyScore >= avg - 0.5 * stdDev) {
        grade = 'C+';
        isPassing = true;
      } else if (dailyScore >= avg - stdDev) {
        grade = 'C';
        isPassing = true;
      } else if (dailyScore >= avg - 1.5 * stdDev) {
        grade = 'D';
        isPassing = false;
      } else {
        grade = 'F';
        isPassing = false;
      }
    } else {
      // 如果班级只有当前一名学生，使用固定标准
      if (dailyScore >= 80) {
        grade = 'A';
        isPassing = true;
      } else if (dailyScore >= 70) {
        grade = 'B';
        isPassing = true;
      } else if (dailyScore >= 60) {
        grade = 'C';
        isPassing = true;
      } else {
        grade = 'D';
        isPassing = false;
      }
    }
  } else {
    // 如果学生没有班级，使用固定标准
    if (dailyScore >= 80) {
      grade = 'A';
      isPassing = true;
    } else if (dailyScore >= 70) {
      grade = 'B';
      isPassing = true;
    } else if (dailyScore >= 60) {
      grade = 'C';
      isPassing = true;
    } else {
      grade = 'D';
      isPassing = false;
    }
  }

  return {
    student: {
      id: student._id,
      username: student.username,
      name: student.name
    },
    semester: semester || '全部学期',
    typing: {
      score: Math.round(typingScore * 100) / 100,
      count: Object.keys(typingScoreMap).length,
      details: {
        totalRecords: typingRecords.length,
        activities: Object.keys(typingScoreMap).length,
        records: typingRecords.map(record => ({
          speed: record.speed,
          targetSpeed: record.targetSpeed,
          score: Math.min(10, (record.speed / record.targetSpeed) * 10)
        }))
      }
    },
    assignment: {
      score: Math.round(assignmentScore * 100) / 100,
      count: assignmentSubmissions.filter(s =>
        (s.grade && s.grade.score !== undefined) ||
        (s.aiGrade && s.aiGrade.score !== undefined)).length,
      details: {
        totalSubmissions: assignmentSubmissions.length
      }
    },
    quiz: {
      score: Math.round(quizScore * 100) / 100,
      count: Object.keys(quizScoreMap).length,
      details: {
        totalSubmissions: quizSubmissions.length
      }
    },
    flowchart: {
      score: Math.round(flowchartScore * 100) / 100,
      count: Object.keys(flowchartScoreMap).length,
      details: {
        totalSubmissions: flowchartSubmissions.length
      }
    },
    python: {
      score: Math.round(pythonScore * 100) / 100,
      count: Object.keys(pythonScoreMap).length,
      details: {
        totalSubmissions: pythonSubmissions.length
      }
    },
    fillblank: {
      score: Math.round(fillblankScore * 100) / 100,
      count: Object.keys(fillblankScoreMap).length,
      details: {
        totalSubmissions: fillblankSubmissions.length
      }
    },
    spreadsheet: {
      score: Math.round(spreadsheetScore * 100) / 100,
      count: Object.keys(spreadsheetScoreMap).length,
      details: {
        totalSubmissions: spreadsheetSubmissions.length
      }
    },
    dailyScore: Math.round(dailyScore * 100) / 100,
    grade: grade,
    isPassing: isPassing,
    classStats: classStats
  };
};

exports.calculateStudentDailyScore = async (req, res) => {
  try {
    logger.info('计算学生平日成绩', {
      studentId: req.params.studentId,
      semester: req.query.semester,
      currentUser: req.user.id,
      role: req.user.role
    });

    const { studentId } = req.params;
    const { semester } = req.query;

    // 验证学生ID是否有效
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: '无效的学生ID' });
    }

    // 权限检查：只有教师或者学生本人可以查看成绩
    if (req.user.role !== 'teacher' && req.user.id !== studentId) {
      logger.warn('权限检查失败：学生尝试查看其他学生成绩', {
        currentUser: req.user.id,
        requestedStudent: studentId
      });
      return res.status(403).json({ success: false, message: '没有权限访问此资源' });
    }

    const data = await exports.calculateStudentDailyScoreInternal(studentId, semester);

    res.status(200).json({ success: true, data });

  } catch (error) {
    logger.error('计算学生平日成绩失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '计算学生平日成绩失败', error: error.message });
  }
};

/**
 * 计算班级学生的平日成绩
 */
exports.calculateClassDailyScores = async (req, res) => {
  try {
    logger.info('计算班级学生平日成绩', {
      classId: req.params.classId,
      semester: req.query.semester
    });

    const { classId } = req.params;
    const { semester } = req.query;

    // 验证班级ID是否有效
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ success: false, message: '无效的班级ID' });
    }

    // 解析学期日期范围
    const { startDate, endDate } = semesterUtils.parseSemesterDateRange(semester);

    // 查找班级中的所有学生
    const students = await User.find({
      role: 'student',
      classId: new mongoose.Types.ObjectId(classId)
    }).select('_id username name');

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: '未找到班级学生' });
    }

    const studentIds = students.map(student => student._id);

    // 构建通用日期过滤条件
    const commonDateFilter = {};
    if (startDate && endDate) {
      commonDateFilter.startTime = { $gte: startDate, $lte: endDate };
    }

    const quizDateFilter = {};
    if (startDate && endDate) {
      quizDateFilter.submitTime = { $gte: startDate, $lte: endDate };
    }

    const assignmentDateFilter = {};
    if (startDate && endDate) {
      assignmentDateFilter.submittedAt = { $gte: startDate, $lte: endDate };
    }

    // 批量获取所有数据 (并行执行7个查询)
    const [allTypingRecords, allQuizSubmissions, allAssignmentSubmissions,
      allFlowchartSubmissions, allPythonSubmissions, allFillblankSubmissions, allSpreadsheetSubmissions] = await Promise.all([
        // 获取课程活动关联的打字记录（排除自由练习）
        TypingRecord.find({
          userId: { $in: studentIds },
          lessonId: { $ne: null },
          activityId: { $ne: null },
          ...commonDateFilter
        }).select('userId speed targetSpeed accuracy lessonId activityId'),

        // 获取有活动关联的测验提交记录
        QuizSubmission.find({
          studentId: { $in: studentIds },
          status: 'SUBMITTED',
          activityId: { $exists: true, $ne: null },
          lessonId: { $exists: true, $ne: null },
          ...quizDateFilter
        }).populate({
          path: 'quizId',
          select: 'questions isScaleTest'
        }),

        // 获取所有作业提交
        AssignmentSubmission.find({
          student: { $in: studentIds },
          status: { $in: ['submitted', 'graded', 'returned'] },
          ...assignmentDateFilter
        }).select('student grade aiGrade status'),

        // 获取所有流程图提交
        FlowchartSubmission.find({
          userId: { $in: studentIds },
          status: 'graded',
          'grade.score': { $exists: true, $ne: null },
          ...assignmentDateFilter
        }).select('userId lessonId activityId grade.score'),

        // 获取所有Python提交
        PythonSubmission.find({
          studentId: { $in: studentIds },
          status: 'submitted',
          score: { $exists: true, $ne: null },
          ...assignmentDateFilter
        }).select('studentId lessonId activityId score'),

        // 获取所有填空题提交
        FillBlankSubmission.find({
          studentId: { $in: studentIds },
          status: { $in: ['submitted', 'graded'] },
          ...assignmentDateFilter
        }).select('studentId lessonId activityId autoScore grade.bonusScore'),

        // 获取所有电子表格提交
        SpreadsheetSubmission.find({
          userId: { $in: studentIds },
          status: 'graded',
          'grade.score': { $exists: true, $ne: null },
          ...assignmentDateFilter
        }).select('userId lessonId activityId grade.score')
      ]);

    // 按学生ID分组数据 (内存处理)
    const typingRecordsMap = {};
    allTypingRecords.forEach(record => {
      const sId = record.userId.toString();
      if (!typingRecordsMap[sId]) typingRecordsMap[sId] = [];
      typingRecordsMap[sId].push(record);
    });

    const quizSubmissionsMap = {};
    allQuizSubmissions.forEach(sub => {
      const sId = sub.studentId.toString();
      if (!quizSubmissionsMap[sId]) quizSubmissionsMap[sId] = [];
      quizSubmissionsMap[sId].push(sub);
    });

    const assignmentSubmissionsMap = {};
    allAssignmentSubmissions.forEach(sub => {
      const sId = sub.student.toString();
      if (!assignmentSubmissionsMap[sId]) assignmentSubmissionsMap[sId] = [];
      assignmentSubmissionsMap[sId].push(sub);
    });

    const flowchartSubmissionsMap = {};
    allFlowchartSubmissions.forEach(sub => {
      const sId = sub.userId.toString();
      if (!flowchartSubmissionsMap[sId]) flowchartSubmissionsMap[sId] = [];
      flowchartSubmissionsMap[sId].push(sub);
    });

    const pythonSubmissionsMap = {};
    allPythonSubmissions.forEach(sub => {
      const sId = sub.studentId.toString();
      if (!pythonSubmissionsMap[sId]) pythonSubmissionsMap[sId] = [];
      pythonSubmissionsMap[sId].push(sub);
    });

    const fillblankSubmissionsMap = {};
    allFillblankSubmissions.forEach(sub => {
      const sId = sub.studentId.toString();
      if (!fillblankSubmissionsMap[sId]) fillblankSubmissionsMap[sId] = [];
      fillblankSubmissionsMap[sId].push(sub);
    });

    const spreadsheetSubmissionsMap = {};
    allSpreadsheetSubmissions.forEach(sub => {
      const sId = sub.userId.toString();
      if (!spreadsheetSubmissionsMap[sId]) spreadsheetSubmissionsMap[sId] = [];
      spreadsheetSubmissionsMap[sId].push(sub);
    });

    // 计算所有学生的成绩
    const studentsScores = [];
    let totalScore = 0;

    for (const student of students) {
      const sId = student._id.toString();

      // 从Map中获取该学生的数据
      const typingRecords = typingRecordsMap[sId] || [];
      const quizSubmissions = quizSubmissionsMap[sId] || [];
      const assignmentSubmissions = assignmentSubmissionsMap[sId] || [];
      const flowchartSubmissions = flowchartSubmissionsMap[sId] || [];
      const pythonSubmissions = pythonSubmissionsMap[sId] || [];
      const fillblankSubmissions = fillblankSubmissionsMap[sId] || [];
      const spreadsheetSubmissions = spreadsheetSubmissionsMap[sId] || [];

      // 计算打字成绩：按活动分组，每个活动只取最高分
      let typingScore = 0;
      const typingActivityScoreMap = {};

      for (const record of typingRecords) {
        const recordScore = Math.min(10, (record.speed / record.targetSpeed) * 10);
        const activityKey = `${record.lessonId}_${record.activityId}`;

        if (!typingActivityScoreMap[activityKey] || recordScore > typingActivityScoreMap[activityKey]) {
          typingActivityScoreMap[activityKey] = recordScore;
        }
      }

      for (const key in typingActivityScoreMap) {
        typingScore += typingActivityScoreMap[key];
      }

      // 计算所有quiz的(实际得分/总分*10)的和
      let quizScore = 0;

      // 按活动分组，只取每个活动的最高分
      const quizScoreMap = {};

      for (const submission of quizSubmissions) {
        // 如果没有关联的quiz，跳过
        if (!submission.quizId) continue;

        // 如果是心理量表测验，跳过计分
        if (submission.quizId.isScaleTest) continue;

        // 计算测验总分 (直接使用answers.length)
        const totalPoints = submission.answers ? submission.answers.length : 0;

        // 如果总分为0，跳过此quiz
        if (totalPoints === 0) continue;

        // 计算得分：(实际得分/总分) * 10
        const submissionScore = Math.min(10, (submission.score / totalPoints) * 10);

        // 按活动分组（同一课时同一活动只取最高分）
        const activityKey = `${submission.lessonId}_${submission.activityId}`;

        // 如果是第一次遇到这个活动或得分比之前记录的高，则更新
        if (!quizScoreMap[activityKey] || submissionScore > quizScoreMap[activityKey]) {
          quizScoreMap[activityKey] = submissionScore;
        }
      }

      // 累加所有活动的最高分
      for (const key in quizScoreMap) {
        quizScore += quizScoreMap[key];
      }

      // 计算所有作业分数的和（优先使用教师评分）
      let assignmentScore = 0;

      for (const submission of assignmentSubmissions) {
        let score = null;

        // 优先使用教师评分，如果没有则使用AI评分
        if ((submission.status === 'graded' || submission.status === 'returned') && submission.grade && submission.grade.score !== undefined) {
          score = submission.grade.score;
        } else if (submission.aiGrade && submission.aiGrade.score !== undefined) {
          score = submission.aiGrade.score;
        }

        if (score !== null) {
          assignmentScore += score;
        }
      }

      // 计算流程图成绩
      let flowchartScore = 0;
      const flowchartActivityScoreMap = {};

      for (const submission of flowchartSubmissions) {
        const normalizedScore = Math.min(10, submission.grade.score); // 已经是0-10
        const activityKey = `${submission.lessonId}_${submission.activityId}`;

        if (!flowchartActivityScoreMap[activityKey] || normalizedScore > flowchartActivityScoreMap[activityKey]) {
          flowchartActivityScoreMap[activityKey] = normalizedScore;
        }
      }

      for (const key in flowchartActivityScoreMap) {
        flowchartScore += flowchartActivityScoreMap[key];
      }

      // 计算Python成绩
      let pythonScore = 0;
      const pythonActivityScoreMap = {};

      for (const submission of pythonSubmissions) {
        const score = Math.min(10, submission.score);
        const activityKey = `${submission.lessonId}_${submission.activityId}`;

        if (!pythonActivityScoreMap[activityKey] || score > pythonActivityScoreMap[activityKey]) {
          pythonActivityScoreMap[activityKey] = score;
        }
      }

      for (const key in pythonActivityScoreMap) {
        pythonScore += pythonActivityScoreMap[key];
      }

      // 计算填空题成绩
      let fillblankScore = 0;
      const fillblankActivityScoreMap = {};

      for (const submission of fillblankSubmissions) {
        const autoScore = submission.autoScore || 0;
        const bonusScore = (submission.grade && submission.grade.bonusScore) || 0;
        const totalScore = Math.min(10, autoScore + bonusScore);
        const activityKey = `${submission.lessonId}_${submission.activityId}`;

        if (!fillblankActivityScoreMap[activityKey] || totalScore > fillblankActivityScoreMap[activityKey]) {
          fillblankActivityScoreMap[activityKey] = totalScore;
        }
      }

      for (const key in fillblankActivityScoreMap) {
        fillblankScore += fillblankActivityScoreMap[key];
      }

      // 计算电子表格成绩
      let spreadsheetScore = 0;
      const spreadsheetActivityScoreMap = {};

      for (const submission of spreadsheetSubmissions) {
        const normalizedScore = Math.min(10, submission.grade.score / 10);
        const activityKey = `${submission.lessonId}_${submission.activityId}`;

        if (!spreadsheetActivityScoreMap[activityKey] || normalizedScore > spreadsheetActivityScoreMap[activityKey]) {
          spreadsheetActivityScoreMap[activityKey] = normalizedScore;
        }
      }

      for (const key in spreadsheetActivityScoreMap) {
        spreadsheetScore += spreadsheetActivityScoreMap[key];
      }

      // 计算综合成绩 - 使用原始分数，不做加权
      const dailyScore = typingScore + assignmentScore + quizScore +
        flowchartScore + pythonScore + fillblankScore + spreadsheetScore;
      totalScore += dailyScore;

      studentsScores.push({
        student: {
          id: student._id,
          username: student.username,
          name: student.name
        },
        typing: {
          score: Math.round(typingScore * 100) / 100,
          count: Object.keys(typingActivityScoreMap).length
        },
        assignment: {
          score: Math.round(assignmentScore * 100) / 100,
          count: assignmentSubmissions.filter(s =>
            (s.grade && s.grade.score !== undefined) ||
            (s.aiGrade && s.aiGrade.score !== undefined)).length
        },
        quiz: {
          score: Math.round(quizScore * 100) / 100,
          count: Object.keys(quizScoreMap).length
        },
        flowchart: {
          score: Math.round(flowchartScore * 100) / 100,
          count: Object.keys(flowchartActivityScoreMap).length
        },
        python: {
          score: Math.round(pythonScore * 100) / 100,
          count: Object.keys(pythonActivityScoreMap).length
        },
        fillblank: {
          score: Math.round(fillblankScore * 100) / 100,
          count: Object.keys(fillblankActivityScoreMap).length
        },
        spreadsheet: {
          score: Math.round(spreadsheetScore * 100) / 100,
          count: Object.keys(spreadsheetActivityScoreMap).length
        },
        dailyScore: Math.round(dailyScore * 100) / 100
      });
    }

    // 计算班级平均分和标准差
    const classAvg = totalScore / students.length;

    const squaredDifferences = studentsScores.map(student =>
      Math.pow(student.dailyScore - classAvg, 2));
    const variance = squaredDifferences.reduce((a, b) => a + b, 0) / students.length;
    const classStdDev = Math.sqrt(variance);

    // 计算每个学生的等级和是否及格
    studentsScores.forEach(studentScore => {
      let grade = '';
      let isPassing = false;

      // 根据平均值和标准差设置等级
      if (studentScore.dailyScore >= classAvg + 1.5 * classStdDev) {
        grade = 'A+';
        isPassing = true;
      } else if (studentScore.dailyScore >= classAvg + classStdDev) {
        grade = 'A';
        isPassing = true;
      } else if (studentScore.dailyScore >= classAvg + 0.5 * classStdDev) {
        grade = 'B+';
        isPassing = true;
      } else if (studentScore.dailyScore >= classAvg) {
        grade = 'B';
        isPassing = true;
      } else if (studentScore.dailyScore >= classAvg - 0.5 * classStdDev) {
        grade = 'C+';
        isPassing = true;
      } else if (studentScore.dailyScore >= classAvg - classStdDev) {
        grade = 'C';
        isPassing = true;
      } else if (studentScore.dailyScore >= classAvg - 1.5 * classStdDev) {
        grade = 'D';
        isPassing = false;
      } else {
        grade = 'F';
        isPassing = false;
      }

      studentScore.grade = grade;
      studentScore.isPassing = isPassing;
    });

    // 排序：按总分从高到低
    studentsScores.sort((a, b) => b.dailyScore - a.dailyScore);

    // 添加排名
    studentsScores.forEach((score, index) => {
      score.rank = index + 1;
    });

    const classStats = {
      totalStudents: students.length,
      avgScore: Math.round(classAvg * 100) / 100,
      stdDev: Math.round(classStdDev * 100) / 100,
      passingCount: studentsScores.filter(s => s.isPassing).length,
      grades: {
        'A+': studentsScores.filter(s => s.grade === 'A+').length,
        'A': studentsScores.filter(s => s.grade === 'A').length,
        'B+': studentsScores.filter(s => s.grade === 'B+').length,
        'B': studentsScores.filter(s => s.grade === 'B').length,
        'C+': studentsScores.filter(s => s.grade === 'C+').length,
        'C': studentsScores.filter(s => s.grade === 'C').length,
        'D': studentsScores.filter(s => s.grade === 'D').length,
        'F': studentsScores.filter(s => s.grade === 'F').length
      },
      semester: semester || '全部学期'
    };

    res.status(200).json({
      success: true,
      data: {
        classStats: classStats,
        studentsScores: studentsScores
      }
    });
  } catch (error) {
    logger.error('计算班级学生平日成绩失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '计算班级学生平日成绩失败', error: error.message });
  }
};

/**
 * 计算一组学生的平日成绩 (内部复用逻辑) - 供 ExamController 使用
 * @param {Array<ObjectId>} studentIds 
 * @param {String} semester 
 * @returns {Array} studentsScores [{ studentId, dailyScore, grade, ... }]
 */
exports.calculateDailyScoresForStudents = async (studentIds, semester) => {
  // 引入依赖 (Assuming they are available in module scope, otherwise we rely on them being there)
  // Common models: TypingRecord, QuizSubmission, AssignmentSubmission, etc.
  const semesterUtils = require('../utils/semesterUtils');

  // 解析学期日期范围
  const { startDate, endDate } = semesterUtils.parseSemesterDateRange(semester);

  // 构建通用日期过滤条件
  const commonDateFilter = {};
  if (startDate && endDate) {
    commonDateFilter.startTime = { $gte: startDate, $lte: endDate };
  }

  const quizDateFilter = {};
  if (startDate && endDate) {
    quizDateFilter.submitTime = { $gte: startDate, $lte: endDate };
  }

  const assignmentDateFilter = {};
  if (startDate && endDate) {
    assignmentDateFilter.submittedAt = { $gte: startDate, $lte: endDate };
  }

  // 并行获取所有类型的数据
  const [
    allTypingRecords,
    allQuizSubmissions,
    allAssignmentSubmissions,
    allFlowchartSubmissions,
    allPythonSubmissions,
    allFillBlankSubmissions,
    allSpreadsheetSubmissions
  ] = await Promise.all([
    require('../models/TypingRecord').find({
      userId: { $in: studentIds },
      ...commonDateFilter
    }).select('userId lessonId activityId speed targetSpeed'),

    require('../models/QuizSubmission').find({
      studentId: { $in: studentIds },
      status: 'SUBMITTED',
      ...quizDateFilter
    }).populate('quizId', 'isScaleTest')
      .select('studentId lessonId activityId score answers quizId'),

    require('../models/AssignmentSubmission').find({
      student: { $in: studentIds },
      status: { $in: ['graded', 'returned'] },
      ...assignmentDateFilter
    }).select('student lesson activity grade aiGrade status'),

    require('../models/FlowchartSubmission').find({
      userId: { $in: studentIds },
      status: 'graded',
      'grade.score': { $exists: true, $ne: null },
      ...assignmentDateFilter
    }).select('userId lessonId activityId grade.score'),

    require('../models/PythonSubmission').find({
      studentId: { $in: studentIds },
      status: 'submitted',
      ...assignmentDateFilter
    }).select('studentId lessonId activityId score'),

    require('../models/FillBlankSubmission').find({
      studentId: { $in: studentIds },
      status: { $in: ['submitted', 'graded'] },
      ...assignmentDateFilter
    }).select('studentId lessonId activityId autoScore grade.bonusScore'),

    require('../models/SpreadsheetSubmission').find({
      userId: { $in: studentIds },
      status: 'graded',
      'grade.score': { $exists: true, $ne: null },
      ...assignmentDateFilter
    }).select('userId lessonId activityId grade.score')
  ]);

  // 按学生ID分组数据
  const typingRecordsMap = {};
  allTypingRecords.forEach(record => {
    const sId = record.userId.toString();
    if (!typingRecordsMap[sId]) typingRecordsMap[sId] = [];
    typingRecordsMap[sId].push(record);
  });

  const quizSubmissionsMap = {};
  allQuizSubmissions.forEach(sub => {
    const sId = sub.studentId.toString();
    if (!quizSubmissionsMap[sId]) quizSubmissionsMap[sId] = [];
    quizSubmissionsMap[sId].push(sub);
  });

  const assignmentSubmissionsMap = {};
  allAssignmentSubmissions.forEach(sub => {
    const sId = sub.student.toString();
    if (!assignmentSubmissionsMap[sId]) assignmentSubmissionsMap[sId] = [];
    assignmentSubmissionsMap[sId].push(sub);
  });

  const flowchartSubmissionsMap = {};
  allFlowchartSubmissions.forEach(sub => {
    const sId = sub.userId.toString();
    if (!flowchartSubmissionsMap[sId]) flowchartSubmissionsMap[sId] = [];
    flowchartSubmissionsMap[sId].push(sub);
  });

  const pythonSubmissionsMap = {};
  allPythonSubmissions.forEach(sub => {
    const sId = sub.studentId.toString();
    if (!pythonSubmissionsMap[sId]) pythonSubmissionsMap[sId] = [];
    pythonSubmissionsMap[sId].push(sub);
  });

  const fillBlankSubmissionsMap = {};
  allFillBlankSubmissions.forEach(sub => {
    const sId = sub.studentId.toString();
    if (!fillBlankSubmissionsMap[sId]) fillBlankSubmissionsMap[sId] = [];
    fillBlankSubmissionsMap[sId].push(sub);
  });

  const spreadsheetSubmissionsMap = {};
  allSpreadsheetSubmissions.forEach(sub => {
    const sId = sub.userId.toString();
    if (!spreadsheetSubmissionsMap[sId]) spreadsheetSubmissionsMap[sId] = [];
    spreadsheetSubmissionsMap[sId].push(sub);
  });

  const studentsScores = [];

  for (const studentIdObj of studentIds) {
    const studentId = studentIdObj.toString();

    // 1. Typing
    const typingRecords = typingRecordsMap[studentId] || [];
    let typingScore = 0;
    const typingActivityScoreMap = {};
    for (const record of typingRecords) {
      const s = Math.min(10, (record.speed / record.targetSpeed) * 10);
      const key = `${record.lessonId}_${record.activityId}`;
      if (!typingActivityScoreMap[key] || s > typingActivityScoreMap[key]) {
        typingActivityScoreMap[key] = s;
      }
    }
    for (const k in typingActivityScoreMap) typingScore += typingActivityScoreMap[k];

    // 2. Quiz
    const quizSubmissions = quizSubmissionsMap[studentId] || [];
    let quizScore = 0;
    const quizScoreMap = {};
    for (const sub of quizSubmissions) {
      if (!sub.quizId || sub.quizId.isScaleTest) continue; // Ensure quizId is populated
      const total = sub.answers ? sub.answers.length : 0;
      if (total === 0) continue;
      const s = Math.min(10, (sub.score / total) * 10);
      const key = `${sub.lessonId}_${sub.activityId}`;
      if (!quizScoreMap[key] || s > quizScoreMap[key]) quizScoreMap[key] = s;
    }
    for (const k in quizScoreMap) quizScore += quizScoreMap[k];

    // 3. Assignment
    const assignmentSubmissions = assignmentSubmissionsMap[studentId] || [];
    let assignmentScore = 0;
    for (const sub of assignmentSubmissions) {
      let s = null;
      if ((sub.status === 'graded' || sub.status === 'returned') && sub.grade?.score !== undefined) {
        s = sub.grade.score;
      } else if (sub.aiGrade?.score !== undefined) {
        s = sub.aiGrade.score;
      }
      if (s !== null) assignmentScore += s;
    }

    // 4. Flowchart
    const flowchartSubmissions = flowchartSubmissionsMap[studentId] || [];
    let flowchartScore = 0;
    const flowMap = {};
    for (const sub of flowchartSubmissions) {
      const s = Math.min(10, sub.grade.score);
      const key = `${sub.lessonId}_${sub.activityId}`;
      if (!flowMap[key] || s > flowMap[key]) flowMap[key] = s;
    }
    for (const k in flowMap) flowchartScore += flowMap[k];

    // 5. Python
    const pythonSubmissions = pythonSubmissionsMap[studentId] || [];
    let pythonScore = 0;
    const pyMap = {};
    for (const sub of pythonSubmissions) {
      const s = Math.min(10, sub.score || 0);
      const key = `${sub.lessonId}_${sub.activityId}`;
      if (!pyMap[key] || s > pyMap[key]) pyMap[key] = s;
    }
    for (const k in pyMap) pythonScore += pyMap[k];

    // 6. FillBlank
    const fillSubmissions = fillBlankSubmissionsMap[studentId] || [];
    let fillblankScore = 0;
    const fillMap = {};
    for (const sub of fillSubmissions) {
      const auto = sub.autoScore || 0;
      const bonus = sub.grade?.bonusScore || 0;
      const s = Math.min(10, auto + bonus);
      const key = `${sub.lessonId}_${sub.activityId}`;
      if (!fillMap[key] || s > fillMap[key]) fillMap[key] = s;
    }
    for (const k in fillMap) fillblankScore += fillMap[k];

    // 7. Spreadsheet
    const sheetSubmissions = spreadsheetSubmissionsMap[studentId] || [];
    let spreadsheetScore = 0;
    const sheetMap = {};
    for (const sub of sheetSubmissions) {
      const s = Math.min(10, (sub.grade.score || 0) / 10);
      const key = `${sub.lessonId}_${sub.activityId}`;
      if (!sheetMap[key] || s > sheetMap[key]) sheetMap[key] = s;
    }
    for (const k in sheetMap) spreadsheetScore += sheetMap[k];

    const dailyScore = quizScore + typingScore + assignmentScore + flowchartScore + pythonScore + fillblankScore + spreadsheetScore;

    studentsScores.push({
      studentId: studentId,
      dailyScore: Math.round(dailyScore * 100) / 100
    });
  }

  // 计算统计数据以分配等级
  const count = studentsScores.length || 1;
  const classAvg = studentsScores.reduce((sum, s) => sum + s.dailyScore, 0) / count;

  const variance = studentsScores.reduce((sum, s) => sum + Math.pow(s.dailyScore - classAvg, 2), 0) / count;
  const classStdDev = Math.sqrt(variance);

  // 分配等级
  studentsScores.forEach(studentScore => {
    let grade = '';
    const s = studentScore.dailyScore;

    if (s >= classAvg + 1.5 * classStdDev) { grade = 'A+'; }
    else if (s >= classAvg + classStdDev) { grade = 'A'; }
    else if (s >= classAvg + 0.5 * classStdDev) { grade = 'B+'; }
    else if (s >= classAvg) { grade = 'B'; }
    else if (s >= classAvg - 0.5 * classStdDev) { grade = 'C+'; }
    else if (s >= classAvg - classStdDev) { grade = 'C'; }
    else if (s >= classAvg - 1.5 * classStdDev) { grade = 'D'; }
    else { grade = 'F'; }

    studentScore.grade = grade;
  });

  return studentsScores;
};