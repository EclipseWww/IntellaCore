import React from 'react';
import { Layout } from 'antd';
import LessonPlanner from './LessonPlanner';
import QuestionGenerator from './QuestionGenerator';
import ChatInterface from './ChatInterface';

const { Content } = Layout;

/**
 * AI教学助手组件
 * @param {Object} props
 * @param {string} props.mode - 显示模式：'lesson' | 'quiz' | 'chat'
 */
const AiTeachingAssistant = ({ mode = 'lesson' }) => {
  const getContent = () => {
    switch (mode) {
      case 'lesson':
        return <LessonPlanner />;
      case 'quiz':
        return <QuestionGenerator />;
      case 'chat':
        return <ChatInterface />;
      default:
        return <LessonPlanner />;
    }
  };
  
  return (
    <Layout className="ai-teaching-assistant" style={{ background: '#fff' }}>
      <Content style={{ padding: '24px', background: '#fff' }}>
        {getContent()}
      </Content>
    </Layout>
  );
};

export default AiTeachingAssistant; 