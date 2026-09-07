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

export function readingUnit(pageId, sectionIndex) {
  if (!pageId || pageId === 'cover' || pageId.startsWith('toc')) return 'cover';
  const exact = sectionIndex.find(section => section.id === pageId || section.anchors.includes(pageId));
  if (exact) return exact.unit;
  if (/^u(0[1-9]|[1-3][0-9]|4[0-2])$/.test(pageId)) return pageId;
  if (['guide', 'materials', 'reference'].includes(pageId)) return pageId;
  return null;
}
