'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { libraryReaderHref } from '@/lib/libraryReturn';
import { lessonGroups } from '@/lib/bookNavigation';
import { bookResume } from '@/lib/webNavigation';
import { BOOK_ID, bookHref as textbookHref } from '@/lib/textbook/contract';
import BookCover from './BookCover';
import LibrarySaveButton from '@/components/library/LibrarySaveButton';
import {LibraryReturnLink} from '@/components/web/LibraryReaderLink';

// 전체 목차 펼침(showAll)은 BookReader가 든다 — 표지 자리(BOOK-HOME-RESTORE-001)와 함께 이 기록에 남아, 다른 화면에서 뒤로 와
// 표지가 다시 붙어도 같은 높이로 펼쳐진다. 따로 쓰면(props 없음) 지금처럼 이 부품이 든다.
// openParts = 돌아온 기록에서 열려 있던 파트(없으면 기본: 지금 파트만 열림).
export default function BookHome({ book, preview=false, progress, hasProgress = false, ready = true, showAll: heldAll, onShowAll, openParts = null }) {
  const bookId = book.bookId || BOOK_ID;
  const level = book.level || 'N5';
  const bookHref = (edition, page = 'cover') => textbookHref(edition, page, bookId);
  const [ownAll, setOwnAll] = useState(false);
  const showAll = onShowAll ? !!heldAll : ownAll, setShowAll = onShowAll || setOwnAll;
  const params = useSearchParams();
  const returnTo = params.get('returnTo');
  const readerHref = page => returnTo ? libraryReaderHref(bookHref(book.edition, page), returnTo) : bookHref(book.edition, page);
  const resume = bookResume(book, progress, hasProgress);
  const current = resume.lesson;
  const groups = lessonGroups(book.lessons);
  return <div className="manabi-page manabi-book-home"><p className="manabi-breadcrumb"><LibraryReturnLink onlyWithContext/><Link href="/lessons" prefetch={false}>교재</Link><span>/</span>일본어 · {level}</p>
    {level === 'N4' ? <>
    <section className="manabi-book-hero"><BookCover level={level} title={book.title} /><div><p className="manabi-eyebrow">일본어 · {level}{preview && ' · 검수 중'}</p><h1>{book.title}</h1><div className="manabi-row"><a className="manabi-button" href={readerHref(resume.page)}>{!ready ? '읽기 열기' : resume.started ? `${String(current.number).padStart(2, '0')}과 이어 읽기` : '첫 과부터 시작하기'} →</a>{resume.started && resume.page !== `${current.id}-start` && <a className="manabi-link" href={readerHref(`${current.id}-start`)}>{String(current.number).padStart(2, '0')}과 처음부터</a>}</div></div></section>
    </> : <>
    <section className="manabi-book-hero"><BookCover /><div><p className="manabi-eyebrow">일본어 · {level}{preview && ' · 검수 중'}</p><h1>작은 문장으로<br />시작하는 일본어</h1><div className="manabi-row"><a className="manabi-button" href={readerHref(resume.page)}>{!ready ? '읽기 열기' : resume.started ? `${String(current.number).padStart(2, '0')}과 이어 읽기` : '첫 과부터 시작하기'} →</a>{resume.started && resume.page !== `${current.id}-start` && <a className="manabi-link" href={readerHref(`${current.id}-start`)}>{String(current.number).padStart(2, '0')}과 처음부터</a>}</div></div></section>
    </>}
    {!preview&&<LibrarySaveButton edition={book.edition} bookTitle={`일본어 ${level}`}/>}
    <div className="manabi-book-body"><section><div className="manabi-section-heading"><h2>목차</h2><span>{resume.completed} / {resume.total}과 학습</span></div>
      <div className="manabi-tabs" aria-label="목차 범위"><button type="button" aria-pressed={!showAll} onClick={() => setShowAll(false)}>현재 파트</button><button type="button" aria-pressed={showAll} onClick={() => setShowAll(true)}>전체 {resume.total}과</button></div>
      {groups.map((group, i) => (showAll || group.title === current.part) && <details key={`${group.title}:${showAll}`} className="manabi-toc-group" data-toc-part={group.title} open={openParts ? openParts.includes(group.title) : group.title === current.part}><summary><span>{String(i + 1).padStart(2, '0')}</span><strong>{group.title}</strong><small>{String(group.lessons[0].number).padStart(2, '0')}–{String(group.lessons.at(-1).number).padStart(2, '0')}과</small></summary><ol>{group.lessons.map(lesson => <li key={lesson.id} className={lesson.id === current.id ? 'is-current' : ''}><a href={readerHref(`${lesson.id}-start`)}><span>{String(lesson.number).padStart(2, '0')}</span><strong>{lesson.title}</strong><small>{progress.completed.includes(lesson.id) ? '학습함 ✓' : lesson.id === current.id && resume.started ? '읽는 중 →' : '→'}</small></a></li>)}</ol></details>)}
    </section><aside className="manabi-book-tools"><h2>학습 도구</h2><a href={readerHref('guide-start')}>{level === 'N4' ? '책 사용법 · N5에서 이어가기' : '책 사용법 · 문자 준비'}</a><a href={readerHref('reference-start')}>{level === 'N4' ? '단어·문형 찾아보기' : '단어·문형·한자 찾기'}</a><Link prefetch={false} href={`/books/${bookId}/review?edition=${book.edition}`}>담은 표현</Link><Link prefetch={false} href={`/books/${bookId}/materials?edition=${book.edition}`}>함께 읽기 · 내 자료</Link><details className="book-scope"><summary>교재 안내</summary><p>판본 {book.edition.slice(0, 8)} · {resume.total}과</p><p>{level === 'N4' ? 'N5의 문장을 연결해 상황을 설명하고, 조정하고, 부탁하는 문법·어휘·읽기를 다룹니다.' : '일상 회화와 N5 기초 문법·어휘·읽기를 순서대로 다룹니다.'} 학습 완료 수는 읽기 기록이며 시험 준비도나 정답률을 뜻하지 않아요.</p>{level === 'N4' && <p>음성과 PDF는 아직 제공하지 않아요. 대화는 대본으로 확인해 주세요.</p>}</details><div className="manabi-reading-record"><p>읽던 위치와 마친 과는<br />이 브라우저에 저장돼요.</p></div></aside></div>
  </div>;
}
