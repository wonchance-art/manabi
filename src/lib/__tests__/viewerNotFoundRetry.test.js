// 볼 수 없는 · 없는 자료를 로그인한 채 열면 「자료 불러오는 중…」에서 끝나지 않고 약 2초마다 자료를 다시 받던 결함(로그인 감사 2026-10-25 KST 실측).
// 원인: NOT_FOUND → 다시 받기 → (데이터가 한 번도 없으면) 받는 동안 오류가 비워짐 → 다시 NOT_FOUND → 효과가 또 다시 받기.
// 고침: 그 자료 · 그 계정으로 한 번만 다시 받고(손님 때 숨겨진 책 장 → 로그인 · 복원 직후 RLS 대비), 그 뒤에는 「자료를 찾을 수 없어요」.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/query-core';

vi.mock('../supabase', () => ({ supabase: {} }));
const { notFoundRetryKey } = await import('../viewerMaterial');
const ROOT = path.resolve(__dirname, '../../..');

const notFound = () => Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });

// ViewerPage의 효과를 그대로 흉내 낸다 — 관찰 결과가 바뀔 때마다(렌더마다) 같은 판정.
function mount({ fetches, userId = 'A', id = '59001', retryKey = notFoundRetryKey }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const observer = new QueryObserver(client, { queryKey: ['material', id], queryFn: async () => { fetches.n++; throw notFound(); } });
  const retried = { current: null };
  const states = [];
  const stop = observer.subscribe((result) => {
    states.push(result.status);
    const key = retryKey(id, userId, result.error?.code);
    if (!key || retried.current === key) return;
    retried.current = key;
    result.refetch();
  });
  return { observer, states, stop: () => { stop(); observer.destroy(); client.clear(); } };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('뷰어 NOT_FOUND 다시 받기 — 한 번만', () => {
  it('로그인한 계정: 처음 1번 + 다시 1번에서 멈추고 오류(→ 「자료를 찾을 수 없어요」)로 남는다', async () => {
    const fetches = { n: 0 };
    const { observer, stop } = mount({ fetches });
    await settle(); await settle();
    expect(fetches.n).toBe(2);
    expect(observer.getCurrentResult().status).toBe('error');
    expect(observer.getCurrentResult().error.code).toBe('NOT_FOUND');
    await settle();
    expect(fetches.n).toBe(2);
    stop();
  });
  it('열쇠는 자료 · 계정마다 — 손님은 다시 받지 않고(책 장 안내가 맡는다), 로그인하면 그 계정으로 한 번', () => {
    expect(notFoundRetryKey('5', null, 'NOT_FOUND')).toBe(null);
    expect(notFoundRetryKey('5', 'A', 'FETCH')).toBe(null);
    expect(notFoundRetryKey('5', 'A', 'NOT_FOUND')).toBe('5:A');
    expect(notFoundRetryKey('5', 'B', 'NOT_FOUND')).toBe('5:B');
    expect(notFoundRetryKey('6', 'A', 'NOT_FOUND')).toBe('6:A');
  });
  it('그 뒤 안내는 기존 「자료를 찾을 수 없어요」 + 서재로 돌아가기(문구 새로 만들지 않음)', () => {
    const viewer = fs.readFileSync(path.join(ROOT, 'src/views/ViewerPage.jsx'), 'utf8');
    expect(viewer).toContain("{isNotFound ? '자료를 찾을 수 없어요' : '자료를 불러오지 못했어요'}");
    expect(viewer).toContain('if (!key || notFoundRetried.current === key) return;');
  });
});
