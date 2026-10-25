// GUEST-STATIC-001 6단계 · FIELD-AUDIT F5 — 추천 읽을거리 한 편(/suggestions/[id])은 본문을 첫 HTML에 싣는 ISR 판이다.
// 이 파일이 지키는 것:
//  ① 판을 만드는 동안 쿠키 · 요청 헤더를 한 번도 읽지 않는다(읽으면 즉시 실패하는 대역으로 실제 서버 조회를 부른다) — 공유 캐시 판은 누구에게나 같은 바이트.
//  ② 서버가 읽은 행은 리더 쿼리의 첫 값(initialData)이다 — 브라우저가 다시 받지 않고 첫 그림이 그대로 남는다.
//  ③ 없는 글 · 조회 실패 · 시간 초과는 아무것도 싣지 않는다 → 브라우저가 예전처럼 받는다(안내 · 다시 시도 그대로).
//  ④ 서버 HTML에 본문이 있고, 서재 담기 칸은 「확인 중」(계정 판정은 브라우저 몫) — 계정 데이터 없음.
//  ⑤ ?from= 갈래는 middleware가 판 경로로 고른다(쿠키 · 계정으로 가르지 않는다). 리더는 searchParams를 읽지 않는다(읽으면 정적 판이 통째로 브라우저 그리기로 밀린다).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextRequest } from 'next/server';

const { state, createClient, createServerClient } = vi.hoisted(() => {
  const state = { suggestion: null, fail: false, hang: false, options: null };
  const createClient = vi.fn((_url, _key, options) => {
    state.options = options;
    const chain = {
      select() { return chain; }, eq() { return chain; }, in() { return chain; },
      async maybeSingle() {
        if (state.hang) return new Promise(() => {});
        if (state.fail) return { data: null, error: { message: 'down' } };
        return { data: state.suggestion, error: null };
      },
      then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
    };
    return { from: () => chain };
  });
  const createServerClient = vi.fn(() => { throw new Error('추천 갈래에서 Supabase 클라이언트를 만들었다'); });
  return { state, createClient, createServerClient };
});
vi.mock('@supabase/supabase-js', () => ({ createClient }));
vi.mock('@supabase/ssr', () => ({ createServerClient }));
vi.mock('next/headers', () => ({
  cookies: () => { throw new Error('cookies() read in a shared-cache page'); },
  headers: () => { throw new Error('headers() read in a shared-cache page'); },
  draftMode: () => { throw new Error('draftMode() read in a shared-cache page'); },
}));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: null, loading: true }) }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => { throw new Error('리더가 searchParams를 읽었다'); },
}));

import { prefetchSuggestion } from '@/lib/server/suggestionReading';
import SuggestionStaticPage from '@/components/materials/SuggestionStaticPage';
import * as basePage from '@/app/(app)/suggestions/[id]/page';
import * as fromHome from '@/app/(app)/suggestions/[id]/from/home/page';
import * as fromDiscover from '@/app/(app)/suggestions/[id]/from/discover/page';
import * as fromReading from '@/app/(app)/suggestions/[id]/from/reading/page';
import { config, middleware } from '@/middleware';
import { STATIC_ROUTES } from '@/lib/staticRoutes';
import { SUGGESTION_BACK } from '@/lib/suggestionBack';
import { isFocusedReadingRoute, navigationOwner } from '@/lib/webNavigation';

const ID = '5f5e2e00-0000-4000-8000-00000000f5f5';
const ROW = { id: ID, date: '2026-10-23', language: 'Japanese', source: 'rss_e2e', video_id: 'rss_e2e_1', title: '駅前の小さな図書館', channel_name: 'e2e', level: 'N4',
  transcript: '駅前に小さな図書館があります。\n\n毎朝十五分だけ読みます。', material_id: null };
const read = (f) => fs.readFileSync(f, 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

// 서버 부품(async — 판 page · SuggestionStaticPage)은 RSC가 푸는 자리다. 여기서는 그 사슬을 직접 풀고 나머지(브라우저 부품의 서버 그리기)를 renderToString에 맡긴다.
async function resolveServer(node) {
  let el = await node;
  while (el && typeof el.type === 'function' && el.type.constructor.name === 'AsyncFunction') el = await el.type(el.props);
  return el;
}
async function html(element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToString(<QueryClientProvider client={client}>{await resolveServer(element)}</QueryClientProvider>);
}

beforeEach(() => { state.suggestion = { ...ROW }; state.fail = false; state.hang = false; state.options = null; });

describe('서버 조회(prefetchSuggestion) — 공개 행만, 쿠키 없이', () => {
  it('찾은 글과 조회 시각을 돌려준다 · anon 클라이언트는 세션을 저장 · 갱신하지 않는다 · 리더는 그것을 첫 값으로 쓴다', async () => {
    const before = Date.now();
    const found = await prefetchSuggestion(ID);
    expect(found.data).toMatchObject({ id: ID, title: ROW.title, transcript: ROW.transcript });
    expect(found.at).toBeGreaterThanOrEqual(before);
    expect(state.options?.auth).toEqual(expect.objectContaining({ persistSession: false, autoRefreshToken: false }));
    expect(read('src/components/materials/SuggestionReader.jsx')).toContain('...(initial ? { initialData: initial, initialDataUpdatedAt: initialAt } : {})');
  });
  it('판에 HydrationBoundary를 들이지 않는다(묶음이 갈려 산책 첫 JS가 늘었다)', () => {
    expect(code('src/components/materials/SuggestionStaticPage.jsx')).not.toMatch(/HydrationBoundary|dehydrate/);
  });
  it('없는 글 · 잘못된 id · 조회 실패 · 시간 초과는 null(브라우저가 예전처럼 받는다)', async () => {
    state.suggestion = null;
    expect(await prefetchSuggestion(ID)).toBeNull();
    expect(await prefetchSuggestion('not-a-uuid')).toBeNull();
    state.suggestion = { ...ROW }; state.fail = true;
    expect(await prefetchSuggestion(ID)).toBeNull();
    state.fail = false; state.hang = true;
    expect(await prefetchSuggestion(ID, { budgetMs: 20 })).toBeNull();
  });
});

describe('판 HTML — 본문은 첫 HTML에, 계정 칸은 브라우저 몫', () => {
  it('본문 · 제목 · 돌아갈 곳이 서버 HTML에 있고, 서재 칸은 「확인 중」(계정 판정 전)', async () => {
    const out = await html(fromReading.default({ params: Promise.resolve({ id: ID }) }));
    expect(out).toContain('駅前の小さな図書館');
    expect(out).toContain('<p>駅前に小さな図書館があります。</p>');
    expect(out).toContain('<p>毎朝十五分だけ読みます。</p>');
    expect(out).toContain('← 함께 읽는 글');
    expect(out).toContain('서재 확인 중…');
    expect(out).not.toContain('읽을거리를 펼치고 있어요');
    expect(out).not.toMatch(/로그인하고 서재에 담기|내 서재에 담기/);
  });
  it('기본 판은 서재로 돌아간다 · 없는 글은 예전처럼 브라우저가 받는 자리(「펼치고 있어요」)', async () => {
    expect(await html(basePage.default({ params: Promise.resolve({ id: ID }) }))).toContain('← 내 서재로');
    state.suggestion = null;
    const missing = await html(SuggestionStaticPage({ id: ID, from: 'home' }));
    expect(missing).toContain('읽을거리를 펼치고 있어요…');
    expect(missing).toContain('← 오늘로');
  });
  it('돌아갈 곳 판 = 서재 밖 값마다 고정 폴더 하나(표 밖 값은 라우트가 없어 예전처럼 404) · 판마다 제 돌아갈 곳', async () => {
    const pages = { home: fromHome, discover: fromDiscover, reading: fromReading };
    expect(Object.keys(pages).sort()).toEqual(Object.keys(SUGGESTION_BACK).filter(k => k !== 'materials').sort());
    expect(fs.existsSync('src/app/(app)/suggestions/[id]/from/materials')).toBe(false);
    for (const dir of fs.readdirSync('src/app/(app)/suggestions/[id]/from')) expect(Object.keys(pages), dir).toContain(dir);
    for (const [from, page] of Object.entries(pages)) expect(await html(page.default({ params: Promise.resolve({ id: ID }) })), from).toContain(SUGGESTION_BACK[from].label);
  });
  it('판 경로(서버가 그리는 pathname)와 주소창(브라우저)이 같은 머리말을 고른다 — 집중 화면 · 메뉴 불(어긋나면 하이드레이션 불일치)', () => {
    for (const from of ['home', 'discover', 'reading']) {
      expect(isFocusedReadingRoute(`/suggestions/${ID}/from/${from}`), from).toBe(isFocusedReadingRoute(`/suggestions/${ID}`));
      expect(navigationOwner(`/suggestions/${ID}/from/${from}`), from).toBe(navigationOwner(`/suggestions/${ID}`));
    }
    expect(isFocusedReadingRoute(`/suggestions/${ID}`)).toBe(true);
    for (const path of [`/suggestions/${ID}/from/materials`, `/suggestions/${ID}/from/zzz`, `/suggestions/${ID}/edit`]) expect(isFocusedReadingRoute(path), path).toBe(false);
  });
  it('네 판은 ISR 300 · 빌드 때 굽지 않는다(첫 방문에 굽는다) · 정적 경로 표에 있다', () => {
    for (const page of [basePage, fromHome, fromDiscover, fromReading]) {
      expect(page.revalidate).toBe(300);
      expect(page.dynamicParams).toBe(true);
      expect(page.generateStaticParams()).toEqual([]);
    }
    expect(STATIC_ROUTES).toEqual(expect.arrayContaining([
      { route: '/suggestions/[id]', revalidate: 300, onDemand: true },
      ...['home', 'discover', 'reading'].map(from => ({ route: `/suggestions/[id]/from/${from}`, revalidate: 300, onDemand: true }))]));
  });
  it('리더는 searchParams를 읽지 않는다 — 돌아갈 곳은 판(서버)이 넘긴다 · 옛 서재 주소(?suggestion=)도 from을 넘긴다', () => {
    expect(code('src/components/materials/SuggestionReader.jsx')).not.toMatch(/useSearchParams|searchParams/);
    expect(read('src/components/materials/MaterialEntry.jsx')).toContain("from={params.get('from')}");
  });
});

describe('돌아갈 곳 갈래(middleware) — ?from=으로만 가른다', () => {
  const run = (url, cookie) => middleware(new NextRequest(new URL(url, 'https://manabi.test'), { headers: cookie ? { cookie } : {} }));
  const rewrite = (res) => { const to = res.headers.get('x-middleware-rewrite'); return to ? new URL(to).pathname + new URL(to).search : null; };
  it('home · discover · reading은 판 경로로(쿼리는 비운다) — 손님 · 로그인 같은 판', async () => {
    for (const cookie of [undefined, 'sb-e2e-auth-token=base64-x']) {
      expect(rewrite(await run(`/suggestions/${ID}?from=home`, cookie))).toBe(`/suggestions/${ID}/from/home`);
      expect(rewrite(await run(`/suggestions/${ID}?from=discover&utm=x`, cookie))).toBe(`/suggestions/${ID}/from/discover`);
      expect(rewrite(await run(`/suggestions/${ID}?from=reading`, cookie))).toBe(`/suggestions/${ID}/from/reading`);
    }
  });
  it('from 없음 · materials · 목록 밖 값은 기본 판(서재로) — 쿠키를 쓰지 않고 Supabase 클라이언트를 만들지 않는다', async () => {
    for (const url of [`/suggestions/${ID}`, `/suggestions/${ID}?from=materials`, `/suggestions/${ID}?from=constructor`, `/suggestions/${ID}?from=`]) {
      const res = await run(url, 'sb-e2e-auth-token=base64-x');
      expect(rewrite(res), url).toBeNull();
      expect(res.headers.get('x-middleware-next'), url).toBe('1');
      expect(res.headers.get('set-cookie'), url).toBeNull();
    }
    expect(createServerClient).not.toHaveBeenCalled();
  });
  it('matcher는 한 단계 주소만 — 판 경로(/from/*)는 밖(rewrite된 요청이 다시 지나도 되돌리지 않게)', () => {
    expect(config.matcher).toContain('/suggestions/:id');
    expect(config.matcher.filter(p => p.startsWith('/suggestions/') && p !== '/suggestions/:id')).toEqual([]);
  });
  it('middleware는 무거운 추천 모듈 대신 돌아갈 곳 표(suggestionBack)만 가져온다', () => {
    expect(read('src/middleware.js')).toContain("from './lib/suggestionBack'");
    expect(read('src/middleware.js')).not.toContain("from './lib/suggestionReading'");
  });
});
