import { cookies } from 'next/headers';
import VocabPage from '@/views/VocabPage';
import { hasSupabaseSessionInJar } from '@/lib/authCookie';
import { parseReviewScope } from '@/lib/reviewScopeUrl';
import { prefetchReviewRoomFirstScreen, reviewRoomSession } from '@/lib/server/reviewRoomPrefetch';

export const metadata = {
  title: '복습',
  description: '단어와 문법을 한곳에서 — FSRS 간격 반복으로 돌아온 것만 골라 복습해요.',
  openGraph: { title: '복습 | manabi', description: '단어와 문법을 한곳에서 — FSRS 간격 반복으로 돌아온 것만 골라 복습해요.' },
};
// 계정마다 다른 숫자를 싣는다 — 늘 요청마다 그린다(공유 캐시 없음, 응답은 private no-store).
export const dynamic = 'force-dynamic';

// 범위 주소(lang · level · src · state, 옛 ?book=)는 REV-SCOPE-R1A 정본 parseReviewScope가 읽는다.
// 「오늘」 카드 첫 숫자는 서버가 미리 센다(VOCAB-FIRST-NUMBERS-001). 숫자 약속은 기다리지 않고 넘긴다 — 본문 · 골격은 바로 나가고
// 숫자는 같은 HTML 응답 뒤쪽으로 온다. 손님 · 실패 · 예산 초과면 null(지금처럼 브라우저가 목록을 받은 뒤 센다).
// 로그인 확인(서명만 — 갱신 없음)은 먼저 한 번 한다: serverUserId로 브라우저가 로그인 복원(문서를 다 받은 뒤)을 기다리지 않고
// 전체 목록을 하이드레이션 직후 받기 시작한다(서재 serverUserId 선례 — 숫자를 싣느라 문서가 길어져도 목록 시작이 늦어지지 않게).
export default async function Page({ searchParams }) {
  const reviewScope = parseReviewScope(await searchParams);
  const session = await reviewRoomSession();
  // 세션 쿠키 이름(값 · 계정은 읽지 않는다 — 서재 · 배움과 같은 판정)이 없으면 손님이다 — 로그인 확인을 기다리지 않고 손님 화면을 바로 그린다
  // (VOCAB-GUEST-FIRST-001: 운영 CPU×4 손님 /vocab이 「계정을 확인하고 있어요…」로 약 1.2초 머문 뒤에야 안내가 나왔다).
  return <VocabPage reviewScope={reviewScope} serverUserId={session?.user.id ?? null} sessionHint={hasSupabaseSessionInJar(await cookies())}
    firstScreen={session ? prefetchReviewRoomFirstScreen(reviewScope, { session }) : null} />;
}
