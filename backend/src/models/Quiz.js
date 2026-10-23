const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  questions: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    order: {
      type: Number,
      required: true
    },
    // ========== 版本控制字段 ==========
    // 锁定使用的题目版本（null表示始终使用最新版本）
    lockedVersion: {
      type: Number,
      default: null
    },
    // 题目快照（当题目被删除时的备份，确保测验仍可使用）
    questionSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  }],
  status: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'ENDED'],
    default: 'DRAFT'
  },
  isScaleTest: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 测验设置
  // 测验设置已迁移至 Lesson.activities.quizSettings
  // settings字段已弃用
}, {
  timestamps: true
});

// 添加虚拟字段 totalPoints，计算测验的总分
// 对于普通题目，每题1分；心理量表不计分
quizSchema.virtual('totalPoints').get(function () {
  // 如果是心理量表测验，返回0
  if (this.isScaleTest) return 0;

  // 普通测验，返回题目数量作为总分
  // 添加安全检查，防止部分字段查询时报错
  return this.questions?.length || 0;
});

// 确保虚拟字段在 JSON 输出中可见
quizSchema.set('toJSON', { virtuals: true });
quizSchema.set('toObject', { virtuals: true });

const Quiz = mongoose.model('Quiz', quizSchema);

module.exports = Quiz; 