const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAssignmentTree } = require('../controllers/assignmentTreeController');
const { getPendingSummary } = require('../controllers/pendingAssignmentsController');

/**
 * @swagger
 * /teacher/assignment-tree:
 *   get:
 *     tags:
 *       - 教师功能
 *     summary: 获取作业评阅树形结构
 *     description: 一次性返回教师所有课程-单元-课时-活动的级联结构，用于作业评阅页面的级联选择器
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回树形结构
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       value:
 *                         type: string
 *                         description: 课程ID
 *                       label:
 *                         type: string
 *                         description: 课程标题
 *                       children:
 *                         type: array
 *                         description: 单元列表
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 */
router.get('/assignment-tree', auth, getAssignmentTree);

/**
 * @swagger
 * /teacher/pending-summary:
 *   get:
 *     tags:
 *       - 教师功能
 *     summary: 获取待批改作业汇总
 *     description: 返回教师所有课程中待批改的作业数量，按课程/单元/课时/活动分组
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回待批改汇总
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                 totalPending:
 *                   type: number
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 */
router.get('/pending-summary', auth, getPendingSummary);

module.exports = router;

