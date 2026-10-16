import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween';

let pathname = '/books/japanese-n5';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import BookLoading from '../../app/(app)/books/loading';

// 교재 첫 화면 대기(BOOK-SKELETON-001 — LOADING-SKELETON-001 연장): /books/japanese-n5에 들어오면 전역 스피너 뒤
// 빈 화면(~0.4초)이 이어지던 자리를 실제 화면(BookHome)의 책 머리 · 목차 골격으로. 높이(CLS)는 빌드 프레임 측정이 본다.
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const FILE = 'src/app/(app)/books/loading.jsx';
const source = read(FILE);
const home = read('src/components/books/BookHome.jsx');
const render = (at) => { pathname = at; return renderToStaticMarkup(createElement(BookLoading)); };

describe('교재 대기 화면 — src/app/(app)/books/loading.jsx', () => {
  const html = render('/books/japanese-n5');
  it('파일이 있고, 전역 스피너가 아니라 골격이다(aria-busy + 「교재 불러오는 중…」 한 줄)', () => {
    expect(fs.existsSync(path.join(ROOT, FILE))).toBe(true);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('<span class="skeleton-sr" role="status">교재 불러오는 중…</span>');
    expect(html).not.toContain('spinner');
  });
  it('실제 화면(BookHome)과 같은 클래스 · 같은 고정 글 — 데이터가 들어와도 칸이 튀지 않게', () => {
    for (const cls of ['manabi-page manabi-book-home', 'manabi-breadcrumb', 'manabi-book-hero', 'manabi-eyebrow', 'manabi-book-body',
      'manabi-section-heading', 'manabi-tabs', 'manabi-toc-group', 'manabi-book-tools', 'book-scope', 'manabi-reading-record']) {
      expect(home).toContain(cls);
      expect(html).toContain(cls);
    }
    expect(home).toContain('<section className="manabi-book-hero"><BookCover />');
    expect(source).toContain("import BookCover from '@/components/books/BookCover';"); // 표지는 같은 부품
    expect(html).toContain('class="manabi-cover"');
    expect(home).toContain('<h1>작은 문장으로<br />시작하는 일본어</h1>');
    expect(html).toContain('<h1>작은 문장으로<br/>시작하는 일본어</h1>');
    for (const label of ['<h2>목차</h2>', '<h2>학습 도구</h2>', '책 사용법 · 문자 준비', '단어·문형·한자 찾기', '함께 읽기 · 내 자료', '교재 안내']) {
      expect(home).toContain(label);
      expect(html).toContain(label);
    }
    expect(sliceBetween(html, '<ol>', '</ol>').match(/<li>/g)).toHaveLength(5); // 처음 파트(처음 만난 사람과) 5과
  });
  it('자리표 칸은 이동 · 초점이 없다(href 0, 버튼 · 요약은 tabindex -1, 칸 전체 aria-hidden)', () => {
    expect(html.replace(/<script>[\s\S]*?<\/script>/, '')).not.toMatch(/href=/);
    expect(html.match(/<(button|summary)\b/g).length).toBe(html.match(/<(button|summary)\b[^>]*tabindex="-1"/g).length);
    for (const part of ['manabi-breadcrumb', 'manabi-book-hero', 'manabi-book-body']) expect(html).toContain(`class="${part}" aria-hidden="true"`);
  });
  it('색 리터럴 0 · 부품은 Skeleton.jsx · 반짝임은 모션 축소에서 멈춘다', () => {
    expect(source).toMatch(/import \{ SkeletonLine, SkeletonRegion \} from '@\/components\/Skeleton';/);
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|style=/i);
    expect(html).toContain('skeleton-line');
    expect(read('src/index.css')).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.skeleton, \.skeleton-line \{ animation: none; \}\s*\}/);
  });
  it('책 첫 화면이 아닌 곳(함께 읽기 · 담은 표현)은 모양이 달라 전과 같은 전역 대기', () => {
    for (const at of ['/books/japanese-n5/materials', '/books/japanese-n5/review']) {
      const other = render(at);
      expect(other).toContain('<p class="spinner-msg">화면 불러오는 중…</p>');
      expect(other).not.toContain('aria-busy');
    }
  });
});

// 본문 첫 그림 골격(BOOK-ENTRY-SKELETON-001): 본문 위치(#u01-…)로 하드 로드하면 붙기 전 110–340ms 표지 자리가 비어 있었다(GNB만).
describe('본문 위치 진입 — 감춤 한 줄 · 본문 골격', () => {
  const html = render('/books/japanese-n5');
  const reader = read('src/components/books/BookReader.jsx');
  const skeleton = read('src/components/books/BookReaderSkeleton.jsx');
  it('서버 첫 그림: 감춤 한 줄 → 꺼진 본문 골격(.book-reader 안) → 표지 골격 순서(한 줄이 둘보다 먼저 실행된다)', () => {
    const gate = html.indexOf('<script>(function(){'), body = html.indexOf('<div class="book-reader"><div class="manabi-reader-page book-entry-skeleton" aria-busy="true">'),
      cover = html.indexOf('class="manabi-page manabi-book-home" aria-busy="true"');
    expect(gate).toBeGreaterThanOrEqual(0);
    expect(body).toBeGreaterThan(gate);
    expect(cover).toBeGreaterThan(body);
    expect(html.match(/role="status"/g)).toHaveLength(1); // 알림은 표지 골격의 한 줄뿐 — 꺼진 본문 골격은 알리지 않는다
  });
  it('붙은 뒤(링크 이동)는 그리기 전에 판정해 본문 골격만, 교재가 아닌 화면으로 끝나도 감춤을 남기지 않는다', () => {
    expect(source).toContain('useLayoutEffect(() => { setReader(readerEntry()); }, [pathname]);');
    expect(source).toContain('if (reader) return <div className="book-reader"><BookReaderSkeleton announce /></div>;');
    expect(source).toContain('useLayoutEffect(() => () => hashGate(false), []);');
  });
  it('본문 골격은 실제 본문 화면과 같은 클래스 · 같은 고정 글, 이동 · 초점 0, 색 리터럴 0', () => {
    const body = sliceBetween(html, '<div class="manabi-reader-page book-entry-skeleton"', 'class="manabi-page manabi-book-home"');
    for (const cls of ['manabi-reader-page', 'manabi-reader-toolbar', 'manabi-reference-menu', 'manabi-reader-grid', 'manabi-reader-outline', 'manabi-reader-main',
      'manabi-mobile-toc', 'manabi-chapter-opening', 'manabi-chapter-subtitle', 'manabi-chapter-goal', 'manabi-chapter-number']) {
      expect(reader).toContain(cls);
      expect(body).toContain(cls);
    }
    for (const label of ['← 책 목차', '담은 표현', '참고 자료', '집중 읽기', '이 과의 목차']) { expect(reader).toContain(label); expect(body).toContain(label); }
    expect(body).toContain('일본어 · N5');
    expect(body).not.toMatch(/href=/);
    expect(body.match(/<(button|summary)\b/g).length).toBe(body.match(/<(button|summary)\b[^>]*tabindex="-1"/g).length);
    for (const part of ['manabi-reader-toolbar', 'manabi-reader-grid']) expect(body).toContain(`class="${part}" aria-hidden="true"`);
    expect(skeleton).toMatch(/import \{ SkeletonLine, SkeletonRegion \} from '@\/components\/Skeleton';/);
    expect(skeleton).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|style=/i);
    expect(body).toContain('skeleton-line'); // 모션 축소 정지는 .skeleton-line 공통 블록
  });
});
