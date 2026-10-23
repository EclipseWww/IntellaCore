const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/downloadController');
const auth = require('../middleware/auth');

/**
 * @swagger
 * /api/download/{fileType}/{filePath}:
 *   get:
 *     summary: 统一文件下载接口
 *     tags: [文件下载]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [assignment, resource, preview]
 *         description: 文件类型（作业、资源或预览）
 *       - in: path
 *         name: filePath
 *         required: true
 *         schema:
 *           type: string
 *         description: 文件相对路径（在存储中的位置）
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
 *       403:
 *         description: 权限不足
 *       404:
 *         description: 文件未找到
 *       500:
 *         description: 服务器错误
 */
// 统一下载路由
// fileType: assignment, resource, preview
// filePath: 文件的相对路径
router.get('/:fileType/*', auth, (req, res) => {
  req.params.filePath = req.params[0];
  downloadController.downloadFile(req, res);
});

module.exports = router; 