import React, { useState, useEffect } from 'react';
import { 
  Card, Spin, Alert, Row, Col, Table, Button, Typography, 
  Statistic, Progress, Tabs, Select, Tag
} from 'antd';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { 
  UserOutlined, FileTextOutlined, 
  FormOutlined, FileSearchOutlined, EyeOutlined, TrophyOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { learningStatsAPI, classAPI } from '../../services/api';
import usePageTitle from '../../hooks/usePageTitle';

const { TabPane } = Tabs;
const { Title, Text } = Typography;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const ClassLearningStatsComponent = ({ 
  classId, 
  onViewStudentStats, 
  onViewDailyScores, 
  hideHeader = false 
}) => {
  usePageTitle('班级学习统计');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [className, setClassName] = useState('');
  const [studentsStats, setStudentsStats] = useState([]);
  const [selectedTab, setSelectedTab] = useState('overview');
  
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
    
    const fetchClassLearningStats = async () => {
      setLoading(true);
      try {
        const response = await learningStatsAPI.getClassLearningStats(classId);
        if (response.success) {
          setStudentsStats(response.data);
          setError(null);
        }
      } catch (err) {
        console.error('获取班级学习统计失败:', err);
        setError('获取班级学习统计数据失败，请稍后再试');
      } finally {
        setLoading(false);
      }
    };
    
    fetchClassInfo();
    fetchClassLearningStats();
  }, [classId]);
  
  const handleTabChange = (key) => {
    setSelectedTab(key);
  };
  
  const handleViewStudentStatsInternal = (studentId) => {
    if (onViewStudentStats) {
      onViewStudentStats(studentId);
    }
  };
  
  const handleViewDailyScoresInternal = () => {
    if (onViewDailyScores) {
      onViewDailyScores();
    }
  };
  
  const renderOverview = () => {
    if (studentsStats.length === 0) return <Alert message="暂无班级学习数据" type="info" />;
    
    // 计算汇总统计
    const summary = studentsStats.reduce((acc, curr) => {
      acc.typingTotalRecords += curr.typing.totalRecords || 0;
      acc.typingTotalPassedCount += curr.typing.totalPassedCount || 0;
      acc.quizTotalSubmissions += curr.quiz.totalSubmissions || 0;
      acc.assignmentTotalSubmissions += curr.assignment.totalSubmissions || 0;
      acc.assignmentGradedSubmissions += curr.assignment.gradedSubmissions || 0;
      
      // 计算平均值的累加
      if (curr.typing.totalRecords > 0) {
        acc.typingAvgSpeedSum += curr.typing.averageSpeed || 0;
        acc.typingAvgAccuracySum += curr.typing.averageAccuracy || 0;
        acc.typingStudentCount++;
      }
      
      if (curr.quiz.totalSubmissions > 0) {
        acc.quizAvgScoreSum += curr.quiz.averageScore || 0;
        acc.quizStudentCount++;
      }
      
      if (curr.assignment.gradedSubmissions > 0) {
        acc.assignmentAvgScoreSum += curr.assignment.averageScore || 0;
        acc.assignmentStudentCount++;
      }
      
      return acc;
    }, {
      typingTotalRecords: 0,
      typingTotalPassedCount: 0,
      typingAvgSpeedSum: 0,
      typingAvgAccuracySum: 0,
      typingStudentCount: 0,
      quizTotalSubmissions: 0,
      quizAvgScoreSum: 0,
      quizStudentCount: 0,
      assignmentTotalSubmissions: 0,
      assignmentGradedSubmissions: 0,
      assignmentAvgScoreSum: 0,
      assignmentStudentCount: 0
    });
    
    // 构造饼图数据
    const typingDistribution = [
      { name: '已达标', value: summary.typingTotalPassedCount },
      { name: '未达标', value: summary.typingTotalRecords - summary.typingTotalPassedCount }
    ];
    
    const assignmentDistribution = [
      { name: '已批阅', value: summary.assignmentGradedSubmissions },
      { name: '未批阅', value: summary.assignmentTotalSubmissions - summary.assignmentGradedSubmissions }
    ];
    
    return (
      <div className="overview-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ width: '100%', textAlign: 'right' }}>
            <Button 
              type="primary"
              icon={<TrophyOutlined />}
              onClick={handleViewDailyScoresInternal}
              style={{ marginRight: 8 }}
            >
              查看平日成绩
            </Button>
          </div>
        </div>
        
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={24} sm={8}>
            <Card title="打字练习汇总" className="stat-card" bordered={false}>
              <Statistic 
                title="总记录数" 
                value={summary.typingTotalRecords} 
                prefix={<FileTextOutlined />} 
              />
              <Statistic 
                title="平均速度" 
                value={summary.typingStudentCount > 0 ? Math.round(summary.typingAvgSpeedSum / summary.typingStudentCount) : 0} 
                suffix="字/分钟"
                style={{ margin: '20px 0' }}
              />
              <Statistic 
                title="平均准确率" 
                value={summary.typingStudentCount > 0 ? Math.round(summary.typingAvgAccuracySum / summary.typingStudentCount * 100) / 100 : 0} 
                suffix="%" 
              />
              <div style={{ marginTop: 20 }}>
                <Text>达标率:</Text>
                <Progress 
                  percent={summary.typingTotalRecords > 0 
                    ? Math.round(summary.typingTotalPassedCount / summary.typingTotalRecords * 100) 
                    : 0
                  } 
                />
              </div>
            </Card>
          </Col>
          
          <Col xs={24} sm={8}>
            <Card title="测验完成汇总" className="stat-card" bordered={false}>
              <Statistic 
                title="总提交次数" 
                value={summary.quizTotalSubmissions} 
                prefix={<FormOutlined />} 
              />
              <Statistic 
                title="平均分数" 
                value={summary.quizStudentCount > 0 ? Math.round(summary.quizAvgScoreSum / summary.quizStudentCount * 100) / 100 : 0} 
                suffix="分"
                style={{ margin: '20px 0' }} 
              />
              <div style={{ marginTop: 20 }}>
                <Text>平均参与率:</Text>
                <Progress 
                  percent={studentsStats.length > 0 
                    ? Math.round(summary.quizStudentCount / studentsStats.length * 100) 
                    : 0
                  } 
                />
              </div>
            </Card>
          </Col>
          
          <Col xs={24} sm={8}>
            <Card title="作业提交汇总" className="stat-card" bordered={false}>
              <Statistic 
                title="总提交次数" 
                value={summary.assignmentTotalSubmissions} 
                prefix={<FileSearchOutlined />} 
              />
              <Statistic 
                title="已批阅数量" 
                value={summary.assignmentGradedSubmissions} 
                style={{ margin: '20px 0' }} 
              />
              <Statistic 
                title="平均分数" 
                value={summary.assignmentStudentCount > 0 ? Math.round(summary.assignmentAvgScoreSum / summary.assignmentStudentCount * 100) / 100 : 0} 
                suffix="分"
              />
            </Card>
          </Col>
        </Row>
        
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12}>
            <Card title="打字练习达标情况">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={typingDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {typingDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          
          <Col xs={24} sm={12}>
            <Card title="作业批阅情况">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={assignmentDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {assignmentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
        
        <div style={{ marginTop: 24 }}>
          <Alert 
            message="班级学习情况分析" 
            description={`班级共有${studentsStats.length}名学生，总共完成了${summary.typingTotalRecords}次打字练习，提交了${summary.quizTotalSubmissions}次测验和${summary.assignmentTotalSubmissions}次作业。`} 
            type="info" 
            showIcon 
          />
        </div>
      </div>
    );
  };
  
  const renderTypingStats = () => {
    if (studentsStats.length === 0) return <Alert message="暂无打字记录数据" type="info" />;
    
    // 准备表格数据
    const tableData = studentsStats.map(stat => ({
      key: stat.student.id,
      studentId: stat.student.id,
      name: stat.student.name,
      username: stat.student.username,
      totalRecords: stat.typing.totalRecords,
      averageSpeed: stat.typing.averageSpeed,
      averageAccuracy: stat.typing.averageAccuracy,
      totalPassedCount: stat.typing.totalPassedCount,
      passRate: stat.typing.totalRecords > 0 
        ? Math.round(stat.typing.totalPassedCount / stat.typing.totalRecords * 100) 
        : 0
    }));
    
    // 准备柱状图数据
    const chartData = tableData
      .filter(student => student.totalRecords > 0)
      .sort((a, b) => b.averageSpeed - a.averageSpeed)
      .slice(0, 10)
      .map(student => ({
        name: student.name,
        averageSpeed: student.averageSpeed,
        averageAccuracy: student.averageAccuracy
      }));
    
    const columns = [
      {
        title: '学生姓名',
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <span>
            {text} ({record.username})
          </span>
        ),
      },
      {
        title: '练习次数',
        dataIndex: 'totalRecords',
        key: 'totalRecords',
        sorter: (a, b) => a.totalRecords - b.totalRecords,
      },
      {
        title: '平均速度',
        dataIndex: 'averageSpeed',
        key: 'averageSpeed',
        render: (speed) => `${speed} 字/分钟`,
        sorter: (a, b) => a.averageSpeed - b.averageSpeed,
      },
      {
        title: '平均准确率',
        dataIndex: 'averageAccuracy',
        key: 'averageAccuracy',
        render: (accuracy) => `${accuracy}%`,
        sorter: (a, b) => a.averageAccuracy - b.averageAccuracy,
      },
      {
        title: '达标次数',
        dataIndex: 'totalPassedCount',
        key: 'totalPassedCount',
        sorter: (a, b) => a.totalPassedCount - b.totalPassedCount,
      },
      {
        title: '达标率',
        dataIndex: 'passRate',
        key: 'passRate',
        render: (rate) => <Progress percent={rate} size="small" />,
        sorter: (a, b) => a.passRate - b.passRate,
      },
      {
        title: '操作',
        key: 'action',
        render: (_, record) => (
          <Button 
            type="link" 
            icon={<EyeOutlined />} 
            onClick={() => handleViewStudentStatsInternal(record.studentId)}
          >
            查看详情
          </Button>
        ),
      },
    ];
    
    return (
      <div className="typing-stats-container">
        <Card title="打字速度排行榜 (Top 10)" style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="averageSpeed" name="平均速度(字/分钟)" fill="#8884d8" />
              <Bar dataKey="averageAccuracy" name="平均准确率(%)" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        
        <Card title="班级打字练习统计">
          <Table 
            columns={columns} 
            dataSource={tableData}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
          />
        </Card>
      </div>
    );
  };
  
  const renderQuizStats = () => {
    if (studentsStats.length === 0) return <Alert message="暂无测验数据" type="info" />;
    
    // 准备表格数据
    const tableData = studentsStats.map(stat => ({
      key: stat.student.id,
      studentId: stat.student.id,
      name: stat.student.name,
      username: stat.student.username,
      totalSubmissions: stat.quiz.totalSubmissions,
      averageScore: stat.quiz.averageScore,
    }));
    
    // 准备柱状图数据
    const chartData = tableData
      .filter(student => student.totalSubmissions > 0)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10)
      .map(student => ({
        name: student.name,
        averageScore: student.averageScore
      }));
    
    const columns = [
      {
        title: '学生姓名',
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <span>
            {text} ({record.username})
          </span>
        ),
      },
      {
        title: '提交次数',
        dataIndex: 'totalSubmissions',
        key: 'totalSubmissions',
        sorter: (a, b) => a.totalSubmissions - b.totalSubmissions,
      },
      {
        title: '平均分数',
        dataIndex: 'averageScore',
        key: 'averageScore',
        render: (score) => `${score} 分`,
        sorter: (a, b) => a.averageScore - b.averageScore,
      },
      {
        title: '分数级别',
        key: 'scoreLevel',
        render: (_, record) => {
          const score = record.averageScore;
          let color = 'green';
          let text = '优秀';
          
          if (score < 60) {
            color = 'red';
            text = '不及格';
          } else if (score < 75) {
            color = 'orange';
            text = '及格';
          } else if (score < 85) {
            color = 'blue';
            text = '良好';
          }
          
          return <Tag color={color}>{text}</Tag>;
        },
      },
      {
        title: '操作',
        key: 'action',
        render: (_, record) => (
          <Button 
            type="link" 
            icon={<EyeOutlined />} 
            onClick={() => handleViewStudentStatsInternal(record.studentId)}
          >
            查看详情
          </Button>
        ),
      },
    ];
    
    return (
      <div className="quiz-stats-container">
        <Card title="测验分数排行榜 (Top 10)" style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="averageScore" name="平均分数" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        
        <Card title="班级测验统计">
          <Table 
            columns={columns} 
            dataSource={tableData}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
          />
        </Card>
      </div>
    );
  };
  
  const renderAssignmentStats = () => {
    if (studentsStats.length === 0) return <Alert message="暂无作业数据" type="info" />;
    
    // 准备表格数据
    const tableData = studentsStats.map(stat => ({
      key: stat.student.id,
      studentId: stat.student.id,
      name: stat.student.name,
      username: stat.student.username,
      totalSubmissions: stat.assignment.totalSubmissions,
      gradedSubmissions: stat.assignment.gradedSubmissions,
      averageScore: stat.assignment.averageScore,
      gradedRate: stat.assignment.totalSubmissions > 0 
        ? Math.round(stat.assignment.gradedSubmissions / stat.assignment.totalSubmissions * 100) 
        : 0
    }));
    
    // 准备柱状图数据
    const chartData = tableData
      .filter(student => student.gradedSubmissions > 0)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10)
      .map(student => ({
        name: student.name,
        averageScore: student.averageScore
      }));
    
    const columns = [
      {
        title: '学生姓名',
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <span>
            {text} ({record.username})
          </span>
        ),
      },
      {
        title: '提交次数',
        dataIndex: 'totalSubmissions',
        key: 'totalSubmissions',
        sorter: (a, b) => a.totalSubmissions - b.totalSubmissions,
      },
      {
        title: '已批阅数',
        dataIndex: 'gradedSubmissions',
        key: 'gradedSubmissions',
        sorter: (a, b) => a.gradedSubmissions - b.gradedSubmissions,
      },
      {
        title: '批阅率',
        dataIndex: 'gradedRate',
        key: 'gradedRate',
        render: (rate) => <Progress percent={rate} size="small" />,
        sorter: (a, b) => a.gradedRate - b.gradedRate,
      },
      {
        title: '平均分数',
        dataIndex: 'averageScore',
        key: 'averageScore',
        render: (score) => score ? `${score} 分` : '暂无评分',
        sorter: (a, b) => (a.averageScore || 0) - (b.averageScore || 0),
      },
      {
        title: '操作',
        key: 'action',
        render: (_, record) => (
          <Button 
            type="link" 
            icon={<EyeOutlined />} 
            onClick={() => handleViewStudentStatsInternal(record.studentId)}
          >
            查看详情
          </Button>
        ),
      },
    ];
    
    return (
      <div className="assignment-stats-container">
        <Card title="作业分数排行榜 (Top 10)" style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="averageScore" name="平均分数" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        
        <Card title="班级作业统计">
          <Table 
            columns={columns} 
            dataSource={tableData}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
          />
        </Card>
      </div>
    );
  };
  
  return (
    <div className="class-learning-stats-container">
      {!hideHeader && (
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3}>{className || '班级'} 学习统计</Title>
          <div>
            <Button 
              type="primary"
              icon={<TrophyOutlined />}
              onClick={handleViewDailyScoresInternal}
              style={{ marginRight: 8 }}
            >
              查看平日成绩
            </Button>
          </div>
        </div>
      )}
      
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      
      <Card>
        <Tabs activeKey={selectedTab} onChange={handleTabChange}>
          <TabPane tab={<span><DashboardOutlined /> 班级概览</span>} key="overview">
            {loading ? <Spin tip="加载中..." /> : renderOverview()}
          </TabPane>
          
          <TabPane tab={<span><FileTextOutlined /> 打字统计</span>} key="typing">
            {loading ? <Spin tip="加载中..." /> : renderTypingStats()}
          </TabPane>
          
          <TabPane tab={<span><FormOutlined /> 测验统计</span>} key="quiz">
            {loading ? <Spin tip="加载中..." /> : renderQuizStats()}
          </TabPane>
          
          <TabPane tab={<span><FileSearchOutlined /> 作业统计</span>} key="assignment">
            {loading ? <Spin tip="加载中..." /> : renderAssignmentStats()}
          </TabPane>
        </Tabs>
      </Card>
      
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={5}>学生学习表现统计</Title>
          <Text type="secondary">点击学生行查看详细学习数据</Text>
        </div>
        <Table 
          columns={[
            {
              title: '学生姓名',
              dataIndex: ['student', 'name'],
              key: 'name',
              sorter: (a, b) => a.student.name.localeCompare(b.student.name)
            },
            {
              title: '打字记录数',
              dataIndex: ['typing', 'totalRecords'],
              key: 'typingRecords',
              sorter: (a, b) => a.typing.totalRecords - b.typing.totalRecords
            },
            {
              title: '平均打字速度',
              dataIndex: ['typing', 'averageSpeed'],
              key: 'typingSpeed',
              render: speed => `${speed} 字/分钟`,
              sorter: (a, b) => a.typing.averageSpeed - b.typing.averageSpeed
            },
            {
              title: '测验提交数',
              dataIndex: ['quiz', 'totalSubmissions'],
              key: 'quizSubmissions',
              sorter: (a, b) => a.quiz.totalSubmissions - b.quiz.totalSubmissions
            },
            {
              title: '测验平均分',
              dataIndex: ['quiz', 'averageScore'],
              key: 'quizScore',
              render: score => `${score} 分`,
              sorter: (a, b) => a.quiz.averageScore - b.quiz.averageScore
            },
            {
              title: '作业提交数',
              dataIndex: ['assignment', 'totalSubmissions'],
              key: 'assignmentSubmissions',
              sorter: (a, b) => a.assignment.totalSubmissions - b.assignment.totalSubmissions
            },
            {
              title: '操作',
              key: 'action',
              render: (_, record) => (
                <Button 
                  type="link" 
                  icon={<EyeOutlined />} 
                  onClick={() => handleViewStudentStatsInternal(record.student.id)}
                >
                  查看详情
                </Button>
              )
            }
          ]}
          dataSource={studentsStats.map(student => ({
            ...student,
            key: student.student.id
          }))}
          pagination={{ pageSize: 10 }}
          onRow={(record) => ({
            onClick: () => handleViewStudentStatsInternal(record.student.id),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>
      
      <div className="page-footer" style={{ margin: '16px 0', textAlign: 'center' }}>
        <Text type="secondary">统计数据每日更新，仅供参考</Text>
      </div>
      
      <style jsx>{`
        .stat-card {
          height: 100%;
        }
      `}</style>
    </div>
  );
};

export default ClassLearningStatsComponent;