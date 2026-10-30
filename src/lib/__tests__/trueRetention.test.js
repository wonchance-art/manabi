import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { buildTrueRetention, TRUE_RETENTION_HEADLINE, TRUE_RETENTION_PERIODS } from '../trueRetention';
import { FSRS_POLICY, introduceFsrsCard, learningDay, scheduleFsrsReview } from '../fsrsScheduler';
import { MATURE_MIN_INTERVAL } from '../growthStats';
import { buildPracticeEvent } from '../practiceEvents';

// 계약: 실제 기억률 표(docs/design/true-retention.md · Anki 24.11 True Retention 대조).
// 행 모양은 저장 경로 그대로다 — 새 일정 채점 · undo 이벤트는 fsrs_apply_operation(m09 repair 018 §grade/undo)이 쓰는 detail,
// 예전 일정은 VocabPage · useInlineReview · studyExerciseBridge의 detail, 연습은 practiceEvents.buildPracticeEvent,
// 예전 일정 undo는 reviewOutbox의 보상 이벤트. 시각은 PostgREST가 돌려주는 '+00:00' 표기로 둔다.

const NOW = Date.parse('2026-10-30T12:00:00+09:00'); // 목 12:00 KST — 오늘 학습일은 10-30 04:00 KST부터
const kst = (local) => new Date(Date.parse(`${local}+09:00`)).toISOString().replace('Z', '+00:00');
const kstZ = (local) => new Date(Date.parse(`${local}+09:00`)).toISOString();

// 같은 카드를 알맞음(3)으로 키운다 — 1단계: 학습(Learning) · 2단계: 복습 2일 · 3단계: 11일 · 4단계: 46일(실제 엔진 출력).
function grownCard(steps) {
  let card = introduceFsrsCard('2026-01-05T01:00:00.000Z');
  for (let i = 0; i < steps; i += 1) card = scheduleFsrsReview(card, 3, card.due).card;
  return card;
}

let seq = 0;
/** 새 일정 채점 한 번 → [fsrs_operations 행, review_events 행] (SQL fsrs_apply_operation의 grade 분기 모양). */
function fsrsGrade({ card, rating, at, word = '책', lang = 'Korean', cardId = `card-${word}` }) {
  const id = `op-${(seq += 1)}`;
  const { card: next, log } = scheduleFsrsReview(card, rating, at);
  const operation = { kind: 'grade', attemptId: `attempt-${seq}`, previousCard: card, nextCard: next,
    log: { ...log, questionAt: at, revealedAt: at, optimizerEligible: true, rewardEligible: true } };
  const op = { id, card_id: cardId, kind: 'grade', operation, received_at: log.reviewedAt };
  const event = { lang, source: 'vocab', item_key: word, correct: rating > 1,
    created_at: log.reviewedAt.replace('Z', '+00:00'),
    detail: { word_id: cardId, meaning: '뜻', rating, mode: 'flash', qtype: 'flash',
      fsrs_operation_id: id, fsrs_version: 1, optimizerEligible: true, rewardEligible: true } };
  return { op, event };
}
/** 새 일정 undo — fsrs_operations undo 행 + review_events 보상 이벤트(source ui · qtype undo · undo_of). */
function fsrsUndo(grade, at) {
  const id = `op-${(seq += 1)}`;
  const op = { id, card_id: grade.op.card_id, kind: 'undo', operation: { kind: 'undo', undoneOperationId: grade.op.id, log: { reviewedAt: at } } };
  const marker = { lang: grade.event.lang, source: 'ui', item_key: grade.event.item_key, correct: true, created_at: at.replace('Z', '+00:00'),
    detail: { qtype: 'undo', fsrs_operation_id: id,
      undo_of: { item_key: grade.event.item_key, rating: grade.event.detail.rating, reviewed_at: grade.op.operation.log.reviewedAt } } };
  return { op, marker };
}
/** 예전 일정 채점(VocabPage 모양) — 직전 간격 기록이 없다. */
const legacy = ({ at, rating, word = '食べる', wordId = `w-${word}`, lang = 'Japanese', mode = 'flash', ...extra }) => ({
  lang, source: 'vocab', item_key: word, correct: rating > 1, created_at: kst(at),
  detail: { word_id: wordId, meaning: '먹다', rating, mode, qtype: mode === 'flash' ? 'flash' : 'choice', ...extra },
});
const cell = (r, key, part) => r.periods.find(p => p.key === key)[part];

describe('실제 기억률 표 — 무엇을 세나', () => {
  it('새 일정: 직전 카드가 복습 단계인 채점만, 직전 간격 21일 이상이 익숙 · 다시만 실패(어려움은 맞힘)', () => {
    const mature = fsrsGrade({ card: grownCard(4), rating: 2, at: kstZ('2026-10-30T09:00:00'), word: '사과' }); // 46일 → 익숙 · 어려움 = 맞힘
    const matureFail = fsrsGrade({ card: grownCard(4), rating: 1, at: kstZ('2026-10-30T09:05:00'), word: '배' });
    const young = fsrsGrade({ card: grownCard(3), rating: 3, at: kstZ('2026-10-30T09:10:00'), word: '귤' }); // 11일 → 익히는 중
    const learning = fsrsGrade({ card: grownCard(1), rating: 1, at: kstZ('2026-10-30T09:15:00'), word: '감' }); // 학습 단계 → 빼기
    expect(mature.op.operation.previousCard.scheduledDays).toBeGreaterThanOrEqual(MATURE_MIN_INTERVAL);
    expect(young.op.operation.previousCard.scheduledDays).toBeLessThan(MATURE_MIN_INTERVAL);
    const all = [mature, matureFail, young, learning];
    const r = buildTrueRetention({ events: all.map(g => g.event), operations: all.map(g => g.op), now: NOW });
    expect(cell(r, 'today', 'mature')).toEqual({ passed: 1, failed: 1, total: 2, rate: 0.5 });
    expect(cell(r, 'today', 'young')).toEqual({ passed: 1, failed: 0, total: 1, rate: 1 });
    expect(cell(r, 'today', 'all')).toEqual({ passed: 2, failed: 1, total: 3, rate: 2 / 3 });
    expect(r.skipped).toEqual({ learning: 1, first: 0, unknown: 0 });
  });

  it('목표 기억률은 FSRS_POLICY.retention 정본(0.9) — 빈 칸의 비율은 0이 아니라 null', () => {
    const r = buildTrueRetention({ events: [], now: NOW });
    expect(r.target).toBe(FSRS_POLICY.retention);
    expect(r.target).toBe(0.9);
    expect(r.periods.map(p => p.key)).toEqual(['today', 'yesterday', 'week', 'month', 'year', 'all']);
    expect(cell(r, 'month', 'all')).toEqual({ passed: 0, failed: 0, total: 0, rate: null });
    expect(TRUE_RETENTION_HEADLINE).toBe('month');
  });

  it('연습 · 목록 자기 확인 · 산출 · 예열 · 행동 계측은 일정 밖이라 세지 않는다', () => {
    const base = fsrsGrade({ card: grownCard(3), rating: 3, at: kstZ('2026-10-30T10:00:00'), word: '물' });
    const practice = { ...buildPracticeEvent({ word: { id: 'card-물', language: 'Korean' }, qtype: 'choice', scope: 'lang=Korean', result: 'wrong' }),
      created_at: kst('2026-10-30T10:01:00') };
    const practiceSelf = { ...buildPracticeEvent({ word: { id: 'card-물', language: 'Korean' }, qtype: 'self', scope: '', result: 'unknown' }),
      created_at: kst('2026-10-30T10:02:00') };
    const level = { lang: 'Chinese', source: 'level', item_key: '水', correct: false, created_at: kst('2026-10-30T10:03:00'), detail: { qtype: 'meaning' } };
    const hanzi = { lang: 'Chinese', source: 'hanzi', item_key: '水', correct: true, created_at: kst('2026-10-30T10:04:00'), detail: {} };
    // /study 산출 — source vocab이지만 FSRS 무반영(v2 헌법 M7). 예열 — 단어 id 없음. 만남 인지 — word_id null.
    const produce = { lang: 'Japanese', source: 'vocab', item_key: '食べる', correct: true, created_at: kst('2026-10-30T10:05:00'), detail: { qtype: 'produce', score: 3, rt_ms: 900 } };
    const warmup = { lang: 'Japanese', source: 'vocab', item_key: '食べる', correct: false, created_at: kst('2026-10-30T10:06:00'), detail: { mode: 'study', qtype: 'choice', rt_ms: 1, warmup: true } };
    const encounter = { lang: 'Japanese', source: 'vocab', item_key: '飲む', correct: false, created_at: kst('2026-10-30T10:07:00'), detail: { word_id: null, mode: 'study', qtype: 'choice', origin: 'encounter', rt_ms: 1 } };
    const tap = { lang: 'Korean', source: 'ui', item_key: '-', correct: true, created_at: kst('2026-10-30T10:08:00'), detail: { qtype: 'forecast_tap' } };
    const r = buildTrueRetention({ events: [base.event, practice, practiceSelf, level, hanzi, produce, warmup, encounter, tap], operations: [base.op], now: NOW });
    expect(cell(r, 'today', 'all')).toEqual({ passed: 1, failed: 0, total: 1, rate: 1 });
    expect(r.skipped).toEqual({ learning: 0, first: 0, unknown: 0 }); // 일정 밖 행은 「건너뜀」에도 들지 않는다
  });

  it('새 일정 채점인데 연산 행을 못 받았으면 추정하지 않고 unknown으로 센다', () => {
    const g = fsrsGrade({ card: grownCard(4), rating: 3, at: kstZ('2026-10-30T10:00:00') });
    const r = buildTrueRetention({ events: [g.event], operations: [], now: NOW });
    expect(cell(r, 'today', 'all').total).toBe(0);
    expect(r.skipped.unknown).toBe(1);
  });
});

describe('되돌린 채점 제외', () => {
  it('새 일정 undo 보상 이벤트가 원 채점을 뺀다(undoneReviews 정본) — 보상 이벤트 자체도 안 센다', () => {
    const kept = fsrsGrade({ card: grownCard(4), rating: 3, at: kstZ('2026-10-30T09:00:00'), word: '사과' });
    const undone = fsrsGrade({ card: grownCard(4), rating: 1, at: kstZ('2026-10-30T09:01:00'), word: '배' });
    const { marker } = fsrsUndo(undone, kstZ('2026-10-30T09:01:20'));
    const r = buildTrueRetention({ events: [kept.event, undone.event, marker], operations: [kept.op, undone.op], now: NOW });
    expect(cell(r, 'today', 'mature')).toEqual({ passed: 1, failed: 0, total: 1, rate: 1 });
  });

  it('마커 조회가 잘려도(fetchUndoMarkers limit) undo 연산의 undoneOperationId로 원 채점을 뺀다', () => {
    const undone = fsrsGrade({ card: grownCard(4), rating: 1, at: kstZ('2026-10-30T09:01:00'), word: '배' });
    const { op: undoOp } = fsrsUndo(undone, kstZ('2026-10-30T09:01:20'));
    const r = buildTrueRetention({ events: [undone.event], undoMarkers: [], operations: [undone.op, undoOp], now: NOW });
    expect(cell(r, 'today', 'all').total).toBe(0);
  });

  it('예전 일정 undo(reviewOutbox 보상 이벤트)도 원 채점을 빼고, 다음 답의 직전 간격은 되돌리지 않은 답부터 잰다', () => {
    const first = legacy({ at: '2026-10-01T09:00:00', rating: 3 });
    const undone = legacy({ at: '2026-10-20T09:00:00', rating: 1 });
    const marker = { lang: 'Japanese', source: 'ui', item_key: '食べる', correct: true, created_at: kst('2026-10-20T09:00:30'),
      detail: { qtype: 'undo', word_id: 'w-食べる', undo_of: { item_key: '食べる', rating: 1, reviewed_at: kstZ('2026-10-20T09:00:00'), word_id: 'w-食べる' } } };
    const again = legacy({ at: '2026-10-30T09:00:00', rating: 3 }); // 10-01부터 29일 → 익숙(추정)
    const r = buildTrueRetention({ events: [first, undone, marker, again], now: NOW });
    expect(cell(r, 'today', 'mature')).toEqual({ passed: 1, failed: 0, total: 1, rate: 1 });
    expect(cell(r, 'month', 'all').total).toBe(1);
    expect(r.estimated).toBe(1);
  });
});

describe('학습일 경계(04:00 KST)와 기간', () => {
  it('03:59 KST 채점은 어제, 04:00 KST 채점은 오늘 — KST 자정이 아니라 학습일 경계를 쓴다', () => {
    const before = fsrsGrade({ card: grownCard(3), rating: 1, at: kstZ('2026-10-30T03:59:59'), word: '귤' });
    const after = fsrsGrade({ card: grownCard(3), rating: 3, at: kstZ('2026-10-30T04:00:00'), word: '감' });
    const r = buildTrueRetention({ events: [before.event, after.event], operations: [before.op, after.op], now: NOW });
    expect(cell(r, 'today', 'young')).toEqual({ passed: 1, failed: 0, total: 1, rate: 1 });
    expect(cell(r, 'yesterday', 'young')).toEqual({ passed: 0, failed: 1, total: 1, rate: 0 });
    expect(cell(r, 'week', 'young').total).toBe(2);
  });

  it('오늘이 03:30 KST면 아직 어제 학습일이다 — 전날 23:00 채점이 「오늘」에 든다', () => {
    const g = fsrsGrade({ card: grownCard(3), rating: 3, at: kstZ('2026-10-29T23:00:00') });
    const r = buildTrueRetention({ events: [g.event], operations: [g.op], now: Date.parse('2026-10-30T03:30:00+09:00') });
    expect(cell(r, 'today', 'all').total).toBe(1);
    expect(r.today).toBe(learningDay(Date.parse('2026-10-29T12:00:00+09:00')));
  });

  it('지난 7일 = 오늘 포함 7학습일, 지난 30일 = 30학습일, 365일 밖은 전체에만', () => {
    const at = (local) => fsrsGrade({ card: grownCard(4), rating: 3, at: kstZ(local) });
    const day6 = at('2026-10-24T04:00:00'); // 오늘 − 6일 첫 순간 → 7일 안
    const day7 = at('2026-10-24T03:59:00'); // 오늘 − 7일 마지막 순간 → 30일 안, 7일 밖
    const day29 = at('2026-10-01T04:00:00'); // 오늘 − 29일 → 30일 안
    const day30 = at('2026-10-01T03:00:00'); // 오늘 − 30일 → 1년 안
    const old = fsrsGrade({ card: grownCard(3), rating: 1, at: kstZ('2026-03-04T21:00:00') }); // 1년 안 · 30일 밖
    const all = [day6, day7, day29, day30, old];
    const r = buildTrueRetention({ events: all.map(g => g.event), operations: all.map(g => g.op), now: NOW });
    expect(cell(r, 'week', 'all').total).toBe(1);
    expect(cell(r, 'month', 'all').total).toBe(3);
    expect(cell(r, 'year', 'all').total).toBe(5);
    expect(cell(r, 'all', 'all').total).toBe(5);
    const veryOld = { ...day6.event, created_at: kst('2025-10-29T12:00:00') }; // 366학습일 전 — 전체에만
    const r2 = buildTrueRetention({ events: [veryOld], operations: [day6.op], now: NOW });
    expect(cell(r2, 'year', 'all').total).toBe(0);
    expect(cell(r2, 'all', 'all').total).toBe(1);
  });

  it('PostgREST 마이크로초 표기도 읽는다 · 기기 시계가 앞선(미래) 행은 어느 기간에도 넣지 않는다', () => {
    const g = fsrsGrade({ card: grownCard(3), rating: 3, at: kstZ('2026-10-30T09:00:00') });
    const micro = { ...g.event, created_at: '2026-10-30T00:00:00.123456+00:00' };
    const future = { ...g.event, created_at: kst('2026-10-31T09:00:00') };
    expect(cell(buildTrueRetention({ events: [micro], operations: [g.op], now: NOW }), 'today', 'all').total).toBe(1);
    expect(cell(buildTrueRetention({ events: [future], operations: [g.op], now: NOW }), 'all', 'all').total).toBe(0);
  });
});

describe('예전 일정 — 직전 간격 기록이 없어 추정한다', () => {
  it('첫 채점은 직전 간격이 없어 빼고(first), 같은 날 다시 본 답은 학습 단계처럼 뺀다(learning)', () => {
    const events = [
      legacy({ at: '2026-10-28T09:00:00', rating: 3 }),      // 첫 채점 → first
      legacy({ at: '2026-10-30T09:00:00', rating: 1 }),      // 2학습일 → 익히는 중 · 실패
      legacy({ at: '2026-10-30T09:05:00', rating: 3 }),      // 같은 날 다시(VocabPage 다시 → 재출제) → learning
    ];
    const r = buildTrueRetention({ events, now: NOW });
    expect(cell(r, 'today', 'young')).toEqual({ passed: 0, failed: 1, total: 1, rate: 0 });
    expect(r.skipped).toEqual({ learning: 1, first: 1, unknown: 0 });
    expect(r.estimated).toBe(1);
  });

  it('detail.prev_interval_days가 있으면 추정 대신 그 값을 쓴다(기록 보강 제안의 앞날 호환)', () => {
    const events = [legacy({ at: '2026-10-30T09:00:00', rating: 3, prev_interval_days: 30 })];
    const r = buildTrueRetention({ events, now: NOW });
    expect(cell(r, 'today', 'mature').total).toBe(1);
    expect(r.estimated).toBe(0);
    expect(r.skipped.first).toBe(0);
  });

  it('/study 어휘 문항(평가 없이 정오로 일정을 바꾼다)도 같은 단어의 채점 줄에 든다', () => {
    const study = (at, correct) => ({ lang: 'Japanese', source: 'vocab', item_key: '食べる', correct, created_at: kst(at),
      detail: { word_id: 'w-食べる', meaning: '먹다', mode: 'study', qtype: 'choice', rt_ms: 1200 } });
    const events = [study('2026-10-05T09:00:00', true), legacy({ at: '2026-10-29T09:00:00', rating: 3 }), study('2026-10-30T09:00:00', false)];
    const r = buildTrueRetention({ events, now: NOW });
    expect(cell(r, 'yesterday', 'mature')).toEqual({ passed: 1, failed: 0, total: 1, rate: 1 }); // 24학습일
    expect(cell(r, 'today', 'young')).toEqual({ passed: 0, failed: 1, total: 1, rate: 0 });     // 1학습일
  });

  it('평가도 /study 표지도 없는 어휘 행은 일정을 바꿨는지 알 수 없어 세지 않는다', () => {
    const odd = (at) => ({ lang: 'Japanese', source: 'vocab', item_key: '食べる', correct: true, created_at: kst(at),
      detail: { word_id: 'w-食べる', meaning: '먹다', qtype: 'choice' } });
    const r = buildTrueRetention({ events: [odd('2026-10-01T09:00:00'), odd('2026-10-30T09:00:00')], now: NOW });
    expect(cell(r, 'all', 'all').total).toBe(0);
    expect(r.skipped).toEqual({ learning: 0, first: 0, unknown: 0 });
  });

  it('언어 칩으로 걸러도 직전 채점 줄은 언어 거르기 전에 이어진다 · 입력 순서와 무관', () => {
    const events = [
      legacy({ at: '2026-10-30T09:00:00', rating: 3 }),
      legacy({ at: '2026-10-01T09:00:00', rating: 3 }),
      legacy({ at: '2026-10-29T09:00:00', rating: 1, word: 'pomme', lang: 'French' }),
      legacy({ at: '2026-10-25T09:00:00', rating: 3, word: 'pomme', lang: 'French' }),
    ];
    const ja = buildTrueRetention({ events, lang: 'Japanese', now: NOW });
    expect(cell(ja, 'all', 'mature')).toEqual({ passed: 1, failed: 0, total: 1, rate: 1 });
    expect(cell(ja, 'all', 'young').total).toBe(0);
    const fr = buildTrueRetention({ events, lang: 'French', now: NOW });
    expect(cell(fr, 'all', 'young')).toEqual({ passed: 0, failed: 1, total: 1, rate: 0 });
  });
});

describe('정본 재사용 — 중복 신설 금지', () => {
  const src = fs.readFileSync('src/lib/trueRetention.js', 'utf8');
  it('채점 판정 · 되돌림 · 학습일 · 익숙 경계 · 목표를 정본에서 가져온다', () => {
    expect(src).toMatch(/import \{ isGradedReviewEvent \} from '\.\/weeklyReport\.js'/);
    expect(src).toMatch(/import \{ dropUndoneEvents \} from '\.\/undoneReviews\.js'/);
    expect(src).toMatch(/import \{ FSRS_POLICY, learningDay \} from '\.\/fsrsScheduler\.js'/);
    expect(src).toMatch(/import \{ MATURE_MIN_INTERVAL \} from '\.\/growthStats\.js'/);
    // 주석 밖 코드에 경계 · 목표 숫자를 다시 쓰지 않는다(정본이 바뀌면 이 표만 낡는다).
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\b21\b|0\.9\b|9 \* 3600/);
  });
  it('기간 폭은 Anki와 같다 — 1 · 1 · 7 · 30 · 365학습일 · 전체', () => {
    expect(TRUE_RETENTION_PERIODS.map(p => (p.fromDay == null ? null : p.fromDay - p.toDay + 1))).toEqual([1, 1, 7, 30, 365, null]);
  });
});
