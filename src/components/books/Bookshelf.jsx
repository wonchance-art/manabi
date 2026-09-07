'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { BOOK_SERIES } from '@/lib/bookNavigation';
import { bookResume } from '@/lib/webNavigation';
import { bookHref } from '@/lib/textbook/contract';
import BookCover from './BookCover';
import useReadingProgress from './useReadingProgress';

function ContinueBook({ book }) {
  const local = useReadingProgress(book.edition);
  const resume = bookResume(book, local.progress, local.hasProgress);
  if (!resume) return null;
  return <section className="shelf-resume" aria-label="읽던 교재"><span className="shelf-resume__mark" aria-hidden="true">あ</span><div><p className="manabi-eyebrow">{resume.started ? '읽던 곳에서 이어서' : '나의 첫 일본어'}</p><h2>{String(resume.lesson.number).padStart(2, '0')}과 · {resume.lesson.title}</h2><p>{resume.completed} / {resume.total}과 학습 · 이 브라우저의 기록</p></div><Link className="manabi-button" href={bookHref(book.edition, resume.page)}>{resume.started ? '이어서 읽기' : '공부 시작하기'} ↗</Link></section>;
}
export default function Bookshelf({ book, initialLang }) {
  const { profile } = useAuth();
  const [selected, setSelected] = useState(BOOK_SERIES.some(s => s.language === initialLang) ? initialLang : 'all');
  const series = selected === 'all' ? BOOK_SERIES : BOOK_SERIES.filter(item => item.language === selected);
  return <div className="manabi-page manabi-bookshelf"><header className="manabi-page-heading"><div><p className="manabi-eyebrow">THE LANGUAGE COLLECTION / 교재</p><h1>네 언어.<br />나만의 한 권<span>.</span></h1></div><p className="shelf-intro">처음의 한 문장부터<br />내 생각을 말하는 날까지.</p></header>
    {book ? <ContinueBook book={book} /> : <section className="manabi-inline-state" role="status">발행 교재를 불러오지 못했어요. <button type="button" onClick={() => location.reload()}>다시 확인</button></section>}
    <div className="shelf-language-tabs" aria-label="교재 언어"><button type="button" aria-pressed={selected === 'all'} onClick={() => setSelected('all')}>전체 시리즈</button>{BOOK_SERIES.map(item => <button key={item.id} type="button" aria-pressed={selected === item.language} onClick={() => setSelected(item.language)} style={{ '--series-color': item.color }}>{item.name}</button>)}</div>
    <div className="manabi-series-shelf">{series.map(item => {
      const published = item.language === 'Japanese' && book;
      const content = <><span className="shelf-series-number">{String(BOOK_SERIES.indexOf(item) + 1).padStart(2, '0')} / {item.language.toUpperCase()}</span><BookCover language={item.language} compact /><span className="manabi-series-caption"><strong>{item.name}</strong><small>{published ? `N5 · ${book.lessons.length}과` : '한 권으로 준비 중'}</small>{published && <i aria-hidden="true">↗</i>}</span></>;
      return published ? <Link className="manabi-series-book" key={item.id} href={bookHref(book.edition)} aria-label="일본어 N5 책 둘러보기">{content}</Link> : <article className="manabi-series-book is-unpublished" key={item.id}>{content}</article>;
    })}</div>
    {selected !== 'all' && selected !== 'Japanese' && <p className="manabi-series-notice" role="status">이 언어의 새 교재를 준비하고 있어요. <Link className="manabi-link" href={`/materials?tab=public&lang=${selected}`}>공개 읽을거리 살펴보기 ↗</Link></p>}
    <div className="shelf-footnote"><div><p className="manabi-eyebrow">READ / REMEMBER / REPEAT</p><h2>한 권 안에서 배우고,<br />한 권 밖으로 이어가요.</h2></div><div><p>예문을 읽고, 마음에 남는 표현을 담고.<br />내 자료와 함께 나만의 읽기를 이어가세요.</p><div className="manabi-row"><Link className="manabi-link" href="/discover">문화와 읽을거리 ↗</Link><Link className="manabi-link" href="/vocab">담은 표현 복습 ↗</Link>{book && <Link className="manabi-link" href={bookHref(book.edition, 'reference-start')}>단어·문형 찾기 ↗</Link>}</div></div></div>
    {profile?.role === 'admin' && <p className="manabi-admin-entry"><Link href="/admin/books/japanese-n5">새 교재 원고 편집</Link><Link href="/admin/legacy-textbooks">기존 교재 보관함 →</Link></p>}
  </div>;
}
