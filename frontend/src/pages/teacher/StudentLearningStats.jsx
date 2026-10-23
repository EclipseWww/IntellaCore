import React, { useState, useEffect } from 'react';
import { Card, Tabs, Spin, Alert, Row, Col, Statistic, Table, Select, Button, Typography } from 'antd';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  UserOutlined, FileTextOutlined, FormOutlined, FileSearchOutlined, 
  TrophyOutlined, DashboardOutlined
} from '@ant-design/icons';
import { learningStatsAPI, classAPI } from '../../services/api';
import usePageTitle from '../../hooks/usePageTitle';

const { TabPane } = Tabs;
const { Title, Text } = Typography;
const { Option } = Select;

const StudentLearningStatsComponent = ({ 
  studentId,
  classId,
  className = '',
  students = [],
  onStudentChange,
  onViewDailyScore,
  hideHeader = false
}) => {
  usePageTitle('学生学习统计');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typingStats, setTypingStats] = useState(null);
  const [quizStats, setQuizStats] = useState(null);
  const [assignmentStats, setAssignmentStats] = useState(null);
  const [learningStats, setLearningStats] = useState(null);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedStudent, setSelectedStudent] = useState(studentId || null);
  
  useEffect(() => {
    if (studentId) {
      setSelectedStudent(studentId);
    } else if (students.length > 0 && !selectedStudent) {
      setSelectedStudent(students[0]._id);
    }
  }, [studentId, students, selectedStudent]);
  
  useEffect(() => {
    if (!selectedStudent) return;
    
    const fetchLearningStats = async () => {
      setLoading(true);
      try {
        const response = await learningStatsAPI.getStudentLearningStats(selectedStudent);
        setLearningStats(response.data);
        setError(null);
      } catch (err) {
        console.error('获取学习统计数据失败:', err);
        setError('获取学习统计数据失败，请稍后再试');
      } finally {
        setLoading(false);
      }
    };
    
    fetchLearningStats();
  }, [selectedStudent]);
  
  useEffect(() => {
    if (!selectedStudent || selectedTab !== 'typing') return;
    
    const fetchTypingStats = async () => {
      setLoading(true);
      try {
        const response = await learningStatsAPI.getStudentTypingStats(selectedStudent);
        setTypingStats(response.data);
        setError(null);
      } catch (err) {
        console.error('获取打字统计数据失败:', err);
        setError('获取打字统计数据失败，请稍后再试');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTypingStats();
  }, [selectedStudent, selectedTab]);
  
  useEffect(() => {
    if (!selectedStudent || selectedTab !== 'quiz') return;
    
    const fetchQuizStats = async () => {
      setLoading(true);
      try {
        const response = await learningStatsAPI.getStudentQuizStats(selectedStudent);
        setQuizStats(response.data);
        setError(null);
      } catch (err) {
        console.error('获取测验统计数据失败:', err);
        setError('获取测验统计数据失败，请稍后再试');
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuizStats();
  }, [selectedStudent, selectedTab]);
  
  useEffect(() => {
    if (!selectedStudent || selectedTab !== 'assignment') return;
    
    const fetchAssignmentStats = async () => {
      setLoading(true);
      try {
        const response = await learningStatsAPI.getStudentAssignmentStats(selectedStudent);
        setAssignmentStats(response.data);
        setError(null);
      } catch (err) {
        console.error('获取作业统计数据失败:', err);
        setError('获取作业统计数据失败，请稍后再试');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAssignmentStats();
  }, [selectedStudent, selectedTab]);
  
  const handleTabChange = (key) => {
    setSelectedTab(key);
  };
  
  const handleStudentChange = (studentId) => {
    setSelectedStudent(studentId);
    if (onStudentChange) {
      onStudentChange(studentId);
    }
  };
  
  const handleViewDailyScore = () => {
    if (onViewDailyScore) {
      onViewDailyScore(selectedStudent);
    }
  };
  
  const renderOverview = () => {
    if (!learningStats) return <Spin tip="加载中..." />;
    
    return (
      <div className="overview-container">
        <Title level={4}>
          {learningStats.student.name} ({learningStats.student.username}) 的学习统计概览
        </Title>
        
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={24} sm={8}>
            <Card title="打字练习" className="stat-card" bordered={false}>
              <Statistic 
                title="总记录数" 
                value={learningStats.typing.totalRecords} 
                prefix={<FileTextOutlined />} 
              />
              <Statistic 
                title="平均速度" 
                value={learningStats.typing.averageSpeed} 
                suffix="字/分钟"
                style={{ margin: '20px 0' }}
              />
              <Statistic 
                title="平均准确率" 
                value={learningStats.typing.averageAccuracy} 
                suffix="%" 
              />
              <Statistic 
                title="达标次数" 
                value={learningStats.typing.totalPassedCount} 
                style={{ marginTop: '20px' }} 
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={8}>
            <Card title="测验完成" className="stat-card" bordered={false}>
              <Statistic 
                title="总提交次数" 
                value={learningStats.quiz.totalSubmissions} 
                prefix={<FormOutlined />} 
              />
              <Statistic 
                title="平均分数" 
                value={learningStats.quiz.averageScore} 
                suffix="分"
                style={{ margin: '20px 0' }} 
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={8}>
            <Card title="作业提交" className="stat-card" bordered={false}>
              <Statistic 
                title="总提交次数" 
                value={learningStats.assignment.totalSubmissions} 
                prefix={<FileSearchOutlined />} 
              />
              <Statistic 
                title="已批阅数量" 
                value={learningStats.assignment.gradedSubmissions} 
                style={{ margin: '20px 0' }} 
              />
              <Statistic 
                title="平均分数" 
                value={learningStats.assignment.averageScore} 
                suffix="分"
              />
            </Card>
          </Col>
        </Row>
        
        <div style={{ marginTop: 24 }}>
          <Alert 
            message="学习进度分析" 
            description={`该学生总共完成了${learningStats.typing.totalRecords}次打字练习，提交了${learningStats.quiz.totalSubmissions}次测验和${learningStats.assignment.totalSubmissions}次作业。`} 
            type="info" 
            showIcon 
          />
        </div>
      </div>
    );
  };
  
  const renderTypingStats = () => {
    if (!typingStats) return <Spin tip="加载中..." />;
    
    const columns = [
      {
        title: '日期',
        dataIndex: 'date',
        key: 'date',
      },
      {
        title: '练习次数',
        dataIndex: 'count',
        key: 'count',
        sorter: (a, b) => a.count - b.count,
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
    ];
    
    return (
      <div className="typing-stats-container">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic 
                title="总记录数" 
                value={typingStats.totalRecords} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic 
                title="近30天记录" 
                value={typingStats.recentRecords} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic 
                title="平均速度" 
                value={typingStats.averageSpeed} 
                suffix="字/分钟" 
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic 
                title="平均准确率" 
                value={typingStats.averageAccuracy} 
                suffix="%" 
              />
            </Card>
          </Col>
        </Row>
        
        <Card title="打字速度趋势" style={{ marginTop: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={typingStats.dailyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="averageSpeed" name="平均速度(字/分钟)" stroke="#8884d8" />
              <Line type="monotone" dataKey="averageAccuracy" name="平均准确率(%)" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        
        <Card title="每日打字练习记录" style={{ marginTop: 16 }}>
          <Table 
            columns={columns} 
            dataSource={typingStats.dailyStats.map((item, index) => ({
              ...item,
              key: index,
            }))} 
            pagination={{ pageSize: 7 }}
          />
        </Card>
      </div>
    );
  };
  
  const renderQuizStats = () => {
    if (!quizStats) return <Spin tip="加载中..." />;
    
    const columns = [
      {
        title: '日期',
        dataIndex: 'date',
        key: 'date',
      },
      {
        title: '提交次数',
        dataIndex: 'count',
        key: 'count',
        sorter: (a, b) => a.count - b.count,
      },
      {
        title: '平均分数',
        dataIndex: 'averageScore',
        key: 'averageScore',
        render: (score) => `${score} 分`,
        sorter: (a, b) => a.averageScore - b.averageScore,
      },
    ];
    
    return (
      <div className="quiz-stats-container">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic 
                title="总提交次数" 
                value={quizStats.totalSubmissions} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic 
                title="近30天提交" 
                value={quizStats.recentSubmissions} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic 
                title="平均分数" 
                value={quizStats.averageScore} 
                suffix="分" 
              />
            </Card>
          </Col>
        </Row>
        
        <Card title="测验分数趋势" style={{ marginTop: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={quizStats.dailyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="averageScore" name="平均分数" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        
        <Card title="每日测验提交记录" style={{ marginTop: 16 }}>
          <Table 
            columns={columns} 
            dataSource={quizStats.dailyStats.map((item, index) => ({
              ...item,
              key: index,
            }))} 
            pagination={{ pageSize: 7 }}
          />
        </Card>
      </div>
    );
  };
  
  const renderAssignmentStats = () => {
    if (!assignmentStats) return <Spin tip="加载中..." />;
    
    const columns = [
      {
        title: '日期',
        dataIndex: 'date',
        key: 'date',
      },
      {
        title: '提交次数',
        dataIndex: 'count',
        key: 'count',
        sorter: (a, b) => a.count - b.count,
      },
    ];
    
    return (
      <div className="assignment-stats-container">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic 
                title="总提交次数" 
                value={assignmentStats.totalSubmissions} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic 
                title="近30天提交" 
                value={assignmentStats.recentSubmissions} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic 
                title="平均分数" 
                value={assignmentStats.averageScore} 
                suffix="分" 
              />
            </Card>
          </Col>
        </Row>
        
        <Card title="作业提交趋势" style={{ marginTop: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={assignmentStats.dailyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="提交次数" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        
        <Card title="每日作业提交记录" style={{ marginTop: 16 }}>
          <Table 
            columns={columns} 
            dataSource={assignmentStats.dailyStats.map((item, index) => ({
              ...item,
              key: index,
            }))} 
            pagination={{ pageSize: 7 }}
          />
        </Card>
      </div>
    );
  };
  
  return (
    <div className="student-learning-stats-container">
      {!hideHeader && (
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3}>
            学生学习统计
            {className && <Text type="secondary" style={{ fontSize: '16px', marginLeft: '8px' }}>({className})</Text>}
          </Title>
          <div>
            <Button 
              type="primary"
              icon={<TrophyOutlined />}
              onClick={handleViewDailyScore}
              style={{ marginRight: 8 }}
            >
              查看平日成绩
            </Button>
          </div>
        </div>
      )}
      
      {students.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 200 }}
            value={selectedStudent}
            onChange={handleStudentChange}
            placeholder="选择学生"
          >
            {students.map(student => (
              <Option key={student._id} value={student._id}>{student.name}</Option>
            ))}
          </Select>
        </div>
      )}
      
      {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
      
      <Card>
        <Tabs activeKey={selectedTab} onChange={handleTabChange}>
          <TabPane tab={<span><DashboardOutlined /> 学习概览</span>} key="overview">
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

export default StudentLearningStatsComponent; 