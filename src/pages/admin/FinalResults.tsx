import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';

export default function FinalResults() {
  const { user } = useAuth();
  const [years, setYears] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  
  const [evaluatees, setEvaluatees] = useState<any[]>([]); // Grouped results
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [userPositions, setUserPositions] = useState<Record<string, string>>({});
  const [groupsMap, setGroupsMap] = useState<Record<string, string>>({});
  const [itemsMap, setItemsMap] = useState<Record<string, string>>({});
  
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [userDepartments, setUserDepartments] = useState<Record<string, string>>({});

  const [selectedEvaluatee, setSelectedEvaluatee] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [finalScoreInput, setFinalScoreInput] = useState('');

  const isGroupLeader = user && user.role === 'user' && user.position?.endsWith('그룹장');
  const isPresidentReadOnly = user?.position === '사장' && user?.role !== 'admin' && user?.role !== 'hr';

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
      const [yearsSnap, usersSnap, groupsSnap, itemsSnap] = await Promise.all([
        getDocs(collection(db, 'years')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'groups')),
        getDocs(collection(db, 'items'))
      ]);
      setYears(yearsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const umap: Record<string, string> = {};
      const dmap: Record<string, string> = {};
      const pmap: Record<string, string> = {};
      const deptSet = new Set<string>();
      
      usersSnap.docs.forEach(d => { 
        const data = d.data();
        umap[data.email] = data.name; 
        dmap[data.email] = data.department || '';
        pmap[data.email] = data.position || '';
        if (data.department) deptSet.add(data.department);
      });
      setUsersMap(umap);
      setUserDepartments(dmap);
      setUserPositions(pmap);
      setDepartments(Array.from(deptSet).sort());

      const gmap: Record<string, string> = {};
      groupsSnap.docs.forEach(d => { gmap[d.id] = d.data().name; });
      setGroupsMap(gmap);

      const imap: Record<string, string> = {};
      itemsSnap.docs.forEach(d => { imap[d.id] = d.data().question; });
      setItemsMap(imap);
    } catch (e) {
      console.error("fetchBaseData error", e);
    }
  };

  const fetchResults = async () => {
    try {
      // 1. Fetch assignments for this year
      const q1 = query(collection(db, 'assignments'), where('year', '==', selectedYear));
      const assignmentsSnap = await getDocs(q1);
      const assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Fetch finalized scores if any
      const q2 = query(collection(db, 'finalScores'), where('year', '==', selectedYear));
      const finalSnap = await getDocs(q2);
      const finalScoresMap : Record<string, any> = {};
      finalSnap.docs.forEach(d => { finalScoresMap[d.data().evaluateeId] = d.data(); });

      // 3. Fetch qualitative comments (results)
      const resultsSnap = await getDocs(collection(db, 'results'));
      const resultsMap : Record<string, any> = {};
      resultsSnap.docs.forEach(d => {
        // the document ID is the assignmentId
        resultsMap[d.id] = d.data();
      });

      // Group assignments by evaluatee
      const grouped: Record<string, any> = {};

      assignments.forEach((assn: any) => {
        if (!grouped[assn.evaluateeId]) {
          grouped[assn.evaluateeId] = {
            evaluateeId: assn.evaluateeId,
            totalAssigned: 0,
            totalCompleted: 0,
            rawScoreSum: 0,
            assignments: [],
            finalState: finalScoresMap[assn.evaluateeId] || null
          };
        }
        grouped[assn.evaluateeId].totalAssigned++;
        if (assn.status === 'completed') {
          grouped[assn.evaluateeId].totalCompleted++;
          grouped[assn.evaluateeId].rawScoreSum += (assn.totalScore || 0);
          // attach qualitative comment and scores
          assn.comment = resultsMap[assn.id]?.comment || '';
          assn.scores = resultsMap[assn.id]?.scores || {};
        }
        grouped[assn.evaluateeId].assignments.push(assn);
      });

      setEvaluatees(Object.values(grouped));
    } catch (e: any) {
      console.error("fetchResults error", e);
      alert("데이터를 불러오지 못했습니다. 권한이 부족하거나 오류가 발생했습니다: " + e.message);
    }
  };

  const openConfirmation = (evaluatee: any) => {
    setSelectedEvaluatee(evaluatee);
    // suggest an average score if not previously confirmed
    let suggested = 0;
    if (evaluatee.finalState) {
      suggested = evaluatee.finalState.totalScore;
    } else {
      if (evaluatee.totalCompleted > 0) {
        suggested = Math.round((evaluatee.rawScoreSum / evaluatee.totalCompleted) * 10) / 10;
      }
    }
    setFinalScoreInput(suggested.toString());
    setModalOpen(true);
  };

  const confirmScore = async () => {
    if (!selectedEvaluatee || !selectedYear) return;
    const finalId = `${selectedYear}_${selectedEvaluatee.evaluateeId}`;
    
    await setDoc(doc(db, 'finalScores', finalId), {
      year: selectedYear,
      evaluateeId: selectedEvaluatee.evaluateeId,
      totalScore: parseFloat(finalScoreInput),
      status: 'confirmed',
      confirmedAt: serverTimestamp()
    });

    setModalOpen(false);
    fetchResults();
    alert('최종 점수가 확정되어 저장되었습니다.');
  };

  const downloadExcel = () => {
    if (!selectedYear || filteredEvaluatees.length === 0) return alert('다운로드할 결과 데이터가 없습니다.');

    const yearData = years.find(y => y.id === selectedYear);
    const exportData = filteredEvaluatees.map(ev => {
      const isComplete = ev.totalCompleted === ev.totalAssigned;
      const rawAvg = ev.totalCompleted > 0 ? (ev.rawScoreSum / ev.totalCompleted).toFixed(2) : '-';
      
      const commentsText = ev.assignments
        .filter((a: any) => a.comment)
        .map((a: any) => `[${usersMap[a.evaluatorId] || a.evaluatorId}] ${a.comment}`)
        .join('\n\n');

      return {
        '연도': yearData?.year || selectedYear,
        '피평가자(대상자) 이름': usersMap[ev.evaluateeId] || ev.evaluateeId,
        '직급': userPositions[ev.evaluateeId] || '-',
        '이메일': ev.evaluateeId,
        '할당 건수': ev.totalAssigned,
        '완료 건수': ev.totalCompleted,
        '진행률': isComplete ? '완료' : '진행중',
        '원점수 평균': rawAvg,
        '최종 확정 점수': ev.finalState ? ev.finalState.totalScore : '미확정',
        '상태': ev.finalState ? '확정됨' : '대기 중',
        '정성 평가 의견': commentsText
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Final Results");
    XLSX.writeFile(wb, `Final_Evaluation_Results_${yearData?.year || selectedYear}.xlsx`);
  };

  const filteredEvaluatees = evaluatees.filter(ev => {
    if (isGroupLeader) {
      const dep = user.department || user.position!.replace('장', '');
      return userDepartments[ev.evaluateeId] === dep;
    }
    if (selectedDepartment === 'all') return true;
    return userDepartments[ev.evaluateeId] === selectedDepartment;
  });

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[#1A1A1A] pb-6">
        <div>
          <h2 className="text-5xl tracking-tighter">최종 평가 결과</h2>
          <p className="mt-2 text-[#555] uppercase tracking-[0.2em] text-[15px]">평가 대상자별 종합 점수를 검토하고 최종 확정합니다.</p>
        </div>
        <div className="flex gap-3">
          {selectedYear && evaluatees.length > 0 && (
            <button 
              onClick={downloadExcel}
              className="px-5 py-2 border border-[#1A1A1A] text-[11px] uppercase tracking-widest hover:bg-[#1A1A1A] hover:text-white transition-colors"
            >
              엑셀 다운로드
            </button>
          )}
          <div className="w-48">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment} disabled={!!isGroupLeader}>
              <SelectTrigger className="border-[#1A1A1A] rounded-none bg-transparent">
                <SelectValue placeholder="소속 부서 선택" />
              </SelectTrigger>
              <SelectContent>
                {!isGroupLeader && <SelectItem value="all">전체 부서</SelectItem>}
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="border-[#1A1A1A] rounded-none bg-transparent">
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
        <div className="border-b border-[#EEE] pb-4">
          <p className="text-[15px] uppercase tracking-[0.2em] text-[#999] mb-1">진행 연도</p>
          <p className="text-2xl font-light tracking-tight">{selectedYear || '선택 안됨'}</p>
        </div>
        <div className="border-b border-[#EEE] pb-4">
          <p className="text-[15px] uppercase tracking-[0.2em] text-[#999] mb-1">평가 대상자 수 (필터됨)</p>
          <p className="text-2xl font-light tracking-tight">{filteredEvaluatees.length}명</p>
        </div>
        <div className="border-b border-[#EEE] pb-4">
          <p className="text-[15px] uppercase tracking-[0.2em] text-[#999] mb-1">전체 평가율 (필터됨)</p>
          <p className="text-2xl font-light tracking-tight">
             {filteredEvaluatees.length > 0 
               ? `${Math.round((filteredEvaluatees.reduce((sum, e) => sum + e.totalCompleted, 0) / filteredEvaluatees.reduce((sum, e) => sum + e.totalAssigned, 0)) * 100)}%` 
               : '0%'}
          </p>
        </div>
        <div className="border-b border-[#EEE] pb-4">
          <p className="text-[15px] uppercase tracking-[0.2em] text-[#999] mb-1">현재 상태</p>
          <p className="text-2xl font-light tracking-tight text-emerald-700 underline underline-offset-4">평가 진행/검토 중</p>
        </div>
      </section>

      {selectedYear && (
        <div className="flex-1 border border-[#1A1A1A] overflow-hidden flex flex-col">
          <div className="grid grid-cols-12 bg-[#1A1A1A] text-white text-[15px] uppercase tracking-[0.15em] p-4 sticky top-0">
            <div className="col-span-2">이름</div>
            <div className="col-span-2">직급</div>
            <div className="col-span-2">소속부서</div>
            <div className="col-span-1 text-center">진행률</div>
            <div className="col-span-1 text-center">원점수</div>
            <div className="col-span-2 text-center">최종 점수</div>
            <div className="col-span-1 text-center">상태</div>
            <div className="col-span-1 text-right">상세조회</div>
          </div>
          
          <div className="flex-1 overflow-y-auto  text-sm">
            {filteredEvaluatees.length === 0 ? (
               <div className="p-8 text-center text-[#777] font-sans">진행된 평가 내역이 없습니다.</div>
            ) : (
              filteredEvaluatees.map(ev => {
                const isComplete = ev.totalCompleted === ev.totalAssigned;
                const rawAvg = ev.totalCompleted > 0 ? (ev.rawScoreSum / ev.totalCompleted).toFixed(2) : '-';
                
                return (
                  <div key={ev.evaluateeId} className="grid grid-cols-12 p-4 border-b border-[#EEE] items-center hover:bg-[#F9F9F9] cursor-default group">
                    <div className="col-span-2 font-bold">
                      {usersMap[ev.evaluateeId] || ev.evaluateeId}
                    </div>
                    <div className="col-span-2 font-sans text-xs uppercase text-[#777]">{userPositions[ev.evaluateeId] || '-'}</div>
                    <div className="col-span-2 font-sans text-xs uppercase text-[#777]">{userDepartments[ev.evaluateeId] || '-'}</div>
                    <div className="col-span-1 font-sans text-xs uppercase text-[#777] text-center">
                      <span className={isComplete ? 'text-emerald-700' : 'text-amber-700'}>
                         {ev.totalCompleted}/{ev.totalAssigned}
                      </span>
                    </div>
                    <div className="col-span-1 text-center font-sans text-xs bg-[#F0F0F0] py-1 mx-2">
                      {rawAvg}
                    </div>
                    <div className="col-span-2 text-center text-lg">
                      {ev.finalState ? ev.finalState.totalScore : '—'}
                    </div>
                    <div className="col-span-1 text-center">
                      {ev.finalState ? (
                        <span className="text-[9px] uppercase tracking-widest px-2 py-1 bg-[#1A1A1A] text-white">확정</span>
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
        <DialogContent className="sm:max-w-[50vw] max-w-[50vw] w-[50vw] border-[#1A1A1A] rounded-none bg-[#FDFDFB] p-0">
          <DialogHeader className="p-8 border-b border-[#E5E5E5] bg-[#F9F9F9]">
            <DialogTitle className="text-3xl font-normal leading-none text-[#1A1A1A]">
              최종 점수 확정
              <span className="block mt-2 font-sans font-bold text-lg text-[#555] tracking-tight">
                {usersMap[selectedEvaluatee?.evaluateeId]} {userPositions[selectedEvaluatee?.evaluateeId] ? `(${userPositions[selectedEvaluatee?.evaluateeId]})` : ''}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-8 pb-12">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#999] border-b border-[#EEE] pb-2">평가 내역 상세</h4>
            
            <div className="border border-[#1A1A1A] flex flex-col">
              <div className="grid grid-cols-12 bg-[#1A1A1A] text-white text-[10px] uppercase tracking-[0.15em] p-3 sticky top-0">
                <div className="col-span-4">평가자</div>
                <div className="col-span-3">대상 그룹</div>
                <div className="col-span-2 text-center">점수</div>
                <div className="col-span-3 text-right">상태</div>
              </div>
              <div className="max-h-64 overflow-y-auto  text-sm bg-white">
                {selectedEvaluatee?.assignments.map((assn: any) => (
                  <div key={assn.id} className="p-3 border-b border-[#EEE] hover:bg-[#F9F9F9] transition-colors">
                    <div className="grid grid-cols-12 items-center">
                      <div className="col-span-4 font-bold">{usersMap[assn.evaluatorId] || assn.evaluatorId} {userPositions[assn.evaluatorId] ? `(${userPositions[assn.evaluatorId]})` : ''}</div>
                      <div className="col-span-3 text-xs font-sans uppercase text-[#777] tracking-wider">{groupsMap[assn.groupId]}</div>
                      <div className="col-span-2 text-center font-bold text-lg">{assn.status === 'completed' ? assn.totalScore : '-'}</div>
                      <div className="col-span-3 text-right">
                         <span className={`text-[9px] uppercase tracking-widest px-2 py-1 ${assn.status === 'completed' ? 'bg-[#1A1A1A] text-white' : 'bg-[#E5E5E5] text-[#777]'}`}>{assn.status === 'completed' ? '완료' : '대기'}</span>
                      </div>
                    </div>
                    {(assn.comment || (assn.scores && Object.keys(assn.scores).length > 0)) && (
                      <div className="mt-4 p-4 bg-[#F5F5F5] text-xs text-[#555] rounded whitespace-pre-wrap leading-relaxed">
                        {assn.scores && Object.keys(assn.scores).length > 0 && (
                          <div className="mb-4 space-y-2">
                             <span className="font-bold text-[#333] block mb-2 text-[10px] uppercase tracking-widest border-b border-[#E5E5E5] pb-1">점수 평가 내역</span>
                             {Object.entries(assn.scores).map(([itemId, score], idx) => (
                               <div key={itemId} className="flex justify-between border-b border-[#E5E5E5] pb-1 last:border-0 last:pb-0 gap-4">
                                 <span className="text-[#333] flex-1 truncate">{itemsMap[itemId] || `문항 ${idx + 1}`}</span>
                                 <span className="font-bold text-[#1A1A1A] whitespace-nowrap">{String(score)}점</span>
                               </div>
                             ))}
                          </div>
                        )}
                        {assn.comment && (
                          <div>
                            <span className="font-bold text-[#333] block mb-2 text-[10px] uppercase tracking-widest border-b border-[#E5E5E5] pb-1">정성 평가 의견</span>
                            {assn.comment}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {!isPresidentReadOnly && (
              <div className="bg-[#1A1A1A] p-6 space-y-4 text-white">
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
                    className="flex-1 bg-white text-[#1A1A1A] text-[11px] uppercase tracking-widest hover:bg-[#E5E5E5] transition-colors" 
                    onClick={confirmScore}
                  >
                    최종 점수 확정 및 저장
                  </button>
                </div>
                <p className="text-[9px] uppercase tracking-widest text-[#777] ">원점수 평균을 바탕으로 HR 담당자 및 관리자가 최종 점수를 조정하여 확정할 수 있습니다.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
