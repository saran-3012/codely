import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { ToastProvider, ErrorBoundary } from '@codely/ui';
import { useAdminAuth } from './hooks/useAdminAuth';
import AdminLoginPage from './pages/AdminLoginPage';
import LogsPage from './pages/LogsPage';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AdminLoginPage />} />
    <Route
      path="/logs"
      element={
        <ProtectedRoute>
          <LogsPage />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<Navigate to="/logs" replace />} />
  </Routes>
);

const App = () => (
  <ErrorBoundary>
    <ToastProvider>
      <AdminAuthProvider>
        <BrowserRouter basename="/admin">
          <AppRoutes />
        </BrowserRouter>
      </AdminAuthProvider>
    </ToastProvider>
  </ErrorBoundary>
);

export default App;
