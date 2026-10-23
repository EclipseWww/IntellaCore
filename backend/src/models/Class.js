const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Class:
 *       type: object
 *       required:
 *         - grade
 *         - name
 *         - teacher
 *       properties:
 *         _id:
 *           type: string
 *           description: 班级ID
 *         grade:
 *           type: number
 *           description: 年级（四位数年份，如2023）
 *         name:
 *           type: number
 *           description: 班级号
 *         teacher:
 *           type: string
 *           description: 班主任ID
 *         allowIpChange:
 *           type: boolean
 *           description: 是否允许学生更换IP登录
 *         isInClass:
 *           type: boolean
 *           description: 班级是否在上课中
 *         scheduledEndTime:
 *           type: string
 *           format: date-time
 *           description: 预定下课时间
 *         allowAiUsage:
 *           type: boolean
 *           description: 是否允许学生使用AI功能
 *         currentCourse:
 *           type: string
 *           description: 当前正在学习的课程ID
 *         currentUnit:
 *           type: string
 *           description: 当前正在学习的单元ID
 *         currentLesson:
 *           type: string
 *           description: 当前正在学习的课时ID
 *         autoRedirectToLesson:
 *           type: boolean
 *           description: 是否自动重定向到当前课时
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 */

const classSchema = new mongoose.Schema({
  grade: {
    type: Number,
    required: true,
    validate: {
      validator: function (v) {
        // 验证为四位数年份(2000-2099)
        return /^20\d{2}$/.test(String(v));
      },
      message: props => `${props.value}不是有效的年级格式。年级必须是四位数年份，例如：2023、2024`
    }
  },
  name: {
    type: Number,
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  allowIpChange: {
    type: Boolean,
    default: false
  },
  isInClass: {
    type: Boolean,
    default: false
  },
  scheduledEndTime: { type: Date, default: null },
  allowAiUsage: {
    type: Boolean,
    default: false
  },
  currentCourse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null
  },
  currentUnit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseUnit',
    default: null
  },
  currentLesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    default: null
  },
  autoRedirectToLesson: {
    type: Boolean,
    default: false
  },
  // 班级归档相关字段（用于毕业/升年级处理）
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },
  archivedAt: {      // 归档时间
    type: Date,
    default: null
  },
  graduationYear: {  // 毕业学年（如 "2025-2026"）
    type: String,
    default: null
  },
  selectedClassroomLayout: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassroomLayout',
    default: null
  },
  // 自由练习配置
  freePracticeSettings: {
    isEnabled: { type: Boolean, default: true }, // 是否开启自由练习
    dailyLimit: { type: Number, default: 0 }, // 每日练习次数限制（0为不限）
    timeLimit: { type: Number, default: 300 }, // 单次练习时长（秒）
    questionCount: { type: Number, default: 10 }, // 每次题目数量
    pointsPerQuestion: { type: Number, default: 5 }, // 每题积分
    // 题目筛选条件
    allowedTypes: {
      type: [String],
      default: ['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE'] // 默认允许的题型，增加了多选
    },
    allowedTags: [String], // 允许的标签（空表示不限制）
    difficultyRange: { // 难度范围
      min: { type: Number, default: 1 },
      max: { type: Number, default: 5 }
    },
    // 是否只允许练习指定知识点（QuestionBank modules）
    knowledgeModules: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseUnit' // 或者关联到特定的知识点模型，此处暂用CourseUnit示例，实际可能需要标签匹配
    }]
  },
  allowGameCenter: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// 添加复合索引确保班级名称在同一年级内唯一
classSchema.index({ grade: 1, name: 1 }, { unique: true });

const Class = mongoose.model('Class', classSchema);

module.exports = Class; 