import { SkeletonLine, SkeletonRegion } from '@/components/Skeleton';

/**
 * 산책 대기 화면(LOADING-SKELETON-001 — 오너 승인 2026-10-17 KST · 큰 칸 셋 DISCOVER-CLASSICS-001 2026-10-22 KST). 탭을 누르면 서버가
 * 소식 · 고전 명작을 모으는 동안 「화면 불러오는 중…」 스피너가 0.25~0.4초 보이던 자리다. 실제 화면(page.jsx · DiscoverTiles)의 **같은 클래스**로
 * 골격을 그린다 — 늘 같은 글(제목 「산책」 · 칸 이름 · 「첫 호 준비 중」)은 글자 그대로, 바뀌는 글만 회색 줄.
 * 칸은 누를 수 없는 div(초점 · 이동 없음)라 실제 칸 스타일(`.discover-tile`)을 그대로 받는다.
 * 「함께 읽는 글」 줄은 그리지 않는다 — 실제 화면은 공개 글이 1편 이상일 때만 그 줄을 둔다(publicCount > 0).
 */
export default function Loading() {
  return (
    <SkeletonRegion className="manabi-page manabi-discover" label="산책 화면" announce>
      {/* 제목은 실제 화면이 들어오며 다시 그린다 — 대기 중엔 화면 읽기에 숨겨 「산책」이 두 번 읽히지 않게(배움 · 서재 대기와 같다). */}
      <header className="manabi-page-heading" aria-hidden="true"><h1>산책</h1></header>
      <section className="discover-tiles" aria-hidden="true">
        <div className="discover-tile discover-tile--news">
          <span className="discover-tile__head"><span className="discover-tile__kicker">오늘 화제</span><span className="discover-tile__big"><SkeletonLine width="4.5em" /></span></span>
          <span className="discover-tile__body"><strong className="discover-tile__title"><SkeletonLine width="90%" /><br /><SkeletonLine width="60%" /></strong><span className="discover-tile__sub"><SkeletonLine width="7em" /></span></span>
        </div>
        <div className="discover-tile discover-tile--classics">
          <span className="discover-tile__head"><span className="discover-tile__kicker">고전 명작</span><span className="discover-tile__big"><SkeletonLine width="2.5em" /></span></span>
          <span className="discover-tile__body"><span className="discover-tile__covers">{[0, 1, 2].map(i => <span key={i} className="discover-tile__cover discover-tile__cover--blank" />)}</span></span>
        </div>
        <div className="discover-tile discover-tile--magazine">
          <span className="discover-tile__head"><span className="discover-tile__kicker">여행 매거진</span></span>
          <span className="discover-tile__body"><strong className="discover-tile__title">첫 호 준비 중</strong></span>
        </div>
      </section>
    </SkeletonRegion>
  );
}
