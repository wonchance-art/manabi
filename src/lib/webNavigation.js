// 메뉴 셋(LEARN-HOME-AK-001 — 오너 확정 목업 2026-10-09): 배움 · 서재 · 산책. 「대화」는 화면이 생길 때까지 숨긴다
// (생기면 배움 · 대화 · 서재 · 산책). /lessons · /vocab 경로는 남고 배움 화면의 칸으로 들어간다.
export const MAIN_NAV = Object.freeze([
  { href: '/home', label: '배움', icon: 'learn', prefetch: false },
  { href: '/materials', label: '서재', icon: 'library', prefetch: false },
  { href: '/discover', label: '산책', icon: 'compass' },
]);
// Only the text reader uses this shell; PDF and book readers keep their own controls.
export function isFocusedReadingRoute(pathname) {
  return /^\/(?:viewer|suggestions)\/[^/]+\/?$/.test(pathname || '');
}
export function navigationOwner(pathname) {
  if (/^\/study\/library(?:\/|$)/.test(pathname)) return '/materials';
  if (/^\/(?:discover|studies|world|suggestions)(?:\/|$)/.test(pathname)) return '/discover';
  // 메뉴에서 빠진 교재 · 복습 · 학습 경로는 배움 소속이다 — 어느 메뉴에도 불이 안 들어오는 화면을 만들지 않는다(정정 2026-10-11).
  if (/^\/(?:lessons|books|vocab|review|study|learn|progress)(?:\/|$)/.test(pathname)) return '/home';
  if (/^\/(?:materials|viewer|library|pdf|epub|groups)(?:\/|$)/.test(pathname)) return '/materials';
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
