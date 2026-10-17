// FSRS-LOADING-CAP (2026-10-17 KST) — 처음 받는 FSRS 목록이 끝나지 않으면(대기 연산 IndexedDB blocked 등) 상태가 'loading'에 묶여
// /vocab 오늘 카드가 골격 · 시작 단추가 「복습 준비 중…」에 멈췄다. FSRS_LOADING_CAP_MS를 넘기면 오류로 내리고(기존 「다시 시도」),
// 다시 시도는 새 읽기를 보낸다. 늦게 도착한 결과는 세대 검사를 따른다(새 읽기 없으면 반영 · 있으면 버림).
import { describe, expect, it, vi } from 'vitest';
import { createFsrsReviewController, FSRS_LOADING_CAP_MS } from '../useFsrsReview';

vi.mock('../useLearningAdmission', () => ({ logLearningFailure: vi.fn() }));
const actor = '10000000-0000-0000-0000-000000000001';
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const snapshot = (extra = {}) => ({ version: 1, registryAvailable: true, cards: [], enabled: false, now: '2026-10-17T00:00:00.000Z', firstQuestionsToday: 0, ...extra });
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness() {
  const loads = [], timers = [], cleared = [];
  const client = { load: vi.fn(() => { const d = deferred(); loads.push(d); return d.promise; }), pending: vi.fn(async () => []) };
  const controller = createFsrsReviewController({ accountId: actor, client, eventTarget: null, visibilityTarget: null,
    setTimer: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimer: id => cleared.push(id) });
  controller.start();
  const capTimers = () => timers.map((t, i) => ({ ...t, id: i + 1 })).filter(t => t.delay === FSRS_LOADING_CAP_MS);
  return { client, controller, loads, timers, cleared, capTimers };
}

describe('FSRS-LOADING-CAP — 처음 읽기 상한', () => {
  it('상한 전에는 loading, 상한을 넘기면 오류(다시 시도 화면) — registryAvailable도 거짓', async () => {
    const { controller, capTimers } = harness();
    controller.refresh();
    expect(controller.getSnapshot().status).toBe('loading');
    expect(capTimers()).toHaveLength(1);
    capTimers()[0].fn();
    const state = controller.getSnapshot();
    expect(state.status).toBe('error'); expect(state.registryAvailable).toBe(false);
    expect(state.error.message).toBe('fsrs_load_timeout');
  });

  it('다시 시도는 묶인 읽기를 기다리지 않고 새 읽기를 보낸다 — 그 결과로 ready', async () => {
    const { controller, client, loads, capTimers } = harness();
    controller.refresh(); capTimers()[0].fn();
    const retry = controller.refresh();
    expect(client.load).toHaveBeenCalledTimes(2);
    loads[1].resolve(snapshot()); expect(await retry).toBe(true);
    expect(controller.getSnapshot().status).toBe('ready');
  });

  it('늦게 도착한 성공은 새 읽기가 없으면 반영된다(스스로 회복)', async () => {
    const { controller, loads, capTimers } = harness();
    const first = controller.refresh(); capTimers()[0].fn();
    expect(controller.getSnapshot().status).toBe('error');
    loads[0].resolve(snapshot()); expect(await first).toBe(true);
    expect(controller.getSnapshot().status).toBe('ready'); expect(controller.getSnapshot().registryAvailable).toBe(true);
  });

  it('다시 시도가 시작된 뒤 늦게 온 옛 결과는 버린다(세대 검사)', async () => {
    const { controller, loads, capTimers } = harness();
    const first = controller.refresh(); capTimers()[0].fn();
    const retry = controller.refresh();
    loads[1].resolve(snapshot({ firstQuestionsToday: 2 })); await retry;
    loads[0].resolve(snapshot({ firstQuestionsToday: 9 })); expect(await first).toBe(false);
    expect(controller.getSnapshot().firstQuestionsToday).toBe(2);
  });

  it('상한 전에 끝나면 상한 타이머를 거두고, 뒤늦게 울려도 아무것도 바꾸지 않는다', async () => {
    const { controller, loads, cleared, capTimers } = harness();
    const first = controller.refresh();
    loads[0].resolve(snapshot()); await first;
    const cap = capTimers()[0];
    expect(cleared).toContain(cap.id);
    cap.fn(); await tick();
    expect(controller.getSnapshot().status).toBe('ready');
  });

  it('처음 받는 중이 아닐 때(ready · error 뒤 다시 읽기)는 상한을 걸지 않는다 — 화면을 오류로 뒤집지 않는다', async () => {
    const { controller, loads, capTimers } = harness();
    const first = controller.refresh(); loads[0].resolve(snapshot()); await first;
    controller.refresh();
    expect(capTimers()).toHaveLength(1); // 첫 읽기 것 하나뿐
  });
});
