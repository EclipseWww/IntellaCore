const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * @swagger
 * components:
 *   schemas:
 *     Crowdfunding:
 *       type: object
 *       required:
 *         - title
 *         - targetPoints
 *         - type
 *       properties:
 *         _id:
 *           type: string
 *           description: 众筹ID
 *         title:
 *           type: string
 *           description: 众筹活动标题
 *         description:
 *           type: string
 *           description: 众筹活动描述
 *         targetPoints:
 *           type: number
 *           description: 目标积分数
 *         currentPoints:
 *           type: number
 *           description: 当前已筹集积分数
 *         type:
 *           type: string
 *           enum: [network_time, game, other]
 *           description: 众筹类型
 *         reward:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [network_time, game, other]
 *               description: 奖励类型
 *             duration:
 *               type: number
 *               description: 奖励时间（分钟）
 *             description:
 *               type: string
 *               description: 奖励描述
 *         image:
 *           type: string
 *           description: 活动图片
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: 开始时间
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: 结束时间
 *         status:
 *           type: string
 *           enum: [pending, active, ready_to_complete, completed, expired]
 *           description: 众筹状态
 *         createdBy:
 *           type: string
 *           description: 创建者ID
 *         accessibleClasses:
 *           type: array
 *           items:
 *             type: string
 *           description: 可访问此众筹的班级ID列表
 *         isPublic:
 *           type: boolean
 *           description: 是否对所有班级开放
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 * 
 *     CrowdfundingContribution:
 *       type: object
 *       required:
 *         - crowdfundingId
 *         - studentId
 *         - points
 *       properties:
 *         _id:
 *           type: string
 *           description: 贡献记录ID
 *         crowdfundingId:
 *           type: string
 *           description: 众筹活动ID
 *         studentId:
 *           type: string
 *           description: 学生ID
 *         points:
 *           type: number
 *           description: 贡献积分数
 *         message:
 *           type: string
 *           description: 留言
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: 贡献时间
 */

// 众筹模型
const crowdfundingSchema = new mongoose.Schema({
  reservedPoints: { type: Number, default: 0, select: false },
  contributionReceipts: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
  settledContributionIds: { type: [String], default: [], select: false },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  targetPoints: {
    type: Number,
    required: true,
    min: 100 // 最低众筹100积分
  },
  currentPoints: {
    type: Number,
    default: 0
  },
  type: {
    type: String,
    enum: ['network_time', 'game', 'other'],
    required: true
  },
  reward: {
    type: {
      type: String,
      enum: ['network_time', 'game', 'other'],
    },
    duration: {
      type: Number,
      min: 0
    },
    description: String
  },
  image: {
    type: String,
    default: ''
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'ready_to_complete', 'completed', 'expired'],
    default: 'pending'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 替换多个班级为单个班级
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  contributionsCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 众筹贡献记录模型
const crowdfundingContributionSchema = new mongoose.Schema({
  crowdfundingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Crowdfunding',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  points: {
  type: Number,
  required: true,
  min: 0.01 // 允许封顶时产生不足1分的实际贡献
  },
  message: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 添加索引
crowdfundingSchema.index({ status: 1 });
crowdfundingSchema.index({ endDate: 1 });
crowdfundingSchema.index({ createdBy: 1 });
crowdfundingSchema.index({ currentPoints: 1 });
crowdfundingSchema.index({ 'participants': 1 });

crowdfundingContributionSchema.index({ crowdfundingId: 1 });
crowdfundingContributionSchema.index({ studentId: 1 });
crowdfundingContributionSchema.index({ timestamp: -1 });

// 静态方法：添加贡献
crowdfundingSchema.statics.addContribution = async function(crowdfundingId, studentId, points, message = '') {
  return require('../services/crowdfundingOperationService').contribute(crowdfundingId, studentId, points, message);
};

// 实例方法：检查众筹状态
crowdfundingSchema.methods.checkStatus = async function() {
  const now = new Date();
  
  // 如果已过期但状态未更新
  if (now > this.endDate && (this.status === 'active' || this.status === 'pending')) {
    this.status = 'expired';
    await this.save();
    return 'expired';
  }
  
  // 如果达到目标但状态未更新 - 修改为ready_to_complete状态
  if (this.currentPoints >= this.targetPoints && this.status === 'active') {
    this.status = 'ready_to_complete';
    await this.save();
    return 'ready_to_complete';
  }
  
  // 如果处于待启动状态但已到开始时间
  if (this.status === 'pending' && now >= this.startDate) {
    this.status = 'active';
    await this.save();
    return 'active';
  }
  
  return this.status;
};

const Crowdfunding = mongoose.model('Crowdfunding', crowdfundingSchema);
const CrowdfundingContribution = mongoose.model('CrowdfundingContribution', crowdfundingContributionSchema);

module.exports = { Crowdfunding, CrowdfundingContribution }; 