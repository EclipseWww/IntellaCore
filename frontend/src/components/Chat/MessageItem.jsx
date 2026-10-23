import React, { useState } from 'react';
import { Card, Tag, Typography, Space, Avatar, Button, Divider, Tooltip, Badge, Row, Col } from 'antd';
import { UserOutlined, RobotOutlined, SettingOutlined, ClockCircleOutlined, TagOutlined, CodeOutlined, InfoCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, CommentOutlined, BookOutlined } from '@ant-design/icons';
import MarkdownRenderer from '../shared/MarkdownRenderer';

const { Text, Paragraph } = Typography;

// Add CSS keyframes for cursor blinking
const style = document.createElement('style');
style.textContent = `
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  .cursor {
    display: inline-block;
    width: 2px;
    height: 1.2em;
    background-color: #1890ff;
    vertical-align: text-bottom;
    animation: blink 1s step-end infinite;
    margin-left: 1px;
  }
  
  .message-card {
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
  }
  .message-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .user-message {
    border-left: 3px solid #1890ff;
  }
  .ai-message {
    border-left: 3px solid #52c41a;
  }
  .system-message {
    border-left: 3px solid #722ed1;
  }
  .message-type-badge {
    position: absolute;
    top: -8px;
    right: 16px;
  }
  .message-content {
    padding: 8px 0;
  }
  .timestamp {
    display: flex;
    align-items: center;
    margin-top: 6px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }
  .action-buttons {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
  }
  .course-tag {
    font-size: 12px;
    padding: 2px 6px;
    margin-left: 8px;
    border-radius: 4px;
    background: #f0f5ff;
    color: #1890ff;
    border: 1px solid #d6e4ff;
  }
  .course-badge {
    background: #1890ff;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
    margin-left: 10px;
    box-shadow: 0 2px 5px rgba(24, 144, 255, 0.3);
  }
`;
document.head.appendChild(style);

const MessageItem = ({ message = {}, currentResponse, onApprove, onReject, showActions, reviewEnabled }) => {
  const [showSystemDetails, setShowSystemDetails] = useState(false);
  
  const getStatusTag = (status) => {
    // 检查状态是否为有效字符串
    if (typeof status !== 'string' || status.trim() === '') {
      return <Tag color="default">未知状态</Tag>;
    }

    const statusConfig = {
      pending: { color: 'warning', text: '待审核', icon: <ClockCircleOutlined /> },
      approved: { color: 'success', text: '已通过', icon: <CheckCircleOutlined /> },
      rejected: { color: 'error', text: '已拒绝', icon: <CloseCircleOutlined /> }
    };
    
    const config = statusConfig[status.toLowerCase()] || { color: 'default', text: '未知状态', icon: <InfoCircleOutlined /> };
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 判断是否应该显示 AI 回复
  const shouldShowAIResponse = () => {
    // 如果有实时响应，总是显示
    if (currentResponse) return true;
    
    // 如果是待审核消息，总是显示 AI 回复
    if (message.status === 'pending') return true;
    
    // 如果是在审核历史页面（showActions === false），显示所有消息的 AI 回复
    if (showActions === false) return true;
    
    // 如果审核功能开启，只显示已通过审核的 AI 回复
    if (reviewEnabled) {
      return message.status === 'approved';
    }
    
    // 如果审核功能关闭，显示所有 AI 回复
    return true;
  };

  // 确保消息中有对话数组
  if (!message.conversations || !Array.isArray(message.conversations)) {
    return <Card size="small">数据格式错误，无法显示消息</Card>;
  }

  // 找出系统提示（如果存在）
  const systemMessages = message.conversations.filter(msg => msg.role === 'system');
  const userAndAiMessages = message.conversations.filter(msg => msg.role !== 'system');
  
  // 获取学生姓名
  const getStudentName = () => {
    if (message.student) {
      if (typeof message.student === 'object') {
        // 如果student是对象，优先使用name，否则使用username
        return message.student.name || message.student.username || '学生';
      } else {
        // 如果是字符串ID，只显示"学生"
        return '学生';
      }
    }
    return '学生'; // 默认显示
  };
  
  const studentName = getStudentName();
  
  // 格式化时间显示
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', { 
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit'
    });
  };
  
  // 获取消息类型
  const isCourseQuestion = message.type === 'course';
  
  // 获取课程信息标签
  const getCourseTag = () => {
    if (message.courseId) {
      const courseName = message.courseId.title || '未知课程';
      return (
        <span className="course-tag">
          <TagOutlined /> {courseName}
        </span>
      );
    }
    return null;
  };
  
  return (
    <div style={{ marginBottom: 24, position: 'relative' }}>
      {/* 消息元信息 */}
      <Row 
        style={{ 
          marginBottom: 8, 
          padding: '0 8px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Col>
          <Space align="center">
            {getStatusTag(message.status)}
            {getCourseTag()}
            {isCourseQuestion && (
              <span className="course-badge">
                <BookOutlined /> 课程问答
              </span>
            )}
            <Text type="secondary" style={{ fontSize: '13px' }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {formatTime(message.createdAt)}
            </Text>
          </Space>
        </Col>
        <Col>
          {systemMessages.length > 0 && (
            <Button 
              type="link" 
              size="small"
              icon={<SettingOutlined />} 
              onClick={() => setShowSystemDetails(!showSystemDetails)}
            >
              {showSystemDetails ? '隐藏系统提示' : '显示系统提示'}
            </Button>
          )}
        </Col>
      </Row>
      
      {/* 系统提示 */}
      {systemMessages.length > 0 && showSystemDetails && (
        <Card 
          size="small" 
          className="message-card system-message"
          style={{ 
            marginBottom: 12, 
            background: '#f9f0ff', 
            borderColor: '#efdbff'
          }}
        >
          <div style={{ padding: '4px 0' }}>
            <MarkdownRenderer content={systemMessages[0].content} />
          </div>
        </Card>
      )}
      
      {/* 对话消息 */}
      <div style={{ marginBottom: 16 }}>
        {userAndAiMessages.map((msg, index) => (
          <div key={index} style={{ position: 'relative' }}>
            {msg.role === 'user' ? (
              // 用户消息
              <Card 
                size="small" 
                className="message-card user-message"
                style={{ 
                  marginBottom: 12, 
                  background: '#f8f9ff'
                }}
              >
                <Space align="start" style={{ width: '100%' }}>
                  <Avatar 
                    icon={<UserOutlined />} 
                    style={{ 
                      background: 'linear-gradient(135deg, #1890ff, #096dd9)',
                      boxShadow: '0 2px 5px rgba(24, 144, 255, 0.3)'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <Space>
                      <Text strong>{studentName}</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {formatTime(msg.timestamp || message.createdAt)}
                      </Text>
                    </Space>
                    <div className="message-content">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  </div>
                </Space>
              </Card>
            ) : msg.role === 'assistant' ? (
              // AI回复
              <Card 
                size="small" 
                className="message-card ai-message"
                style={{ 
                  marginLeft: 16,
                  marginBottom: 12, 
                  background: '#f6ffed',
                  borderColor: '#d9f7be'
                }}
              >
                <Space align="start" style={{ width: '100%' }}>
                  <Avatar 
                    icon={<RobotOutlined />} 
                    style={{ 
                      background: 'linear-gradient(135deg, #52c41a, #389e0d)',
                      boxShadow: '0 2px 5px rgba(82, 196, 26, 0.3)'
                    }} 
                  />
                  <div style={{ flex: 1 }}>
                    <Space>
                      <Text strong>AI助手</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {formatTime(msg.timestamp || message.createdAt)}
                      </Text>
                    </Space>
                    <div className="message-content">
                      {index === userAndAiMessages.length - 1 && currentResponse ? (
                        <MarkdownRenderer content={currentResponse + '<span class="cursor"> </span>'} />
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )}
                    </div>
                    {Array.isArray(msg.suggestedQuestions) && msg.suggestedQuestions.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>AI 建议的下一步提问：</Text>
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {msg.suggestedQuestions.map((q, qi) => (
                            <Tag key={qi} color="blue" style={{ display: 'inline-block', width: 'fit-content', whiteSpace: 'normal' }}>
                              {q}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Space>
              </Card>
            ) : null}
          </div>
        ))}
      </div>
      
      {/* 审核操作区 */}
      {showActions && message.status === 'pending' && (
        <div className="action-buttons">
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => onApprove(message._id)}
              style={{ marginRight: 8, background: '#52c41a', borderColor: '#52c41a' }}
            >
              通过
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={() => onReject(message._id)}
            >
              拒绝
            </Button>
          </Space>
        </div>
      )}
      
      {/* 审核意见展示 */}
      {message.reviewComment && (
        <div style={{ marginTop: 8, background: '#fffbe6', padding: '8px 12px', borderRadius: 4, borderLeft: '3px solid #ffd666' }}>
          <Text type="warning">
            <CommentOutlined style={{ marginRight: 4 }} />
            审核意见: {message.reviewComment}
          </Text>
        </div>
      )}
    </div>
  );
};

export default MessageItem;