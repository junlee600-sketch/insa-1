import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export default function Dashboard() {
  const { user } = useAuth();
  
  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8">
      <header className="mb-8">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">환영합니다, {user?.name}님</h2>
        <p className="mt-2 text-sm text-gray-500">한국종합건축사사무소 인사평가 시스템 개요</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-widest">사용자 프로필</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">이메일</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">부서</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{user?.department}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500">권한</span>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                  {user?.role}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-widest">빠른 안내</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-5 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex gap-4">
                <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400">1</div>
                <p><span className="font-semibold text-gray-900 dark:text-gray-100">내 평가 진행</span> 메뉴로 이동하여 본인에게 할당된 평가를 제출해 주시기 바랍니다.</p>
              </li>
              {['admin', 'hr'].includes(user?.role || '') && (
                <li className="flex gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400">2</div>
                  <p><span className="font-semibold text-gray-900 dark:text-gray-100">내 평가 이력</span> 메뉴에서 역대 확정된 평가 결과(점수)를 조회할 수 있습니다.</p>
                </li>
              )}
              {['admin', 'hr'].includes(user?.role || '') && (
                <li className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl mt-6 border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 uppercase">HR 권한</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">시스템 관리자로서 사이드 네비게이션을 통해 평가 연도/그룹 생성, 대상자 배정 및 최종 평가 확정을 진행할 수 있습니다.</p>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
