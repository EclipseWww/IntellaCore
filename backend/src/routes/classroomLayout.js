const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const classroomLayoutController = require('../controllers/classroomLayoutController');

/**
 * @swagger
 * /api/classroom-layouts:
 *   get:
 *     summary: 获取所有机房布局列表
 *     tags: [机房布局]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回机房布局列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                     description: 布局名称
 *                   rows:
 *                     type: integer
 *                     description: 行数
 *                   columns:
 *                     type: integer
 *                     description: 列数
 *                   description:
 *                     type: string
 *                     description: 布局描述
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/', auth, classroomLayoutController.getLayouts);

/**
 * @swagger
 * /api/classroom-layouts:
 *   post:
 *     summary: 创建新的机房布局
 *     tags: [机房布局]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - rows
 *               - columns
 *             properties:
 *               name:
 *                 type: string
 *                 description: 布局名称
 *               rows:
 *                 type: integer
 *                 description: 行数
 *               columns:
 *                 type: integer
 *                 description: 列数
 *               description:
 *                 type: string
 *                 description: 布局描述
 *               positions:
 *                 type: array
 *                 description: 座位位置配置
 *                 items:
 *                   type: object
 *                   properties:
 *                     row:
 *                       type: integer
 *                     column:
 *                       type: integer
 *                     disabled:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: 成功创建机房布局
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 layout:
 *                   type: object
 *       400:
 *         description: 无效的请求数据
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.post('/', auth, classroomLayoutController.createLayout);

/**
 * @swagger
 * /api/classroom-layouts/{id}:
 *   get:
 *     summary: 获取单个机房布局详情
 *     tags: [机房布局]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 机房布局ID
 *     responses:
 *       200:
 *         description: 成功返回机房布局详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 rows:
 *                   type: integer
 *                 columns:
 *                   type: integer
 *                 description:
 *                   type: string
 *                 positions:
 *                   type: array
 *                   items:
 *                     type: object
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: 未授权
 *       404:
 *         description: 未找到机房布局
 *       500:
 *         description: 服务器错误
 */
router.get('/:id', auth, classroomLayoutController.getLayout);

/**
 * @swagger
 * /api/classroom-layouts/{id}:
 *   put:
 *     summary: 更新机房布局
 *     tags: [机房布局]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 机房布局ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 布局名称
 *               rows:
 *                 type: integer
 *                 description: 行数
 *               columns:
 *                 type: integer
 *                 description: 列数
 *               description:
 *                 type: string
 *                 description: 布局描述
 *               positions:
 *                 type: array
 *                 description: 座位位置配置
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: 成功更新机房布局
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 layout:
 *                   type: object
 *       400:
 *         description: 无效的请求数据
 *       401:
 *         description: 未授权
 *       404:
 *         description: 未找到机房布局
 *       500:
 *         description: 服务器错误
 */
router.put('/:id', auth, classroomLayoutController.updateLayout);

/**
 * @swagger
 * /api/classroom-layouts/{id}:
 *   delete:
 *     summary: 删除机房布局
 *     tags: [机房布局]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 机房布局ID
 *     responses:
 *       200:
 *         description: 成功删除机房布局
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授权
 *       404:
 *         description: 未找到机房布局
 *       500:
 *         description: 服务器错误
 */
router.delete('/:id', auth, classroomLayoutController.deleteLayout);

module.exports = router; 