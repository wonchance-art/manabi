import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserClient } from '@supabase/ssr';

// SUPA-SSR-0127 — postgrest-js 2.102부터 GET 조회는 네트워크 오류에 1 · 2 · 4초 백오프로 3번 더 묻는다(기본 켜짐).
// 이 앱의 오프라인 폴백(뷰어 · 서재 · 복습이 조회 실패를 받으면 기기 캐시를 읽는다)은 실패를 바로 받아야 한다 — 재시도가 켜지면
// 끊긴 Supabase에서 오류 · 폴백이 7초 넘게 늦는다(e2e account-boundary ⑥ 실측: 15초 안에 「자료를 불러오지 못했어요」가 안 나왔다).
// 계약: 앱의 브라우저 클라이언트는 판 올림 전(2.100)처럼 한 번만 묻고 바로 오류를 돌려준다. 대조: SDK 기본값은 재시도한다.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://e2e.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'e2e-anon-key';
});

function offlineFetch() {
  const calls = [];
  vi.stubGlobal('fetch', async (url, init) => {
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError'); // 실제 fetch처럼 끊긴 요청은 보내지 않는다
    calls.push(new URL(String(url)).pathname);
    throw new TypeError('Failed to fetch');
  });
  return calls;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('브라우저 클라이언트 — 끊긴 Supabase 조회는 재시도 없이 바로 실패', () => {
  it('앱 클라이언트(src/lib/supabaseClient): GET 한 번 · 바로 { error }', async () => {
    const calls = offlineFetch();
    const { supabase } = await import('../supabaseClient');
    const started = Date.now();
    const { data, error } = await supabase.from('materials').select('id').limit(1);
    expect(data).toBeNull();
    expect(error).toBeTruthy();
    expect(calls).toEqual(['/rest/v1/materials']);
    expect(Date.now() - started).toBeLessThan(900); // 첫 백오프(1초)를 기다리지 않았다
  });

  it('대조: SDK 기본값(재시도 켜짐)은 같은 실패에 더 묻는다 — 이 차이를 막는 것이 위 옵션이다', async () => {
    const calls = offlineFetch();
    const client = createBrowserClient('https://e2e.supabase.co', 'e2e-anon-key', { isSingleton: false });
    const stop = new AbortController();
    // 빌더는 then이 불려야 요청을 보낸다.
    const pending = client.from('materials').select('id').limit(1).abortSignal(stop.signal).then(() => {}, () => {});
    await vi.waitFor(() => expect(calls.length).toBe(2), { timeout: 3000, interval: 50 }); // 1초 백오프 뒤 두 번째 요청
    stop.abort(); // 남은 백오프(2 · 4초)를 기다리지 않게 끊는다
    await pending;
    expect(calls).toEqual(['/rest/v1/materials', '/rest/v1/materials']);
  });
});
