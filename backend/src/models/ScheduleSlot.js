const mongoose = require('mongoose');

/**
 * 固定课表：某教师每周某天某节上某班的某门课
 */
const scheduleSlotSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null }, // 为空=自动（跟随该班最近上的课程）
  weekday: { type: Number, min: 1, max: 7, required: true }, // 1=周一
  period: { type: Number, min: 1, required: true },          // 节次序号
  autoStart: { type: Boolean, default: true },               // 到点自动上课
  startDate: { type: String, default: null },                // 生效起始日 YYYY-MM-DD（可空）
  endDate: { type: String, default: null }                   // 生效截止日（可空）
}, { timestamps: true });

// 同一教师同一时间只能上一节；同一班级同一时间只能有一节
scheduleSlotSchema.index({ teacher: 1, weekday: 1, period: 1 }, { unique: true });
scheduleSlotSchema.index({ class: 1, weekday: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('ScheduleSlot', scheduleSlotSchema);
