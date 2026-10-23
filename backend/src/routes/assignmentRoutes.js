const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const maintenance = require('../services/maintenanceTasks');
router.get('/assignment/maintenance-tasks/:taskId', auth, roleCheck(['admin', 'teacher']), maintenance.getTask);

/**
 * @swagger
 * /courses/{courseId}/units/{unitId}/lessons/{lessonId}/activities/{activityId}/submit:
 *   post:
 *     tags:
 *       - 作业
 *     summary: 提交作业
 *     description: 学生提交作业
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
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: 活动ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: 作业文件
 *               comment:
 *                 type: string
 *                 description: 提交评论
 *     responses:
 *       201:
 *         description: 作业提交成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 资源不存在
 */
router.post('/courses/:courseId/units/:unitId/lessons/:lessonId/activities/:activityId/submit',
  auth,
  assignmentController.upload.single('file'),
  assignmentController.submitAssignment
);

/**
 * @swagger
 * /assignments/student/submissions:
 *   get:
 *     tags:
 *       - 作业
 *     summary: 获取学生作业提交记录
 *     description: 获取当前学生的所有作业提交记录
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回作业提交记录
 *       401:
 *         description: 未授权访问
 */
router.get('/assignments/student/submissions',
  auth,
  assignmentController.getStudentSubmissions
);

/**
 * @swagger
 * /courses/{courseId}/units/{unitId}/lessons/{lessonId}/activities/{activityId}/submissions:
 *   get:
 *     tags:
 *       - 作业
 *     summary: 获取作业提交历史
 *     description: 获取特定作业的提交历史记录
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
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: 活动ID
 *     responses:
 *       200:
 *         description: 成功返回提交历史
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 资源不存在
 */
router.get('/courses/:courseId/units/:unitId/lessons/:lessonId/activities/:activityId/submissions',
  auth,
  assignmentController.getSubmissionHistory
);

/**
 * @swagger
 * /submissions/{submissionId}:
 *   get:
 *     tags:
 *       - 作业
 *     summary: 获取提交详情
 *     description: 获取特定作业提交的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 提交ID
 *     responses:
 *       200:
 *         description: 成功返回提交详情
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 提交不存在
 */
router.get('/submissions/:submissionId',
  auth,
  assignmentController.getSubmissionDetail
);

/**
 * @swagger
 * /uploads/assignments/{fileName}:
 *   get:
 *     tags:
 *       - 作业
 *     summary: 下载作业文件
 *     description: 下载提交的作业文件
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileName
 *         required: true
 *         schema:
 *           type: string
 *         description: 文件名
 *     responses:
 *       200:
 *         description: 文件下载成功
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 文件不存在
 */
router.get('/uploads/assignments/*',
  auth,
  assignmentController.downloadAssignmentFile
);

/**
 * @swagger
 * /uploads/pdf_previews/{fileName}:
 *   get:
 *     tags:
 *       - 作业
 *     summary: 下载PDF预览
 *     description: 下载作业的PDF预览文件
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileName
 *         required: true
 *         schema:
 *           type: string
 *         description: 文件名
 *     responses:
 *       200:
 *         description: 文件下载成功
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 文件不存在
 */
router.get('/uploads/pdf_previews/*',
  auth,
  assignmentController.downloadPdfPreview
);

/**
 * @swagger
 * /courses/{courseId}/units/{unitId}/lessons/{lessonId}/activities/{activityId}/teacher-submissions:
 *   get:
 *     tags:
 *       - 作业
 *     summary: 教师获取作业提交列表
 *     description: 教师获取特定作业的所有学生提交列表
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
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: 活动ID
 *     responses:
 *       200:
 *         description: 成功返回提交列表
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 资源不存在
 */
router.get('/courses/:courseId/units/:unitId/lessons/:lessonId/activities/:activityId/teacher-submissions',
  auth,
  assignmentController.getSubmissionsByTeacher
);

/**
 * @swagger
 * /submissions/{submissionId}/grade:
 *   post:
 *     tags:
 *       - 作业
 *     summary: 教师批阅作业
 *     description: 教师为学生提交的作业打分并评价
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 提交ID
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
 *                 description: 分数
 *               feedback:
 *                 type: string
 *                 description: 教师反馈
 *     responses:
 *       200:
 *         description: 批阅成功
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 提交不存在
 */
router.post('/submissions/:submissionId/grade',
  auth,
  assignmentController.gradeSubmission
);

router.post('/submissions/:submissionId/ppt-auto-grade',
  auth,
  assignmentController.autoGradePptSubmission
);


/**
 * @swagger
 * /submissions/{submissionId}/download:
 *   get:
 *     tags:
 *       - 作业
 *     summary: 下载作业文件 (通过提交ID)
 *     description: 下载特定提交的作业源文件
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 提交ID
 *     responses:
 *       200:
 *         description: 文件下载成功
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 提交不存在
 */
router.get('/submissions/:submissionId/download',
  // auth, // auth middleware is handled inside controller via token check in query param
  assignmentController.downloadSubmissionFile
);

/**
 * @swagger
 * /submissions/{submissionId}/preview:
 *   get:
 *     tags:
 *       - 作业
 *     summary: 获取PDF预览
 *     description: 获取作业提交的PDF预览
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 提交ID
 *     responses:
 *       200:
 *         description: 成功返回预览信息
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 提交不存在
 */
router.get('/submissions/:submissionId/preview',
  auth,
  assignmentController.getPdfPreview
);

/**
 * @swagger
 * /submissions/{submissionId}/excel-data:
 *   get:
 *     tags:
 *       - 作业
 *     summary: 获取Excel数据
 *     description: 获取Excel文件内容并转换为SpreadsheetEditor格式
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 提交ID
 *     responses:
 *       200:
 *         description: 成功返回Excel数据
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 提交不存在或非Excel文件
 */
router.get('/submissions/:submissionId/excel-data',
  auth,
  assignmentController.getExcelData
);

/**
 * @swagger
 * /assignment/files-stats:
 *   get:
 *     tags:
 *       - 作业
 *     summary: 获取文件统计
 *     description: 获取作业文件统计信息，仅管理员和教师可用
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回文件统计
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 */
router.get('/assignment/files-stats', auth, roleCheck(['admin', 'teacher']), assignmentController.getAssignmentFilesStats);

/**
 * @swagger
 * /assignment/preview-cleanup:
 *   post:
 *     tags:
 *       - 作业
 *     summary: 预览文件清理
 *     description: 清理预览文件，仅管理员和教师可用
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 清理成功
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 */
router.post('/assignment/preview-cleanup', auth, roleCheck(['admin', 'teacher']), maintenance.taskHandler('preview-cleanup', assignmentController.previewCleanup));

/**
 * @swagger
 * /assignment/cleanup-files:
 *   post:
 *     tags:
 *       - 作业
 *     summary: 文件清理
 *     description: 清理作业文件，仅管理员和教师可用
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 清理成功
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 */
router.post('/assignment/cleanup-files', auth, roleCheck(['admin', 'teacher']), maintenance.taskHandler('cleanup-files', assignmentController.cleanupFiles));

module.exports = router;

router.get('/submissions/:submissionId/office-grading-reports', auth, assignmentController.getOfficeGradingReports);

router.post('/submissions/:submissionId/excel-auto-grade', auth, assignmentController.autoGradeExcelSubmission);
