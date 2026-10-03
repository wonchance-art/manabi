import {describe, expect, it, vi} from 'vitest';
vi.mock('../supabase', () => ({supabase: {}}));
import {knownWordsLang} from '../knownWords';
import {KNOWN_LANGUAGES, knownWordKeys, knownWordSetOf, scopedKnownWords, updateKnownWords} from '../knownWordControl';
import {findVocabularyExclusion, updateVocabularyExclusions, scopedVocabularyExclusions, VOCABULARY_LANGUAGES} from '../vocabularyExclusion';
import {encounterLookupLang} from '../refVocabLookup';

const rows = [{lang: 'ko', word_text: '갔어요'}, {lang: 'ja', word_text: '갔어요'}];
const exclusion = {id: 'exclude', language: 'Korean', word_text: '가다', vocabulary_id: 'card',
  retired_vocabulary_ids: ['old-card'], known_word_keys: ['갔어요']};
const words = [{id: 'card', word_text: '가다', language: 'Korean'}, {id: 'ja-card', word_text: '가다', language: 'Japanese'}];

describe('Korean known and exclusion contracts', () => {
  it('requires explicit verified Korean storage while encounter mapping stays unchanged', () => {
    expect(knownWordsLang('Korean')).toBeNull();
    expect(knownWordsLang('Korean', false)).toBeNull();
    expect(knownWordsLang('Korean', 'true')).toBeNull();
    expect(knownWordsLang('Korean', true)).toBe('ko');
    expect(knownWordsLang('Chinese', true)).toBe('zh');
    expect(knownWordsLang('unknown', true)).toBeNull();
    expect(encounterLookupLang('Korean')).toBeNull();
    expect(KNOWN_LANGUAGES.ko).toBe('Korean'); expect(VOCABULARY_LANGUAGES).toContain('Korean');
  });
  it('resolves exact persisted known keys through the Korean base exclusion alias', () => {
    expect(knownWordKeys(rows, 'ko', {id: 'card', word_text: '가다'}, [exclusion])).toEqual(['갔어요']);
    expect(knownWordKeys(rows, 'ko', {id: 'old-card', word_text: '편집된 표기'}, [exclusion])).toEqual(['갔어요']);
    expect([...knownWordSetOf(rows, [exclusion], 'ko')]).toEqual(['갔어요', '가다']);
    expect([...knownWordSetOf(rows, [exclusion], 'ja')]).toEqual(['갔어요']);
  });
  it('keeps Korean exclusion scoping separate from identical spellings in other languages', () => {
    expect(findVocabularyExclusion([exclusion], {language: 'Korean', word: ' 가다 '})).toBe(exclusion);
    expect(findVocabularyExclusion([exclusion], {language: 'Japanese', word: '가다'})).toBeNull();
    expect(scopedVocabularyExclusions([exclusion], words, ['card'])).toEqual([exclusion]);
    expect(scopedVocabularyExclusions([exclusion], words, ['ja-card'])).toEqual([]);
    expect(scopedKnownWords(rows, [exclusion], words, ['card'])).toEqual([rows[0]]);
  });
  it('removes Korean aliases on restore while preserving the card and other-language markers', () => {
    const original = structuredClone({rows, exclusion, words});
    expect(updateKnownWords(rows, {lang: 'ko', wordText: '가다', known: false, removeKeys: ['갔어요']})).toEqual([rows[1]]);
    expect(updateVocabularyExclusions([exclusion], {excluded: false, entry: {...exclusion, id: 'new-id'}})).toEqual([]);
    expect({rows, exclusion, words}).toEqual(original);
  });
  it('compares NFC while returning original raw known keys for deletion', () => {
    const nfd = '가다', rawRows = [{lang: 'ko', word_text: nfd}];
    expect(knownWordKeys(rawRows, 'ko', {text: '가다'})).toEqual([nfd]);
    expect(rawRows[0].word_text).toBe(nfd);
  });
});
