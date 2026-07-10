import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { logger } from '../lib/logger';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';

export default function ProfileSettings() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({ name: '', department: '', position: '', password: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorModalMsg, setErrorModalMsg] = useState('');

  useEffect(() => {
    if (user?.email) {
      getDoc(doc(db, 'users', user.email)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setFormData(prev => ({ ...prev, name: data.name || '', department: data.department || '', position: data.position || '' }));
        }
      });
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !auth.currentUser) return;
    setMsg({ type: '', text: '' });
    setLoading(true);

    try {
      // Update password if fields are filled
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          setErrorModalMsg('비밀번호가 일치하지 않습니다.');
          setErrorModalOpen(true);
          setLoading(false);
          return;
        }
        if (formData.newPassword.length < 6) {
          setErrorModalMsg('비밀번호는 최소 6자 이상이어야 합니다.');
          setErrorModalOpen(true);
          setLoading(false);
          return;
        }
        try {
          await updatePassword(auth.currentUser, formData.newPassword);
          await updateDoc(doc(db, 'users', user.email), { mustChangePassword: false });
          setFormData(prev => ({ ...prev, password: '', newPassword: '', confirmPassword: '' }));
        } catch (pwErr: any) {
          logger.error(pwErr);
          let errMsg = '비밀번호 변경에 실패했습니다.';
          if (pwErr.code === 'auth/requires-recent-login') {
            errMsg = '비밀번호를 변경하려면 최신 로그인 정보가 필요합니다. 다시 로그인 후 시도해 주세요.';
          } else if (pwErr.code === 'auth/weak-password') {
            errMsg = '비밀번호가 너무 약합니다. 6자 이상으로 설정해 주세요.';
          }
          setErrorModalMsg(errMsg);
          setErrorModalOpen(true);
          setLoading(false);
          return;
        }
      }

      setMsg({ type: 'success', text: '내 정보가 성공적으로 변경되었습니다.' });
    } catch (err: any) {
      logger.error(err);
      setMsg({ type: 'error', text: '저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[var(--hrs-line)] pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">내 비밀번호 변경</h2>
          <p className="mt-2 text-sm text-[var(--hrs-slate)] tracking-normal text-[12px]">계정 비밀번호 변경</p>
        </div>
      </header>
      
      <div className="max-w-xl mx-auto bg-[var(--hrs-bg)] border border-[var(--hrs-line)] p-8">
        {msg.text && (
          <div className={`text-xs p-3 mb-6 border ${msg.type === 'error' ? 'text-red-700 bg-red-50 border-red-200' : 'text-green-700 bg-green-50 border-green-200'}`}>
            {msg.text}
          </div>
        )}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">ID</Label>
            <Input 
              value={user?.email?.includes('@') ? user.email.split('@')[0] : user?.email || ''} 
              disabled
              className="border border-[var(--hrs-line)] rounded-md bg-white px-3 opacity-50 px-0"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">사용자 이름</Label>
            <Input 
              value={formData.name} 
              disabled
              className="border border-[var(--hrs-line)] rounded-md bg-white px-3 opacity-50 px-0"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">직급</Label>
            <Input 
              value={formData.position || ''} 
              disabled
              className="border border-[var(--hrs-line)] rounded-md bg-white px-3 opacity-50 px-0"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">소속 부서</Label>
            <Input 
              value={formData.department} 
              disabled
              className="border border-[var(--hrs-line)] rounded-md bg-white px-3 opacity-50 px-0"
            />
          </div>

          <div className="pt-6 border-t border-[var(--hrs-line-soft)]">
            <h3 className="text-sm font-bold mb-4">비밀번호 변경</h3>
            <p className="text-[12px] text-[var(--hrs-slate)] mb-6">비밀번호를 변경하지 않으려면 비워두세요.</p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">새 비밀번호</Label>
                <Input 
                  type="password"
                  value={formData.newPassword} 
                  onChange={e => setFormData({...formData, newPassword: e.target.value})} 
                  placeholder="최소 6자 이상"
                  className="border border-[var(--hrs-line)] rounded-md bg-white px-3 focus-visible:ring-0 focus-visible:border-[var(--hrs-line)] px-0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12px] tracking-normal text-[var(--hrs-slate)]">새 비밀번호 확인</Label>
                <Input 
                  type="password"
                  value={formData.confirmPassword} 
                  onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
                  placeholder="비밀번호 다시 입력"
                  className="border border-[var(--hrs-line)] rounded-md bg-white px-3 focus-visible:ring-0 focus-visible:border-[var(--hrs-line)] px-0"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="px-8 py-3 bg-[var(--hrs-accent)] text-white text-[12px] tracking-normal hover:bg-[var(--hrs-ink)] transition-colors disabled:opacity-50"
            >
              {loading ? '저장 중...' : '변경 내용 저장'}
            </button>
          </div>
        </form>
      </div>

      <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg">오류</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-sm text-gray-700">
            {errorModalMsg}
          </div>
          <DialogFooter>
            <Button onClick={() => setErrorModalOpen(false)} className="bg-[var(--hrs-accent)] hover:bg-[var(--hrs-ink)] text-white">확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
