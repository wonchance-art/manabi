import WorldMapPage from '@/views/WorldMapPage';

export const metadata = {
  title: '전체 맵 뷰어 | Anatomy Studio',
  description: '학습 월드 전체 지도를 줌·팬으로 훑어보는 관리자 전용 뷰어 — 노드 배치·콘텐츠 마운트 계획용.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <WorldMapPage />;
}
