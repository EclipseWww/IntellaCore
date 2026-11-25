const express = require('express');
const router = express.Router();
const achievementController = require('../controllers/achievementController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

/**
 * @swagger
 * tags:
 *   name: Achievements
 *   description: 成就与积分管理
 */

/**
 * @swagger
 * /api/achievements:
 *   get:
 *     summary: 获取学生的所有成就
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *       401:
 *         description: 未授权
 */
router.get('/', auth, achievementController.getStudentAchievements);

/**
 * @swagger
 * /api/achievements/stats:
 *   get:
 *     tags: [Achievements]
 *     summary: 获取学生的统计数据
 *     description: 获取当前登录学生的学习统计数据
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回学生的统计数据
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 未找到统计数据
 */
router.get('/stats', auth, achievementController.getStudentStats);

/**
 * @swagger
 * /api/achievements/points/balance:
 *   get:
 *     summary: 获取学生的积分余额
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *       401:
 *         description: 未授权
 */
router.get('/points/balance', auth, achievementController.getPointBalance);

/**
 * @swagger
 * /api/achievements/points/transactions:
 *   get:
 *     summary: 获取学生的积分交易记录
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页记录数
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 跳过记录数
 *     responses:
 *       200:
 *         description: 获取成功
 *       401:
 *         description: 未授权
 */
router.get('/points/transactions', auth, achievementController.getPointTransactions);

/**
 * @swagger
 * /api/achievements/points/add:
 *   post:
 *     summary: 为学生添加积分（管理员功能）
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentId
 *               - amount
 *             properties:
 *               studentId:
 *                 type: string
 *               amount:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: 添加成功
 *       400:
 *         description: 请求错误
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 */
router.post('/points/add', auth, roleCheck(['admin', 'teacher']), achievementController.addPoints);

/**
 * @swagger
 * /api/achievements/admin/student-points:
 *   get:
 *     summary: 获取所有学生积分余额（管理员功能）
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *         description: 按学生ID筛选
 *     responses:
 *       200:
 *         description: 获取成功
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 */
router.get('/admin/student-points', auth, roleCheck(['admin', 'teacher']), achievementController.getStudentsPointBalance);

/**
 * @swagger
 * /api/achievements/admin/student/{studentId}/transactions:
 *   get:
 *     summary: 获取特定学生的积分交易记录（管理员功能）
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 学生ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页记录数
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 跳过记录数
 *     responses:
 *       200:
 *         description: 获取成功
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 */
router.get('/admin/student/:studentId/transactions', auth, roleCheck(['admin', 'teacher']), achievementController.getStudentPointTransactions);

module.exports = router;
