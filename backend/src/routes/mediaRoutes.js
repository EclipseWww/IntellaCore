const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const mediaController = require('../controllers/mediaController');
const { promisify } = require('util');
const fs = require('fs');
const mkdir = promisify(fs.mkdir);

// 配置 multer
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    // 为每个课程/单元/课时创建独特的目录
    const { courseId, unitId, lessonId } = req.params;
    const dir = path.join(__dirname, '../../uploads/public/media', courseId, unitId, lessonId);
    
    try {
      await mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    // 使用时间戳和原始文件名生成新文件名，避免重复
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 限制媒体文件大小为100MB
  },
  fileFilter: function (req, file, cb) {
    // 允许上传图片和视频
    const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const allowedVideoTypes = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mkv'];
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片格式(jpg, jpeg, png, gif, webp, svg)和视频格式(mp4, webm, ogg, mov, avi, wmv, flv, mkv)'));
    }
  }
});

/**
 * @swagger
 * /api/media/courses/{courseId}/units/{unitId}/lessons/{lessonId}/upload:
 *   post:
 *     summary: 上传媒体文件（图片或视频）
 *     tags: [媒体文件管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID，对于题库媒体使用'question-bank'
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: 单元ID，对于题库媒体使用题目分类
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课时ID，对于题库媒体使用题目类型
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               media:
 *                 type: string
 *                 format: binary
 *                 description: 要上传的媒体文件（图片或视频）
 *     responses:
 *       200:
 *         description: 媒体文件上传成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 媒体文件上传成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     originalName:
 *                       type: string
 *                       description: 原始文件名
 *                     filename:
 *                       type: string
 *                       description: 存储的文件名
 *                     path:
 *                       type: string
 *                       description: 公开访问的URL路径
 *                     fullPath:
 *                       type: string
 *                       description: 完整的文件系统路径
 *                     size:
 *                       type: number
 *                       description: 文件大小（字节）
 *                     mediaType:
 *                       type: string
 *                       enum: [image, video, other]
 *                       description: 媒体类型
 *                     uploadTime:
 *                       type: string
 *                       format: date-time
 *                       description: 上传时间
 *       400:
 *         description: 没有上传文件或格式不支持
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.post(
  '/courses/:courseId/units/:unitId/lessons/:lessonId/upload',
  auth,
  upload.single('media'),
  mediaController.uploadMedia
);

/**
 * @swagger
 * /api/media/courses/{courseId}/media:
 *   get:
 *     summary: 获取指定课程下所有公开媒体文件列表
 *     tags: [媒体文件管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID，对于题库媒体使用'question-bank'
 *     responses:
 *       200:
 *         description: 成功返回媒体文件列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 获取公开媒体文件列表成功
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                         description: 文件名
 *                       path:
 *                         type: string
 *                         description: 公开访问的URL路径
 *                       size:
 *                         type: number
 *                         description: 文件大小（字节）
 *                       mediaType:
 *                         type: string
 *                         enum: [image, video]
 *                         description: 媒体类型
 *                       uploadTime:
 *                         type: string
 *                         format: date-time
 *                         description: 上传时间
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get(
  '/courses/:courseId/media',
  auth,
  mediaController.getMediaFiles
);

/**
 * @swagger
 * /api/media/courses/{courseId}/units/{unitId}/media:
 *   get:
 *     summary: 获取指定课程、单元下所有公开媒体文件列表
 *     tags: [媒体文件管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID，对于题库媒体使用'question-bank'
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: 单元ID，对于题库媒体使用题目分类
 *     responses:
 *       200:
 *         description: 成功返回媒体文件列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/paths/~1api~1media~1courses~1{courseId}~1media/get/responses/200/content/application~1json/schema'
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get(
  '/courses/:courseId/units/:unitId/media',
  auth,
  mediaController.getMediaFiles
);

/**
 * @swagger
 * /api/media/courses/{courseId}/units/{unitId}/lessons/{lessonId}/media:
 *   get:
 *     summary: 获取指定课程、单元、课时下所有公开媒体文件列表
 *     tags: [媒体文件管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID，对于题库媒体使用'question-bank'
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: 单元ID，对于题库媒体使用题目分类
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课时ID，对于题库媒体使用题目类型
 *     responses:
 *       200:
 *         description: 成功返回媒体文件列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/paths/~1api~1media~1courses~1{courseId}~1media/get/responses/200/content/application~1json/schema'
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get(
  '/courses/:courseId/units/:unitId/lessons/:lessonId/media',
  auth,
  mediaController.getMediaFiles
);

/**
 * @swagger
 * /api/media/courses/{courseId}/units/{unitId}/lessons/{lessonId}/media/{filename}:
 *   delete:
 *     summary: 删除指定的公开媒体文件
 *     tags: [媒体文件管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课程ID，对于题库媒体使用'question-bank'
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: 单元ID，对于题库媒体使用题目分类
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *         description: 课时ID，对于题库媒体使用题目类型
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: 要删除的文件名
 *     responses:
 *       200:
 *         description: 媒体文件删除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 媒体文件删除成功
 *       401:
 *         description: 未授权
 *       404:
 *         description: 媒体文件不存在
 *       500:
 *         description: 服务器错误
 */
router.delete(
  '/courses/:courseId/units/:unitId/lessons/:lessonId/media/:filename',
  auth,
  mediaController.deleteMedia
);

module.exports = router; 