import { SkeletonRegion } from '@/components/Skeleton';
// 칸 모양 CSS는 이 대기 화면이 직접 부른다 — 화면(HomePage)만 부르면 첫 방문 때 페이지 코드보다 대기 화면이 먼저 그려져
// 골격이 스타일 없이(목록처럼) 0.3초 보였다(/ux-review Preview b5d2fc7 · 2026-10-17 KST).
import '@/components/learn/learn.css';
import ResumeTile from '@/components/learn/ResumeTile';
import ParagraphTile from '@/components/learn/ParagraphTile';
import { GoalTrackSkeleton } from '@/components/learn/GoalTrackTile';
import { ReviewTile, StatTile } from '@/components/learn/LearnTiles';

/**
 * 배움 대기 화면(LOADING-SKELETON-001 — 오너 승인 2026-10-17 KST). 라우트 대기(약 0.15초) 동안 전역 스피너 대신
 * 배움 칸 배치 그대로 — 화면이 받는 중에 그리는 골격(ResumeTile · ReviewTile · ParagraphTile pending, GoalTrackSkeleton)을
 * 같은 부품으로 쓴다. 그래서 대기 화면 → 화면 첫 렌더 → 데이터 순서로 칸이 바뀌어도 자리가 같다.
 * 연속 · 오늘 목표는 값이 없으면 원래 「–」다(거짓 0 없음 — 0 무표기 선례).
 */
export default function Loading() {
  return (
    <SkeletonRegion className="manabi-page learn-page" label="배움 화면" announce>
      <div className="learn-top" aria-hidden="true">
        <div className="learn-top__title"><h1>배움</h1></div>
        <span className="learn-toplink">현황 전체 →</span>
      </div>
      <div className="learn-grid" aria-hidden="true">
        <ResumeTile pending />
        <div className="learn-quad learn-order-status">
          <GoalTrackSkeleton />
          <StatTile value="–" label="오늘 목표" />
          <StatTile value="–" label="연속" />
        </div>
        <ReviewTile className="learn-order-review" pending />
        <ParagraphTile state={{ kind: 'empty' }} href="/study" pending />
      </div>
    </SkeletonRegion>
  );
}
