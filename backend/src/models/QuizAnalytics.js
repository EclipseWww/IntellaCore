const mongoose = require('mongoose');

const questionAnalyticsSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  totalAttempts: {
    type: Number,
    default: 0
  },
  correctAttempts: {
    type: Number,
    default: 0
  },
  optionDistribution: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,  // 修改为Mixed类型，可以存储百分比字符串
    default: {}  // 存储每个选项被选择的次数和百分比
  },
  averageResponseTime: {
    type: Number,
    default: 0  // 平均作答时间（秒）
  },
  // 按尝试次数分类的正确率
  attemptWiseAccuracy: {
    type: Map,
    of: Number,
    default: {}  // key: 尝试次数, value: 正确率
  }
});

const quizAnalyticsSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  totalSubmissions: {
    type: Number,
    default: 0
  },
  averageScore: {
    type: Number,
    default: 0
  },
  scoreDistribution: {
    type: Map,
    of: Number,
    default: {}  // 分数区间分布
  },
  completionRate: {
    type: Number,
    default: 0  // 完成率
  },
  questionAnalytics: [questionAnalyticsSchema],
  // 心理量表专用
  scaleAnalytics: {
    dimensionAverages: {
      type: Map,
      of: Number,
      default: {}  // 各维度平均分
    },
    dimensionDistribution: {
      type: Map,
      of: Map,
      default: {}  // 各维度分数分布
    }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 添加索引以提高查询性能
quizAnalyticsSchema.index({ quizId: 1 });
questionAnalyticsSchema.index({ questionId: 1 });

const QuizAnalytics = mongoose.model('QuizAnalytics', quizAnalyticsSchema);

module.exports = QuizAnalytics;