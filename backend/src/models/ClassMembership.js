const mongoose = require('mongoose');

/**
 * 教学班（社团课、选修课）成员。
 * 学生的行政班仍记在 User.classId；这里只记录学生参加的教学班，
 * 以及他在该教学班里的座位号和绑定的登录 IP（与行政班分开，互不影响）。
 */
const classMembershipSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seatNumber: { type: String, trim: true, default: null },
  // 在该教学班登录时绑定的 IP：第一次登录时记下，之后换电脑需该班老师审批
  boundIp: { type: String, default: null },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

classMembershipSchema.index({ class: 1, student: 1 }, { unique: true });
classMembershipSchema.index({ student: 1 });

module.exports = mongoose.model('ClassMembership', classMembershipSchema);
