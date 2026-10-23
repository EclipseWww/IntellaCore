import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Row, Col, Select, Input, Tag, Statistic, 
  Empty, Spin, Tabs, Alert, Button, Space, Tooltip, Badge,
  Divider, Progress, Typography, Radio, message
} from 'antd';
import { 
  SearchOutlined, FilterOutlined, ReloadOutlined,
  QuestionCircleOutlined, CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import { 
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { questionAnalyticsAPI, quizAPI } from '../../../services/api';
import ReactMarkdown from 'react-markdown';
import MarkdownRenderer from '../../shared/MarkdownRenderer';
import usePageTitle from '../../../hooks/usePageTitle';

const { TabPane } = Tabs;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// 图表颜色
const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1'];

const QuestionAnalysis = () => {
  usePageTitle('题目分析');
  
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    tags: [],
    difficulty: null,
    type: null,
    sortBy: 'correctRate',
    sortOrder: 'asc'
  });
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [questionDetail, setQuestionDetail] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [filteredClassStats, setFilteredClassStats] = useState(null);
  const [classSortInfo, setClassSortInfo] = useState({
    columnKey: 'correctRate',
    order: 'descend' // 初始化排序为正确率降序
  });
  
  // 获取题目列表
  const fetchQuestions = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: pageSize,
        ...filters
      };
      
      // 如果difficulty是数组，将其转换为逗号分隔的字符串
      if (params.difficulty && Array.isArray(params.difficulty)) {
        params.difficulty = params.difficulty.join(',');
      }
      
      const response = await questionAnalyticsAPI.getAllQuestionsAnalytics(params);
      if (response.success && response.data) {
        setQuestions(response.data.questions);
        setPagination({
          current: response.data.pagination.page,
          pageSize: response.data.pagination.limit,
          total: response.data.pagination.total
        });
        
        // 直接使用后端返回的所有标签
        if (response.data.allTags && Array.isArray(response.data.allTags)) {
          setAllTags(response.data.allTags);
        }
      }
    } catch (error) {
      console.error('获取题目列表失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 获取题目详情
  const fetchQuestionDetail = async (questionId) => {
    try {
      setDetailLoading(true);
      const response = await questionAnalyticsAPI.getQuestionAnalytics(questionId);
      if (response.success) {
        setQuestionDetail(response);
      } else {
        message.error('获取题目详情失败');
      }
    } catch (error) {
      console.error('获取题目详情失败:', error);
      message.error('获取题目详情失败');
    } finally {
      setDetailLoading(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchQuestions();
  }, []);
  
  // 筛选条件变化时重新加载
  useEffect(() => {
    fetchQuestions(1, pagination.pageSize);
  }, [filters]);
  
  // 选中题目变化时加载详情
  useEffect(() => {
    if (selectedQuestion) {
      fetchQuestionDetail(selectedQuestion);
    } else {
      setQuestionDetail(null);
      setFilteredClassStats(null);
    }
  }, [selectedQuestion]);
  
  // 题目详情变化时重置筛选的班级数据
  useEffect(() => {
    setFilteredClassStats(null);
  }, [questionDetail]);
  
  // 处理表格分页变化
  const handleTableChange = (pagination, filters, sorter) => {
    // 处理排序变化
    if (sorter && sorter.field) {
      // 确定排序字段
      let sortBy = 'correctRate'; // 默认排序字段
      if (sorter.field === 'analytics.totalAttempts') {
        sortBy = 'totalAttempts';
      } else if (sorter.field === 'analytics.correctRate') {
        sortBy = 'correctRate';
      } else if (sorter.field === 'difficulty') {
        sortBy = 'difficulty';
      }
      
      // 确定排序顺序
      const sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';
      
      // 更新排序状态
      setFilters(prev => ({
        ...prev,
        sortBy,
        sortOrder
      }));
    } else {
      // 如果没有排序信息，只处理分页
      fetchQuestions(pagination.current, pagination.pageSize);
    }
  };
  
  // 处理搜索
  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, search: value }));
  };
  
  // 处理标签筛选
  const handleTagFilter = (tags) => {
    setFilters(prev => ({ ...prev, tags }));
  };
  
  // 处理难度筛选
  const handleDifficultyFilter = (difficultyRange) => {
    // 如果选择了范围，则将范围转换为具体的难度值
    let difficulty = null;
    if (difficultyRange) {
      difficulty = difficultyRangeMap[difficultyRange].range;
    }
    setFilters(prev => ({ ...prev, difficulty }));
  };
  
  // 处理类型筛选
  const handleTypeFilter = (type) => {
    setFilters(prev => ({ ...prev, type }));
  };
  
  // 重置筛选条件
  const resetFilters = () => {
    setFilters({
      search: '',
      tags: [],
      difficulty: null,
      type: null,
      sortBy: 'correctRate',
      sortOrder: 'asc'
    });
  };
  
  // 题目类型映射
  const questionTypeMap = {
    'SINGLE_CHOICE': '单选题',
    'TRUE_FALSE': '判断题',
    'PSYCHOLOGICAL_SCALE': '心理量表题'
  };
  
  // 难度等级映射
  const difficultyLevelMap = {
    1: { color: 'success', text: '简单' },
    2: { color: 'success', text: '简单' },
    3: { color: 'success', text: '简单' },
    4: { color: 'processing', text: '中等' },
    5: { color: 'processing', text: '中等' },
    6: { color: 'processing', text: '中等' },
    7: { color: 'error', text: '困难' },
    8: { color: 'error', text: '困难' },
    9: { color: 'error', text: '困难' },
    10: { color: 'error', text: '困难' }
  };
  
  // 难度范围映射
  const difficultyRangeMap = {
    'easy': { text: '简单', color: 'success', range: [1, 2, 3] },
    'medium': { text: '中等', color: 'processing', range: [4, 5, 6] },
    'hard': { text: '困难', color: 'error', range: [7, 8, 9, 10] }
  };
  
  // 表格列定义
  const columns = [
    {
      title: '题目',
      dataIndex: 'content',
      key: 'content',
      render: (text, record) => (
        <Tooltip
          title={
            <div>
              <div className="quiz-markdown-content">
                <MarkdownRenderer content={record.content} />
              </div>
              <div style={{ marginTop: 8 }}>
                {record.tags && record.tags.map(tag => (
                  <Tag key={tag} color="blue" style={{ marginRight: 4 }}>{tag}</Tag>
                ))}
              </div>
            </div>
          }
          placement="rightTop"
          overlayStyle={{ maxWidth: '420px' }}
          color="#ffffff"
          overlayInnerStyle={{
            backgroundColor: '#ffffff',
            color: '#333333',
            border: '1px solid #e8e8e8',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}
        >
          <div className="ellipsis-text" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <div>{(record.content || '').replace(/<[^>]+>/g, '').substring(0, 30) + '...'}</div>
          </div>
        </Tooltip>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: type => questionTypeMap[type] || type
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 120,
      render: difficulty => {
        const level = difficultyLevelMap[difficulty] || { color: 'default', text: '未知' };
        return <Badge status={level.color} text={level.text} />;
      },
      sorter: true
    },
    {
      title: '作答次数',
      dataIndex: ['analytics', 'totalAttempts'],
      key: 'totalAttempts',
      width: 120,
      sorter: true,
      defaultSortOrder: 'descend'
    },
    {
      title: '正确率',
      dataIndex: ['analytics', 'correctRate'],
      key: 'correctRate',
      width: 120,
      render: rate => (
        <Progress 
          percent={parseFloat(rate)} 
          size="small" 
          status={parseFloat(rate) >= 60 ? "success" : "exception"}
        />
      ),
      sorter: true,
      defaultSortOrder: 'ascend'
    }
  ];
  
  // 处理班级表格排序变化
  const handleClassTableChange = (pagination, filters, sorter) => {
    console.log('班级表格排序变化:', sorter);
    if (sorter && sorter.columnKey) {
      setClassSortInfo({
        columnKey: sorter.columnKey,
        order: sorter.order || 'descend'
      });
    }
  };

  // 预处理班级数据，按正确率降序排序
  const getSortedClassStats = (classStats) => {
    if (!classStats) return [];
    
    // 复制数组，避免修改原始数据
    const sortedStats = [...classStats];
    
    // 根据当前排序信息排序
    sortedStats.sort((a, b) => {
      const columnKey = classSortInfo.columnKey;
      const isDescend = classSortInfo.order === 'descend';
      
      if (columnKey === 'correctRate') {
        return isDescend 
          ? parseFloat(b.correctRate) - parseFloat(a.correctRate)  // 降序
          : parseFloat(a.correctRate) - parseFloat(b.correctRate); // 升序
      } else if (columnKey === 'totalAttempts') {
        return isDescend 
          ? b.totalAttempts - a.totalAttempts 
          : a.totalAttempts - b.totalAttempts;
      } else if (columnKey === 'correctAttempts') {
        return isDescend 
          ? b.correctAttempts - a.correctAttempts 
          : a.correctAttempts - b.correctAttempts;
      }
      
      // 默认按正确率降序
      return parseFloat(b.correctRate) - parseFloat(a.correctRate);
    });
    
    return sortedStats;
  };
  
  // 渲染题目详情
  const renderQuestionDetail = () => {
    if (!questionDetail) {
      return (
        <Card>
          <Empty description="请选择一个题目查看详情" />
        </Card>
      );
    }
    
    const { question, stats } = questionDetail.data;
    
    // 确保 question 和 stats 都存在
    if (!question || !stats) {
      return (
        <Card>
          <Empty description="题目数据加载失败，请重试" />
        </Card>
      );
    }
    
    const isScaleQuestion = question.type === 'PSYCHOLOGICAL_SCALE';

    return (
      <Spin spinning={detailLoading}>
        <Card>
          <Title level={4}>题目详情</Title>
          <Paragraph>
            <div className="quiz-markdown-content">
              <MarkdownRenderer content={question.content} />
            </div>
          </Paragraph>
          
          <Row gutter={16}>
            <Col span={8}>
              <Statistic 
                title="总作答次数" 
                value={stats.totalAttempts} 
                suffix="次"
              />
            </Col>
            {!isScaleQuestion && (
              <>
                <Col span={8}>
                  <Statistic 
                    title="正确次数" 
                    value={stats.correctAttempts} 
                    suffix="次"
                  />
                </Col>
                <Col span={8}>
                  <Statistic 
                    title="正确率" 
                    value={stats.correctRate} 
                    suffix="%" 
                    precision={2}
                    valueStyle={{ 
                      color: parseFloat(stats.correctRate) >= 60 ? '#3f8600' : '#cf1322' 
                    }}
                  />
                </Col>
              </>
            )}
          </Row>
          
          <Divider />
          
          <Tabs defaultActiveKey="options">
            <TabPane tab="选项分析" key="options">
              {!isScaleQuestion ? (
                <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card title="选项分布" bordered={false}>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={(() => {
                            // 为饼图准备数据
                            const pieData = [];
                            
                            // 判断题特殊处理
                            if (question.type === 'TRUE_FALSE') {
                              // 遍历选项
                              question.options.forEach((option, index) => {
                                const optionId = option._id.toString();
                                const optionStats = stats.optionDistribution[optionId] || { count: 0, percentage: 0 };
                                
                                pieData.push({
                                  name: option.isCorrect ? '正确' : '错误',
                                  value: parseInt(optionStats.count || 0),
                                  percentage: parseFloat(optionStats.percentage || 0).toFixed(2)
                                });
                              });
                            } else {
                              // 单选题处理
                              question.options.forEach((option, index) => {
                                const optionId = option._id.toString();
                                const optionStats = stats.optionDistribution[optionId] || { count: 0, percentage: 0 };
                                
                                pieData.push({
                                  name: String.fromCharCode(65 + index), // A, B, C, D...
                                  value: parseInt(optionStats.count || 0),
                                  percentage: parseFloat(optionStats.percentage || 0).toFixed(2)
                                });
                              });
                            }
                            return pieData;
                          })()}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          animationDuration={300}
                          animationBegin={0}
                        >
                          {(() => {
                            // 获取选项数量
                            const optionsCount = question.options ? question.options.length : 0;
                            // 创建对应数量的Cell组件
                            return Array(optionsCount).fill().map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ));
                          })()}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value, name, props) => [
                            `${value} (${props.payload.percentage}%)`, 
                            name
                          ]} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="选项详情" bordered={false}>
                    {(question.options || []).map((option, index) => {
                      // 确保 option 是有效对象
                      if (!option || typeof option !== 'object') return null;
                      
                      // 获取选项ID
                      const optionId = option._id ? option._id.toString() : `option_${index}`;
                      
                      // 获取选项统计数据，如果不存在则提供默认值
                      const optionStats = stats.optionDistribution && stats.optionDistribution[optionId];
                      const count = optionStats ? parseInt(optionStats.count || 0) : 0;
                      const percentage = optionStats ? parseFloat(optionStats.percentage || 0).toFixed(2) : '0.00';
                      
                      // 判断题特殊处理选项标签
                      const optionLabel = question.type === 'TRUE_FALSE' 
                        ? (option.isCorrect ? '正确' : '错误')
                        : String.fromCharCode(65 + index);
                      
                      return (
                        <div key={optionId} style={{ marginBottom: 16 }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            backgroundColor: option.isCorrect ? '#f6ffed' : '#fff',
                            padding: 8,
                            borderRadius: 4,
                            border: option.isCorrect ? '1px solid #b7eb8f' : '1px solid #f0f0f0'
                          }}>
                            <div style={{ marginRight: 8, fontWeight: 'bold' }}>
                              {optionLabel}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="quiz-markdown-content">
                                <MarkdownRenderer content={option.content} />
                              </div>
                            </div>
                            <div>
                              <Tag color={option.isCorrect ? 'success' : 'default'}>
                                {count}次 ({percentage}%)
                              </Tag>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                </Col>
              </Row>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <h4 style={{ margin: 0 }}>评分分布 ({stats.totalAttempts > 0 ? `${stats.totalAttempts}人作答` : '暂无作答'})</h4>
                  </div>
                  {(() => {
                    const optionDistribution = stats.optionDistribution || {};
                    const totalAttempts = typeof stats.totalAttempts === 'number' ? stats.totalAttempts : 0;
                    const scaleLevel = question.scaleLevel || 5;
                    const hasMatrix = (question.matrixRows && question.matrixRows.length > 0) || Object.keys(optionDistribution).some(k => k.startsWith('matrix_'));
                    
                    if (hasMatrix) {
                      // 矩阵量表：逐行展示
                      // 行来源：题目定义优先，其次从分布键推断
                      let rows = Array.isArray(question.matrixRows) ? question.matrixRows : [];
                      if (!rows || rows.length === 0) {
                        const matrixKeys = Object.keys(optionDistribution).filter(k => k.startsWith('matrix_'));
                        const rowIds = Array.from(new Set(matrixKeys.map(k => k.split('_')[1])));
                        rows = rowIds.map(id => ({ id, content: id }));
                      }
                      return (
                        <div>
                          {rows.map((row, rowIdx) => (
                            <div key={row.id || rowIdx} style={{ marginBottom: 12 }}>
                              <div style={{ fontWeight: 600, marginBottom: 6 }}>{row.content}</div>
                              <Row gutter={[6, 6]}>
                                {Array.from({ length: scaleLevel }, (_, i) => {
                                  const value = i + 1;
                                  const key = `matrix_${row.id || rowIdx}_${value}`;
                                  let count = optionDistribution[key] || 0;
                                  if (typeof count === 'string') {
                                    const pct = parseFloat(count);
                                    count = totalAttempts > 0 ? Math.round((pct / 100) * totalAttempts) : 0;
                                  }
                                  const percent = totalAttempts > 0 ? Math.round((count / totalAttempts) * 100) : 0;
                                  const label = (Array.isArray(question.scaleLabels) && question.scaleLabels[i]) ? question.scaleLabels[i] : `${value}分`;
                                  return (
                                    <Col span={Math.floor(24 / scaleLevel)} key={value}>
                                      <div style={{
                                        padding: '8px',
                                        border: '1px solid #e9ecef',
                                        borderRadius: 6,
                                        textAlign: 'center',
                                        background: count > 0 ? '#f6ffed' : '#fafafa'
                                      }}>
                                        <div style={{ fontWeight: 600 }}>{label}</div>
                                        <div style={{ fontSize: 12, color: '#666' }}>{count}人（{percent}%）</div>
                                      </div>
                                    </Col>
                                  );
                                })}
                              </Row>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    
                    // 单个量表
                    return (
                      <>
                        <Row gutter={[8, 8]}>
                          {Array.from({ length: scaleLevel }, (_, i) => {
                            const value = i + 1;
                            const key = `scale_${value}`;
                            let count = optionDistribution[key] || 0;
                            if (typeof count === 'string') {
                              const pct = parseFloat(count);
                              count = totalAttempts > 0 ? Math.round((pct / 100) * totalAttempts) : 0;
                            }
                            const percent = totalAttempts > 0 ? Math.round((count / totalAttempts) * 100) : 0;
                            const label = (Array.isArray(question.scaleLabels) && question.scaleLabels[i]) ? question.scaleLabels[i] : `${value}分`;
                            return (
                              <Col span={Math.floor(24 / scaleLevel)} key={value}>
                                <div style={{
                                  padding: '12px',
                                  border: '1px solid #e9ecef',
                                  borderRadius: 6,
                                  textAlign: 'center',
                                  background: count > 0 ? '#f0f5ff' : '#fafafa'
                                }}>
                                  <div style={{ fontWeight: 600 }}>{label}</div>
                                  <div style={{ fontSize: 12, color: '#666' }}>{count}人（{percent}%）</div>
                                </div>
                              </Col>
                            );
                          })}
                        </Row>
                      </>
                    );
                  })()}
                </>
              )}
            </TabPane>
            
            <TabPane tab="测验分析" key="quizzes">
              <Card bordered={false}>
                <Table
                  dataSource={stats.quizStats || []}
                  rowKey={(record, index) => `quiz_${index}`}
                  pagination={false}
                  columns={(() => {
                    const cols = [
                      {
                        title: '测验名称',
                        dataIndex: 'quizName',
                        key: 'quizName'
                      },
                      {
                        title: '作答次数',
                        dataIndex: 'totalAttempts',
                        key: 'totalAttempts',
                        width: 120
                      }
                    ];
                    if (!isScaleQuestion) {
                      cols.push(
                        {
                          title: '正确次数',
                          dataIndex: 'correctAttempts',
                          key: 'correctAttempts',
                          width: 120
                        },
                        {
                          title: '正确率',
                          dataIndex: 'correctRate',
                          key: 'correctRate',
                          width: 180,
                          render: rate => (
                            <div>
                              <Progress 
                                percent={parseFloat(rate)} 
                                size="small" 
                                status={parseFloat(rate) >= 60 ? "success" : "exception"}
                              />
                              <div style={{ textAlign: 'center', marginTop: '5px' }}>
                                {parseFloat(rate).toFixed(2)}%
                              </div>
                            </div>
                          )
                        }
                      );
                    }
                    return cols;
                  })()}
                />
              </Card>
            </TabPane>
            
            <TabPane tab="班级分析" key="classes">
              <Card bordered={false}>
                <div style={{ marginBottom: 16 }}>
                  <Select 
                    placeholder="按年级筛选" 
                    allowClear
                    style={{ width: 200 }}
                    onChange={(value) => {
                      // 筛选出选定年级的班级
                      const filtered = value 
                        ? (stats.classStats || []).filter(c => 
                            c.className && c.className.includes(`${value}级`))
                        : stats.classStats || [];
                      
                      // 更新内部状态以显示筛选后的班级
                      setFilteredClassStats(filtered);
                    }}
                  >
                    {/* 从班级名中提取年级，并去重 */}
                    {Array.from(new Set((stats.classStats || [])
                      .map(c => {
                        // 尝试从班级名称中提取年级（通常是"XX级XX班"格式）
                        const match = c.className && c.className.match(/^(\d+)级/);
                        return match ? match[1] : null;
                      })
                      .filter(Boolean)))
                      .sort()
                      .map(grade => (
                        <Option key={grade} value={grade}>{grade}级</Option>
                      ))
                    }
                  </Select>
                </div>
                
                <Table
                  dataSource={getSortedClassStats(filteredClassStats || stats.classStats || [])}
                  rowKey={(record, index) => `class_${index}`}
                  pagination={false}
                  onChange={handleClassTableChange}
                  columns={(() => {
                    const cols = [
                      {
                        title: '班级',
                        dataIndex: 'className',
                        key: 'className'
                      },
                      {
                        title: '作答次数',
                        dataIndex: 'totalAttempts',
                        key: 'totalAttempts',
                        width: 120,
                        sorter: true,
                        sortOrder: classSortInfo.columnKey === 'totalAttempts' ? classSortInfo.order : null
                      }
                    ];
                    if (!isScaleQuestion) {
                      cols.push(
                        {
                          title: '正确次数',
                          dataIndex: 'correctAttempts',
                          key: 'correctAttempts',
                          width: 120,
                          sorter: true,
                          sortOrder: classSortInfo.columnKey === 'correctAttempts' ? classSortInfo.order : null
                        },
                        {
                          title: '正确率',
                          dataIndex: 'correctRate',
                          key: 'correctRate',
                          width: 180,
                          sorter: true,
                          sortOrder: classSortInfo.columnKey === 'correctRate' ? classSortInfo.order : null,
                          render: rate => (
                            <div>
                              <Progress 
                                percent={parseFloat(rate)} 
                                size="small" 
                                status={parseFloat(rate) >= 60 ? "success" : "exception"}
                              />
                              <div style={{ textAlign: 'center', marginTop: '5px' }}>
                                {parseFloat(rate).toFixed(2)}%
                              </div>
                            </div>
                          )
                        }
                      );
                    }
                    return cols;
                  })()}
                />
              </Card>
            </TabPane>
          </Tabs>
        </Card>
      </Spin>
    );
  };
  
  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]}>
        <Col span={24} lg={12}>
          <Card title="题目分析">
            <div style={{ marginBottom: 16 }}>
              <Row gutter={16} align="middle">
                <Col xs={24} sm={12} md={12} lg={24} xl={12}>
                  <Input.Search
                    placeholder="搜索题目"
                    allowClear
                    enterButton
                    value={filters.search}
                    onChange={e => handleSearch(e.target.value)}
                    onSearch={handleSearch}
                    style={{ marginBottom: '8px' }}
                  />
                </Col>
                <Col xs={24} sm={12} md={12} lg={24} xl={12}>
                  <Select
                    placeholder="按标签筛选"
                    mode="multiple"
                    allowClear
                    style={{ width: '100%', marginBottom: '8px' }}
                    value={filters.tags}
                    onChange={handleTagFilter}
                    maxTagCount={1}
                    maxTagTextLength={10}
                    maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}...`}
                    optionFilterProp="children"
                    showSearch
                    listHeight={200}
                  >
                    {allTags.map(tag => (
                      <Option key={tag} value={tag}>{tag}</Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={12} lg={24} xl={12}>
                  <div style={{ marginBottom: '8px' }}>
                    <Radio.Group
                      value={filters.difficulty ? 
                        Object.keys(difficultyRangeMap).find(key => 
                          JSON.stringify(difficultyRangeMap[key].range) === JSON.stringify(filters.difficulty)
                        ) : undefined}
                      onChange={e => handleDifficultyFilter(e.target.value)}
                      buttonStyle="solid"
                      style={{ width: '100%' }}
                    >
                      <Radio.Button value={undefined} style={{ width: '25%', textAlign: 'center' }}>全部</Radio.Button>
                      {Object.entries(difficultyRangeMap).map(([key, value]) => (
                        <Radio.Button 
                          key={key} 
                          value={key}
                          style={{ width: '25%', textAlign: 'center' }}
                        >
                          {value.text}
                        </Radio.Button>
                      ))}
                    </Radio.Group>
                  </div>
                </Col>
                <Col xs={24} sm={12} md={12} lg={24} xl={12}>
                  <Select
                    placeholder="按类型筛选"
                    allowClear
                    style={{ width: '100%', marginBottom: '8px' }}
                    value={filters.type}
                    onChange={handleTypeFilter}
                  >
                    {Object.entries(questionTypeMap).map(([key, value]) => (
                      <Option key={key} value={key}>{value}</Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={24}>
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={resetFilters}
                  >
                    重置筛选
                  </Button>
                </Col>
              </Row>
            </div>
            
            <Table
              columns={columns}
              dataSource={questions}
              rowKey="_id"
              loading={loading}
              pagination={pagination}
              onChange={handleTableChange}
              scroll={{ y: 'calc(100vh - 400px)' }}
              onRow={(record) => ({
                onClick: () => setSelectedQuestion(record._id),
                style: { cursor: 'pointer' }
              })}
            />
          </Card>
        </Col>
        
        <Col span={24} lg={12}>
          {renderQuestionDetail()}
        </Col>
      </Row>
    </div>
  );
};

export default QuestionAnalysis;
