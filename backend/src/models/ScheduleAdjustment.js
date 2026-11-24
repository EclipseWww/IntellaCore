const mongoose = require('mongoose');

/**
 * 临时调课：只影响某一天的某一节
 *  - cancel：该节不上（课被占用 / 调出）
 *  - add：该节临时上某班某课（调入 / 补课 / 代课，若本有固定课则替换）
 * 把课从 A 调到 B = 在 A 处 cancel + 在 B 处 add
 */
const scheduleAdjustmentSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['cancel', 'add'], required: true },
  date: { type: String, required: true },   // YYYY-MM-DD
  period: { type: Number, min: 1, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  reason: { type: String, default: '', maxlength: 200 }
}, { timestamps: true });

scheduleAdjustmentSchema.index({ teacher: 1, date: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('ScheduleAdjustment', scheduleAdjustmentSchema);
