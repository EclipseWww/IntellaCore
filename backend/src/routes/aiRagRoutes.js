const express = require('express');
const router = express.Router();
const aiRagController = require('../controllers/aiRagController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// 所有路由都需要登录
router.use(auth);

/**
 * @swagger
 * /api/ai-rag/lesson-plan:
 *   get:
 *     summary: 生成AI辅助备课计划
 *     tags: [RAG功能]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *         required: true
 *         description: 备课主题
 *       - in: query
 *         name: grade
 *         schema:
 *           type: string
 *         description: 年级/学段
 *       - in: query
 *         name: duration
 *         schema:
 *           type: integer
 *         description: 课时时长（分钟）
 *     responses:
 *       200:
 *         description: 成功生成备课计划
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       500:
 *         description: 服务器错误
 */
router.get('/lesson-plan', roleCheck(['teacher', 'admin']), aiRagController.generateLessonPlan);

/**
 * @swagger
 * /api/ai-rag/questions:
 *   get:
 *     summary: 生成AI辅助题目（流式响应）
 *     tags: [RAG功能]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *         required: true
 *         description: 题目主题
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *         description: 生成题目数量
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [easy, medium, hard]
 *         description: 难度级别
 *     responses:
 *       200:
 *         description: 流式返回生成的题目
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       500:
 *         description: 服务器错误
 */
router.get('/questions', roleCheck(['teacher', 'admin']), aiRagController.generateQuestions);

/**
 * @swagger
 * /api/ai-rag/knowledge-bases:
 *   get:
 *     summary: 获取可用的知识库列表
 *     tags: [RAG功能]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回知识库列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/knowledge-bases', aiRagController.getKnowledgeBases);

/**
 * @swagger
 * /api/ai-rag/clear-temp:
 *   post:
 *     summary: 清理系统临时文件
 *     tags: [RAG功能]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功清理临时文件
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: integer
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅管理员可用
 *       500:
 *         description: 服务器错误
 */
router.post('/clear-temp', roleCheck(['admin']), aiRagController.clearTemporaryFiles);

/**
 * @swagger
 * /api/ai-rag/chat:
 *   get:
 *     summary: AI聊天功能（流式响应）
 *     tags: [RAG功能]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: message
 *         schema:
 *           type: string
 *         required: true
 *         description: 用户消息内容
 *       - in: query
 *         name: history
 *         schema:
 *           type: array
 *         description: 聊天历史记录（可选）
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: 使用的AI模型（可选，默认使用系统配置）
 *       - in: query
 *         name: dbName
 *         schema:
 *           type: string
 *         description: 知识库名称（可选）
 *     responses:
 *       200:
 *         description: 流式返回AI回复内容
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: 事件流包含多个JSON数据块
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.route('/chat').get(aiRagController.aiChat);
  
module.exports = router; 