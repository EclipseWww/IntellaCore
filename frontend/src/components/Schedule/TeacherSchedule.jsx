import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Tabs, Card, Table, Button, Select, Space, Tag, Modal, Radio, Input, Switch, message,
  Empty, Tooltip, Popconfirm, Typography, Alert, DatePicker, Progress, Spin
} from 'antd';
import {
  LeftOutlined, RightOutlined, DownloadOutlined, PlayCircleOutlined, CheckSquareOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { classAPI } from '../../services/api';
import { scheduleAPI } from '../../services/scheduleAPI';

const { Text } = Typography;
const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DATE_FMT = 'YYYY-MM-DD';
const ATT_OPTIONS = [
  { label: '出勤', value: 'present' }, { label: '迟到', value: 'late' },
  { label: '缺勤', value: 'absent' }, { label: '请假', value: 'leave' }
];
const errMsg = (e, fallback) => e?.response?.data?.message || fallback;
const classLabel = (c) => (c ? `${c.grade}级${c.name}班` : '未知班级');
const mondayOf = (d) => dayjs(d).startOf('day').subtract((dayjs(d).day() + 6) % 7, 'day');

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
  const end = dayjs(`${occ.date} ${occ.end}`);
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
        const ls = await scheduleAPI.listCourseLessons(res.data.course);
        setLessons(ls.data);
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

// ───────────── 课节操作弹窗 ─────────────
const CellModal = ({ cell, classes, courses, periods, onClose, onChanged, openSession }) => {
  const [mode, setMode] = useState('slot');
  const [classId, setClassId] = useState(null);
  const [courseId, setCourseId] = useState(null);
  const [autoStart, setAutoStart] = useState(true);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setMode('slot'); setReason(''); setAutoStart(true); setClassId(null); setCourseId(null); }, [cell]);
  if (!cell) return null;
  const { occ, date, weekday, period } = cell;
  const periodInfo = periods.find(p => p.index === period);
  const cancelled = cell.cancelAdjustment;

  const run = async (fn, okText) => {
    setBusy(true);
    try { await fn(); if (okText) message.success(okText); onChanged(); onClose(); }
    catch (e) { message.error(errMsg(e, '操作失败')); } finally { setBusy(false); }
  };

  const classCourseSelect = (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Select style={{ width: '100%' }} placeholder="选择班级" value={classId} onChange={setClassId}
        options={classes.map(c => ({ value: c._id, label: classLabel(c) }))} />
      <Select style={{ width: '100%' }} showSearch optionFilterProp="label" placeholder="选择课程" value={courseId} onChange={setCourseId}
        options={courses.map(c => ({ value: c._id, label: c.title }))} />
    </Space>
  );

  const title = `${date}（${DAY_NAMES[weekday]}）${periodInfo?.name || ''} ${periodInfo ? `${periodInfo.start}-${periodInfo.end}` : ''}`;
  const ref = occ && { classId: occ.class, date: occ.date, period: occ.period };
  const s = occ?.session;

  return (
    <Modal open title={title} onCancel={onClose} footer={null} destroyOnClose>
      {!occ ? (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {cancelled && (
            <Alert type="warning" showIcon message={`本次已取消${cancelled.reason ? `：${cancelled.reason}` : ''}`}
              action={<Button size="small" onClick={() => run(() => scheduleAPI.deleteAdjustment(cancelled._id), '已恢复')}>恢复</Button>} />
          )}
          <Radio.Group value={mode} onChange={e => setMode(e.target.value)}>
            <Radio.Button value="slot">每周固定上课</Radio.Button>
            <Radio.Button value="add">仅{date.slice(5)}临时上课</Radio.Button>
          </Radio.Group>
          {classCourseSelect}
          {mode === 'slot' && <Space><Switch checked={autoStart} onChange={setAutoStart} /> 到点自动上课</Space>}
          <Button type="primary" block loading={busy} disabled={!classId || !courseId}
            onClick={() => run(() => mode === 'slot'
              ? scheduleAPI.saveSlot({ weekday, period, classId, courseId, autoStart })
              : scheduleAPI.createAdjustment({ type: 'add', date, period, classId, courseId }), '已保存')}>
            保存
          </Button>
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <Tag color="geekblue">{classLabel(occ.classInfo)}</Tag>
            <Text strong>{occ.courseInfo?.title}</Text>
            <Tag color={statusOf(occ, dayjs()).color}>{statusOf(occ, dayjs()).text}</Tag>
            {occ.source === 'adjust' && <Tag color="purple">临时调课</Tag>}
          </Space>
          {statusOf(occ, dayjs()).tip && s?.status !== 'skipped' && <Text type="secondary">{statusOf(occ, dayjs()).tip}</Text>}
          {s?.lesson && <Text type="secondary">本节课时：{s.lesson.title}</Text>}
          {s?.status === 'skipped' && <Text type="secondary">未上原因：{s.skipReason || '（未填写）'}</Text>}

          <Space wrap>
            {!s && (
              <Button icon={<PlayCircleOutlined />} loading={busy}
                onClick={() => run(() => scheduleAPI.startOccurrence(ref), '已开始上课，课时已切换')}>立即上课</Button>
            )}
            {!s && dayjs(`${occ.date} ${occ.start}`).isBefore(dayjs()) && (
              <Button loading={busy} onClick={() => run(() => scheduleAPI.recordOccurrence(ref), '已补记')}>补记为已上</Button>
            )}
            {s && s.status !== 'skipped' && (
              <Button type="primary" icon={<CheckSquareOutlined />} onClick={() => { openSession(s._id); onClose(); }}>
                点名 / 调整课时
              </Button>
            )}
            {s?.status === 'skipped' && !s.startedAt && dayjs(s.startAt).isAfter(dayjs()) && (
              <Button loading={busy} onClick={() => run(() => scheduleAPI.unskip(s._id), '已撤销')}>撤销「未上」</Button>
            )}
          </Space>

          {s && s.status !== 'in_progress' && !(s.status === 'skipped' && !s.startedAt && dayjs(s.startAt).isAfter(dayjs())) && (
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

          {(!s || s.status === 'in_progress') && (
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="已知会被占用？填写原因（可选）" value={reason} maxLength={100} onChange={e => setReason(e.target.value)} />
              <Button danger loading={busy} onClick={() => run(() => scheduleAPI.skipOccurrence({ ...ref, reason }), '已标记为未上，进度不会前进')}>标记未上</Button>
            </Space.Compact>
          )}

          {!s && (
            <Space wrap>
              <Popconfirm title="取消本次课？（仅这一天，不影响每周课表）" onConfirm={() =>
                run(() => scheduleAPI.createAdjustment({ type: 'cancel', date, period, reason }), '本次已取消')}>
                <Button>取消本次（调课调出）</Button>
              </Popconfirm>
              {occ.source === 'adjust' && (
                <Button onClick={() => run(() => scheduleAPI.deleteAdjustment(occ.adjustmentId), '已移除')}>移除这次临时课</Button>
              )}
              {occ.source === 'slot' && (
                <Popconfirm title="删除这条每周固定课？" onConfirm={() => run(() => scheduleAPI.deleteSlot(occ.slotId), '已删除')}>
                  <Button danger>删除每周固定课</Button>
                </Popconfirm>
              )}
            </Space>
          )}
        </Space>
      )}
    </Modal>
  );
};

// ───────────── 周课表 ─────────────
const WeekGrid = ({ config, classes, courses }) => {
  const [weekStart, setWeekStart] = useState(mondayOf(dayjs()));
  const [occs, setOccs] = useState([]);
  const [cancelled, setCancelled] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cell, setCell] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  const days = config.days;
  const dates = days.map(d => ({ weekday: d, date: weekStart.add(d - 1, 'day').format(DATE_FMT) }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await scheduleAPI.listOccurrences(weekStart.format(DATE_FMT), weekStart.add(6, 'day').format(DATE_FMT));
      setOccs(res.data);
      setCancelled(res.adjustments || []);
    } catch (e) { message.error(errMsg(e, '加载课表失败')); } finally { setLoading(false); }
  }, [weekStart]);
  useEffect(() => { load(); }, [load]);

  const find = (date, period) => occs.find(o => o.date === date && o.period === period);
  const now = dayjs();

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<LeftOutlined />} onClick={() => setWeekStart(w => w.subtract(7, 'day'))} />
        <DatePicker picker="week" allowClear={false} value={weekStart} format={() => `${weekStart.format('MM-DD')} ~ ${weekStart.add(6, 'day').format('MM-DD')}`}
          onChange={v => v && setWeekStart(mondayOf(v))} />
        <Button icon={<RightOutlined />} onClick={() => setWeekStart(w => w.add(7, 'day'))} />
        <Button onClick={() => setWeekStart(mondayOf(dayjs()))}>本周</Button>
      </Space>
      <Table size="small" bordered pagination={false} loading={loading} rowKey="index" dataSource={config.periods}
        columns={[
          { title: '节次', width: 110, fixed: 'left', render: (_, p) => <div><b>{p.name}</b><br /><Text type="secondary" style={{ fontSize: 12 }}>{p.start}-{p.end}</Text></div> },
          ...dates.map(({ weekday, date }) => ({
            title: <div>{DAY_NAMES[weekday]}<br /><Text type={date === now.format(DATE_FMT) ? undefined : 'secondary'} strong={date === now.format(DATE_FMT)} style={{ fontSize: 12 }}>{date.slice(5)}</Text></div>,
            width: 150,
            onCell: (p) => ({ style: { cursor: 'pointer', padding: 6, verticalAlign: 'top', minWidth: 130 }, onClick: () => {
              const occ = find(date, p.index) || null;
              setCell({ occ, date, weekday, period: p.index, cancelAdjustment: cancelled.find(a => a.date === date && a.period === p.index) });
            } }),
            render: (_, p) => {
              const occ = find(date, p.index);
              if (!occ) {
                return cancelled.some(a => a.date === date && a.period === p.index)
                  ? <Tag>已取消</Tag>
                  : <Text type="secondary" style={{ fontSize: 12 }}>＋</Text>;
              }
              const st = statusOf(occ, now);
              return (
                <div>
                  <b>{classLabel(occ.classInfo)}</b>
                  <div style={{ fontSize: 12 }}>{occ.courseInfo?.title}</div>
                  <Space size={4} wrap>
                    <Tag color={st.color} style={{ marginRight: 0 }}>{st.text}</Tag>
                    {occ.source === 'adjust' && <Tag color="purple" style={{ marginRight: 0 }}>调</Tag>}
                    {occ.session?.attendanceTaken && <Tag color="green" style={{ marginRight: 0 }}>已点名</Tag>}
                  </Space>
                  {occ.session?.lesson && <div style={{ fontSize: 12, color: '#738078' }}>{occ.session.lesson.title}</div>}
                </div>
              );
            }
          }))
        ]}
        scroll={{ x: 'max-content' }} />
      <CellModal cell={cell} classes={classes} courses={courses} periods={config.periods}
        onClose={() => setCell(null)} onChanged={load} openSession={setSessionId} />
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
          scheduleAPI.getConfig(), classAPI.getTeacherClasses(), api.get('/courses')
        ]);
        setConfig(cfg.data);
        setClasses(cls.data || []);
        setCourses(crs.data.courses || []);
      } catch (e) { message.error('加载课表失败'); }
    })();
  }, []);

  if (!config) return <Spin />;
  if (classes.length === 0) return <Empty description="请先在「班级管理」中创建班级" />;

  return (
    <Tabs items={[
      {
        key: 'week', label: '课表',
        children: (
          <>
            <Alert style={{ marginBottom: 12 }} type="info" showIcon
              message="排好每周固定课表后，平时不需要再操作"
              description={<>
                上课前 {config.leadMinutes} 分钟自动上课，并切到该班该课程的下一节课时。下课 10 分钟后自动判定：
                至少 {config.threshold}% 的学生完成了本节课时的活动 → 上了本课；
                否则至少 {config.presenceThreshold}% 的学生登录 → 到课但没上新课（自由活动、复习等）；都不满足 → 没上（被占课等）。
                只有「上了本课」进度才前进；到课的课都按登录自动生成考勤。上课中切换课时，系统记录停留最久的那一节。
                临时去别的班上课，直接在「上课」页面选班级、点上课即可。判定有误时点格子更正。
              </>} />
            <WeekGrid config={config} classes={classes} courses={courses} />
          </>
        )
      },
      { key: 'progress', label: '进度 · 考勤 · 导出', children: <ProgressPanel classes={classes} /> }
    ]} />
  );
};

export default TeacherSchedule;
