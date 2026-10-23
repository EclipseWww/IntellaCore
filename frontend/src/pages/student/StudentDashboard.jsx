import { getAutoGrade } from '../../utils/submissionGrading';
import AutoGradeFeedback from '../../components/Course/student/AutoGradeFeedback';
import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Card, Row, Col, Statistic, Button, List, Tag, Divider, Timeline, Empty, Space, Badge, Avatar, message, Modal, Spin, Input, Tooltip } from 'antd';
import {
  BookOutlined,
  RobotOutlined,
  ProjectOutlined,
  EditOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  FieldTimeOutlined,
  ArrowRightOutlined,
  DownloadOutlined,
  ShoppingOutlined,
  TrophyOutlined,
  TeamOutlined,
  MailOutlined,
  CodeOutlined,
  DeleteOutlined,
  FileAddOutlined,
  ArrowLeftOutlined,
  GlobalOutlined,
  FormOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import CourseAIHelper from '../../components/Course/student/CourseAIHelper';
import StudentHeader from '../../layouts/StudentHeader';
import CourseList from '../../components/Course/student/CourseList';
import TypingPractice from '../../components/Typing/TypingPractice';
import StudentDailyScoreComponent from '../teacher/StudentDailyScore';
import PointShop from './PointShop';
import GameCenter from '../../components/games/GameCenter';
import usePageTitle from '../../hooks/usePageTitle';
import { courseManagementAPI, API_BASE_URL, typingAPI, classAPI } from '../../services/api';
import * as htmlProjectAPI from '../../services/htmlProjectAPI';
import HtmlEditor from '../../components/HtmlEditor';
import { getShopItems } from '../../services/pointShopService';
import NetworkLab from '../../components/NetworkLab/NetworkLab';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import QuizPracticeModule from '../../components/Quiz/student/QuizPracticeModule';

// 注册 Python 语言支持
SyntaxHighlighter.registerLanguage('python', python);

const { Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;

// HTML 编辑器模块组件
const HtmlEditorModule = ({
  htmlProjects,
  setHtmlProjects,
  currentHtmlProject,
  setCurrentHtmlProject,
  htmlLoading,
  setHtmlLoading
}) => {
  const [showProjectList, setShowProjectList] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [saving, setSaving] = useState(false);

  // 获取项目列表
  const fetchProjects = async () => {
    try {
      setHtmlLoading(true);
      const result = await htmlProjectAPI.getProjects();
      if (result.success) {
        setHtmlProjects(result.data);
      }
    } catch (error) {
      console.error('获取HTML项目失败:', error);
      message.error('获取项目列表失败');
    } finally {
      setHtmlLoading(false);
    }
  };

  // 首次加载
  useEffect(() => {
    fetchProjects();
  }, []);

  // 创建新项目
  const handleCreateProject = async () => {
    try {
      setHtmlLoading(true);
      const result = await htmlProjectAPI.createProject({ name: '未命名网页' });
      if (result.success) {
        message.success('项目创建成功');
        setCurrentHtmlProject(result.data);
        setProjectName(result.data.name);
        setShowProjectList(false);
        fetchProjects(); // 刷新列表
      }
    } catch (error) {
      console.error('创建项目失败:', error);
      message.error('创建项目失败');
    } finally {
      setHtmlLoading(false);
    }
  };

  // 打开项目
  const handleOpenProject = async (projectId) => {
    try {
      setHtmlLoading(true);
      const result = await htmlProjectAPI.getProject(projectId);
      if (result.success) {
        setCurrentHtmlProject(result.data);
        setProjectName(result.data.name);
        setShowProjectList(false);
      }
    } catch (error) {
      console.error('打开项目失败:', error);
      message.error('打开项目失败');
    } finally {
      setHtmlLoading(false);
    }
  };

  // 保存项目
  const handleSaveProject = async (code) => {
    if (!currentHtmlProject) return;

    try {
      setSaving(true);
      const result = await htmlProjectAPI.updateProject(currentHtmlProject._id, {
        code,
        name: projectName || currentHtmlProject.name
      });
      if (result.success) {
        setCurrentHtmlProject(result.data);
        fetchProjects(); // 刷新列表
      }
    } catch (error) {
      console.error('保存项目失败:', error);
      throw error; // 让 HtmlEditor 处理错误提示
    } finally {
      setSaving(false);
    }
  };

  // 删除项目
  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个项目吗？此操作不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await htmlProjectAPI.deleteProject(projectId);
          if (result.success) {
            message.success('项目已删除');
            fetchProjects();
            if (currentHtmlProject && currentHtmlProject._id === projectId) {
              setCurrentHtmlProject(null);
              setShowProjectList(true);
            }
          }
        } catch (error) {
          console.error('删除项目失败:', error);
          message.error('删除项目失败');
        }
      }
    });
  };

  // 返回项目列表
  const handleBackToList = () => {
    setShowProjectList(true);
    setCurrentHtmlProject(null);
  };

  // 更新项目名称
  const handleUpdateName = async () => {
    if (!currentHtmlProject || !projectName.trim()) return;

    try {
      await htmlProjectAPI.updateProject(currentHtmlProject._id, { name: projectName });
      setEditingName(false);
      fetchProjects();
    } catch (error) {
      console.error('更新名称失败:', error);
      message.error('更新名称失败');
    }
  };

  // 渲染项目列表
  if (showProjectList) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>HTML 编辑器</Title>
          <Button type="primary" icon={<FileAddOutlined />} onClick={handleCreateProject} loading={htmlLoading}>
            新建网页
          </Button>
        </div>

        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Spin spinning={htmlLoading}>
            {htmlProjects.length === 0 ? (
              <Empty
                description="暂无网页项目"
                style={{ padding: '60px 0' }}
              >
                <Button type="primary" onClick={handleCreateProject}>创建第一个网页</Button>
              </Empty>
            ) : (
              <Row gutter={[16, 16]}>
                {htmlProjects.map(project => (
                  <Col xs={24} sm={12} md={8} lg={6} key={project._id}>
                    <Card
                      hoverable
                      onClick={() => handleOpenProject(project._id)}
                      style={{ borderRadius: 8 }}
                      bodyStyle={{ padding: 16 }}
                      actions={[
                        <Tooltip title="删除">
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => handleDeleteProject(project._id, e)}
                          />
                        </Tooltip>
                      ]}
                    >
                      <div style={{
                        height: 100,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: 8,
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <CodeOutlined style={{ fontSize: 36, color: 'white' }} />
                      </div>
                      <Text strong ellipsis style={{ display: 'block', marginBottom: 4 }}>
                        {project.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(project.updatedAt).toLocaleString()}
                      </Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Spin>
        </Card>
      </div>
    );
  }

  // 渲染编辑器
  return (
    <div style={{ height: 'calc(100vh - 150px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBackToList}>
            返回列表
          </Button>
          {editingName ? (
            <Space>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                style={{ width: 200 }}
                onPressEnter={handleUpdateName}
              />
              <Button type="primary" size="small" onClick={handleUpdateName}>保存</Button>
              <Button size="small" onClick={() => setEditingName(false)}>取消</Button>
            </Space>
          ) : (
            <Title level={4} style={{ margin: 0, cursor: 'pointer' }} onClick={() => setEditingName(true)}>
              {projectName || '未命名网页'} <EditOutlined style={{ fontSize: 14, color: '#999' }} />
            </Title>
          )}
        </Space>
      </div>

      <HtmlEditor
        initialCode={currentHtmlProject?.code}
        onSave={handleSaveProject}
        title={projectName || '未命名网页'}
        style={{ height: 'calc(100% - 50px)' }}
      />
    </div>
  );
};




const StudentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedMenu, setSelectedMenu] = useState(searchParams.get('tab') || 'dashboard');
  const [currentSpeed, setCurrentSpeed] = useState(35);
  const [currentCourse, setCurrentCourse] = useState(null);
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [typingRecords, setTypingRecords] = useState([]);
  const [typingStats, setTypingStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [typingLoading, setTypingLoading] = useState(false);
  const [showAssignmentDetail, setShowAssignmentDetail] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [currentSubmissionCode, setCurrentSubmissionCode] = useState('');
  const [classLoading, setClassLoading] = useState(false);
  const [studentId, setStudentId] = useState(null);
  const [currentSemester, setCurrentSemester] = useState('');
  const [htmlProjects, setHtmlProjects] = useState([]);
  const [currentHtmlProject, setCurrentHtmlProject] = useState(null);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [hasGameItems, setHasGameItems] = useState(false); // 是否有游戏商品可用

  usePageTitle();

  // 获取作业提交记录
  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await courseManagementAPI.getStudentSubmissions();
      if (response.success) {
        setRecentAssignments(response.data.map(assignment => ({
          id: assignment.id,
          type: assignment.type,  // 活动类型
          title: assignment.title,
          lessonName: assignment.lessonName,  // 课时名称
          courseName: assignment.courseName,
          status: assignment.status,
          // 优先使用教师评分，如果没有则使用AI评分
          score: assignment.score !== undefined ? assignment.score : assignment.aiGrade?.score,
          submitTime: new Date(assignment.submitTime).toLocaleString(),
          // 优先使用教师评语，如果没有则使用AI评语
          feedback: assignment.feedback || assignment.aiGrade?.feedback,
          content: assignment.content,
          // 保存AI评分信息，以便查看详情时显示
          aiGrade: assignment.aiGrade,
          gradeSource: assignment.gradeSource,
          canResubmit: assignment.canResubmit,
          allowedFormats: assignment.allowedFormats,
          pptAutoGrade: assignment.pptAutoGrade,
          excelAutoGrade: assignment.excelAutoGrade,
          // 导航相关字段
          lessonId: assignment.lessonId,
          courseId: assignment.courseId,
          unitId: assignment.unitId,
          activityId: assignment.activityId
        })));
      }
    } catch (error) {
      console.error('获取作业提交记录失败:', error);
      message.error('获取作业提交记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取打字记录
  const fetchTypingRecords = async () => {
    try {
      setTypingLoading(true);
      const records = await typingAPI.getRecords();
      setTypingRecords(records);

      // 获取打字统计数据
      const stats = await typingAPI.getStats();

      // 检查统计数据
      if (stats && stats.averages) {
        // console.log('平均速度:', stats.averages.avgSpeed);
        // console.log('平均准确率:', stats.averages.avgAccuracy);
      } else {
        console.warn('统计数据为空或格式不正确:', stats);
      }

      // 后端已经计算好了总练习时间，不再需要前端计算
      setTypingStats(stats);


    } catch (error) {
      console.error('获取打字记录失败:', error);
      message.error('获取打字记录失败');
      console.error('获取打字记录失败', { error: error.message });
    } finally {
      setTypingLoading(false);
    }
  };

  // 获取当前用户班级信息
  const fetchCurrentClassInfo = async () => {
    try {
      setClassLoading(true);
      // 从localStorage获取用户ID
      const userData = JSON.parse(localStorage.getItem('user'));
      if (!userData || !userData.id) {
        console.error('未找到用户信息');
        message.error('获取用户信息失败');
        return;
      }

      // 获取用户班级设置
      const classSettings = await classAPI.getUserClassSettings(userData.id);

      if (!classSettings || !classSettings.currentCourse) {
        console.warn('班级未设置当前课程');
        return;
      }

      // 获取当前课程详情（使用新的专门为学生设计的API）
      const courseResponse = await courseManagementAPI.getStudentCourseDetails(classSettings.currentCourse);

      if (!courseResponse || !courseResponse.success) {
        console.warn('获取课程详情失败');
        return;
      }

      // 处理课程数据
      const courseData = courseResponse.data.course;
      const units = courseResponse.data.units || [];
      const currentLessonId = courseResponse.data.currentLessonId;
      const currentUnitId = courseResponse.data.currentUnitId;

      if (!courseData || !courseData._id) {
        console.warn('课程数据格式不正确');
        return;
      }

      // 查找当前课时和下一课时的信息
      let currentLessonTitle = '当前课时';
      let nextLessonTitle = '下一课时';
      let nextLessonId = null;

      // 查找当前单元
      const currentUnit = units.find(unit => unit._id === currentUnitId);

      if (currentUnit && currentUnit.lessons && currentUnit.lessons.length > 0) {
        // 查找当前课时
        const currentLessonIndex = currentUnit.lessons.findIndex(lesson => lesson._id === currentLessonId);

        if (currentLessonIndex !== -1) {
          // 获取当前课时标题
          currentLessonTitle = currentUnit.lessons[currentLessonIndex].title;

          // 获取下一课时信息（如果存在）
          if (currentLessonIndex < currentUnit.lessons.length - 1) {
            nextLessonTitle = currentUnit.lessons[currentLessonIndex + 1].title;
            nextLessonId = currentUnit.lessons[currentLessonIndex + 1]._id;
          } else {
            // 如果当前单元的课时已经学完，查找下一个单元的第一个课时
            const currentUnitIndex = units.findIndex(unit => unit._id === currentUnitId);
            if (currentUnitIndex !== -1 && currentUnitIndex < units.length - 1) {
              const nextUnit = units[currentUnitIndex + 1];
              if (nextUnit.lessons && nextUnit.lessons.length > 0) {
                nextLessonTitle = nextUnit.lessons[0].title;
                nextLessonId = nextUnit.lessons[0]._id;
              }
            }
          }
        }
      }

      // 设置当前课程信息
      setCurrentCourse({
        id: courseData._id,
        title: courseData.title || '未知课程',
        // 添加当前单元信息
        currentUnit: {
          id: currentUnitId || null,
          title: currentUnit?.title || '未知单元'
        },
        // 暂时去掉进度显示
        currentLesson: {
          id: currentLessonId || classSettings.currentLesson,
          title: currentLessonTitle,
          status: 'in-progress'
        },
        nextLesson: {
          id: nextLessonId,
          title: nextLessonTitle,
          status: 'upcoming'
        }
      });
    } catch (error) {
      console.error('获取班级信息失败:', error);
      message.error('获取班级信息失败');
    } finally {
      setClassLoading(false);
    }
  };

  // 检查是否有游戏商品可用
  const checkGameItems = async () => {
    try {
      const response = await getShopItems();
      if (response.success) {
        setHasGameItems(response.hasGameItems || false);
      }
    } catch (error) {
      console.error('检查游戏商品失败:', error);
      setHasGameItems(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
    fetchTypingRecords();
    fetchCurrentClassInfo(); // 获取当前班级信息
    checkGameItems(); // 检查是否有游戏商品

    // 从本地存储获取用户信息
    const userData = JSON.parse(localStorage.getItem('user'));
    if (userData && userData.id) {
      setStudentId(userData.id);
    }

    // 获取当前学期
    const getCurrentSemester = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 月份从0开始计数

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

      return `${academicYear}-${semester}`;
    };

    setCurrentSemester(getCurrentSemester());
  }, []);

  // 获取文件类型
  const getFileType = (mimeType, fileName) => {
    const mimeMap = {
      'text/x-python': 'py',
      'text/python': 'py',
      'application/x-python': 'py'
    };

    // 首先尝试从 MIME 类型获取
    if (mimeType && mimeMap[mimeType]) {
      return mimeMap[mimeType];
    }

    // 如果 MIME 类型不匹配，尝试从文件扩展名获取
    const extension = fileName?.split('.').pop()?.toLowerCase();
    return extension === 'py' ? 'py' : null;
  };

  // 获取提交文件的代码内容
  const fetchSubmissionCode = async (submissionId) => {
    try {
      setPreviewLoading(true);
      // 获取token
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('未找到认证token，请重新登录');
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/submissions/${submissionId}/preview?token=${token}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('获取代码内容失败');
      }

      const text = await response.text();
      setCurrentSubmissionCode(text);
    } catch (error) {
      console.error('获取代码内容失败:', error);
      message.error('获取代码内容失败');
      setCurrentSubmissionCode('');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 处理查看详情
  const handleViewDetail = (assignment) => {
    setSelectedAssignment(assignment);
    setShowAssignmentDetail(true);

    // 如果是Python文件，获取代码内容
    if (assignment.content?.file && getFileType(assignment.content.file.mimeType, assignment.content.file.originalName) === 'py') {
      fetchSubmissionCode(assignment.id);
    }
  };

  // 处理资源下载
  const handleResourceDownload = async (resource) => {
    try {
      if (!resource.path) {
        message.error('资源路径无效');
        return;
      }

      // 作业文件下载
      const cleanPath = resource.path.replace('uploads/assignments/', '');
      const response = await fetch(
        `${API_BASE_URL}/api/download/assignment/${cleanPath}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('下载失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resource.originalName || '作业文件';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('文件下载成功');
    } catch (error) {
      console.error('下载文件失败:', error);
      message.error('下载文件失败');
    }
  };

  // 格式化文件名
  const formatFileName = (fileName, maxLength = 20) => {
    if (!fileName) return '未知文件';

    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return fileName.length > maxLength ? fileName.slice(0, maxLength) + '...' : fileName;
    }

    const name = fileName.slice(0, lastDotIndex);
    const extension = fileName.slice(lastDotIndex);

    if (name.length > maxLength) {
      return name.slice(0, maxLength) + '...' + extension;
    }

    return fileName;
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const menuItems = [
    { key: 'dashboard', icon: <ProjectOutlined />, label: '首页' },
    { key: 'courses', icon: <BookOutlined />, label: '我的课程' },
    { key: 'my-score', icon: <TrophyOutlined />, label: '我的成绩' },
    { key: 'typing', icon: <EditOutlined />, label: '打字练习' },
    { key: 'quiz-practice', icon: <FormOutlined />, label: '测验练习' },
    { key: 'html-editor', icon: <CodeOutlined />, label: 'HTML编辑器' },
    { key: 'email', icon: <MailOutlined />, label: '邮件' },
    { key: 'network-lab', icon: <GlobalOutlined />, label: '网络实验室' },

    { key: 'ai-assistant', icon: <RobotOutlined />, label: 'AI 助手' },
    { key: 'point-shop', icon: <ShoppingOutlined />, label: '积分商店' },
    // 只有当老师发布了游戏商品时才显示游戏中心
    ...(hasGameItems ? [{ key: 'games', icon: <PlayCircleOutlined />, label: '游戏中心' }] : []),
  ];

  const handleSpeedUpdate = (speed) => {
    if (speed > 0) {
      setCurrentSpeed(speed);
    }
  };

  // 处理继续学习按钮点击
  const handleContinueLearning = () => {
    if (currentCourse && currentCourse.currentLesson && currentCourse.currentLesson.id) {
      // 获取用户班级设置
      const userData = JSON.parse(localStorage.getItem('user'));
      if (!userData || !userData.id) {
        console.error('未找到用户信息');
        message.error('获取用户信息失败');
        return;
      }

      // 跳转到当前课时详情页（使用新的URL格式）
      navigate(`/student/course/${currentCourse.id}/unit/${currentCourse.currentUnit?.id || 'unknown'}/lesson/${currentCourse.currentLesson.id}`);
    } else {
      message.warning('当前没有正在学习的课时');
    }
  };

  // 处理查看全部课时按钮点击
  const handleViewAllLessons = () => {
    if (currentCourse && currentCourse.id) {
      // 跳转到课程详情页
      navigate(`/student/course/${currentCourse.id}`);
    } else {
      message.warning('当前没有正在学习的课程');
    }
  };

  // 渲染作业详情弹窗
  const renderAssignmentDetailModal = () => {
    if (!selectedAssignment) return null;

    const file = selectedAssignment.content?.file;
    const token = localStorage.getItem('token');

    const autoGrade = getAutoGrade(selectedAssignment, 'pptAutoGrade') || getAutoGrade(selectedAssignment, 'excelAutoGrade');
    const manualGrade = selectedAssignment.gradeSource === 'manual';
    const isPythonFile = getFileType(file?.mimeType, file?.originalName) === 'py';

    return (
      <Modal
        title={selectedAssignment.score != null || autoGrade ? "作业得分详情" : "作业提交记录"}
        open={showAssignmentDetail}
        onCancel={() => {
          setShowAssignmentDetail(false);
          setSelectedAssignment(null);
          setCurrentSubmissionCode('');
        }}
        width={900}
        className="assignment-feedback-modal"
        footer={null}
        styles={{ body: { maxHeight: '74vh', overflowY: 'auto', padding: '8px 0 0' } }}
      >
        <div className="assignment-feedback-records">
          <section className="assignment-feedback-record">
            <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
              <Col flex="auto">
                <Space size="large" style={{ flexWrap: 'wrap', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                  <Space size="large" style={{ flexWrap: 'wrap', gap: '8px' }}>
                    <Space>
                      <Text type="secondary">课程：</Text>
                      <Text>{selectedAssignment.courseName}</Text>
                    </Space>
                    <Space>
                      <Text type="secondary">作业：</Text>
                      <Text>{selectedAssignment.title}</Text>
                    </Space>
                    <Space>
                      <Text type="secondary">提交时间：</Text>
                      <Text>{selectedAssignment.submitTime}</Text>
                    </Space>
                  </Space>
                  {selectedAssignment.score != null && (!autoGrade || manualGrade) && (
                    <Space>
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      <Text strong style={{ fontSize: '15px', color: '#52c41a' }}>
                        得分：{selectedAssignment.score}分
                      </Text>
                    </Space>
                  )}
                </Space>
              </Col>
            </Row>

            {file && (
              <Row align="middle" style={{ marginBottom: '16px' }}>
                <Col span={24}>
                  <Button type="link" onClick={() => handleResourceDownload(file)} style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}>
                    <Space>
                      <DownloadOutlined style={{ color: '#1890ff' }} />
                      <Text strong>{formatFileName(file.originalName)}</Text>
                      {file.size && <Text type="secondary">({formatFileSize(file.size)})</Text>}
                    </Space>
                  </Button>
                </Col>
              </Row>
            )}

            <Row gutter={[16, 16]}>

              {/* Python文件预览 */}
              {isPythonFile && (
                <Col span={24}>
                  <div style={{ marginTop: '8px' }}>
                    {previewLoading ? (
                      <div style={{ textAlign: 'center', padding: '20px' }}>
                        <Spin tip="加载代码中..." />
                      </div>
                    ) : (
                      <div style={{
                        marginTop: '8px',
                        background: '#f6f8fa',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        border: '1px solid #e8e8e8'
                      }}>
                        <SyntaxHighlighter
                          language="python"
                          style={docco}
                          showLineNumbers={true}
                          customStyle={{
                            margin: 0,
                            padding: '16px',
                            maxHeight: '300px',
                            overflow: 'auto',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            backgroundColor: '#ffffff'
                          }}
                          lineNumberStyle={{
                            minWidth: '3em',
                            paddingRight: '1em',
                            color: '#666',
                            userSelect: 'none'
                          }}
                          wrapLines={true}
                          wrapLongLines={true}
                        >
                          {currentSubmissionCode || currentSubmissionCode === ''
                            ? (currentSubmissionCode || '# 空文件 - 这是一个空的Python文件')
                            : '加载中...'}
                        </SyntaxHighlighter>
                      </div>
                    )}
                  </div>
                </Col>
              )}

              {/* 教师评语 */}
              {selectedAssignment.feedback && (!autoGrade || manualGrade) && (
                <Col span={24}>
                  <section className="assignment-feedback-note"><Text strong>评语</Text>
                    <Paragraph>{selectedAssignment.feedback}</Paragraph>
                  </section>
                </Col>
              )}

              <Col span={24}><AutoGradeFeedback submission={selectedAssignment} /></Col>
              {/* AI评分信息 */}
              {selectedAssignment.aiGrade && selectedAssignment.aiGrade.score !== undefined && !selectedAssignment.feedback && (
                <Col span={24}>
                  <section className="assignment-feedback-note"><Text strong>AI评分反馈</Text>
                    <Paragraph>{selectedAssignment.aiGrade.feedback}</Paragraph>

                    {selectedAssignment.aiGrade.suggestions && selectedAssignment.aiGrade.suggestions.length > 0 && (
                      <>
                        <Divider style={{ margin: '12px 0' }} />
                        <Text strong style={{ display: 'block', marginBottom: '8px' }}>改进建议：</Text>
                        <List
                          size="small"
                          dataSource={selectedAssignment.aiGrade.suggestions}
                          renderItem={(item, index) => (
                            <List.Item>
                              <Text type="secondary">{index + 1}. </Text>
                              {item}
                            </List.Item>
                          )}
                        />
                      </>
                    )}
                  </section>
                </Col>
              )}
            </Row>
          </section>
        </div>
      </Modal>
    );
  };

  // 渲染打字记录部分
  const renderTypingRecords = () => {
    if (typingLoading) {
      return <Spin tip="加载中..." />;
    }

    if (!typingRecords || typingRecords.length === 0) {
      return <Empty description="暂无打字记录" />;
    }

    return (
      <div style={{ overflow: 'auto', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '16px' }}>
          {typingRecords.map(record => (
            <div key={record._id} style={{ flex: '0 0 300px', maxWidth: '300px' }}>
              <Card
                size="small"
                bordered
                hoverable
                style={{
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  height: '100%'
                }}
                headStyle={{
                  background: record.isPassed ? '#f0f7ff' : '#fff7e6',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  padding: '8px 16px'
                }}
                title={
                  <Space>
                    <Text strong>{new Date(record.startTime).toLocaleDateString()}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {new Date(record.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </Space>
                }
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space>
                    {record.isPassed && <Tag color="success">达标</Tag>}
                    <Tag color="blue">
                      {record.lessonId ? '课程练习' : '自主练习'}
                    </Tag>
                  </Space>

                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    练习时长: {Math.round((new Date(record.endTime) - new Date(record.startTime)) / 1000)} 秒
                  </Text>

                  <Row gutter={16} style={{ marginTop: '8px' }}>
                    <Col span={12}>
                      <Statistic
                        title={<Text style={{ fontSize: '13px' }}>速度</Text>}
                        value={record.speed}
                        suffix="字/分"
                        valueStyle={{
                          fontSize: '18px',
                          color: record.speed >= record.targetSpeed ? '#52c41a' : '#faad14'
                        }}
                      />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        目标: {record.targetSpeed}
                      </Text>
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title={<Text style={{ fontSize: '13px' }}>准确率</Text>}
                        value={record.accuracy}
                        suffix="%"
                        valueStyle={{
                          fontSize: '18px',
                          color: record.accuracy >= record.targetAccuracy ? '#52c41a' : '#faad14'
                        }}
                      />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        目标: {record.targetAccuracy}%
                      </Text>
                    </Col>
                  </Row>
                </Space>
              </Card>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 渲染打字统计部分
  const renderTypingStats = () => {
    if (!typingStats) return null;

    // 检查是否有有效的统计数据
    const hasValidStats = typingStats.totalCount > 0;

    // 如果没有记录，显示提示信息
    if (!hasValidStats) {
      return (
        <Empty
          description="暂无打字统计数据，请先完成一次打字练习"
          style={{ margin: '20px 0' }}
        />
      );
    }

    // 格式化总练习时间（转换为小时:分钟:秒格式，超过1小时不显示秒）
    const formatTotalTime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;

      if (hours > 0) {
        // 超过1小时不显示秒数，避免换行
        return `${hours}时${minutes}分`;
      } else if (minutes > 0) {
        return `${minutes}分${remainingSeconds}秒`;
      } else {
        return `${remainingSeconds}秒`;
      }
    };

    return (
      <div>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ background: '#f6ffed', borderRadius: '8px' }}>
              <Statistic
                title={<Space><EditOutlined /> 总练习次数</Space>}
                value={typingStats.totalCount || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ background: '#e6f7ff', borderRadius: '8px' }}>
              <Statistic
                title={<Space><TeamOutlined /> 总练习时间</Space>}
                value={formatTotalTime(typingStats.totalPracticeTime || 0)}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ background: '#fff7e6', borderRadius: '8px' }}>
              <Statistic
                title="平均速度"
                value={(typingStats.averages?.avgSpeed > 0)
                  ? Number(typingStats.averages.avgSpeed).toFixed(1)
                  : '0.0'}
                suffix="字/分"
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ background: '#f9f0ff', borderRadius: '8px' }}>
              <Statistic
                title="平均准确率"
                value={(typingStats.averages?.avgAccuracy > 0)
                  ? Number(typingStats.averages.avgAccuracy).toFixed(1)
                  : '0.0'}
                suffix="%"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {typingStats.bestRecord && (
          <Card
            title="最佳记录"
            size="small"
            style={{ marginTop: '16px', borderRadius: '8px' }}
            bordered={false}
            headStyle={{ background: '#f0f5ff', color: '#1890ff', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}
          >
            <Row gutter={16} align="middle">
              <Col span={12}>
                <Space direction="vertical" size={4}>
                  <Text>
                    <Text type="secondary">日期：</Text>
                    {new Date(typingStats.bestRecord.startTime).toLocaleDateString()}
                  </Text>
                  <Text>
                    <Text type="secondary">练习时长：</Text>
                    {Math.round((new Date(typingStats.bestRecord.endTime) - new Date(typingStats.bestRecord.startTime)) / 1000)} 秒
                  </Text>
                  <Space>
                    {typingStats.bestRecord.isPassed && <Tag color="success">达标</Tag>}
                    <Tag color="blue">
                      {typingStats.bestRecord.lessonId ? '课程练习' : '自主练习'}
                    </Tag>
                  </Space>
                </Space>
              </Col>
              <Col span={12}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="速度"
                      value={typingStats.bestRecord.speed}
                      suffix="字/分"
                      valueStyle={{ color: '#1890ff', fontSize: '16px' }}
                    />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      目标: {typingStats.bestRecord.targetSpeed}
                    </Text>
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="准确率"
                      value={typingStats.bestRecord.accuracy}
                      suffix="%"
                      valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                    />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      目标: {typingStats.bestRecord.targetAccuracy}%
                    </Text>
                  </Col>
                </Row>
              </Col>
            </Row>
          </Card>
        )}
      </div>
    );
  };

  // 处理菜单点击，并更新URL参数
  const handleMenuClick = (key) => {
    setSelectedMenu(key);
    // 更新URL查询参数
    setSearchParams({ tab: key });
  };

  const renderContent = () => {
    switch (selectedMenu) {
      case 'ai-assistant':
        return (
          <div>
            <Title level={2}>AI 助手对话</Title>
            <CourseAIHelper />
          </div>
        );
      case 'typing':
        return <TypingPractice onSpeedUpdate={handleSpeedUpdate} />;
      case 'html-editor':
        navigate('/student/html-editor');
        return null;
      case 'point-shop':
        return <PointShop />;
      case 'games':
        return <GameCenter />;
      case 'email':
        navigate('/student/email');
        return null;
      case 'crowdfunding':
        return navigate('/student/crowdfunding');
      case 'my-score':
        return (
          <div>
            {studentId ? (
              <StudentDailyScoreComponent
                studentId={studentId}
                hideNavigation={true}
                semester={currentSemester}
              />
            ) : (
              <Empty description="无法获取学生信息" />
            )}
          </div>
        );
      case 'dashboard':
        return (
          <div>
            {/* 当前课程区域 */}
            <Title level={2}>当前课程</Title>
            {classLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin tip="加载课程信息..." />
              </div>
            ) : currentCourse ? (
              <Card
                hoverable
                style={{ marginBottom: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderRadius: '8px' }}
              >
                <Row gutter={16} align="middle">
                  <Col span={16}>
                    <Title level={4} style={{ margin: 0 }}>{currentCourse.title}</Title>

                    <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
                      <div>
                        <Badge status="processing" text="当前课时" />
                        <Text
                          strong
                          style={{ marginLeft: 8, cursor: 'pointer', color: '#1890ff' }}
                          onClick={handleContinueLearning}
                        >
                          {currentCourse.currentLesson.title}
                        </Text>
                      </div>
                      {/* 暂时不显示下一课时
                      <div>
                        <Badge status="default" text="下一课时" />
                        <Text style={{ marginLeft: 8 }}>{currentCourse.nextLesson.title}</Text>
                      </div>
                      */}
                    </Space>
                  </Col>
                  <Col span={8} style={{ textAlign: 'right' }}>
                    <Space direction="vertical">
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        size="large"
                        onClick={handleContinueLearning}
                      >
                        继续学习
                      </Button>
                      <Button
                        type="link"
                        icon={<ArrowRightOutlined />}
                        onClick={handleViewAllLessons}
                      >
                        查看全部课时
                      </Button>
                    </Space>
                  </Col>
                </Row>
              </Card>
            ) : (
              <Empty description="暂无学习中的课程" />
            )}

            {/* 调整页面布局为双列 */}
            <Row gutter={[24, 24]}>
              {/* 左侧列 */}
              <Col xs={24} sm={24} md={24} lg={24} xl={12}>
                {/* 活动提交记录 */}
                <Card
                  title={<Title level={3} style={{ marginBottom: 0 }}>活动提交记录</Title>}
                  bordered={false}
                  style={{
                    marginBottom: 24,
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    height: '600px', // 增加高度到600px
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  bodyStyle={{
                    padding: '0 16px 16px',
                    flex: 1,
                    overflow: 'hidden' // 防止溢出
                  }}
                >
                  <div style={{ height: '100%', overflow: 'auto' }}>
                    <List
                      loading={loading}
                      itemLayout="horizontal"
                      dataSource={recentAssignments}
                      renderItem={item => {
                        // 活动类型映射（匹配数据库中的activityType值）
                        const typeConfig = {
                          assignment: { label: '作业', color: 'blue', icon: <FileTextOutlined /> },
                          quiz: { label: '测验', color: 'green', icon: <FormOutlined /> },
                          flowchart: { label: '流程图', color: 'magenta', icon: <FileTextOutlined /> },
                          spreadsheet: { label: '表格', color: 'cyan', icon: <FileTextOutlined /> },
                          fillBlank: { label: '填空', color: 'orange', icon: <EditOutlined /> },
                          python: { label: 'Python', color: 'gold', icon: <CodeOutlined /> },
                          html: { label: 'HTML', color: 'volcano', icon: <CodeOutlined /> },
                          resource: { label: '资源', color: 'purple', icon: <FileTextOutlined /> },
                          video: { label: '视频', color: 'geekblue', icon: <FileTextOutlined /> },
                          link: { label: '链接', color: 'lime', icon: <FileTextOutlined /> }
                        };
                        const typeInfo = typeConfig[item.type] || { label: item.type || '活动', color: 'default', icon: <FileTextOutlined /> };

                        // 处理点击进入活动
                        const handleNavigateToActivity = () => {
                          if (item.courseId && item.unitId && item.lessonId && item.activityId) {
                            // 完整路径导航到LessonDetail并预选活动
                            navigate(`/student/course/${item.courseId}/unit/${item.unitId}/lesson/${item.lessonId}?activityId=${item.activityId}`);
                          } else if (item.lessonId && item.activityId) {
                            // 如果没有courseId/unitId，尝试直接导航（可能失败）
                            message.warning('无法导航到该活动，缺少课程信息');
                          }
                        };

                        return (
                          <List.Item
                            actions={[
                              (item.status === 'graded' || (item.score !== undefined && item.score !== null)) ? (
                                <Tag color="success">
                                  <CheckCircleOutlined /> {(item.score !== undefined && item.score !== null) ? `${item.score}分` : '已完成'}
                                </Tag>
                              ) : item.status === 'submitted' ? (
                                <Tag color="processing">
                                  <CheckCircleOutlined /> 已提交
                                </Tag>
                              ) : (
                                <Tag color="default">
                                  <FieldTimeOutlined /> {item.status}
                                </Tag>
                              ),
                              // 文件作业可以查看详情
                              item.content?.file && (item.type === 'assignment' || item.pptAutoGrade?.score != null || item.excelAutoGrade?.score != null) ? (
                                <Button
                                  type="link"
                                  onClick={() => handleViewDetail(item)}
                                >
                                  查看详情
                                </Button>
                              ) : item.lessonId && item.activityId ? (
                                // 其他类型导航到活动页面
                                <Button
                                  type="link"
                                  onClick={handleNavigateToActivity}
                                >
                                  进入活动
                                </Button>
                              ) : null
                            ].filter(Boolean)}
                          >
                            <List.Item.Meta
                              avatar={<Avatar icon={typeInfo.icon} style={{ backgroundColor: '#1890ff' }} />}
                              title={
                                <Space wrap>
                                  <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
                                  <span>{item.title}</span>
                                  {item.lessonName && <Text type="secondary" style={{ fontSize: '12px' }}>（{item.lessonName}）</Text>}
                                </Space>
                              }
                              description={
                                <div>
                                  <div>提交时间: {item.submitTime ? new Date(item.submitTime).toLocaleString() : '-'}</div>
                                  {item.feedback && <div>{item.gradeSource?.includes('auto') ? '自动评阅' : '评语'}: {item.feedback}</div>}
                                </div>
                              }
                            />
                          </List.Item>
                        );
                      }}
                      locale={{
                        emptyText: <Empty description="暂无活动提交记录" />
                      }}
                    />
                  </div>
                </Card>
              </Col>

              {/* 右侧列 */}
              <Col xs={24} sm={24} md={24} lg={24} xl={12}>
                {/* 打字练习记录 */}
                <Card
                  title={<Title level={3} style={{ marginBottom: 0 }}>打字练习记录</Title>}
                  bordered={false}
                  style={{
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    height: '600px', // 增加高度到600px
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  bodyStyle={{
                    flex: 1,
                    overflow: 'hidden' // 防止溢出
                  }}
                >
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div>{renderTypingStats()}</div>
                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ flex: 1, overflow: 'auto' }}>{renderTypingRecords()}</div>
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        );
      case 'courses':
        return (
          <div>
            <Title level={2}>我的课程</Title>
            <CourseList />
          </div>
        );
      case 'network-lab':
        return <NetworkLab />;
      case 'quiz-practice':
        return <QuizPracticeModule />;
      default:
        return <Title level={2}>开发中...</Title>;
    }
  };

  return (
    <Layout className="layout">
      <StudentHeader />
      <Layout>
        <Sider width={200} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[selectedMenu]}
            items={menuItems}
            onClick={({ key }) => handleMenuClick(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Content className="content" style={{ padding: '24px', minHeight: 280 }}>
          {renderContent()}
          {renderAssignmentDetailModal()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default StudentDashboard;