import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, query, where, documentId, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../contexts/AuthContext';
import { readExcelRows, downloadExcelFile, validateExcelFile } from '../../lib/excel';
import { logger } from '../../lib/logger';

type ScoreRow = { attendanceScore: string; workLogScore: string };

export default function PeriodicScores() {
  const { user } = useAuth();

  const [years, setYears] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreRow>>({});
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    if (selectedYear) fetchScores();
  }, [selectedYear, users]);

  const fetchBaseData = async () => {
    setLoading(true);
    try {
      const [yearsSnap, usersSnap, settingsSnap] = await Promise.all([
        getDocs(collection(db, 'years')),
        getDocs(collection(db, 'users')),
        getDoc(doc(db, 'settings', 'global')),
      ]);

      const yearList = yearsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setYears(yearList);

      const userList = usersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((u: any) => (u.status || 'active') === 'active')
        .sort((a: any, b: any) => (a.department || '').localeCompare(b.department || '', 'ko'));
      setUsers(userList);

      const deptSet = new Set<string>();
      userList.forEach((u: any) => { if (u.department) deptSet.add(u.department); });
      setDepartments(Array.from(deptSet).sort());

      const activeYear = settingsSnap.exists() ? settingsSnap.data().activeYear : '';
      if (activeYear && yearList.some((y: any) => y.id === activeYear)) {
        setSelectedYear(activeYear);
      } else if (yearList.length > 0) {
        setSelectedYear(yearList[0].id);
      }
    } catch (e) {
      logger.error('PeriodicScores fetchBaseData error', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchScores = async () => {
    try {
      const scoreMap: Record<string, ScoreRow> = {};
      const ids = users.map((u: any) => `${selectedYear}_${u.id}`);
      // documentId() in-query, 30개씩 배치
      for (let i = 0; i < ids.length; i += 30) {
        const batch = ids.slice(i, i + 30);
        if (batch.length === 0) continue;
        const q = query(collection(db, 'periodicScores'), where(documentId(), 'in', batch));
        const snap = await getDocs(q);
        snap.docs.forEach(d => {
          const data = d.data();
          scoreMap[data.userId] = {
            attendanceScore: data.attendanceScore != null ? String(data.attendanceScore) : '',
            workLogScore: data.workLogScore != null ? String(data.workLogScore) : '',
          };
        });
      }
      setScores(scoreMap);
    } catch (e) {
      logger.error('PeriodicScores fetchScores error', e);
    }
  };

  const setScore = (userId: string, field: keyof ScoreRow, value: string) => {
    setScores(prev => {
      const current = prev[userId] || { attendanceScore: '', workLogScore: '' };
      return { ...prev, [userId]: { ...current, [field]: value } };
    });
  };

  const validScore = (v: string): number | null | 'invalid' => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    if (!isFinite(n) || n < 0 || n > 100) return 'invalid';
    return n;
  };

  const handleSaveAll = async () => {
    if (!selectedYear) return;
    // 유효성 검증
    for (const u of users) {
      const row = scores[u.id];
      if (!row) continue;
      if (validScore(row.attendanceScore) === 'invalid' || validScore(row.workLogScore) === 'invalid') {
        alert(`[${u.name}]의 점수는 0~100 범위의 숫자여야 합니다.`);
        return;
      }
    }

    setSaving(true);
    try {
      let batch = writeBatch(db);
      let ops = 0;
      let saved = 0;
      for (const u of users) {
        const row = scores[u.id];
        if (!row) continue;
        const att = validScore(row.attendanceScore);
        const log = validScore(row.workLogScore);
        // 둘 다 비어있으면 저장 생략
        if (att === null && log === null) continue;

        const ref = doc(db, 'periodicScores', `${selectedYear}_${u.id}`);
        batch.set(ref, {
          year: selectedYear,
          userId: u.id,
          attendanceScore: att === null ? null : att,
          workLogScore: log === null ? null : log,
          updatedAt: serverTimestamp(),
          updatedBy: user?.email || '',
        }, { merge: true });
        ops++;
        saved++;
        if (ops >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }
      if (ops > 0) await batch.commit();
      alert(`저장 완료: ${saved}명의 점수가 저장되었습니다.`);
      fetchScores();
    } catch (e: any) {
      logger.error('PeriodicScores save error', e);
      alert('저장 중 오류가 발생했습니다. 권한이 부족하거나 오류가 발생했습니다: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = async () => {
    const rows = filteredUsers.map(u => ({
      '로그인 ID': u.email?.includes('@') ? u.email.split('@')[0] : u.email,
      '사용자 이름': u.name,
      '소속 부서': u.department || '',
      '근태점수': scores[u.id]?.attendanceScore ?? '',
      '업무일지 점수': scores[u.id]?.workLogScore ?? '',
    }));
    await downloadExcelFile(rows, 'PeriodicScores', `Periodic_Scores_${selectedYear || 'template'}.xlsx`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateExcelFile(file);
    if (err) { alert(err); e.target.value = ''; return; }

    try {
      const rows = await readExcelRows(file);
      const next = { ...scores };
      let matched = 0;
      for (const row of rows) {
        let email = String(row['로그인 ID'] || '').trim().toLowerCase();
        if (!email) continue;
        if (!email.includes('@')) email += '@han-guk.co.kr';
        const u = users.find((x: any) => x.id === email || x.email === email);
        if (!u) continue;
        const att = String(row['근태점수'] ?? '').trim();
        const log = String(row['업무일지 점수'] ?? '').trim();
        next[u.id] = {
          attendanceScore: att !== '' ? att : (next[u.id]?.attendanceScore ?? ''),
          workLogScore: log !== '' ? log : (next[u.id]?.workLogScore ?? ''),
        };
        matched++;
      }
      setScores(next);
      alert(`엑셀에서 ${matched}명의 점수를 불러왔습니다. 확인 후 '일괄 저장'을 눌러 저장하세요.`);
    } catch (err) {
      logger.error(err);
      alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
    }
    e.target.value = '';
  };

  const filteredUsers = users.filter((u: any) => {
    if (selectedDepartment !== 'all' && u.department !== selectedDepartment) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (u.name || '').toLowerCase().includes(q)
      || (u.email || '').toLowerCase().includes(q)
      || (u.department || '').toLowerCase().includes(q);
  });

  if (loading) return <div className="p-8 text-center text-[#777]">데이터를 불러오는 중입니다...</div>;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-8 border-b border-[#1A1A1A] pb-6">
        <div>
          <h2 className="text-5xl tracking-tighter">근태·업무일지 점수 관리</h2>
          <p className="mt-2 text-sm text-[#555] uppercase tracking-[0.2em] text-[10px]">연도별 근태·업무일지 점수를 일괄 부여합니다 (0~100)</p>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={downloadTemplate} className="px-5 py-2 border border-[#1A1A1A] text-[11px] uppercase tracking-widest hover:bg-[#1A1A1A] hover:text-white transition-colors">
            엑셀 양식/현황 다운로드
          </button>
          <div className="relative">
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <button className="px-5 py-2 border border-[#1A1A1A] text-[11px] uppercase tracking-widest hover:bg-[#1A1A1A] hover:text-white transition-colors pointer-events-none">
              엑셀 일괄 불러오기
            </button>
          </div>
          <div className="w-40">
            <Select value={selectedYear} onValueChange={(v) => setSelectedYear(v ?? '')}>
              <SelectTrigger className="border-[#1A1A1A] rounded-none bg-transparent">
                <SelectValue placeholder="평가 연도 선택" />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y.id} value={y.id}>{y.year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="flex gap-4 items-center">
        <div className="w-48">
          <Select value={selectedDepartment} onValueChange={(v) => setSelectedDepartment(v ?? 'all')}>
            <SelectTrigger className="border-[#1A1A1A] rounded-none bg-transparent">
              <SelectValue placeholder="소속 부서" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 부서</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="이름/ID/부서 검색"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="max-w-xs border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A]"
        />
        <div className="flex-1" />
        <span className="text-xs text-[#777]">{filteredUsers.length}명</span>
      </div>

      {!selectedYear ? (
        <div className="p-8 text-center text-[#777] border border-[#EEE]">평가 연도를 먼저 등록/선택해 주세요.</div>
      ) : (
        <div className="border border-[#1A1A1A] overflow-hidden flex flex-col">
          <div className="grid grid-cols-12 bg-[#1A1A1A] text-white text-[10px] uppercase tracking-[0.15em] p-4 sticky top-0">
            <div className="col-span-3">로그인 ID</div>
            <div className="col-span-2">이름</div>
            <div className="col-span-3">소속 부서</div>
            <div className="col-span-2 text-center">근태점수</div>
            <div className="col-span-2 text-center">업무일지 점수</div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto text-sm">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-[#777]">표시할 사용자가 없습니다.</div>
            ) : (
              filteredUsers.map((u: any) => (
                <div key={u.id} className="grid grid-cols-12 p-3 border-b border-[#EEE] items-center hover:bg-[#F9F9F9]">
                  <div className="col-span-3 text-[#777] truncate pr-2">{u.email?.includes('@') ? u.email.split('@')[0] : u.email}</div>
                  <div className="col-span-2 font-bold truncate pr-2">{u.name}</div>
                  <div className="col-span-3 font-sans text-xs uppercase text-[#777] truncate pr-2">{u.department || '-'}</div>
                  <div className="col-span-2 px-2">
                    <Input
                      type="number" min="0" max="100" step="0.1"
                      value={scores[u.id]?.attendanceScore ?? ''}
                      onChange={e => setScore(u.id, 'attendanceScore', e.target.value)}
                      className="text-center border border-[#CCC] rounded-none bg-white focus-visible:ring-0 focus-visible:border-[#1A1A1A] h-9"
                    />
                  </div>
                  <div className="col-span-2 px-2">
                    <Input
                      type="number" min="0" max="100" step="0.1"
                      value={scores[u.id]?.workLogScore ?? ''}
                      onChange={e => setScore(u.id, 'workLogScore', e.target.value)}
                      className="text-center border border-[#CCC] rounded-none bg-white focus-visible:ring-0 focus-visible:border-[#1A1A1A] h-9"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveAll}
          disabled={saving || !selectedYear}
          className="px-8 py-3 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest hover:bg-[#333] transition-colors disabled:opacity-50"
        >
          {saving ? '저장 중...' : '일괄 저장'}
        </button>
      </div>
    </div>
  );
}
