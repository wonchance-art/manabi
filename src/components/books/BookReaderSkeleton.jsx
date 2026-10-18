'use client';
import { usePathname } from 'next/navigation';
import { SkeletonLine, SkeletonRegion } from '@/components/Skeleton';
// 「참고 자료」 메뉴 모양(.manabi-reference-menu)은 본문 CSS에만 있다 — BookReader보다 먼저 그려지는 골격이 직접 부른다
// (없으면 첫 진입 때 회색 「▶ 참고 자료」가 보였다가 「참고 자료 ⌄」로 바뀐다 · /ux-review 2026-10-17 KST).
import './reading-content.css';

/**
 * 본문 첫 그림 골격(BOOK-ENTRY-SKELETON-001). 본문 위치(#u01-…)로 바로 열 때 붙기 전 빈 자리(110–340ms)를 메운다.
 * 실제 본문 화면(BookReader의 manabi-reader-page)과 **같은 클래스**로 도구 줄 · 과 목차 · 과 머리를 그린다 — 늘 같은 글(← 책 목차 ·
 * 일본어 · N5 · 담은 표현 · 참고 자료 · 집중 읽기 · 이 과의 목차)은 그대로, 과마다 다른 글만 회색 줄. 이동 · 초점이 없다.
 * gated = 평소에는 꺼져 있고 HASH_GATE style이 켤 때만 보인다(.book-entry-skeleton — bookEntryGate). 감싼 .book-reader 안에 둔다.
 * lesson = 과 본문 머리(부제 · 목표 · 과 번호 · 도구 줄 「/ N과」). 과가 아닌 쪽(책 사용법 · 찾기 · 문화 읽기)은 실제 화면처럼 갈래 · 제목만.
 * gated일 때는 hash를 모르니 과 칸을 .book-entry-lesson으로 함께 보내고, 과가 아니면 HASH_GATE가 그 칸을 끈다.
 */
export default function BookReaderSkeleton({ gated = false, announce = false, lesson = true, level = null }) {
  const pathname = usePathname();
  const bookLevel = level || (pathname?.startsWith('/books/japanese-n4') ? 'N4' : 'N5');
  const part = (node) => (gated ? <span className="book-entry-lesson">{node}</span> : lesson ? node : null);
  const block = (Tag, className, node) => (gated ? <Tag className={`${className} book-entry-lesson`}>{node}</Tag> : lesson ? <Tag className={className}>{node}</Tag> : null);
  return (
    <SkeletonRegion className={`manabi-reader-page${gated ? ' book-entry-skeleton' : ''}`} label="교재" announce={announce}>
      <div className="manabi-reader-toolbar" aria-hidden="true">
        <a>← 책 목차</a><span>일본어 · {bookLevel}{part(<> / <SkeletonLine width="2.4em" /></>)}</span>
        <div>
          <a>담은 표현</a>
          <details className="manabi-reference-menu"><summary tabIndex={-1}>참고 자료</summary></details>
          <button type="button" tabIndex={-1} aria-pressed="false">집중 읽기</button>
        </div>
      </div>
      <div className="manabi-reader-grid" aria-hidden="true">
        <aside className="manabi-reader-outline">
          <p className="manabi-eyebrow"><SkeletonLine width="6em" /></p>
          <nav>{['70%', '55%', '80%', '62%', '48%', '66%'].map((width, i) => <a key={i}><SkeletonLine width={width} /></a>)}</nav>
        </aside>
        <div className="manabi-reader-main">
          <details className="manabi-mobile-toc"><summary tabIndex={-1}>이 과의 목차</summary></details>
          <header className="manabi-chapter-opening">
            <div>
              <p className="manabi-eyebrow"><SkeletonLine width="9em" /></p>
              {block('p', 'manabi-chapter-subtitle', <SkeletonLine width="11em" />)}
              <h1><SkeletonLine width="70%" /></h1>
              {block('p', 'manabi-chapter-goal', <SkeletonLine width="85%" />)}
            </div>
            {block('span', 'manabi-chapter-number', <SkeletonLine width="1.1em" />)}
          </header>
        </div>
      </div>
    </SkeletonRegion>
  );
}
