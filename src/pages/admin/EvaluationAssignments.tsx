import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Label } from '../../components/ui/label';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export default function EvaluationAssignments() {
  const [years, setYears] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [selectedYear, setSelectedYear] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);

  // Form states
  const [evaluatorId, setEvaluatorId] = useState('');
  const [evaluateeId, setEvaluateeId] = useState('');
  const [groupId, setGroupId] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{id: string, evor: string, evee: string} | null>(null);

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
    const q = query(collection(db, 'assignments'), where('year', '==', selectedYear));
    const snap = await getDocs(q);
    setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const addAssignment = async () => {
    if (!selectedYear || !evaluatorId || !evaluateeId || !groupId) return;
    const id = uuidv4();
    await setDoc(doc(db, 'assignments', id), {
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
    await deleteDoc(doc(db, 'assignments', id));
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
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      // Expected columns: 평가자 이름 (or Email), 피평가자 이름, 그룹명
      for (const row of data) {
        const evorQuery = String(row['평가자 이름'] || row['Evaluator Email'] || row['Evaluator Name'] || '').trim();
        const eveeQuery = String(row['피평가자 이름'] || row['Evaluatee Email'] || row['Evaluatee Name'] || '').trim();
        const gName = String(row['그룹명'] || row['Group'] || '').trim();
        
        const matchedGroup = groups.find(g => g.name.toLowerCase() === gName.toLowerCase());
        
        // Match user by name or email
        const validEvor = users.find(u => (u.name || '').trim() === evorQuery || (u.email || '').toLowerCase() === evorQuery.toLowerCase());
        const validEvee = users.find(u => (u.name || '').trim() === eveeQuery || (u.email || '').toLowerCase() === eveeQuery.toLowerCase());

        if (validEvor && validEvee && matchedGroup) {
          const id = uuidv4();
          await setDoc(doc(db, 'assignments', id), {
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
      // Reset file input
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    // Generate template
    const ws = XLSX.utils.json_to_sheet([{
      '평가자 이름': '홍길동',
      '피평가자 이름': '김철수',
      '그룹명': '그룹명입력'
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assignments");
    XLSX.writeFile(wb, "Assignment_Template.xlsx");
  };

  const getUserName = (email: string) => {
    if (!email) return '';
    const matchedUser = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
    if (matchedUser) {
      const positionStr = matchedUser.position ? ` ${matchedUser.position}` : '';
      return `${matchedUser.name}${positionStr}`;
    }
    return email;
  };

  const getGroupName = (id: string) => groups.find(g => g.id === id)?.name || id;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[#1A1A1A] pb-6">
        <div>
          <h2 className="text-5xl tracking-tighter">평가자 배정</h2>
          <p className="mt-2 text-sm text-[#555] uppercase tracking-[0.2em] text-[10px]">평가 주기별 평가자 및 대상자 매핑 (Excel 다운로드/업로드 지원)</p>
        </div>
      </header>

      <section className="bg-[#F9F9F9] border border-[#E5E5E5] p-6 mb-10 space-y-6">
        <div className="flex gap-8 items-end w-full">
          <div className="space-y-2 flex-1">
            <Label className="text-[10px] uppercase tracking-widest text-[#999]">평가 연도 주기</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="border-b border-[#1A1A1A] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent px-0"><SelectValue placeholder="연도 선택" /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y.id} value={y.id}>{y.year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedYear && (
            <div className="flex-1 flex gap-4 justify-end items-center">
              <button 
                onClick={downloadTemplate}
                className="px-5 py-2 border border-[#1A1A1A] text-[11px] uppercase tracking-widest hover:bg-[#1A1A1A] hover:text-white transition-colors"
              >
                매핑 양식 다운로드
              </button>
              <div className="relative">
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <button className="px-5 py-2 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest hover:bg-[#333] transition-colors pointer-events-none">
                  일괄 엑셀 업로드
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedYear && (
        <>
          <div className="grid grid-cols-4 gap-6 items-end pb-8 border-b border-[#EEE]">
            <div className="space-y-2 col-span-1">
              <Label className="text-[10px] uppercase tracking-widest text-[#999]">평가자</Label>
              <Select value={evaluatorId} onValueChange={setEvaluatorId}>
                <SelectTrigger className="border-b border-[#1A1A1A] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent px-0"><SelectValue placeholder="사용자 선택" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.email} value={u.email}>{u.name || u.email} {u.position ? `(${u.position})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-1">
              <Label className="text-[10px] uppercase tracking-widest text-[#999]">피평가자 (대상자)</Label>
              <Select value={evaluateeId} onValueChange={setEvaluateeId}>
                <SelectTrigger className="border-b border-[#1A1A1A] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent px-0"><SelectValue placeholder="사용자 선택" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.email} value={u.email}>{u.name || u.email} {u.position ? `(${u.position})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-1">
              <Label className="text-[10px] uppercase tracking-widest text-[#999]">그룹 지정</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="border-b border-[#1A1A1A] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent px-0"><SelectValue placeholder="그룹 선택" /></SelectTrigger>
                <SelectContent>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 flex justify-end">
              <button onClick={addAssignment} className="px-5 py-2 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest hover:bg-[#333] transition-colors h-fit">
                평가 배정
              </button>
            </div>
          </div>

          <div className="flex-1 border border-[#1A1A1A] overflow-hidden flex flex-col mt-8">
            <div className="grid grid-cols-12 bg-[#1A1A1A] text-white text-[10px] uppercase tracking-[0.15em] p-4 sticky top-0">
              <div className="col-span-1">평가자</div>
              <div className="col-span-1">직급</div>
              <div className="col-span-2">부서</div>
              <div className="col-span-1">대상자</div>
              <div className="col-span-1">직급</div>
              <div className="col-span-2">부서</div>
              <div className="col-span-2">대상 그룹</div>
              <div className="col-span-1">상태</div>
              <div className="col-span-1 text-right">작업</div>
            </div>
            <div className="flex-1 overflow-y-auto  text-sm">
              {assignments.length === 0 ? (
                <div className="p-8 text-center text-[#777] font-sans">배정된 내역이 없습니다.</div>
              ) : (
                assignments.map((assignment) => {
                  const evorUser = users.find(u => (u.email || '').toLowerCase() === (assignment.evaluatorId || '').toLowerCase()) || { name: assignment.evaluatorId, position: '', department: '' };
                  const eveeUser = users.find(u => (u.email || '').toLowerCase() === (assignment.evaluateeId || '').toLowerCase()) || { name: assignment.evaluateeId, position: '', department: '' };
                  return (
                    <div key={assignment.id} className="grid grid-cols-12 p-4 border-b border-[#EEE] items-center hover:bg-[#F9F9F9] transition-colors gap-2">
                      <div className="col-span-1 font-bold truncate pr-1" title={evorUser.name}>{evorUser.name}</div>
                      <div className="col-span-1 text-xs text-[#555] truncate pr-1" title={evorUser.position}>{evorUser.position || '-'}</div>
                      <div className="col-span-2 text-xs uppercase text-[#777] truncate pr-1" title={evorUser.department}>{evorUser.department || '-'}</div>

                      <div className="col-span-1 font-bold truncate pr-1" title={eveeUser.name}>{eveeUser.name}</div>
                      <div className="col-span-1 text-xs text-[#555] truncate pr-1" title={eveeUser.position}>{eveeUser.position || '-'}</div>
                      <div className="col-span-2 text-xs uppercase text-[#777] truncate pr-1" title={eveeUser.department}>{eveeUser.department || '-'}</div>

                      <div className="col-span-2 font-sans text-xs uppercase text-[#777] truncate pr-1" title={getGroupName(assignment.groupId)}>{getGroupName(assignment.groupId)}</div>
                      <div className="col-span-1">
                        <span className={`text-[9px] uppercase tracking-widest px-2 py-1 ${assignment.status === 'completed' ? 'bg-[#1A1A1A] text-white' : 'bg-[#E5E5E5] text-[#1A1A1A]'}`}>{assignment.status === 'completed' ? '완료' : '대기'}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <button 
                          className="text-[10px] uppercase tracking-widest text-[#777] hover:text-red-700 underline underline-offset-4"
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
