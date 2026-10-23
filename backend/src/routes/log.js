const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

/**
 * @swagger
 * /api/log/files:
 *   get:
 *     summary: 获取系统日志文件列表
 *     tags: [系统日志]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回日志文件列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: 日志文件名
 *                   size:
 *                     type: integer
 *                     description: 文件大小(字节)
 *                   lastModified:
 *                     type: string
 *                     format: date-time
 *                     description: 最后修改时间
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅管理员和教师可访问
 *       500:
 *         description: 服务器错误
 */
router.get('/files',
  auth,
  roleCheck(['admin', 'teacher']),
  logController.getLogFiles
);

/**
 * @swagger
 * /api/log/content/{filename}:
 *   get:
 *     summary: 获取指定日志文件内容
 *     tags: [系统日志]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: 日志文件名
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: 返回的最大行数
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: 起始行数偏移
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索关键词
 *     responses:
 *       200:
 *         description: 成功返回日志文件内容
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: array
 *                   items:
 *                     type: string
 *                 totalLines:
 *                   type: integer
 *                 filename:
 *                   type: string
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅管理员和教师可访问
 *       404:
 *         description: 日志文件不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/content/:filename',
  auth,
  roleCheck(['admin', 'teacher']),
  logController.getLogContent
);

/**
 * @swagger
 * /api/log/recent:
 *   get:
 *     summary: 获取实时日志
 *     tags: [系统日志]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lines
 *         schema:
 *           type: integer
 *           default: 100
 *         description: 返回的最近日志行数
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [info, warn, error, debug]
 *         description: 日志级别过滤
 *     responses:
 *       200:
 *         description: 成功返回实时日志内容
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   level:
 *                     type: string
 *                     enum: [info, warn, error, debug]
 *                   message:
 *                     type: string
 *                   meta:
 *                     type: object
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足，仅管理员和教师可访问
 *       500:
 *         description: 服务器错误
 */
router.get('/recent',
  auth,
  roleCheck(['admin', 'teacher']),
  logController.getRecentLogs
);

/**
 * @swagger
 * /api/log/download/{filename}:
 *   get:
 *     summary: 下载指定日志文件
 *     tags: [系统日志]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: 日志文件名
 *     responses:
 *       200:
 *         description: 日志文件下载
 *       404:
 *         description: 日志文件不存在
 */
router.get('/download/:filename',
  auth,
  roleCheck(['admin']),
  logController.downloadLogFile
);

/**
 * @swagger
 * /api/log/clear/{filename}:
 *   delete:
 *     summary: 清空指定日志文件
 *     tags: [系统日志]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: 日志文件名
 *     responses:
 *       200:
 *         description: 日志文件已清空
 *       404:
 *         description: 日志文件不存在
 */
router.delete('/clear/:filename',
  auth,
  roleCheck(['admin']),
  logController.clearLogFile
);

/**
 * @swagger
 * /api/log/clear-all:
 *   delete:
 *     summary: 清空所有日志文件
 *     tags: [系统日志]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 所有日志文件已清空
 */
router.delete('/clear-all',
  auth,
  roleCheck(['admin']),
  logController.clearAllLogs
);

module.exports = router; 