const cron = require('node-cron');
const Setting = require('../models/Setting');
const Class = require('../models/Class');
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const CourseUnit = require('../models/CourseUnit');
require('../models/Course'); // populate('course') 需要已注册的模型
const ScheduleSlot = require('../models/ScheduleSlot');
const ScheduleAdjustment = require('../models/ScheduleAdjustment');
const LessonSession = require('../models/LessonSession');
const logger = require('../utils/logger');
const L = require('./scheduleLogic');
const { collectCompletions, isLessonTrackable } = require('./lessonActivity');

const CONFIG_KEY = 'schedule.config';
const JUDGE_GRACE_MIN = 10;   // 下课后再等 10 分钟收齐提交，再判定上没上
const EARLY_BIND_MIN = 30;    // 教师提前这么多分钟内手动上课，视为同一节课
const LESSON_PICK_MIN = 30;   // 教师在上课前这么多分钟内手动选过课时，则以教师选择为准

const DEFAULT_CONFIG = {
  days: [1, 2, 3, 4, 5],
  leadMinutes: 5,
  presenceThreshold: 30, // 本节课内登录学生达到该比例 -> 到课
  threshold: 25,         // 完成本节课时活动的学生达到该比例 -> 上了本课
  periods: [
    { index: 1, name: '第1节', start: '08:00', end: '08:40' },
    { index: 2, name: '第2节', start: '08:50', end: '09:30' },
    { index: 3, name: '第3节', start: '09:50', end: '10:30' },
    { index: 4, name: '第4节', start: '10:40', end: '11:20' },
    { index: 5, name: '第5节', start: '14:00', end: '14:40' },
    { index: 6, name: '第6节', start: '14:50', end: '15:30' },
    { index: 7, name: '第7节', start: '15:40', end: '16:20' }
  ]
};

const clampInt = (v, min, max, dflt) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : dflt;
};

// ───────────── 配置 ─────────────

async function getConfig() {
  const doc = await Setting.findOne({ key: CONFIG_KEY }).lean();
  const v = (doc && doc.value) || {};
  return {
    periods: (v.periods && L.normalizePeriods(v.periods).periods) || DEFAULT_CONFIG.periods,
    days: (v.days && L.normalizeDays(v.days).days) || DEFAULT_CONFIG.days,
    leadMinutes: clampInt(v.leadMinutes, 0, 30, DEFAULT_CONFIG.leadMinutes),
    threshold: clampInt(v.threshold, 1, 100, DEFAULT_CONFIG.threshold),
    presenceThreshold: clampInt(v.presenceThreshold, 1, 100, DEFAULT_CONFIG.presenceThreshold),
    timezone: L.getTimezone(),
    isDefault: !doc
  };
}

async function saveConfig({ periods, days, leadMinutes, threshold, presenceThreshold }) {
  const p = L.normalizePeriods(periods);
  if (p.error) return { error: p.error };
  const d = L.normalizeDays(days);
  if (d.error) return { error: d.error };
  const lead = clampInt(leadMinutes ?? DEFAULT_CONFIG.leadMinutes, 0, 30, null);
  if (lead === null) return { error: '提前上课时间应为 0-30 分钟' };
  const th = clampInt(threshold ?? DEFAULT_CONFIG.threshold, 1, 100, null);
  if (th === null) return { error: '活动判定比例应为 1-100%' };
  const pr = clampInt(presenceThreshold ?? DEFAULT_CONFIG.presenceThreshold, 1, 100, null);
  if (pr === null) return { error: '到课判定比例应为 1-100%' };
  const value = { periods: p.periods, days: d.days, leadMinutes: lead, threshold: th, presenceThreshold: pr };
  await Setting.findOneAndUpdate(
    { key: CONFIG_KEY },
    { key: CONFIG_KEY, value, description: '课表节次、上课日与自动判定设置' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return value;
}

// ───────────── 课时与进度 ─────────────

/** 课程下全部课时，按 单元顺序 -> 课时顺序 排列 */
async function orderedLessons(courseId) {
  if (!courseId) return [];
  const units = await CourseUnit.find({ course: courseId }).select('_id order').sort({ order: 1 }).lean();
  const unitRank = new Map(units.map((u, i) => [String(u._id), i]));
  const lessons = await Lesson.find({ course: courseId })
    .select('_id unit order title course activities.type activities.requireSubmission').lean();
  lessons.sort((a, b) =>
    (unitRank.get(String(a.unit)) ?? 1e9) - (unitRank.get(String(b.unit)) ?? 1e9) ||
    (a.order || 0) - (b.order || 0)
  );
  return lessons;
}

const classStudentIds = async (classId) =>
  (await User.find({ classId, role: 'student' }).select('_id').lean()).map(s => s._id);

/** 该班在该课程上过的课时（≥阈值比例的学生至少完成过一个活动，不限时间） */
async function taughtSetFor(classId, lessons, cfg, studentIds) {
  const ids = studentIds || await classStudentIds(classId);
  const completions = await collectCompletions({ studentIds: ids, lessonIds: lessons.map(l => l._id) });
  return L.taughtLessonSet(completions, ids.length, cfg.threshold);
}

/**
 * 最近一次真正上过的课时：已判定上过的课节；或尚未判定、但学生活动已经达标 / 无法追踪的课节
 */
async function lastTaughtLesson(classId, courseId, lessons, taughtSet, excludeSessionId) {
  const q = { class: classId, course: courseId, status: { $in: ['completed', 'in_progress'] }, lesson: { $ne: null } };
  if (excludeSessionId) q._id = { $ne: excludeSessionId };
  const recent = await LessonSession.find(q).sort({ startAt: -1 }).limit(20).select('lesson judgement').lean();
  const byId = new Map(lessons.map(l => [String(l._id), l]));
  for (const s of recent) {
    const st = s.judgement && s.judgement.state;
    const id = String(s.lesson);
    if (st === 'taught' || st === 'assumed') return id;
    if (st === 'pending' && (taughtSet.has(id) || !isLessonTrackable(byId.get(id)))) return id;
  }
  return null;
}

/**
 * 本节课默认应上的课时。
 * 没有下一课时（教师一节一节备课、下一节还没建；或本课程已上完）时返回 null：
 * 照常上课但不指定课时，等教师建好 / 选择后再切换，避免把已上过的课时又记一遍。
 */
async function resolveNextLesson(classId, courseId, excludeSessionId) {
  const cfg = await getConfig();
  const lessons = await orderedLessons(courseId);
  if (!lessons.length) return null;
  const taught = await taughtSetFor(classId, lessons, cfg);
  const last = await lastTaughtLesson(classId, courseId, lessons, taught, excludeSessionId);
  const nextId = L.pickNextLesson(lessons.map(l => String(l._id)), last, taught);
  return lessons.find(l => String(l._id) === nextId) || null;
}

/**
 * 这节课上哪门课程（课表里可以不填课程）：
 * 1. 课表里为这节课固定了课程 -> 用它
 * 2. 该班最近一次实际上的课程（教师在上课页切到新模块后，之后自动跟随）
 * 3. 班级当前选择的课程
 * 4. 该教师最早创建的课程
 */
async function resolveCourse({ classId, teacherId, pinned }) {
  if (pinned) return pinned;
  const last = await LessonSession.findOne({ class: classId, course: { $ne: null }, status: { $ne: 'skipped' } })
    .sort({ startAt: -1 }).select('course').lean();
  if (last) return last.course;
  const cls = await Class.findById(classId).select('currentCourse').lean();
  if (cls && cls.currentCourse) return cls.currentCourse;
  const Course = require('../models/Course');
  const first = teacherId && await Course.findOne({ instructor: teacherId }).sort({ createdAt: 1 }).select('_id').lean();
  return first ? first._id : null;
}

// ───────────── 课节 ─────────────

/** 区间内（含）每天的有效课节，附带已存在的 session */
async function listOccurrences({ teacherId, from, to }) {
  const dates = L.dateRange(from, to);
  if (!dates.length) return [];
  const cfg = await getConfig();
  const [slots, adjustments, sessions] = await Promise.all([
    ScheduleSlot.find({ teacher: teacherId }).lean(),
    ScheduleAdjustment.find({ teacher: teacherId, date: { $gte: from, $lte: to } }).lean(),
    LessonSession.find({ teacher: teacherId, date: { $gte: from, $lte: to } }).populate('lesson', 'title').lean()
  ]);
  const sessionMap = new Map(sessions.map(s => [`${s.class}:${s.date}:${s.period}`, s]));
  const periodMap = new Map(cfg.periods.map(p => [p.index, p]));

  const out = [];
  for (const date of dates) {
    const occ = L.effectiveOccurrences({ slots, adjustments, dateKey: date, days: cfg.days });
    for (const o of occ) {
      const p = periodMap.get(o.period);
      if (!p) continue; // 节次已被管理员删除
      out.push({
        ...o, date, periodName: p.name, start: p.start, end: p.end,
        session: sessionMap.get(`${o.class}:${date}:${o.period}`) || null
      });
    }
    // 课表之外产生的课节（教师临时手动上课）也展示
    for (const s of sessions) {
      if (s.date !== date) continue;
      if (!occ.some(o => String(o.class) === String(s.class) && o.period === s.period)) {
        const p = periodMap.get(s.period);
        out.push({
          teacher: String(s.teacher), class: String(s.class), course: s.course ? String(s.course) : null, period: s.period,
          source: 'extra', date, periodName: s.periodName, start: p && p.start, end: p && p.end, session: s
        });
      }
    }
  }
  return out;
}

async function findOccurrence({ teacherId, classId, date, period }) {
  const occ = await listOccurrences({ teacherId, from: date, to: date });
  return occ.find(o => String(o.class) === String(classId) && o.period === Number(period)) || null;
}

const sessionEnd = (s) => s.endedAt || s.endAt;

/** 结束一节课（不判定）；若班级上课状态属于这节课则同时下课 */
async function completeSession(session, { now = new Date() } = {}) {
  if (session.status !== 'in_progress') return session;
  session.status = 'completed';
  session.endedAt = now < session.endAt ? now : session.endAt;
  await session.save();
  await Class.updateOne(
    { _id: session.class, isInClass: true, scheduledEndTime: { $lte: new Date(session.endAt.getTime() + 1000) } },
    { $set: { isInClass: false, scheduledEndTime: null } }
  );
  return session;
}

/**
 * 开始一节课：创建/复用 session，把班级切到该课时并置为上课中。
 * force=true 表示教师主动开始：可重新打开已结束或被标记未上的这一节。
 */
async function startSession(occ, { lessonId: pickedLesson, now = new Date(), force = false } = {}) {
  let lessonId = pickedLesson;
  const cfg = await getConfig();
  const p = cfg.periods.find(x => x.index === occ.period);
  if (!p) throw new Error('节次不存在');
  const startAt = L.zonedToDate(occ.date, p.start);
  const endAt = L.zonedToDate(occ.date, p.end);

  let session = await LessonSession.findOne({ class: occ.class, date: occ.date, period: occ.period });
  if (session && !force) {
    // 定时任务每分钟都会经过这里：已开始 / 已结束 / 已标记的节次都不重复处理
    return { session, started: false, reason: session.status };
  }

  // 同一班级另一节还在进行（例如上一节手动上课拖堂），由这一节接替
  const others = await LessonSession.find({ class: occ.class, status: 'in_progress', ...(session && { _id: { $ne: session._id } }) });
  for (const o of others) await completeSession(o, { now });

  // 教师刚在上课页选过课时（如课前备好要上的课），以教师选择为准
  let lessonBy = lessonId ? 'teacher' : 'auto';
  if (!lessonId && !(session && session.lesson)) {
    const cls = await Class.findById(occ.class).select('currentLesson lessonSelectedAt').lean();
    if (cls && cls.currentLesson && cls.lessonSelectedAt && now - new Date(cls.lessonSelectedAt) <= LESSON_PICK_MIN * 60 * 1000) {
      lessonId = cls.currentLesson; lessonBy = 'teacher';
    }
  }
  const plannedCourse = (session && session.course) || await resolveCourse({ classId: occ.class, teacherId: occ.teacher, pinned: occ.course });
  const lesson = lessonId
    ? await Lesson.findById(lessonId).select('_id unit course title').lean()
    : (session && session.lesson
      ? await Lesson.findById(session.lesson).select('_id unit course title').lean()
      : await resolveNextLesson(occ.class, plannedCourse, session && session._id));
  const course = lesson ? lesson.course : plannedCourse;

  if (!session) {
    try {
      session = await LessonSession.create({
        teacher: occ.teacher, class: occ.class, course,
        date: occ.date, period: occ.period, periodName: p.name,
        startAt, endAt, startedAt: now, status: 'in_progress', source: occ.source === 'adjust' ? 'adjust' : (occ.source === 'manual' ? 'manual' : 'slot'),
        lesson: lesson ? lesson._id : null, unit: lesson ? lesson.unit : null,
        lessonLog: lesson ? [{ lesson: lesson._id, unit: lesson.unit, at: now, by: lessonBy }] : []
      });
    } catch (e) {
      if (e.code === 11000) return { session: null, started: false, reason: 'exists' };
      throw e;
    }
  } else {
    Object.assign(session, {
      teacher: occ.teacher, course, status: 'in_progress', skipReason: '',
      startedAt: session.startedAt && session.startedAt < now ? session.startedAt : now,
      endedAt: null,
      lesson: lesson ? lesson._id : session.lesson, unit: lesson ? lesson.unit : session.unit,
      judgement: { state: 'pending', by: 'auto' }
    });
    if (lesson) session.lessonLog.push({ lesson: lesson._id, unit: lesson.unit, at: now, by: lessonBy });
    await session.save();
  }

  const set = { isInClass: true, scheduledEndTime: endAt > now ? endAt : new Date(now.getTime() + 60 * 1000) };
  if (course) set.currentCourse = course;
  // 下一课时还没准备好：不让学生停在已上过的课时上
  if (lesson) { set.currentLesson = lesson._id; set.currentUnit = lesson.unit; } else if (lessonBy === 'auto') { set.currentLesson = null; set.currentUnit = null; }
  await Class.updateOne({ _id: occ.class }, { $set: set });

  logger.info('课表上课', { classId: String(occ.class), date: occ.date, period: occ.period, lesson: lesson && lesson.title, force });
  return { session, started: true };
}

/**
 * 统计本节课时间内：登录过的学生、完成过活动的学生。
 * 连堂（同班上一节刚结束且上过）时学生通常不会重新登录，到课窗口向前延伸到上一节开始。
 */
async function measureSession(session) {
  const students = await User.find({ classId: session.class, role: 'student' }).select('_id loginHistory.timestamp').lean();
  const studentIds = students.map(s => s._id);
  const from = session.startedAt || session.startAt;
  const to = new Date(sessionEnd(session).getTime() + JUDGE_GRACE_MIN * 60 * 1000);

  let presenceFrom = from;
  const prev = await LessonSession.findOne({
    class: session.class, _id: { $ne: session._id }, status: 'completed',
    endAt: { $gte: new Date(from.getTime() - 15 * 60 * 1000), $lte: sessionEnd(session) },
    'judgement.state': { $in: ['taught', 'met'] }
  }).sort({ endAt: -1 }).lean();
  if (prev) presenceFrom = prev.startedAt || prev.startAt;

  const present = new Set(students
    .filter(st => (st.loginHistory || []).some(h => h.timestamp >= presenceFrom && h.timestamp <= sessionEnd(session)))
    .map(st => String(st._id)));

  const lessons = await orderedLessons(session.course);
  const completions = await collectCompletions({ studentIds, lessonIds: lessons.map(l => l._id), from, to });
  const active = new Set(completions.map(c => c.student)); // 做过本课程任意活动（用于考勤）

  // 本节课实际上的课时（教师切换轨迹中停留最久的），只统计它的活动
  const lessonId = (session.lessonLog && session.lessonLog.length)
    ? L.dominantLesson(session.lessonLog, from, sessionEnd(session))
    : (session.lesson ? String(session.lesson) : null);
  const lesson = lessonId ? lessons.find(l => String(l._id) === lessonId) : null;
  const lessonActive = new Set(completions.filter(c => lessonId && c.lesson === lessonId).map(c => c.student));
  return { studentIds, present, active, lessonActive, lesson, lessons, from, to };
}

/** 按到课登录生成考勤（教师手动点过名的不覆盖）：登录过或做过活动 -> 出勤，否则缺勤 */
function applyAutoAttendance(session, m) {
  if (session.attendanceSource === 'teacher') return;
  session.attendance = m.studentIds.map(id => ({
    student: id, status: (m.present.has(String(id)) || m.active.has(String(id))) ? 'present' : 'absent', note: ''
  }));
  session.attendanceTaken = true;
  session.attendanceSource = 'auto';
}

/** 课时以教师的切换轨迹为准：取本节课内停留最久的课时 */
function applyDominantLesson(session, m) {
  if (m.lesson) { session.lesson = m.lesson._id; session.unit = m.lesson.unit; }
}

const clearAutoAttendance = (session) => {
  if (session.attendanceSource === 'auto') { session.attendance = []; session.attendanceTaken = false; session.attendanceSource = null; }
};

/** 写入判定结果；by=teacher 时之后不再自动改动 */
function applyJudgement(session, m, state, { by, basis = null, reason = '' } = {}) {
  session.judgement = {
    state, by, basis, presentStudents: m.present.size, activeStudents: m.lessonActive.size,
    totalStudents: m.studentIds.length, judgedAt: new Date()
  };
  applyDominantLesson(session, m);
  if (state === 'not_taught') {
    session.status = 'skipped';
    session.skipReason = reason;
    clearAutoAttendance(session);
    return;
  }
  session.status = 'completed';
  session.skipReason = state === 'met' ? reason : '';
  if (m.present.size || m.active.size) applyAutoAttendance(session, m); else clearAutoAttendance(session);
}

/** 自动判定这节课的情况（教师手动标记过的不改） */
async function judge(session, cfg) {
  if (session.judgement && session.judgement.by === 'teacher') return session;
  const m = await measureSession(session);
  const r = L.judgeSession({
    presentCount: m.present.size, lessonActiveCount: m.lessonActive.size, studentCount: m.studentIds.length,
    presencePercent: cfg.presenceThreshold, activityPercent: cfg.threshold, lessonTrackable: isLessonTrackable(m.lesson)
  });
  const n = m.studentIds.length;
  const reason = r.state === 'not_taught'
    ? `自动判定没上：本节课时间内仅 ${m.present.size}/${n} 名学生登录、${m.lessonActive.size} 名完成本课活动`
    : r.state === 'met'
      ? `自动判定到课但没上新课：${m.present.size}/${n} 名学生登录，只有 ${m.lessonActive.size} 名完成本课活动（不足 ${cfg.threshold}%），进度不前进`
      : '';
  applyJudgement(session, m, r.state, { by: 'auto', basis: r.basis, reason });
  await session.save();
  logger.info('课表自动判定', { session: String(session._id), state: r.state, present: m.present.size, lessonActive: m.lessonActive.size, total: n });
  return session;
}

/**
 * 教师更正判定：taught=上了本课，met=到课但没上新课，not_taught=没上。
 * 考勤仍按登录生成（教师点过名的不覆盖）。
 */
async function teacherJudge(session, state, reason = '') {
  const m = await measureSession(session);
  if (state === 'taught' && !m.lesson && !session.lesson) {
    const lesson = await resolveNextLesson(session.class, session.course, session._id);
    if (lesson) { session.lesson = lesson._id; session.unit = lesson.unit; }
  }
  const text = reason || (state === 'met' ? '教师标记：到课但没上新课' : state === 'not_taught' ? '教师标记：没上' : '');
  applyJudgement(session, m, state, { by: 'teacher', reason: text });
  await session.save();
  return session;
}

const confirmTaught = (session) => teacherJudge(session, 'taught');

/** 当天所有教师的有效课节（定时任务用） */
async function todaysOccurrences(dateKey, weekday, cfg, periodFilter) {
  const pq = periodFilter ? { period: { $in: periodFilter } } : {};
  const [slots, adjustments] = await Promise.all([
    ScheduleSlot.find({ weekday, ...pq }).lean(),
    ScheduleAdjustment.find({ date: dateKey, ...pq }).lean()
  ]);
  const teachers = new Set([...slots.map(s => String(s.teacher)), ...adjustments.map(a => String(a.teacher))]);
  const out = [];
  for (const t of teachers) {
    out.push(...L.effectiveOccurrences({
      slots: slots.filter(s => String(s.teacher) === t),
      adjustments: adjustments.filter(a => String(a.teacher) === t),
      dateKey, days: cfg.days
    }).map(o => ({ ...o, date: dateKey })));
  }
  return out;
}

/**
 * 每分钟一次，幂等：
 * 1. 到下课时间的课节结束
 * 2. 下课 10 分钟后，按学生活动判定上没上
 * 3. 课表里有、但系统没记录的课（服务停机、未开自动上课等）补建记录并判定
 * 4. 上课前 N 分钟自动上课
 */
async function tick(now = new Date()) {
  const cfg = await getConfig();

  for (const s of await LessonSession.find({ status: 'in_progress', endAt: { $lte: now } })) {
    try { await completeSession(s, { now }); } catch (e) { logger.error('课表结课失败', { error: e.message }); }
  }

  const graceAgo = new Date(now.getTime() - JUDGE_GRACE_MIN * 60 * 1000);
  const toJudge = await LessonSession.find({
    status: 'completed', 'judgement.state': 'pending', 'judgement.by': { $ne: 'teacher' },
    $or: [{ endedAt: { $lte: graceAgo } }, { endedAt: null, endAt: { $lte: graceAgo } }]
  });
  for (const s of toJudge) {
    try { await judge(s, cfg); } catch (e) { logger.error('课表判定失败', { error: e.message }); }
  }

  // 上课时下一课时还没准备好的课：教师在课上建好新课时后，自动切过去（教师手动选过课时的不动）
  for (const s of await LessonSession.find({ status: 'in_progress', lesson: null, course: { $ne: null } })) {
    try {
      if ((s.lessonLog || []).some(x => x.by === 'teacher')) continue;
      const lesson = await resolveNextLesson(s.class, s.course, s._id);
      if (!lesson) continue;
      s.lesson = lesson._id; s.unit = lesson.unit;
      s.lessonLog.push({ lesson: lesson._id, unit: lesson.unit, at: now, by: 'auto' });
      await s.save();
      await Class.updateOne({ _id: s.class, isInClass: true }, { $set: { currentLesson: lesson._id, currentUnit: lesson.unit, currentCourse: lesson.course } });
      logger.info('课表：新课时已准备好，自动切换', { classId: String(s.class), lesson: lesson.title });
    } catch (e) { logger.error('课表自动切换新课时失败', { error: e.message }); }
  }

  const { dateKey, weekday, minutes } = L.zonedParts(now);
  if (!cfg.days.includes(weekday)) return;

  // 3. 补建：今天已下课超过 10 分钟、却没有记录的课
  const ended = cfg.periods.filter(p => L.toMinutes(p.end) + JUDGE_GRACE_MIN <= minutes).map(p => p.index);
  if (ended.length) {
    const occs = await todaysOccurrences(dateKey, weekday, cfg, ended);
    const existing = await LessonSession.find({ date: dateKey, period: { $in: ended } }).select('class period').lean();
    const has = new Set(existing.map(s => `${s.class}:${s.period}`));
    for (const o of occs) {
      if (has.has(`${o.class}:${o.period}`)) continue;
      try {
        const p = cfg.periods.find(x => x.index === o.period);
        const course = await resolveCourse({ classId: o.class, teacherId: o.teacher, pinned: o.course });
        const lesson = await resolveNextLesson(o.class, course);
        const s = await LessonSession.create({
          teacher: o.teacher, class: o.class, course: lesson ? lesson.course : course, date: dateKey, period: o.period, periodName: p.name,
          startAt: L.zonedToDate(dateKey, p.start), endAt: L.zonedToDate(dateKey, p.end),
          status: 'completed', source: o.source === 'adjust' ? 'adjust' : 'slot',
          lesson: lesson ? lesson._id : null, unit: lesson ? lesson.unit : null
        });
        await judge(s, cfg);
      } catch (e) {
        if (e.code !== 11000) logger.error('课表补建记录失败', { error: e.message });
      }
    }
  }

  // 4. 自动上课
  const active = L.activePeriods(cfg.periods, minutes, cfg.leadMinutes).map(p => p.index);
  if (!active.length) return;
  for (const o of await todaysOccurrences(dateKey, weekday, cfg, active)) {
    if (!o.autoStart) continue;
    try { await startSession(o, { now }); } catch (e) {
      logger.error('课表自动上课失败', { error: e.message, class: o.class, period: o.period });
    }
  }
}

// ───────────── 与「上课」页面的手动操作联动 ─────────────

/**
 * 教师在上课页面手动点「上课」：
 * - 结束该教师在其他班进行中的课（人只能在一个地方上课）
 * - 若该班今天有课表课、尚未下课且距离上课不超过 30 分钟 -> 视为这一节（提前上课也是同一节）
 * - 否则落到当前 / 即将开始的节次，记一节课表外的课（教师忘了调课时仍能记录）
 */
/** 教师主动去某班上课时，结束他在其他班进行中的课 */
async function endTeacherElsewhere({ teacherId, classId, now = new Date() }) {
  const elsewhere = await LessonSession.find({ teacher: teacherId, status: 'in_progress', class: { $ne: classId } });
  for (const s of elsewhere) {
    await completeSession(s, { now });
    await Class.updateOne({ _id: s.class }, { $set: { isInClass: false, scheduledEndTime: null } });
  }
}

async function onManualStart({ classId, teacherId, now = new Date() }) {
  const cfg = await getConfig();
  const { dateKey, minutes } = L.zonedParts(now);

  await endTeacherElsewhere({ teacherId, classId, now });

  const classObj = await Class.findById(classId).select('currentLesson currentCourse lessonSelectedAt').lean();
  const recentPick = classObj.currentLesson && classObj.lessonSelectedAt &&
    now - new Date(classObj.lessonSelectedAt) <= LESSON_PICK_MIN * 60 * 1000;

  const occs = (await listOccurrences({ teacherId, from: dateKey, to: dateKey }))
    .filter(o => String(o.class) === String(classId) && o.source !== 'extra');
  const bound = L.bindManualStart(occs, minutes, EARLY_BIND_MIN);
  if (bound) return startSession({ ...bound, date: dateKey }, { now, force: true });

  const p = L.periodForManualStart(cfg.periods, minutes, EARLY_BIND_MIN);
  if (!p) return { started: false, reason: 'no_period' };
  let course = null;
  if (recentPick) course = (await Lesson.findById(classObj.currentLesson).select('course').lean() || {}).course;
  if (!course) course = classObj.currentCourse || await resolveCourse({ classId, teacherId });
  return startSession(
    { teacher: teacherId, class: classId, course, period: p.index, date: dateKey, source: 'manual' },
    { now, force: true }
  );
}

async function onManualStop({ classId, now = new Date() }) {
  for (const s of await LessonSession.find({ class: classId, status: 'in_progress' })) await completeSession(s, { now });
}

/** 教师在上课中切换课时：记入切换轨迹，判定时取停留最久的课时 */
async function onManualLessonChange({ classId, lessonId, now = new Date() }) {
  const lesson = await Lesson.findById(lessonId).select('unit course').lean();
  if (!lesson) return;
  await LessonSession.updateMany(
    { class: classId, status: 'in_progress' },
    {
      $set: { lesson: lesson._id, unit: lesson.unit, course: lesson.course },
      $push: { lessonLog: { lesson: lesson._id, unit: lesson.unit, at: now, by: 'teacher' } }
    }
  );
}

/** 教师端顶部状态：服务器时间、正在上的课、下一节将自动上课的班级 */
async function nowStatus(teacherId, now = new Date()) {
  const cfg = await getConfig();
  const { dateKey, minutes } = L.zonedParts(now);
  const occs = await listOccurrences({ teacherId, from: dateKey, to: L.addDays(dateKey, 6) });
  const inProgress = await LessonSession.findOne({ teacher: teacherId, status: 'in_progress' })
    .populate('class', 'grade name').populate('course', 'title').populate('lesson', 'title').lean();
  const startOf = (o) => L.zonedToDate(o.date, o.start);
  const upcoming = occs
    .filter(o => o.start && !o.session && (o.date > dateKey || L.toMinutes(o.start) > minutes))
    .sort((a, b) => startOf(a) - startOf(b))[0] || null;
  let next = null;
  if (upcoming) {
    const Course = require('../models/Course');
    const course = await resolveCourse({ classId: upcoming.class, teacherId, pinned: upcoming.course });
    const lesson = course ? await resolveNextLesson(upcoming.class, course) : null;
    const [cls, c] = await Promise.all([
      Class.findById(upcoming.class).select('grade name').lean(),
      course ? Course.findById(course).select('title').lean() : null
    ]);
    next = {
      date: upcoming.date, period: upcoming.period, periodName: upcoming.periodName, start: upcoming.start, end: upcoming.end,
      class: cls, course: c, lesson: lesson ? { _id: lesson._id, title: lesson.title } : null,
      lessonMissing: !!course && !lesson,
      autoStart: upcoming.autoStart !== false,
      autoStartAt: upcoming.autoStart !== false ? new Date(startOf(upcoming).getTime() - cfg.leadMinutes * 60000) : null
    };
  }
  return {
    serverTime: now, timezone: cfg.timezone,
    current: inProgress ? {
      sessionId: inProgress._id, classId: inProgress.class && inProgress.class._id, class: inProgress.class,
      course: inProgress.course, lesson: inProgress.lesson, period: inProgress.period, periodName: inProgress.periodName,
      endAt: inProgress.endAt, lessonMissing: !inProgress.lesson
    } : null,
    next
  };
}

let started = false;
function startScheduleTicker() {
  if (started) return;
  started = true;
  cron.schedule('* * * * *', async () => {
    try { await tick(new Date()); } catch (e) { logger.error('课表定时任务出错', { error: e.message }); }
  });
  tick(new Date()).catch(e => logger.error('课表启动补跑出错', { error: e.message }));
}

/** 班级各课程的上课进度（课节记录 + 学生活动判定） */
async function classProgress(classId) {
  const cfg = await getConfig();
  const sessions = await LessonSession.find({ class: classId })
    .populate('lesson', 'title').populate('unit', 'title').populate('course', 'title')
    .sort({ startAt: -1 }).lean();
  const studentIds = await classStudentIds(classId);
  const byCourse = new Map();
  for (const s of sessions) {
    if (!s.course) continue;
    const cid = String(s.course._id);
    if (!byCourse.has(cid)) byCourse.set(cid, { course: s.course, completed: 0, met: 0, skipped: 0, autoSkipped: 0, pending: 0, lastLesson: null, lastUnit: null, lastDate: null });
    const r = byCourse.get(cid);
    const st = s.judgement && s.judgement.state;
    if (s.status === 'skipped') { r.skipped++; if (s.judgement && s.judgement.by === 'auto') r.autoSkipped++; }
    else if (st === 'met') r.met++;
    else {
      if (s.status === 'completed' && st !== 'pending') r.completed++; else r.pending++;
      if (!r.lastLesson && s.lesson) { r.lastLesson = s.lesson; r.lastUnit = s.unit; r.lastDate = s.date; }
    }
  }
  const result = [...byCourse.values()];
  for (const r of result) {
    const lessons = await orderedLessons(r.course._id);
    const taught = await taughtSetFor(classId, lessons, cfg, studentIds);
    r.totalLessons = lessons.length;
    r.taughtLessons = lessons.filter(l => taught.has(String(l._id))).length;
    const idx = r.lastLesson ? lessons.findIndex(l => String(l._id) === String(r.lastLesson._id)) : -1;
    r.lessonPosition = idx + 1;
    const next = await resolveNextLesson(classId, r.course._id);
    r.nextLesson = next ? { _id: next._id, title: next.title } : null;
  }
  return result;
}

module.exports = {
  CONFIG_KEY, DEFAULT_CONFIG, JUDGE_GRACE_MIN, EARLY_BIND_MIN,
  getConfig, saveConfig, orderedLessons, resolveNextLesson,
  listOccurrences, findOccurrence, startSession, completeSession, judge, confirmTaught, teacherJudge, tick,
  onManualStart, onManualStop, onManualLessonChange, endTeacherElsewhere, resolveCourse, nowStatus,
  startScheduleTicker, classProgress
};
