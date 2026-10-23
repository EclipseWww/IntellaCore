const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Setting:
 *       type: object
 *       required:
 *         - key
 *         - value
 *       properties:
 *         _id:
 *           type: string
 *           description: 设置ID
 *         key:
 *           type: string
 *           description: 设置键名
 *         value:
 *           type: string
 *           description: 设置值（可以是任意类型）
 *         description:
 *           type: string
 *           description: 设置描述
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 */

const settingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
