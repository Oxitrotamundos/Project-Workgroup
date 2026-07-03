import React from 'react';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useUserRole } from '../hooks/useUserRole';

interface AdminRouteProps {
  children: React.ReactNode;
}

// Gate interno: asume que ya pasó ProtectedRoute (usuario autenticado)
const AdminGate: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAdmin, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => (
  <ProtectedRoute>
    <AdminGate>{children}</AdminGate>
  </ProtectedRoute>
);

export default AdminRoute;
