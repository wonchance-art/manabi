import Bookshelf from '@/components/books/Bookshelf';
import { createSupabasePublicClient } from '@/lib/supabaseServer';
import { publishedReadingWith, readingCatalog } from '@/lib/server/publishedBook';
import { levelTileCounts } from '@/lib/levelListData';
import { BOOKS } from '@/lib/textbook/contract';

// 책장(/lessons · /lessons?lang=…) 서버 판 — ISR 1시간(GUEST-STATIC-001 3단계). 누구에게나 같은 바이트다:
// 발행 판본은 쿠키 없는 공개 클라이언트로 읽고(발행 · 판본 표 RLS using (true)), 레벨 타일 수는 저장소 콘텐츠다. 계정 데이터(이어 읽기 · 관리자 줄)는
// 브라우저(Bookshelf)가 그린다. 교재를 새로 발행하면 발행 API가 이 판들을 바로 버린다(revalidatePath — api/admin/books/japanese-n5/route.js).
// 실패를 1시간 굳히지 않는다: 다시 만들 때(revalidate) 발행이 아닌 이유(503 · 연결)로 한 권이라도 못 받으면 던져서 앞 판을 둔다.
// 「아직 발행 안 함」(404)은 실패가 아니다. 빌드 때는 던지지 않는다 — 빌드가 DB에 묶이지 않게, 첫 판은 다음 재생성이 고친다.
export default async function LessonsShelf({ lang }) {
  const client = createSupabasePublicClient();
  // 등록 교재 · 레벨 타일(일본어 · 중국어)을 한꺼번에 시작한다 — 전에는 교재를 다 받은 뒤 타일을 언어마다 차례로 셌다(LEARN-PAGES 2026-10-17 KST).
  const [results, tiles] = await Promise.all([
    Promise.allSettled(Object.keys(BOOKS).map(async bookId => readingCatalog((await publishedReadingWith(client, undefined, false, bookId)).book))),
    // 레벨별 단어 · 문형 타일(LEVEL-LIST-AJ-001) — 숫자는 목록과 같은 조립에서 센다. 실패하면 타일 없이 책장은 그대로 연다.
    Promise.all([levelTileCounts('japanese'), levelTileCounts('chinese')]).then(([Japanese, Chinese]) => ({ Japanese, Chinese }), () => ({})),
  ]);
  const failed = results.some(result => result.status === 'rejected' && result.reason?.status !== 404);
  if (failed && process.env.NEXT_PHASE !== 'phase-production-build') throw new Error('lessons_shelf_unavailable');
  const books = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  return <Bookshelf book={books[0] || null} books={books} initialLang={lang} levelTiles={tiles} />;
}
