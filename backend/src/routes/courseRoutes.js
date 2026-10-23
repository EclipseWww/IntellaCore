const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const auth = require('../middleware/auth');

/**
 * @swagger
 * /courses:
 *   get:
 *     tags:
 *       - 课程
 *     summary: 获取所有课程
 *     description: 获取用户可访问的所有课程列表，支持搜索和分页
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 每页数量
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索关键词
 *     responses:
 *       200:
 *         description: 成功返回课程列表
 *       401:
 *         description: 未授权访问
 */
router.get('/', auth, courseController.getAllCoursesNew);

/**
 * @swagger
 * /courses/recommended:
 *   get:
 *     tags:
 *       - 课程
 *     summary: 获取推荐课程
 *     description: 获取系统推荐的课程列表
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回推荐课程列表
 *       401:
 *         description: 未授权访问
 */
router.get('/recommended', auth, courseController.getRecommendedCourses);

// 获取学生可访问的HTML活动列表
router.get('/html-activities', auth, courseController.getHtmlActivities);

/**
 * @swagger
 * /courses/{courseId}/progress:
 *   get:
 *     tags:
 *       - 课程
 *     summary: 获取课程进度
 *     description: 获取用户在特定课程的学习进度
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID
 *     responses:
 *       200:
 *         description: 成功返回课程进度
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程不存在
 */
router.get('/:courseId/progress', auth, courseController.getCourseProgressNew);

/**
 * @swagger
 * /courses/{courseId}/progress:
 *   post:
 *     tags:
 *       - 课程
 *     summary: 更新学习进度
 *     description: 更新用户在特定课程的学习进度
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - unitId
 *               - lessonId
 *             properties:
 *               unitId:
 *                 type: string
 *                 description: 单元ID
 *               lessonId:
 *                 type: string
 *                 description: 课时ID
 *               completed:
 *                 type: boolean
 *                 description: 是否完成
 *     responses:
 *       200:
 *         description: 成功更新课程进度
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程不存在
 */
router.post('/:courseId/progress', auth, courseController.updateProgressNew);

/**
 * @swagger
 * /courses/{courseId}/stats:
 *   get:
 *     tags:
 *       - 课程
 *     summary: 获取课程统计数据
 *     description: 获取特定课程的统计数据
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID
 *     responses:
 *       200:
 *         description: 成功返回课程统计数据
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程不存在
 */
router.get('/:courseId/stats', auth, courseController.getCourseStats);

/**
 * @swagger
 * /courses/{courseId}/resources:
 *   get:
 *     tags:
 *       - 课程
 *       - 资源
 *     summary: 获取课程资源
 *     description: 获取特定课程的资源列表
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID
 *     responses:
 *       200:
 *         description: 成功返回课程资源列表
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程不存在
 */
router.get('/:courseId/resources', auth, courseController.getCourseResources);

/**
 * @swagger
 * /courses/{courseId}/student-details:
 *   get:
 *     tags:
 *       - 课程
 *     summary: 获取学生课程详情
 *     description: 获取学生视角的课程详细信息，包含单元和课时
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID
 *     responses:
 *       200:
 *         description: 成功返回课程详情
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程不存在
 */
router.get('/:courseId/student-details', auth, courseController.getStudentCourseDetails);

/**
 * @swagger
 * /courses/{courseId}:
 *   get:
 *     tags:
 *       - 课程
 *     summary: 获取课程详情
 *     description: 获取特定课程的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID
 *     responses:
 *       200:
 *         description: 成功返回课程详情
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程不存在
 */
router.get('/:courseId', auth, courseController.getCourseByIdNew);

/**
 * @swagger
 * /courses/create-samples:
 *   post:
 *     tags:
 *       - 课程
 *     summary: 创建示例课程
 *     description: 创建示例课程数据（仅开发环境使用）
 *     responses:
 *       201:
 *         description: 成功创建示例课程
 */
router.post('/create-samples', courseController.createSampleCourses);

module.exports = router;
