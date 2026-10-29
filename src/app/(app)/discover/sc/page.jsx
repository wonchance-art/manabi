import { ScFontLink } from '@/components/fonts/ScFontLink';
import DiscoverPage from '../page';

// 산책 · 간체 힌트 변형(GUEST-STATIC-001 2단계) — 중국어 학습자 힌트 쿠키(manabi_sc)가 있으면 middleware가 /discover를 여기로 넘긴다.
// 같은 화면에 간체 독립 스타일시트를 첫 그림 전에 건다(SC-LINK-001 2단계 C — 예전 discover/layout의 ScFontCookieHint가 하던 일).
// 이 변형도 쿠키를 읽지 않는다 — 고르는 것은 middleware, 이 판은 늘 링크를 싣는다. 그래서 두 판 다 ISR로 공유 캐시에 맡긴다.
// 바로 열어도 같은 판이다 — 정본 주소는 canonical(/discover, 기본 판과 같은 metadata)이 알린다.
export const revalidate = 300;
export { metadata } from '../page';
export default function Page() {
  return <><ScFontLink /><DiscoverPage /></>;
}
