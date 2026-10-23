import React, { useState, useEffect } from 'react';
import {
  Card, Spin, Alert, Row, Col, Table, Button, Typography,
  Statistic, Progress, Tag, Tooltip, message
} from 'antd';
import {
  UserOutlined, FormOutlined, FileSearchOutlined, EyeOutlined,
  BarChartOutlined, TrophyOutlined, DownloadOutlined, CalendarOutlined
} from '@ant-design/icons';
import { learningStatsAPI, classAPI } from '../../services/api';
import usePageTitle from '../../hooks/usePageTitle';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const { Title, Text } = Typography;
const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1'];

const ClassDailyScoresComponent = ({ classId, onViewStudentScore, hideHeader = false, semester }) => {
  usePageTitle('班级平日成绩');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [className, setClassName] = useState('');
  const [dailyScores, setDailyScores] = useState(null);
  const [semesterLabel, setSemesterLabel] = useState('');

  useEffect(() => {
    const fetchClassInfo = async () => {
      try {
        const response = await classAPI.getClassDetails(classId);
        if (response.success) {
          setClassName(response.data.name);
        }
      } catch (err) {
        console.error('获取班级信息失败:', err);
      }
    };

    const fetchClassDailyScores = async () => {
      setLoading(true);
      try {
        // 传递学期参数
        const response = await learningStatsAPI.getClassDailyScores(classId, { semester });
        if (response.success) {
          setDailyScores(response.data);

          // 设置学期标签
          if (response.data?.classStats?.semester) {
            setSemesterLabel(formatSemesterLabel(response.data.classStats.semester));
          } else {
            setSemesterLabel('全部学期');
          }

          setError(null);
        }
      } catch (err) {
        console.error('获取班级平日成绩失败:', err);
        setError('获取班级平日成绩数据失败，请稍后再试');
      } finally {
        setLoading(false);
      }
    };

    fetchClassInfo();
    fetchClassDailyScores();
  }, [classId, semester]);

  // 格式化学期标签显示
  const formatSemesterLabel = (semesterValue) => {
    if (!semesterValue || semesterValue === '全部学期') return '全部学期';

    try {
      const parts = semesterValue.split('-');
      if (parts.length === 3) {
        const academicYear = `${parts[0]}-${parts[1]}`;
        const semesterNum = parts[2];
        return `${academicYear} 学年 第${semesterNum}学期`;
      }
      return semesterValue;
    } catch (err) {
      console.error('格式化学期标签出错:', err);
      return semesterValue;
    }
  };

  const handleViewStudentScore = (studentId) => {
    if (onViewStudentScore) {
      onViewStudentScore(studentId);
    }
  };

  // 导出成绩为CSV文件
  const exportToCSV = () => {
    if (!dailyScores || !dailyScores.studentsScores || dailyScores.studentsScores.length === 0) {
      message.error('没有可导出的成绩数据');
      return;
    }

    try {
      // CSV表头
      const headers = [
        '学号',
        '姓名',
        '平日成绩',
        '成绩等级',
        '是否及格',
        '打字成绩',
        '打字记录数',
        '作业成绩',
        '作业提交数',
        '测验成绩',
        '测验完成数'
      ];

      // 准备CSV内容
      const csvContent = dailyScores.studentsScores.map(student => [
        `"${student.student.username}"`,
        `"${student.student.name}"`,
        student.dailyScore,
        `"${student.grade || '-'}"`,
        `"${student.isPassing ? '是' : '否'}"`,
        student.typing.score,
        student.typing.count || 0,
        student.assignment.score,
        student.assignment.count || 0,
        student.quiz.score,
        student.quiz.count || 0
      ]);

      // 生成CSV内容
      let csv = '';

      // 添加表头
      csv += headers.map(header => `"${header}"`).join(',') + '\n';

      // 添加学生数据
      csvContent.forEach(row => {
        csv += row.join(',') + '\n';
      });

      // 创建Blob对象 - 添加BOM标记使Excel正确识别UTF-8编码
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);

      // 格式化日期时间作为文件名的一部分
      const now = new Date();
      const dateStr = now.toLocaleDateString('zh-CN').replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false }).replace(/:/g, '');

      link.setAttribute('download', `${className}平日成绩_${dateStr}_${timeStr}.csv`);
      document.body.appendChild(link);

      // 触发下载
      link.click();

      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      message.success('成绩数据导出成功');
    } catch (error) {
      console.error('导出CSV失败：', error);
      message.error('导出失败，请重试');
    }
  };

  // 根据分数获取对应的颜色
  const getScoreColor = (score) => {
    if (score >= 90) return '#52c41a';
    if (score >= 80) return '#1890ff';
    if (score >= 70) return '#faad14';
    if (score >= 60) return '#fa8c16';
    return '#f5222d';
  };

  // 根据分数获取对应的标签
  const getScoreTag = (score) => {
    if (score >= 90) return <Tag color="success">优秀</Tag>;
    if (score >= 80) return <Tag color="processing">良好</Tag>;
    if (score >= 70) return <Tag color="warning">中等</Tag>;
    if (score >= 60) return <Tag color="orange">及格</Tag>;
    return <Tag color="error">不及格</Tag>;
  };

  // 获取等级对应的颜色
  const getGradeColor = (grade) => {
    if (grade === 'A+' || grade === 'A') return 'success';
    if (grade === 'B+' || grade === 'B') return 'processing';
    if (grade === 'C+' || grade === 'C') return 'warning';
    if (grade === 'D') return 'orange';
    if (grade === 'F') return 'error';
    return 'default';
  };

  // 准备成绩分布数据
  const prepareDistributionData = () => {
    if (!dailyScores || !dailyScores.classStats || !dailyScores.studentsScores) return [];

    // 使用新的成绩等级分布
    if (dailyScores.classStats.grades) {
      return [
        { range: 'A+', count: dailyScores.classStats.grades['A+'] || 0 },
        { range: 'A', count: dailyScores.classStats.grades['A'] || 0 },
        { range: 'B+', count: dailyScores.classStats.grades['B+'] || 0 },
        { range: 'B', count: dailyScores.classStats.grades['B'] || 0 },
        { range: 'C+', count: dailyScores.classStats.grades['C+'] || 0 },
        { range: 'C', count: dailyScores.classStats.grades['C'] || 0 },
        { range: 'D', count: dailyScores.classStats.grades['D'] || 0 },
        { range: 'F', count: dailyScores.classStats.grades['F'] || 0 }
      ].filter(item => item.count > 0).map(item => ({
        ...item,
        percentage: Math.round((item.count / dailyScores.studentsScores.length) * 100)
      }));
    }

    // 兼容旧数据结构
    return [];
  };

  // 准备各部分成绩平均分数据
  const prepareComponentsData = () => {
    if (!dailyScores || !dailyScores.studentsScores) return [];
    const len = dailyScores.studentsScores.length;

    const avgTyping = dailyScores.studentsScores.reduce((sum, s) => sum + (s.typing?.score || 0), 0) / len;
    const avgQuiz = dailyScores.studentsScores.reduce((sum, s) => sum + (s.quiz?.score || 0), 0) / len;
    const avgActivity = dailyScores.studentsScores.reduce((sum, s) => {
      return sum + (s.assignment?.score || 0) + (s.flowchart?.score || 0) +
        (s.python?.score || 0) + (s.fillblank?.score || 0) + (s.spreadsheet?.score || 0);
    }, 0) / len;

    return [
      { name: '打字', value: Math.round(avgTyping * 10) / 10 },
      { name: '活动', value: Math.round(avgActivity * 10) / 10 },
      { name: '测验', value: Math.round(avgQuiz * 10) / 10 }
    ];
  };

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      fixed: 'left',
      width: 70,
      render: (rank) => (
        <Tag color={rank <= 3 ? 'gold' : 'default'}>
          {rank}
        </Tag>
      )
    },
    {
      title: '学生',
      dataIndex: ['student', 'name'],
      key: 'name',
      fixed: 'left',
      width: 120
    },
    {
      title: '平日成绩',
      dataIndex: 'dailyScore',
      key: 'dailyScore',
      sorter: (a, b) => a.dailyScore - b.dailyScore,
      sortDirections: ['descend', 'ascend'],
      defaultSortOrder: 'descend',
      width: 140,
      render: (score, record) => (
        <div>
          <span style={{ color: getScoreColor(score), fontWeight: 'bold', marginRight: 8 }}>
            {score}
          </span>
          {record.grade ? (
            <Tag color={getGradeColor(record.grade)}>
              {record.grade}
            </Tag>
          ) : (
            getScoreTag(score)
          )}
        </div>
      )
    },
    {
      title: '打字成绩',
      dataIndex: ['typing', 'score'],
      key: 'typingScore',
      width: 140,
      sorter: (a, b) => a.typing.score - b.typing.score,
      render: (score, record) => (
        <Tooltip title={`打字记录数: ${record.typing.count || 0}`}>
          <div>
            <span style={{ color: getScoreColor(score) }}>{score}</span>
            <div style={{ color: '#888', fontSize: '12px' }}>
              记录数: {record.typing.count || 0}
            </div>
          </div>
        </Tooltip>
      )
    },
    {
      title: '作业成绩',
      dataIndex: ['assignment', 'score'],
      key: 'assignmentScore',
      width: 140,
      sorter: (a, b) => a.assignment.score - b.assignment.score,
      render: (score, record) => (
        <Tooltip title={`作业提交数: ${record.assignment.count || 0}`}>
          <div>
            <span style={{ color: getScoreColor(score) }}>{score}</span>
            <div style={{ color: '#888', fontSize: '12px' }}>
              提交数: {record.assignment.count || 0}
            </div>
          </div>
        </Tooltip>
      )
    },
    {
      title: '测验成绩',
      dataIndex: ['quiz', 'score'],
      key: 'quizScore',
      width: 140,
      sorter: (a, b) => a.quiz.score - b.quiz.score,
      render: (score, record) => (
        <Tooltip title={`测验完成数: ${record.quiz.count || 0}`}>
          <div>
            <span style={{ color: getScoreColor(score) }}>{score}</span>
            <div style={{ color: '#888', fontSize: '12px' }}>
              完成数: {record.quiz.count || 0}
            </div>
          </div>
        </Tooltip>
      )
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewStudentScore(record.student.id)}
        >
          详情
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <Card>
          <Spin tip="加载中...">
            <div style={{ minHeight: '300px' }} />
          </Spin>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert message={error} type="error" />
      </div>
    );
  }

  if (!dailyScores) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert message="暂无班级平日成绩数据" type="info" />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {!hideHeader && (
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ display: 'inline-block', margin: 0 }}>
              {className} - 平日成绩统计
            </Title>
            {semesterLabel && (
              <Tag color="blue" style={{ marginLeft: 10 }}>
                <CalendarOutlined /> {semesterLabel}
              </Tag>
            )}
          </div>
          <div>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={exportToCSV}
              disabled={!dailyScores || !dailyScores.studentsScores || dailyScores.studentsScores.length === 0}
            >
              导出CSV
            </Button>
          </div>
        </div>
      )}

      {/* 左右排布主体内容 */}
      <Row gutter={[16, 16]}>
        {/* 左侧统计卡片，从上到下排布 */}
        <Col xs={24} lg={8}>
          {/* 班级平均成绩 */}
          <Card title="班级平均成绩" bordered={false} style={{ marginBottom: '16px' }}>
            <Statistic
              title="平均平日成绩"
              value={dailyScores.classStats.avgScore}
              precision={1}
              valueStyle={{ color: getScoreColor(dailyScores.classStats.avgScore) }}
              prefix={<TrophyOutlined />}
              suffix="分"
            />
            <div style={{ marginTop: '20px' }}>
              <Text>学生总数: {dailyScores.classStats.totalStudents} 人</Text>
              <br />
              <Text>及格人数: {dailyScores.classStats.passingCount} 人</Text>
              <br />
              <Text>标准差: {dailyScores.classStats.stdDev.toFixed(2)}</Text>
            </div>
          </Card>

          {/* 各部分平均分 */}
          <Card title="各部分平均分" bordered={false} style={{ marginBottom: '16px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={prepareComponentsData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 'auto']} />
                <RechartsTooltip formatter={(value) => [`${value.toFixed(1)}分`, '分数']} />
                <Bar dataKey="value" fill="#1890ff">
                  {prepareComponentsData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <Text type="secondary">各类活动成绩总和</Text>
            </div>
          </Card>

          {/* 成绩等级分布 */}
          <Card title="成绩等级分布" bordered={false}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={prepareDistributionData()}
                  dataKey="count"
                  nameKey="range"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ range, percentage }) => `${range}: ${percentage}%`}
                >
                  {prepareDistributionData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value, name) => [value, `${name}`]} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 右侧表格 */}
        <Col xs={24} lg={16}>
          <Card title="学生平日成绩列表" bordered={false}>
            <div style={{ marginBottom: '16px' }}>
              <Text type="secondary">
                计算方式：各类活动成绩之和（打字、作业、测验、流程图、Python、填空、表格），每个活动只取最高分
              </Text>
            </div>
            <Table
              columns={columns}
              dataSource={dailyScores.studentsScores}
              rowKey={record => record.student.id}
              pagination={{ pageSize: 15 }}
              scroll={{ x: 880, y: 600 }}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ClassDailyScoresComponent; 