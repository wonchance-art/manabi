import WorldPage from '@/views/WorldPage';

export const metadata = {
  title: '학습 월드 (실험) | Anatomy Studio',
  description: '캐릭터를 움직이며 돌아다니는 2D 학습 월드 실험 기능 (관리자 전용).',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <WorldPage />;
}
