import { describe, it, expect } from 'vitest';
import { preservePendingVocabularyReviews } from '../viewerVocabularyCache';
import { exclusionWord, findVocabularyExclusion, updateVocabularyExclusions, loadVocabularyExclusions, scopedVocabularyExclusions } from '../vocabularyExclusion';
describe('가역적인 계정 단어 제외', () => {
  const rows = [{ id: 'a', language: 'Chinese', word_text: '和', vocabulary_id: null },
    { id: 'b', language: 'English', word_text: 'book', vocabulary_id: 'card' }];
  it('같은 글자의 다른 언어를 결합하지 않는다', () => {
    expect(findVocabularyExclusion(rows, { language: 'Japanese', word: '和' })).toBeNull();
    expect(findVocabularyExclusion(rows, { language: 'Chinese', word: '和' }).id).toBe('a');
  });
  it('기존 저장 기본형/이합사 우선과 NFC만 사용한다', () => {
    expect(exclusionWord({ text: '食べた', base_form: '食べる' })).toBe('食べる');
    expect(exclusionWord({ text: '了', base_form: '了', sep_link: '吃饭' })).toBe('吃饭');
    expect(exclusionWord({ text: ' e\u0301 ' })).toBe('é');
    expect(exclusionWord({ text: 'Book' })).toBe('Book');
  });
  it('저장 ID/언어·기본형으로 전체 범위 적용, 편집 후 옛 표기는 적용하지 않는다', () => {
    expect(findVocabularyExclusion(rows, { vocabularyId: 'card', language: 'English', word: 'volume' }).id).toBe('b');
    expect(findVocabularyExclusion(rows, { vocabularyId: 'another', language: 'English', word: 'book' }).id).toBe('b');
    const edited = [{ ...rows[1], word_text: 'volume' }];
    expect(findVocabularyExclusion(edited, { vocabularyId: 'another', language: 'English', word: 'book' })).toBeNull();
  });
  it('언어 미상 기록을 추정하지 않는다', () => {
    expect(findVocabularyExclusion(rows, { language: null, word: '和' })).toBeNull();
  });
  it('중복 성공/해제는 기존 목록을 변형하지 않는 멱등 갱신이다', () => {
    const result = { excluded: true, entry: rows[0] };
    const once = updateVocabularyExclusions(rows, result);
    expect(updateVocabularyExclusions(once, result)).toEqual(once);
    expect(updateVocabularyExclusions(once, { ...result, excluded: false })).toEqual([rows[1]]);
    expect(rows).toHaveLength(2);
  });
  it('1,000개 뒤의 제외도 읽으며 중간 페이지 실패를 숨기지 않는다', async () => {
    const all = Array.from({ length: 1001 }, (_, i) => ({ id: String(i) }));
    const client = failAt => ({ from: () => ({ select: () => ({ eq: () => ({ order: () => ({ range: async (start, end) => {
      if (start === failAt) return { error: new Error('unavailable') };
      return { data: all.slice(start, end + 1) };
    } }) }) }) }) });
    expect(await loadVocabularyExclusions(client(-1), 'owner')).toHaveLength(1001);
    await expect(loadVocabularyExclusions(client(400), 'owner')).rejects.toThrow('unavailable');
  });
  it('채점 응답을 기다리는 캐시도 새 서버의 제외 상태를 덮지 않는다', () => {
    const row = { id: 'card', word_text: 'book', is_excluded: false, __pendingReview: 9 };
    const current = { byKey: new Map([['base:book', row]]) };
    const fresh = { byKey: new Map([['base:book', { ...row, is_excluded: true }]]), surfaces: new Set(), bases: new Set() };
    expect(preservePendingVocabularyReviews(fresh, current).byKey.get('base:book').is_excluded).toBe(true);
  });

  it('교재 범위는 같은 기본형의 다른 자료 카드에서도 해제 항목을 찾는다', () => {
    const words = [{ id: 'another', language: 'English', base_form: 'book', word_text: 'books' }];
    expect(scopedVocabularyExclusions(rows, words, ['another'])).toEqual([rows[1]]);
    expect(scopedVocabularyExclusions(rows, words, [])).toEqual([]);
  });

  it('삭제 후 돌아온 오프라인 평가는 원래 카드 ID로도 제외 판정한다', () => {
    const removed = [{ id: 'x', language: 'English', word_text: 'book', vocabulary_id: null, retired_vocabulary_ids: ['old-books'] }];
    expect(findVocabularyExclusion(removed, { vocabularyId: 'old-books', language: 'English', word: 'books' }).id).toBe('x');
  });

});
