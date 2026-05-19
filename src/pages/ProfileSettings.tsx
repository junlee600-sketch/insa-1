import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

export default function ProfileSettings() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({ name: '', department: '', position: '', password: '', newPassword: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

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
        if (formData.newPassword.length < 6) {
          throw new Error('새 비밀번호는 최소 6자 이상이어야 합니다.');
        }
        try {
          await updatePassword(auth.currentUser, formData.newPassword);
          setFormData(prev => ({ ...prev, password: '', newPassword: '' }));
        } catch (pwErr: any) {
          console.error(pwErr);
          if (pwErr.code === 'auth/requires-recent-login') {
            throw new Error('비밀번호를 변경하려면 최신 로그인 정보가 필요합니다. 다시 로그인 후 시도해 주세요.');
          }
          if (pwErr.code === 'auth/weak-password') {
            throw new Error('비밀번호가 너무 약합니다. 6자 이상으로 설정해 주세요.');
          }
          throw new Error('비밀번호 변경에 실패했습니다: ' + pwErr.message);
        }
      }

      setMsg({ type: 'success', text: '내 정보가 성공적으로 변경되었습니다.' });
    } catch (err: any) {
      console.error(err);
      setMsg({ type: 'error', text: err.message || '저장 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-12 border-b border-[#1A1A1A] pb-6">
        <div>
          <h2 className="text-5xl tracking-tighter">내 비밀번호 변경</h2>
          <p className="mt-2 text-sm text-[#555] uppercase tracking-[0.2em] text-[10px]">계정 비밀번호 변경</p>
        </div>
      </header>
      
      <div className="max-w-xl mx-auto bg-[#F9F9F9] border border-[#E5E5E5] p-8">
        {msg.text && (
          <div className={`text-xs p-3 mb-6 border ${msg.type === 'error' ? 'text-red-700 bg-red-50 border-red-200' : 'text-green-700 bg-green-50 border-green-200'}`}>
            {msg.text}
          </div>
        )}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-[#999]">ID</Label>
            <Input 
              value={user?.email?.includes('@') ? user.email.split('@')[0] : user?.email || ''} 
              disabled
              className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent opacity-50 px-0"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-[#999]">사용자 이름</Label>
            <Input 
              value={formData.name} 
              disabled
              className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent opacity-50 px-0"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-[#999]">직급</Label>
            <Input 
              value={formData.position || ''} 
              disabled
              className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent opacity-50 px-0"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-[#999]">소속 부서</Label>
            <Input 
              value={formData.department} 
              disabled
              className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent opacity-50 px-0"
            />
          </div>

          <div className="pt-6 border-t border-[#EEE]">
            <h3 className="text-sm font-bold mb-4">비밀번호 변경</h3>
            <p className="text-[10px] text-[#777] mb-6">비밀번호를 변경하지 않으려면 비워두세요.</p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-[#999]">새 비밀번호</Label>
                <Input 
                  type="password"
                  value={formData.newPassword} 
                  onChange={e => setFormData({...formData, newPassword: e.target.value})} 
                  placeholder="최소 6자 이상"
                  className="border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A] px-0"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="px-8 py-3 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest hover:bg-[#333] transition-colors disabled:opacity-50"
            >
              {loading ? '저장 중...' : '변경 내용 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
