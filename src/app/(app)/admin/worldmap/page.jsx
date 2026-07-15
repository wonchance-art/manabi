import WorldMapPage from '@/views/WorldMapPage';

export const metadata = {
  title: '전체 맵 뷰어 | Anatomy Studio',
  description: '전국 월드와 도시 정밀맵을 선택해 줌·팬으로 훑어보는 관리자 전용 뷰어.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <WorldMapPage />;
}
