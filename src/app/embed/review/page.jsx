// 🔌 임베드 복습 라우트 — 게더타운 등 외부 서비스의 iframe 오브젝트에 우리 앱의
// due 어휘 복습을 그대로 꽂기 위한 범용 엔드포인트.
//
// 배치 근거:
//   · (app) 그룹 "밖"에 둔다 → 앱 셸/네비게이션(components/Layout) 없이 위젯만 단독으로 뜬다.
//     (루트 layout.jsx의 Providers — QueryClient·Toast·Auth — 는 그대로 상속되므로 세션·쿼리는 정상 동작)
//   · 프레이밍 허용 헤더는 next.config.mjs의 '/embed/:path*' 엔트리가 담당한다.
//   · 채점·SRS 규약은 신규 도입 없이 QuestReview(=fsrs.js + logReviewEvents + due 조회)를 그대로 재사용한다.

import EmbedReviewClient from './EmbedReviewClient';

// 임베드 위젯은 검색 노출 대상이 아니다(외부 iframe 전용) → noindex.
export const metadata = {
  title: '즉석 복습',
  robots: { index: false, follow: false },
};

export default function EmbedReviewPage() {
  return <EmbedReviewClient />;
}
