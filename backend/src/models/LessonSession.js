const mongoose = require('mongoose');

/**
 * 实际发生（或被记录为未发生）的一节课，同时承载上课进度与考勤
 */
const attendanceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['present', 'late', 'absent', 'leave'], default: 'present' },
  note: { type: String, default: '', maxlength: 100 }
}, { _id: false });

const lessonSessionSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  date: { type: String, required: true },     // YYYY-MM-DD
  period: { type: Number, required: true },
  periodName: { type: String, default: '' },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'skipped'],
    required: true
  },
  skipReason: { type: String, default: '', maxlength: 200 },
  source: { type: String, enum: ['slot', 'adjust', 'manual'], default: 'slot' },
  unit: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseUnit', default: null },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null },
  note: { type: String, default: '', maxlength: 500 },
  startedAt: { type: Date, default: null },   // 实际开始（可能早于 startAt：提前上课 / 提前 5 分钟自动上课）
  endedAt: { type: Date, default: null },     // 实际结束（教师提前下课时早于 endAt）
  // 上没上的判定：自动按学生活动完成情况判定；教师手动标记后不再自动改动
  judgement: {
    state: { type: String, enum: ['pending', 'taught', 'met', 'not_taught', 'assumed'], default: 'pending' }, // met=到课但没上新课
    by: { type: String, enum: ['auto', 'teacher'], default: 'auto' },
    basis: { type: String, enum: ['presence', 'activity', null], default: null },
    presentStudents: { type: Number, default: 0 },   // 本节课时间内登录过的学生数
    activeStudents: { type: Number, default: 0 },    // 本节课时间内完成过【本节课时】活动的学生数
    totalStudents: { type: Number, default: 0 },
    judgedAt: { type: Date, default: null }
  },
  attendanceTaken: { type: Boolean, default: false },
  attendanceSource: { type: String, enum: ['auto', 'teacher', null], default: null }, // auto=按登录自动生成
  // 本节课的课时切换轨迹（自动选课时 / 教师切换），判定时取停留最久的课时
  lessonLog: [{
    _id: false,
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseUnit' },
    at: { type: Date, default: Date.now },
    by: { type: String, enum: ['auto', 'teacher'], default: 'auto' }
  }],
  attendance: [attendanceSchema]
}, { timestamps: true });

lessonSessionSchema.index({ class: 1, date: 1, period: 1 }, { unique: true });
lessonSessionSchema.index({ teacher: 1, date: 1 });
lessonSessionSchema.index({ status: 1, 'judgement.state': 1, endAt: 1 });
lessonSessionSchema.index({ class: 1, course: 1, status: 1, startAt: -1 });

module.exports = mongoose.model('LessonSession', lessonSessionSchema);
