import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => new Proxy({}, { get: (_, name) => (name === 'then' ? undefined : () => ({ variable: `f-${String(name).toLowerCase()}` })), has: () => true }));

import catalog from '../../content/literature/catalog.json';
import ClassicsShelf from '../../components/web/ClassicsShelf';
import DiscoverTiles, { CLASSICS_TILE_COVERS, MAGAZINE_HREF, dailyCovers, shelfDateLabel } from '../../components/web/DiscoverTiles';
import {
  CLASSICS_LANGUAGES, classicsChips, classicsFilters, classicsHref, classicsWorks, filterClassics, releasedClassics,
} from '../classicsShelf';
import { readerReturnLabel, readerReturnTarget, safeReaderReturn } from '../libraryReturn';

// 산책 「고전 명작」 · 큰 칸 셋(DISCOVER-CLASSICS-001, 오너 「권장대로 ㄱㄱ」 2026-10-22 KST).
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const works = classicsWorks();
const shelfOf = (keys) => keys.map((key, i) => ({ book_key: key, first_material_id: 1000 + i, chapters: 3, released_at: '2026-10-22T00:00:00Z' }));
const ALL = releasedClassics(works, shelfOf(works.map((item) => item.key)));
const render = (props) => renderToStaticMarkup(createElement(ClassicsShelf, props));
const anchors = (html) => [...html.matchAll(/<a [^>]*>/g)].map((match) => match[0]);

describe('고전 명작 — 저장소 정본에서 만든 책 목록', () => {
  it('수록 줄 전부가 대조표에 있고, 카탈로그 차례 · 갈래를 그대로 쓴다', () => {
    const shelved = catalog.works.filter((entry) => entry.status === '수록');
    expect(works.map((item) => item.key)).toEqual(shelved.map((entry) => entry.key));
    expect(works.map((item) => item.category)).toEqual(shelved.map((entry) => entry.category));
    for (const item of works) {
      expect([item.key, CLASSICS_LANGUAGES.includes(item.language), Boolean(item.title), Boolean(item.authorKo), item.total > 0])
        .toEqual([item.key, true, true, true, true]);
    }
  });
  it('발행 기록이 있는 책만 보인다 — 첫 장 id · 공개 장 수는 서가 함수 값, 모르는 key · 깨진 id는 버린다', () => {
    const [first, second] = works;
    const rows = [...shelfOf([second.key]), { book_key: 'aozora-999999-999999', first_material_id: 5, chapters: 1 }, { book_key: first.key, first_material_id: 'x', chapters: 2 }];
    expect(releasedClassics(works, rows).map((item) => [item.key, item.firstMaterialId, item.chapters])).toEqual([[second.key, 1000, 3]]);
    expect(releasedClassics(works, null)).toEqual([]);
  });
  it('주소 질의 → 거르기: 모르는 값은 버리고, 작은 갈래가 큰 갈래를 정한다', () => {
    expect(classicsFilters({ lang: 'Klingon', group: 'x', cat: 'novel', author: '  김유정 ' })).toEqual({ lang: '', group: '', cat: '', author: '김유정' });
    expect(classicsFilters({ group: 'nonfiction', cat: 'poetry' })).toEqual({ lang: '', group: 'literature', cat: 'poetry', author: '' });
    expect(classicsFilters({ lang: ['Korean', 'English'] }).lang).toBe('Korean');
  });
  it('칩은 책이 있는 것만 — 고른 언어에 없는 갈래는 없고, 작은 갈래는 둘 이상일 때만', () => {
    const korean = classicsChips(ALL, classicsFilters({ lang: 'Korean' }));
    expect(korean.languages).toEqual(CLASSICS_LANGUAGES);
    expect(korean.groups).not.toContain('young'); // 한국어 수록작에 아동 · 청소년이 없다
    expect(classicsChips(ALL, classicsFilters({ lang: 'Korean', group: 'literature' })).categories).toEqual(['fiction', 'poetry']);
    expect(classicsChips(ALL, classicsFilters({ lang: 'Korean', group: 'nonfiction' })).categories).toEqual([]); // 한국어 비문학은 갈래가 하나뿐(선언서)
    expect(classicsChips(ALL, classicsFilters({ lang: 'Japanese', group: 'nonfiction' })).categories).toEqual(['essay', 'society']);
    const dazai = filterClassics(ALL, classicsFilters({ author: '다자이 오사무' }));
    expect(dazai).toHaveLength(5);
    expect(classicsChips(dazai, classicsFilters({ author: '다자이 오사무' })).languages).toEqual(['Japanese']);
  });
  it('이동 주소는 바꾸는 칸만 덮어쓰고 순서가 고정이다', () => {
    const filters = classicsFilters({ lang: 'Japanese', group: 'literature', cat: 'fiction' });
    expect(classicsHref(filters, { cat: '' })).toBe('/discover/classics?lang=Japanese&group=literature');
    expect(classicsHref(filters, { lang: '', group: '', cat: '' })).toBe('/discover/classics');
    expect(classicsHref({}, { author: '김소월' })).toBe('/discover/classics?author=%EA%B9%80%EC%86%8C%EC%9B%94');
  });
});

describe('고전 명작 화면', () => {
  it('카드: 표지 · 원제(lang) · 한국어 제목 · 작가 링크 · 레벨 · 장 수 — 링크 안에 링크가 없다', () => {
    const html = render({ items: ALL, filters: classicsFilters({}) });
    expect(html.match(/<li class="classics-card">/g)).toHaveLength(ALL.length);
    expect(html).toContain('<strong lang="ja">人間失格</strong><span>인간 실격</span>');
    expect(html).toContain('lang="zh-Hans"');
    expect(html).toContain('lang="ko"');
    // 표지는 장식(aria-hidden), 글자가 읽어 준다
    expect(html).toMatch(/<span class="classics-card__cover"><span class="lit-cover[^"]*"[^>]*aria-hidden="true"/);
    for (const card of html.split('<li class="classics-card">').slice(1)) {
      // 첫 링크(열기)가 닫히기 전에 다른 링크가 열리지 않는다
      expect(sliceBetween(card, '<a class="classics-card__open"', '</a>').match(/<a /g)).toHaveLength(1);
    }
    expect(html).not.toMatch(/담기|class="[^"]*tag/);
  });
  it('열기 = 그 책 첫 장, 「←」는 지금 거르기 그대로 고전 명작으로', () => {
    const filters = classicsFilters({ lang: 'Korean' });
    const html = render({ items: ALL, filters });
    const first = filterClassics(ALL, filters)[0];
    expect(html).toContain(`href="/viewer/${first.firstMaterialId}?returnTo=%2Fdiscover%2Fclassics%3Flang%3DKorean"`);
    const back = '/discover/classics?lang=Korean';
    expect(safeReaderReturn(back)).toBe(back);
    expect(readerReturnLabel(back)).toBe('← 고전 명작');
    expect(readerReturnTarget(back, { guest: true })).toEqual({ href: back, label: '← 고전 명작', guestDefault: false });
    expect(safeReaderReturn('/discover/classics?evil=1&author=x')).toBe('/discover/classics?author=x');
    expect(safeReaderReturn('https://evil.example/discover/classics')).toBe('/materials');
  });
  it('칩 = 주소 링크 · 지금 고른 칩은 aria-current · 큰 갈래를 고르면 「‹ 문학」 한 줄로 들어간다', () => {
    const top = render({ items: ALL, filters: classicsFilters({}) });
    expect(top).toContain('<nav class="classics-chips" aria-label="언어">');
    expect(top).toContain('<a class="classics-chip" aria-current="true" href="/discover/classics">전체</a>');
    expect(top).toContain('href="/discover/classics?group=literature">문학</a>');
    const inGroup = render({ items: ALL, filters: classicsFilters({ group: 'literature' }) });
    expect(inGroup).toContain('<a class="classics-chip classics-chip--back" aria-current="true" href="/discover/classics"><span aria-hidden="true">‹ </span>문학</a>');
    expect(inGroup).toContain('href="/discover/classics?group=literature&amp;cat=poetry">시</a>');
    expect(inGroup).not.toContain('>비문학</a>');
    for (const chip of anchors(top).filter((tag) => tag.includes('classics-chip'))) expect(chip).toMatch(/href="\/discover\/classics/);
  });
  it('작가를 누르면 다른 거르기를 풀고 그 작가 책만 — 머리에 「작가 · N권」과 해제(44px 단추)', () => {
    const lang = render({ items: ALL, filters: classicsFilters({ lang: 'Japanese', group: 'young' }) });
    expect(lang).toContain('href="/discover/classics?author=%EB%AF%B8%EC%95%BC%EC%9E%90%EC%99%80+%EA%B2%90%EC%A7%80"');
    const html = render({ items: ALL, filters: classicsFilters({ author: '미야자와 겐지' }) });
    expect(html).toContain('<span>미야자와 겐지 · 7권</span>');
    expect(html).toContain('aria-label="미야자와 겐지 거르기 해제"');
    expect(html).not.toContain('aria-label="언어"'); // 한 언어뿐 — 고를 게 없는 줄은 두지 않는다
    expect(read('src/components/web/web-shell.css')).toMatch(/\.classics-author__clear\{[^}]*width:44px;height:44px/);
  });
  it('빈 서가 · 조건에 맞는 책 없음 · 불러오기 실패는 문구가 다르다(조용히 「없어요」로 지나가지 않는다)', () => {
    expect(render({ items: [], filters: classicsFilters({}) })).toBe('<p class="classics-state">아직 공개한 고전 명작이 없어요.</p>');
    expect(render({ items: ALL, filters: classicsFilters({ author: '없는 작가' }) })).toContain('이 조건의 책이 없어요.');
    const failed = render({ items: [], filters: classicsFilters({}), failed: true });
    expect(failed).toContain('role="alert">고전 명작을 불러오지 못했어요. <a class="manabi-link" href="/discover/classics">다시 시도</a>');
  });
  it('서버 화면이다 — 대조표 · 카탈로그 · 표지를 브라우저 번들에 싣지 않는다', () => {
    for (const file of ['src/components/web/ClassicsShelf.jsx', 'src/components/web/DiscoverTiles.jsx', 'src/components/books/ClassicCover.jsx', 'src/lib/classicsShelf.js', 'src/app/(app)/discover/classics/page.jsx']) {
      expect(read(file)).not.toMatch(/^['"]use client['"]/m);
    }
    expect(read('src/app/(app)/discover/classics/page.jsx')).toContain('releasedClassicsOf(suggestionClient())');
    expect(read('src/lib/server/classicsReading.js')).toContain("client.rpc('canonical_book_shelf')");
  });
});

describe('산책 큰 칸 셋', () => {
  const news = [{ id: '00000000-0000-4000-8000-000000000001', language: 'Japanese', level: 'N3 중급', title: '東京の秋祭り', channel_name: 'NHK NEWS WEB EASY', transcript: '본문', material_id: null, source: 'nhk_easy' }];
  it('오늘 화제 · 고전 명작 · 여행 매거진 — 열 것이 있는 칸만 링크, 소식 수는 달지 않는다', () => {
    const html = renderToStaticMarkup(createElement(DiscoverTiles, { suggestions: news, classics: ALL, date: '2026-10-22' }));
    expect(html).toContain('<a class="discover-tile discover-tile--news" href="/discover?view=reading#today-news">');
    expect(html).toContain('<span class="discover-tile__big">10월 22일</span>');
    expect(html).toContain('<strong class="discover-tile__title" lang="ja">東京の秋祭り</strong>');
    expect(html).toContain(`<a class="discover-tile discover-tile--classics" href="/discover/classics"><span class="discover-tile__head"><span class="discover-tile__kicker">고전 명작</span><span class="discover-tile__big">${ALL.length}권</span>`);
    expect(html.match(/class="discover-tile__cover"/g)).toHaveLength(CLASSICS_TILE_COVERS);
    expect(html).toContain('<div class="discover-tile discover-tile--magazine">');
    expect(html).toContain('첫 호 준비 중');
    expect(MAGAZINE_HREF).toBe(null); // 매거진 세션이 첫 호 때 건다
    expect(html).not.toMatch(/소식 \d+편/);
  });
  it('열 것이 없으면 누를 수 없는 칸 — 단추 없이 「준비 중」', () => {
    const html = renderToStaticMarkup(createElement(DiscoverTiles, { suggestions: [], classics: [], date: '2026-10-22' }));
    expect(html).not.toContain('<a ');
    expect(html).toContain('오늘 소식 준비 중');
    expect(html).toContain('첫 책 준비 중');
    expect(html).not.toContain('discover-tile__pill');
  });
  it('표지 셋은 날마다 한 칸씩 밀린다(같은 날은 같은 셋)', () => {
    const items = ['a', 'b', 'c', 'd'].map((key) => ({ key }));
    expect(dailyCovers(items, '2026-10-22').map((item) => item.key)).toEqual(dailyCovers(items, '2026-10-22').map((item) => item.key));
    const today = dailyCovers(items, '2026-10-22')[0].key, tomorrow = dailyCovers(items, '2026-10-23')[0].key;
    expect(items.findIndex((item) => item.key === tomorrow)).toBe((items.findIndex((item) => item.key === today) + 1) % items.length);
    expect(dailyCovers([{ key: 'a' }], '2026-10-22')).toHaveLength(1);
    expect(dailyCovers([], '2026-10-22')).toEqual([]);
    expect(shelfDateLabel('2026-10-16')).toBe('10월 16일');
  });
  it('넓으면 가로 셋 · 정사각, 셸 640 이하는 세로 · 높이 236(배움 휴대폰 선례) — 새 화면 폭 쿼리 없이 셸 컨테이너로', () => {
    const css = read('src/components/web/web-shell.css');
    expect(css).toContain('.discover-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))');
    expect(css).toMatch(/\.discover-tile\{[^}]*aspect-ratio:1/);
    expect(css).toContain('@container manabi-shell (max-width:640px){.discover-tiles{grid-template-columns:minmax(0,1fr)}.discover-tile{aspect-ratio:auto;height:236px}');
  });
});
