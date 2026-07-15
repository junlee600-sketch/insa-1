import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMenuPermissions } from '../contexts/MenuPermissionsContext';

// 권한은 개별 메뉴 권한(userAccess) → 역할별 메뉴 권한(settings/menuPermissions)으로만 판단.
// 직급(position) 기반 자동 부여는 사용하지 않으므로 specialRoles 필드도 두지 않는다.
const ALL_NAV = [
  { to: "/", label: "대시보드", category: "기본" },
  { to: "/evaluate", label: "내 평가 진행", category: "기본" },
  { to: "/evaluate-executive", label: "임원평가 진행", category: "기본" },
  { to: "/history", label: "내 평가 이력", category: "기본" },
  { to: "/admin/items", label: "평가 항목 관리", category: "관리 기능" },
  { to: "/admin/items-executive", label: "임원평가 항목 관리", category: "관리 기능" },
  { to: "/admin/assignments", label: "평가자 배정", category: "관리 기능" },
  { to: "/admin/assignments-executive", label: "임원평가 배정", category: "관리 기능" },
  { to: "/admin/results", label: "최종 평가 결과", category: "관리 기능" },
  { to: "/admin/results-executive", label: "임원평가 최종 결과", category: "관리 기능" },
  { to: "/admin/scores", label: "근태·업무일지 점수 관리", category: "관리 기능" },
  { to: "/admin/users", label: "사용자 관리", category: "시스템 설정" },
  { to: "/admin/settings", label: "평가 연도/그룹", category: "시스템 설정" },
  { to: "/admin/menu-permissions", label: "메뉴 권한 관리", category: "시스템 설정" },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { perms } = useMenuPermissions();

  // 2차 방어: 어떤 경로로 진입했든 비밀번호 강제 변경이 남아 있으면 본 화면을 렌더링하지 않는다.
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;

  const role = user?.role || '';

  // 권한은 개별 메뉴 권한 → 역할별 메뉴 권한(메뉴 권한 관리)만으로 판단. 직급 기반 자동 부여 없음.
  const canAccess = (item: typeof ALL_NAV[0]) => {
    if (user?.menuPermissions && item.to in user.menuPermissions) {
      return user.menuPermissions[item.to];
    }
    const p = perms[item.to];
    if (!p) return false;
    return !!p[role as 'admin' | 'hr' | 'user'];
  };

  const groupedNav = ALL_NAV.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [] as typeof ALL_NAV;
    if (canAccess(item)) acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof ALL_NAV>);

  return (
    <div className="min-h-screen bg-[var(--hrs-bg)] text-[var(--hrs-ink)] flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-[var(--hrs-surface)] border-r border-[var(--hrs-line)] flex flex-col pt-6 pb-6 px-3.5 shrink-0">
        <div className="mb-8 px-2 flex items-center">
          <Link to="/" className="hover:opacity-75 transition-opacity leading-tight">
            <span className="block text-[13px] font-semibold tracking-tight text-[var(--hrs-ink)]">한국종합건축사사무소</span>
            <span className="block text-[10.5px] text-[var(--hrs-slate)]">인사평가 시스템</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto pr-1">
          {Object.entries(groupedNav).map(([category, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={category} className="space-y-1">
                <p className="px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--hrs-slate)]">{category}</p>
                <ul className="space-y-0.5 text-sm">
                  {items.map((item) => {
                    // 세그먼트 경계까지 일치해야 활성 (자식 라우트는 유지, 접두어가 겹치는 형제 라우트 오탐 방지:
                    //  예) /evaluate 가 /evaluate-executive 를 활성화하던 문제)
                    const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to + '/'));
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          className={`block px-2.5 py-2 rounded-md font-medium transition-colors duration-150
                            ${isActive
                              ? 'bg-[var(--hrs-accent)] text-white'
                              : 'text-[var(--hrs-slate)] hover:text-[var(--hrs-ink)] hover:bg-[var(--hrs-line-soft)]'
                            }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="pt-5 border-t border-[var(--hrs-line)] mt-4 px-1.5">
          <div className="flex items-center gap-3 mb-3.5">
            <div className="w-9 h-9 bg-[var(--hrs-accent-soft)] text-[var(--hrs-accent)] rounded-full flex items-center justify-center text-xs font-semibold">
              {user?.name?.substring(0, 2) || 'AD'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--hrs-ink)] truncate">{user?.name} {user?.position}</p>
              <p className="text-xs text-[var(--hrs-slate)] truncate capitalize">{user?.role} · {user?.department}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <Link to="/profile" className="text-xs font-medium text-[var(--hrs-slate)] hover:text-[var(--hrs-accent)] transition-colors">
              프로필 관리
            </Link>
            <button onClick={logout} className="text-xs font-medium text-[var(--hrs-slate)] hover:text-[var(--hrs-accent)] transition-colors">
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto px-6 py-6 lg:px-10 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
