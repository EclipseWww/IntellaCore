const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createCourse,
  updateCourse,
  getTeacherCourses,
  getCourseDetails,
  deleteCourse
} = require('../controllers/courseManagementController');
const lessonController = require('../controllers/lessonController');

// 引入单元管理路由
const unitManagementRouter = require('./unitManagement');

// 所有路由都需要认证
router.use(auth);

// 重定向单元管理路由
router.use('/:courseId/units', unitManagementRouter);

/**
 * @swagger
 * /course-management:
 *   post:
 *     tags:
 *       - 课程管理
 *     summary: 创建新课程
 *     description: 教师创建新的课程
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
 *               - type
 *               - level
 *             properties:
 *               title:
 *                 type: string
 *                 description: 课程标题
 *               description:
 *                 type: string
 *                 description: 课程描述
 *               type:
 *                 type: string
 *                 enum: [software, programming, language, design, business, other]
 *                 description: 课程类型
 *               level:
 *                 type: string
 *                 enum: [入门, 初级, 中级, 高级]
 *                 description: 课程难度级别
 *               accessibleClasses:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 可访问的班级ID列表
 *               isPublic:
 *                 type: boolean
 *                 description: 是否对所有班级公开
 *     responses:
 *       201:
 *         description: 课程创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Course'
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *   get:
 *     tags:
 *       - 课程管理
 *     summary: 获取教师的所有课程
 *     description: 获取当前教师创建的所有课程
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
 *         description: 成功返回教师课程列表
 *       401:
 *         description: 未授权访问
 */
router.route('/')
  .post(createCourse)
  .get(getTeacherCourses);

/**
 * @swagger
 * /course-management/{id}:
 *   get:
 *     tags:
 *       - 课程管理
 *     summary: 获取课程详情
 *     description: 获取特定课程的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *   put:
 *     tags:
 *       - 课程管理
 *     summary: 更新课程
 *     description: 更新特定课程的信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               title:
 *                 type: string
 *                 description: 课程标题
 *               description:
 *                 type: string
 *                 description: 课程描述
 *               type:
 *                 type: string
 *                 enum: [software, programming, language, design, business, other]
 *                 description: 课程类型
 *               level:
 *                 type: string
 *                 enum: [入门, 初级, 中级, 高级]
 *                 description: 课程难度级别
 *               accessibleClasses:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 可访问的班级ID列表
 *               isPublic:
 *                 type: boolean
 *                 description: 是否对所有班级公开
 *     responses:
 *       200:
 *         description: 课程更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程不存在
 *   delete:
 *     tags:
 *       - 课程管理
 *     summary: 删除课程
 *     description: 删除特定课程
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID
 *     responses:
 *       200:
 *         description: 课程删除成功
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程不存在
 */
router.route('/:id')
  .get(getCourseDetails)
  .put(updateCourse)
  .delete(deleteCourse);

/**
 * @swagger
 * /course-management/{courseId}/units/{unitId}/lessons/order:
 *   put:
 *     tags:
 *       - 课程管理
 *       - 课时
 *     summary: 更新课时顺序
 *     description: 更新单元中课时的顺序
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID
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
 *               - lessons
 *             properties:
 *               lessons:
 *                 type: array
 *                 description: 按顺序排列的课时ID列表
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 课时顺序更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程或单元不存在
 */
router.put(
  '/:courseId/units/:unitId/lessons/order',
  lessonController.updateLessonsOrder
);

/**
 * @swagger
 * /course-management/{courseId}/units/{unitId}/lessons/{lessonId}/status:
 *   put:
 *     tags:
 *       - 课程管理
 *       - 课时
 *     summary: 更新课时状态
 *     description: 更新课时的发布状态
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: 单元ID
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, published, archived]
 *                 description: 课时状态
 *     responses:
 *       200:
 *         description: 课时状态更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程、单元或课时不存在
 */
router.put(
  '/:courseId/units/:unitId/lessons/:lessonId/status',
  lessonController.updateLessonStatus
);

/**
 * @swagger
 * /course-management/{courseId}/units/{unitId}/lessons/{lessonId}:
 *   delete:
 *     tags:
 *       - 课程管理
 *       - 课时
 *     summary: 删除课时
 *     description: 删除特定课时
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: 单元ID
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
 *         description: 课程、单元或课时不存在
 */
router.delete(
  '/:courseId/units/:unitId/lessons/:lessonId',
  lessonController.deleteLesson
);

module.exports = router;
