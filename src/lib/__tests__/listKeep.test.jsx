import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InfiniteQueryObserver, QueryClient, QueryObserver } from '@tanstack/react-query';
import { sliceBetween } from './helpers/sliceBetween';
import { keepPreviousForUser } from '../keepPreviousForUser';
import ParagraphTile from '../../components/learn/ParagraphTile';

vi.mock('next/link', () => ({ default: ({ children, prefetch, ...props }) => createElement('a', props, children) }));

// LIST-KEEP(오너 「앱처럼」 2026-10-16) — 조건을 바꾸면 목록이 비었다가 다시 차며 높이가 튀던 문제.
// 서재(폴더 · 즐겨찾기 · 휴지통 · 정렬 · 검색)와 배움(언어 칩 → 오늘 문단)은 새 조건을 받는 동안 같은 계정의
// 이전 결과를 흐리게(aria-busy · opacity .6) 남긴다. 다른 계정 · 로그아웃이면 남기지 않고, 결과 0이면 빈 상태가 정상으로 나온다.
// 같이: /study 채점 ✓ 도장(160ms).
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

/** 손으로 푸는 응답 — 새 조건을 받는 「사이」를 붙잡아 본다. */
function deferredFetcher() {
  const pending = new Map();
  return {
    fn: ({ queryKey }) => new Promise((resolve) => pending.set(JSON.stringify(queryKey), resolve)),
    resolve: async (key, value) => { pending.get(JSON.stringify(key))(value); await new Promise((r) => setTimeout(r, 0)); },
  };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('keepPreviousForUser — 같은 계정의 이전 결과만', () => {
  const prev = ['row'];
  it('이전 키의 [1]이 지금 계정이면 이전 결과, 아니면 undefined', () => {
    expect(keepPreviousForUser('u1')(prev, { queryKey: ['personal-library', 'u1', { scope: 'all' }] })).toBe(prev);
    expect(keepPreviousForUser('u1')(prev, { queryKey: ['personal-library', 'u2', { scope: 'all' }] })).toBeUndefined();
    expect(keepPreviousForUser(undefined)(prev, { queryKey: ['learn-paragraph', undefined, 'Japanese'] })).toBeUndefined();
    expect(keepPreviousForUser('u1')(prev, undefined)).toBeUndefined();
  });
});

describe('React Query v5 실제 동작 — 조건 전환 사이', () => {
  it('같은 계정 · 조건만 바뀜 → 받는 동안 이전 결과 + isPlaceholderData, 받으면 새 결과', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const f = deferredFetcher();
    const options = (lang) => ({ queryKey: ['learn-paragraph', 'u1', lang], queryFn: f.fn, placeholderData: keepPreviousForUser('u1') });
    const observer = new QueryObserver(client, options('Japanese'));
    const unsubscribe = observer.subscribe(() => {});
    await f.resolve(['learn-paragraph', 'u1', 'Japanese'], { lang: 'Japanese', sentence: '駅' });
    expect(observer.getCurrentResult().data).toEqual({ lang: 'Japanese', sentence: '駅' });
    observer.setOptions(options('Chinese'));
    await settle();
    const between = observer.getCurrentResult();
    expect(between.isPlaceholderData).toBe(true);
    expect(between.isPending).toBe(false);
    expect(between.data).toEqual({ lang: 'Japanese', sentence: '駅' });
    await f.resolve(['learn-paragraph', 'u1', 'Chinese'], { lang: 'Chinese', sentence: null });
    expect(observer.getCurrentResult()).toMatchObject({ isPlaceholderData: false, data: { lang: 'Chinese', sentence: null } });
    unsubscribe();
  });

  it('다른 계정으로 바뀜 → 이전 계정 결과를 남기지 않는다(isPending, data 없음)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const f = deferredFetcher();
    const options = (user) => ({ queryKey: ['learn-paragraph', user, 'Japanese'], queryFn: f.fn, placeholderData: keepPreviousForUser(user) });
    const observer = new QueryObserver(client, options('u1'));
    const unsubscribe = observer.subscribe(() => {});
    await f.resolve(['learn-paragraph', 'u1', 'Japanese'], { lang: 'Japanese', sentence: '駅' });
    observer.setOptions(options('u2'));
    await settle();
    expect(observer.getCurrentResult()).toMatchObject({ isPending: true, isPlaceholderData: false, data: undefined });
    unsubscribe();
  });

  it('서재(무한 목록): 폴더 → 휴지통(결과 0) — 받는 동안 이전 목록, 받으면 빈 목록이 정상으로', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const f = deferredFetcher();
    const options = (scope, user = 'u1') => ({ queryKey: ['personal-library', user, { scope }, undefined], queryFn: f.fn, initialPageParam: 0,
      getNextPageParam: () => undefined, placeholderData: keepPreviousForUser(user) });
    const observer = new InfiniteQueryObserver(client, options('all'));
    const unsubscribe = observer.subscribe(() => {});
    const page = { items: [{ id: 1 }, { id: 2 }], total: 2 };
    await f.resolve(['personal-library', 'u1', { scope: 'all' }, undefined], page);
    observer.setOptions(options('trash'));
    await settle();
    expect(observer.getCurrentResult()).toMatchObject({ isPlaceholderData: true, isSuccess: true });
    expect(observer.getCurrentResult().data.pages[0].items).toHaveLength(2);
    await f.resolve(['personal-library', 'u1', { scope: 'trash' }, undefined], { items: [], total: 0 });
    expect(observer.getCurrentResult()).toMatchObject({ isPlaceholderData: false, isSuccess: true });
    expect(observer.getCurrentResult().data.pages[0].items).toEqual([]);
    // 로그아웃 뒤 다른 계정: 남기지 않는다.
    observer.setOptions(options('trash', 'u2'));
    await settle();
    expect(observer.getCurrentResult()).toMatchObject({ isPending: true, data: undefined });
    unsubscribe();
  });
});

describe('서재 — 머리줄은 새 조건, 목록은 흐린 이전 결과, 거짓 빈 상태 · 수 없음', () => {
  const shelf = read('src/components/library/LibraryShelf.jsx');
  it('무한 목록이 같은 계정일 때만 이전 결과를 남긴다(키 [1] = user.id)', () => {
    expect(shelf).toContain("import {keepPreviousForUser} from '@/lib/keepPreviousForUser';");
    // 키 · 가져오기는 서버와 함께 쓰는 정본(libraryShelfQueries — [1] = 계정 id), 이전 결과 남기기는 화면 몫.
    expect(shelf).toContain('const listQuery=libraryListQuery(supabase,user.id,filters,pinned.data)');
    expect(shelf).toContain('useInfiniteQuery({...listQuery,enabled:!filters.pinned||pinned.isSuccess,placeholderData:keepPreviousForUser(user.id)})');
    expect(read('src/lib/libraryShelfQueries.js')).toContain("queryKey: ['personal-library', ownerId, keyFilters, pinnedIds]");
    expect(shelf).toContain('isPlaceholderData:stale}=list;');
  });
  it('흐린 동안: 목록 aria-busy, 수 · 빈 상태 · 더 보기 · 자동 이어 받기는 새 결과를 기다린다', () => {
    expect(shelf).toContain('className="shelf-list-focus" aria-busy={stale||undefined}');
    expect(shelf).toContain("<span className=\"shelf-count\">{list.isSuccess&&!stale?total:''}</span>");
    expect(shelf).toContain('{list.isSuccess&&!stale&&!items.length&&<div className="shelf-empty">');
    expect(shelf).toContain('{list.hasNextPage&&!stale&&<button className="shelf-load-more"');
    expect(shelf).toContain('useEffect(()=>{if(!stale&&items.length<filters.shown&&hasNextPage');
    expect(shelf).toContain('{(list.isPending||(stale&&!items.length))&&<ShelfRowsSkeleton/>}');
    expect(shelf).toContain('disabled={busy||stale}');
  });
  it('머리줄(폴더 이름)은 데이터가 아니라 새 조건에서 바로 그린다', () => {
    const heading = sliceBetween(shelf, '<h2 id="shelf-list-title">', '</h2>');
    expect(heading).toContain("{currentCollection?.path||({trash:'휴지통',favorites:'즐겨찾기',unfiled:'미분류'})[filters.scope]||'전체'}");
  });
});

describe('배움 — 언어 칩 전환 동안 오늘 문단', () => {
  const home = read('src/views/HomePage.jsx');
  it('같은 계정일 때만 남기고, 남긴 문장의 lang은 그 문장의 언어를 따른다', () => {
    expect(home).toContain("queryKey: ['learn-paragraph', user?.id, lang], queryFn: async () => ({ lang, sentence: await fetchPrefetchedSentence(user.id, lang) }),");
    expect(home).toContain('placeholderData: keepPreviousForUser(user?.id)');
    expect(home).toContain("lang={paragraphTileState.kind === 'ready' ? paragraph.data?.lang || lang : lang} busy={paragraph.isPlaceholderData}");
    expect(home).toContain('paragraphState({ sentence: paragraph.data?.sentence, forecastWords })');
  });
  it('ParagraphTile을 그리면 busy일 때만 문단 칸에 aria-busy="true"', () => {
    const state = { kind: 'ready', sentence: '駅前の小さなパン屋' };
    const busy = renderToStaticMarkup(createElement(ParagraphTile, { state, lang: 'Japanese', href: '/study?lang=Chinese', busy: true }));
    const idle = renderToStaticMarkup(createElement(ParagraphTile, { state, lang: 'Japanese', href: '/study?lang=Chinese' }));
    expect(busy).toContain('<span class="learn-paragraph__cycle" aria-busy="true"><span class="learn-paragraph__sentence" lang="ja">');
    expect(idle).not.toContain('aria-busy');
    expect(busy).toContain('href="/study?lang=Chinese"');
  });
});

describe('흐림 · 도장 CSS — 길이 · 곡선 · 모션 축소', () => {
  it('흐림은 opacity .6 · transition var(--transition-fast) · 전용 모션 축소 블록(서재 · 배움)', () => {
    const lib = read('src/components/library/library.css');
    expect(lib).toContain('.shelf-list-focus{transition:opacity var(--transition-fast)}');
    expect(lib).toContain('.shelf-list-focus[aria-busy="true"]{opacity:.6}');
    expect(lib).toContain('@media (prefers-reduced-motion:reduce){.shelf-list-focus{transition:none}}');
    const learn = read('src/components/learn/learn.css');
    expect(learn).toContain('.learn-paragraph__cycle{transform:translateY(-1px);transition:opacity var(--transition-fast)}');
    expect(learn).toContain('.learn-paragraph__cycle[aria-busy="true"]{opacity:.6}');
    expect(learn).toContain('@media (prefers-reduced-motion:reduce){.learn-paragraph__cycle{transition:none}}');
  });
  it('채점 ✓ 도장 — ✓(::after)에만 stampIn 0.16s var(--ease-settle) both, 키프레임은 transform · opacity만, 모션 축소 시 none', () => {
    const css = read('src/index.css');
    const after = sliceBetween(css, '.fr-quiz__opt.is-correct::after {', '}');
    const m = after.match(/animation:\s*stampIn\s+([\d.]+)s\s+var\(--ease-settle\)\s+both;/);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBeLessThanOrEqual(0.16);
    expect(sliceBetween(css, '.fr-quiz__opt.is-correct {', '}')).not.toContain('animation');
    const frames = sliceBetween(css, '@keyframes stampIn {', '\n}');
    for (const prop of [...frames.matchAll(/(?:^|[{;])\s*([a-z-]+)\s*:/g)].map((x) => x[1])) expect(['transform', 'opacity']).toContain(prop);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.fr-quiz__opt\.is-correct::after \{ animation: none; animation-delay: 0s; \}/);
  });
});
