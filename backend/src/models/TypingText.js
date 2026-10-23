const mongoose = require('mongoose');

const typingTextSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: [ 'programming', 'article', 'other'],
    default: 'article'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// 添加索引以提高查询性能
typingTextSchema.index({ category: 1, difficulty: 1 });
typingTextSchema.index({ tags: 1 });

const TypingText = mongoose.model('TypingText', typingTextSchema);

module.exports = TypingText; 