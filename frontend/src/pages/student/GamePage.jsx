import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Empty, List, Tag, Modal, message } from 'antd';
import { ClockCircleOutlined, TrophyOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import { getRedemptionRecords, updateGameRecord } from '../../services/pointShopService';
import GameContainer from '../../components/games/GameContainer';

const { Title, Text, Paragraph } = Typography;

const GamePage = () => {
  usePageTitle('我的游戏');
  
  const navigate = useNavigate();
  const { recordId } = useParams();
  
  const [gameRecords, setGameRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);

  // 加载已兑换的游戏记录
  useEffect(() => {
    const fetchGameRecords = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await getRedemptionRecords();
        if (response.success) {
          // 只筛选类型为"game"的记录
          const gameRecords = response.records.filter(record => 
            record.itemType === 'game' && record.status === 'pending'
          );
          setGameRecords(gameRecords);
          
          // 如果URL中有recordId参数，直接启动该游戏
          if (recordId) {
            const gameToStart = gameRecords.find(game => game._id === recordId);
            if (gameToStart) {
              setSelectedGame(gameToStart);
              setShowConfirmModal(true);
            }
          }
        } else {
          setError('获取游戏记录失败');
        }
      } catch (err) {
        console.error('加载游戏记录失败:', err);
        setError('加载游戏记录失败，请稍后再试');
      } finally {
        setLoading(false);
      }
    };
    
    fetchGameRecords();
  }, [recordId]);

  // 启动游戏
  const handleStartGame = async () => {
    if (!selectedGame) return;
    
    try {
      // 关闭确认对话框
      setShowConfirmModal(false);
      
      // 设置活动游戏
      setActiveGame(selectedGame);
      
      // 可以在这里记录游戏开始时间等信息
      console.log('游戏开始:', selectedGame.itemName);
    } catch (err) {
      console.error('启动游戏失败:', err);
      message.error('启动游戏失败，请稍后再试');
    }
  };

  // 处理游戏结束
  const handleGameEnd = async () => {
    if (!activeGame) return;
    
    try {
      // 更新游戏记录为已完成
      const response = await updateGameRecord(activeGame._id);
      if (response.success) {
        message.success('游戏时间已用完，记录已更新');
        
        // 更新本地游戏记录列表
        setGameRecords(prev => 
          prev.filter(record => record._id !== activeGame._id)
        );
      } else {
        message.error('更新游戏记录失败');
      }
    } catch (err) {
      console.error('更新游戏记录失败:', err);
      message.error('更新游戏记录失败，请稍后再试');
    } finally {
      // 关闭游戏
      setActiveGame(null);
    }
  };

  // 处理手动关闭游戏
  const handleCloseGame = () => {
    Modal.confirm({
      title: '确认关闭游戏',
      content: '关闭游戏将消耗您的游戏时间，确定要关闭吗？',
      onOk: handleGameEnd,
      okText: '确认',
      cancelText: '取消'
    });
  };

  // 打开游戏确认对话框
  const handleOpenGameConfirm = (game) => {
    setSelectedGame(game);
    setShowConfirmModal(true);
  };

  // 如果正在加载中
  if (loading && gameRecords.length === 0) {
    return <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div>;
  }

  // 如果有活动游戏，显示游戏界面
  if (activeGame) {
    return (
      <GameContainer 
        gameId={activeGame._id}
        gameName={activeGame.itemName}
        gameUrl={`/games/${getGamePathFromName(activeGame.itemName)}/index.html`}
        timeLimit={15} // 默认15分钟游戏时间限制
        onClose={handleCloseGame}
        onTimeUp={handleGameEnd}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
      <Title level={2}>我的游戏</Title>
      
      {error && (
        <Paragraph type="danger" style={{ marginBottom: 16 }}>
          错误: {error}
        </Paragraph>
      )}
      
      {gameRecords.length > 0 ? (
        <List
          grid={{ 
            gutter: 16, 
            xs: 1, 
            sm: 2, 
            md: 3, 
            lg: 3, 
            xl: 4, 
            xxl: 4 
          }}
          dataSource={gameRecords}
          renderItem={game => (
            <List.Item>
              <Card
                hoverable
                cover={
                  <div style={{ 
                    height: 140, 
                    background: '#1890ff', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    color: 'white',
                    fontSize: 24
                  }}>
                    <TrophyOutlined style={{ fontSize: 48 }} />
                  </div>
                }
                actions={[
                  <Button 
                    type="primary" 
                    onClick={() => handleOpenGameConfirm(game)}
                  >
                    开始游戏
                  </Button>
                ]}
              >
                <Card.Meta
                  title={game.itemName}
                  description={
                    <div>
                      <Tag color="blue" icon={<ClockCircleOutlined />}>
                        15分钟
                      </Tag>
                      <Tag color="green" icon={<InfoCircleOutlined />}>
                        待使用
                      </Tag>
                    </div>
                  }
                />
              </Card>
            </List.Item>
          )}
        />
      ) : (
        <Empty
          description="暂无可用游戏，请前往积分商店兑换"
          style={{ margin: '40px 0' }}
        >
          <Button type="primary" onClick={() => navigate('/student/point-shop')}>
            前往积分商店
          </Button>
        </Empty>
      )}
      
      {/* 游戏确认对话框 */}
      <Modal
        title="开始游戏"
        open={showConfirmModal}
        onOk={handleStartGame}
        onCancel={() => setShowConfirmModal(false)}
        okText="开始"
        cancelText="取消"
      >
        {selectedGame && (
          <>
            <Paragraph>
              您即将开始 <Text strong>{selectedGame.itemName}</Text>
            </Paragraph>
            <Paragraph>
              <InfoCircleOutlined /> 游戏时间限制为 <Text strong>15分钟</Text>，时间结束后游戏将自动关闭。
            </Paragraph>
          </>
        )}
      </Modal>
    </div>
  );
};

// 根据游戏名称获取对应的路径
function getGamePathFromName(name) {
  // 简单处理：将游戏名称转换为小写，并替换空格为连字符
  const simpleName = name.toLowerCase().trim();
  
  if (simpleName.includes('贪吃蛇')) {
    return 'snake';
  } else if (simpleName.includes('记忆') || simpleName.includes('配对')) {
    return 'memory';
  } else if (simpleName.includes('恐龙') || simpleName.includes('chrome')) {
    return 'dino';
  } else {
    // 默认使用snake游戏
    return 'snake';
  }
}

export default GamePage; 