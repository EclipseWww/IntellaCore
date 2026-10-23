const express = require('express');
const router = express.Router();
const courseUnitController = require('../controllers/courseUnitController');
const lessonController = require('../controllers/lessonController');
const auth = require('../middleware/auth');

// 课程单元路由
// 所有路由都需要认证
router.use(auth);

/**
 * @swagger
 * /course-units/course/{courseId}/units:
 *   get:
 *     tags:
 *       - 单元
 *     summary: 获取课程的所有单元
 *     description: 获取特定课程的所有学习单元
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
 *         description: 成功返回单元列表
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程不存在
 */
router.get('/course/:courseId/units', courseUnitController.getCourseUnits);

/**
 * @swagger
 * /course-units/course/{courseId}/units:
 *   post:
 *     tags:
 *       - 单元
 *     summary: 创建课程单元
 *     description: 在特定课程中创建新的学习单元
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
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: 单元标题
 *               description:
 *                 type: string
 *                 description: 单元描述
 *               order:
 *                 type: number
 *                 description: 单元顺序（可选，默认添加到末尾）
 *     responses:
 *       201:
 *         description: 单元创建成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程不存在
 */
router.post('/course/:courseId/units', courseUnitController.createCourseUnit);

/**
 * @swagger
 * /course-units/units/{unitId}:
 *   get:
 *     tags:
 *       - 单元
 *     summary: 获取单元详情
 *     description: 获取特定单元的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: 单元ID
 *     responses:
 *       200:
 *         description: 成功返回单元详情
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 单元不存在
 */
router.get('/units/:unitId', courseUnitController.getCourseUnitDetails);

/**
 * @swagger
 * /course-units/units/{unitId}:
 *   put:
 *     tags:
 *       - 单元
 *     summary: 更新课程单元
 *     description: 更新特定单元的信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: 单元ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: 单元标题
 *               description:
 *                 type: string
 *                 description: 单元描述
 *     responses:
 *       200:
 *         description: 单元更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 单元不存在
 */
router.put('/units/:unitId', courseUnitController.updateCourseUnit);

/**
 * @swagger
 * /course-units/units/{unitId}:
 *   delete:
 *     tags:
 *       - 单元
 *     summary: 删除课程单元
 *     description: 删除特定单元
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: 单元ID
 *     responses:
 *       200:
 *         description: 单元删除成功
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 单元不存在
 */
router.delete('/units/:unitId', courseUnitController.deleteCourseUnit);

/**
 * @swagger
 * /course-units/course/{courseId}/units/reorder:
 *   post:
 *     tags:
 *       - 单元
 *     summary: 调整单元顺序
 *     description: 重新排序课程中的单元
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
 *               - unitIds
 *             properties:
 *               unitIds:
 *                 type: array
 *                 description: 按新顺序排列的单元ID数组
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 单元顺序调整成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程或单元不存在
 */
router.post('/course/:courseId/units/reorder', courseUnitController.reorderUnits);

// 课时相关路由

/**
 * @swagger
 * /course-units/units/{unitId}/lessons:
 *   post:
 *     tags:
 *       - 课时
 *     summary: 创建课时
 *     description: 在特定单元中创建新的课时
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: 单元ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: 课时标题
 *               description:
 *                 type: string
 *                 description: 课时描述
 *               objectives:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 学习目标
 *               order:
 *                 type: number
 *                 description: 课时顺序（可选，默认添加到末尾）
 *     responses:
 *       201:
 *         description: 课时创建成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 单元不存在
 */
router.post('/units/:unitId/lessons', lessonController.createLesson);

/**
 * @swagger
 * /course-units/units/{unitId}/lessons:
 *   get:
 *     tags:
 *       - 课时
 *     summary: 获取单元的所有课时
 *     description: 获取特定单元的所有课时
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: 单元ID
 *     responses:
 *       200:
 *         description: 成功返回课时列表
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 单元不存在
 */
router.get('/units/:unitId/lessons', lessonController.getUnitLessons);

/**
 * @swagger
 * /course-units/lessons/{lessonId}:
 *   get:
 *     tags:
 *       - 课时
 *     summary: 获取课时详情
 *     description: 获取特定课时的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课时ID
 *     responses:
 *       200:
 *         description: 成功返回课时详情
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课时不存在
 */
router.get('/lessons/:lessonId', lessonController.getLessonDetails);

/**
 * @swagger
 * /course-units/lessons/{lessonId}:
 *   put:
 *     tags:
 *       - 课时
 *     summary: 更新课时
 *     description: 更新特定课时的信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课时ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: 课时标题
 *               description:
 *                 type: string
 *                 description: 课时描述
 *               objectives:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 学习目标
 *               activities:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: 学习活动
 *     responses:
 *       200:
 *         description: 课时更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课时不存在
 */
router.put('/lessons/:lessonId', lessonController.updateLesson);

/**
 * @swagger
 * /course-units/lessons/{lessonId}:
 *   delete:
 *     tags:
 *       - 课时
 *     summary: 删除课时
 *     description: 删除特定课时
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课时ID
 *     responses:
 *       200:
 *         description: 课时删除成功
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课时不存在
 */
router.delete('/lessons/:lessonId', lessonController.deleteLesson);

/**
 * @swagger
 * /course-units/lessons/{lessonId}/teaching-plan:
 *   put:
 *     tags:
 *       - 课时
 *     summary: 更新课时教学计划
 *     description: 更新特定课时的教学计划
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课时ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               teachingPlan:
 *                 type: string
 *                 description: 教学计划内容
 *     responses:
 *       200:
 *         description: 教学计划更新成功
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课时不存在
 */
router.put('/lessons/:lessonId/teaching-plan', lessonController.updateTeachingPlan);

/**
 * @swagger
 * /course-units/lessons/{lessonId}/resources:
 *   put:
 *     tags:
 *       - 课时
 *       - 资源
 *     summary: 更新课时资源
 *     description: 更新特定课时的资源列表
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课时ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resources:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     type:
 *                       type: string
 *                     url:
 *                       type: string
 *                 description: 资源列表
 *     responses:
 *       200:
 *         description: 资源更新成功
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课时不存在
 */
router.put('/lessons/:lessonId/resources', lessonController.updateResources);

/**
 * @swagger
 * /course-units/teacher/lessons:
 *   get:
 *     tags:
 *       - 课时
 *     summary: 获取教师的所有课程小节
 *     description: 获取当前教师的所有课程小节
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
 *         name: courseId
 *         schema:
 *           type: string
 *         description: 按课程筛选
 *     responses:
 *       200:
 *         description: 成功返回课时列表
 *       401:
 *         description: 未授权访问
 */
router.get('/teacher/lessons', lessonController.getTeacherLessons);

module.exports = router;
