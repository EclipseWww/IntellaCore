const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const initializationController = require('../controllers/initializationController');

router.get('/initialization', initializationController.status);
router.post('/initialization', initializationController.initialize);

// 账号仅由管理员创建或由教师/管理员导入，禁止公开注册。
router.post('/register', (req, res) => res.status(403).json({ message: '不提供公开注册，请联系教师或管理员' }));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - 认证
 *     summary: 用户登录
 *     description: 验证用户凭据并返回JWT令牌
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: 用户名
 *               password:
 *                 type: string
 *                 description: 密码
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT令牌
 *                 user:
 *                   type: object
 *                   description: 用户信息
 *       401:
 *         description: 用户名或密码错误
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags:
 *       - 认证
 *     summary: 获取当前用户信息
 *     description: 根据JWT令牌返回当前登录用户的详细信息
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回用户信息
 *       401:
 *         description: 未授权访问
 */
router.get('/me', auth, authController.getCurrentUser);

/**
 * @swagger
 * /auth/validate-token:
 *   get:
 *     tags:
 *       - 认证
 *     summary: 验证令牌有效性
 *     description: 验证JWT令牌是否有效
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 令牌有效
 *       401:
 *         description: 令牌无效或已过期
 */
router.get('/validate-token', auth, authController.validateToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags:
 *       - 认证
 *     summary: 用户登出
 *     description: 清理学生会话，教师直接返回成功
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 登出成功
 *       401:
 *         description: 未授权访问
 */
router.post('/logout', auth, authController.logout);

// 注意：密码恢复功能已移至管理员界面，这些路由已被移除

/**
 * @swagger
 * /auth/update-seat:
 *   post:
 *     tags:
 *       - 认证
 *     summary: 更新座位号
 *     description: 更新学生座位号
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - seatNumber
 *             properties:
 *               seatNumber:
 *                 type: string
 *                 description: 新座位号
 *     responses:
 *       200:
 *         description: 座位号更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 */
router.post('/update-seat', auth, authController.updateSeatNumber);

module.exports = router;
