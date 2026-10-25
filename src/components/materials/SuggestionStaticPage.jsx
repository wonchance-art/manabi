import SuggestionReader from './SuggestionReader';
import { prefetchSuggestion } from '@/lib/server/suggestionReading';

// 추천 읽을거리 한 편의 판(ISR, GUEST-STATIC-001 6단계 · FIELD-AUDIT F5) — 본문을 첫 HTML에 싣는다.
// 예전에는 하이드레이션 뒤 브라우저가 /api/suggestions/[id]를 받아서야 본문을 그렸다(운영 cold LCP 2.5–2.6 s).
// 서버는 쿠키 없는 anon 클라이언트로 공개 행만 읽어(/api/suggestions/[id]와 같은 readSuggestion) 리더 쿼리의 첫 값(initialData)으로 넘긴다 —
// 브라우저 첫 그림이 곧 지금의 최종 화면이다. 서재 담기 · 로그인 갈래는 브라우저가 useAuth로 그린다(판에는 계정 데이터가 없다).
// HydrationBoundary(dehydrate)는 쓰지 않는다 — 그 부품을 이 판에 들이면 webpack 묶음이 갈려 산책 첫 JS가 113 → 127 kB로 늘었다(e2e 빌드 실측).
// 없는 글 · 조회 실패 · 시간 초과면 첫 값이 없다 → 브라우저가 지금처럼 받는다(「펼치고 있어요」 → 안내 · 다시 시도까지 그대로).
export default async function SuggestionStaticPage({ id, from }) {
  const initial = await prefetchSuggestion(id);
  return <SuggestionReader key={id} id={id} from={from} initial={initial?.data} initialAt={initial?.at} />;
}
