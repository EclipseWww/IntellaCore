const mongoose = require('mongoose');

// 支持私聊与群聊的会话模型
// type: 'direct' | 'group'
// participants: 成员列表（用户ID）
// admins: 管理员列表，仅群聊使用
// name/avatar: 群聊名称与头像（direct 会自动从两端用户派生展示，后端不强制）
// lastMessageAt: 便于排序

const conversationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group'],
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  name: { type: String },
  avatar: { type: String },
  lastMessageAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

conversationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;


