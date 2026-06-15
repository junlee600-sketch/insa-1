import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query, where, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { db, secondaryAuth, auth } from '../../lib/firebase';

async function adminFetch(path: string, body: object) {
  if (!auth.currentUser) throw new Error('로그인이 필요합니다.');
  const idToken = await auth.currentUser.getIdToken();
  return fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
}
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { readExcelRows, downloadExcelFile, validateExcelFile } from '../../lib/excel';
import { logger } from '../../lib/logger';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', name: '', department: '', position: '', role: 'user' });
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [adminForcePassword, setAdminForcePassword] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const querySnapshot = await getDocs(collection(db, 'users'));
    const userData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    userData.sort((a: any, b: any) => (a.department || '').localeCompare(b.department || '', 'ko'));
    setUsers(userData);
    setLoading(false);
  };

  const handleForcePasswordChange = async (e: React.MouseEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!adminForcePassword || adminForcePassword.length < 8 || !/[A-Za-z]/.test(adminForcePassword) || !/[0-9]/.test(adminForcePassword)) {
      setErrorMsg("비밀번호는 최소 8자 이상이며 영문자와 숫자를 포함해야 합니다.");
      return;
    }
    
    try {
      let emailForPwd = formData.email;
      if (!emailForPwd.includes('@')) emailForPwd += '@han-guk.co.kr';

      const response = await adminFetch('/api/admin/update-password', { email: emailForPwd, newPassword: adminForcePassword });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '알 수 없는 오류');
      }
      
      setSuccessMsg(`[${formData.email}] 계정의 비밀번호가 성공적으로 즉시 변경되었습니다.`);
      setAdminForcePassword('');
    } catch (err: any) {
      logger.error(err);
      setErrorMsg('비밀번호 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const handleSave = async () => {
    if (!formData.email) return;
    setErrorMsg('');

    try {
      let isAuthInUse = false;

      let finalEmail = formData.email.trim().toLowerCase();
      if (!finalEmail.includes('@')) {
        finalEmail += '@han-guk.co.kr';
      }

      if (!isEditing) {
        if (!formData.password || formData.password.length < 8 || !/[A-Za-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
          setErrorMsg('비밀번호는 최소 8자 이상이며 영문자와 숫자를 포함해야 합니다.');
          return;
        }
        // Force create auth account without signing current admin out
        try {
          await createUserWithEmailAndPassword(secondaryAuth, finalEmail, formData.password);
          await signOut(secondaryAuth);
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            isAuthInUse = true;
          } else {
            throw authErr;
          }
        }
      }

      const userRef = doc(db, 'users', finalEmail);
      await setDoc(userRef, {
        email: finalEmail,
        name: formData.name,
        department: formData.department,
        position: formData.position,
        role: formData.role,
        createdAt: serverTimestamp(),
        uid: '' // Will be populatd on their first login
      }, { merge: true });
      
      setIsOpen(false);
      fetchUsers();

      if (isAuthInUse) {
        window.alert(`[${finalEmail}] 계정은 이미 인증 시스템 서버에 가입되어 있어 성공적으로 데이터베이스 목록에 복구 및 연동되었습니다.\n\n단, 비밀번호는 새로 입력하신 비밀번호로 변경되지 않았으며 기존 인증 시스템 내 비밀번호가 그대로 유지됩니다. (변경이 필요한 경우 기존 사용자가 '비밀번호 재설정'을 해야 합니다)`);
      }
    } catch (err: any) {
      logger.error(err);
      if (err.code === 'auth/invalid-email') {
        setErrorMsg('아이디에 사용할 수 없는 문자가 포함되어 있습니다.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('비밀번호가 너무 약합니다. 6자 이상으로 설정해 주세요.');
      } else {
        setErrorMsg('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }
  };

  const handleDelete = async (email: string) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      let emailForPwd = email;
      if (!emailForPwd.includes('@')) emailForPwd += '@han-guk.co.kr';

      // 1. Delete Firebase Auth user via backend
      try {
        await adminFetch('/api/admin/delete-user', { email: emailForPwd, authOnly: true });
      } catch (err) {
        logger.warn('Backend auth deletion failed, but continuing with DB deletion', err);
      }

      // 2. Query all related docs first, then batch-delete for atomicity
      const collectDocsToDelete = async (colName: string, field: string) => {
        const snap = await getDocs(query(collection(db, colName), where(field, '==', emailForPwd)));
        return snap.docs;
      };

      const [
        evalorAssignments, evalorExecAssignments,
        evaleeAssignments, evaleeExecAssignments,
        finalScoresDocs, execFinalScoresDocs,
      ] = await Promise.all([
        collectDocsToDelete('assignments', 'evaluatorId'),
        collectDocsToDelete('exec_assignments', 'evaluatorId'),
        collectDocsToDelete('assignments', 'evaluateeId'),
        collectDocsToDelete('exec_assignments', 'evaluateeId'),
        collectDocsToDelete('finalScores', 'evaluateeId'),
        collectDocsToDelete('exec_finalScores', 'evaluateeId'),
      ]);

      const batch = writeBatch(db);

      // Delete user document
      batch.delete(doc(db, 'users', emailForPwd));

      // Delete assignments and their results
      for (const d of evalorAssignments) {
        batch.delete(doc(db, 'results', d.id));
        batch.delete(d.ref);
      }
      for (const d of evalorExecAssignments) {
        batch.delete(doc(db, 'exec_results', d.id));
        batch.delete(d.ref);
      }
      for (const d of evaleeAssignments) {
        batch.delete(doc(db, 'results', d.id));
        batch.delete(d.ref);
      }
      for (const d of evaleeExecAssignments) {
        batch.delete(doc(db, 'exec_results', d.id));
        batch.delete(d.ref);
      }
      for (const d of finalScoresDocs) batch.delete(d.ref);
      for (const d of execFinalScoresDocs) batch.delete(d.ref);

      await batch.commit();

      alert('사용자 및 모든 관련 데이터가 성공적으로 삭제되었습니다.');
      fetchUsers();
    } catch (err: any) {
      logger.error(err);
      alert('삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteConfirm = () => {
    if (confirmData) {
      handleDelete(confirmData.id);
    }
  };

  const openEdit = (user: any) => {
    setFormData({ email: user.email?.includes('@') ? user.email.split('@')[0] : user.email, password: '', name: user.name, department: user.department, position: user.position || '', role: user.role });
    setAdminForcePassword('');
    setIsEditing(true);
    setErrorMsg('');
    setSuccessMsg('');
    setIsOpen(true);
  };

  const openNew = () => {
    setFormData({ email: '', password: '', name: '', department: '', position: '', role: 'user' });
    setAdminForcePassword('');
    setIsEditing(false);
    setErrorMsg('');
    setSuccessMsg('');
    setIsOpen(true);
  };

  const downloadTemplate = async () => {
    await downloadExcelFile([{
      '로그인 ID': 'user01',
      '초기 비밀번호': 'Abcd123!',
      '사용자 이름': '홍길동',
      '소속 부서': '인사팀',
      '직급': '사원',
      '권한 (admin/user)': 'user'
    }], "Users", "User_Registration_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateExcelFile(file);
    if (validationError) { alert(validationError); e.target.value = ''; return; }

    try {
      const data = await readExcelRows(file);
      let successCount = 0;
      let failCount = 0;
      setLoading(true);

      for (const row of data) {
        let email = String(row['로그인 ID'] || row['로그인 아이디 (이메일)'] || '').trim().toLowerCase();
        const password = String(row['초기 비밀번호'] || '').trim();
        const name = String(row['사용자 이름'] || '').trim();
        const department = String(row['소속 부서'] || '').trim();
        const position = String(row['직급'] || '').trim();
        let role = String(row['권한 (admin/user)'] || '').trim().toLowerCase();

        if (!email || !name) {
          failCount++;
          continue;
        }

        if (!email.includes('@')) {
          email += '@han-guk.co.kr';
        }

        if (role !== 'admin' && role !== 'user') {
          role = 'user';
        }

        const existingUser = users.find(u => u.email === email);

        try {
          if (!existingUser) {
            if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
              failCount++;
              continue;
            }
            try {
              await createUserWithEmailAndPassword(secondaryAuth, email, password);
              await signOut(secondaryAuth);
            } catch (authErr: any) {
              if (authErr.code !== 'auth/email-already-in-use') {
                failCount++;
                continue;
              }
            }
          }

          const userRef = doc(db, 'users', email);
          await setDoc(userRef, {
            email,
            name,
            department,
            position,
            role,
            createdAt: existingUser ? existingUser.createdAt : serverTimestamp(),
            uid: existingUser ? existingUser.uid : ''
          }, { merge: true });

          successCount++;
        } catch (err) {
          logger.error(err);
          failCount++;
        }
      }

      fetchUsers();
      alert(`일괄 처리가 완료되었습니다.\n성공: ${successCount}건\n실패: ${failCount}건`);
    } catch (err) {
      logger.error(err);
      alert('파일 처리 중 오류가 발생했습니다.');
      setLoading(false);
    }
    e.target.value = '';
  };

  if (loading) return <div>사용자 정보를 불러오는 중입니다...</div>;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[#1A1A1A] pb-6">
        <div>
          <h2 className="text-5xl tracking-tighter">사용자 관리</h2>
          <p className="mt-2 text-sm text-[#555] uppercase tracking-[0.2em] text-[10px]">계정 추가 수정 및 권한 부여 관리</p>
        </div>
        
        <div className="flex gap-4 items-center">
          <button 
            onClick={downloadTemplate}
            className="px-5 py-2 border border-[#1A1A1A] text-[11px] uppercase tracking-widest hover:bg-[#1A1A1A] hover:text-white transition-colors"
          >
            등록양식 다운로드
          </button>
          
          <div className="relative">
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <button className="px-5 py-2 border border-[#1A1A1A] text-[11px] uppercase tracking-widest hover:bg-[#1A1A1A] hover:text-white transition-colors pointer-events-none">
              일괄 사용자 등록
            </button>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger render={<Button onClick={openNew} className="rounded-none bg-[#1A1A1A] hover:bg-[#333] px-5 py-2 text-[11px] uppercase tracking-widest h-auto">개별 사용자 등록</Button>} />
            <DialogContent className="border-[#1A1A1A] rounded-none bg-[#FDFDFB]">
            <DialogHeader>
              <DialogTitle className="text-2xl">{isEditing ? '사용자 정보 수정' : '신규 사용자 등록'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {errorMsg && <div className="text-red-700 text-xs p-2 bg-red-50 border border-red-200">{errorMsg}</div>}
              {successMsg && <div className="text-green-700 text-xs p-2 bg-green-50 border border-green-200">{successMsg}</div>}
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-[#999]">로그인 ID</Label>
                <Input 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  disabled={isEditing}
                  className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A] "
                />
              </div>
              {!isEditing && (
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest text-[#999]">초기 비밀번호</Label>
                  <Input 
                    type="password"
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                    className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A] "
                    placeholder="최소 6자 이상"
                  />
                </div>
              )}
              {isEditing && (
                <div className="space-y-2 pt-4 border-t border-[#EEE]">
                  <Label className="text-[10px] uppercase tracking-widest text-[#red-700] text-red-700 font-bold">비밀번호 즉시 변경 (관리자)</Label>
                  <div className="flex gap-2 items-center">
                    <Input 
                      type="password"
                      value={adminForcePassword} 
                      onChange={e => setAdminForcePassword(e.target.value)} 
                      className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A] "
                      placeholder="새 비밀번호 (6자 이상)"
                    />
                    <button type="button" onClick={handleForcePasswordChange} className="px-5 py-2 whitespace-nowrap bg-[#1A1A1A] text-white text-[10px] hover:bg-[#333] transition-colors uppercase tracking-widest">
                      적용
                    </button>
                  </div>
                  <p className="text-[10px] text-[#777] mt-1">이메일 인증 없이 계정의 비밀번호를 즉시 새로운 값으로 덮어씁니다.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-[#999]">사용자 이름</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A] "
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-[#999]">소속 부서</Label>
                <div className="flex gap-2">
                  <Select value={formData.department} onValueChange={(v) => setFormData({...formData, department: v ?? ''})}>
                    <SelectTrigger className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent px-0 uppercase tracking-wider text-xs flex-1">
                      <SelectValue placeholder="부서 선택 혹은 직접 입력" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="설계1그룹">설계1그룹</SelectItem>
                      <SelectItem value="설계2그룹">설계2그룹</SelectItem>
                      <SelectItem value="전략기획그룹">전략기획그룹</SelectItem>
                      <SelectItem value="주거그룹">주거그룹</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    placeholder="직접 입력"
                    value={formData.department} 
                    onChange={e => setFormData({...formData, department: e.target.value})} 
                    className="w-1/3 border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A] uppercase tracking-wider text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-[#999]">직급/직책</Label>
                <div className="flex gap-2">
                  <Select value={formData.position} onValueChange={(v) => setFormData({...formData, position: v ?? ''})}>
                    <SelectTrigger className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent px-0 uppercase tracking-wider text-xs flex-1">
                      <SelectValue placeholder="직급 선택 혹은 직접 입력" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="설계1그룹장">설계1그룹장</SelectItem>
                      <SelectItem value="설계2그룹장">설계2그룹장</SelectItem>
                      <SelectItem value="전략기획그룹장">전략기획그룹장</SelectItem>
                      <SelectItem value="주거그룹장">주거그룹장</SelectItem>
                      <SelectItem value="팀원">팀원</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    placeholder="직접 입력"
                    value={formData.position} 
                    onChange={e => setFormData({...formData, position: e.target.value})} 
                    className="w-1/3 border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A] uppercase tracking-wider text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-[#999]">권한 레벨</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v ?? ''})}>
                  <SelectTrigger className="border-b border-[#1A1A1A] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent px-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">사용자</SelectItem>
                    <SelectItem value="hr">인사담당자</SelectItem>
                    <SelectItem value="admin">최고 관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-4 flex justify-end">
                <button onClick={handleSave} className="px-5 py-2 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest hover:bg-[#333] transition-colors w-full">저장하기</button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </header>

      <div className="flex-1 border border-[#1A1A1A] overflow-hidden flex flex-col mt-8">
        <div className="grid grid-cols-12 bg-[#1A1A1A] text-white text-[10px] uppercase tracking-[0.15em] p-4 sticky top-0">
          <div className="col-span-3">로그인 ID</div>
          <div className="col-span-2">사용자 이름</div>
          <div className="col-span-2">직급</div>
          <div className="col-span-2">소속 부서</div>
          <div className="col-span-1">권한</div>
          <div className="col-span-2 text-right">작업</div>
        </div>
        <div className="flex-1 overflow-y-auto  text-sm">
          {users.map((user) => (
            <div key={user.id} className="grid grid-cols-12 p-4 border-b border-[#EEE] items-center hover:bg-[#F9F9F9] transition-colors">
              <div className="col-span-3 text-[#777] truncate pr-2">{user.email?.includes('@') ? user.email.split('@')[0] : user.email}</div>
              <div className="col-span-2 font-bold text-lg truncate pr-2">{user.name}</div>
              <div className="col-span-2 font-sans text-xs text-[#555] truncate pr-2">{user.position || '-'}</div>
              <div className="col-span-2 font-sans text-xs uppercase text-[#777] truncate pr-2">{user.department}</div>
              <div className="col-span-1">
                 <span className={`text-[9px] uppercase tracking-widest px-2 py-1 ${user.role === 'admin' ? 'bg-[#1A1A1A] text-white' : 'bg-[#E5E5E5] text-[#1A1A1A]'}`}>
                    {user.role}
                 </span>
              </div>
              <div className="col-span-2 text-right flex justify-end gap-3">
                <button onClick={() => openEdit(user)} className="text-[10px] uppercase tracking-widest text-[#777] hover:text-[#1A1A1A] underline underline-offset-4">수정</button>
                <button onClick={() => { setConfirmData({ id: user.id, name: user.name }); setConfirmOpen(true); }} className="text-[10px] uppercase tracking-widest text-[#777] hover:text-red-700 underline underline-offset-4 border-l border-[#CCC] pl-3">삭제</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ConfirmDialog 
        open={confirmOpen} 
        onOpenChange={setConfirmOpen}
        title="사용자 삭제"
        description={`정말로 사용자 '${confirmData?.name}' 님을 삭제하시겠습니까? 관련 평가 및 확정 점수 데이터를 포함한 모든 데이터가 완전히 삭제되며 복구할 수 없습니다.`}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
