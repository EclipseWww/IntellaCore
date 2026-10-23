import React from 'react';
import { Layout, Breadcrumb } from 'antd';
import QuestionAnalysis from '../../components/Quiz/teacher/QuestionAnalysis';
import { HomeOutlined, BarChartOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Content } = Layout;

const QuestionAnalysisPage = () => {
  return (
    <Content style={{ padding: '0 24px', minHeight: 280 }}>
      <Breadcrumb style={{ margin: '16px 0' }}>
        <Breadcrumb.Item>
          <Link to="/teacher">
            <HomeOutlined /> 首页
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to="/teacher/quiz">
            测验管理
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <BarChartOutlined /> 题目分析
        </Breadcrumb.Item>
      </Breadcrumb>
      
      <div className="site-layout-content">
        <QuestionAnalysis />
      </div>
    </Content>
  );
};

export default QuestionAnalysisPage;
