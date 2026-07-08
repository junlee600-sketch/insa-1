import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

const GCP_PROJECT = 'gen-lang-client-0327374539';
const GCP_CREDENTIALS_URL = `https://console.cloud.google.com/apis/credentials?project=${GCP_PROJECT}`;

function RefererBlockedGuide() {
  return (
    <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-sm space-y-3">
      <p className="font-bold text-amber-900 text-base">🔧 로컬 개발 환경 설정 필요</p>
      <p className="text-amber-800">
        Firebase API 키가 <code className="bg-amber-100 px-1 rounded">localhost</code> 접속을 차단하고 있습니다.
        아래 단계를 따라 1회만 설정하면 됩니다.
      </p>
      <ol className="text-amber-800 space-y-2 list-decimal list-inside leading-relaxed">
        <li>
          <a href={GCP_CREDENTIALS_URL} target="_blank" rel="noopener noreferrer"
             className="text-blue-600 hover:underline font-semibold">
            Google Cloud Console → 사용자 인증 정보
          </a>
          &nbsp;접속
        </li>
        <li>
          <span className="font-mono text-xs bg-amber-100 px-1 rounded">AIzaSyBdwfa...</span> 키 클릭
        </li>
        <li>
          <span className="font-semibold">애플리케이션 제한사항</span> →{' '}
          <span className="font-semibold">HTTP 리퍼러(웹 사이트)</span> 선택
        </li>
        <li>
          아래 두 주소를 추가:
          <div className="mt-1 space-y-1">
            <code className="block bg-amber-100 px-2 py-1 rounded text-xs">http://localhost:8080/*</code>
            <code className="block bg-amber-100 px-2 py-1 rounded text-xs">http://localhost/*</code>
          </div>
        </li>
        <li>저장 후 <span className="font-semibold">1~2분</span> 대기 후 재시도</li>
      </ol>
    </div>
  );
}

export default function Login() {
  const { login, authError, user } = useAuth();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRefererBlocked, setIsRefererBlocked] = useState(false);
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
      setIsRefererBlocked(false);
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
      const code: string = err.code || '';
      if (code.includes('requests-from-referer') && code.includes('are-blocked')) {
        setIsRefererBlocked(true);
        setError('');
      } else if (code === 'auth/network-request-failed') {
        setError('네트워크 요청에 실패했습니다. 인터넷 연결 또는 광고 차단기(AdBlock) 설정을 확인해 주세요.');
      } else if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError('ID 또는 비밀번호가 일치하지 않습니다. 다시 확인해 주세요.');
      } else if (code === 'auth/too-many-requests') {
        setError('로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      } else if (code === 'auth/user-disabled') {
        setError('비활성화된 계정입니다. 관리자에게 문의해 주세요.');
      } else if (code === 'auth/operation-not-allowed') {
        setError('이메일/비밀번호 로그인이 비활성화되어 있습니다. Firebase 콘솔에서 활성화해 주세요.');
      } else if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid') {
        setError('Firebase API 키가 유효하지 않습니다. 설정 파일을 확인해 주세요.');
      } else {
        setError(`인증에 실패했습니다. (${code || '알 수 없는 오류'}) 관리자에게 문의해 주세요.`);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--hrs-bg)] text-[var(--hrs-ink)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <span className="w-9 h-9 rounded-lg bg-[var(--hrs-accent)] text-white grid place-items-center text-base font-bold">한</span>
            <h1 className="text-lg font-bold tracking-tight text-[var(--hrs-ink)]">한국종합건축사사무소</h1>
          </div>
          <p className="text-xs font-medium text-[var(--hrs-slate)]">인사평가 시스템</p>
        </div>

        <Card className="p-2 sm:p-4">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-xl">로그인</CardTitle>
            <CardDescription className="text-sm text-[var(--hrs-slate)]">
              시스템에 접근하려면 계정 정보를 입력하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="flex flex-col gap-5" autoComplete="off">
              {isRefererBlocked && <RefererBlockedGuide />}
              {(error || authError) && !isRefererBlocked && (
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
                <label className="text-sm font-medium text-[var(--hrs-ink)]">로그인 ID</label>
                <input
                  type="text"
                  autoComplete="off"
                  required
                  value={loginId}
                  onChange={e => setLoginId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-md border border-[var(--hrs-line)] bg-[var(--hrs-bg)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--hrs-accent)] focus:border-[var(--hrs-accent)] transition-colors text-sm"
                  placeholder="아이디를 입력하세요"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--hrs-ink)]">비밀번호</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-md border border-[var(--hrs-line)] bg-[var(--hrs-bg)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--hrs-accent)] focus:border-[var(--hrs-accent)] transition-colors text-sm"
                  placeholder="비밀번호를 입력하세요"
                />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="rememberId"
                  checked={rememberId}
                  onChange={(e) => setRememberId(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--hrs-line)] accent-[var(--hrs-accent)]"
                />
                <label htmlFor="rememberId" className="text-sm text-[var(--hrs-slate)] cursor-pointer">
                  아이디 저장
                </label>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 mt-2 bg-[var(--hrs-accent)] hover:brightness-110 text-white font-semibold rounded-md transition-all text-sm"
              >
                로그인
              </button>
            </form>
          </CardContent>
        </Card>
        
        <p className="text-xs text-center mt-8 text-gray-400">
          인가된 계정만 접속 가능합니다.
        </p>
      </div>
    </div>
  );
}
