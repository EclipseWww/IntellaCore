const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const auth = require('../middleware/auth');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`创建上传临时目录: ${uploadDir}`);
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/temp');
  },
  filename: function (req, file, cb) {
    cb(null, `backup-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 限制文件大小为500MB
});

// 需要管理员权限的路由
router.use(auth);
router.use((req, res, next) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ message: '需要管理员权限' });
  }
  next();
});

/**
 * @swagger
 * /backup/export:
 *   get:
 *     tags:
 *       - 系统管理
 *       - 备份恢复
 *     summary: 导出系统备份
 *     description: 导出系统数据备份，支持通过查询参数选择要备份的内容
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeAssignments
 *         schema:
 *           type: boolean
 *         description: 是否包含作业数据
 *     responses:
 *       200:
 *         description: 成功导出备份
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       500:
 *         description: 服务器错误
 */
router.get('/export', backupController.exportBackup);

/**
 * @swagger
 * /backup/import:
 *   post:
 *     tags:
 *       - 系统管理
 *       - 备份恢复
 *     summary: 导入系统备份
 *     description: 从备份文件导入系统数据，支持通过表单字段选择要导入的内容
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - backupFile
 *             properties:
 *               backupFile:
 *                 type: string
 *                 format: binary
 *                 description: 备份文件（ZIP格式）
 *               includeAssignments:
 *                 type: boolean
 *                 description: 是否包含作业数据
 *     responses:
 *       200:
 *         description: 成功导入备份
 *       400:
 *         description: 请求参数错误或备份文件格式错误
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       500:
 *         description: 服务器错误
 */
router.post('/import', upload.single('backupFile'), backupController.importBackup);

/**
 * @swagger
 * /backup/list:
 *   get:
 *     tags:
 *       - 系统管理
 *       - 备份恢复
 *     summary: 获取备份列表
 *     description: 获取所有备份文件的列表，包括文件名、大小和创建时间
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回备份列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 backups:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         description: 备份文件名
 *                       size:
 *                         type: number
 *                         description: 文件大小(字节)
 *                       sizeFormatted:
 *                         type: string
 *                         description: 格式化的文件大小
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: 创建时间
 *                       modifiedAt:
 *                         type: string
 *                         format: date-time
 *                         description: 修改时间
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       500:
 *         description: 服务器错误
 */
router.get('/list', backupController.getBackupList);

/**
 * @swagger
 * /backup/{filename}:
 *   delete:
 *     tags:
 *       - 系统管理
 *       - 备份恢复
 *     summary: 删除备份文件
 *     description: 删除指定的备份文件
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: 要删除的备份文件名
 *     responses:
 *       200:
 *         description: 备份文件删除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 filename:
 *                   type: string
 *                 size:
 *                   type: string
 *       400:
 *         description: 无效的文件名
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 备份文件不存在
 *       500:
 *         description: 服务器错误
 */
router.delete('/:filename', backupController.deleteBackup);

/**
 * @swagger
 * /backup/create:
 *   post:
 *     tags:
 *       - 系统管理
 *       - 备份恢复
 *     summary: 创建系统备份
 *     description: 创建系统备份文件并保存到服务器，返回备份信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeAssignments
 *         schema:
 *           type: boolean
 *         description: 是否包含作业数据
 *     responses:
 *       200:
 *         description: 成功创建备份
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 backup:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     size:
 *                       type: number
 *                     sizeFormatted:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       500:
 *         description: 服务器错误
 */
router.post('/create', backupController.createBackup);

/**
 * @swagger
 * /backup/download/{filename}:
 *   get:
 *     tags:
 *       - 系统管理
 *       - 备份恢复
 *     summary: 下载备份文件
 *     description: 下载指定的备份文件
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: 要下载的备份文件名
 *     responses:
 *       200:
 *         description: 成功下载备份文件
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: 无效的文件名
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 备份文件不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/download/:filename', backupController.downloadBackup);

module.exports = router;