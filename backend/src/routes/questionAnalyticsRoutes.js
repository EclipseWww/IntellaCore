const express = require('express');
const router = express.Router();
const questionAnalyticsController = require('../controllers/questionAnalyticsController');
const auth = require('../middleware/auth');

/**
 * @swagger
 * /api/question-analytics/questions:
 *   get:
 *     summary: 获取所有题目的分析数据列表
 *     tags: [题目分析]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: 返回的最大记录数
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *         description: 跳过的记录数（用于分页）
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [difficulty, correctRate, attemptCount, responseTime]
 *         description: 排序字段
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: 排序方向
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [mcq, essay, coding, matching]
 *         description: 题目类型过滤
 *     responses:
 *       200:
 *         description: 成功返回题目分析数据列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       content:
 *                         type: string
 *                       type:
 *                         type: string
 *                       correctRate:
 *                         type: number
 *                       attemptCount:
 *                         type: integer
 *                       averageResponseTime:
 *                         type: number
 *                 total:
 *                   type: integer
 *                   description: 总记录数
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get(
  '/questions',
  auth,
  questionAnalyticsController.getAllQuestionsAnalytics
);

/**
 * @swagger
 * /api/question-analytics/questions/{questionId}:
 *   get:
 *     summary: 获取单个题目的详细分析数据
 *     tags: [题目分析]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 题目ID
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [day, week, month, year, all]
 *         description: 时间范围筛选
 *     responses:
 *       200:
 *         description: 成功返回题目详细分析数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 content:
 *                   type: string
 *                 type:
 *                   type: string
 *                 correctRate:
 *                   type: number
 *                 attemptCount:
 *                   type: integer
 *                 averageResponseTime:
 *                   type: number
 *                 timeDistribution:
 *                   type: object
 *                   description: 不同时间段的统计数据
 *                 optionAnalysis:
 *                   type: array
 *                   description: 选项分析（针对选择题）
 *                   items:
 *                     type: object
 *                 commonMistakes:
 *                   type: array
 *                   description: 常见错误（针对编程和填空题）
 *                   items:
 *                     type: object
 *       401:
 *         description: 未授权
 *       404:
 *         description: 题目不存在
 *       500:
 *         description: 服务器错误
 */
router.get(
  '/questions/:questionId',
  auth,
  questionAnalyticsController.getQuestionAnalytics
);

module.exports = router;
