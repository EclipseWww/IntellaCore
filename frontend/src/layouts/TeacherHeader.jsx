import React from 'react';
import { Layout, Button, Space } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';


const { Header } = Layout;

const TeacherHeader = ({ title = '教师工作台', collapsed = false }) => {

  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <Header className={`header teacher-header${collapsed ? ' teacher-header-collapsed' : ''}`} style={{ '--teacher-nav-width': collapsed ? '80px' : '224px' }}>
      <div className="teacher-brand">
        <div className="teacher-brand-identity">
          <img className="teacher-brand-mark" src="/teacher-logo.svg" alt="" />
          <span className="teacher-brand-name">信息科技</span>
        </div>
        <span className="teacher-module-title" aria-live="polite">{title}</span>
      </div>
      <Space>
        <span className="teacher-account"><span className="teacher-avatar"><UserOutlined /></span> {user?.username || '教师'}</span>
        <Button
          type="link"
          icon={<LogoutOutlined />}
          onClick={handleLogout}
        >
          退出登录
        </Button>
      </Space>
    </Header>
  );
};

export default TeacherHeader; 