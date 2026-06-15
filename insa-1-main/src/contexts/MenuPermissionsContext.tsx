import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export type RolePerms = { admin: boolean; hr: boolean; user: boolean };

export const DEFAULT_PERMS: Record<string, RolePerms> = {
  "/": { admin: true, hr: true, user: true },
  "/evaluate": { admin: true, hr: true, user: true },
  "/evaluate-executive": { admin: true, hr: true, user: false },
  "/history": { admin: true, hr: true, user: false },
  "/admin/items": { admin: true, hr: true, user: false },
  "/admin/items-executive": { admin: true, hr: true, user: false },
  "/admin/assignments": { admin: true, hr: true, user: false },
  "/admin/assignments-executive": { admin: true, hr: true, user: false },
  "/admin/results": { admin: true, hr: true, user: false },
  "/admin/results-executive": { admin: true, hr: true, user: false },
  "/admin/users": { admin: true, hr: false, user: false },
  "/admin/settings": { admin: true, hr: false, user: false },
  "/admin/menu-permissions": { admin: true, hr: false, user: false },
};

interface MenuPermissionsContextType {
  perms: Record<string, RolePerms>;
  loaded: boolean;
}

const MenuPermissionsContext = createContext<MenuPermissionsContextType>({
  perms: DEFAULT_PERMS,
  loaded: false,
});

export function MenuPermissionsProvider({ children }: { children: ReactNode }) {
  const [perms, setPerms] = useState<Record<string, RolePerms>>(DEFAULT_PERMS);
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'settings', 'menuPermissions'), snap => {
      setPerms(snap.exists() ? { ...DEFAULT_PERMS, ...(snap.data() as Record<string, RolePerms>) } : DEFAULT_PERMS);
      setLoaded(true);
    }, () => {
      // 읽기 실패 시 기본값 사용
      setLoaded(true);
    });
    return unsub;
  }, [user]);

  return (
    <MenuPermissionsContext.Provider value={{ perms, loaded }}>
      {children}
    </MenuPermissionsContext.Provider>
  );
}

export const useMenuPermissions = () => useContext(MenuPermissionsContext);
