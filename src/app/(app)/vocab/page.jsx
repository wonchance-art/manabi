import VocabPage from '@/views/VocabPage';

export const metadata = {
  title: '복습',
  description: '단어와 문법을 한곳에서 — FSRS 간격 반복으로 돌아온 것만 골라 복습해요.',
  openGraph: { title: '복습 | manabi', description: 'FSRS v4 알고리즘 기반 과학적 단어 복습' },
};

// 범위 주소(REV-SCOPE R1-A)는 클라이언트가 읽는다 — 기본 언어가 이 기기에서 고른 배움 언어라서다.
const SCOPE_KEYS = ['lang', 'level', 'src', 'state', 'book', 'returnTo'];
export default async function Page({ searchParams }) {
  const params = (await searchParams) || {};
  const scopeParams = Object.fromEntries(SCOPE_KEYS.filter(key => params[key] !== undefined).map(key => [key, params[key]]));
  return <VocabPage scopeParams={scopeParams} />;
}
