const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

/**
 * @swagger
 * /api/chat/send:
 *   post:
 *     summary: 发送聊天消息
 *     tags: [常规大模型]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: 消息内容
 *               sessionId:
 *                 type: string
 *                 description: 会话ID（可选，不提供则创建新会话）
 *               courseId:
 *                 type: string
 *                 description: 关联的课程ID（可选）
 *     responses:
 *       200:
 *         description: 成功发送消息并返回回复
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅学生可用
 *       500:
 *         description: 服务器错误
 *   get:
 *     summary: 发送聊天消息（GET方式）
 *     tags: [聊天]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: content
 *         schema:
 *           type: string
 *         required: true
 *         description: 消息内容
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: 会话ID（可选）
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *         description: 关联的课程ID（可选）
 *     responses:
 *       200:
 *         description: 成功发送消息并返回回复
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅学生可用
 *       500:
 *         description: 服务器错误
 */
router.route('/send')
  .post(auth, roleCheck(['student', 'admin']), chatController.sendMessage)
  .get(auth, roleCheck(['student', 'admin']), chatController.sendMessage);

/**
 * @swagger
 * /api/chat/history:
 *   get:
 *     summary: 获取聊天历史记录
 *     tags: [常规大模型]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: 会话ID（可选）
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: 用户ID（可选，教师查询特定学生的记录）
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *         description: 课程ID（可选，筛选特定课程相关消息）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: 返回记录数量限制
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *         description: 跳过记录数（分页用）
 *     responses:
 *       200:
 *         description: 成功返回聊天历史
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
 *                 total:
 *                   type: integer
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/history', 
  auth, 
  roleCheck(['student', 'teacher', 'admin']), 
  chatController.getMessageHistory
);

// 教师端：获取待审核学生汇总
router.get(
  '/pending/students',
  auth,
  roleCheck(['teacher', 'admin']),
  chatController.getPendingStudentsAggregate
);

// 教师端：按学生获取该学生的全部消息（可筛选）
router.get(
  '/students/:studentId/messages',
  auth,
  roleCheck(['teacher', 'admin']),
  chatController.getMessagesByStudent
);

/**
 * @swagger
 * /api/chat/course-question:
 *   post:
 *     summary: 发送课程相关问题
 *     tags: [常规大模型]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - courseId
 *             properties:
 *               content:
 *                 type: string
 *                 description: 问题内容
 *               courseId:
 *                 type: string
 *                 description: 课程ID
 *               lessonId:
 *                 type: string
 *                 description: 课时ID（可选）
 *     responses:
 *       200:
 *         description: 成功发送问题并返回回复
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅学生可用
 *       500:
 *         description: 服务器错误
 *   get:
 *     summary: 发送课程相关问题（GET方式）
 *     tags: [常规大模型]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: content
 *         schema:
 *           type: string
 *         required: true
 *         description: 问题内容
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *         required: true
 *         description: 课程ID
 *       - in: query
 *         name: lessonId
 *         schema:
 *           type: string
 *         description: 课时ID（可选）
 *     responses:
 *       200:
 *         description: 成功发送问题并返回回复
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅学生可用
 *       500:
 *         description: 服务器错误
 */
router.route('/course-question')
  .get(auth, roleCheck(['student', 'admin']), chatController.handleCourseQuestion)
  .post(auth, roleCheck(['student', 'admin']), chatController.handleCourseQuestion);

/**
 * @swagger
 * /api/chat/message/{id}:
 *   get:
 *     summary: 获取单个消息详情
 *     tags: [常规大模型]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 消息ID
 *     responses:
 *       200:
 *         description: 成功返回消息详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 content:
 *                   type: string
 *                 sender:
 *                   type: object
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 sessionId:
 *                   type: string
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅学生可用
 *       404:
 *         description: 消息不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/message/:id', 
  auth, 
  roleCheck(['student', 'admin']), 
  chatController.getMessage
);

/**
 * @swagger
 * /api/chat/current-session:
 *   get:
 *     summary: 获取当前会话的所有消息
 *     tags: [常规大模型]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         required: true
 *         description: 会话ID
 *     responses:
 *       200:
 *         description: 成功返回当前会话消息
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   content:
 *                     type: string
 *                   sender:
 *                     type: object
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅学生可用
 *       404:
 *         description: 会话不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/current-session',
  auth,
  roleCheck(['student', 'admin']),
  chatController.getCurrentSession
);

// 导出聊天记录（CSV）：教师/管理员
router.get('/export/csv',
  auth,
  roleCheck(['teacher', 'admin', 'student']),
  chatController.exportAllMessagesCSV
);

module.exports = router;