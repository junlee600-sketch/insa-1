export type SortDir = 'asc' | 'desc';

/**
 * 표 헤더용 정렬 버튼.
 * 같은 컬럼을 다시 누르면 오름차순 ↔ 내림차순이 토글된다.
 */
export function SortHeader({
  label,
  colKey,
  sortKey,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string;
  colKey: string;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  align?: 'left' | 'right';
}) {
  const active = sortKey === colKey;
  return (
    <button
      type="button"
      onClick={() => onSort(colKey)}
      title={`${label} 기준 정렬`}
      aria-label={`${label} 기준 정렬`}
      className={`flex items-center gap-1 w-full font-semibold uppercase tracking-[0.04em] transition-colors hover:text-[var(--hrs-ink)] ${
        align === 'right' ? 'justify-end' : 'text-left'
      } ${active ? 'text-[var(--hrs-ink)]' : ''}`}
    >
      <span className="truncate">{label}</span>
      <span className={`text-[9px] leading-none shrink-0 ${active ? 'opacity-100' : 'opacity-30'}`}>
        {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </button>
  );
}
