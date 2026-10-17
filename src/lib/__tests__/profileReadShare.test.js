// PROFILE-READ-SHARE-001 (2026-10-17 KST) — 로그인 상태 페이지 로드마다 profiles GET이 두 번 나갔다(세션 확인 getSession 경로 +
// INITIAL_SESSION 알림 경로, 개발 서버 실측 4~10ms 간격 · 같은 select('*')). 같은 계정의 진행 중 읽기를 공유하되:
//   · 공유는 세션 경로가 명시할 때만(share: true). 그 밖의 refresh는 「쓰기 뒤 재읽기」로 보고 늘 새로 읽는다 — 그리고 경계를 긋는다.
//   · 「쓰기(경계) 이후에 시작된 읽기」만 공유한다 — 쓰기 직후 재읽기가 그 전에 시작된 옛 읽기 결과를 받지 않게.
//   · 세대 검사(계정 전환 · 로그아웃 invalidate, 후착 응답 버림)는 그대로다. invalidate는 진행 중 읽기도 공유 대상에서 뺀다.
//
// 경쟁 순서 표(아래 각 it):
//   세션 확인 먼저   getSession → 읽기 A 시작 → INITIAL_SESSION → A에 합류              → 요청 1 · 적용 1
//   알림 먼저        INITIAL_SESSION → A 시작 → getSession → A에 합류                 → 요청 1 · 적용 1
//   쓰기 중          A 진행 중 → 쓰기 뒤 refresh(공유 아님) → B 새로 → 이후 알림은 B에 합류 → 요청 2 · B만 적용
//   로그아웃 중      A 진행 중 → invalidate → (같은 계정 알림이 와도) A에 합류하지 않음      → A 버림
//   계정 전환 중     A(계정1) 진행 중 → 계정2 · invalidate → 계정2 알림 → 새로 읽기        → 계정1 결과 버림
import { describe, expect, it, vi } from 'vitest';
import { createProfileReadOnlyRefresh } from '../learningActivity';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const row = (id, streak = 6) => ({ id, streak_count: streak });
function harness(actor = 'A') {
  const state = { actor }, pending = [], apply = vi.fn();
  const read = vi.fn(() => { const d = deferred(); pending.push(d); return d.promise; });
  const reader = createProfileReadOnlyRefresh({ getActor: () => state.actor, read, onProfile: apply });
  return { state, pending, apply, read, reader };
}

describe('PROFILE-READ-SHARE-001 — 같은 계정의 진행 중 읽기 공유(세션 경로만)', () => {
  it('세션 확인 먼저: 세션 읽기 진행 중에 온 알림 읽기는 합류한다 — 요청 1 · 적용 1 · 둘 다 같은 결과', async () => {
    const { pending, apply, read, reader } = harness();
    const session = reader.refresh('A', { share: true });
    const notice = reader.refresh('A', { share: true });
    expect(read).toHaveBeenCalledTimes(1);
    pending[0].resolve({ data: row('A') });
    expect(await session).toEqual(row('A'));
    expect(await notice).toEqual(row('A'));
    expect(apply).toHaveBeenCalledExactlyOnceWith(row('A'), 'A');
  });

  it('알림 먼저: 알림 읽기 진행 중에 끝난 세션 확인도 합류한다(순서가 바뀌어도 요청 1)', async () => {
    const { pending, apply, read, reader } = harness();
    const notice = reader.refresh('A', { share: true });
    await Promise.resolve();
    const session = reader.refresh('A', { share: true });
    expect(read).toHaveBeenCalledTimes(1);
    pending[0].resolve({ data: row('A') });
    expect([await notice, await session]).toEqual([row('A'), row('A')]);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('쓰기 중: 쓰기 뒤 refresh(공유 아님)는 진행 중 옛 읽기에 합류하지 않고 새로 읽는다 — 옛 결과는 버리고 새 결과만 적용', async () => {
    const { pending, apply, read, reader } = harness();
    const before = reader.refresh('A', { share: true });
    const afterWrite = reader.refresh('A');
    expect(read).toHaveBeenCalledTimes(2);
    pending[1].resolve({ data: row('A', 7) });
    expect(await afterWrite).toEqual(row('A', 7));
    pending[0].resolve({ data: row('A', 6) });
    expect(await before).toBeNull();
    expect(apply).toHaveBeenCalledExactlyOnceWith(row('A', 7), 'A');
  });

  it('쓰기 뒤에 시작된 읽기에는 이후 알림이 합류한다(경계 뒤 읽기만 공유)', async () => {
    const { pending, read, reader } = harness();
    reader.refresh('A', { share: true });
    const afterWrite = reader.refresh('A');
    const notice = reader.refresh('A', { share: true });
    expect(read).toHaveBeenCalledTimes(2);
    pending[1].resolve({ data: row('A', 7) });
    expect(await notice).toEqual(row('A', 7));
    expect(await afterWrite).toEqual(row('A', 7));
  });

  it('쓰기 뒤 refresh끼리는 공유하지 않는다 — 둘째 쓰기의 재읽기가 첫째 쓰기 직후 읽기를 받지 않게', () => {
    const { read, reader } = harness();
    reader.refresh('A'); reader.refresh('A');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('로그아웃 중: invalidate된 진행 중 읽기에는 합류하지 않고, 그 결과도 적용하지 않는다', async () => {
    const { state, pending, apply, read, reader } = harness();
    const old = reader.refresh('A', { share: true });
    state.actor = null; reader.invalidate();
    expect(await reader.refresh('A', { share: true })).toBeNull(); // 계정이 없으니 읽지도 않는다
    state.actor = 'A';
    const again = reader.refresh('A', { share: true });              // 같은 계정으로 다시 들어와도 버린 읽기에 붙지 않는다
    expect(read).toHaveBeenCalledTimes(2);
    pending[0].resolve({ data: row('A', 1) });
    expect(await old).toBeNull();
    pending[1].resolve({ data: row('A', 8) });
    expect(await again).toEqual(row('A', 8));
    expect(apply).toHaveBeenCalledExactlyOnceWith(row('A', 8), 'A');
  });

  it('계정 전환 중: 다른 계정의 진행 중 읽기에는 합류하지 않는다 — 옛 계정 결과 버림', async () => {
    const { state, pending, apply, read, reader } = harness();
    const a = reader.refresh('A', { share: true });
    state.actor = 'B'; reader.invalidate();
    const b = reader.refresh('B', { share: true });
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls.map(([id]) => id)).toEqual(['A', 'B']);
    pending[0].resolve({ data: row('A') }); pending[1].resolve({ data: row('B') });
    expect(await a).toBeNull(); expect(await b).toEqual(row('B'));
    expect(apply).toHaveBeenCalledExactlyOnceWith(row('B'), 'B');
  });

  it('다른 계정 요청은 진행 중 읽기에 합류하지 않는다 — invalidate가 늦어도(계정 비교가 따로 막는다)', async () => {
    const { state, pending, read, reader } = harness();
    reader.refresh('A', { share: true });
    state.actor = 'B';
    const b = reader.refresh('B', { share: true });
    expect(read.mock.calls.map(([id]) => id)).toEqual(['A', 'B']);
    pending[1].resolve({ data: row('B') });
    expect(await b).toEqual(row('B'));
  });

  it('실패한 읽기는 남기지 않는다 — 다음 세션 읽기는 새로 보낸다(오류는 합류한 쪽에도 그대로)', async () => {
    const { pending, read, reader } = harness();
    const first = reader.refresh('A', { share: true }), joined = reader.refresh('A', { share: true });
    pending[0].resolve({ error: new Error('offline') });
    await expect(first).rejects.toThrow('offline');
    await expect(joined).rejects.toThrow('offline');
    reader.refresh('A', { share: true });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('끝난 읽기는 공유하지 않는다 — 진행 중일 때만(나중 알림은 새로 읽는다)', async () => {
    const { pending, read, reader } = harness();
    const first = reader.refresh('A', { share: true });
    pending[0].resolve({ data: row('A') }); await first;
    reader.refresh('A', { share: true });
    expect(read).toHaveBeenCalledTimes(2);
  });
});
