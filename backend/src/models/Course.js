const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Course:
 *       type: object
 *       required:
 *         - title
 *         - type
 *         - level
 *         - instructor
 *       properties:
 *         _id:
 *           type: string
 *           description: 课程ID
 *         title:
 *           type: string
 *           description: 课程标题
 *         description:
 *           type: string
 *           description: 课程描述
 *         type:
 *           type: string
 *           enum: [software, programming, language, design, business, other]
 *           description: 课程类型
 *         level:
 *           type: string
 *           enum: [入门, 初级, 中级, 高级]
 *           description: 课程难度级别
 *         instructor:
 *           type: string
 *           description: 教师ID
 *         accessibleClasses:
 *           type: array
 *           items:
 *             type: string
 *           description: 可访问此课程的班级ID列表
 *         isPublic:
 *           type: boolean
 *           description: 是否对所有班级开放
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 */

const courseSchema = new mongoose.Schema({
  // 基本信息
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  type: {
    type: String,
    required: true,
    // 新类型: programming, design, network, ai, other
    // 保留旧类型以兼容现有数据: software, language, business
    enum: ['programming', 'design', 'network', 'ai', 'software', 'language', 'business', 'other']
  },
  level: {
    type: String,
    required: true,
    enum: ['入门', '初级', '中级', '高级'],
    default: '入门'
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 添加可访问班级列表
  accessibleClasses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],
  // 是否对所有班级开放
  isPublic: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
