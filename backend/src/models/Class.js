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

const isElective = doc => doc && doc.type === 'elective';

const classSchema = new mongoose.Schema({
  // 班级类型：admin=行政班（学生账号归属的班级）；elective=教学班（社团课、选修课，学生可来自不同班级和年级）
  type: {
    type: String,
    enum: ['admin', 'elective'],
    default: 'admin'
  },
  // 教学班名称，如“Python 社团”（行政班不用）
  title: { type: String, trim: true, default: undefined },
  // 教学班学期，如“2026-2027学年第一学期”（仅用于显示与归档）
  term: { type: String, trim: true, default: undefined },
  // 教学班面向的年级（仅用于显示，可为空，表示不限）
  grades: { type: [Number], default: undefined },
  // 教学班人数上限（0 或空表示不限）
  capacity: { type: Number, min: 0, default: undefined },
  grade: {
    type: Number,
    required: function () { return !isElective(this); },
    validate: {
      validator: function (v) {
        if (v == null) return true;
        // 验证为四位数年份(2000-2099)
        return /^20\d{2}$/.test(String(v));
      },
      message: props => `${props.value}不是有效的年级格式。年级必须是四位数年份，例如：2023、2024`
    }
  },
  name: {
    type: Number,
    required: function () { return !isElective(this); }
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 共同执教的教师（仅教学班）：与负责教师（teacher）一样可以上课、管理成员、批阅；
  // 修改班级信息、归档、删除和管理共同执教教师只能由负责教师操作
  coTeachers: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: undefined
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
  // 教师最近一次手动选择课时的时间（课表据此判断手动上课时是否沿用教师所选课时）
  lessonSelectedAt: { type: Date, default: null },
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
  },
  // 教师提前开放游戏中心（不必等登录满 35 分钟），到这个时间自动失效
  gameOpenUntil: { type: Date, default: null }
}, {
  timestamps: true
});

// 行政班的年级 + 班号唯一；教学班没有年级和班号，不参与该约束。
// 旧版本的 grade_1_name_1 唯一索引不区分班级类型，启动时由 migrateClassIndexes 删除。
classSchema.index(
  { grade: 1, name: 1 },
  { unique: true, name: 'grade_name_unique_admin', partialFilterExpression: { grade: { $type: 'number' }, name: { $type: 'number' } } }
);
classSchema.index({ type: 1, status: 1 });
classSchema.index({ coTeachers: 1 });

classSchema.statics.isElective = isElective;

const Class = mongoose.model('Class', classSchema);

module.exports = Class; 