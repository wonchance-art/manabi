import { cookies } from 'next/headers';
import HomePage from '@/views/HomePage';
import { hasSupabaseSessionInJar } from '@/lib/authCookie';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
export const dynamic = 'force-dynamic';
export const metadata = { title: '배움', description: '읽던 페이지 · 단어 복습 · 오늘 문단을 한 화면에서.' };
export default async function Page() {
  // 교재 판본은 기다리지 않는다 — 약속(promise)으로 넘겨 이어 읽기 칸만 안쪽 Suspense에서 받는다(LCP-UNSUSPEND, 조정 승인
  // 2026-10-17 KST). 예전엔 이 조회(DB)를 await해서 화면 전체가 대기 화면(loading.jsx) 뒤 스트리밍 조각으로 늦게 끼워졌고,
  // 첫 진입 LCP(맛보기 문단)가 그 조각 공개를 기다렸다. 조회 · 실패 처리(null)는 그대로다 — 데이터 경로 무변경.
  const bookPromise = publishedReading().then(published => readingCatalog(published.book))
    .catch(() => null); // Reading and account services can fail independently.
  // 세션 쿠키 유무(이름만) — 손님이면 서버 HTML부터 손님 배치(B1). force-dynamic이라 쿠키를 읽어도 추가 동적 비용이 없다.
  const sessionHint = hasSupabaseSessionInJar(await cookies());
  return <HomePage bookPromise={bookPromise} sessionHint={sessionHint} />;
}
