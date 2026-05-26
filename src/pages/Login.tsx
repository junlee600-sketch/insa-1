import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

export default function Login() {
  const { login, authError, user } = useAuth();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberId, setRememberId] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    const savedId = localStorage.getItem('savedLoginId');
    if (savedId) {
      setLoginId(savedId);
      setRememberId(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      let finalEmail = loginId.trim().toLowerCase();
      if (!finalEmail.includes('@')) {
        finalEmail += '@han-guk.co.kr';
      }
      
      if (rememberId) {
        localStorage.setItem('savedLoginId', loginId);
      } else {
        localStorage.removeItem('savedLoginId');
      }

      await login(finalEmail, password);
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('네트워크 요청에 실패했습니다. 타사 쿠키 차단 해제, 광고 차단 확장 프로그램(AdBlock 등) 비활성화 또는 인터넷 연결을 확인해 주세요.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('ID 또는 비밀번호가 일치하지 않습니다. 다시 확인해 주세요.');
      } else {
        setError(err.message || '인증에 실패했습니다. 자격 증명을 확인해 주세요.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] dark:bg-[oklch(0.15_0_0)] text-gray-900 dark:text-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center justify-center gap-2 mb-2">
            한국종합건축사사무소 HRS
          </h1>
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">인사평가 시스템 v4.0</p>
        </div>
        
        <Card className="border-none shadow-sm shadow-gray-200/50 dark:shadow-none p-2 sm:p-4">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-xl">로그인</CardTitle>
            <CardDescription className="text-sm text-gray-500">
              시스템에 접근하려면 계정 정보를 입력하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="flex flex-col gap-5" autoComplete="off">
              {(error || authError) && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl text-red-800 dark:text-red-300 text-sm flex flex-col gap-1">
                  {error && <span>{error}</span>}
                  {authError && (
                    <span>
                      데이터 동기화 실패: {authError}
                      {authError.toLowerCase().includes('offline') && (
                        <span className="block mt-1 font-medium">네트워크 방화벽, 광고 차단기(AdBlock) 또는 브라우저의 쿠키 설정이 연결을 막고 있는지 확인해 주세요.</span>
                      )}
                    </span>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">로그인 ID</label>
                <input 
                  type="text" 
                  autoComplete="username"
                  required
                  value={loginId}
                  onChange={e => setLoginId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-colors text-sm"
                  placeholder="아이디를 입력하세요"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">비밀번호</label>
                <input 
                  type="password" 
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-colors text-sm"
                  placeholder="비밀번호를 입력하세요"
                />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="rememberId"
                  checked={rememberId}
                  onChange={(e) => setRememberId(e.target.checked)}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:checked:bg-gray-100"
                />
                <label htmlFor="rememberId" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  아이디 저장
                </label>
              </div>
              <button 
                type="submit"
                className="w-full py-2.5 mt-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900 text-white font-medium rounded-xl transition-colors shadow-sm text-sm"
              >
                로그인
              </button>
            </form>
          </CardContent>
        </Card>
        
        <p className="text-xs text-center mt-8 text-gray-400 flex flex-col gap-2 items-center justify-center">
          <span>인가된 계정만 접속 가능합니다.</span>
          {window.self !== window.top && (
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              새 창으로 접속하기
            </a>
          )}
        </p>
      </div>
    </div>
  );
}
