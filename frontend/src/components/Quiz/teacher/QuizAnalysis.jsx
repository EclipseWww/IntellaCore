import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Row, Col, Select, Statistic, Empty, Spin, Tabs, Alert, Tag, Progress, Button, Space, Modal, message, Tooltip } from 'antd';
import { DownloadOutlined, ReloadOutlined, CheckCircleFilled, CloseCircleFilled, TeamOutlined, TrophyOutlined, RiseOutlined, FallOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { quizAPI, classAPI } from '../../../services/api';
import QuizResult from '../../Quiz/student/QuizResult';

import usePageTitle from '../../../hooks/usePageTitle';

const { Option } = Select;
const { TabPane } = Tabs;

// 图表颜色
const COLORS = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777'];
const CHART_GRADIENT = ['#6366F1', '#818CF8'];

/**
 * 安全地将 optionDistribution 的值转换为整数计数
 * 防御性处理：兼容整数和百分比字符串两种格式
 */
const safeCount = (value) => {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : 0;
};

/**
 * 规范化选项分布数据 —— 将所有值转为整数
 * 当后端返回百分比字符串（如 "48.72"）时，需要根据 totalAttempts 反算人数
 */
const normalizeOptionDistribution = (dist, totalAttempts) => {
  if (!dist || typeof dist !== 'object') return {};
  const keys = Object.keys(dist);
  if (keys.length === 0) return {};
  
  // 判断数据是否可能是百分比字符串格式：值为字符串且包含小数点
  const isPercentageFormat = keys.some(k => {
    const v = dist[k];
    return typeof v === 'string' && v.includes('.');
  });
  
  if (isPercentageFormat && totalAttempts > 0) {
    // 按百分比反算人数
    const normalized = {};
    keys.forEach(k => {
      const pct = parseFloat(dist[k]);
      normalized[k] = Number.isFinite(pct) ? Math.round((pct / 100) * totalAttempts) : 0;
    });
    return normalized;
  }
  
  // 正常整数计数
  const normalized = {};
  keys.forEach(k => {
    normalized[k] = safeCount(dist[k]);
  });
  return normalized;
};

const QuizAnalysis = () => {
  usePageTitle('测验分析');
  
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [classes, setClasses] = useState({});
  const [selectedClass, setSelectedClass] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSubmission, setDetailSubmission] = useState(null);
  const [detailQuiz, setDetailQuiz] = useState(null);

  // 获取测验列表
  const fetchQuizzes = async () => {
    try {
      const response = await quizAPI.quizzes.getList();
      if (response.data && Array.isArray(response.data)) {
        setError(null);
        setQuizzes(response.data);
      } else {
        setError('获取测验列表失败，响应数据格式不正确');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        setError('您没有权限查看测验列表，请确认登录状态');
      } else if (error.response?.status === 404) {
        setError('未找到测验数据');
      } else {
        setError(`获取测验列表失败: ${error.message}`);
      }
    }
  };

  // 获取分析数据
  const fetchAnalytics = async (quizId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await quizAPI.analytics.getQuizAnalytics(quizId, selectedClass);
      if (!response.data || !response.data.analytics) {
        setError('返回的分析数据格式不正确');
        setAnalyticsData(null);
        return;
      }
      setAnalyticsData(response.data);
    } catch (error) {
      console.error('获取分析数据失败:', error);
      setError('获取分析数据失败，请稍后重试');
      setAnalyticsData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedQuiz) return;
    try {
      setRefreshing(true);
      const quizId = selectedQuiz._id || selectedQuiz.id || selectedQuiz;
      setLoading(true);
      const response = await quizAPI.analytics.getQuizAnalytics(quizId, selectedClass, 1);
      if (response?.data?.analytics) {
        setAnalyticsData(response.data);
      } else {
        await fetchAnalytics(quizId);
      }
      message.success('分析已刷新');
    } catch (e) {
      message.error('刷新失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await classAPI.getTeacherClasses();
        if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
          setClasses({});
          return;
        }
        const activeClasses = response.data.filter(cls => cls.status !== 'archived');
        
        const groupedClasses = activeClasses.reduce((acc, cls) => {
          if (!acc[cls.grade]) {
            acc[cls.grade] = [];
          }
          acc[cls.grade].push(cls);
          return acc;
        }, {});
        Object.keys(groupedClasses).forEach(grade => {
          groupedClasses[grade].sort((a, b) => Number(a.name) - Number(b.name));
        });
        const sortedGroupedClasses = Object.keys(groupedClasses)
          .sort((a, b) => Number(b) - Number(a))
          .reduce((acc, grade) => {
            acc[grade] = groupedClasses[grade];
            return acc;
          }, {});
        setClasses(sortedGroupedClasses);
      } catch (error) {
        setClasses({});
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedQuiz) {
      fetchAnalytics(selectedQuiz);
    } else {
      setAnalyticsData(null);
    }
  }, [selectedQuiz, selectedClass]);

  // 准备分数分布图表数据
  const getScoreDistributionData = () => {
    if (!analyticsData || !analyticsData.stats.scoreDistribution) return [];
    if (analyticsData.submissions.length === 0) return [];
    return Object.entries(analyticsData.stats.scoreDistribution).map(([range, count]) => ({
      range,
      count
    }));
  };

  // 准备用时分布图表数据
  const getDurationDistributionData = () => {
    if (!analyticsData || !analyticsData.stats.durationDistribution) return [];
    if (analyticsData.submissions.length === 0) return [];
    return Object.entries(analyticsData.stats.durationDistribution).map(([range, count]) => ({
      range: `${range}`,
      count
    }));
  };

  // 获取问题准确率数据
  const getQuestionAccuracyData = () => {
    if (!analyticsData || !analyticsData.analytics || !analyticsData.analytics.questionAnalytics) {
      return [];
    }
    if (analyticsData.submissions.length === 0) return [];
    
    const questionsWithAttempts = analyticsData.analytics.questionAnalytics.filter(
      q => q && typeof q.totalAttempts === 'number' && q.totalAttempts > 0
    );
    
    if (questionsWithAttempts.length === 0) {
      return analyticsData.analytics.questionAnalytics.map((q, index) => ({
        question: `题目${index + 1}`,
        accuracy: 0,
        totalAttempts: 0,
        correctAttempts: 0
      }));
    }
    
    return analyticsData.analytics.questionAnalytics.map((question, index) => {
      if (!question) {
        return {
          question: `题目${index + 1}`,
          accuracy: 0,
          totalAttempts: 0,
          correctAttempts: 0
        };
      }
      
      const totalAttempts = typeof question.totalAttempts === 'number' ? question.totalAttempts : 0;
      const correctAttempts = typeof question.correctAttempts === 'number' ? question.correctAttempts : 0;
      let accuracy = 0;
      if (totalAttempts > 0) {
        accuracy = Math.round((correctAttempts / totalAttempts) * 100);
      }
      
      let questionTitle = `题目${index + 1}`;
      if (question.questionId && analyticsData.questionDetails && analyticsData.questionDetails[question.questionId]) {
        const detail = analyticsData.questionDetails[question.questionId];
        questionTitle = `Q${index + 1}: ${detail.content.substring(0, 10)}${detail.content.length > 10 ? '...' : ''}`;
      }
      
      return {
        question: questionTitle,
        accuracy: Number(accuracy),
        totalAttempts: Number(totalAttempts),
        correctAttempts: Number(correctAttempts),
        questionId: question.questionId
      };
    });
  };

  // 删除测验提交记录
  const handleDeleteSubmission = async (submissionId) => {
    try {
      Modal.confirm({
        title: '确认删除',
        content: '确定要删除此测验提交记录吗？此操作无法撤销，学生将失去相应积分。',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          message.loading({ content: '正在删除...', key: 'deleteSubmission' });
          await quizAPI.submissions.delete(submissionId);
          message.success({ content: '删除成功', key: 'deleteSubmission' });
          if (selectedQuiz) {
            fetchAnalytics(selectedQuiz);
          }
        }
      });
    } catch (error) {
      message.error('删除测验提交记录失败');
    }
  };

  // 导出Excel功能
  const handleExportExcel = async () => {
    if (!selectedQuiz) {
      message.warning('请先选择要导出的测验');
      return;
    }
    try {
      setExporting(true);
      message.loading({ content: '正在生成Excel文件...', key: 'exportExcel' });
      const blob = await quizAPI.submissions.exportToExcel(selectedQuiz, selectedClass);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const selectedQuizData = quizzes.find(q => q._id === selectedQuiz);
      const quizTitle = selectedQuizData ? selectedQuizData.title : '测验记录';
      const classFilter = selectedClass ? `-${getClassName(selectedClass)}` : '';
      const fileName = `${quizTitle}${classFilter}-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      message.success({ content: 'Excel文件导出成功', key: 'exportExcel' });
    } catch (error) {
      message.error({ content: '导出Excel失败，请稍后重试', key: 'exportExcel' });
    } finally {
      setExporting(false);
    }
  };

  // 查看提交详情
  const handleViewSubmission = async (submissionId) => {
    if (!selectedQuiz) {
      message.warning('请先选择测验');
      return;
    }
    try {
      setDetailLoading(true);
      setDetailVisible(true);
      message.loading({ content: '加载答卷详情...', key: 'loadSubmissionDetail' });
      const [subRes, quizRes] = await Promise.all([
        quizAPI.submissions.getById(submissionId),
        quizAPI.quizzes.getById(selectedQuiz)
      ]);
      setDetailSubmission(subRes.data || subRes);
      setDetailQuiz(quizRes.data || quizRes);
      message.success({ content: '加载成功', key: 'loadSubmissionDetail', duration: 1 });
    } catch (e) {
      message.error({ content: '加载提交详情失败', key: 'loadSubmissionDetail' });
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // 表格列定义
  const submissionColumns = [
    {
      title: '学生姓名',
      dataIndex: ['student', 'name'],
      key: 'studentName',
    },
    {
      title: '提交时间',
      dataIndex: 'submitTime',
      key: 'submitTime',
      render: (time) => new Date(time).toLocaleString(),
    },
    {
      title: '得分',
      dataIndex: 'score',
      key: 'score',
      sorter: (a, b) => a.score - b.score,
    },
    {
      title: '用时(秒)',
      key: 'duration',
      render: (record) => {
        const durationInSeconds = (new Date(record.submitTime) - new Date(record.startTime)) / 1000;
        return durationInSeconds.toFixed(1);
      },
    },
    {
      title: '尝试次数',
      dataIndex: 'attemptNumber',
      key: 'attemptNumber',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewSubmission(record.id || record._id)}
            style={{ padding: 0 }}
          >
            查看详情
          </Button>
          <Button 
            type="link" 
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteSubmission(record.id)}
            style={{ padding: 0 }}
          >
            删除
          </Button>
        </Space>
      ),
    }
  ];

  // 心理量表特定的图表数据
  const getDimensionData = () => {
    if (!analyticsData || !analyticsData.dimensionStats) return [];
    return Object.entries(analyticsData.dimensionStats).map(([dimension, stats]) => ({
      dimension,
      average: parseFloat(stats.average.toFixed(2)),
      max: stats.max,
      min: stats.min
    }));
  };

  // 获取状态文本
  const getStatusText = (status) => {
    switch (status) {
      case 'DRAFT': return '草稿';
      case 'PUBLISHED': return '已发布';
      case 'IN_PROGRESS': return '进行中';
      case 'ENDED': return '已结束';
      default: return status;
    }
  };

  // 获取状态颜色
  const getStatusColor = (status) => {
    switch (status) {
      case 'DRAFT': return '#8c8c8c';
      case 'PUBLISHED': return '#4F46E5';
      case 'IN_PROGRESS': return '#059669';
      case 'ENDED': return '#DC2626';
      default: return '#8c8c8c';
    }
  };

  // 获取状态背景色
  const getStatusBgColor = (status) => {
    switch (status) {
      case 'DRAFT': return '#f5f5f5';
      case 'PUBLISHED': return '#EEF2FF';
      case 'IN_PROGRESS': return '#ECFDF5';
      case 'ENDED': return '#FEF2F2';
      default: return '#f5f5f5';
    }
  };

  // 获取班级名称
  const getClassName = (classId) => {
    if (!classId) return null;
    for (const grade in classes) {
      const cls = classes[grade].find(c => c._id === classId);
      if (cls) {
        return `${grade}级${cls.name}班`;
      }
    }
    return '未知班级';
  };

  // ============================================================
  // 渲染：统计卡片组件
  // ============================================================
  const StatCard = ({ icon, title, value, suffix, color, bgGradient }) => (
    <div style={{
      background: bgGradient,
      borderRadius: '12px',
      padding: '20px',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
      minHeight: '100px',
    }}>
      <div style={{
        position: 'absolute',
        right: '-10px',
        top: '-10px',
        fontSize: '72px',
        opacity: 0.1,
        lineHeight: 1,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '13px', opacity: 0.85, marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px' }}>
        {value}
        {suffix && <span style={{ fontSize: '14px', fontWeight: '400', marginLeft: '4px', opacity: 0.8 }}>{suffix}</span>}
      </div>
    </div>
  );

  // ============================================================
  // 渲染：选项条目组件（普通题目）
  // ============================================================
  const OptionItem = ({ option, index, count, percentage, isCorrect, isSurvey }) => {
    const letter = String.fromCharCode(65 + index);
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px',
        backgroundColor: isSurvey ? '#FAFAFA' : (isCorrect ? '#F0FDF4' : '#FAFAFA'),
        borderRadius: '8px',
        border: isSurvey 
          ? '1px solid #E5E7EB' 
          : (isCorrect ? '1px solid #86EFAC' : '1px solid #E5E7EB'),
        marginBottom: '6px',
        transition: 'all 0.2s ease',
        gap: '12px',
      }}>
        {/* 选项字母 */}
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          fontWeight: '600',
          flexShrink: 0,
          backgroundColor: isSurvey ? '#F3F4F6' : (isCorrect ? '#DCFCE7' : '#F3F4F6'),
          color: isSurvey ? '#6B7280' : (isCorrect ? '#16A34A' : '#6B7280'),
          border: isSurvey ? '1px solid #D1D5DB' : (isCorrect ? '1px solid #86EFAC' : '1px solid #D1D5DB'),
        }}>
          {letter}
        </div>
        
        {/* 选项内容 */}
        <div style={{ flex: 1, fontSize: '13px', lineHeight: '1.5', color: '#374151', minWidth: 0 }}>
          <ReactMarkdown 
            components={{
              p: ({ children }) => <span>{children}</span>,
              code: ({ children }) => <code style={{ 
                backgroundColor: '#F3F4F6',
                padding: '1px 4px',
                borderRadius: '3px',
                fontSize: '12px'
              }}>{children}</code>
            }}
          >
            {option.content}
          </ReactMarkdown>
        </div>
        
        {/* 正确/错误标记 */}
        {!isSurvey && (
          <div style={{ flexShrink: 0, fontSize: '14px' }}>
            {isCorrect ? (
              <CheckCircleFilled style={{ color: '#16A34A' }} />
            ) : null}
          </div>
        )}
        
        {/* 进度条+统计 */}
        <div style={{ width: '130px', flexShrink: 0, textAlign: 'right' }}>
          <Progress 
            percent={percentage} 
            size="small" 
            strokeColor={isSurvey ? '#6366F1' : (isCorrect ? '#16A34A' : '#94A3B8')}
            trailColor="#E5E7EB"
            style={{ marginBottom: '2px' }}
            format={() => `${percentage}%`}
          />
          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
            {count}人
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        title={
          <span style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937' }}>
            测验分析
          </span>
        }
        style={{ 
          marginBottom: 24, 
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
        headStyle={{ borderBottom: '1px solid #F3F4F6' }}
        extra={
          <button 
            onClick={fetchQuizzes} 
            style={{ 
              border: 'none', 
              background: 'none', 
              color: '#4F46E5', 
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
            disabled={loading}
          >
            {loading ? '加载中...' : '刷新测验列表'}
          </button>
        }
      >
        <Row gutter={16}>
        <Col span={12}>
          <Select
            style={{ width: '100%', marginBottom: 24 }}
            placeholder="请选择测验"
            onChange={setSelectedQuiz}
            loading={loading}
            disabled={loading}
            optionLabelProp="label"
          >
            {quizzes.map(quiz => (
              <Option 
                key={quiz._id} 
                value={quiz._id}
                label={quiz.title}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{quiz.title}</span>
                  <span style={{ 
                    color: getStatusColor(quiz.status),
                    fontSize: '12px',
                    padding: '0 6px',
                    borderRadius: '10px',
                    backgroundColor: getStatusBgColor(quiz.status)
                  }}>
                    {getStatusText(quiz.status)}
                  </span>
                </div>
              </Option>
            ))}
          </Select>
        </Col>
        <Col span={12}>
          <Select
            style={{ width: '100%', marginBottom: 24 }}
            placeholder="按班级筛选"
            onChange={setSelectedClass}
            allowClear
            value={selectedClass}
          >
            {Object.entries(classes).map(([grade, gradeClasses]) => (
              <Select.OptGroup key={grade} label={`${grade}级`}>
                {gradeClasses.map(cls => (
                  <Option key={cls._id} value={cls._id}>
                    {cls.name}班
                  </Option>
                ))}
              </Select.OptGroup>
            ))}
          </Select>
        </Col>
      </Row>
        {error && (
          <Alert
            message="错误"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 24, borderRadius: '8px' }}
          />
        )}

        {quizzes.length === 0 && !error && !loading && (
          <Alert
            message="提示"
            description="没有找到可分析的测验。请确保系统中存在测验数据。"
            type="info"
            showIcon
            style={{ marginBottom: 24, borderRadius: '8px' }}
          />
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" />
          </div>
        ) : selectedQuiz && analyticsData ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Space>
                <Button 
                  icon={<ReloadOutlined />} 
                  loading={refreshing} 
                  onClick={handleRefresh} 
                  disabled={!selectedQuiz}
                  style={{ borderRadius: '8px' }}
                >
                  刷新分析
                </Button>
                <Button 
                  icon={<DownloadOutlined />} 
                  loading={exporting} 
                  onClick={handleExportExcel} 
                  disabled={!selectedQuiz}
                  style={{ borderRadius: '8px' }}
                >
                  导出Excel
                </Button>
              </Space>
            </div>
          <Tabs defaultActiveKey="overview">
            <TabPane tab="概览" key="overview">
              {selectedClass && analyticsData.submissions.length === 0 ? (
                <Alert
                  message="无数据"
                  description="当前筛选的班级没有提交记录。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 24, borderRadius: '8px' }}
                />
              ) : null}
              
              {/* 统计概览卡片 */}
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}>
                  <StatCard 
                    icon={<TeamOutlined />}
                    title="提交人数"
                    value={analyticsData.stats.totalSubmissions}
                    suffix="人"
                    bgGradient="linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)"
                  />
                </Col>
                <Col span={6}>
                  <StatCard 
                    icon={<RiseOutlined />}
                    title="平均分"
                    value={parseFloat(analyticsData.stats.averageScore.toFixed(1))}
                    suffix="分"
                    bgGradient="linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)"
                  />
                </Col>
                <Col span={6}>
                  <StatCard 
                    icon={<TrophyOutlined />}
                    title="最高分"
                    value={analyticsData.stats.highestScore}
                    suffix="分"
                    bgGradient="linear-gradient(135deg, #059669 0%, #10B981 100%)"
                  />
                </Col>
                <Col span={6}>
                  <StatCard 
                    icon={<FallOutlined />}
                    title="最低分"
                    value={analyticsData.stats.lowestScore}
                    suffix="分"
                    bgGradient="linear-gradient(135deg, #DC2626 0%, #F43F5E 100%)"
                  />
                </Col>
              </Row>

              {/* 图表 */}
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={12}>
                  <Card 
                    title="分数分布" 
                    style={{ borderRadius: '12px', border: '1px solid #E5E7EB' }}
                    headStyle={{ borderBottom: '1px solid #F3F4F6', fontWeight: '600' }}
                  >
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={getScoreDistributionData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis dataKey="range" tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <RechartsTooltip 
                          formatter={(value) => [`${value}人`, '提交人数']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }}
                        />
                        <Bar 
                          dataKey="count" 
                          fill="#6366F1"
                          radius={[4, 4, 0, 0]}
                          animationDuration={500}
                        >
                          {getScoreDistributionData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card 
                    title="用时分布" 
                    style={{ borderRadius: '12px', border: '1px solid #E5E7EB' }}
                    headStyle={{ borderBottom: '1px solid #F3F4F6', fontWeight: '600' }}
                  >
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={getDurationDistributionData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#6B7280' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <RechartsTooltip 
                          formatter={(value) => [`${value}人`, '提交人数']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }}
                        />
                        <Bar 
                          dataKey="count" 
                          fill="#059669"
                          radius={[4, 4, 0, 0]}
                          animationDuration={500}
                        >
                          {getDurationDistributionData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              </Row>

              {/* 题目正确率 */}
              {!analyticsData.analytics.isScaleTest && (
                <Card 
                  title="题目正确率" 
                  style={{ marginBottom: 24, borderRadius: '12px', border: '1px solid #E5E7EB' }}
                  headStyle={{ borderBottom: '1px solid #F3F4F6', fontWeight: '600' }}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getQuestionAccuracyData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="question" tick={{ fontSize: 11, fill: '#6B7280' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <RechartsTooltip 
                        formatter={(value) => [`${value}%`, '正确率']}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }}
                      />
                      <Bar 
                        dataKey="accuracy" 
                        fill="#6366F1"
                        radius={[4, 4, 0, 0]}
                        animationDuration={500}
                      >
                        {getQuestionAccuracyData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.accuracy > 60 ? '#059669' : '#DC2626'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* 维度分析 */}
              {analyticsData.analytics.isScaleTest && (
                <Card 
                  title="维度分析" 
                  style={{ marginBottom: 24, borderRadius: '12px', border: '1px solid #E5E7EB' }}
                  headStyle={{ borderBottom: '1px solid #F3F4F6', fontWeight: '600' }}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getDimensionData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="dimension" tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <RechartsTooltip 
                        formatter={(value) => [`${value}`, '平均值']}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                      />
                      <Bar 
                        dataKey="average" 
                        fill="#6366F1"
                        radius={[4, 4, 0, 0]}
                        animationDuration={500}
                      >
                        {getDimensionData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </TabPane>

            <TabPane tab="题目分析" key="questions">
              {selectedClass && analyticsData.submissions.length === 0 ? (
                <Alert
                  message="无数据"
                  description="当前筛选的班级没有提交记录，无法显示题目分析数据。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 24, borderRadius: '8px' }}
                />
              ) : (
                <>
                  <h3 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#1F2937', 
                    marginBottom: '16px' 
                  }}>
                    题目分析
                    {selectedQuiz && selectedQuiz.isScaleTest ? '（问卷/量表：不显示对错）' : ''}
                  </h3>
                  <Row gutter={[16, 16]}>
                    {analyticsData.analytics.questionAnalytics
                      .filter(question => question && question.questionId)
                      .map((question, index) => {
                        const detail = analyticsData.questionDetails[question.questionId];
                        if (!detail) return null;
                        
                        const totalAttempts = typeof question.totalAttempts === 'number' ? question.totalAttempts : 0;
                        const correctAttempts = typeof question.correctAttempts === 'number' ? question.correctAttempts : 0;
                        const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
                        
                        // 规范化选项分布数据（核心修复）
                        const rawDist = question.optionDistribution || {};
                        const optionDistribution = normalizeOptionDistribution(rawDist, totalAttempts);
                        
                        // 判断是否为量表题目
                        const isScaleQuestion = detail.type === 'PSYCHOLOGICAL_SCALE';
                        const selectedQuizObj = (selectedQuiz && typeof selectedQuiz === 'object')
                          ? selectedQuiz
                          : (Array.isArray(quizzes) ? quizzes.find(q => q && (q._id === selectedQuiz || q.id === selectedQuiz)) : null);
                        const quizIsScaleTest = Boolean(selectedQuizObj && selectedQuizObj.isScaleTest);
                        const treatAsSurveyGlobal = quizIsScaleTest;
                        
                        return (
                          <Col xs={24} sm={24} md={12} lg={12} xl={8} key={question.questionId}>
                            <Card
                              title={
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ 
                                      fontWeight: '700', 
                                      fontSize: '15px',
                                      color: '#1F2937',
                                    }}>
                                      题目 {index + 1}
                                    </span>
                                    {detail.isOrphan && (
                                      <Tag color="orange" style={{ margin: 0, fontSize: '11px', borderRadius: '4px' }}>
                                        已移除
                                      </Tag>
                                    )}
                                    {detail.isDeleted && (
                                      <Tag color="red" style={{ margin: 0, fontSize: '11px', borderRadius: '4px' }}>
                                        已删除
                                      </Tag>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    {isScaleQuestion ? (
                                      <Tag color="purple" style={{ margin: 0, borderRadius: '4px' }}>
                                        量表题目
                                      </Tag>
                                    ) : treatAsSurveyGlobal ? (
                                      <Tag color="blue" style={{ margin: 0, borderRadius: '4px' }}>
                                        问卷
                                      </Tag>
                                    ) : detail.type !== 'UNKNOWN' ? (
                                      <Tag 
                                        color={accuracy > 60 ? 'success' : 'error'} 
                                        style={{ margin: 0, borderRadius: '4px', fontWeight: '600' }}
                                      >
                                        正确率: {accuracy}%
                                      </Tag>
                                    ) : (
                                      <Tag color="default" style={{ margin: 0, borderRadius: '4px' }}>
                                        已删除题目
                                      </Tag>
                                    )}
                                    <Tag 
                                      style={{ 
                                        margin: 0, 
                                        borderRadius: '4px', 
                                        backgroundColor: '#EEF2FF', 
                                        color: '#4F46E5', 
                                        border: '1px solid #C7D2FE',
                                        fontWeight: '500',
                                      }}
                                    >
                                      {totalAttempts}人作答
                                    </Tag>
                                  </div>
                                </div>
                              }
                              style={{ 
                                height: '100%',
                                borderRadius: '12px',
                                border: '1px solid #E5E7EB',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                              }}
                              headStyle={{ 
                                borderBottom: '1px solid #F3F4F6',
                                padding: '12px 16px',
                              }}
                              bodyStyle={{ padding: '16px' }}
                            >
                              {/* 题目内容 */}
                              <div style={{ marginBottom: '16px' }}>
                                <div style={{ 
                                  marginBottom: '14px',
                                  maxHeight: '120px',
                                  overflow: 'auto',
                                  padding: '12px 14px',
                                  backgroundColor: '#F9FAFB',
                                  borderRadius: '8px',
                                  border: '1px solid #E5E7EB',
                                  fontSize: '13px',
                                  lineHeight: '1.6',
                                  color: '#374151',
                                }}>
                                  <ReactMarkdown
                                    components={{
                                      p: ({ children }) => <p style={{ margin: '0 0 6px 0', lineHeight: '1.6' }}>{children}</p>,
                                      strong: ({ children }) => <strong style={{ color: '#4F46E5', fontWeight: '600' }}>{children}</strong>,
                                      em: ({ children }) => <em style={{ color: '#6B7280' }}>{children}</em>,
                                      code: ({ children }) => <code style={{ 
                                        backgroundColor: '#fff',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        border: '1px solid #E5E7EB',
                                        fontFamily: 'Monaco, Consolas, monospace'
                                      }}>{children}</code>,
                                      ul: ({ children }) => <ul style={{ marginLeft: '16px', marginBottom: '6px' }}>{children}</ul>,
                                      ol: ({ children }) => <ol style={{ marginLeft: '16px', marginBottom: '6px' }}>{children}</ol>,
                                      li: ({ children }) => <li style={{ marginBottom: '3px', lineHeight: '1.5' }}>{children}</li>
                                    }}
                                  >
                                    {detail.content}
                                  </ReactMarkdown>
                                </div>
                                
                                {isScaleQuestion ? (
                                  // 量表题目的分析界面
                                  <>
                                    <div style={{ marginBottom: '12px' }}>
                                      <h4 style={{ 
                                        margin: '0 0 8px 0', 
                                        fontSize: '13px', 
                                        color: '#6B7280',
                                        fontWeight: '600'
                                      }}>
                                        评分分布 ({totalAttempts > 0 ? `${totalAttempts}人作答` : '暂无作答'})
                                      </h4>
                                    </div>
                                    
                                    {/* 检查是否为矩阵量表 */}
                                    {(detail.matrixRows && detail.matrixRows.length > 0) || Object.keys(optionDistribution).some(key => key.startsWith('matrix_')) ? (
                                      // 矩阵量表显示
                                      <div style={{ marginBottom: '16px' }}>
                                        <div style={{ 
                                          fontSize: '12px', 
                                          color: '#6B7280', 
                                          marginBottom: '8px' 
                                        }}>
                                          矩阵量表 - 各项目评分分布
                                        </div>
                                        {(() => {
                                          let matrixRows = detail.matrixRows || [];
                                          if (matrixRows.length === 0) {
                                            const matrixKeys = Object.keys(optionDistribution).filter(key => key.startsWith('matrix_'));
                                            const rowIds = [...new Set(matrixKeys.map(key => key.split('_')[1]))];
                                            matrixRows = rowIds.map(id => ({ id, content: id }));
                                          }
                                          
                                          return matrixRows.map((row, rowIdx) => {
                                            // 计算该行平均分
                                            let rowTotalScore = 0;
                                            let rowTotalCount = 0;
                                            for (let s = 1; s <= (detail.scaleLevel || 5); s++) {
                                              const mk = `matrix_${row.id || rowIdx}_${s}`;
                                              const c = safeCount(optionDistribution[mk]);
                                              rowTotalScore += s * c;
                                              rowTotalCount += c;
                                            }
                                            const rowAvg = rowTotalCount > 0 ? (rowTotalScore / rowTotalCount).toFixed(2) : '0.00';
                                            
                                            return (
                                              <div key={row.id || rowIdx} style={{ marginBottom: '12px' }}>
                                                <div style={{ 
                                                  display: 'flex', 
                                                  justifyContent: 'space-between', 
                                                  alignItems: 'center',
                                                  marginBottom: '6px'
                                                }}>
                                                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                                                    {row.content}
                                                  </div>
                                                  <div style={{
                                                    fontSize: '12px',
                                                    color: '#4F46E5',
                                                    fontWeight: '600',
                                                    backgroundColor: '#EEF2FF',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    border: '1px solid #C7D2FE'
                                                  }}>
                                                    平均: {rowAvg}分
                                                  </div>
                                                </div>
                                                <Row gutter={[4, 4]}>
                                                  {Array.from({ length: detail.scaleLevel || 5 }, (_, scaleIdx) => {
                                                    const scaleValue = scaleIdx + 1;
                                                    const matrixKey = `matrix_${row.id || rowIdx}_${scaleValue}`;
                                                    const scaleCount = safeCount(optionDistribution[matrixKey]);
                                                    const scalePct = rowTotalCount > 0 ? Math.round((scaleCount / rowTotalCount) * 100) : 0;
                                                    
                                                    return (
                                                      <Col span={Math.floor(24 / (detail.scaleLevel || 5))} key={scaleValue}>
                                                        <div style={{
                                                          padding: '6px',
                                                          backgroundColor: scaleCount > 0 ? '#EEF2FF' : '#F9FAFB',
                                                          borderRadius: '6px',
                                                          textAlign: 'center',
                                                          border: scaleCount > 0 ? '1px solid #C7D2FE' : '1px solid #E5E7EB',
                                                          fontSize: '11px',
                                                        }}>
                                                          <div style={{ fontWeight: '600', color: '#374151' }}>{scaleValue}分</div>
                                                          <div style={{ color: '#6B7280' }}>{scaleCount}人</div>
                                                          <div style={{ fontSize: '10px', color: '#9CA3AF' }}>{scalePct}%</div>
                                                        </div>
                                                      </Col>
                                                    );
                                                  })}
                                                </Row>
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    ) : (
                                      // 单个量表显示
                                      <>
                                        {Object.keys(optionDistribution).some(key => key.startsWith('scale_') || key.startsWith('matrix_')) ? (
                                          <>
                                            {/* 总体平均分 */}
                                            <div style={{
                                              marginBottom: '12px',
                                              padding: '8px 12px',
                                              backgroundColor: '#EEF2FF',
                                              borderRadius: '8px',
                                              border: '1px solid #C7D2FE',
                                              textAlign: 'center'
                                            }}>
                                              <span style={{
                                                fontSize: '14px',
                                                fontWeight: '600',
                                                color: '#4F46E5'
                                              }}>
                                                总体平均分: {(() => {
                                                  let totalScore = 0;
                                                  let totalCount = 0;
                                                  for (let s = 1; s <= (detail.scaleLevel || 5); s++) {
                                                    const c = safeCount(optionDistribution[`scale_${s}`]);
                                                    totalScore += s * c;
                                                    totalCount += c;
                                                  }
                                                  return totalCount > 0 ? (totalScore / totalCount).toFixed(2) : '0.00';
                                                })()}分
                                              </span>
                                            </div>
                                            <Row gutter={[8, 8]}>
                                              {Array.from({ length: detail.scaleLevel || 5 }, (_, scaleIdx) => {
                                                const scaleValue = scaleIdx + 1;
                                                const scaleKey = `scale_${scaleValue}`;
                                                const scaleCount = safeCount(optionDistribution[scaleKey]);
                                                
                                                // 计算百分比
                                                let scaleTotalCount = 0;
                                                for (let j = 1; j <= (detail.scaleLevel || 5); j++) {
                                                  scaleTotalCount += safeCount(optionDistribution[`scale_${j}`]);
                                                }
                                                const scalePercentage = scaleTotalCount > 0 ? Math.round((scaleCount / scaleTotalCount) * 100) : 0;
                                                
                                                const scaleLabel = detail.scaleLabels && detail.scaleLabels[scaleIdx] 
                                                  ? detail.scaleLabels[scaleIdx] 
                                                  : `${scaleValue}分`;
                                                
                                                return (
                                                  <Col span={Math.floor(24 / (detail.scaleLevel || 5))} key={scaleValue}>
                                                    <div style={{
                                                      padding: '12px',
                                                      backgroundColor: '#F9FAFB',
                                                      borderRadius: '8px',
                                                      textAlign: 'center',
                                                      border: '1px solid #E5E7EB',
                                                    }}>
                                                      <div style={{ 
                                                        fontWeight: '600', 
                                                        color: '#374151',
                                                        marginBottom: '4px',
                                                        fontSize: '13px'
                                                      }}>
                                                        {scaleLabel}
                                                      </div>
                                                      <Progress 
                                                        percent={scalePercentage} 
                                                        size="small" 
                                                        style={{ marginBottom: '4px' }}
                                                        strokeColor="#7C3AED"
                                                      />
                                                      <div style={{ fontSize: '11px', color: '#6B7280' }}>
                                                        {scaleCount}人 ({scalePercentage}%)
                                                      </div>
                                                    </div>
                                                  </Col>
                                                );
                                              })}
                                            </Row>
                                          </>
                                        ) : (
                                          <div style={{
                                            padding: '20px',
                                            textAlign: 'center',
                                            backgroundColor: '#F9FAFB',
                                            borderRadius: '8px',
                                            border: '1px solid #E5E7EB'
                                          }}>
                                            <div style={{ color: '#6B7280', marginBottom: '8px' }}>
                                              暂无量表评分数据
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                                              可能是旧版本提交的数据，请重新提交测验
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </>
                                ) : (
                                  // 普通题目的选项分析
                                  <>
                                    <div style={{ marginBottom: '10px' }}>
                                      <h4 style={{ 
                                        margin: '0 0 8px 0', 
                                        fontSize: '13px', 
                                        color: '#6B7280',
                                        fontWeight: '600'
                                      }}>
                                        {quizIsScaleTest ? '选项选择分布' : '选项分析'} ({totalAttempts > 0 ? `${totalAttempts}人作答` : '暂无作答'})
                                      </h4>
                                    </div>
                                
                                    {detail.options.map((option, idx) => {
                                      const optionCount = safeCount(optionDistribution[option._id]);
                                      const percentage = totalAttempts > 0 ? Math.round((optionCount / totalAttempts) * 100) : 0;
                                      const isCorrect = option.isCorrect;
                                      const isSurvey = quizIsScaleTest || treatAsSurveyGlobal;
                                      
                                      return (
                                        <OptionItem
                                          key={option._id}
                                          option={option}
                                          index={idx}
                                          count={optionCount}
                                          percentage={percentage}
                                          isCorrect={isCorrect}
                                          isSurvey={isSurvey}
                                        />
                                      );
                                    })}
                                  </>
                                )}
                              </div>

                              {/* 底部统计 */}
                              <div style={{
                                borderTop: '1px solid #F3F4F6',
                                paddingTop: '12px',
                                display: 'flex',
                                gap: '24px',
                              }}>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>作答次数</div>
                                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>{totalAttempts}</div>
                                </div>
                                {!(isScaleQuestion || quizIsScaleTest || treatAsSurveyGlobal) && (
                                  <div>
                                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>正确次数</div>
                                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>{correctAttempts}</div>
                                  </div>
                                )}
                              </div>
                            </Card>
                          </Col>
                        );
                      })}
                  </Row>
                </>
              )}
            </TabPane>

            <TabPane tab="提交记录" key="submissions">
              <div style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExportExcel}
                  loading={exporting}
                  disabled={!analyticsData || analyticsData.submissions.length === 0}
                  style={{ borderRadius: '8px' }}
                >
                  导出Excel
                </Button>
                {selectedClass && (
                  <span style={{ marginLeft: 8, color: '#6B7280', fontSize: '12px' }}>
                    （仅导出 {getClassName(selectedClass)} 的记录）
                  </span>
                )}
              </div>
              
              {analyticsData.submissions.length === 0 ? (
                <Alert
                  message="无数据"
                  description={selectedClass ? 
                    `当前筛选的班级没有提交记录。` : 
                    `该测验暂无提交记录。`
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 24, borderRadius: '8px' }}
                />
              ) : (
                <Table 
                  columns={submissionColumns}
                  dataSource={analyticsData.submissions}
                  rowKey="id"
                  style={{ borderRadius: '8px', overflow: 'hidden' }}
                />
              )}
            </TabPane>

          </Tabs>
          {/* 详情弹窗 */}
          <Modal
            title="答卷详情"
            open={detailVisible}
            onCancel={() => setDetailVisible(false)}
            footer={null}
            width={920}
            destroyOnClose
          >
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Spin />
              </div>
            ) : detailSubmission && detailQuiz ? (
              <QuizResult
                submission={detailSubmission}
                quiz={{
                  ...detailQuiz,
                  questions: (detailQuiz.questions || []).map(q => {
                    const obj = typeof q.questionId === 'object' && q.questionId !== null ? q.questionId : {};
                    return {
                      ...obj,
                      _id: q._id,
                      order: q.order,
                      options: obj.options || [],
                      originalQuestionId: obj._id || q.questionId
                    };
                  })
                }}
                settings={{ showAnswerAfterSubmit: true, showScoreAfterSubmit: true }}
                answerLabel="学生答案"
                mode="preview"
              />
            ) : (
              <Empty description="无详情数据" />
            )}
          </Modal>
          </>
        ) : (
          quizzes.length > 0 && !error && <Empty description="请选择要分析的测验" />
        )}
      </Card>
    </div>
  );
};

export default QuizAnalysis;