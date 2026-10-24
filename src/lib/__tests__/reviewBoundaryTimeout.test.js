import { beforeEach, describe, expect, it, vi } from 'vitest';

// 운영 실측 2026-10-23 KST: DB가 몰릴 때 채점 전 경계 확인(fsrs_legacy_boundary)이 8초 시간 초과(57014)로 실패하면
// 채점이 서버에도 기기 큐에도 남지 않고 「복습을 저장하지 못했어요」로 버려졌다. 확인 실패는 차단이 아니다.
const remote = vi.hoisted(() => ({ rpc: vi.fn(), events: vi.fn(), grade: vi.fn(), activity: vi.fn(), enqueue: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { rpc: remote.rpc } }));
vi.mock('../reviewEvents', () => ({ logReviewEvents: remote.events }));
vi.mock('../fsrs', () => ({ persistVocabGrade: remote.grade }));
vi.mock('../streak', () => ({ recordActivity: remote.activity }));
vi.mock('../reviewOutbox', () => ({ enqueueReview: remote.enqueue }));
import { recordReviewCompleted } from '../learn/progressStore';

const grade = (userId) => recordReviewCompleted(userId, {
  type: 'vocab', itemKey: '学习', lang: 'Chinese', correct: true,
  detail: { word_id: `word-${userId}`, rating: 3, qtype: 'flash' },
}, { interval: 1, ease_factor: 5, repetitions: 0, next_review_at: '2026-10-24T01:00:00.000Z' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { onLine: true });
  remote.events.mockResolvedValue(true);
  remote.grade.mockResolvedValue();
  remote.activity.mockResolvedValue(true);
  remote.enqueue.mockResolvedValue(true);
});

describe('legacy boundary check failure keeps the grade', () => {
  it('queues the grade on the device when the boundary RPC times out, without writing online', async () => {
    remote.rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });
    const r = await grade('alice');
    expect(r).toMatchObject({ ok: true, queued: true });
    expect(remote.enqueue).toHaveBeenCalledTimes(1);
    expect(remote.enqueue.mock.calls[0][0]).toMatchObject({ userId: 'alice', itemKey: '学习', reviewedAt: r.reviewedAt });
    expect(remote.events).not.toHaveBeenCalled();
    expect(remote.grade).not.toHaveBeenCalled();
  });

  it('queues when the boundary RPC throws (connection dropped)', async () => {
    remote.rpc.mockRejectedValue(new TypeError('Load failed'));
    expect(await grade('bob')).toMatchObject({ ok: true, queued: true });
  });

  it('still refuses, unqueued, a card the boundary reports as enrolled', async () => {
    remote.rpc.mockResolvedValue({ data: { version: 1, enrolled: true, actorId: 'carol' }, error: null });
    const r = await grade('carol');
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('fsrs_legacy_write_blocked');
    expect(remote.enqueue).not.toHaveBeenCalled();
  });

  it('still refuses, unqueued, when the signed-in account changed mid-grade', async () => {
    remote.rpc.mockResolvedValue({ data: { version: 1, enrolled: false, actorId: 'someone-else' }, error: null });
    const r = await grade('dave');
    expect(r.error?.code).toBe('fsrs_account_changed');
    expect(remote.enqueue).not.toHaveBeenCalled();
  });
});
