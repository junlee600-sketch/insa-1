// 연차(근속) 계산 유틸
// - 입력·표시는 "연차(년/개월)"로 하되, 내부적으로 기준앵커(YYYY-MM-01)를 저장해
//   매월 1일 기준으로 자동 증가하도록 한다. (만 근속: 1년 미만 = 0년 N개월)

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// 연차(년/개월) → 기준앵커 날짜 문자열. 이번 달 1일에서 (년×12+개월) 만큼 뺀 달의 1일.
export function anchorFromService(years: number, months: number, ref: Date = new Date()): string {
  const base = firstOfMonth(ref);
  const total = (years || 0) * 12 + (months || 0);
  const anchor = new Date(base.getFullYear(), base.getMonth() - total, 1);
  const y = anchor.getFullYear();
  const m = String(anchor.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

// 기준앵커 → 현재 연차(년/개월). 이번 달 1일 기준, 만 근속.
export function serviceFromAnchor(anchor: string, ref: Date = new Date()): { years: number; months: number } {
  const parts = anchor.split('-').map(Number);
  const ay = parts[0];
  const am = parts[1]; // 1~12
  if (!ay || !am) return { years: 0, months: 0 };
  const base = firstOfMonth(ref);
  let total = (base.getFullYear() * 12 + base.getMonth()) - (ay * 12 + (am - 1));
  if (total < 0) total = 0;
  return { years: Math.floor(total / 12), months: total % 12 };
}

// 사용자 문서 → 표시용 연차. 앵커가 있으면 자동계산, 없으면 수동값(fallback).
export function userService(u: any): { years: number | null; months: number | null } {
  if (u?.serviceAnchor) {
    const s = serviceFromAnchor(u.serviceAnchor);
    return { years: s.years, months: s.months };
  }
  return {
    years: u?.yearsOfService ?? null,
    months: u?.serviceMonths ?? null,
  };
}

// "N년 M개월" 표시 (둘 다 없으면 '-')
export function formatService(years: number | null | undefined, months: number | null | undefined): string {
  if (years == null && months == null) return '-';
  const y = years ?? 0;
  const m = months || 0;
  return `${y}년${m ? ` ${m}개월` : ''}`;
}
