import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Label } from '../../components/ui/label';
import { v4 as uuidv4 } from 'uuid';
import { readExcelRows, downloadExcelFile, validateExcelFile } from '../../lib/excel';
import { logger } from '../../lib/logger';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SortHeader, type SortDir } from '../../components/SortHeader';

export default function ExecutiveAssignments() {
  const [years, setYears] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [selectedYear, setSelectedYear] = useState('');
  const [exec_assignments, setAssignments] = useState<any[]>([]);

  // Form states
  const [evaluatorId, setEvaluatorId] = useState('');
  const [evaluateeId, setEvaluateeId] = useState('');
  const [groupId, setGroupId] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{id: string, evor: string, evee: string} | null>(null);

  // 정렬 상태 (컬럼 헤더 클릭)
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  useEffect(() => {
    fetchCoreData();
  }, []);

  useEffect(() => {
    if (selectedYear) fetchAssignments();
  }, [selectedYear]);

  const fetchCoreData = async () => {
    const [yearsSnap, groupsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'years')),
      getDocs(collection(db, 'groups')),
      getDocs(collection(db, 'users'))
    ]);
    setYears(yearsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setGroups(groupsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchAssignments = async () => {
    const q = query(collection(db, 'exec_assignments'), where('year', '==', selectedYear));
    const snap = await getDocs(q);
    setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const addAssignment = async () => {
    if (!selectedYear || !evaluatorId || !evaluateeId || !groupId) return;
    const id = uuidv4();
    await setDoc(doc(db, 'exec_assignments', id), {
      year: selectedYear,
      evaluatorId,
      evaluateeId,
      groupId,
      status: 'pending'
    });
    setEvaluatorId('');
    setEvaluateeId('');
    setGroupId('');
    fetchAssignments();
  };

  const deleteAssignment = async (id: string) => {
    await deleteDoc(doc(db, 'exec_assignments', id));
    fetchAssignments();
  };

  const handleDeleteConfirm = () => {
    if (confirmData) {
      deleteAssignment(confirmData.id);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedYear) return alert('연도를 먼저 선택한 후 파일을 업로드해 주세요.');

    const validationError = validateExcelFile(file);
    if (validationError) { alert(validationError); e.target.value = ''; return; }

    try {
      const data = await readExcelRows(file);
      for (const row of data) {
        const evorQuery = String(row['평가자 이름'] || row['Evaluator Email'] || row['Evaluator Name'] || '').trim();
        const eveeQuery = String(row['피평가자 이름'] || row['Evaluatee Email'] || row['Evaluatee Name'] || '').trim();
        const gName = String(row['그룹명'] || row['Group'] || '').trim();

        const matchedGroup = groups.find(g => g.name.toLowerCase() === gName.toLowerCase());
        const validEvor = users.find(u => (u.name || '').trim() === evorQuery || (u.email || '').toLowerCase() === evorQuery.toLowerCase());
        const validEvee = users.find(u => (u.name || '').trim() === eveeQuery || (u.email || '').toLowerCase() === eveeQuery.toLowerCase());

        if (validEvor && validEvee && matchedGroup) {
          const id = uuidv4();
          await setDoc(doc(db, 'exec_assignments', id), {
            year: selectedYear,
            evaluatorId: validEvor.email,
            evaluateeId: validEvee.email,
            groupId: matchedGroup.id,
            status: 'pending'
          });
        }
      }
      fetchAssignments();
      alert('업로드가 처리되었습니다.');
    } catch (err) {
      logger.error(err);
      alert('파일 처리 중 오류가 발생했습니다.');
    }
    e.target.value = '';
  };

  const downloadTemplate = async () => {
    await downloadExcelFile([{
      '평가자 이름': '홍길동',
      '피평가자 이름': '김철수',
      '그룹명': '그룹명입력'
    }], "Assignments", "Assignment_Template.xlsx");
  };

  const getUserName = (email: string) => {
    if (!email) return '';
    const matchedUser = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
    if (matchedUser) {
      const positionStr = matchedUser.position ? ` ${matchedUser.position}` : '';
      const name = matchedUser.name?.includes('@') ? matchedUser.name.split('@')[0] : matchedUser.name;
      return `${name}${positionStr}`;
    }
    return email.includes('@') ? email.split('@')[0] : email;
  };

  const getGroupName = (id: string) => groups.find(g => g.id === id)?.name || id;

  // 정렬에 쓸 값을 미리 계산 (평가자/대상자의 이름·직급·부서, 대상 그룹)
  const rows = useMemo(() => exec_assignments.map((assignment) => {
    const evorUser = users.find(u => (u.email || '').toLowerCase() === (assignment.evaluatorId || '').toLowerCase()) || { name: assignment.evaluatorId, position: '', department: '' };
    const eveeUser = users.find(u => (u.email || '').toLowerCase() === (assignment.evaluateeId || '').toLowerCase()) || { name: assignment.evaluateeId, position: '', department: '' };
    const evorName = evorUser.name?.includes('@') ? evorUser.name.split('@')[0] : (evorUser.name || '알 수 없음');
    const eveeName = eveeUser.name?.includes('@') ? eveeUser.name.split('@')[0] : (eveeUser.name || '알 수 없음');
    return {
      assignment,
      evorName,
      evorPosition: evorUser.position || '',
      evorDepartment: evorUser.department || '',
      eveeName,
      eveePosition: eveeUser.position || '',
      eveeDepartment: eveeUser.department || '',
      groupName: getGroupName(assignment.groupId),
      statusLabel: assignment.status === 'completed' ? '완료' : '대기',
    };
  }), [exec_assignments, users, groups]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) =>
      dir * String((a as any)[sortKey] ?? '').localeCompare(String((b as any)[sortKey] ?? ''), 'ko', { numeric: true })
    );
  }, [rows, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[var(--hrs-line)] pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">임원평가 배정</h2>
          <p className="mt-2 text-sm text-[var(--hrs-slate)] tracking-normal text-[12px]">평가 주기별 평가자 및 대상자 매핑 (Excel 다운로드/업로드 지원)</p>
        </div>
      </header>

      <section className="bg-[var(--hrs-bg)] border border-[var(--hrs-line)] p-6 mb-10 space-y-6">
        <div className="flex gap-8 items-end w-full">
          <div className="space-y-2 flex-1">
            <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">평가 연도 주기</Label>
            <Select value={selectedYear} onValueChange={(v) => setSelectedYear(v ?? '')}>
              <SelectTrigger className="border border-[var(--hrs-line)] rounded-md bg-white px-3"><SelectValue placeholder="연도 선택" /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y.id} value={y.id}>{y.year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedYear && (
            <div className="flex-1 flex gap-4 justify-end items-center">
              <button 
                onClick={downloadTemplate}
                className="px-5 py-2 border border-[var(--hrs-line)] text-[12px] tracking-normal hover:bg-[var(--hrs-accent)] hover:text-white transition-colors"
              >
                매핑 양식 다운로드
              </button>
              <div className="relative">
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <button className="px-5 py-2 bg-[var(--hrs-accent)] text-white text-[12px] tracking-normal hover:bg-[var(--hrs-ink)] transition-colors pointer-events-none">
                  일괄 엑셀 업로드
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedYear && (
        <>
          <div className="grid grid-cols-4 gap-6 items-end pb-8 border-b border-[var(--hrs-line-soft)]">
            <div className="space-y-2 col-span-1">
              <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">평가자</Label>
              <Select value={evaluatorId} onValueChange={(v) => setEvaluatorId(v ?? '')}>
                <SelectTrigger className="border border-[var(--hrs-line)] rounded-md bg-white px-3">
                  <SelectValue placeholder="사용자 선택">
                    {evaluatorId ? getUserName(evaluatorId).trim() : "사용자 선택"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => {
                    const displayName = u.name?.includes('@') ? u.name.split('@')[0] : (u.name || (u.email ? u.email.split('@')[0] : ''));
                    return <SelectItem key={u.email} value={u.email}>{displayName}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-1">
              <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">피평가자 (대상자)</Label>
              <Select value={evaluateeId} onValueChange={(v) => setEvaluateeId(v ?? '')}>
                <SelectTrigger className="border border-[var(--hrs-line)] rounded-md bg-white px-3">
                  <SelectValue placeholder="사용자 선택">
                    {evaluateeId ? getUserName(evaluateeId).trim() : "사용자 선택"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => {
                    const displayName = u.name?.includes('@') ? u.name.split('@')[0] : (u.name || (u.email ? u.email.split('@')[0] : ''));
                    return <SelectItem key={u.email} value={u.email}>{displayName}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-1">
              <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">그룹 지정</Label>
              <Select value={groupId} onValueChange={(v) => setGroupId(v ?? '')}>
                <SelectTrigger className="border border-[var(--hrs-line)] rounded-md bg-white px-3"><SelectValue placeholder="그룹 선택" /></SelectTrigger>
                <SelectContent>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 flex justify-end">
              <button onClick={addAssignment} className="px-5 py-2 bg-[var(--hrs-accent)] text-white text-[12px] tracking-normal hover:bg-[var(--hrs-ink)] transition-colors h-fit">
                평가 배정
              </button>
            </div>
          </div>

          <div className="flex-1 border border-[var(--hrs-line)] rounded-lg bg-[var(--hrs-surface)] shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden flex flex-col mt-8">
            <div className="grid grid-cols-12 bg-[var(--hrs-bg)] text-[var(--hrs-slate)] border-b border-[var(--hrs-line)] font-semibold text-[12px] uppercase tracking-[0.04em] p-4 sticky top-0">
              <div className="col-span-1"><SortHeader label="평가자" colKey="evorName" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
              <div className="col-span-1"><SortHeader label="직급" colKey="evorPosition" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
              <div className="col-span-2"><SortHeader label="부서" colKey="evorDepartment" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
              <div className="col-span-1"><SortHeader label="대상자" colKey="eveeName" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
              <div className="col-span-1"><SortHeader label="직급" colKey="eveePosition" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
              <div className="col-span-2"><SortHeader label="부서" colKey="eveeDepartment" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
              <div className="col-span-2"><SortHeader label="대상 그룹" colKey="groupName" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
              <div className="col-span-1"><SortHeader label="상태" colKey="statusLabel" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
              <div className="col-span-1 text-right">작업</div>
            </div>
            <div className="flex-1 overflow-y-auto  text-sm">
              {exec_assignments.length === 0 ? (
                <div className="p-8 text-center text-[var(--hrs-slate)] font-sans">배정된 내역이 없습니다.</div>
              ) : (
                sortedRows.map((row) => {
                  const { assignment, evorName, evorPosition, evorDepartment, eveeName, eveePosition, eveeDepartment, groupName } = row;

                  return (
                    <div key={assignment.id} className="grid grid-cols-12 p-4 border-b border-[var(--hrs-line-soft)] items-center hover:bg-[var(--hrs-bg)] transition-colors gap-2">
                      <div className="col-span-1 font-bold truncate pr-1" title={evorName}>{evorName}</div>
                      <div className="col-span-1 text-xs text-[var(--hrs-slate)] truncate pr-1" title={evorPosition}>{evorPosition || '-'}</div>
                      <div className="col-span-2 text-xs uppercase text-[var(--hrs-slate)] truncate pr-1" title={evorDepartment}>{evorDepartment || '-'}</div>

                      <div className="col-span-1 font-bold truncate pr-1" title={eveeName}>{eveeName}</div>
                      <div className="col-span-1 text-xs text-[var(--hrs-slate)] truncate pr-1" title={eveePosition}>{eveePosition || '-'}</div>
                      <div className="col-span-2 text-xs uppercase text-[var(--hrs-slate)] truncate pr-1" title={eveeDepartment}>{eveeDepartment || '-'}</div>

                      <div className="col-span-2 font-sans text-xs uppercase text-[var(--hrs-slate)] truncate pr-1" title={groupName}>{groupName}</div>
                      <div className="col-span-1">
                        <span className={`hrs-chip ${assignment.status === 'completed' ? 'hrs-chip-good' : 'hrs-chip-wait'}`}>{assignment.status === 'completed' ? '완료' : '대기'}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <button 
                          className="text-[12px] tracking-normal text-[var(--hrs-slate)] hover:text-red-700 underline underline-offset-4"
                          onClick={() => { setConfirmData({ id: assignment.id, evor: getUserName(assignment.evaluatorId), evee: getUserName(assignment.evaluateeId) }); setConfirmOpen(true); }}
                        >
                          배정 취소
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmDialog 
        open={confirmOpen} 
        onOpenChange={setConfirmOpen}
        title="평가 배정 취소"
        description={`정말로 평가 배정을 취소하시겠습니까? (평가자: ${confirmData?.evor} → 대상자: ${confirmData?.evee})`}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
