import { HydrationBoundary } from '@tanstack/react-query';
import LibraryPage from '@/components/web/LibraryPage';
import { prefetchLibraryShelf } from '@/lib/server/libraryPrefetch';
export const dynamic = 'force-dynamic';
export const metadata = { title: '내 서재', description: '읽던 글과 교재, 내 자료와 노트를 한자리에서.' };
// 로그인한 계정이면 첫 화면 쿼리(읽던 곳 · 대화 · 폴더 · 목록 첫 쪽)를 서버가 미리 받아 넘긴다(LIBRARY-PREFETCH-001).
// 손님 · 실패 · 예산(800ms) 초과면 지금처럼 브라우저가 받는다 — 골격이 대신한다.
export default async function Page({ searchParams }) {
  const prefetched = await prefetchLibraryShelf(await searchParams);
  if (!prefetched) return <LibraryPage />;
  return <HydrationBoundary state={prefetched.state}><LibraryPage serverUserId={prefetched.userId} /></HydrationBoundary>;
}
