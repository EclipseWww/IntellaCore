const express = require('express');
const router = express.Router();
const LessonController = require('../controllers/lessonController');
const auth = require('../middleware/auth');
const multer = require('multer');
const transfer = require('../controllers/lessonTransferController');
router.get('/:lessonId/media-status', auth, transfer.mediaStatus);

router.get('/units/:unitId/transfers/:transferId', auth, transfer.authorize, transfer.status);
router.put('/units/:unitId/transfers/:transferId/chunks/:index', auth, transfer.authorize,
  express.raw({ type: 'application/octet-stream', limit: '8mb' }), transfer.chunk);
router.post('/units/:unitId/transfers/:transferId/complete', auth, transfer.authorize, transfer.complete);

// 配置文件上传
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    // 确保目标目录存在
    const fs = require('fs');
    if (!fs.existsSync('temp/')) {
      fs.mkdirSync('temp/', { recursive: true });
    }
    cb(null, 'temp/');
  },
  filename: function(req, file, cb) {
    // 只使用时间戳作为文件名，避免使用原始文件名中的中文字符
    cb(null, `lesson_import_${Date.now()}.zip`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 兼容直接上传；网页使用8MB分片
});

const pptGradingStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    const fs = require('fs');
    const path = require('path');
    const { lessonId, activityId } = req.params;
    const dir = path.join(__dirname, '../../uploads/ppt-grading', lessonId, activityId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const path = require('path');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`);
  }
});

const pptGradingUpload = multer({
  storage: pptGradingStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    const path = require('path');
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pptx') return cb(null, true);
    return cb(new Error('目前仅支持PPTX文件'));
  }
});

const excelGradingStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    const fs = require('fs');
    const path = require('path');
    const { lessonId, activityId } = req.params;
    const dir = path.join(__dirname, '../../uploads/excel-grading', lessonId, activityId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const path = require('path');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`);
  }
});

const excelGradingUpload = multer({
  storage: excelGradingStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    const path = require('path');
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx') return cb(null, true);
    return cb(new Error('目前仅支持XLSX文件'));
  }
});

/**
 * @swagger
 * /lessons/{lessonId}/activities/{activityId}/publish:
 *   put:
 *     tags:
 *       - 课时
 *     summary: 更新活动发布状态
 *     description: 更新课时中特定活动的发布状态
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isPublished
 *             properties:
 *               isPublished:
 *                 type: boolean
 *                 description: 是否发布
 *     responses:
 *       200:
 *         description: 活动发布状态更新成功
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课时或活动不存在
 */
router.put('/:lessonId/activities/:activityId/publish', LessonController.updateActivityPublishStatus);

/**
 * @swagger
 * /lessons/{lessonId}/export:
 *   get:
 *     tags:
 *       - 课时
 *     summary: 导出课时
 *     description: 将课时导出为ZIP文件，包含所有课时内容和活动
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
 *         description: 成功导出课时
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课时不存在
 */
router.get('/:lessonId/export', auth, LessonController.exportLesson);

/**
 * @swagger
 * /lessons/units/{unitId}/import:
 *   post:
 *     tags:
 *       - 课时
 *     summary: 导入课时
 *     description: 将ZIP文件导入为新课时
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: 目标单元ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - lessonFile
 *             properties:
 *               lessonFile:
 *                 type: string
 *                 format: binary
 *                 description: 课时ZIP文件
 *     responses:
 *       201:
 *         description: 课时导入成功
 *       400:
 *         description: 请求参数错误或无效的ZIP文件
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 单元不存在
 */
router.post('/units/:unitId/import', auth, upload.single('lessonFile'), LessonController.importLesson);

/**
 * @swagger
 * /lessons/{lessonId}/activities/{activityId}/details:
 *   put:
 *     tags:
 *       - 课时
 *       - 活动
 *     summary: 更新活动详情
 *     description: 更新活动的描述和参考答案
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: 活动描述
 *               referenceAnswer:
 *                 type: string
 *                 description: 参考答案
 *     responses:
 *       200:
 *         description: 活动详情更新成功
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课时或活动不存在
 */
router.put('/:lessonId/activities/:activityId/details', auth, LessonController.updateActivityDetails);

router.post(
  '/:lessonId/activities/:activityId/ppt-grading/upload',
  auth,
  pptGradingUpload.single('file'),
  LessonController.uploadPptGradingFile
);

router.put(
  '/:lessonId/activities/:activityId/ppt-grading/settings',
  auth,
  LessonController.updatePptGradingSettings
);

router.post(
  '/:lessonId/activities/:activityId/ppt-grading/regenerate',
  auth,
  LessonController.regeneratePptGradingRules
);

router.get(
  '/:lessonId/activities/:activityId/ppt-grading/:fileRole/download',
  auth,
  LessonController.downloadPptGradingFile
);

module.exports = router;

router.post(
  '/:lessonId/activities/:activityId/excel-grading/upload',
  auth,
  excelGradingUpload.single('file'),
  LessonController.uploadExcelGradingFile
);

router.put(
  '/:lessonId/activities/:activityId/excel-grading/settings',
  auth,
  LessonController.updateExcelGradingSettings
);

router.post(
  '/:lessonId/activities/:activityId/excel-grading/regenerate',
  auth,
  LessonController.regenerateExcelGradingRules
);

router.get(
  '/:lessonId/activities/:activityId/excel-grading/:fileRole/download',
  auth,
  LessonController.downloadExcelGradingFile
);
