import React, { useState, useEffect } from 'react';
import {
  Table, Button, Tabs, Spin,
  Alert, Typography, Row, Col, Statistic,
  Menu, Divider, Select, Radio, Space
} from 'antd';
import {
  BarChartOutlined, TeamOutlined,
  FileTextOutlined, BookOutlined,
  UserOutlined, FormOutlined,
  TrophyOutlined, FileSearchOutlined,
  DashboardOutlined, CalendarOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { classAPI } from '../../services/api';
import usePageTitle from '../../hooks/usePageTitle';
import ClassLearningStatsComponent from '../../pages/teacher/ClassLearningStats';
import ClassDailyScoresComponent from '../../pages/teacher/ClassDailyScores';
import StudentLearningStatsComponent from '../../pages/teacher/StudentLearningStats';
import StudentDailyScoreComponent from '../../pages/teacher/StudentDailyScore';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

const LearningStatsManagement = () => {
  usePageTitle('学习统计管理');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [classes, setClasses] = useState({});
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [students, setStudents] = useState([]);
  const [showContent, setShowContent] = useState('classDailyScores'); // 默认展示平日成绩页面
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('classes');
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [semesterOptions, setSemesterOptions] = useState([]);

  // 计算当前学年和学期
  const getCurrentSemester = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 月份从0开始计数

    // 判断当前学期
    // 8-次年1月是第一学期，2-7月是第二学期
    let academicYear, semester;

    if (currentMonth >= 8) {
      // 8-12月，当前学年的第一学期
      academicYear = `${currentYear}-${currentYear + 1}`;
      semester = 1;
    } else if (currentMonth >= 2 && currentMonth <= 7) {
      // 2-7月，上一学年的第二学期
      academicYear = `${currentYear - 1}-${currentYear}`;
      semester = 2;
    } else {
      // 1月，上一学年的第一学期
      academicYear = `${currentYear - 1}-${currentYear}`;
      semester = 1;
    }

    return {
      label: `${academicYear} 学年 第${semester}学期`,
      value: `${academicYear}-${semester}`,
      academicYear,
      semester
    };
  };

  // 生成过去几年的学期选项
  const generateSemesterOptions = () => {
    const current = getCurrentSemester();
    const options = [current];

    // 生成过去的4个学期选项（共5个选项）
    const [startYear, endYear] = current.academicYear.split('-').map(Number);
    let year1 = startYear;
    let year2 = endYear;
    let sem = current.semester;

    for (let i = 0; i < 4; i++) {
      // 计算上一个学期
      if (sem === 1) {
        sem = 2;
        year1 = year1 - 1;
        year2 = year2 - 1;
      } else {
        sem = 1;
      }

      const academicYear = `${year1}-${year2}`;
      options.push({
        label: `${academicYear} 学年 第${sem}学期`,
        value: `${academicYear}-${sem}`,
        academicYear,
        semester: sem
      });
    }

    return options;
  };

  useEffect(() => {
    // 生成学期选项并设置默认选中当前学期
    const options = generateSemesterOptions();
    setSemesterOptions(options);
    setSelectedSemester(options[0].value);

    // 初始化选项后立即获取班级数据
    const fetchInitialData = async () => {
      if (options.length > 0) {
        await fetchClasses(options[0].value);
      }
    };

    fetchInitialData();
  }, []);

  const fetchClasses = async (semester = selectedSemester) => {
    if (!semester) return;

    setLoading(true);
    try {
      // 请求时添加学期参数
      const response = await classAPI.getTeacherClasses({ semester });
      if (response.success) {
        // 过滤掉已归档班级
        const activeClasses = response.data.filter(cls => cls.status !== 'archived');
        
        // 按年级分组班级
        const groupedClasses = activeClasses.reduce((acc, cls) => {
          const grade = cls.grade || '未分组';
          if (!acc[grade]) {
            acc[grade] = [];
          }
          acc[grade].push(cls);
          return acc;
        }, {});
        
        // 对每个年级内的班级进行排序（按班级名称/号码升序）
        Object.keys(groupedClasses).forEach(grade => {
          groupedClasses[grade].sort((a, b) => Number(a.name) - Number(b.name));
        });
        
        setClasses(groupedClasses);
        setError(null);

        // 如果有班级数据，默认选中第一个年级和第一个班级
        const grades = Object.keys(groupedClasses).sort((a, b) => Number(b) - Number(a));
        if (grades.length > 0) {
          const firstGrade = grades[0];
          setSelectedGrade(firstGrade);
          const firstClass = groupedClasses[firstGrade][0];
          if (firstClass) {
            setSelectedClass(firstClass._id);
            fetchClassStudents(firstClass._id, semester);
          }
        }
      }
    } catch (err) {
      console.error('获取班级列表失败:', err);
      setError('获取班级列表失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const fetchClassStudents = async (classId, semester = selectedSemester) => {
    if (!classId || !semester) return;

    try {
      // 请求时添加学期参数
      const response = await classAPI.getClassDetails(classId, { semester });
      if (response.success && response.data.students) {
        setStudents(response.data.students);
      }
    } catch (err) {
      console.error('获取班级学生列表失败:', err);
      setStudents([]);
    }
  };

  // 处理班级变更
  const handleClassChange = (classId) => {
    setSelectedClass(classId);
    setSelectedStudent(null);
    fetchClassStudents(classId);

    // 保持当前视图类型（班级视图）
    if (showContent === 'studentStats' || showContent === 'studentDailyScore') {
      setShowContent('classDailyScores');
    }
  };

  // 查看学生学习统计
  const handleViewStudentStats = (studentId) => {
    setSelectedStudent(studentId);
    setShowContent('studentStats');
  };

  // 查看班级平日成绩
  const handleViewClassDailyScores = () => {
    setShowContent('classDailyScores');
  };

  // 查看班级学习统计
  const handleViewClassStats = () => {
    setShowContent('classStats');
  };

  // 查看学生平日成绩
  const handleViewStudentDailyScore = (studentId) => {
    if (studentId) {
      setSelectedStudent(studentId);
    }
    setShowContent('studentDailyScore');
  };

  // 返回班级学习统计
  const handleBackToClassStats = () => {
    setShowContent('classStats');
  };

  // 返回班级平日成绩
  const handleBackToClassDailyScores = () => {
    setShowContent('classDailyScores');
  };

  // 跳转到上一个/下一个学生
  const handlePrevStudent = (studentId) => {
    setSelectedStudent(studentId);
  };

  const handleNextStudent = (studentId) => {
    setSelectedStudent(studentId);
  };

  // 处理学期变更
  const handleSemesterChange = (value) => {
    setSelectedSemester(value);
    // 根据新选择的学期重新获取数据
    fetchClasses(value);

    // 重置学生和年级选择
    setSelectedStudent(null);
    setSelectedGrade(null);

    // 切换回班级视图
    if (showContent === 'studentStats' || showContent === 'studentDailyScore') {
      setShowContent('classDailyScores');
    }
  };

  // 表格列配置
  const columns = [
    {
      title: '班级名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '学生人数',
      dataIndex: 'studentCount',
      key: 'studentCount',
      sorter: (a, b) => a.studentCount - b.studentCount,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <>
          <Button
            type="primary"
            icon={<BarChartOutlined />}
            onClick={() => {
              setSelectedClass(record._id);
              fetchClassStudents(record._id);
              setShowContent('classStats');
            }}
            style={{ marginRight: 8 }}
          >
            学习统计
          </Button>
          <Button
            icon={<TrophyOutlined />}
            onClick={() => {
              setSelectedClass(record._id);
              fetchClassStudents(record._id);
              setShowContent('classDailyScores');
            }}
          >
            平日成绩
          </Button>
        </>
      ),
    },
  ];

  // 渲染数据展示区域
  const renderStatsContent = () => {
    if (!selectedClass) {
      return (
        <Alert
          message="请先选择班级"
          description="从顶部班级列表中选择一个班级来查看详细数据"
          type="info"
          showIcon
        />
      );
    }

    // 从班级列表中获取班级名称
    const allClasses = Object.values(classes).flat();
    const classInfo = allClasses.find(c => c._id === selectedClass);
    const className = classInfo ? classInfo.name : '';

    switch (showContent) {
      case 'classStats':
        return (
          <ClassLearningStatsComponent
            classId={selectedClass}
            onViewStudentStats={handleViewStudentStats}
            onViewDailyScores={handleViewClassDailyScores}
            hideHeader={false}
            semester={selectedSemester}
          />
        );

      case 'classDailyScores':
        return (
          <ClassDailyScoresComponent
            classId={selectedClass}
            onViewStudentScore={handleViewStudentDailyScore}
            hideHeader={false}
            semester={selectedSemester}
          />
        );

      case 'studentStats':
        if (!selectedStudent) {
          return <Alert message="请选择学生" type="info" />;
        }
        return (
          <StudentLearningStatsComponent
            studentId={selectedStudent}
            classId={selectedClass}
            className={className}
            students={students}
            onStudentChange={handleViewStudentStats}
            onViewDailyScore={handleViewStudentDailyScore}
            hideHeader={false}
            semester={selectedSemester}
          />
        );

      case 'studentDailyScore':
        if (!selectedStudent) {
          return <Alert message="请选择学生" type="info" />;
        }
        return (
          <StudentDailyScoreComponent
            studentId={selectedStudent}
            classId={selectedClass}
            onGoBack={handleBackToClassDailyScores}
            onPrevStudent={handlePrevStudent}
            onNextStudent={handleNextStudent}
            hideNavigation={false}
            semester={selectedSemester}
          />
        );

      default:
        return <Alert message="未知的内容类型" type="error" />;
    }
  };

  return (
    <div className="learning-stats-management">
      {/* 顶部选择区域 */}
      <div style={{ padding: '8px 4px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 12 }}>
          <div style={{ marginRight: 40 }}>
            <Text strong style={{ marginRight: 8 }}>选择年级:</Text>
            <Select
              style={{ width: 120, marginRight: 16 }}
              placeholder="请选择年级"
              value={selectedGrade}
              onChange={(grade) => {
                setSelectedGrade(grade);
                // 选择该年级第一个班级
                const gradeClasses = classes[grade] || [];
                if (gradeClasses.length > 0) {
                  setSelectedClass(gradeClasses[0]._id);
                  fetchClassStudents(gradeClasses[0]._id);
                }
              }}
              disabled={loading || Object.keys(classes).length === 0}
            >
              {Object.keys(classes).sort((a, b) => Number(b) - Number(a)).map(grade => (
                <Option key={grade} value={grade}>{grade}级</Option>
              ))}
            </Select>
            <Text strong style={{ marginRight: 8 }}>选择班级:</Text>
            <Select
              style={{ width: 150 }}
              placeholder="请选择班级"
              value={selectedClass}
              onChange={handleClassChange}
              disabled={loading || !selectedGrade || (classes[selectedGrade] || []).length === 0}
            >
              {(classes[selectedGrade] || []).map(cls => (
                <Option key={cls._id} value={cls._id}>{cls.name}班</Option>
              ))}
            </Select>
          </div>

          <div>
            <Text strong style={{ marginRight: 8 }}>查看内容:</Text>
            <Radio.Group
              value={showContent}
              onChange={(e) => setShowContent(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              disabled={loading || !selectedClass}
            >
              <Radio.Button value="classDailyScores">
                <TrophyOutlined /> 班级平日成绩
              </Radio.Button>
              <Radio.Button value="classStats">
                <BarChartOutlined /> 班级学习统计
              </Radio.Button>
            </Radio.Group>

            <Button
              type="primary"
              icon={<FormOutlined />}
              onClick={() => navigate('/teacher/exam-config')}
              style={{ marginLeft: 16 }}
            >
              考试成绩导出
            </Button>
          </div>

          <div style={{ marginLeft: 'auto' }}>
            <Text strong style={{ marginRight: 8 }}>
              <CalendarOutlined /> 学期:
            </Text>
            <Select
              style={{ width: 240 }}
              placeholder="请选择学期"
              value={selectedSemester}
              onChange={handleSemesterChange}
              disabled={loading}
            >
              {semesterOptions.map(option => (
                <Option key={option.value} value={option.value}>{option.label}</Option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* 加载和错误状态 */}
      {loading && (
        <div style={{ textAlign: 'center', margin: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>正在加载数据...</div>
        </div>
      )}

      {error && (
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 内容展示区域 */}
      {!loading && !error && (
        <div className="stats-content">
          {renderStatsContent()}
        </div>
      )}

      <style jsx>{`
        .stat-card {
          height: 100%;
        }
        .stats-content {
          min-height: 500px;
        }
      `}</style>
    </div>
  );
};

export default LearningStatsManagement; 