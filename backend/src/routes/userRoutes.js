const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

/**
 * @swagger
 * /api/users/{userId}/class-settings:
 *   get:
 *     summary: 获取用户的班级设置
 *     tags: [用户管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 用户ID
 *     responses:
 *       200:
 *         description: 成功返回用户的班级设置
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 classSettings:
 *                   type: object
 *                   properties:
 *                     defaultClass:
 *                       type: string
 *                       description: 默认班级ID
 *                     recentClasses:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: 最近访问的班级ID列表
 *                     favoriteClasses:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: 收藏的班级ID列表
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，无法访问其他用户的设置
 *       404:
 *         description: 用户不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:userId/class-settings', auth, userController.getClassSettings);

module.exports = router; 