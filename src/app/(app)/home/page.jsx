import HomePage from '@/views/HomePage';

export const metadata = {
  title: '홈 — Anatomy Studio',
  description: '나의 학습 현황과 오늘의 추천 자료를 확인하세요.',
  openGraph: { title: '홈 — Anatomy Studio', description: '나의 학습 현황과 오늘의 추천 자료' },
};

export default function Page() {
  return <HomePage />;
}
