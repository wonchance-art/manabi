import LessonsShelf from '@/components/books/LessonsShelf';

export const revalidate = 3600;
export const metadata = {
  title: '나의 책장',
  description: '작은 문장부터 차근차근. 일본어 교재를 읽고, 기억할 표현과 내 자료를 연결하세요.',
  alternates: { canonical: '/lessons' },
};
// #1077 판정의 다음 판(GUEST-STATIC-001 3단계, 2026-10-23 KST). 예전 이 자리는 「쿠키 확인 발행 · searchParams 때문에 동적 SSR(private, no-store) —
// 효과 없는 revalidate를 달지 말라」였다. 이제 동적 재료를 걷어 냈으므로 revalidate가 실제로 효과가 있다:
//  · 쿠키 · searchParams를 읽지 않는다(src/lib/__tests__/staticSegments.test.js). 옛 ?lang 링크 · 단어 목록의 「← 교재」(?lang=…)는
//    middleware가 /lessons/lang/<언어>(같은 판 + 갈래 선택, 역시 ISR)로 넘긴다 — 첫 그림부터 그 언어가 골라져 있다.
//  · 빌드가 실제로 ISR 3600으로 구웠는지는 scripts/check-static-routes.mjs가 CI에서 본다(선언만 있고 효과가 없던 옛 오진을 산출로 막는다).
//  · 「옛 버전이 뜬다」는 보고가 오면: 판 수명은 최대 1시간, 발행은 즉시 무효화(revalidatePath)다 — 그 둘을 먼저 본다.
export default function Page() {
  return <LessonsShelf />;
}
