import React, { useState, useEffect } from 'react';
import { List, Card, Space, Typography, Progress, Tag, Collapse, Spin, message } from 'antd';
import {
  BookOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  RightOutlined,
  ReadOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './CourseUnitList.css';
import { courseUnitAPI } from '../../../services/api';
import api from '../../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

// 自定义样式
const styles = {
  unitPanel: {
    marginBottom: '16px',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
  },
  unitHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px'
  },
  unitIcon: {
    fontSize: '22px',
    color: '#1890ff',
    marginRight: '12px'
  },
  unitTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: 0
  },
  unitContent: {
    padding: '0 16px 16px'
  },
  lessonItem: {
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '8px',
    transition: 'all 0.3s',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    border: '1px solid #f0f0f0'
  },
  lessonItemActive: {
    backgroundColor: '#e6f7ff',
    borderColor: '#91d5ff'
  },
  lessonIcon: {
    fontSize: '18px',
    color: '#1890ff',
    marginRight: '12px'
  },
  lessonTitle: {
    fontWeight: '500'
  },
  lessonStatus: {
    display: 'flex',
    alignItems: 'center'
  },
  statusTag: {
    borderRadius: '12px',
    padding: '0 10px',
    height: '24px',
    lineHeight: '24px',
    marginLeft: '8px',
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap'
  },
  statusTagCompleted: {
    backgroundColor: '#f6ffed',
    color: '#52c41a',
    border: '1px solid #b7eb8f'
  },
  statusTagInProgress: {
    backgroundColor: '#e6f7ff',
    color: '#1890ff',
    border: '1px solid #91d5ff',
    minWidth: '70px'
  },
  objectives: {
    backgroundColor: '#fafafa',
    padding: '12px 16px',
    borderRadius: '6px',
    marginTop: '16px',
    marginBottom: '16px'
  },
  objectivesList: {
    paddingLeft: '20px',
    marginTop: '8px',
    marginBottom: '0'
  },
  objectiveItem: {
    marginBottom: '6px'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px 0'
  }
};

const CourseUnitList = ({ courseId, onLessonClick, defaultExpanded }) => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState({});
  const [unitLessons, setUnitLessons] = useState({});
  const [activeKeys, setActiveKeys] = useState([]);
  const [currentClassLesson, setCurrentClassLesson] = useState(null);
  const navigate = useNavigate();

  // 获取当前用户信息和班级设置
  useEffect(() => {
    const fetchCurrentClassSettings = async () => {
      try {
        // 从localStorage获取用户信息
        const userString = localStorage.getItem('user');
        if (!userString) return;

        const user = JSON.parse(userString);
        if (user.role !== 'student') return;

        // 获取用户的班级设置
        const response = await api.get(`/users/${user.id}/class-settings`);
        if (response.data && response.data.isInClass && response.data.currentLesson) {
          setCurrentClassLesson(response.data.currentLesson);
        }
      } catch (error) {
        console.error('获取班级设置失败:', error);
      }
    };

    fetchCurrentClassSettings();
  }, []);

  useEffect(() => {
    if (courseId) {
      fetchUnits();
    }
  }, [courseId]);

  const fetchUnits = async () => {
    try {
      setLoading(true);
      const response = await courseUnitAPI.getUnits(courseId);
      setUnits(response);
      // 如果defaultExpanded为true，设置所有单元的key为激活状态
      if (defaultExpanded) {
        setActiveKeys(response.map(unit => unit._id));
        // 为每个单元预先加载课时
        response.forEach(unit => {
          fetchUnitLessons(unit._id);
        });
      }
    } catch (error) {
      console.error('获取课程单元失败:', error);
      message.error('获取课程单元失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnitLessons = async (unitId) => {
    if (unitLessons[unitId]) return; // 如果已经加载过，就不再加载

    try {
      setLoadingLessons(prev => ({ ...prev, [unitId]: true }));
      const response = await courseUnitAPI.getLessons(courseId, unitId);

      if (response.success) {
        setUnitLessons(prev => ({
          ...prev,
          [unitId]: response.data
        }));
      } else {
        console.error('获取课时失败:', response.message);
      }
    } catch (error) {
      console.error('获取课时失败:', error);
    } finally {
      setLoadingLessons(prev => ({ ...prev, [unitId]: false }));
    }
  };

  const getUnitIcon = (type) => {
    switch (type) {
      case 'chapter':
        return <BookOutlined style={styles.unitIcon} />;
      case 'lesson':
        return <VideoCameraOutlined style={styles.unitIcon} />;
      default:
        return <FileTextOutlined style={styles.unitIcon} />;
    }
  };

  const getUnitTypeText = (type) => {
    const types = {
      chapter: '章节',
      section: '小节',
      lesson: '课时'
    };
    return types[type] || '单元';
  };

  const renderLesson = (lesson, unitId) => {
    // 判断是否是当前正在上课的课时
    const isCurrentLesson = currentClassLesson && lesson._id === currentClassLesson;

    return (
      <div
        key={lesson._id}
        className={`course-lesson-item ${isCurrentLesson ? 'active' : ''}`}
        style={{
          ...styles.lessonItem,
          ...(isCurrentLesson ? styles.lessonItemActive : {})
        }}
        onClick={() => navigate(`/student/course/${courseId}/unit/${unitId}/lesson/${lesson._id}`)}
      >
        <Space align="center" size="middle">
          <ReadOutlined style={styles.lessonIcon} />
          <div>
            <Text strong style={styles.lessonTitle}>{lesson.title}</Text>
          </div>
        </Space>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: '140px' }}>
          {lesson.duration && (
            <span style={{ display: 'flex', alignItems: 'center', marginRight: 8, whiteSpace: 'nowrap' }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {lesson.duration}分钟
            </span>
          )}
          {isCurrentLesson && (
            <span style={{ ...styles.statusTag, ...styles.statusTagInProgress }}>
              <PlayCircleOutlined style={{ marginRight: 4 }} />
              进行中
            </span>
          )}
          {lesson.status === 'completed' && (
            <span style={{ ...styles.statusTag, ...styles.statusTagCompleted }}>
              <CheckCircleOutlined style={{ marginRight: 4 }} />
              已完成
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderUnitLessons = (unitId) => {
    if (loadingLessons[unitId]) {
      return (
        <div style={styles.loadingContainer}>
          <Spin size="small" />
        </div>
      );
    }

    if (!unitLessons[unitId]) {
      return null;
    }

    return (
      <div className="unit-lessons">
        {unitLessons[unitId].map(lesson => renderLesson(lesson, unitId))}
      </div>
    );
  };

  const renderUnit = (unit) => {
    const lessons = unitLessons[unit._id] || [];
    const isLoading = loadingLessons[unit._id];

    return (
      <Panel
        header={
          <div style={styles.unitHeader}>
            {getUnitIcon(unit.type)}
            <div style={{ flex: 1 }}>
              <Text strong style={styles.unitTitle}>{unit.title}</Text>
              {unit.totalLessons && (
                <Text type="secondary" style={{ marginLeft: 8, fontSize: '13px' }}>
                  {unit.totalLessons} 课时
                </Text>
              )}
            </div>
            <Tag color="blue">{getUnitTypeText(unit.type)}</Tag>
          </div>
        }
        key={unit._id}
        style={styles.unitPanel}
      >
        <div style={styles.unitContent}>
          {unit.description && (
            <Paragraph type="secondary">
              {unit.description}
            </Paragraph>
          )}
          {unit.objectives?.length > 0 && (
            <div style={styles.objectives}>
              <Title level={5}>本章目标</Title>
              <ul style={styles.objectivesList}>
                {unit.objectives.map((objective, index) => (
                  <li key={index} style={styles.objectiveItem}>
                    <Text type="secondary">{objective}</Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="unit-lessons">
            {isLoading ? (
              <div style={styles.loadingContainer}>
                <Spin size="small" />
              </div>
            ) : (
              renderUnitLessons(unit._id)
            )}
          </div>
        </div>
      </Panel>
    );
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="course-unit-list">
      <Collapse
        activeKey={activeKeys}
        onChange={setActiveKeys}
        expandIconPosition="end"
        bordered={false}
      >
        {units.map(unit => renderUnit(unit))}
      </Collapse>
    </div>
  );
};

export default CourseUnitList;
