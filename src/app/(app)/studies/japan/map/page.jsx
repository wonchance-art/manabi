import JapanStudiesMapPage from '@/views/JapanStudiesMapPage';

export const metadata = {
  title: '일본학 지도',
  description: '식문화·역사·문학·예술·신앙 — 일본학 심층 문서의 장소들을 테마별 핀으로 탐색하는 지도.',
};

// 페이지 전체를 Suspense로 감싸지 않는다 — ?pin= 쿼리는 JapanStudiesMapPage 안의 작은 자식(PinFromQuery)만
// 자기 Suspense 경계에서 읽어, 제목·지도·목록은 정적으로 먼저 그려진다.
export default function Page() {
  return <JapanStudiesMapPage />;
}
