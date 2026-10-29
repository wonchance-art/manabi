import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ROUTE-AUDIT-2 F1 (2026-10-25 KST) — 옛 학습 대시보드 주소 /learn → /lessons를 페이지가 아니라 middleware(엣지)에서 보낸다.
// /learn/page.jsx는 redirect()뿐인 정적 판이라, e2e 빌드에서 307이 아니라 200 HTML(22 kB) + <meta http-equiv="refresh" content="1;url=/lessons">로
// 나갔다(x-nextjs-cache HIT). 브라우저는 앱 JS를 받아 하이드레이션한 뒤에야 클라이언트에서 옮겼다. 옮겨도 목적지는 같다 — page.jsx의
// redirect('/lessons')처럼 질의를 버리고 /lessons로 간다(/learn/course와 같은 줄). 세션은 읽지 않는다.
const { createServerClientMock } = vi.hoisted(() => ({ createServerClientMock: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: createServerClientMock }));

import { config, middleware } from '../../middleware';
import LearnPage from '../../app/(app)/learn/page';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

// page.jsx가 내는 목적지(redirect 예외의 digest: NEXT_REDIRECT;replace;<위치>;307;)
function pageTarget() {
  try { LearnPage(); } catch (error) { return String(error.digest).split(';')[2]; }
  throw new Error('learn/page.jsx did not redirect');
}

describe('/learn 리다이렉트 — 엣지로 옮겨도 목적지는 page.jsx와 같다', () => {
  it('matcher가 /learn을 정확히 받는다(/learn/* 전체가 아니라 두 주소만)', () => {
    expect(config.matcher).toContain('/learn');
    expect(config.matcher).toContain('/learn/course');
    expect(config.matcher.filter((m) => m.startsWith('/learn/') && m !== '/learn/course')).toEqual([]);
  });

  it.each(['/learn', '/learn?tab=vocab&utm_source=x'])('%s → 307 /lessons (질의 버림 — page.jsx와 같다)', async (input) => {
    const response = await middleware(new NextRequest(`https://example.test${input}`));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location'));
    expect(location.pathname + location.search).toBe(pageTarget());
    expect(pageTarget()).toBe('/lessons');
  });

  it('/learn/course도 그대로 /lessons(기존 줄 보존)', async () => {
    const response = await middleware(new NextRequest('https://example.test/learn/course?track=ja&level=N5'));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')).pathname + new URL(response.headers.get('location')).search).toBe('/lessons');
  });

  it('세션을 읽지 않는다 — 로그인 여부로 갈리지 않는다', async () => {
    createServerClientMock.mockReset();
    await middleware(new NextRequest('https://example.test/learn'));
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('/learn/* 아래 다른 화면은 middleware가 손대지 않는다(matcher 밖) — page.jsx 대체 경로는 남긴다', () => {
    expect(read('src/app/(app)/learn/page.jsx')).toContain("redirect('/lessons')");
  });
});
