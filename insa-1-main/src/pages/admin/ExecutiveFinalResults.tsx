import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, query, where, documentId, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../contexts/AuthContext';
import { downloadExcelFile } from '../../lib/excel';
import { logger } from '../../lib/logger';

export default function ExecutiveFinalResults() {
  const { user } = useAuth();
  
  if (user?.position !== '사장' && user?.role !== 'admin') {
    return <div className="p-8 text-center text-red-500 font-bold">임원평가 확정 및 조회는 사장 직급 또는 관리자(Admin)만 가능합니다.</div>;
  }
  
  const [years, setYears] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  
  const [evaluatees, setEvaluatees] = useState<any[]>([]); // Grouped exec_results
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [userPositions, setUserPositions] = useState<Record<string, string>>({});
  const [groupsMap, setGroupsMap] = useState<Record<string, string>>({});
  const [itemsMap, setItemsMap] = useState<Record<string, string>>({});
  
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [userDepartments, setUserDepartments] = useState<Record<string, string>>({});
  const [userYears, setUserYears] = useState<Record<string, number | null>>({});
  const [userPeriodic, setUserPeriodic] = useState<Record<string, { attendanceScore: number | null; workLogScore: number | null }>>({});
  const [weights, setWeights] = useState<{ eval: number; attendance: number; workLog: number }>({ eval: 70, attendance: 15, workLog: 15 });

  const [selectedEvaluatee, setSelectedEvaluatee] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [finalScoreInput, setFinalScoreInput] = useState('');

  // 가중평균 최종점수 계산: 원점수평균×평가% + 근태×근태% + 업무일지×업무일지% (미입력=0)
  const rawAvgOf = (ev: any) => ev.totalCompleted > 0 ? ev.rawScoreSum / ev.totalCompleted : 0;
  const weightedScoreOf = (ev: any) => {
    const p = userPeriodic[ev.evaluateeId] || {};
    const att = p.attendanceScore ?? 0;
    const log = p.workLogScore ?? 0;
    const total = (rawAvgOf(ev) * weights.eval + att * weights.attendance + log * weights.workLog) / 100;
    return Math.round(total * 10) / 10;
  };

  const isGroupLeader = user && user.role === 'user' && user.position?.endsWith('그룹장');
  // 사장은 임원평가 최종 결과를 수정할 수 있으므로 읽기 전용이 아님
  const isPresidentReadOnly = false;

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    if (selectedYear) fetchResults();
  }, [selectedYear]);

  // Force department if group leader
  useEffect(() => {
    if (isGroupLeader) {
      const dep = user.department || user.position!.replace('장', '');
      setSelectedDepartment(dep);
    }
  }, [isGroupLeader, user]);

  const fetchBaseData = async () => {
    try {
      const [yearsSnap, groupsSnap, itemsSnap] = await Promise.all([
        getDocs(collection(db, 'years')),
        getDocs(collection(db, 'groups')),
        getDocs(collection(db, 'exec_items'))
      ]);
      setYears(yearsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const gmap: Record<string, string> = {};
      groupsSnap.docs.forEach(d => { gmap[d.id] = d.data().name; });
      setGroupsMap(gmap);

      const imap: Record<string, string> = {};
      itemsSnap.docs.forEach(d => { imap[d.id] = d.data().question; });
      setItemsMap(imap);
    } catch (e) {
      logger.error("fetchBaseData error", e);
    }
  };

  const fetchResults = async () => {
    try {
      // 1. Fetch exec_assignments for this year
      const q1 = query(collection(db, 'exec_assignments'), where('year', '==', selectedYear));
      const exec_assignmentsSnap = await getDocs(q1);
      const exec_assignments = exec_assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Fetch finalized scores if any
      const q2 = query(collection(db, 'exec_finalScores'), where('year', '==', selectedYear));
      const finalSnap = await getDocs(q2);
      const exec_finalScoresMap : Record<string, any> = {};
      finalSnap.docs.forEach(d => { exec_finalScoresMap[d.data().evaluateeId] = d.data(); });

      // 3. Fetch exec_results only for this year's assignment IDs (batched, max 30 per query)
      const exec_assignmentIds = exec_assignments.map((a: any) => a.id);
      const exec_resultsMap: Record<string, any> = {};
      for (let i = 0; i < exec_assignmentIds.length; i += 30) {
        const batch = exec_assignmentIds.slice(i, i + 30);
        const rq = query(collection(db, 'exec_results'), where(documentId(), 'in', batch));
        const rSnap = await getDocs(rq);
        rSnap.docs.forEach(d => { exec_resultsMap[d.id] = d.data(); });
      }

      // 4. Fetch user info for all referenced users individually (avoids list permission requirement)
      const allUserIds = new Set<string>();
      exec_assignments.forEach((assn: any) => {
        allUserIds.add(assn.evaluateeId);
        allUserIds.add(assn.evaluatorId);
      });
      const umap: Record<string, string> = {};
      const dmap: Record<string, string> = {};
      const pmap: Record<string, string> = {};
      const ymap: Record<string, number | null> = {};
      const deptSet = new Set<string>();
      await Promise.all([...allUserIds].map(async (id: string) => {
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          const data = userDoc.data();
          umap[data.email] = data.name;
          dmap[data.email] = data.department || '';
          pmap[data.email] = data.position || '';
          ymap[data.email] = data.yearsOfService ?? null;
          if (data.department) deptSet.add(data.department);
        }
      }));
      setUsersMap(umap);
      setUserDepartments(dmap);
      setUserPositions(pmap);
      setUserYears(ymap);
      setDepartments(Array.from(deptSet).sort());

      // 연도 가중치 + 근태/업무일지 점수 조회
      const yearDoc = await getDoc(doc(db, 'years', selectedYear));
      const w = yearDoc.exists() ? yearDoc.data().weights : null;
      setWeights({ eval: w?.eval ?? 70, attendance: w?.attendance ?? 15, workLog: w?.workLog ?? 15 });

      const periodicMap: Record<string, { attendanceScore: number | null; workLogScore: number | null }> = {};
      const periodicIds = [...allUserIds].map(id => `${selectedYear}_${id}`);
      for (let i = 0; i < periodicIds.length; i += 30) {
        const batch = periodicIds.slice(i, i + 30);
        if (batch.length === 0) continue;
        const pq = query(collection(db, 'periodicScores'), where(documentId(), 'in', batch));
        const pSnap = await getDocs(pq);
        pSnap.docs.forEach(d => {
          const data = d.data();
          periodicMap[data.userId] = {
            attendanceScore: data.attendanceScore ?? null,
            workLogScore: data.workLogScore ?? null,
          };
        });
      }
      setUserPeriodic(periodicMap);

      // Group exec_assignments by evaluatee
      const grouped: Record<string, any> = {};

      exec_assignments.forEach((assn: any) => {
        if (!grouped[assn.evaluateeId]) {
          grouped[assn.evaluateeId] = {
            evaluateeId: assn.evaluateeId,
            totalAssigned: 0,
            totalCompleted: 0,
            rawScoreSum: 0,
            exec_assignments: [],
            finalState: exec_finalScoresMap[assn.evaluateeId] || null
          };
        }
        grouped[assn.evaluateeId].totalAssigned++;
        if (assn.status === 'completed') {
          grouped[assn.evaluateeId].totalCompleted++;
          grouped[assn.evaluateeId].rawScoreSum += (assn.totalScore || 0);
          // attach qualitative comment
          assn.comment = exec_resultsMap[assn.id]?.comment || '';
          assn.scores = exec_resultsMap[assn.id]?.scores || {};
        }
        grouped[assn.evaluateeId].exec_assignments.push(assn);
      });

      setEvaluatees(Object.values(grouped));
    } catch (e: any) {
      logger.error("fetchResults error", e);
      alert("데이터를 불러오지 못했습니다. 권한이 부족하거나 오류가 발생했습니다: " + e.message);
    }
  };

  const openConfirmation = (evaluatee: any) => {
    setSelectedEvaluatee(evaluatee);
    // 확정 전이면 가중평균(원점수+근태+업무일지) 값을 제안, 확정된 경우 저장값 사용
    const suggested = evaluatee.finalState ? evaluatee.finalState.totalScore : weightedScoreOf(evaluatee);
    setFinalScoreInput(suggested.toString());
    setModalOpen(true);
  };

  const confirmScore = async () => {
    if (!selectedEvaluatee || !selectedYear) return;

    const score = parseFloat(finalScoreInput);
    if (!isFinite(score) || score < 0 || score > 100) {
      alert('유효한 점수를 입력하세요 (0~100 범위).');
      return;
    }

    const finalId = `${selectedYear}_${selectedEvaluatee.evaluateeId}`;

    await setDoc(doc(db, 'exec_finalScores', finalId), {
      year: selectedYear,
      evaluateeId: selectedEvaluatee.evaluateeId,
      totalScore: score,
      status: 'confirmed',
      confirmedAt: serverTimestamp()
    });

    setModalOpen(false);
    fetchResults();
    alert('최종 점수가 확정되어 저장되었습니다.');
  };

  const downloadExcel = async () => {
    if (!selectedYear || filteredEvaluatees.length === 0) return alert('다운로드할 결과 데이터가 없습니다.');

    const yearData = years.find(y => y.id === selectedYear);
    
    // Find max number of evaluators to create dynamic columns
    const maxEvaluators = Math.max(...filteredEvaluatees.map(ev => ev.exec_assignments.length), 0);

    const exportData = filteredEvaluatees.map(ev => {
      const isComplete = ev.totalCompleted === ev.totalAssigned;
      const rawAvg = ev.totalCompleted > 0 ? (ev.rawScoreSum / ev.totalCompleted).toFixed(2) : '-';
      const periodic = userPeriodic[ev.evaluateeId] || {};

      const row: any = {
        '연도': yearData?.year || selectedYear,
        '피평가자(대상자) 이름': usersMap[ev.evaluateeId] || ev.evaluateeId,
        '직급': userPositions[ev.evaluateeId] || '-',
        '부서': userDepartments[ev.evaluateeId] || '-',
        '연차': userYears[ev.evaluateeId] != null ? `${userYears[ev.evaluateeId]}년` : '-',
        '할당 건수': ev.totalAssigned,
        '완료 건수': ev.totalCompleted,
        '진행률': isComplete ? '완료' : '진행중',
        '원점수 평균': rawAvg,
        '근태점수': periodic.attendanceScore != null ? periodic.attendanceScore : '미입력',
        '업무일지 점수': periodic.workLogScore != null ? periodic.workLogScore : '미입력',
        '가중치(평가/근태/업무일지)': `${weights.eval}%/${weights.attendance}%/${weights.workLog}%`,
        '가중평균 제안 점수': weightedScoreOf(ev),
        '최종 확정 점수': ev.finalState ? ev.finalState.totalScore : '미확정',
        '상태': ev.finalState ? '확정됨' : '대기 중',
      };

      // Add dynamic columns for each evaluator
      ev.exec_assignments.forEach((assn: any, idx: number) => {
        const i = idx + 1;
        const evorName = usersMap[assn.evaluatorId] || assn.evaluatorId;
        row[`평가자${i} 이름`] = evorName;
        row[`평가자${i} 직급`] = userPositions[assn.evaluatorId] || '-';
        row[`평가자${i} 대상 그룹`] = groupsMap[assn.groupId] || '-';
        row[`평가자${i} 상태`] = assn.status === 'completed' ? '완료' : '대기';
        row[`평가자${i} 점수`] = assn.status === 'completed' ? assn.totalScore : '-';
        row[`평가자${i} 정성 평가 의견`] = assn.comment || '';
      });

      return row;
    });

    await downloadExcelFile(exportData, "Final Results", `Final_Evaluation_Results_${yearData?.year || selectedYear}.xlsx`);
  };

  const filteredEvaluatees = evaluatees.filter(ev => {
    if (userPositions[ev.evaluateeId] !== '그룹장') return false;

    if (isGroupLeader) {
      const dep = user.department || user.position!.replace('장', '');
      return userDepartments[ev.evaluateeId] === dep;
    }
    if (selectedDepartment === 'all') return true;
    return userDepartments[ev.evaluateeId] === selectedDepartment;
  });

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[var(--hrs-line)] pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">임원평가 최종 결과</h2>
          <p className="mt-2 text-[var(--hrs-slate)] uppercase tracking-[0.2em] text-[15px]">평가 대상자별 종합 점수를 검토하고 최종 확정합니다.</p>
        </div>
        <div className="flex gap-3">
          {selectedYear && evaluatees.length > 0 && (
            <button 
              onClick={downloadExcel}
              className="px-5 py-2 border border-[var(--hrs-line)] text-[11px] uppercase tracking-widest hover:bg-[var(--hrs-accent)] hover:text-white transition-colors"
            >
              엑셀 다운로드
            </button>
          )}
          <div className="w-48">
            <Select value={selectedDepartment} onValueChange={(v) => setSelectedDepartment(v ?? '')} disabled={!!isGroupLeader}>
              <SelectTrigger className="border-[var(--hrs-line)] rounded-none bg-transparent">
                <SelectValue placeholder="소속 부서 선택" />
              </SelectTrigger>
              <SelectContent>
                {!isGroupLeader && <SelectItem value="all">전체 부서</SelectItem>}
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={selectedYear} onValueChange={(v) => setSelectedYear(v ?? '')}>
              <SelectTrigger className="border-[var(--hrs-line)] rounded-none bg-transparent">
                <SelectValue placeholder="조회할 평가 연도 선택" />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y.id} value={y.id}>{y.year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Quick Stats / Controls */}
      <section className="grid grid-cols-4 gap-8 mb-10">
        <div className="border-b border-[var(--hrs-line-soft)] pb-4">
          <p className="text-[15px] uppercase tracking-[0.2em] text-[var(--hrs-slate)] mb-1">진행 연도</p>
          <p className="text-2xl font-light tracking-tight">{selectedYear || '선택 안됨'}</p>
        </div>
        <div className="border-b border-[var(--hrs-line-soft)] pb-4">
          <p className="text-[15px] uppercase tracking-[0.2em] text-[var(--hrs-slate)] mb-1">평가 대상자 수 (필터됨)</p>
          <p className="text-2xl font-light tracking-tight">{filteredEvaluatees.length}명</p>
        </div>
        <div className="border-b border-[var(--hrs-line-soft)] pb-4">
          <p className="text-[15px] uppercase tracking-[0.2em] text-[var(--hrs-slate)] mb-1">전체 평가율 (필터됨)</p>
          <p className="text-2xl font-light tracking-tight">
             {filteredEvaluatees.length > 0 
               ? `${Math.round((filteredEvaluatees.reduce((sum, e) => sum + e.totalCompleted, 0) / filteredEvaluatees.reduce((sum, e) => sum + e.totalAssigned, 0)) * 100)}%` 
               : '0%'}
          </p>
        </div>
        <div className="border-b border-[var(--hrs-line-soft)] pb-4">
          <p className="text-[15px] uppercase tracking-[0.2em] text-[var(--hrs-slate)] mb-1">현재 상태</p>
          <p className="text-2xl font-light tracking-tight text-emerald-700 underline underline-offset-4">평가 진행/검토 중</p>
        </div>
      </section>

      {selectedYear && (
        <div className="flex-1 border border-[var(--hrs-line)] overflow-hidden flex flex-col">
          <div className="grid grid-cols-12 bg-[var(--hrs-bg)] text-[var(--hrs-slate)] border-b border-[var(--hrs-line)] font-semibold text-[11px] uppercase tracking-[0.04em] p-4 sticky top-0">
            <div className="col-span-2">이름</div>
            <div className="col-span-1">직급</div>
            <div className="col-span-1">소속부서</div>
            <div className="col-span-1 text-center">연차</div>
            <div className="col-span-1 text-center">진행률</div>
            <div className="col-span-1 text-center">원점수</div>
            <div className="col-span-1 text-center">근태</div>
            <div className="col-span-1 text-center">업무일지</div>
            <div className="col-span-1 text-center">최종</div>
            <div className="col-span-1 text-center">상태</div>
            <div className="col-span-1 text-right">상세</div>
          </div>

          <div className="flex-1 overflow-y-auto  text-sm">
            {filteredEvaluatees.length === 0 ? (
               <div className="p-8 text-center text-[var(--hrs-slate)] font-sans">진행된 평가 내역이 없습니다.</div>
            ) : (
              filteredEvaluatees.map(ev => {
                const isComplete = ev.totalCompleted === ev.totalAssigned;
                const rawAvg = ev.totalCompleted > 0 ? (ev.rawScoreSum / ev.totalCompleted).toFixed(2) : '-';
                const periodic = userPeriodic[ev.evaluateeId] || {};

                return (
                  <div key={ev.evaluateeId} className="grid grid-cols-12 p-4 border-b border-[var(--hrs-line-soft)] items-center hover:bg-[var(--hrs-bg)] cursor-default group">
                    <div className="col-span-2 font-bold truncate pr-2">
                      {usersMap[ev.evaluateeId] || ev.evaluateeId}
                    </div>
                    <div className="col-span-1 font-sans text-xs uppercase text-[var(--hrs-slate)] truncate pr-1">{userPositions[ev.evaluateeId] || '-'}</div>
                    <div className="col-span-1 font-sans text-xs uppercase text-[var(--hrs-slate)] truncate pr-1">{userDepartments[ev.evaluateeId] || '-'}</div>
                    <div className="col-span-1 font-sans text-xs text-center text-[var(--hrs-slate)]">{userYears[ev.evaluateeId] != null ? `${userYears[ev.evaluateeId]}년` : '-'}</div>
                    <div className="col-span-1 font-sans text-xs uppercase text-[var(--hrs-slate)] text-center">
                      <span className={isComplete ? 'text-emerald-700' : 'text-amber-700'}>
                         {ev.totalCompleted}/{ev.totalAssigned}
                      </span>
                    </div>
                    <div className="col-span-1 text-center font-sans text-xs bg-[var(--hrs-line-soft)] py-1 mx-1 rounded">
                      {rawAvg}
                    </div>
                    <div className="col-span-1 text-center font-sans text-xs text-[var(--hrs-slate)]">
                      {periodic.attendanceScore != null ? periodic.attendanceScore : <span className="text-[var(--hrs-slate)]">미입력</span>}
                    </div>
                    <div className="col-span-1 text-center font-sans text-xs text-[var(--hrs-slate)]">
                      {periodic.workLogScore != null ? periodic.workLogScore : <span className="text-[var(--hrs-slate)]">미입력</span>}
                    </div>
                    <div className="col-span-1 text-center text-base font-bold">
                      {ev.finalState ? ev.finalState.totalScore : <span className="text-[var(--hrs-slate)] text-xs font-normal">{weightedScoreOf(ev)}</span>}
                    </div>
                    <div className="col-span-1 text-center">
                      {ev.finalState ? (
                        <span className="text-[9px] uppercase tracking-widest px-2 py-1 bg-[var(--hrs-accent)] text-white">확정</span>
                      ) : (
                        <span className="text-[9px] uppercase tracking-widest px-2 py-1 bg-[#E8F5E9] text-emerald-800 border border-emerald-100">대기</span>
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        className="text-[12px] uppercase tracking-widest text-red-500 hover:text-red-700 underline underline-offset-4 font-bold"
                        onClick={() => openConfirmation(ev)}
                      >
                        검토
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[50vw] max-w-[50vw] w-[50vw] border-[var(--hrs-line)] rounded-none bg-[var(--hrs-surface)] p-0">
          <DialogHeader className="p-8 border-b border-[var(--hrs-line)] bg-[var(--hrs-bg)]">
            <DialogTitle className="text-3xl font-normal leading-none text-[var(--hrs-ink)]">
              최종 점수 확정
              <span className="block mt-2 font-sans font-bold text-lg text-[var(--hrs-slate)] tracking-tight">
                {usersMap[selectedEvaluatee?.evaluateeId]} {userPositions[selectedEvaluatee?.evaluateeId] ? `(${userPositions[selectedEvaluatee?.evaluateeId]})` : ''}{userYears[selectedEvaluatee?.evaluateeId] != null ? ` · ${userYears[selectedEvaluatee?.evaluateeId]}년차` : ''}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-8 pb-12">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-[var(--hrs-slate)] border-b border-[var(--hrs-line-soft)] pb-2">평가 내역 상세</h4>
            
            <div className="border border-[var(--hrs-line)] flex flex-col">
              <div className="grid grid-cols-12 bg-[var(--hrs-bg)] text-[var(--hrs-slate)] border-b border-[var(--hrs-line)] font-semibold text-[11px] uppercase tracking-[0.04em] p-3 sticky top-0">
                <div className="col-span-2">평가자</div>
                <div className="col-span-1">직급</div>
                <div className="col-span-2">부서</div>
                <div className="col-span-1 text-center">연차</div>
                <div className="col-span-3">대상 그룹</div>
                <div className="col-span-1 text-center">점수</div>
                <div className="col-span-2 text-right">상태</div>
              </div>
              <div className="max-h-[320px] overflow-y-auto text-sm bg-white">
                {[...(selectedEvaluatee?.exec_assignments ?? [])].sort((a: any, b: any) => {
                  const order = (g: string) => { const n = groupsMap[g] || ''; return n.includes('자기') ? 0 : n.includes('하향') ? 1 : n.includes('상향') ? 2 : 3; };
                  return order(a.groupId) - order(b.groupId) || (groupsMap[a.groupId] || '').localeCompare(groupsMap[b.groupId] || '');
                }).map((assn: any) => (
                  <div key={assn.id} className="p-3 border-b border-[var(--hrs-line-soft)] hover:bg-[var(--hrs-bg)] transition-colors">
                    <div className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-2 font-bold truncate pr-1" title={usersMap[assn.evaluatorId] || assn.evaluatorId}>{usersMap[assn.evaluatorId] || assn.evaluatorId}</div>
                      <div className="col-span-1 text-xs text-[var(--hrs-slate)] truncate pr-1" title={userPositions[assn.evaluatorId]}>{userPositions[assn.evaluatorId] || '-'}</div>
                      <div className="col-span-2 text-xs uppercase text-[var(--hrs-slate)] truncate pr-1" title={userDepartments[assn.evaluatorId]}>{userDepartments[assn.evaluatorId] || '-'}</div>
                      <div className="col-span-1 text-xs text-center text-[var(--hrs-slate)]">{userYears[assn.evaluatorId] != null ? `${userYears[assn.evaluatorId]}년` : '-'}</div>
                      <div className="col-span-3 text-xs font-sans uppercase text-[var(--hrs-slate)] tracking-wider truncate pr-1">{groupsMap[assn.groupId]}</div>
                      <div className="col-span-1 text-center font-bold text-lg">{assn.status === 'completed' ? assn.totalScore : '-'}</div>
                      <div className="col-span-2 text-right">
                         <span className={`text-[9px] uppercase tracking-widest px-2 py-1 ${assn.status === 'completed' ? 'bg-[var(--hrs-accent)] text-white' : 'bg-[var(--hrs-line)] text-[var(--hrs-slate)]'}`}>{assn.status === 'completed' ? '완료' : '대기'}</span>
                      </div>
                    </div>
                    {(assn.comment || (assn.scores && Object.keys(assn.scores).length > 0)) && (
                      <div className="mt-4 p-4 bg-[var(--hrs-line-soft)] text-xs text-[var(--hrs-slate)] rounded whitespace-pre-wrap leading-relaxed">
                        {assn.scores && Object.keys(assn.scores).length > 0 && (
                          <div className="mb-4 space-y-2">
                             <span className="font-bold text-[var(--hrs-ink)] block mb-2 text-[10px] uppercase tracking-widest border-b border-[var(--hrs-line)] pb-1">점수 평가 내역</span>
                             {Object.entries(assn.scores).map(([itemId, score], idx) => (
                               <div key={itemId} className="flex justify-between border-b border-[var(--hrs-line)] pb-1 last:border-0 last:pb-0 gap-4">
                                 <span className="text-[var(--hrs-ink)] flex-1 truncate">{itemsMap[itemId] || `문항 ${idx + 1}`}</span>
                                 <span className="font-bold text-[var(--hrs-ink)] whitespace-nowrap">{String(score)}점</span>
                               </div>
                             ))}
                          </div>
                        )}
                        {assn.comment && (
                          <div>
                            <span className="font-bold text-[var(--hrs-ink)] block mb-2 text-[10px] uppercase tracking-widest border-b border-[var(--hrs-line)] pb-1">정성 평가 의견</span>
                            {assn.comment}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 가중평균 산출 내역 */}
            {selectedEvaluatee && (
              <div className="border border-[var(--hrs-line)] bg-[var(--hrs-bg)] p-5">
                <h4 className="text-[10px] uppercase tracking-[0.2em] text-[var(--hrs-slate)] border-b border-[var(--hrs-line-soft)] pb-2 mb-3">가중평균 산출 내역</h4>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-[var(--hrs-slate)] mb-1">원점수 평균</p>
                    <p className="text-lg font-bold">{rawAvgOf(selectedEvaluatee).toFixed(1)}</p>
                    <p className="text-[9px] text-[var(--hrs-slate)]">×{weights.eval}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-[var(--hrs-slate)] mb-1">근태</p>
                    <p className="text-lg font-bold">{userPeriodic[selectedEvaluatee.evaluateeId]?.attendanceScore ?? <span className="text-[var(--hrs-slate)] text-sm">미입력(0)</span>}</p>
                    <p className="text-[9px] text-[var(--hrs-slate)]">×{weights.attendance}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-[var(--hrs-slate)] mb-1">업무일지</p>
                    <p className="text-lg font-bold">{userPeriodic[selectedEvaluatee.evaluateeId]?.workLogScore ?? <span className="text-[var(--hrs-slate)] text-sm">미입력(0)</span>}</p>
                    <p className="text-[9px] text-[var(--hrs-slate)]">×{weights.workLog}%</p>
                  </div>
                  <div className="border-l border-[var(--hrs-line)]">
                    <p className="text-[9px] uppercase tracking-widest text-[var(--hrs-slate)] mb-1">가중평균 제안</p>
                    <p className="text-lg font-bold text-emerald-700">{weightedScoreOf(selectedEvaluatee)}</p>
                  </div>
                </div>
              </div>
            )}

            {!isPresidentReadOnly && (
              <div className="bg-[var(--hrs-accent)] p-6 space-y-4 text-white">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-white/70 block mb-2">최종 확정 점수</Label>
                <div className="flex gap-4">
                  <Input 
                    type="number" 
                    step="0.1" 
                    className="w-1/3 text-2xl bg-transparent border-b border-white/20 border-t-0 border-l-0 border-r-0 rounded-none focus-visible:ring-0 focus-visible:border-white text-center" 
                    value={finalScoreInput}
                    onChange={e => setFinalScoreInput(e.target.value)} 
                  />
                  <button 
                    className="flex-1 bg-white text-[var(--hrs-ink)] text-[11px] uppercase tracking-widest hover:bg-[var(--hrs-line)] transition-colors" 
                    onClick={confirmScore}
                  >
                    최종 점수 확정 및 저장
                  </button>
                </div>
                <p className="text-[9px] uppercase tracking-widest text-[var(--hrs-slate)] ">원점수 평균을 바탕으로 HR 담당자 및 관리자가 최종 점수를 조정하여 확정할 수 있습니다.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
