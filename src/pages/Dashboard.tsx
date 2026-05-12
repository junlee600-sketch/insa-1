import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export default function Dashboard() {
  const { user } = useAuth();
  
  return (
    <div className="space-y-12">
      <header className="mb-12 border-b border-[#1A1A1A] pb-6">
        <h2 className="text-5xl tracking-tighter">환영합니다, {user?.name}님</h2>
        <p className="mt-2 text-sm text-[#555] uppercase tracking-widest text-[10px]">한국종합 HRS 시스템 개요</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#999] border-b border-[#EEE] pb-2">사용자 프로필</h3>
          <div className="bg-[#F9F9F9] p-6 border border-[#E5E5E5] space-y-4 text-sm">
            <div className="flex justify-between border-b border-dashed border-[#CCC] pb-2">
              <span className="text-[#777]  text-xs uppercase tracking-wider">이메일</span>
              <span>{user?.email}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-[#CCC] pb-2">
              <span className="text-[#777]  text-xs uppercase tracking-wider">부서</span>
              <span>{user?.department}</span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-[#777]  text-xs uppercase tracking-wider">권한</span>
              <span className="capitalize font-bold text-emerald-800">{user?.role}</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#999] border-b border-[#EEE] pb-2">빠른 안내</h3>
          <ul className="space-y-4 text-sm text-[#333] leading-relaxed">
            <li className="flex gap-4">
              <span className="text-xs bg-[#1A1A1A] text-white px-2 py-1  h-fit tracking-widest uppercase">01</span>
              <p><strong className="font-bold border-b border-[#1A1A1A]">내 평가 진행</strong> 메뉴로 이동하여 본인에게 할당된 평가를 제출해 주시기 바랍니다.</p>
            </li>
            {['admin', 'hr'].includes(user?.role || '') && (
              <li className="flex gap-4">
                <span className="text-xs bg-[#1A1A1A] text-white px-2 py-1  h-fit tracking-widest uppercase">02</span>
                <p><strong className="font-bold border-b border-[#1A1A1A]">내 평가 이력</strong> 메뉴에서 역대 확정된 평가 결과(점수)를 조회할 수 있습니다.</p>
              </li>
            )}
            {['admin', 'hr'].includes(user?.role || '') && (
              <li className="flex gap-4 p-4 bg-[#E8F5E9] border border-[#C8E6C9] mt-4">
                <span className="text-xs bg-emerald-800 text-white px-2 py-1  h-fit tracking-widest uppercase mt-0.5">HR</span>
                <p className="text-emerald-900 text-sm">시스템 관리자로서 사이드 네비게이션을 통해 평가 연도/그룹 생성, 대상자 배정 및 최종 평가 확정을 진행할 수 있습니다.</p>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
