const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const freePracticeController = require('../controllers/freePracticeController');

/**
 * @swagger
 * /quiz/free-practice/start:
 *   post:
 *     tags:
 *       - 自由练习
 *     summary: 开始新的自由练习
 *     description: 随机抽取10道题目开始练习
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: 练习会话创建成功
 */
router.post('/start', auth, roleCheck(['student']), freePracticeController.startPractice);

/**
 * @swagger
 * /quiz/free-practice/submit:
 *   post:
 *     tags:
 *       - 自由练习
 *     summary: 提交练习答案
 *     description: 提交答案并计算得分
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *               answers:
 *                 type: object
 *     responses:
 *       200:
 *         description: 提交成功，返回结果
 */
router.post('/submit', auth, roleCheck(['student']), freePracticeController.submitPractice);

/**
 * @swagger
 * /quiz/free-practice/history:
 *   get:
 *     tags:
 *       - 自由练习
 *     summary: 获取练习历史
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回历史记录
 */
router.get('/history', auth, roleCheck(['student']), freePracticeController.getHistory);
router.get('/details/:sessionId', auth, roleCheck(['student']), freePracticeController.getDetails);

/**
 * @swagger
 * /quiz/free-practice/class/{classId}/settings:
 *   get:
 *     tags:
 *       - 自由练习
 *     summary: 获取班级练习配置 (Teacher)
 *     security:
 *       - bearerAuth: []
 *   put:
 *     tags:
 *       - 自由练习
 *     summary: 更新班级练习配置 (Teacher)
 *     security:
 *       - bearerAuth: []
 */
router.get('/class/:classId/settings', auth, roleCheck(['teacher', 'admin']), freePracticeController.getClassSettings);
router.put('/class/:classId/settings', auth, roleCheck(['teacher', 'admin']), freePracticeController.updateClassSettings);
router.put('/class/settings/bulk', auth, roleCheck(['teacher', 'admin']), freePracticeController.bulkUpdateClassSettings);

// Teacher: 获取学生练习记录
router.get('/records', auth, roleCheck(['teacher', 'admin']), freePracticeController.getStudentRecords);

// Teacher: 获取排行榜
router.get('/leaderboard', auth, roleCheck(['teacher', 'admin']), freePracticeController.getLeaderboard);

module.exports = router;
