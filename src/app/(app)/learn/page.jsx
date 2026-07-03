import LearnPage from '@/views/LearnPage';

export const metadata = {
  title: '학습 | Anatomy Studio',
  description: '오늘의 학습과 연습을 한곳에서 시작하세요.',
  openGraph: { title: '학습 | Anatomy Studio', description: '오늘의 학습과 연습을 한곳에서' },
};

export default function Page() {
  return <LearnPage />;
}
