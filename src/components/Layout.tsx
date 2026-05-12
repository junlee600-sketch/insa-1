import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { LayoutDashboard, ListTodo, History, Users, Settings, ClipboardList, PenBox, CheckSquare } from 'lucide-react';

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isGroupLeader = user?.position?.endsWith('그룹장');

  const navItems = [
    { to: "/", label: "대시보드", roles: ['admin', 'hr', 'user'], category: "기본" },
    { to: "/evaluate", label: "내 평가 진행", roles: ['admin', 'hr', 'user'], category: "기본" },
    { to: "/history", label: "내 평가 이력", roles: ['admin', 'hr'], category: "기본" },
    { to: "/admin/items", label: "평가 항목 관리", roles: ['admin', 'hr'], category: "관리 기능" },
    { to: "/admin/assignments", label: "평가자 배정", roles: ['admin', 'hr'], category: "관리 기능" },
    { to: "/admin/results", label: "최종 평가 결과", roles: ['admin', 'hr', isGroupLeader ? 'user' : ''], category: "관리 기능" },
    { to: "/admin/users", label: "사용자 관리", roles: ['admin'], category: "시스템 설정" },
    { to: "/admin/settings", label: "평가 연도 및 그룹", roles: ['admin'], category: "시스템 설정" },
  ];

  const groupedNav = navItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    if (item.roles.includes(user?.role || '')) {
      acc[item.category].push(item);
    }
    return acc;
  }, {} as Record<string, typeof navItems>);

  return (
    <div className="min-h-screen bg-[#FDFDFB] text-[#1A1A1A]  flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#E5E5E5] flex flex-col p-6 shrink-0 bg-[#FDFDFB]">
        <div className="mb-10">
          <h1 className="text-3xl tracking-tight leading-none text-[#000]">
            한국종합 HRS<br/>
            <span className="text-xs uppercase tracking-[0.2em] opacity-40">HR System v4.0</span>
          </h1>
        </div>
        
        <nav className="flex-1 space-y-8 overflow-y-auto pr-2">
          {Object.entries(groupedNav).map(([category, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={category} className="space-y-4">
                <p className="text-[10px] uppercase tracking-widest text-[#999]">{category}</p>
                <ul className="space-y-3 text-sm">
                  {items.map((item) => {
                    const isActive = location.pathname === item.to;
                    return (
                      <li 
                        key={item.to}
                        className={`${isActive ? 'font-medium border-l-2 border-[#1A1A1A] pl-3 text-[#1A1A1A]' : 'text-[#777] hover:text-[#1A1A1A] pl-[14px]'}`}
                      >
                        <Link to={item.to} className="block w-full">{item.label}</Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="pt-6 border-t border-[#EEE] mt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white text-[10px] uppercase">
              {user?.name?.substring(0, 2) || 'AD'}
            </div>
            <div>
              <p className="text-xs font-bold">{user?.name}</p>
              <p className="text-[10px] text-[#999] capitalize">{user?.role} - {user?.department}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/profile" className="text-[10px] uppercase tracking-widest text-[#777] hover:text-[#1A1A1A] underline underline-offset-4">비밀번호 변경</Link>
            <button onClick={logout} className="text-[10px] uppercase tracking-widest text-[#777] hover:text-[#1A1A1A] underline underline-offset-4">로그아웃</button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
