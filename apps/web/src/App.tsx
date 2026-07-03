import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/Layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectView from './pages/ProjectView';
import AccountApiKeys from './pages/AccountApiKeys';
import CalendarSettingsPage from './pages/CalendarSettingsPage';
import ProjectSettingsPage from './pages/ProjectSettingsPage';
import SettingsPage from './pages/SettingsPage';
import AdminUsers from './pages/AdminUsers';
import AdminResources from './pages/AdminResources';

const LoginWrapper = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Login />;
};


function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<LoginWrapper />} />
            <Route
              path="/signup"
              element={<Navigate to="/login" state={{ signupDisabled: true }} replace />}
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:projectId"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProjectView />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/account/api-keys"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AccountApiKeys />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:projectId/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProjectSettingsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:projectId/settings/calendar"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CalendarSettingsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SettingsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/calendar"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CalendarSettingsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AppLayout>
                    <AdminUsers />
                  </AppLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/resources"
              element={
                <AdminRoute>
                  <AppLayout>
                    <AdminResources />
                  </AppLayout>
                </AdminRoute>
              }
            />

            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
