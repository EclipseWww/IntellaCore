import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Progress, Button, Spin, Tag, Row, Col, Modal, Input, List, Avatar, message as messageApi, Divider, Alert, Table } from 'antd';
import { getCrowdfundingDetail, contributeToCrowdfunding } from '../../services/crowdfundingService';
import { UserOutlined, TrophyOutlined, CalendarOutlined, TeamOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const CrowdfundingDetailView = ({ crowdfundingId, onBack }) => {
  const [crowdfunding, setCrowdfunding] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [userParticipation, setUserParticipation] = useState({});
  const [loading, setLoading] = useState(true);
  const [contributing, setContributing] = useState(false);
  const [contributionModal, setContributionModal] = useState(false);
  const [points, setPoints] = useState('');
  const [message, setMessage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // 获取众筹活动详情
  const fetchCrowdfundingDetail = async () => {
    try {
      setLoading(true);
      const response = await getCrowdfundingDetail(crowdfundingId);
      
      setCrowdfunding(response.crowdfunding);
      setContributions(response.contributions);
      setUserParticipation(response.userParticipation);
      
    } catch (error) {
      console.error('获取众筹详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (crowdfundingId) {
      fetchCrowdfundingDetail();
    }
  }, [crowdfundingId]);

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

  // 参与众筹
  const handleContribute = () => {
    setContributionModal(true);
  };

  // 提交贡献
  const handleSubmitContribution = async () => {
    if (!points || isNaN(points) || parseInt(points) < 100) {
      messageApi.error('请输入至少100积分');
      return;
    }

    try {
      setSubmitLoading(true);
      
      const result = await contributeToCrowdfunding(crowdfundingId, {
        points: parseInt(points),
        message
      });
      
      if (result.processing) messageApi.info(result.message);
      else messageApi.success('众筹参与成功！');
      setContributionModal(false);
      setPoints('');
      setMessage('');
      
      // 重新获取详情
      fetchCrowdfundingDetail();
      
    } catch (error) {
      if (error.response && error.response.data) {
        messageApi.error(error.response.data.message || '参与众筹失败');
      } else {
        messageApi.error('参与众筹失败');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  // 统计每个学生的贡献
  const contributionRanking = useMemo(() => {
    if (!contributions || contributions.length === 0) return [];
    
    // 合并相同学生的贡献
    const studentContributions = {};
    
    contributions.forEach(contribution => {
      const studentId = contribution.studentId._id;
      if (!studentContributions[studentId]) {
        studentContributions[studentId] = {
          studentId: studentId,
          name: contribution.studentId.name || contribution.studentId.username || '匿名用户',
          avatar: contribution.studentId.avatar,
          totalPoints: 0,
          contributionCount: 0,
          latestContribution: null,
          latestMessage: null
        };
      }
      
      studentContributions[studentId].totalPoints += contribution.points;
      studentContributions[studentId].contributionCount += 1;
      
      // 记录最新的贡献时间和留言
      if (!studentContributions[studentId].latestContribution || 
          new Date(contribution.timestamp) > new Date(studentContributions[studentId].latestContribution)) {
        studentContributions[studentId].latestContribution = contribution.timestamp;
        studentContributions[studentId].latestMessage = contribution.message;
        studentContributions[studentId].latestPoints = contribution.points;
      }
    });
    
    // 转换为数组并排序
    return Object.values(studentContributions)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));
  }, [contributions]);

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 更详细的日期格式化，包含时间
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!crowdfunding) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Title level={3}>众筹活动不存在</Title>
        <Button onClick={onBack}>返回列表</Button>
      </div>
    );
  }

  return (
    <div>
      <Button 
        onClick={onBack} 
        style={{ marginBottom: '20px' }}
      >
        返回列表
      </Button>
      
      <Row gutter={[24, 24]}>
        {/* 左侧众筹信息部分 */}
        <Col xs={24} md={14}>
          <Card bordered={false} className="crowdfunding-info-card">
            {/* 状态提示 */}
            {crowdfunding.status === 'completed' && (
              <Alert
                message="众筹已完成"
                description="该众筹活动已成功完成，参与者已获得奖励。"
                type="success"
                showIcon
                style={{ marginBottom: '20px' }}
              />
            )}
            
            {crowdfunding.status === 'expired' && (
              <Alert
                message="众筹已过期"
                description="该众筹活动未能在截止日期前达成目标，已自动结束。"
                type="warning"
                showIcon
                style={{ marginBottom: '20px' }}
              />
            )}
            
            {crowdfunding.status === 'ready_to_complete' && (
              <Alert
                message="众筹目标已达成"
                description="该众筹活动已达成目标，正在等待老师确认发放奖励。"
                type="info"
                showIcon
                style={{ marginBottom: '20px' }}
              />
            )}
            
            {/* 众筹图片 */}
            {crowdfunding.image && (
              <div style={{ marginBottom: '20px' }}>
                <img 
                  src={crowdfunding.image} 
                  alt={crowdfunding.title} 
                  style={{ 
                    width: '100%', 
                    maxHeight: '250px', 
                    objectFit: 'cover', 
                    borderRadius: '8px',
                    filter: crowdfunding.status === 'expired' ? 'grayscale(0.5)' : 'none'
                  }} 
                />
              </div>
            )}
            
            {/* 标题和状态 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <Title level={3} style={{ margin: 0 }}>{crowdfunding.title}</Title>
              <Tag color={statusColorMap[crowdfunding.status]} style={{ fontSize: '14px', padding: '4px 8px' }}>
                {statusNameMap[crowdfunding.status]}
              </Tag>
            </div>
            
            {/* 众筹描述 */}
            <Paragraph style={{ fontSize: '15px', marginBottom: '20px' }}>
              {crowdfunding.description}
            </Paragraph>
            
            {/* 众筹信息 */}
            <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <TrophyOutlined style={{ 
                      fontSize: '20px', 
                      marginRight: '10px', 
                      color: crowdfunding.status === 'expired' ? '#d9d9d9' : '#1890ff' 
                    }} />
                    <div>
                      <Text type="secondary">奖励</Text>
                      <div>
                        {crowdfunding.reward && crowdfunding.reward.type === 'network_time' && (
                          <Tag color={crowdfunding.status === 'expired' ? 'default' : 'blue'}>
                            {`上网时间 ${crowdfunding.reward.duration || 0} 分钟`}
                          </Tag>
                        )}
                        {crowdfunding.reward && crowdfunding.reward.type === 'game' && (
                          <Tag color={crowdfunding.status === 'expired' ? 'default' : 'purple'}>
                            游戏时间
                          </Tag>
                        )}
                        {crowdfunding.reward && crowdfunding.reward.type === 'badge' && (
                          <Tag color={crowdfunding.status === 'expired' ? 'default' : 'cyan'}>
                            徽章奖励
                          </Tag>
                        )}
                      </div>
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <CalendarOutlined style={{ fontSize: '20px', marginRight: '10px', color: '#52c41a' }} />
                    <div>
                      <Text type="secondary">截止日期</Text>
                      <div>{formatDate(crowdfunding.endDate)}</div>
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <TeamOutlined style={{ fontSize: '20px', marginRight: '10px', color: '#faad14' }} />
                    <div>
                      <Text type="secondary">参与人数</Text>
                      <div>{contributionRanking.length} 人</div>
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
            
            {/* 众筹进度 */}
            <div style={{ marginBottom: '20px' }}>
              <Title level={4}>众筹进度</Title>
              <Progress 
                percent={Math.min(100, Math.round((crowdfunding.currentPoints / crowdfunding.targetPoints) * 100))} 
                status={
                  crowdfunding.status === 'expired' ? 'exception' : 
                  crowdfunding.status === 'completed' || crowdfunding.status === 'ready_to_complete' ? 'success' : 'active'
                }
                format={() => `${crowdfunding.currentPoints}/${crowdfunding.targetPoints} 积分`}
                strokeWidth={15}
              />

              {/* 参与按钮 */}
              {crowdfunding.status === 'active' && (
                <Button 
                  type="primary" 
                  size="large" 
                  style={{ marginTop: '15px', width: '100%' }} 
                  onClick={handleContribute}
                  loading={contributing}
                >
                  {userParticipation.hasParticipated ? '继续参与众筹' : '参与众筹'}
                </Button>
              )}
              
              {crowdfunding.status !== 'active' && (
                <Button 
                  type="default" 
                  size="large" 
                  style={{ marginTop: '15px', width: '100%' }} 
                  disabled
                >
                  {
                    crowdfunding.status === 'completed' ? '众筹已完成' :
                    crowdfunding.status === 'expired' ? '众筹已过期' :
                    crowdfunding.status === 'ready_to_complete' ? '等待确认完成' : '即将开始'
                  }
                </Button>
              )}
            </div>
            
            {/* 用户参与情况 */}
            {userParticipation.hasParticipated && (
              <div style={{ 
                background: '#e6f7ff', 
                padding: '15px', 
                borderRadius: '8px',
                border: '1px solid #91d5ff'
              }}>
                <Title level={5}>我的参与</Title>
                <Row gutter={[16, 8]}>
                  <Col span={12}>
                    <Text type="secondary">贡献积分</Text>
                    <div><Text strong>{userParticipation.totalPoints || 0}</Text> 分</div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">参与次数</Text>
                    <div><Text strong>{userParticipation.contributionCount || 0}</Text> 次</div>
                  </Col>
                  <Col span={24}>
                    <Text type="secondary">最近参与</Text>
                    <div>{userParticipation.lastContribution ? formatDateTime(userParticipation.lastContribution) : '暂无记录'}</div>
                  </Col>
                </Row>
              </div>
            )}
          </Card>
        </Col>
        
        {/* 右侧贡献排行榜部分 */}
        <Col xs={24} md={10}>
          <Card 
            title={<div style={{ fontSize: '18px', fontWeight: 'bold' }}>贡献排行榜</div>}
            bordered={false}
            className="contribution-ranking-card"
          >
            {contributionRanking.length > 0 ? (
              <List
                dataSource={contributionRanking}
                renderItem={(item, index) => (
                  <List.Item key={item.studentId}>
                    <div style={{ 
                      width: '100%',
                      padding: '12px 0',
                      borderBottom: index < contributionRanking.length - 1 ? '1px solid #f0f0f0' : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        {/* 排名和头像 */}
                        <div style={{ position: 'relative', marginRight: '12px' }}>
                          <Avatar 
                            src={item.avatar} 
                            size={50}
                            icon={<UserOutlined />}
                          />
                          {item.rank <= 3 && (
                            <div style={{
                              position: 'absolute',
                              bottom: -5,
                              right: -5,
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: item.rank === 1 ? '#ffd700' : item.rank === 2 ? '#c0c0c0' : '#cd7f32',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              color: '#fff',
                              fontWeight: 'bold',
                              fontSize: '14px',
                              border: '2px solid #fff'
                            }}>
                              {item.rank}
                            </div>
                          )}
                          {item.rank > 3 && (
                            <div style={{
                              position: 'absolute',
                              bottom: -5,
                              right: -5,
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: '#f0f0f0',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              fontSize: '12px',
                              border: '2px solid #fff'
                            }}>
                              {item.rank}
                            </div>
                          )}
                        </div>
                        
                        {/* 用户信息 */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{item.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                            <Tag color="#108ee9">总贡献: {item.totalPoints} 积分</Tag>
                            <Tag color="#87d068">参与 {item.contributionCount} 次</Tag>
                          </div>
                        </div>
                      </div>
                      
                      {/* 最新贡献记录 */}
                      {item.latestContribution && (
                        <div style={{ 
                          background: '#f9f9f9', 
                          padding: '8px 12px', 
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <Text type="secondary">最近贡献</Text>
                            <Text type="secondary">{formatDateTime(item.latestContribution)}</Text>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ color: '#1890ff', fontWeight: 'bold' }}>
                              +{item.latestPoints} 积分
                            </div>
                            {item.latestMessage && (
                              <div style={{ 
                                maxWidth: '60%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: '#666'
                              }}>
                                "{item.latestMessage}"
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <Text type="secondary">暂无贡献记录</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 参与众筹对话框 */}
      <Modal
        title="参与众筹"
        open={contributionModal}
        onCancel={() => setContributionModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setContributionModal(false)}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={submitLoading} 
            onClick={handleSubmitContribution}
          >
            提交
          </Button>
        ]}
      >
        <div style={{ marginBottom: '15px' }}>
          <Text strong>目标积分: {crowdfunding.targetPoints}</Text>
          <Progress 
            percent={Math.round((crowdfunding.currentPoints / crowdfunding.targetPoints) * 100)} 
            status={crowdfunding.currentPoints >= crowdfunding.targetPoints ? 'success' : 'active'}
            format={() => `${crowdfunding.currentPoints}/${crowdfunding.targetPoints}`}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <Text strong>贡献积分</Text>
          <Input 
            placeholder="请输入您要贡献的积分数量" 
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            style={{ marginTop: '8px', marginBottom: '8px' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <Button size="small" onClick={() => setPoints('100')}>100分</Button>
            <Button size="small" onClick={() => setPoints('150')}>150分</Button>
            <Button size="small" onClick={() => setPoints('200')}>200分</Button>
            <Button size="small" onClick={() => setPoints('300')}>300分</Button>
            <Button size="small" onClick={() => setPoints('500')}>500分</Button>
          </div>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <Text strong>留言(可选)</Text>
          <TextArea 
            placeholder="给众筹活动留言..." 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ marginTop: '8px' }}
            rows={3}
            maxLength={100}
          />
        </div>
      </Modal>
    </div>
  );
};

export default CrowdfundingDetailView; 