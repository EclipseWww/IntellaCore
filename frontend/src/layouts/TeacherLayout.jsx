import React from 'react';
import { Layout, Menu } from 'antd';
import { Outlet } from 'react-router-dom';
import { BookOutlined } from '@ant-design/icons';

const { Header, Content } = Layout;

const TeacherLayout = () => {
  return (
    <Layout>
      <Header style={{ background: '#fff', padding: 0 }}>
        <Menu mode="horizontal" defaultSelectedKeys={['courses']}>
          <Menu.Item key="courses" icon={<BookOutlined />}>
            课程管理
          </Menu.Item>
        </Menu>
      </Header>
      <Content style={{ padding: '0 50px', minHeight: 'calc(100vh - 64px)' }}>
        <Outlet />
      </Content>
    </Layout>
  );
};

export default TeacherLayout;
