import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createLearningAdmissionClient, createLearningAdmissionController } from '../useLearningAdmission';
import { createFsrsLearningClient } from '../fsrsLearningClient';
import { createFsrsReviewController } from '../useFsrsReview';
import { introduceFsrsCard } from '../fsrsScheduler';
import { beginFsrsAttempt } from '../fsrsReviewSession';
import VocabReview from '../../views/VocabReview';

vi.mock('next/link', () => ({ default: ({ children, ...props }) => createElement('a', props, children) }));
const actor = '10000000-0000-0000-0000-000000000001';
const cardId = '20000000-0000-0000-0000-000000000001';
const now = '2026-10-04T00:00:30.000Z';
const status = (extra = {}) => ({ version: 1, actorId: actor, installed: true, enabled: true, active: true,
  fsrsEnabled: true, startsAt: '2026-10-03T19:00:00.000Z', now, learningDay: '2026-10-04', timeZone: 'Asia/Seoul', rolloverHour: 4,
  limit: 15, policyRevision: 1, used: 0, remaining: 15, fsrsUsed: 0, legacyUsed: 0, admittedLegacyCardIds: [], ...extra });
const receipt = (request, quota = status({ used: 1, remaining: 14, legacyUsed: 1, admittedLegacyCardIds: [cardId] })) => ({
  version: 1, actorId: actor, operationId: request.operationId, cardId: request.cardId, admitted: true,
  consumed: true, duplicate: false, admittedAt: now, firstQuestionAt: now, startsAt: quota.startsAt, learningDay: quota.learningDay, quota,
});
const response = (body, code = 200) => ({ ok: code < 400, status: code, json: async () => body });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function memoryStore() {
  const entries = [];
  return { entries,
    prepare: vi.fn(async request => {
      const row = entries.find(row => row.status === 'pending' && row.request.accountId === request.accountId && row.request.action === request.action && row.request.cardId === request.cardId);
      if (row) {
        if (request.action === 'configure' && row.request.dailyNewLimit !== request.dailyNewLimit) throw new Error('learning_admission_pending_configuration');
        return row.request;
      }
      entries.push({ request, status: 'pending' }); return request;
    }),
    settle: vi.fn(async (request, value) => { const row = entries.find(row => row.request.operationId === request.operationId); row.status = 'settled'; return value; }),
    reject: vi.fn(async request => { entries.find(row => row.request.operationId === request.operationId).status = 'blocked'; }),
    pending: vi.fn(async accountId => entries.filter(row => row.request.accountId === accountId && row.status === 'pending')),
  };
}
const disposers = [];
afterEach(() => disposers.splice(0).forEach(dispose => dispose()));
function controller(client, extra = {}) {
  const timers = [];
  const value = createLearningAdmissionController({ accountId: actor, client, eventTarget: null, visibilityTarget: null,
    setTimer: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimer: vi.fn(), ...extra });
  value.start(); disposers.push(() => value.dispose()); return { value, timers };
}

describe('authoritative admission before question exposure', () => {
  it('commits intent before POST and receipt before returning admission', async () => {
    const store = memoryStore(), prepared = deferred(), settled = deferred();
    store.prepare.mockImplementationOnce(async req => { await prepared.promise; return req; });
    store.settle.mockImplementationOnce(async (_, body) => { await settled.promise; return body; });
    const fetchImpl = vi.fn(async (_, init) => response(receipt(JSON.parse(init.body))));
    const client = createLearningAdmissionClient({ accountId: actor, store, fetchImpl, makeId: () => 'stable' });
    let finished = false;
    const pending = client.admit({ cardId, expectedPolicyRevision: 1 }).then(() => { finished = true; });
    await Promise.resolve(); expect(fetchImpl).not.toHaveBeenCalled();
    prepared.resolve(); await vi.waitFor(() => expect(store.settle).toHaveBeenCalled());
    expect(finished).toBe(false); settled.resolve(); await pending; expect(finished).toBe(true);
  });

  it('reload and lost reply replay the immutable ID, card and original CAS revision', async () => {
    const store = memoryStore(), payloads = [];
    const fetchImpl = vi.fn(async (_, init) => {
      const request = JSON.parse(init.body); payloads.push(request);
      if (payloads.length === 1) throw new Error('reply lost');
      return response({ ...receipt(request, status({ policyRevision: 2, limit: 0, used: 1, legacyUsed: 1, remaining: 0, admittedLegacyCardIds: [cardId] })), duplicate: true });
    });
    const make = id => createLearningAdmissionClient({ accountId: actor, store, fetchImpl, makeId: () => id });
    await expect(make('original').admit({ cardId, expectedPolicyRevision: 1 })).rejects.toThrow('reply lost');
    const accepted = await make('new-id-must-not-win').admit({ cardId, expectedPolicyRevision: 2 });
    expect(payloads[1]).toEqual(payloads[0]); expect(accepted.quota.limit).toBe(0);
  });

  it('prepare or receipt commit failure never becomes an accepted question', async () => {
    const store = memoryStore(), fetchImpl = vi.fn(async (_, init) => response(receipt(JSON.parse(init.body))));
    const client = createLearningAdmissionClient({ accountId: actor, store, fetchImpl, makeId: () => 'abort' });
    store.prepare.mockRejectedValueOnce(new Error('prepare abort'));
    await expect(client.admit({ cardId, expectedPolicyRevision: 1 })).rejects.toThrow('prepare abort');
    expect(fetchImpl).not.toHaveBeenCalled();
    store.settle.mockRejectedValueOnce(new Error('receipt abort'));
    await expect(client.admit({ cardId, expectedPolicyRevision: 1 })).rejects.toThrow('receipt abort');
    expect(store.entries[0].status).toBe('pending');
  });

  it('actor switch while POST is in flight cannot settle or expose the previous actor receipt', async () => {
    let current = actor;
    const store = memoryStore(), reply = deferred();
    const client = createLearningAdmissionClient({ accountId: actor, getAccountId: () => current, store,
      fetchImpl: async (_, init) => { await reply.promise; return response(receipt(JSON.parse(init.body))); }, makeId: () => 'actor-bound' });
    const pending = client.admit({ cardId, expectedPolicyRevision: 1 });
    await vi.waitFor(() => expect(store.prepare).toHaveBeenCalled()); current = cardId; reply.resolve();
    await expect(pending).rejects.toThrow('account_changed'); expect(store.settle).not.toHaveBeenCalled();
  });

  it('renders neither word nor meaning until the exact question key is acknowledged', async () => {
    const gate = deferred();
    const { value } = controller({ load: async () => status(), admit: async req => { await gate.promise; return receipt({ ...req, operationId: 'visible' }); } });
    const pending = value.question(cardId, 'session:0');
    await vi.waitFor(() => expect(value.getSnapshot().quota).not.toBeNull());
    expect(value.getSnapshot().current).toBeNull();
    const word = { id: cardId, word_text: '未承認の問題', meaning: '노출되면 안 되는 뜻' };
    const html = renderToStaticMarkup(createElement(VocabReview, { vocab: [word], reviewWords: [word], reviewIdx: 0,
      currentWord: undefined, admissionPending: true, reviewMode: 'flash', contextOptions: [] }));
    expect(html).toContain('복습 준비 중'); expect(html).not.toContain(word.word_text); expect(html).not.toContain(word.meaning);
    gate.resolve(); expect(await pending).toBe(true);
    expect(value.getSnapshot().current).toMatchObject({ accountId: actor, cardId, questionKey: 'session:0', compatibility: false });
    value.leave(); expect(value.getSnapshot().current).toBeNull(); expect(value.getSnapshot().quota.used).toBe(1);
  });

  it('unknown or failed quota is closed; only explicit pre-activation disabled status keeps legacy compatibility', async () => {
    const admit = vi.fn();
    const broken = controller({ load: async () => ({ enabled: false }), admit }).value;
    expect(await broken.question(cardId, 'missing')).toBe(false); expect(broken.getSnapshot().current).toBeNull();
    const disabled = status({ enabled: false, active: false, fsrsEnabled: false, startsAt: null });
    const legacy = controller({ load: async () => disabled, admit }).value;
    expect(await legacy.question(cardId, 'old')).toBe(true); expect(legacy.getSnapshot().current.compatibility).toBe(true);
    expect(admit).not.toHaveBeenCalled();
  });

  it('future or stopped epoch with FSRS enabled does not use compatibility and quota0 refuses novel exposure', async () => {
    const error = Object.assign(new Error('fsrs_daily_limit'), { status: 409 });
    for (const extra of [{ limit: 0, remaining: 0 }, { active: false, startsAt: '2026-10-04T19:00:00.000Z' }, { active: false, enabled: false }]) {
      const admit = vi.fn(async () => { throw error; });
      const { value } = controller({ load: async () => status(extra), admit });
      expect(await value.question(cardId, 'closed')).toBe(false); expect(admit).toHaveBeenCalled();
      expect(value.getSnapshot().current).toBeNull();
    }
  });

  it('settled configure invalidates a previously started GET, even at the same server millisecond', async () => {
    const late = deferred(), changed = status({ policyRevision: 2, limit: 0, remaining: 0 });
    const load = vi.fn().mockResolvedValueOnce(status()).mockImplementationOnce(() => late.promise);
    const { value } = controller({ load, configure: async () => ({ quota: changed }) });
    await value.refresh(); const pending = value.refresh();
    expect(await value.configure(0)).toBe(true); late.resolve(status()); await pending;
    expect(value.getSnapshot().quota).toMatchObject({ policyRevision: 2, limit: 0 });
  });

  it('a pending configuration can explicitly replay its original value after reload', async () => {
    const configure = vi.fn(async req => ({ quota: status({ policyRevision: 2, limit: req.dailyNewLimit, remaining: req.dailyNewLimit }) }));
    const { value } = controller({ load: async () => status(), configure,
      pending: async () => [{ request: { action: 'configure', dailyNewLimit: 20 } }] });
    await value.refresh(); expect(await value.retryConfiguration()).toBe(true);
    expect(configure).toHaveBeenCalledWith({ dailyNewLimit: 20, expectedPolicyRevision: 1 });
  });

  it('wakes at server KST04 even if the device has a different day, and disposal removes the wake', async () => {
    const load = vi.fn().mockResolvedValueOnce(status({ now: '2026-10-04T18:59:59.999Z' })).mockResolvedValueOnce(status({ now: '2026-10-04T19:00:00.000Z', learningDay: '2026-10-05' }));
    const { value, timers } = controller({ load });
    await value.refresh(); expect(timers[0].delay).toBe(1); timers[0].fn();
    await vi.waitFor(() => expect(value.getSnapshot().quota.learningDay).toBe('2026-10-05'));
    value.dispose(); timers[1].fn(); expect(load).toHaveBeenCalledTimes(2);
  });

  it('an obsolete card request cannot replace a newer question or refund used quota', async () => {
    const first = deferred(), second = deferred();
    const { value } = controller({ load: async () => status(), admit: req => (req.cardId === cardId ? first : second).promise });
    const old = value.question(cardId, 'old'); await vi.waitFor(() => expect(value.getSnapshot().quota).not.toBeNull());
    value.leave(); const next = value.question(actor, 'next');
    second.resolve(receipt({ operationId: 'next', cardId: actor }, status({ used: 2, legacyUsed: 2, remaining: 13, admittedLegacyCardIds: [actor, cardId] })));
    await next; first.resolve(receipt({ operationId: 'old', cardId })); await old;
    expect(value.getSnapshot().current.cardId).toBe(actor); expect(value.getSnapshot().quota.used).toBe(2);
  });
});

describe('FSRS shares authoritative admission without early exposure', () => {
  it('holds question word until server attempt and quota receipt, then sends the canonical CAS', async () => {
    const card = introduceFsrsCard('2026-10-04T00:00:00.000Z'), reply = deferred();
    const entry = { cardId, card, attempt: null, eligible: true };
    const client = { load: async () => ({ version: 1, enabled: true, registryAvailable: true, cards: [entry], now, admission: status() }),
      pending: async () => [], question: vi.fn(async payload => { await reply.promise; return { ...entry,
        attempt: beginFsrsAttempt(card, { id: payload.attemptId, userId: actor, cardId, at: now }), admission: status({ used: 1, fsrsUsed: 1, remaining: 14 }) }; }) };
    const value = createFsrsReviewController({ accountId: actor, client, now: () => Date.parse(now), makeId: () => 'question', eventTarget: null, visibilityTarget: null });
    disposers.push(() => value.dispose()); value.setWords([{ id: cardId, word_text: '秘密', meaning: '비밀' }]);
    const pending = value.question(); await vi.waitFor(() => expect(client.question).toHaveBeenCalled());
    expect(value.getSnapshot().current).toBeNull(); expect(client.question.mock.calls[0][0]).toMatchObject({ expectedPolicyRevision: 1, dailyNewLimit: 15 });
    reply.resolve(); expect(await pending).toBe(true); expect(value.getSnapshot().firstQuestionsToday).toBe(1);
  });

  it('a GET begun before question settlement cannot erase its attempt or mixed used count', async () => {
    const card = introduceFsrsCard('2026-10-04T00:00:00.000Z'), reply = deferred(), late = deferred();
    const entry = { cardId, card, attempt: null, eligible: true };
    const snapshot = () => ({ version: 1, enabled: true, registryAvailable: true, cards: [entry], now, admission: status() });
    const client = { load: vi.fn().mockResolvedValueOnce(snapshot()).mockImplementationOnce(() => late.promise), pending: async () => [],
      question: vi.fn(async payload => { await reply.promise; return { ...entry,
        attempt: beginFsrsAttempt(card, { id: payload.attemptId, userId: actor, cardId, at: now }),
        admission: status({ used: 1, fsrsUsed: 1, remaining: 14 }) }; }) };
    const value = createFsrsReviewController({ accountId: actor, client, now: () => Date.parse(now), makeId: () => 'question', eventTarget: null, visibilityTarget: null });
    disposers.push(() => value.dispose()); value.setWords([{ id: cardId }]);
    const question = value.question(); await vi.waitFor(() => expect(client.question).toHaveBeenCalled());
    const earlier = value.refresh(); reply.resolve(); await question; late.resolve(snapshot()); await earlier;
    expect(value.getSnapshot().current.attempt.id).toBe('question');
    expect(value.getSnapshot().cards[0].attempt.id).toBe('question');
    expect(value.getSnapshot().firstQuestionsToday).toBe(1);
  });

  it('durable FSRS question retries original operation/revision/attempt, with no automatic flush', async () => {
    const questionStore = memoryStore(), payloads = [], outbox = { list: async () => [] };
    const fetchImpl = async (_, init) => { const payload = JSON.parse(init.body); payloads.push(payload);
      if (payloads.length === 1) throw new Error('lost');
      return response({ version: 1, ok: true, actorId: actor, operationId: payload.operationId, cardId,
        duplicate: true, card: { revision: 0 }, admission: status(),
        attempt: { phase: 'question', eligible: true, hintedAt: null, questionAt: now, userId: actor, cardId, id: payload.attemptId, card: { revision: 0 } } }); };
    const make = () => createFsrsLearningClient({ accountId: actor, fetchImpl, questionStore, outbox, eventTarget: null });
    const payload = { cardId, operationId: 'original', expectedRevision: 0, attemptId: 'attempt', dailyNewLimit: 15, expectedPolicyRevision: 1 };
    await expect(make().question(payload)).rejects.toThrow('lost');
    const next = make(); next.start(); await Promise.resolve(); expect(payloads).toHaveLength(1);
    await next.question({ ...payload, operationId: 'replacement', attemptId: 'replacement', expectedPolicyRevision: 2 });
    expect(payloads[1]).toEqual(payloads[0]); next.dispose();
  });
});

// VOCAB-START-3 (2026-10-17 KST) — 복습 시작의 셋째 왕복: startSession이 입장 한도를 막 읽었는데 첫 카드의 question()이 다시
// refresh(GET)부터 했다(픽스처 실측 시작 클릭 뒤 입장 → FSRS → 입장 다시). question이 쓰는 것은 입장 한도(정책 판 · 호환 여부)뿐이고
// FSRS 목록은 쓰지 않지만, 묻는 카드(줄 머리)는 두 결과로 짠 줄에서 나오므로 앞 두 읽기와 함께 보낼 수는 없다. 대신 막 받은 한도
// (QUESTION_QUOTA_FRESH_MS 안)면 다시 읽지 않는다. 오래됐거나 · 오류 · 한도 없음이면 지금처럼 읽고, 판이 어긋나면 서버 409 → 다시 읽기 그대로.
describe('VOCAB-START-3 — 막 받은 입장 한도로 묻기(중복 GET 없음)', () => {
  const clock = start => { let t = start; return { now: () => t, advance: ms => { t += ms; } }; };
  it('막 읽은 한도(창 안)면 question은 다시 읽지 않는다 — 시작 직후 첫 카드', async () => {
    const load = vi.fn(async () => status()), c = clock(1000);
    const { value } = controller({ load, admit: async req => receipt({ ...req, operationId: 'q' }) }, { now: c.now });
    expect(await value.refresh()).toBe(true); expect(load).toHaveBeenCalledTimes(1);
    c.advance(300);
    expect(await value.question(cardId, 's:0')).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('호환(사전 활성) 한도도 같다 — 창 안이면 GET 없이 바로 호환 입장', async () => {
    const load = vi.fn(async () => status({ enabled: false, active: false, fsrsEnabled: false, startsAt: null })), admit = vi.fn(), c = clock(0);
    const { value } = controller({ load, admit }, { now: c.now });
    await value.refresh(); c.advance(50);
    expect(await value.question(cardId, 's:0')).toBe(true);
    expect(load).toHaveBeenCalledTimes(1); expect(admit).not.toHaveBeenCalled();
    expect(value.getSnapshot().current.compatibility).toBe(true);
  });
  it('창을 넘긴 한도는 지금처럼 다시 읽는다', async () => {
    const load = vi.fn(async () => status()), c = clock(0);
    const { value } = controller({ load, admit: async req => receipt({ ...req, operationId: 'q' }) }, { now: c.now });
    await value.refresh(); c.advance(60_000);
    await value.question(cardId, 's:0');
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('한도가 없거나 오류 상태면 다시 읽는다(창 안이어도)', async () => {
    const load = vi.fn().mockRejectedValueOnce(Object.assign(new Error('offline'), { status: 503 })).mockResolvedValue(status()), c = clock(0);
    const { value } = controller({ load, admit: async req => receipt({ ...req, operationId: 'q' }) }, { now: c.now });
    expect(await value.refresh()).toBe(false); expect(value.getSnapshot().status).toBe('error');
    expect(await value.question(cardId, 's:0')).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('성공 뒤 실패한 읽기(창 안)가 있었으면 막 받은 한도가 아니다 — 다시 읽는다', async () => {
    const load = vi.fn().mockResolvedValueOnce(status()).mockRejectedValueOnce(Object.assign(new Error('offline'), { status: 503 })).mockResolvedValue(status()), c = clock(0);
    const { value } = controller({ load, admit: async req => receipt({ ...req, operationId: 'q' }) }, { now: c.now });
    await value.refresh(); c.advance(10); expect(await value.refresh()).toBe(false); c.advance(10);
    expect(await value.question(cardId, 's:0')).toBe(true);
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('입장 응답이 준 한도도 막 받은 한도다 — 다음 카드(창 안)는 GET 없이 바로 묻는다', async () => {
    const load = vi.fn(async () => status()), c = clock(0);
    const { value } = controller({ load, admit: async req => receipt({ ...req, operationId: req.cardId }) }, { now: c.now });
    await value.refresh(); c.advance(100);
    await value.question(cardId, 's:0'); c.advance(100);
    value.leave(); await value.question(actor, 's:1');
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('진행 중인 읽기가 있으면 그것을 기다린다(창 안의 옛 한도를 쓰지 않음)', async () => {
    const late = deferred(), load = vi.fn().mockResolvedValueOnce(status()).mockImplementationOnce(() => late.promise), c = clock(0);
    const admit = vi.fn(async req => receipt({ ...req, operationId: 'q' }, status({ policyRevision: 2, used: 1, remaining: 14, legacyUsed: 1, admittedLegacyCardIds: [cardId] })));
    const { value } = controller({ load, admit }, { now: c.now });
    await value.refresh(); c.advance(10);
    const focusRead = value.refresh();
    const asked = value.question(cardId, 's:0');
    late.resolve(status({ policyRevision: 2 })); await focusRead;
    expect(await asked).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    expect(admit.mock.calls[0][0].expectedPolicyRevision).toBe(2); // 기다린 새 한도의 판으로 묻는다
  });
});
