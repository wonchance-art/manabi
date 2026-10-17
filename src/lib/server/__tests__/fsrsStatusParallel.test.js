import { describe, expect, it, vi } from 'vitest';
import { readFsrsStatus } from '../fsrsLearning.js';
import { introduceFsrsCard } from '../../fsrsScheduler.js';

// readFsrsStatus(PERF-FSRS-001) — 능력(fsrs_capabilities)과 등록 목록(fsrs_list_states)은 서로 기다리지 않는다.
// 둘 다 받은 뒤 능력 오류를 먼저 판정한다(오류 우선순위는 순차 때와 같다).
const owner = '10000000-0000-0000-0000-000000000001';
const cardId = '20000000-0000-0000-0000-000000000001';
const at = '2026-10-02T18:59:30.000Z';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const admission = { version: 1, actorId: owner, installed: true, enabled: true, active: true, fsrsEnabled: true, startsAt: '2026-10-01T19:00:00.000Z',
  now: at, learningDay: '2026-10-02', timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 15, policyRevision: 0, used: 0, remaining: 15,
  fsrsUsed: 0, legacyUsed: 0, admittedLegacyCardIds: [] };
const state = { cardId, userId: owner, card: introduceFsrsCard('2026-10-02T18:59:00.000Z'), attempt: null, enrolled: true, excluded: false, eligible: true, firstQuestionAt: null };

function clients({ capabilities = { data: { version: 1, enabled: true, policyVersion: 'anki-seconds-v1' } }, list = { data: [state] } } = {}) {
  const gate = { capabilities: deferred(), list: deferred() };
  const authClient = { rpc: vi.fn(async () => { await gate.capabilities.promise; if (capabilities instanceof Error) throw capabilities; return capabilities; }) };
  const serviceClient = { rpc: vi.fn(async name => {
    if (name === 'learning_admission_status') return { data: admission };
    await gate.list.promise; return list;
  }) };
  return { authClient, serviceClient, gate };
}
const flush = () => new Promise(r => setTimeout(r, 0));

describe('readFsrsStatus — 능력 · 등록 목록 병렬', () => {
  it('능력 응답을 기다리기 전에 등록 목록 요청이 이미 나가 있다', async () => {
    const { authClient, serviceClient, gate } = clients();
    const pending = readFsrsStatus({ authClient, serviceClient, userId: owner, now: at });
    await flush();
    expect(authClient.rpc).toHaveBeenCalledWith('fsrs_capabilities', undefined);
    expect(serviceClient.rpc).toHaveBeenCalledWith('fsrs_list_states', { p_actor: owner });
    gate.capabilities.resolve(); gate.list.resolve();
    const status = await pending;
    expect(status).toMatchObject({ enabled: true, policyVersion: 'anki-seconds-v1', registryAvailable: true, actorId: owner,
      cards: [{ cardId, enrolled: true }] });
  });
  it('둘 다 실패하면 능력 오류가 먼저다 — 목록이 먼저 실패해도', async () => {
    const { authClient, serviceClient, gate } = clients({ capabilities: new TypeError('fetch failed'), list: { error: { code: '57014', message: 'timeout' } } });
    const pending = readFsrsStatus({ authClient, serviceClient, userId: owner, now: at }).catch(error => error);
    gate.list.resolve(); await flush(); gate.capabilities.resolve();
    expect(await pending).toMatchObject({ code: 'fsrs_storage_unavailable', detail: 'fsrs_capabilities threw: TypeError fetch failed' });
  });
  it('능력 계약 불일치도 목록 오류보다 먼저다', async () => {
    const { authClient, serviceClient, gate } = clients({ capabilities: { data: { version: 2, enabled: true, policyVersion: 'anki-seconds-v1' } }, list: { error: { code: '57014', message: 'timeout' } } });
    const pending = readFsrsStatus({ authClient, serviceClient, userId: owner, now: at }).catch(error => error);
    gate.list.resolve(); gate.capabilities.resolve();
    expect(await pending).toMatchObject({ detail: 'fsrs_capabilities: contract mismatch' });
  });
  it('능력이 정상이면 목록 오류를 그대로 낸다', async () => {
    const { authClient, serviceClient, gate } = clients({ list: { error: { code: '57014', message: 'timeout' } } });
    const pending = readFsrsStatus({ authClient, serviceClient, userId: owner, now: at }).catch(error => error);
    gate.capabilities.resolve(); gate.list.resolve();
    expect(await pending).toMatchObject({ code: 'fsrs_storage_unavailable', detail: 'fsrs_list_states: 57014 timeout' });
  });
});
