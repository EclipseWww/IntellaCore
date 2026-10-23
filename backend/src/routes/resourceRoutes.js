const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const resourceController = require('../controllers/resourceController');
const { promisify } = require('util');
const fs = require('fs');
const mkdir = promisify(fs.mkdir);

// 配置 multer
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    // 为每个课程/单元/课时创建独特的目录
    const { courseId, unitId, lessonId } = req.params;
    const dir = path.join(__dirname, '../../uploads/resources', courseId, unitId, lessonId);
    
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
    fileSize: (process.env.MAX_RESOURCE_FILE_SIZE || 50) * 1024 * 1024 // 从环境变量读取，默认50MB
  },
  fileFilter: function (req, file, cb) {
    // 放开常见文档与代码文本类：含 txt、c、cpp、py 等
    const allowedExts = [
      '.doc', '.docx', '.pdf', '.ppt', '.pptx', '.xls', '.xlsx',
      '.zip', '.rar', '.txt', '.py', '.c', '.cpp',
      '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.avi', '.mp3', '.wav'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      return cb(null, true);
    }
    return cb(new Error('不支持的文件类型'));
  }
});

// 所有路由都需要认证
router.use(auth);

/**
 * @swagger
 * /api/resources/courses/{courseId}/units/{unitId}/lessons/{lessonId}/activities/resources:
 *   post:
 *     summary: 上传活动资源文件
 *     tags: [资源管理]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: 要上传的资源文件
 *               title:
 *                 type: string
 *                 description: 资源标题
 *               description:
 *                 type: string
 *                 description: 资源描述
 *               activityId:
 *                 type: string
 *                 description: 关联的活动ID
 *     responses:
 *       201:
 *         description: 成功上传资源文件
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 resource:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     filename:
 *                       type: string
 *                     originalname:
 *                       type: string
 *                     path:
 *                       type: string
 *                     size:
 *                       type: integer
 *                     mimetype:
 *                       type: string
 *       400:
 *         description: 无效请求，可能是文件格式不支持或超过大小限制
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.post(
  '/courses/:courseId/units/:unitId/lessons/:lessonId/activities/resources',
  upload.single('file'),
  resourceController.uploadActivityResource
);

/**
 * @swagger
 * /api/resources/resources/{filename}:
 *   get:
 *     summary: 下载资源文件
 *     tags: [资源管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: 资源文件名
 *     responses:
 *       200:
 *         description: 成功返回文件流
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: 未授权
 *       404:
 *         description: 资源文件不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/resources/:filename', auth, resourceController.downloadResource);

/**
 * @swagger
 * /api/resources/courses/{courseId}/units/{unitId}/lessons/{lessonId}/resources/{filename}:
 *   delete:
 *     summary: 删除资源文件
 *     tags: [资源管理]
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
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: 资源文件名
 *     responses:
 *       200:
 *         description: 成功删除资源文件
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: 成功删除信息
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 资源文件不存在
 *       500:
 *         description: 服务器错误
 */
router.delete(
  '/courses/:courseId/units/:unitId/lessons/:lessonId/resources/:filename',
  resourceController.deleteResource
);

module.exports = router;
