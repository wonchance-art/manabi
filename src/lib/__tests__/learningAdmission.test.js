import { describe, expect, it } from 'vitest';
import { normalizeAdmissionStatus, normalizeAdmissionRequest, validateAdmissionReceipt,
  canUseLegacyAdmissionCompatibility, nextAdmissionDayAt } from '../learningAdmission.js';

const actorId = '10000000-0000-0000-0000-000000000001';
const cardId = '20000000-0000-0000-0000-000000000001';
const status = extra => ({ version: 1, actorId, installed: true, enabled: true, active: true, fsrsEnabled: true,
  startsAt: '2026-10-03T19:00:00.000Z', now: '2026-10-04T00:00:00.000Z', learningDay: '2026-10-04',
  timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 15, policyRevision: 1, used: 1, remaining: 14,
  fsrsUsed: 0, legacyUsed: 1, admittedLegacyCardIds: [cardId], ...extra });
const request = extra => ({ action: 'admit', accountId: actorId, operationId: 'first-question', cardId, expectedPolicyRevision: 1, ...extra });
const receipt = extra => ({ version: 1, actorId, operationId: 'first-question', cardId, admitted: true,
  consumed: true, duplicate: false, firstQuestionAt: '2026-10-04T00:00:00.000Z', admittedAt: '2026-10-04T00:00:00.000Z',
  startsAt: '2026-10-03T19:00:00.000Z', learningDay: '2026-10-04', quota: status(), ...extra });

describe('공통 첫 문제 입장 계약', () => {
  it('계정/문제/정책 revision만 입장 요청으로 받고 한도 변경은 별도 CAS이다', () => {
    expect(normalizeAdmissionRequest(request(), actorId)).toEqual(request());
    const configure = { action: 'configure', accountId: actorId, operationId: 'policy', expectedPolicyRevision: 1, dailyNewLimit: 0 };
    expect(normalizeAdmissionRequest(configure, actorId)).toEqual(configure);
    for (const extra of [{ dailyNewLimit: 40 }, { now: status().now }, { admitted: true }, { memory: {} }, { userId: actorId },
      { expectedPolicyRevision: -1 }, { expectedPolicyRevision: Number.MAX_SAFE_INTEGER }, { expectedPolicyRevision: '1' }]) {
      expect(() => normalizeAdmissionRequest(request(extra), actorId)).toThrow();
    }
    expect(() => normalizeAdmissionRequest(request({ accountId: cardId }), actorId)).toThrow('fsrs_account_changed');
    expect(() => normalizeAdmissionRequest({ ...configure, dailyNewLimit: 16 }, actorId)).toThrow();
    expect(() => normalizeAdmissionRequest(null, actorId)).toThrow();
  });

  it('mixed total, remaining, 고유 actor 카드 집합, KST04 날짜를 실제 관계로 검사한다', () => {
    expect(normalizeAdmissionStatus(status({ fsrsUsed: 2, legacyUsed: 3, used: 5, remaining: 10 }), { actorId }).used).toBe(5);
    for (const extra of [{ actorId: cardId }, { used: 2 }, { remaining: 15 }, { limit: 16 }, { policyRevision: null },
      { admittedLegacyCardIds: [cardId, cardId] }, { admittedLegacyCardIds: null }, { learningDay: '2026-10-03' },
      { rolloverHour: 0 }, { timeZone: 'UTC' }, { startsAt: '2026-10-03T19:00:00.001Z' }, { active: false }, { fsrsEnabled: undefined }]) {
      expect(() => normalizeAdmissionStatus(status(extra), { actorId })).toThrow();
    }
    expect(normalizeAdmissionStatus(status({ limit: 0, used: 1, remaining: 0 }), { actorId }).remaining).toBe(0);
    expect(normalizeAdmissionStatus(status({ now: '2026-10-04T00:00:00.123456Z' }), { actorId }).now).toBe('2026-10-04T00:00:00.123Z');
  });

  it('03:59:59와04:00에 새 학습일/다음 갱신 경계가 함께 바뀐다', () => {
    const before = status({ now: '2026-10-04T18:59:59.999Z' });
    const after = status({ now: '2026-10-04T19:00:00.000Z', learningDay: '2026-10-05' });
    expect(nextAdmissionDayAt(before)).toBe('2026-10-04T19:00:00.000Z');
    expect(nextAdmissionDayAt(after)).toBe('2026-10-05T19:00:00.000Z');
  });

  it('정확한 구 비활성만 호환하고 epoch 도달 뒤 중단/미확인은 호환하지 않는다', () => {
    const missing = status({ installed: false, enabled: false, active: false, fsrsEnabled: false, startsAt: null,
      limit: null, policyRevision: null, used: null, remaining: null, fsrsUsed: null, legacyUsed: null, admittedLegacyCardIds: null });
    expect(canUseLegacyAdmissionCompatibility(missing)).toBe(true);
    expect(canUseLegacyAdmissionCompatibility({ enabled: false })).toBe(false);
    expect(canUseLegacyAdmissionCompatibility({ ...missing, used: 0 })).toBe(false);
    expect(canUseLegacyAdmissionCompatibility(status({ active: false, startsAt: '2026-10-04T19:00:00.000Z' }))).toBe(false);
    expect(canUseLegacyAdmissionCompatibility(status({ active: false, enabled: false, fsrsEnabled: false }))).toBe(false);
    expect(canUseLegacyAdmissionCompatibility(status({ active: false, fsrsEnabled: false, startsAt: '2026-10-04T19:00:00.000Z' }))).toBe(true);
  });

  it('최초 노출 영수증은 요청·시각·학습일·카드와 묶이고 재전송은 현재 한도로 돌아온다', () => {
    expect(validateAdmissionReceipt(receipt(), { request: request() }).consumed).toBe(true);
    const replay = receipt({ duplicate: true, quota: status({ now: '2026-10-05T00:00:00.000Z', learningDay: '2026-10-05',
      used: 0, legacyUsed: 0, remaining: 0, limit: 0, policyRevision: 3 }) });
    expect(validateAdmissionReceipt(replay, { request: request() })).toMatchObject({ learningDay: '2026-10-04', quota: { learningDay: '2026-10-05', limit: 0 } });
    for (const extra of [{ cardId: actorId }, { actorId: cardId }, { operationId: 'another' }, { admitted: false },
      { firstQuestionAt: null }, { admittedAt: '2026-10-04T00:00:01.000Z' }, { learningDay: '2026-10-03' },
      { startsAt: '2026-10-02T19:00:00.000Z' },
      { quota: status({ admittedLegacyCardIds: [] }) }, { quota: status({ policyRevision: 2 }) }]) {
      expect(() => validateAdmissionReceipt(receipt(extra), { request: request() })).toThrow();
    }
  });

  it('reviewed 입장은 first receipt를 추측하지 않고 configure는 성공한 CAS와 현재 replay를 구분한다', () => {
    const reviewed = receipt({ consumed: false, firstQuestionAt: null });
    expect(validateAdmissionReceipt(reviewed, { request: request() }).firstQuestionAt).toBeNull();
    expect(validateAdmissionReceipt({ ...reviewed, duplicate: true, startsAt: null }, { request: request() }).startsAt).toBeNull();
    const configure = { action: 'configure', accountId: actorId, operationId: 'policy', expectedPolicyRevision: 1, dailyNewLimit: 0 };
    const response = { version: 1, actorId, operationId: 'policy', duplicate: false, quota: status({ limit: 0, remaining: 0, policyRevision: 2 }) };
    expect(validateAdmissionReceipt(response, { request: configure }).quota.limit).toBe(0);
    expect(() => validateAdmissionReceipt({ ...response, quota: status() }, { request: configure })).toThrow();
    expect(() => validateAdmissionReceipt({ ...response, duplicate: true, quota: status() }, { request: configure })).toThrow();
    expect(validateAdmissionReceipt({ ...response, duplicate: true, quota: status({ policyRevision: 3 }) }, { request: configure }).quota.limit).toBe(15);
  });
});
