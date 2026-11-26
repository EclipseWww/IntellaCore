import React, { useEffect, useMemo, useState } from 'react';
import { Card, Table, Switch, Typography, Statistic, Row, Col, message, Tag, Space, Alert, Button } from 'antd';
import { FireOutlined, TeamOutlined, PlayCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import gameService from '../../services/gameService';
import { getTeacherClasses, updateClassSettings } from '../../services/classService';
import { LOCAL_GAMES, formatPlayTime } from './gameCatalog';
import { formatClassName } from '../../utils/className';

const { Text } = Typography;

/** 教师：查看各游戏累计游玩时长，设置哪些游戏对自己的班级开放 */
const GameManagement = () => {
  const [stats, setStats] = useState({});
  const [disabled, setDisabled] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [updatingClassId, setUpdatingClassId] = useState(null);
  const [batchUpdating, setBatchUpdating] = useState(false);

  useEffect(() => {
    gameService.getStats()
      .then(res => {
        setStats(Object.fromEntries((res.data || []).map(x => [x.gameId, x])));
        setDisabled(res.disabled || []);
        setTotal(res.totalSeconds || 0);
      })
      .catch(() => message.error('加载游戏数据失败'))
      .finally(() => setLoading(false));
    getTeacherClasses()
      .then(res => setClasses(res.success ? res.data || [] : []))
      .catch(() => message.error('加载班级列表失败'))
      .finally(() => setClassesLoading(false));
  }, []);

  const setClassAllowed = async (cls, allow) => {
    setUpdatingClassId(cls._id);
    try {
      await updateClassSettings(cls._id, { allowGameCenter: allow });
      setClasses(prev => prev.map(c => c._id === cls._id ? { ...c, allowGameCenter: allow } : c));
      message.success(`已${allow ? '开启' : '关闭'} ${formatClassName(cls)} 的游戏中心`);
    } catch (e) {
      message.error('操作失败');
    } finally { setUpdatingClassId(null); }
  };

  const setAllClassesAllowed = async (allow) => {
    setBatchUpdating(true);
    const results = await Promise.allSettled(classes.map(c => updateClassSettings(c._id, { allowGameCenter: allow })));
    const okIds = new Set(classes.filter((_, i) => results[i].status === 'fulfilled').map(c => c._id));
    setClasses(prev => prev.map(c => okIds.has(c._id) ? { ...c, allowGameCenter: allow } : c));
    if (okIds.size === classes.length) message.success(`已全部${allow ? '开启' : '关闭'}`);
    else message.error(`有 ${classes.length - okIds.size} 个班级未能更新，请重试`);
    setBatchUpdating(false);
  };

  const rows = useMemo(() => LOCAL_GAMES
    .map(g => ({ ...g, ...(stats[g._id] || {}), totalSeconds: stats[g._id]?.totalSeconds || 0 }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds), [stats]);

  const toggle = async (gameId, open) => {
    const next = open ? disabled.filter(x => x !== gameId) : [...disabled, gameId];
    setSaving(true);
    try {
      const res = await gameService.setDisabled(next);
      setDisabled(res.disabled);
      message.success(open ? '已对你的班级开放' : '已对你的班级关闭');
    } catch (e) {
      message.error('保存失败');
    } finally { setSaving(false); }
  };

  const players = Object.values(stats).reduce((a, x) => a + (x.sessions || 0), 0);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={8}><Card><Statistic title="全校累计游玩" value={formatPlayTime(total)} prefix={<FireOutlined style={{ color: '#fa541c' }} />} /></Card></Col>
        <Col span={8}><Card><Statistic title="累计游戏次数" value={players} prefix={<PlayCircleOutlined />} /></Card></Col>
        <Col span={8}><Card><Statistic title="对我的班级开放" value={`${LOCAL_GAMES.length - disabled.length} / ${LOCAL_GAMES.length}`} prefix={<TeamOutlined />} /></Card></Col>
      </Row>
      <Card
        title="班级游戏中心开关"
        extra={(
          <Space>
            <Button size="small" loading={batchUpdating} disabled={!classes.length} onClick={() => setAllClassesAllowed(true)}>全部开启</Button>
            <Button size="small" danger loading={batchUpdating} disabled={!classes.length} onClick={() => setAllClassesAllowed(false)}>全部关闭</Button>
          </Space>
        )}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          关闭后，该班学生看不到游戏中心，也看不到、不能兑换你在积分商店发布的游戏商品。
        </Text>
        <Table size="small" rowKey="_id" loading={classesLoading} dataSource={classes} pagination={{ pageSize: 10, hideOnSinglePage: true }} columns={[
          { title: '班级', key: 'className', sorter: (a, b) => (a.type === 'elective') - (b.type === 'elective') || (a.grade || 0) - (b.grade || 0), render: (_, c) => formatClassName(c) },
          {
            title: '状态', render: (_, c) => (
              <Tag color={c.allowGameCenter !== false ? 'success' : 'default'}>{c.allowGameCenter !== false ? '允许访问' : '禁止访问'}</Tag>
            )
          },
          {
            title: '游戏中心', width: 110, render: (_, c) => (
              <Switch checked={c.allowGameCenter !== false} loading={updatingClassId === c._id || batchUpdating}
                checkedChildren="开启" unCheckedChildren="关闭" onChange={v => setClassAllowed(c, v)} />
            )
          }
        ]} />
      </Card>
      <Alert type="info" showIcon message="关闭的游戏不会出现在你所教班级学生的游戏中心里，学生也无法打开。累计时长按学生实际游玩时间统计（教师试玩不计入），游戏中心默认按热度排序。" />
      <Card>
        <Table rowKey="_id" loading={loading} pagination={false} dataSource={rows} columns={[
          {
            title: '游戏', render: (_, g) => (
              <Space>
                <img src={g.image} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                <div><Text strong>{g.itemName}</Text><div style={{ fontSize: 12, color: '#888', maxWidth: 420 }}>{g.description}</div></div>
              </Space>
            )
          },
          {
            title: '热度排名', width: 90, render: (_, g, i) => g.totalSeconds ? <Tag color={i < 3 ? 'volcano' : 'default'}>第 {i + 1}</Tag> : '—'
          },
          { title: '累计游玩', width: 110, render: (_, g) => g.totalSeconds ? formatPlayTime(g.totalSeconds) : '—' },
          { title: '玩过的学生', width: 100, render: (_, g) => g.playerCount || 0 },
          { title: '游戏次数', width: 90, render: (_, g) => g.sessions || 0 },
          { title: '最近游玩', width: 140, render: (_, g) => g.lastPlayedAt ? dayjs(g.lastPlayedAt).format('MM-DD HH:mm') : '—' },
          {
            title: '对我的班级开放', width: 130, render: (_, g) => (
              <Switch checked={!disabled.includes(g._id)} loading={saving} onChange={(v) => toggle(g._id, v)} />
            )
          }
        ]} />
      </Card>
    </Space>
  );
};

export default GameManagement;
