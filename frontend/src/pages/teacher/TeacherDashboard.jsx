import { getSettings } from '../../services/api';
import React, { useState, useEffect } from 'react';
import { ConfigProvider, Layout, Menu } from 'antd';
import './TeacherDashboard.css';
import TeacherHeader from '../../layouts/TeacherHeader';
import PendingReviews from '../../components/Review/PendingReviews';
import ReviewHistory from '../../components/Review/ReviewHistory';
import ReviewStats from '../../components/Review/ReviewStats';
import CourseList from './CourseList';
import AssignmentReview from './AssignmentReview';
import TeacherHtmlGallery from './TeacherHtmlGallery';
import DashboardWelcome from './components/DashboardWelcome';
import UserManual from './components/UserManual';
import ClassManagement from '../../components/Class/ClassManagement';
import ClassroomManagement from '../../components/Classroom/ClassroomManagement';
import ClassroomLayoutManagement from '../../components/Classroom/ClassroomLayoutManagement';
import TypingTextManagement from '../../components/Typing/TypingTextManagement';
import TypingScoreManagement from '../../components/Typing/TypingScoreManagement';
import QuestionBank from '../../components/Quiz/teacher/QuestionBank';
import QuizManagement from '../../components/Quiz/teacher/QuizManagement';
import QuizAnalysis from '../../components/Quiz/teacher/QuizAnalysis';
import QuestionAnalysis from '../../components/Quiz/teacher/QuestionAnalysis';
import FreePracticeManagement from '../../components/Quiz/teacher/FreePracticeManagement';
import FreePracticeRecords from '../../components/Quiz/teacher/FreePracticeRecords';
import AiTeachingAssistant from '../../components/AiRag/AiTeachingAssistant';
import LearningStatsManagement from '../../components/Stats/LearningStatsManagement';
import PointShopManagement from './PointShopManagement';
import {
  DesktopOutlined,
  EditOutlined,
  BookOutlined,
  TeamOutlined,
  FileTextOutlined,
  MessageOutlined,
  FormOutlined,
  SettingOutlined,
  LayoutOutlined,
  RobotOutlined,
  ShoppingOutlined,
  BarChartOutlined,
  MailOutlined,
  GlobalOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Content, Sider } = Layout;

const ReviewManagement = () => {
  const [activeTab, setActiveTab] = useState('pending');

  return (
    <div className="review-management">
      <Menu
        selectedKeys={[activeTab]}
        mode="horizontal"
        onClick={({ key }) => setActiveTab(key)}
      >
        <Menu.Item key="pending">待审核消息</Menu.Item>
        <Menu.Item key="history">审核历史</Menu.Item>
      </Menu>
      <div className="review-content" style={{ padding: '24px 0' }}>
        {activeTab === 'pending' && <PendingReviews />}
        {activeTab === 'history' && <ReviewHistory />}
      </div>
    </div>
  );
};

const TeacherDashboard = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const defaultSelectedKey = urlParams.get('tab') || 'classroom';
  const [selectedKey, setSelectedKey] = useState(defaultSelectedKey);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const [ragEnabled, setRagEnabled] = useState(false);
  useEffect(() => {
    getSettings('rag.enabled').then(s => setRagEnabled(s?.value === true)).catch(() => setRagEnabled(false));
  }, []);

  // 监听 URL 查询参数变化，确保在导航回来时能正确显示选项卡
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const tabKey = params.get('tab');
      if (tabKey && tabKey !== selectedKey) {
        setSelectedKey(tabKey);
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [selectedKey]);

  const menuItems = [
    {
      key: 'classroom',
      icon: <DesktopOutlined />,
      label: '上课',
    },
    {
      key: 'course',
      icon: <BookOutlined />,
      label: '课程管理',
    },
    {
      key: 'quiz',
      icon: <FormOutlined />,
      label: '测验模块',
      children: [
        {
          key: 'question-bank',
          label: '题库管理',
        },
        {
          key: 'question-analysis',
          label: '题目分析',
        },
        {
          key: 'quiz-management',
          label: '试卷管理',
        },
        {
          key: 'quiz-analysis',
          label: '试卷分析',
        },
        {
          key: 'free-practice',
          label: '自由练习设置',
        },
        {
          key: 'free-practice-records',
          label: '练习记录',
        },
      ],
    },
    {
      key: 'typing',
      icon: <EditOutlined />,
      label: '打字模块',
      children: [
        {
          key: 'typing-text',
          label: '文本管理',
        },
        {
          key: 'typing-score',
          label: '打字记录',
        },
      ],
    },
    {
      key: 'assignment',
      icon: <FileTextOutlined />,
      label: '作业批阅',
    },
    {
      key: 'stats',
      icon: <BarChartOutlined />,
      label: '学习统计',
    },
    {
      key: 'html-gallery',
      icon: <GlobalOutlined />,
      label: '网页作品',
    },
    {
      key: 'email',
      icon: <MailOutlined />,
      label: '邮件系统',
    },
    {
      key: 'ai-assistant',
      icon: <MessageOutlined />,
      label: 'AI助手',
      children: [
        {
          key: 'pending-reviews',
          label: '待审核消息',
        },
        {
          key: 'review-history',
          label: '审核历史',
        },
      ],
    },
    {
      key: 'ai-teaching',
      icon: <RobotOutlined />,
      label: '知识库智能助教',
      children: [
        {
          key: 'ai-lesson',
          label: 'AI备课',
        },
        {
          key: 'ai-quiz',
          label: 'AI出题',
        },
        {
          key: 'ai-chat',
          label: 'AI聊天',
        },
      ],
    },
    {
      key: 'point-shop',
      icon: <ShoppingOutlined />,
      label: '积分商店管理',
    },
    {
      key: 'class',
      icon: <TeamOutlined />,
      label: '班级管理',
    },
    {
      key: 'classroom-layout',
      icon: <LayoutOutlined />,
      label: '机房管理',
    },
    {
      key: 'manual',
      icon: <QuestionCircleOutlined />,
      label: '平台手册',
    }
  ];

  const handleMenuClick = (key) => {
    setSelectedKey(key);
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('tab', key);
    window.history.pushState({}, '', newUrl);
  };

  const handleResize = () => {
    setCollapsed(window.innerWidth < 768);
  };

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    handleResize(); // 初始化时检查窗口大小
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getContent = () => {
    if (!ragEnabled && ['ai-lesson', 'ai-quiz', 'ai-chat'].includes(selectedKey)) return <DashboardWelcome />;
    switch (selectedKey) {
      case 'classroom':
        return <ClassroomManagement />;
      case 'classroom-layout':
        return <ClassroomLayoutManagement />;
      case 'course':
        return <CourseList />;
      case 'class':
        return <ClassManagement />;
      case 'assignment':
        return <AssignmentReview />;
      case 'pending-reviews':
        return <PendingReviews />;
      case 'review-history':
        return <ReviewHistory />;
      case 'typing-text':
        return <TypingTextManagement />;
      case 'typing-score':
        return <TypingScoreManagement />;
      case 'question-bank':
        return <QuestionBank />;
      case 'quiz-management':
        return <QuizManagement />;
      case 'free-practice':
        return <FreePracticeManagement />;
      case 'free-practice-records':
        return <FreePracticeRecords />;
      case 'quiz-analysis':
        return <QuizAnalysis />;
      case 'question-analysis':
        return <QuestionAnalysis />;
      case 'ai-lesson':
        return <AiTeachingAssistant mode="lesson" />;
      case 'ai-quiz':
        return <AiTeachingAssistant mode="quiz" />;
      case 'ai-chat':
        return <AiTeachingAssistant mode="chat" />;
      case 'point-shop':
        return <PointShopManagement />;
      case 'stats':
        return <LearningStatsManagement />;
      case 'email':
        navigate('/teacher/email');
        return null;
      case 'html-gallery':
        return <TeacherHtmlGallery />;
      case 'manual':
        return <UserManual />;
      default:
        return <DashboardWelcome />;
    }
  };

  return (
    <ConfigProvider theme={{
      token: {
        colorPrimary: '#326b59',
        colorInfo: '#326b59',
        colorInfoBg: '#f3f8f5',
        colorInfoBorder: '#dce8df',
        colorText: '#25352f',
        colorTextSecondary: '#738078',
        colorBorder: '#dce3de',
        borderRadius: 6,
      },
      components: {
        Menu: { itemSelectedBg: '#e8f0eb', itemSelectedColor: '#285b48', itemHeight: 42 },
        Table: { headerBg: '#f5f7f5', rowHoverBg: '#f7faf8' },
        Button: { primaryShadow: 'none' },
      },
    }}>
    <Layout className="teacher-workspace" style={{ minHeight: '100vh' }}>
      <TeacherHeader collapsed={collapsed} title={selectedKey === 'classroom' ? '课堂管理' : menuItems.flatMap(item => item.children || [item]).find(item => item.key === selectedKey)?.label || '教师工作台'} />
      <Layout style={{ paddingTop: 64 }}>
        <Sider
          width={224}
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          className="custom-sider teacher-sider"
          style={{
            background: '#fff',
            borderRight: '1px solid #f0f0f0',
            overflow: 'auto',
            height: 'calc(100vh - 64px)',
            position: 'fixed',
            top: 64,
            left: 0,
            zIndex: 10
          }}
        >
          <div className="teacher-nav-caption">{collapsed ? '教学' : '教学工作台'}</div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{
              borderRight: 0
            }}
            items={menuItems.filter(item => item.key !== 'ai-teaching' || ragEnabled)}
            onClick={({ key }) => handleMenuClick(key)}
          />
        </Sider>
        <Layout style={{ marginLeft: collapsed ? 80 : 224, transition: 'margin-left 0.2s' }}>
          <Content className="teacher-content"
            style={{
              background: '#fff',
              borderRadius: '4px',
              padding: 24,
              margin: '0px',
              minHeight: 'calc(100vh - 64px)'
            }}
          >
            <div className="teacher-page-surface">{getContent()}</div>
          </Content>
        </Layout>
      </Layout>
    </Layout>
    </ConfigProvider>
  );
};

export default TeacherDashboard;