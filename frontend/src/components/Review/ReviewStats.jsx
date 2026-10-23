import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import api from '../../services/api';

const ReviewStats = () => {
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0
  });
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/review/stats');
      setStats(response.data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // 每30秒更新一次
    return () => clearInterval(interval);
  }, []);

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card>
          <Statistic
            loading={loading}
            title="待审核消息"
            value={stats.pending}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic
            loading={loading}
            title="已通过消息"
            value={stats.approved}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic
            loading={loading}
            title="已拒绝消息"
            value={stats.rejected}
            prefix={<CloseCircleOutlined />}
            valueStyle={{ color: '#ff4d4f' }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default ReviewStats; 