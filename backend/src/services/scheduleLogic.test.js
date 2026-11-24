const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./scheduleLogic');

test('normalizePeriods 规范化并校验', () => {
  const ok = L.normalizePeriods([
    { start: '08:00', end: '08:40' },
    { name: '大课间后', start: '08:50', end: '09:30' }
  ]);
  assert.equal(ok.periods.length, 2);
  assert.equal(ok.periods[0].name, '第1节');
  assert.equal(ok.periods[1].index, 2);

  assert.ok(L.normalizePeriods([]).error);
  assert.ok(L.normalizePeriods([{ start: '9:00', end: '10:00' }]).error);
  assert.ok(L.normalizePeriods([{ start: '10:00', end: '09:00' }]).error);
  assert.ok(L.normalizePeriods([{ start: '08:00', end: '08:40' }, { start: '08:30', end: '09:10' }]).error);
  // 连堂（无课间）允许
  assert.ok(!L.normalizePeriods([{ start: '08:00', end: '08:40' }, { start: '08:40', end: '09:20' }]).error);
});

test('zonedParts / zonedToDate 按时区换算', () => {
  // 2026-11-24 00:30 UTC == 北京时间 08:30（周二）
  const p = L.zonedParts(new Date('2026-11-24T00:30:00Z'), 'Asia/Shanghai');
  assert.equal(p.dateKey, '2026-11-24');
  assert.equal(p.weekday, 2);
  assert.equal(p.minutes, 8 * 60 + 30);

  const d = L.zonedToDate('2026-11-24', '08:30', 'Asia/Shanghai');
  assert.equal(d.toISOString(), '2026-11-24T00:30:00.000Z');

  // 跨日：UTC 前一天 20:00 == 北京次日 04:00
  assert.equal(L.zonedParts(new Date('2026-11-23T20:00:00Z'), 'Asia/Shanghai').dateKey, '2026-11-24');
});

test('addDays / weekdayOf / dateRange', () => {
  assert.equal(L.addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(L.weekdayOf('2026-11-22'), 7); // 周日
  assert.equal(L.weekdayOf('2026-11-23'), 1);
  assert.deepEqual(L.dateRange('2026-11-23', '2026-11-25'), ['2026-11-23', '2026-11-24', '2026-11-25']);
  assert.deepEqual(L.dateRange('2026-11-25', '2026-11-23'), []);
});

test('effectiveOccurrences：固定课表 + 取消 + 临时加课', () => {
  const slots = [
    { _id: 's1', teacher: 't1', class: 'c1', course: 'k1', weekday: 2, period: 1 },
    { _id: 's2', teacher: 't1', class: 'c2', course: 'k1', weekday: 2, period: 3 },
    { _id: 's3', teacher: 't1', class: 'c3', course: 'k1', weekday: 3, period: 1 }
  ];
  const day = '2026-11-24'; // 周二

  let r = L.effectiveOccurrences({ slots, adjustments: [], dateKey: day });
  assert.deepEqual(r.map(x => x.class), ['c1', 'c2']);

  // 第 1 节被占用 -> 取消
  r = L.effectiveOccurrences({
    slots, dateKey: day,
    adjustments: [{ _id: 'a1', type: 'cancel', teacher: 't1', date: day, period: 1 }]
  });
  assert.deepEqual(r.map(x => x.class), ['c2']);

  // 调课：把 c3 调到周二第 1 节（替换 c1）
  r = L.effectiveOccurrences({
    slots, dateKey: day,
    adjustments: [{ _id: 'a2', type: 'add', teacher: 't1', class: 'c3', course: 'k1', date: day, period: 1 }]
  });
  assert.deepEqual(r.map(x => [x.period, x.class, x.source]), [[1, 'c3', 'adjust'], [3, 'c2', 'slot']]);

  // 调整只影响指定日期
  r = L.effectiveOccurrences({
    slots, dateKey: '2026-12-01',
    adjustments: [{ _id: 'a1', type: 'cancel', teacher: 't1', date: day, period: 1 }]
  });
  assert.deepEqual(r.map(x => x.class), ['c1', 'c2']);
});

test('effectiveOccurrences：学期起止与上课日', () => {
  const slots = [{ _id: 's', teacher: 't', class: 'c', course: 'k', weekday: 2, period: 1, startDate: '2026-12-01' }];
  assert.equal(L.effectiveOccurrences({ slots, adjustments: [], dateKey: '2026-11-24' }).length, 0);
  assert.equal(L.effectiveOccurrences({ slots, adjustments: [], dateKey: '2026-12-01' }).length, 1);
  // 周二不在上课日
  assert.equal(L.effectiveOccurrences({ slots, adjustments: [], dateKey: '2026-12-01', days: [1, 3] }).length, 0);
});

test('nextLessonId', () => {
  assert.equal(L.nextLessonId(['a', 'b', 'c'], null), 'a');
  assert.equal(L.nextLessonId(['a', 'b', 'c'], 'a'), 'b');
  assert.equal(L.nextLessonId(['a', 'b', 'c'], 'c'), null);
  assert.equal(L.nextLessonId(['a', 'b'], 'zzz'), 'a');
  assert.equal(L.nextLessonId([], null), null);
});

test('activePeriods', () => {
  const { periods } = L.normalizePeriods([
    { start: '08:00', end: '08:40' }, { start: '08:40', end: '09:20' }
  ]);
  assert.deepEqual(L.activePeriods(periods, 8 * 60).map(p => p.index), [1]);
  assert.deepEqual(L.activePeriods(periods, 8 * 60 + 40).map(p => p.index), [2]);
  assert.deepEqual(L.activePeriods(periods, 9 * 60 + 20), []);
});

test('activePeriods 提前 5 分钟进入窗口', () => {
  const { periods } = L.normalizePeriods([{ start: '08:00', end: '08:40' }]);
  assert.deepEqual(L.activePeriods(periods, 7 * 60 + 54, 5), []);
  assert.deepEqual(L.activePeriods(periods, 7 * 60 + 55, 5).map(p => p.index), [1]);
});

test('minActiveStudents / taughtLessonSet：10% 学生至少完成一个活动', () => {
  assert.equal(L.minActiveStudents(40, 10), 4);
  assert.equal(L.minActiveStudents(5, 10), 1);
  const comps = [
    { student: 's1', lesson: 'L1' }, { student: 's2', lesson: 'L1' }, { student: 's2', lesson: 'L1' },
    { student: 's3', lesson: 'L1' }, { student: 's4', lesson: 'L1' },
    { student: 's1', lesson: 'L2' } // 有学生误点开 L2
  ];
  assert.deepEqual([...L.taughtLessonSet(comps, 40, 10)], ['L1']);
  assert.equal(L.taughtLessonSet(comps, 0, 10).size, 0);
});

test('judgeSession：到课与讲了本课分开判定', () => {
  const base = { studentCount: 40, presencePercent: 30, activityPercent: 25, lessonTrackable: true };
  // 正常上课：全班登录，大部分人做了本课活动
  assert.deepEqual(L.judgeSession({ ...base, presentCount: 38, lessonActiveCount: 30 }), { state: 'taught', basis: 'activity' });
  // 自由活动：全班登录，只有几个人自觉做了本课活动
  assert.deepEqual(L.judgeSession({ ...base, presentCount: 38, lessonActiveCount: 4 }), { state: 'met', basis: 'presence' });
  // 连堂第二节没人重新登录，但在做本课活动
  assert.equal(L.judgeSession({ ...base, presentCount: 0, lessonActiveCount: 20 }).state, 'taught');
  // 被占课
  assert.equal(L.judgeSession({ ...base, presentCount: 2, lessonActiveCount: 1 }).state, 'not_taught');
  // 纯讲授课：没有可提交活动，到课即算上了本课
  assert.deepEqual(L.judgeSession({ ...base, lessonTrackable: false, presentCount: 38, lessonActiveCount: 0 }), { state: 'taught', basis: 'presence' });
  assert.equal(L.judgeSession({ ...base, lessonTrackable: false, presentCount: 1, lessonActiveCount: 0 }).state, 'not_taught');
  assert.equal(L.judgeSession({ ...base, studentCount: 0, presentCount: 0, lessonActiveCount: 0 }).state, 'assumed');
});

test('dominantLesson：停留最久的课时', () => {
  const t = (m) => new Date(Date.UTC(2026, 10, 24, 0, m));
  const from = t(0), to = t(40);
  // 前 35 分钟 L3，最后 5 分钟切到 L4 预览 -> L3
  assert.equal(L.dominantLesson([{ lesson: 'L3', at: t(-5) }, { lesson: 'L4', at: t(35) }], from, to), 'L3');
  // 开课自动切到 L2，第 3 分钟教师改成 L5 -> L5
  assert.equal(L.dominantLesson([{ lesson: 'L2', at: t(0) }, { lesson: 'L5', at: t(3) }], from, to), 'L5');
  assert.equal(L.dominantLesson([], from, to), null);
  // 切换都在窗口之前 -> 最后一次
  assert.equal(L.dominantLesson([{ lesson: 'L1', at: t(-30) }, { lesson: 'L2', at: t(-20) }], from, to), 'L2');
});

test('pickNextLesson：从最近上过的往后，跳过已上过的', () => {
  const ids = ['L1', 'L2', 'L3', 'L4'];
  assert.equal(L.pickNextLesson(ids, null), 'L1');
  assert.equal(L.pickNextLesson(ids, 'L1', new Set(['L1'])), 'L2');
  assert.equal(L.pickNextLesson(ids, 'L1', new Set(['L1', 'L2'])), 'L3'); // L2 已在课外上过
  // 没有课表记录，但学生活动显示 L1、L3 上过 -> 从 L3 之后开始
  assert.equal(L.pickNextLesson(ids, null, new Set(['L1', 'L3'])), 'L4');
  assert.equal(L.pickNextLesson(ids, 'L4', new Set(['L1', 'L2', 'L3', 'L4'])), null);
  // L2 曾被跳过，后面都上完了 -> 回头补 L2
  assert.equal(L.pickNextLesson(ids, 'L4', new Set(['L1', 'L3', 'L4'])), 'L2');
});

test('bindManualStart / periodForManualStart', () => {
  const occs = [
    { class: 'c', period: 1, start: '08:00', end: '08:40' },
    { class: 'c', period: 3, start: '10:00', end: '10:40' }
  ];
  // 7:40 提前 20 分钟点上课 -> 绑定第 1 节
  assert.equal(L.bindManualStart(occs, 7 * 60 + 40, 30).period, 1);
  // 8:20 上课中 -> 第 1 节
  assert.equal(L.bindManualStart(occs, 8 * 60 + 20, 30).period, 1);
  // 9:00 离第 3 节还有 60 分钟 -> 不绑定
  assert.equal(L.bindManualStart(occs, 9 * 60, 30), null);

  const { periods } = L.normalizePeriods([{ start: '08:00', end: '08:40' }, { start: '08:50', end: '09:30' }]);
  assert.equal(L.periodForManualStart(periods, 8 * 60 + 45, 30).index, 2); // 课间 -> 下一节
  assert.equal(L.periodForManualStart(periods, 8 * 60 + 10, 30).index, 1);
  assert.equal(L.periodForManualStart(periods, 12 * 60, 30), null);
});
