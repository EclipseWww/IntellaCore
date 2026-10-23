const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// 所有路由都需要教师权限
router.use(auth, roleCheck(['teacher']));

/**
 * @swagger
 * /api/review/pending:
 *   get:
 *     summary: 获取待审核消息列表
 *     tags: [消息审核]
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
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: 排序方向
 *     responses:
 *       200:
 *         description: 成功返回待审核消息列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       content:
 *                         type: string
 *                       sender:
 *                         type: object
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         enum: [pending, approved, rejected]
 *                 total:
 *                   type: integer
 *                   description: 待审核消息总数
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       500:
 *         description: 服务器错误
 */
router.get('/pending', reviewController.getPendingMessages);

// 批量审核（教师）优先放在参数路由前，避免被":messageId"误匹配
router.post('/bulk', reviewController.bulkReviewMessages);

/**
 * @swagger
 * /api/review/{messageId}:
 *   post:
 *     summary: 审核消息
 *     tags: [消息审核]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: 消息ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: 审核操作（批准或拒绝）
 *               reason:
 *                 type: string
 *                 description: 拒绝原因（拒绝时可选）
 *               feedback:
 *                 type: string
 *                 description: 教师反馈
 *     responses:
 *       200:
 *         description: 成功审核消息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 reviewedMessage:
 *                   type: object
 *       400:
 *         description: 无效请求
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       404:
 *         description: 消息不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/:messageId([0-9a-fA-F]{24})', reviewController.reviewMessage);

/**
 * @swagger
 * /api/review/history:
 *   get:
 *     summary: 获取审核历史记录
 *     tags: [消息审核]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [approved, rejected]
 *         description: 按状态筛选
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 开始日期
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 结束日期
 *     responses:
 *       200:
 *         description: 成功返回审核历史记录
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reviews:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       messageId:
 *                         type: string
 *                       content:
 *                         type: string
 *                       action:
 *                         type: string
 *                         enum: [approve, reject]
 *                       reviewer:
 *                         type: object
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       reason:
 *                         type: string
 *                 total:
 *                   type: integer
 *                   description: 历史记录总数
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       500:
 *         description: 服务器错误
 */
router.get('/history', reviewController.getReviewHistory);

/**
 * @swagger
 * /api/review/stats:
 *   get:
 *     summary: 获取审核统计数据
 *     tags: [消息审核]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *         description: 时间范围
 *     responses:
 *       200:
 *         description: 成功返回审核统计数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalReviewed:
 *                   type: integer
 *                   description: 审核总数
 *                 approved:
 *                   type: integer
 *                   description: 批准数量
 *                 rejected:
 *                   type: integer
 *                   description: 拒绝数量
 *                 pending:
 *                   type: integer
 *                   description: 待审核数量
 *                 timeDistribution:
 *                   type: object
 *                   description: 不同时间段的审核数量
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       500:
 *         description: 服务器错误
 */
router.get('/stats', reviewController.getReviewStats);

module.exports = router; 