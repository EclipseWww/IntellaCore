import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Input, Button, List, Avatar, Typography, Spin, Tabs, Space, message } from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  BookOutlined,
  BulbOutlined,
  QuestionCircleOutlined,
  ExperimentOutlined,
  HighlightOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import MarkdownRenderer from '../../shared/MarkdownRenderer';
import api from '../../../services/api';
import { classAPI } from '../../../services/api';
import _ from 'lodash';
import { chatAPI } from '../../../services/api';

const { Text, Title } = Typography;

// 学生端快捷提问模板
const QUICK_PROMPTS = [
  '请用更简单的例子解释一下',
  '能给一个练习题吗？',
  '本课有哪些易错点？'
];

// 添加自定义AI图标组件
const AIIcon = ({ style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    version="1.1"
    width="32"
    height="28"
    viewBox="0 0 13.5 14.399999618530273"
    style={style}
  >
    <defs>
      <linearGradient
        x1="0.8993133306503296"
        y1="-0.04394836351275444"
        x2="0.24075928330421448"
        y2="0.9298340082168579"
        id="master_svg0_2366_01267"
      >
        <stop offset="0.6084760185331106%" stopColor="#FF768D" stopOpacity="1"></stop>
        <stop offset="67.67439842224121%" stopColor="#2D6AE2" stopOpacity="1"></stop>
        <stop offset="99.99993443489075%" stopColor="#78ABF5" stopOpacity="1"></stop>
      </linearGradient>
    </defs>
    <g>
      <path
        d="M0.562939,5.79672L0,6.67106L0.498614,7.68384Q4.43568,7.64845,6.40421,7.63077Q5.87699,8.45156,4.82261,10.0931L5.29349,11.1148L6.36982,11.1148Q7.45928,9.42212,8.00398,8.57582Q8.92542,10.5172,10.7683,14.4L11.8277,14.4L12.3792,13.5484L9.59079,7.59611L12.9485,7.56694Q13.3162,7.00327,13.5,6.72144Q13.3382,6.37966,13.0147,5.69608L9.86061,5.73569L12.8984,1.00212L12.4135,0L11.3691,0L8.26666,4.77933L6.75,1.59439L5.70514,1.59439L5.14402,2.45869L6.69809,5.76079L0.562939,5.79672Z"
        fillRule="evenodd"
        fill="url(#master_svg0_2366_01267)"
        fillOpacity="1"
      ></path>
    </g>
  </svg>
);

// 修改欢迎提示组件中的图标
const CourseWelcomeHints = () => (
  <div style={{
    padding: '16px',
    textAlign: 'center',
    background: 'linear-gradient(to bottom, #ffffff, #e6f7ff)',
    borderRadius: '12px',
    margin: '8px'
  }}>
    <Space direction="vertical" size="small" style={{ width: '100%', maxWidth: '600px' }}>
      <div style={{ transform: 'scale(1.5)', margin: '12px 0' }}>
        <AIIcon style={{ fontSize: '32px' }} />
      </div>
      <Title level={4} style={{ margin: '6px 0', fontSize: '18px' }}>课程 AI 助手</Title>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        maxWidth: '400px',
        margin: '0 auto'
      }}>
        <div style={{
          padding: '6px 12px',
          background: '#f0f5ff',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <BulbOutlined style={{ color: '#1890ff' }} />
          <Text style={{ fontSize: '13px' }}>我可以帮你理解课程内容，解答疑惑</Text>
        </div>
        <div style={{
          padding: '6px 12px',
          background: '#f6ffed',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <QuestionCircleOutlined style={{ color: '#52c41a' }} />
          <Text style={{ fontSize: '13px' }}>描述具体的问题，会得到更好的回答</Text>
        </div>
      </div>
    </Space>
  </div>
);

// 添加自定义滚动条样式
// 使用安全的方式添加样式，防止Selection.getRangeAt错误
if (typeof document !== 'undefined') {
  try {
    const existingStyleSheet = document.getElementById('course-ai-helper-styles');
    if (!existingStyleSheet) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'course-ai-helper-styles';
      styleSheet.textContent = `
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .chat-messages-container {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        
        .chat-messages-container::-webkit-scrollbar {
          display: none;  /* Chrome, Safari, Opera */
        }

        .chat-messages-container div {
          margin-bottom: 0 !important;
        }
        
        /* 优化消息容器的滚动效果 */
        .messages-scroll-container {
          scroll-behavior: smooth;
        }
        
        /* 美化历史记录 */
        .history-item {
          transition: all 0.2s ease;
        }
        
        .history-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        
        /* 优化输入框 */
        .chat-input textarea {
          border-radius: 8px;
          transition: all 0.3s ease;
          line-height: 22px !important;
          overflow-y: hidden !important;
        }
        
        .chat-input textarea:focus {
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
        }
        
        /* 发送按钮样式 */
        .send-button {
          border-radius: 6px;
          transition: all 0.3s ease;
        }
        
        .send-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(24, 144, 255, 0.25);
        }
      `;

      // 确保document.head存在并且处于可用状态
      if (document.head) {
        document.head.appendChild(styleSheet);
      }
    }
  } catch (error) {
    console.error('添加样式表时出错:', error);
  }
}

const MessageBubble = ({ message }) => {
  let content = '';

  // 简化内容处理逻辑
  if (!message.content) {
    content = '';
  } else {
    content = String(message.content)
      .replace(/^\s*['"]|['"]\s*$/g, '')  // 移除首尾的引号
      .replace(/\\([*_`])/g, '$1');  // 移除 markdown 字符的转义
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      padding: '6px 8px',
      marginTop: message.type === 'user' ? '8px' : '10px',
      marginBottom: 0,
      backgroundColor: '#fff',
      maxWidth: '100%',
      boxSizing: 'border-box'
    }}>
      <Avatar
        icon={message.type === 'user' ? <UserOutlined /> : <AIIcon style={{ fontSize: '14px' }} />}
        style={{
          backgroundColor: message.type === 'user' ? '#1890ff' : '#fff',
          marginRight: '8px',
          flexShrink: 0,
          border: message.type === 'ai' ? '1px solid #e8e8e8' : 'none',
          color: message.type === 'ai' ? '#595959' : '#fff'
        }}
        size="small"
      />
      <div style={{
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start'
      }}>
        <Text strong style={{ fontSize: '12px', marginBottom: '2px' }}>{message.type === 'ai' ? 'AI助手' : ''}</Text>
        <div
          className="chat-messages-container"
          style={{
            marginTop: message.type === 'user' ? '0' : '2px',
            wordBreak: 'break-word',
            overflow: 'hidden',
            padding: message.type === 'user' ? '8px 12px' : '0',
            backgroundColor: message.type === 'user' ? '#e6f7ff' : 'transparent',
            borderRadius: message.type === 'user' ? '8px' : '0',
            maxWidth: message.type === 'user' ? '90%' : '100%',
            alignSelf: 'flex-start',
            border: message.type === 'user' ? 'none' : 'transparent',
            boxShadow: message.type === 'user' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
          }}
        >
          <MarkdownRenderer
            content={content + (message.isStreaming ? '▋' : '')}
            key={content}
          />
        </div>
      </div>
    </div>
  );
};

const CourseAIHelper = ({
  courseId,
  chapterId,
  courseUnitId,
  lessonId,
  currentContent,
  courseName,
  courseDescription,
  selectedText,
  selectedQuestion
}) => {
  const [currentMessages, setCurrentMessages] = useState([]); // 当前对话消息
  const [historyMessages, setHistoryMessages] = useState([]); // 历史记录消息
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const historyContainerRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const messagesEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const [classSettings, setClassSettings] = useState(null);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);

  // 当selectedQuestion变化时，自动设置输入值
  useEffect(() => {
    if (selectedQuestion) {
      setInputValue(selectedQuestion);
    }
  }, [selectedQuestion]);

  // 清理函数
  const cleanupEventSource = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => cleanupEventSource();
  }, []);

  const loadHistory = useCallback(async (page = 1) => {
    if (historyLoading) return;

    try {
      setHistoryLoading(true);

      const response = await chatAPI.getMessageHistory({
        courseId,
        courseUnitId,
        lessonId,
        type: 'course',
        page,
        pageSize: page === 1 ? 5 : 20
      });

      if (response.success && response.data && response.data.messages) {
        const historyItems = response.data.messages.map(message => {
          return {
            id: message._id,
            conversations: message.conversations || [],
            timestamp: message.createdAt,
            status: message.status
          };
        });

        if (page === 1) {
          setHistoryMessages(historyItems);
        } else {
          setHistoryMessages(prev => [...prev, ...historyItems]);
        }

        // 确保分页信息存在
        const pagination = response.data.pagination || {};
        setHasMore(historyItems.length > 0 && pagination.currentPage < pagination.totalPages);
        setHistoryPage(pagination.currentPage || page);
      } else {
        console.warn('API响应数据结构不符合预期:', response);
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
      message.error('加载聊天记录失败');
    } finally {
      setHistoryLoading(false);
    }
  }, [courseId, courseUnitId, lessonId, historyLoading]);

  // 添加滚动监听函数
  const handleHistoryScroll = useCallback(() => {
    if (!historyContainerRef.current || historyLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = historyContainerRef.current;
    // 当滚动到距离底部100px时加载更多
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadHistory(historyPage + 1);
    }
  }, [historyLoading, hasMore, historyPage, loadHistory]);

  // 监听历史记录容器的滚动事件
  useEffect(() => {
    const historyContainer = historyContainerRef.current;
    if (historyContainer) {
      const throttledScroll = _.throttle(handleHistoryScroll, 300); // 添加节流
      historyContainer.addEventListener('scroll', throttledScroll);
      return () => {
        historyContainer.removeEventListener('scroll', throttledScroll);
        throttledScroll.cancel(); // 清理节流函数
      };
    }
  }, [handleHistoryScroll]);

  // 重置历史记录
  useEffect(() => {
    setHistoryMessages([]);
    setHistoryPage(1);
    setHasMore(true);
    loadHistory(1);
  }, [courseId]);

  // 获取班级设置
  const fetchClassSettings = async () => {
    try {
      const userStr = localStorage.getItem('user');

      const user = JSON.parse(userStr);

      if (!user || !user.id) {
        return;
      }

      const classSettings = await classAPI.getUserClassSettings(user.id);
      setClassSettings(classSettings);
    } catch (error) {
      console.error('获取班级设置失败:', error);
      message.error('获取班级设置失败');
    }
  };

  // 在组件加载时获取班级设置
  useEffect(() => {
    fetchClassSettings();
  }, []);

  const handleSendMessage = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) {
      message.warning('请输入消息内容');
      return;
    }

    // 检查是否允许使用 AI 助手
    setIsCheckingPermission(true);
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      if (!user || !user.id) {
        message.error('用户未登录');
        return;
      }

      const classSettings = await classAPI.getUserClassSettings(user.id);
      if (!classSettings.allowAiUsage) {
        message.error(' AI 助手暂未启用');
        return;
      }

      // 清理之前的连接和状态
      cleanupEventSource();
      setIsLoading(true);

      // 获取当前会话ID (如果没有则为空，后端会创建新对话)
      let currentChatId = '';
      if (historyMessages.length > 0 && courseId) {
        const latestChat = historyMessages[0];
        if (latestChat && latestChat.id) {
          currentChatId = latestChat.id;
        }
      }

      // 只发送学生的实际问题，不再包含提示内容
      const userQuestion = trimmedInput;

      // 添加新的用户消息和一个空的 AI 响应消息
      setCurrentMessages(prev => [
        ...prev,
        {
          type: 'user',
          content: userQuestion,
          timestamp: new Date().toISOString()
        },
        {
          type: 'ai',
          content: '',
          isStreaming: true,
          timestamp: new Date().toISOString()
        }
      ]);

      // 清空输入框
      setInputValue('');
      setCurrentResponse('');
      setSuggestedQuestions([]);

      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        content: userQuestion,  // 修改这里，直接发送用户问题
        courseId: courseId || '',
        lessonId: lessonId || '',
        courseUnitId: courseUnitId || '',
        contextContent: currentContent || '',
        messageId: currentChatId, // 添加现有消息ID
        token
      }).toString();

      const eventSource = new EventSource(
        `${api.defaults.baseURL}/chat/send?${queryParams}`
      );
      eventSourceRef.current = eventSource;

      let tempResponse = '';

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'init':
              // 如果后端返回了新的或现有的消息ID，保存它
              if (data.data && data.data.messageId) {
                currentChatId = data.data.messageId;
              }
              break;

            case 'chunk':
              tempResponse += data.content;
              // 更新最后一条消息的内容
              setCurrentMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.type === 'ai' && lastMessage.isStreaming) {
                  lastMessage.content = tempResponse;
                }
                return newMessages;
              });
              break;

            case 'done':
              // 完成流式响应，更新最后一条消息的状态
              setCurrentMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.type === 'ai') {
                  lastMessage.content = tempResponse;
                  lastMessage.isStreaming = false;
                }
                return newMessages;
              });
              // 接收后端返回的下一步提问建议
              if (data.data && Array.isArray(data.data.suggestedQuestions)) {
                setSuggestedQuestions(data.data.suggestedQuestions.filter(Boolean));
              }
              // 刷新历史记录，获取最新的对话
              loadHistory(1);
              cleanupEventSource();
              setIsLoading(false);
              break;
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
          cleanupEventSource();
          setIsLoading(false);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE Error:', error);
        message.error('连接中断，请重试');
        cleanupEventSource();
        setIsLoading(false);
      };

    } catch (error) {
      console.error('Error sending message:', error);
      message.error('发送消息失败，请重试');
      setCurrentMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.type === 'ai' && lastMessage.isStreaming) {
          newMessages.pop();
        }
        return newMessages;
      });
      setIsLoading(false);
      setCurrentResponse('');
    }
  };

  useEffect(() => {
    loadHistory();
    setCurrentMessages([]); // 清空当前对话
  }, [courseId]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);

  const items = [
    {
      key: '1',
      label: '对话',
      children: (
        <div style={{
          height: 'calc(80vh - 100px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div
            className="chat-messages-container messages-scroll-container"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0 4px',
              minHeight: '200px',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}>
            {currentMessages.length === 0 ? (
              <CourseWelcomeHints />
            ) : (
              <Space
                direction="vertical"
                style={{
                  width: '100%',
                  maxWidth: '100%'
                }}
                size={0}
              >
                {currentMessages.map((message, index) => (
                  <MessageBubble
                    key={index}
                    message={message}
                  />
                ))}
              </Space>
            )}
            {/* 快捷提问与建议：放置在聊天消息区域内，避免与底部输入区域重叠 */}
            {!isLoading && (
              <div style={{ padding: '8px 6px', margin: '8px 2px 0', background: '#fafafa', borderRadius: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start', width: '100%' }}>
                  {Array.isArray(suggestedQuestions) && suggestedQuestions.length > 0 ? (
                    suggestedQuestions.map((p, idx) => (
                      <Button
                        key={`sug-${idx}`}
                        type="dashed"
                        size="small"
                        style={{ width: '100%', whiteSpace: 'normal', height: 'auto', textAlign: 'left', lineHeight: '20px', padding: '6px 10px', wordBreak: 'break-word' }}
                        onClick={() => setInputValue(p)}
                      >{p}</Button>
                    ))
                  ) : (
                    QUICK_PROMPTS.map((p, idx) => (
                      <Button
                        key={idx}
                        size="small"
                        style={{ width: '100%', whiteSpace: 'normal', height: 'auto', textAlign: 'left', lineHeight: '20px', padding: '6px 10px', wordBreak: 'break-word' }}
                        onClick={() => setInputValue(p)}
                      >{p}</Button>
                    ))
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{
            borderTop: '1px solid #f0f0f0',
            padding: '12px',
            background: '#fff',
            borderRadius: '0 0 8px 8px',
            position: 'relative',
            zIndex: 1,
            flexShrink: 0
          }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              width: '100%',
              alignItems: 'center'
            }}>
              <Input.TextArea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="输入你的问题，比如：这个概念是什么意思？"
                disabled={isLoading}
                autoSize={false}
                rows={1}
                style={{
                  flex: 1,
                  resize: 'none',
                  maxWidth: 'calc(100% - 88px)',
                  borderRadius: '6px',
                  margin: 0,
                  height: '38px',
                  lineHeight: '22px',
                  padding: '7px 11px'
                }}
                className="chat-input"
              />
              <Button
                type="primary"
                onClick={handleSendMessage}
                disabled={isLoading}
                className="send-button"
                style={{
                  flexShrink: 0,
                  width: '80px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 8px'
                }}
              >
                {isLoading ? <Spin size="small" /> : <><SendOutlined style={{ marginRight: '4px' }} />发送</>}
              </Button>
            </div>
          </div>
        </div>
      )
    },
    {
      key: '2',
      label: '历史记录',
      children: (
        <div
          ref={historyContainerRef}
          style={{
            height: 'calc(80vh - 100px)',
            overflowY: 'auto',
            padding: '12px 8px'
          }}
          className="messages-scroll-container"
        >
          {historyMessages.length === 0 && !historyLoading ? (
            <div style={{ textAlign: 'center', padding: '16px', color: '#999' }}>
              暂无历史记录
            </div>
          ) : (
            <List
              dataSource={historyMessages}
              renderItem={(item, index) => {
                console.log(`渲染历史项 ${index}:`, item);
                return (
                  <List.Item
                    key={index}
                    style={{
                      padding: '12px',
                      background: '#fff',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      border: '1px solid #f0f0f0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                    className="history-item"
                  >
                    <List.Item.Meta
                      title={
                        <div style={{
                          marginBottom: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {new Date(item.timestamp).toLocaleString()}
                          </Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            ID: {item.id?.substring(0, 8)}
                          </Text>
                        </div>
                      }
                      description={
                        <div>
                          {item.conversations && item.conversations.length > 0 ? (
                            item.conversations
                              // 过滤掉 system 角色的消息
                              .filter(message => message.role !== 'system')
                              .map((message, msgIndex) => {
                                return (
                                  <div key={msgIndex} style={{
                                    marginBottom: '12px',
                                    background: message.role === 'user' ? '#e6f7ff' : '#f6ffed',
                                    padding: '10px 14px',
                                    borderRadius: message.role === 'user' ? '8px 8px 0 8px' : '8px 8px 8px 0',
                                    marginLeft: message.role === 'user' ? '24px' : '0',
                                    marginRight: message.role === 'assistant' ? '24px' : '0',
                                    position: 'relative',
                                    fontSize: '13px'
                                  }}>
                                    <div style={{
                                      position: 'absolute',
                                      [message.role === 'user' ? 'right' : 'left']: '-10px',
                                      top: '10px',
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '50%',
                                      background: message.role === 'user' ? '#1890ff' : '#52c41a',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#fff',
                                      fontSize: '12px'
                                    }}>
                                      {message.role === 'user' ? '问' : '答'}
                                    </div>
                                    <div style={{
                                      marginLeft: message.role === 'user' ? '0' : '16px',
                                      marginRight: message.role === 'user' ? '16px' : '0'
                                    }}>
                                      <MarkdownRenderer content={message.content} />
                                    </div>
                                  </div>
                                );
                              })
                          ) : (
                            <div style={{ textAlign: 'center', color: '#999' }}>
                              该记录没有对话内容
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
          {historyLoading && (
            <div style={{ textAlign: 'center', padding: '12px' }}>
              <Spin />
            </div>
          )}
          {!hasMore && historyMessages.length > 0 && (
            <div style={{ textAlign: 'center', padding: '12px', color: '#999' }}>
              没有更多记录了
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <Card
      style={{
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: 0,
        marginBottom: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        borderRadius: '8px'
      }}
      styles={{
        body: {
          padding: '4px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <Tabs
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
        items={items}
        tabBarStyle={{
          margin: 0,
          padding: '8px 12px 0',
          background: '#fff',
          zIndex: 2,
          position: 'relative'
        }}
      />
    </Card>
  );
};

export default CourseAIHelper;