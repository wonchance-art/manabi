// 정적 · ISR 경로 고정표(GUEST-STATIC-001, 2026-10-23 KST) — 공유 캐시(CDN)에 맡기는 화면.
//
// 이 화면들의 서버 HTML은 누구에게나 같은 바이트여야 한다(계정 데이터는 브라우저가 받는다). 그 전제를 두 겹으로 지킨다:
//   ① 소스 계약(src/lib/__tests__/staticSegments.test.js) — 세그먼트 사슬(page · layout · loading · template)과 그 서버 import가
//      쿠키 · 요청 헤더 · 쿠키 세션 클라이언트 · searchParams를 읽지 않는다.
//   ② 빌드 산출 대조(scripts/check-static-routes.mjs, CI e2e 빌드 뒤) — next build가 실제로 정적(○ · ●)으로 구웠고, ISR 주기가 표와 같다.
//      빌드 판정이 소스 계약보다 넓다(라이브러리 깊은 곳의 동적 API · 새 import도 잡는다).
// revalidate: false = 배포 동안 고정(정적), 숫자 = ISR 초.
// 계정 데이터를 서버에서 그리는 화면(/viewer/[id] · /materials · /study* · 판본 하나 말고도 쿼리가 붙은 /books/*)은 여기에 넣지 않는다.
export const STATIC_ROUTES = Object.freeze([
  { route: '/auth', revalidate: false },
  { route: '/studies', revalidate: false },
  { route: '/studies/[country]', revalidate: false },
  { route: '/studies/[country]/[slug]', revalidate: false },
  { route: '/japanese/vocab/[level]', revalidate: false },
  { route: '/chinese/vocab/[level]', revalidate: false },
  // 계정 데이터를 브라우저에서만 그리는 셸 — 문서 bfcache 복원 가드(AuthContext recheckAccountOnRestore · account-boundary e2e ⑨) 대상
  { route: '/profile', revalidate: false },
  { route: '/progress', revalidate: false },
  // 2단계: 산책(쿼리 없음) ISR 5분 — 기본 판과 간체 힌트 판(middleware가 고른다, 「함께 읽는 글」 /discover/reading은 동적)
  { route: '/discover', revalidate: 300 },
  { route: '/discover/sc', revalidate: 300 },
  // 3단계: 책장 ISR 1시간 + 발행 시 즉시 무효화(revalidatePath) — 기본 판과 언어 판(?lang=… → middleware)
  { route: '/lessons', revalidate: 3600 },
  { route: '/lessons/lang/[lang]', revalidate: 3600 },
  // 4단계: 배움 ISR 1시간 + 발행 시 즉시 무효화 — 세션 쿠키(이름) 유무 × 간체 힌트 네 판(middleware가 고른다, 계정 데이터 없음)
  { route: '/home', revalidate: 3600 },
  { route: '/home/sc', revalidate: 3600 },
  { route: '/home/member', revalidate: 3600 },
  { route: '/home/member/sc', revalidate: 3600 },
  // 4단계: 교재 첫 화면(쿼리 없음)만 — 세션 쿠키 유무 두 판. 쿼리가 붙은 교재 화면(관리자 미리보기 ?edition · ?reference · ?returnTo)은 동적 그대로
  { route: '/books/japanese-n5/cover/[hint]', revalidate: 3600 },
  { route: '/books/japanese-n4/cover/[hint]', revalidate: 3600 },
  { route: '/books/japanese-n3/cover/[hint]', revalidate: 3600 },
  // 5단계: 쿼리가 `edition` 하나뿐이고 값이 저장소 판본 id인 교재 화면 — 판본 × 세션 쿠키 유무(주소의 판본 그대로, 발행 도장 있는 판본만 그린다).
  // 관리자 미리보기(&preview=1) · ?reference · ?returnTo · 모르는 id는 동적 그대로
  { route: '/books/japanese-n5/edition/[edition]/[hint]', revalidate: 3600 },
  { route: '/books/japanese-n4/edition/[edition]/[hint]', revalidate: 3600 },
  { route: '/books/japanese-n3/edition/[edition]/[hint]', revalidate: 3600 },
]);

/**
 * next build의 .next/prerender-manifest.json을 표와 대조한다 — 어긋남 목록(빈 배열이면 통과).
 * 정적 · ISR로 구운 경로는 routes[경로].srcRoute로 원래 라우트(동적 세그먼트 포함)를 가리킨다. 동적(ƒ) 라우트는 manifest에 없다.
 */
export function staticRouteErrors(manifest, table = STATIC_ROUTES) {
  const routes = Object.values(manifest?.routes || {});
  const errors = [];
  for (const { route, revalidate } of table) {
    const built = routes.filter((r) => r?.srcRoute === route);
    if (!built.length) { errors.push(`${route}: 정적으로 굽지 않았다(동적 ƒ로 바뀜 — 쿠키 · 헤더 · searchParams · force-dynamic을 확인)`); continue; }
    const wrong = built.filter((r) => r.initialRevalidateSeconds !== revalidate);
    if (wrong.length) errors.push(`${route}: ISR 주기 ${JSON.stringify(wrong[0].initialRevalidateSeconds)} ≠ 표 ${JSON.stringify(revalidate)}`);
  }
  return errors;
}

/** 빌드 산출에서 ISR(숫자 주기) 경로만, prefix 아래로 — e2e 서버가 발행 상태를 바꿔 띄울 때 새로 만들 판(scripts/e2e-refresh-isr.mjs). */
export function isrPaths(manifest, prefix = '/') {
  const under = (path) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
  return Object.entries(manifest?.routes || {}).filter(([path, r]) => typeof r?.initialRevalidateSeconds === 'number' && under(path)).map(([path]) => path).sort();
}
