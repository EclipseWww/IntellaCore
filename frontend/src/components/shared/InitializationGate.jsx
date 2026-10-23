import React from 'react';
import { Navigate } from 'react-router-dom';
import useInitializationStatus from '../../hooks/useInitializationStatus';

export default function InitializationGate({ children }) {
  const { status } = useInitializationStatus();
  // Setup is exceptional: only an explicit server response redirects to it.
  if (status?.initialized === false) return <Navigate to="/setup" replace />;
  return children;
}
