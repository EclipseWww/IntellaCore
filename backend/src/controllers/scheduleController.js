const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Class = require('../models/Class');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const ScheduleSlot = require('../models/ScheduleSlot');
const ScheduleAdjustment = require('../models/ScheduleAdjustment');
const LessonSession = require('../models/LessonSession');
const logger = require('../utils/logger');
const L = require('../services/scheduleLogic');
const svc = require('../services/scheduleService');
const semesterUtils = require('../utils/semesterUtils');

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const fail = (res, code, message) => res.status(code).json({ success: false, message });
const guard = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    logger.error('课表接口出错', { path: req.path, error: e.message, stack: e.stack });
    fail(res, 500, '服务器错误');
  }
};

const ownClass = (classId, teacherId) => Class.findOne({ _id: classId, teacher: teacherId, status: { $ne: 'archived' } });

/** 课程选项：与教师端课程列表一致，授课教师可选任意课程 */
const courseExists = (id) => Course.exists({ _id: id });

// ───────────── 节次配置（管理员维护，所有人可读）─────────────

exports.getConfig = guard(async (req, res) => {
  res.json({ success: true, data: await svc.getConfig() });
});

exports.updateConfig = guard(async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 403, '只有管理员可以修改课表节次设置');
  const r = await svc.saveConfig(req.body || {});
  if (r.error) return fail(res, 400, r.error);
  res.json({ success: true, data: await svc.getConfig() });
});

// ───────────── 固定课表 ─────────────

exports.listSlots = guard(async (req, res) => {
  const slots = await ScheduleSlot.find({ teacher: req.user._id })
    .populate('class', 'grade name').populate('course', 'title').lean();
  res.json({ success: true, data: slots });
});

exports.upsertSlot = guard(async (req, res) => {
  const { weekday, period, classId, courseId, autoStart = true, startDate = null, endDate = null } = req.body || {};
  const cfg = await svc.getConfig();
  if (!Number.isInteger(weekday) || !cfg.days.includes(weekday)) return fail(res, 400, '该天不是上课日');
  if (!cfg.periods.some(p => p.index === period)) return fail(res, 400, '节次不存在');
  if (!isId(classId) || !isId(courseId)) return fail(res, 400, '请选择班级和课程');
  for (const d of [startDate, endDate]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return fail(res, 400, '日期格式错误');
  if (!await ownClass(classId, req.user._id)) return fail(res, 404, '未找到该班级或无权操作');
  if (!await courseExists(courseId)) return fail(res, 404, '课程不存在');

  const clash = await ScheduleSlot.findOne({
    class: classId, weekday, period, teacher: { $ne: req.user._id }
  }).lean();
  if (clash) return fail(res, 409, '该班级此时间已被其他教师排课');

  // 同教师同一格 → 覆盖；同班同一格已有（本人）→ 也覆盖（班级唯一索引）
  await ScheduleSlot.deleteMany({ class: classId, weekday, period, teacher: req.user._id });
  const slot = await ScheduleSlot.findOneAndUpdate(
    { teacher: req.user._id, weekday, period },
    { teacher: req.user._id, weekday, period, class: classId, course: courseId, autoStart: !!autoStart, startDate, endDate },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('class', 'grade name').populate('course', 'title');
  res.json({ success: true, data: slot });
});

exports.deleteSlot = guard(async (req, res) => {
  const r = await ScheduleSlot.deleteOne({ _id: req.params.id, teacher: req.user._id });
  if (!r.deletedCount) return fail(res, 404, '课表项不存在');
  res.json({ success: true });
});

// ───────────── 临时调整 ─────────────

exports.createAdjustment = guard(async (req, res) => {
  const { type, date, period, classId, courseId, reason = '' } = req.body || {};
  const cfg = await svc.getConfig();
  if (!['cancel', 'add'].includes(type)) return fail(res, 400, '调整类型错误');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return fail(res, 400, '日期格式错误');
  if (!cfg.periods.some(p => p.index === period)) return fail(res, 400, '节次不存在');
  const data = { teacher: req.user._id, type, date, period, reason: String(reason).slice(0, 200), class: null, course: null };

  if (type === 'add') {
    if (!isId(classId) || !isId(courseId)) return fail(res, 400, '请选择班级和课程');
    if (!await ownClass(classId, req.user._id)) return fail(res, 404, '未找到该班级或无权操作');
    if (!await courseExists(courseId)) return fail(res, 404, '课程不存在');
    const busy = await LessonSession.exists({ class: classId, date, period });
    if (busy) return fail(res, 409, '该班级这一节已有上课记录');
    data.class = classId; data.course = courseId;
  }
  const existingSession = await LessonSession.findOne({ teacher: req.user._id, date, period, status: { $ne: 'skipped' } });
  if (existingSession) return fail(res, 409, '这一节已经上课或有记录，无法再调整');

  const adj = await ScheduleAdjustment.findOneAndUpdate(
    { teacher: req.user._id, date, period }, data, { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({ success: true, data: adj });
});

exports.deleteAdjustment = guard(async (req, res) => {
  const r = await ScheduleAdjustment.deleteOne({ _id: req.params.id, teacher: req.user._id });
  if (!r.deletedCount) return fail(res, 404, '调整记录不存在');
  res.json({ success: true });
});

// ───────────── 课节（含进度、考勤）─────────────

exports.listOccurrences = guard(async (req, res) => {
  const { from, to } = req.query;
  if (!L.dateRange(from, to).length) return fail(res, 400, '日期范围无效');
  const occ = await svc.listOccurrences({ teacherId: req.user._id, from, to });
  const classes = await Class.find({ _id: { $in: [...new Set(occ.map(o => o.class))] } }).select('grade name').lean();
  const courses = await Course.find({ _id: { $in: [...new Set(occ.map(o => o.course))] } }).select('title').lean();
  const cMap = new Map(classes.map(c => [String(c._id), c]));
  const kMap = new Map(courses.map(c => [String(c._id), c]));
  const adjustments = await ScheduleAdjustment.find({
    teacher: req.user._id, type: 'cancel', date: { $gte: from, $lte: to }
  }).lean();
  res.json({
    success: true,
    data: occ.map(o => ({ ...o, classInfo: cMap.get(o.class) || null, courseInfo: kMap.get(o.course) || null })),
    adjustments
  });
});

/** 开始上课（手动提前开始，或未开启自动上课的课节） */
exports.startOccurrence = guard(async (req, res) => {
  const { classId, date, period, lessonId } = req.body || {};
  const occ = await findOwnOccurrence(req, res, { classId, date, period });
  if (!occ) return;
  const now = new Date();
  if (date !== L.zonedParts(now).dateKey || L.zonedToDate(date, occ.end) <= now) {
    return fail(res, 400, '只能开始今天还没下课的课');
  }
  await svc.endTeacherElsewhere({ teacherId: req.user._id, classId, now });
  const r = await svc.startSession({ ...occ, date }, { lessonId: isId(lessonId) ? lessonId : undefined, force: true, now });
  if (!r.started) return fail(res, 409, '这一节刚刚已经开始，请刷新');
  res.json({ success: true, data: r.session });
});

async function findOwnOccurrence(req, res, { classId, date, period }) {
  if (!isId(classId) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isInteger(period)) {
    fail(res, 400, '参数错误'); return null;
  }
  const occ = await svc.findOccurrence({ teacherId: req.user._id, classId, date, period });
  if (!occ) { fail(res, 404, '课表中没有这一节课'); return null; }
  return occ;
}

/** 教师手动标记「没上」（被占课等）；可覆盖自动判定 */
exports.skipOccurrence = guard(async (req, res) => {
  const { classId, date, period, reason = '' } = req.body || {};
  const occ = await findOwnOccurrence(req, res, { classId, date, period });
  if (!occ) return;
  const cfg = await svc.getConfig();
  const p = cfg.periods.find(x => x.index === period);
  let session = await LessonSession.findOne({ class: classId, date, period });

  if (!session) {
    session = new LessonSession({
      teacher: req.user._id, class: classId, course: occ.course, date, period, periodName: p.name,
      startAt: L.zonedToDate(date, p.start), endAt: L.zonedToDate(date, p.end),
      source: occ.source === 'adjust' ? 'adjust' : 'slot'
    });
  }
  const wasRunning = session.status === 'in_progress';
  session.status = 'skipped';
  session.skipReason = String(reason).slice(0, 200);
  session.lesson = null; session.unit = null;
  session.judgement = { state: 'not_taught', by: 'teacher', judgedAt: new Date() };
  await session.save();
  if (wasRunning) {
    await Class.updateOne(
      { _id: classId, isInClass: true, scheduledEndTime: { $lte: new Date(session.endAt.getTime() + 1000) } },
      { $set: { isInClass: false, scheduledEndTime: null } }
    );
  }
  res.json({ success: true, data: session });
});

/**
 * 撤销「没上」：
 * - 提前标记、这节课还没到 -> 删除标记，到点照常自动上课
 * - 已经过去的课（含自动判定为没上的）-> 改为教师确认「上过」
 */
exports.unskipOccurrence = guard(async (req, res) => {
  const session = await LessonSession.findOne({ _id: req.params.id, teacher: req.user._id });
  if (!session || session.status !== 'skipped') return fail(res, 404, '记录不存在');
  if (!session.startedAt && session.startAt > new Date()) {
    await session.deleteOne();
    return res.json({ success: true, data: null });
  }
  await svc.confirmTaught(session);
  res.json({ success: true, data: session });
});

/** 补记一节已经上过、但系统未自动记录的课（如当时未开启自动上课） */
exports.recordOccurrence = guard(async (req, res) => {
  const { classId, date, period, lessonId } = req.body || {};
  const occ = await findOwnOccurrence(req, res, { classId, date, period });
  if (!occ) return;
  const cfg = await svc.getConfig();
  const p = cfg.periods.find(x => x.index === period);
  if (L.zonedToDate(date, p.start) > new Date()) return fail(res, 400, '这一节还没开始，不能补记');
  if (await LessonSession.exists({ class: classId, date, period })) return fail(res, 409, '这一节已有记录');
  const lesson = isId(lessonId) ? await Lesson.findById(lessonId).select('unit course').lean()
    : await svc.resolveNextLesson(classId, occ.course);
  const session = await LessonSession.create({
    teacher: req.user._id, class: classId, course: occ.course, date, period, periodName: p.name,
    startAt: L.zonedToDate(date, p.start), endAt: L.zonedToDate(date, p.end),
    status: 'completed', source: 'manual',
    lesson: lesson ? lesson._id : null, unit: lesson ? lesson.unit : null
  });
  await svc.confirmTaught(session);
  res.json({ success: true, data: session });
});

/** 教师更正判定：taught=上了本课 / met=到课但没上新课 / not_taught=没上 */
exports.setJudgement = guard(async (req, res) => {
  const session = await ownSession(req, res);
  if (!session) return;
  const { state, reason = '' } = req.body || {};
  if (!['taught', 'met', 'not_taught'].includes(state)) return fail(res, 400, '参数错误');
  if (session.status === 'in_progress') return fail(res, 409, '课还没结束');
  await svc.teacherJudge(session, state, String(reason).slice(0, 200));
  res.json({ success: true, data: session });
});

async function ownSession(req, res) {
  if (!isId(req.params.id)) { fail(res, 400, '参数错误'); return null; }
  const s = await LessonSession.findOne({ _id: req.params.id, teacher: req.user._id });
  if (!s) { fail(res, 404, '记录不存在'); return null; }
  return s;
}

/** 修改这节课实际上的课时 / 备注 */
exports.updateSession = guard(async (req, res) => {
  const session = await ownSession(req, res);
  if (!session) return;
  const { lessonId, note } = req.body || {};
  if (session.status === 'skipped') return fail(res, 409, '未上的课节不能修改进度');
  if (lessonId !== undefined) {
    const lesson = await Lesson.findOne({ _id: lessonId, course: session.course }).select('unit').lean();
    if (!lesson) return fail(res, 404, '该课程下没有这个课时');
    session.lesson = lesson._id; session.unit = lesson.unit;
    // 教师明确指定了这节课上的课时：轨迹只保留这一条，判定时不再按停留时长改动
    session.lessonLog = [{ lesson: lesson._id, unit: lesson.unit, at: session.startedAt || session.startAt, by: 'teacher' }];
    if (session.status === 'in_progress') {
      await Class.updateOne({ _id: session.class }, { $set: { currentLesson: lesson._id, currentUnit: lesson.unit } });
    }
  }
  if (note !== undefined) session.note = String(note).slice(0, 500);
  await session.save();
  res.json({ success: true, data: session });
});

exports.getSession = guard(async (req, res) => {
  const session = await ownSession(req, res);
  if (!session) return;
  const students = await User.find({ classId: session.class, role: 'student' })
    .select('name username seatNumber').sort({ username: 1 }).lean();
  const map = new Map(session.attendance.map(a => [String(a.student), a]));
  res.json({
    success: true,
    data: {
      ...session.toObject(),
      roster: students.map(s => ({
        ...s,
        status: (map.get(String(s._id)) || {}).status || 'present',
        note: (map.get(String(s._id)) || {}).note || ''
      }))
    }
  });
});

exports.saveAttendance = guard(async (req, res) => {
  const session = await ownSession(req, res);
  if (!session) return;
  if (session.status === 'skipped') return fail(res, 409, '未上的课节不需要考勤');
  const { records } = req.body || {};
  if (!Array.isArray(records)) return fail(res, 400, '参数错误');
  const valid = new Set(['present', 'late', 'absent', 'leave']);
  const students = await User.find({ classId: session.class, role: 'student' }).select('_id').lean();
  const inClass = new Set(students.map(s => String(s._id)));

  const next = new Map();
  for (const r of records) {
    if (!inClass.has(String(r.studentId)) || !valid.has(r.status)) continue;
    next.set(String(r.studentId), { student: r.studentId, status: r.status, note: String(r.note || '').slice(0, 100) });
  }
  // 未提交的学生按出勤处理，保证花名册完整
  for (const id of inClass) if (!next.has(id)) next.set(id, { student: id, status: 'present', note: '' });
  session.attendance = [...next.values()];
  session.attendanceTaken = true;
  session.attendanceSource = 'teacher';
  await session.save();
  res.json({ success: true, data: { saved: session.attendance.length } });
});

exports.listCourseLessons = guard(async (req, res) => {
  const lessons = await svc.orderedLessons(req.params.courseId);
  res.json({ success: true, data: lessons.map(l => ({ _id: l._id, title: l.title, unit: l.unit })) });
});

// ───────────── 进度 / 导出 ─────────────

exports.getProgress = guard(async (req, res) => {
  const { classId } = req.query;
  if (!isId(classId) || !await ownClass(classId, req.user._id)) return fail(res, 404, '未找到该班级或无权操作');
  res.json({ success: true, data: await svc.classProgress(classId) });
});

exports.listSessions = guard(async (req, res) => {
  const { classId, from, to } = req.query;
  if (!isId(classId) || !await ownClass(classId, req.user._id)) return fail(res, 404, '未找到该班级或无权操作');
  const q = { class: classId };
  if (from || to) q.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  const sessions = await LessonSession.find(q).populate('lesson', 'title').populate('course', 'title')
    .sort({ date: -1, period: -1 }).limit(300).lean();
  res.json({
    success: true,
    data: sessions.map(s => {
      const c = { present: 0, late: 0, absent: 0, leave: 0 };
      s.attendance.forEach(a => { c[a.status]++; });
      return { ...s, attendance: undefined, attendanceCounts: c };
    })
  });
});

const MARK = { present: '', late: '迟', absent: '缺', leave: '假' };

/** 导出平日成绩花名册：学生 × 课节考勤矩阵 + 出勤汇总 + 平日成绩 */
exports.exportRoster = guard(async (req, res) => {
  const { classId, from, to, semester } = req.query;
  const classObj = isId(classId) ? await ownClass(classId, req.user._id) : null;
  if (!classObj) return fail(res, 404, '未找到该班级或无权操作');

  const range = semester ? semesterUtils.parseSemesterDateRange(semester) : {};
  const q = { class: classId, status: { $ne: 'skipped' } };
  const fromKey = from || (range.startDate && L.zonedParts(range.startDate).dateKey);
  const toKey = to || (range.endDate && L.zonedParts(range.endDate).dateKey);
  if (fromKey || toKey) q.date = { ...(fromKey && { $gte: fromKey }), ...(toKey && { $lte: toKey }) };

  const [sessions, students] = await Promise.all([
    LessonSession.find(q).populate('lesson', 'title').populate('course', 'title').sort({ date: 1, period: 1 }).lean(),
    User.find({ classId, role: 'student' }).select('name username seatNumber gender').sort({ username: 1 }).lean()
  ]);

  let scoreMap = new Map();
  try {
    const { calculateDailyScoresForStudents } = require('./analyticsController');
    const scores = await calculateDailyScoresForStudents(students.map(s => s._id), semester || undefined);
    scoreMap = new Map(scores.map(s => [String(s.studentId), s.dailyScore]));
  } catch (e) {
    logger.warn('导出花名册时计算平日成绩失败，成绩列留空', { error: e.message });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('平日成绩花名册');
  const taken = sessions.filter(s => s.attendanceTaken); // 只统计点过名的课节
  const fixedHeaders = ['序号', '学号', '姓名', '性别', '座号'];
  const sumHeaders = ['应到次数', '出勤', '迟到', '缺勤', '请假', '出勤率', '平日成绩'];
  const sessionHeaders = sessions.map(s => `${s.date.slice(5)} 第${s.period}节`);
  ws.addRow([`${classObj.grade}级${classObj.name}班 平日成绩花名册`]);
  ws.addRow([`导出时间：${new Date().toLocaleString('zh-CN', { timeZone: L.getTimezone() })}　课节数：${sessions.length}（已点名 ${taken.length}）　标记：迟=迟到 缺=缺勤 假=请假 空=出勤`]);
  ws.addRow([...fixedHeaders, ...sumHeaders, ...sessionHeaders]);
  const leadCols = fixedHeaders.length + sumHeaders.length;
  ws.addRow([
    ...Array(leadCols - 1).fill(''), '课程：课时 →',
    ...sessions.map(s => `${(s.course && s.course.title) || ''}${s.lesson ? '：' + s.lesson.title : ''}`)
  ]);

  students.forEach((stu, idx) => {
    const cnt = { present: 0, late: 0, absent: 0, leave: 0 };
    const cells = sessions.map(s => {
      if (!s.attendanceTaken) return '-';
      const rec = s.attendance.find(a => String(a.student) === String(stu._id));
      const st = rec ? rec.status : 'present';
      cnt[st]++;
      return MARK[st];
    });
    const total = taken.length;
    const attended = cnt.present + cnt.late;
    ws.addRow([
      idx + 1, stu.username, stu.name,
      { male: '男', female: '女' }[stu.gender] || '', stu.seatNumber || '',
      total, cnt.present, cnt.late, cnt.absent, cnt.leave,
      total ? `${Math.round(attended / total * 1000) / 10}%` : '-',
      scoreMap.has(String(stu._id)) ? scoreMap.get(String(stu._id)) : '',
      ...cells
    ]);
  });

  ws.mergeCells(1, 1, 1, fixedHeaders.length + sumHeaders.length);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.getRow(3).font = { bold: true };
  ws.getRow(4).font = { color: { argb: 'FF738078' }, size: 9 };
  ws.getRow(4).alignment = { wrapText: true, vertical: 'top' };
  ws.columns.forEach((c, i) => { c.width = i < 3 ? 12 : i < 12 ? 9 : 14; });
  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];

  const filename = encodeURIComponent(`${classObj.grade}级${classObj.name}班-平日成绩花名册.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
  await wb.xlsx.write(res);
  res.end();
});
