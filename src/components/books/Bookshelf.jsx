'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { BOOK_SERIES } from '@/lib/bookNavigation';
import { bookHref } from '@/lib/textbook/contract';
import BookCover from './BookCover';
import useReadingProgress from './useReadingProgress';

function ContinueBook({ book }) {
  const { progress } = useReadingProgress(book.edition);
  const lesson = book.lessons.find(item => progress.page.startsWith(item.id)) || book.lessons[0];
  const started = progress.page !== 'u01-start' || progress.completed.length > 0;
  return <section className="manabi-continue" aria-label="읽던 교재">
    <div className="manabi-continue__copy"><p className="manabi-eyebrow">{started ? '읽던 곳에서 이어서' : '한 문장부터 시작해요'}</p>
      <h2>작은 문장으로<br />시작하는 일본어</h2><p className="manabi-muted manabi-small">일본어 N5 <span className="manabi-separator">/</span> 42과</p>
      <div className="manabi-location"><span className="manabi-lesson-number">{String(lesson.number).padStart(2, '0')}<small>LESSON</small></span><div><strong>{lesson.title}</strong><p>{started ? '읽던 곳부터 이어서' : lesson.subtitle}</p></div></div>
      <div className="manabi-row"><Link className="manabi-button" href={bookHref(book.edition, progress.page)}>{started ? '이어서 읽기' : '공부 시작하기'} <span aria-hidden="true">↗</span></Link><Link className="manabi-link" href="/books/japanese-n5">책 둘러보기</Link></div>
      <div className="manabi-progress-row"><div className="manabi-progress" aria-hidden="true"><span style={{ width: `${progress.completed.length / 42 * 100}%` }} /></div><span>{progress.completed.length} / 42과 학습</span></div>
    </div><Link href="/books/japanese-n5" className="manabi-cover-stage" aria-label="일본어 N5 책 둘러보기"><BookCover /><span className="manabi-stage-caption" lang="ja">日本語のある毎日</span><small>언어마다, 나만의 한 권.</small></Link>
  </section>;
}

export default function Bookshelf({ book, initialLang }) {
  const { profile } = useAuth();
  const [selected, setSelected] = useState(() => BOOK_SERIES.find(series => series.language === initialLang && initialLang !== 'Japanese') || null);
  return <div className="manabi-page manabi-bookshelf"><header className="manabi-page-heading"><div><p className="manabi-eyebrow">MY BOOKSHELF</p><h1>나의 책장<span>.</span></h1></div>{book && <Link className="manabi-link manabi-link--ink" href={bookHref(book.edition, 'reference-start')}>단어·문형 찾기 ↗</Link>}</header>
    {book ? <ContinueBook book={book} /> : <section className="manabi-empty"><h2>한 권의 교재를 준비하고 있어요.</h2><p>잠시 후 다시 방문해 주세요.</p></section>}
    <div className="manabi-study-links"><Link href="/vocab"><span>01</span><div><strong>담은 표현 다시 보기</strong><small>내가 고른 문장을 다시 꺼내요.</small></div><i aria-hidden="true">↗</i></Link><Link href="/materials"><span>02</span><div><strong>책 밖으로 이어 읽기</strong><small>짧은 글과 내 자료</small></div><i aria-hidden="true">↗</i></Link></div>
    <div className="manabi-section-heading"><h2>네 언어, 나만의 한 권</h2><span>언어별 교재</span></div>
    <div className="manabi-series-shelf">{BOOK_SERIES.map(series => {
      const content = <><BookCover language={series.language} compact /><span className="manabi-series-caption"><strong>{series.name}</strong><small>{series.language === 'Japanese' && book ? 'N5 · 42과 교재' : '한 권으로 준비 중'}</small><i aria-hidden="true">↗</i></span></>;
      return series.language === 'Japanese' && book ? <Link className="manabi-series-book" key={series.id} href="/books/japanese-n5">{content}</Link> : <button className="manabi-series-book" type="button" key={series.id} onClick={() => setSelected(series)}>{content}</button>;
    })}</div>
    {selected && <section className="manabi-series-notice" role="status"><strong>{selected.name} 교재는 한 권의 흐름으로 준비 중이에요.</strong><button type="button" className="manabi-link" onClick={() => setSelected(null)}>닫기</button></section>}
    {profile?.role === 'admin' && <p className="manabi-admin-entry"><Link href="/admin/books/japanese-n5">새 교재 원고 편집</Link><Link href="/admin/legacy-textbooks">기존 교재 보관함 →</Link></p>}
  </div>;
}
