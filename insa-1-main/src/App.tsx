import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MenuPermissionsProvider, useMenuPermissions } from './contexts/MenuPermissionsContext';
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

import MenuPermissions from './pages/admin/MenuPermissions';

// Executive Evaluation Pages
import ExecutiveEvaluations from './pages/ExecutiveEvaluations';
import ExecutiveEvaluationForm from './pages/ExecutiveEvaluationForm';
import ExecutiveEvaluationItems from './pages/admin/ExecutiveEvaluationItems';
import ExecutiveAssignments from './pages/admin/ExecutiveAssignments';
import ExecutiveFinalResults from './pages/admin/ExecutiveFinalResults';

function ProtectedRoute({ children, requiredRole, allowGroupLeader, allowPresident, allowExecutives, menuPath }: {
  children: React.ReactNode;
  requiredRole?: string[];
  allowGroupLeader?: boolean;
  allowPresident?: boolean;
  allowExecutives?: boolean;
  menuPath?: string;
}) {
  const { user, loading } = useAuth();
  const menuPerms = useMenuPermissions();

  if (loading) return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  if (!user) return <Navigate to="/login" replace />;

  // 1순위: 사용자별 개별 권한 (UserManagement에서 설정)
  if (menuPath && user.menuPermissions && menuPath in user.menuPermissions) {
    return user.menuPermissions[menuPath] ? <>{children}</> : <Navigate to="/" replace />;
  }

  // 2순위: Firestore 기반 역할별 메뉴 권한 (메뉴 권한 관리에서 설정)
  if (menuPath && menuPerms[menuPath]) {
    const p = menuPerms[menuPath];
    const role = user.role as 'admin' | 'hr' | 'user';
    let hasAccess = p[role];
    if (!hasAccess && allowGroupLeader && user.position?.endsWith('그룹장')) hasAccess = true;
    if (!hasAccess && allowPresident && user.position === '사장') hasAccess = true;
    if (!hasAccess && allowExecutives && ['본부장', '그룹장', '사장'].includes(user.position || '')) hasAccess = true;
    return hasAccess ? <>{children}</> : <Navigate to="/" replace />;
  }

  // 3순위: 하드코딩 역할 체크 (fallback)
  if (requiredRole) {
    let hasAccess = requiredRole.includes(user.role);
    if (!hasAccess && allowGroupLeader && user.position?.endsWith('그룹장')) hasAccess = true;
    if (!hasAccess && allowPresident && user.position === '사장') hasAccess = true;
    if (!hasAccess && allowExecutives && ['본부장', '그룹장', '사장'].includes(user.position || '')) hasAccess = true;
    if (!hasAccess) return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <MenuPermissionsProvider>
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
              element={<ProtectedRoute menuPath="/evaluate-executive" requiredRole={['admin', 'hr']} allowExecutives={true}><ExecutiveEvaluations /></ProtectedRoute>}
            />
            <Route
              path="evaluate-executive/:assignmentId"
              element={<ProtectedRoute menuPath="/evaluate-executive" requiredRole={['admin', 'hr']} allowExecutives={true}><ExecutiveEvaluationForm /></ProtectedRoute>}
            />

            {/* Admin / HR Views */}
            <Route
              path="history"
              element={<ProtectedRoute menuPath="/history" requiredRole={['admin', 'hr']}><MyHistory /></ProtectedRoute>}
            />
            <Route
              path="admin/users"
              element={<ProtectedRoute menuPath="/admin/users" requiredRole={['admin']}><UserManagement /></ProtectedRoute>}
            />
            <Route
              path="admin/settings"
              element={<ProtectedRoute menuPath="/admin/settings" requiredRole={['admin', 'hr']}><EvaluationSettings /></ProtectedRoute>}
            />
            <Route
              path="admin/items"
              element={<ProtectedRoute menuPath="/admin/items" requiredRole={['admin', 'hr']}><EvaluationItems /></ProtectedRoute>}
            />
            <Route
              path="admin/items-executive"
              element={<ProtectedRoute menuPath="/admin/items-executive" requiredRole={['admin', 'hr']}><ExecutiveEvaluationItems /></ProtectedRoute>}
            />
            <Route
              path="admin/assignments"
              element={<ProtectedRoute menuPath="/admin/assignments" requiredRole={['admin', 'hr']}><EvaluationAssignments /></ProtectedRoute>}
            />
            <Route
              path="admin/assignments-executive"
              element={<ProtectedRoute menuPath="/admin/assignments-executive" requiredRole={['admin', 'hr']}><ExecutiveAssignments /></ProtectedRoute>}
            />
            <Route
              path="admin/results"
              element={<ProtectedRoute menuPath="/admin/results" requiredRole={['admin', 'hr']} allowGroupLeader={true} allowPresident={true}><FinalResults /></ProtectedRoute>}
            />
            <Route
              path="admin/results-executive"
              element={<ProtectedRoute menuPath="/admin/results-executive" requiredRole={['admin', 'hr']} allowPresident={true}><ExecutiveFinalResults /></ProtectedRoute>}
            />
            <Route
              path="admin/menu-permissions"
              element={<ProtectedRoute menuPath="/admin/menu-permissions" requiredRole={['admin']}><MenuPermissions /></ProtectedRoute>}
            />
          </Route>
        </Routes>
      </Router>
      </MenuPermissionsProvider>
    </AuthProvider>
  );
}
