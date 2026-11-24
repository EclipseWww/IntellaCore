import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Input, InputNumber, TimePicker, Checkbox, Space, message, Alert, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { scheduleAPI } from '../../services/scheduleAPI';

const { Text } = Typography;
const DAY_OPTIONS = [
  { label: '周一', value: 1 }, { label: '周二', value: 2 }, { label: '周三', value: 3 },
  { label: '周四', value: 4 }, { label: '周五', value: 5 }, { label: '周六', value: 6 }, { label: '周日', value: 7 }
];
const FMT = 'HH:mm';

/** 管理员：设置每天共几节课、每节课的起止时间、哪些天上课 */
const ScheduleSettings = () => {
  const [periods, setPeriods] = useState([]);
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [leadMinutes, setLeadMinutes] = useState(5);
  const [threshold, setThreshold] = useState(25);
  const [presenceThreshold, setPresenceThreshold] = useState(30);
  const [isDefault, setIsDefault] = useState(false);
  const [timezone, setTimezone] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await scheduleAPI.getConfig();
      setPeriods(res.data.periods);
      setDays(res.data.days);
      setLeadMinutes(res.data.leadMinutes);
      setThreshold(res.data.threshold);
      setPresenceThreshold(res.data.presenceThreshold);
      setIsDefault(res.data.isDefault);
      setTimezone(res.data.timezone);
    } catch (e) {
      message.error('获取课表设置失败');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const update = (i, patch) => setPeriods(ps => ps.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const add = () => {
    const last = periods[periods.length - 1];
    const start = last ? dayjs(last.end, FMT).add(10, 'minute') : dayjs('08:00', FMT);
    setPeriods([...periods, { name: `第${periods.length + 1}节`, start: start.format(FMT), end: start.add(40, 'minute').format(FMT) }]);
  };
  const remove = (i) => setPeriods(ps => ps.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, name: /^第\d+节$/.test(p.name) ? `第${idx + 1}节` : p.name })));

  const save = async () => {
    setSaving(true);
    try {
      await scheduleAPI.updateConfig({
        days, leadMinutes, threshold, presenceThreshold,
        periods: periods.map(p => ({ name: p.name, start: p.start, end: p.end }))
      });
      message.success('课表设置已保存');
      load();
    } catch (e) {
      message.error(e.response?.data?.message || '保存失败');
    } finally { setSaving(false); }
  };

  const columns = [
    { title: '节次', width: 70, render: (_, __, i) => i + 1 },
    { title: '名称', width: 160, render: (_, p, i) => <Input value={p.name} maxLength={20} onChange={e => update(i, { name: e.target.value })} /> },
    {
      title: '上课时间', width: 140,
      render: (_, p, i) => <TimePicker format={FMT} minuteStep={5} allowClear={false} value={dayjs(p.start, FMT)}
        onChange={v => v && update(i, { start: v.format(FMT) })} />
    },
    {
      title: '下课时间', width: 140,
      render: (_, p, i) => <TimePicker format={FMT} minuteStep={5} allowClear={false} value={dayjs(p.end, FMT)}
        onChange={v => v && update(i, { end: v.format(FMT) })} />
    },
    { title: '时长', width: 90, render: (_, p) => `${dayjs(p.end, FMT).diff(dayjs(p.start, FMT), 'minute')} 分钟` },
    { title: '', width: 60, render: (_, __, i) => <Button type="text" danger icon={<DeleteOutlined />} disabled={periods.length <= 1} onClick={() => remove(i)} /> }
  ];

  return (
    <Card title="课表节次设置" loading={loading}>
      {isDefault && <Alert style={{ marginBottom: 16 }} type="info" showIcon
        message="当前使用系统默认节次，点击「保存」后才会成为学校的正式设置。" />}
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Text strong>上课日：</Text>
          <Checkbox.Group options={DAY_OPTIONS} value={days} onChange={setDays} />
        </div>
        <Space wrap size={24}>
          <span><Text strong>提前自动上课：</Text>上课前 <InputNumber min={0} max={30} value={leadMinutes} onChange={v => setLeadMinutes(v ?? 0)} style={{ width: 70 }} /> 分钟</span>
          <span>
            <Text strong>上了本课：</Text>至少
            <InputNumber min={1} max={100} value={threshold} onChange={v => setThreshold(v ?? 25)} style={{ width: 70, margin: '0 4px' }} />% 的学生完成了本节课时的活动
          </span>
          <span>
            <Text strong>到课：</Text>至少
            <InputNumber min={1} max={100} value={presenceThreshold} onChange={v => setPresenceThreshold(v ?? 30)} style={{ width: 70, margin: '0 4px' }} />% 的学生在本节课内登录
          </span>
        </Space>
        <Table rowKey={(_, i) => i} size="small" pagination={false} columns={columns} dataSource={periods} />
        <Space>
          <Button icon={<PlusOutlined />} onClick={add} disabled={periods.length >= 20}>增加一节</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>保存设置</Button>
        </Space>
        <Text type="secondary">
          每天共 {periods.length} 节课。教师按这里的节次排课，到点自动上课、到点自动下课；
          时区：{timezone || '—'}。修改节次时间后，已排好的课表自动按新时间生效；删除节次会使该节次上的课表项暂不显示。
        </Text>
      </Space>
    </Card>
  );
};

export default ScheduleSettings;
