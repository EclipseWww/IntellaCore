import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Tabs, Card, Table, Button, Select, Space, Tag, Modal, Radio, Input, Switch, message,
  Empty, Tooltip, Popconfirm, Typography, Alert, DatePicker, Progress, Spin, Popover
} from 'antd';
import {
  LeftOutlined, RightOutlined, DownloadOutlined, PlayCircleOutlined, CheckSquareOutlined, DeleteOutlined, PushpinOutlined, QuestionCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { nowTz, atTz, setScheduleTz } from '../../utils/scheduleTime';
import { classAPI } from '../../services/api';
import { scheduleAPI } from '../../services/scheduleAPI';
import { formatClassName } from '../../utils/className';

const { Text } = Typography;
const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DATE_FMT = 'YYYY-MM-DD';
const ATT_OPTIONS = [
  { label: '出勤', value: 'present' }, { label: '迟到', value: 'late' },
  { label: '缺勤', value: 'absent' }, { label: '请假', value: 'leave' }
];
const errMsg = (e, fallback) => e?.response?.data?.message || fallback;
const classLabel = (c) => formatClassName(c, '未知班级');
/** 班级排序：年级新到旧，同年级按班号 */
// 行政班按年级、班号排序；社团/选修排在后面
const sortClasses = (list) => [...list].sort((a, b) => {
  const ea = a.type === 'elective', eb = b.type === 'elective';
  if (ea !== eb) return ea ? 1 : -1;
  if (ea) return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN');
  return (b.grade - a.grade) || (Number(a.name) - Number(b.name));
});
const AUTO_COURSE = '__auto__';
const courseOptions = (courses) => [
  { value: AUTO_COURSE, label: '自动（跟随该班最近上的课程）' },
  ...courses.map(c => ({ value: c._id, label: c.title }))
];
const toCourseId = (v) => (v && v !== AUTO_COURSE ? v : null);
const DRAG_MIME = 'application/x-schedule';
// 周起始日：取「日期」本身（与时区无关），只用于排列日期
const mondayOf = (d) => { const x = dayjs(dayjs.isDayjs(d) ? d.format('YYYY-MM-DD') : d); return x.subtract((x.day() + 6) % 7, 'day'); };

/** 课节记录的状态展示（含自动判定结果） */
function sessionStatus(s) {
  const j = s.judgement || {};
  if (s.status === 'in_progress') return { color: 'processing', text: '上课中' };
  if (s.status === 'completed') {
    if (j.state === 'pending') return { color: 'cyan', text: '待判定', tip: '下课 10 分钟后根据学生登录和本课活动完成情况自动判定' };
    const basis = `${j.presentStudents}/${j.totalStudents} 名学生登录，${j.activeStudents} 名完成本课活动`;
    if (j.state === 'met') return { color: 'gold', text: '到课·未上新课', tip: j.by === 'teacher' ? '教师标记：到课但没上新课（自由活动、复习等）' : `自动判定（${basis}）：自由活动、复习等，进度不前进` };
    return { color: 'success', text: '已上', tip: j.by === 'teacher' ? '教师确认' : `自动判定：${basis}` };
  }
  return { color: 'warning', text: j.by === 'auto' ? '未上（自动）' : '未上', tip: s.skipReason };
}

/** 一节课的状态展示 */
function statusOf(occ, now) {
  if (occ.session) return sessionStatus(occ.session);
  const end = atTz(occ.date, occ.end);
  return end.isBefore(now) ? { color: 'default', text: '无记录' } : { color: 'blue', text: '待上' };
}

// ───────────── 考勤 / 进度弹窗 ─────────────
const SessionModal = ({ sessionId, onClose }) => {
  const [data, setData] = useState(null);
  const [roster, setRoster] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [lessonId, setLessonId] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const res = await scheduleAPI.getSession(sessionId);
        setData(res.data);
        setRoster(res.data.roster);
        setLessonId(res.data.lesson || null);
        setNote(res.data.note || '');
        if (res.data.course) {
          const ls = await scheduleAPI.listCourseLessons(res.data.course);
          setLessons(ls.data);
        }
      } catch (e) { message.error(errMsg(e, '加载失败')); onClose(); }
    })();
    // onClose 每次渲染都是新函数，不能作为依赖，否则会反复重新加载并覆盖正在编辑的考勤
  }, [sessionId]);

  const setStatus = (id, status) => setRoster(r => r.map(x => x._id === id ? { ...x, status } : x));
  const counts = useMemo(() => roster.reduce((a, s) => ({ ...a, [s.status]: (a[s.status] || 0) + 1 }), {}), [roster]);

  const save = async () => {
    setSaving(true);
    try {
      await scheduleAPI.saveAttendance(sessionId, roster.map(s => ({ studentId: s._id, status: s.status, note: s.note })));
      const patch = {};
      if (lessonId && lessonId !== data.lesson) patch.lessonId = lessonId;
      if (note !== (data.note || '')) patch.note = note;
      if (Object.keys(patch).length) await scheduleAPI.updateSession(sessionId, patch);
      message.success('已保存');
      onClose(true);
    } catch (e) { message.error(errMsg(e, '保存失败')); } finally { setSaving(false); }
  };

  return (
    <Modal open={!!sessionId} onCancel={() => onClose()} title="上课记录与考勤" width={720}
      onOk={save} okText="保存" confirmLoading={saving} destroyOnClose>
      {!data ? <Spin /> : (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <Text strong>{data.date} {data.periodName}</Text>
            <span>本节课时：</span>
            <Select style={{ width: 280 }} showSearch optionFilterProp="label" value={lessonId} onChange={setLessonId}
              placeholder="未指定课时" options={lessons.map(l => ({ value: l._id, label: l.title }))} />
          </Space>
          <Input.TextArea rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="本节课备注（可选）" />
          <Space>
            <Button size="small" onClick={() => setRoster(r => r.map(s => ({ ...s, status: 'present' })))}>全部出勤</Button>
            <Text type="secondary">
              出勤 {counts.present || 0} · 迟到 {counts.late || 0} · 缺勤 {counts.absent || 0} · 请假 {counts.leave || 0}
            </Text>
            {!data.attendanceTaken && <Tag color="orange">尚未点名，保存后才会计入考勤</Tag>}
            {data.attendanceSource === 'auto' && <Tag color="blue">已按登录自动生成：登录过的记出勤，没登录的记缺勤</Tag>}
          </Space>
          <Table size="small" rowKey="_id" pagination={false} scroll={{ y: 360 }} dataSource={roster}
            columns={[
              { title: '座号', dataIndex: 'seatNumber', width: 70 },
              { title: '学号', dataIndex: 'username', width: 110 },
              { title: '姓名', dataIndex: 'name', width: 100 },
              {
                title: '考勤', render: (_, s) => (
                  <Radio.Group size="small" optionType="button" buttonStyle="solid" options={ATT_OPTIONS}
                    value={s.status} onChange={e => setStatus(s._id, e.target.value)} />
                )
              }
            ]} />
        </Space>
      )}
    </Modal>
  );
};

// ───────────── 课节操作弹窗（本周视图） ─────────────
const CellModal = ({ cell, classes, courses, periods, onClose, onChanged, openSession }) => {
  const [mode, setMode] = useState('slot');
  const [classId, setClassId] = useState(null);
  const [courseId, setCourseId] = useState(AUTO_COURSE);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  // 空格子默认排每周固定课；这节原本有固定课只是本次取消了，才默认临时加课
  useEffect(() => { setMode(cell?.cancelAdjustment ? 'add' : 'slot'); setReason(''); setClassId(null); setCourseId(AUTO_COURSE); }, [cell]);
  if (!cell) return null;
  const { occ, date, weekday, period } = cell;
  const periodInfo = periods.find(p => p.index === period);
  const cancelled = cell.cancelAdjustment;

  const run = async (fn, okText) => {
    setBusy(true);
    try { await fn(); if (okText) message.success(okText); onChanged(); onClose(); }
    catch (e) { message.error(errMsg(e, '操作失败')); } finally { setBusy(false); }
  };

  const title = `${date}（${DAY_NAMES[weekday]}）${periodInfo?.name || ''} ${periodInfo ? `${periodInfo.start}-${periodInfo.end}` : ''}`;
  const ref = occ && { classId: occ.class, date: occ.date, period: occ.period };
  const s = occ?.session;
  const future = occ && atTz(occ.date, occ.start).isAfter(nowTz());

  return (
    <Modal open title={title} onCancel={onClose} footer={null} destroyOnClose>
      {!occ ? (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {cancelled && (
            <Alert type="warning" showIcon message={`本次已取消${cancelled.reason ? `：${cancelled.reason}` : ''}`}
              action={<Button size="small" onClick={() => run(() => scheduleAPI.deleteAdjustment(cancelled._id), '已恢复')}>恢复</Button>} />
          )}
          <Radio.Group value={mode} onChange={e => setMode(e.target.value)}>
            <Radio.Button value="slot">每周{DAY_NAMES[weekday].slice(1)}固定上课</Radio.Button>
            <Radio.Button value="add">仅 {date.slice(5)} 临时上一次</Radio.Button>
          </Radio.Group>
          <Select style={{ width: '100%' }} placeholder="选择班级" value={classId} onChange={setClassId}
            options={classes.map(c => ({ value: c._id, label: classLabel(c) }))} />
          <Select style={{ width: '100%' }} value={courseId} onChange={setCourseId} options={courseOptions(courses)} />
          <Button type="primary" block loading={busy} disabled={!classId}
            onClick={() => run(() => mode === 'slot'
              ? scheduleAPI.saveSlot({ weekday, period, classId, courseId: toCourseId(courseId) })
              : scheduleAPI.createAdjustment({ type: 'add', date, period, classId, courseId: toCourseId(courseId) }), '已保存')}>
            保存
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {mode === 'slot' ? '以后每周这个时间都会自动上课。' : '只加这一次，每周课表不变。'}
          </Text>
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <Tag color="geekblue">{classLabel(occ.classInfo)}</Tag>
            <Text strong>{occ.courseInfo?.title || '（未指定课程）'}</Text>
            {occ.courseAuto && <Tag>自动</Tag>}
            <Tag color={statusOf(occ, nowTz()).color}>{statusOf(occ, nowTz()).text}</Tag>
            {occ.source === 'adjust' && <Tag color="purple">临时调课</Tag>}
            {occ.source === 'extra' && <Tag color="magenta">课表外</Tag>}
          </Space>
          {statusOf(occ, nowTz()).tip && s?.status !== 'skipped' && <Text type="secondary">{statusOf(occ, nowTz()).tip}</Text>}
          {s && (s.lesson ? <Text type="secondary">本节课时：{s.lesson.title}</Text>
            : s.status !== 'skipped' && <Alert type="warning" showIcon message="这节课没有指定课时：下一课时尚未准备。建好新课时后会自动切换，也可在「上课」页手动选择。" />)}
          {s?.status === 'skipped' && <Text type="secondary">未上原因：{s.skipReason || '（未填写）'}</Text>}

          <Space wrap>
            {!s && (
              <Button icon={<PlayCircleOutlined />} loading={busy}
                onClick={() => run(() => scheduleAPI.startOccurrence(ref), '已开始上课')}>立即上课</Button>
            )}
            {!s && !future && (
              <Button loading={busy} onClick={() => run(() => scheduleAPI.recordOccurrence(ref), '已补记')}>补记为已上</Button>
            )}
            {s && s.status !== 'skipped' && (
              <Button type="primary" icon={<CheckSquareOutlined />} onClick={() => { openSession(s._id); onClose(); }}>
                考勤 / 调整课时
              </Button>
            )}
            {s?.status === 'skipped' && !s.startedAt && dayjs(s.startAt).isAfter(nowTz()) && (
              <Button loading={busy} onClick={() => run(() => scheduleAPI.unskip(s._id), '已撤销')}>撤销「未上」</Button>
            )}
            {occ.source === 'extra' && (
              <Button icon={<PushpinOutlined />} loading={busy}
                onClick={() => run(() => scheduleAPI.saveSlot({ weekday, period, classId: occ.class, courseId: null }), '已设为每周固定课')}>
                以后每周都上这个班
              </Button>
            )}
          </Space>

          {s && s.status !== 'in_progress' && !(s.status === 'skipped' && !s.startedAt && dayjs(s.startAt).isAfter(nowTz())) && (
            <div>
              <Text type="secondary">这节课实际情况{s.judgement?.by === 'teacher' ? '（已由你确认）' : s.judgement?.state === 'pending' ? '（待自动判定）' : '（自动判定，有误可改）'}：</Text>
              <Radio.Group size="small" optionType="button" disabled={busy}
                value={s.status === 'skipped' ? 'not_taught' : s.judgement?.state === 'met' ? 'met' : s.judgement?.state === 'pending' ? null : 'taught'}
                onChange={e => run(() => scheduleAPI.setJudgement(s._id, e.target.value), '已更正')}
                options={[
                  { label: '上了本课', value: 'taught' },
                  { label: '到课·没上新课', value: 'met' },
                  { label: '没上', value: 'not_taught' }
                ]} />
            </div>
          )}

          {(!s || s.status === 'in_progress') && occ.source !== 'extra' && (
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="备注未上原因（可选）" value={reason} maxLength={100} onChange={e => setReason(e.target.value)} />
              <Button danger loading={busy} onClick={() => run(() => scheduleAPI.skipOccurrence({ ...ref, reason }), '已标记为未上，进度不会前进')}>标记未上</Button>
            </Space.Compact>
          )}

          {!s && (
            <Space wrap>
              <Popconfirm title="取消本次课？（仅这一天，不影响每周课表）" onConfirm={() =>
                run(() => scheduleAPI.createAdjustment({ type: 'cancel', date, period, reason }), '本次已取消')}>
                <Button>取消本次</Button>
              </Popconfirm>
              {occ.source === 'adjust' && (
                <Button onClick={() => run(() => scheduleAPI.deleteAdjustment(occ.adjustmentId), '已移除')}>移除这次临时课</Button>
              )}
            </Space>
          )}
          {future && !s && <Text type="secondary" style={{ fontSize: 12 }}>要临时调到别的时间，直接把它拖到目标格子。</Text>}
        </Space>
      )}
    </Modal>
  );
};

// ───────────── 每周固定课：编辑弹窗 ─────────────
const SlotModal = ({ target, classes, courses, onClose, onChanged }) => {
  const [classId, setClassId] = useState(null);
  const [courseId, setCourseId] = useState(AUTO_COURSE);
  const [autoStart, setAutoStart] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const sl = target && target.slot;
    setClassId(sl ? sl.class?._id : null);
    setCourseId(sl && sl.course ? sl.course._id : AUTO_COURSE);
    setAutoStart(sl ? sl.autoStart !== false : true);
  }, [target]);
  if (!target) return null;
  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); message.success(ok); onChanged(); onClose(); }
    catch (e) { message.error(errMsg(e, '操作失败')); } finally { setBusy(false); }
  };
  return (
    <Modal open title={`每周 ${DAY_NAMES[target.weekday]} ${target.periodName}`} onCancel={onClose} footer={null} destroyOnClose>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Select style={{ width: '100%' }} placeholder="选择班级" value={classId} onChange={setClassId}
          options={classes.map(c => ({ value: c._id, label: classLabel(c) }))} />
        <Select style={{ width: '100%' }} value={courseId} onChange={setCourseId} options={courseOptions(courses)} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          课程选「自动」时，跟随这个班最近一次实际上的课程。一个模块讲完后，在「上课」页选一次新模块的课时，之后就自动跟随。
        </Text>
        <Space><Switch checked={autoStart} onChange={setAutoStart} /> 到点自动上课</Space>
        <Space>
          <Button type="primary" loading={busy} disabled={!classId}
            onClick={() => run(() => scheduleAPI.saveSlot({ weekday: target.weekday, period: target.period, classId, courseId: toCourseId(courseId), autoStart }), '已保存')}>保存</Button>
          {target.slot && (
            <Popconfirm title="删除这节每周固定课？" onConfirm={() => run(() => scheduleAPI.deleteSlot(target.slot._id), '已删除')}>
              <Button danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      </Space>
    </Modal>
  );
};

// ───────────── 课表网格（拖拽） ─────────────
const chipStyle = (color) => ({
  padding: '4px 8px', borderRadius: 6, background: color, color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: 'grab', userSelect: 'none', display: 'inline-block'
});
const CLASS_COLORS = ['#326b59', '#2f6fb0', '#8a5cd6', '#c2410c', '#0e7490', '#a21caf', '#4d7c0f', '#b45309', '#be123c', '#475569'];
const colorOf = (classes, id) => CLASS_COLORS[Math.max(0, classes.findIndex(c => c._id === String(id))) % CLASS_COLORS.length];

const ScheduleGrid = ({ config, classes, courses }) => {
  const [view, setView] = useState('week');
  const [weekStart, setWeekStart] = useState(mondayOf(nowTz()));
  const [occs, setOccs] = useState([]);
  const [cancelled, setCancelled] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cell, setCell] = useState(null);
  const [slotTarget, setSlotTarget] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [over, setOver] = useState(null);
  const firstLoad = React.useRef(true);

  const dates = config.days.map(d => ({ weekday: d, date: weekStart.add(d - 1, 'day').format(DATE_FMT) }));
  const today = nowTz().format(DATE_FMT);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, sl] = await Promise.all([
        scheduleAPI.listOccurrences(weekStart.format(DATE_FMT), weekStart.add(6, 'day').format(DATE_FMT)),
        scheduleAPI.listSlots()
      ]);
      setOccs(o.data); setCancelled(o.adjustments || []); setSlots(sl.data);
      if (firstLoad.current && sl.data.length === 0) setView('template');
      firstLoad.current = false;
    } catch (e) { message.error(errMsg(e, '加载课表失败')); } finally { setLoading(false); }
  }, [weekStart]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, ok) => {
    try { await fn(); if (ok) message.success(ok); } catch (e) { message.error(errMsg(e, '操作失败')); }
    load();
  };

  // 拖放：班级卡片 / 固定课 / 本周的一节课
  const onDrop = (e, target) => {
    e.preventDefault(); setOver(null);
    let src; try { src = JSON.parse(e.dataTransfer.getData(DRAG_MIME)); } catch { return; }
    if (!src) return;
    if (view === 'template') {
      if (src.kind === 'class') return act(() => scheduleAPI.saveSlot({ weekday: target.weekday, period: target.period, classId: src.classId, courseId: null }), '已排入每周课表');
      if (src.kind === 'slot') return act(() => scheduleAPI.moveSlot({ weekday: src.weekday, period: src.period }, { weekday: target.weekday, period: target.period }), '已调整每周课表');
      return;
    }
    if (atTz(target.date, config.periods.find(p => p.index === target.period).end).isBefore(nowTz())) {
      return message.warning('这节课已经过去了');
    }
    if (src.kind === 'class') {
      return act(() => scheduleAPI.createAdjustment({ type: 'add', date: target.date, period: target.period, classId: src.classId }), `已安排 ${target.date.slice(5)} 临时上课`);
    }
    if (src.kind === 'occ') {
      if (src.date === target.date && src.period === target.period) return;
      Modal.confirm({
        title: '临时调课',
        content: `把 ${src.label} 从 ${src.date.slice(5)} 第${src.period}节 调到 ${target.date.slice(5)} 第${target.period}节？只影响这一次，每周课表不变。`,
        onOk: () => act(async () => {
          if (src.source === 'adjust') await scheduleAPI.deleteAdjustment(src.adjustmentId);
          else await scheduleAPI.createAdjustment({ type: 'cancel', date: src.date, period: src.period, reason: '调课' });
          await scheduleAPI.createAdjustment({ type: 'add', date: target.date, period: target.period, classId: src.classId, courseId: src.pinnedCourse || null });
        }, '已调课')
      });
    }
  };
  const dropProps = (key, target) => ({
    onDragOver: (e) => { e.preventDefault(); if (over !== key) setOver(key); },
    onDragLeave: () => setOver(o => (o === key ? null : o)),
    onDrop: (e) => onDrop(e, target)
  });
  const drag = (payload) => ({
    draggable: true,
    onDragStart: (e) => { e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload)); e.dataTransfer.effectAllowed = 'move'; }
  });

  const renderWeekCell = (date, weekday, p) => {
    const items = occs.filter(o => o.date === date && o.period === p.index);
    // 实际上了的课排前面；原定却没上、被别的班顶替的显示为「原定」
    // 同一节里教师实际去了课表外的班级（source=extra）：原定的班级即使还没判定，也显示为「原定」
    const tookOver = items.some(o => o.source === 'extra' && o.session && o.session.status !== 'skipped');
    const actual = items.filter(o => o.session && o.session.status !== 'skipped' && (!tookOver || o.source === 'extra'));
    const ordered = [...actual, ...items.filter(o => !actual.includes(o))];
    const isCancelled = cancelled.some(a => a.date === date && a.period === p.index);
    if (!ordered.length) {
      return <Text type="secondary" style={{ fontSize: 12 }}>{isCancelled ? '已取消（点击恢复）' : '＋'}</Text>;
    }
    return ordered.map((o, i) => {
      const st = statusOf(o, nowTz());
      const replaced = actual.length > 0 && !actual.includes(o);
      const future = !o.session && atTz(o.date, o.start).isAfter(nowTz());
      return (
        <div key={i} onClick={(e) => { e.stopPropagation(); setCell({ occ: o, date, weekday, period: p.index }); }}
          {...(future ? drag({ kind: 'occ', date, period: p.index, classId: o.class, label: classLabel(o.classInfo), source: o.source, adjustmentId: o.adjustmentId, pinnedCourse: o.courseAuto ? null : o.course }) : {})}
          style={{ marginBottom: 4, opacity: replaced ? 0.55 : 1, cursor: future ? 'grab' : 'pointer' }}>
          <div style={{ borderLeft: `4px solid ${colorOf(classes, o.class)}`, paddingLeft: 6 }}>
            <b style={{ textDecoration: replaced ? 'line-through' : 'none' }}>{classLabel(o.classInfo)}</b>
            {replaced && <Text type="secondary" style={{ fontSize: 12 }}> 原定</Text>}
            {!replaced && <div style={{ fontSize: 12, color: '#55625b' }}>{o.courseInfo?.title || '未指定课程'}{o.courseAuto ? '（自动）' : ''}</div>}
            {!replaced && (
              <Space size={4} wrap>
                <Tag color={st.color} style={{ marginRight: 0 }}>{st.text}</Tag>
                {o.source === 'adjust' && <Tag color="purple" style={{ marginRight: 0 }}>调</Tag>}
                {o.source === 'extra' && <Tag color="magenta" style={{ marginRight: 0 }}>课表外</Tag>}
              </Space>
            )}
            {!replaced && o.session && (o.session.lesson
              ? <div style={{ fontSize: 12, color: '#738078' }}>{o.session.lesson.title}</div>
              : o.session.status !== 'skipped' && <div style={{ fontSize: 12, color: '#d46b08' }}>未指定课时</div>)}
          </div>
        </div>
      );
    });
  };

  const renderTemplateCell = (weekday, p) => {
    const sl = slots.find(x => x.weekday === weekday && x.period === p.index);
    if (!sl) return <Text type="secondary" style={{ fontSize: 12 }}>＋</Text>;
    return (
      <div {...drag({ kind: 'slot', weekday, period: p.index })} style={{ cursor: 'grab' }}>
        <div style={chipStyle(colorOf(classes, sl.class?._id))}>{classLabel(sl.class)}</div>
        <div style={{ fontSize: 12, color: '#55625b', marginTop: 4 }}>{sl.course ? sl.course.title : '课程：自动'}</div>
        {sl.autoStart === false && <Tag style={{ marginTop: 4 }}>不自动上课</Tag>}
      </div>
    );
  };

  const cols = `110px repeat(${dates.length}, minmax(130px, 1fr))`;
  return (
    <>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Radio.Group optionType="button" buttonStyle="solid" value={view} onChange={e => setView(e.target.value)}
            options={[{ label: '本周', value: 'week' }, { label: '每周固定课表', value: 'template' }]} />
          {view === 'week' && (
            <>
              <Button icon={<LeftOutlined />} onClick={() => setWeekStart(w => w.subtract(7, 'day'))} />
              <DatePicker picker="week" allowClear={false} value={weekStart} format={() => `${weekStart.format('MM-DD')} ~ ${weekStart.add(6, 'day').format('MM-DD')}`}
                onChange={v => v && setWeekStart(mondayOf(v))} />
              <Button icon={<RightOutlined />} onClick={() => setWeekStart(w => w.add(7, 'day'))} />
              <Button onClick={() => setWeekStart(mondayOf(nowTz()))}>本周</Button>
            </>
          )}
          <Popover placement="bottomLeft" overlayStyle={{ maxWidth: 420 }} title="课表怎么自动运行" content={
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <div>· 上课前 {config.leadMinutes} 分钟自动上课，课程跟随该班最近上的课程，并切到下一课时；下一课时没备好就先不指定，建好后自动切过去。</div>
              <div>· 下课 10 分钟后自动判定：≥{config.threshold}% 学生完成本课活动算「上了本课」；否则 ≥{config.presenceThreshold}% 学生登录算「到课·没上新课」；都不满足算「没上」。</div>
              <div>· 临时去别的班上课，直接在「上课」页选班级上课即可，这里会自动显示。</div>
            </div>
          }>
            <Button type="text" icon={<QuestionCircleOutlined />} style={{ color: '#738078' }}>规则</Button>
          </Popover>
        </Space>
        {view === 'template' && (
          <div {...dropProps('trash', null)} onDrop={(e) => {
            e.preventDefault(); setOver(null);
            let src; try { src = JSON.parse(e.dataTransfer.getData(DRAG_MIME)); } catch { return; }
            const sl = src && src.kind === 'slot' && slots.find(x => x.weekday === src.weekday && x.period === src.period);
            if (sl) act(() => scheduleAPI.deleteSlot(sl._id), '已删除');
          }} style={{ padding: '6px 14px', border: `2px dashed ${over === 'trash' ? '#ff4d4f' : '#d9d9d9'}`, borderRadius: 8, color: over === 'trash' ? '#ff4d4f' : '#999' }}>
            <DeleteOutlined /> 拖到这里删除
          </div>
        )}
      </Space>

      <div style={{ marginBottom: 12, padding: 10, background: '#f6f8f7', borderRadius: 8 }}>
        <Text type="secondary" style={{ marginRight: 8 }}>
          {view === 'template' ? '把班级拖进格子排每周课表，拖动格子里的课可调整或互换：' : '拖班级到格子 = 临时加一节课；拖动还没上的课 = 只调这一次：'}
        </Text>
        <Space size={[6, 6]} wrap>
          {classes.map(c => (
            <span key={c._id} {...drag({ kind: 'class', classId: c._id })} style={chipStyle(colorOf(classes, c._id))}>{classLabel(c)}</span>
          ))}
        </Space>
      </div>

      <Spin spinning={loading}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, border: '1px solid #e5e9e7', borderRadius: 8, minWidth: 110 + dates.length * 130 }}>
            <div style={{ padding: 8, background: '#fafbfa', borderBottom: '1px solid #e5e9e7' }} />
            {dates.map(({ weekday, date }) => (
              <div key={weekday} style={{ padding: 8, background: date === today && view === 'week' ? '#e8f0eb' : '#fafbfa', borderBottom: '1px solid #e5e9e7', borderLeft: '1px solid #eef1ef', textAlign: 'center' }}>
                <b>{DAY_NAMES[weekday]}</b>{view === 'week' && <div style={{ fontSize: 12, color: '#738078' }}>{date.slice(5)}</div>}
              </div>
            ))}
            {config.periods.map(p => (
              <React.Fragment key={p.index}>
                <div style={{ padding: 8, borderBottom: '1px solid #eef1ef', background: '#fafbfa' }}>
                  <b>{p.name}</b><div style={{ fontSize: 12, color: '#738078' }}>{p.start}-{p.end}</div>
                </div>
                {dates.map(({ weekday, date }) => {
                  const key = `${weekday}-${p.index}`;
                  const target = { weekday, date, period: p.index };
                  return (
                    <div key={key} {...dropProps(key, target)}
                      onClick={() => view === 'template'
                        ? setSlotTarget({ weekday, period: p.index, periodName: p.name, slot: slots.find(x => x.weekday === weekday && x.period === p.index) })
                        : setCell({ occ: null, date, weekday, period: p.index, cancelAdjustment: cancelled.find(a => a.date === date && a.period === p.index) })}
                      style={{
                        minHeight: 78, padding: 6, cursor: 'pointer', borderBottom: '1px solid #eef1ef', borderLeft: '1px solid #eef1ef',
                        background: over === key ? '#e6f4ff' : (date === today && view === 'week' ? '#fbfdfb' : '#fff'),
                        outline: over === key ? '2px dashed #1677ff' : 'none', outlineOffset: -3
                      }}>
                      {view === 'template' ? renderTemplateCell(weekday, p) : renderWeekCell(date, weekday, p)}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Spin>

      <CellModal cell={cell} classes={classes} courses={courses} periods={config.periods}
        onClose={() => setCell(null)} onChanged={load} openSession={setSessionId} />
      <SlotModal target={slotTarget} classes={classes} courses={courses} onClose={() => setSlotTarget(null)} onChanged={load} />
      <SessionModal sessionId={sessionId} onClose={(saved) => { setSessionId(null); if (saved) load(); }} />
    </>
  );
};

// ───────────── 进度 & 考勤记录 & 导出 ─────────────
const ProgressPanel = ({ classes }) => {
  const [classId, setClassId] = useState(classes[0]?._id);
  const [progress, setProgress] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const [p, s] = await Promise.all([scheduleAPI.getProgress(classId), scheduleAPI.listSessions({ classId })]);
      setProgress(p.data); setSessions(s.data);
    } catch (e) { message.error(errMsg(e, '加载失败')); } finally { setLoading(false); }
  }, [classId]);
  useEffect(() => { load(); }, [load]);

  const exportRoster = async () => {
    setExporting(true);
    try {
      const params = { classId };
      if (range) { params.from = range[0].format(DATE_FMT); params.to = range[1].format(DATE_FMT); }
      const blob = await scheduleAPI.exportRoster(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const c = classes.find(x => x._id === classId);
      a.href = url; a.download = `${classLabel(c)}-平日成绩花名册.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { message.error('导出失败'); } finally { setExporting(false); }
  };


  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Space wrap>
        <Select style={{ width: 180 }} value={classId} onChange={setClassId}
          options={classes.map(c => ({ value: c._id, label: classLabel(c) }))} />
        <DatePicker.RangePicker value={range} onChange={setRange} placeholder={['起始日期', '截止日期']} />
        <Tooltip title="含每节课考勤、出勤汇总和平日成绩；不选日期则导出全部">
          <Button type="primary" icon={<DownloadOutlined />} loading={exporting} disabled={!classId} onClick={exportRoster}>导出平日成绩花名册</Button>
        </Tooltip>
      </Space>

      <Card size="small" title="上课进度" loading={loading}>
        {progress.length === 0 ? <Empty description="还没有上课记录" /> : (
          <Table size="small" rowKey={r => r.course?._id} pagination={false} dataSource={progress} columns={[
            { title: '课程', render: (_, r) => r.course?.title },
            {
              title: <Tooltip title="按学生完成活动的情况统计：达到比例的课时算上过，包括课表之外上的">已上课时</Tooltip>,
              width: 200, render: (_, r) => r.totalLessons
                ? <Progress size="small" percent={Math.round(r.taughtLessons / r.totalLessons * 100)} format={() => `${r.taughtLessons}/${r.totalLessons}`} />
                : '—'
            },
            { title: '最近上的', render: (_, r) => r.lastLesson ? `${r.lastUnit?.title || ''} · ${r.lastLesson.title}` : '—' },
            { title: '下次自动上', render: (_, r) => r.nextLesson?.title || '—' },
            { title: '上过的课节', dataIndex: 'completed', width: 90 },
            { title: <Tooltip title="学生到了但没上新课：自由活动、复习、考试等">到课·未上新课</Tooltip>, dataIndex: 'met', width: 110 },
            { title: '没上的课节', width: 100, render: (_, r) => r.skipped ? `${r.skipped}${r.autoSkipped ? `（自动 ${r.autoSkipped}）` : ''}` : 0 },
            { title: '最近一次', dataIndex: 'lastDate', width: 110 }
          ]} />
        )}
      </Card>

      <Card size="small" title="课节与考勤记录（最近 300 节）" loading={loading}>
        <Table size="small" rowKey="_id" dataSource={sessions} pagination={{ pageSize: 10 }} columns={[
          { title: '日期', dataIndex: 'date', width: 110 },
          { title: '节次', dataIndex: 'periodName', width: 80 },
          { title: '课程', render: (_, s) => s.course?.title },
          { title: '课时', render: (_, s) => s.lesson?.title || '—' },
          { title: '状态', width: 110, render: (_, s) => { const st = sessionStatus(s); return <Tooltip title={st.tip}><Tag color={st.color}>{st.text}</Tag></Tooltip>; } },
          {
            title: '考勤', width: 210, render: (_, s) => s.status === 'skipped' ? <Text type="secondary">{s.skipReason || '—'}</Text>
              : s.attendanceTaken ? `出${s.attendanceCounts.present} 迟${s.attendanceCounts.late} 缺${s.attendanceCounts.absent} 假${s.attendanceCounts.leave}`
                : <Text type="secondary">未点名</Text>
          },
          { title: '', width: 80, render: (_, s) => s.status !== 'skipped' && <Button type="link" size="small" onClick={() => setSessionId(s._id)}>点名/修改</Button> }
        ]} />
      </Card>
      <SessionModal sessionId={sessionId} onClose={(saved) => { setSessionId(null); if (saved) load(); }} />
    </Space>
  );
};

// ───────────── 入口 ─────────────
const TeacherSchedule = () => {
  const [config, setConfig] = useState(null);
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [cfg, cls, crs] = await Promise.all([
          scheduleAPI.getConfig(), classAPI.getTeacherClasses(), scheduleAPI.listMyCourses()
        ]);
        setConfig(cfg.data);
        setClasses(sortClasses(cls.data || []));
        setCourses(crs.data || []);
      } catch (e) { message.error('加载课表失败'); }
    })();
  }, []);

  if (!config) return <Spin />;
  setScheduleTz(config.timezone);
  if (classes.length === 0) return <Empty description="请先在「班级管理」中创建班级" />;

  return (
    <Tabs items={[
      {
        key: 'week', label: '课表',
        children: <ScheduleGrid config={config} classes={classes} courses={courses} />
      },
      { key: 'progress', label: '进度 · 考勤 · 导出', children: <ProgressPanel classes={classes} /> }
    ]} />
  );
};

export default TeacherSchedule;
