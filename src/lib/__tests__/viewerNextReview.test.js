import { describe, expect, it } from 'vitest';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler';
import { buildVocabularyWordIndex, indexedVocabularyNextReview, isIndexedVocabularyDue } from '../vocabularyDueIndex';
import { formatNextReviewDate, nextReviewForSavedWord } from '../viewerNextReview';

/**
 * 계약: 단어창 하단 저장 줄 「✓ 단어장에 있음 · 다음 복습 10월 12일」(VIEWER-V2-ROUNDS-001 §2 하단 · AE-R1 설계서 §3.1).
 * - 출처 = savedWords.projectionsById의 review.nextQuestionAt(추가 조회 없음, 읽기 전용).
 *   isIndexedVocabularyDue와 같은 projection(legacy 낙관 패치 반영, FSRS cohort 고정)을 쓴다.
 * - 날짜 = KST + 04시 학습일 경계(FSRS_POLICY). 표기 = `${월}월 ${일}일`, 해가 다르면 연도.
 * - 복습 대상이 아니면(아는 단어·제외·FSRS 비활성·일정 없음·평가 전송 중·남의 행) null.
 */
const START = Date.parse('2026-10-04T00:00:00.000Z'); // 10월 4일 09:00 KST
const NOW = START + 90000;
const iso = (value) => new Date(value).toISOString();
const actorId = 'actor';
function row(id, extra = {}) {
  return { id, user_id: actorId, word_text: id, base_form: id, language: 'Chinese', meaning: '개인 뜻',
    source_sentence: '원문', source_material_id: 1, created_at: iso(START - 86400000),
    interval: 3, ease_factor: 5, repetitions: 2, last_reviewed_at: iso(START - 86400000), next_review_at: iso(START - 10000), ...extra };
}
const legacy = (value) => ({ cardId: value.id, userId: actorId, enrolled: false, eligible: true,
  known: false, excluded: false, card: null, nextQuestionAt: null, firstQuestionAt: null });
function snapshot(mutate) {
  const card = scheduleFsrsReview(introduceFsrsCard(START), 1, START + 30000).card;
  const rows = [
    row('学习'),
    row('体育场', { next_review_at: '2026-10-12T03:00:00.000Z' }), // 10월 12일 12:00 KST
    row('壮观', { next_review_at: '2026-10-12T18:00:00.000Z' }), // 10월 13일 03:00 KST → 학습일 12일
    row('明年', { next_review_at: '2027-01-03T03:00:00.000Z' }),
    row('没排', { next_review_at: null, last_reviewed_at: null }),
  ];
  const data = { version: 1, actorId, enabled: true, registryAvailable: true, complete: true, now: iso(NOW), rows,
    registry: [{ ...legacy(rows[0]), enrolled: true, card, nextQuestionAt: iso(START + 86400000 * 5 + 3600000), firstQuestionAt: iso(START + 30000) },
      ...rows.slice(1).map(legacy)] };
  mutate?.(data);
  return data;
}

describe('다음 복습 선택자 — projectionsById 기반', () => {
  it('legacy 행: 10월 12일 · 복습 전 · 오늘부터 8일', () => {
    const data = snapshot(), index = buildVocabularyWordIndex(data, NOW);
    expect(nextReviewForSavedWord(index, data.rows[1], { at: NOW })).toEqual({
      label: '10월 12일', year: 2026, month: 10, date: 12, daysAway: 8, due: false,
      at: '2026-10-12T03:00:00.000Z', source: 'legacy' });
  });
  it('FSRS 코호트 행은 registry의 nextQuestionAt(행의 legacy 일정이 아니라)', () => {
    const data = snapshot(), index = buildVocabularyWordIndex(data, NOW);
    const next = nextReviewForSavedWord(index, data.rows[0], { at: NOW });
    expect(next).toMatchObject({ source: 'fsrs-v1', at: data.registry[0].nextQuestionAt, label: '10월 9일', due: false });
  });
  it('새벽 4시 전 시각은 그 전날 학습일 — 10월 13일 03:00 KST = 10월 12일', () => {
    const data = snapshot(), index = buildVocabularyWordIndex(data, NOW);
    expect(nextReviewForSavedWord(index, data.rows[2], { at: NOW }).label).toBe('10월 12일');
  });
  it('해가 다르면 연도를 붙인다 · 중국어 해설 로캘은 月日', () => {
    const data = snapshot(), index = buildVocabularyWordIndex(data, NOW);
    expect(nextReviewForSavedWord(index, data.rows[3], { at: NOW }).label).toBe('2027년 1월 3일');
    expect(nextReviewForSavedWord(index, data.rows[1], { at: NOW, locale: 'zh-CN' }).label).toBe('10月12日');
    expect(nextReviewForSavedWord(index, data.rows[3], { at: NOW, locale: 'zh-TW' }).label).toBe('2027年1月3日');
  });
  it('복습 시점이 지났으면 due — isIndexedVocabularyDue와 같은 판정', () => {
    const data = snapshot((d) => { d.registry[0].nextQuestionAt = iso(NOW - 1000); });
    const index = buildVocabularyWordIndex(data, NOW);
    for (const r of data.rows.slice(0, 2)) {
      expect(indexedVocabularyNextReview(index, r, { at: NOW + 1 })?.due ?? false).toBe(isIndexedVocabularyDue(index, r, { at: NOW + 1 }));
    }
    expect(nextReviewForSavedWord(index, data.rows[0], { at: NOW }).due).toBe(true);
  });
  it('legacy 낙관/되돌리기 패치(행 일정 변경)를 반영한다', () => {
    const data = snapshot(), index = buildVocabularyWordIndex(data, NOW);
    const patched = { ...data.rows[1], next_review_at: '2026-10-20T03:00:00.000Z' };
    expect(nextReviewForSavedWord(index, patched, { at: NOW }).label).toBe('10월 20일');
  });
  it.each([
    ['아는 단어', (d) => Object.assign(d.registry[1], { known: true, eligible: false })],
    ['제외', (d) => Object.assign(d.registry[1], { excluded: true, eligible: false })],
  ])('%s → null', (_name, mutate) => {
    const data = snapshot(mutate), index = buildVocabularyWordIndex(data, NOW);
    expect(nextReviewForSavedWord(index, data.rows[1], { at: NOW })).toBeNull();
  });
  it('FSRS 비활성 코호트·일정 없음·평가 전송 중·남의 행·미완 인덱스·미등록 행 → null', () => {
    const disabled = snapshot((d) => { d.enabled = false; });
    expect(nextReviewForSavedWord(buildVocabularyWordIndex(disabled, NOW), disabled.rows[0], { at: NOW })).toBeNull();
    const data = snapshot(), index = buildVocabularyWordIndex(data, NOW);
    expect(nextReviewForSavedWord(index, data.rows[4], { at: NOW })).toBeNull();
    expect(nextReviewForSavedWord(index, { ...data.rows[1], __pendingReview: 1 }, { at: NOW })).toBeNull();
    expect(nextReviewForSavedWord(index, { ...data.rows[1], user_id: 'other' }, { at: NOW })).toBeNull();
    expect(nextReviewForSavedWord({ ...index, complete: false }, data.rows[1], { at: NOW })).toBeNull();
    expect(nextReviewForSavedWord(index, row('unknown'), { at: NOW })).toBeNull();
    expect(nextReviewForSavedWord(undefined, data.rows[1], { at: NOW })).toBeNull();
    expect(nextReviewForSavedWord(index, null, { at: NOW })).toBeNull();
  });
  it('읽기 전용 — 행·스냅샷을 바꾸지 않는다', () => {
    const data = snapshot(), before = JSON.stringify(data), index = buildVocabularyWordIndex(data, NOW);
    for (const r of data.rows) nextReviewForSavedWord(index, r, { at: NOW });
    expect(JSON.stringify(data)).toBe(before);
  });
});

describe('formatNextReviewDate', () => {
  it('오늘·내일·지난 날의 daysAway', () => {
    expect(formatNextReviewDate('2026-10-04T10:00:00.000Z', { at: NOW })).toMatchObject({ label: '10월 4일', daysAway: 0, due: false });
    expect(formatNextReviewDate('2026-10-05T01:00:00.000Z', { at: NOW })).toMatchObject({ label: '10월 5일', daysAway: 1 });
    expect(formatNextReviewDate('2026-10-01T01:00:00.000Z', { at: NOW })).toMatchObject({ label: '10월 1일', daysAway: -3, due: true });
  });
  it('KST 자정 넘김 — 10월 4일 23:30 KST는 4일, 10월 5일 04:00 KST는 5일', () => {
    expect(formatNextReviewDate('2026-10-04T14:30:00.000Z', { at: NOW }).label).toBe('10월 4일');
    expect(formatNextReviewDate('2026-10-04T19:00:00.000Z', { at: NOW }).label).toBe('10월 5일');
  });
  it('값이 없거나 깨지면 null', () => {
    expect(formatNextReviewDate(null, { at: NOW })).toBeNull();
    expect(formatNextReviewDate('not-a-date', { at: NOW })).toBeNull();
  });
});
