import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { LayoutDashboard, ListTodo, History, Users, Settings, ClipboardList, PenBox, CheckSquare } from 'lucide-react';

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isGroupLeader = user?.position?.endsWith('그룹장');
  const isExecutive = ['본부장', '그룹장', '사장'].includes(user?.position || '');

  const navItems = [
    { to: "/", label: "대시보드", roles: ['admin', 'hr', 'user'], category: "기본" },
    { to: "/evaluate", label: "내 평가 진행", roles: ['admin', 'hr', 'user'], category: "기본" },
    { to: "/evaluate-executive", label: "임원평가 진행", roles: ['admin', 'hr', isExecutive ? 'user' : ''], category: "기본" },
    { to: "/history", label: "내 평가 이력", roles: ['admin', 'hr'], category: "기본" },
    { to: "/admin/items", label: "평가 항목 관리", roles: ['admin', 'hr'], category: "관리 기능" },
    { to: "/admin/items-executive", label: "임원평가 항목 관리", roles: ['admin', 'hr'], category: "관리 기능" },
    { to: "/admin/assignments", label: "평가자 배정", roles: ['admin', 'hr'], category: "관리 기능" },
    { to: "/admin/assignments-executive", label: "임원평가 배정", roles: ['admin', 'hr'], category: "관리 기능" },
    { to: "/admin/results", label: "최종 평가 결과", roles: ['admin', 'hr', isGroupLeader || user?.position === '사장' ? 'user' : ''], category: "관리 기능" },
    { to: "/admin/results-executive", label: "임원평가 최종 결과", roles: ['admin', 'hr', user?.position === '사장' ? 'user' : ''], category: "관리 기능" },
    { to: "/admin/users", label: "사용자 관리", roles: ['admin'], category: "시스템 설정" },
    { to: "/admin/settings", label: "평가 연도/그룹", roles: ['admin'], category: "시스템 설정" },
  ];

  const groupedNav = navItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    if (item.roles.includes(user?.role || '')) {
      acc[item.category].push(item);
    }
    return acc;
  }, {} as Record<string, typeof navItems>);

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[oklch(0.15_0_0)] text-gray-900 dark:text-gray-100 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-[oklch(0.2_0_0)] border-r border-gray-200 dark:border-gray-800 flex flex-col pt-8 pb-6 px-4 shrink-0 transition-colors">
        <div className="mb-10 px-2">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            한국종합 HRS
          </h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-1">HR System v4.0</p>
        </div>
        
        <nav className="flex-1 space-y-8 overflow-y-auto pr-1">
          {Object.entries(groupedNav).map(([category, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={category} className="space-y-2">
                <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{category}</p>
                <ul className="space-y-0.5 text-sm">
                  {items.map((item) => {
                    const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
                    return (
                      <li key={item.to}>
                        <Link 
                          to={item.to} 
                          className={`block px-3 py-2 rounded-lg font-medium transition-colors duration-150
                            ${isActive 
                              ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100' 
                              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50'
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

        <div className="pt-6 border-t border-gray-100 dark:border-gray-800 mt-4 px-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase">
              {user?.name?.substring(0, 2) || 'AD'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name} {user?.position}</p>
              <p className="text-xs text-gray-500 truncate capitalize">{user?.role} · {user?.department}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <Link to="/profile" className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
              프로필 관리
            </Link>
            <button onClick={logout} className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
              로그아웃
            </button>
            {window.self !== window.top && (
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-0.5 ml-auto"
                title="새 창으로 접속하기"
              >
                새창접속 <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>
            )}
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
