const mongoose = require('mongoose');

// 用户消息（会话中的单条消息）
// conversation: 关联会话
// sender: 发送者
// content: 文本内容
// attachments: 可选附件（后续可拓展）
// mentions: @ 提及的用户

const userMessageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    trim: true,
    required: true
  },
  attachments: [{
    url: String,
    type: String,
    name: String,
    size: Number
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userMessageSchema.index({ conversation: 1, createdAt: -1 });

userMessageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const UserMessage = mongoose.model('UserMessage', userMessageSchema);
module.exports = UserMessage;


