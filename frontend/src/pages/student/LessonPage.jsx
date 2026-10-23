import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import LessonDetail from '../../components/Course/student/LessonDetail';

const LessonPage = () => {
  const { courseId, unitId, lessonId } = useParams();
  const [searchParams] = useSearchParams();
  const activityId = searchParams.get('activity');

  return <LessonDetail lessonId={lessonId} courseId={courseId} unitId={unitId} initialActivityId={activityId} />;
};

export default LessonPage;
