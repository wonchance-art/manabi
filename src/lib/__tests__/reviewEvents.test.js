import { describe, it, expect, vi } from 'vitest';

// reviewEvents → supabase.js가 모듈 로드 시 env를 요구하므로, 스텁 후 동적 import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { createReviewEventBatcher, sendReviewEventsOnHide } = await import('../reviewEvents');

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

// 로그인 감사 2026-10-25 KST §5-2 — /study 탭을 닫을 때 남은 0–3개가 supabase-js 보통 요청(keepalive 아님)으로 나가 사라질 수 있었다.
describe('sendReviewEventsOnHide — 닫히는 탭의 남은 묶음', () => {
  const transport = fetchImpl => ({ url: 'https://x.supabase.co', apiKey: 'anon', fetchImpl });
  const assist = { lang: 'Japanese', source: 'assist', item_key: '猫', correct: false, detail: { qtype: 'assist' } };
  const produce = { lang: 'Japanese', source: 'vocab', item_key: '犬', correct: true, detail: { qtype: 'produce' } };
  it('drain은 남은 이벤트를 꺼내고 비운다(보내지 않는다)', () => {
    const flush = vi.fn(), b = createReviewEventBatcher('u1', { flush });
    b.add(EV(1)); b.add(EV(2));
    expect(b.drain()).toEqual([EV(1), EV(2)]);
    expect(b.size).toBe(0); b.flush(); expect(flush).not.toHaveBeenCalled();
  });
  it('경계 확인이 필요 없는 행은 keepalive POST 한 번(같은 행 모양 · 세션 토큰), 어휘 행은 지금처럼 보통 전송(경계 확인을 건너뛰지 않는다)', () => {
    const fetchImpl = vi.fn(async () => ({ ok: true })), send = vi.fn();
    expect(sendReviewEventsOnHide('u1', [assist, produce, null], { accessToken: 'tok', send, ...transport(fetchImpl) })).toEqual({ keepalive: 1, regular: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [href, init] = fetchImpl.mock.calls[0];
    expect(href).toBe('https://x.supabase.co/rest/v1/review_events');
    expect(init).toMatchObject({ method: 'POST', keepalive: true, headers: { Authorization: 'Bearer tok', Prefer: 'return=minimal' } });
    expect(JSON.parse(init.body)).toEqual([{ user_id: 'u1', lang: 'Japanese', source: 'assist', item_key: '猫', correct: false, detail: { qtype: 'assist' } }]);
    expect(send).toHaveBeenCalledWith('u1', [produce]);
  });
  it('토큰이 없으면(다른 계정 · 아직 못 받음) 전부 지금처럼 보통 전송 — keepalive 없음', () => {
    const fetchImpl = vi.fn(), send = vi.fn();
    expect(sendReviewEventsOnHide('u1', [assist], { accessToken: null, send, ...transport(fetchImpl) })).toEqual({ keepalive: 0, regular: 1 });
    expect(fetchImpl).not.toHaveBeenCalled(); expect(send).toHaveBeenCalledWith('u1', [assist]);
  });
  it('keepalive가 실패해도 같은 행을 다시 보내지 않는다(중복 행 방지) · 빈 묶음은 아무것도 안 한다', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('offline'); }), send = vi.fn();
    sendReviewEventsOnHide('u1', [assist], { accessToken: 'tok', send, ...transport(fetchImpl) });
    await Promise.resolve(); await Promise.resolve();
    expect(send).not.toHaveBeenCalled();
    expect(sendReviewEventsOnHide('u1', [], { accessToken: 'tok', send })).toEqual({ keepalive: 0, regular: 0 });
  });
});
