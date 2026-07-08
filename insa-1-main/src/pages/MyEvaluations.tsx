import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, query, where, documentId } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useNavigate } from 'react-router-dom';

export default function MyEvaluations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [userPositions, setUserPositions] = useState<Record<string, string>>({});
  const [userDepartments, setUserDepartments] = useState<Record<string, string>>({});
  const [groupsMap, setGroupsMap] = useState<Record<string, string>>({});
  const [activeYear, setActiveYear] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    
    try {
      // First figure out the active year from global settings
      const settingDoc = await getDoc(doc(db, 'settings', 'global'));
      let yearToQuery = '';
      if (settingDoc.exists()) {
        yearToQuery = settingDoc.data().activeYear || '';
        setActiveYear(yearToQuery);
      }
      
      if (!yearToQuery) {
        setLoading(false);
        return;
      }

      // Fetch assignments for this user
      // Querying only by evaluatorId avoids the need for a composite Firestore index
      const q = query(
        collection(db, 'assignments'), 
        where('evaluatorId', '==', user?.email)
      );
      const snap = await getDocs(q);
      
      // Filter by active year in memory
      const allAssignments = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const filtered = allAssignments.filter(a => a.year === yearToQuery);
      setAssignments(filtered);

      // Fetch only the users referenced in assignments (individual reads, not list query)
      const umap: Record<string, string> = {};
      const pmap: Record<string, string> = {};
      const dmap: Record<string, string> = {};
      const uniqueIds = [...new Set(filtered.map(a => a.evaluateeId))];
      await Promise.all(uniqueIds.map(async (id: string) => {
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          const data = userDoc.data();
          umap[data.email] = data.name;
          pmap[data.email] = data.position || '';
          dmap[data.email] = data.department || '';
        }
      }));
      setUsersMap(umap);
      setUserPositions(pmap);
      setUserDepartments(dmap);

      const groupsSnap = await getDocs(collection(db, 'groups'));
      const gmap: Record<string, string> = {};
      groupsSnap.docs.forEach(d => { gmap[d.id] = d.data().name; });
      setGroupsMap(gmap);

    } catch (err: any) {
      logger.error("Fetch Error:", err);
      alert("데이터를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>평가 목록을 불러오는 중입니다...</div>;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[var(--hrs-line)] pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">내 평가 대기열</h2>
          <p className="mt-2 text-[var(--hrs-slate)] uppercase tracking-[0.2em] text-[15px]">본인에게 배정된 인사평가를 진행합니다.</p>
        </div>
      </header>

      <section className="grid grid-cols-4 gap-8 mb-10">
        <div className="border-b border-[var(--hrs-line-soft)] pb-4">
          <p className="text-[15px] uppercase tracking-[0.2em] text-[var(--hrs-slate)] mb-1">현재 진행 연도</p>
          <p className="text-2xl font-light tracking-tight">{activeYear || '설정 안됨'}</p>
        </div>
        <div className="border-b border-[var(--hrs-line-soft)] pb-4">
          <p className="text-[15px] uppercase tracking-[0.2em] text-[var(--hrs-slate)] mb-1">총 할당 대상 그룹</p>
          <p className="text-2xl font-light tracking-tight">{assignments.length}명</p>
        </div>
        <div className="border-b border-[var(--hrs-line-soft)] pb-4">
          <p className="text-[15px] uppercase tracking-[0.2em] text-[var(--hrs-slate)] mb-1">평가 대기 중</p>
          <p className="text-2xl font-light tracking-tight">{assignments.filter(a => a.status !== 'completed').length}건</p>
        </div>
      </section>

      {activeYear && (
        <div className="flex-1 border border-[var(--hrs-line)] overflow-hidden flex flex-col">
          <div className="grid grid-cols-12 bg-[var(--hrs-accent)] text-white text-[15px] uppercase tracking-[0.15em] p-4 sticky top-0">
            <div className="col-span-2">이름</div>
            <div className="col-span-2">직급</div>
            <div className="col-span-2">소속부서</div>
            <div className="col-span-2">대상자 그룹</div>
            <div className="col-span-2">진행 상태</div>
            <div className="col-span-2 text-right">작업</div>
          </div>
          
          <div className="flex-1 overflow-y-auto  text-sm">
            {assignments.length === 0 ? (
              <div className="p-8 text-center text-[var(--hrs-slate)] font-sans">현재 배정된 평가 대상자가 없습니다.</div>
            ) : (
              assignments.map(a => (
                <div key={a.id} className="grid grid-cols-12 p-4 border-b border-[var(--hrs-line-soft)] items-center hover:bg-[var(--hrs-bg)] transition-colors">
                  <div className="col-span-2 font-bold">
                    {usersMap[a.evaluateeId] || a.evaluateeId}
                  </div>
                  <div className="col-span-2 font-sans text-xs uppercase text-[var(--hrs-slate)]">{userPositions[a.evaluateeId] || '-'}</div>
                  <div className="col-span-2 font-sans text-xs uppercase text-[var(--hrs-slate)]">{userDepartments[a.evaluateeId] || '-'}</div>
                  <div className="col-span-2 font-sans text-xs uppercase text-[var(--hrs-slate)]">{groupsMap[a.groupId] || a.groupId}</div>
                  <div className="col-span-2">
                    {a.status === 'completed' ? (
                      <span className="text-[9px] uppercase tracking-widest px-2 py-1 bg-[#E8F5E9] text-emerald-800 border border-emerald-100">평가 완료</span>
                    ) : (
                      <span className="text-[9px] uppercase tracking-widest px-2 py-1 bg-amber-50 text-amber-800 border border-amber-100">대기 중</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    {a.status === 'completed' ? (
                      <button 
                        className="text-[10px] uppercase tracking-widest text-[var(--hrs-slate)] hover:text-[var(--hrs-ink)] underline underline-offset-4"
                        onClick={() => navigate(`/evaluate/${a.id}`)}
                      >
                        상세 내역 보기
                      </button>
                    ) : (
                      <button 
                        className="px-5 py-2 bg-[var(--hrs-accent)] text-white text-[10px] font-sans uppercase tracking-widest hover:bg-[var(--hrs-ink)] transition-colors"
                        onClick={() => navigate(`/evaluate/${a.id}`)}
                      >
                        평가하기
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
