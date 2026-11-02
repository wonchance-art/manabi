'use client';
// 책장(/lessons) — 오너 승인 목업(SHELF-REDESIGN-001, 2026-11-02 KST): 제목 바로 아래 언어 탭(일본어 · 중국어 · 영어 · 프랑스어 · 전체),
// 읽은 기록이 있을 때만 한 줄 「이어 하기」, 그 아래 「책」 → 「단어 · 문형」(나온 책이 없는 언어는 단어 타일이 먼저, 책은 「준비 중」 한 줄).
// 표지 줄과 타일 줄은 같은 격자(.shelf-row)라 PC에서는 N5 표지가 N5 타일 바로 위에, 휴대폰에서는 둘 다 150px 가로 줄이다.
// 정적 판(ISR — LessonsShelf)이라 서버 · 첫 그림에는 기록이 없다: 「이어 하기」 · 표지 진도는 붙은 뒤 이 브라우저의 기록(useReadingProgress)으로 그린다.
// 줄 자리는 그리기 전 한 줄(bookEntryGate.shelfResumeHintScript)이 잡는다 — 기록이 없는 손님은 서버 · 붙은 뒤 모두 줄이 없다.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { BOOK_SERIES } from '@/lib/bookNavigation';
import { bookResume } from '@/lib/webNavigation';
import { BOOK_ID, bookHref } from '@/lib/textbook/contract';
import BookCover from './BookCover';
import LevelTiles, { shelfRowClass } from '@/components/levels/LevelTiles';
import useReadingProgress from './useReadingProgress';
import { clearShelfResumeHint, shelfResumeHintScript } from './bookEntryGate';

const pad = number => String(number).padStart(2, '0');
// 발행 판본은 지금 일본어 책뿐이다(LessonsShelf가 등록 교재를 모두 받는다) — 다른 언어는 「준비 중」 한 줄.
const booksOf = (books, language) => language === 'Japanese' ? books : [];

// 책마다 읽은 자리 — 같은 훅(useReadingProgress: 저장 키 · 계정 · 다른 탭 동기화)을 책 수만큼 한 단씩 겹쳐 부른다(훅을 반복문에서 부르지 않는다).
// children(records) — records[i] = { book, ready, resume(진짜 읽은 자리가 있을 때만), updatedAt }.
function WithProgress({ books, done = [], children }) {
  if (!books.length) return children(done);
  return <ProgressStep book={books[0]} rest={books.slice(1)} done={done}>{children}</ProgressStep>;
}
function ProgressStep({ book, rest, done, children }) {
  const local = useReadingProgress(book.edition, book.bookId || BOOK_ID);
  const resume = local.ready ? bookResume(book, local.progress, local.hasProgress) : null;
  return <WithProgress books={rest} done={[...done, { book, ready: local.ready, resume: resume?.started ? resume : null, updatedAt: local.updatedAt }]}>{children}</WithProgress>;
}
/** 가장 최근에 읽은 책 — 시각 없는 옛 기록은 가장 오래된 것으로 본다(같으면 책장 순서). */
export function latestReading(records) {
  const time = record => Date.parse(record.updatedAt) || 0;
  return records.filter(record => record.resume).reduce((best, record) => !best || time(record) > time(best) ? record : best, null);
}

function ContinueRow({ record, series }) {
  const { book, resume } = record;
  return <Link className="shelf-continue" href={bookHref(book.edition, resume.page, book.bookId || BOOK_ID)}>
    <span className="shelf-continue__mark" aria-hidden="true" lang="ja">{series.glyph}</span>
    <span className="shelf-continue__text"><small>이어 하기 · {series.name} {book.level || 'N5'}</small><strong>{pad(resume.lesson.number)}과 · {resume.lesson.title}</strong></span>
    <span className="shelf-continue__count"><span aria-hidden="true">{resume.completed}/{resume.total}</span><span className="sr-only">{resume.total}과 중 {resume.completed}과 학습 · 이 브라우저의 기록</span></span>
    <span className="shelf-continue__go" aria-hidden="true">→</span>
  </Link>;
}

function ShelfContinue({ records, seriesOf }) {
  const ready = records.every(record => record.ready);
  useEffect(() => { if (ready) clearShelfResumeHint(); }, [ready]);
  if (ready) {
    const latest = latestReading(records);
    return latest ? <div className="shelf-continue-hold"><ContinueRow record={latest} series={seriesOf(latest)} /></div> : null;
  }
  const series = seriesOf(records[0]);
  const hint = shelfResumeHintScript(records.map(record => record.book));
  // 붙기 전(서버 · 첫 그림) — 그리기 전 한 줄과, 그 한 줄이 켜는 빈 줄(같은 높이). 기록이 없으면 둘 다 보이지 않는다.
  return hint ? <div className="shelf-continue-hold"><script dangerouslySetInnerHTML={{ __html: hint }} />
    <div className="shelf-continue shelf-continue--ghost" aria-hidden="true"><span className="shelf-continue__mark" lang="ja">{series.glyph}</span><span className="shelf-continue__text"><small>이어 하기</small><strong>00과</strong></span></div></div> : null;
}

export default function Bookshelf({ book, books = book ? [book] : [], initialLang, levelTiles = {} }) {
  const { profile } = useAuth();
  const [selected, setSelected] = useState(BOOK_SERIES.some(s => s.language === initialLang) ? initialLang : 'all');
  const all = selected === 'all';
  const shown = all ? BOOK_SERIES : BOOK_SERIES.filter(item => item.language === selected);
  const covers = shown.flatMap(item => booksOf(books, item.language).map(current => ({ item, current })));
  const failed = !books.length;
  // 「준비 중」 한 줄 — 발행 책이 없는 언어. 일본어 책을 못 받은 것(실패)은 준비 중이 아니라 다시 시도 안내다.
  const pending = shown.filter(item => !booksOf(books, item.language).length && !(failed && item.language === 'Japanese'));
  const tiles = levelTiles[selected] || [];
  const tileSection = tiles.length > 0 && <LevelTiles language={selected} tiles={tiles} />;
  return <div className="manabi-page manabi-bookshelf"><header className="manabi-page-heading"><h1>교재</h1></header>
    <div className="shelf-language-tabs" aria-label="교재 언어">{BOOK_SERIES.map(item => <button key={item.id} type="button" aria-pressed={selected === item.language} onClick={() => setSelected(item.language)} style={{ '--series-color': item.color }}>{item.name}</button>)}<button type="button" aria-pressed={all} onClick={() => setSelected('all')}>전체</button></div>
    {/* 기록은 탭과 상관없이 모든 책을 한 번 읽는다 — 탭을 바꿔도 다시 읽지 않는다(줄이 한 박자 늦게 서지 않게). */}
    <WithProgress books={books}>{allRecords => {
      const records = allRecords.filter(record => covers.some(({ current }) => current === record.book));
      const recordOf = current => records.find(record => record.book === current);
      const bookSection = <section className="shelf-books" aria-labelledby="shelf-books-h"><h2 id="shelf-books-h" className="shelf-section-h">책</h2>
        {failed && shown.some(item => item.language === 'Japanese') && <p className="manabi-inline-state" role="status">발행 교재를 불러오지 못했어요. <button type="button" onClick={() => location.reload()}>다시 시도</button></p>}
        {covers.length > 0 && <div className={`manabi-series-shelf ${shelfRowClass(tiles.length)}`}>{covers.map(({ item, current }) => {
          const level = current.level || 'N5', resume = recordOf(current)?.resume;
          return <Link className="manabi-series-book" key={current.bookId || current.edition} href={bookHref(current.edition, 'cover', current.bookId || BOOK_ID)} aria-label={`일본어 ${level} 책 둘러보기`}><BookCover language={item.language} compact level={current.level} title={current.title} />
            <span className="manabi-series-caption"><strong>{all ? `${item.name} ${level}` : level}</strong>{resume ? <small className="is-progress">{resume.completed}/{resume.total}과</small> : <small>{current.lessons.length}과</small>}</span></Link>;
        })}</div>}
        {pending.map(item => <p className="shelf-pending" key={item.id}><span>{item.name} 교재</span><span>준비 중</span></p>)}
      </section>;
      return <>
        {records.length > 0 && <ShelfContinue records={records} seriesOf={record => covers.find(({ current }) => current === record.book).item} />}
        {covers.length > 0 ? <>{bookSection}{tileSection}</> : <>{tileSection}{bookSection}</>}
      </>;
    }}</WithProgress>
    {!all && <p className="shelf-public"><Link className="shelf-public__link" href={`/materials?tab=public&lang=${selected}`}>이 언어의 공개 읽을거리<span aria-hidden="true">→</span></Link></p>}
    {profile?.role === 'admin' && <p className="manabi-admin-entry"><Link href="/admin/books/japanese-n5">N5 원고 편집</Link><Link href="/admin/books/japanese-n4">N4 원고 편집·검수</Link><Link href="/admin/books/japanese-n3">N3 원고 편집·검수</Link><Link href="/admin/legacy-textbooks">기존 교재 보관함 →</Link></p>}
  </div>;
}
