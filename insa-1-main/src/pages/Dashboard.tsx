import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  const profileRows = [
    { k: 'ID', v: user?.email?.includes('@') ? user.email.split('@')[0] : user?.email },
    { k: '부서', v: user?.department },
    { k: '직급', v: user?.position },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      <header>
        <p className="hrs-eyebrow mb-1.5">대시보드</p>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--hrs-ink)]">
          환영합니다, {user?.name} {user?.position}님
        </h2>
        <p className="mt-1.5 text-sm text-[var(--hrs-slate)]">한국종합건축사사무소 인사평가 시스템</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 사용자 프로필 */}
        <section className="hrs-card p-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--hrs-slate)] mb-5">사용자 프로필</h3>
          <div className="text-sm">
            {profileRows.map((r, i) => (
              <div key={r.k} className={`flex justify-between items-center py-3 ${i < profileRows.length - 1 ? 'border-b border-[var(--hrs-line-soft)]' : ''}`}>
                <span className="text-[var(--hrs-slate)]">{r.k}</span>
                <span className="font-semibold text-[var(--hrs-ink)]">{r.v}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 border-t border-[var(--hrs-line-soft)]">
              <span className="text-[var(--hrs-slate)]">권한</span>
              <span className="hrs-chip hrs-chip-info capitalize">{user?.role}</span>
            </div>
          </div>
        </section>

        {/* 빠른 안내 */}
        <section className="hrs-card p-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--hrs-slate)] mb-5">빠른 안내</h3>
          <ul className="space-y-4 text-sm text-[var(--hrs-ink)]">
            <li className="flex gap-3.5">
              <span className="flex-shrink-0 w-6 h-6 rounded-md bg-[var(--hrs-accent-soft)] text-[var(--hrs-accent)] grid place-items-center text-xs font-semibold hrs-mono">1</span>
              <p><span className="font-semibold">내 평가 진행</span> 메뉴로 이동하여 본인에게 할당된 평가를 제출해 주시기 바랍니다.</p>
            </li>
            <li className="flex gap-3.5">
              <span className="flex-shrink-0 w-6 h-6 rounded-md bg-[var(--hrs-accent-soft)] text-[var(--hrs-accent)] grid place-items-center text-xs font-semibold hrs-mono">2</span>
              <p><span className="font-semibold">임원평가 진행</span> 메뉴 권한이 부여된 평가자는 임원평가 메뉴로 이동하여 본인에게 할당된 평가를 제출해 주시기 바랍니다.</p>
            </li>
            {['admin', 'hr'].includes(user?.role || '') && (
              <li className="flex gap-3.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-md bg-[var(--hrs-accent-soft)] text-[var(--hrs-accent)] grid place-items-center text-xs font-semibold hrs-mono">3</span>
                <p><span className="font-semibold">내 평가 이력</span> 메뉴에서 역대 확정된 평가 결과(점수)를 조회할 수 있습니다.</p>
              </li>
            )}
            <li className="flex gap-3.5 pt-1">
              <span className="flex-shrink-0 w-6 h-6 rounded-md bg-[var(--hrs-mid-bg)] text-[var(--hrs-mid)] grid place-items-center text-xs font-semibold">!</span>
              <p className="text-[var(--hrs-slate)]">메뉴는 권한에 따라 부여된 메뉴가 다릅니다.</p>
            </li>
            {['admin', 'hr'].includes(user?.role || '') && (
              <li className="mt-2 p-4 rounded-lg bg-[var(--hrs-accent-soft)] border border-[var(--hrs-line)]">
                <span className="hrs-chip hrs-chip-info">HR 권한</span>
                <p className="mt-2.5 text-[var(--hrs-ink)] text-sm leading-relaxed">시스템 관리자로서 사이드 네비게이션을 통해 평가 연도/그룹 생성, 대상자 배정 및 최종 평가 확정을 진행할 수 있습니다.</p>
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
