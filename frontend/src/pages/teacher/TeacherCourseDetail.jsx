import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  message
} from 'antd';
import {
  BookOutlined,
  EditOutlined,
  ArrowLeftOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { courseManagementAPI } from '../../services/api';
import UnitList from './UnitList';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const TeacherCourseDetail = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) {
      message.error('课程ID无效');
      navigate('/teacher');
      return;
    }
    fetchCourseDetails();
  }, [courseId]);

  const fetchCourseDetails = async () => {
    try {
      const response = await courseManagementAPI.getCourse(courseId);
      if (response.data.success) {
        setCourse(response.data.data.course);
      } else {
        message.error('获取课程信息失败');
      }
    } catch (error) {
      console.error('获取课程信息失败:', error);
      message.error('获取课程信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/teacher/courses/${courseId}/edit`);
  };

  const handleCreateLesson = (unitId) => {
    navigate(`/teacher/courses/${courseId}/units/${unitId}/lessons/new`);
  };

  const getDifficultyColor = (level) => {
    const colors = {
      '入门': 'green',
      '初级': 'blue',
      '中级': 'orange',
      '高级': 'red'
    };
    return colors[level] || 'default';
  };

  const getTypeText = (type) => {
    const types = {
      'software': '软件开发',
      'programming': '编程语言',
      'language': '外语学习',
      'design': '设计',
      'business': '商业',
      'other': '其他'
    };
    return types[type] || type;
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!course) {
    return <div>未找到课程</div>;
  }

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
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <Title level={4} style={{ margin: 0 }}>课程单元管理</Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(`/teacher/courses/${courseId}/units/new`)}
            >
              添加单元
            </Button>
          </div>
          <UnitList 
            courseId={courseId} 
            onCreateLesson={handleCreateLesson}
          />
        </div>
      )
    }
  ];

  return (
    <Layout>
      <Content style={{ padding: '24px' }}>
        <Card>
          <div style={{ marginBottom: '20px' }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/teacher/courses')}
              style={{ marginBottom: '16px' }}
            >
              返回课程列表
            </Button>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={2} style={{ marginBottom: '8px' }}>{course.title}</Title>
                <Space size={[0, 8]} wrap>
                  <Tag color={getDifficultyColor(course.level)}>
                    {course.level}
                  </Tag>
                  <Tag color="blue">{getTypeText(course.type)}</Tag>
                </Space>
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={handleEdit}
                >
                  编辑课程
                </Button>
              </Col>
            </Row>
          </div>

          <Paragraph style={{ marginBottom: '24px' }}>
            {course.description}
          </Paragraph>

          <Tabs items={tabItems} />
        </Card>
      </Content>
    </Layout>
  );
};

export default TeacherCourseDetail;
