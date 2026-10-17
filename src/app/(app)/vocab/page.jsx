import VocabPage from '@/views/VocabPage';
import { parseReviewScope } from '@/lib/reviewScopeUrl';

export const metadata = {
  title: '복습',
  description: '단어와 문법을 한곳에서 — FSRS 간격 반복으로 돌아온 것만 골라 복습해요.',
  openGraph: { title: '복습 | manabi', description: '단어와 문법을 한곳에서 — FSRS 간격 반복으로 돌아온 것만 골라 복습해요.' },
};

// 범위 주소(lang · level · src · state, 옛 ?book=)는 REV-SCOPE-R1A 정본 parseReviewScope가 읽는다.
export default async function Page({ searchParams }) {
  return <VocabPage reviewScope={parseReviewScope(await searchParams)} />;
}
