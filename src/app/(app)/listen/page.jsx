import ListenLabPage from '@/views/ListenLabPage';

export const metadata = {
  title: '듣고 읽기 (실험) | Anatomy Studio',
  description: 'YouTube 영상 + 내 자막으로 표현을 모으는 실험 기능 (관리자 전용).',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ListenLabPage />;
}
