'use client';
import Link from 'next/link';
import { useState } from 'react';
import { lessonGroups } from '@/lib/bookNavigation';
import { bookResume } from '@/lib/webNavigation';
import { bookHref } from '@/lib/textbook/contract';
import BookCover from './BookCover';

export default function BookHome({ book, progress, hasProgress = false, ready = true }) {
  const [showAll, setShowAll] = useState(false);
  const resume = bookResume(book, progress, hasProgress);
  const current = resume.lesson;
  const groups = lessonGroups(book.lessons);
  return <div className="manabi-page manabi-book-home"><p className="manabi-breadcrumb"><Link href="/lessons">교재</Link><span>/</span>일본어 · N5</p>
    <section className="manabi-book-hero"><BookCover /><div><p className="manabi-eyebrow">JAPANESE · N5 / 발행 교재</p><h1>작은 문장으로<br />시작하는 일본어</h1><p className="manabi-muted">나를 소개하는 말부터, 일상을 나누는 대화까지.<br />장면과 예문으로 익히고, 대화와 연습으로 내 것으로 만들어요.</p><p className="book-edition">판본 {book.edition.slice(0, 8)} · {resume.total}과</p><div className="manabi-row"><a className="manabi-button" href={bookHref(book.edition, resume.page)}>{!ready ? '읽기 열기' : resume.started ? `${String(current.number).padStart(2, '0')}과 이어 읽기` : '첫 과부터 시작하기'} →</a><a className="manabi-link" href={bookHref(book.edition, `${current.id}-start`)}>{String(current.number).padStart(2, '0')}과 처음부터</a></div></div></section>
    <div className="manabi-book-body"><section><div className="manabi-section-heading"><h2>한 권의 흐름</h2><span>{resume.completed} / {resume.total}과 학습</span></div>
      <div className="manabi-tabs" aria-label="목차 범위"><button type="button" aria-pressed={!showAll} onClick={() => setShowAll(false)}>현재 파트</button><button type="button" aria-pressed={showAll} onClick={() => setShowAll(true)}>전체 {resume.total}과</button></div>
      {groups.map((group, i) => (showAll || group.title === current.part) && <details key={`${group.title}:${showAll}`} className="manabi-toc-group" open={group.title === current.part}><summary><span>{String(i + 1).padStart(2, '0')}</span><strong>{group.title}</strong><small>{String(group.lessons[0].number).padStart(2, '0')}–{String(group.lessons.at(-1).number).padStart(2, '0')}과</small></summary><ol>{group.lessons.map(lesson => <li key={lesson.id} className={lesson.id === current.id ? 'is-current' : ''}><a href={bookHref(book.edition, `${lesson.id}-start`)}><span>{String(lesson.number).padStart(2, '0')}</span><strong>{lesson.title}</strong><small>{progress.completed.includes(lesson.id) ? '학습함 ✓' : lesson.id === current.id && resume.started ? '읽는 중 →' : '→'}</small></a></li>)}</ol></details>)}
    </section><aside className="manabi-book-tools"><h2>책 안의 작은 서랍</h2><a href={bookHref(book.edition, 'guide-start')}>책 사용법 · 문자 준비 <span>↗</span></a><a href={bookHref(book.edition, 'reference-start')}>단어·문형·한자 찾기 <span>↗</span></a><Link href={`/books/japanese-n5/review?edition=${book.edition}`}>담은 표현 복습하기 <span>↗</span></Link><Link href={`/books/japanese-n5/materials?edition=${book.edition}`}>함께 읽기 · 내 자료 <span>↗</span></Link><details className="book-scope"><summary>학습 범위와 기록 안내</summary><p>일상 회화와 N5 기초 문법·어휘·읽기를 순서대로 다룹니다. 학습 완료 수는 읽기 기록이며 시험 준비도나 정답률을 뜻하지 않아요.</p></details><div className="manabi-reading-record"><small>학습 기록</small><strong>{resume.completed}<small> / {resume.total}과</small></strong><div className="manabi-progress" aria-hidden="true"><span style={{ width: `${resume.completed / resume.total * 100}%` }} /></div><p>읽던 위치와 마친 과를<br />이 브라우저에 기억해요.</p></div></aside></div>
  </div>;
}
