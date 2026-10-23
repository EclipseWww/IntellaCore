const mongoose = require('mongoose');
const { roundPoints } = require('../utils/pointPrecision');

/**
 * @swagger
 * components:
 *   schemas:
 *     PointTransaction:
 *       type: object
 *       required:
 *         - amount
 *         - type
 *       properties:
 *         amount:
 *           type: number
 *           description: 积分数量，正数表示获得，负数表示消费
 *         type:
 *           type: string
 *           enum: [task_completion, quiz_reward, course_completion, shop_purchase, system_reward, other]
 *           description: 交易类型
 *         description:
 *           type: string
 *           description: 交易描述
 *         relatedId:
 *           type: string
 *           description: 相关ID，如商品ID、课程ID等
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: 交易时间
 * 
 *     Badge:
 *       type: object
 *       required:
 *         - type
 *         - name
 *       properties:
 *         type:
 *           type: string
 *           enum: [course_completion, study_streak, perfect_score, fast_learner, helper, active_participant]
 *           description: 徽章类型
 *         name:
 *           type: string
 *           description: 徽章名称
 *         description:
 *           type: string
 *           description: 徽章描述
 *         earnedAt:
 *           type: string
 *           format: date-time
 *           description: 获得时间
 * 
 *     Achievement:
 *       type: object
 *       required:
 *         - studentId
 *       properties:
 *         _id:
 *           type: string
 *           description: 成就ID
 *         studentId:
 *           type: string
 *           description: 学生ID
 *         totalPoints:
 *           type: number
 *           description: 总积分
 *         level:
 *           type: number
 *           description: 当前等级
 *         badges:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Badge'
 *           description: 获得的徽章列表
 *         pointTransactions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PointTransaction'
 *           description: 积分交易记录
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 */

const badgeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'course_completion',
      'study_streak',
      'perfect_score',
      'fast_learner',
      'helper',
      'active_participant'
    ]
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  earnedAt: {
    type: Date,
    default: Date.now
  }
});

const pointTransactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'task_completion',
      'quiz_reward',
      'quiz_reward_revoked',
      'course_completion',
      'shop_purchase',
      'system_reward',
      'crowdfunding',
      'task_completion_revoked',
      'free_practice',
      'other'
    ]
  },
  description: {
    type: String,
    default: ''
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const achievementSchema = new mongoose.Schema({
  quizAwards: { type: Map, of: Number, default: {}, select: false },
  shopReceipts: { type: [mongoose.Schema.Types.Mixed], default: [], select: false },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  assignmentPoints: { type: Map, of: Number, default: {} },
  totalPoints: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  badges: [badgeSchema],
  pointTransactions: [pointTransactionSchema]
}, {
  timestamps: true
});

// Clean legacy floating-point tails in API responses without changing query values used by CAS.
achievementSchema.set('toJSON',{transform(doc,ret){
 ret.totalPoints=roundPoints(ret.totalPoints);
 for(const transaction of ret.pointTransactions || [])transaction.amount=roundPoints(transaction.amount);
 return ret;
}});

// 添加索引
achievementSchema.index({ studentId: 1 });
achievementSchema.index({ 'badges.type': 1 });
achievementSchema.index({ totalPoints: -1 });
achievementSchema.index({ level: -1 });
achievementSchema.index({ 'pointTransactions.timestamp': -1 });

// 静态方法: 添加积分交易记录
achievementSchema.statics.addPointTransaction = async function (studentId, amount, type, description = '', relatedId = null) {
  amount=roundPoints(amount);
  // Use schema casting/validation before an aggregation update, which Mongoose does not cast.
  const draft=new this({studentId,pointTransactions:[{amount,type,description,relatedId,timestamp:new Date()}]});
  const error=draft.validateSync();if(error)throw error;
  const transaction=draft.pointTransactions[0].toObject();
  // Round inside the atomic update so concurrent awards cannot overwrite one another.
  return this.findOneAndUpdate({studentId},[{$set:{
    totalPoints:{$round:[{$add:[{$ifNull:['$totalPoints',0]},amount]},2]},
    pointTransactions:{$slice:[{$concatArrays:[{$literal:[transaction]},{$ifNull:['$pointTransactions',[]]}]},100]},
    level:{$ifNull:['$level',1]},badges:{$ifNull:['$badges',[]]},assignmentPoints:{$ifNull:['$assignmentPoints',{}]}
  }}],{new:true,upsert:true});
};

// 静态方法: 获取学生积分
achievementSchema.statics.getStudentPoints = async function (studentId) {
  const achievement = await this.findOne({ studentId });
  return achievement ? roundPoints(achievement.totalPoints) : 0;
};

// 实例方法: 获取积分余额
achievementSchema.methods.getPointBalance = function () {
  return roundPoints(this.totalPoints);
};

// 实例方法: 获取最近的积分交易
achievementSchema.methods.getRecentTransactions = function (limit = 10) {
  return this.pointTransactions.slice(0, limit);
};

module.exports = mongoose.model('Achievement', achievementSchema);
