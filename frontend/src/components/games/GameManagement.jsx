import React, { useEffect, useMemo, useState } from 'react';
import { Card, Table, Switch, Typography, Statistic, Row, Col, message, Tag, Space, Alert } from 'antd';
import { FireOutlined, TeamOutlined, PlayCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import gameService from '../../services/gameService';
import { LOCAL_GAMES, formatPlayTime } from './gameCatalog';

const { Text } = Typography;

/** 教师：查看各游戏累计游玩时长，设置哪些游戏对自己的班级开放 */
const GameManagement = () => {
  const [stats, setStats] = useState({});
  const [disabled, setDisabled] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    gameService.getStats()
      .then(res => {
        setStats(Object.fromEntries((res.data || []).map(x => [x.gameId, x])));
        setDisabled(res.disabled || []);
        setTotal(res.totalSeconds || 0);
      })
      .catch(() => message.error('加载游戏数据失败'))
      .finally(() => setLoading(false));
  }, []);

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
