import Link from 'next/link';
import { BookReaderView } from '@/components/books/BookReader';
import { publishedOrNull, publishedReadingWith, readingCatalog, readingSections } from '@/lib/server/publishedBook';

// 교재 화면 이름(metadata) — 동적 갈래(쿼리가 붙은 page.jsx)와 표지 판(cover/[hint])이 같은 값을 쓴다.
export const BOOK_METADATA = Object.freeze({
  'japanese-n5': { title: '일본어 N5 · 작은 문장으로 시작하는 일본어', alternates: { canonical: '/books/japanese-n5' } },
  'japanese-n4': { title: '일본어 N4 · 문장을 이어, 내 이야기를 하는 일본어', alternates: { canonical: '/books/japanese-n4' } },
  'japanese-n3': { title: '일본어 N3 · 근거를 읽고, 내 생각을 전하는 일본어', alternates: { canonical: '/books/japanese-n3' } },
});
// 판 둘 — 세션 쿠키(이름만) 유무. 판정 · 고르기는 middleware(hasSupabaseSessionInJar), 이름은 내부 경로 /books/<책>/cover/<판> · /books/<책>/edition/<id>/<판>.
export const COVER_HINTS = Object.freeze(['guest', 'member']);

export function BookUnavailable() {
  return <div className="manabi-page"><h1>교재를 불러오지 못했어요</h1><p>잠시 후 다시 열어 주세요.</p><Link href="/lessons">책장으로 돌아가기</Link></div>;
}

/**
 * 쿼리 없는 교재 첫 화면(/books/<책>) 판 — ISR(GUEST-STATIC-001 4단계). edition을 주면 판본별 판(5단계 — `?edition=<저장소 판본 id>` 하나뿐인 요청,
 * /books/<책>/edition/[edition]/[hint])이다: 주소의 그 판본을 그리고(현재 발행본으로 바꾸지 않는다), 발행 도장이 없으면 동적 화면의 손님과 같은 안내다.
 * 누구에게나 같은 바이트다: 발행 판본(공개 행 · 쿠키 없는 공개 클라이언트)과 본문 색인(저장소 판본 파일)만 그린다. 읽던 자리 · 마친 과 · 담기 버튼은 브라우저가 그린다 — 이어 읽기 줄의 자리는 그리기 전 한 줄
 * (BOOK-RESUME-HOLD-001 resumeHintScript), 담기 버튼 자리는 판(member = 세션 쿠키 있음, BOOKS-FLOW-002)이 안다.
 * 미리보기는 없다: 관리자 미리보기(?edition=<미발행>&preview=1 — 쿼리 둘)와 ?reference · ?returnTo는 middleware가 이 판으로 넘기지 않는다(동적 page.jsx).
 * 아직 발행 안 한 책(404)은 동적 화면의 손님과 같은 안내다. 다시 만들 때의 실패(503 · 연결)는 던져 앞 판을 둔다(publishedOrNull).
 * 발행 API가 판을 바로 버린다(revalidatePath — api/admin/books/japanese-n5/route.js).
 */
export default async function BookCoverStatic({ bookId, member, edition = undefined }) {
  const published = await publishedOrNull(db => publishedReadingWith(db, edition, false, bookId));
  if (!published) return <BookUnavailable />;
  const { book } = published;
  // 본문 색인 실패도 같은 규칙(다시 만들 때는 던져 앞 판 유지) — 동적 화면은 안내로 바꿨다.
  const sections = await publishedOrNull(() => readingSections(book.editionId, bookId));
  if (!sections) return <BookUnavailable />;
  return <BookReaderView key={`${book.editionId}:false`} book={readingCatalog(book)} sessionHint={member}
    sectionIndex={sections.map(({ id, unit, title, anchors }) => ({ id, unit, title, anchors }))} />;
}
