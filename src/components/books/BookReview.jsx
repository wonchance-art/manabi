'use client';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { bookHref } from '@/lib/textbook/contract';
import useReadingProgress from './useReadingProgress';

export default function BookReview({ book }) {
  const { user, loading } = useAuth();
  const { progress } = useReadingProgress(book.edition);
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: ['book-review', user?.id], enabled: !!user,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const response = await fetch(`/api/learning/book-review?offset=${pageParam}`, { cache: 'no-store', signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '담은 표현을 불러오지 못했어요.');
      return result;
    },
    getNextPageParam: last => last.nextOffset ?? undefined,
  });
  const items = data?.pages.flatMap(page => page.items) || [];
  return <div className="manabi-page"><p className="manabi-breadcrumb"><Link href="/lessons">교재</Link><span>/</span><Link href={bookHref(book.edition)}>일본어 N5</Link><span>/</span>담은 표현</p>
    <header className="manabi-page-heading"><div><p className="manabi-eyebrow">WORDS TO KEEP</p><h1>다시 꺼내 보는 문장<span>.</span></h1></div></header>
    <p className="manabi-muted manabi-small">책에서 고른 표현을 문맥과 함께 떠올려 보세요.</p><div className="manabi-row"><Link className="manabi-button" href="/vocab">오늘의 복습 시작 →</Link><Link className="manabi-link" href={bookHref(book.edition, progress.page)}>읽던 교재로 돌아가기 ↗</Link></div>
    {loading ? <p className="manabi-status" role="status">계정을 확인하고 있어요…</p> : !user ? <section className="manabi-empty"><h2>내가 고른 표현으로 채워 보세요.</h2><p>로그인하면 교재에서 담은 표현과 출처를 이곳에 모아 볼 수 있어요.</p><Link className="manabi-link" href="/auth">로그인하기 →</Link></section> : <>
      {isPending && <p className="manabi-status" role="status">표현을 불러오고 있어요…</p>}{error && <p className="manabi-status" role="alert">{error.message} <button type="button" onClick={() => refetch()}>다시 시도</button></p>}
      {!isPending && !error && !items.length && <section className="manabi-empty"><h2>첫 문장을 담아 볼까요?</h2><p>교재 예문의 ‘이 예문 담기’를 누르거나, 기억할 표현을 선택해 주세요.</p><Link className="manabi-link" href={bookHref(book.edition, progress.page)}>교재에서 표현 고르기 →</Link></section>}
      <div className="manabi-review-list">{items.map(item => <article key={item.id} className="manabi-review-card"><small>일본어 N5 · {Number(item.chapter?.match(/u(\d+)/)?.[1]) || ''}과에서 담은 표현</small><h2 lang="ja">{item.word.text}</h2>{item.word.furigana && item.word.furigana !== item.word.text && <p className="manabi-review-reading" lang="ja">{item.word.furigana}</p>}{item.quote !== item.word.text && <blockquote lang="ja">{item.quote}</blockquote>}<details><summary>뜻 떠올린 뒤 펼치기</summary><p>{item.word.meaning}</p></details><Link className="manabi-link" href={item.href}>이 표현을 만난 교재로 ↗</Link></article>)}</div>
      {hasNextPage && <button type="button" className="manabi-link" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>{isFetchingNextPage ? '불러오는 중…' : '이전에 담은 표현 더 보기'}</button>}
    </>}
  </div>;
}
