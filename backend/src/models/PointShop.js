const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     PointShopItem:
 *       type: object
 *       required:
 *         - name
 *         - pointCost
 *         - type
 *       properties:
 *         _id:
 *           type: string
 *           description: 商品ID
 *         name:
 *           type: string
 *           description: 商品名称
 *         description:
 *           type: string
 *           description: 商品描述
 *         pointCost:
 *           type: number
 *           description: 所需积分
 *         type:
 *           type: string
 *           enum: [network_time, game, badge, virtual_item]
 *           description: 商品类型
 *         image:
 *           type: string
 *           description: 商品图片
 *         duration:
 *           type: number
 *           description: 上网时间（分钟），仅当type为network_time时有效
 *         gameUrl:
 *           type: string
 *           description: 游戏链接，仅当type为game时有效
 *         stock:
 *           type: number
 *           description: 库存数量，-1表示无限
 *         isActive:
 *           type: boolean
 *           description: 是否激活
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 */

const pointShopItemSchema = new mongoose.Schema({
  shopReceipts: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
  shopRefundIds: { type: [String], default: [], select: false },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  pointCost: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['network_time', 'game', 'badge', 'virtual_item'],
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  duration: {
    type: Number,
    min: 0,
    default: 0 // 上网时间，以分钟为单位
  },
  gameUrl: {
    type: String,
    default: ''
  },
  stock: {
    type: Number,
    default: -1, // -1表示无限
    validate: { validator: value => Number.isInteger(value) && value >= -1, message: '库存必须是 -1 或非负整数' },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null  // 可为空，兼容旧数据
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

/**
 * @swagger
 * components:
 *   schemas:
 *     RedemptionRecord:
 *       type: object
 *       required:
 *         - studentId
 *         - itemId
 *         - pointCost
 *       properties:
 *         _id:
 *           type: string
 *           description: 兑换记录ID
 *         studentId:
 *           type: string
 *           description: 学生ID
 *         itemId:
 *           type: string
 *           description: 商品ID
 *         itemName:
 *           type: string
 *           description: 商品名称
 *         itemType:
 *           type: string
 *           description: 商品类型
 *         pointCost:
 *           type: number
 *           description: 消耗积分
 *         status:
 *           type: string
 *           enum: [pending, completed, expired]
 *           description: 兑换状态
 *         redeemTime:
 *           type: string
 *           format: date-time
 *           description: 兑换时间
 *         useTime:
 *           type: string
 *           format: date-time
 *           description: 使用时间
 */

const redemptionRecordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PointShopItem',
    required: true
  },
  itemName: {
    type: String,
    required: true
  },
  itemType: {
    type: String,
    required: true
  },
  pointCost: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    default: 0,
    description: '商品时长（分钟），适用于上网时间和游戏时间'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'expired'],
    default: 'pending'
  },
  redeemTime: {
    type: Date,
    default: Date.now
  },
  useTime: {
    type: Date,
    description: '使用时间，记录学生点击使用按钮的时间'
  }
}, {
  timestamps: true
});

pointShopItemSchema.index({ type: 1 });
pointShopItemSchema.index({ pointCost: 1 });
pointShopItemSchema.index({ createdBy: 1 });

redemptionRecordSchema.index({ studentId: 1 });
redemptionRecordSchema.index({ itemId: 1 });
redemptionRecordSchema.index({ status: 1 });
redemptionRecordSchema.index({ redeemTime: -1 });

const PointShopItem = mongoose.model('PointShopItem', pointShopItemSchema);
const RedemptionRecord = mongoose.model('RedemptionRecord', redemptionRecordSchema);

module.exports = { PointShopItem, RedemptionRecord };
