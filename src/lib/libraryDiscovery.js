import { isWriteMaterial, LEVELS } from './constants';

export function libraryView(params) {
  if (params.get('tab') === 'public') return 'public';
  if (params.get('tab') === 'private') return 'owned';
  const view = params.get('view');
  return ['owned', 'notes'].includes(view) ? view : 'reading';
}

export function isLibraryNote(material) {
  return isWriteMaterial(material) || material?.status === 'note' || material?.processed_json?.status === 'note';
}

// Keep the server's recency order. A hidden/deleted join is not a resumable item;
// completion, vocabulary schedules and local textbook progress are separate records.
export function readingLibraryRows(rows = []) {
  const seen = new Set();
  return rows.filter(row => {
    const material = row?.reading_materials;
    if (!material?.id || row.is_completed || !(row.last_token_idx > 0) || isLibraryNote(material) || seen.has(material.id)) return false;
    seen.add(material.id);
    return true;
  });
}

/** 서재(/materials)가 서가 대신 자료 목록 도구(MaterialsPage)를 그리는 주소 — 도구 · 맞춤도 정렬 · 넘긴 말 정렬.
 *  LibraryPage(그리기)와 libraryPrefetch.shelfRendered(서버 미리 받기)가 같은 분기를 쓴다. */
export function isLibraryToolsView(params) {
  const sort = params.get('sort');
  return params.get('tools') === '1' || sort === 'fit' || sort === 'words';
}

/** 「이 말이 나오는 글」 정렬에 넘긴 말(다시 만난 말 창 → /materials?sort=words&words=…) — 30개 · 한 말 40자 · 겹침 제거. */
export const LIBRARY_WORDS_MAX = 30;
export function libraryWords(params) {
  const words = [];
  for (const part of (params.get('words') || '').split(',')) {
    const w = part.trim();
    if (!w || w.length > 40 || words.includes(w)) continue;
    words.push(w);
    if (words.length >= LIBRARY_WORDS_MAX) break;
  }
  return words;
}

export function materialLibraryFilters(params) {
  const lang = params.get('lang');
  const language = Object.hasOwn(LEVELS, lang) ? lang : 'all';
  const words = libraryWords(params);
  const sort = params.get('sort');
  return {
    language,
    level: LEVELS[language]?.includes(params.get('level')) ? params.get('level') : 'all',
    query: (params.get('q') || '').slice(0, 120),
    // 'words'는 넘긴 말이 있을 때만 — 말 없이 주소만 남으면 최신순.
    sort: ['fit', 'level', 'title'].includes(sort) || (sort === 'words' && words.length) ? sort : 'newest',
    words,
    unread: params.get('unread') === '1',
    pinned: params.get('pinned') === '1',
  };
}

// Only public registry metadata is supplied by the server, never private materials.
export function discoverMatches(documents, { region = 'all', topic = 'all', query = '' } = {}) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return documents.filter(doc => (region === 'all' || doc.region === region)
    && (topic === 'all' || doc.domain === topic)
    && terms.every(term => `${doc.title} ${doc.summary} ${doc.regionName} ${doc.topicName}`.toLocaleLowerCase().includes(term)));
}
