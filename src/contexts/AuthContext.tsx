import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut, signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

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
        console.error("Failed to set persistence:", error);
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
              appUser = {
                uid: firebaseUser.uid,
                email: email.toLowerCase(),
                name: firebaseUser.displayName || '시스템 관리자',
                department: '관리부',
                role: 'admin',
              };
              await setDoc(userDocRef, {
                uid: appUser.uid,
                email: appUser.email,
                name: appUser.name,
                department: appUser.department,
                role: appUser.role,
                createdAt: serverTimestamp()
              });
            }
            setUser(appUser);
          } else {
            setUser(null);
          }
        } catch (err: any) {
          console.error("Auth sync error:", err);
          setAuthError(err.message || '데이터 동기화 오류');
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
        const oneHour = 60 * 60 * 1000;
        const timeElapsed = now - loginTime;

        if (timeElapsed >= oneHour) {
          logout();
          alert('보안을 위해 로그인 후 1시간이 경과되어 자동 로그아웃 되었습니다.');
        } else {
          absoluteTimer = setTimeout(() => {
            logout();
            alert('보안을 위해 로그인 후 1시간이 경과되어 자동 로그아웃 되었습니다.');
          }, oneHour - timeElapsed);
        }
      }
    };

    checkTimeout();

    if (user) {
      interval = setInterval(() => {
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.metadata.lastSignInTime) {
          const loginTime = new Date(currentUser.metadata.lastSignInTime).getTime();
          if (Date.now() - loginTime >= 60 * 60 * 1000) {
            logout();
            alert('보안을 위해 로그인 후 1시간이 경과되어 자동 로그아웃 되었습니다.');
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
