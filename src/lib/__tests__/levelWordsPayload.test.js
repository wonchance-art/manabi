import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { levelListRoute } from '../../views/levelListRoute.jsx';
import { levelListData } from '../levelListData.js';
import { LEVEL_LIST_LANGS, levelKinds } from '../levelList.js';
import { LEVEL_WORDS_BUILD, LEVEL_WORDS_CACHE, fetchLevelWords, levelWordsUrl, requestLevelWords, warmLevelWords } from '../levelWordsPayload.js';
import LevelWordsPreload from '../../components/levels/LevelWordsPreload.jsx';
import { renderToStaticMarkup } from 'react-dom/server';
import { GET, generateStaticParams } from '../../app/api/level-words/[lang]/[level]/route.js';
import { LATIN_WORD_LEVELS } from '../latinLevelWords.js';
import { latinWordsData } from '../latinWordsData.js';
import LatinWordPage from '../../views/LatinWordPage.jsx';
import EnglishWordsPage from '../../app/(app)/english/words/[level]/page.jsx';
import FrenchWordsPage from '../../app/(app)/french/words/[level]/page.jsx';

// 레벨 단어 목록 조각 감량(LEVEL-LIST-RSC-001, 2026-10-26 KST) — 단어 화면의 항목 전체가 화면 조각(RSC)에 실려
// N3 207 KB · H7 542 KB(gz)였고, 책장 레벨 타일 미리 받기 7–15개가 0.6–0.9 MB를 받았다. 항목은 조각 밖 정적 묶음으로 옮기고
// 조각에는 주소만 — 되돌리면(항목을 다시 조각 props로) 아래 ①이 깨진다.
const View = () => null;
const flat = (node) => (Array.isArray(node) ? node.flatMap(flat) : node?.props?.children && node.type !== View ? [node, ...flat(node.props.children)] : [node]);
async function pageOf(lang, kind, level) {
  const tree = await levelListRoute(lang, kind, View).Page({ params: Promise.resolve({ level }) });
  const nodes = flat(tree);
  return { view: nodes.find((n) => n?.type === View), link: nodes.find((n) => n?.type === LevelWordsPreload) };
}

describe('레벨 단어 화면 — 항목은 조각 밖 정적 묶음', () => {
  it.each([['japanese', 'n3'], ['japanese', 'n5'], ['chinese', 'h6'], ['chinese', 'h7']])('① %s %s — 화면 props에 항목이 없고(1 KB 미만) 묶음 주소 · 같은 주소 preload만', async (lang, level) => {
    const { view, link } = await pageOf(lang, 'vocab', level);
    expect(view.props.groups).toBeUndefined();
    expect(JSON.stringify(view.props).length).toBeLessThan(1024);
    const url = levelWordsUrl(lang, level.toUpperCase());
    expect(view.props).toEqual({ lang, kind: 'vocab', levelKey: level.toUpperCase(), wordsUrl: url });
    expect(url).toBe(`/api/level-words/${lang}/${level}?v=${LEVEL_WORDS_BUILD}`);
    // 문서 머리에서 JS와 나란히 받는다(요소 preload — 미리 받기 조각을 풀 때는 받지 않는다). fetch 기본값(cors · same-origin 자격)과 맞는 crossOrigin.
    expect(link.props).toEqual({ href: url });
  }, 120000);

  it('② 묶음 응답 = 그 레벨 페이지가 조립하던 항목 그대로 · 배포 판 주소면 오래 캐시', async () => {
    for (const [lang, level] of [['japanese', 'n3'], ['chinese', 'h1']]) {
      const res = await GET(new Request(`http://x/api/level-words/${lang}/${level}`), { params: Promise.resolve({ lang, level }) });
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe(LEVEL_WORDS_CACHE);
      const body = await res.json();
      const data = await levelListData(lang, 'vocab', level);
      expect(body).toEqual({ version: 1, groups: data.groups });
    }
    // 판(커밋)이 붙은 주소만 1년 · 로컬 판('dev')은 매번 확인 — 판 없는 주소를 오래 두면 다음 빌드의 묶음과 갈린다.
    expect(LEVEL_WORDS_CACHE).toBe(LEVEL_WORDS_BUILD === 'dev' ? 'no-cache' : 'public, max-age=31536000, immutable');
    expect(levelWordsUrl('japanese', 'N3', 'abc1234')).toBe('/api/level-words/japanese/n3?v=abc1234');
    for (const [lang, level] of [['chinese', 'h9'], ['korean', 'h1']]) {
      expect((await GET(new Request('http://x'), { params: Promise.resolve({ lang, level }) })).status).toBe(404);
    }
  }, 120000);

  it('③ 굽는 묶음 = 단어 페이지 주소 전부(빠진 레벨 없이)', () => {
    const pages = Object.entries(LEVEL_LIST_LANGS).flatMap(([lang, conf]) => conf.levels.filter((k) => levelKinds(lang, k).includes('vocab'))
      .map((k) => `${lang}/${k.toLowerCase()}`));
    const latin = Object.entries(LATIN_WORD_LEVELS).flatMap(([lang, levels]) => levels.map((k) => `${lang}/${k.toLowerCase()}`));
    expect(generateStaticParams().map((p) => `${p.lang}/${p.level}`)).toEqual([...pages, ...latin]);
    expect(pages).toHaveLength(12);
    expect(latin).toEqual(['english/a1', 'french/a1']);
  });

  // 영어 · 프랑스어 단어 페이지도 같은 길(준비 검토 ② 2026-10-29 KST) — 다 채우면 프랑스어 B2가 약 300 KB라 조각에 싣지 않는다.
  it.each([['english', EnglishWordsPage], ['french', FrenchWordsPage]])('⑥ %s — 화면 props는 묶음 주소만 · 묶음 = latinWordsData', async (lang, Page) => {
    const nodes = flat(await Page({ params: Promise.resolve({ level: 'a1' }) }));
    const view = nodes.find((n) => n?.type === LatinWordPage);
    const url = levelWordsUrl(lang, 'A1');
    expect(view.props).toEqual({ lang, levelKey: 'A1', wordsUrl: url });
    expect(nodes.find((n) => n?.type === LevelWordsPreload).props).toEqual({ href: url });
    const res = await GET(new Request(`http://x${url}`), { params: Promise.resolve({ lang, level: 'a1' }) });
    expect(await res.json()).toEqual({ version: 1, groups: latinWordsData(lang, 'a1').groups });
    expect(latinWordsData(lang, 'a1').groups.flatMap((g) => g.entries)).toHaveLength(8);
    expect((await GET(new Request('http://x'), { params: Promise.resolve({ lang, level: 'b2' }) })).status).toBe(404);
  }, 60000);

  it('④ 문형 · 한자 목록은 그대로 항목을 싣는다(서버 그림의 줄 — 찾기 · 화면 읽기)', async () => {
    const { view, link } = await pageOf('japanese', 'bunkei', 'n5');
    expect(view.props.groups.length).toBeGreaterThan(0);
    expect(view.props.wordsUrl).toBeUndefined();
    expect(link).toBeUndefined();
  }, 60000);

  it('⑤ 받기 — 실패 · 다른 모양은 던진다(화면은 다시 시도)', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ version: 1, groups: [{ name: 'a', entries: [] }] })));
    await expect(fetchLevelWords('/u', { fetchImpl: ok })).resolves.toEqual([{ name: 'a', entries: [] }]);
    await expect(fetchLevelWords('/u', { fetchImpl: async () => new Response('x', { status: 500 }) })).rejects.toThrow('500');
    await expect(fetchLevelWords('/u', { fetchImpl: async () => new Response(JSON.stringify({ version: 2, groups: [] })) })).rejects.toThrow('shape');
  });

  it('④-2 preload는 서버 그림(문서)에만 — 앱 안 이동(머리에 같은 link 없음)에서는 그리지 않는다(누를 때 받기와 두 번 받지 않게)', () => {
    // 서버 그림: 문서 머리에서 JS와 나란히 받는 link(fetch 기본값 cors · same-origin 자격과 맞는 crossorigin).
    expect(renderToStaticMarkup(LevelWordsPreload({ href: '/api/level-words/japanese/n3?v=x' })).toLowerCase()) // HTML 속성 이름은 대소문자를 가리지 않는다
      .toBe('<link rel="preload" as="fetch" crossorigin="anonymous" fetchpriority="low" href="/api/level-words/japanese/n3?v=x"/>');
    const head = new Set();
    globalThis.document = { head: { querySelector: (sel) => ([...head].some((h) => sel.includes(`"${h}"`)) ? {} : null) } };
    globalThis.CSS ||= { escape: (s) => s };
    try {
      expect(LevelWordsPreload({ href: '/a?v=1' })).toBeNull(); // 앱 안 이동
      head.add('/a?v=1');
      expect(LevelWordsPreload({ href: '/a?v=1' }).props).toEqual({ rel: 'preload', as: 'fetch', crossOrigin: 'anonymous', fetchPriority: 'low', href: '/a?v=1' }); // 붙는 중
    } finally { delete globalThis.document; }
  });

  it('⑤-2 누르는 순간 시작한 받기는 화면이 한 번 이어받는다(두 번 받지 않는다) · 실패는 남기지 않는다', async () => {
    const calls = [];
    const real = globalThis.fetch;
    globalThis.fetch = vi.fn(async (u) => { calls.push(u); return new Response(JSON.stringify({ version: 1, groups: [{ name: u, entries: [] }] })); });
    try {
      warmLevelWords('/w1'); warmLevelWords('/w1');
      expect(calls).toEqual(['/w1']);
      await expect(requestLevelWords('/w1')).resolves.toEqual([{ name: '/w1', entries: [] }]);
      await requestLevelWords('/w1'); // 이어받은 뒤에는 새로 받는다(다시 시도)
      expect(calls).toEqual(['/w1', '/w1']);
      globalThis.fetch = vi.fn(async () => new Response('x', { status: 503 }));
      warmLevelWords('/w2');
      await new Promise((r) => setTimeout(r, 0));
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ version: 1, groups: [] })));
      await expect(requestLevelWords('/w2')).resolves.toEqual([]);
    } finally { globalThis.fetch = real; }
    const tiles = fs.readFileSync('src/components/levels/LevelTiles.jsx', 'utf8');
    expect(tiles).toMatch(/<LevelWordsLink className="lv-tile__go" href=\{levelListHref\(lang, 'vocab', t\.levelKey\)\} lang=\{lang\} levelKey=\{t\.levelKey\}/);
    const link = fs.readFileSync('src/components/levels/LevelWordsLink.jsx', 'utf8');
    expect(link).toContain("onPointerDown={(e) => { if (e.pointerType === 'mouse') warm(); }} onClick={warm}");
  });

  it('⑥ 화면은 묶음을 받기 전에 세션 · 연습 · 훑기를 시작하지 않고, 실패면 다시 시도', () => {
    const src = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(src).toContain('const words = useLevelWords(wordsUrl, givenGroups);');
    expect(src).toContain('if (!ready || !loaded || !slotsSettled || startedFor.current === scope) return;'); // 서버 새 단어 몫(LEVEL-SAVED-TAG-001)도 받은 뒤
    expect(src).toContain('const areasReady = loaded && (');
    expect(src).toContain(': browse && !loaded ? <div className="lw-one">{pending}</div>');
    expect(src).toMatch(/words\.failed[\s\S]{0,200}단어 목록을 불러오지 못했어요\.[\s\S]{0,120}다시 시도/);
    // 「고르는 중」 자리는 한 곳(pending)에서만 — 받기 전 · 붙기 전이 같은 화면.
    expect(src.match(/단어를 고르는 중…/g)).toHaveLength(1);
    expect(fs.readFileSync('src/lib/useLevelWords.js', 'utf8')).toMatch(/staleTime: Infinity/);
  });
});
