import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Card, Select, message, Typography, Divider, Space, Avatar, List, Spin } from 'antd';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

/**
 * AI聊天组件
 * 用于与AI进行对话
 */
const AiChat = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [references, setReferences] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState(null);
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false);
  const [selectedModel, setSelectedModel] = useState('qwen-max');
  const messagesEndRef = useRef(null);

  // 获取知识库列表
  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      setLoadingKnowledgeBases(true);
      try {
        const response = await axios.get('/api/ai-rag/knowledge-bases');
        if (response.data.success) {
          setKnowledgeBases(response.data.data || []);
        } else {
          message.error('获取知识库列表失败');
        }
      } catch (error) {
        console.error('获取知识库列表错误:', error);
        message.error('获取知识库列表失败: ' + (error.response?.data?.message || error.message));
      } finally {
        setLoadingKnowledgeBases(false);
      }
    };

    fetchKnowledgeBases();
  }, []);

  // 滚动到最新消息
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 发送消息
  const sendMessage = async () => {
    if (!message.trim()) return;
    
    const userMessage = message;
    setMessage('');
    
    // 添加用户消息到聊天历史
    const newHistory = [...chatHistory, ['user', userMessage]];
    setChatHistory(newHistory);
    
    setLoading(true);
    
    try {
      const response = await axios.post('/api/ai-rag/chat', {
        message: userMessage,
        history: formatHistoryForApi(newHistory),
        model: selectedModel,
        dbName: selectedKnowledgeBase
      });
      
      if (response.data.success) {
        setChatHistory(formatHistoryFromApi(response.data.data.history));
        setReferences(response.data.data.references || []);
      } else {
        message.error('发送消息失败');
      }
    } catch (error) {
      console.error('发送消息错误:', error);
      message.error('发送消息失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 格式化聊天历史以适应API
  const formatHistoryForApi = (history) => {
    return history.map(([role, content]) => {
      return [content, role === 'assistant' ? content : null];
    });
  };

  // 从API响应中格式化聊天历史
  const formatHistoryFromApi = (history) => {
    return history.map(([userMsg, aiMsg]) => {
      if (aiMsg) {
        return ['assistant', aiMsg];
      } else {
        return ['user', userMsg];
      }
    });
  };

  // 清空聊天历史
  const clearChat = () => {
    setChatHistory([]);
    setReferences([]);
  };

  // 处理按键事件
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="ai-chat">
      <Title level={2}>AI聊天助手</Title>
      <Paragraph>
        与AI进行对话，获取教学相关的帮助和建议。您可以选择知识库以获得更专业的回答。
      </Paragraph>
      
      <div style={{ display: 'flex', marginBottom: 20 }}>
        <Card 
          title="聊天设置" 
          style={{ width: 300, marginRight: 20 }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>选择模型</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                value={selectedModel}
                onChange={setSelectedModel}
              >
                <Option value="qwen-max">通义千问-Max</Option>
                <Option value="qwen-plus">通义千问-Plus</Option>
                <Option value="qwen-turbo">通义千问-Turbo</Option>
              </Select>
            </div>
            
            <Divider style={{ margin: '12px 0' }} />
            
            <div>
              <Text strong>选择知识库</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                placeholder="选择知识库（可选）"
                allowClear
                loading={loadingKnowledgeBases}
                onChange={value => setSelectedKnowledgeBase(value)}
                value={selectedKnowledgeBase}
              >
                {knowledgeBases.map(db => (
                  <Option key={db} value={db}>{db}</Option>
                ))}
              </Select>
            </div>
            
            <Divider style={{ margin: '12px 0' }} />
            
            <Button type="default" onClick={clearChat} block>
              清空聊天记录
            </Button>
          </Space>
        </Card>
        
        <Card 
          title="聊天窗口" 
          style={{ flex: 1 }}
          bodyStyle={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: 500 
          }}
        >
          <div 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '0 10px',
              marginBottom: 10
            }}
          >
            {chatHistory.length === 0 ? (
              <div style={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#999',
                flexDirection: 'column'
              }}>
                <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <Text>开始与AI助手对话吧！</Text>
              </div>
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={chatHistory}
                renderItem={([role, content]) => (
                  <List.Item style={{ 
                    padding: '10px 0',
                    display: 'flex',
                    justifyContent: role === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={{ 
                      maxWidth: '80%',
                      display: 'flex',
                      flexDirection: role === 'user' ? 'row-reverse' : 'row',
                      alignItems: 'flex-start'
                    }}>
                      <Avatar 
                        icon={role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                        style={{ 
                          backgroundColor: role === 'user' ? '#1890ff' : '#52c41a',
                          marginRight: role === 'user' ? 0 : 10,
                          marginLeft: role === 'user' ? 10 : 0
                        }}
                      />
                      <div style={{ 
                        background: role === 'user' ? '#e6f7ff' : '#f6ffed',
                        padding: 10,
                        borderRadius: 8,
                        wordBreak: 'break-word'
                      }}>
                        <ReactMarkdown>{content}</ReactMarkdown>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div style={{ display: 'flex', marginTop: 'auto' }}>
            <TextArea
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息..."
              autoSize={{ minRows: 2, maxRows: 4 }}
              disabled={loading}
              style={{ flex: 1, marginRight: 10 }}
            />
            <Button 
              type="primary" 
              icon={<SendOutlined />} 
              onClick={sendMessage}
              loading={loading}
              disabled={!message.trim()}
            >
              发送
            </Button>
          </div>
        </Card>
      </div>
      
      {references && references.length > 0 && (
        <Card title="参考资料">
          <List
            itemLayout="vertical"
            dataSource={references}
            renderItem={(ref, index) => (
              <List.Item>
                <Text strong>参考片段 {index + 1}:</Text>
                <Paragraph style={{ 
                  background: '#f5f5f5', 
                  padding: 16, 
                  borderRadius: 4,
                  marginTop: 8
                }}>
                  {ref}
                </Paragraph>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default AiChat; 