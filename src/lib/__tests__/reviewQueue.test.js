import { describe, expect, it } from 'vitest';
import {
  BACKLOG_DEFAULT_BASELINE, BACKLOG_MIN_BASELINE, REASK_AFTER, SOURCE_SPACING, backlogBaseline, initialSteps, insertAfterIntro,
  insertLearningStep, intersperseNew, isBacklogged, orderReviewQueue, readResume, restoreResume, sessionLengthOptions, sliceSession, stepProgress, writeResume,
} from '../reviewQueue';

// REV-SCOPE-R1B-1 계약(설계 §6-1 ③ · §8): 두 엔진 한 줄 · 순서 · 끼우기 · 띄우기 · 처음 보는 표현 · 세션 길이 · 이어 하기 · 밀린 복습.
const DAY = 86_400_000;
const review = (id, engine, retrievability, extra = {}) => ({ id, engine, retrievability, dueAt: 0, ...extra });
const fresh = (id, engine, sourceKey = null, extra = {}) => ({ id, engine, sourceKey, createdAt: 0, ...extra });

describe('orderReviewQueue — 두 엔진을 한 줄로', () => {
  it('기한 지난 복습은 지금 기억 확률이 낮은 순 — 엔진과 무관하게 섞인다(FSRS 독점 없음)', () => {
    const items = orderReviewQueue({ reviews: [review('a', 'legacy', 0.9), review('b', 'fsrs', 0.4), review('c', 'legacy', 0.6), review('d', 'fsrs', 0.8)] });
    expect(items.map(item => item.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(new Set(items.map(item => item.engine))).toEqual(new Set(['fsrs', 'legacy']));
  });
  it('새 일정의 학습 · 재학습 단계 카드는 앞에 — 짧은 단계가 밀리지 않게', () => {
    const items = orderReviewQueue({ reviews: [review('a', 'legacy', 0.2), review('l', 'fsrs', 0.99, { learning: true })] });
    expect(items.map(item => item.id)).toEqual(['l', 'a']);
  });
  it('새 표현은 복습 사이에 고르게 편다 — Anki 「복습과 섞기」 비율 (복습 + 1) / (새 + 1) (오너 「Anki와 동일하게」 2026-10-25 KST)', () => {
    // Anki intersperser.rs 실측과 같은 예: 복습 10 · 새 5.
    const R = Array.from({ length: 10 }, (_, i) => `R${i}`), N = Array.from({ length: 5 }, (_, i) => `N${i}`);
    expect(intersperseNew(R, N).map(id => id[0]).join(' ')).toBe('R N R R N R R N R R N R R N R');
    expect(intersperseNew(R, N).filter(id => id[0] === 'N')).toEqual(N); // 순서는 그대로
    expect(intersperseNew([], N)).toEqual(N);
    expect(intersperseNew(R, [])).toEqual(R);
    // 새가 더 많으면 새 사이에 복습이 퍼진다(끝에 몰리지 않는다).
    expect(intersperseNew(['R0', 'R1'], ['N0', 'N1', 'N2', 'N3', 'N4']).map(id => id[0]).join(' ')).toBe('N R N N R N N');
    const reviews = Array.from({ length: 7 }, (_, i) => review(`r${i}`, i % 2 ? 'fsrs' : 'legacy', i / 10));
    const items = orderReviewQueue({ reviews, fresh: [fresh('n1', 'legacy'), fresh('n2', 'fsrs')] });
    expect(items.map(item => item.id)).toEqual(['r0', 'r1', 'n1', 'r2', 'r3', 'r4', 'n2', 'r5', 'r6']);
    expect(items.filter(item => item.isNew).map(item => item.id)).toEqual(['n1', 'n2']);
  });
  it('학습 단계 카드는 섞지 않고 맨 앞 — 새 표현은 그 뒤 복습 사이에 편다', () => {
    const items = orderReviewQueue({ reviews: [review('l', 'fsrs', 0.9, { learning: true }), review('a', 'legacy', 0.1), review('b', 'legacy', 0.2)],
      fresh: [fresh('n1', 'legacy')] });
    expect(items.map(item => item.id)).toEqual(['l', 'a', 'n1', 'b']);
  });
  it(`같은 출처 단위(과 · 자료 · 덱)의 새 표현끼리는 ${SOURCE_SPACING}장 이상 띄운다 — 다른 출처가 먼저 끼어든다`, () => {
    const items = orderReviewQueue({ reviews: [], fresh: [fresh('a1', 'legacy', 'chapter:u05'), fresh('a2', 'legacy', 'chapter:u05'), fresh('b1', 'fsrs', 'material:9'),
      fresh('c1', 'legacy', 'ref:중국어 · H3'), fresh('d1', 'legacy', null), fresh('e1', 'legacy', 'material:10')] });
    const ids = items.map(item => item.id);
    expect(ids).toEqual(['a1', 'b1', 'c1', 'd1', 'a2', 'e1']);
    expect(ids.indexOf('a2') - ids.indexOf('a1')).toBe(SOURCE_SPACING);
  });
  it('고르게 편 자리가 가까우면 복습을 한 장 더 내서 같은 출처 새 표현을 4장 띄운다 · 남은 것이 같은 출처뿐이면 순서대로 낸다', () => {
    const reviews = Array.from({ length: 6 }, (_, i) => review(`r${i}`, 'legacy', i / 10));
    const ids = orderReviewQueue({ reviews, fresh: [fresh('a1', 'legacy', 'm'), fresh('a2', 'legacy', 'm')] }).map(item => item.id);
    // 비율대로면 r0 r1 a1 r2 r3 a2 … — a2를 한 장 미뤄 4장 띄운다.
    expect(ids).toEqual(['r0', 'r1', 'a1', 'r2', 'r3', 'r4', 'a2', 'r5']);
    expect(ids.indexOf('a2') - ids.indexOf('a1')).toBeGreaterThanOrEqual(SOURCE_SPACING);
    expect(orderReviewQueue({ fresh: [fresh('a1', 'legacy', 'm'), fresh('a2', 'legacy', 'm')] }).map(item => item.id)).toEqual(['a1', 'a2']);
  });
  it('이미 시작한 새 표현(입장권 · 첫 질문)이 먼저, 그다음 담은 순서', () => {
    const items = orderReviewQueue({ fresh: [fresh('late', 'legacy', null, { createdAt: 2 }), fresh('early', 'legacy', null, { createdAt: 1 }), fresh('started', 'fsrs', null, { createdAt: 3, introduced: true })] });
    expect(items.map(item => item.id)).toEqual(['started', 'early', 'late']);
    expect(items[0].introduced).toBe(true);
  });
});

describe('세션 길이 = 서로 다른 카드 수', () => {
  it('칩은 20개보다 많을 때만 — 20 · 50(개수보다 작을 때) · 전부', () => {
    expect(sessionLengthOptions(20)).toEqual([]);
    expect(sessionLengthOptions(21)).toEqual([20, null]);
    expect(sessionLengthOptions(80)).toEqual([20, 50, null]);
  });
  it('줄 앞에서 자른다 — 시작하는 줄 길이 = 버튼 숫자', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}` }));
    expect(sliceSession(items, 20).map(item => item.id)).toEqual(items.slice(0, 20).map(item => item.id));
    expect(sliceSession(items, null)).toHaveLength(30);
  });
  it('학습 단계 · 재질문 · 「다시」 재노출은 진행 N에 세지 않는다', () => {
    let steps = initialSteps([{ id: 'n', engine: 'legacy', isNew: true }, { id: 'a', engine: 'fsrs', isNew: false }, { id: 'b', engine: 'legacy', isNew: false }]);
    steps = insertAfterIntro(steps, 0);
    steps = [...steps, { id: 'b', engine: 'legacy', phase: 'again' }];
    steps = insertLearningStep(steps, 1, 'a');
    expect(steps.length).toBeGreaterThan(3);
    expect(stepProgress(steps, 0, ['n', 'a', 'b'])).toMatchObject({ done: 0, total: 3 });
    expect(stepProgress(steps, steps.length, ['n', 'a', 'b'])).toMatchObject({ done: 3, total: 3 });
  });
});

describe('처음 보는 표현 → 3장 뒤 채점 · 학습 단계', () => {
  it('새 표현의 첫 등장은 채점 없는 카드(intro), 이미 시작한 새 표현 · 복습은 바로 채점', () => {
    const steps = initialSteps([{ id: 'n', engine: 'fsrs', isNew: true, introduced: false }, { id: 's', engine: 'legacy', isNew: true, introduced: true }, { id: 'r', engine: 'legacy', isNew: false }]);
    expect(steps.map(step => step.phase)).toEqual(['intro', 'question', 'question']);
  });
  it(`넘기면 ${REASK_AFTER}장 뒤에 채점 단계 — FSRS는 첫 질문(question), 예전 일정은 세션 내 재질문(reask)`, () => {
    const base = ['x1', 'x2', 'x3', 'x4'].map(id => ({ id, engine: 'legacy', phase: 'question' }));
    const fsrs = insertAfterIntro([{ id: 'n', engine: 'fsrs', phase: 'intro' }, ...base], 0);
    expect(fsrs.findIndex(step => step.id === 'n' && step.phase === 'question')).toBe(1 + REASK_AFTER);
    const legacy = insertAfterIntro([{ id: 'n', engine: 'legacy', phase: 'intro' }, ...base], 0);
    expect(legacy[1 + REASK_AFTER]).toEqual({ id: 'n', engine: 'legacy', phase: 'reask' });
    // 남은 줄이 짧으면 끝에
    expect(insertAfterIntro([{ id: 'n', engine: 'legacy', phase: 'intro' }], 0).at(-1)).toEqual({ id: 'n', engine: 'legacy', phase: 'reask' });
    // 처음 보는 표현이 아닌 단계는 그대로
    expect(insertAfterIntro(base, 0)).toBe(base);
  });
  it('FSRS 학습 단계 카드는 때가 되면 지금 카드 바로 뒤에 — 이미 남아 있거나 지금 카드면 끼우지 않는다', () => {
    const steps = [{ id: 'a', engine: 'fsrs', phase: 'question' }, { id: 'b', engine: 'legacy', phase: 'question' }];
    expect(insertLearningStep(steps, 1, 'a')).toEqual([...steps, { id: 'a', engine: 'fsrs', phase: 'learn' }]);
    expect(insertLearningStep(steps, 0, 'a')).toBe(steps);
    expect(insertLearningStep(steps, 0, 'b')).toBe(steps);
  });
  it('되돌린 단계 · 건너뛴 단계는 끝낸 것으로 세지 않는다 — 건너뛰기만 한 카드는 N에서 빠진다', () => {
    const steps = [{ id: 'a', engine: 'fsrs', phase: 'undone' }, { id: 'b', engine: 'legacy', phase: 'skipped' }, { id: 'c', engine: 'legacy', phase: 'question' }];
    expect(stepProgress(steps, 3, ['a', 'b', 'c'])).toEqual({ done: 1, total: 2, doneIds: ['c'], remainingIds: ['a'] });
  });
});

describe('이어 하기(세션 저장소 { scopeKey, cardIds, index, startedAt })', () => {
  const startedAt = '2026-10-13T00:00:00.000Z';
  const store = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; };
  it('쓰고 다시 읽는다 — 모양이 어긋나면 버린다', () => {
    const storage = store();
    const value = { scopeKey: '/vocab?lang=Chinese', cardIds: ['a', 'b', 'c'], index: 1, startedAt };
    writeResume(storage, 'actor', value);
    expect(readResume(storage, 'actor')).toEqual(value);
    storage.setItem('vocab_review_resume:actor', JSON.stringify({ ...value, index: 9 }));
    expect(readResume(storage, 'actor')).toBeNull();
    writeResume(storage, 'actor', null);
    expect(readResume(storage, 'actor')).toBeNull();
  });
  it('새로고침 뒤 「멈춘 복습 이어 하기 (n / N)」 — 같은 범위 · 24시간 안 · 다른 곳에서 채점된 카드는 건너뛴다', () => {
    const resume = { scopeKey: 'k', cardIds: ['a', 'b', 'c', 'd'], index: 1, startedAt };
    const now = Date.parse(startedAt) + 3600_000;
    expect(restoreResume(resume, { scopeKey: 'k', now })).toEqual({ remaining: ['b', 'c', 'd'], done: 1, total: 4 });
    const elsewhere = restoreResume(resume, { scopeKey: 'k', now, reviewedAt: id => (id === 'c' ? Date.parse(startedAt) + 60_000 : null) });
    expect(elsewhere).toEqual({ remaining: ['b', 'd'], done: 2, total: 4 });
    expect(restoreResume(resume, { scopeKey: 'other', now })).toBeNull();
    expect(restoreResume(resume, { scopeKey: 'k', now: Date.parse(startedAt) + DAY })).toBeNull();
    expect(restoreResume(resume, { scopeKey: 'k', now, available: id => id === 'b' })).toEqual({ remaining: ['b'], done: 3, total: 4 });
  });
});

describe('밀린 복습 규칙 — 기준 = 지난 14일 하루 평균(기록이 없으면 20 · 하한 10), 2배를 넘으면 새 표현 0', () => {
  const NOW = Date.parse('2026-10-13T00:00:00.000Z');
  const p = (created, lastReview) => ({ vocabulary: { created_at: new Date(created).toISOString() }, memory: { lastReview: lastReview == null ? null : new Date(lastReview).toISOString() } });
  it('기록이 14일에 못 미치거나 지난 14일 채점이 없으면 기본값 20', () => {
    expect(backlogBaseline([p(NOW - 5 * DAY, NOW - DAY)], { now: NOW })).toBe(BACKLOG_DEFAULT_BASELINE);
    expect(backlogBaseline([p(NOW - 90 * DAY, NOW - 30 * DAY)], { now: NOW })).toBe(BACKLOG_DEFAULT_BASELINE);
  });
  it('14일 안에 마지막 채점이 있는 카드 수 ÷ 14', () => {
    const rows = Array.from({ length: 28 }, (_, i) => p(NOW - 90 * DAY, NOW - (i % 14) * DAY));
    expect(backlogBaseline(rows, { now: NOW })).toBe(2);
  });
  it('판정 기준은 하루 10장 아래로 내려가지 않는다 — 평균 2인 가벼운 사용자도 밀린 복습 20장까지는 새 표현을 이어 간다', () => {
    expect(BACKLOG_MIN_BASELINE).toBe(10);
    expect(isBacklogged(5, 2)).toBe(false);
    expect(isBacklogged(20, 2)).toBe(false);
    expect(isBacklogged(21, 2)).toBe(true);
    // 평균이 하한보다 크면 평균 × 2 그대로
    expect(isBacklogged(30, 15)).toBe(false);
    expect(isBacklogged(31, 15)).toBe(true);
  });
});
