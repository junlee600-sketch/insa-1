import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, authError, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('네트워크 요청에 실패했습니다. 타사 쿠키 차단 해제, 광고 차단 확장 프로그램(AdBlock 등) 비활성화 또는 인터넷 연결을 확인해 주세요.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('이메일 또는 비밀번호가 일치하지 않습니다. 다시 확인해 주세요.');
      } else {
        setError(err.message || '인증에 실패했습니다. 자격 증명을 확인해 주세요.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFDFB] text-[#1A1A1A] p-4 ">
      <div className="w-full max-w-lg border border-[#1A1A1A] bg-[#FDFDFB] p-12 shadow-2xl">
        <div className="text-center mb-10 pb-10 border-b border-[#E5E5E5]">
          <h1 className="text-5xl tracking-tight leading-none text-[#000] mb-4">
            한국종합 HRS<br/>
            <span className="text-xs uppercase tracking-[0.2em] opacity-40">HR System v4.0</span>
          </h1>
          <p className="text-sm text-[#777]">한국종합건축사사무소 인사평가 시스템</p>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-6" autoComplete="off">
          {(error || authError) && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs text-center flex flex-col gap-1">
              {error && <span>{error}</span>}
              {authError && (
                <span>
                  데이터 동기화 실패: {authError}
                  {authError.toLowerCase().includes('offline') && (
                    <span className="block mt-1 font-bold">네트워크 방화벽, 광고 차단기(AdBlock) 또는 브라우저의 쿠키 설정이 연결을 막고 있는지 확인해 주세요.</span>
                  )}
                </span>
              )}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-[#999]">로그인 아이디 (Email)</label>
            <input 
              type="text" 
              inputMode="email"
              autoComplete="new-password"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A] text-lg outline-none pb-2 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-[#999]">비밀번호 (Security Key)</label>
            <input 
              type="password" 
              autoComplete="new-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border-b border-[#CCC] border-t-0 border-r-0 border-l-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-[#1A1A1A] text-lg outline-none pb-2 transition-colors"
            />
          </div>
          <button 
            type="submit"
            className="w-full py-4 mt-4 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest hover:bg-[#333] transition-colors"
          >
            로그인
          </button>
          <p className="text-[10px] uppercase tracking-widest text-[#999] text-center mt-2">
            인가된 계정만 접속 가능합니다.
          </p>
        </form>
      </div>
    </div>
  );
}
