import Link from 'next/link';
import VocabPage from '@/views/VocabPage';

export const metadata = {
  title: '복습',
  description: '단어와 문법을 한곳에서 — FSRS 간격 반복으로 돌아온 것만 골라 복습해요.',
  openGraph: { title: '복습 | Anatomy Studio', description: 'FSRS v4 알고리즘 기반 과학적 단어 복습' },
};

export default function Page() {
  return <><div className="manabi-return-strip"><span>내가 고른 문장으로 다시 떠올려요.</span><Link href="/books/japanese-n5/review">일본어 N5 · 담은 표현</Link><Link href="/lessons">책장으로 →</Link></div><VocabPage /></>;
}
