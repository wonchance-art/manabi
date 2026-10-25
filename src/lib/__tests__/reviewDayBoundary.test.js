import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateFSRS, calculateVocabFSRS, vocabStepPhase } from '../fsrs.js';
import { introduceFsrsCard, learningDay, learningDaySpan, learningDayStart, previewFsrsRatings } from '../fsrsScheduler.js';
import { cardIntervalDays } from '../growthStats.js';
import { dueAmount, legacyGradePreviews, gradePreviews } from '../levelWordStatus.js';
import { fsrsIntervalLabel } from '../useFsrsReview.js';

// 날 경계 복습 기한 계약(오너 2026-10-25 KST: 「1일 지정시 정확히 24시간 후가 아니라 날짜 넘어가면 바로 활성화」 → 「Anki와 동일하게」).
// Anki(rslib)는 복습 기한을 날 번호로 두고 「다음 날 시작」(기본 04:00)에 연다 — 실측: 23:00에 답한 1일 카드 → 다음 날 04:00,
// 02:00에 답한 카드 → 그날 04:00(02:00은 전날로 센다). 우리 학습일도 04:00 KST라 같은 경계를 쓴다.
// 설계: 「1일 복습 날짜 경계 · 새 단어 섞기 설계」 Claude Doc · /mnt/project-files/review-day-boundary/anki.md.
const KST = (s) => Date.parse(`${s}+09:00`);
const iso = (ms) => new Date(ms).toISOString();

afterEach(() => vi.useRealTimers());

describe('learningDayStart — 학습일이 시작하는 시각', () => {
  it('서울 04:00 KST · learningDay와 맞물린다', () => {
    const day = learningDay(KST('2026-10-25T23:00:00'));
    expect(learningDayStart(day + 1)).toBe(KST('2026-10-26T04:00:00'));
    expect(learningDay(learningDayStart(day + 1))).toBe(day + 1);
    expect(learningDay(learningDayStart(day + 1) - 1)).toBe(day);
    expect(learningDay(KST('2026-10-26T02:00:00'))).toBe(day); // 02:00은 전날
  });
  it('다른 시간대는 지역 달력 — 일광 절약 전환일에도 경계가 맞다', () => {
    for (const at of ['2026-03-08T12:00:00Z', '2026-11-01T12:00:00Z']) {
      const day = learningDay(at, 'America/New_York');
      const startMs = learningDayStart(day, 'America/New_York');
      expect(learningDay(startMs, 'America/New_York')).toBe(day);
      expect(learningDay(startMs - 1, 'America/New_York')).toBe(day - 1);
    }
    expect(learningDayStart(learningDay('2026-03-08T12:00:00Z', 'America/New_York'), 'America/New_York')).toBe(Date.parse('2026-03-08T08:00:00Z')); // 04:00 EDT
  });
  it('learningDaySpan — 학습일 시작 시각인 기한만 날 수, 분 단위 · 24시간 기한은 null', () => {
    const at = KST('2026-10-25T23:00:00');
    expect(learningDaySpan(iso(KST('2026-10-26T04:00:00')), at)).toBe(1);
    expect(learningDaySpan(iso(KST('2026-11-02T04:00:00')), at)).toBe(8);
    expect(learningDaySpan(iso(at + 600000), at)).toBeNull();
    expect(learningDaySpan(iso(at + 86400000), at)).toBeNull();
  });
});

describe('복습 단계 기한 = 채점한 학습일 + N일이 시작하는 04:00 KST — 두 엔진', () => {
  // 새 단어를 「쉬움」으로 답하면 바로 복습 단계(8일)다. 23:00과 다음 날 02:00은 같은 학습일이라 기한이 같다(Anki 실측과 같은 꼴).
  const cases = [['2026-10-25T23:00:00', '2026-11-02T04:00:00'], ['2026-10-26T02:00:00', '2026-11-02T04:00:00'], ['2026-10-25T15:00:00', '2026-11-02T04:00:00']];
  it.each(cases)('FSRS 카드: %s에 쉬움 → %s', (when, expected) => {
    const at = KST(when);
    const card = introduceFsrsCard(iso(at - 60000), { policyVersion: 'anki-v2' });
    const easy = previewFsrsRatings(card, iso(at))[4].card;
    expect(easy.state).toBe('Review');
    expect(easy.scheduledDays).toBe(8);
    expect(easy.due).toBe(iso(KST(expected)));
  });
  it.each(cases)('옛 일정 단어: %s에 쉬움 → %s', (when, expected) => {
    expect(calculateVocabFSRS(4, undefined, KST(when)).next_review_at).toBe(iso(KST(expected)));
  });
  it('학습 단계(분 단위)는 시각 그대로 — 23:55의 알맞음 10분은 00:05(Anki도 차이가 최대 10분이라 따르지 않는다)', () => {
    const at = KST('2026-10-25T23:55:00');
    const card = introduceFsrsCard(iso(at - 60000), { policyVersion: 'anki-v2' });
    expect(previewFsrsRatings(card, iso(at))[3].card.due).toBe(iso(at + 600000));
    expect(calculateVocabFSRS(3, undefined, at).next_review_at).toBe(iso(at + 600000));
  });
  it('일정 칸만 있는 옛 행(calculateFSRS — 문법 · 드릴 · 기록 없는 행)도 같은 경계', () => {
    vi.useFakeTimers();
    vi.setSystemTime(KST('2026-10-25T23:00:00'));
    const due = Date.parse(calculateFSRS(3, { interval: 0, ease_factor: 0, repetitions: 0, next_review_at: null }).next_review_at);
    expect(due).toBe(learningDayStart(learningDay(due)));
    expect(learningDay(due) - learningDay(Date.now())).toBeGreaterThanOrEqual(1);
  });
});

describe('옛 일정 행 읽기 — 04:00 직전에 답해 기한이 몇 분 뒤여도 복습 단계', () => {
  it('03:55에 1일로 답한 행(기한 04:00, 5분 뒤)은 복습 단계 · 간격 1일', () => {
    const last = KST('2026-10-26T03:55:00'), due = KST('2026-10-26T04:00:00');
    const row = { interval: 3.2, ease_factor: 5, repetitions: 0, last_reviewed_at: iso(last), next_review_at: iso(due) };
    expect(vocabStepPhase(row)).toEqual({ state: 'Review', step: 0 });
    expect(cardIntervalDays(row)).toBe(1);
    // 학습 단계 행(10분 뒤 기한)은 그대로 학습 단계.
    expect(vocabStepPhase({ ...row, next_review_at: iso(last + 600000) }).state).toBe('Learning');
  });
  it('기한이 되면 바로 다시 채점할 수 있고 다음 기한도 날 경계', () => {
    const last = KST('2026-10-25T23:00:00');
    const first = calculateVocabFSRS(4, undefined, last);
    const row = { ...first, last_reviewed_at: iso(last), created_at: iso(last - 60000) };
    const open = Date.parse(first.next_review_at);
    const next = calculateVocabFSRS(3, row, open);
    expect(Date.parse(next.next_review_at)).toBe(learningDayStart(learningDay(Date.parse(next.next_review_at))));
    expect(Date.parse(next.next_review_at)).toBeGreaterThan(open);
  });
});

describe('간격 글자 — 날 단위 기한은 학습일 수(23:00에 누른 「8일」은 남은 7일 5시간이 아니라 8일)', () => {
  const at = KST('2026-10-25T23:00:00');
  it('단어 페이지 네 칸 · 뷰어 인라인 복습', () => {
    const fresh = gradePreviews({ projection: null, row: null, at });
    expect(fresh[4]).toMatchObject({ label: '8일', amount: { n: 8, unit: '일' } });
    expect(fresh[3]).toMatchObject({ label: '10분', amount: { n: 10, unit: '분' } });
    const row = { ...calculateVocabFSRS(4, undefined, at - 9 * 86400000), last_reviewed_at: iso(at - 9 * 86400000), created_at: iso(at - 9 * 86400000) };
    const legacy = legacyGradePreviews(row, at);
    for (const g of [2, 3, 4]) expect(legacy[g].amount.unit).toBe('일');
    expect(legacy[1].amount.unit).toBe('분');
  });
  it('다음 차례 글자 · 복습실 단추 글자', () => {
    expect(dueAmount(iso(KST('2026-10-26T04:00:00')), at)).toEqual({ n: 1, unit: '일' });
    expect(dueAmount(iso(at + 600000), at)).toEqual({ n: 10, unit: '분' });
    expect(fsrsIntervalLabel(iso(KST('2026-10-26T04:00:00')), iso(at))).toBe('1d');
    expect(fsrsIntervalLabel(iso(at + 600000), iso(at))).toBe('10m');
    expect(fsrsIntervalLabel(iso(at + 86400000), iso(at))).toBe('1d'); // 바꾸기 전 24시간 기한
  });
});
