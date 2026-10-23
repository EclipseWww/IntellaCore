const express = require('express');
const router = express.Router();
const flowchartController = require('../controllers/flowchartController');
const auth = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: 流程图
 *   description: 流程图绘制活动相关接口
 */

/**
 * @swagger
 * /api/flowchart/submit:
 *   post:
 *     summary: 提交流程图
 *     tags: [流程图]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lessonId
 *               - activityId
 *               - flowchartData
 *             properties:
 *               lessonId:
 *                 type: string
 *                 description: 课时ID
 *               activityId:
 *                 type: string
 *                 description: 活动ID
 *               flowchartData:
 *                 type: string
 *                 description: 流程图数据(JSON格式)
 *               duration:
 *                 type: number
 *                 description: 绘制耗时(秒)
 *     responses:
 *       201:
 *         description: 提交成功
 *       400:
 *         description: 请求参数无效
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.post('/submit', auth, flowchartController.submitFlowchart);

/**
 * @swagger
 * /api/flowchart/draft:
 *   post:
 *     summary: 保存流程图草稿
 *     tags: [流程图]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lessonId
 *               - activityId
 *               - flowchartData
 *             properties:
 *               lessonId:
 *                 type: string
 *                 description: 课时ID
 *               activityId:
 *                 type: string
 *                 description: 活动ID
 *               flowchartData:
 *                 type: string
 *                 description: 流程图数据(JSON格式)
 *     responses:
 *       200:
 *         description: 保存成功
 *       400:
 *         description: 请求参数无效
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.post('/draft', auth, flowchartController.saveDraft);

/**
 * @swagger
 * /api/flowchart/submission:
 *   get:
 *     summary: 获取用户的流程图提交记录
 *     tags: [流程图]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课时ID
 *       - in: query
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: 活动ID
 *     responses:
 *       200:
 *         description: 获取成功
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/submission', auth, flowchartController.getSubmission);

/**
 * @swagger
 * /api/flowchart/teacher/submissions:
 *   get:
 *     summary: 获取活动的所有提交记录(教师专用)
 *     tags: [流程图-教师]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课时ID
 *       - in: query
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: 活动ID
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *         description: 班级ID(可选)
 *     responses:
 *       200:
 *         description: 获取成功
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 *       500:
 *         description: 服务器错误
 */
router.get('/teacher/submissions', auth, flowchartController.getActivitySubmissions);

/**
 * @swagger
 * /api/flowchart/teacher/grade/{submissionId}:
 *   post:
 *     summary: 评分流程图(教师专用)
 *     tags: [流程图-教师]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 提交记录ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - score
 *             properties:
 *               score:
 *                 type: number
 *                 description: 评分(0-100)
 *               feedback:
 *                 type: string
 *                 description: 评语
 *     responses:
 *       200:
 *         description: 评分成功
 *       400:
 *         description: 请求参数无效
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 提交记录不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/teacher/grade/:submissionId', auth, flowchartController.gradeSubmission);

/**
 * @swagger
 * /api/flowchart/teacher/stats:
 *   get:
 *     summary: 获取班级流程图统计(教师专用)
 *     tags: [流程图-教师]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课时ID
 *       - in: query
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: 活动ID
 *       - in: query
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: 班级ID
 *     responses:
 *       200:
 *         description: 获取成功
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 *       500:
 *         description: 服务器错误
 */
router.get('/teacher/stats', auth, flowchartController.getClassStats);

/**
 * @swagger
 * /api/flowchart/teacher/submissions/{submissionId}:
 *   delete:
 *     summary: 删除流程图提交记录(教师专用)
 *     tags: [流程图-教师]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 提交记录ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 提交记录不存在
 *       500:
 *         description: 服务器错误
 */
router.delete('/teacher/submissions/:submissionId', auth, flowchartController.deleteSubmission);

module.exports = router;

