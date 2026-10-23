import React from 'react';
import { Layout } from 'antd';
import Router from './router';
import './App.css';


const { Content } = Layout;

function App() {
  return (
    <Layout className="layout">
      <Content>
        <Router />
      </Content>
    </Layout>
  );
}

export default App;