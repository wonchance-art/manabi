import { describe, it, expect, vi } from 'vitest';

// P2-4: 저장 중 재진입이 "저장 성공"으로 오인되는 구멍을 막는 통과 저장 게이트(createPassGate).
// readingProgress → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { createPassGate } = await import('../readingProgress');

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const flush = () => new Promise((r) => setTimeout(r, 0)); // 마이크로태스크 완전 배수

describe('createPassGate — 진행 중 Promise 재사용(P2-4)', () => {
  it('같은 노드 재진입은 진행 중 Promise 를 반환하고 task 는 정확히 1회만 실행된다', async () => {
    const gate = createPassGate();
    const d = deferred();
    const task = vi.fn(() => d.promise);

    const p1 = gate.run('node-1', task);
    const p2 = gate.run('node-1', task); // 저장 중 재진입(빠른 이중 클릭·이탈 후 재완료)
    expect(p2).toBe(p1);                  // 같은 진행 중 Promise — 새 저장을 걸지 않는다
    expect(gate.isInFlight('node-1')).toBe(true);

    d.resolve('ok');
    // 재진입 호출부도 undefined 가 아니라 **실제 저장 결과**를 await 한다(성공 오인 없음)
    expect(await p1).toBe('ok');
    expect(await p2).toBe('ok');
    expect(task).toHaveBeenCalledTimes(1); // 기록·이벤트는 정확히 1회
  });

  it('저장 완료(settle) 후 in-flight 에서 해제된다 — 다음 저장을 허용', async () => {
    const gate = createPassGate();
    const p = gate.run('n', () => Promise.resolve('done'));
    expect(gate.isInFlight('n')).toBe(true);
    await p;
    await flush();
    expect(gate.isInFlight('n')).toBe(false);
  });

  it('첫 저장 실패 후 같은 노드 재시도는 새 task 를 실행한다(재-push 경로 생존)', async () => {
    const gate = createPassGate();
    const task1 = vi.fn(() => Promise.reject(new Error('boom')));
    await expect(gate.run('n', task1)).rejects.toThrow('boom'); // 실패는 호출부로 전파
    await flush();
    expect(gate.isInFlight('n')).toBe(false); // 실패도 해제 — 재시도 가능

    const task2 = vi.fn(() => Promise.resolve('recovered'));
    expect(await gate.run('n', task2)).toBe('recovered'); // 재시도가 실제로 실행됨
    expect(task1).toHaveBeenCalledTimes(1);
    expect(task2).toHaveBeenCalledTimes(1);
  });

  it('서로 다른 노드는 직렬화 — 앞선 저장이 끝나야 다음 저장이 시작된다(경합 유실 방지)', async () => {
    const gate = createPassGate();
    const dA = deferred();
    const taskA = vi.fn(() => dA.promise);
    const taskB = vi.fn(() => Promise.resolve('B'));

    const pA = gate.run('A', taskA);
    const pB = gate.run('B', taskB);
    await flush();
    expect(taskA).toHaveBeenCalledTimes(1);
    expect(taskB).not.toHaveBeenCalled(); // A 완료 전엔 B 대기(직렬 체인)

    dA.resolve('A');
    expect(await pA).toBe('A');
    expect(await pB).toBe('B');
    expect(taskB).toHaveBeenCalledTimes(1);
  });

  it('한 노드 실패가 체인을 끊지 않는다 — 뒤따르는 다른 노드 저장은 계속 진행', async () => {
    const gate = createPassGate();
    const pA = gate.run('A', () => Promise.reject(new Error('A-fail')));
    const pB = gate.run('B', () => Promise.resolve('B-ok'));
    await expect(pA).rejects.toThrow('A-fail');
    expect(await pB).toBe('B-ok'); // 앞 저장 실패에도 다음 저장은 살아남는다
  });
});
