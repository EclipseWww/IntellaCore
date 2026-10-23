const express = require('express');
const router = express.Router({ mergeParams: true }); // 允许访问父路由的参数
const auth = require('../middleware/auth');
const {
  createUnit,
  updateUnit,
  deleteUnit,
  getUnits,
  updateUnitsOrder
} = require('../controllers/unitManagementController');

// 所有路由都需要认证
router.use(auth);

/**
 * @swagger
 * /course-management/{courseId}/units:
 *   post:
 *     tags:
 *       - 课程管理
 *       - 单元
 *     summary: 创建新单元
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
 *   get:
 *     tags:
 *       - 课程管理
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
router.route('/')
  .post(createUnit)
  .get(getUnits);

/**
 * @swagger
 * /course-management/{courseId}/units/order-units:
 *   put:
 *     tags:
 *       - 课程管理
 *       - 单元
 *     summary: 更新单元顺序
 *     description: 更新课程中单元的顺序
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
 *               - units
 *             properties:
 *               units:
 *                 type: array
 *                 description: 按顺序排列的单元ID列表
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 单元顺序更新成功
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权访问
 *       404:
 *         description: 课程不存在
 */
router.put('/order-units', updateUnitsOrder);

/**
 * @swagger
 * /course-management/{courseId}/units/{id}:
 *   put:
 *     tags:
 *       - 课程管理
 *       - 单元
 *     summary: 更新单元
 *     description: 更新特定单元的信息
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
 *         name: id
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
 *         description: 课程或单元不存在
 *   delete:
 *     tags:
 *       - 课程管理
 *       - 单元
 *     summary: 删除单元
 *     description: 删除特定单元
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
 *         name: id
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
 *         description: 课程或单元不存在
 */
router.route('/:id')
  .put(updateUnit)
  .delete(deleteUnit);

module.exports = router;
