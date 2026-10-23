const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  completedLessons: [{
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    completedAt: {
      type: Date,
      default: Date.now
    },
    timeSpent: {
      type: Number,  // 单位：分钟
      default: 0
    }
  }],
  lastLesson: {
    lessonId: {
      type: mongoose.Schema.Types.ObjectId
    },
    position: {
      type: Number,
      default: 0
    }
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  lastAccessDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'dropped'],
    default: 'not_started'
  },
  notes: [{
    lessonId: {
      type: mongoose.Schema.Types.ObjectId
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// 添加复合索引
progressSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
progressSchema.index({ status: 1 });
progressSchema.index({ lastAccessDate: -1 });

module.exports = mongoose.model('Progress', progressSchema);
