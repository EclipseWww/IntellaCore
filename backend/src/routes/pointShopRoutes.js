const express = require('express');
const router = express.Router();
const pointShopController = require('../controllers/pointShopController');


/**
 * @swagger
 * tags:
 *   name: PointShop
 *   description: 积分商店管理
 */

/**
 * @swagger
 * /api/point-shop/items:
 *   get:
 *     summary: 获取所有积分商店商品
 *     tags: [PointShop]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功获取商品列表
 *       500:
 *         description: 服务器错误
 */
router.get('/items', pointShopController.getAllItems);

/**
 * @swagger
 * /api/point-shop/items/{itemId}:
 *   get:
 *     summary: 获取单个商品详情
 *     tags: [PointShop]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: 商品ID
 *     responses:
 *       200:
 *         description: 成功获取商品详情
 *       404:
 *         description: 商品不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/items/:itemId', pointShopController.getItemById);

/**
 * @swagger
 * /api/point-shop/items/{itemId}/redeem:
 *   post:
 *     summary: 兑换商品
 *     tags: [PointShop]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: 商品ID
 *     responses:
 *       200:
 *         description: 兑换成功
 *       400:
 *         description: 积分不足或商品已下架
 *       404:
 *         description: 商品不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/items/:itemId/redeem', pointShopController.redeemItem);

/**
 * @swagger
 * /api/point-shop/redemptions:
 *   get:
 *     summary: 获取学生的兑换记录
 *     tags: [PointShop]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功获取兑换记录
 *       500:
 *         description: 服务器错误
 */
router.get('/redemptions', pointShopController.getStudentRedemptions);

/**
 * @swagger
 * /api/point-shop/redemptions/{recordId}/use-network-time:
 *   post:
 *     summary: 使用网络时间
 *     tags: [PointShop]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *         description: 兑换记录ID
 *     responses:
 *       200:
 *         description: 成功使用网络时间
 *       400:
 *         description: 记录不是网络时间类型或已使用/过期
 *       404:
 *         description: 兑换记录不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/redemptions/:recordId/use-network-time', pointShopController.useNetworkTime);

/**
 * @swagger
 * /api/point-shop/redemptions/{recordId}/use-game:
 *   post:
 *     summary: 使用游戏
 *     tags: [PointShop]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *         description: 兑换记录ID
 *     responses:
 *       200:
 *         description: 成功使用游戏
 *       400:
 *         description: 记录不是游戏类型或已使用/过期
 *       404:
 *         description: 兑换记录不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/redemptions/:recordId/use-game', pointShopController.useGame);

// ===== 管理员路由 =====

/**
 * @swagger
 * /api/point-shop/admin/items:
 *   post:
 *     summary: 创建新商品
 *     tags: [PointShop]
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
 *               - pointCost
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               pointCost:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [network_time, game, badge, virtual_item]
 *               image:
 *                 type: string
 *               duration:
 *                 type: number
 *               gameUrl:
 *                 type: string
 *               stock:
 *                 type: number
 *     responses:
 *       201:
 *         description: 商品创建成功
 *       403:
 *         description: 无权操作
 *       500:
 *         description: 服务器错误
 */
router.post('/admin/items', pointShopController.createItem);

/**
 * @swagger
 * /api/point-shop/admin/items/{itemId}:
 *   put:
 *     summary: 更新商品
 *     tags: [PointShop]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: 商品ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               pointCost:
 *                 type: number
 *               image:
 *                 type: string
 *               duration:
 *                 type: number
 *               gameUrl:
 *                 type: string
 *               stock:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 商品更新成功
 *       403:
 *         description: 无权操作
 *       404:
 *         description: 商品不存在
 *       500:
 *         description: 服务器错误
 *   delete:
 *     summary: 删除商品
 *     tags: [PointShop]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: 商品ID
 *     responses:
 *       200:
 *         description: 商品删除成功
 *       403:
 *         description: 无权操作
 *       404:
 *         description: 商品不存在
 *       500:
 *         description: 服务器错误
 */
router.put('/admin/items/:itemId', pointShopController.updateItem);
router.delete('/admin/items/:itemId', pointShopController.deleteItem);

/**
 * @swagger
 * /api/point-shop/admin/student-redemptions:
 *   get:
 *     summary: 获取所有学生兑换记录（管理员功能）
 *     tags: [PointShop]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *         description: 按学生ID筛选
 *       - in: query
 *         name: itemType
 *         schema:
 *           type: string
 *           enum: [network_time, game, badge, virtual_item]
 *         description: 按商品类型筛选
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, expired]
 *         description: 按状态筛选
 *     responses:
 *       200:
 *         description: 成功获取所有学生兑换记录
 *       403:
 *         description: 无权操作
 *       500:
 *         description: 服务器错误
 */
router.get('/admin/student-redemptions', pointShopController.getAllStudentRedemptions);

module.exports = router; 