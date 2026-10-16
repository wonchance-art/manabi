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

/**
 * 골격 영역(LOADING-SKELETON-001 — 오너 승인 2026-10-17 KST): 대기 화면을 스피너 대신 실제 화면의 칸 모양으로.
 * aria-busy="true" + 화면 읽기용 한 줄 「〔무엇〕 불러오는 중…」(문구 표준). 칸 모양은 children이 **실제 화면 클래스**로
 * 흉내 내야 데이터가 들어올 때 높이가 튀지 않는다(CLS). 칸 자체는 aria-hidden으로 둔다 — 읽을 내용이 없다.
 * 알림은 한 묶음에 한 번: announce(라우트 대기 화면 · 목록 하나)만 role="status"를 **aria-busy 밖**에 둔다 — busy 안의
 * 변화는 화면 읽기가 미루고, 칸마다 status를 달면 네 칸이 한꺼번에 읽힌다. 칸 단위는 같은 한 줄을 읽을 수만 있게(live 아님) 둔다.
 */
export function SkeletonRegion({ as: Tag = 'div', label, className, children, announce = false, ...rest }) {
  const line = `${label} 불러오는 중…`;
  const region = (
    <Tag className={className} aria-busy="true" {...rest}>
      {!announce && <span className="skeleton-sr">{line}</span>}
      {children}
    </Tag>
  );
  if (!announce) return region;
  return <><span className="skeleton-sr" role="status">{line}</span>{region}</>;
}

/**
 * 글줄 자리 — 글자 대신 줄 안에 앉는 회색 칸(inline-block · 가운데 정렬). 감싼 요소(h3 · p …)의 줄 높이가 그대로
 * 살아 실제 글이 들어와도 높이가 같다. 색은 .skeleton-line(토큰), 크기만 받는다.
 */
export function SkeletonLine({ width = '60%', height = '0.8em', className = '' }) {
  return <span aria-hidden="true" className={`skeleton-line skeleton-line--inline ${className}`.trim()} style={{ width, height }} />;
}
