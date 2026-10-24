import HomePage from '@/views/HomePage';
import { ScFontLink } from '@/components/fonts/ScFontLink';
import { publishedOrNull, publishedReadingWith, readingCatalog } from '@/lib/server/publishedBook';

export const homeMetadata = { title: '배움', description: '읽던 페이지 · 단어 복습 · 오늘 문단을 한 화면에서.', alternates: { canonical: '/home' } };

/**
 * 배움(/home) 판 — ISR(GUEST-STATIC-001 4단계). 누구에게나 같은 바이트다: 서버가 그리는 재료는 발행 교재(N5)의 작은 카탈로그(공개 행 ·
 * 쿠키 없는 공개 클라이언트)뿐이고, 연속 · 복습 · 오늘 문단 · 이어 읽기 위치는 전부 브라우저가 받는다(HomePage는 'use client').
 * 판은 넷 — 세션 쿠키 유무(member: 손님 / 로그인 배치, B1) × 간체 힌트 쿠키(sc: 간체 스타일시트 미리 걸기, SC-LINK-001 2단계 C).
 * 고르는 것은 middleware(src/middleware.js, 쿠키 이름 · 값 '1'만 본다)이고, 판은 쿠키 · 헤더 · searchParams를 읽지 않는다(staticSegments.test.js).
 * 주기: 서버 재료는 발행할 때만 바뀐다 — 발행 API가 판들을 바로 버린다(revalidatePath('/home', 'layout')). 오늘 추천은 브라우저가 받으므로 주기와 무관하다.
 * 1시간은 발행을 API 밖(SQL)으로 했을 때의 상한이자, 빌드 때 조회가 실패해 「교재 정보를 불러오지 못했어요」로 구운 첫 판의 수명이다.
 * 판본은 기다린다(await) — ISR 판은 미리 구워 두므로 사람이 기다리지 않는다. 기다려야 다시 만들 때의 실패를 던져 앞 판을 둘 수 있다(publishedOrNull).
 */
export default async function HomeVariant({ member, sc }) {
  const published = await publishedOrNull(db => publishedReadingWith(db));
  const book = published ? readingCatalog(published.book) : null;
  return <>{sc && <ScFontLink />}<HomePage book={book} sessionHint={member} /></>;
}
