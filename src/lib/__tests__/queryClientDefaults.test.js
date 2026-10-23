import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MutationObserver, QueryClient, onlineManager } from '@tanstack/react-query';
import { QUERY_CLIENT_DEFAULTS } from '../queryClientDefaults';

// OFFLINE-SWEEP-001 — 끊긴 동안 쓰기가 「멈춤」으로 남지 않는다. 멈추면 정본의 기기 보관함(reviewOutbox) · 실패 알림 · 되돌리기가
// 돌지 않아 뷰어 복습이 「저장 중…」에 갇히고(보관함 0건), 닫으면 채점 · 아는 단어가 사라졌다(390 실측 2026-10-23 KST).
function run(client, mutationFn) {
  const observer = new MutationObserver(client, { mutationFn });
  const settled = observer.mutate().then(value => ({ value }), error => ({ error }));
  return { observer, settled };
}

describe('QueryClient 기본값 — 끊김에서의 쓰기', () => {
  afterEach(() => { onlineManager.setOnline(true); });

  it('끊긴 동안에도 쓰기를 바로 시도한다 — 보관함에 담는 쓰기는 그 자리에서 끝난다', async () => {
    onlineManager.setOnline(false);
    const client = new QueryClient({ defaultOptions: QUERY_CLIENT_DEFAULTS });
    const queue = vi.fn(async () => ({ ok: true, queued: true }));
    const { observer, settled } = run(client, queue);
    expect(await settled).toEqual({ value: { ok: true, queued: true } });
    expect(queue).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().isPaused).toBe(false);
  });

  it('끊긴 동안 실패하는 쓰기는 멈추지 않고 실패로 끝난다 — 화면이 알리고 낙관 반영을 되돌릴 수 있다', async () => {
    onlineManager.setOnline(false);
    const client = new QueryClient({ defaultOptions: QUERY_CLIENT_DEFAULTS });
    const write = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const onError = vi.fn();
    const observer = new MutationObserver(client, { mutationFn: write, onError });
    const result = await observer.mutate().then(() => 'resolved', error => error.message);
    expect(result).toBe('Failed to fetch');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().status).toBe('error');
  });

  it('대조: 라이브러리 기본값(online)은 끊기면 mutationFn을 부르지 않고 멈춘다 — 이 기본값이 막는 위험', async () => {
    onlineManager.setOnline(false);
    const client = new QueryClient();
    const write = vi.fn(async () => 'sent');
    const { observer } = run(client, write);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(write).not.toHaveBeenCalled();
    expect(observer.getCurrentResult().isPaused).toBe(true);
  });

  it('조회 기본값은 그대로다(2분 신선 · 재시도 1회)', () => {
    expect(QUERY_CLIENT_DEFAULTS.queries).toEqual({ staleTime: 120000, retry: 1 });
    expect(QUERY_CLIENT_DEFAULTS.queries.networkMode).toBeUndefined();
  });

  it('앱의 QueryClient가 이 기본값을 쓴다(두 번째 기본값을 만들지 않는다)', () => {
    const providers = readFileSync('src/app/providers.jsx', 'utf8');
    expect(providers).toMatch(/new QueryClient\(\{ defaultOptions: QUERY_CLIENT_DEFAULTS \}\)/);
    expect(providers).not.toMatch(/networkMode/);
  });
});
