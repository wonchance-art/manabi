import { publicMetadata } from '@/lib/seo';

// 「함께 읽는 글」 탭 제목 · 설명(VIEWER-SEO-001 — 오케스트레이터 (나) 2026-11-08 KST). 예전엔 산책 메타를 그대로 다시 내보내 탭이 「산책」, h1은
// 「함께 읽는 글」로 어긋났다. 정본은 산책(/discover) 그대로 — 이 화면은 산책의 갈래(?view=reading)이고, 자료 한 편 한 편은 사이트 지도로 발견된다.
// page.jsx에 두지 않는다 — 첫 화면 한글 하위 집합(kr-viewer-chars reading)이 page.jsx의 한글을 세어, 그리지 않는 문구가 미리 받는 글꼴에 들어간다.
export const metadata = publicMetadata('/discover', {
  title: '함께 읽는 글',
  description: '누구나 읽을 수 있는 일본어 · 영어 · 중국어 읽기 자료예요. 모르는 말은 눌러서 뜻과 발음을 보며 읽어요.',
});
