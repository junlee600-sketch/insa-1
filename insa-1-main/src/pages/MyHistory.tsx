import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Button } from '../components/ui/button';

export default function MyHistory() {
  const { user } = useAuth();
  const canDelete = user?.role === 'admin' || user?.role === 'hr';
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      if (!user?.email) { setHistory([]); return; }

      // 근태·업무일지 점수(periodicScores)는 최종 확정과 무관하게 '입력되는 즉시' 바로 표시한다.
      // finalScores(최종 확정)는 '확정 상태' 표시 + 삭제 대상 파악용으로만 병합한다.
      const [psSnap, fsSnap] = await Promise.all([
        getDocs(query(collection(db, 'periodicScores'), where('userId', '==', user.email))),
        getDocs(query(collection(db, 'finalScores'), where('evaluateeId', '==', user.email))),
      ]);

      // 연도별로 병합
      const byYear = new Map<string, any>();

      // 1) 근태·업무일지 점수 (원본)
      psSnap.docs.forEach(d => {
        const data = d.data() as any;
        const year = String(data.year);
        byYear.set(year, {
          year,
          attendanceScore: data.attendanceScore ?? null,
          workLogScore: data.workLogScore ?? null,
          status: null,
          finalScoreId: null,
        });
      });

      // 2) 최종 확정 상태 병합 (점수 입력이 아직 없던 연도도 목록에 포함)
      fsSnap.docs.forEach(d => {
        const data = d.data() as any;
        const year = String(data.year);
        const row = byYear.get(year) || { year, attendanceScore: null, workLogScore: null };
        row.status = data.status || 'confirmed';
        row.finalScoreId = d.id;
        byYear.set(year, row);
      });

      // 연도 내림차순 정렬
      const records = Array.from(byYear.values()).sort((a, b) => b.year.localeCompare(a.year));

      setHistory(records);
    } catch (err: any) {
      logger.error(err);
      setErrorMsg("데이터를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecordToDelete(id);
    setDeleteModalOpen(true);
    setErrorMsg(null);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      // finalScores(최종 확정)만 삭제한다. 근태·업무일지 점수(periodicScores)는 그대로 남아
      // 해당 연도 행은 '미확정' 상태로 계속 표시되므로 목록을 다시 불러온다.
      await deleteDoc(doc(db, 'finalScores', recordToDelete));
      setDeleteModalOpen(false);
      setRecordToDelete(null);
      await fetchHistory();
    } catch (err: any) {
      logger.error(err);
      setErrorMsg("삭제 권한이 없거나 오류가 발생했습니다 (관리자 권한 필요).");
    }
  };

  if (loading) return <div>과거 평가 내역을 불러오는 중입니다...</div>;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[var(--hrs-line)] pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">내 평가 이력</h2>
          <p className="mt-2 text-[var(--hrs-slate)] tracking-normal text-[15px]">과거 평가 연도의 근태·업무일지 점수 기록</p>
        </div>
      </header>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 border border-red-200">
          {errorMsg}
        </div>
      )}

      <section className="grid grid-cols-4 gap-8 mb-10">
        <div className="border-b border-[var(--hrs-line-soft)] pb-4">
          <p className="text-[15px] tracking-normal text-[var(--hrs-slate)] mb-1">기록된 평가 연도</p>
          <p className="text-2xl font-light tracking-tight">{history.length}</p>
        </div>
      </section>

      <div className="flex-1 border border-[var(--hrs-line)] rounded-lg bg-[var(--hrs-surface)] shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden flex flex-col">
        <div className="grid grid-cols-12 bg-[var(--hrs-bg)] text-[var(--hrs-slate)] border-b border-[var(--hrs-line)] font-semibold text-[12px] uppercase tracking-[0.04em] p-4 sticky top-0">
          <div className="col-span-3">평가 연도</div>
          <div className="col-span-2 text-center">최종 상태</div>
          <div className="col-span-3 text-center">근태점수</div>
          <div className="col-span-3 text-center">업무일지 점수</div>
          <div className="col-span-1 text-right">관리</div>
        </div>

        <div className="flex-1 overflow-y-auto  text-sm">
          {history.length === 0 ? (
            <div className="p-8 text-center text-[var(--hrs-slate)] font-sans">근태·업무일지 점수 기록이 없습니다.</div>
          ) : (
            history.map(record => (
              <div key={record.year} className="grid grid-cols-12 p-4 border-b border-[var(--hrs-line-soft)] items-center hover:bg-[var(--hrs-bg)] transition-colors">
                <div className="col-span-3 font-bold">{record.year}</div>
                <div className="col-span-2 text-center">
                  {record.status ? (
                    <span className="hrs-chip hrs-chip-good">확정</span>
                  ) : (
                    <span className="hrs-chip hrs-chip-wait">미확정</span>
                  )}
                </div>
                <div className="col-span-3 text-center hrs-mono text-lg font-bold text-[var(--hrs-ink)]">
                  {record.attendanceScore != null ? record.attendanceScore : <span className="text-[var(--hrs-slate)] text-sm font-normal">미입력</span>}
                </div>
                <div className="col-span-3 text-center hrs-mono text-lg font-bold text-[var(--hrs-ink)]">
                  {record.workLogScore != null ? record.workLogScore : <span className="text-[var(--hrs-slate)] text-sm font-normal">미입력</span>}
                </div>
                <div className="col-span-1 text-right">
                  {canDelete && record.finalScoreId && (
                    <button
                      onClick={(e) => openDeleteModal(record.finalScoreId, e)}
                      className="text-[12px] tracking-normal text-[var(--hrs-slate)] hover:text-red-600 underline underline-offset-4"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-md border-[var(--hrs-line)]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-normal tracking-tight">최종 확정 삭제</DialogTitle>
            <DialogDescription className="text-[var(--hrs-slate)] mt-4">
              이 연도의 최종 확정 기록을 삭제합니다. 근태·업무일지 점수는 그대로 유지되며 '미확정' 상태로 표시됩니다. 삭제 후에는 복구할 수 없습니다. (관리자 권한 필요)
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-8 flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              className="rounded-md border-[var(--hrs-line)] text-[var(--hrs-slate)] hover:bg-[var(--hrs-line-soft)] hover:text-[var(--hrs-ink)]"
              onClick={() => setDeleteModalOpen(false)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              className="rounded-md bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDelete}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
