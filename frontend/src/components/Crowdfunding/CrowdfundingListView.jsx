import React, { useState, useEffect } from 'react';
import { Card, List, Badge, Progress, Button, Spin, Empty, Tag, Typography, Row, Col, Tabs, Space } from 'antd';
import { getCrowdfundingList } from '../../services/crowdfundingService';
import { TrophyOutlined, CalendarOutlined, TeamOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const CrowdfundingListView = ({ onViewDetails, isEmbedded = false, maxDisplay }) => {
  const [loading, setLoading] = useState(true);
  const [crowdfundings, setCrowdfundings] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: maxDisplay || 10,
    total: 0
  });
  const [activeTab, setActiveTab] = useState('all');

  // 获取众筹活动列表
  const fetchCrowdfundings = async (page = 1, status = '') => {
    try {
      setLoading(true);
      const response = await getCrowdfundingList({
        page,
        limit: pagination.pageSize,
        status,
        includeCompleted: true,
        includeExpired: true
      });
      
      setCrowdfundings(response.crowdfundings);
      setPagination({
        ...pagination,
        current: response.pagination.page,
        total: response.pagination.total
      });
    } catch (error) {
      console.error('获取众筹列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrowdfundings();
  }, []);

  // 状态标签颜色映射
  const statusColorMap = {
    pending: 'default',
    active: 'green',
    ready_to_complete: 'gold',
    completed: 'blue',
    expired: 'red'
  };

  // 状态中文名称映射
  const statusNameMap = {
    pending: '即将开始',
    active: '进行中',
    ready_to_complete: '目标已达成',
    completed: '已完成',
    expired: '已过期'
  };

  // 处理选项卡切换
  const handleTabChange = (key) => {
    setActiveTab(key);
    
    // 根据选项卡切换状态筛选
    if (key === 'all') {
      fetchCrowdfundings(1, '');
    } else if (key === 'active') {
      fetchCrowdfundings(1, 'active');
    } else if (key === 'pending') {
      fetchCrowdfundings(1, 'pending');
    } else if (key === 'completed') {
      fetchCrowdfundings(1, 'completed');
    } else if (key === 'expired') {
      fetchCrowdfundings(1, 'expired');
    }
  };

  // 根据状态筛选众筹活动
  const getFilteredCrowdfundings = () => {
    // 在嵌入模式下，展示全部状态（含已完成、已过期）的众筹，便于查看历史
    if (isEmbedded) {
      return crowdfundings;
    }
    
    // 正常模式下，根据当前选择的标签过滤
    if (activeTab === 'all') {
      return crowdfundings;
    } else {
      return crowdfundings.filter(item => item.status === activeTab);
    }
  };

  // 格式化截止日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 渲染标题部分 - 移除文字说明
  const renderTitle = () => {
    if (isEmbedded) {
      // 嵌入积分商店时不显示标题
      return null;
    } else {
      // 独立页面时只显示标题，不显示说明文字
      return (
        <Row justify="center" style={{ marginBottom: '20px' }}>
          <Col xs={24} sm={20} md={18} lg={16} xl={14}>
            <Title level={2} style={{ textAlign: 'center' }}>积分众筹活动</Title>
          </Col>
        </Row>
      );
    }
  };

  // 渲染卡片内容
  const renderCardContent = (item) => (
    <div style={{ height: '310px', width: '100%' }}>
      <div className="crowdfunding-card" style={{
        width: '100%',
        height: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        transition: 'all 0.3s',
        cursor: 'pointer',
        position: 'relative',
        border: '1px solid #eee'
      }}>
        {/* 状态标签 */}
        <div style={{ 
          position: 'absolute', 
          top: '10px', 
          right: '10px', 
          zIndex: 2 
        }}>
          <Tag color={statusColorMap[item.status]}>{statusNameMap[item.status]}</Tag>
        </div>

        {/* 图片容器 */}
        <div style={{ 
          width: '100%', 
          height: '160px',
          position: 'relative', 
          overflow: 'hidden',
          backgroundColor: '#f5f5f5'
        }}>
          <img 
            alt={item.title} 
            src={item.image} 
            style={{ 
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: item.status === 'expired' ? 'grayscale(0.5)' : 'none'
            }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              e.target.parentNode.innerHTML = '<div style="height:160px;display:flex;align-items:center;justify-content:center;color:#999;">暂无图片</div>';
            }}
          />
        </div>
        
        {/* 内容区域 */}
        <div style={{ 
          padding: '10px', 
          display: 'flex', 
          flexDirection: 'column',
          flex: 1
        }} onClick={() => onViewDetails(item)}>
          {/* 标题 */}
          <div style={{ 
            fontWeight: 'bold', 
            fontSize: '15px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '6px'
          }}>
            {item.title}
          </div>
          
          {/* 描述 */}
          <div style={{ 
            fontSize: '13px',
            color: '#666',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            marginBottom: '8px'
          }}>
            {item.description || '暂无描述'}
          </div>
          
          {/* 进度 */}
          <div style={{ marginBottom: '8px' }}>
            <Progress 
              percent={Math.round((item.currentPoints / item.targetPoints) * 100)} 
              status={
                item.status === 'expired' ? 'exception' : 
                (item.currentPoints >= item.targetPoints ? 'success' : 'active')
              }
              size="small"
              format={() => `${item.currentPoints}/${item.targetPoints}`}
            />
          </div>
          
          {/* 奖励信息 */}
          <div style={{ fontSize: '12px', marginBottom: '8px' }}>
            <Space>
              <TrophyOutlined style={{ color: item.status === 'expired' ? '#d9d9d9' : '#1890ff' }} />
              {item.reward && item.reward.type === 'network_time' && (
                <Tag color={item.status === 'expired' ? 'default' : 'blue'} style={{ margin: 0 }}>
                  {`上网时间 ${item.reward.duration || 0} 分钟`}
                </Tag>
              )}
              {item.reward && item.reward.type === 'game' && (
                <Tag color={item.status === 'expired' ? 'default' : 'purple'} style={{ margin: 0 }}>
                  游戏时间
                </Tag>
              )}
              {item.reward && item.reward.type === 'other' && (
                <Tag color={item.status === 'expired' ? 'default' : 'orange'} style={{ margin: 0 }}>
                  其他奖励
                </Tag>
              )}
            </Space>
          </div>
          
          {/* 截止日期 */}
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
            <CalendarOutlined style={{ marginRight: '5px' }} />
            截止日期: {formatDate(item.endDate)}
          </div>
          
          {/* 分隔线 */}
          <div style={{ height: '1px', background: '#f0f0f0', margin: '2px 0 8px' }} />
          
          {/* 按钮区域 */}
          <div style={{ 
            marginTop: 'auto', 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: '13px', color: '#1890ff' }}>
              目标: <Text strong>{item.targetPoints}</Text> 积分
            </Text>
            <Button 
              type={item.status === 'active' ? 'primary' : 'default'} 
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(item);
              }}
              disabled={item.status === 'expired'}
            >
              {item.status === 'active' ? '参与' : '详情'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="crowdfunding-list-container">
      {renderTitle()}

      <Row justify="center">
        <Col xs={24} sm={isEmbedded ? 24 : 22} md={isEmbedded ? 24 : 22} lg={isEmbedded ? 24 : 22} xl={isEmbedded ? 24 : 22}>
          {!isEmbedded && (
            <Tabs activeKey={activeTab} onChange={handleTabChange} centered>
              <TabPane tab="全部" key="all" />
              <TabPane tab="进行中" key="active" />
              <TabPane tab="即将开始" key="pending" />
              <TabPane tab="已完成" key="completed" />
              <TabPane tab="已过期" key="expired" />
            </Tabs>
          )}
          
          <Spin spinning={loading}>
            {getFilteredCrowdfundings().length > 0 ? (
              <List
                grid={{
                  gutter: 16,
                  xs: 1,
                  sm: 2,
                  md: 3,
                  lg: 4,
                  xl: 4,
                  xxl: 4,
                }}
                dataSource={getFilteredCrowdfundings()}
                pagination={!maxDisplay ? {
                  onChange: (page) => fetchCrowdfundings(page, activeTab === 'all' ? '' : activeTab),
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  size: 'small'
                } : false}
                renderItem={(item) => (
                  <List.Item>
                    {renderCardContent(item)}
                  </List.Item>
                )}
              />
            ) : (
              <Empty description={`暂无${activeTab === 'all' ? '' : statusNameMap[activeTab]}众筹活动`} />
            )}
          </Spin>
        </Col>
      </Row>
    </div>
  );
};

export default CrowdfundingListView; 