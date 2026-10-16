import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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
  it('자료 목록 화면은 그 화면에서만 받는다 — 산책 · 서재 기본 화면 JS에 싣지 않는다(운영 약 119KB, 2026-10-17 KST)', () => {
    for (const file of ['src/app/(app)/discover/page.jsx', 'src/components/web/LibraryPage.jsx']) {
      expect(read(file)).not.toMatch(/import\s+\w+\s+from\s+'@\/views\/MaterialsPage'/);
      expect(read(file)).toContain('<LazyMaterialsPage libraryView=');
    }
    expect(read('src/components/web/LazyMaterialsPage.jsx')).toContain("dynamic(() => import('@/views/MaterialsPage')");
  });
  it('「함께 읽는 글」 목록의 추천 카드도 발견으로 돌아간다(서재 목록은 서재로)', () => {
    expect(read('src/views/MaterialsPage.jsx')).toContain("from={libraryView === 'public' ? 'discover' : 'materials'}");
    expect(read('src/views/MaterialsPage.jsx')).toContain('router.push(suggestionHref(s, from))');
  });
  it('비로그인 서재는 서가로 안내한다', () => {
    expect(read('src/components/web/LibraryPage.jsx')).toContain('href="/discover">서가에서 읽어 보기</Link>');
  });
});
