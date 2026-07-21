export type SortDir = 'asc' | 'desc';

/**
 * 표 정렬용 값 비교.
 * - 숫자끼리는 숫자 크기로 비교 (문자열 비교 시 10 < 9 가 되는 문제 방지)
 * - 그 외는 한국어 로케일 기준 (가나다순)
 * - 빈값(null/undefined/'')은 정렬 방향과 무관하게 항상 뒤로 보낸다
 */
export function compareValues(a: unknown, b: unknown, dir: SortDir): number {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const sign = dir === 'asc' ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return sign * (a - b);
  return sign * String(a).localeCompare(String(b), 'ko', { numeric: true });
}

/** key 가 없으면 원본 순서 유지. 있으면 해당 필드 기준으로 정렬한 새 배열 반환. */
export function sortRows<T extends Record<string, any>>(rows: T[], key: string | null, dir: SortDir): T[] {
  if (!key) return rows;
  return [...rows].sort((x, y) => compareValues(x[key], y[key], dir));
}
