const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const auth = require('../middleware/auth');

/**
 * @swagger
 * /settings:
 *   get:
 *     tags:
 *       - 系统管理
 *       - 设置
 *     summary: 获取所有系统设置
 *     description: 获取所有可用的系统设置
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回系统设置
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   key:
 *                     type: string
 *                     description: 设置键名
 *                   value:
 *                     type: string
 *                     description: 设置值
 *                   description:
 *                     type: string
 *                     description: 设置描述
 *       401:
 *         description: 未授权访问
 */
router.get('/', auth, settingController.getAllSettings);

/**
 * @swagger
 * /settings/system-stats:
 *   get:
 *     tags:
 *       - 系统管理
 *       - 设置
 *     summary: 获取系统统计信息
 *     description: 获取系统的统计信息，包括用户数量、课程数量等，仅限管理员和教师访问
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回系统统计信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: number
 *                   description: 总用户数
 *                 totalStudents:
 *                   type: number
 *                   description: 学生数量
 *                 totalTeachers:
 *                   type: number
 *                   description: 教师数量
 *                 totalCourses:
 *                   type: number
 *                   description: 课程数量
 *                 totalClasses:
 *                   type: number
 *                   description: 班级数量
 *                 totalAssignments:
 *                   type: number
 *                   description: 作业数量
 *                 totalQuizzes:
 *                   type: number
 *                   description: 测验数量
 *                 diskUsage:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       description: 总存储空间（字节）
 *                     used:
 *                       type: number
 *                       description: 已使用空间（字节）
 *                     free:
 *                       type: number
 *                       description: 可用空间（字节）
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 */
router.get('/system-stats', auth, (req, res, next) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ message: '权限不足' });
  }
  next();
}, settingController.getSystemStats);

/**
 * @swagger
 * /settings/{key}:
 *   get:
 *     tags:
 *       - 系统管理
 *       - 设置
 *     summary: 获取单个设置
 *     description: 根据键名获取特定的系统设置
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: 设置键名
 *     responses:
 *       200:
 *         description: 成功返回设置
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 key:
 *                   type: string
 *                   description: 设置键名
 *                 value:
 *                   type: string
 *                   description: 设置值
 *                 description:
 *                   type: string
 *                   description: 设置描述
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 设置不存在
 */
router.get('/:key', auth, settingController.getSetting);

/**
 * @swagger
 * /settings/{key}:
 *   put:
 *     tags:
 *       - 系统管理
 *       - 设置
 *     summary: 更新设置
 *     description: 更新特定的系统设置，仅限教师权限
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: 设置键名
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               value:
 *                 type: string
 *                 description: 新的设置值
 *               description:
 *                 type: string
 *                 description: 设置描述（可选）
 *     responses:
 *       200:
 *         description: 设置更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 设置不存在
 */
router.put('/:key', auth, (req, res, next) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ message: '权限不足' });
  }
  next();
}, settingController.updateSetting);

module.exports = router;
