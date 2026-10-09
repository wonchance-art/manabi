// Public reading routes and device-local progress are independent of legacy chapters.
export const BOOK_SERIES = [
  { language: 'Japanese', name: '일본어', native: '日本語', glyph: 'あ', color: '#994A5A', level: 'N5', id: 'japanese-n5' },
  { language: 'Chinese', name: '중국어', native: '中文', glyph: '你', color: '#2A7657', level: 'HSK', id: 'chinese' },
  { language: 'English', name: '영어', native: 'English', glyph: 'Aa', color: '#906021', level: 'CEFR', id: 'english' },
  { language: 'French', name: '프랑스어', native: 'Français', glyph: 'é', color: '#3A68A2', level: 'CEFR', id: 'french' },
];

export function lessonGroups(lessons) {
  return lessons.reduce((groups, lesson) => {
    const previous = groups.at(-1);
    if (previous?.title === lesson.part) previous.lessons.push(lesson);
    else groups.push({ title: lesson.part, lessons: [lesson] });
    return groups;
  }, []);
}

export const readingProgressKey = (edition, userId) => `manabi-book-progress:${edition}:${userId || 'guest'}`;
export const readingDraftKey = (edition, userId) => `manabi-book-answers:${edition}:${userId || 'guest'}`;
export const emptyReadingProgress = () => ({ page: 'u01-start', completed: [] });
export function validReadingProgress(value) {
  const source = value && typeof value === 'object' ? value : {};
  const page = /^u(0[1-9]|[1-3][0-9]|4[0-2])(?:-[a-z0-9_-]+)?$/.test(source.page || '') ? source.page : 'u01-start';
  return { page, completed: [...new Set((Array.isArray(source.completed) ? source.completed : []).filter(id => /^u(0[1-9]|[1-3][0-9]|4[0-2])$/.test(id)))] };
}

export function legacyTextbookTarget(pathname) {
  if (/^\/(japanese|chinese|english|french)(?:\/(grammar|vocab|bunkei)\/[^/]+)?\/?$/.test(pathname)) {
    return `/admin/legacy-textbooks${pathname.replace(/\/$/, '')}`;
  }
  return null;
}

// 학습자 화면에 내보내는 주소의 마지막 관문. 옛 교재 공개 URL은 #1287부터 관리자 보관함으로만 열리므로
// (middleware → /admin/legacy-textbooks → 비관리자는 /), 학습자 링크로 만들면 홈으로 튕긴다.
// 옛 챕터와 새 책 위치의 대응은 데이터로 확정된 것이 없어 추측해 옮기지 않는다 — null을 돌려주고,
// 호출부는 링크 자리에 ARCHIVED_TEXTBOOK_NOTICE를 보인다(VIEWER-R0-BUGS-001 버그 3).
export const ARCHIVED_TEXTBOOK_NOTICE = '보관된 교재라 열 수 없어요';
export function learnerHref(href) {
  if (typeof href !== 'string' || !href) return null;
  return legacyTextbookTarget(href.replace(/[?#].*$/s, '')) ? null : href;
}

export function readingUnit(pageId, sectionIndex) {
  if (!pageId || pageId === 'cover' || pageId.startsWith('toc')) return 'cover';
  const exact = sectionIndex.find(section => section.id === pageId || section.anchors.includes(pageId));
  if (exact) return exact.unit;
  if (/^u(0[1-9]|[1-3][0-9]|4[0-2])$/.test(pageId)) return pageId;
  if (['guide', 'materials', 'reference'].includes(pageId)) return pageId;
  return null;
}
