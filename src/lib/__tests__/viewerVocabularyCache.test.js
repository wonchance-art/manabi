import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { insertConfirmedVocabulary, beginVocabularyReview, settleVocabularyReview, preservePendingVocabularyReviews } from '../viewerVocabularyCache';

function setup() {
  const client = new QueryClient();
  const word = { id: 'cat', word_text: '猫', base_form: '猫', user_id: 'u', meaning: '내 뜻', interval: 2, ease_factor: 5, repetitions: 1, next_review_at: 'old', last_reviewed_at: null };
  const other = { ...word, id: 'dog', word_text: '犬', base_form: '犬' };
  client.setQueryData(['vocab-words', 'u'], { byKey: new Map([['surface:猫', word], ['base:猫', word], ['surface:犬', other]]), surfaces: new Set(['猫', '犬']), bases: new Set(['猫', '犬']) });
  return { client, word, other, read: () => client.getQueryData(['vocab-words', 'u']) };
}

describe('viewer response cache: confirmed saves and reversible pending grades', () => {
  it('an INSERT response updates membership without waiting for a second GET', () => {
    const { client, read } = setup();
    insertConfirmedVocabulary(client, 'u', { id: 'flower', user_id: 'u', word_text: '花', base_form: '花', meaning: '꽃' });
    expect(read().byKey.get('surface:花').id).toBe('flower');
    expect(read().surfaces.has('花')).toBe(true);
    expect(read().bases.has('花')).toBe(true);
  });
  it('no INSERT / a different account cannot invent a saved card or overwrite a personal meaning', () => {
    const { client, word, read } = setup();
    insertConfirmedVocabulary(client, 'u', undefined);
    insertConfirmedVocabulary(client, 'u', { id: 'v', user_id: 'other', word_text: '花' });
    insertConfirmedVocabulary(client, 'u', { ...word, id: 'another', meaning: '새 뜻', interval: 999 });
    expect(read().byKey.get('surface:猫')).toEqual(word);
    expect(read().surfaces.has('花')).toBe(false);
  });
  it('pending grade changes both aliases immediately and failure restores only that card’s SRS', () => {
    const { client, word, other, read } = setup();
    const context = beginVocabularyReview(client, 'u', word, { interval: 8, next_review_at: 'later' });
    expect(read().byKey.get('base:猫').next_review_at).toBe('later');
    client.setQueryData(['vocab-words', 'u'], cur => ({ ...cur, byKey: new Map([...cur.byKey].map(([k, v]) => [k, v.id === 'cat' ? { ...v, meaning: '동시 편집 뜻' } : v])) }));
    settleVocabularyReview(client, context);
    expect(read().byKey.get('surface:猫')).toEqual({ ...word, meaning: '동시 편집 뜻' });
    expect(read().byKey.get('surface:犬')).toEqual(other);
  });
  it('late failure cannot undo a later grade or freshly fetched server result', () => {
    const { client, word, read } = setup();
    const first = beginVocabularyReview(client, 'u', word, { next_review_at: 'one' });
    const second = beginVocabularyReview(client, 'u', word, { next_review_at: 'two' });
    settleVocabularyReview(client, first);
    expect(read().byKey.get('surface:猫').next_review_at).toBe('two');
    settleVocabularyReview(client, second, { next_review_at: 'confirmed', last_reviewed_at: 'stamp' });
    settleVocabularyReview(client, first);
    expect(read().byKey.get('surface:猫').next_review_at).toBe('confirmed');
    expect(read().byKey.get('surface:猫')).not.toHaveProperty('__pendingReview');
  });
  it('another word’s save/refetch retains a pending grade until its own result', () => {
    const { client, word, other, read } = setup();
    const original = read();
    const context = beginVocabularyReview(client, 'u', word, { next_review_at: 'later' });
    const second = beginVocabularyReview(client, 'u', other, { next_review_at: 'dog-later' });
    const fresh = preservePendingVocabularyReviews(original, read());
    client.setQueryData(['vocab-words', 'u'], fresh);
    settleVocabularyReview(client, context, { next_review_at: 'cat-confirmed' });
    expect(read().byKey.get('surface:犬').next_review_at).toBe('dog-later');
    settleVocabularyReview(client, second);
    expect(read().byKey.get('surface:犬')).toEqual(other);
    expect(read().byKey.get('surface:猫').next_review_at).toBe('cat-confirmed');
  });
});
