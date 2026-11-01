// LEARN-AHEAD-001 — 미리 학습(Anki 「learn ahead limit」 기본 20분 · 오너 승인 2026-11-01 KST · 시안 ② 보드 2 · ③ 보드 1).
// 오늘 줄에 채점할 카드가 남지 않았을 때, 다음 질문 시각이 20분 안인 학습 · 재학습 단계(분 단위) 카드는 기다리지 않고 바로 묻고 채점한다.
// 날 단위 복습 카드 · New 카드는 차례 전에 묻지 않는다. 채점할 카드가 남아 있는 동안은 지금 그대로(60초 창). 간격은 실제 답한 시각부터 잰다.
// 서버(src/lib/server/fsrsLearning.js 전이 · SQL fsrs_apply_operation 20261101060000)가 20분 · 단계 조건을 지키고, 화면은 「언제」(줄이 빈 뒤)만 정한다.
// DB 동작은 supabase/tests/fsrs-learn-ahead.mjs(PGlite — 실제 SQL 함수)가 따로 본다.
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { FSRS_LEARN_AHEAD_SECONDS, fsrsAskableAt, introduceFsrsCard, previewFsrsRatings, scheduleFsrsReview } from '../fsrsScheduler';
import { beginFsrsAttempt, fsrsQuestionBound, revealFsrsAttempt } from '../fsrsReviewSession';
import { LEARN_AHEAD_MS, fsrsGradeWait, gradeEngine, gradePreviews, learnAheadable, legacyGradeWait } from '../levelWordStatus';
import { gradeLevelSession, sessionAhead, sessionOrder, startLevelSession } from '../levelWordSession';
import { applyFsrsAnswer, applyFsrsRequest, fsrsError, resetFsrsCapabilityCache } from '../server/fsrsLearning.js';
import { createFsrsReviewController } from '../useFsrsReview';
import { cardIds, fsrsMemoryDb, owner } from './helpers/fsrsMemoryDb.js';
import { WordCard } from '@/components/levels/word/WordCard';
import { OneWordCard } from '@/components/levels/word/OneWord';
import { WordLangContext } from '@/components/levels/word/wordLang';

const MIN = 60_000;
const iso = (ms) => new Date(ms).toISOString();
const T = Date.parse('2026-11-01T03:00:00Z'); // 12:00 KST — 학습일 경계(04시)와 멀다
// anki-v2 학습 카드: 소개 → 첫 문제 「알맞음」 → 학습 2단계(10분). due = T + after.
function learningCard(after) {
  const intro = introduceFsrsCard(iso(T + after - 11 * MIN), { policyVersion: 'anki-v2' });
  const card = scheduleFsrsReview(intro, 3, intro.due, { policyVersion: 'anki-v2' }).card;
  expect(card).toMatchObject({ state: 'Learning', step: 1 });
  expect(Date.parse(card.due)).toBe(T + after);
  // 마지막 채점은 늘 지금(T) 이전이다 — 단계보다 먼 기한(21분)도 같은 모양으로 쓰려고 그 시각만 T 앞으로 둔다.
  const last = Math.min(Date.parse(card.lastReview), T - 30_000);
  return { ...card, lastReview: iso(last), introducedAt: iso(Math.min(Date.parse(card.introducedAt), last - MIN)) };
}
const reviewCard = (after) => ({ ...learningCard(after), state: 'Review', step: 0, scheduledDays: 2 });
const fsrsProjection = (card, nextQuestionAt = card.due) => ({ source: 'fsrs-v1', memory: card,
  review: { available: true, known: false, excluded: false, eligible: true, nextQuestionAt } });

describe('한도 — 학습 · 재학습 카드만 기한 20분 전부터(JS 정본 · SQL과 같은 값)', () => {
  it('fsrsAskableAt — 학습 · 재학습 = 기한 − 20분, 복습 · New = 기한 그대로', () => {
    expect(FSRS_LEARN_AHEAD_SECONDS).toBe(1200);
    const learning = learningCard(5 * MIN);
    expect(fsrsAskableAt(learning)).toBe(T + 5 * MIN - 20 * MIN);
    expect(fsrsAskableAt({ ...learning, state: 'Relearning', step: 0 })).toBe(T + 5 * MIN - 20 * MIN);
    expect(fsrsAskableAt(reviewCard(5 * MIN))).toBe(T + 5 * MIN);
    const fresh = introduceFsrsCard(iso(T), { policyVersion: 'anki-v2' });
    expect(fsrsAskableAt(fresh)).toBe(T + MIN);
  });
  it('미리보기 · 채점 계산 — 20분 안은 받고(간격은 답한 시각부터), 21분 전 · 복습 카드 차례 전은 거절', () => {
    const card = learningCard(20 * MIN);
    const previews = previewFsrsRatings(card, iso(T));
    expect(Date.parse(previews[1].card.due)).toBe(T + MIN); // 다시 = 지금부터 1분(옛 기한부터가 아니다)
    expect(Date.parse(previews[2].card.due)).toBe(T + 10 * MIN); // 어려움 = 지금부터 10분
    expect(previews[1].card.lastReview).toBe(iso(T));
    expect(() => previewFsrsRatings(learningCard(21 * MIN), iso(T))).toThrow('fsrs_card_not_due');
    expect(() => previewFsrsRatings(reviewCard(MIN), iso(T))).toThrow('fsrs_card_not_due');
    // 시도(묻기 · 보이기)도 같은 경계
    expect(beginFsrsAttempt(card, { id: 'q', userId: owner, cardId: cardIds[0], at: iso(T) }).questionAt).toBe(iso(T));
    expect(() => beginFsrsAttempt(learningCard(21 * MIN), { id: 'q', userId: owner, cardId: cardIds[0], at: iso(T) })).toThrow('fsrs_card_not_due');
  });
  it('묻기 경계(fsrsQuestionBound) — 되돌린 뒤 30초 · 중단 뒤 30초는 그대로 엄격하다(기한만 당긴다)', () => {
    const card = learningCard(10 * MIN);
    expect(fsrsQuestionBound({ card, nextQuestionAt: card.due })).toBe(T - 10 * MIN);
    // 다음 질문 시각이 기한보다 늦으면 대기가 정한 시각
    expect(fsrsQuestionBound({ card, nextQuestionAt: iso(T + 11 * MIN) })).toBe(T + 11 * MIN);
    // 대기가 기한보다 일찍 끝나 다음 질문 시각에 가려져도 미리 물을 때는 드러난다
    expect(fsrsQuestionBound({ card, nextQuestionAt: card.due, operations: [{ kind: 'grade', log: { reviewedAt: iso(T) } }, { kind: 'undo', log: { reviewedAt: iso(T) } }] }))
      .toBe(T + 30_000);
    expect(fsrsQuestionBound({ card, nextQuestionAt: card.due, attempt: { phase: 'abandoned', questionAt: iso(T - 5000), revealedAt: iso(T) } })).toBe(T + 30_000);
    expect(fsrsQuestionBound({ card: reviewCard(10 * MIN), nextQuestionAt: iso(T + 10 * MIN) })).toBe(T + 10 * MIN);
  });
});

describe('서버 전이 — 한 번 채점(answer) · 단건 연산이 20분 · 단계 조건을 지킨다', () => {
  const setup = () => { resetFsrsCapabilityCache(); return fsrsMemoryDb(); };
  const answer = (db, extra = {}, cardId = cardIds[0]) => applyFsrsAnswer({ authClient: db.authClient, serviceClient: db.serviceClient, userId: owner, now: db.tick,
    body: { action: 'answer', accountId: owner, cardId, operationId: 'tap-1', rating: 3, ...extra } });
  it('학습 단계(10분 뒤) 카드는 바로 다시 채점된다 — 간격은 두 번째 답한 시각부터', async () => {
    const db = setup();
    const first = await answer(db);
    expect(first.card).toMatchObject({ state: 'Learning', step: 1 });
    expect(Date.parse(first.card.due) - db.now).toBeGreaterThan(9 * MIN);
    const second = await answer(db, { operationId: 'tap-2', rating: 1 });
    expect(second).toMatchObject({ ok: true, card: { revision: 2, state: 'Learning', step: 0 } });
    expect(Date.parse(second.card.lastReview)).toBeGreaterThan(Date.parse(first.card.lastReview));
    expect(Date.parse(second.card.due) - Date.parse(second.card.lastReview)).toBe(30_000); // anki-seconds-v1 다시 = 답한 시각 + 30초
  });
  it('20분 넘게 남은 학습 카드 · 차례 전 복습 카드는 거절 — 물을 수 있는 가장 이른 시각을 함께', async () => {
    const db = setup();
    const at = db.now;
    const far = { ...learningCard(0), policyVersion: 'anki-seconds-v1', lastReview: iso(at - MIN), introducedAt: iso(at - 2 * MIN), due: iso(at + 21 * MIN) };
    db.cards.get(cardIds[0]).card = far;
    const error = await answer(db).catch((e) => e);
    expect(error).toMatchObject({ code: 'fsrs_card_not_due', status: 409 });
    expect(fsrsError(error).body).toEqual({ ok: false, code: 'fsrs_card_not_due', nextQuestionAt: iso(at + MIN) }); // 기한 − 20분
    db.cards.get(cardIds[1]).card = { ...far, state: 'Review', step: 0, scheduledDays: 2, due: iso(at + 60 * MIN) };
    const review = await answer(db, { operationId: 'tap-r' }, cardIds[1]).catch((e) => e);
    expect(fsrsError(review).body).toEqual({ ok: false, code: 'fsrs_card_not_due', nextQuestionAt: iso(at + 60 * MIN) });
    expect(db.calls().fsrs_apply_learning_operation).toBeUndefined();
  });
  it('되돌린 학습 카드 — 기한 20분 창 안이어도 되돌린 뒤 30초는 기다린다(가려진 대기도 이력에서 찾는다)', async () => {
    const db = setup();
    await answer(db); // 학습 2단계(10분)
    const early = await answer(db, { operationId: 'tap-2', rating: 3 }); // 미리 학습 → 복습 단계로
    const undone = await applyFsrsRequest({ authClient: db.authClient, serviceClient: db.serviceClient, userId: owner, now: db.tick,
      body: { action: 'undo', accountId: owner, cardId: cardIds[0], operationId: 'undo-1', expectedRevision: early.grade.revision, targetOperationId: early.grade.operationId } });
    expect(undone.card).toMatchObject({ state: 'Learning', step: 1 }); // 10분 뒤 학습 카드로 — 기한이 되돌린 뒤 30초보다 늦다
    expect(Date.parse(undone.nextQuestionAt)).toBe(Date.parse(undone.card.due));
    await expect(answer(db, { operationId: 'tap-3' })).rejects.toMatchObject({ code: 'fsrs_card_not_due' });
    db.now += 30_000;
    expect(await answer(db, { operationId: 'tap-4', rating: 2 })).toMatchObject({ ok: true, card: { state: 'Learning' } });
  });
});

describe('단어 페이지 — 채점할 카드가 남지 않았을 때만(ahead) · 네 칸은 지금부터', () => {
  const row = { id: cardIds[0] };
  it('FSRS 학습 카드 4분 뒤 — 평소엔 못 하고(60초 창 밖), ahead면 지금(기다림 0) · 미리보기는 지금부터 1분 · 10분', () => {
    const p = fsrsProjection(learningCard(4 * MIN));
    expect(learnAheadable({ projection: p }, T)).toBe(true);
    expect(fsrsGradeWait(p, T)).toBeNull();
    expect(gradePreviews({ projection: p, row, at: T })).toBeNull();
    expect(gradeEngine({ projection: p, row, at: T })).toBeNull();
    expect(fsrsGradeWait(p, T, { ahead: true })).toBe(0);
    expect(gradeEngine({ projection: p, row, at: T, ahead: true })).toBe('fsrs');
    const previews = gradePreviews({ projection: p, row, at: T, ahead: true });
    expect(previews[1]).toMatchObject({ label: '1분', ms: MIN });
    expect(previews[2]).toMatchObject({ label: '10분', ms: 10 * MIN });
  });
  it('미리 올리지 않는 카드 — 21분 뒤 학습 카드 · 날 단위 복습 카드 · 대기(되돌린 뒤)가 정한 시각 · 지금 이미 차례', () => {
    expect(learnAheadable({ projection: fsrsProjection(learningCard(21 * MIN)) }, T)).toBe(false);
    expect(gradePreviews({ projection: fsrsProjection(learningCard(21 * MIN)), row, at: T, ahead: true })).toBeNull();
    expect(learnAheadable({ projection: fsrsProjection(reviewCard(5 * MIN)) }, T)).toBe(false);
    expect(gradeEngine({ projection: fsrsProjection(reviewCard(5 * MIN)), row, at: T, ahead: true })).toBeNull();
    const card = learningCard(-MIN);
    expect(learnAheadable({ projection: fsrsProjection(card, iso(T + 2 * MIN)) }, T)).toBe(false); // 되돌린 뒤 30초가 정한 다음 질문 시각
    expect(learnAheadable({ projection: fsrsProjection(card) }, T)).toBe(false); // 이미 차례 — 평소 길
    expect(LEARN_AHEAD_MS).toBe(20 * MIN);
  });
  it('옛 일정 카드도 같은 규칙 — 학습 단계 행은 ahead면 지금, 날 단위 복습 행은 차례 전 그대로 못 한다', () => {
    const learningRow = { id: 'L', interval: 2.3065, ease_factor: 2.118, repetitions: 0, last_reviewed_at: iso(T - 6 * MIN), next_review_at: iso(T + 4 * MIN), created_at: iso(T - 7 * MIN) };
    const legacy = (r) => ({ source: 'legacy', memory: { lastReview: r.last_reviewed_at, stability: r.interval }, review: { available: true, eligible: true, known: false, excluded: false, nextQuestionAt: r.next_review_at } });
    expect(legacyGradeWait(legacy(learningRow), T)).toBeNull();
    expect(legacyGradeWait(legacy(learningRow), T, { ahead: true, row: learningRow })).toBe(0);
    expect(gradeEngine({ projection: legacy(learningRow), row: learningRow, at: T, ahead: true })).toBe('legacy');
    expect(gradePreviews({ projection: legacy(learningRow), row: learningRow, at: T, ahead: true })[1].ms).toBe(MIN); // 지금부터 1분
    const reviewRow = { ...learningRow, id: 'R', interval: 5, last_reviewed_at: iso(T - 3 * 86400000), next_review_at: iso(T + 30 * MIN) };
    expect(gradeEngine({ projection: legacy(reviewRow), row: reviewRow, at: T, ahead: true })).toBeNull();
  });
  it('줄 — 채점할 카드(① + ②)가 남아 있으면 미리 올리지 않고, 비면 기다리는 카드 중 미리 물을 수 있는 것만(남은 시간 짧은 순)', () => {
    let s = startLevelSession(['a', 'b', 'c', 'd'].map((key) => ({ key })), () => 'today', () => 0, T);
    s = gradeLevelSession(s, 'a', 1, T + 4 * MIN);
    s = gradeLevelSession(s, 'b', 1, T + 2 * MIN);
    const can = (k) => k !== 'c';
    expect(sessionAhead(s, T, () => true)).toEqual([]); // c · d가 남았다
    s = gradeLevelSession(s, 'c', 3, T + 35 * MIN);
    s = gradeLevelSession(s, 'd', 3, null);
    expect(sessionOrder(s, T)).toEqual([]);
    expect(sessionAhead(s, T, can)).toEqual(['b', 'a']); // c(35분 · 화면이 거른다)는 「오늘 할 카드 끝」 쪽
  });
  it('방금 채점한 카드는 다른 미리 학습 카드가 있으면 한 칸 뒤로 — 하나뿐이면 그대로', () => {
    let s = startLevelSession(['a', 'b'].map((key) => ({ key })), () => 'today', () => 0, T);
    s = gradeLevelSession(s, 'a', 3, T + 8 * MIN);
    s = gradeLevelSession(s, 'b', 1, T + MIN); // 방금 「다시」 — 가장 이르다
    expect(sessionAhead(s, T, () => true)).toEqual(['a', 'b']);
    let one = startLevelSession([{ key: 'a' }], () => 'today', () => 0, T);
    one = gradeLevelSession(one, 'a', 1, T + MIN);
    expect(sessionAhead(one, T, () => true)).toEqual(['a']);
  });
});

describe('화면 — 미리 올린 카드 · 남은 시간 칩 「4분 후」 · 한 단어도 바로 이어서', () => {
  const read = (f) => fs.readFileSync(f, 'utf8');
  const screen = read('src/components/levels/word/LevelWordScreen.jsx');
  const L = { hw: 'ja', exReading: 'ja', head: (e) => ({ hw: e.word, sub: e.reading }), tag: (l) => `JLPT ${l}`, Reading: ({ text }) => <span>{text}</span> };
  const wrap = (node) => renderToStaticMarkup(<WordLangContext.Provider value={L}>{node}</WordLangContext.Provider>);
  const ENTRY = { key: '約束', word: '約束', reading: 'やくそく', meaning: '약속', ex: null };
  it('리스트 카드 — 「지금」이 아니라 남은 시간(WaitChip) · 한 단어 카드 — 앞면 오른쪽 위에 같은 칩', () => {
    const html = wrap(<WordCard entry={ENTRY} level="N5" view="word" info={{ status: 'today', previews: {} }} wait={Date.now() + 4 * MIN} />);
    expect(html).toMatch(/<span class="lw-time" role="timer" aria-label="4분 후 다시">4분 후<\/span>/);
    expect(html).not.toContain('>지금<');
    const one = wrap(<OneWordCard entry={ENTRY} view="word" info={{ status: 'today', previews: {} }} tiles={null} revealed={false} onReveal={() => {}} wait={Date.now() + 4 * MIN} />);
    expect(one).toMatch(/<span class="lw-one__wait"><span class="lw-time" role="timer" aria-label="4분 후 다시">4분 후<\/span><\/span>/);
    expect(wrap(<OneWordCard entry={ENTRY} view="word" info={{ status: 'today', previews: {} }} tiles={null} revealed={false} onReveal={() => {}} />)).not.toContain('lw-one__wait');
  });
  it('줄이 비었을 때만 ahead — 네 칸 미리보기 · 채점 요청이 같은 판정 · 위 목록 · 대기 화면', () => {
    expect(screen).toContain('const aheadMode = !!session && !sessionOrder(session, clock).length;');
    expect(screen).toContain('const aheadKeys = useMemo(() => (aheadMode ? sessionAhead(session, clock, canAhead) : []), [aheadMode, session, clock, canAhead]);');
    expect(screen).toContain('gradePreviews({ projection: base.projection, row: base.row, at: clock, ahead: aheadMode })');
    expect(screen).toContain('const res = info.variant ? await grader.gradeCard(info.variant, rating, { ahead: aheadMode }) : await grader.grade(entry, rating, { ahead: aheadMode });');
    expect(screen).toContain('const line = order.length ? order : aheadKeys;');
    expect(screen).toContain('listCard(e, { due: listed.due.has(e.key), wait: listed.ahead.get(e.key) ?? null })');
    // 「오늘 할 카드 끝」은 미리 올릴 카드가 없을 때(위 목록이 빔)만 — 미리 올린 카드는 대기 목록에서 뺀다.
    expect(screen).toContain('waiting: waiting.filter((w) => !ahead.has(w.key))');
    expect(screen).toContain('{!listed.active.length && listed.waiting.length > 0 && <div className="lw-capped" role="status">');
    // 한 단어 — 미리 올린 카드가 지금 카드(대기 화면 없이 바로) · 칩
    expect(screen).toContain(': aheadKeys[0] ?? sessionCurrent(session, clock);');
    expect(screen).toContain('wait={aheadKeys.includes(current.key) ? aheadAt(current.key) : null}');
    // 20분 창에 드는 시각에도 다시 그린다
    expect(screen).toContain('const comesAt = riseAt && (!nextAt || riseAt < nextAt) ? riseAt : nextAt;');
  });
});

describe('복습실 — 줄을 다 풀었을 때 20분 안의 학습 · 재학습 카드를 바로 잇는다', () => {
  const ACTOR = owner;
  function setup(rows) {
    let clock = T;
    const client = {
      start: vi.fn(), dispose: vi.fn(), subscribe: vi.fn(() => () => {}),
      load: vi.fn(async () => ({ version: 1, enabled: true, registryAvailable: true, cards: structuredClone(rows), now: iso(clock), firstQuestionsToday: 0,
        admission: { version: 1, actorId: ACTOR, installed: true, enabled: true, active: true, fsrsEnabled: true, startsAt: '2026-10-02T19:00:00.000Z', now: iso(clock),
          learningDay: '2026-11-01', timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 15, policyRevision: 1, used: 0, remaining: 15, fsrsUsed: 0, legacyUsed: 0, admittedLegacyCardIds: [] } })),
      pending: vi.fn(async () => []),
      question: vi.fn(async (payload) => {
        const row = rows.find((entry) => entry.cardId === payload.cardId);
        row.attempt = beginFsrsAttempt(row.card, { id: payload.attemptId, userId: ACTOR, cardId: row.cardId, at: clock });
        return { ...structuredClone(row), now: iso(clock), admission: (await client.load()).admission };
      }),
      reveal: vi.fn(async (payload) => {
        const row = rows.find((entry) => entry.cardId === payload.cardId);
        row.attempt = revealFsrsAttempt(row.attempt, clock);
        return { ...structuredClone(row), now: iso(clock) };
      }),
    };
    const timers = [];
    const controller = createFsrsReviewController({ accountId: ACTOR, client, now: () => clock, makeId: () => `op-${timers.length}-${Math.random()}`,
      eventTarget: null, visibilityTarget: null, setTimer: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimer: vi.fn() });
    controller.start();
    controller.setWords(rows.map((r) => ({ id: r.cardId, word_text: r.cardId, meaning: '뜻' })));
    return { controller, client, timers, tick: (ms) => { clock += ms; } };
  }
  const entry = (cardId, card) => ({ cardId, card, attempt: null, eligible: true, nextQuestionAt: card.due, firstQuestionAt: iso(T - 20 * MIN) });
  it('controller.ahead = 차례 전 학습 · 재학습 카드 중 지금 물을 수 있는 것(20분 안) · 복습 카드와 21분 뒤 카드는 없다 · 20분 창에 들 때 깨운다', async () => {
    const { controller, timers } = setup([entry('l4', learningCard(4 * MIN)), entry('l21', learningCard(21 * MIN)), entry('r5', reviewCard(5 * MIN))]);
    await controller.refresh();
    const state = controller.getSnapshot();
    expect(state.ready).toEqual([]);
    expect(state.ahead.map((e) => e.cardId)).toEqual(['l4']);
    expect(Date.parse(state.nextWakeAt)).toBe(T + MIN); // l21이 20분 창에 드는 시각(T + 21분 − 20분)
    expect(timers.at(-1).delay).toBe(MIN);
  });
  it('question(cardId)은 차례가 된 카드만 — 복습방이 미리 학습 단계로 끼운 것(ahead)만 차례 전 학습 카드를 연다 · 복습 카드는 그래도 못 연다', async () => {
    const { controller, client } = setup([entry('l4', learningCard(4 * MIN)), entry('r5', reviewCard(5 * MIN))]);
    expect(await controller.question('l4')).toBe(false);
    expect(client.question).not.toHaveBeenCalled();
    expect(await controller.question('r5', { ahead: true })).toBe(false);
    expect(await controller.question('l4', { ahead: true })).toBe(true);
    expect(client.question).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().current).toMatchObject({ cardId: 'l4', phase: 'question' });
    expect(await controller.reveal()).toBe(true);
    expect(controller.getSnapshot().current.previews[1].due).toBe(iso(T + MIN)); // 네 칸 = 지금부터
  });
  it('복습방 — 줄 끝(finishRun)에서 이 줄의 미리 물을 수 있는 카드를 끝 화면 없이 잇는다 · 줄의 FSRS 단계는 ahead를 넘긴다', () => {
    const page = fs.readFileSync('src/views/VocabPage.jsx', 'utf8');
    const session = fs.readFileSync('src/components/vocab/FsrsReviewSession.jsx', 'utf8');
    expect(page).toContain("return (fsrsReview.controller.getSnapshot().ahead || []).filter(entry => inRun.has(entry.cardId) && !failed.has(entry.cardId) && fsrsStepValid(entry.cardId))");
    expect(page).toContain(".map(entry => ({ id: entry.cardId, engine: 'fsrs', phase: 'learn', ahead: true }));");
    expect(page).toMatch(/const finishRun = \(queue = reviewQueueRef\.current\) => \{\n\s+const ahead = aheadSteps\(queue\);\n\s+if \(ahead\.length\) \{/);
    expect(page).toContain('ahead={!!currentStep.ahead}');
    expect(session).toContain('controller.question(cardId, ahead ? { ahead: true } : undefined)');
    // 끝 화면 「잠시 뒤 이어 하기」도 20분 안이면 켜진다
    expect(page).toContain('const readyIds = cards.filter(entry => isReady(entry.cardId) || isAhead(entry.cardId)).map(entry => entry.cardId);');
  });
});
