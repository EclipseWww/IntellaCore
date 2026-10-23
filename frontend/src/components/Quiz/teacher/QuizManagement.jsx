import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, InputNumber, message, Select, Row, Col, List, Empty, Divider, Switch, Tooltip, Statistic, Progress, Spin, Alert, Tabs, Dropdown, Menu, Tag } from 'antd';
import { quizAPI, questionAnalyticsAPI } from '../../../services/api';
import moment from 'moment';
import ReactMarkdown from 'react-markdown';
import MarkdownRenderer from '../../shared/MarkdownRenderer';
import { SortAscendingOutlined, SortDescendingOutlined, EditOutlined, SaveOutlined, ArrowUpOutlined, ArrowDownOutlined, VerticalAlignTopOutlined, VerticalAlignBottomOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 图表颜色
const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1'];

const QuestionItem = ({
  question,
  index,
  selectedQuiz,
  tempQuestions,
  handleRemoveQuestion,
  handleAddToTemp,
  setTempQuestions,
  setQuestions,
  getQuestionTypeText
}) => {
  const [questionAnalytics, setQuestionAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        const response = await questionAnalyticsAPI.getQuestionAnalytics(question._id);
        if (mounted) {
          if (response && response.success && response.data) {
            setQuestionAnalytics(response.data);
          } else {
            setQuestionAnalytics(null);
          }
        }
      } catch (error) {
        if (mounted) {
          setQuestionAnalytics(null);
        }
      } finally {
        if (mounted) {
          setAnalyticsLoading(false);
        }
      }
    };
    fetchAnalytics();
    return () => { mounted = false; };
  }, [question._id]);

  return (
    <div style={{
      width: '100%',
      padding: '16px',
      backgroundColor: question.isInQuiz ? '#f6ffed' : '#f8f9fa',
      borderRadius: '4px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: question.isInQuiz ? '1px solid #52c41a' : 'none'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontWeight: 'bold', marginRight: '8px', color: '#1890ff' }}>
              {index + 1}.
            </span>
            <span style={{
              display: 'inline-block',
              margin: '0 4px 4px 0',
              padding: '2px 8px',
              background: '#e6f7ff',
              color: '#1890ff',
              borderRadius: '12px',
              fontSize: '12px'
            }}>
              {getQuestionTypeText(question.type)}
            </span>
            <span style={{
              display: 'inline-block',
              margin: '0 4px 4px 0',
              padding: '2px 8px',
              background: question.difficulty >= 7 ? '#fff1f0' :
                question.difficulty >= 4 ? '#fff7e6' : '#f6ffed',
              color: question.difficulty >= 7 ? '#f5222d' :
                question.difficulty >= 4 ? '#fa8c16' : '#52c41a',
              borderRadius: '12px',
              fontSize: '12px'
            }}>
              {{ '0': '简单', '1': '简单', '2': '简单', '3': '简单', '4': '中等', '5': '中等', '6': '中等', '7': '困难', '8': '困难', '9': '困难', '10': '困难' }[question.difficulty] || '未知'}
            </span>
            {question.tags && question.tags.map((tag, i) => (
              <span key={i} style={{
                display: 'inline-block',
                margin: '0 4px 4px 0',
                padding: '2px 8px',
                background: '#f9f0ff',
                color: '#722ed1',
                borderRadius: '12px',
                fontSize: '12px'
              }}>
                {tag}
              </span>
            ))}
          </div>

          <span style={{ fontSize: '14px', display: 'block' }}>
            <div className="quiz-markdown-content">
              <MarkdownRenderer content={question.content} smallImages={true} />
            </div>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {question.isInQuiz && (
            <span style={{
              background: '#52c41a',
              color: '#fff',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}>
              已添加
            </span>
          )}
          <Tooltip title="在题库管理中编辑此题目">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                const url = `/teacher?tab=question-bank&questionId=${question._id}&type=${question.type}`;
                window.open(url, '_blank');
              }}
            >
              编辑题目
            </Button>
          </Tooltip>
          {question.isInQuiz ? (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => {
                const quizQuestionIndex = selectedQuiz?.questions?.findIndex(
                  q => (q.questionId?._id || q.questionId) === question._id
                );
                if (quizQuestionIndex !== -1 && quizQuestionIndex !== undefined) {
                  handleRemoveQuestion(question, quizQuestionIndex);
                } else {
                  setTempQuestions(prev => prev.filter(q => q._id !== question._id));
                  setQuestions(prevQuestions => {
                    return prevQuestions.map(q => ({
                      ...q,
                      isInQuiz: q._id === question._id ? false : q.isInQuiz
                    }));
                  });
                  message.success('题目已移出，记得保存更改哦');
                }
              }}
            >
              移出
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={() => handleAddToTemp(question)}
              disabled={tempQuestions.some(q => q._id === question._id)}
            >
              移入
            </Button>
          )}
        </div>
      </div>

      <div style={{
        marginTop: '12px',
        padding: '8px 12px',
        background: '#fff',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ marginRight: 'auto' }}>
          <span style={{ fontWeight: 'bold', color: '#555', marginRight: '4px' }}>分析数据:</span>
        </div>
        {analyticsLoading ? (
          <Spin size="small" />
        ) : questionAnalytics && questionAnalytics.stats ? (
          <>
            <div>
              <span style={{ color: '#666', fontSize: '13px', marginRight: '4px' }}>作答:</span>
              <span style={{ fontWeight: '500' }}>{questionAnalytics.stats.totalAttempts || 0}次</span>
            </div>
            <div>
              <span style={{ color: '#666', fontSize: '13px', marginRight: '4px' }}>正确:</span>
              <span style={{ fontWeight: '500' }}>{questionAnalytics.stats.correctAttempts || 0}次</span>
            </div>
            <div>
              <span style={{ color: '#666', fontSize: '13px', marginRight: '4px' }}>正确率:</span>
              <span style={{
                fontWeight: '500',
                color: parseFloat(questionAnalytics.stats.correctRate || 0) >= 60 ? '#3f8600' : '#cf1322'
              }}>
                {parseFloat(questionAnalytics.stats.correctRate || 0).toFixed(1)}%
              </span>
            </div>
          </>
        ) : (
          <span style={{ color: '#999', fontSize: '13px' }}>暂无数据</span>
        )}
      </div>

      {question.type === 'PSYCHOLOGICAL_SCALE' ? (
        <div style={{ marginTop: '12px', padding: '0 12px' }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#722ed1' }}>量表选项：</div>
          {Array.isArray(question.matrixRows) && question.matrixRows.length > 0 ? (
            <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e8e8e8', borderRight: '1px solid #e8e8e8' }}></th>
                    {Array.from({ length: question.scaleLevel || 5 }, (_, i) => (
                      <th key={i} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #e8e8e8', borderRight: i < (question.scaleLevel || 5) - 1 ? '1px solid #e8e8e8' : 'none' }}>
                        {question.scaleLabels?.[i] || `${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {question.matrixRows.map((row, idx) => (
                    <tr key={row.id || idx}>
                      <td style={{ padding: '8px 12px', borderBottom: idx < question.matrixRows.length - 1 ? '1px solid #e8e8e8' : 'none', borderRight: '1px solid #e8e8e8' }}>
                        {row.content || row.id}
                      </td>
                      {Array.from({ length: question.scaleLevel || 5 }, (_, i) => (
                        <td key={i} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: idx < question.matrixRows.length - 1 ? '1px solid #e8e8e8' : 'none', borderRight: i < (question.scaleLevel || 5) - 1 ? '1px solid #e8e8e8' : 'none' }}>
                          ○
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '12px' }}>
              {Array.from({ length: question.scaleLevel || 5 }, (_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60, padding: '8px', background: '#f9f0ff', borderRadius: '4px' }}>
                  <div style={{ marginBottom: 4, fontSize: '16px' }}>○</div>
                  <div style={{ fontSize: 14, fontWeight: 'bold', color: '#722ed1' }}>{i + 1}</div>
                  <div style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>{question.scaleLabels?.[i] || ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : question.options && (
        <div style={{ marginTop: '12px', padding: '0 12px' }}>
          {question.options.map((option, optIndex) => {
            let optionAnalytics = null;
            if (questionAnalytics && questionAnalytics.stats && questionAnalytics.stats.optionDistribution) {
              const optionId = option._id.toString();
              const optionData = questionAnalytics.stats.optionDistribution[optionId];

              if (optionData) {
                let count = 0;
                let percentage = 0;

                if (typeof optionData === 'object') {
                  count = optionData.count || 0;
                  percentage = parseFloat(optionData.percentage || 0);
                } else {
                  percentage = parseFloat(optionData || 0);
                  const totalAttempts = questionAnalytics.stats.totalAttempts || 0;
                  count = Math.round(totalAttempts * percentage / 100);
                }

                optionAnalytics = { count, percentage };
              }
            }

            return (
              <div
                key={option._id}
                style={{
                  padding: '8px 12px',
                  marginBottom: '8px',
                  background: option.isCorrect ? '#e6f7ff' : '#fff',
                  border: `1px solid ${option.isCorrect ? '#91d5ff' : '#d9d9d9'}`,
                  borderRadius: '4px'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1 }}>
                    <span style={{
                      minWidth: '20px',
                      color: option.isCorrect ? '#1890ff' : '#595959',
                      fontWeight: 'bold',
                      marginRight: '8px',
                      marginTop: '2px' // align with first line of markdown
                    }}>
                      {String.fromCharCode(65 + optIndex)}.
                    </span>
                    <span style={{
                      color: option.isCorrect ? '#1890ff' : '#262626',
                      fontWeight: option.isCorrect ? '500' : 'normal',
                      flex: 1
                    }}>
                      <div style={{ display: 'inline-block', width: '100%' }}>
                        <MarkdownRenderer content={option.content} compact={true} smallImages={true} />
                      </div>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {option.isCorrect && (
                      <span style={{
                        marginLeft: '8px',
                        color: '#1890ff',
                        fontSize: '12px',
                        background: '#e6f7ff',
                        padding: '2px 8px',
                        borderRadius: '12px'
                      }}>
                        正确答案
                      </span>
                    )}
                    {optionAnalytics && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        color: '#999',
                        whiteSpace: 'nowrap'
                      }}>
                        {optionAnalytics.count}次 ({optionAnalytics.percentage.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {question.explanation && (
        <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#fff7e6', borderRadius: '4px' }}>
          <div style={{ marginBottom: '4px', fontWeight: 'bold', color: '#fa8c16' }}>题目解析：</div>
          <div className="quiz-markdown-content">
            <MarkdownRenderer content={question.explanation} smallImages={true} />
          </div>
        </div>
      )}
    </div>
  );
};

const QuizManagement = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [tempQuestions, setTempQuestions] = useState([]);
  const [form] = Form.useForm();
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(null);
  const [questionTypes, setQuestionTypes] = useState([]);
  const [uniqueTags, setUniqueTags] = useState([]);
  const [filterType, setFilterType] = useState(null);
  const [filterTags, setFilterTags] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [tagSortOrder, setTagSortOrder] = useState('asc');
  const [questionAnalytics, setQuestionAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('questionBank');

  const typeToChineseMap = {
    'SINGLE_CHOICE': '单选题',
    'MULTIPLE_CHOICE': '多选题',
    'TRUE_FALSE': '判断题',
    'FILL_BLANK': '填空题',
    'SHORT_ANSWER': '简答题',
    'PSYCHOLOGICAL_SCALE': '心理量表',
    // 添加其他题型映射
  };

  // 添加一个转换函数
  const getQuestionTypeText = (type) => {
    return typeToChineseMap[type] || type;
  };
  // 获取测验列表
  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const response = await quizAPI.quizzes.getList();
      setQuizzes(response.data);
    } catch (error) {
      message.error('获取测验列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取题目列表
  const fetchQuestions = async () => {
    try {
      const response = await quizAPI.questions.getList();
      setQuestions(response.data);

      // Extract unique question types
      const types = [...new Set(response.data.map(q => q.type))].filter(Boolean);
      setQuestionTypes(types);

      // Extract unique tags from all questions
      const allTags = response.data.reduce((tags, question) => {
        if (Array.isArray(question.tags)) {
          return [...tags, ...question.tags];
        }
        return tags;
      }, []);

      // Use Set to get unique tags
      const uniqueTagsList = [...new Set(allTags)].filter(Boolean);

      // 按字母顺序排序标签
      const sortedTags = uniqueTagsList.sort((a, b) => {
        if (tagSortOrder === 'asc') {
          return a.localeCompare(b, 'zh-CN');
        } else {
          return b.localeCompare(a, 'zh-CN');
        }
      });

      setUniqueTags(sortedTags);

      // Initialize filtered questions with all questions
      setFilteredQuestions(response.data);
    } catch (error) {
      message.error('获取题目列表失败');
    }
  };

  // 切换标签排序方式
  const toggleTagSortOrder = () => {
    const newOrder = tagSortOrder === 'asc' ? 'desc' : 'asc';
    setTagSortOrder(newOrder);

    // 重新排序标签，但保持筛选条件不变
    const sortedTags = [...uniqueTags].sort((a, b) => {
      if (newOrder === 'asc') {
        return a.localeCompare(b, 'zh-CN');
      } else {
        return b.localeCompare(a, 'zh-CN');
      }
    });

    setUniqueTags(sortedTags);
    // 重新应用筛选条件
    filterQuestions();
    message.success(`标签已按${newOrder === 'asc' ? '升序' : '降序'}排列`);
  };

  // 筛选题目
  const filterQuestions = () => {
    let filtered = questions;

    // Filter by type if selected
    if (filterType) {
      filtered = filtered.filter(q => q.type === filterType);
      console.log('按类型过滤:', filterType, '结果:', filtered.length);
    }

    // Filter by tags if any selected
    if (filterTags.length > 0) {
      filtered = filtered.filter(q => {
        // Check if question has tags and if any of the selected tags are included
        return Array.isArray(q.tags) &&
          filterTags.some(tag => q.tags.includes(tag));
      });
    }

    setFilteredQuestions(filtered);
  };

  // 获取测验详细信息
  const fetchQuizDetail = async (id) => {
    try {
      const response = await quizAPI.quizzes.getById(id);
      console.log('获取到的测验详情:', response.data);
      const quiz = response.data;
      setSelectedQuiz(quiz);

      // 输出测验中的所有题目
      console.log('测验中的题目:', quiz.questions);

      // 获取测验中的题目ID，使用正确的ID字段
      const existingQuestionIds = quiz.questions?.map(q => q.questionId._id) || [];
      console.log('当前测验中的题目IDs:', existingQuestionIds);

      // 输出题库中的所有题目
      console.log('题库中的所有题目:', questions);

      // 更新题库中题目的状态
      setQuestions(prevQuestions => {
        const updatedQuestions = prevQuestions.map(question => {
          const isInQuiz = existingQuestionIds.includes(question._id);
          return {
            ...question,
            isInQuiz
          };
        });
        return updatedQuestions;
      });
    } catch (error) {
      message.error('获取测验详情失败');
    }
  };

  useEffect(() => {
    fetchQuizzes();
    fetchQuestions();  // 自动刷新题库
  }, []);

  // 监听窗口尺寸，控制移动端视图
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);


  useEffect(() => {
    filterQuestions();
    // 当筛选条件变化时，重置选中的题目索引
    setSelectedQuestionIndex(null);
  }, [filterType, filterTags, questions]);

  // 在 useEffect 中监听标签排序顺序变化
  useEffect(() => {
    // 当标签排序方式变化时，重新获取题目并排序标签
    if (questions.length > 0) {
      const sortedTags = [...uniqueTags].sort((a, b) => {
        if (tagSortOrder === 'asc') {
          return a.localeCompare(b, 'zh-CN');
        } else {
          return b.localeCompare(a, 'zh-CN');
        }
      });
      setUniqueTags(sortedTags);
    }
  }, [tagSortOrder]);

  // 处理创建/编辑测验
  const handleSubmit = async (values) => {
    try {
      const { isScaleTest, timeRange, settings, ...rest } = values;
      // 测验设置现在完全由活动来配置，这里使用空的默认值
      const quizData = {
        ...rest,
        isScaleTest,
        settings: {
          allowMultipleAttempts: false,
          maxAttempts: 1,
          randomizeQuestions: false,
          randomizeOptions: false,
          showAnswerAfterSubmit: false,
          showScoreAfterSubmit: false,
          timeLimit: 0
        }
      };

      if (selectedQuiz) {
        await quizAPI.quizzes.update(selectedQuiz._id, quizData);
        message.success('测验更新成功');
      } else {
        await quizAPI.quizzes.create(quizData);
        message.success('测验创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      setSelectedQuiz(null);
      fetchQuizzes();
    } catch (error) {
      message.error(selectedQuiz ? '更新测验失败' : '创建测验失败');
    }
  };

  // 处理删除测验
  const handleDelete = async (id) => {
    try {
      await quizAPI.quizzes.delete(id);
      message.success('测验删除成功');
      fetchQuizzes();
    } catch (error) {
      message.error('删除测验失败');
    }
  };

  // 处理发布测验
  const handlePublish = async (id) => {
    try {
      await quizAPI.quizzes.publish(id);
      message.success('测验发布成功');
      fetchQuizzes();
    } catch (error) {
      message.error('发布测验失败');
    }
  };

  // 处理复制测验
  const handleDuplicate = async (id) => {
    try {
      await quizAPI.quizzes.duplicate(id);
      message.success('复制成功');
      fetchQuizzes();
    } catch (error) {
      message.error('复制失败');
    }
  };

  // 二次确认复制
  const confirmDuplicate = (id) => {
    Modal.confirm({
      title: '确认复制',
      content: '将创建一个草稿副本。确定要复制该测验吗？',
      onOk: () => handleDuplicate(id)
    });
  };

  // 处理添加题目到测验
  const handleAddToTemp = async (question) => {
    if (!selectedQuiz) {
      message.warning('请先选择一个测验');
      return;
    }

    if (question.isInQuiz) {
      message.warning('该题目已在测验中');
      return;
    }

    const allQuestions = [
      ...(selectedQuiz.questions || []),
      {
        questionId: question,
        order: (selectedQuiz.questions?.length || 0) + 1
      }
    ];

    try {
      const updatedQuizData = {
        ...selectedQuiz,
        questions: allQuestions
      };
      
      await quizAPI.quizzes.update(selectedQuiz._id, updatedQuizData);
      setSelectedQuiz(updatedQuizData);
      
      setQuestions(prevQuestions => {
        return prevQuestions.map(q => ({
          ...q,
          isInQuiz: q._id === question._id ? true : q.isInQuiz
        }));
      });
      message.success('题目已自动保存到测验中');
    } catch (error) {
      console.error('添加题目失败:', error);
      message.error('添加题目失败');
    }
  };

  // 移出题目的处理函数
  const handleRemoveQuestion = async (questionToRemove, index) => {
    if (!selectedQuiz) return;
    
    let removeIndex = index;
    if (removeIndex === undefined || removeIndex === -1) {
      removeIndex = selectedQuiz.questions?.findIndex(
        q => (q.questionId?._id || q.questionId) === questionToRemove._id
      );
    }
    
    if (removeIndex === -1 || removeIndex === undefined) {
      message.warning('未在测验中找到该题目');
      return;
    }

    const allQuestions = selectedQuiz.questions.filter((_, i) => i !== removeIndex);
    allQuestions.forEach((q, i) => q.order = i + 1);

    try {
      const updatedQuizData = {
        ...selectedQuiz,
        questions: allQuestions
      };
      await quizAPI.quizzes.update(selectedQuiz._id, updatedQuizData);
      
      setSelectedQuiz(updatedQuizData);
      setQuestions(prevQuestions => {
        return prevQuestions.map(q => ({
          ...q,
          isInQuiz: q._id === questionToRemove._id ? false : q.isInQuiz
        }));
      });
      message.success('题目已移出并自动保存');
    } catch (error) {
      console.error('移出题目失败:', error);
      message.error('移出题目失败');
    }
  };

  const handleMoveQuestion = async (index, direction) => {
    if (!selectedQuiz || !selectedQuiz.questions) return;
    
    const newQuestions = [...selectedQuiz.questions];
    if (direction === 'up' && index > 0) {
      const temp = newQuestions[index];
      newQuestions[index] = newQuestions[index - 1];
      newQuestions[index - 1] = temp;
    } else if (direction === 'down' && index < newQuestions.length - 1) {
      const temp = newQuestions[index];
      newQuestions[index] = newQuestions[index + 1];
      newQuestions[index + 1] = temp;
    } else if (direction === 'top' && index > 0) {
      const temp = newQuestions[index];
      newQuestions.splice(index, 1);
      newQuestions.unshift(temp);
    } else if (direction === 'bottom' && index < newQuestions.length - 1) {
      const temp = newQuestions[index];
      newQuestions.splice(index, 1);
      newQuestions.push(temp);
    } else {
      return;
    }
    
    newQuestions.forEach((q, i) => q.order = i + 1);

    try {
      const updatedQuizData = {
        ...selectedQuiz,
        questions: newQuestions
      };
      await quizAPI.quizzes.update(selectedQuiz._id, updatedQuizData);
      setSelectedQuiz(updatedQuizData);
    } catch (error) {
      console.error('调整顺序失败:', error);
      message.error('调整顺序失败');
    }
  };

  // 获取题目分析数据
  const fetchQuestionAnalytics = async (questionId) => {
    if (!questionId) return;

    try {
      setAnalyticsLoading(true);
      const response = await questionAnalyticsAPI.getQuestionAnalytics(questionId);

      if (response && response.success && response.data) {
        setQuestionAnalytics(response.data);
        console.log('题目分析数据:', response.data);
      } else {
        setQuestionAnalytics(null);
        console.log('题目分析数据获取失败或暂无数据:', response);
      }
    } catch (error) {
      console.error('获取题目分析数据失败:', error);
      setQuestionAnalytics(null);
      message.error('获取题目分析数据失败');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // 选中题目时加载分析数据
  useEffect(() => {
    if (selectedQuestionIndex !== null) {
      const selectedQuestion = filteredQuestions[selectedQuestionIndex];
      if (selectedQuestion && selectedQuestion._id) {
        fetchQuestionAnalytics(selectedQuestion._id);
      } else {
        setQuestionAnalytics(null);
      }
    } else {
      setQuestionAnalytics(null);
    }
  }, [selectedQuestionIndex]);

  const columns = [
    {
      title: '测验标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (date) => moment(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      key: 'endTime',
      render: (date) => moment(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => ({
        'DRAFT': '草稿',
        'PUBLISHED': '已发布',
        'IN_PROGRESS': '进行中',
        'ENDED': '已结束'
      }[status] || status),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" size="small" onClick={(e) => {
            e.stopPropagation();
            fetchQuizDetail(record._id);
            form.setFieldsValue({
              ...record,
              timeRange: [moment(record.startTime), moment(record.endTime)]
            });
            setModalVisible(true);
          }}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={(e) => {
            e.stopPropagation();
            confirmDuplicate(record._id);
          }}>
            复制
          </Button>
          {record.status === 'DRAFT' ? (
            <Button type="link" onClick={() => {
              Modal.confirm({
                title: '确认发布',
                content: '发布后的测验将对学生可见，确定要发布吗？',
                onOk: () => handlePublish(record._id),
              });
            }}>
              发布
            </Button>
          ) : record.status === 'PUBLISHED' && (
            <Button
              type="link"
              size="small"
              style={{ color: '#faad14' }}
              onClick={(e) => {
                e.stopPropagation();
                Modal.confirm({
                  title: '确认撤回',
                  content: '撤回后测验将变为草稿状态，不再对学生可见，确定要撤回吗？',
                  onOk: () => handlePublish(record._id),
                });
              }}
            >
              撤回
            </Button>
          )}
          <Button type="link" danger onClick={() => {
            Modal.confirm({
              title: '确认删除',
              content: '确定要删除这个测验吗？',
              onOk: () => handleDelete(record._id),
            });
          }}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 测验列表操作菜单
  const getQuizActionMenu = (item) => (
    <Menu>
      <Menu.Item key="edit" onClick={(e) => {
        e.domEvent.stopPropagation();
        fetchQuizDetail(item._id);
        form.setFieldsValue({
          ...item,
          timeRange: [moment(item.startTime), moment(item.endTime)]
        });
        setModalVisible(true);
      }}>
        编辑
      </Menu.Item>
      <Menu.Item key="duplicate" onClick={(e) => {
        e.domEvent.stopPropagation();
        confirmDuplicate(item._id);
      }}>
        复制
      </Menu.Item>
      {item.status === 'DRAFT' ? (
        <Menu.Item key="publish" onClick={(e) => {
          e.domEvent.stopPropagation();
          Modal.confirm({
            title: '确认发布',
            content: '发布后的测验将对学生可见，确定要发布吗？',
            onOk: () => handlePublish(item._id),
          });
        }}>
          发布
        </Menu.Item>
      ) : item.status === 'PUBLISHED' && (
        <Menu.Item key="revoke" onClick={(e) => {
          e.domEvent.stopPropagation();
          Modal.confirm({
            title: '确认撤回',
            content: '撤回后测验将变为草稿状态，不再对学生可见，确定要撤回吗？',
            onOk: () => handlePublish(item._id),
          });
        }}>
          撤回
        </Menu.Item>
      )}
      <Menu.Item key="delete" danger onClick={(e) => {
        e.domEvent.stopPropagation();
        Modal.confirm({
          title: '确认删除',
          content: '确定要删除这个测验吗？',
          onOk: () => handleDelete(item._id),
        });
      }}>
        删除
      </Menu.Item>
    </Menu>
  );

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button type="primary" onClick={() => {
              setSelectedQuiz(null);
              form.resetFields();
              setModalVisible(true);
            }}>
              新建测验
            </Button>
            <Button type="link" onClick={fetchQuestions}>刷新题库</Button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>测验列表</h3>
            {isMobile ? (
              <div>
                <Select
                  placeholder="选择测验"
                  style={{ width: '100%', marginBottom: 12 }}
                  value={selectedQuiz?._id}
                  onChange={(value) => {
                    const item = quizzes.find(q => q._id === value);
                    if (item) {
                      fetchQuizDetail(item._id);
                    }
                  }}
                  showSearch
                  optionFilterProp="children"
                >
                  {quizzes.map(item => (
                    <Option key={item._id} value={item._id}>{item.title}</Option>
                  ))}
                </Select>
                <Space>
                  <Button size="small" type="link" disabled={!selectedQuiz} onClick={() => {
                    if (!selectedQuiz) return;
                    form.setFieldsValue({
                      ...selectedQuiz,
                      timeRange: [moment(selectedQuiz.startTime), moment(selectedQuiz.endTime)]
                    });
                    setModalVisible(true);
                  }}>编辑</Button>
                  {selectedQuiz && selectedQuiz.status === 'DRAFT' ? (
                    <Button size="small" type="link" onClick={() => {
                      Modal.confirm({
                        title: '确认发布',
                        content: '发布后的测验将对学生可见，确定要发布吗？',
                        onOk: () => handlePublish(selectedQuiz._id),
                      });
                    }}>发布</Button>
                  ) : selectedQuiz && selectedQuiz.status === 'PUBLISHED' ? (
                    <Button size="small" type="link" style={{ color: '#faad14' }} onClick={() => {
                      Modal.confirm({
                        title: '确认撤回',
                        content: '撤回后测验将变为草稿状态，不再对学生可见，确定要撤回吗？',
                        onOk: () => handlePublish(selectedQuiz._id),
                      });
                    }}>撤回</Button>
                  ) : null}
                  <Button size="small" type="link" disabled={!selectedQuiz} onClick={() => selectedQuiz && confirmDuplicate(selectedQuiz._id)}>复制</Button>
                  <Button size="small" type="link" danger disabled={!selectedQuiz} onClick={() => {
                    if (!selectedQuiz) return;
                    Modal.confirm({
                      title: '确认删除',
                      content: '确定要删除这个测验吗？',
                      onOk: () => handleDelete(selectedQuiz._id),
                    });
                  }}>删除</Button>
                </Space>
              </div>
            ) : null}
            <List
              loading={loading}
              dataSource={quizzes}
              size="small"
              pagination={{
                pageSize: 7,
                size: 'small',
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 个测验`
              }}
              renderItem={item => (
                <List.Item
                  style={{
                    padding: '12px',
                    cursor: 'pointer',
                    background: selectedQuiz?._id === item._id ? '#f0f7ff' : '#fff',
                    border: selectedQuiz?._id === item._id ? '1px solid #1890ff' : '1px solid transparent',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}
                  onClick={() => {
                    console.log('选择测验:', item);
                    fetchQuizDetail(item._id);
                  }}
                >
                  <List.Item.Meta
                    title={(
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          flex: '1',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginRight: '8px'
                        }}>
                          {item.title}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            background: '#e6f7ff',
                            color: '#1890ff',
                            borderRadius: '12px',
                            padding: '2px 8px',
                            fontSize: '12px',
                            whiteSpace: 'nowrap'
                          }}>
                            {
                              {
                                'DRAFT': '草稿',
                                'PUBLISHED': '已发布',
                                'IN_PROGRESS': '进行中',
                                'ENDED': '已结束'
                              }[item.status]
                            }
                          </span>
                          <Dropdown overlay={getQuizActionMenu(item)} trigger={['click']}>
                            <Button
                              type="text"
                              size="small"
                              onClick={(e) => e.stopPropagation()}
                              style={{ padding: '0 4px' }}
                            >
                              •••
                            </Button>
                          </Dropdown>
                        </div>
                      </div>
                    )}
                    description={(
                      <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        {item.questions?.length || 0} 道题目
                      </div>
                    )}
                  />
                </List.Item>
              )}
            />
          </div>
        </Col>

        <Col xs={24} md={18}>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <Tabs.TabPane tab="题库" key="questionBank">
              <div>

                <div style={{ marginBottom: '16px' }}>
                  <Row gutter={[16, 16]} align="middle">
                    <Col span={6}>
                      <Select
                        placeholder="按题型筛选"
                        allowClear
                        style={{ width: '100%' }}
                        onChange={(value) => setFilterType(value)}
                      >

                        {questionTypes.map(type => (
                          <Option key={type} value={type}>{getQuestionTypeText(type)}</Option>
                        ))}

                      </Select>
                    </Col>
                    <Col span={12}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Select
                          placeholder="按标签筛选"
                          mode="multiple"
                          allowClear
                          style={{ width: '100%' }}
                          onChange={(values) => setFilterTags(values)}
                          maxTagCount={1}
                          maxTagTextLength={10}
                          maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}...`}
                          optionFilterProp="children"
                          showSearch
                          listHeight={200}
                        >
                          {uniqueTags.map(tag => (
                            <Option key={tag} value={tag}>{tag}</Option>
                          ))}
                        </Select>
                        <Tooltip title={`点击${tagSortOrder === 'asc' ? '降序' : '升序'}排列标签`}>
                          <Button
                            type="text"
                            size="small"
                            onClick={toggleTagSortOrder}
                            style={{ marginLeft: '4px', padding: '0 4px' }}
                            icon={tagSortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                          />
                        </Tooltip>
                      </div>
                    </Col>
                    <Col span={6} style={{ textAlign: 'right' }}>
                    </Col>
                  </Row>
                </div>
                <List
                  dataSource={filteredQuestions}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50'],
                    showTotal: (total) => `共 ${total} 道题目`,
                    style: { marginTop: '16px', textAlign: 'center' }
                  }}
                  renderItem={(question) => {
                    const trueIndex = filteredQuestions.indexOf(question);
                    return (
                      <List.Item style={{ padding: 0, marginBottom: '16px', border: 'none', width: '100%' }}>
                        <QuestionItem
                          question={question}
                          index={trueIndex}
                          selectedQuiz={selectedQuiz}
                          tempQuestions={tempQuestions}
                          handleRemoveQuestion={handleRemoveQuestion}
                          handleAddToTemp={handleAddToTemp}
                          setTempQuestions={setTempQuestions}
                          setQuestions={setQuestions}
                          getQuestionTypeText={getQuestionTypeText}
                        />
                      </List.Item>
                    );
                  }}
                />
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane tab="测验预览" key="quizPreview">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0 }}>测验预览</h3>
                </div>
                {selectedQuiz ? (
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>{selectedQuiz.title}</h3>
                        <div>
                          <span style={{
                            background: '#e6f7ff',
                            color: '#1890ff',
                            borderRadius: '12px',
                            padding: '4px 8px',
                            marginLeft: '8px',
                            fontSize: '12px'
                          }}>时间限制: {selectedQuiz.settings?.timeLimit > 0 ? `${selectedQuiz.settings.timeLimit} 分钟` : '无限制'}</span>
                          <span style={{
                            background: '#f0f0f0',
                            color: '#595959',
                            borderRadius: '12px',
                            padding: '4px 8px',
                            marginLeft: '8px',
                            fontSize: '12px'
                          }}>{selectedQuiz.isScaleTest ? '心理量表' : '普通测验'}</span>
                        </div>
                      </div>
                      <p>{selectedQuiz.description}</p>
                    </div>

                    {/* 题目统计信息 */}
                    {(() => {
                      const allQuestions = selectedQuiz.questions || [];
                      const typeStats = {};
                      allQuestions.forEach(item => {
                        const qData = item.questionId || item;
                        const type = qData.type || 'UNKNOWN';
                        typeStats[type] = (typeStats[type] || 0) + 1;
                      });
                      return (
                        <div style={{
                          marginBottom: '16px',
                          padding: '12px 16px',
                          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}>
                          <div style={{ fontWeight: 'bold', color: '#333' }}>
                            共 <span style={{ color: '#1890ff', fontSize: '18px' }}>{allQuestions.length}</span> 题
                          </div>
                          <div style={{ height: '20px', width: '1px', background: '#d9d9d9' }} />
                          {Object.entries(typeStats).map(([type, count]) => (
                            <Tag key={type} color="blue" style={{ margin: 0 }}>
                              {getQuestionTypeText(type)}: {count}题
                            </Tag>
                          ))}
                        </div>
                      );
                    })()}
                    <div>
                      <h3>题目列表</h3>
                      {selectedQuiz.questions?.length > 0 ? (
                        <List
                          size="small"
                          dataSource={selectedQuiz.questions || []}
                          renderItem={(item, index) => {
                            // 统一数据结构
                            const questionData = item.questionId || item;
                            return (
                              <List.Item style={{
                                padding: '16px',
                                background: '#f8f9fa',
                                marginBottom: '8px',
                                borderRadius: '4px',
                                flexDirection: 'column',
                                alignItems: 'flex-start'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  width: '100%',
                                  marginBottom: '12px'
                                }}>
                                  <div style={{
                                    minWidth: '24px',
                                    height: '24px',
                                    backgroundColor: '#1890ff',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: '12px',
                                    fontSize: '14px',
                                    borderRadius: '4px'
                                  }}>
                                    {index + 1}
                                  </div>
                                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '15px', fontWeight: '500', color: '#262626', display: 'block' }}>
                                      <div className="quiz-markdown-content">
                                        <MarkdownRenderer content={questionData.content} />
                                      </div>
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <Tooltip title="置顶">
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<VerticalAlignTopOutlined />}
                                          disabled={index === 0}
                                          onClick={() => handleMoveQuestion(index, 'top')}
                                        />
                                      </Tooltip>
                                      <Tooltip title="上移">
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<ArrowUpOutlined />}
                                          disabled={index === 0}
                                          onClick={() => handleMoveQuestion(index, 'up')}
                                        />
                                      </Tooltip>
                                      <Tooltip title="下移">
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<ArrowDownOutlined />}
                                          disabled={index === (selectedQuiz.questions?.length || 0) - 1}
                                          onClick={() => handleMoveQuestion(index, 'down')}
                                        />
                                      </Tooltip>
                                      <Tooltip title="置底">
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<VerticalAlignBottomOutlined />}
                                          disabled={index === (selectedQuiz.questions?.length || 0) - 1}
                                          onClick={() => handleMoveQuestion(index, 'bottom')}
                                        />
                                      </Tooltip>
                                      <Button
                                        type="link"
                                        danger
                                        size="small"
                                        onClick={() => handleRemoveQuestion(questionData, index)}
                                      >
                                        移出
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                                {/* 添加题目元数据显示 */}
                                <div style={{ marginLeft: '36px', marginBottom: '12px', padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', width: 'calc(100% - 36px)' }}>
                                  <Row gutter={16}>
                                    <Col span={8}>
                                      <strong>题型：</strong> {getQuestionTypeText(questionData.type)}
                                    </Col>
                                    <Col span={8}>
                                      <strong>难度：</strong>
                                      <span style={{
                                        color: questionData.difficulty >= 7 ? '#f5222d' :
                                          questionData.difficulty >= 4 ? '#fa8c16' : '#52c41a'
                                      }}>
                                        {{ 0: '简单', 1: '简单', 2: '简单', 3: '简单', 4: '中等', 5: '中等', 6: '中等', 7: '困难', 8: '困难', 9: '困难', 10: '困难' }[questionData.difficulty] || '未知'}
                                      </span>
                                    </Col>
                                  </Row>
                                  {questionData.tags && questionData.tags.length > 0 && (
                                    <div style={{ marginTop: '4px' }}>
                                      <strong>标签：</strong>
                                      {questionData.tags.map((tag, i) => (
                                        <span key={i} style={{
                                          display: 'inline-block',
                                          margin: '0 4px 4px 0',
                                          padding: '2px 6px',
                                          background: '#e6f7ff',
                                          color: '#1890ff',
                                          borderRadius: '12px',
                                          fontSize: '12px'
                                        }}>
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* 添加题目解析 */}
                                {questionData.explanation && (
                                  <div style={{ marginLeft: '36px', marginBottom: '12px', padding: '8px', backgroundColor: '#fff7e6', borderRadius: '4px', width: 'calc(100% - 36px)' }}>
                                    <div style={{ marginBottom: '4px', fontWeight: 'bold', color: '#fa8c16' }}>题目解析：</div>
                                    <div className="quiz-markdown-content">
                                      <MarkdownRenderer content={questionData.explanation} />
                                    </div>
                                  </div>
                                )}
                                {/* 量表题预览（单个/矩阵）；非量表显示普通选项 */}
                                {questionData.type === 'PSYCHOLOGICAL_SCALE' ? (
                                  <div style={{ marginLeft: '36px', width: 'calc(100% - 36px)' }}>
                                    {Array.isArray(questionData.matrixRows) && questionData.matrixRows.length > 0 ? (
                                      <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '6px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                                          <thead>
                                            <tr style={{ background: '#fafafa' }}>
                                              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e8e8e8', borderRight: '1px solid #e8e8e8' }}></th>
                                              {Array.from({ length: questionData.scaleLevel || 5 }, (_, i) => (
                                                <th key={i} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #e8e8e8', borderRight: i < (questionData.scaleLevel || 5) - 1 ? '1px solid #e8e8e8' : 'none' }}>
                                                  {questionData.scaleLabels && questionData.scaleLabels[i] ? questionData.scaleLabels[i] : `${i + 1}`}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {questionData.matrixRows.map((row, idx) => (
                                              <tr key={row.id || idx}>
                                                <td style={{ padding: '8px 12px', borderBottom: idx < questionData.matrixRows.length - 1 ? '1px solid #e8e8e8' : 'none', borderRight: '1px solid #e8e8e8' }}>
                                                  {row.content || row.id}
                                                </td>
                                                {Array.from({ length: questionData.scaleLevel || 5 }, (_, i) => (
                                                  <td key={i} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: idx < questionData.matrixRows.length - 1 ? '1px solid #e8e8e8' : 'none', borderRight: i < (questionData.scaleLevel || 5) - 1 ? '1px solid #e8e8e8' : 'none' }}>
                                                    ○
                                                  </td>
                                                ))}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '12px' }}>
                                        {Array.from({ length: questionData.scaleLevel || 5 }, (_, i) => (
                                          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                                            <div style={{ marginBottom: 8 }}>○</div>
                                            <div style={{ fontSize: 12, color: '#666' }}>{i + 1}</div>
                                            <div style={{ fontSize: 12 }}>{questionData.scaleLabels && questionData.scaleLabels[i] ? questionData.scaleLabels[i] : `${i + 1}`}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  questionData.options && (
                                    <div style={{
                                      marginLeft: '36px',
                                      width: 'calc(100% - 36px)'
                                    }}>
                                      {questionData.options.map((option, optIndex) => (
                                        <div
                                          key={option._id}
                                          style={{
                                            padding: '8px 12px',
                                            marginBottom: '4px',
                                            background: option.isCorrect ? '#e6f7ff' : '#fff',
                                            border: `1px solid ${option.isCorrect ? '#91d5ff' : '#d9d9d9'}`,
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center'
                                          }}
                                        >
                                          <span style={{
                                            width: '20px',
                                            color: option.isCorrect ? '#1890ff' : '#595959'
                                          }}>
                                            {String.fromCharCode(65 + optIndex)}.
                                          </span>
                                          <span style={{
                                            color: option.isCorrect ? '#1890ff' : '#262626',
                                            fontWeight: option.isCorrect ? '500' : 'normal'
                                          }}>
                                            {option.content}
                                          </span>
                                          {option.isCorrect && (
                                            <span style={{
                                              marginLeft: 'auto',
                                              color: '#1890ff',
                                              fontSize: '12px'
                                            }}>
                                              正确答案
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )
                                )}
                              </List.Item>
                            );
                          }}
                        />
                      ) : (
                        <Empty description="暂无题目" />
                      )}
                    </div>
                  </div>
                ) : (
                  <Empty description="请从左侧选择一个测验" />
                )}
              </div>
            </Tabs.TabPane>
          </Tabs>
        </Col>
      </Row>

      {/* 创建/编辑测验的模态框 */}
      <Modal
        title={selectedQuiz ? '编辑测验' : '新建测验'}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setSelectedQuiz(null);
        }}
        onOk={() => form.submit()}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            settings: {
              allowMultipleAttempts: false,
              maxAttempts: 1,
              randomizeQuestions: false,
              randomizeOptions: false,
              showAnswerAfterSubmit: false,
              showScoreAfterSubmit: false,
              timeLimit: 0
            }
          }}
        >
          <Form.Item
            name="title"
            label="测验标题"
            rules={[{ required: true, message: '请输入测验标题' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="description"
            label="测验说明"
          >
            <Input.TextArea rows={4} />
          </Form.Item>

          <Form.Item
            name="isScaleTest"
            label="测验类型"
            rules={[{ required: true, message: '请选择测验类型' }]}
          >
            <Select>
              <Option value={false}>普通测验</Option>
              <Option value={true}>心理量表</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QuizManagement; 