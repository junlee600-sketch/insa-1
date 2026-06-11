import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut, signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { logger } from '../lib/logger';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  department: string;
  position?: string;
  role: 'admin' | 'hr' | 'user';
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

  useEffect(() => {
    let unsubscribe: () => void;

    const initializeAuth = async () => {
      try {
        // Set persistence to session so that closing the tab logs the user out
        await setPersistence(auth, browserSessionPersistence);
      } catch (error) {
        logger.error("Failed to set persistence:", error);
      }

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        try {
          setAuthError('');
          if (firebaseUser) {
            const email = firebaseUser.email;
            if (!email) {
              setUser(null);
              setLoading(false);
              return;
            }
            
            const userDocRef = doc(db, 'users', email.toLowerCase());
            const userDoc = await getDoc(userDocRef);

            let appUser: AppUser;

            if (userDoc.exists()) {
              appUser = { uid: firebaseUser.uid, ...userDoc.data() } as AppUser;
              // Ensure uid is stored/updated
              if (userDoc.data().uid !== firebaseUser.uid) {
                await setDoc(userDocRef, { uid: firebaseUser.uid }, { merge: true });
              }
            } else {
              // 등록되지 않은 계정은 접근 차단
              await signOut(auth);
              setUser(null);
              setLoading(false);
              setAuthError('등록되지 않은 계정입니다. 관리자에게 문의하세요.');
              return;
            }
            setUser(appUser);
          } else {
            setUser(null);
          }
        } catch (err: any) {
          logger.error("Auth sync error:", err);
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
      });
    };

    initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
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
