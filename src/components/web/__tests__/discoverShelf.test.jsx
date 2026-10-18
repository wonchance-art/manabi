import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../../lib/__tests__/helpers/sliceBetween.js';
import DiscoverShelf, { SHELF_NEWS_LIMIT, interleaveByLanguage, shelfDateLabel } from '../DiscoverShelf';

// 발견 서가(SHELF-001 — 오너 「발견에 공개」·「서가」·「지역학 치워버려 지우진 말고」 2026-10-16 KST).
const ROOT = path.resolve(__dirname, '../../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const row = (id, language, over = {}) => ({ id: `00000000-0000-4000-8000-00000000000${id}`, language, level: 'N3 중급', title: `제목 ${id}`,
  channel_name: '출처', transcript: '본문', material_id: null, source: 'nhk_easy', ...over });

describe('오늘의 소식 칸', () => {
  it('언어를 번갈아 최대 넷을 고른다(같은 언어 안의 순서는 그대로)', () => {
    const rows = [row(1, 'English'), row(2, 'English'), row(3, 'English'), row(4, 'Japanese'), row(5, 'Japanese')];
    expect(interleaveByLanguage(rows).map((r) => r.id.slice(-1))).toEqual(['1', '4', '2', '5']);
    expect(interleaveByLanguage(rows)).toHaveLength(SHELF_NEWS_LIMIT);
    expect(interleaveByLanguage([row(1, 'English')])).toHaveLength(1);
  });
  it('날짜는 「10월 16일」, 읽을 수 없는 카드는 빼고 센다', () => {
    expect(shelfDateLabel('2026-10-16')).toBe('10월 16일');
    const html = renderToStaticMarkup(createElement(DiscoverShelf, {
      suggestions: [row(1, 'Japanese'), row(2, 'English', { transcript: null })], publicCount: 0, date: '2026-10-16' }));
    expect(html).toContain('오늘의 소식');
    expect(html).toContain('>전체 보기</a>');
    expect(html).not.toMatch(/전체 보기 \(\d+\)/);
    expect(html).toContain('제목 1');
    expect(html).not.toContain('제목 2');
    expect(html).toContain('lang="ja"');
    expect(html).toContain('?from=discover');
  });
  it('소식도 공개 글도 없으면 서가를 그리지 않는다 — 빈 칸 안내를 만들지 않는다', () => {
    expect(renderToStaticMarkup(createElement(DiscoverShelf, { suggestions: [], publicCount: 0 }))).toBe('');
    expect(renderToStaticMarkup(createElement(DiscoverShelf, { suggestions: [], publicCount: 123 }))).toContain('공개 글 123편');
  });
});

describe('발견 화면 배선', () => {
  const page = () => read('src/app/(app)/discover/page.jsx');
  it('서가를 그리고, 오늘의 추천은 /api/suggestions/today와 같은 todaySuggestions를 쓴다', () => {
    expect(page()).toContain('<DiscoverShelf');
    expect(page()).toContain('todaySuggestions(client)');
    expect(read('src/app/api/suggestions/today/route.js')).toContain('todaySuggestions(');
  });
  it('지역학은 발견에서 내렸지만 지우지 않았다 — /studies 경로와 콘텐츠가 남아 있다', () => {
    expect(page()).not.toMatch(/STUDY_COUNTRIES|DiscoveryExplorer/);
    expect(fs.existsSync(path.join(ROOT, 'src/app/(app)/studies/page.jsx'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src/content/studies'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src/components/web/DiscoveryExplorer.jsx'))).toBe(true);
  });
  it('공개 글 수는 책 장도 센다 — 비로그인은 책 장 행을 못 읽으니 public_book_catalog로 더한다', () => {
    expect(page()).toContain("client.rpc('public_book_catalog', {}, { count: 'exact', head: true }).not('title', 'ilike', SERIES_TITLE_ILIKE)");
    expect(page()).not.toMatch(/rpc\('public_book_catalog'\)\.then/);
    expect(page()).toContain('const publicCount = looseCount + bookChapterCount;');
  });
  it('자료 목록 화면은 그 화면에서만 받는다 — 산책 · 서재 기본 화면 JS에 싣지 않는다(운영 약 119KB, 2026-10-17 KST)', () => {
    for (const file of ['src/app/(app)/discover/page.jsx', 'src/components/web/LibraryPage.jsx']) {
      expect(read(file)).not.toMatch(/import\s+\w+\s+from\s+'@\/views\/MaterialsPage'/);
      expect(read(file)).toContain('<LazyMaterialsPage libraryView=');
    }
    expect(read('src/components/web/LazyMaterialsPage.jsx')).toContain("dynamic(() => import('@/views/MaterialsPage')");
  });
  it('「함께 읽는 글」 목록의 추천 카드는 그 목록으로 돌아간다(서재 목록은 서재로 — READER-RETURN-001)', () => {
    expect(read('src/views/MaterialsPage.jsx')).toContain("from={libraryView === 'public' ? 'reading' : 'materials'}");
    expect(read('src/views/MaterialsPage.jsx')).toContain('router.push(suggestionHref(s, from))');
  });
  it('「함께 읽는 글」은 세션 쿠키(이름만)를 넘겨 로그인 고르기 줄을 서버부터 그린다(DISCOVER-CHIP-CLS-001)', () => {
    // 서버 그림은 늘 로그인 확인 전 — 힌트가 없으면 확인 뒤 「안 읽은 것만」 칩이 끼며 390폭에서 줄이 접혀 목록을 밀었다.
    expect(page()).toContain("import { hasSupabaseSessionInJar } from '@/lib/authCookie';");
    expect(page()).toContain('<LazyMaterialsPage libraryView="public" sessionHint={hasSupabaseSessionInJar(await cookies())}/>');
    expect(read('src/views/MaterialsPage.jsx')).toContain("export default function MaterialsPage({ libraryView = null, sessionHint = false })");
  });
  it('비로그인 서재는 서가로 안내한다', () => {
    expect(read('src/components/web/LibraryPage.jsx')).toContain('href="/discover">서가에서 읽어 보기</Link>');
  });
});

// B2 A안(오너 「권장대로」 2026-10-17 KST): 부제는 제목 아래 · 오른쪽 끝은 비운다 · 소식 「전체 보기」는 「함께 읽는 글」 아래 「오늘의 소식」 칸으로.
describe('서가 머리 · 소식 전체 보기(B2 A안)', () => {
  const html = renderToStaticMarkup(createElement(DiscoverShelf, { suggestions: [row(1, 'Japanese')], publicCount: 3, date: '2026-10-16' }));

  it('「서가」 아래 부제 「누구나 읽는 책장」 — 줄 머리와 같은 쌓기(h + small), 머리 오른쪽에는 아무것도 없다', () => {
    expect(html).toContain('<div class="manabi-section-heading"><div class="discover-shelf__label"><h2 id="discover-shelf-title">서가</h2><small>누구나 읽는 책장</small></div></div>');
    expect(html).not.toContain('<span>누구나 읽는 책장</span>');
  });

  it('소식 「전체 보기」는 #today-news로, 「함께 읽는 글」 「전체 보기」는 목록 맨 위로', () => {
    expect(html).toContain('href="/discover?view=reading#today-news">전체 보기</a>');
    expect(html.match(/href="\/discover\?view=reading">전체 보기<\/a>/g)).toHaveLength(1);
  });

  it('발견 대기 화면 머리도 같은 모양이다', () => {
    expect(read('src/app/(app)/discover/loading.jsx')).toContain('<div className="manabi-section-heading"><div className="discover-shelf__label"><h2>서가</h2><small>누구나 읽는 책장</small></div></div>');
  });

  it('「함께 읽는 글」 화면의 칸 — id · 제목 「오늘의 소식」 · 목록과 소식이 둘 다 온 뒤 한 번 내려가 초점(#library-search와 같은 해시 처리)', () => {
    const page = read('src/views/MaterialsPage.jsx');
    expect(read('src/lib/suggestionReading.js')).toContain("export const TODAY_NEWS_ID = 'today-news';");
    expect(page).toContain('<h2 className="suggestions-section__title" id={TODAY_NEWS_ID} tabIndex={-1}>오늘의 소식</h2>');
    expect(page).not.toContain('오늘의 추천 자료');
    expect(page).toContain('const newsReady = materialsFetched && suggestionsFetched;');
    const effect = sliceBetween(page, 'const newsFocusDone = useRef(false);', '}, [newsReady]);');
    expect(effect).toContain("window.location.hash !== `#${TODAY_NEWS_ID}` || newsFocusDone.current || !newsReady");
    expect(effect).toContain("heading.scrollIntoView({ block: 'start' });");
    expect(effect).toContain('heading.focus({ preventScroll: true });');
    expect(effect).toContain("window.addEventListener('hashchange', again);");
  });
});
