'use client';
import { useLayoutEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import BookCover from '@/components/books/BookCover';
import { SkeletonLine, SkeletonRegion } from '@/components/Skeleton';
import BookReaderSkeleton from '@/components/books/BookReaderSkeleton';
import { HASH_GATE, hashGate, readerEntry } from '@/components/books/bookEntryGate';
import AppLoading from '../loading';

/**
 * 교재 첫 화면 대기(LOADING-SKELETON-001 연장 — BOOK-SKELETON-001). /books/japanese-n5에 들어오면 서버가 판본을 확인하는 동안
 * 전역 「화면 불러오는 중…」 스피너 뒤 빈 화면이 이어지던 자리다. 실제 화면(BookHome)의 **같은 클래스**로 책 머리 · 목차를
 * 그린다 — 늘 같은 글(갈래 · 표지 · 제목 · 「목차」 · 학습 도구 이름)은 글자 그대로, 사람마다 다른 글(과 이름 · 진도)만 회색 줄.
 * 칸은 href 없는 <a> · tabIndex -1 버튼(초점 · 이동 없음)이라 실제 칸 스타일을 그대로 받는다.
 * 함께 읽기 · 담은 표현은 모양이 달라 전과 같은 전역 대기를 쓴다.
 * 본문 위치(#u01-…)로 여는 읽기 화면은 본문 골격(BookReaderSkeleton — BOOK-ENTRY-SKELETON-001)이다. hash는 서버가 모르므로
 * 서버 · 하이드레이션 첫 그림은 늘 「감춤 한 줄(HASH_GATE) + 꺼진 본문 골격 + 표지 골격」이고, 하드 로드는 그 한 줄이 칠하기 전에
 * 표지 골격을 끄고 본문 골격을 켠다. 링크 이동(붙은 뒤)은 그리기 전(layout effect)에 보고 본문 골격만 그린다(불일치 0).
 */
export default function Loading() {
  const pathname = usePathname();
  const [reader, setReader] = useState(false);
  useLayoutEffect(() => { setReader(readerEntry()); }, [pathname]);
  // 교재가 아닌 화면(오류 등)으로 끝나도 감춤을 남기지 않는다 — 교재가 그려지면 BookReader가 같은 그림에서 다시 정한다.
  useLayoutEffect(() => () => hashGate(false), []);
  if (pathname !== '/books/japanese-n5') return <AppLoading />;
  if (reader) return <div className="book-reader"><BookReaderSkeleton announce /></div>;
  return (<>
    <script dangerouslySetInnerHTML={{ __html: HASH_GATE }} />
    <div className="book-reader"><BookReaderSkeleton gated /></div>
    <SkeletonRegion className="manabi-page manabi-book-home" label="교재" announce>
      <p className="manabi-breadcrumb" aria-hidden="true"><a>교재</a><span>/</span>일본어 · N5</p>
      <section className="manabi-book-hero" aria-hidden="true">
        <BookCover />
        <div>
          <p className="manabi-eyebrow">일본어 · N5</p>
          <h1>작은 문장으로<br />시작하는 일본어</h1>
          <div className="manabi-row"><a className="manabi-button"><SkeletonLine width="7.5em" /></a></div>
        </div>
      </section>
      <div className="manabi-book-body" aria-hidden="true">
        <section>
          <div className="manabi-section-heading"><h2>목차</h2><span><SkeletonLine width="6em" /></span></div>
          <div className="manabi-tabs">
            <button type="button" tabIndex={-1} aria-pressed="true">현재 파트</button>
            <button type="button" tabIndex={-1} aria-pressed="false">전체 <SkeletonLine width="1.4em" />과</button>
          </div>
          <details className="manabi-toc-group" open>
            <summary tabIndex={-1}><span><SkeletonLine width="1.2em" /></span><strong><SkeletonLine width="9em" /></strong><small><SkeletonLine width="3.6em" /></small></summary>
            <ol>
              {[0, 1, 2, 3, 4].map(i => <li key={i}><a>
                <span><SkeletonLine width="1.2em" /></span>
                <strong><SkeletonLine width={['62%', '48%', '56%', '40%', '58%'][i]} /></strong>
                <small>→</small>
              </a></li>)}
            </ol>
          </details>
        </section>
        <aside className="manabi-book-tools">
          <h2>학습 도구</h2>
          <a>책 사용법 · 문자 준비</a><a>단어·문형·한자 찾기</a><a>담은 표현</a><a>함께 읽기 · 내 자료</a>
          <details className="book-scope"><summary tabIndex={-1}>교재 안내</summary></details>
          <div className="manabi-reading-record"><p>읽던 위치와 마친 과는<br />이 브라우저에 저장돼요.</p></div>
        </aside>
      </div>
    </SkeletonRegion>
  </>);
}
