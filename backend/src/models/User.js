const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginHistory:
 *       type: object
 *       properties:
 *         ip:
 *           type: string
 *           description: 登录IP地址
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: 登录时间
 *         userAgent:
 *           type: string
 *           description: 用户浏览器信息
 *
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - password
 *         - name
 *         - role
 *       properties:
 *         _id:
 *           type: string
 *           description: 用户ID
 *         username:
 *           type: string
 *           description: 用户名（学生使用学号，教师使用工号）
 *         name:
 *           type: string
 *           description: 用户真实姓名
 *         role:
 *           type: string
 *           enum: [student, teacher, admin]
 *           description: 用户角色
 *         seatNumber:
 *           type: string
 *           description: 座位号（例如：A1, B2等）
 *         gender:
 *           type: string
 *           enum: [male, female, other]
 *           description: 性别
 *         classId:
 *           type: string
 *           description: 所属班级ID
 *         avatar:
 *           type: string
 *           description: 头像URL
 *         isActive:
 *           type: boolean
 *           description: 账户是否激活
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           description: 最后登录时间
 *         loginHistory:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LoginHistory'
 *           description: 登录历史记录
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 */

const loginHistorySchema = new mongoose.Schema({
  ip: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  userAgent: String
}, { _id: false });

const userSchema = new mongoose.Schema({
  usedGameRedemptions: { type: [mongoose.Schema.Types.ObjectId], default: [], select: false },
  username: {  // 学生使用学号，教师使用工号
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  seatNumber: {  // 座位号（例如：A1, B2 等）
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  gender: {  // 性别
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'other'
  },
  classId: {  // 班级ID
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: null
  },
  avatar: {  // 头像URL
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  // 学生单点登录会话字段
  sessionId: {
    type: String,
    default: null
  },
  sessionExpiresAt: {
    type: Date,
    default: null
  },
  // 学生游戏剩余时长（秒）
  gameTimeRemainingSeconds: {
    type: Number,
    default: 0,
    min: 0
  },
  loginHistory: [loginHistorySchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 密码加密中间件
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 验证密码方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// 记录登录历史的方法
userSchema.methods.addLoginRecord = async function(ip, userAgent) {
  this.lastLogin = new Date();
  this.loginHistory.unshift({ ip, userAgent });
  
  // 只保留最近的10条登录记录
  if (this.loginHistory.length > 10) {
    this.loginHistory = this.loginHistory.slice(0, 10);
  }
  
  return this.save();
};

// username 的 unique: true 已声明唯一索引；不要再声明同名的普通索引。
// 旧数据库中的 username_1 是唯一索引，重复声明会导致 User.init() 失败。
userSchema.index({ role: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
