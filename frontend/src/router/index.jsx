import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import InitializationGate from '../components/shared/InitializationGate';
import DeferredLoading from '../components/shared/DeferredLoading';
import PageUnavailable from '../components/shared/PageUnavailable';
import RouteErrorBoundary from '../components/shared/RouteErrorBoundary';
const Login = lazy(() => import('../pages/common/Login'));
const Setup = lazy(() => import('../pages/common/Setup'));

const TeacherDashboard = lazy(() => import('../pages/teacher/TeacherDashboard'));
const StudentDashboard = lazy(() => import('../pages/student/StudentDashboard'));
const CourseDetail = lazy(() => import('../pages/CourseDetail'));
const CourseList = lazy(() => import('../pages/teacher/CourseList'));
const CourseForm = lazy(() => import('../pages/teacher/CourseForm'));
const UnitList = lazy(() => import('../pages/teacher/UnitList'));
const TeacherCourseDetail = lazy(() => import('../pages/teacher/TeacherCourseDetail'));
const LessonEdit = lazy(() => import('../pages/teacher/LessonEdit'));
const LessonPage = lazy(() => import('../pages/student/LessonPage'));
const SeatSelection = lazy(() => import('../pages/student/SeatSelection'));
const PointShop = lazy(() => import('../pages/student/PointShop'));
const GamePage = lazy(() => import('../pages/student/GamePage'));
const PointShopManagement = lazy(() => import('../pages/teacher/PointShopManagement'));
const StudentLearningStats = lazy(() => import('../pages/teacher/StudentLearningStats'));
const ClassLearningStats = lazy(() => import('../pages/teacher/ClassLearningStats'));
const ClassDailyScores = lazy(() => import('../pages/teacher/ClassDailyScores'));
const StudentDailyScore = lazy(() => import('../pages/teacher/StudentDailyScore'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const Logs = lazy(() => import('../pages/admin/Logs'));
const Messages = lazy(() => import('../pages/student/Messages'));
const ChatAudit = lazy(() => import('../pages/teacher/ChatAudit'));
const SpreadsheetList = lazy(() => import('../pages/common/SpreadsheetList'));
const SpreadsheetPage = lazy(() => import('../pages/common/SpreadsheetPage'));
const EmailClient = lazy(() => import('../pages/common/EmailClient'));
const HtmlEditorPage = lazy(() => import('../pages/student/HtmlEditorPage'));
const HtmlGallery = lazy(() => import('../pages/student/HtmlGallery'));
const TeacherHtmlGallery = lazy(() => import('../pages/teacher/TeacherHtmlGallery'));
const ExamConfiguration = lazy(() => import('../pages/teacher/ExamConfiguration'));

const Router = () => {
  return (
    <RouteErrorBoundary>
    <Suspense fallback={<DeferredLoading />}>
    <Routes>
      {/* 公共路由 */}
      <Route path="/login" element={<InitializationGate><Login /></InitializationGate>} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* 教师路由 */}
      <Route element={<PrivateRoute role="teacher" />}>
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/logs" element={<Logs />} />
        <Route path="/teacher/courses" element={<CourseList />} />
        <Route path="/teacher/course/create" element={<CourseForm />} />
        <Route path="/teacher/course/:courseId" element={<TeacherCourseDetail />} />
        <Route path="/teacher/course/:courseId/units" element={<UnitList />} />
        <Route path="/teacher/course/:courseId/unit/:unitId/lesson/:lessonId/edit" element={<LessonEdit />} />
        <Route path="/teacher/point-shop" element={<PointShopManagement />} />
        <Route path="/teacher/student/:studentId/stats" element={<StudentLearningStats />} />
        <Route path="/teacher/class/:classId/stats" element={<ClassLearningStats />} />
        <Route path="/teacher/class/:classId/daily-scores" element={<ClassDailyScores />} />
        <Route path="/teacher/student/:studentId/daily-score" element={<StudentDailyScore />} />
        <Route path="/teacher/chat-audit" element={<ChatAudit />} />
        <Route path="/teacher/spreadsheets" element={<SpreadsheetList />} />
        <Route path="/teacher/spreadsheet/new" element={<SpreadsheetPage />} />
        <Route path="/teacher/spreadsheet/:id" element={<SpreadsheetPage />} />
        <Route path="/teacher/email" element={<EmailClient />} />
        <Route path="/teacher/html-gallery" element={<TeacherHtmlGallery />} />
        <Route path="/teacher/exam-config" element={<ExamConfiguration />} />
      </Route>

      {/* 学生路由 */}
      <Route element={<PrivateRoute role="student" />}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/seat-selection" element={<SeatSelection />} />
        <Route path="/student/course/:courseId" element={<CourseDetail />} />
        <Route path="/student/course/:courseId/unit/:unitId/lesson/:lessonId" element={<LessonPage />} />
        <Route path="/student/point-shop" element={<PointShop />} />
        <Route path="/student/games" element={<GamePage />} />
        <Route path="/student/games/:recordId" element={<GamePage />} />
        <Route path="/student/messages" element={<Messages />} />
        <Route path="/student/spreadsheets" element={<SpreadsheetList />} />
        <Route path="/student/spreadsheet/new" element={<SpreadsheetPage />} />
        <Route path="/student/spreadsheet/:id" element={<SpreadsheetPage />} />
        <Route path="/student/email" element={<EmailClient />} />
        <Route path="/student/html-editor" element={<HtmlEditorPage />} />
        <Route path="/student/html-editor/:id" element={<HtmlEditorPage />} />
        <Route path="/student/html-gallery" element={<HtmlGallery />} />
        <Route path="/student/html-gallery/:id" element={<HtmlGallery />} />
      </Route>

      {/* 管理员路由 */}
      <Route element={<PrivateRoute role="admin" />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/logs" element={<Logs />} />
      </Route>

      <Route path="*" element={<PageUnavailable />} />
    </Routes>
    </Suspense>
    </RouteErrorBoundary>
  );
};

export default Router;
