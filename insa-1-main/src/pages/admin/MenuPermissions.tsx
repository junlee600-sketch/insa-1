import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const MENU_ITEMS = [
  { to: "/", label: "대시보드", category: "기본" },
  { to: "/evaluate", label: "내 평가 진행", category: "기본" },
  { to: "/evaluate-executive", label: "임원평가 진행", category: "기본" },
  { to: "/history", label: "내 평가 이력", category: "기본" },
  { to: "/admin/items", label: "평가 항목 관리", category: "관리 기능" },
  { to: "/admin/items-executive", label: "임원평가 항목 관리", category: "관리 기능" },
  { to: "/admin/assignments", label: "평가자 배정", category: "관리 기능" },
  { to: "/admin/assignments-executive", label: "임원평가 배정", category: "관리 기능" },
  { to: "/admin/results", label: "최종 평가 결과", category: "관리 기능" },
  { to: "/admin/results-executive", label: "임원평가 최종 결과", category: "관리 기능" },
  { to: "/admin/users", label: "사용자 관리", category: "시스템 설정" },
  { to: "/admin/settings", label: "평가 연도/그룹", category: "시스템 설정" },
  { to: "/admin/menu-permissions", label: "메뉴 권한 관리", category: "시스템 설정" },
];

const DEFAULT_PERMISSIONS: Record<string, { admin: boolean; hr: boolean; user: boolean }> = {
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

type Permissions = typeof DEFAULT_PERMISSIONS;

const ROLES: { key: 'admin' | 'hr' | 'user'; label: string }[] = [
  { key: 'admin', label: '관리자' },
  { key: 'hr', label: 'HR' },
  { key: 'user', label: '일반 사용자' },
];

export default function MenuPermissions() {
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, 'settings', 'menuPermissions'));
      if (snap.exists()) {
        setPermissions({ ...DEFAULT_PERMISSIONS, ...snap.data() as Permissions });
      }
    };
    load();
  }, []);

  const toggle = (path: string, role: 'admin' | 'hr' | 'user') => {
    if (role === 'admin' && path === '/admin/menu-permissions') return;
    setPermissions(prev => ({
      ...prev,
      [path]: { ...prev[path], [role]: !prev[path][role] },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await setDoc(doc(db, 'settings', 'menuPermissions'), permissions);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const grouped = MENU_ITEMS.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof MENU_ITEMS>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">메뉴 권한 관리</h2>
          <p className="text-sm text-gray-500 mt-1">메뉴별로 접근 가능한 역할을 설정합니다.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : saved ? '저장 완료!' : '저장'}
        </Button>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{category}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">메뉴</th>
                  {ROLES.map(r => (
                    <th key={r.key} className="text-center px-6 py-3 font-medium text-gray-500 w-28">{r.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr
                    key={item.to}
                    className={idx !== items.length - 1 ? 'border-b border-gray-50 dark:border-gray-800/50' : ''}
                  >
                    <td className="px-6 py-3 font-medium text-gray-800 dark:text-gray-200">{item.label}</td>
                    {ROLES.map(r => {
                      const locked = r.key === 'admin' && item.to === '/admin/menu-permissions';
                      return (
                        <td key={r.key} className="px-6 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={permissions[item.to]?.[r.key] ?? false}
                            onChange={() => toggle(item.to, r.key)}
                            disabled={locked}
                            className="w-4 h-4 rounded accent-gray-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
