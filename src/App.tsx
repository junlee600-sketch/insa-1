import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import UserManagement from './pages/admin/UserManagement';
import EvaluationSettings from './pages/admin/EvaluationSettings';
import EvaluationItems from './pages/admin/EvaluationItems';
import EvaluationAssignments from './pages/admin/EvaluationAssignments';
import FinalResults from './pages/admin/FinalResults';
import MyEvaluations from './pages/MyEvaluations';
import EvaluationForm from './pages/EvaluationForm';
import MyHistory from './pages/MyHistory';
import ProfileSettings from './pages/ProfileSettings';

function ProtectedRoute({ children, requiredRole, allowGroupLeader }: { children: React.ReactNode, requiredRole?: string[], allowGroupLeader?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  if (requiredRole) {
    let hasAccess = requiredRole.includes(user.role);
    if (!hasAccess && allowGroupLeader && user.position?.endsWith('그룹장')) {
      hasAccess = true;
    }
    if (!hasAccess) return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            
            {/* User Evaluator Views */}
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="evaluate" element={<MyEvaluations />} />
            <Route path="evaluate/:assignmentId" element={<EvaluationForm />} />

            {/* Admin / HR Views */}
            <Route 
              path="history" 
              element={<ProtectedRoute requiredRole={['admin', 'hr']}><MyHistory /></ProtectedRoute>} 
            />
            <Route 
              path="admin/users" 
              element={<ProtectedRoute requiredRole={['admin']}><UserManagement /></ProtectedRoute>} 
            />
            <Route 
              path="admin/settings" 
              element={<ProtectedRoute requiredRole={['admin', 'hr']}><EvaluationSettings /></ProtectedRoute>} 
            />
            <Route 
              path="admin/items" 
              element={<ProtectedRoute requiredRole={['admin', 'hr']}><EvaluationItems /></ProtectedRoute>} 
            />
            <Route 
              path="admin/assignments" 
              element={<ProtectedRoute requiredRole={['admin', 'hr']}><EvaluationAssignments /></ProtectedRoute>} 
            />
            <Route 
              path="admin/results" 
              element={<ProtectedRoute requiredRole={['admin', 'hr']} allowGroupLeader={true}><FinalResults /></ProtectedRoute>} 
            />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
