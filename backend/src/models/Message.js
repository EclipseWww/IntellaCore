const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    // 助手回复可选携带“下一步提问建议”
    suggestedQuestions: [{
      type: String
    }],
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // 新增字段，用于区分消息类型
  type: {
    type: String,
    enum: ['general', 'course'],
    default: 'general'
  },
  // 课程相关字段
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: function() { return this.type === 'course'; }
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: false
  },
  courseUnitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseUnit',
    required: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewComment: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: Date
});

// 更新updatedAt时间戳
messageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;