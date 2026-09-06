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

export function materialLibraryFilters(params) {
  const lang = params.get('lang');
  const language = Object.hasOwn(LEVELS, lang) ? lang : 'all';
  return {
    language,
    level: LEVELS[language]?.includes(params.get('level')) ? params.get('level') : 'all',
    query: (params.get('q') || '').slice(0, 120),
    sort: ['fit', 'level', 'title'].includes(params.get('sort')) ? params.get('sort') : 'newest',
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
