const mongoose = require('mongoose');

const typingRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  textId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TypingText',
    required: true
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  },
  activityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  speed: {
    type: Number,  // 字/分钟
    required: true
  },
  accuracy: {
    type: Number,  // 百分比
    required: true,
    min: 0,
    max: 100
  },
  targetSpeed: {    // 本次练习的目标速度
    type: Number,
    required: true
  },
  targetAccuracy: { // 本次练习的目标准确率
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  isPassed: {       // 是否达标
    type: Boolean,
    required: true,
    default: false
  },
  input: {          // 用户输入的完整内容
    type: String,
    required: false // 兼容旧数据
  }
}, {
  timestamps: true
});

// 添加索引
typingRecordSchema.index({ userId: 1, startTime: -1 });
typingRecordSchema.index({ lessonId: 1, userId: 1 });
typingRecordSchema.index({ userId: 1, isPassed: 1 }); // 添加新索引用于查询达标记录

// 添加虚拟字段计算练习时长（分钟）
typingRecordSchema.virtual('duration').get(function () {
  return (this.endTime - this.startTime) / (1000 * 60);
});

// 添加保存前的中间件来自动计算是否达标
typingRecordSchema.pre('save', function (next) {
  this.isPassed = this.speed >= this.targetSpeed && this.accuracy >= this.targetAccuracy;
  next();
});

const TypingRecord = mongoose.model('TypingRecord', typingRecordSchema);

module.exports = TypingRecord; 