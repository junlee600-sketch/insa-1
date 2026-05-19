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

// Executive Evaluation Pages
import ExecutiveEvaluations from './pages/ExecutiveEvaluations';
import ExecutiveEvaluationForm from './pages/ExecutiveEvaluationForm';
import ExecutiveEvaluationItems from './pages/admin/ExecutiveEvaluationItems';
import ExecutiveAssignments from './pages/admin/ExecutiveAssignments';
import ExecutiveFinalResults from './pages/admin/ExecutiveFinalResults';

function ProtectedRoute({ children, requiredRole, allowGroupLeader, allowPresident, allowExecutives }: { children: React.ReactNode, requiredRole?: string[], allowGroupLeader?: boolean, allowPresident?: boolean, allowExecutives?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  if (requiredRole) {
    let hasAccess = requiredRole.includes(user.role);
    if (!hasAccess && allowGroupLeader && user.position?.endsWith('그룹장')) {
      hasAccess = true;
    }
    if (!hasAccess && allowPresident && user.position === '사장') {
      hasAccess = true;
    }
    if (!hasAccess && allowExecutives && ['본부장', '그룹장', '사장'].includes(user.position || '')) {
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
            <Route 
              path="evaluate-executive" 
              element={<ProtectedRoute requiredRole={['admin', 'hr']} allowExecutives={true}><ExecutiveEvaluations /></ProtectedRoute>} 
            />
            <Route 
              path="evaluate-executive/:assignmentId" 
              element={<ProtectedRoute requiredRole={['admin', 'hr']} allowExecutives={true}><ExecutiveEvaluationForm /></ProtectedRoute>} 
            />

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
              path="admin/items-executive" 
              element={<ProtectedRoute requiredRole={['admin', 'hr']}><ExecutiveEvaluationItems /></ProtectedRoute>} 
            />
            <Route 
              path="admin/assignments" 
              element={<ProtectedRoute requiredRole={['admin', 'hr']}><EvaluationAssignments /></ProtectedRoute>} 
            />
            <Route 
              path="admin/assignments-executive" 
              element={<ProtectedRoute requiredRole={['admin', 'hr']}><ExecutiveAssignments /></ProtectedRoute>} 
            />
            <Route 
              path="admin/results" 
              element={<ProtectedRoute requiredRole={['admin', 'hr']} allowGroupLeader={true} allowPresident={true}><FinalResults /></ProtectedRoute>} 
            />
            <Route 
              path="admin/results-executive" 
              element={<ProtectedRoute requiredRole={['admin', 'hr']} allowPresident={true}><ExecutiveFinalResults /></ProtectedRoute>} 
            />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
