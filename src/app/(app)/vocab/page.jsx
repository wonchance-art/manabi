import VocabPage from '@/views/VocabPage';

export const metadata = {
  title: '단어장 | Anatomy Studio',
  description: 'FSRS v4 알고리즘으로 과학적인 단어 복습. 나만의 단어장을 관리하세요.',
  openGraph: { title: '단어장 | Anatomy Studio', description: 'FSRS v4 알고리즘 기반 과학적 단어 복습' },
};

export default function Page() {
  return <VocabPage />;
}
