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
    expect(html).not.toMatch(/href=/);
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
    // 본문 위치(#u01-…)는 서버가 모른다 — 붙은 뒤 그리기 전에 보고 전역 대기로 바꾼다(하이드레이션 불일치 0).
    expect(sliceBetween(source, 'const [reader, setReader] = useState(false);', 'return (')).toContain('useLayoutEffect(() => { setReader(/^#(?!cover$)./.test(window.location.hash)); }, [pathname]);');
  });
});
