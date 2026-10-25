import { SkeletonRegion } from '@/components/Skeleton';
import { GUEST_RESUME_GLYPH } from '@/lib/learnDashboard';
// 칸 모양 CSS는 대기 화면이 직접 부른다 — 화면(HomePage)만 부르면 첫 방문 때 페이지 코드보다 대기 화면이 먼저 그려져
// 골격이 스타일 없이(목록처럼) 0.3초 보였다(/ux-review Preview b5d2fc7 · 2026-10-17 KST).
import '@/components/learn/learn.css';
import ResumeTile from '@/components/learn/ResumeTile';
import ParagraphTile from '@/components/learn/ParagraphTile';
import { GoalTrackSkeleton } from '@/components/learn/GoalTrackTile';
import { GuestLoginTile, ReviewTile, StatTile } from '@/components/learn/LearnTiles';

/**
 * 배움 대기 화면(LOADING-SKELETON-001 — 오너 승인 2026-10-17 KST). 라우트 대기(약 0.15초) 동안 전역 스피너 대신
 * 배움 칸 배치 그대로 — 화면이 받는 중에 그리는 골격(ResumeTile · ReviewTile · ParagraphTile pending, GoalTrackSkeleton)을
 * 같은 부품으로 쓴다. 그래서 대기 화면 → 화면 첫 렌더 → 데이터 순서로 칸이 바뀌어도 자리가 같다.
 * 연속 · 오늘 목표는 값이 없으면 원래 「–」다(거짓 0 없음 — 0 무표기 선례).
 *
 * 손님 / 로그인 두 골격(B1 — 오너 승인 목업 ①, 2026-10-17 KST). 예전엔 대기 화면이 세션 쿠키를 읽어 골랐다. 이제(GUEST-STATIC-001 4단계)
 * middleware가 세션 쿠키 유무로 배움 판을 고르고(/home = 손님 · /home/member = 로그인), 판마다 자기 대기 화면이 이 둘 중 하나를 그린다 —
 * 판정은 같은 함수(hasSupabaseSessionInJar)이고 대기 화면은 쿠키를 읽지 않는다.
 */
export function GuestHomeSkeleton() {
  // 손님 배움 배치 — 이어 읽기 · 오늘 문단(맛보기) 한 줄, 아래 로그인 칸. 로그인 배치 골격이 0.7초 보였다가 손님 화면으로 바뀌던 것.
  return (
    <SkeletonRegion className="manabi-page learn-page" label="배움 화면" announce>
      <div className="learn-top" aria-hidden="true"><div className="learn-top__title"><h1>배움</h1></div></div>
      <div className="learn-grid" aria-hidden="true">
        {/* 손님 장식 글자는 화면 골격과 같다(HOME-GLYPH-LCP-001) — 대기 화면 → 화면으로 바뀌어도 글자가 깜빡이지 않는다. */}
        <ResumeTile pending glyph={GUEST_RESUME_GLYPH} />
        <ParagraphTile state={{ kind: 'empty' }} href="/study" kicker="오늘 문단 · 맛보기" pending />
        <GuestLoginTile />
      </div>
    </SkeletonRegion>
  );
}

export function MemberHomeSkeleton() {
  return (
    <SkeletonRegion className="manabi-page learn-page" label="배움 화면" announce>
      <div className="learn-top" aria-hidden="true">
        {/* 칩 자리 — 칩은 계정 학습 언어를 받은 뒤에 그려진다. 좁은 화면(셸 480 이하)은 칩이 둘째 줄이라 빈 자리(44)를 먼저 둔다. */}
        <div className="learn-top__title"><h1>배움</h1><span className="learn-chips" /></div>
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
