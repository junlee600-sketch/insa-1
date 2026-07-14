import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MenuPermissionsProvider, useMenuPermissions } from './contexts/MenuPermissionsContext';
import { Layout } from './components/Layout';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ForcePasswordChange from './pages/ForcePasswordChange';
import UserManagement from './pages/admin/UserManagement';
import EvaluationSettings from './pages/admin/EvaluationSettings';
import EvaluationItems from './pages/admin/EvaluationItems';
import EvaluationAssignments from './pages/admin/EvaluationAssignments';
import FinalResults from './pages/admin/FinalResults';
import PeriodicScores from './pages/admin/PeriodicScores';
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

function ProtectedRoute({ children, requiredRole, menuPath }: {
  children: React.ReactNode;
  requiredRole?: string[];
  menuPath?: string;
}) {
  const { user, loading } = useAuth();
  const { perms: menuPerms, loaded: menuPermsLoaded } = useMenuPermissions();

  if (loading) return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // 최초 로그인 사용자는 비밀번호를 변경할 때까지 다른 페이지 접근 차단
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;

  // 권한은 오직 ① 개별 메뉴 권한 → ② 메뉴 권한 관리(역할 규칙) → ③ 하드코딩 역할 fallback 순으로만 판단
  // (직급 기반 자동 권한 부여는 사용하지 않음)

  // 1순위: 사용자별 개별 권한 (UserManagement에서 설정)
  if (menuPath && user.menuPermissions && menuPath in user.menuPermissions) {
    return user.menuPermissions[menuPath] ? <>{children}</> : <Navigate to="/" replace />;
  }

  // 역할별 권한 체크 전 Firestore settings/menuPermissions 로드 대기
  if (menuPath && !menuPermsLoaded) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  // 2순위: Firestore 기반 역할별 메뉴 권한 (메뉴 권한 관리에서 설정)
  if (menuPath && menuPerms[menuPath]) {
    const p = menuPerms[menuPath];
    const role = user.role as 'admin' | 'hr' | 'user';
    return p[role] ? <>{children}</> : <Navigate to="/" replace />;
  }

  // 3순위: 하드코딩 역할 체크 (fallback)
  if (requiredRole && !requiredRole.includes(user.role)) {
    return <Navigate to="/" replace />;
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
          <Route path="/change-password" element={<ForcePasswordChange />} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            
            {/* User Evaluator Views */}
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="evaluate" element={<MyEvaluations />} />
            <Route path="evaluate/:assignmentId" element={<EvaluationForm />} />
            <Route
              path="evaluate-executive"
              element={<ProtectedRoute menuPath="/evaluate-executive" requiredRole={['admin', 'hr']}><ExecutiveEvaluations /></ProtectedRoute>}
            />
            <Route
              path="evaluate-executive/:assignmentId"
              element={<ProtectedRoute menuPath="/evaluate-executive" requiredRole={['admin', 'hr']}><ExecutiveEvaluationForm /></ProtectedRoute>}
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
              element={<ProtectedRoute menuPath="/admin/results" requiredRole={['admin', 'hr']}><FinalResults /></ProtectedRoute>}
            />
            <Route
              path="admin/results-executive"
              element={<ProtectedRoute menuPath="/admin/results-executive" requiredRole={['admin', 'hr']}><ExecutiveFinalResults /></ProtectedRoute>}
            />
            <Route
              path="admin/scores"
              element={<ProtectedRoute menuPath="/admin/scores" requiredRole={['admin']}><PeriodicScores /></ProtectedRoute>}
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
