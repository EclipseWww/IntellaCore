const Conversation = require('../models/Conversation');
const UserMessage = require('../models/UserMessage');
const User = require('../models/User');
const logger = require('../utils/logger');

const ensureParticipant = async (conversationId, userId) => {
  const conv = await Conversation.findById(conversationId).select('_id participants type admins');
  if (!conv) return { ok: false, code: 404, message: '会话不存在' };
  const isMember = conv.participants.some(id => String(id) === String(userId));
  if (!isMember) return { ok: false, code: 403, message: '不是会话成员' };
  return { ok: true, conv };
};

const isAdmin = (conv, userId) => conv.admins?.some(id => String(id) === String(userId));

const userMessageController = {
  // 创建或获取私聊会话（双人）
  async getOrCreateDirectConversation(req, res) {
    try {
      const userId = req.user?.id;
      const targetUserId = req.body?.userId || req.query?.userId;

      logger.info('创建/获取私聊会话', { userId, targetUserId });

      if (!targetUserId) {
        return res.status(400).json({ message: '缺少目标用户ID' });
      }

      if (String(userId) === String(targetUserId)) {
        return res.status(400).json({ message: '不能与自己创建私聊' });
      }

      const targetExists = await User.exists({ _id: targetUserId });
      if (!targetExists) return res.status(404).json({ message: '目标用户不存在' });

      // 查找是否已有双人 direct 会话（成员刚好两人）
      let conv = await Conversation.findOne({
        type: 'direct',
        participants: { $all: [userId, targetUserId], $size: 2 }
      });

      if (!conv) {
        conv = new Conversation({
          type: 'direct',
          participants: [userId, targetUserId],
          admins: [userId],
          lastMessageAt: new Date()
        });
        await conv.save();
        logger.info('新建私聊会话成功', { conversationId: conv._id, userId, targetUserId });
      }

      res.json({ success: true, data: { conversation: conv } });
    } catch (error) {
      logger.error('创建/获取私聊会话失败', { error: error.message, stack: error.stack, userId: req.user?.id });
      res.status(500).json({ success: false, message: '创建/获取私聊会话失败' });
    }
  },

  // 创建群聊
  async createGroupConversation(req, res) {
    try {
      const userId = req.user?.id;
      const { name, participantIds } = req.body || {};

      logger.info('创建群聊请求', { userId, name, participantCount: Array.isArray(participantIds) ? participantIds.length : 0 });

      if (!name) return res.status(400).json({ message: '缺少群聊名称' });
      const participants = Array.isArray(participantIds) ? participantIds.filter(Boolean) : [];
      const uniqueSet = new Set([String(userId), ...participants.map(String)]);
      const uniqueParticipants = Array.from(uniqueSet);

      const conv = new Conversation({
        type: 'group',
        name,
        participants: uniqueParticipants,
        admins: [userId],
        lastMessageAt: new Date()
      });
      await conv.save();
      logger.info('创建群聊成功', { conversationId: conv._id, userId });
      res.json({ success: true, data: { conversation: conv } });
    } catch (error) {
      logger.error('创建群聊失败', { error: error.message, stack: error.stack, userId: req.user?.id });
      res.status(500).json({ success: false, message: '创建群聊失败' });
    }
  },

  // 发送消息
  async sendMessage(req, res) {
    try {
      const userId = req.user?.id;
      const { conversationId, content, mentions, attachments } = req.body || {};
      logger.info('发送用户消息', { userId, conversationId });

      if (!conversationId) return res.status(400).json({ message: '缺少会话ID' });
      if (!content || !content.trim()) return res.status(400).json({ message: '消息内容不能为空' });

      const check = await ensureParticipant(conversationId, userId);
      if (!check.ok) return res.status(check.code).json({ message: check.message });

      // 学生端：拦截 Python 代码/答案
      const containsPython = (text) => {
        if (!text || typeof text !== 'string') return false;
        const t = text.toLowerCase();
        // 明确的代码围栏或提示
        if (t.includes('```python') || t.includes('``` py')) return true;
        if (t.includes('#!/usr/bin/env python')) return true;
        // 关键字密度判定
        const keywords = ['def ', 'class ', 'import ', 'from ', 'lambda ', 'yield', 'except', 'try:', 'with ', 'print(', 'range(', '__name__', '__main__'];
        const hit = keywords.reduce((acc, k) => acc + (t.includes(k) ? 1 : 0), 0);
        if (hit >= 2 && text.length >= 40) return true;
        // 常见函数定义/类定义正则（跨行）
        if (/\bdef\s+\w+\s*\(/.test(text)) return true;
        if (/\bclass\s+\w+\s*[:(]/.test(text)) return true;
        return false;
      };

      if (req.user?.role === 'student' && (check.conv?.type === 'direct' || check.conv?.type === 'group')) {
        const hasPyAttachment = Array.isArray(attachments) && attachments.some(a => {
          const name = (a?.name || a?.url || '').toLowerCase();
          return name.endsWith('.py');
        });
        if (hasPyAttachment || containsPython(content)) {
          logger.warn('拦截疑似Python答案分享', { userId, conversationId });
          return res.status(403).json({ success: false, message: '为促进独立思考，不允许在聊天中分享Python代码/答案' });
        }
      }

      const msg = new UserMessage({
        conversation: conversationId,
        sender: userId,
        content: content.trim(),
        attachments: Array.isArray(attachments) ? attachments : [],
        mentions: Array.isArray(mentions) ? mentions : []
      });
      await msg.save();
      await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });

      res.json({ success: true, data: { message: msg } });
    } catch (error) {
      logger.error('发送用户消息失败', { error: error.message, stack: error.stack, userId: req.user?.id });
      res.status(500).json({ success: false, message: '发送消息失败' });
    }
  },

  // 获取我的会话列表
  async getMyConversations(req, res) {
    try {
      const userId = req.user?.id;
      logger.info('获取会话列表', { userId });
      const list = await Conversation.find({ participants: userId })
        .sort({ lastMessageAt: -1 })
        .lean();

      // 计算未读数：统计该会话下 readBy 不包含我的消息数量
      const withUnread = await Promise.all(list.map(async (c) => {
        const unreadCount = await UserMessage.countDocuments({
          conversation: c._id,
          sender: { $ne: userId },
          $or: [
            { readBy: { $exists: false } },
            { readBy: { $nin: [userId] } }
          ]
        });
        return { ...c, unreadCount };
      }));

      res.json({ success: true, data: { conversations: withUnread } });
    } catch (error) {
      logger.error('获取会话列表失败', { error: error.message, stack: error.stack, userId: req.user?.id });
      res.status(500).json({ success: false, message: '获取会话列表失败' });
    }
  },

  // 拉取会话消息（分页）
  async getConversationMessages(req, res) {
    try {
      const userId = req.user?.id;
      const { conversationId } = req.params;
      const { page = 1, limit = 20 } = req.query || {};
      logger.info('获取会话消息', { userId, conversationId, page, limit });

      const check = await ensureParticipant(conversationId, userId);
      if (!check.ok) return res.status(check.code).json({ message: check.message });

      const skip = (Number(page) - 1) * Number(limit);
      const [messages, total] = await Promise.all([
        UserMessage.find({ conversation: conversationId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .populate('sender', 'username name _id')
          .lean(),
        UserMessage.countDocuments({ conversation: conversationId })
      ]);

      // 标记我未读的消息为已读
      await UserMessage.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: userId },
          $or: [
            { readBy: { $exists: false } },
            { readBy: { $nin: [userId] } }
          ]
        },
        { $addToSet: { readBy: userId } }
      );

      res.json({
        success: true,
        data: {
          messages: messages.reverse(),
          pagination: { page: Number(page), limit: Number(limit), total }
        }
      });
    } catch (error) {
      logger.error('获取会话消息失败', { error: error.message, stack: error.stack, userId: req.user?.id });
      res.status(500).json({ success: false, message: '获取会话消息失败' });
    }
  },

  // 显式标记会话消息为已读
  async markConversationRead(req, res) {
    try {
      const userId = req.user?.id;
      const { conversationId } = req.params;
      logger.info('标记会话已读', { userId, conversationId });
      const check = await ensureParticipant(conversationId, userId);
      if (!check.ok) return res.status(check.code).json({ message: check.message });
      await UserMessage.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: userId },
          $or: [
            { readBy: { $exists: false } },
            { readBy: { $nin: [userId] } }
          ]
        },
        { $addToSet: { readBy: userId } }
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('标记会话已读失败', { error: error.message, stack: error.stack, userId: req.user?.id });
      res.status(500).json({ success: false, message: '标记已读失败' });
    }
  },

  // 群聊：添加成员（管理员）
  async addMembers(req, res) {
    try {
      const userId = req.user?.id;
      const { conversationId } = req.params;
      const { memberIds } = req.body || {};
      logger.info('群聊添加成员', { userId, conversationId, count: Array.isArray(memberIds) ? memberIds.length : 0 });

      const conv = await Conversation.findById(conversationId);
      if (!conv) return res.status(404).json({ message: '会话不存在' });
      if (conv.type !== 'group') return res.status(400).json({ message: '仅群聊支持成员管理' });
      if (!isAdmin(conv, userId)) return res.status(403).json({ message: '仅管理员可操作' });

      const current = new Set(conv.participants.map(id => String(id)));
      (Array.isArray(memberIds) ? memberIds : []).forEach(id => current.add(String(id)));
      conv.participants = Array.from(current);
      await conv.save();
      res.json({ success: true, data: { conversation: conv } });
    } catch (error) {
      logger.error('群聊添加成员失败', { error: error.message, stack: error.stack, userId: req.user?.id });
      res.status(500).json({ success: false, message: '添加成员失败' });
    }
  },

  // 群聊：移除成员（管理员）
  async removeMember(req, res) {
    try {
      const userId = req.user?.id;
      const { conversationId, memberId } = req.params;
      logger.info('群聊移除成员', { userId, conversationId, memberId });

      const conv = await Conversation.findById(conversationId);
      if (!conv) return res.status(404).json({ message: '会话不存在' });
      if (conv.type !== 'group') return res.status(400).json({ message: '仅群聊支持成员管理' });
      if (!isAdmin(conv, userId)) return res.status(403).json({ message: '仅管理员可操作' });

      conv.participants = conv.participants.filter(id => String(id) !== String(memberId));
      await conv.save();
      res.json({ success: true, data: { conversation: conv } });
    } catch (error) {
      logger.error('群聊移除成员失败', { error: error.message, stack: error.stack, userId: req.user?.id });
      res.status(500).json({ success: false, message: '移除成员失败' });
    }
  },

  // 退出会话（成员）
  async leaveConversation(req, res) {
    try {
      const userId = req.user?.id;
      const { conversationId } = req.params;
      logger.info('退出会话', { userId, conversationId });

      const conv = await Conversation.findById(conversationId);
      if (!conv) return res.status(404).json({ message: '会话不存在' });

      const isMember = conv.participants.some(id => String(id) === String(userId));
      if (!isMember) return res.status(403).json({ message: '不是会话成员' });

      conv.participants = conv.participants.filter(id => String(id) !== String(userId));
      // 如果管理员退出，仍保留会话，可后续转移管理员（此处不强制）
      await conv.save();
      res.json({ success: true, data: { conversation: conv } });
    } catch (error) {
      logger.error('退出会话失败', { error: error.message, stack: error.stack, userId: req.user?.id });
      res.status(500).json({ success: false, message: '退出会话失败' });
    }
  }
};

// 教师审查扩展：挂到导出的对象上
userMessageController.getStudentConversationsForTeacher = async (req, res) => {
  try {
    const teacherId = req.user?.id;
    const { studentId } = req.params;
    logger.info('教师获取学生会话列表', { teacherId, studentId });

    const student = await User.findById(studentId).select('classId role');
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: '未找到学生' });
    }
    const ClassModel = require('../models/Class');
    const cls = await ClassModel.findOne({ _id: student.classId, teacher: teacherId }).select('_id');
    if (!cls) return res.status(403).json({ success: false, message: '无权审查该学生' });

    const list = await Conversation.find({ participants: studentId })
      .sort({ lastMessageAt: -1 })
      .lean();
    res.json({ success: true, data: { conversations: list } });
  } catch (error) {
    logger.error('教师获取学生会话列表失败', { error: error.message, stack: error.stack, teacherId: req.user?.id });
    res.status(500).json({ success: false, message: '获取学生会话失败' });
  }
};

userMessageController.getConversationMessagesForTeacher = async (req, res) => {
  try {
    const teacherId = req.user?.id;
    const { conversationId } = req.params;
    const { page = 1, limit = 20 } = req.query || {};
    logger.info('教师获取会话消息', { teacherId, conversationId, page, limit });

    const conv = await Conversation.findById(conversationId).lean();
    if (!conv) return res.status(404).json({ success: false, message: '会话不存在' });

    const participants = (conv.participants || []).map(String);
    const ClassModel = require('../models/Class');
    const students = await User.find({ _id: { $in: participants }, role: 'student' }).select('_id classId');
    const classIds = students.map(s => s.classId).filter(Boolean);
    const hasOwned = await ClassModel.exists({ _id: { $in: classIds }, teacher: teacherId });
    if (!hasOwned) return res.status(403).json({ success: false, message: '无权查看该会话' });

    const skip = (Number(page) - 1) * Number(limit);
    const [messages, total] = await Promise.all([
      UserMessage.find({ conversation: conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('sender', 'username name _id role')
        .lean(),
      UserMessage.countDocuments({ conversation: conversationId })
    ]);

    res.json({ success: true, data: { messages: messages.reverse(), pagination: { page: Number(page), limit: Number(limit), total } } });
  } catch (error) {
    logger.error('教师获取会话消息失败', { error: error.message, stack: error.stack, teacherId: req.user?.id });
    res.status(500).json({ success: false, message: '获取会话消息失败' });
  }
};

// 教师审查：获取班级群聊列表
userMessageController.getClassGroupConversationsForTeacher = async (req, res) => {
  try {
    const teacherId = req.user?.id;
    const { classId } = req.params;
    logger.info('教师获取班级群聊列表', { teacherId, classId });

    const ClassModel = require('../models/Class');
    const cls = await ClassModel.findOne({ _id: classId, teacher: teacherId }).select('_id');
    if (!cls) return res.status(403).json({ success: false, message: '无权查看该班级群聊' });

    // 找到该班级所有学生
    const students = await User.find({ classId, role: 'student' }).select('_id');
    const studentIds = students.map(s => s._id);

    // 查找包含本班学生的群聊（type=group 且 participants ∩ studentIds 非空）
    const groups = await Conversation.find({
      type: 'group',
      participants: { $in: studentIds }
    }).sort({ lastMessageAt: -1 }).lean();

    res.json({ success: true, data: { conversations: groups } });
  } catch (error) {
    logger.error('教师获取班级群聊列表失败', { error: error.message, stack: error.stack, teacherId: req.user?.id });
    res.status(500).json({ success: false, message: '获取班级群聊失败' });
  }
};

module.exports = userMessageController;


