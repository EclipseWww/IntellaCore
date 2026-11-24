/**
 * 课表纯逻辑（无数据库依赖，便于测试）
 *
 * 约定：
 * - 日期用 'YYYY-MM-DD' 字符串表示（按课表时区）
 * - weekday: 1=周一 ... 7=周日
 * - period: 节次序号，从 1 开始
 */

const DEFAULT_TZ = 'Asia/Shanghai';
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PERIODS = 20;

const getTimezone = () => process.env.SCHEDULE_TIMEZONE || DEFAULT_TZ;

const toMinutes = (hhmm) => {
  const m = HHMM.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** 校验并规范化节次设置，返回 { periods } 或 { error } */
function normalizePeriods(input) {
  if (!Array.isArray(input) || input.length === 0) return { error: '至少需要设置一节课' };
  if (input.length > MAX_PERIODS) return { error: `每天最多 ${MAX_PERIODS} 节课` };

  const periods = [];
  for (let i = 0; i < input.length; i++) {
    const p = input[i] || {};
    const start = toMinutes(p.start);
    const end = toMinutes(p.end);
    if (start === null || end === null) return { error: `第 ${i + 1} 节的时间格式应为 HH:MM` };
    if (start >= end) return { error: `第 ${i + 1} 节的下课时间必须晚于上课时间` };
    if (periods.length && start < toMinutes(periods[periods.length - 1].end)) {
      return { error: `第 ${i + 1} 节与上一节时间重叠，请按先后顺序填写` };
    }
    periods.push({
      index: i + 1,
      name: String(p.name || '').trim().slice(0, 20) || `第${i + 1}节`,
      start: p.start,
      end: p.end
    });
  }
  return { periods };
}

function normalizeDays(input) {
  if (!Array.isArray(input)) return { error: '上课日格式错误' };
  const days = [...new Set(input.map(Number))].filter(d => Number.isInteger(d) && d >= 1 && d <= 7).sort();
  if (days.length === 0) return { error: '至少选择一个上课日' };
  return { days };
}

/** 取得某个时刻在指定时区下的 日期/星期/当天分钟数 */
function zonedParts(date, tz = getTimezone()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short'
  }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday];
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

/** 将 (日期, HH:MM, 时区) 转为真实时间点 */
function zonedToDate(dateKey, hhmm, tz = getTimezone()) {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const mins = toMinutes(hhmm);
  const guess = Date.UTC(y, mo - 1, d, Math.floor(mins / 60), mins % 60);
  const asZoned = (ms) => {
    const p = zonedParts(new Date(ms), tz);
    const [yy, mm, dd] = p.dateKey.split('-').map(Number);
    return Date.UTC(yy, mm - 1, dd, Math.floor(p.minutes / 60), p.minutes % 60);
  };
  let result = guess - (asZoned(guess) - guess);
  result = guess - (asZoned(result) - result); // 二次修正，覆盖夏令时边界
  return new Date(result);
}

/** 日期字符串 + n 天 */
function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

function weekdayOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

function dateRange(from, to, maxDays = 62) {
  if (!DATE_KEY.test(from) || !DATE_KEY.test(to) || from > to) return [];
  const out = [];
  for (let d = from; d <= to && out.length < maxDays; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * 计算某天的有效课节：固定课表 + 临时调整
 *  - cancel：取消该教师该节的固定课
 *  - add：该教师该节临时上某班某课（若该节本有固定课，则替换，即调课/代课）
 * 返回按节次排序的数组。
 */
function effectiveOccurrences({ slots, adjustments, dateKey, days }) {
  const weekday = weekdayOf(dateKey);
  const key = (teacher, period) => `${teacher}:${period}`;
  const map = new Map();

  if (!days || days.includes(weekday)) {
    for (const s of slots) {
      if (s.weekday !== weekday) continue;
      if (s.startDate && dateKey < s.startDate) continue;
      if (s.endDate && dateKey > s.endDate) continue;
      map.set(key(String(s.teacher), s.period), {
        teacher: String(s.teacher), class: String(s.class), course: s.course ? String(s.course) : null,
        period: s.period, source: 'slot', slotId: String(s._id), autoStart: s.autoStart !== false
      });
    }
  }
  for (const a of adjustments) {
    if (a.date !== dateKey) continue;
    const k = key(String(a.teacher), a.period);
    if (a.type === 'cancel') map.delete(k);
    else if (a.type === 'add') {
      map.set(k, {
        teacher: String(a.teacher), class: String(a.class), course: a.course ? String(a.course) : null,
        period: a.period, source: 'adjust', adjustmentId: String(a._id), autoStart: true
      });
    }
  }
  return [...map.values()].sort((x, y) => x.period - y.period);
}

/** 在有序课时 id 列表中，求上次上到 lastId 之后的下一节；未上过则从头；已上完返回 null */
function nextLessonId(orderedIds, lastId) {
  if (!orderedIds.length) return null;
  if (!lastId) return orderedIds[0];
  const i = orderedIds.indexOf(String(lastId));
  if (i === -1) return orderedIds[0];
  return i + 1 < orderedIds.length ? orderedIds[i + 1] : null;
}

/** 当前时刻处于哪些节次的自动上课窗口内（上课时间 - lead <= 现在 < 下课时间） */
function activePeriods(periods, minutes, lead = 0) {
  return periods.filter(p => toMinutes(p.start) - lead <= minutes && minutes < toMinutes(p.end));
}

/** 判定「上过」所需的最少活跃学生数（至少 1 人） */
function minActiveStudents(studentCount, thresholdPercent) {
  return Math.max(1, Math.ceil(studentCount * thresholdPercent / 100));
}

/** completions: [{student, lesson}] -> Map(lessonId -> 完成过至少一个活动的不同学生数) */
function countStudentsByLesson(completions) {
  const sets = new Map();
  for (const c of completions) {
    const k = String(c.lesson);
    if (!sets.has(k)) sets.set(k, new Set());
    sets.get(k).add(String(c.student));
  }
  return new Map([...sets].map(([k, v]) => [k, v.size]));
}

/** 按「≥阈值比例的学生至少完成一个活动」得到该班上过的课时集合 */
function taughtLessonSet(completions, studentCount, thresholdPercent) {
  if (!studentCount) return new Set();
  const need = minActiveStudents(studentCount, thresholdPercent);
  return new Set([...countStudentsByLesson(completions)].filter(([, n]) => n >= need).map(([k]) => k));
}

/**
 * 判定一节课的情况，「到课」与「讲了本课」分开看：
 * - taught     上了本课：≥activityPercent 的学生完成了【本节课时】的活动（连堂没重新登录也成立）
 *              本课时没有可提交的活动（纯讲授）时，无法区分讲课与自由活动，只要到课就算上了本课
 * - met        到课但没上新课：≥presencePercent 的学生登录，但本课时活动不达标（自由活动、复习、考试等）
 * - not_taught 没上：两者都不达标（被占课等）
 * 只统计本节课时的活动：自由活动时学生补做以前课时的作业，不算上了新课。
 */
function judgeSession({ presentCount, lessonActiveCount, studentCount, presencePercent, activityPercent, lessonTrackable }) {
  if (!studentCount) return { state: 'assumed' };
  const present = presentCount >= minActiveStudents(studentCount, presencePercent);
  if (lessonTrackable && lessonActiveCount >= minActiveStudents(studentCount, activityPercent)) return { state: 'taught', basis: 'activity' };
  if (!lessonTrackable && present) return { state: 'taught', basis: 'presence' };
  if (present) return { state: 'met', basis: 'presence' };
  return { state: 'not_taught' };
}

/**
 * 本节课实际上的课时：在 [from, to] 内停留时间最长的课时。
 * log: [{ lesson, at }]，按时间先后；教师课尾切到下一课预览，不会被误记为本节课时。
 */
function dominantLesson(log, from, to) {
  if (!log || !log.length) return null;
  const sorted = [...log].sort((x, y) => new Date(x.at) - new Date(y.at));
  const dwell = new Map();
  for (let i = 0; i < sorted.length; i++) {
    const start = Math.max(new Date(sorted[i].at).getTime(), from.getTime());
    const end = Math.min(i + 1 < sorted.length ? new Date(sorted[i + 1].at).getTime() : to.getTime(), to.getTime());
    const k = String(sorted[i].lesson);
    dwell.set(k, (dwell.get(k) || 0) + Math.max(0, end - start));
  }
  let best = null; let bestMs = -1;
  for (const [k, ms] of dwell) if (ms > bestMs) { best = k; bestMs = ms; }
  // 所有切换都发生在窗口之外时，取窗口开始前最后一次选择
  return bestMs > 0 ? best : String(sorted.filter(x => new Date(x.at) <= from).pop()?.lesson || sorted[0].lesson);
}

/**
 * 求本节应上的课时：从「最近一次上过的课时」往后，跳过已经上过的课时。
 * 没有上课记录时，以已上过课时中顺序最靠后的一节为起点。
 * 往后都上过了，回头找被跳过的；全部上完返回 null。
 */
function pickNextLesson(orderedIds, lastId, taughtSet = new Set()) {
  if (!orderedIds.length) return null;
  let from = lastId ? orderedIds.indexOf(String(lastId)) : -1;
  if (from === -1) {
    for (let i = orderedIds.length - 1; i >= 0; i--) if (taughtSet.has(orderedIds[i])) { from = i; break; }
  }
  for (let i = from + 1; i < orderedIds.length; i++) if (!taughtSet.has(orderedIds[i])) return orderedIds[i];
  // 后面都上过了：回头找之前被跳过、还没上过的课时
  for (let i = 0; i <= from; i++) if (!taughtSet.has(orderedIds[i]) && orderedIds[i] !== String(lastId)) return orderedIds[i];
  return null;
}

/**
 * 教师手动点「上课」时，绑定到该班今天哪一节课表课：
 * 尚未下课、且距离上课不超过 earlyMinutes 的最早一节。
 */
function bindManualStart(occurrences, minutes, earlyMinutes) {
  return occurrences
    .filter(o => minutes < toMinutes(o.end) && toMinutes(o.start) - minutes <= earlyMinutes)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))[0] || null;
}

/** 不在课表里的手动上课：落在当前所处节次，或 earlyMinutes 内即将开始的节次；都没有返回 null */
function periodForManualStart(periods, minutes, earlyMinutes) {
  return periods.find(p => toMinutes(p.start) <= minutes && minutes < toMinutes(p.end))
    || periods.find(p => toMinutes(p.start) > minutes && toMinutes(p.start) - minutes <= earlyMinutes)
    || null;
}

module.exports = {
  MAX_PERIODS, getTimezone, toMinutes, normalizePeriods, normalizeDays,
  zonedParts, zonedToDate, addDays, weekdayOf, dateRange,
  effectiveOccurrences, nextLessonId, activePeriods,
  minActiveStudents, countStudentsByLesson, taughtLessonSet, judgeSession, dominantLesson, pickNextLesson,
  bindManualStart, periodForManualStart
};
