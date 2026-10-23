import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => new Proxy({}, { get: (_, name) => (name === 'then' ? undefined : () => ({ variable: `f-${String(name).toLowerCase()}` })), has: () => true }));

import shelfOrder from '../../content/art/shelf-order.json';
import { ART_CATALOG } from '../../content/art/index.js';
import ArtShelf from '../../components/web/ArtShelf';
import DiscoverTiles from '../../components/web/DiscoverTiles';
import { ART_LIMITS, validateArtCatalog } from '../artCatalog';
import { ART_PUBLISHED_CURATIONS, artBooks } from '../artBook';
import { artShelfWorks, releasedArt } from '../artShelf';
import { classicsFilters, classicsSection } from '../classicsShelf';
import { readerReturnLabel, safeReaderReturn } from '../libraryReturn';

// 산책 「고전 명작」 그림 구간(DISCOVER-ART-001, 오너 「그림도 대중적으로 인기 많을 법한 것 위주로 먼저」 → 「권장대로 ㄱㄱ」 2026-10-23 KST).
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const works = artShelfWorks();
const rowsOf = (items) => items.map((item, i) => ({ book_key: item.bookKey, work: item.workId, chapter_order: item.order, material_id: 5000 + i }));
const ALL = releasedArt(works, rowsOf(works));
const render = (props) => renderToStaticMarkup(createElement(ArtShelf, props));

describe('그림 구간 — 게시 책의 작품 한 점 = 카드 한 장', () => {
  it('게시 책의 장 전부가 카드가 되고, 카드마다 그림 · 한국어 제목 · 작가 · 한 줄 이야기가 있다', () => {
    const chapters = artBooks().flatMap((book) => book.chapters.map((chapter) => `${book.book.key}:${chapter.order}`));
    expect(works.map((item) => item.key).sort()).toEqual([...chapters].sort());
    for (const item of works) {
      expect([item.key, Boolean(item.image?.url), Boolean(item.title), Boolean(item.artist), Boolean(item.hook)]).toEqual([item.key, true, true, true, true]);
    }
  });
  it('한 줄 이야기는 게시 작품 모두에 — 계약(1–40자, 우리가 쓴 한국어)이 길이를 잡는다', () => {
    const published = new Set(ART_CATALOG.curations.filter((curation) => ART_PUBLISHED_CURATIONS.includes(curation.id)).flatMap((curation) => curation.works));
    for (const work of ART_CATALOG.works.filter((item) => published.has(item.id))) {
      expect(work.hook, work.id).toBeTruthy();
      expect(work.hook.length, work.id).toBeLessThanOrEqual(ART_LIMITS.hookMax);
      expect(work.hook, `${work.id}: 화면 문구는 한국어`).toMatch(/[가-힣]/);
    }
    const catalog = structuredClone(ART_CATALOG);
    catalog.works[0].hook = '가'.repeat(ART_LIMITS.hookMax + 1);
    expect(validateArtCatalog(catalog).join('\n')).toMatch(/works\[0\]\.hook: 한 줄 이야기는 1–40자/);
  });
  it('차례는 한국에서 익숙한 그림 먼저(shelf-order.json) — 앞줄 id는 모두 게시 작품이다', () => {
    const ids = works.map((item) => item.workId);
    for (const id of shelfOrder.first) expect(ids, id).toContain(id);
    expect(ids.slice(0, shelfOrder.first.length)).toEqual(shelfOrder.first);
    expect(ids.slice(0, 4)).toEqual(['hokusai-kanagawa-oki-nami-ura', 'van-gogh-bedroom', 'monet-water-lilies', 'seurat-grande-jatte']);
  });
  it('명화 책은 영어로 읽는다 — 카드의 언어 · 레벨은 책에서', () => {
    const bedroom = works.find((item) => item.workId === 'van-gogh-bedroom');
    expect(bedroom).toMatchObject({ bookKey: 'art-aic-famous-paintings', order: 1, language: 'English', level: 'B2 상급', title: '아를의 침실', titleNative: 'The Bedroom', titleLang: 'en', artist: '빈센트 반 고흐' });
    expect(works.find((item) => item.workId === 'hokusai-kanagawa-oki-nami-ura')).toMatchObject({ language: 'Japanese', titleLang: 'ja' });
  });
  it('그림 서가 줄과 책 key · 장 순서 · 작품이 모두 맞아야 연다 — 어긋난 줄 · 깨진 id는 버린다(fail closed)', () => {
    const [first, second, third] = works;
    const rows = [
      { book_key: first.bookKey, work: first.workId, chapter_order: first.order, material_id: 11 },
      { book_key: second.bookKey, work: 'somebody-else', chapter_order: second.order, material_id: 12 },
      { book_key: third.bookKey, work: third.workId, chapter_order: third.order, material_id: 'x' },
      { book_key: 'art-nope', work: first.workId, chapter_order: 1, material_id: 13 },
    ];
    expect(releasedArt(works, rows).map((item) => [item.workId, item.materialId])).toEqual([[first.workId, 11]]);
    expect(releasedArt(works, null)).toEqual([]);
  });
});

describe('그림 구간 화면', () => {
  it('카드: 그림(꾸밈) · 제목 링크 → 그 장 · 작가 링크(그 작가만) · 한 줄 이야기 · 언어 · 레벨', () => {
    const html = render({ items: ALL, filters: classicsFilters({ shelf: 'art' }) });
    expect(html.match(/<li class="art-card">/g)).toHaveLength(ALL.length);
    const bedroom = ALL.find((item) => item.workId === 'van-gogh-bedroom');
    expect(html).toContain(`<a class="art-card__open" href="/viewer/${bedroom.materialId}?returnTo=%2Fdiscover%2Fclassics%3Fshelf%3Dart">`);
    expect(html).toContain('<img src="/art/van-gogh-bedroom.jpg" alt="" width="800" height="624" loading="lazy" decoding="async"/>');
    expect(html).toContain('<strong>아를의 침실</strong></a><a class="classics-card__author" href="/discover/classics?shelf=art&amp;author=%EB%B9%88%EC%84%BC%ED%8A%B8+%EB%B0%98+%EA%B3%A0%ED%9D%90">빈센트 반 고흐</a>');
    expect(html).toContain('<p class="art-card__hook">고흐가 세 번이나 그린 「노란 집」의 자기 방</p><small>영어 · B2 상급</small>');
  });
  it('언어 칩은 작품이 있는 언어만(둘 이상일 때), 작가로 거르면 「N점」과 해제', () => {
    const html = render({ items: ALL, filters: classicsFilters({ shelf: 'art' }) });
    expect(html).toContain('<nav class="classics-chips" aria-label="언어">');
    expect(html).toContain('href="/discover/classics?shelf=art&amp;lang=English"');
    expect(html).toContain('href="/discover/classics?shelf=art&amp;lang=Japanese"');
    expect(html).not.toContain('lang=French');
    const english = render({ items: ALL, filters: classicsFilters({ shelf: 'art', lang: 'English' }) });
    expect(english.match(/<li class="art-card">/g)).toHaveLength(16);
    const monet = render({ items: ALL, filters: classicsFilters({ shelf: 'art', author: '클로드 모네' }) });
    expect(monet.match(/<li class="art-card">/g)).toHaveLength(3);
    expect(monet).toContain('<span>클로드 모네 · 3점</span>');
    expect(monet).toContain('aria-label="클로드 모네 거르기 해제"');
    expect(render({ items: ALL.slice(0, 1), filters: classicsFilters({ shelf: 'art' }) })).not.toContain('aria-label="언어"');
  });
  it('빈 · 실패 · 조건 없음 상태', () => {
    expect(render({ items: [], filters: classicsFilters({ shelf: 'art' }) })).toContain('아직 공개한 그림이 없어요.');
    const failed = render({ items: [], filters: classicsFilters({ shelf: 'art' }), failed: true });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('href="/discover/classics?shelf=art"');
    expect(render({ items: ALL, filters: classicsFilters({ shelf: 'art', author: '없는 화가' }) })).toContain('이 조건의 그림이 없어요.');
  });
  it('구간 탭은 두 구간 모두 열 것이 있을 때만 — 고른 구간이 비면 다른 구간으로, 실패는 그 구간에 남는다', () => {
    expect(classicsSection('', { books: true, art: true })).toEqual({ shelf: '', tabs: true });
    expect(classicsSection('art', { books: true, art: true })).toEqual({ shelf: 'art', tabs: true });
    expect(classicsSection('art', { books: true, art: false })).toEqual({ shelf: '', tabs: false });
    expect(classicsSection('', { books: false, art: true })).toEqual({ shelf: 'art', tabs: false });
    expect(classicsSection('', { books: false, art: false })).toEqual({ shelf: '', tabs: false });
  });
  it('뷰어 「←」는 그림 구간으로 돌아온다(shelf · 거르기만 옮긴다)', () => {
    expect(safeReaderReturn('/discover/classics?shelf=art&lang=English&x=1')).toBe('/discover/classics?shelf=art&lang=English');
    expect(readerReturnLabel('/discover/classics?shelf=art')).toBe('← 고전 명작');
  });
  it('산책 고전 명작 칸은 책 · 그림 수를 함께, 책이 없으면 그림을 표지 자리에', () => {
    const both = renderToStaticMarkup(createElement(DiscoverTiles, { classics: [{ key: 'a', provider: 'aozora', work: {} }], art: ALL, date: '2026-10-23' }));
    expect(both).toContain(`<span class="discover-tile__big">1권 · ${ALL.length}점</span>`);
    const artOnly = renderToStaticMarkup(createElement(DiscoverTiles, { classics: [], art: ALL, date: '2026-10-23' }));
    expect(artOnly).toContain('<a class="discover-tile discover-tile--classics" href="/discover/classics">');
    expect(artOnly).toContain(`<span class="discover-tile__big">${ALL.length}점</span>`);
    expect(artOnly.match(/discover-tile__cover--art/g)).toHaveLength(3);
    expect(artOnly).not.toContain('첫 책 준비 중');
  });
  it('서버 화면 · 카드 그림은 저장소 파일 · 정사각 칸', () => {
    expect(read('src/components/web/ArtShelf.jsx')).not.toMatch(/^['"]use client['"]/m);
    for (const item of ALL) expect(item.image.url).toMatch(/^\/art\/[a-z0-9-]+\.jpg$/);
    const css = read('src/components/web/web-shell.css');
    expect(css).toMatch(/\.art-card__frame\{[^}]*aspect-ratio:1/);
    expect(css).toMatch(/\.art-card__frame img\{[^}]*object-fit:cover/);
  });
});
