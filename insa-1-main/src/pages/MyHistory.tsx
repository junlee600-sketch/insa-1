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
      await deleteDoc(doc(db, 'finalScores', recordToDelete));
      setHistory(history.filter(h => h.id !== recordToDelete));
      setDeleteModalOpen(false);
      setRecordToDelete(null);
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
          <p className="mt-2 text-[var(--hrs-slate)] tracking-normal text-[15px]">과거 평가 연도의 최종 확정 점수 기록</p>
        </div>
      </header>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 border border-red-200">
          {errorMsg}
        </div>
      )}

      <section className="grid grid-cols-4 gap-8 mb-10">
        <div className="border-b border-[var(--hrs-line-soft)] pb-4">
          <p className="text-[15px] tracking-normal text-[var(--hrs-slate)] mb-1">총 완료된 평가 연도</p>
          <p className="text-2xl font-light tracking-tight">{history.length}</p>
        </div>
      </section>

      <div className="flex-1 border border-[var(--hrs-line)] rounded-lg bg-[var(--hrs-surface)] shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden flex flex-col">
        <div className="grid grid-cols-12 bg-[var(--hrs-bg)] text-[var(--hrs-slate)] border-b border-[var(--hrs-line)] font-semibold text-[12px] uppercase tracking-[0.04em] p-4 sticky top-0">
          <div className="col-span-3">평가 연도</div>
          <div className="col-span-3 text-center">최종 상태</div>
          <div className="col-span-4 text-right">최종 확정 점수</div>
          <div className="col-span-2 text-right">관리</div>
        </div>
        
        <div className="flex-1 overflow-y-auto  text-sm">
          {history.length === 0 ? (
            <div className="p-8 text-center text-[var(--hrs-slate)] font-sans">확정된 본인의 평가 이력이 없습니다.</div>
          ) : (
            history.map(record => (
              <div key={record.id} className="grid grid-cols-12 p-4 border-b border-[var(--hrs-line-soft)] items-center hover:bg-[var(--hrs-bg)] transition-colors">
                <div className="col-span-3 font-bold">{record.year}</div>
                <div className="col-span-3 text-center">
                  <span className="text-[12px] tracking-normal px-2 py-1 bg-[var(--hrs-accent)] text-white">{record.status}</span>
                </div>
                <div className="col-span-4 text-right text-xl font-bold">
                  {record.totalScore}
                </div>
                <div className="col-span-2 text-right">
                  {canDelete && (
                    <button
                      onClick={(e) => openDeleteModal(record.id, e)}
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
            <DialogTitle className="text-2xl font-normal tracking-tight">이력 삭제</DialogTitle>
            <DialogDescription className="text-[var(--hrs-slate)] mt-4">
              정말 이 평가 이력을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다. (관리자 권한 필요)
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
