import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Label } from '../../components/ui/label';
import { v4 as uuidv4 } from 'uuid';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export default function ExecutiveEvaluationItems() {
  const [years, setYears] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  
  const [exec_items, setItems] = useState<any[]>([]);
  const [newItemQuestion, setNewItemQuestion] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{id: string, question: string} | null>(null);

  useEffect(() => {
    fetchYearsAndGroups();
  }, []);

  useEffect(() => {
    if (selectedYear && selectedGroup) {
      fetchItems();
    } else {
      setItems([]);
    }
  }, [selectedYear, selectedGroup]);

  const fetchYearsAndGroups = async () => {
    const [yearsSnap, groupsSnap] = await Promise.all([
      getDocs(collection(db, 'years')),
      getDocs(collection(db, 'groups'))
    ]);
    setYears(yearsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setGroups(groupsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchItems = async () => {
    try {
      const q = query(
        collection(db, 'exec_items'),
        where('year', '==', selectedYear),
        where('groupId', '==', selectedGroup)
      );
      const snap = await getDocs(q);
      const fetchedItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by order roughly
      fetchedItems.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setItems(fetchedItems);
    } catch (e: any) {
      alert("Error fetching items: " + e.message);
    }
  };

  const addItem = async () => {
    if (!newItemQuestion || !selectedYear || !selectedGroup) return;
    const id = uuidv4();
    const order = exec_items.length;
    try {
      await setDoc(doc(db, 'exec_items', id), {
        year: selectedYear,
        groupId: selectedGroup,
        question: newItemQuestion,
        order
      });
      setNewItemQuestion('');
      fetchItems();
    } catch (e: any) {
      alert("Error adding item: " + e.message);
    }
  };

  const deleteItem = async (id: string) => {
    await deleteDoc(doc(db, 'exec_items', id));
    fetchItems();
  };

  const handleDeleteConfirm = () => {
    if (confirmData) {
      deleteItem(confirmData.id);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[#1A1A1A] pb-6">
        <div>
          <h2 className="text-5xl tracking-tighter">임원평가 항목 관리</h2>
          <p className="mt-2 text-sm text-[#555] uppercase tracking-[0.2em] text-[10px]">연도 및 평가 그룹별 문항을 자유롭게 생성하고 삭제합니다.</p>
        </div>
      </header>

      <section className="bg-[#F9F9F9] border border-[#E5E5E5] p-6 mb-10 flex gap-8 items-end">
        <div className="space-y-2 flex-1">
          <Label className="text-[10px] uppercase tracking-widest text-[#999]">평가 연도 주기</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="border-b border-[#1A1A1A] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent px-0"><SelectValue placeholder="연도 선택" /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y.id} value={y.id}>{y.year}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 flex-1">
          <Label className="text-[10px] uppercase tracking-widest text-[#999]">평가 그룹 (대상 형태)</Label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="border-b border-[#1A1A1A] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent px-0"><SelectValue placeholder="그룹 선택" /></SelectTrigger>
            <SelectContent>
              {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </section>

      {selectedYear && selectedGroup && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <Input 
              placeholder="새로운 평가 문항을 입력하세요..." 
              value={newItemQuestion} 
              onChange={e => setNewItemQuestion(e.target.value)} 
              className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A]  text-sm"
            />
            <Button onClick={addItem} className="uppercase tracking-widest text-xs px-6 py-2 rounded-none bg-[#1A1A1A] text-white">항목 추가</Button>
          </div>

          <div className="flex-1 border border-[#1A1A1A] overflow-hidden flex flex-col">
            <div className="grid grid-cols-12 bg-[#1A1A1A] text-white text-[10px] uppercase tracking-[0.15em] p-4 sticky top-0">
              <div className="col-span-1">번호</div>
              <div className="col-span-9">평가 항목 내용</div>
              <div className="col-span-2 text-right">작업</div>
            </div>
            
            <div className="flex-1 overflow-y-auto  text-sm">
              {exec_items.length === 0 ? (
                <div className="p-8 text-center text-[#777] font-sans">선택한 연도 및 그룹에 등록된 평가 항목이 없습니다.</div>
              ) : (
                exec_items.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 p-4 border-b border-[#EEE] items-center hover:bg-[#F9F9F9] transition-colors">
                    <div className="col-span-1 text-[10px] uppercase tracking-widest text-[#999]">{String(index + 1).padStart(2, '0')}</div>
                    <div className="col-span-9 leading-relaxed">{item.question}</div>
                    <div className="col-span-2 text-right">
                      <button 
                        className="text-[10px] uppercase tracking-widest text-[#777] hover:text-red-700 underline underline-offset-4"
                        onClick={() => { setConfirmData({ id: item.id, question: item.question }); setConfirmOpen(true); }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog 
        open={confirmOpen} 
        onOpenChange={setConfirmOpen}
        title="평가 항목 삭제"
        description={`정말로 해당 평가 항목을 삭제하시겠습니까? 이 작업은 방금 선택하신 질문 '${confirmData?.question.substring(0, 20)}...'과 연결된 배정도 영향을 받을 수 있습니다.`}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
