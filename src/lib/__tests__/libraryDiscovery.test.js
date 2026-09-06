import { describe, it, expect } from 'vitest';
import { libraryView, materialLibraryFilters, isLibraryNote, readingLibraryRows, discoverMatches } from '../libraryDiscovery';

describe('library sections and real record boundaries', () => {
  it('defaults to reading and preserves old public/private links', () => {
    const view = text => libraryView(new URLSearchParams(text));
    expect(view('')).toBe('reading');
    expect(view('view=notes')).toBe('notes');
    expect(view('tab=public&view=notes')).toBe('public');
    expect(view('tab=private')).toBe('owned');
    expect(view('view=invented')).toBe('reading');
  });
  it('separates notes without requiring a migrated direction column', () => {
    expect(isLibraryNote({ direction: 'write' })).toBe(true);
    expect(isLibraryNote({ processed_json: { status: 'note' } })).toBe(true);
    expect(isLibraryNote({ direction: 'read', processed_json: { status: 'completed' } })).toBe(false);
  });
  it('omits inaccessible, completed, unstarted and note rows; keeps recency and deduplicates', () => {
    const row = (id, extra = {}) => ({ last_token_idx: 5, reading_materials: { id, title: '글' }, ...extra });
    const latest = row(7), earlier = row(3);
    expect(readingLibraryRows([null, latest, row(2, { reading_materials: null }), row(5, { is_completed: true }), row(4, { last_token_idx: 0 }), row(9, { reading_materials: { id: 9, direction: 'write' } }), earlier, row(7)])).toEqual([latest, earlier]);
  });
  it('validates language-level pairs including French and rejects URL junk', () => {
    expect(materialLibraryFilters(new URLSearchParams('lang=French&level=B1+중급&q=bonjour&sort=title&unread=1'))).toMatchObject({ language:'French', level:'B1 중급', query:'bonjour', sort:'title', unread:true });
    expect(materialLibraryFilters(new URLSearchParams('lang=French&level=N5&sort=garbage'))).toMatchObject({ language:'French', level:'all', sort:'newest' });
    expect(materialLibraryFilters(new URLSearchParams('lang=__proto__&level=B1'))).toMatchObject({ language:'all', level:'all' });
  });
});

describe('discovery metadata filtering', () => {
  const docs = [{region:'france', domain:'culture', title:'프랑스 음식', summary:'지역의 식탁', regionName:'프랑스학', topicName:'문화'}, {region:'japan', domain:'culture', title:'일본 음식', summary:'계절의 식탁', regionName:'일본학', topicName:'문화'}, {region:'japan', domain:'history', title:'역사', summary:'도시의 변화', regionName:'일본학', topicName:'역사'}];
  it('combines region, actual topic and AND search terms', () => {
    expect(discoverMatches(docs, { region:'japan', topic:'culture', query:'음식 식탁' })).toEqual([docs[1]]);
    expect(discoverMatches(docs, { region:'france', topic:'history' })).toEqual([]);
    expect(discoverMatches(docs, { query:'  ' })).toEqual(docs);
  });
  it('searches literal metadata and never treats region as a learning level', () => {
    expect(discoverMatches(docs, { query:'N5' })).toEqual([]);
    expect(discoverMatches(docs, { query:'.*' })).toEqual([]);
    expect(discoverMatches(docs, { query:'프랑스학' })).toEqual([docs[0]]);
  });
});
