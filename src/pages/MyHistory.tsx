import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

export default function MyHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Fetch final scores where evaluateeId == current user
      const q = query(
        collection(db, 'finalScores'),
        where('evaluateeId', '==', user?.email)
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // Sort descending by year
      records.sort((a, b) => b.year.localeCompare(a.year));
      setHistory(records);
    } catch (err: any) {
      console.error(err);
      alert("데이터를 불러오는 중 오류가 발생했습니다: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>과거 평가 내역을 불러오는 중입니다...</div>;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[#1A1A1A] pb-6">
        <div>
          <h2 className="text-5xl tracking-tighter">내 평가 이력</h2>
          <p className="mt-2 text-sm text-[#555] uppercase tracking-[0.2em] text-[10px]">과거 평가 연도의 최종 확정 점수 기록</p>
        </div>
      </header>

      <section className="grid grid-cols-4 gap-8 mb-10">
        <div className="border-b border-[#EEE] pb-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#999] mb-1">총 완료된 평가 연도</p>
          <p className="text-2xl font-light tracking-tight">{history.length}</p>
        </div>
      </section>

      <div className="flex-1 border border-[#1A1A1A] overflow-hidden flex flex-col">
        <div className="grid grid-cols-12 bg-[#1A1A1A] text-white text-[10px] uppercase tracking-[0.15em] p-4 sticky top-0">
          <div className="col-span-3">평가 연도</div>
          <div className="col-span-3 text-center">최종 상태</div>
          <div className="col-span-6 text-right">최종 확정 점수</div>
        </div>
        
        <div className="flex-1 overflow-y-auto  text-sm">
          {history.length === 0 ? (
            <div className="p-8 text-center text-[#777] font-sans">확정된 본인의 평가 이력이 없습니다.</div>
          ) : (
            history.map(record => (
              <div key={record.id} className="grid grid-cols-12 p-4 border-b border-[#EEE] items-center hover:bg-[#F9F9F9] transition-colors">
                <div className="col-span-3 font-bold">{record.year}</div>
                <div className="col-span-3 text-center">
                  <span className="text-[9px] uppercase tracking-widest px-2 py-1 bg-[#1A1A1A] text-white">{record.status}</span>
                </div>
                <div className="col-span-6 text-right text-xl font-bold">
                  {record.totalScore}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
