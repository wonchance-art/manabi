import { afterEach, describe, expect, it, vi } from 'vitest';
import { canAutoStartFsrsReview, createFsrsReviewController, fsrsIntervalLabel, isNewFsrsManualInsert } from '../useFsrsReview';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler';
import { beginFsrsAttempt, revealFsrsAttempt } from '../fsrsReviewSession';

const ACTOR = '10000000-0000-0000-0000-000000000001';
const START = Date.parse('2026-10-03T00:00:00Z');
const disposers = [];
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); });

function setup({ enabled = true, dueIn = 0, registryAvailable = true, firstQuestionsToday = 0, dailyNewLimit = 15, learnAheadSeconds, card: given } = {}) {
  let clock = START + 30000, number = 0, listener;
  const card = given || introduceFsrsCard(START + dueIn);
  const rows = [{ cardId: 'one', card, attempt: null, eligible: true }];
  const admission = () => {
    const used = firstQuestionsToday + rows.filter(row => row.firstQuestionAt).length;
    return { version: 1, actorId: ACTOR, installed: true, enabled, active: enabled, fsrsEnabled: enabled,
      startsAt: enabled ? '2026-10-02T19:00:00.000Z' : null, now: new Date(clock).toISOString(), learningDay: '2026-10-03',
      timeZone: 'Asia/Seoul', rolloverHour: 4, limit: dailyNewLimit, policyRevision: 1,
      used, remaining: Math.max(0, dailyNewLimit - used), fsrsUsed: used, legacyUsed: 0, admittedLegacyCardIds: [] };
  };
  const pending = [];
  const timers = [], events = new EventTarget();
  const client = {
    start: vi.fn(), dispose: vi.fn(),
    subscribe: vi.fn(fn => { listener = fn; return () => { listener = null; }; }),
    load: vi.fn(async () => ({ version: 1, enabled, registryAvailable, cards: structuredClone(rows), learnAheadSeconds,
      now: new Date(clock).toISOString(), firstQuestionsToday, admission: admission() })),
    pending: vi.fn(async () => structuredClone(pending)),
    question: vi.fn(async payload => {
      const row = rows.find(entry => entry.cardId === payload.cardId);
      row.attempt = beginFsrsAttempt(row.card, { id: payload.attemptId, userId: ACTOR, cardId: row.cardId, at: clock });
      row.firstQuestionAt ||= row.attempt.questionAt;
      return { ...structuredClone(row), now: new Date(clock).toISOString(), admission: admission() };
    }),
    reveal: vi.fn(async payload => {
      const row = rows.find(entry => entry.cardId === payload.cardId);
      row.attempt = revealFsrsAttempt(row.attempt, clock);
      return { ...structuredClone(row), now: new Date(clock).toISOString() };
    }),
    submit: vi.fn(async payload => {
      pending.push({ operationId: payload.operationId, cardId: payload.cardId, payload, status: 'pending' });
      return { queued: true, operationId: payload.operationId, status: 'pending' };
    }),
    enroll: vi.fn(async payload => {
      const row = { cardId: payload.cardId, card: introduceFsrsCard(clock), attempt: null, eligible: true };
      rows.push(row);
      return { ok: true, ...structuredClone(row), now: new Date(clock).toISOString() };
    }),
  };
  const controller = createFsrsReviewController({ accountId: ACTOR, client,
    now: () => clock, makeId: () => `operation-${++number}`, eventTarget: events,
    visibilityTarget: null, setTimer: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimer: vi.fn() });
  controller.start();
  controller.setWords([{ id: 'one', word_text: '你好', meaning: '안녕하세요' }]);
  disposers.push(() => controller.dispose());
  return { controller, client, rows, pending, timers, events,
    tick(ms) { clock += ms; }, emit(event) { listener?.(event); } };
}

describe('FSRS personal review lifecycle', () => {
  it('does not republish unchanged loading arrays, but keeps scope and authoritative changes live', async () => {
    const { controller, rows } = setup();
    controller.setWords([], []);
    const changed = vi.fn();
    controller.subscribe(changed);
    for (let i = 0; i < 100; i++) controller.setWords([], []);
    expect(changed).not.toHaveBeenCalled();
    await controller.refresh();
    changed.mockClear();
    for (let i = 0; i < 100; i++) controller.setWords([{ id: 'one', meaning: `updated-${i}` }], ['one']);
    expect(changed).toHaveBeenCalledTimes(1);
    controller.setWords([{ id: 'one' }], []);
    expect(controller.getSnapshot().ready).toEqual([]);
    controller.setWords([{ id: 'one', meaning: 'latest' }], ['one']);
    await controller.question();
    expect(controller.getSnapshot().current.word.meaning).toBe('latest');
    rows[0].excluded = true;
    await controller.refresh();
    expect(controller.getSnapshot().current).toBeNull();
    expect(controller.getSnapshot().ready).toEqual([]);
  });

  it('inactive empty registry keeps legacy available; known enrollment never falls back', async () => {
    const { controller, rows } = setup({ enabled: false });
    await controller.refresh();
    expect(controller.canLegacy('legacy')).toBe(true);
    expect(controller.canLegacy('one')).toBe(false);
    rows.length = 0;
    await controller.refresh();
    expect(controller.canLegacy('one')).toBe(false);
    expect(controller.getSnapshot().ready).toEqual([]);
  });

  it('unreadable registry fails closed without losing enrolled IDs', async () => {
    const { controller, client } = setup();
    await controller.refresh();
    client.load.mockRejectedValueOnce(new Error('offline'));
    await controller.refresh();
    expect(controller.getSnapshot().enrolledIds).toContain('one');
    expect(controller.canLegacy('legacy')).toBe(false);
    expect(await controller.question()).toBe(true);
    expect(controller.canLegacy('one')).toBe(false);
  });

  it('does not grade before question/reveal and previews one stable authoritative card', async () => {
    const { controller, client, tick } = setup();
    await controller.refresh();
    expect(await controller.grade(3)).toBe(false);
    await controller.question();
    expect(await controller.grade(3)).toBe(false);
    expect(client.submit).not.toHaveBeenCalled();
    await controller.reveal();
    const answer = controller.getSnapshot().current;
    expect(fsrsIntervalLabel(answer.previews[1].due, answer.previewAt)).toBe('30s');
    expect(fsrsIntervalLabel(answer.previews[2].due, answer.previewAt)).toBe('5m15s');
    expect(fsrsIntervalLabel(answer.previews[3].due, answer.previewAt)).toBe('10m');
    tick(180000);
    expect(controller.getSnapshot().current.previews).toEqual(answer.previews);
    expect(client.question.mock.calls[0][0]).toMatchObject({ answerVisible: false, dailyNewLimit: 15 });
  });

  it('keeps answer and queue on durable storage failure, only then advances on commit', async () => {
    const { controller, client } = setup();
    await controller.question(); await controller.reveal();
    client.submit.mockRejectedValueOnce(new Error('quota exceeded'));
    expect(await controller.grade(1)).toBe(false);
    expect(controller.getSnapshot().current.phase).toBe('revealed');
    expect(controller.getSnapshot().completed).toBe(0);
    expect(await controller.grade(1)).toBe(true);
    expect(controller.getSnapshot().current).toBeNull();
    expect(controller.getSnapshot().ready).toEqual([]);
    expect(controller.getSnapshot().pending).toHaveLength(1);
    expect(controller.canLegacy('one')).toBe(false);
  });

  it('compensates pending grade with the next revision and retains original grade', async () => {
    const { controller, client, pending } = setup();
    await controller.question(); await controller.reveal(); await controller.grade(1);
    const grade = client.submit.mock.calls[0][0];
    await controller.undo();
    expect(client.submit.mock.calls[1][0]).toMatchObject({ action: 'undo', cardId: 'one',
      expectedRevision: grade.expectedRevision + 1, targetOperationId: grade.operationId });
    expect(pending.map(row => row.payload.action)).toEqual(['grade', 'undo']);
    expect(controller.getSnapshot().ready).toEqual([]);
  });

  it('never counts a durably retained blocked grade as accepted recall', async () => {
    const { controller, client } = setup();
    await controller.question(); await controller.reveal();
    client.submit.mockResolvedValueOnce({ queued: true, status: 'blocked' });
    expect(await controller.grade(3)).toBe(false);
    expect(controller.getSnapshot().current.phase).toBe('revealed');
    expect(controller.getSnapshot().completed).toBe(0);
    const original = client.submit.mock.calls[0][0];
    await controller.grade(3);
    expect(client.submit.mock.calls[1][0].operationId).toBe(original.operationId);
  });

  it('does not count blocked compensation as undo', async () => {
    const { controller, client } = setup();
    await controller.question(); await controller.reveal(); await controller.grade(3);
    client.submit.mockResolvedValueOnce({ queued: true, status: 'conflict' });
    expect(await controller.undo()).toBe(false);
    expect(controller.getSnapshot().completed).toBe(1);
    expect(controller.getSnapshot().lastGrade).not.toBeNull();
  });

  it('leaves a conflicted card quarantined while opening a different due card', async () => {
    const { controller, rows, pending } = setup();
    rows.push({ ...structuredClone(rows[0]), cardId: 'two' });
    controller.setWords([{ id: 'one' }, { id: 'two' }]);
    pending.push({ operationId: 'held', cardId: 'one', status: 'conflict' });
    await controller.refresh();
    expect(controller.getSnapshot().ready.map(row => row.cardId)).toEqual(['two']);
    expect(canAutoStartFsrsReview(controller.getSnapshot())).toBe(true);
    await controller.question();
    expect(controller.getSnapshot().current.cardId).toBe('two');
    controller.leave();
    expect(controller.getSnapshot().current).toBeNull();
    expect(controller.getSnapshot().pending).toHaveLength(1);
  });

  it('enrolls only a confirmed new owned row and leaves it hidden for the first30seconds', async () => {
    const { controller, client, tick } = setup();
    const row = { id: 'new', user_id: ACTOR, interval: 0, repetitions: 0, last_reviewed_at: null };
    controller.setWords([{ id: 'new', word_text: '你好' }]);
    await controller.refresh();
    expect(await controller.enrollInserted(row)).toEqual({ enrolled: true });
    expect(client.enroll.mock.calls[0][0]).toMatchObject({ action: 'enroll', expectedRevision: 0,
      operationId: `fsrs-enroll:${ACTOR}:new`, cardId: 'new' });
    expect(controller.canLegacy('new')).toBe(false);
    expect(controller.getSnapshot().ready).toEqual([]);
    tick(29999); await controller.refresh();
    expect(controller.getSnapshot().ready).toEqual([]);
    tick(1); await controller.refresh();
    expect(controller.getSnapshot().ready.map(entry => entry.cardId)).toEqual(['new']);
  });

  it('keeps saved-but-unregistered row quarantined and retries the same enrollment ID', async () => {
    const { controller, client } = setup();
    const row = { id: 'new', user_id: ACTOR, interval: 0, repetitions: 0, last_reviewed_at: null };
    await controller.refresh();
    client.enroll.mockResolvedValueOnce({ queued: true, status: 'pending' });
    expect((await controller.enrollInserted(row)).enrolled).toBe(false);
    expect(controller.canLegacy('new')).toBe(false);
    expect(controller.getSnapshot().enrollmentFailures.map(entry => entry.id)).toEqual(['new']);
    await controller.enrollInserted(row);
    expect(client.enroll.mock.calls[1][0].operationId).toBe(client.enroll.mock.calls[0][0].operationId);
    expect(controller.getSnapshot().enrollmentFailures).toEqual([]);
  });

  it('does not enroll duplicate/no inserted row, old memory, another owner or inactive storage', async () => {
    const { controller, client } = setup({ enabled: false });
    await controller.refresh();
    const row = { id: 'new', user_id: ACTOR, interval: 0, repetitions: 0, last_reviewed_at: null };
    expect(isNewFsrsManualInsert(undefined, ACTOR)).toBe(false);
    expect(isNewFsrsManualInsert({ ...row, interval: 1 }, ACTOR)).toBe(false);
    expect(isNewFsrsManualInsert({ ...row, user_id: 'other' }, ACTOR)).toBe(false);
    expect((await controller.enrollInserted(row)).skipped).toBe(true);
    expect(client.enroll).not.toHaveBeenCalled();
    expect(controller.canLegacy('new')).toBe(true);
  });

  it('reconciles a settlement racing durable acceptance without leaving a phantom pending card', async () => {
    const env = setup();
    const { controller, client, rows } = env;
    await controller.question(); await controller.reveal();
    client.submit.mockImplementationOnce(async payload => {
      rows[0].card = scheduleFsrsReview(rows[0].card, payload.rating, rows[0].attempt.revealedAt).card;
      rows[0].attempt = null;
      env.emit({ type: 'change', status: 'applied', response: structuredClone(rows[0]) });
      return { queued: true, operationId: payload.operationId, status: 'pending' };
    });
    await controller.grade(1);
    expect(controller.getSnapshot().pending).toEqual([]);
    expect(controller.getSnapshot().ready).toEqual([]);
    expect(controller.getSnapshot().nextWakeAt).toBe(rows[0].card.due);
  });

  it('rechecks eligibility at seconds due and when returning to the window', async () => {
    const { controller, client, timers, tick, rows, events } = setup({ dueIn: 30000 });
    await controller.refresh();
    expect(controller.getSnapshot().ready).toEqual([]);
    expect(timers.at(-1).delay).toBe(30000);
    tick(30000); timers.at(-1).fn(); await controller.refresh();
    expect(controller.getSnapshot().ready).toHaveLength(1);
    rows[0].excluded = true;
    events.dispatchEvent(new Event('focus')); await controller.refresh();
    expect(client.load).toHaveBeenCalledTimes(3);
    expect(controller.getSnapshot().ready).toEqual([]);
    expect(controller.canLegacy('one')).toBe(false);
  });

  it('rechecks local exclusions before grading and never changes their schedule', async () => {
    const { controller, client } = setup();
    await controller.question(); await controller.reveal();
    controller.setWords([{ id: 'one', is_excluded: true }]);
    expect(await controller.grade(3)).toBe(false);
    expect(client.submit).not.toHaveBeenCalled();
    expect(controller.getSnapshot().current).toBeNull();
  });

  it('waits after undo exposure without rescheduling the preserved card due', async () => {
    const { controller, rows, timers, tick } = setup();
    const originalDue = rows[0].card.due;
    rows[0].nextQuestionAt = new Date(START + 60000).toISOString();
    await controller.refresh();
    expect(controller.getSnapshot().ready).toEqual([]);
    expect(controller.getSnapshot().cards[0].card.due).toBe(originalDue);
    expect(timers.at(-1).delay).toBe(30000);
    tick(30000); await controller.refresh();
    expect(controller.getSnapshot().ready).toHaveLength(1);
  });

  it('restores a revealed persisted attempt after reload without claiming a new recall', async () => {
    const { controller, client, rows } = setup();
    rows[0].attempt = revealFsrsAttempt(beginFsrsAttempt(rows[0].card,
      { id: 'persisted', userId: ACTOR, cardId: 'one', at: START + 30000 }), START + 30000);
    await controller.question();
    expect(client.question).not.toHaveBeenCalled();
    expect(controller.getSnapshot().current.phase).toBe('revealed');
    expect(controller.getSnapshot().current.attempt.id).toBe('persisted');
  });

  it('recovers a lost reveal response from persisted phase instead of restarting question', async () => {
    const { controller, client, rows } = setup();
    await controller.question();
    rows[0].attempt = revealFsrsAttempt(rows[0].attempt, START + 30000);
    await controller.reveal();
    expect(client.reveal).not.toHaveBeenCalled();
    expect(controller.getSnapshot().current.phase).toBe('revealed');
  });

  it('charges new budget at first question and never refunds it on undo', async () => {
    const { controller, client } = setup({ firstQuestionsToday: 5, dailyNewLimit: 5 });
    controller.setDailyNewLimit(5);
    await controller.refresh();
    expect(await controller.question()).toBe(false);
    expect(client.question).not.toHaveBeenCalled();
  });

  it('ignores a late previous-account answer and supports effect setup-cleanup-setup', async () => {
    const { controller, client } = setup();
    let resolve;
    client.load.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const old = controller.refresh();
    controller.dispose(); controller.start();
    resolve({ version: 1, registryAvailable: true, enabled: true, cards: [], now: new Date(START).toISOString() });
    await old;
    expect(controller.getSnapshot().enabled).toBe(false);
    await controller.refresh();
    expect(controller.getSnapshot().enrolledIds).toEqual(['one']);
  });
});

// Anki learn-ahead(FSRS-ANKI-R2): 서버가 허용 폭(1200초)을 알릴 때만, 기한 전 20분 안의 학습 · 재학습 카드를 ahead로 낸다.
describe('FSRS learn-ahead', () => {
  // 처음 「알맞음」 → 학습 2단계(10분 뒤). 시계는 그 채점 1분 뒤 — 기한까지 9분 남음.
  const learning = () => scheduleFsrsReview(introduceFsrsCard(START - 60000, { policyVersion: 'anki-v2' }), 3, START, { policyVersion: 'anki-v2' }).card;

  it('허용 폭이 없으면 기한 전 학습 카드를 묻지 않는다', async () => {
    const { controller, client } = setup({ card: learning() });
    await controller.refresh();
    expect(controller.getSnapshot().ready).toEqual([]);
    expect(controller.getSnapshot().ahead).toEqual([]);
    expect(await controller.question()).toBe(false);
    expect(client.question).not.toHaveBeenCalled();
  });

  it('허용 폭 안이면 ahead로 내고 question으로 연다 · 화면 대기 시각(nextWakeAt)은 기한 그대로', async () => {
    const card = learning();
    expect(card.state).toBe('Learning');
    const { controller, client } = setup({ card, learnAheadSeconds: 1200 });
    await controller.refresh();
    const snapshot = controller.getSnapshot();
    expect(snapshot.ready).toEqual([]);
    expect(snapshot.ahead.map(entry => entry.cardId)).toEqual(['one']);
    expect(snapshot.nextWakeAt).toBe(card.due);
    expect(canAutoStartFsrsReview(snapshot)).toBe(true);
    expect(await controller.question('one')).toBe(true);
    expect(client.question).toHaveBeenCalledTimes(1);
  });

  it('모르는 허용 폭 값은 0으로 본다 · 복습(Review) 카드는 앞당기지 않는다', async () => {
    const odd = setup({ card: learning(), learnAheadSeconds: 99999 });
    await odd.controller.refresh();
    expect(odd.controller.getSnapshot().ahead).toEqual([]);
    const review = scheduleFsrsReview(learning(), 4, START, { policyVersion: 'anki-v2' }).card;
    expect(review.state).toBe('Review');
    const later = setup({ card: review, learnAheadSeconds: 1200 });
    await later.controller.refresh();
    expect(later.controller.getSnapshot().ahead).toEqual([]);
  });

  it('중단 뒤 30초 재질문 대기 안에서는 앞당기지 않고 그 뒤에 깨어난다', async () => {
    const card = learning();
    const { controller, rows, timers } = setup({ card, learnAheadSeconds: 1200 });
    const exposed = beginFsrsAttempt(card, { id: 'gone', userId: ACTOR, cardId: 'one', at: START + 20000 });
    rows[0].attempt = { ...exposed, phase: 'abandoned', abandonedAt: exposed.questionAt };
    await controller.refresh();
    expect(controller.getSnapshot().ahead).toEqual([]);
    expect(timers.at(-1).delay).toBe(20000);
  });

  it('폭 밖이면 폭에 드는 시각에 깨어난다', async () => {
    const card = learning();
    const { controller, timers, tick } = setup({ card, learnAheadSeconds: 1200 });
    tick(-20 * 60000);
    await controller.refresh();
    expect(controller.getSnapshot().ahead).toEqual([]);
    const wake = timers.at(-1).delay;
    expect(wake).toBe(Date.parse(card.due) - 1200000 - (START + 30000 - 20 * 60000));
  });
});
