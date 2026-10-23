import React, { useState, useEffect } from 'react';
import { Typography, Badge, Tooltip, Spin } from 'antd';
import { GiftOutlined } from '@ant-design/icons';
import { getPointBalance, subscribeToPointsChange } from '../../services/achievementService';

const { Text } = Typography;

/**
 * 积分显示组件，显示学生当前积分
 * @param {Object} props
 * @param {string} [props.size='default'] - 尺寸：'small', 'default', 'large'
 * @param {boolean} [props.showIcon=true] - 是否显示图标
 * @param {Function} [props.onPointsChange] - 积分变化时的回调函数
 * @returns {JSX.Element}
 */
const PointsDisplay = ({ size = 'default', showIcon = true, onPointsChange = null }) => {
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPoints = async () => {
      try {
        setLoading(true);
        const response = await getPointBalance();
        if (response.success) {
          setPoints(response.totalPoints);
          if (onPointsChange) {
            onPointsChange(response.totalPoints);
          }
        } else {
          setError('获取积分失败');
        }
      } catch (err) {
        console.error('获取积分失败:', err);
        setError('获取积分失败');

        // 尝试从本地存储获取
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData.totalPoints) {
          setPoints(userData.totalPoints);
          if (onPointsChange) {
            onPointsChange(userData.totalPoints);
          }
        } else {
          setPoints(0);
          if (onPointsChange) {
            onPointsChange(0);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPoints();

    // 订阅积分变化事件
    const unsubscribe = subscribeToPointsChange((newPoints) => {
      console.log('积分变化:', newPoints);
      setPoints(newPoints);
      if (onPointsChange) {
        onPointsChange(newPoints);
      }
    });

    // 组件卸载时取消订阅
    return () => unsubscribe();
  }, [onPointsChange]);

  // 字体大小映射
  const fontSizeMap = {
    small: 14,
    default: 16,
    large: 18
  };

  if (loading) {
    return <Spin size="small" />;
  }

  if (error && points === null) {
    return (
      <Tooltip title="获取积分失败">
        <Text type="danger">积分: --</Text>
      </Tooltip>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      {showIcon && (
        <GiftOutlined style={{ marginRight: 6, color: '#1890ff' }} />
      )}
      <Badge
        count={Number.isFinite(Number(points)) ? Math.trunc(Number(Number(points).toFixed(2))) : 0}
        showZero
        color="#1890ff"
        overflowCount={99999}
        style={{ fontWeight: 'bold', fontSize: fontSizeMap[size] }}
      />
    </div>
  );
};

export default PointsDisplay; 