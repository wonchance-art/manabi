// 오프라인 복습 허용(F9) · 이미 입장한 카드의 입장 왕복 생략(F5①) — 오너 승인 2026-10-25 KST 「권장대로」(로그인 감사 ㉡).
// 계약: ① 서버가 이미 입장시킨 카드(admittedLegacyCardIds · 입장 응답)는 끊겼을 때만 왕복 없이 연다. 연결돼 있으면 지금처럼 입장 POST가
//    매번 다시 검사한다(제외 · 다른 기기가 먼저 복습해 아직 때가 아님 · 정책 판 — 독립 리뷰 2026-10-25 KST).
// ② 아직 입장하지 않은 카드는 서버만 연다 — 끊겼으면 묻지 않고 끊김 오류(learning_admission_offline)로 기다리다 연결되면 같은 열쇠로 다시 묻는다.
// ③ 끊긴 동안의 배경 읽기 실패는 받은 한도 · 열린 카드를 거두지 않는다(연결된 채 실패는 지금처럼 닫는다). ④ 호환(사전 활성) 모드는 지름길을 쓰지 않는다.
// ⑤ 입장 응답의 한도는 FSRS 줄이 GET 없이 받는다(같은 날 · 같은 정책 판일 때만). ⑥ 계정마다 따로다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLearningAdmissionController, LEARNING_ADMISSION_OFFLINE, isAdmissionOfflineError } from '../useLearningAdmission';
import { createFsrsReviewController } from '../useFsrsReview';
import { introduceFsrsCard } from '../fsrsScheduler';

const actor = '10000000-0000-0000-0000-000000000001';
const other = '10000000-0000-0000-0000-000000000002';
const reviewed = '20000000-0000-0000-0000-000000000001';
const fresh = '20000000-0000-0000-0000-000000000002';
const now = '2026-10-04T00:00:30.000Z';
const status = (extra = {}) => ({ version: 1, actorId: actor, installed: true, enabled: true, active: true,
  fsrsEnabled: true, startsAt: '2026-10-03T19:00:00.000Z', now, learningDay: '2026-10-04', timeZone: 'Asia/Seoul', rolloverHour: 4,
  limit: 15, policyRevision: 1, used: 0, remaining: 15, fsrsUsed: 0, legacyUsed: 0, admittedLegacyCardIds: [reviewed], ...extra });
const receipt = (request, quota) => ({ version: 1, actorId: quota.actorId, operationId: request.operationId || 'op', cardId: request.cardId,
  admitted: true, consumed: true, duplicate: false, admittedAt: now, firstQuestionAt: now, startsAt: quota.startsAt, learningDay: quota.learningDay, quota });
const offlineError = () => Object.assign(new TypeError('Failed to fetch'));

class Target { constructor() { this.listeners = {}; }
  addEventListener(type, fn) { (this.listeners[type] ||= new Set()).add(fn); }
  removeEventListener(type, fn) { this.listeners[type]?.delete(fn); }
  emit(type) { [...(this.listeners[type] || [])].forEach(fn => fn()); } }

const disposers = [];
afterEach(() => disposers.splice(0).forEach(dispose => dispose()));
function setup({ load, admit, accountId = actor, clock = { t: 0 } } = {}) {
  const net = { offline: false };
  const client = { load: vi.fn(load || (async () => status())),
    admit: vi.fn(admit || (async req => receipt(req, status({ used: 1, remaining: 14, legacyUsed: 1, admittedLegacyCardIds: [...new Set([reviewed, req.cardId])] })))),
    pending: async () => [], cancel: vi.fn() };
  const target = new Target(), onQuota = vi.fn();
  const value = createLearningAdmissionController({ accountId, client, onQuota, eventTarget: target, visibilityTarget: null,
    setTimer: () => 1, clearTimer: () => {}, now: () => clock.t, isOffline: () => net.offline });
  value.start(); disposers.push(() => value.dispose());
  return { value, client, net, target, onQuota, clock };
}
const calls = client => client.load.mock.calls.length + client.admit.mock.calls.length;

describe('연결돼 있으면 이미 입장한 카드도 서버가 다시 검사한다', () => {
  it('이미 입장한 카드라도 연결돼 있으면 입장 POST를 한다(지름길 없음 — 서버 재검사 유지)', async () => {
    const f = setup(); await f.value.refresh();
    expect(await f.value.question(reviewed, 's:0')).toBe(true);
    expect(f.client.admit).toHaveBeenCalledWith({ cardId: reviewed, expectedPolicyRevision: 1 });
    expect(f.value.getSnapshot().current.receipt.cardId).toBe(reviewed);
    expect(f.value.getSnapshot().current.admitted).toBeUndefined();
  });

  it('다른 기기가 방금 복습한 카드는 입장했어도 연결된 채로는 열리지 않는다 — 서버 거절(not_due)을 그대로 알린다', async () => {
    const notDue = Object.assign(new Error('fsrs_card_not_due'), { code: 'fsrs_card_not_due', status: 409 });
    const f = setup({ admit: async () => { throw notDue; } }); await f.value.refresh();
    expect(f.value.isAdmitted(reviewed)).toBe(true);
    expect(await f.value.question(reviewed, 's:3')).toBe(false);
    expect(f.client.admit).toHaveBeenCalledTimes(1);
    expect(f.value.getSnapshot()).toMatchObject({ current: null });
    expect(f.value.getSnapshot().error?.code).toBe('fsrs_card_not_due');
    f.value.dismissError(); expect(f.value.getSnapshot().error).toBeNull();
  });

  it('입장 응답이 알려 준 카드도 다음 질문(연결됨)에서는 다시 묻고, 끊긴 뒤에는 왕복 없이 연다', async () => {
    const f = setup(); await f.value.refresh();
    expect(await f.value.question(fresh, 's:0')).toBe(true);
    f.value.leave();
    expect(await f.value.question(fresh, 's:4')).toBe(true);
    expect(f.client.admit).toHaveBeenCalledTimes(2);
    f.value.leave(); f.net.offline = true;
    const before = calls(f.client);
    expect(await f.value.question(fresh, 's:9')).toBe(true);
    expect(calls(f.client)).toBe(before);
    expect(f.value.getSnapshot().current).toMatchObject({ cardId: fresh, questionKey: 's:9', admitted: true });
  });

  it('입장하지 않은 카드는 지금처럼 서버가 연다(POST 1번 · 응답 한도는 source admit으로 알린다)', async () => {
    const f = setup(); await f.value.refresh(); f.onQuota.mockClear();
    expect(await f.value.question(fresh, 's:0')).toBe(true);
    expect(f.client.admit).toHaveBeenCalledWith({ cardId: fresh, expectedPolicyRevision: 1 });
    expect(f.onQuota).toHaveBeenCalledTimes(1);
    expect(f.onQuota.mock.calls[0][1]).toEqual({ source: 'admit' });
    expect(f.value.getSnapshot().current.receipt.cardId).toBe(fresh);
  });

  it('호환(사전 활성) 한도에서는 끊겨도 지름길을 쓰지 않는다 — 입장권이 없는 모드다', async () => {
    const compat = status({ enabled: false, active: false, fsrsEnabled: false, startsAt: null, admittedLegacyCardIds: [reviewed] });
    const f = setup({ load: async () => compat }); await f.value.refresh();
    expect(f.value.isAdmitted(reviewed)).toBe(false);
    f.net.offline = true;
    expect(await f.value.question(reviewed, 's:0')).toBe(false);
    expect(f.value.getSnapshot().error?.code).toBe(LEARNING_ADMISSION_OFFLINE);
  });

  it('한도를 한 번도 못 받았으면 끊긴 채 지름길이 없다', async () => {
    const f = setup(); f.net.offline = true;
    expect(await f.value.question(reviewed, 's:0')).toBe(false);
    expect(calls(f.client)).toBe(0);
  });
});

describe('F9 — 끊긴 동안의 복습', () => {
  it('이미 입장한 카드는 끊겨도 열린다(네트워크 0)', async () => {
    const f = setup(); await f.value.refresh(); f.net.offline = true;
    f.client.load.mockRejectedValue(offlineError());
    expect(await f.value.question(reviewed, 's:1')).toBe(true);
    expect(f.client.load).toHaveBeenCalledTimes(1); expect(f.client.admit).not.toHaveBeenCalled();
  });

  it('입장하지 않은 카드에 닿으면 묻지 않고 끊김 오류로 기다리다, 연결되면 같은 카드 · 같은 열쇠로 다시 묻는다', async () => {
    const f = setup(); await f.value.refresh(); f.net.offline = true;
    expect(await f.value.question(fresh, 's:2')).toBe(false);
    expect(f.client.admit).not.toHaveBeenCalled();
    expect(f.value.getSnapshot().error?.code).toBe(LEARNING_ADMISSION_OFFLINE);
    expect(isAdmissionOfflineError(f.value.getSnapshot().error)).toBe(true);
    expect(f.value.getSnapshot()).toMatchObject({ busy: false, current: null, status: 'ready' });
    f.net.offline = false; f.target.emit('online');
    await vi.waitFor(() => expect(f.value.getSnapshot().current?.cardId).toBe(fresh));
    expect(f.value.getSnapshot().current.questionKey).toBe('s:2');
    expect(f.client.admit).toHaveBeenCalledTimes(1);
    expect(f.value.getSnapshot().error).toBeNull();
  });

  it('묻는 도중 끊기면(POST 실패) 「준비하지 못했어요」 대신 끊김 오류다', async () => {
    const f = setup({ admit: async () => { f.net.offline = true; throw offlineError(); } });
    await f.value.refresh();
    expect(await f.value.question(fresh, 's:0')).toBe(false);
    expect(f.value.getSnapshot().error?.code).toBe(LEARNING_ADMISSION_OFFLINE);
  });

  it('끊긴 동안의 배경 읽기(포커스) 실패는 받은 한도 · 열린 카드를 거두지 않는다', async () => {
    const f = setup(); await f.value.refresh();
    await f.value.question(reviewed, 's:0');
    f.net.offline = true; f.client.load.mockRejectedValue(offlineError());
    expect(await f.value.refresh()).toBe(false);
    expect(f.value.getSnapshot()).toMatchObject({ status: 'ready', error: null });
    expect(f.value.getSnapshot().quota).not.toBeNull();
    expect(f.value.getSnapshot().current?.cardId).toBe(reviewed);
  });

  it('연결된 채 읽기가 실패하면 지금처럼 닫는다(한도 · 카드를 거둔다)', async () => {
    const f = setup(); await f.value.refresh(); await f.value.question(reviewed, 's:0');
    f.client.load.mockRejectedValue(Object.assign(new Error('fsrs_admission_unavailable'), { status: 503 }));
    expect(await f.value.refresh()).toBe(false);
    expect(f.value.getSnapshot()).toMatchObject({ status: 'error', quota: null, current: null });
    // 단조 사실(이미 입장)은 계정 controller가 기억한다 — 그 뒤 끊기면 이미 입장한 카드는 열린다(연결된 채로는 서버에 묻는다).
    expect(await f.value.question(reviewed, 's:1')).toBe(false);
    f.net.offline = true;
    expect(await f.value.question(reviewed, 's:2')).toBe(true);
  });

  it('다음 카드로 넘기면(leave) 끊김 오류를 지운다 — 목록으로 돌아가도 「준비하지 못했어요」가 남지 않는다', async () => {
    const f = setup(); await f.value.refresh(); f.net.offline = true;
    await f.value.question(fresh, 's:2'); f.value.leave();
    expect(f.value.getSnapshot().error).toBeNull();
    f.net.offline = false; f.target.emit('online');
    await vi.waitFor(() => expect(f.client.load).toHaveBeenCalledTimes(2)); // 다시 물을 카드가 없으면 한도만 다시 읽는다
    expect(f.client.admit).not.toHaveBeenCalled();
  });
});

describe('계정 경계', () => {
  it('A 계정 controller가 아는 입장은 B 계정 controller가 모른다 — 카드는 그 계정 id로만 열린다', async () => {
    const a = setup(); await a.value.refresh();
    const bQuota = status({ actorId: other, admittedLegacyCardIds: [] });
    const b = setup({ accountId: other, load: async () => bQuota,
      admit: async req => receipt(req, { ...bQuota, used: 1, remaining: 14, legacyUsed: 1, admittedLegacyCardIds: [req.cardId] }) });
    await b.value.refresh(); b.net.offline = true;
    expect(await b.value.question(reviewed, 's:0')).toBe(false); // A가 입장한 카드라도 B는 서버에 물어야 한다(끊김 → 기다림)
    expect(b.value.getSnapshot().error?.code).toBe(LEARNING_ADMISSION_OFFLINE);
    expect(await a.value.question(reviewed, 's:0')).toBe(true);
    expect(a.value.getSnapshot().current.accountId).toBe(actor);
  });

  it('dispose(계정 전환 · 화면 떠남)는 기억한 입장을 버린다 — 다시 시작해 새 한도(그 카드 없음)를 받아도 되살아나지 않는다', async () => {
    const f = setup(); await f.value.refresh();
    expect(f.value.isAdmitted(reviewed)).toBe(true);
    f.value.dispose();
    expect(f.value.isAdmitted(reviewed)).toBe(false);
    f.client.load.mockResolvedValue(status({ admittedLegacyCardIds: [] }));
    f.value.start(); await f.value.refresh();
    expect(f.value.isAdmitted(reviewed)).toBe(false); // admitted.clear()가 없으면 옛 합집합이 남는다
    f.net.offline = true;
    expect(await f.value.question(reviewed, 's:0')).toBe(false);
  });
});

describe('F5① — 입장 응답이 실은 한도를 FSRS 줄이 GET 없이 받는다', () => {
  const card = introduceFsrsCard('2026-10-03T00:00:00.000Z');
  const fsrs = ({ offline = () => false } = {}) => {
    const client = { load: vi.fn(async () => ({ version: 1, enabled: true, registryAvailable: true, now,
      cards: [{ cardId: fresh, card, attempt: null, eligible: true }], admission: status() })), pending: async () => [] };
    const target = new Target();
    const value = createFsrsReviewController({ accountId: actor, client, now: () => Date.parse(now), eventTarget: target,
      visibilityTarget: null, setTimer: () => 1, clearTimer: () => {}, isOffline: offline });
    value.start(); value.setWords([{ id: fresh }]); disposers.push(() => value.dispose());
    return { value, client, target };
  };
  it('같은 날 · 같은 정책 판이면 한도만 바꾸고 다시 읽지 않는다', async () => {
    const f = fsrs(); await f.value.refresh();
    expect(f.value.adoptAdmission(status({ now: '2026-10-04T00:01:00.000Z', used: 3, remaining: 12, legacyUsed: 3 }))).toBe(true);
    expect(f.client.load).toHaveBeenCalledTimes(1);
    expect(f.value.getSnapshot().admission).toMatchObject({ used: 3, remaining: 12 });
    expect(f.value.getSnapshot().firstQuestionsToday).toBe(3);
  });
  it('날 · 정책 판 · 활성이 바뀌었으면 받지 않는다(false — 호출부가 지금처럼 다시 읽는다) · 더 옛 한도는 무시한다', async () => {
    const f = fsrs(); await f.value.refresh();
    expect(f.value.adoptAdmission(status({ policyRevision: 2 }))).toBe(false);
    expect(f.value.adoptAdmission(status({ now: '2026-10-04T19:00:00.000Z', learningDay: '2026-10-05' }))).toBe(false);
    expect(f.value.adoptAdmission({ ...status(), actorId: other })).toBe(false);
    expect(f.value.adoptAdmission(status({ now: '2026-10-04T00:00:00.000Z', used: 9, remaining: 6, legacyUsed: 9 }))).toBe(true);
    expect(f.value.getSnapshot().admission.used).toBe(0);
  });
  it('끊긴 동안의 배경 다시 읽기 실패는 등록 목록을 「없음」으로 내리지 않는다 — 예전 일정 카드가 계속 열린다', async () => {
    let offline = false;
    const f = fsrs({ offline: () => offline }); await f.value.refresh();
    expect(f.value.canLegacy(reviewed)).toBe(true);
    offline = true; f.client.load.mockRejectedValue(offlineError());
    expect(await f.value.refresh()).toBe(false);
    expect(f.value.getSnapshot()).toMatchObject({ status: 'ready', registryAvailable: true });
    expect(f.value.canLegacy(reviewed)).toBe(true); expect(f.value.canLegacy(fresh)).toBe(false);
    offline = false; f.client.load.mockClear().mockResolvedValue({ version: 1, enabled: true, registryAvailable: true, now, cards: [], admission: status() });
    f.target.emit('online');
    await vi.waitFor(() => expect(f.client.load).toHaveBeenCalledTimes(1)); // 연결되면 정본으로 다시 읽는다
  });
  it('연결된 채 실패하면 지금처럼 오류다', async () => {
    const f = fsrs(); await f.value.refresh();
    f.client.load.mockRejectedValue(new Error('fsrs_unavailable'));
    expect(await f.value.refresh()).toBe(false);
    expect(f.value.getSnapshot()).toMatchObject({ status: 'error', registryAvailable: false });
  });
});
