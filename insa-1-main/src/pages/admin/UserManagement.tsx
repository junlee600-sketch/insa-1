import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteField, serverTimestamp, query, where } from 'firebase/firestore';
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
const ALL_MENUS = [
  { to: "/", label: "대시보드", category: "기본" },
  { to: "/evaluate", label: "내 평가 진행", category: "기본" },
  { to: "/evaluate-executive", label: "임원평가 진행", category: "기본" },
  { to: "/history", label: "내 평가 이력", category: "기본" },
  { to: "/admin/items", label: "평가 항목 관리", category: "관리 기능" },
  { to: "/admin/items-executive", label: "임원평가 항목 관리", category: "관리 기능" },
  { to: "/admin/assignments", label: "평가자 배정", category: "관리 기능" },
  { to: "/admin/assignments-executive", label: "임원평가 배정", category: "관리 기능" },
  { to: "/admin/results", label: "최종 평가 결과", category: "관리 기능" },
  { to: "/admin/results-executive", label: "임원평가 최종 결과", category: "관리 기능" },
  { to: "/admin/scores", label: "근태·업무일지 점수 관리", category: "관리 기능" },
  { to: "/admin/users", label: "사용자 관리", category: "시스템 설정" },
  { to: "/admin/settings", label: "평가 연도/그룹", category: "시스템 설정" },
  { to: "/admin/menu-permissions", label: "메뉴 권한 관리", category: "시스템 설정" },
];

const ROLE_DEFAULT_PERMS: Record<string, Record<string, boolean>> = {
  admin: { "/": true, "/evaluate": true, "/evaluate-executive": true, "/history": true, "/admin/items": true, "/admin/items-executive": true, "/admin/assignments": true, "/admin/assignments-executive": true, "/admin/results": true, "/admin/results-executive": true, "/admin/scores": true, "/admin/users": true, "/admin/settings": true, "/admin/menu-permissions": true },
  hr:    { "/": true, "/evaluate": true, "/evaluate-executive": true, "/history": true, "/admin/items": true, "/admin/items-executive": true, "/admin/assignments": true, "/admin/assignments-executive": true, "/admin/results": true, "/admin/results-executive": true, "/admin/scores": false, "/admin/users": false, "/admin/settings": false, "/admin/menu-permissions": false },
  user:  { "/": true, "/evaluate": true, "/evaluate-executive": false, "/history": false, "/admin/items": false, "/admin/items-executive": false, "/admin/assignments": false, "/admin/assignments-executive": false, "/admin/results": false, "/admin/results-executive": false, "/admin/scores": false, "/admin/users": false, "/admin/settings": false, "/admin/menu-permissions": false },
};

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
  const [formData, setFormData] = useState({ email: '', password: '', name: '', department: '', position: '', role: 'user', yearsOfService: '' });
  const [userMenuPerms, setUserMenuPerms] = useState<Record<string, boolean> | null>(null);
  const [showMenuPerms, setShowMenuPerms] = useState(false);
  const [confirmDepartments, setConfirmDepartments] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [adminForcePassword, setAdminForcePassword] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'retired' | 'all'>('active');

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
    if (!adminForcePassword || adminForcePassword.length < 6) {
      setErrorMsg("비밀번호는 최소 6자 이상이어야 합니다.");
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
        if (!formData.password || formData.password.length < 6) {
          setErrorMsg('비밀번호는 최소 6자 이상이어야 합니다.');
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
      const saveData: any = {
        email: finalEmail,
        name: formData.name,
        department: formData.department,
        position: formData.position,
        role: formData.role,
        yearsOfService: formData.yearsOfService !== '' ? Number(formData.yearsOfService) : null,
        confirmDepartments,
        updatedAt: serverTimestamp(),
      };
      if (!isEditing) {
        saveData.createdAt = serverTimestamp();
        saveData.uid = '';
      }
      if (userMenuPerms !== null) {
        saveData.menuPermissions = userMenuPerms;
      } else if (isEditing) {
        // 초기화 시 개별 권한 필드 완전 삭제
        saveData.menuPermissions = deleteField();
      }
      await setDoc(userRef, saveData, { merge: true });
      
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
        setErrorMsg('비밀번호가 너무 약합니다. 최소 6자 이상으로 설정해 주세요.');
      } else {
        setErrorMsg('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }
  };

  const handleToggleStatus = async (targetUser: any) => {
    const isRetiring = (targetUser.status || 'active') === 'active';
    const label = isRetiring ? '퇴직' : '재직';
    const confirmMsg = isRetiring
      ? `[${targetUser.name}] 사용자를 퇴직 처리하시겠습니까?\n\n퇴직 처리 시 즉시 로그아웃되며 이후 접속이 차단됩니다.\n기존 평가 데이터는 그대로 유지됩니다.`
      : `[${targetUser.name}] 사용자를 재직으로 복구하시겠습니까?\n\n재직 복구 시 즉시 로그인이 가능해집니다.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      let emailForReq = targetUser.email || targetUser.id;
      if (!emailForReq.includes('@')) emailForReq += '@han-guk.co.kr';

      const userRef = doc(db, 'users', targetUser.id);
      await setDoc(userRef, { status: isRetiring ? 'retired' : 'active', updatedAt: serverTimestamp() }, { merge: true });

      const response = await adminFetch('/api/admin/set-user-status', { email: emailForReq, disabled: isRetiring });
      if (!response.ok) {
        const data = await response.json();
        logger.warn('Auth 계정 상태 변경 실패 (Firestore는 반영됨):', data.error);
      }

      fetchUsers();
      alert(`[${targetUser.name}] 사용자가 ${label} 처리되었습니다.`);
    } catch (err: any) {
      logger.error(err);
      alert('상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (email: string) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      let emailForReq = email;
      if (!emailForReq.includes('@')) emailForReq += '@han-guk.co.kr';

      const response = await adminFetch('/api/admin/delete-user', { email: emailForReq });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '삭제 실패');

      alert('사용자 및 모든 관련 데이터가 성공적으로 삭제되었습니다.');
      fetchUsers();
    } catch (err: any) {
      logger.error(err);
      alert(err.message || '삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
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
    setFormData({ email: user.email?.includes('@') ? user.email.split('@')[0] : user.email, password: '', name: user.name, department: user.department, position: user.position || '', role: user.role, yearsOfService: user.yearsOfService != null ? String(user.yearsOfService) : '' });
    setUserMenuPerms(user.menuPermissions ?? null);
    setShowMenuPerms(false);
    setConfirmDepartments(Array.isArray(user.confirmDepartments) ? user.confirmDepartments : []);
    setAdminForcePassword('');
    setIsEditing(true);
    setErrorMsg('');
    setSuccessMsg('');
    setIsOpen(true);
  };

  const openNew = () => {
    setFormData({ email: '', password: '', name: '', department: '', position: '', role: 'user', yearsOfService: '' });
    setUserMenuPerms(null);
    setShowMenuPerms(false);
    setConfirmDepartments([]);
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
      '연차': 3,
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
        const yearsRaw = row['연차'];
        const yearsOfService = yearsRaw != null && yearsRaw !== '' ? Number(yearsRaw) : null;
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
            if (!password || password.length < 6) {
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
            yearsOfService,
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

  const allDepartments = [...new Set(users.map(u => u.department).filter(Boolean))].sort() as string[];

  const filteredUsers = users.filter(u => {
    const userStatus = u.status || 'active';
    if (statusFilter !== 'all' && userStatus !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.name || '').toLowerCase().includes(q)
      || (u.email || '').toLowerCase().includes(q)
      || (u.department || '').toLowerCase().includes(q)
      || (u.position || '').toLowerCase().includes(q);
  });

  const activeCount = users.filter(u => (u.status || 'active') === 'active').length;
  const retiredCount = users.filter(u => u.status === 'retired').length;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[var(--hrs-line)] pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">사용자 관리</h2>
          <p className="mt-2 text-sm text-[var(--hrs-slate)] tracking-normal text-[12px]">계정 추가 수정 및 권한 부여 관리</p>
        </div>
        
        <div className="flex gap-4 items-center">
          <button 
            onClick={downloadTemplate}
            className="px-5 py-2 border border-[var(--hrs-line)] text-[12px] tracking-normal hover:bg-[var(--hrs-accent)] hover:text-white transition-colors"
          >
            등록양식 다운로드
          </button>
          
          <div className="relative">
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <button className="px-5 py-2 border border-[var(--hrs-line)] text-[12px] tracking-normal hover:bg-[var(--hrs-accent)] hover:text-white transition-colors pointer-events-none">
              일괄 사용자 등록
            </button>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger render={<Button onClick={openNew} className="rounded-md bg-[var(--hrs-accent)] hover:bg-[var(--hrs-ink)] px-5 py-2 text-[12px] tracking-normal h-auto">개별 사용자 등록</Button>} />
            <DialogContent className="border-[var(--hrs-line)] rounded-md bg-[var(--hrs-surface)]">
            <DialogHeader>
              <DialogTitle className="text-2xl">{isEditing ? '사용자 정보 수정' : '신규 사용자 등록'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {errorMsg && <div className="text-red-700 text-xs p-2 bg-red-50 border border-red-200">{errorMsg}</div>}
              {successMsg && <div className="text-green-700 text-xs p-2 bg-green-50 border border-green-200">{successMsg}</div>}
              <div className="space-y-2">
                <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">로그인 ID</Label>
                <Input
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  disabled={isEditing}
                  autoComplete="off"
                  className="border border-[var(--hrs-line)] rounded-md bg-white px-3 focus-visible:ring-0 focus-visible:border-[var(--hrs-line)] "
                />
              </div>
              {!isEditing && (
                <div className="space-y-2">
                  <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">초기 비밀번호</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    autoComplete="new-password"
                    className="border border-[var(--hrs-line)] rounded-md bg-white px-3 focus-visible:ring-0 focus-visible:border-[var(--hrs-line)] "
                    placeholder="최소 6자 이상"
                  />
                </div>
              )}
              {isEditing && (
                <div className="space-y-2 pt-4 border-t border-[var(--hrs-line-soft)]">
                  <Label className="text-[12px] tracking-normal text-[#red-700] text-red-700 font-bold">비밀번호 즉시 변경 (관리자)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="password"
                      value={adminForcePassword}
                      onChange={e => setAdminForcePassword(e.target.value)}
                      autoComplete="new-password"
                      className="border border-[var(--hrs-line)] rounded-md bg-white px-3 focus-visible:ring-0 focus-visible:border-[var(--hrs-line)] "
                      placeholder="최소 6자 이상"
                    />
                    <button type="button" onClick={handleForcePasswordChange} className="px-5 py-2 whitespace-nowrap bg-[var(--hrs-accent)] text-white text-[12px] hover:bg-[var(--hrs-ink)] transition-colors tracking-normal">
                      적용
                    </button>
                  </div>
                  <p className="text-[12px] text-[var(--hrs-slate)] mt-1">이메일 인증 없이 계정의 비밀번호를 즉시 새로운 값으로 덮어씁니다.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">사용자 이름</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  autoComplete="off"
                  className="border border-[var(--hrs-line)] rounded-md bg-white px-3 focus-visible:ring-0 focus-visible:border-[var(--hrs-line)] "
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">소속 부서</Label>
                <div className="flex gap-2">
                  <Select value={formData.department} onValueChange={(v) => setFormData({...formData, department: v ?? ''})}>
                    <SelectTrigger className="border border-[var(--hrs-line)] rounded-md bg-white px-3 text-sm flex-1">
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
                    className="w-1/3 border border-[var(--hrs-line)] rounded-md bg-white px-3 focus-visible:ring-0 focus-visible:border-[var(--hrs-line)] tracking-normal text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">직급/직책</Label>
                <div className="flex gap-2">
                  <Select value={formData.position} onValueChange={(v) => setFormData({...formData, position: v ?? ''})}>
                    <SelectTrigger className="border border-[var(--hrs-line)] rounded-md bg-white px-3 text-sm flex-1">
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
                    className="w-1/3 border border-[var(--hrs-line)] rounded-md bg-white px-3 focus-visible:ring-0 focus-visible:border-[var(--hrs-line)] tracking-normal text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">연차</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.yearsOfService}
                  onChange={e => setFormData({...formData, yearsOfService: e.target.value})}
                  placeholder="연차 입력"
                  className="border border-[var(--hrs-line)] rounded-md bg-white px-3 focus-visible:ring-0 focus-visible:border-[var(--hrs-line)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">권한 레벨</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v ?? ''})}>
                  <SelectTrigger className="border border-[var(--hrs-line)] rounded-md bg-white px-3"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">사용자</SelectItem>
                    <SelectItem value="hr">인사담당자</SelectItem>
                    <SelectItem value="admin">최고 관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isEditing && (
                <div className="space-y-2 pt-4 border-t border-[var(--hrs-line-soft)]">
                  <div className="py-2">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[12px] tracking-normal text-[var(--hrs-slate)]">최종평가 점수 확정 권한</p>
                      {confirmDepartments.length > 0 && (
                        <button type="button" onClick={() => setConfirmDepartments([])} className="text-[12px] text-red-500 tracking-normal underline">초기화</button>
                      )}
                    </div>
                    <p className="text-[12px] text-[var(--hrs-slate)] mb-2">체크한 부서의 최종 점수를 확정할 수 있습니다.</p>
                    <div className="border border-[var(--hrs-line-soft)] p-2 space-y-1.5">
                      {allDepartments.length === 0 && <p className="text-[12px] text-[var(--hrs-slate)]">등록된 부서가 없습니다.</p>}
                      {allDepartments.map(dept => (
                        <label key={dept} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmDepartments.includes(dept)}
                            onChange={e => setConfirmDepartments(prev =>
                              e.target.checked ? [...prev, dept] : prev.filter(d => d !== dept)
                            )}
                            className="w-3.5 h-3.5 accent-[var(--hrs-ink)]"
                          />
                          <span className="text-xs text-[var(--hrs-ink)]">{dept}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenuPerms(v => !v);
                      if (userMenuPerms === null) {
                        setUserMenuPerms({ ...ROLE_DEFAULT_PERMS[formData.role] });
                      }
                    }}
                    className="w-full text-left text-[12px] tracking-normal text-[var(--hrs-slate)] flex justify-between items-center py-1 border-t border-[var(--hrs-line-soft)] pt-3"
                  >
                    <span>개별 메뉴 권한 설정</span>
                    <span>{showMenuPerms ? '▲' : '▼'}</span>
                  </button>
                  {showMenuPerms && userMenuPerms !== null && (
                    <div className="border border-[var(--hrs-line-soft)] p-3 space-y-3 max-h-60 overflow-y-auto">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[12px] text-[var(--hrs-slate)] tracking-normal">역할 기반 기본값 재정의</span>
                        <button
                          type="button"
                          onClick={() => { setUserMenuPerms(null); setShowMenuPerms(false); }}
                          className="text-[12px] text-red-500 tracking-normal underline"
                        >
                          초기화 (역할 기본값 사용)
                        </button>
                      </div>
                      {Object.entries(
                        ALL_MENUS.reduce((acc, m) => { if (!acc[m.category]) acc[m.category] = []; acc[m.category].push(m); return acc; }, {} as Record<string, typeof ALL_MENUS>)
                      ).map(([cat, items]) => (
                        <div key={cat}>
                          <p className="text-[12px] tracking-normal text-[var(--hrs-slate)] mb-1">{cat}</p>
                          {items.map(m => (
                            <label key={m.to} className="flex items-center gap-2 py-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={userMenuPerms[m.to] ?? false}
                                onChange={e => setUserMenuPerms(prev => ({ ...prev!, [m.to]: e.target.checked }))}
                                className="w-3.5 h-3.5 accent-[var(--hrs-ink)]"
                              />
                              <span className="text-xs text-[var(--hrs-ink)]">{m.label}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="pt-4 flex justify-end">
                <button onClick={handleSave} className="px-5 py-2 bg-[var(--hrs-accent)] text-white text-[12px] tracking-normal hover:bg-[var(--hrs-ink)] transition-colors w-full">저장하기</button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </header>

      <div className="flex items-center gap-0 mt-8 mb-0 border-b border-[var(--hrs-line-soft)]">
        {([['active', `재직 (${activeCount})`], ['retired', `퇴직 (${retiredCount})`], ['all', `전체 (${users.length})`]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val)}
            className={`px-5 py-2 text-[12px] tracking-normal border-b-2 transition-colors ${statusFilter === val ? 'border-[var(--hrs-line)] text-[var(--hrs-ink)] font-bold' : 'border-transparent text-[var(--hrs-slate)] hover:text-[var(--hrs-slate)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-3 mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="이름, 아이디, 부서, 직급 검색..."
          autoComplete="off"
          className="border border-[var(--hrs-line)] px-4 py-2 text-sm w-72 focus:outline-none focus:border-[var(--hrs-line)] bg-transparent"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-[12px] tracking-normal text-[var(--hrs-slate)] hover:text-[var(--hrs-ink)] transition-colors">
            초기화
          </button>
        )}
        <span className="text-[12px] text-[var(--hrs-slate)] ml-auto">
          {filteredUsers.length}명
        </span>
      </div>

      <div className="flex-1 border border-[var(--hrs-line)] rounded-lg bg-[var(--hrs-surface)] shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden flex flex-col">
        <div className="grid grid-cols-12 bg-[var(--hrs-bg)] text-[var(--hrs-slate)] border-b border-[var(--hrs-line)] font-semibold text-[12px] uppercase tracking-[0.04em] p-4 sticky top-0">
          <div className="col-span-2">로그인 ID</div>
          <div className="col-span-2">사용자 이름</div>
          <div className="col-span-1">직급</div>
          <div className="col-span-2">소속 부서</div>
          <div className="col-span-1 text-center">연차</div>
          <div className="col-span-1">권한</div>
          <div className="col-span-1">재직상태</div>
          <div className="col-span-2 text-right">작업</div>
        </div>
        <div className="flex-1 overflow-y-auto text-sm">
          {filteredUsers.map((user) => {
            const isRetired = user.status === 'retired';
            return (
              <div key={user.id} className={`grid grid-cols-12 p-4 border-b border-[var(--hrs-line-soft)] items-center transition-colors ${isRetired ? 'bg-[#FAFAFA] opacity-70' : 'hover:bg-[var(--hrs-bg)]'}`}>
                <div className="col-span-2 text-[var(--hrs-slate)] truncate pr-2">{user.email?.includes('@') ? user.email.split('@')[0] : user.email}</div>
                <div className={`col-span-2 font-bold text-lg truncate pr-2 ${isRetired ? 'line-through text-[var(--hrs-slate)]' : ''}`}>{user.name}</div>
                <div className="col-span-1 font-sans text-xs text-[var(--hrs-slate)] truncate pr-2">{user.position || '-'}</div>
                <div className="col-span-2 font-sans text-xs uppercase text-[var(--hrs-slate)] truncate pr-2">{user.department}</div>
                <div className="col-span-1 font-sans text-xs text-center text-[var(--hrs-slate)]">{user.yearsOfService != null ? `${user.yearsOfService}년` : '-'}</div>
                <div className="col-span-1">
                  <span className={`text-[12px] tracking-normal px-2 py-1 ${user.role === 'admin' ? 'bg-[var(--hrs-accent)] text-white' : 'bg-[var(--hrs-line)] text-[var(--hrs-ink)]'}`}>
                    {user.role}
                  </span>
                </div>
                <div className="col-span-1">
                  <span className={`text-[12px] tracking-normal px-2 py-1 ${isRetired ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {isRetired ? '퇴직' : '재직'}
                  </span>
                </div>
                <div className="col-span-2 text-right flex justify-end gap-2 flex-wrap">
                  <button onClick={() => openEdit(user)} className="text-[12px] tracking-normal text-[var(--hrs-slate)] hover:text-[var(--hrs-ink)] underline underline-offset-4">수정</button>
                  <button
                    onClick={() => handleToggleStatus(user)}
                    className={`text-[12px] tracking-normal underline underline-offset-4 border-l border-[var(--hrs-line)] pl-2 ${isRetired ? 'text-emerald-600 hover:text-emerald-800' : 'text-amber-600 hover:text-amber-800'}`}
                  >
                    {isRetired ? '재직복구' : '퇴직처리'}
                  </button>
                  <button onClick={() => { setConfirmData({ id: user.id, name: user.name }); setConfirmOpen(true); }} className="text-[12px] tracking-normal text-[var(--hrs-slate)] hover:text-red-700 underline underline-offset-4 border-l border-[var(--hrs-line)] pl-2">삭제</button>
                </div>
              </div>
            );
          })}
          {filteredUsers.length === 0 && (
            <div className="p-8 text-center text-[var(--hrs-slate)] text-sm">검색 결과가 없습니다.</div>
          )}
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
