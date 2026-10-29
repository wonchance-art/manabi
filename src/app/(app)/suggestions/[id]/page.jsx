import SuggestionStaticPage from '@/components/materials/SuggestionStaticPage';

// 추천 읽을거리 한 편 — ISR 5분(GUEST-STATIC-001 6단계). /api/suggestions/[id]의 공유 캐시(s-maxage=300)와 같은 주기다:
// 행은 수집 크론(KST 자정)만 쓰고, 바뀌는 것은 연결 자료의 처리 완료 여부뿐이다. 빌드 때는 굽지 않고(id를 모른다) 첫 방문에 굽는다.
// 이 판은 돌아갈 곳이 서재(?from= 없음 · materials · 목록 밖 값)인 경우다. ?from=home · discover · reading은 middleware가
// /suggestions/<id>/from/<from> 판으로 넘긴다(주소창은 그대로) — 판은 쿼리를 읽지 않는다(읽으면 판이 동적이 된다).
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() { return []; }
export const metadata = { title: '추천 읽을거리' };

export default async function Page({ params }) {
  const { id } = await params;
  return <SuggestionStaticPage id={id} from="materials" />;
}
