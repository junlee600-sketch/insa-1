import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { updatePassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

export default function ForcePasswordChange() {
  const { user, loading, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return <div className="p-8 text-center text-[var(--hrs-slate)]">로딩 중...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // 이미 변경을 마친 사용자는 대시보드로
  if (!user.mustChangePassword) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!auth.currentUser) {
      setError('세션이 만료되었습니다. 다시 로그인해 주세요.');
      return;
    }

    setSaving(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      // 강제 변경 플래그 해제 (해제 시 AuthContext 리스너가 즉시 반영 → 대시보드로 이동)
      await setDoc(doc(db, 'users', user.email), { mustChangePassword: false }, { merge: true });
    } catch (err: any) {
      logger.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('보안을 위해 다시 로그인한 뒤 변경해 주세요.');
      } else if (err.code === 'auth/weak-password') {
        setError('비밀번호가 너무 약합니다. 6자 이상으로 설정해 주세요.');
      } else if (err.code === 'permission-denied') {
        setError('변경 권한이 없습니다. 관리자에게 문의해 주세요.');
      } else {
        setError('비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--hrs-bg)] text-[var(--hrs-ink)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-lg font-bold tracking-tight text-[var(--hrs-ink)]">한국종합건축사사무소</h1>
          <p className="mt-1 text-xs font-medium text-[var(--hrs-slate)]">인사평가 시스템</p>
        </div>

        <Card className="p-2 sm:p-4">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-xl">비밀번호 변경이 필요합니다</CardTitle>
            <CardDescription className="text-sm text-[var(--hrs-slate)]">
              최초 로그인입니다. 계속하려면 새 비밀번호를 설정해 주세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5" autoComplete="off">
              {error && (
                <div className="p-3 bg-[var(--hrs-low-bg)] border border-[var(--hrs-line)] rounded-md text-[var(--hrs-low)] text-sm">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--hrs-ink)]">새 비밀번호</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="최소 6자 이상"
                  className="w-full px-4 py-2.5 rounded-md border border-[var(--hrs-line)] bg-[var(--hrs-bg)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--hrs-accent)] focus:border-[var(--hrs-accent)] transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--hrs-ink)]">새 비밀번호 확인</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 다시 입력"
                  className="w-full px-4 py-2.5 rounded-md border border-[var(--hrs-line)] bg-[var(--hrs-bg)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--hrs-accent)] focus:border-[var(--hrs-accent)] transition-colors text-sm"
                />
              </div>
              <p className="text-xs text-[var(--hrs-slate)]">비밀번호는 6자 이상이면 됩니다. 다른 제한은 없습니다.</p>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 mt-1 bg-[var(--hrs-accent)] hover:brightness-110 text-white font-semibold rounded-md transition-all text-sm disabled:opacity-50"
              >
                {saving ? '변경 중...' : '비밀번호 변경'}
              </button>
              <button
                type="button"
                onClick={logout}
                className="text-xs text-[var(--hrs-slate)] hover:text-[var(--hrs-ink)] transition-colors"
              >
                로그아웃
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
