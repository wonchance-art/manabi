// FSRS-LOADING-CAP (2026-10-17 KST) — FSRS 목록 읽기가 끝나지 않으면(대기 연산 IndexedDB blocked 등) 상태가 'loading'에 묶여
// /vocab 오늘 카드가 골격 · 시작 단추가 「복습 준비 중…」에 멈췄다. ready가 아닌 상태(loading · error)에서 시작한 읽기는
// FSRS_LOADING_CAP_MS를 넘기면 오류로 내리고(기존 「다시 시도」), 다시 시도는 누른 즉시 대기 표시로 올린 뒤 새 읽기를 보낸다 —
// 저장소가 계속 묶여 있으면 상한 뒤 다시 오류. ready 뒤 배경 재읽기에는 걸지 않는다. 늦게 도착한 결과는 세대 검사를 따른다.
import { readFileSync } from 'node:fs';
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

describe('FSRS-LOADING-CAP — ready가 아닌 상태의 읽기 상한', () => {
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

  it('ready 뒤 배경 재읽기(포커스 · 한도 변경)에는 상한을 걸지 않는다 — 화면을 오류로 뒤집지 않는다', async () => {
    const { controller, loads, capTimers } = harness();
    const first = controller.refresh(); loads[0].resolve(snapshot()); await first;
    controller.refresh();
    expect(capTimers()).toHaveLength(1); // 첫 읽기 것 하나뿐
    expect(controller.getSnapshot().status).toBe('ready');
  });

  it('저장소가 계속 묶인 채 다시 시도 — 누른 즉시 loading(대기 표시), 상한 뒤 다시 오류', async () => {
    const { controller, client, capTimers } = harness();
    controller.refresh(); capTimers()[0].fn();
    expect(controller.getSnapshot().status).toBe('error');
    controller.refresh({ retry: true });
    expect(client.load).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().status).toBe('loading'); expect(controller.getSnapshot().error).toBe(null);
    expect(capTimers()).toHaveLength(2);
    capTimers()[1].fn();
    expect(controller.getSnapshot().status).toBe('error');
    expect(controller.getSnapshot().error.message).toBe('fsrs_load_timeout');
    // 두 번째로 눌러도 같은 순환 — 묶인 약속에 갇히지 않는다.
    controller.refresh({ retry: true });
    expect(client.load).toHaveBeenCalledTimes(3); expect(controller.getSnapshot().status).toBe('loading');
    capTimers()[2].fn(); expect(controller.getSnapshot().status).toBe('error');
  });

  it('오류 중 배경 재읽기(retry 아님)는 화면을 오류로 둔 채 상한을 건다 — 다음 다시 시도가 새 읽기를 보낸다', async () => {
    const { controller, client, capTimers } = harness();
    controller.refresh(); capTimers()[0].fn();
    controller.refresh();
    expect(controller.getSnapshot().status).toBe('error');
    expect(capTimers()).toHaveLength(2);
    capTimers()[1].fn();
    controller.refresh({ retry: true });
    expect(client.load).toHaveBeenCalledTimes(3);
  });

  it('다시 시도 후 묶였던 저장소가 풀리면 ready', async () => {
    const { controller, loads, capTimers } = harness();
    controller.refresh(); capTimers()[0].fn();
    const retry = controller.refresh({ retry: true });
    loads[1].resolve(snapshot()); expect(await retry).toBe(true);
    expect(controller.getSnapshot().status).toBe('ready');
  });

  it('ready에서 retry를 넘겨도 loading으로 내리지 않는다', async () => {
    const { controller, loads, capTimers } = harness();
    const first = controller.refresh(); loads[0].resolve(snapshot()); await first;
    controller.refresh({ retry: true });
    expect(controller.getSnapshot().status).toBe('ready'); expect(capTimers()).toHaveLength(1);
  });
});

describe('FSRS-LOADING-CAP — /vocab 배선', () => {
  const src = readFileSync(new URL('../../views/VocabPage.jsx', import.meta.url), 'utf8');
  it('오류 안내의 「다시 시도」는 retry로 읽는다(누른 즉시 대기 표시)', () => {
    const alert = src.match(/<p role="alert">복습 일정을 불러오지 못했어요\.[^\n]*/)?.[0] || '';
    expect(alert).toContain('fsrsReview.controller.refresh({ retry: true })');
  });
  it('loading은 기존 대기 표시(「복습 준비 중…」)로 이어진다 — 새 문구 없음', () => {
    expect(src).toMatch(/const roomHeroPending = [^\n]*fsrsReview\.status === 'loading'/);
    // 서버 첫 화면 숫자(VOCAB-FIRST-NUMBERS-001)를 그리는 동안만 제외 — 그 밖의 대기 표시는 같은 판정이다.
    expect(src).toContain('const heroPending = !firstView && roomHeroPending;');
    expect(src).toMatch(/heroPending \? <p aria-busy="true" className="review-room-note">복습 준비 중…<\/p>/);
  });
});
