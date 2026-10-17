// 메뉴 넷(LEARN-HOME-AK-001 — 오너 확정 목업 2026-10-09 「대화 화면이 생기면 배움 · 대화 · 서재 · 산책」,
// 대화 화면 #1444 운영 반영 뒤 오너 지시 2026-10-15 「배움과 서재 사이 대화 넣어서 오픈」). /lessons · /vocab 경로는 남고 배움 화면의 칸으로 들어간다.
export const MAIN_NAV = Object.freeze([
  // prefetch:false = 화면에 들어올 때 미리 받지 않는다(P5 — 로그인 직후 홈의 부분 prefetch가 연속 탐색을 붙잡는 회귀).
  // intentPrefetch = 마우스가 머물거나 키보드 포커스가 올 때만 대기 화면까지 받는다(APP-FEEL-004, src/lib/intentPrefetch.js).
  // 서재는 붙이지 않는다 — 자체 loading이 없어 AUTO가 라우터 상태만 받는다(골격 이득 없이 붙잡힘 위험만).
  { href: '/home', label: '배움', icon: 'learn', prefetch: false, intentPrefetch: true },
  { href: '/conversation/new', label: '대화', icon: 'chat', prefetch: false },
  { href: '/materials', label: '서재', icon: 'library', prefetch: false },
  // 산책도 화면 진입 prefetch를 끈다(BFCACHE-A-001 — 오너 승인 2026-10-17 KST 선택지 A). Next 15.5 RSC prefetch 응답은
  // no-store라 받기만 해도 Chrome이 그 화면을 bfcache에 넣지 않는다(JsNetworkRequestReceivedCacheControlNoStoreResource) —
  // 교재 등 메뉴가 보이는 화면 전부의 「뒤로」가 다시 불러오기(Preview 1.3~1.6초)가 됐다. 자체 대기 화면이 있어 배움과 같이 의도 prefetch.
  { href: '/discover', label: '산책', icon: 'compass', prefetch: false, intentPrefetch: true },
]);
// Only the text reader uses this shell; PDF and book readers keep their own controls.
export function isFocusedReadingRoute(pathname) {
  return /^\/(?:viewer|suggestions)\/[^/]+\/?$/.test(pathname || '');
}
export function navigationOwner(pathname) {
  if (/^\/study\/library(?:\/|$)/.test(pathname)) return '/materials';
  if (/^\/conversation(?:\/|$)/.test(pathname)) return '/conversation/new';
  if (/^\/(?:discover|studies|world|suggestions)(?:\/|$)/.test(pathname)) return '/discover';
  // 메뉴에서 빠진 교재 · 복습 · 학습 경로는 배움 소속이다 — 어느 메뉴에도 불이 안 들어오는 화면을 만들지 않는다(정정 2026-10-11).
  // 작문은 배움(학습 순환의 산출 — 단어장 · 오늘 학습에서 연다), 빠른 분석은 서재(자료 추가로 이어진다) 소속(오너 「권장대로」 2026-10-17 KST).
  if (/^\/(?:lessons|books|vocab|review|study|learn|progress|writing)(?:\/|$)/.test(pathname)) return '/home';
  if (/^\/(?:materials|viewer|library|pdf|epub|groups|quick)(?:\/|$)/.test(pathname)) return '/materials';
  return pathname === '/home' ? '/home' : null;
}
// Published-book reading counts never incorporate legacy quizzes or vocabulary schedules.
export function bookResume(book, progress, hasProgress = false) {
  if (!book?.lessons?.length) return null;
  const lesson = book.lessons.find(item => progress?.page === item.id || progress?.page?.startsWith(`${item.id}-`));
  const ids = new Set(book.lessons.map(item => item.id));
  const completed = [...new Set(progress?.completed || [])].filter(id => ids.has(id));
  return { lesson: lesson || book.lessons[0], page: lesson ? progress.page : `${book.lessons[0].id}-start`,
    started: Boolean(lesson && hasProgress), completed: completed.length, total: ids.size };
}
export function recentMaterial(rows) {
  return (rows || []).filter(row => !row.is_completed && row.reading_materials?.id && row.reading_materials?.title)
    .sort((a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0))[0] || null;
}
export function chooseResume(book, updatedAt, material) {
  if (!material) return book ? 'book' : null;
  if (!book?.started) return 'material';
  // Older local records have no timestamp; preserve their known position without inventing a date.
  if (!Number.isFinite(Date.parse(updatedAt))) return 'book';
  return Date.parse(material.updated_at) > Date.parse(updatedAt) ? 'material' : 'book';
}
