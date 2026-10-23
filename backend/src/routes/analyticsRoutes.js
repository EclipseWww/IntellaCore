const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const quizAnalyticsController = require('../controllers/quizAnalyticsController');
const analyticsController = require('../controllers/analyticsController');

/**
 * @swagger
 * /api/analytics/quizzes/{quizId}:
 *   get:
 *     summary: 获取测验分析数据
 *     tags: [数据分析]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: 测验ID
 *     responses:
 *       200:
 *         description: 成功返回测验统计分析数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 averageScore:
 *                   type: number
 *                   description: 平均分数
 *                 completionRate:
 *                   type: number
 *                   description: 完成率
 *                 submissionCount:
 *                   type: integer
 *                   description: 提交数量
 *                 scoreDistribution:
 *                   type: object
 *                   description: 分数分布
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       404:
 *         description: 未找到测验
 *       500:
 *         description: 服务器错误
 */
router
  .route('/quizzes/:quizId')
  .get(auth, roleCheck(['teacher']), quizAnalyticsController.getQuizAnalytics);

/**
 * @swagger
 * /api/analytics/questions/{questionId}:
 *   get:
 *     summary: 获取问题分析数据
 *     tags: [数据分析]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 问题ID
 *     responses:
 *       200:
 *         description: 成功返回问题分析数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 correctRate:
 *                   type: number
 *                   description: 正确率
 *                 attemptCount:
 *                   type: integer
 *                   description: 尝试次数
 *                 averageResponseTime:
 *                   type: number
 *                   description: 平均响应时间（秒）
 *                 optionDistribution:
 *                   type: object
 *                   description: 选项分布（针对选择题）
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       404:
 *         description: 未找到问题
 *       500:
 *         description: 服务器错误
 */
router
  .route('/questions/:questionId')
  .get(auth, roleCheck(['teacher']), quizAnalyticsController.getQuestionAnalytics);

/**
 * @swagger
 * /api/analytics/scales/{quizId}:
 *   get:
 *     summary: 获取心理量表分析数据
 *     tags: [数据分析]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: 量表测验ID
 *     responses:
 *       200:
 *         description: 成功返回心理量表分析数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dimensions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       average:
 *                         type: number
 *                       distribution:
 *                         type: object
 *                 participantCount:
 *                   type: integer
 *                   description: 参与人数
 *                 completionRate:
 *                   type: number
 *                   description: 完成率
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       404:
 *         description: 未找到量表
 *       500:
 *         description: 服务器错误
 */
router
  .route('/scales/:quizId')
  .get(auth, roleCheck(['teacher']), quizAnalyticsController.getScaleAnalytics);

/**
 * @swagger
 * /api/analytics/student/{studentId}/typing:
 *   get:
 *     summary: 获取学生打字记录统计
 *     tags: [数据分析]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 学生ID
 *     responses:
 *       200:
 *         description: 成功返回学生打字记录统计
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRecords:
 *                   type: integer
 *                   description: 总记录数
 *                 recentRecords:
 *                   type: integer
 *                   description: 最近30天记录数
 *                 averageSpeed:
 *                   type: number
 *                   description: 平均速度（字/分钟）
 *                 averageAccuracy:
 *                   type: number
 *                   description: 平均准确率（%）
 *                 totalPassedCount:
 *                   type: integer
 *                   description: 总达标次数
 *                 dailyStats:
 *                   type: array
 *                   description: 每日统计
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       404:
 *         description: 未找到学生
 *       500:
 *         description: 服务器错误
 */
router
  .route('/student/:studentId/typing')
  .get(auth, roleCheck(['teacher']), analyticsController.getStudentTypingStats);

/**
 * @swagger
 * /api/analytics/student/{studentId}/quizzes:
 *   get:
 *     summary: 获取学生测验提交统计
 *     tags: [数据分析]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 学生ID
 *     responses:
 *       200:
 *         description: 成功返回学生测验提交统计
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalSubmissions:
 *                   type: integer
 *                   description: 总提交数
 *                 recentSubmissions:
 *                   type: integer
 *                   description: 最近30天提交数
 *                 averageScore:
 *                   type: number
 *                   description: 平均分数
 *                 dailyStats:
 *                   type: array
 *                   description: 每日统计
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       404:
 *         description: 未找到学生
 *       500:
 *         description: 服务器错误
 */
router
  .route('/student/:studentId/quizzes')
  .get(auth, roleCheck(['teacher']), analyticsController.getStudentQuizStats);

/**
 * @swagger
 * /api/analytics/student/{studentId}/assignments:
 *   get:
 *     summary: 获取学生作业提交统计
 *     tags: [数据分析]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 学生ID
 *     responses:
 *       200:
 *         description: 成功返回学生作业提交统计
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalSubmissions:
 *                   type: integer
 *                   description: 总提交数
 *                 recentSubmissions:
 *                   type: integer
 *                   description: 最近30天提交数
 *                 averageScore:
 *                   type: number
 *                   description: 平均分数
 *                 dailyStats:
 *                   type: array
 *                   description: 每日统计
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       404:
 *         description: 未找到学生
 *       500:
 *         description: 服务器错误
 */
router
  .route('/student/:studentId/assignments')
  .get(auth, roleCheck(['teacher']), analyticsController.getStudentAssignmentStats);

/**
 * @swagger
 * /api/analytics/student/{studentId}/learning:
 *   get:
 *     summary: 获取学生综合学习统计
 *     tags: [数据分析]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 学生ID
 *     responses:
 *       200:
 *         description: 成功返回学生综合学习统计
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 student:
 *                   type: object
 *                   description: 学生信息
 *                 typing:
 *                   type: object
 *                   description: 打字统计
 *                 quiz:
 *                   type: object
 *                   description: 测验统计
 *                 assignment:
 *                   type: object
 *                   description: 作业统计
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       404:
 *         description: 未找到学生
 *       500:
 *         description: 服务器错误
 */
router
  .route('/student/:studentId/learning')
  .get(auth, roleCheck(['teacher']), analyticsController.getStudentLearningStats);

/**
 * @swagger
 * /api/analytics/class/{classId}/learning:
 *   get:
 *     summary: 获取班级学生的学习统计
 *     tags: [数据分析]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: 班级ID
 *     responses:
 *       200:
 *         description: 成功返回班级学习统计
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   student:
 *                     type: object
 *                     description: 学生信息
 *                   typing:
 *                     type: object
 *                     description: 打字统计
 *                   quiz:
 *                     type: object
 *                     description: 测验统计
 *                   assignment:
 *                     type: object
 *                     description: 作业统计
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       404:
 *         description: 未找到班级或班级中没有学生
 *       500:
 *         description: 服务器错误
 */
router
  .route('/class/:classId/learning')
  .get(auth, roleCheck(['teacher']), analyticsController.getClassLearningStats);

/**
 * @swagger
 * /api/analytics/student/{studentId}/daily-score:
 *   get:
 *     summary: 计算学生平日成绩
 *     tags: [数据分析]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 学生ID
 *     responses:
 *       200:
 *         description: 成功返回学生平日成绩
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: 操作是否成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     student:
 *                       type: object
 *                     typing:
 *                       type: object
 *                     assignment:
 *                       type: object
 *                     quiz:
 *                       type: object
 *                     dailyScore:
 *                       type: number
 *                       description: 平日成绩
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 未找到学生
 *       500:
 *         description: 服务器错误
 */
router
  .route('/student/:studentId/daily-score')
  .get(auth, analyticsController.calculateStudentDailyScore);

/**
 * @swagger
 * /api/analytics/class/{classId}/daily-scores:
 *   get:
 *     summary: 计算班级学生平日成绩
 *     tags: [数据分析]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: 班级ID
 *     responses:
 *       200:
 *         description: 成功返回班级学生平日成绩
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: 操作是否成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     classStats:
 *                       type: object
 *                       description: 班级整体统计
 *                     students:
 *                       type: array
 *                       description: 班级学生平日成绩列表
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       404:
 *         description: 未找到班级学生
 *       500:
 *         description: 服务器错误
 */
router
  .route('/class/:classId/daily-scores')
  .get(auth, roleCheck(['teacher']), analyticsController.calculateClassDailyScores);

module.exports = router; 