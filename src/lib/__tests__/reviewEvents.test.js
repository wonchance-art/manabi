import { describe, it, expect, vi } from 'vitest';

// reviewEvents → supabase.js가 모듈 로드 시 env를 요구하므로, 스텁 후 동적 import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { createReviewEventBatcher } = await import('../reviewEvents');

const EV = n => ({ lang: 'Japanese', source: 'vocab', item_key: `w${n}`, correct: true });

describe('createReviewEventBatcher — review_events 마이크로배치', () => {
  it('size개가 쌓이면 자동 flush (기본 4)', () => {
    const flush = vi.fn();
    const b = createReviewEventBatcher('u1', { flush });
    b.add(EV(1)); b.add(EV(2)); b.add(EV(3));
    expect(flush).not.toHaveBeenCalled();
    expect(b.size).toBe(3);
    b.add(EV(4));                              // 4개째 → flush
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith('u1', [EV(1), EV(2), EV(3), EV(4)]);
    expect(b.size).toBe(0);
  });

  it('size 옵션을 존중한다', () => {
    const flush = vi.fn();
    const b = createReviewEventBatcher('u1', { flush, size: 2 });
    b.add(EV(1)); b.add(EV(2));
    expect(flush).toHaveBeenCalledTimes(1);
    b.add(EV(3));
    b.flush();
    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush).toHaveBeenLastCalledWith('u1', [EV(3)]);
  });

  it('flush()는 잔여만 보내고, 비어있으면 아무것도 안 보낸다', () => {
    const flush = vi.fn();
    const b = createReviewEventBatcher('u1', { flush });
    b.add(EV(1));
    b.flush();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith('u1', [EV(1)]);
    b.flush();                                 // 비어있음 → no-op
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('같은 이벤트를 두 번 보내지 않는다 (flush 후 버퍼 비움)', () => {
    const flush = vi.fn();
    const b = createReviewEventBatcher('u1', { flush, size: 2 });
    b.add(EV(1)); b.add(EV(2));                // flush 1: [1,2]
    b.add(EV(3)); b.flush();                   // flush 2: [3]
    const all = flush.mock.calls.flatMap(c => c[1]);
    expect(all).toEqual([EV(1), EV(2), EV(3)]);
  });

  it('falsy 이벤트는 무시한다', () => {
    const flush = vi.fn();
    const b = createReviewEventBatcher('u1', { flush, size: 2 });
    b.add(null); b.add(undefined);
    expect(b.size).toBe(0);
    expect(flush).not.toHaveBeenCalled();
  });
});
