const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const aiGradeController = require('../controllers/aiGradeController');

// 所有路由都需要认证
router.use(auth);

/**
 * @swagger
 * /api/ai-grade/submissions/{submissionId}/ai-grade:
 *   post:
 *     summary: 请求AI评阅学生作业提交
 *     tags: [常规大模型]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 作业提交ID
 *     responses:
 *       200:
 *         description: 成功请求AI评阅
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: 操作成功消息
 *                 data:
 *                   type: object
 *                   description: 包含评阅结果数据
 *       400:
 *         description: 无效请求
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅教师可用
 *       404:
 *         description: 未找到作业提交
 *       500:
 *         description: 服务器错误
 */
router.post('/submissions/:submissionId/ai-grade', aiGradeController.requestGrade);

module.exports = router; 