import { SkeletonLine, SkeletonRegion } from '@/components/Skeleton';

/**
 * 서재 골격(LOADING-SKELETON-001 — 오너 승인 2026-10-17 KST). 「서재를 열고 있어요…」 · 「읽던 곳을 확인하고 있어요…」 ·
 * 「자료 목록 불러오는 중…」 한 줄이 서 있다가 목록이 들어오며 아래가 한꺼번에 밀리던 자리다. 실제 줄(LibraryRow) ·
 * 읽던 곳 카드(RecentReads)와 같은 치수 규칙(library.css가 .shelf-row-skeleton · .shelf-recent-skeleton을 함께 받는다)으로 그려
 * 자리 높이를 맞춘다. 줄 · 카드 클래스 자체는 다르게 둔다 — 실제 자료 줄(.shelf-row)을 세는 곳이 골격을 자료로 세지 않게. 표지는 같은 크기의 회색 칸(.shelf-cover 치수).
 */
export function ShelfRowsSkeleton({ count = 4 }) {
  return (
    <SkeletonRegion label="자료 목록">
      <ul className="shelf-rows" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => <li key={i} className="shelf-row-skeleton">
          <div className="shelf-row-main"><div className="shelf-row-link">
            <span className="shelf-cover shelf-cover--skeleton skeleton" />
            <div className="shelf-row-copy">
              <h3><SkeletonLine width={`${[62, 48, 70, 40][i % 4]}%`} /></h3>
              <small><SkeletonLine width="9em" /></small>
            </div>
          </div><span className="shelf-row-menu" /></div>
        </li>)}
      </ul>
    </SkeletonRegion>
  );
}

export function RecentReadsSkeleton() {
  return (
    <SkeletonRegion as="section" className="shelf-recent" label="읽던 곳">
      <div className="shelf-section-heading" aria-hidden="true"><h2>읽던 곳에서</h2></div>
      <div className="shelf-recent-grid" aria-hidden="true">
        {[0, 1, 2].map(i => <div key={i} className={`shelf-recent-skeleton${i ? ' shelf-recent-extra' : ''}`}>
          <span className="shelf-cover shelf-cover--skeleton skeleton" />
          <div>
            <small><SkeletonLine width="4em" /></small>
            <h3><SkeletonLine width="80%" /></h3>
            <p><SkeletonLine width="6em" /></p>
          </div>
        </div>)}
      </div>
    </SkeletonRegion>
  );
}

/** 로그인 확인 중(LibraryPage) — 머리줄 · 위치 목록 · 읽던 곳 · 목록 골격. 머리 글(「내 서재」)은 늘 같아서 글자 그대로. */
export function LibraryShelfSkeleton() {
  return (
    <SkeletonRegion className="shelf-layout shelf-managed" label="서재">
      <header className="shelf-header" aria-hidden="true">
        <h1>내 서재</h1>
        <form><SkeletonLine width="100%" height="20px" /></form>
        <SkeletonLine className="shelf-skeleton-button" width="7.5em" height="44px" />
      </header>
      <div className="shelf-workspace" aria-hidden="true">
        <nav className="shelf-folder-nav">{[3, 4, 3].map((w, i) => <span key={i} className="shelf-skeleton-nav"><SkeletonLine width={`${w}em`} /></span>)}</nav>
        <div className="shelf-content">
          <RecentReadsSkeleton />
          <section className="shelf-list-section">
            {/* 도구(정렬 · 필터 · 선택)는 44px 단추라 머리줄 높이를 정한다 — 같은 높이 칸을 둬야 목록이 밀리지 않는다(실측 +17px). */}
            <div className="shelf-section-heading"><h2>전체</h2><div className="shelf-list-tools"><SkeletonLine width="12em" height="44px" /></div></div>
            <ShelfRowsSkeleton />
          </section>
        </div>
      </div>
    </SkeletonRegion>
  );
}
