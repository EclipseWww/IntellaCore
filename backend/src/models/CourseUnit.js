const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     CourseUnit:
 *       type: object
 *       required:
 *         - course
 *         - title
 *         - order
 *       properties:
 *         _id:
 *           type: string
 *           description: 单元ID
 *         course:
 *           type: string
 *           description: 所属课程ID
 *         title:
 *           type: string
 *           description: 单元标题
 *         description:
 *           type: string
 *           description: 单元描述
 *         order:
 *           type: number
 *           description: 单元顺序
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 */

const courseUnitSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  order: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

const CourseUnit = mongoose.model('CourseUnit', courseUnitSchema);

module.exports = CourseUnit;
