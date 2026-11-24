import React, { useEffect, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import { ClockCircleOutlined, PlayCircleOutlined, FieldTimeOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { scheduleAPI } from '../../services/scheduleAPI';
import { inTz, setScheduleTz } from '../../utils/scheduleTime';

const classLabel = (c) => (c ? `${c.grade}级${c.name}班` : '');
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 教师端顶部状态：服务器时间（避免教室电脑时间不准）、正在上的课、下一节将自动上课的班级。
 * 每 30 秒刷新一次，并广播 schedule-now 事件供「上课」页自动切换班级。
 */
const ScheduleStatus = () => {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(Date.now());
  const offsetRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const load = () => scheduleAPI.now().then((res) => {
      if (!alive) return;
      setScheduleTz(res.data.timezone);
      offsetRef.current = new Date(res.data.serverTime).getTime() - Date.now();
      setData(res.data);
      window.dispatchEvent(new CustomEvent('schedule-now', { detail: res.data }));
    }).catch(() => {});
    load();
    const poll = setInterval(load, 30000);
    const clock = setInterval(() => setTick(Date.now()), 1000);
    return () => { alive = false; clearInterval(poll); clearInterval(clock); };
  }, []);

  const now = inTz(tick + offsetRef.current);
  const { current, next } = data || {};
  const item = { display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' };

  let nextText = null;
  if (next) {
    const sameDay = next.date === now.format('YYYY-MM-DD');
    const when = sameDay ? '' : `${dayjs(next.date).format('M/D')} 周${WEEK[dayjs(next.date).day()]} `;
    nextText = `下一节：${when}${next.periodName} ${classLabel(next.class)}` +
      (next.autoStartAt ? `，${inTz(next.autoStartAt).format('HH:mm')} 自动上课` : '（不自动上课）');
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 13, color: '#3c4a43', overflow: 'hidden' }}>
      <span style={{ ...item, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        <ClockCircleOutlined /> {now.format('M月D日 周')}{WEEK[now.day()]} {now.format('HH:mm:ss')}
      </span>
      {current && (
        <span style={{ ...item, color: '#237a57' }}>
          <PlayCircleOutlined /> 上课中：{current.periodName} {classLabel(current.class)}
          {current.lesson ? ` · ${current.lesson.title}` : ''}
          {current.lessonMissing && (
            <Tooltip title="下一课时尚未准备：照常上课但没有指定课时。建好新课时后会自动切换，也可在「上课」页手动选择。">
              <WarningOutlined style={{ color: '#d46b08' }} />
            </Tooltip>
          )}
        </span>
      )}
      {nextText && (
        <Tooltip title={next.course ? `课程：${next.course.title}${next.lesson ? `，课时：${next.lesson.title}` : '（下一课时尚未准备）'}` : '课程：未确定'}>
          <span style={item}>
            <FieldTimeOutlined /> {nextText}
            {next.lessonMissing && <WarningOutlined style={{ color: '#d46b08' }} />}
          </span>
        </Tooltip>
      )}
    </div>
  );
};

export default ScheduleStatus;
