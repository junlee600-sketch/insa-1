import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut, signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { logger } from '../lib/logger';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  department: string;
  position?: string;
  role: 'admin' | 'hr' | 'user';
  menuPermissions?: Record<string, boolean>;
  confirmDepartments?: string[];
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authError: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const userDocUnsub = useRef<(() => void) | null>(null);

  useEffect(() => {
    let authUnsub: () => void;

    const initializeAuth = async () => {
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (error) {
        logger.error("Failed to set persistence:", error);
      }

      authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
        // 이전 사용자 문서 리스너 해제
        if (userDocUnsub.current) {
          userDocUnsub.current();
          userDocUnsub.current = null;
        }

        setAuthError('');

        if (!firebaseUser?.email) {
          setUser(null);
          setLoading(false);
          return;
        }

        const email = firebaseUser.email.toLowerCase();
        const userDocRef = doc(db, 'users', email);

        // 실시간 리스너로 사용자 문서 구독 (권한 변경 즉시 반영)
        userDocUnsub.current = onSnapshot(userDocRef, async (snap) => {
          try {
            if (!snap.exists()) {
              await signOut(auth);
              setUser(null);
              setAuthError('등록되지 않은 계정입니다. 관리자에게 문의하세요.');
              return;
            }

            const data = snap.data();

            // 퇴직 처리된 계정은 즉시 로그아웃
            if (data.status === 'retired') {
              await signOut(auth);
              setUser(null);
              setAuthError('접속이 차단되었습니다. 관리자에게 문의하세요.');
              return;
            }

            const appUser: AppUser = { uid: firebaseUser.uid, ...data } as AppUser;

            if (data.uid !== firebaseUser.uid) {
              await setDoc(userDocRef, { uid: firebaseUser.uid }, { merge: true });
            }

            setUser(appUser);
          } catch (err: any) {
            logger.error("User doc sync error:", err);
            const code: string = err?.code || '';
            if (code.includes('offline') || code.includes('unavailable')) {
              setAuthError('네트워크 연결을 확인해 주세요. (offline)');
            } else if (code.includes('permission-denied')) {
              setAuthError('접근 권한이 없습니다.');
            } else {
              setAuthError('데이터 동기화 오류가 발생했습니다.');
            }
            setUser(null);
          } finally {
            setLoading(false);
          }
        }, (err) => {
          logger.error("Snapshot error:", err);
          setUser(null);
          setLoading(false);
        });
      });
    };

    initializeAuth();

    return () => {
      if (authUnsub) authUnsub();
      if (userDocUnsub.current) userDocUnsub.current();
    };
  }, []);

  useEffect(() => {
    let absoluteTimer: NodeJS.Timeout;
    let interval: NodeJS.Timeout;

    const checkTimeout = () => {
      const currentUser = auth.currentUser;
      if (user && currentUser && currentUser.metadata.lastSignInTime) {
        const loginTime = new Date(currentUser.metadata.lastSignInTime).getTime();
        const now = Date.now();
        const timeoutDuration = 3 * 60 * 60 * 1000; // 3 hours
        const timeElapsed = now - loginTime;

        if (timeElapsed >= timeoutDuration) {
          logout();
          alert('보안을 위해 로그인 후 3시간이 경과되어 자동 로그아웃 되었습니다.');
        } else {
          absoluteTimer = setTimeout(() => {
            logout();
            alert('보안을 위해 로그인 후 3시간이 경과되어 자동 로그아웃 되었습니다.');
          }, timeoutDuration - timeElapsed);
        }
      }
    };

    checkTimeout();

    if (user) {
      interval = setInterval(() => {
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.metadata.lastSignInTime) {
          const loginTime = new Date(currentUser.metadata.lastSignInTime).getTime();
          if (Date.now() - loginTime >= 3 * 60 * 60 * 1000) {
            logout();
            alert('보안을 위해 로그인 후 3시간이 경과되어 자동 로그아웃 되었습니다.');
          }
        }
      }, 60000);
    }

    return () => {
      clearTimeout(absoluteTimer);
      clearInterval(interval);
    };
  }, [user]);

  const login = async (email: string, password: string) => {
    await setPersistence(auth, browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, authError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
