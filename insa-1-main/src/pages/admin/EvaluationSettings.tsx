import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export default function EvaluationSettings() {
  const [scale, setScale] = useState<string>("5");
  const [activeYear, setActiveYear] = useState<string>("");
  
  const [years, setYears] = useState<any[]>([]);
  const [newYear, setNewYear] = useState('');
  
  const [groups, setGroups] = useState<any[]>([]);
  const [newGroupName, setNewGroupName] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{type: 'year' | 'group', id: string, name: string} | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchYears();
    fetchGroups();
  }, []);

  const fetchSettings = async () => {
    const docSnap = await getDoc(doc(db, 'settings', 'global'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      setScale(data.scoringScale?.toString() || "5");
      setActiveYear(data.activeYear || "");
    }
  };

  const fetchYears = async () => {
    const snap = await getDocs(collection(db, 'years'));
    setYears(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchGroups = async () => {
    const snap = await getDocs(collection(db, 'groups'));
    const fetchedGroups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setGroups(fetchedGroups);
  };

  const saveSettings = async () => {
    await setDoc(doc(db, 'settings', 'global'), {
      scoringScale: parseInt(scale),
      activeYear
    }, { merge: true });
    alert('Global settings saved!');
  };

  const addYear = async () => {
    if (!newYear) return;
    await setDoc(doc(db, 'years', newYear), { year: newYear, status: 'active' });
    setNewYear('');
    fetchYears();
  };

  const addGroup = async () => {
    if (!newGroupName) return;
    const id = newGroupName.toLowerCase().replace(/\s+/g, '-');
    await setDoc(doc(db, 'groups', id), { name: newGroupName });
    setNewGroupName('');
    fetchGroups();
  };

  const deleteGroup = async (id: string) => {
    await deleteDoc(doc(db, 'groups', id));
    fetchGroups();
  };

  const deleteYear = async (id: string) => {
    await deleteDoc(doc(db, 'years', id));
    fetchYears();
  };

  const handleDeleteConfirm = () => {
    if (!confirmData) return;
    if (confirmData.type === 'year') {
      deleteYear(confirmData.id);
    } else {
      deleteGroup(confirmData.id);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[#1A1A1A] pb-6">
        <div>
          <h2 className="text-5xl tracking-tighter">평가 환경 설정</h2>
          <p className="mt-2 text-sm text-[#555] uppercase tracking-[0.2em] text-[10px]">평가 점수 척도 및 전체 활성 평가 연도 관리</p>
        </div>
      </header>

      {/* Global Config */}
      <section className="bg-[#F9F9F9] border border-[#E5E5E5] p-6 mb-10 space-y-6">
        <h3 className="text-2xl tracking-tighter border-b border-[#EEE] pb-4">글로벌 시스템 설정 (Global Configuration)</h3>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-[#999]">현재 활성화된 항목 연도</Label>
            <Select value={activeYear} onValueChange={(v) => setActiveYear(v ?? '')}>
              <SelectTrigger className="border-b border-[#1A1A1A] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent px-0">
                <SelectValue placeholder="연도 선택" />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y.id} value={y.id}>{y.year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-[#999]">점수 평가 척도</Label>
            <Select value={scale} onValueChange={(v) => setScale(v ?? '')}>
              <SelectTrigger className="border-b border-[#1A1A1A] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent px-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5점 척도</SelectItem>
                <SelectItem value="7">7점 척도</SelectItem>
                <SelectItem value="10">10점 척도</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="pt-4 flex justify-end">
          <button onClick={saveSettings} className="px-5 py-2 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest hover:bg-[#333] transition-colors">
            설정 저장
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-12">
        {/* Years Management */}
        <section className="space-y-6">
          <h3 className="text-2xl tracking-tighter border-b border-[#1A1A1A] pb-2">평가 연도 관리</h3>
          <div className="flex gap-4">
            <Input 
              placeholder="예: 2026" 
              value={newYear} 
              onChange={e => setNewYear(e.target.value)} 
              className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A]  text-lg"
            />
            <button onClick={addYear} className="px-5 py-2 border border-[#1A1A1A] text-[11px] uppercase tracking-widest hover:bg-[#1A1A1A] hover:text-white transition-colors">
              추가
            </button>
          </div>
          <div className="border border-[#1A1A1A] flex flex-col">
            {years.map(y => (
              <div key={y.id} className="flex justify-between items-center p-4 border-b border-[#EEE] hover:bg-[#F9F9F9] transition-colors">
                <span className="text-lg">{y.year}</span>
                <button 
                  onClick={() => { setConfirmData({ type: 'year', id: y.id, name: y.year }); setConfirmOpen(true); }}
                  className="text-[10px] uppercase tracking-widest text-[#777] hover:text-red-700 underline underline-offset-4"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Groups Management */}
        <section className="space-y-6">
          <h3 className="text-2xl tracking-tighter border-b border-[#1A1A1A] pb-2">평가 그룹 관리</h3>
          <div className="flex gap-4">
            <Input 
              placeholder="새 그룹 이름" 
              value={newGroupName} 
              onChange={e => setNewGroupName(e.target.value)} 
              className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A]  text-lg"
            />
            <button onClick={addGroup} className="px-5 py-2 border border-[#1A1A1A] text-[11px] uppercase tracking-widest hover:bg-[#1A1A1A] hover:text-white transition-colors">
              추가
            </button>
          </div>
          <div className="border border-[#1A1A1A] flex flex-col">
            {groups.map(g => (
              <div key={g.id} className="flex justify-between items-center p-4 border-b border-[#EEE] hover:bg-[#F9F9F9] transition-colors">
                <span className="font-bold">{g.name}</span>
                <button 
                  onClick={() => { setConfirmData({ type: 'group', id: g.id, name: g.name }); setConfirmOpen(true); }}
                  className="text-[10px] uppercase tracking-widest text-[#777] hover:text-red-700 underline underline-offset-4"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <ConfirmDialog 
        open={confirmOpen} 
        onOpenChange={setConfirmOpen}
        title={confirmData?.type === 'year' ? "평가 연도 삭제" : "평가 그룹 삭제"}
        description={`정말로 [${confirmData?.name || ''}] ${confirmData?.type === 'year' ? '연도' : '그룹'}를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
