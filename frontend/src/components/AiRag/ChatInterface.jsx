import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Card, Select, Spin, message as antdMessage, Typography, Divider, Space, List, Avatar, Collapse, Row, Col, Slider, InputNumber } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { aiRagAPI } from '../../services/api';


const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

/**
 * AI聊天界面组件
 * 用于与AI进行对话交流
 */
const ChatInterface = () => {
  const [userMessage, setUserMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState(null);
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamingReferences, setStreamingReferences] = useState([]);
  const [currentMessageId, setCurrentMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  
  // 模型设置
  const [selectedModel, setSelectedModel] = useState('qwen-max');
  const [temperature, setTemperature] = useState(0.85);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [topP, setTopP] = useState(3);
  
  // RAG参数设置
  const [chunkCount, setChunkCount] = useState(5);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.2);

  // 获取知识库列表
  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      setLoadingKnowledgeBases(true);
      try {
        const response = await aiRagAPI.getKnowledgeBases();
        if (response.success) {
          setKnowledgeBases(response.data || []);
          if (response.data && response.data.length > 0) {
            setSelectedKnowledgeBase(response.data[0]);
          }
        } else {
          antdMessage.error('获取知识库列表失败');
        }
      } catch (error) {
        console.error('获取知识库列表错误:', error);
        antdMessage.error('获取知识库列表失败: ' + (error.response?.data?.message || error.message));
      } finally {
        setLoadingKnowledgeBases(false);
      }
    };

    fetchKnowledgeBases();
  }, []);

  // 清理事件源
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // 滚动到最新消息
  useEffect(() => {
    // 只在新消息添加到历史记录时滚动到底部，而不是在流式更新时
    if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // 单独处理发送消息后的滚动
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 保存流式消息到聊天历史
  const saveStreamingMessageToHistory = () => {
    if (streamingMessage) {
      // 更新现有聊天历史中的消息，而不是添加新消息
      setChatHistory(prev => {
        // 查找是否已经有一个带有当前消息ID的助手消息
        const messageIndex = prev.findIndex(
          msg => msg.messageId === currentMessageId && msg.role === 'assistant'
        );
        
        if (messageIndex >= 0) {
          // 如果找到，更新它
          const updatedHistory = [...prev];
          updatedHistory[messageIndex] = {
            ...updatedHistory[messageIndex],
            content: streamingMessage,
            references: streamingReferences,
            isComplete: true
          };
          return updatedHistory;
        } else {
          // 如果没有找到，添加新消息
          return [
            ...prev,
            {
              role: 'assistant',
              content: streamingMessage,
              references: streamingReferences,
              messageId: currentMessageId,
              isComplete: true
            }
          ];
        }
      });
    }
  };

  // 发送消息（流式传输）
  const sendMessage = async () => {
    if (!userMessage.trim()) return;
    if (!selectedKnowledgeBase) {
      antdMessage.warning('请先选择知识库');
      return;
    }

    // 保存当前的流式消息到聊天历史（如果有）
    saveStreamingMessageToHistory();

    // 为新消息生成唯一ID
    const newMessageId = Date.now().toString();
    setCurrentMessageId(newMessageId);
    
    // 添加用户消息到聊天历史
    const newUserMessage = { 
      role: 'user', 
      content: userMessage,
      messageId: `user-${newMessageId}`
    };
    setChatHistory(prev => [...prev, newUserMessage]);
    setUserMessage('');
    setLoading(true);
    setStreamingMessage(''); // 清空流式消息
    setStreamingReferences([]); // 清空参考资料

    // 关闭之前的事件源
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // 创建聊天历史副本，排除尚未完成的AI回复
      const completeHistory = chatHistory.filter(msg => msg.isComplete !== false);
      
      // 创建请求体
      const requestBody = {
        message: userMessage.trim(),
        dbName: selectedKnowledgeBase,
        history: completeHistory,
        model: selectedModel,
        temperature: temperature,
        max_tokens: maxTokens,
        top_p: topP,
        chunk_count: chunkCount,
        similarity_threshold: similarityThreshold
      };

      // 添加一个待处理的AI回复占位符到聊天历史
      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          messageId: newMessageId,
          isComplete: false
        }
      ]);
      
      // 滚动到底部
      setTimeout(scrollToBottom, 100);

      // 使用 chatStream 方法
      const eventSource = aiRagAPI.chatStream(
        requestBody,
        // 消息回调
        (content) => {
          if (Array.isArray(content) && content.length >= 2) {
            // 获取最新的历史记录和知识库引用
            const history = content[0];
            const chunkShow = content[1];
            
            // 如果有历史记录，获取最后一条AI回复
            if (Array.isArray(history) && history.length > 0) {
              const lastItem = history[history.length - 1];
              if (Array.isArray(lastItem) && lastItem.length >= 2 && lastItem[1]) {
                setStreamingMessage(lastItem[1]);
                
                // 实时更新聊天历史中的助手消息
                setChatHistory(prev => {
                  const updatedHistory = [...prev];
                  const assistantIndex = updatedHistory.findIndex(
                    msg => msg.messageId === newMessageId && msg.role === 'assistant'
                  );
                  
                  if (assistantIndex >= 0) {
                    updatedHistory[assistantIndex] = {
                      ...updatedHistory[assistantIndex],
                      content: lastItem[1]
                    };
                  }
                  return updatedHistory;
                });
              }
            }
            
            // 更新知识库引用
            if (Array.isArray(chunkShow) && chunkShow.length > 0) {
              const formattedRefs = chunkShow.map(chunk => {
                return `${chunk.title || '未知来源'}: ${chunk.content?.substring(0, 100)}${chunk.content?.length > 100 ? '...' : ''} (相似度: ${chunk.score?.toFixed(2) || 'N/A'})`;
              });
              setStreamingReferences(formattedRefs);
              
              // 实时更新聊天历史中的参考资料
              setChatHistory(prev => {
                const updatedHistory = [...prev];
                const assistantIndex = updatedHistory.findIndex(
                  msg => msg.messageId === newMessageId && msg.role === 'assistant'
                );
                
                if (assistantIndex >= 0) {
                  updatedHistory[assistantIndex] = {
                    ...updatedHistory[assistantIndex],
                    references: formattedRefs
                  };
                }
                return updatedHistory;
              });
            }
          }
        },
        // 错误回调
        (error) => {
          console.error('流式传输错误:', error);
          antdMessage.error('接收消息失败: ' + (error.error || '未知错误'));
          
          // 更新错误状态到聊天历史
          setChatHistory(prev => {
            const updatedHistory = [...prev];
            const assistantIndex = updatedHistory.findIndex(
              msg => msg.messageId === newMessageId && msg.role === 'assistant'
            );
            
            if (assistantIndex >= 0) {
              updatedHistory[assistantIndex] = {
                role: 'system',
                content: '消息接收失败，请重试。',
                messageId: newMessageId,
                isComplete: true
              };
            } else {
              updatedHistory.push({
                role: 'system',
                content: '消息接收失败，请重试。',
                messageId: newMessageId,
                isComplete: true
              });
            }
            return updatedHistory;
          });
          
          setLoading(false);
        },
        // 完成回调
        (data) => {
          console.log('流式传输完成:', data);
          
          // 标记消息为完成状态
          setChatHistory(prev => {
            const updatedHistory = [...prev];
            const assistantIndex = updatedHistory.findIndex(
              msg => msg.messageId === newMessageId && msg.role === 'assistant'
            );
            
            if (assistantIndex >= 0) {
              updatedHistory[assistantIndex] = {
                ...updatedHistory[assistantIndex],
                isComplete: true
              };
            }
            return updatedHistory;
          });
          
          setLoading(false);
          
          // 在AI回复完成后滚动到底部
          setTimeout(scrollToBottom, 100);
        }
      );
      
      // 保存事件源引用
      eventSourceRef.current = eventSource;

    } catch (error) {
      console.error('发送消息错误:', error);
      antdMessage.error('发送消息失败: ' + (error.response?.data?.message || error.message));
      
      // 添加错误消息到聊天历史
      setChatHistory(prev => {
        const updatedHistory = [...prev];
        const assistantIndex = updatedHistory.findIndex(
          msg => msg.messageId === newMessageId && msg.role === 'assistant'
        );
        
        if (assistantIndex >= 0) {
          updatedHistory[assistantIndex] = {
            role: 'system',
            content: '消息发送失败，请重试。',
            messageId: newMessageId,
            isComplete: true
          };
        } else {
          updatedHistory.push({
            role: 'system',
            content: '消息发送失败，请重试。',
            messageId: newMessageId,
            isComplete: true
          });
        }
        return updatedHistory;
      });
      
      setLoading(false);
    }
  };

  // 处理按键事件，按Enter发送消息
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 清空聊天历史
  const clearChat = () => {
    setChatHistory([]);
    setStreamingMessage('');
    setStreamingReferences([]);
    setCurrentMessageId(null);
    // 关闭事件源
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setLoading(false);
  };

  // 渲染参考资料
  const renderReferences = (refs, messageId) => {
    if (!refs || refs.length === 0) return null;
    
    return (
      <div style={{ marginTop: 10 }}>
        <Collapse 
          ghost
          expandIconPosition="end"
          style={{ 
            backgroundColor: '#f5f5f5',
            borderRadius: 4,
            padding: '4px 0'
          }}
        >
          <Collapse.Panel 
            header={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Text><InfoCircleOutlined style={{ marginRight: 8 }} /> 找到了 {refs.length} 篇相关文档：</Text>
              </div>
            }
            key="references"
          >
            <List
              size="small"
              dataSource={refs}
              renderItem={(ref, index) => (
                <List.Item style={{ padding: '4px 0', border: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <Text style={{ marginRight: 8, color: '#1890ff', minWidth: '16px' }}>{index + 1}</Text>
                    <Text style={{ color: '#595959' }}>{ref}</Text>
                  </div>
                </List.Item>
              )}
              style={{ 
                maxHeight: '200px',
                overflowY: 'auto',
                paddingLeft: 8
              }}
            />
          </Collapse.Panel>
        </Collapse>
      </div>
    );
  };

  return (
    <Row gutter={16}>
      <Col span={16}>
        <Card title="AI教学助手" style={{ marginBottom: 20 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button onClick={clearChat} disabled={loading} size="small">
                清空对话
              </Button>
            </div>

            <div style={{ height: 500, overflowY: 'auto', padding: '0 10px', marginBottom: 16, border: '1px solid #f0f0f0', borderRadius: 4 }}>
              {chatHistory.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', marginTop: 150 }}>
                  <RobotOutlined style={{ fontSize: 48 }} />
                  <p>开始与AI助手对话吧！</p>
                </div>
              ) : (
                <>
                  {/* 仅渲染聊天历史 */}
                  {chatHistory.map((msg, index) => (
                    <div 
                      key={`${msg.messageId}-${index}`} 
                      style={{ 
                        marginBottom: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'flex-start',
                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                      }}>
                        <Avatar 
                          icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />} 
                          style={{ 
                            backgroundColor: msg.role === 'user' ? '#1890ff' : '#52c41a',
                            marginRight: msg.role === 'user' ? 0 : 8,
                            marginLeft: msg.role === 'user' ? 8 : 0
                          }} 
                        />
                        <div style={{ 
                          maxWidth: '80%',
                          padding: '10px 14px',
                          borderRadius: 8,
                          backgroundColor: msg.role === 'user' ? '#e6f7ff' : '#f6ffed',
                          border: `1px solid ${msg.role === 'user' ? '#91d5ff' : '#b7eb8f'}`
                        }}>
                          {msg.role === 'system' ? (
                            <Text type="danger">{msg.content}</Text>
                          ) : (
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          )}
                          {msg.role === 'assistant' && msg.references && msg.references.length > 0 && 
                            renderReferences(msg.references, msg.messageId)}
                          {msg.role === 'assistant' && !msg.isComplete && (
                            <div style={{ marginTop: 8 }}>
                              <Spin size="small" /> <Text type="secondary">正在思考...</Text>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ display: 'flex', marginTop: 16 }}>
              <TextArea
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入您的问题..."
                autoSize={{ minRows: 2, maxRows: 6 }}
                disabled={loading}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button 
                type="primary" 
                icon={<SendOutlined />} 
                onClick={sendMessage} 
                loading={loading}
                disabled={!userMessage.trim() || !selectedKnowledgeBase || loading}
              >
                发送
              </Button>
            </div>
          </Space>
        </Card>
      </Col>
      
      <Col span={8}>
        {/* 知识库选择 */}
        <Card 
          title="加载知识库" 
          style={{ marginBottom: 16 }}
          size="small"
        >
          <Select
            loading={loadingKnowledgeBases}
            style={{ width: '100%' }}
            value={selectedKnowledgeBase}
            onChange={setSelectedKnowledgeBase}
            placeholder="选择知识库"
            disabled={loading}
          >
            {knowledgeBases.map(kb => (
              <Option key={kb} value={kb}>{kb}</Option>
            ))}
          </Select>
        </Card>
        
        {/* 模型设置 */}
        <Collapse 
          defaultActiveKey={['model']} 
          style={{ marginBottom: 16 }}
          bordered
          size="small"
        >
          <Collapse.Panel header="模型设置" key="model">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text>选择模型</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={selectedModel}
                  onChange={setSelectedModel}
                >
                  <Option value="qwen-max">qwen-max</Option>
                  <Option value="qwen-plus">qwen-plus</Option>
                  <Option value="qwen-turbo">qwen-turbo</Option>
                </Select>
              </div>
              
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>温度参数</Text>
                  <InputNumber
                    min={0}
                    max={1}
                    step={0.01}
                    value={temperature}
                    onChange={setTemperature}
                    style={{ width: 70 }}
                  />
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={temperature}
                  onChange={setTemperature}
                />
              </div>
              
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>最大回复长度</Text>
                  <InputNumber
                    min={100}
                    max={4000}
                    step={1}
                    value={maxTokens}
                    onChange={setMaxTokens}
                    style={{ width: 70 }}
                  />
                </div>
                <Slider
                  min={100}
                  max={4000}
                  step={1}
                  value={maxTokens}
                  onChange={setMaxTokens}
                />
              </div>
              
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>携带上下文轮数</Text>
                  <InputNumber
                    min={1}
                    max={10}
                    step={1}
                    value={topP}
                    onChange={setTopP}
                    style={{ width: 70 }}
                  />
                </div>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={topP}
                  onChange={setTopP}
                />
              </div>
            </Space>
          </Collapse.Panel>
        </Collapse>
        
        {/* RAG参数设置 */}
        <Collapse 
          defaultActiveKey={['rag']} 
          style={{ marginBottom: 16 }}
          bordered
          size="small"
        >
          <Collapse.Panel header="RAG参数设置" key="rag">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>选择召回片段数</Text>
                  <InputNumber
                    min={1}
                    max={20}
                    step={1}
                    value={chunkCount}
                    onChange={setChunkCount}
                    style={{ width: 70 }}
                  />
                </div>
                <Slider
                  min={1}
                  max={20}
                  step={1}
                  value={chunkCount}
                  onChange={setChunkCount}
                />
              </div>
              
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>相似度阈值</Text>
                  <InputNumber
                    min={0}
                    max={1}
                    step={0.01}
                    value={similarityThreshold}
                    onChange={setSimilarityThreshold}
                    style={{ width: 70 }}
                  />
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={similarityThreshold}
                  onChange={setSimilarityThreshold}
                />
              </div>
            </Space>
          </Collapse.Panel>
        </Collapse>
      </Col>
    </Row>
  );
};

export default ChatInterface; 