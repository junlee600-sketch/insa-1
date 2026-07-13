import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { updatePassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

// 실시간 검증 체크 항목
function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm" style={{ color: ok ? 'var(--hrs-high)' : 'var(--hrs-slate)' }}>
      <span
        className="w-[18px] h-[18px] rounded-full grid place-items-center shrink-0"
        style={{ background: ok ? 'var(--hrs-high-bg)' : 'var(--hrs-line-soft)' }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M3.5 8.5l3 3 6-6.5" stroke={ok ? 'var(--hrs-high)' : 'var(--hrs-slate)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label}
    </div>
  );
}

// 비밀번호 강도 (0~4) — 시각 표시용, 통과 조건 아님
function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[a-zA-Z]/.test(pw) && /[0-9]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

export default function ForcePasswordChange() {
  const { user, loading, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return <div className="p-8 text-center text-[var(--hrs-slate)]">로딩 중...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // 이미 변경을 마친 사용자는 대시보드로
  if (!user.mustChangePassword) return <Navigate to="/" replace />;

  const lenOk = newPassword.length >= 6;
  const matchOk = confirmPassword.length > 0 && newPassword === confirmPassword;
  const strength = passwordStrength(newPassword);
  const strengthLabel = ['', '약함', '보통', '양호', '강함'][strength];
  const strengthColor = strength <= 1 ? 'var(--hrs-low)' : strength === 2 ? 'var(--hrs-mid)' : 'var(--hrs-high)';

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
    let passwordChanged = false;
    const clearFlag = () => setDoc(doc(db, 'users', user.email), { mustChangePassword: false }, { merge: true });

    try {
      await updatePassword(auth.currentUser, newPassword);
      passwordChanged = true;
      // 플래그 해제 시 AuthContext 리스너가 반영 → 대시보드로 이동
      await clearFlag();
    } catch (err: any) {
      logger.error(err);

      if (passwordChanged) {
        // 비밀번호는 이미 바뀌었고 플래그 해제만 실패한 경우 → 1회 재시도
        try {
          await clearFlag();
          return;
        } catch (retryErr) {
          logger.error(retryErr);
          setError('비밀번호는 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요.');
          setSaving(false);
          return;
        }
      }

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
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="off">
              {error && (
                <div className="p-3 bg-[var(--hrs-low-bg)] border border-[var(--hrs-line)] rounded-md text-[var(--hrs-low)] text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--hrs-ink)]">새 비밀번호</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="최소 6자 이상"
                    className="w-full pl-4 pr-11 py-2.5 rounded-md border border-[var(--hrs-line)] bg-[var(--hrs-bg)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--hrs-accent)] focus:border-[var(--hrs-accent)] transition-colors text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-[var(--hrs-slate)] hover:text-[var(--hrs-ink)]"
                  >
                    {showPw ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.6 10.6a2.5 2.5 0 003.4 3.4M9.9 5.2A9.8 9.8 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.3 4M6.3 6.3A17 17 0 002 12s3.5 7 10 7a9.7 9.7 0 004.2-.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.5"/></svg>
                    )}
                  </button>
                </div>
                {newPassword && (
                  <div className="pt-1">
                    <div className="h-1.5 rounded bg-[var(--hrs-line-soft)] overflow-hidden">
                      <div className="h-full rounded transition-all" style={{ width: `${(strength / 4) * 100}%`, background: strengthColor }} />
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: strengthColor }}>비밀번호 강도 · {strengthLabel}</p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--hrs-ink)]">새 비밀번호 확인</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 다시 입력"
                  className="w-full px-4 py-2.5 rounded-md border border-[var(--hrs-line)] bg-[var(--hrs-bg)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--hrs-accent)] focus:border-[var(--hrs-accent)] transition-colors text-sm"
                />
              </div>

              {/* 실시간 검증 체크리스트 */}
              <div className="flex flex-col gap-2 py-1">
                <Check ok={lenOk} label="6자 이상" />
                <Check ok={matchOk} label="비밀번호 일치" />
              </div>

              <button
                type="submit"
                disabled={saving || !lenOk || !matchOk}
                className="w-full py-2.5 mt-1 bg-[var(--hrs-accent)] hover:brightness-110 text-white font-semibold rounded-md transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '변경 중...' : '변경하기'}
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
