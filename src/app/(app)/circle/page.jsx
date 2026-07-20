import FocusCirclePage from '@/views/FocusCirclePage';

export const metadata = {
  title: '함께 집중 — Anatomy Studio',
  description: '친구와 매주 집중하고, 기록하고, 한 달의 방향을 함께 돌아보세요.',
  openGraph: {
    title: '함께 집중 — Anatomy Studio',
    description: '매주 실행하고 매월 방향을 나누는 작은 성장 공동체',
  },
};

export default function Page() {
  return <FocusCirclePage />;
}
