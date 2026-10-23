const mongoose = require('mongoose');

const quizSubmissionSchema = new mongoose.Schema({
  attemptKey: { type: String },
  attemptSlot: { type: Number },
  pointsPending: { type: Boolean, default: false },
  pointsTarget: Number,
  pointsBaseline: Number,
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 固定的题目顺序（存储原始题目ID数组，在开始答题时确定）
  questionOrder: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  // 选项随机化映射（题目ID -> 选项ID数组，仅在启用选项随机时使用）
  optionOrderMap: {
    type: Map,
    of: [mongoose.Schema.Types.ObjectId],
    default: new Map()
  },
  // 最后保存进度的时间
  lastSaveTime: {
    type: Date,
    default: null
  },
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    // ========== 版本控制字段 ==========
    // 提交时的题目版本号
    questionVersion: {
      type: Number,
      default: 1
    },
    // 题目快照（确保历史记录完整，即使题目被修改或删除）
    questionSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    // ========== 原有字段 ==========
    selectedOption: {
      type: mongoose.Schema.Types.ObjectId,  // 选择的选项ID（非量表）
      required: function () {
        // 只有当没有量表相关字段时才要求selectedOption
        return !this.scaleValue && (!this.matrixAnswers || this.matrixAnswers.size === 0);
      }
    },
    scaleValue: {
      type: Number,  // 心理量表的分值（1-N）
      required: false  // 改为非必需，由业务逻辑控制
    },
    isCorrect: {
      type: Boolean,
      required: false
    },
    // 矩阵量表答案（用于心理量表的矩阵模式）
    matrixAnswers: {
      type: Map,
      of: Number, // 存储每行的选择值（列索引）
      required: false
    }
  }],
  startTime: {
    type: Date,
    required: true
  },
  submitTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['IN_PROGRESS', 'SUBMITTED', 'DELETED'],
    default: 'IN_PROGRESS'
  },
  // 仅用于普通测验
  score: {
    type: Number,
    default: 0
  },
  // 仅用于心理量表
  scaleResults: {
    type: Map,
    of: Number,
    default: {}  // 存储不同维度的得分
  },
  // 尝试次数
  attemptNumber: {
    type: Number,
    required: true,
    min: 1
  },
  // 活动来源（用于区分同一测验在不同活动中的提交）
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false  // 可选，向后兼容旧记录
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: false
  }
}, {
  timestamps: true,
  optimisticConcurrency: true
});

// 添加复合索引，用于快速查询学生的提交记录
// 主索引：按quizId和studentId查询
quizSubmissionSchema.index({ quizId: 1, studentId: 1, status: 1 });
// 活动级别索引：支持按活动筛选
quizSubmissionSchema.index({ quizId: 1, studentId: 1, activityId: 1, status: 1 });

quizSubmissionSchema.index({ attemptKey: 1 }, { unique: true, sparse: true });
quizSubmissionSchema.index({ pointsPending: 1, updatedAt: 1 });
// Tombstones preserve retry safety while ordinary reads keep deleted records hidden.
quizSubmissionSchema.pre(/^find/, function(next) {
  if (!this.getQuery().status) this.where({ status: { $ne: 'DELETED' } });
  next();
});
const QuizSubmission = mongoose.model('QuizSubmission', quizSubmissionSchema);

module.exports = QuizSubmission; 