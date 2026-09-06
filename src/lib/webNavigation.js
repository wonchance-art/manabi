export const MAIN_NAV = Object.freeze([
  { href: '/home', label: '오늘' },
  { href: '/lessons', label: '교재' },
  { href: '/discover', label: '발견' },
  { href: '/vocab', label: '복습', prefetch: false },
  { href: '/materials', label: '내 서재', prefetch: false },
]);
export function navigationOwner(pathname) {
  if (/^\/study\/library(?:\/|$)/.test(pathname)) return '/materials';
  if (/^\/(?:lessons|books)(?:\/|$)/.test(pathname)) return '/lessons';
  if (/^\/(?:discover|studies|world)(?:\/|$)/.test(pathname)) return '/discover';
  if (/^\/(?:vocab|review|study|learn)(?:\/|$)/.test(pathname)) return '/vocab';
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
