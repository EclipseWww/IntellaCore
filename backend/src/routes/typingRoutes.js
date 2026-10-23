const express = require('express');
const router = express.Router();
const typingController = require('../controllers/typingController');
const auth = require('../middleware/auth');

// 文本管理路由
/**
 * @swagger
 * /api/typing/texts:
 *   post:
 *     summary: 创建打字练习文本
 *     tags: [打字练习]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 description: 文本标题
 *               content:
 *                 type: string
 *                 description: 练习文本内容
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *                 description: 难度级别
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 文本标签
 *               courseId:
 *                 type: string
 *                 description: 关联的课程ID（可选）
 *     responses:
 *       201:
 *         description: 成功创建打字练习文本
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 text:
 *                   type: object
 *       400:
 *         description: 无效请求
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.post('/texts', auth, typingController.createText);

/**
 * @swagger
 * /api/typing/texts:
 *   get:
 *     summary: 获取打字练习文本列表
 *     tags: [打字练习]
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
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [easy, medium, hard]
 *         description: 按难度筛选
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: 按标签筛选
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *         description: 按课程ID筛选
 *     responses:
 *       200:
 *         description: 成功返回打字练习文本列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 texts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       difficulty:
 *                         type: string
 *                       contentPreview:
 *                         type: string
 *                       tags:
 *                         type: array
 *                         items:
 *                           type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                   description: 总记录数
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/texts', auth, typingController.getTexts);

/**
 * @swagger
 * /api/typing/texts/{id}:
 *   get:
 *     summary: 获取单个打字练习文本详情
 *     tags: [打字练习]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 文本ID
 *     responses:
 *       200:
 *         description: 成功返回打字练习文本详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                 difficulty:
 *                   type: string
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: string
 *                 courseId:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 createdBy:
 *                   type: object
 *       401:
 *         description: 未授权
 *       404:
 *         description: 文本不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/texts/:id', auth, typingController.getTextById);

/**
 * @swagger
 * /api/typing/texts/{id}:
 *   put:
 *     summary: 更新打字练习文本
 *     tags: [打字练习]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 文本ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: 文本标题
 *               content:
 *                 type: string
 *                 description: 练习文本内容
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *                 description: 难度级别
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 文本标签
 *               courseId:
 *                 type: string
 *                 description: 关联的课程ID
 *     responses:
 *       200:
 *         description: 成功更新打字练习文本
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 text:
 *                   type: object
 *       400:
 *         description: 无效请求
 *       401:
 *         description: 未授权
 *       404:
 *         description: 文本不存在
 *       500:
 *         description: 服务器错误
 */
router.put('/texts/:id', auth, typingController.updateText);

/**
 * @swagger
 * /api/typing/texts/{id}:
 *   delete:
 *     summary: 删除打字练习文本
 *     tags: [打字练习]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 文本ID
 *     responses:
 *       200:
 *         description: 成功删除打字练习文本
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授权
 *       404:
 *         description: 文本不存在
 *       500:
 *         description: 服务器错误
 */
router.delete('/texts/:id', auth, typingController.deleteText);

// 练习记录路由
/**
 * @swagger
 * /api/typing/records:
 *   post:
 *     summary: 记录打字练习结果
 *     tags: [打字练习]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - textId
 *               - speed
 *               - accuracy
 *             properties:
 *               textId:
 *                 type: string
 *                 description: 练习文本ID
 *               speed:
 *                 type: number
 *                 description: 打字速度（字/分钟）
 *               accuracy:
 *                 type: number
 *                 description: 准确率百分比
 *               errors:
 *                 type: integer
 *                 description: 错误数量
 *               completionTime:
 *                 type: integer
 *                 description: 完成时间（秒）
 *     responses:
 *       201:
 *         description: 成功记录打字练习结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 record:
 *                   type: object
 *       400:
 *         description: 无效请求
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.post('/records', auth, typingController.recordTyping);

/**
 * @swagger
 * /api/typing/records:
 *   get:
 *     summary: 获取用户的打字练习记录
 *     tags: [打字练习]
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
 *         name: textId
 *         schema:
 *           type: string
 *         description: 按文本ID筛选
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
 *         description: 成功返回用户的打字练习记录
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 records:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       textId:
 *                         type: object
 *                       speed:
 *                         type: number
 *                       accuracy:
 *                         type: number
 *                       errors:
 *                         type: integer
 *                       completionTime:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                   description: 总记录数
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/records', auth, typingController.getRecords);

// 统计信息路由
/**
 * @swagger
 * /api/typing/stats:
 *   get:
 *     summary: 获取用户的打字练习统计信息
 *     tags: [打字练习]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [day, week, month, year, all]
 *         description: 时间范围
 *     responses:
 *       200:
 *         description: 成功返回用户的打字练习统计信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 averageSpeed:
 *                   type: number
 *                   description: 平均速度（字/分钟）
 *                 averageAccuracy:
 *                   type: number
 *                   description: 平均准确率
 *                 totalPractices:
 *                   type: integer
 *                   description: 练习总次数
 *                 totalTime:
 *                   type: integer
 *                   description: 练习总时间（分钟）
 *                 speedProgress:
 *                   type: array
 *                   description: 速度进步曲线
 *                   items:
 *                     type: object
 *                 accuracyProgress:
 *                   type: array
 *                   description: 准确率进步曲线
 *                   items:
 *                     type: object
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/stats', auth, typingController.getStats);

// 排行榜路由
/**
 * @swagger
 * /api/typing/leaderboard:
 *   get:
 *     summary: 获取打字排行榜（全校/班级）
 *     tags: [打字练习]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           enum: [school, class]
 *         description: 排行范围（全校或班级）
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [week, month, all]
 *         description: 时间范围
 *     responses:
 *       200:
 *         description: 成功返回排行榜数据
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/leaderboard', auth, typingController.getLeaderboard);

/**
 * @swagger
 * /api/typing/text-leaderboard/{textId}:
 *   get:
 *     summary: 获取指定文章的排行榜
 *     tags: [打字练习]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: textId
 *         required: true
 *         schema:
 *           type: string
 *         description: 文章ID
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [week, month, all]
 *         description: 时间范围
 *     responses:
 *       200:
 *         description: 成功返回文章排行榜
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/text-leaderboard/:textId', auth, typingController.getTextLeaderboard);

// 教师端路由
/**
 * @swagger
 * /api/typing/teacher/records:
 *   get:
 *     summary: 获取学生的打字练习记录（教师专用）
 *     tags: [打字练习-教师]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *         description: 学生ID
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *         description: 班级ID
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
 *     responses:
 *       200:
 *         description: 成功返回学生的打字练习记录
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 records:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       student:
 *                         type: object
 *                       textId:
 *                         type: object
 *                       speed:
 *                         type: number
 *                       accuracy:
 *                         type: number
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                   description: 总记录数
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 *       500:
 *         description: 服务器错误
 */
router.get('/teacher/records', auth, typingController.getTeacherRecords);

/**
 * @swagger
 * /api/typing/teacher/stats:
 *   get:
 *     summary: 获取打字练习统计数据（教师专用）
 *     tags: [打字练习-教师]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *         required: true
 *         description: 班级ID
 *     responses:
 *       200:
 *         description: 成功获取统计数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRecords:
 *                   type: number
 *                 averageSpeed:
 *                   type: number
 *                 averageAccuracy:
 *                   type: number
 *                 passRate:
 *                   type: number
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 *       500:
 *         description: 服务器错误
 */
router.get('/teacher/stats', auth, typingController.getTeacherStats);

/**
 * @swagger
 * /api/typing/teacher/records/{id}:
 *   delete:
 *     summary: 删除打字练习记录（教师专用）
 *     tags: [打字练习-教师]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 记录ID
 *     responses:
 *       200:
 *         description: 成功删除记录
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 记录不存在
 *       500:
 *         description: 服务器错误
 */
router.delete('/teacher/records/:id', auth, typingController.deleteTypingRecord);

module.exports = router; 