import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import {
  Layout,
  Typography,
  Card,
  Row,
  Col,
  Tabs,
  Tag,
  Space,
  Button,
  message,
  Modal
} from 'antd';
import {
  BookOutlined,
  UserOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import CourseAIHelper from '../components/Course/student/CourseAIHelper';
import CourseUnitList from '../components/Course/student/CourseUnitList';
import LessonDetail from '../components/Course/student/LessonDetail';
import { courseManagementAPI } from '../services/api';
import StudentHeader from '../layouts/StudentHeader';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const CourseDetail = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lessonModalVisible, setLessonModalVisible] = useState(false);

  usePageTitle(course?.title);

  useEffect(() => {
    if (!courseId) {
      message.error('课程ID无效');
      navigate('/student');
      return;
    }
    fetchCourseDetails();
  }, [courseId]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && course) {
      document.title = `${user.name} - ${course.title}`;
    }
  }, [course]);

  const fetchCourseDetails = async () => {
    try {
      const [courseData, progressData] = await Promise.all([
        courseManagementAPI.getCourseDetails(courseId),
        courseManagementAPI.getCourseProgress(courseId)
      ]);
      
      setCourse(courseData);
      setProgress(progressData);
    } catch (error) {
      console.error('获取课程信息失败:', error);
      message.error('获取课程信息失败');
      if (error.response?.status === 404) {
        navigate('/student');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLessonClick = (lessonId) => {
    setSelectedLesson(lessonId);
    setLessonModalVisible(true);
  };

  const handleBackToHome = () => {
    navigate('/student');
  };

  const tabItems = [
    {
      key: 'curriculum',
      label: (
        <span>
          <BookOutlined />
          课程大纲
        </span>
      ),
      children: (
        <CourseUnitList 
          courseId={courseId}
          onLessonClick={handleLessonClick}
          defaultExpanded={true}
        />
      )
    }
  ];

  if (loading || !course) {
    return <Card loading={true} />;
  }

  return (
    <Layout className="course-detail">
      <StudentHeader />
      <div className="course-header" style={{ padding: '24px 48px', background: '#fff', marginBottom: '24px' }}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={16}>
            <Space align="start">
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={handleBackToHome}
                style={{ marginRight: 16 }}
                type="primary"
                size="large"
              >
                返回首页
              </Button>
              <div>
                <Title level={2} style={{ margin: 0 }}>{course.title}</Title>
                <Paragraph>{course.description}</Paragraph>
                <Space size={[0, 8]} wrap>
                  {course.tags?.map(tag => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={8}>
            {/* <Button 
              type="primary" 
              style={{ width: '200px', height: '40px' }}
            >
              继续学习
            </Button> */}
          </Col>
        </Row>
      </div>

      <Content style={{ padding: '0 48px' }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={14}>
            <Card>
              <Tabs items={tabItems} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <div style={{ position: 'sticky', top: 24 }}>
              <CourseAIHelper 
                courseId={courseId}
                courseName={course.title}
                courseDescription={course.description}
              />
            </div>
          </Col>
        </Row>
      </Content>

      <Modal
        title="课时详情"
        open={lessonModalVisible}
        onCancel={() => setLessonModalVisible(false)}
        width={1000}
        footer={null}
      >
        {selectedLesson && (
          <LessonDetail lessonId={selectedLesson} />
        )}
      </Modal>
    </Layout>
  );
};

export default CourseDetail;
