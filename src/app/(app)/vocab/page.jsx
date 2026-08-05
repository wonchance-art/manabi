import VocabPage from '@/views/VocabPage';

export const metadata = {
  title: '복습 | Anatomy Studio',
  description: '단어와 문법을 한곳에서 — FSRS 간격 반복으로 돌아온 것만 골라 복습해요.',
  openGraph: { title: '복습 | Anatomy Studio', description: 'FSRS v4 알고리즘 기반 과학적 단어 복습' },
};

export default function Page() {
  return <VocabPage />;
}
