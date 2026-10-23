import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Typography, Progress, Button, Space, Modal, message, Tooltip } from 'antd';
import { 
  CloseOutlined, 
  ClockCircleOutlined, 
  InfoCircleOutlined, 
  FullscreenOutlined,
  FullscreenExitOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * 游戏容器组件，用于加载和管理游戏
 * @param {Object} props - 组件属性
 * @param {string} props.gameId - 游戏ID
 * @param {string} props.gameName - 游戏名称
 * @param {string} props.gameUrl - 游戏URL
 * @param {number} props.initialTimeRemaining - 初始剩余时间（秒）
 * @param {Function} props.onTimeUpdate - 时间更新回调函数
 * @param {Function} props.onClose - 关闭游戏回调
 * @param {Function} props.onTimeUp - 时间用完回调
 */
const GameContainer = ({ 
  gameId, 
  gameName, 
  gameUrl, 
  initialTimeRemaining = 900, // 默认15分钟（900秒）
  onTimeUpdate,
  onClose, 
  onTimeUp 
}) => {
  // 确保初始时间是一个有效的数字
  const validInitialTime = typeof initialTimeRemaining === 'number' && !isNaN(initialTimeRemaining) && initialTimeRemaining > 0 
    ? initialTimeRemaining 
    : 900;
  
  const [timeRemaining, setTimeRemaining] = useState(validInitialTime);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const timerRef = useRef(null);
  const containerRef = useRef(null);
  
  // 获取总时间（用于计算进度）
  const totalTime = 15 * 60; // 假设总时间为15分钟
  
  // 处理时间更新的回调
  const handleTimeUpdate = useCallback((newTime) => {
    if (onTimeUpdate && typeof newTime === 'number' && !isNaN(newTime) && newTime >= 0) {
      onTimeUpdate(newTime);
    }
  }, [onTimeUpdate]);
  
  // 时间用完处理
  const handleTimeUp = useCallback(() => {
    if (onTimeUp) {
      onTimeUp();
    }
  }, [onTimeUp]);
  
  // 组件挂载时初始化时间
  useEffect(() => {
    setTimeRemaining(validInitialTime);
  }, [validInitialTime]);
  
  // 倒计时
  useEffect(() => {
    // 清除之前的计时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // 检查时间是否已用完
    if (timeRemaining <= 0) {
      handleTimeUp();
      return;
    }
    
    // 当剩余时间为60秒时显示警告
    if (timeRemaining === 60) {
      setShowTimeoutWarning(true);
    }
    
    // 启动倒计时
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        // 确保有效时间值
        if (typeof prev !== 'number' || isNaN(prev) || prev <= 0) {
          clearInterval(timerRef.current);
          handleTimeUp();
          return 0;
        }
        
        const newTime = prev - 1;
        
        // 更新父组件时间
        handleTimeUpdate(newTime);
        
        // 检查时间是否剩余一分钟
        if (newTime === 60) {
          setShowTimeoutWarning(true);
        }
        
        // 检查时间是否用完
        if (newTime <= 0) {
          clearInterval(timerRef.current);
          setTimeout(() => handleTimeUp(), 0);
        }
        
        return newTime;
      });
    }, 1000);
    
    // 组件卸载时清除计时器
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [handleTimeUpdate, handleTimeUp]);
  
  // 格式化剩余时间
  const formatTimeRemaining = () => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // 计算进度百分比
  const getProgressPercent = () => {
    return Math.floor((timeRemaining / totalTime) * 100);
  };
  
  // 关闭时间警告
  const handleCloseTimeoutWarning = () => {
    setShowTimeoutWarning(false);
  };
  
  // 切换全屏模式
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
          .then(() => setIsFullScreen(true))
          .catch(err => message.error('全屏模式出错'));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
          .then(() => setIsFullScreen(false))
          .catch(err => message.error('退出全屏模式出错'));
      }
    }
  };
  
  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  // 获取倒计时颜色
  const getTimerColor = () => {
    if (timeRemaining <= 60) return '#ff4d4f'; // 红色：少于1分钟
    if (timeRemaining <= 300) return '#faad14'; // 黄色：少于5分钟
    return 'white'; // 正常颜色
  };
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 0 20px rgba(0,0,0,0.3)'
      }}
    >
      {/* 顶部控制栏 */}
      <div style={{ 
        padding: '10px 20px',
        background: 'linear-gradient(90deg, #1890ff, #096dd9)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <PlayCircleOutlined style={{ fontSize: 24, marginRight: 12 }} />
          <Title level={4} style={{ color: 'white', margin: 0 }}>{gameName}</Title>
        </div>
        
        <Space size="middle">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: 'rgba(255,255,255,0.1)', 
            padding: '4px 12px', 
            borderRadius: '30px' 
          }}>
            <ClockCircleOutlined style={{ marginRight: 8 }} />
            <Text style={{ 
              color: getTimerColor(), 
              fontWeight: 'bold',
              fontSize: '16px',
              transition: 'color 0.3s ease' 
            }}>
              {formatTimeRemaining()}
            </Text>
          </div>
          
          <Tooltip title={isFullScreen ? "退出全屏" : "全屏模式"}>
            <Button 
              type="text" 
              icon={isFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullScreen}
              style={{ color: 'white' }}
            />
          </Tooltip>
          
          <Tooltip title="关闭游戏">
            <Button 
              type="text" 
              icon={<CloseOutlined />} 
              onClick={onClose}
              style={{ color: 'white' }}
            />
          </Tooltip>
        </Space>
      </div>
      
      {/* 进度条 */}
      <Progress 
        percent={getProgressPercent()} 
        showInfo={false} 
        status={timeRemaining < 60 ? "exception" : timeRemaining < 300 ? "warning" : "active"} 
        strokeWidth={4}
        style={{ margin: 0 }}
        strokeColor={{
          from: timeRemaining < 60 ? '#ff4d4f' : timeRemaining < 300 ? '#faad14' : '#1890ff',
          to: timeRemaining < 60 ? '#ff7875' : timeRemaining < 300 ? '#ffc53d' : '#69c0ff',
        }}
      />
      
      {/* 游戏内容 */}
      <div style={{ 
        flex: 1, 
        position: 'relative',
        padding: '2px', // 添加一点内边距
        background: '#f0f2f5', // 背景色
        transition: 'all 0.3s ease'
      }}>
        <iframe 
          src={gameUrl} 
          title={gameName}
          style={{ 
            width: '100%', 
            height: '100%', 
            border: 'none',
            backgroundColor: 'white',
            borderRadius: '4px', // 圆角
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' // 内阴影
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      
      {/* 时间警告模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', color: '#ff4d4f' }}>
            <InfoCircleOutlined style={{ fontSize: 24, marginRight: 12 }} />
            <span>时间即将结束</span>
          </div>
        }
        open={showTimeoutWarning}
        onOk={handleCloseTimeoutWarning}
        onCancel={handleCloseTimeoutWarning}
        centered
        closable={false}
        maskClosable={false}
        bodyStyle={{ padding: '24px' }}
        footer={[
          <Button 
            key="ok" 
            type="primary" 
            danger 
            onClick={handleCloseTimeoutWarning}
            style={{ borderRadius: '4px', fontWeight: 'bold' }}
          >
            知道了
          </Button>
        ]}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          padding: '12px',
          background: '#fff2f0',
          borderRadius: '4px',
          border: '1px solid #ffccc7'
        }}>
          <Text style={{ fontSize: '16px' }}>
            游戏时间还剩不到1分钟，请尽快完成游戏！
          </Text>
        </div>
      </Modal>
    </div>
  );
};

export default GameContainer; 