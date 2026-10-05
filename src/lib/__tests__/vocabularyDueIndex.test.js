import { describe, expect, it } from 'vitest';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler';
import { buildVocabularyWordIndex, countVocabularyDueInMaterial, findIndexedVocabulary, isIndexedVocabularyDue, selectLegacyReviewRows } from '../vocabularyDueIndex';

const START = Date.parse('2026-10-04T00:00:00.000Z');
const NOW = START + 90000;
const iso = value => new Date(value).toISOString();
const actorId = 'actor';
function row(id, extra = {}) {
  return { id, user_id: actorId, word_text: id, base_form: id, language: 'Chinese', meaning: '개인 뜻\r\n보존',
    source_sentence: '원문  그대로', source_material_id: 1, created_at: iso(START - 86400000),
    interval: 3, ease_factor: 5, repetitions: 2, last_reviewed_at: iso(START - 86400000), next_review_at: iso(START - 10000), ...extra };
}
const legacy = value => ({ cardId: value.id, userId: actorId, enrolled: false, eligible: true,
  known: false, excluded: false, card: null, nextQuestionAt: null, firstQuestionAt: null });
function snapshot() {
  const card = scheduleFsrsReview(introduceFsrsCard(START), 1, START + 30000).card;
  const rows = [row('学习', { next_review_at: iso(START + 86400000) }), row('학교', { language: 'Korean' }),
    row('legacy-new', { last_reviewed_at: null }), row('legacy-reviewed')];
  return { version: 1, actorId, enabled: true, registryAvailable: true, complete: true, now: iso(NOW), rows,
    registry: [{ ...legacy(rows[0]), enrolled: true, card, nextQuestionAt: card.due, firstQuestionAt: iso(START + 30000) }, ...rows.slice(1).map(legacy)] };
}

describe('remaining readers effective due index', () => {
  it('uses seconds state, preserves original meanings/source/schedule and never overlays FSRS on raw rows', () => {
    const data = snapshot(), before = JSON.stringify(data.rows), index = buildVocabularyWordIndex(data, NOW);
    const found = findIndexedVocabulary(index, { text: '学习' }, 'Chinese');
    expect(found).toBe(data.rows[0]);
    expect(isIndexedVocabularyDue(index, found, { at: NOW })).toBe(true);
    expect(isIndexedVocabularyDue(index, found, { at: NOW, legacyOnly: true })).toBe(false);
    expect(JSON.stringify(data.rows)).toBe(before);
  });
  it('applies cooldown, disabled and known exclusion without reverting to legacy timestamps', () => {
    for (const mode of ['cooldown', 'disabled', 'known', 'excluded']) {
      const data = snapshot();
      data.rows[0].next_review_at = iso(START - 50000);
      if (mode === 'cooldown') data.registry[0].nextQuestionAt = iso(NOW + 1000);
      if (mode === 'disabled') data.enabled = false;
      if (mode === 'known' || mode === 'excluded') Object.assign(data.registry[0], { [mode]: true, eligible: false });
      const index = buildVocabularyWordIndex(data, NOW);
      expect(isIndexedVocabularyDue(index, data.rows[0], { at: NOW })).toBe(false);
    }
  });
  it('uses scoped surface/base matches and counts each stored card once per material', () => {
    const data = snapshot();
    data.rows[0].base_form = '学';
    const index = buildVocabularyWordIndex(data, NOW);
    const material = { processed_json: { metadata: { language: 'Chinese' }, sequence: ['a', 'b', 'c'],
      dictionary: { a: { text: '学习' }, b: { text: '学了', base_form: '学' }, c: { text: '학교' } } } };
    expect(countVocabularyDueInMaterial(index, material, NOW)).toBe(1);
    expect(findIndexedVocabulary(index, { text: '학교' }, 'Chinese')).toBeNull();
    expect(countVocabularyDueInMaterial(undefined, material, NOW)).toBeNull();
  });
  it('keeps explicit legacy optimistic/undo schedule changes separate from immutable FSRS memory', () => {
    const data = snapshot(), index = buildVocabularyWordIndex(data, NOW), original = data.rows[3];
    expect(isIndexedVocabularyDue(index, original, { at: NOW, legacyOnly: true })).toBe(true);
    expect(isIndexedVocabularyDue(index, { ...original, __pendingReview: 1 }, { at: NOW })).toBe(false);
    expect(isIndexedVocabularyDue(index, { ...original, next_review_at: iso(NOW + 10000) }, { at: NOW })).toBe(false);
    expect(isIndexedVocabularyDue(index, { ...original }, { at: NOW })).toBe(true);
    expect(isIndexedVocabularyDue(index, { ...data.rows[0], next_review_at: iso(NOW + 86400000) }, { at: NOW })).toBe(true);
    expect(data.rows[3]).toBe(original);
  });
  it('does not admit unreviewed legacy or synthesize projections for inserted/unregistered rows', () => {
    const data = snapshot(), index = buildVocabularyWordIndex(data, NOW);
    expect(isIndexedVocabularyDue(index, data.rows[2], { at: NOW })).toBe(true);
    expect(isIndexedVocabularyDue(index, data.rows[2], { at: NOW, legacyOnly: true })).toBe(false);
    expect(isIndexedVocabularyDue(index, row('unknown'), { at: NOW })).toBe(false);
    expect(isIndexedVocabularyDue({ ...index, complete: false }, data.rows[3], { at: NOW })).toBe(false);
    expect(isIndexedVocabularyDue(index, { ...data.rows[3], user_id: 'other' }, { at: NOW })).toBe(false);
  });
  it('uses the server clock as a floor, including a request started before snapshot capture', () => {
    const data = snapshot(), index = buildVocabularyWordIndex(data, NOW - 1000);
    expect(isIndexedVocabularyDue(index, data.rows[0], { at: NOW - 2000 })).toBe(true);
  });
  it.each(['missing', 'unavailable', 'incomplete', 'foreign'])('rejects %s registry instead of returning zero', mode => {
    const data = snapshot();
    if (mode === 'missing') data.registry.pop();
    if (mode === 'unavailable') data.registryAvailable = false;
    if (mode === 'incomplete') data.complete = false;
    if (mode === 'foreign') data.rows[0].user_id = 'other';
    expect(() => buildVocabularyWordIndex(data, NOW)).toThrow();
    expect(() => selectLegacyReviewRows(data, { at: NOW })).toThrow();
  });
});

describe('unsupported legacy selection before sort and LIMIT', () => {
  it('finds reviewed legacy behind more than a page of earlier enrolled and unreviewed rows', () => {
    const data = snapshot(), reviewed = data.rows[3];
    const prefix = Array.from({ length: 1100 }, (_, i) => row(`enrolled-${i}`));
    const enrolled = prefix.map(value => ({ ...data.registry[0], cardId: value.id }));
    data.rows = [...prefix, data.rows[2], reviewed];
    data.registry = [...enrolled, legacy(data.rows[1100]), legacy(reviewed)];
    const before = JSON.stringify(data);
    expect(selectLegacyReviewRows(data, { at: NOW, language: 'Chinese', limit: 1 })).toEqual([reviewed]);
    expect(JSON.stringify(data)).toBe(before);
  });
  it('filters blank meaning and other language before the final limit, retaining actual row identity', () => {
    const data = snapshot();
    data.rows[3].meaning = '  ';
    const answer = row('after-blank'); data.rows.push(answer); data.registry.push(legacy(answer));
    const rows = selectLegacyReviewRows(data, { at: NOW, language: 'Chinese', requireMeaning: true, limit: 1 });
    expect(rows).toHaveLength(1); expect(rows[0]).toBe(answer);
  });
  it('keeps future reviewed legacy for weakness candidates while due lanes respect time', () => {
    const data = snapshot(); data.rows[3].next_review_at = iso(NOW + 3600000);
    expect(selectLegacyReviewRows(data, { at: NOW, language: 'Chinese' })).toEqual([]);
    expect(selectLegacyReviewRows(data, { at: NOW, language: 'Chinese', dueOnly: false })).toEqual([data.rows[3]]);
  });
});
