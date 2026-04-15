/**
 * 공통 로딩 스켈레톤 — 페이지간 일관 로딩 UI
 * 기존 .skeleton, .skeleton-line 클래스 활용
 */

export function CardSkeleton({ height = 120 }) {
  return (
    <div className="skeleton--card" style={{ height }}>
      <div className="skeleton-line skeleton-line--title" />
      <div className="skeleton-line skeleton-line--text" />
      <div className="skeleton-line skeleton-line--short" />
    </div>
  );
}

export function CardGridSkeleton({ count = 6, height = 140 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} height={height} />
      ))}
    </div>
  );
}

export function RowSkeleton({ count = 3 }) {
  return (
    <div className="u-col u-col--gap-md">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton--card" style={{ padding: 14, display: 'flex', gap: 12 }}>
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton-line skeleton-line--title" style={{ width: '40%' }} />
            <div className="skeleton-line skeleton-line--text" />
          </div>
        </div>
      ))}
    </div>
  );
}
