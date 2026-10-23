import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

const PrivateRoute = ({ role }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');
  const location = useLocation();
  const isSimulation = new URLSearchParams(location.search).get('mode') === 'simulation';

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // 如果是模拟模式且用户是教师，允许访问学生路由
  if (role === 'student' && user.role === 'teacher' && isSimulation) {
    return <Outlet />;
  }

  // 其他情况下进行正常的角色检查
  if (role && user.role !== role) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;