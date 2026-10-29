import SuggestionStaticPage from '@/components/materials/SuggestionStaticPage';

// 추천 읽을거리 한 편 · 돌아갈 곳 「home」 판(GUEST-STATIC-001 6단계) — middleware가 /suggestions/<id>?from=home를 여기로 넘긴다(주소창은 그대로).
// 주기 · 내용은 ../../page.jsx와 같고 「← 돌아가기」 링크만 다르다. 돌아갈 곳마다 고정 폴더다 — [from] 하나로 받으면 표 밖 값의 notFound()가
// (app) 로딩 경계 안에서 나와 HTTP 200이 된다(e2e 빌드 실측). 고정 폴더면 표 밖 값은 예전처럼 없는 주소(404)다.
// 세그먼트 설정은 파일마다 글자 그대로 둔다(Next가 이 파일의 export를 읽는다 — 다시 내보내기는 읽지 않는다).
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() { return []; }
export const metadata = { title: '추천 읽을거리' };

export default async function Page({ params }) {
  const { id } = await params;
  return <SuggestionStaticPage id={id} from="home" />;
}
