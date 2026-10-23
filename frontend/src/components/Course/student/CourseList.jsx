import React, { useState, useEffect } from 'react';
import { List, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import CourseCard from './CourseCard';
import { courseUnitAPI } from '../../../services/api';



const CourseList = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const data = await courseUnitAPI.getStudentCourses();
      setCourses(data.courses || []);
    } catch (error) {
      message.error('获取课程列表失败');
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleCourseClick = (courseId) => {
    navigate(`/student/course/${courseId}`);
  };

  return (
    <List
      loading={loading}
      grid={{ 
        gutter: { xs: 8, sm: 16, md: 24 },
        xs: 1,
        sm: 2,
        md: 3
      }}
      dataSource={courses}
      renderItem={course => (
        <List.Item style={{ display: 'flex', justifyContent: 'center' }}>
          <CourseCard 
            course={course} 
            onClick={handleCourseClick}
          />
        </List.Item>
      )}
    />
  );
};

export default CourseList;
