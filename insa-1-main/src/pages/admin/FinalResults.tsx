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
import ExcelJS from 'exceljs';
import { logger } from '../../lib/logger';

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
  const [userYears, setUserYears] = useState<Record<string, number | null>>({});
  const [userMonths, setUserMonths] = useState<Record<string, number | null>>({});
  const fmtService = (id: string) => {
    const y = userYears[id]; const m = userMonths[id];
    if (y == null && m == null) return '-';
    return `${y ?? 0}년${m ? ` ${m}개월` : ''}`;
  };
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
  const hasConfirmPerms = !!(user?.confirmDepartments?.length);
  const canConfirmForDept = (dept: string) =>
    user?.role === 'admin' || user?.role === 'hr' || !!(user?.confirmDepartments?.includes(dept));

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
        getDocs(collection(db, 'items'))
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
      // 1. Fetch assignments for this year
      const q1 = query(collection(db, 'assignments'), where('year', '==', selectedYear));
      const assignmentsSnap = await getDocs(q1);
      const assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Fetch finalized scores if any
      const q2 = query(collection(db, 'finalScores'), where('year', '==', selectedYear));
      const finalSnap = await getDocs(q2);
      const finalScoresMap : Record<string, any> = {};
      finalSnap.docs.forEach(d => { finalScoresMap[d.data().evaluateeId] = d.data(); });

      // 3. Fetch results only for this year's assignment IDs (batched, max 30 per query)
      const assignmentIds = assignments.map((a: any) => a.id);
      const resultsMap: Record<string, any> = {};
      for (let i = 0; i < assignmentIds.length; i += 30) {
        const batch = assignmentIds.slice(i, i + 30);
        const rq = query(collection(db, 'results'), where(documentId(), 'in', batch));
        const rSnap = await getDocs(rq);
        rSnap.docs.forEach(d => { resultsMap[d.id] = d.data(); });
      }

      // 4. Fetch user info for all referenced users individually (avoids list permission requirement)
      const allUserIds = new Set<string>();
      assignments.forEach((assn: any) => {
        allUserIds.add(assn.evaluateeId);
        allUserIds.add(assn.evaluatorId);
      });
      const umap: Record<string, string> = {};
      const dmap: Record<string, string> = {};
      const pmap: Record<string, string> = {};
      const ymap: Record<string, number | null> = {};
      const mmap: Record<string, number | null> = {};
      const deptSet = new Set<string>();
      await Promise.all([...allUserIds].map(async (id: string) => {
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          const data = userDoc.data();
          umap[data.email] = data.name;
          dmap[data.email] = data.department || '';
          pmap[data.email] = data.position || '';
          ymap[data.email] = data.yearsOfService ?? null;
          mmap[data.email] = data.serviceMonths ?? null;
          if (data.department) deptSet.add(data.department);
        }
      }));
      setUsersMap(umap);
      setUserDepartments(dmap);
      setUserPositions(pmap);
      setUserYears(ymap);
      setUserMonths(mmap);
      setDepartments(Array.from(deptSet).sort());

      // 5. 연도 가중치 + 근태/업무일지 점수 조회
      const yearDoc = await getDoc(doc(db, 'years', selectedYear));
      const w = yearDoc.exists() ? yearDoc.data().weights : null;
      setWeights({
        eval: w?.eval ?? 70,
        attendance: w?.attendance ?? 15,
        workLog: w?.workLog ?? 15,
      });

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

    await setDoc(doc(db, 'finalScores', finalId), {
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('최종 평가 결과');
    worksheet.columns = [
      { key: 'label', width: 28 },
      { key: 'value', width: 42 },
    ];

    // 피평가자 블록: 연한 파랑 / 평가자 블록: 노랑→초록→핑크→보라 순환
    const EVALUATEE_BG = 'FFDBEAFE';
    const EVALUATOR_BGS = ['FFFEF9C3', 'FFDCFCE7', 'FFFCE7F3', 'FFEDE9FE'];

    const addRow = (label: string, value: any, bgArgb: string, redValue = false) => {
      const row = worksheet.addRow([label, value ?? '']);

      const labelCell = row.getCell(1);
      labelCell.font = { bold: true, color: { argb: 'FF000000' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };

      const valueCell = row.getCell(2);
      valueCell.font = redValue ? { bold: true, color: { argb: 'FFFF0000' } } : { color: { argb: 'FF000000' } };
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      valueCell.alignment = { horizontal: 'left', vertical: 'middle' };
    };

    filteredEvaluatees.forEach((ev, index) => {
      const rawAvg = ev.totalCompleted > 0
        ? parseFloat((ev.rawScoreSum / ev.totalCompleted).toFixed(2))
        : '-';

      const periodic = userPeriodic[ev.evaluateeId] || {};
      addRow('피평가자(대상자) 이름', usersMap[ev.evaluateeId] || ev.evaluateeId, EVALUATEE_BG);
      addRow('직급', userPositions[ev.evaluateeId] || '-', EVALUATEE_BG);
      addRow('부서', userDepartments[ev.evaluateeId] || '-', EVALUATEE_BG);
      addRow('연차', fmtService(ev.evaluateeId), EVALUATEE_BG);
      addRow('원점수 평균', rawAvg, EVALUATEE_BG, true);
      addRow('근태점수', periodic.attendanceScore != null ? periodic.attendanceScore : '미입력', EVALUATEE_BG);
      addRow('업무일지 점수', periodic.workLogScore != null ? periodic.workLogScore : '미입력', EVALUATEE_BG);
      addRow(`가중치(평가/근태/업무일지)`, `${weights.eval}% / ${weights.attendance}% / ${weights.workLog}%`, EVALUATEE_BG);
      addRow('가중평균 제안 점수', weightedScoreOf(ev), EVALUATEE_BG, true);
      addRow('최종 확정 점수', ev.finalState ? ev.finalState.totalScore : '미확정', EVALUATEE_BG, true);

      const sorted = [...ev.assignments].sort((a: any, b: any) => {
        const order = (g: string) => { const n = groupsMap[g] || ''; return n.includes('자기') ? 0 : n.includes('하향') ? 1 : n.includes('상향') ? 2 : 3; };
        return order(a.groupId) - order(b.groupId);
      });

      sorted.forEach((assn: any, idx: number) => {
        const i = idx + 1;
        const bg = EVALUATOR_BGS[idx % EVALUATOR_BGS.length];
        addRow(`평가${i} 이름`, usersMap[assn.evaluatorId] || assn.evaluatorId, bg);
        addRow(`평가${i} 직급`, userPositions[assn.evaluatorId] || '-', bg);
        addRow(`평가${i} 대상 그룹`, groupsMap[assn.groupId] || '-', bg);
        addRow(`평가${i} 점수`, assn.status === 'completed' ? assn.totalScore : '-', bg);
        addRow(`평가${i} 정성 평가 의견`, assn.comment || '', bg);
      });

      if (index < filteredEvaluatees.length - 1) {
        worksheet.addRow([]);
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Final_Evaluation_Results_${yearData?.year || selectedYear}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredEvaluatees = evaluatees.filter(ev => {
    const evDept = userDepartments[ev.evaluateeId];
    if (isGroupLeader) {
      const dep = user.department || user.position!.replace('장', '');
      return evDept === dep;
    }
    if (hasConfirmPerms && !canConfirmForDept(evDept)) return false;
    if (selectedDepartment === 'all') return true;
    return evDept === selectedDepartment;
  });

  // 표시용 최종점수 (확정값 우선, 미확정은 가중평균 제안값)
  const displayFinal = (ev: any) => ev.finalState ? ev.finalState.totalScore : weightedScoreOf(ev);
  const bandColor = (s: number) => s >= 90 ? 'var(--hrs-accent)' : s >= 80 ? 'var(--hrs-high)' : s >= 70 ? 'var(--hrs-mid)' : 'var(--hrs-low)';

  const totAssigned = filteredEvaluatees.reduce((s, e) => s + e.totalAssigned, 0);
  const totCompleted = filteredEvaluatees.reduce((s, e) => s + e.totalCompleted, 0);
  const completionRate = totAssigned > 0 ? Math.round((totCompleted / totAssigned) * 100) : 0;
  const confirmedCount = filteredEvaluatees.filter(e => e.finalState).length;
  const finals = filteredEvaluatees.map(displayFinal);
  const avgFinal = finals.length ? (finals.reduce((s, n) => s + n, 0) / finals.length) : 0;

  // 점수 분포 (구간별 인원)
  const bands = [
    { label: '60–69', min: 0, max: 69.999, color: 'var(--hrs-low)' },
    { label: '70–79', min: 70, max: 79.999, color: 'var(--hrs-mid)' },
    { label: '80–89', min: 80, max: 89.999, color: 'var(--hrs-high)' },
    { label: '90–100', min: 90, max: 999, color: 'var(--hrs-accent)' },
  ].map(b => ({ ...b, count: finals.filter(s => s >= b.min && s <= b.max).length }));
  const bandMax = Math.max(1, ...bands.map(b => b.count));

  // 부서별 평균
  const deptAgg: Record<string, { sum: number; n: number }> = {};
  filteredEvaluatees.forEach(e => {
    const d = userDepartments[e.evaluateeId] || '기타';
    if (!deptAgg[d]) deptAgg[d] = { sum: 0, n: 0 };
    deptAgg[d].sum += displayFinal(e); deptAgg[d].n += 1;
  });
  const deptAverages = Object.entries(deptAgg)
    .map(([name, { sum, n }]) => ({ name, avg: n ? sum / n : 0 }))
    .sort((a, b) => b.avg - a.avg);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-8 pb-5 border-b border-[var(--hrs-line)]">
        <div>
          <p className="hrs-eyebrow mb-1.5">최종 평가 결과{selectedYear ? ` · ${years.find(y => y.id === selectedYear)?.year || ''}` : ''}</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--hrs-ink)]">종합 평가 분석</h2>
          <p className="mt-1.5 text-sm text-[var(--hrs-slate)]">평가 대상자별 종합 점수를 검토하고 최종 확정합니다.</p>
        </div>
        <div className="flex gap-3 items-center">
          {selectedYear && evaluatees.length > 0 && (
            <button
              onClick={downloadExcel}
              className="px-4 py-2 rounded-md border border-[var(--hrs-line)] text-[13px] font-medium text-[var(--hrs-slate)] hover:text-[var(--hrs-accent)] hover:border-[var(--hrs-accent)] transition-colors bg-[var(--hrs-surface)]"
            >
              엑셀 다운로드
            </button>
          )}
          <div className="w-44">
            <Select value={selectedDepartment} onValueChange={(v) => setSelectedDepartment(v ?? '')} disabled={!!isGroupLeader}>
              <SelectTrigger className="bg-[var(--hrs-surface)]">
                <SelectValue placeholder="소속 부서 선택" />
              </SelectTrigger>
              <SelectContent>
                {!isGroupLeader && <SelectItem value="all">전체 부서</SelectItem>}
                {departments
                  .filter(d => !hasConfirmPerms || canConfirmForDept(d))
                  .map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Select value={selectedYear} onValueChange={(v) => setSelectedYear(v ?? '')}>
              <SelectTrigger className="bg-[var(--hrs-surface)]">
                <SelectValue placeholder="조회할 평가 연도 선택" />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y.id} value={y.id}>{y.year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* KPI 밴드 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-3.5">
        {[
          { label: '평가 대상자', val: `${filteredEvaluatees.length}`, unit: '명' },
          { label: '평가 완료율', val: `${completionRate}`, unit: '%', mono: true },
          { label: '전체 평균', val: avgFinal ? avgFinal.toFixed(1) : '—', mono: true },
          { label: '확정 완료', val: `${confirmedCount}`, unit: `/ ${filteredEvaluatees.length}`, mono: true },
        ].map(k => (
          <div key={k.label} className="hrs-card p-4">
            <p className="text-xs text-[var(--hrs-slate)] mb-2">{k.label}</p>
            <p className={`text-[28px] font-bold leading-none tracking-tight text-[var(--hrs-ink)] ${k.mono ? 'hrs-mono' : ''}`}>
              {k.val}{k.unit && <span className="text-sm font-medium text-[var(--hrs-slate)] ml-1">{k.unit}</span>}
            </p>
          </div>
        ))}
      </section>

      {/* 분석: 점수 분포 + 부서별 평균 */}
      {selectedYear && filteredEvaluatees.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-6">
          <div className="hrs-card p-5">
            <h3 className="text-[12.5px] font-semibold text-[var(--hrs-ink)] mb-0.5">점수 분포</h3>
            <p className="text-[12px] text-[var(--hrs-slate)] mb-4">최종 점수 구간별 인원</p>
            <div className="flex items-end gap-2.5 h-[104px] pt-1.5">
              {bands.map(b => (
                <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5 justify-end h-full">
                  <span className="hrs-mono text-[12px] font-semibold text-[var(--hrs-ink)]">{b.count}</span>
                  <div className="w-full rounded-t-[5px]" style={{ height: `${Math.max(4, (b.count / bandMax) * 72)}px`, background: b.color }}></div>
                  <span className="text-[12px] text-[var(--hrs-slate)]">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hrs-card p-5">
            <h3 className="text-[12.5px] font-semibold text-[var(--hrs-ink)] mb-0.5">부서별 평균</h3>
            <p className="text-[12px] text-[var(--hrs-slate)] mb-4">그룹별 최종 평균 점수</p>
            <div className="flex flex-col gap-2.5">
              {deptAverages.slice(0, 5).map(d => (
                <div key={d.name} className="grid grid-cols-[84px_1fr_42px] items-center gap-2.5">
                  <span className="text-[12.5px] text-[var(--hrs-ink)] truncate">{d.name}</span>
                  <span className="hrs-track"><i style={{ width: `${Math.min(100, d.avg)}%`, background: bandColor(d.avg) }}></i></span>
                  <span className="hrs-mono text-[12.5px] font-semibold text-right text-[var(--hrs-ink)]">{d.avg.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {selectedYear && (
        <div className="hrs-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--hrs-line)]">
            <h2 className="text-sm font-semibold text-[var(--hrs-ink)]">평가 대상자</h2>
            <span className="text-xs text-[var(--hrs-slate)]">{filteredEvaluatees.length}명 · 확정 {confirmedCount} · 대기 {filteredEvaluatees.length - confirmedCount}</span>
          </div>
          <div className="grid grid-cols-12 bg-[var(--hrs-bg)] text-[var(--hrs-slate)] text-[12px] font-semibold uppercase tracking-[0.03em] px-4 py-3 border-b border-[var(--hrs-line)] sticky top-0">
            <div className="col-span-2">이름</div>
            <div className="col-span-1">직급</div>
            <div className="col-span-1">부서</div>
            <div className="col-span-1 text-center">연차</div>
            <div className="col-span-1 text-center">원점수</div>
            <div className="col-span-1 text-center">근태</div>
            <div className="col-span-1 text-center">업무일지</div>
            <div className="col-span-1 text-center">최종</div>
            <div className="col-span-1">분포</div>
            <div className="col-span-1 text-center">상태</div>
            <div className="col-span-1 text-right">상세</div>
          </div>

          <div className="flex-1 overflow-y-auto text-sm">
            {filteredEvaluatees.length === 0 ? (
               <div className="p-10 text-center text-[var(--hrs-slate)]">진행된 평가 내역이 없습니다.</div>
            ) : (
              filteredEvaluatees.map(ev => {
                const rawAvg = ev.totalCompleted > 0 ? (ev.rawScoreSum / ev.totalCompleted).toFixed(1) : '-';
                const periodic = userPeriodic[ev.evaluateeId] || {};
                const fin = displayFinal(ev);

                return (
                  <div key={ev.evaluateeId} className="grid grid-cols-12 px-4 py-3 border-b border-[var(--hrs-line-soft)] last:border-0 items-center hover:bg-[var(--hrs-bg)] transition-colors">
                    <div className="col-span-2 font-semibold text-[var(--hrs-ink)] truncate pr-2">
                      {usersMap[ev.evaluateeId] || ev.evaluateeId}
                    </div>
                    <div className="col-span-1 text-xs text-[var(--hrs-slate)] truncate pr-1">{userPositions[ev.evaluateeId] || '-'}</div>
                    <div className="col-span-1 text-xs text-[var(--hrs-slate)] truncate pr-1">{userDepartments[ev.evaluateeId] || '-'}</div>
                    <div className="col-span-1 hrs-mono text-xs text-center text-[var(--hrs-slate)]">{fmtService(ev.evaluateeId)}</div>
                    <div className="col-span-1 hrs-mono text-xs text-center text-[var(--hrs-slate)]">{rawAvg}</div>
                    <div className="col-span-1 hrs-mono text-xs text-center text-[var(--hrs-ink)]">
                      {periodic.attendanceScore != null ? periodic.attendanceScore : <span className="text-[var(--hrs-slate)] opacity-60">–</span>}
                    </div>
                    <div className="col-span-1 hrs-mono text-xs text-center text-[var(--hrs-ink)]">
                      {periodic.workLogScore != null ? periodic.workLogScore : <span className="text-[var(--hrs-slate)] opacity-60">–</span>}
                    </div>
                    <div className="col-span-1 text-center hrs-mono text-[15px] font-bold text-[var(--hrs-ink)]">{fin}</div>
                    <div className="col-span-1 pr-2">
                      <span className="hrs-track"><i style={{ width: `${Math.min(100, fin)}%`, background: bandColor(fin) }}></i></span>
                    </div>
                    <div className="col-span-1 text-center">
                      {ev.finalState ? (
                        <span className="hrs-chip hrs-chip-good">확정</span>
                      ) : (
                        <span className="hrs-chip hrs-chip-wait">대기</span>
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        className="text-[13px] font-semibold text-[var(--hrs-accent)] hover:underline"
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
        <DialogContent className="sm:max-w-[50vw] max-w-[50vw] w-[50vw] max-h-[95vh] overflow-y-auto border-[var(--hrs-line)] rounded-md bg-[var(--hrs-surface)] p-0">
          <DialogHeader className="p-8 border-b border-[var(--hrs-line)] bg-[var(--hrs-bg)]">
            <DialogTitle className="text-3xl font-normal leading-none text-[var(--hrs-ink)]">
              최종 점수 확정
              <span className="block mt-2 font-sans font-bold text-lg text-[var(--hrs-slate)] tracking-tight">
                {usersMap[selectedEvaluatee?.evaluateeId]} {userPositions[selectedEvaluatee?.evaluateeId] ? `(${userPositions[selectedEvaluatee?.evaluateeId]})` : ''}{selectedEvaluatee && (userYears[selectedEvaluatee.evaluateeId] != null || userMonths[selectedEvaluatee.evaluateeId] != null) ? ` · ${fmtService(selectedEvaluatee.evaluateeId)}` : ''}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-8 pb-12">
            <h4 className="text-[12px] tracking-normal text-[var(--hrs-slate)] border-b border-[var(--hrs-line-soft)] pb-2">평가 내역 상세</h4>
            
            <div className="border border-[var(--hrs-line)] flex flex-col">
              <div className="grid grid-cols-12 bg-[var(--hrs-bg)] text-[var(--hrs-slate)] border-b border-[var(--hrs-line)] font-semibold text-[12px] uppercase tracking-[0.04em] p-3 sticky top-0">
                <div className="col-span-2">평가자</div>
                <div className="col-span-1">직급</div>
                <div className="col-span-2">부서</div>
                <div className="col-span-1 text-center">연차</div>
                <div className="col-span-3">대상 그룹</div>
                <div className="col-span-1 text-center">점수</div>
                <div className="col-span-2 text-right">상태</div>
              </div>
              <div className="max-h-[320px] overflow-y-auto text-sm bg-white">
                {[...(selectedEvaluatee?.assignments ?? [])].sort((a: any, b: any) => {
                  const order = (g: string) => { const n = groupsMap[g] || ''; return n.includes('자기') ? 0 : n.includes('하향') ? 1 : n.includes('상향') ? 2 : 3; };
                  return order(a.groupId) - order(b.groupId) || (groupsMap[a.groupId] || '').localeCompare(groupsMap[b.groupId] || '');
                }).map((assn: any) => (
                  <div key={assn.id} className="p-3 border-b border-[var(--hrs-line-soft)] hover:bg-[var(--hrs-bg)] transition-colors">
                    <div className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-2 font-bold truncate pr-1" title={usersMap[assn.evaluatorId] || assn.evaluatorId}>{usersMap[assn.evaluatorId] || assn.evaluatorId}</div>
                      <div className="col-span-1 text-xs text-[var(--hrs-slate)] truncate pr-1" title={userPositions[assn.evaluatorId]}>{userPositions[assn.evaluatorId] || '-'}</div>
                      <div className="col-span-2 text-xs uppercase text-[var(--hrs-slate)] truncate pr-1" title={userDepartments[assn.evaluatorId]}>{userDepartments[assn.evaluatorId] || '-'}</div>
                      <div className="col-span-1 text-xs text-center text-[var(--hrs-slate)]">{fmtService(assn.evaluatorId)}</div>
                      <div className="col-span-3 text-xs font-sans uppercase text-[var(--hrs-slate)] tracking-wider truncate pr-1">{groupsMap[assn.groupId]}</div>
                      <div className="col-span-1 text-center font-bold text-lg">{assn.status === 'completed' ? assn.totalScore : '-'}</div>
                      <div className="col-span-2 text-right">
                         <span className={`hrs-chip ${assn.status === 'completed' ? 'hrs-chip-good' : 'hrs-chip-wait'}`}>{assn.status === 'completed' ? '완료' : '대기'}</span>
                      </div>
                    </div>
                    {(assn.comment || (assn.scores && Object.keys(assn.scores).length > 0)) && (
                      <div className="mt-4 p-4 bg-[var(--hrs-line-soft)] text-xs text-[var(--hrs-slate)] rounded whitespace-pre-wrap leading-relaxed">
                        {assn.scores && Object.keys(assn.scores).length > 0 && (
                          <div className="mb-4 space-y-2">
                             <span className="font-bold text-[var(--hrs-ink)] block mb-2 text-[12px] tracking-normal border-b border-[var(--hrs-line)] pb-1">점수 평가 내역</span>
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
                            <span className="font-bold text-[var(--hrs-ink)] block mb-2 text-[12px] tracking-normal border-b border-[var(--hrs-line)] pb-1">정성 평가 의견</span>
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
                <h4 className="text-[12px] tracking-normal text-[var(--hrs-slate)] border-b border-[var(--hrs-line-soft)] pb-2 mb-3">가중평균 산출 내역</h4>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-[12px] tracking-normal text-[var(--hrs-slate)] mb-1">원점수 평균</p>
                    <p className="text-lg font-bold">{rawAvgOf(selectedEvaluatee).toFixed(1)}</p>
                    <p className="text-[12px] text-[var(--hrs-slate)]">×{weights.eval}%</p>
                  </div>
                  <div>
                    <p className="text-[12px] tracking-normal text-[var(--hrs-slate)] mb-1">근태</p>
                    <p className="text-lg font-bold">{userPeriodic[selectedEvaluatee.evaluateeId]?.attendanceScore ?? <span className="text-[var(--hrs-slate)] text-sm">미입력(0)</span>}</p>
                    <p className="text-[12px] text-[var(--hrs-slate)]">×{weights.attendance}%</p>
                  </div>
                  <div>
                    <p className="text-[12px] tracking-normal text-[var(--hrs-slate)] mb-1">업무일지</p>
                    <p className="text-lg font-bold">{userPeriodic[selectedEvaluatee.evaluateeId]?.workLogScore ?? <span className="text-[var(--hrs-slate)] text-sm">미입력(0)</span>}</p>
                    <p className="text-[12px] text-[var(--hrs-slate)]">×{weights.workLog}%</p>
                  </div>
                  <div className="border-l border-[var(--hrs-line)]">
                    <p className="text-[12px] tracking-normal text-[var(--hrs-slate)] mb-1">가중평균 제안</p>
                    <p className="text-lg font-bold text-emerald-700">{weightedScoreOf(selectedEvaluatee)}</p>
                  </div>
                </div>
              </div>
            )}

            {canConfirmForDept(userDepartments[selectedEvaluatee?.evaluateeId] || '') && (
              <div className="bg-[var(--hrs-accent)] p-6 space-y-4 text-white">
                <Label className="text-[12px] tracking-normal text-white/70 block mb-2">최종 확정 점수</Label>
                <div className="flex gap-4">
                  <Input 
                    type="number" 
                    step="0.1" 
                    className="w-1/3 text-2xl bg-transparent border-b border-white/20 border-t-0 border-l-0 border-r-0 rounded-md focus-visible:ring-0 focus-visible:border-white text-center" 
                    value={finalScoreInput}
                    onChange={e => setFinalScoreInput(e.target.value)} 
                  />
                  <button 
                    className="flex-1 bg-white text-[var(--hrs-ink)] text-[12px] tracking-normal hover:bg-[var(--hrs-line)] transition-colors" 
                    onClick={confirmScore}
                  >
                    최종 점수 확정 및 저장
                  </button>
                </div>
                <p className="text-[12px] tracking-normal text-[var(--hrs-slate)] ">원점수 평균을 바탕으로 HR 담당자 및 관리자가 최종 점수를 조정하여 확정할 수 있습니다.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
