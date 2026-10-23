const Message = require('../models/Message');
const logger = require('../utils/logger'); // 导入logger模块

const reviewController = {
  // 获取待审核的消息列表
  async getPendingMessages(req, res) {
    try {
      logger.info('获取待审核消息列表', { 
        query: req.query,
        userId: req.user?.userId
      });
      
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10;
      const skip = (page - 1) * pageSize;

      const [messages, total] = await Promise.all([
        Message.find({ status: 'pending' })
          .populate('student', 'username')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize),
        Message.countDocuments({ status: 'pending' })
      ]);

      logger.info('获取待审核消息成功', { 
        count: messages.length,
        total,
        page
      });

      res.json({
        messages: messages.map(msg => ({
          id: msg._id,
          content: msg.content,
          aiResponse: msg.aiResponse,
          studentName: msg.student.username,
          createdAt: msg.createdAt
        })),
        pagination: {
          current: page,
          pageSize,
          total
        }
      });
    } catch (error) {
      logger.error('获取待审核消息失败', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({ message: '获取待审核消息失败', error: error.message });
    }
  },

  // 批量审核消息（按学生与可选筛选条件）
  async bulkReviewMessages(req, res) {
    try {
      logger.info('批量审核消息请求', {
        teacherId: req.user?.userId,
        body: req.body
      });

      const { studentId, status, reviewComment, filters = {} } = req.body || {};
      const teacherId = req.user.userId;

      if (!studentId) {
        logger.warn('缺少学生ID', { teacherId });
        return res.status(400).json({ message: '缺少学生ID' });
      }

      if (!['approved', 'rejected'].includes(status)) {
        logger.warn('无效的批量审核状态', { status, teacherId });
        return res.status(400).json({ message: '无效的审核状态' });
      }

      const query = { student: studentId, status: 'pending' };
      if (filters.type) query.type = filters.type;
      if (filters.courseId) query.courseId = filters.courseId;
      if (filters.lessonId) query.lessonId = filters.lessonId;
      if (filters.courseUnitId) query.courseUnitId = filters.courseUnitId;

      const update = {
        $set: {
          status,
          reviewedBy: teacherId,
          reviewedAt: new Date(),
          ...(reviewComment ? { reviewComment } : {})
        }
      };

      const result = await Message.updateMany(query, update);

      logger.info('批量审核完成', {
        teacherId,
        studentId,
        status,
        matched: result.matchedCount || result.n,
        modified: result.modifiedCount || result.nModified
      });

      res.json({
        message: '批量审核完成',
        data: {
          matched: result.matchedCount || result.n || 0,
          modified: result.modifiedCount || result.nModified || 0
        }
      });
    } catch (error) {
      logger.error('批量审核消息失败', {
        error: error.message,
        stack: error.stack,
        teacherId: req.user?.userId
      });
      res.status(500).json({ message: '批量审核失败', error: error.message });
    }
  },

  // 审核消息
  async reviewMessage(req, res) {
    try {
      logger.info('审核消息请求', { 
        messageId: req.params.messageId,
        status: req.body.status,
        teacherId: req.user?.userId
      });

      const { messageId } = req.params;
      const { status, reviewComment } = req.body;
      const teacherId = req.user.userId;

      if (!['approved', 'rejected'].includes(status)) {
        logger.warn('无效的审核状态', { 
          messageId, 
          status, 
          teacherId 
        });
        return res.status(400).json({ message: '无效的审核状态' });
      }

      const message = await Message.findById(messageId);
      if (!message) {
        logger.warn('消息不存在', { messageId, teacherId });
        return res.status(404).json({ message: '消息不存在' });
      }

      if (message.status !== 'pending') {
        logger.warn('消息已被审核', { 
          messageId, 
          currentStatus: message.status, 
          requestedStatus: status 
        });
        return res.status(400).json({ message: '该消息已被审核' });
      }

      // 更新消息状态
      message.status = status;
      message.reviewedBy = teacherId;
      message.reviewComment = reviewComment;
      message.reviewedAt = new Date();

      await message.save();

      logger.info('消息审核完成', { 
        messageId: message._id, 
        status, 
        teacherId,
        hasComment: !!reviewComment
      });

      res.json({
        message: '审核完成',
        data: {
          id: message._id,
          status: message.status,
          reviewComment: message.reviewComment,
          reviewedAt: message.reviewedAt
        }
      });
    } catch (error) {
      logger.error('审核消息失败', { 
        error: error.message, 
        stack: error.stack,
        messageId: req.params.messageId
      });
      res.status(500).json({ message: '审核消息失败', error: error.message });
    }
  },

  // 获取审核历史
  async getReviewHistory(req, res) {
    try {
      logger.info('获取审核历史', { 
        query: req.query,
        userId: req.user?.userId 
      });
      
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10;
      const skip = (page - 1) * pageSize;

      const [messages, total] = await Promise.all([
        Message.find({ status: { $in: ['approved', 'rejected'] } })
          .populate('student', 'username')
          .populate('reviewedBy', 'username')
          .sort({ reviewedAt: -1 })
          .skip(skip)
          .limit(pageSize),
        Message.countDocuments({ status: { $in: ['approved', 'rejected'] } })
      ]);

      logger.info('获取审核历史成功', { 
        count: messages.length,
        total,
        page
      });

      res.json({
        messages: messages.map(msg => ({
          id: msg._id,
          content: msg.content,
          aiResponse: msg.aiResponse,
          studentName: msg.student.username,
          reviewerName: msg.reviewedBy?.username,
          status: msg.status,
          reviewComment: msg.reviewComment,
          createdAt: msg.createdAt,
          reviewedAt: msg.reviewedAt
        })),
        pagination: {
          current: page,
          pageSize,
          total
        }
      });
    } catch (error) {
      logger.error('获取审核历史失败', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({ message: '获取审核历史失败', error: error.message });
    }
  },

  // 获取审核统计
  async getReviewStats(req, res) {
    try {
      logger.info('获取审核统计数据', { userId: req.user?.userId });
      
      const stats = await Message.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const formattedStats = stats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {
        pending: 0,
        approved: 0,
        rejected: 0
      });

      logger.info('获取统计数据成功', formattedStats);
      
      res.json(formattedStats);
    } catch (error) {
      logger.error('获取统计数据失败', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({ message: '获取统计数据失败', error: error.message });
    }
  }
};

module.exports = reviewController; 