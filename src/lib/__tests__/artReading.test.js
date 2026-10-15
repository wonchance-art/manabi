import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ART_CATALOG } from '../../content/art/index.js';
import { ART_PUBLISHED_CURATIONS, createArtBook } from '../artBook.js';
import { artReadingItem, artReadingItems } from '../artReading.js';
import { ART_READING_SELECT, fetchArtChapterIndex, pickArtChapters } from '../artReadingIndex.js';

// 「그림 한 장 읽기」 기사형 목록(ART-READ-001, 2026-10-15 KST 오너 「권장대로 ㄱㄱ」) — 목록 값 · 작품→장 연결 · 화면 배선.
//
// 기대 화면(발견, 오너 합의 목업):
//   ─ 그림 한 장 읽기 ─
//   [전체] [가쓰시카 호쿠사이] [우타가와 히로시게]
//   [그림]  冨嶽三十六景 神奈川沖浪裏
//           가쓰시카 호쿠사이 · 1830–33년 · N2 상급 · 623자
// 카드 → 바로 뷰어(서재 거치지 않음). 공개 전에는 게시한 관리자에게만(RLS) 「비공개 미리보기」로.

const read = (file) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('목록 값(카탈로그) — artReadingItems', () => {
  const items = artReadingItems();

  it('게시 책 순서대로, 같은 작품은 한 번만', () => {
    const expected = [...new Set(ART_PUBLISHED_CURATIONS.flatMap((id) => ART_CATALOG.curations.find((c) => c.id === id).works))];
    expect(items.map((item) => item.id)).toEqual(expected);
  });

  it('해시는 게시 장(createArtBook)의 해시와 같다 — 목록과 장을 같은 기준으로 잇는다', () => {
    const chapters = ART_PUBLISHED_CURATIONS.flatMap((id) => createArtBook(id).chapters);
    for (const item of items) {
      const chapter = chapters.find((c) => c.metadata.literature.work === item.id);
      expect(item.textSha256).toBe(chapter.metadata.literature.textSha256);
      expect(item.chars).toBe([...chapter.rawText].length);
    }
  });

  it('그림은 자체 보관 파일만(카탈로그 계약 그대로), 제목은 원어·한국어, 작가·날짜·레벨', () => {
    for (const item of items) {
      if (item.image) expect(item.image.url).toMatch(/^\/art\/[a-z0-9-]+\.(?:jpg|webp)$/);
      expect(item.title.native).toBeTruthy();
      expect(item.artist?.ko).toBeTruthy();
      expect(item.date).toBeTruthy();
      expect(item.level).toBeTruthy();
    }
    expect(artReadingItem('no-such-work')).toBeNull();
    expect(artReadingItem(items[0].id)).toEqual(items[0]);
  });
});

describe('작품 → 읽을 장 — pickArtChapters', () => {
  const expected = new Map([['w1', 'h1'], ['w2', 'h2']]);
  const row = (id, work, visibility, extra = {}) => ({ id, visibility, literature: { provider: 'art', work, textSha256: `h${work.slice(1)}`, curation: 'c1', ...extra } });

  it('공개 장이 비공개 장보다 먼저, 같으면 게시 책 순서, 그다음 작은 id', () => {
    const picked = pickArtChapters([
      row(5, 'w1', 'private'), row(9, 'w1', 'public', { curation: 'c2' }), row(7, 'w1', 'public'),
      row(3, 'w2', 'private', { curation: 'c2' }), row(4, 'w2', 'private', { curation: 'c1' }),
    ], expected, ['c1', 'c2']);
    expect(picked.get('w1')).toEqual({ id: '7', visibility: 'public' });
    expect(picked.get('w2')).toEqual({ id: '4', visibility: 'private' });
  });

  it('원문 해시가 카탈로그와 다르거나, 카탈로그에 없는 작품이거나, provider가 다르면 잇지 않는다(꾸민 metadata 차단)', () => {
    const picked = pickArtChapters([
      { id: 1, visibility: 'public', literature: { provider: 'art', work: 'w1', textSha256: 'forged' } },
      { id: 2, visibility: 'public', literature: { provider: 'art', work: 'w9', textSha256: 'h9' } },
      { id: 3, visibility: 'public', literature: { provider: 'aozora', work: 'w2', textSha256: 'h2' } },
      null, { id: 4 },
    ], expected);
    expect(picked.size).toBe(0);
  });

  it('조회는 provider 하나로 한 번 — 고른 열만, 오류는 throw', async () => {
    const calls = [];
    const query = {
      select(cols) { calls.push(['select', cols]); return this; },
      eq(col, value) { calls.push(['eq', col, value]); return this; },
      limit: async (n) => { calls.push(['limit', n]); return { data: [row(1, 'w1', 'public')], error: null }; },
    };
    const picked = await fetchArtChapterIndex({ from: (table) => { calls.push(['from', table]); return query; } }, expected);
    expect(calls).toEqual([['from', 'reading_materials'], ['select', ART_READING_SELECT], ['eq', 'processed_json->metadata->literature->>provider', 'art'], ['limit', 500]]);
    expect(picked.get('w1').id).toBe('1');
    const failing = { from: () => ({ select() { return this; }, eq() { return this; }, limit: async () => ({ data: null, error: new Error('x') }) }) };
    await expect(fetchArtChapterIndex(failing, expected)).rejects.toThrow('x');
  });
});

describe('화면 배선', () => {
  it('클라이언트 모듈은 카탈로그 JSON을 싣지 않는다 — 목록 값은 서버(발견·/art 페이지)가 넘긴다', () => {
    for (const file of ['src/lib/artReadingIndex.js', 'src/components/art/ArtReadingList.jsx', 'src/components/art/ArtWorkOpen.jsx']) {
      expect(read(file), file).not.toMatch(/content\/art|artBook(?:\.js)?['"]|artReading['"]|artCatalog/);
    }
    const discover = read('src/app/(app)/discover/page.jsx');
    expect(discover).toContain('<ArtReadingList items={artReadingItems()} curationOrder={[...ART_PUBLISHED_CURATIONS]} />');
  });

  it('카드는 서재를 거치지 않고 바로 뷰어 — 서재 담기는 뷰어 머리의 선택 버튼(LibrarySaveButton) 그대로', () => {
    const list = read('src/components/art/ArtReadingList.jsx');
    expect(list).toContain('href={`/viewer/${chapter.id}`}');
    expect(list).not.toMatch(/runLibraryOperation|library_operation/);
    expect(list).toContain("chapter.visibility !== 'public' && <span className=\"art-reading__private\"> · 비공개 미리보기</span>");
    expect(read('src/views/ViewerPage.jsx')).toContain('{!classStudyActive&&<LibrarySaveButton material={material}/>}');
  });

  it('/art/<작품>: 카탈로그에 없는 작품은 404, 읽을 장이 있으면 뷰어로 넘기고 없으면 안내', () => {
    const page = read('src/app/(app)/art/[work]/page.jsx');
    expect(page).toContain('if (!item) notFound();');
    const open = read('src/components/art/ArtWorkOpen.jsx');
    expect(open).toContain('router.replace(`/viewer/${chapter.id}`)');
    expect(open).toContain('아직 읽을 수 없는 작품이에요.');
  });

  it('목록 CSS: 색 리터럴·뷰포트 쿼리 없음, 누르는 자리 44px, 키보드 초점', () => {
    const css = read('src/components/art/art-reading.css');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|@media/);
    expect(css).toContain('container: art-reading / inline-size;');
    expect(css).toMatch(/\.art-reading__chips button \{[^}]*min-height: 44px/);
    expect(css).toContain(':focus-visible');
  });
});
