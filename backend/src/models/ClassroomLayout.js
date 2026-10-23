const mongoose = require('mongoose');

const seatConfigSchema = new mongoose.Schema({
  index: { type: Number, required: true },
  ip: { type: String, required: true },
  row: { type: Number, required: true },
  col: { type: Number, required: true }
});

const classroomLayoutSchema = new mongoose.Schema({
  name: { type: String, required: true }, // 机房名称
  description: { type: String }, // 机房描述
  rows: { type: Number, required: true }, // 行数
  cols: { type: Number, required: true }, // 列数
  seats: [seatConfigSchema], // 座位配置
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 创建者
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' }, // 关联的班级（可选）
}, {
  timestamps: true
});

// 添加索引
classroomLayoutSchema.index({ name: 1, createdBy: 1 }, { unique: true });

const ClassroomLayout = mongoose.model('ClassroomLayout', classroomLayoutSchema);

module.exports = ClassroomLayout; 