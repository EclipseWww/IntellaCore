import React, { useState, useEffect } from 'react';
import { Layout, Button, Space, Avatar, Typography, Modal, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PointsDisplay from '../components/shared/PointsDisplay';

const { Header } = Layout;
const { Text, Title } = Typography;

const StudentHeader = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));
  const [clickCount, setClickCount] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [teacherPassword, setTeacherPassword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  // 重置点击计数器的定时器
  useEffect(() => {
    const timer = setTimeout(() => {
      if (clickCount > 0 && clickCount < 3) {
        setClickCount(0);
      }
    }, 3000); // 3秒内未完成3次点击则重置

    return () => clearTimeout(timer);
  }, [clickCount]);

  // 处理标题点击事件
  const handleTitleClick = () => {
    setClickCount(prevCount => {
      const newCount = prevCount + 1;

      // 如果达到3次点击，显示退出对话框
      if (newCount === 3) {
        setModalVisible(true);
        return 0; // 重置计数器
      }

      return newCount;
    });
  };

  // 处理退出登录（先请求后端登出，失败则本地降级）
  const handleLogout = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherPassword })
      });
      if (!response.ok) { const data = await response.json(); message.error(data.message || '退出失败'); return; }
      localStorage.clear();
      message.success('已退出登录');
      navigate('/login');
    } catch { message.error('网络异常，请重试'); }
  };

  // 处理密码输入
  const handlePasswordChange = (e) => {
    setTeacherPassword(e.target.value);
  };

  // 关闭模态框
  const handleCancel = () => {
    setModalVisible(false);
    setTeacherPassword('');
  };

  return (
    <Header
      className="header"
      style={{
        background: 'linear-gradient(135deg, #0052D4 0%, #4364F7 50%, #6FB1FC 100%)', // Deep blue to bright blue gradient
        padding: '0 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        height: 72,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Simple geometric logo shape */}
        <div style={{
          width: 36,
          height: 36,
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <Title
          level={3}
          style={{
            color: '#ffffff',
            margin: 0,
            fontWeight: 700,
            letterSpacing: '1.2px',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
            fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            cursor: 'default', // Keep semantic but no pointer
            fontSize: '24px'
          }}
          onClick={handleTitleClick}
        >
          信息科技学习平台
        </Title>
      </div>

      <Space size={24}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          padding: '6px 16px',
          borderRadius: '50px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
        }}>
          <PointsDisplay size="default" />
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.3)', margin: '0 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Avatar
              size="default"
              icon={<UserOutlined />}
              style={{
                backgroundColor: '#ffffff',
                color: '#4364F7',
                marginRight: 10,
                border: '2px solid rgba(255,255,255,0.8)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            />
            <Text style={{
              color: '#ffffff',
              fontWeight: 500,
              fontSize: '15px',
              textShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              {user?.name || '未知用户'}
            </Text>
          </div>
        </div>
      </Space>

      {/* 教师退出登录模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🔒</span>
            <span>教师验证</span>
          </div>
        }
        open={modalVisible}
        onOk={handleLogout}
        onCancel={handleCancel}
        okText="确认退出"
        cancelText="取消"
        width={320}
        centered
        maskClosable={false}
        styles={{
          mask: { backdropFilter: 'blur(4px)' }
        }}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ marginBottom: 20, color: '#666', fontSize: '15px' }}>请输入教师密码以退出登录</p>
          <input
            type="password"
            value={teacherPassword}
            onChange={handlePasswordChange}
            autoComplete="off"
            style={{
              width: '200px',
              padding: '10px 16px',
              border: '2px solid #e6e6e6',
              borderRadius: '8px',
              fontSize: '16px',
              textAlign: 'center',
              outline: 'none',
              transition: 'all 0.3s',
              letterSpacing: '4px'
            }}
            onFocus={(e) => e.target.style.borderColor = '#4364F7'}
            onBlur={(e) => e.target.style.borderColor = '#e6e6e6'}
            autoFocus
          />
        </div>
      </Modal>
    </Header>
  );
};

export default StudentHeader; 